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
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RaceCourseMapService {
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final int MAX_URL_LENGTH = 500;
    private static final int MAX_IMAGE_BYTES = 6 * 1024 * 1024;
    private static final int MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
    private static final int MAX_CANDIDATES = 6;
    private static final int TARGET_ELEVATION_SAMPLE_COUNT = 25;
    private static final int MIN_ALIGNMENT_CONFIDENCE = 68;
    private static final int MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE = 58;
    private static final double EARTH_RADIUS_KM = 6371.0088;
    private static final int CLIMB_DELTA_THRESHOLD_METERS = 1;
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
            RaceCourseMapResult liveResult = toResult(asset, true);
            if (isStoredAlignedResult(liveResult)) {
                return liveResult;
            }
            RaceCourseMapResult upgradedLiveResult = tryUpgradeLiveAsset(asset);
            if (upgradedLiveResult != null) {
                return upgradedLiveResult;
            }
            return liveResult;
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
        ResolvedCandidateAsset uploadedAsset = resolveUploadedReference(validated);
        if (uploadedAsset == null) {
            throw new IllegalArgumentException("Unable to read course-map image.");
        }
        String source = classifyAdminUploadSource(validated);
        RaceCourseMapResult resolved = analyzeResolvedImage(source, uploadedAsset.imageUrl(), uploadedAsset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() == null || resolved.imageUrl().isBlank()) && uploadedAsset.imageUrl() != null && !uploadedAsset.imageUrl().isBlank()) {
            resolved = new RaceCourseMapResult(uploadedAsset.imageUrl(), source, false, 0, "Hermes saved the upload but could not align it confidently yet.", null, List.of(), List.of(), null, false);
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

    public RaceCourseMapResult reanalyzePendingCourseMap(
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
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (asset == null || asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("race_course_map_pending_missing");
        }
        String storedImageUrl = asset.getPendingImageUrl();
        ResolvedCandidateAsset storedAsset = resolveUploadedReference(storedImageUrl);
        if (storedAsset == null) {
            throw new IllegalArgumentException("race_course_map_pending_missing");
        }
        String source = classifyAdminUploadSource(storedImageUrl);
        RaceCourseMapResult resolved = analyzeResolvedImage(source, storedAsset.imageUrl(), storedAsset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() == null || resolved.imageUrl().isBlank()) && storedAsset.imageUrl() != null && !storedAsset.imageUrl().isBlank()) {
            resolved = new RaceCourseMapResult(storedAsset.imageUrl(), source, false, 0,
                    "Hermes re-scanned the upload but could not align it confidently yet.",
                    null, List.of(), List.of(), null, false);
        }
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail);
        return resolved;
    }

    public void acceptPendingCourseMap(String raceId, String actorEmail) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId)
                .orElseThrow(() -> new IllegalArgumentException("Race course-map asset not found."));
        if (asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("No pending course-map preview to publish.");
        }
        ensurePendingAlignedForPublish(asset, actorEmail);
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

    private void ensurePendingAlignedForPublish(RaceCourseMapAsset asset, String actorEmail) {
        if (asset == null || isStoredAlignedResult(toResult(asset, false))) {
            return;
        }
        ResolvedCandidateAsset storedAsset = resolveUploadedReference(asset.getPendingImageUrl());
        if (storedAsset == null) {
            throw new IllegalArgumentException("No pending course-map preview to publish.");
        }
        String source = asset.getPendingSource() == null || asset.getPendingSource().isBlank()
                ? "admin-upload"
                : asset.getPendingSource();
        RaceCourseMapResult resolved = analyzeResolvedImage(
                source,
                storedAsset.imageUrl(),
                storedAsset.imageBytes(),
                asset.getRaceName(),
                asset.getCity(),
                asset.getCountry(),
                asset.getLatitude(),
                asset.getLongitude(),
                asset.getDistanceKm()
        );
        if (!isStoredAlignedResult(resolved)) {
            throw new IllegalArgumentException("Pending course-map must align before publishing live.");
        }
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

        ResolvedCandidateAsset fallbackAsset = null;
        CourseMapCandidate fallbackCandidate = null;
        for (CourseMapCandidate candidate : ranked) {
            ResolvedCandidateAsset resolvedAsset = resolveCandidateAsset(candidate);
            if (resolvedAsset == null) continue;
            if (fallbackAsset == null) {
                fallbackAsset = resolvedAsset;
                fallbackCandidate = candidate;
            }

            BufferedImage decoded = decodeImage(resolvedAsset.imageBytes());
            if (decoded == null || decoded.getWidth() < 320 || decoded.getHeight() < 180) continue;

            if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
                return candidateOnlyResult(resolvedAsset.imageUrl(), candidate.source(), "AI course-map alignment is not configured.");
            }

            CourseMapAlignment alignment = analyzeCandidate(resolvedAsset.imageUrl(), resolvedAsset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm);
            if (alignment == null || !alignment.isCourseMap()) continue;
            if (alignment.confidence() < MIN_ALIGNMENT_CONFIDENCE) continue;

            List<RoutePoint> routePoints = sanitizeRoutePoints(alignment.routePoints());
            if (!isAlignmentPlausible(routePoints, latitude, longitude, distanceKm)) continue;

            OverlayBounds overlayBounds = sanitizeOverlayBounds(alignment.overlayBounds(), routePoints);
            List<RoutePoint> sampledRoute = resampleRoute(routePoints, TARGET_ELEVATION_SAMPLE_COUNT);
            List<Integer> elevationSamples = smoothElevationSamples(fetchElevationSamples(sampledRoute));
            Integer totalClimbMeters = computeTotalClimbMeters(elevationSamples);

            return new RaceCourseMapResult(
                    resolvedAsset.imageUrl(),
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

        if (fallbackAsset != null && fallbackCandidate != null) {
            return candidateOnlyResult(
                    fallbackAsset.imageUrl(),
                    fallbackCandidate.source(),
                    "Hermes found a likely course-map image but could not align it confidently yet."
            );
        }
        return emptyResult("No usable course-map candidate found yet.");
    }

    private LinkedHashMap<String, CourseMapCandidate> collectCandidates(String raceName, String city, String country, String websiteUrl) {
        LinkedHashMap<String, CourseMapCandidate> candidates = new LinkedHashMap<>();
        if (websiteUrl != null) {
            collectOfficialPageCandidates(candidates, websiteUrl);
            if (!candidates.isEmpty()) {
                return candidates;
            }
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
        List<String> relativePages = List.of(
                "course",
                "course/",
                "course-map",
                "course-map/",
                "route",
                "route/",
                "route-map",
                "route-map/",
                "the-course",
                "race-info",
                "race-info/course",
                "about/course",
                "about/course/",
                "about/course-map",
                "about/course-map/",
                "about/route",
                "about/route-map"
        );
        for (String relativePage : relativePages) {
            pages.add(appendRelativePath(websiteUrl, relativePage));
        }
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
            if (safe == null || (!isImageFileUrl(safe) && !isPdfFileUrl(safe))) return false;
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
            String imageReference,
            byte[] imageBytes,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        String mediaType = detectMediaTypeFromBytes(imageBytes, imageReference);
        String prompt = buildAlignmentPrompt(raceName, city, country, latitude, longitude, distanceKm);
        String text = "claude".equalsIgnoreCase(aiProvider)
                ? callClaude(imageBytes, mediaType, prompt)
                : callGemini(imageBytes, mediaType, prompt);
        if (text == null || text.isBlank()) return null;
        return parseAlignment(text, latitude, longitude, distanceKm);
    }

    private String buildAlignmentPrompt(String raceName, String city, String country, Double latitude, Double longitude, Double distanceKm) {
        return """
                You are aligning a road-race course map image to the real world.
                Decide if the image is an actual course map for the race, not a medal, hero banner, sponsor graphic, or elevation-only chart.
                Poster-style official race graphics still count as course maps when they visibly include a route line over a city map, landmarks, district labels, or a start/finish course diagram.
                If it is a course map, infer an approximate real-world route and map bounds from the visible labels, landmarks, districts, bridges, parks, coastline, and race context.
                Think at the highest level first: identify the overall city geography and major landmarks before tracing the route details.

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
                  "finishLabel": "optional",
                  "candidateAlignments": [
                    {
                      "confidence": 0,
                      "summary": "optional alternate hypothesis",
                      "overlayBounds": { "north": 0, "south": 0, "east": 0, "west": 0 },
                      "routePoints": [
                        { "lat": 0, "lng": 0, "label": "Start" }
                      ],
                      "startLabel": "optional",
                      "finishLabel": "optional"
                    }
                  ]
                }

                Rules:
                - If the image is not a course map, return isCourseMap=false, confidence<=25, overlayBounds=null, routePoints=[].
                - Keep routePoints in running order from start to finish.
                - Use 12 to 32 route points when the map supports it. For marathon-class maps, avoid fewer than 6 route points unless the image is extremely sparse.
                - Keep points approximate but geographically plausible.
                - overlayBounds must cover the visible course-map canvas, not only the route line.
                - Do not invent extreme precision. If unsure, lower confidence instead of hallucinating.
                - Prefer official city geography implied by the image labels and race metadata.
                - When multiple interpretations are plausible, include 2 to 3 candidateAlignments ordered best-first and repeat the single best hypothesis in the top-level fields.
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

    private CourseMapAlignment parseAlignment(String text, Double latitude, Double longitude, Double distanceKm) {
        try {
            String json = extractJsonObject(text);
            if (json == null) return null;
            Map<String, Object> parsed = objectMapper.readValue(json, new TypeReference<>() {});
            List<CourseMapAlignment> alignments = new ArrayList<>();
            CourseMapAlignment rootAlignment = parseAlignmentCandidate(parsed, false);
            if (rootAlignment != null) {
                alignments.add(rootAlignment);
            }
            Object rawCandidates = parsed.get("candidateAlignments");
            if (rawCandidates instanceof List<?> candidateList) {
                for (Object candidate : candidateList) {
                    CourseMapAlignment parsedCandidate = parseAlignmentCandidate(candidate, true);
                    if (parsedCandidate != null) {
                        alignments.add(parsedCandidate);
                    }
                }
            }
            if (alignments.isEmpty()) {
                return null;
            }
            return chooseBestAlignment(alignments, latitude, longitude, distanceKm);
        } catch (Exception ignored) {
            return null;
        }
    }

    private CourseMapAlignment parseAlignmentCandidate(Object raw, boolean defaultIsCourseMap) {
        if (!(raw instanceof Map<?, ?> map)) return null;
        boolean isCourseMap = map.containsKey("isCourseMap")
                ? Boolean.TRUE.equals(map.get("isCourseMap"))
                : defaultIsCourseMap;
        int confidence = clampConfidence(map.get("confidence"));
        String summary = asTrimmedString(map.get("summary"));
        OverlayBounds overlayBounds = parseOverlayBounds(map.get("overlayBounds"));
        List<RoutePoint> routePoints = sanitizeRoutePoints(parseRoutePoints(map.get("routePoints")));
        return new CourseMapAlignment(
                isCourseMap,
                confidence,
                summary,
                overlayBounds,
                routePoints,
                asTrimmedString(map.get("startLabel")),
                asTrimmedString(map.get("finishLabel"))
        );
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

    private CourseMapAlignment chooseBestAlignment(
            List<CourseMapAlignment> alignments,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        CourseMapAlignment best = null;
        double bestScore = Double.NEGATIVE_INFINITY;
        for (CourseMapAlignment alignment : alignments) {
            double score = scoreAlignmentCandidate(alignment, latitude, longitude, distanceKm);
            if (score > bestScore) {
                bestScore = score;
                best = alignment;
            }
        }
        return best;
    }

    private double scoreAlignmentCandidate(
            CourseMapAlignment alignment,
            Double latitude,
            Double longitude,
            Double distanceKm
    ) {
        if (alignment == null) return Double.NEGATIVE_INFINITY;
        double score = alignment.isCourseMap() ? alignment.confidence() : alignment.confidence() - 140.0;
        List<RoutePoint> routePoints = alignment.routePoints() == null ? List.of() : alignment.routePoints();
        if (routePoints.isEmpty()) {
            return score - 120.0;
        }

        score += Math.min(24.0, routePoints.size() * 1.8);
        if (alignment.overlayBounds() != null) score += 3.0;
        if (alignment.startLabel() != null) score += 4.0;
        if (alignment.finishLabel() != null) score += 4.0;

        int minimumRoutePoints = minimumRoutePointCount(distanceKm);
        if (routePoints.size() < minimumRoutePoints) {
            score -= 70.0;
        } else {
            score += Math.min(12.0, (routePoints.size() - minimumRoutePoints) * 1.5);
        }

        if (latitude != null && longitude != null) {
            double centroidDistanceKm = routeCentroidDistanceKm(routePoints, latitude, longitude);
            double maxCentroidDistanceKm = maximumCentroidDistanceKm(distanceKm);
            if (centroidDistanceKm > maxCentroidDistanceKm) {
                score -= 90.0;
            } else {
                score += 18.0 * (1.0 - (centroidDistanceKm / Math.max(maxCentroidDistanceKm, 1.0)));
            }
        }

        if (distanceKm != null && distanceKm > 0) {
            double routeDistanceKm = polylineDistanceKm(routePoints);
            AlignmentRatioWindow ratioWindow = alignmentRatioWindow(distanceKm, routePoints.size());
            double distanceRatio = routeDistanceKm / distanceKm;
            if (distanceRatio < ratioWindow.minRatio() || distanceRatio > ratioWindow.maxRatio()) {
                score -= 90.0;
            } else {
                double ratioDelta = Math.abs(1.0 - distanceRatio);
                double maxRatioDelta = Math.max(1.0 - ratioWindow.minRatio(), ratioWindow.maxRatio() - 1.0);
                score += 24.0 * (1.0 - Math.min(ratioDelta / Math.max(maxRatioDelta, 0.01), 1.0));
            }

            double longestSegmentRatio = largestSegmentRatio(routePoints, routeDistanceKm);
            double maxSegmentRatio = maximumSingleSegmentRatio(distanceKm, routePoints.size());
            if (longestSegmentRatio > maxSegmentRatio) {
                score -= 55.0;
            } else {
                score += 10.0 * (1.0 - (longestSegmentRatio / Math.max(maxSegmentRatio, 0.01)));
            }
        }

        return score;
    }

    private boolean isAlignmentPlausible(List<RoutePoint> routePoints, Double latitude, Double longitude, Double distanceKm) {
        if (routePoints.size() < minimumRoutePointCount(distanceKm)) return false;
        if (latitude != null && longitude != null) {
            double centroidDistanceKm = routeCentroidDistanceKm(routePoints, latitude, longitude);
            double maxCentroidDistance = maximumCentroidDistanceKm(distanceKm);
            if (centroidDistanceKm > maxCentroidDistance) return false;
        }
        if (distanceKm != null && distanceKm > 0) {
            double routeDistanceKm = polylineDistanceKm(routePoints);
            AlignmentRatioWindow ratioWindow = alignmentRatioWindow(distanceKm, routePoints.size());
            if (routeDistanceKm < distanceKm * ratioWindow.minRatio() || routeDistanceKm > distanceKm * ratioWindow.maxRatio()) return false;
            if (largestSegmentRatio(routePoints, routeDistanceKm) > maximumSingleSegmentRatio(distanceKm, routePoints.size())) return false;
        }
        return true;
    }

    private int minimumRoutePointCount(Double distanceKm) {
        if (distanceKm == null) return 4;
        if (distanceKm >= 40.0) return 6;
        if (distanceKm >= 20.0) return 5;
        return 4;
    }

    private double maximumCentroidDistanceKm(Double distanceKm) {
        if (distanceKm == null || distanceKm <= 0) {
            return 160.0;
        }
        return Math.max(25.0, distanceKm * 2.0);
    }

    private AlignmentRatioWindow alignmentRatioWindow(Double distanceKm, int routePointCount) {
        if (distanceKm != null && distanceKm >= 40.0) {
            if (routePointCount >= 16) {
                return new AlignmentRatioWindow(0.75, 1.25);
            }
            if (routePointCount >= 10) {
                return new AlignmentRatioWindow(0.55, 1.45);
            }
            return new AlignmentRatioWindow(0.30, 1.65);
        }
        if (routePointCount >= 12) {
            return new AlignmentRatioWindow(0.45, 1.85);
        }
        return new AlignmentRatioWindow(0.25, 2.10);
    }

    private double routeCentroidDistanceKm(List<RoutePoint> routePoints, double latitude, double longitude) {
        double centroidLat = routePoints.stream().mapToDouble(RoutePoint::lat).average().orElse(latitude);
        double centroidLng = routePoints.stream().mapToDouble(RoutePoint::lng).average().orElse(longitude);
        return haversineKm(latitude, longitude, centroidLat, centroidLng);
    }

    private double largestSegmentRatio(List<RoutePoint> routePoints, double routeDistanceKm) {
        if (routePoints == null || routePoints.size() < 2 || routeDistanceKm <= 0) {
            return 1.0;
        }
        double largestSegmentKm = 0.0;
        for (int i = 1; i < routePoints.size(); i++) {
            largestSegmentKm = Math.max(largestSegmentKm, haversineKm(
                    routePoints.get(i - 1).lat(),
                    routePoints.get(i - 1).lng(),
                    routePoints.get(i).lat(),
                    routePoints.get(i).lng()
            ));
        }
        return largestSegmentKm / routeDistanceKm;
    }

    private double maximumSingleSegmentRatio(Double distanceKm, int routePointCount) {
        boolean marathonLike = distanceKm != null && distanceKm >= 40.0;
        if (routePointCount >= (marathonLike ? 18 : 14)) {
            return 0.22;
        }
        if (routePointCount >= (marathonLike ? 12 : 10)) {
            return 0.34;
        }
        return marathonLike ? 0.55 : 0.65;
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
            if (delta >= CLIMB_DELTA_THRESHOLD_METERS) climb += delta;
        }
        return climb;
    }

    private List<Integer> smoothElevationSamples(List<Integer> samples) {
        if (samples == null || samples.size() < 3) return samples == null ? List.of() : samples;
        List<Integer> smoothed = new ArrayList<>(samples.size());
        smoothed.add(Math.round((samples.get(0) + samples.get(1)) / 2.0f));
        for (int i = 1; i < samples.size() - 1; i++) {
            smoothed.add(Math.round((samples.get(i - 1) + samples.get(i) + samples.get(i + 1)) / 3.0f));
        }
        smoothed.add(Math.round((samples.get(samples.size() - 2) + samples.get(samples.size() - 1)) / 2.0f));
        return smoothed;
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
        String mediaType = detectMediaTypeFromBytes(imageBytes, imageReference);
        BufferedImage decoded = decodeImage(imageBytes);
        boolean allowWebpWithoutImageIo = "image/webp".equalsIgnoreCase(mediaType)
                && decoded == null
                && imageBytes != null
                && imageBytes.length >= 1024;
        if ((!allowWebpWithoutImageIo && decoded == null)
                || (!allowWebpWithoutImageIo && (decoded.getWidth() < 320 || decoded.getHeight() < 180))) {
            return emptyResult("Course-map image is too small or unreadable.");
        }
        if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
            return new RaceCourseMapResult(imageReference, source, false, 0, "AI course-map alignment is not configured.", null, List.of(), List.of(), null, false);
        }
        CourseMapAlignment alignment = analyzeCandidate(imageReference, imageBytes, raceName, city, country, latitude, longitude, distanceKm);
        int minimumConfidence = minimumAlignmentConfidenceForSource(source);
        if (alignment == null || !alignment.isCourseMap() || alignment.confidence() < minimumConfidence) {
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
        List<Integer> elevationSamples = smoothElevationSamples(fetchElevationSamples(resampleRoute(routePoints, TARGET_ELEVATION_SAMPLE_COUNT)));
        Integer totalClimbMeters = computeTotalClimbMeters(elevationSamples);
        return new RaceCourseMapResult(imageReference, source, true, alignment.confidence(), alignment.summary(), overlayBounds, routePoints, elevationSamples, totalClimbMeters, true);
    }

    private int minimumAlignmentConfidenceForSource(String source) {
        if (source != null && source.startsWith("admin-")) {
            return MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE;
        }
        return MIN_ALIGNMENT_CONFIDENCE;
    }

    private boolean isStoredAlignedResult(RaceCourseMapResult result) {
        return result != null
                && result.courseMapDetected()
                && result.overlayBounds() != null
                && result.routePoints() != null
                && result.routePoints().size() > 1;
    }

    private RaceCourseMapResult tryUpgradeLiveAsset(RaceCourseMapAsset asset) {
        if (asset == null || asset.getLiveImageUrl() == null || asset.getLiveImageUrl().isBlank()) {
            return null;
        }
        ResolvedCandidateAsset resolvedAsset = resolveUploadedReference(asset.getLiveImageUrl());
        if (resolvedAsset == null) {
            return null;
        }
        String source = asset.getLiveSource() == null || asset.getLiveSource().isBlank()
                ? "published-live"
                : asset.getLiveSource();
        RaceCourseMapResult upgraded = analyzeResolvedImage(
                source,
                resolvedAsset.imageUrl(),
                resolvedAsset.imageBytes(),
                asset.getRaceName(),
                asset.getCity(),
                asset.getCountry(),
                asset.getLatitude(),
                asset.getLongitude(),
                asset.getDistanceKm()
        );
        if (!isStoredAlignedResult(upgraded)) {
            return null;
        }
        asset.setLiveImageUrl(upgraded.imageUrl());
        asset.setLiveSource(upgraded.source());
        asset.setLiveConfidence(upgraded.confidence());
        asset.setLiveSummary(upgraded.summary());
        asset.setLiveOverlayBoundsJson(writeJson(upgraded.overlayBounds()));
        asset.setLiveRoutePointsJson(writeJson(upgraded.routePoints()));
        asset.setLiveElevationSamplesJson(writeJson(upgraded.elevationSamples()));
        asset.setLiveTotalClimbMeters(upgraded.totalClimbMeters());
        asset.setLiveAiAssisted(upgraded.aiAssisted());
        asset.setLiveUpdatedAt(LocalDateTime.now());
        raceCourseMapAssetRepository.save(asset);
        return upgraded;
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
        if (isPdfFileUrl(imageReference)) {
            byte[] pdfBytes = fetchDocumentBytes(imageReference);
            if (pdfBytes != null) {
                ResolvedCandidateAsset rendered = renderPdfCandidate(pdfBytes);
                if (rendered != null) return rendered.imageBytes();
            }
        }
        return fetchImageBytes(imageReference);
    }

    private ResolvedCandidateAsset resolveUploadedReference(String imageReference) {
        if (imageReference == null || imageReference.isBlank()) return null;
        if (isImageDataUrl(imageReference)) {
            byte[] imageBytes = decodeBase64DataUrlPayload(imageReference);
            if (imageBytes == null) return null;
            return new ResolvedCandidateAsset(imageReference, imageBytes);
        }
        if (isPdfDataUrl(imageReference)) {
            byte[] pdfBytes = decodeBase64DataUrlPayload(imageReference);
            if (pdfBytes == null) return null;
            return renderPdfCandidate(pdfBytes);
        }
        if (isPdfFileUrl(imageReference)) {
            byte[] pdfBytes = fetchDocumentBytes(imageReference);
            if (pdfBytes == null) return null;
            return renderPdfCandidate(pdfBytes);
        }
        byte[] imageBytes = fetchImageBytes(imageReference);
        if (imageBytes == null) return null;
        return new ResolvedCandidateAsset(imageReference, imageBytes);
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
        RaceCourseMapResult currentLiveResult = resolveCourseMapWithStorage(
                asset.getRaceId(),
                asset.getRaceName(),
                asset.getCity(),
                asset.getCountry(),
                asset.getOfficialWebsite(),
                asset.getLatitude(),
                asset.getLongitude(),
                asset.getDistanceKm()
        );
        PreviewSnapshot currentLivePreview = materializePreviewImage(toPreviewSnapshot(currentLiveResult, asset.getLiveUpdatedAt()));
        return new RaceCourseMapAdminDetail(
                asset.getRaceId(),
                asset.getRaceName(),
                asset.getCity(),
                asset.getCountry(),
                materializePreviewImage(buildPreviewSnapshot(asset, false)),
                materializePreviewImage(buildPreviewSnapshot(asset, true)),
                currentLivePreview
        );
    }

    private PreviewSnapshot buildPreviewSnapshot(RaceCourseMapAsset asset, boolean pending) {
        String imageUrl = pending ? asset.getPendingImageUrl() : asset.getLiveImageUrl();
        String source = pending ? asset.getPendingSource() : asset.getLiveSource();
        Integer confidence = pending ? asset.getPendingConfidence() : asset.getLiveConfidence();
        String summary = pending ? asset.getPendingSummary() : asset.getLiveSummary();
        String overlayBoundsJson = pending ? asset.getPendingOverlayBoundsJson() : asset.getLiveOverlayBoundsJson();
        String routePointsJson = pending ? asset.getPendingRoutePointsJson() : asset.getLiveRoutePointsJson();
        String elevationSamplesJson = pending ? asset.getPendingElevationSamplesJson() : asset.getLiveElevationSamplesJson();
        Integer totalClimbMeters = pending ? asset.getPendingTotalClimbMeters() : asset.getLiveTotalClimbMeters();
        Boolean aiAssisted = pending ? asset.getPendingAiAssisted() : asset.getLiveAiAssisted();
        String updatedAt = pending
                ? (asset.getPendingUpdatedAt() == null ? null : asset.getPendingUpdatedAt().toString())
                : (asset.getLiveUpdatedAt() == null ? null : asset.getLiveUpdatedAt().toString());
        if ((imageUrl == null || imageUrl.isBlank()) && (summary == null || summary.isBlank())) {
            return null;
        }
        List<RoutePoint> routePoints = readJson(routePointsJson, new TypeReference<List<RoutePoint>>() {}, List.of());
        return new PreviewSnapshot(
                imageUrl,
                imageUrl,
                source,
                summary,
                confidence,
                updatedAt,
                readJson(overlayBoundsJson, new TypeReference<OverlayBounds>() {}, null),
                routePoints,
                readJson(elevationSamplesJson, new TypeReference<List<Integer>>() {}, List.of()),
                totalClimbMeters,
                Boolean.TRUE.equals(aiAssisted),
                !routePoints.isEmpty()
        );
    }

    private PreviewSnapshot toPreviewSnapshot(RaceCourseMapResult result, LocalDateTime updatedAt) {
        if (result == null) {
            return null;
        }
        if ((result.imageUrl() == null || result.imageUrl().isBlank()) && (result.summary() == null || result.summary().isBlank())) {
            return null;
        }
        return new PreviewSnapshot(
                result.imageUrl(),
                result.imageUrl(),
                result.source(),
                result.summary(),
                result.confidence(),
                updatedAt == null ? null : updatedAt.toString(),
                result.overlayBounds(),
                result.routePoints() == null ? List.of() : result.routePoints(),
                result.elevationSamples() == null ? List.of() : result.elevationSamples(),
                result.totalClimbMeters(),
                result.aiAssisted(),
                result.courseMapDetected()
        );
    }

    private PreviewSnapshot materializePreviewImage(PreviewSnapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        String previewImageUrl = buildDisplayablePreviewImageUrl(snapshot.imageUrl());
        if (Objects.equals(previewImageUrl, snapshot.previewImageUrl())) {
            return snapshot;
        }
        return new PreviewSnapshot(
                snapshot.imageUrl(),
                previewImageUrl,
                snapshot.source(),
                snapshot.summary(),
                snapshot.confidence(),
                snapshot.updatedAt(),
                snapshot.overlayBounds(),
                snapshot.routePoints(),
                snapshot.elevationSamples(),
                snapshot.totalClimbMeters(),
                snapshot.aiAssisted(),
                snapshot.courseMapDetected()
        );
    }

    private String buildDisplayablePreviewImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return imageUrl;
        }
        if (isImageDataUrl(imageUrl)) {
            return imageUrl;
        }
        ResolvedCandidateAsset resolved = resolveUploadedReference(imageUrl);
        if (resolved == null || resolved.imageBytes() == null || resolved.imageBytes().length == 0) {
            return imageUrl;
        }
        String mediaType = detectMediaTypeFromBytes(resolved.imageBytes(), imageUrl);
        if (mediaType == null || mediaType.isBlank()) {
            mediaType = "image/png";
        }
        return "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(resolved.imageBytes());
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
        return fetchBinaryBytes(imageUrl, MAX_IMAGE_BYTES);
    }

    private byte[] fetchDocumentBytes(String documentUrl) {
        return fetchBinaryBytes(documentUrl, MAX_DOCUMENT_BYTES);
    }

    private byte[] fetchBinaryBytes(String url, int maxBytes) {
        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(buildBinaryHeaders()), byte[].class);
            byte[] body = response.getBody();
            if (body == null || body.length == 0 || body.length > maxBytes) return null;
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

    private ResolvedCandidateAsset resolveCandidateAsset(CourseMapCandidate candidate) {
        if (candidate == null || candidate.imageUrl() == null || candidate.imageUrl().isBlank()) return null;
        if (isPdfFileUrl(candidate.imageUrl())) {
            byte[] pdfBytes = fetchDocumentBytes(candidate.imageUrl());
            if (pdfBytes == null) return null;
            return renderPdfCandidate(pdfBytes);
        }
        byte[] imageBytes = fetchImageBytes(candidate.imageUrl());
        if (imageBytes == null) return null;
        return new ResolvedCandidateAsset(candidate.imageUrl(), imageBytes);
    }

    private ResolvedCandidateAsset renderPdfCandidate(byte[] pdfBytes) {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            if (document.getNumberOfPages() == 0) return null;
            PDFRenderer renderer = new PDFRenderer(document);
            BufferedImage image = renderer.renderImageWithDPI(0, 144, ImageType.RGB);
            if (image == null) return null;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, "png", output);
            byte[] imageBytes = output.toByteArray();
            if (imageBytes.length == 0) return null;
            return new ResolvedCandidateAsset("data:image/png;base64," + Base64.getEncoder().encodeToString(imageBytes), imageBytes);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String appendPath(String websiteUrl, String path) {
        try {
            return URI.create(websiteUrl).resolve(path).toString();
        } catch (Exception ignored) {
            return null;
        }
    }

    private String appendRelativePath(String websiteUrl, String path) {
        try {
            String base = websiteUrl == null ? null : websiteUrl.trim();
            if (base == null || base.isBlank()) return null;
            if (!base.endsWith("/")) {
                base = base + "/";
            }
            return URI.create(base).resolve(path).toString();
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

    private boolean isPdfFileUrl(String url) {
        return url != null && url.toLowerCase(Locale.ROOT).contains(".pdf");
    }

    private boolean shouldRefresh(RaceCourseMapResult result) {
        return result == null || (!result.courseMapDetected() && (result.imageUrl() == null || result.imageUrl().isBlank()));
    }

    private RaceCourseMapResult emptyResult(String summary) {
        return new RaceCourseMapResult("", "", false, 0, summary, null, List.of(), List.of(), null, false);
    }

    private RaceCourseMapResult candidateOnlyResult(String imageUrl, String source, String summary) {
        return new RaceCourseMapResult(imageUrl, source, false, 0, summary, null, List.of(), List.of(), null, false);
    }

    private String detectMediaType(String imageUrl) {
        if (imageUrl != null && imageUrl.startsWith("data:image/")) {
            int separator = imageUrl.indexOf(';');
            int comma = imageUrl.indexOf(',');
            int end = separator > 0 ? separator : comma;
            if (end > "data:".length()) {
                return imageUrl.substring("data:".length(), end);
            }
        }
        String lower = imageUrl == null ? "" : imageUrl.toLowerCase(Locale.ROOT);
        if (lower.contains(".pdf")) return "application/pdf";
        if (lower.contains(".png")) return "image/png";
        if (lower.contains(".webp")) return "image/webp";
        if (lower.contains(".gif")) return "image/gif";
        if (lower.contains(".avif")) return "image/avif";
        return "image/jpeg";
    }

    private String classifyAdminUploadSource(String imageReference) {
        if (isImageDataUrl(imageReference)) {
            return "admin-upload";
        }
        if (isPdfReference(imageReference)) {
            return "admin-document-url";
        }
        return "admin-image-url";
    }

    private boolean isImageDataUrl(String url) {
        return url != null && url.regionMatches(true, 0, "data:image/", 0, 11);
    }

    private boolean isPdfDataUrl(String url) {
        return url != null && url.regionMatches(true, 0, "data:application/pdf", 0, 20);
    }

    private boolean isPdfReference(String url) {
        return isPdfDataUrl(url) || isPdfFileUrl(url);
    }

    private byte[] decodeBase64DataUrlPayload(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) return null;
        int comma = dataUrl.indexOf(',');
        if (comma <= 0 || comma >= dataUrl.length() - 1) return null;
        try {
            return Base64.getMimeDecoder().decode(dataUrl.substring(comma + 1).trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private String detectMediaTypeFromBytes(byte[] bytes, String fallbackUrl) {
        if (bytes != null && bytes.length > 8) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == (byte) 0x50 && bytes[2] == (byte) 0x4E && bytes[3] == (byte) 0x47) {
                return "image/png";
            }
            if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) {
                return "image/jpeg";
            }
        }
        return detectMediaType(fallbackUrl);
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
            PreviewSnapshot pendingPreview,
            PreviewSnapshot currentLivePreview
    ) {}

    public record PreviewSnapshot(
            String imageUrl,
            String previewImageUrl,
            String source,
            String summary,
            Integer confidence,
            String updatedAt,
            OverlayBounds overlayBounds,
            List<RoutePoint> routePoints,
            List<Integer> elevationSamples,
            Integer totalClimbMeters,
            boolean aiAssisted,
            boolean courseMapDetected
    ) {}

    private record ResolvedCandidateAsset(String imageUrl, byte[] imageBytes) {}

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

    private record AlignmentRatioWindow(double minRatio, double maxRatio) {}

    private record CachedResult(RaceCourseMapResult result, Instant expiresAt) {
        private boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }
}
