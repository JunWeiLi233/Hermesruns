package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RaceCourseMapService {
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final int MAX_URL_LENGTH = 500;
    private static final int MAX_IMAGE_BYTES = 6 * 1024 * 1024;
    private static final int MAX_CANDIDATES = 6;
    private static final int TARGET_ELEVATION_SAMPLE_COUNT = 25;
    private static final int MIN_ALIGNMENT_CONFIDENCE = 68;
    private static final double EARTH_RADIUS_KM = 6371.0088;
    private static final Pattern MEDIA_URL_PATTERN = Pattern.compile("murl&quot;:&quot;([^&]+?)&quot;", Pattern.CASE_INSENSITIVE);
    private static final Pattern META_IMAGE_PATTERN = Pattern.compile(
            "<meta[^>]+(?:property|name)=[\"'](?:og:image|og:image:url|twitter:image|twitter:image:src)[\"'][^>]+content=[\"']([^\"'#]+(?:\\?[^\"']*)?)[\"'][^>]*>|"
                    + "<meta[^>]+content=[\"']([^\"'#]+(?:\\?[^\"']*)?)[\"'][^>]+(?:property|name)=[\"'](?:og:image|og:image:url|twitter:image|twitter:image:src)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern IMG_PATTERN = Pattern.compile(
            "<img[^>]+(?:src|data-src|data-lazy-src)=[\"']([^\"']+)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern HREF_PATTERN = Pattern.compile(
            "<a[^>]+href=[\"']([^\"']+)[\"'][^>]*>",
            Pattern.CASE_INSENSITIVE
    );
    private static final List<String> COURSE_HINTS = List.of(
            "course", "route", "map", "track", "parcours", "percorso", "strecke", "cours", "plan"
    );
    private static final List<String> REJECT_HINTS = List.of(
            "logo", "icon", "badge", "hero", "banner", "sponsor", "partner", "medal", "podium"
    );

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final SystemConfigService systemConfigService;
    private final RaceCourseMapAssetRepository raceCourseMapAssetRepository;
    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    @Value("${app.ai.model:gemini-2.0-flash}")
    private String aiModel;

    @Value("${app.ai.provider:gemini}")
    private String aiProvider;

    public RaceCourseMapService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository raceCourseMapAssetRepository
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.systemConfigService = systemConfigService;
        this.raceCourseMapAssetRepository = raceCourseMapAssetRepository;
    }

    public RaceCourseMapResult resolveCourseMap(
            String raceName,
            String city,
            String country,
            String websiteUrl,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        String cacheKey = String.join("||",
                normalize(raceName),
                normalize(city),
                normalize(country),
                normalize(websiteUrl),
                normalizeNumber(latitude),
                normalizeNumber(longitude),
                normalizeNumber(distanceKm)
        );
        CachedResult cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired() && !shouldRefresh(cached.result())) {
            return cached.result();
        }

        RaceCourseMapResult resolved = doResolveCourseMap(raceName, city, country, websiteUrl, latitude, longitude, distanceKm);
        cache.put(cacheKey, new CachedResult(resolved, Instant.now().plus(CACHE_TTL)));
        return resolved;
    }

    public RaceCourseMapResult resolveCourseMapWithStorage(
            String raceId,
            String raceName,
            String city,
            String country,
            String websiteUrl,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (asset != null && asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            return toResult(asset, true);
        }

        RaceCourseMapResult resolved = resolveCourseMap(raceName, city, country, websiteUrl, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() != null && !resolved.imageUrl().isBlank()) || resolved.courseMapDetected()) {
            persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, "system-scan");
        }
        return resolved;
    }

    public RaceCourseMapResult uploadPendingCourseMap(
            String raceId,
            String raceName,
            String city,
            String country,
            String websiteUrl,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String imageReference,
            String actorEmail
    ) {
        String validated = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(imageReference, 2_000_000, "imageUrl");
        byte[] imageBytes = readImageBytes(validated);
        if (imageBytes == null) {
            throw new IllegalArgumentException("Unable to read course-map image.");
        }
        String source = validated.startsWith("data:image/") ? "admin-upload" : "admin-image-url";
        RaceCourseMapResult resolved = analyzeResolvedImage(source, validated, imageBytes, raceName, city, country, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() == null || resolved.imageUrl().isBlank()) && (validated.startsWith("http") || validated.startsWith("data:image/"))) {
            resolved = new RaceCourseMapResult(validated, source, false, 0, "Hermes saved the upload but could not align it confidently yet.", null, List.of(), List.of(), null, false);
        }
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail);
        return resolved;
    }

    public RaceCourseMapResult scanPendingCourseMap(
            String raceId,
            String raceName,
            String city,
            String country,
            String websiteUrl,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String actorEmail
    ) {
        RaceCourseMapResult resolved = resolveCourseMap(raceName, city, country, websiteUrl, latitude, longitude, distanceKm);
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail);
        return resolved;
    }

    public void acceptPendingCourseMap(String raceId, String actorEmail) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId)
                .orElseThrow(() -> new IllegalArgumentException("Race course-map asset not found."));
        if (asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("No pending course-map preview to publish.");
        }
        asset.setLiveImageUrl(asset.getPendingImageUrl());
        asset.setLiveSource(asset.getPendingSource());
        asset.setLiveConfidence(asset.getPendingConfidence());
        asset.setLiveSummary(asset.getPendingSummary());
        asset.setLiveOverlayBoundsJson(asset.getPendingOverlayBoundsJson());
        asset.setLiveRoutePointsJson(asset.getPendingRoutePointsJson());
        asset.setLiveElevationSamplesJson(asset.getPendingElevationSamplesJson());
        asset.setLiveTotalClimbMeters(asset.getPendingTotalClimbMeters());
        asset.setLiveAiAssisted(asset.getPendingAiAssisted());
        asset.setLiveUpdatedAt(LocalDateTime.now());
        asset.setLiveUpdatedByEmail(actorEmail);
        raceCourseMapAssetRepository.save(asset);
    }

    public void clearPendingCourseMap(String raceId) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId)
                .orElseThrow(() -> new IllegalArgumentException("Race course-map asset not found."));
        clearPending(asset);
        raceCourseMapAssetRepository.save(asset);
    }

    public List<RaceCourseMapAdminRow> listRaceCourseMaps() {
        return raceCourseMapAssetRepository.findAll().stream()
                .map(this::toAdminRow)
                .toList();
    }

    private RaceCourseMapResult doResolveCourseMap(
            String raceName,
            String city,
            String country,
            String websiteUrl,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        String safeWebsite = SafeUrlValidator.validateHttpUrlOrNull(websiteUrl, MAX_URL_LENGTH, "officialWebsite");
        LinkedHashMap<String, CourseMapCandidate> candidates = collectCandidates(raceName, city, country, safeWebsite);
        if (candidates.isEmpty()) {
            return emptyResult("No course-map candidate found yet.");
        }

        List<CourseMapCandidate> ranked = candidates.values().stream()
                .sorted((left, right) -> Integer.compare(right.score(), left.score()))
                .limit(MAX_CANDIDATES)
                .toList();

        for (CourseMapCandidate candidate : ranked) {
            byte[] imageBytes = fetchImageBytes(candidate.imageUrl());
            if (imageBytes == null) continue;

            BufferedImage decoded = decodeImage(imageBytes);
            if (decoded == null || decoded.getWidth() < 320 || decoded.getHeight() < 180) continue;

            if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
                return candidateOnlyResult(candidate, "AI course-map alignment is not configured.");
            }

            CourseMapAlignment alignment = analyzeCandidate(candidate, imageBytes, raceName, city, country, latitude, longitude, distanceKm);
            if (alignment == null || !alignment.isCourseMap()) continue;
            if (alignment.confidence() < MIN_ALIGNMENT_CONFIDENCE) continue;

            List<RoutePoint> routePoints = sanitizeRoutePoints(alignment.routePoints());
            if (!isAlignmentPlausible(routePoints, latitude, longitude, distanceKm)) continue;

            OverlayBounds overlayBounds = sanitizeOverlayBounds(alignment.overlayBounds(), routePoints);
            List<RoutePoint> sampledRoute = resampleRoute(routePoints, TARGET_ELEVATION_SAMPLE_COUNT);
            List<Integer> elevationSamples = fetchElevationSamples(sampledRoute);
            Integer totalClimbMeters = computeTotalClimbMeters(elevationSamples);

            return new RaceCourseMapResult(
                    candidate.imageUrl(),
                    candidate.source(),
                    true,
                    alignment.confidence(),
                    alignment.summary(),
                    overlayBounds,
                    routePoints,
                    elevationSamples,
                    totalClimbMeters,
                    true
            );
        }

        CourseMapCandidate fallback = ranked.get(0);
        return candidateOnlyResult(fallback, "Hermes found a likely course-map image but could not align it confidently yet.");
    }

    private LinkedHashMap<String, CourseMapCandidate> collectCandidates(String raceName, String city, String country, String websiteUrl) {
        LinkedHashMap<String, CourseMapCandidate> candidates = new LinkedHashMap<>();
        if (websiteUrl != null) {
            collectOfficialPageCandidates(candidates, websiteUrl);
            String websiteHost = URI.create(websiteUrl).getHost();
            for (String query : buildSearchQueries(raceName, city, country, websiteHost)) {
                collectSearchCandidates(candidates, query);
            }
        } else {
            for (String query : buildSearchQueries(raceName, city, country, "")) {
                collectSearchCandidates(candidates, query);
            }
        }
        return candidates;
    }

    private void collectOfficialPageCandidates(Map<String, CourseMapCandidate> candidates, String websiteUrl) {
        List<String> pages = new ArrayList<>();
        pages.add(websiteUrl);
        pages.add(appendPath(websiteUrl, "/course"));
        pages.add(appendPath(websiteUrl, "/course-map"));
        pages.add(appendPath(websiteUrl, "/route"));
        pages.add(appendPath(websiteUrl, "/route-map"));
        pages.add(appendPath(websiteUrl, "/the-course"));
        pages.add(appendPath(websiteUrl, "/race-info"));
        pages.add(appendPath(websiteUrl, "/race-info/course"));
        pages.add(appendPath(websiteUrl, "/en/course"));
        pages.add(appendPath(websiteUrl, "/en/course-map"));
        pages.add(appendPath(websiteUrl, "/en/route"));

        for (String page : new LinkedHashSet<>(pages)) {
            if (page == null) continue;
            String html = fetchHtml(page);
            if (html == null || html.isBlank()) continue;
            URI baseUri = URI.create(page);
            int pageBoost = scoreText(page);
            collectMetaCandidates(candidates, html, baseUri, page, pageBoost + 2);
            collectImageCandidates(candidates, html, baseUri, page, pageBoost);
            collectLinkedImageCandidates(candidates, html, baseUri, page, pageBoost - 1);
        }
    }

    private void collectMetaCandidates(Map<String, CourseMapCandidate> candidates, String html, URI baseUri, String pageUrl, int baseScore) {
        Matcher matcher = META_IMAGE_PATTERN.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            addCandidate(candidates, raw, baseUri, "official-page:" + pageUrl, baseScore + scoreText(raw));
        }
    }

    private void collectImageCandidates(Map<String, CourseMapCandidate> candidates, String html, URI baseUri, String pageUrl, int baseScore) {
        Matcher matcher = IMG_PATTERN.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1);
            int score = baseScore + scoreText(raw) + scoreText(matcher.group(0));
            addCandidate(candidates, raw, baseUri, "official-page:" + pageUrl, score);
        }
    }

    private void collectLinkedImageCandidates(Map<String, CourseMapCandidate> candidates, String html, URI baseUri, String pageUrl, int baseScore) {
        Matcher matcher = HREF_PATTERN.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1);
            int score = baseScore + scoreText(raw);
            addCandidate(candidates, raw, baseUri, "official-link:" + pageUrl, score);
        }
    }

    private void collectSearchCandidates(Map<String, CourseMapCandidate> candidates, String query) {
        String html = fetchHtml("https://www.bing.com/images/search?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8) + "&first=1");
        if (html == null || html.isBlank()) return;
        Matcher matcher = MEDIA_URL_PATTERN.matcher(html);
        int added = 0;
        while (matcher.find() && added < 4) {
            String decoded = java.net.URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
            if (addCandidate(candidates, decoded, null, query, 2 + scoreText(query) + scoreText(decoded))) {
                added += 1;
            }
        }
    }

    private boolean addCandidate(Map<String, CourseMapCandidate> candidates, String raw, URI baseUri, String source, int score) {
        if (raw == null || raw.isBlank()) return false;
        try {
            String resolved = baseUri == null ? raw.trim() : baseUri.resolve(raw.trim()).toString();
            String safe = SafeUrlValidator.validateHttpsUrlOrNull(resolved, MAX_URL_LENGTH, "courseMapImageUrl");
            if (safe == null || !isImageFileUrl(safe)) return false;
            int totalScore = score + scoreText(safe);
            if (totalScore <= 0) return false;
            CourseMapCandidate existing = candidates.get(safe);
            if (existing == null || totalScore > existing.score()) {
                candidates.put(safe, new CourseMapCandidate(safe, source, totalScore));
            }
            return true;
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    private CourseMapAlignment analyzeCandidate(
            CourseMapCandidate candidate,
            byte[] imageBytes,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        String mediaType = detectMediaType(candidate.imageUrl());
        String prompt = buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm);
        String text = "claude".equalsIgnoreCase(aiProvider)
                ? callClaude(imageBytes, mediaType, prompt)
                : callGemini(imageBytes, mediaType, prompt);
        if (text == null || text.isBlank()) return null;
        return parseAlignment(text);
    }

    private String buildAlignmentPrompt(String raceName, String city, String country, Double latitude, Double longitude, Double distanceKm) {
        return """
                You are aligning a road-race course map image to the real world.
                Decide if the image is an actual course map for the race, not a medal, hero banner, sponsor graphic, or elevation-only chart.
                If it is a course map, infer an approximate real-world route and map bounds from the visible labels, landmarks, districts, bridges, parks, coastline, and race context.

                Race metadata:
                - raceName: %s
                - city: %s
                - country: %s
                - cityCenterLat: %s
                - cityCenterLng: %s
                - distanceKm: %s

                Output ONLY JSON with this shape:
                {
                  "isCourseMap": true,
                  "confidence": 0,
                  "summary": "short plain summary",
                  "overlayBounds": { "north": 0, "south": 0, "east": 0, "west": 0 },
                  "routePoints": [
                    { "lat": 0, "lng": 0, "label": "Start" }
                  ],
                  "startLabel": "optional",
                  "finishLabel": "optional"
                }

                Rules:
                - If the image is not a course map, return isCourseMap=false, confidence<=25, overlayBounds=null, routePoints=[].
                - Keep routePoints in running order from start to finish.
                - Use 8 to 24 route points.
                - Keep points approximate but geographically plausible.
                - overlayBounds must cover the visible course-map canvas, not only the route line.
                - Do not invent extreme precision. If unsure, lower confidence instead of hallucinating.
                - Prefer official city geography implied by the image labels and race metadata.
                """.formatted(
                safePromptValue(raceName),
                safePromptValue(city),
                safePromptValue(country),
                latitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", latitude),
                longitude == null ? "unknown" : String.format(Locale.ROOT, "%.6f", longitude),
                distanceKm == null ? "unknown" : String.format(Locale.ROOT, "%.3f", distanceKm)
        );
    }

    private String callGemini(byte[] imageBytes, String mediaType, String prompt) {
        Map<String, Object> request = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("inline_data", Map.of(
                                        "mime_type", mediaType,
                                        "data", Base64.getEncoder().encodeToString(imageBytes)
                                )),
                                Map.of("text", prompt)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + aiModel + ":generateContent?key=" + aiApiKey;

        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(request, headers), Map.class);
        Map<?, ?> body = response.getBody();
        if (body == null) return null;
        Object candidates = body.get("candidates");
        if (!(candidates instanceof List<?> list) || list.isEmpty() || !(list.get(0) instanceof Map<?, ?> first)) return null;
        Object content = first.get("content");
        if (!(content instanceof Map<?, ?> contentMap)) return null;
        Object parts = contentMap.get("parts");
        if (!(parts instanceof List<?> partList) || partList.isEmpty() || !(partList.get(0) instanceof Map<?, ?> partMap)) return null;
        Object text = partMap.get("text");
        return text instanceof String value ? value : null;
    }

    private String callClaude(byte[] imageBytes, String mediaType, String prompt) {
        Map<String, Object> request = Map.of(
                "model", aiModel,
                "max_tokens", 2048,
                "messages", List.of(Map.of(
                        "role", "user",
                        "content", List.of(
                                Map.of("type", "image",
                                        "source", Map.of(
                                                "type", "base64",
                                                "media_type", mediaType,
                                                "data", Base64.getEncoder().encodeToString(imageBytes)
                                        )),
                                Map.of("type", "text", "text", prompt)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", aiApiKey);
        headers.set("anthropic-version", "2023-06-01");

        ResponseEntity<Map> response = restTemplate.exchange(
                "https://api.anthropic.com/v1/messages",
                HttpMethod.POST,
                new HttpEntity<>(request, headers),
                Map.class
        );
        Map<?, ?> body = response.getBody();
        if (body == null) return null;
        Object content = body.get("content");
        if (!(content instanceof List<?> list) || list.isEmpty() || !(list.get(0) instanceof Map<?, ?> first)) return null;
        Object text = first.get("text");
        return text instanceof String value ? value : null;
    }

    private CourseMapAlignment parseAlignment(String text) {
        try {
            String json = extractJsonObject(text);
            if (json == null) return null;
            Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
            boolean isCourseMap = Boolean.TRUE.equals(parsed.get("isCourseMap"));
            int confidence = clampConfidence(parsed.get("confidence"));
            String summary = asTrimmedString(parsed.get("summary"));
            OverlayBounds overlayBounds = parseOverlayBounds(parsed.get("overlayBounds"));
            List<RoutePoint> routePoints = parseRoutePoints(parsed.get("routePoints"));
            return new CourseMapAlignment(
                    isCourseMap,
                    confidence,
                    summary,
                    overlayBounds,
                    routePoints,
                    asTrimmedString(parsed.get("startLabel")),
                    asTrimmedString(parsed.get("finishLabel"))
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    private String extractJsonObject(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        return text.substring(start, end + 1);
    }

    private OverlayBounds parseOverlayBounds(Object raw) {
        if (!(raw instanceof Map<?, ?> map)) return null;
        Double north = asDouble(map.get("north"));
        Double south = asDouble(map.get("south"));
        Double east = asDouble(map.get("east"));
        Double west = asDouble(map.get("west"));
        if (north == null || south == null || east == null || west == null) return null;
        if (north <= south || east <= west) return null;
        return new OverlayBounds(north, south, east, west);
    }

    private List<RoutePoint> parseRoutePoints(Object raw) {
        if (!(raw instanceof List<?> list)) return List.of();
        List<RoutePoint> points = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> pointMap)) continue;
            Double lat = asDouble(pointMap.get("lat"));
            Double lng = asDouble(pointMap.get("lng"));
            if (lat == null || lng == null) continue;
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
            points.add(new RoutePoint(lat, lng, asTrimmedString(pointMap.get("label"))));
        }
        return points;
    }

    private boolean isAlignmentPlausible(List<RoutePoint> routePoints, Double latitude, Double longitude, Double distanceKm) {
        if (routePoints.size() < 4) return false;
        if (latitude != null && longitude != null) {
            double centroidLat = routePoints.stream().mapToDouble(RoutePoint::lat).average().orElse(latitude);
            double centroidLng = routePoints.stream().mapToDouble(RoutePoint::lng).average().orElse(longitude);
            double centroidDistanceKm = haversineKm(latitude, longitude, centroidLat, centroidLng);
            double maxCentroidDistance = distanceKm == null ? 240.0 : Math.max(80.0, distanceKm * 6.0);
            if (centroidDistanceKm > maxCentroidDistance) return false;
        }
        if (distanceKm != null && distanceKm > 0) {
            double routeDistanceKm = polylineDistanceKm(routePoints);
            if (routeDistanceKm < distanceKm * 0.45 || routeDistanceKm > distanceKm * 1.85) return false;
        }
        return true;
    }

    private List<RoutePoint> sanitizeRoutePoints(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.isEmpty()) return List.of();
        List<RoutePoint> sanitized = new ArrayList<>();
        RoutePoint previous = null;
        for (RoutePoint point : routePoints) {
            if (point == null) continue;
            if (previous != null && Math.abs(previous.lat() - point.lat()) < 1.0e-6 && Math.abs(previous.lng() - point.lng()) < 1.0e-6) continue;
            sanitized.add(point);
            previous = point;
        }
        return sanitized;
    }

    private OverlayBounds sanitizeOverlayBounds(OverlayBounds rawBounds, List<RoutePoint> routePoints) {
        if (rawBounds != null && routeFitsInsideBounds(routePoints, rawBounds)) return rawBounds;
        return boundsFromRoute(routePoints);
    }

    private boolean routeFitsInsideBounds(List<RoutePoint> routePoints, OverlayBounds bounds) {
        for (RoutePoint point : routePoints) {
            if (point.lat() < bounds.south() - 0.02 || point.lat() > bounds.north() + 0.02) return false;
            if (point.lng() < bounds.west() - 0.02 || point.lng() > bounds.east() + 0.02) return false;
        }
        return true;
    }

    private OverlayBounds boundsFromRoute(List<RoutePoint> routePoints) {
        double minLat = Double.POSITIVE_INFINITY;
        double maxLat = Double.NEGATIVE_INFINITY;
        double minLng = Double.POSITIVE_INFINITY;
        double maxLng = Double.NEGATIVE_INFINITY;
        for (RoutePoint point : routePoints) {
            minLat = Math.min(minLat, point.lat());
            maxLat = Math.max(maxLat, point.lat());
            minLng = Math.min(minLng, point.lng());
            maxLng = Math.max(maxLng, point.lng());
        }
        double latPad = Math.max(0.01, (maxLat - minLat) * 0.2);
        double lngPad = Math.max(0.01, (maxLng - minLng) * 0.2);
        return new OverlayBounds(maxLat + latPad, minLat - latPad, maxLng + lngPad, minLng - lngPad);
    }

    private List<RoutePoint> resampleRoute(List<RoutePoint> routePoints, int targetCount) {
        if (routePoints.size() <= 1 || targetCount <= 1) return routePoints;
        List<Double> cumulative = new ArrayList<>();
        cumulative.add(0.0);
        for (int i = 1; i < routePoints.size(); i++) {
            double segment = haversineKm(
                    routePoints.get(i - 1).lat(),
                    routePoints.get(i - 1).lng(),
                    routePoints.get(i).lat(),
                    routePoints.get(i).lng()
            );
            cumulative.add(cumulative.get(i - 1) + Math.max(segment, 0.001));
        }
        double total = cumulative.get(cumulative.size() - 1);
        if (total <= 0.001) return routePoints;

        List<RoutePoint> resampled = new ArrayList<>();
        for (int i = 0; i < targetCount; i++) {
            double targetDistance = total * i / Math.max(targetCount - 1, 1);
            resampled.add(interpolateRoutePoint(routePoints, cumulative, targetDistance));
        }
        return resampled;
    }

    private RoutePoint interpolateRoutePoint(List<RoutePoint> routePoints, List<Double> cumulative, double targetDistance) {
        for (int i = 1; i < cumulative.size(); i++) {
            double end = cumulative.get(i);
            if (targetDistance > end) continue;
            double start = cumulative.get(i - 1);
            double span = Math.max(0.001, end - start);
            double ratio = Math.max(0.0, Math.min(1.0, (targetDistance - start) / span));
            RoutePoint left = routePoints.get(i - 1);
            RoutePoint right = routePoints.get(i);
            double lat = left.lat() + (right.lat() - left.lat()) * ratio;
            double lng = left.lng() + (right.lng() - left.lng()) * ratio;
            return new RoutePoint(lat, lng, null);
        }
        return routePoints.get(routePoints.size() - 1);
    }

    private List<Integer> fetchElevationSamples(List<RoutePoint> routePoints) {
        if (routePoints.isEmpty()) return List.of();
        StringBuilder latitudes = new StringBuilder();
        StringBuilder longitudes = new StringBuilder();
        for (int i = 0; i < routePoints.size(); i++) {
            if (i > 0) {
                latitudes.append(',');
                longitudes.append(',');
            }
            latitudes.append(String.format(Locale.ROOT, "%.6f", routePoints.get(i).lat()));
            longitudes.append(String.format(Locale.ROOT, "%.6f", routePoints.get(i).lng()));
        }
        URI uri = UriComponentsBuilder.fromUriString("https://api.open-meteo.com/v1/elevation")
                .queryParam("latitude", latitudes.toString())
                .queryParam("longitude", longitudes.toString())
                .build()
                .toUri();
        try {
            RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, uri);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(request, new ParameterizedTypeReference<>() {});
            Object elevations = response.getBody() != null ? response.getBody().get("elevation") : null;
            if (!(elevations instanceof List<?> list)) return List.of();
            List<Integer> samples = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Number number) samples.add((int) Math.round(number.doubleValue()));
            }
            return samples;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private Integer computeTotalClimbMeters(List<Integer> samples) {
        if (samples == null || samples.size() < 2) return null;
        int climb = 0;
        for (int i = 1; i < samples.size(); i++) {
            int delta = samples.get(i) - samples.get(i - 1);
            if (delta > 0) climb += delta;
        }
        return climb;
    }

    private RaceCourseMapResult analyzeResolvedImage(
            String source,
            String imageReference,
            byte[] imageBytes,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        BufferedImage decoded = decodeImage(imageBytes);
        if (decoded == null || decoded.getWidth() < 320 || decoded.getHeight() < 180) {
            return emptyResult("Course-map image is too small or unreadable.");
        }
        if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
            return new RaceCourseMapResult(imageReference, source, false, 0, "AI course-map alignment is not configured.", null, List.of(), List.of(), null, false);
        }
        CourseMapCandidate candidate = new CourseMapCandidate(imageReference, source, 100);
        CourseMapAlignment alignment = analyzeCandidate(candidate, imageBytes, raceName, city, country, latitude, longitude, distanceKm);
        if (alignment == null || !alignment.isCourseMap() || alignment.confidence() < MIN_ALIGNMENT_CONFIDENCE) {
            return new RaceCourseMapResult(imageReference, source, false, alignment == null ? 0 : alignment.confidence(),
                    alignment == null ? "Hermes could not align this course-map confidently yet." : alignment.summary(),
                    null, List.of(), List.of(), null, alignment != null);
        }
        List<RoutePoint> routePoints = sanitizeRoutePoints(alignment.routePoints());
        if (!isAlignmentPlausible(routePoints, latitude, longitude, distanceKm)) {
            return new RaceCourseMapResult(imageReference, source, false, alignment.confidence(),
                    "Hermes found route hints but the alignment failed the plausibility checks.", null, List.of(), List.of(), null, true);
        }
        OverlayBounds overlayBounds = sanitizeOverlayBounds(alignment.overlayBounds(), routePoints);
        List<Integer> elevationSamples = fetchElevationSamples(resampleRoute(routePoints, TARGET_ELEVATION_SAMPLE_COUNT));
        Integer totalClimbMeters = computeTotalClimbMeters(elevationSamples);
        return new RaceCourseMapResult(imageReference, source, true, alignment.confidence(), alignment.summary(), overlayBounds, routePoints, elevationSamples, totalClimbMeters, true);
    }

    private byte[] readImageBytes(String imageReference) {
        if (imageReference == null || imageReference.isBlank()) return null;
        if (imageReference.startsWith("data:image/")) {
            int comma = imageReference.indexOf(',');
            if (comma <= 0 || comma >= imageReference.length() - 1) return null;
            try {
                return Base64.getDecoder().decode(imageReference.substring(comma + 1).trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return fetchImageBytes(imageReference);
    }

    private void persistPending(
            String raceId,
            String raceName,
            String city,
            String country,
            String websiteUrl,
            Double latitude,
            Double longitude,
            Double distanceKm,
            RaceCourseMapResult resolved,
            String actorEmail
    ) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElseGet(RaceCourseMapAsset::new);
        asset.setRaceId(raceId);
        asset.setRaceName(raceName);
        asset.setCity(city);
        asset.setCountry(country);
        asset.setOfficialWebsite(websiteUrl);
        asset.setLatitude(latitude);
        asset.setLongitude(longitude);
        asset.setDistanceKm(distanceKm);
        asset.setPendingImageUrl(resolved.imageUrl());
        asset.setPendingSource(resolved.source());
        asset.setPendingConfidence(resolved.confidence());
        asset.setPendingSummary(resolved.summary());
        asset.setPendingOverlayBoundsJson(writeJson(resolved.overlayBounds()));
        asset.setPendingRoutePointsJson(writeJson(resolved.routePoints()));
        asset.setPendingElevationSamplesJson(writeJson(resolved.elevationSamples()));
        asset.setPendingTotalClimbMeters(resolved.totalClimbMeters());
        asset.setPendingAiAssisted(resolved.aiAssisted());
        asset.setPendingUpdatedAt(LocalDateTime.now());
        asset.setPendingUpdatedByEmail(actorEmail);
        raceCourseMapAssetRepository.save(asset);
    }

    private void clearPending(RaceCourseMapAsset asset) {
        asset.setPendingImageUrl(null);
        asset.setPendingSource(null);
        asset.setPendingConfidence(null);
        asset.setPendingSummary(null);
        asset.setPendingOverlayBoundsJson(null);
        asset.setPendingRoutePointsJson(null);
        asset.setPendingElevationSamplesJson(null);
        asset.setPendingTotalClimbMeters(null);
        asset.setPendingAiAssisted(null);
        asset.setPendingUpdatedAt(null);
        asset.setPendingUpdatedByEmail(null);
    }

    private RaceCourseMapResult toResult(RaceCourseMapAsset asset, boolean live) {
        String imageUrl = live ? asset.getLiveImageUrl() : asset.getPendingImageUrl();
        String source = live ? asset.getLiveSource() : asset.getPendingSource();
        Integer confidence = live ? asset.getLiveConfidence() : asset.getPendingConfidence();
        String summary = live ? asset.getLiveSummary() : asset.getPendingSummary();
        String overlayBoundsJson = live ? asset.getLiveOverlayBoundsJson() : asset.getPendingOverlayBoundsJson();
        String routePointsJson = live ? asset.getLiveRoutePointsJson() : asset.getPendingRoutePointsJson();
        String elevationSamplesJson = live ? asset.getLiveElevationSamplesJson() : asset.getPendingElevationSamplesJson();
        Integer totalClimb = live ? asset.getLiveTotalClimbMeters() : asset.getPendingTotalClimbMeters();
        Boolean aiAssisted = live ? asset.getLiveAiAssisted() : asset.getPendingAiAssisted();
        return new RaceCourseMapResult(
                imageUrl == null ? "" : imageUrl,
                source == null ? "" : source,
                routePointsJson != null && !routePointsJson.isBlank(),
                confidence == null ? 0 : confidence,
                summary == null ? "" : summary,
                readJson(overlayBoundsJson, new TypeReference<OverlayBounds>() {}, null),
                readJson(routePointsJson, new TypeReference<List<RoutePoint>>() {}, List.of()),
                readJson(elevationSamplesJson, new TypeReference<List<Integer>>() {}, List.of()),
                totalClimb,
                Boolean.TRUE.equals(aiAssisted)
        );
    }

    private RaceCourseMapAdminRow toAdminRow(RaceCourseMapAsset asset) {
        return new RaceCourseMapAdminRow(
                asset.getRaceId(),
                asset.getRaceName(),
                asset.getCity(),
                asset.getCountry(),
                buildPreviewSnapshot(asset, false),
                buildPreviewSnapshot(asset, true),
                asset.getUpdatedAt() == null ? null : asset.getUpdatedAt().toString(),
                asset.getPendingImageUrl() != null && !asset.getPendingImageUrl().isBlank()
        );
    }

    public RaceCourseMapAdminDetail getAdminDetail(String raceId) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId)
                .orElseThrow(() -> new IllegalArgumentException("Race course-map asset not found."));
        return new RaceCourseMapAdminDetail(
                asset.getRaceId(),
                asset.getRaceName(),
                asset.getCity(),
                asset.getCountry(),
                buildPreviewSnapshot(asset, false),
                buildPreviewSnapshot(asset, true)
        );
    }

    private PreviewSnapshot buildPreviewSnapshot(RaceCourseMapAsset asset, boolean pending) {
        String imageUrl = pending ? asset.getPendingImageUrl() : asset.getLiveImageUrl();
        String source = pending ? asset.getPendingSource() : asset.getLiveSource();
        Integer confidence = pending ? asset.getPendingConfidence() : asset.getLiveConfidence();
        String summary = pending ? asset.getPendingSummary() : asset.getLiveSummary();
        String updatedAt = pending
                ? (asset.getPendingUpdatedAt() == null ? null : asset.getPendingUpdatedAt().toString())
                : (asset.getLiveUpdatedAt() == null ? null : asset.getLiveUpdatedAt().toString());
        if ((imageUrl == null || imageUrl.isBlank()) && (summary == null || summary.isBlank())) {
            return null;
        }
        return new PreviewSnapshot(imageUrl, source, summary, confidence, updatedAt);
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ignored) {
            return null;
        }
    }

    private <T> T readJson(String raw, TypeReference<T> typeReference, T fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        try {
            return objectMapper.readValue(raw, typeReference);
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private String fetchHtml(String url) {
        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(buildHtmlHeaders()), String.class);
            return response.getBody();
        } catch (Exception ignored) {
            return null;
        }
    }

    private byte[] fetchImageBytes(String imageUrl) {
        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(imageUrl, HttpMethod.GET, new HttpEntity<>(buildBinaryHeaders()), byte[].class);
            byte[] body = response.getBody();
            if (body == null || body.length == 0 || body.length > MAX_IMAGE_BYTES) return null;
            return body;
        } catch (Exception ignored) {
            return null;
        }
    }

    private BufferedImage decodeImage(byte[] bytes) {
        try {
            return ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (Exception ignored) {
            return null;
        }
    }

    private HttpHeaders buildHtmlHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.TEXT_HTML, MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT,
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9");
        return headers;
    }

    private HttpHeaders buildBinaryHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT,
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        return headers;
    }

    private List<String> buildSearchQueries(String raceName, String city, String country, String websiteHost) {
        List<String> queries = new ArrayList<>();
        String baseRace = normalizeSpacing(raceName);
        String baseCity = normalizeSpacing(city);
        queries.add(baseRace + " course map");
        queries.add(baseRace + " route map");
        if (!baseCity.isBlank()) queries.add(baseCity + " marathon course map");
        String localized = localizedCourseQueryForCountry(country);
        if (localized != null) queries.add(baseRace + " " + localized);
        if (websiteHost != null && !websiteHost.isBlank()) {
            queries.add("site:" + websiteHost + " " + baseRace + " course map");
            queries.add("site:" + websiteHost + " " + baseRace + " route map");
        }
        return queries.stream().filter(query -> query != null && !query.isBlank()).toList();
    }

    private String localizedCourseQueryForCountry(String country) {
        if (country == null) return null;
        return switch (country.trim()) {
            case "Japan" -> "course map";
            case "France" -> "carte du parcours";
            case "Germany", "Austria", "Switzerland" -> "streckenkarte";
            case "Spain", "Mexico", "Argentina", "Chile" -> "mapa del recorrido";
            case "Portugal", "Brazil" -> "mapa do percurso";
            case "Italy" -> "mappa del percorso";
            default -> null;
        };
    }

    private String appendPath(String websiteUrl, String path) {
        try {
            return URI.create(websiteUrl).resolve(path).toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private int scoreText(String value) {
        if (value == null || value.isBlank()) return 0;
        String lower = value.toLowerCase(Locale.ROOT);
        int score = 0;
        for (String hint : COURSE_HINTS) {
            if (lower.contains(hint)) score += 2;
        }
        for (String reject : REJECT_HINTS) {
            if (lower.contains(reject)) score -= 4;
        }
        return score;
    }

    private boolean isImageFileUrl(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains(".html") || lower.contains(".htm")) return false;
        return lower.contains(".png") || lower.contains(".jpg") || lower.contains(".jpeg")
                || lower.contains(".webp") || lower.contains(".gif") || lower.contains(".avif");
    }

    private boolean shouldRefresh(RaceCourseMapResult result) {
        return result == null || (!result.courseMapDetected() && (result.imageUrl() == null || result.imageUrl().isBlank()));
    }

    private RaceCourseMapResult emptyResult(String summary) {
        return new RaceCourseMapResult("", "", false, 0, summary, null, List.of(), List.of(), null, false);
    }

    private RaceCourseMapResult candidateOnlyResult(CourseMapCandidate candidate, String summary) {
        return new RaceCourseMapResult(candidate.imageUrl(), candidate.source(), false, 0, summary, null, List.of(), List.of(), null, false);
    }

    private String detectMediaType(String imageUrl) {
        String lower = imageUrl == null ? "" : imageUrl.toLowerCase(Locale.ROOT);
        if (lower.contains(".png")) return "image/png";
        if (lower.contains(".webp")) return "image/webp";
        if (lower.contains(".gif")) return "image/gif";
        if (lower.contains(".avif")) return "image/avif";
        return "image/jpeg";
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeSpacing(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String normalizeNumber(Double value) {
        return value == null ? "" : String.format(Locale.ROOT, "%.6f", value);
    }

    private String safePromptValue(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim();
    }

    private String asTrimmedString(Object value) {
        if (!(value instanceof String stringValue)) return null;
        String trimmed = stringValue.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Double asDouble(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        if (value instanceof String stringValue) {
            try {
                return Double.parseDouble(stringValue.trim());
            } catch (Exception ignored) {
                return null;
            }
        }
        return null;
    }

    private int clampConfidence(Object value) {
        Double parsed = asDouble(value);
        if (parsed == null) return 0;
        return Math.max(0, Math.min(100, (int) Math.round(parsed)));
    }

    private double polylineDistanceKm(List<RoutePoint> routePoints) {
        double total = 0;
        for (int i = 1; i < routePoints.size(); i++) {
            total += haversineKm(routePoints.get(i - 1).lat(), routePoints.get(i - 1).lng(), routePoints.get(i).lat(), routePoints.get(i).lng());
        }
        return total;
    }

    private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    public record RaceCourseMapResult(
            String imageUrl,
            String source,
            boolean courseMapDetected,
            int confidence,
            String summary,
            OverlayBounds overlayBounds,
            List<RoutePoint> routePoints,
            List<Integer> elevationSamples,
            Integer totalClimbMeters,
            boolean aiAssisted
    ) {}

    public record OverlayBounds(double north, double south, double east, double west) {}

    public record RoutePoint(double lat, double lng, String label) {}

    public record RaceCourseMapAdminRow(
            String raceId,
            String raceName,
            String city,
            String country,
            PreviewSnapshot live,
            PreviewSnapshot pendingPreview,
            String updatedAt,
            boolean hasPendingPreview
    ) {}

    public record RaceCourseMapAdminDetail(
            String raceId,
            String raceName,
            String city,
            String country,
            PreviewSnapshot live,
            PreviewSnapshot pendingPreview
    ) {}

    public record PreviewSnapshot(
            String imageUrl,
            String source,
            String summary,
            Integer confidence,
            String updatedAt
    ) {}

    private record CourseMapCandidate(String imageUrl, String source, int score) {}

    private record CourseMapAlignment(
            boolean isCourseMap,
            int confidence,
            String summary,
            OverlayBounds overlayBounds,
            List<RoutePoint> routePoints,
            String startLabel,
            String finishLabel
    ) {}

    private record CachedResult(RaceCourseMapResult result, Instant expiresAt) {
        private boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
