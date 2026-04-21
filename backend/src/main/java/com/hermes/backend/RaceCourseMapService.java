package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RaceCourseMapService {
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final int MIN_ALIGNMENT_CONFIDENCE = 68;
    private static final int MIN_DIRECTIVE_RETRY_CONFIDENCE = 55;
    private static final int MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE = 58;
    private static final int MIN_ALIGNMENT_ROUTE_POINTS = 12;
    private static final int MIN_DIRECTIVE_RETRY_ROUTE_POINTS = 20;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final SystemConfigService systemConfigService;
    private final RaceCourseMapAssetRepository raceCourseMapAssetRepository;
    private final OsrmMapMatchingClient osrmMapMatchingClient;

    private final RaceCourseMapGeometryService geometryService;
    private final RaceCourseMapSearchService searchService;
    private final RaceCourseMapImageService imageService;
    private final RaceCourseMapAiService aiService;

    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    public RaceCourseMapService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository raceCourseMapAssetRepository,
            RaceCourseMapGeometryService geometryService,
            RaceCourseMapSearchService searchService,
            RaceCourseMapImageService imageService,
            RaceCourseMapAiService aiService
    ) {
        this(restTemplate, objectMapper, systemConfigService, raceCourseMapAssetRepository, null, geometryService, searchService, imageService, aiService);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public RaceCourseMapService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository raceCourseMapAssetRepository,
            OsrmMapMatchingClient osrmMapMatchingClient,
            RaceCourseMapGeometryService geometryService,
            RaceCourseMapSearchService searchService,
            RaceCourseMapImageService imageService,
            RaceCourseMapAiService aiService
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.systemConfigService = systemConfigService;
        this.raceCourseMapAssetRepository = raceCourseMapAssetRepository;
        this.osrmMapMatchingClient = osrmMapMatchingClient;
        this.geometryService = geometryService;
        this.searchService = searchService;
        this.imageService = imageService;
        this.aiService = aiService;
    }

    public RaceCourseMapResult resolveCourseMap(
            String raceName,
            String city,
            String country,
            String websiteUrl,
            Double latitude, Double longitude, Double distanceKm
    ) {
        String cacheKey = String.join("||",
                normalize(raceName), normalize(city), normalize(country), normalize(websiteUrl),
                normalizeNumber(latitude), normalizeNumber(longitude), normalizeNumber(distanceKm)
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
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm
    ) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (asset != null && asset.getLiveImageUrl() != null && !asset.getLiveImageUrl().isBlank()) {
            RaceCourseMapResult liveResult = toResult(asset, true);
            if (isStoredAlignedResult(liveResult)) return liveResult;
            RaceCourseMapResult upgraded = tryUpgradeLiveAsset(asset);
            if (upgraded != null) return upgraded;
            return liveResult;
        }

        RaceCourseMapResult resolved = resolveCourseMap(raceName, city, country, websiteUrl, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() != null && !resolved.imageUrl().isBlank()) || resolved.courseMapDetected()) {
            persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, "system-scan");
        }
        return resolved;
    }

    public String materializePreviewImageUrl(String imageUrl) {
        return imageService.buildDisplayablePreviewImageUrl(imageUrl);
    }

    public RaceCourseMapResult uploadPendingCourseMap(
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm, String imageReference, String actorEmail
    ) {
        String validated = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(imageReference, 2_000_000, "imageUrl");
        ResolvedCandidateAsset uploadedAsset = imageService.resolveUploadedReference(validated);
        if (uploadedAsset == null) throw new IllegalArgumentException("Unable to read course-map image.");
        String source = classifyAdminUploadSource(validated);
        RaceCourseMapResult resolved = analyzeResolvedImage(source, uploadedAsset.imageUrl(), uploadedAsset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() == null || resolved.imageUrl().isBlank()) && uploadedAsset.imageUrl() != null && !uploadedAsset.imageUrl().isBlank()) {
            resolved = new RaceCourseMapResult(uploadedAsset.imageUrl(), source, false, 0, "Hermes saved the upload but could not align it confidently yet.", null, List.of(), List.of(), null, false);
        }
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail);
        return resolved;
    }

    public RaceCourseMapResult scanPendingCourseMap(
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm, String actorEmail
    ) {
        RaceCourseMapResult resolved = resolveCourseMap(raceName, city, country, websiteUrl, latitude, longitude, distanceKm);
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail);
        return resolved;
    }

    public RaceCourseMapResult reanalyzePendingCourseMap(
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm, String actorEmail
    ) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (asset == null || asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("race_course_map_pending_missing");
        }
        ResolvedCandidateAsset storedAsset = imageService.resolveUploadedReference(asset.getPendingImageUrl());
        if (storedAsset == null) throw new IllegalArgumentException("race_course_map_pending_missing");
        String source = classifyAdminUploadSource(asset.getPendingImageUrl());
        RaceCourseMapResult resolved = analyzeResolvedImage(source, storedAsset.imageUrl(), storedAsset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() == null || resolved.imageUrl().isBlank()) && storedAsset.imageUrl() != null && !storedAsset.imageUrl().isBlank()) {
            resolved = new RaceCourseMapResult(storedAsset.imageUrl(), source, false, 0, "Hermes re-scanned the upload but could not align it confidently yet.", null, List.of(), List.of(), null, false);
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

    public RaceCourseMapAdminDetail getAdminDetail(String raceId) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId)
                .orElseThrow(() -> new IllegalArgumentException("Race course-map asset not found."));
        RaceCourseMapResult currentLiveResult = resolveCourseMapWithStorage(
                asset.getRaceId(), asset.getRaceName(), asset.getCity(), asset.getCountry(),
                asset.getOfficialWebsite(), asset.getLatitude(), asset.getLongitude(), asset.getDistanceKm()
        );
        PreviewSnapshot currentLivePreview = materializePreviewImage(toPreviewSnapshot(currentLiveResult, asset.getLiveUpdatedAt()));
        return new RaceCourseMapAdminDetail(
                asset.getRaceId(), asset.getRaceName(), asset.getCity(), asset.getCountry(),
                materializePreviewImage(buildPreviewSnapshot(asset, false)),
                materializePreviewImage(buildPreviewSnapshot(asset, true)),
                currentLivePreview
        );
    }

    private RaceCourseMapResult doResolveCourseMap(String raceName, String city, String country, String websiteUrl, Double latitude, Double longitude, Double distanceKm) {
        String safeWebsite = SafeUrlValidator.validateHttpUrlOrNull(websiteUrl, 500, "officialWebsite");
        PromptRaceType raceType = inferPromptRaceType(raceName, city, country, safeWebsite);
        LinkedHashMap<String, CourseMapCandidate> candidates = searchService.collectCandidates(raceName, city, country, safeWebsite, distanceKm);
        if (candidates.isEmpty()) return emptyResult("No course-map candidate found yet.");

        List<CourseMapCandidate> ranked = candidates.values().stream()
                .sorted((left, right) -> Integer.compare(right.score(), left.score())).limit(12).toList();

        ResolvedCandidateAsset fallbackAsset = null;
        CourseMapCandidate fallbackCandidate = null;
        RetryableAlignmentCandidate bestRetryable = null;

        for (CourseMapCandidate candidate : ranked) {
            List<ResolvedCandidateAsset> assets = imageService.resolveCandidateAssets(candidate);
            for (ResolvedCandidateAsset asset : assets) {
                if (asset == null) continue;
                if (fallbackAsset == null) { fallbackAsset = asset; fallbackCandidate = candidate; }
                if (!imageService.isCandidateImageLargeEnough(asset.imageBytes())) continue;
                if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
                    return candidateOnlyResult(asset.imageUrl(), candidate.source(), "AI course-map alignment is not configured.");
                }
                String mediaType = imageService.detectMediaTypeFromBytes(asset.imageBytes(), asset.imageUrl());
                CourseMapAlignment alignment = aiService.analyzeCandidate(asset.imageUrl(), asset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm, false, raceType, mediaType);
                if (alignment == null || !alignment.isCourseMap()) continue;
                List<RoutePoint> routePoints = geometryService.sanitizeRoutePoints(alignment.routePoints());
                if (alignment.confidence() >= MIN_ALIGNMENT_CONFIDENCE && geometryService.isAlignmentPlausible(routePoints, latitude, longitude, distanceKm, MIN_ALIGNMENT_ROUTE_POINTS, raceType)) {
                    return buildAlignedResult(asset, candidate, alignment, routePoints, latitude, longitude, distanceKm, raceType);
                }
                if (alignment.confidence() >= MIN_DIRECTIVE_RETRY_CONFIDENCE && routePoints.size() >= MIN_DIRECTIVE_RETRY_ROUTE_POINTS) {
                    double retryScore = aiService.scoreAlignmentCandidate(alignment, latitude, longitude, distanceKm, raceType);
                    if (bestRetryable == null || retryScore > bestRetryable.score()) bestRetryable = new RetryableAlignmentCandidate(candidate, asset, retryScore);
                }
            }
        }

        if (bestRetryable != null) {
            String mediaType = imageService.detectMediaTypeFromBytes(bestRetryable.asset().imageBytes(), bestRetryable.asset().imageUrl());
            CourseMapAlignment retried = aiService.analyzeCandidate(bestRetryable.asset().imageUrl(), bestRetryable.asset().imageBytes(), raceName, city, country, latitude, longitude, distanceKm, true, raceType, mediaType);
            if (retried != null && retried.isCourseMap()) {
                List<RoutePoint> points = geometryService.sanitizeRoutePoints(retried.routePoints());
                if (retried.confidence() >= MIN_DIRECTIVE_RETRY_CONFIDENCE && points.size() >= MIN_DIRECTIVE_RETRY_ROUTE_POINTS && geometryService.isAlignmentPlausible(points, latitude, longitude, distanceKm, MIN_ALIGNMENT_ROUTE_POINTS, raceType)) {
                    return buildAlignedResult(bestRetryable.asset(), bestRetryable.candidate(), retried, points, latitude, longitude, distanceKm, raceType);
                }
            }
        }

        if (fallbackAsset != null) return candidateOnlyResult(fallbackAsset.imageUrl(), fallbackCandidate.source(), "Hermes found a likely course-map image but could not align it confidently yet.");
        return emptyResult("No usable course-map candidate found yet.");
    }

    private RaceCourseMapResult analyzeResolvedImage(String source, String imageReference, byte[] imageBytes, String raceName, String city, String country, Double latitude, Double longitude, Double distanceKm) {
        PromptRaceType raceType = inferPromptRaceType(raceName, city, country, imageReference);
        String mediaType = imageService.detectMediaTypeFromBytes(imageBytes, imageReference);
        if (!imageService.isCandidateImageLargeEnough(imageBytes)) return emptyResult("Course-map image is too small or unreadable.");
        if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
            return new RaceCourseMapResult(imageReference, source, false, 0, "AI course-map alignment is not configured.", null, List.of(), List.of(), null, false);
        }
        CourseMapAlignment alignment = aiService.analyzeCandidate(imageReference, imageBytes, raceName, city, country, latitude, longitude, distanceKm, false, raceType, mediaType);
        int minConf = minimumAlignmentConfidenceForSource(source);
        if (alignment != null && alignment.isCourseMap() && alignment.confidence() < minConf && alignment.confidence() >= MIN_DIRECTIVE_RETRY_CONFIDENCE && geometryService.sanitizeRoutePoints(alignment.routePoints()).size() >= MIN_DIRECTIVE_RETRY_ROUTE_POINTS) {
            CourseMapAlignment retried = aiService.analyzeCandidate(imageReference, imageBytes, raceName, city, country, latitude, longitude, distanceKm, true, raceType, mediaType);
            if (retried != null && retried.isCourseMap()) alignment = retried;
        }
        if (alignment == null || !alignment.isCourseMap() || alignment.confidence() < minConf) {
            return new RaceCourseMapResult(imageReference, source, false, alignment == null ? 0 : alignment.confidence(), alignment == null ? "Hermes could not align this course-map confidently yet." : alignment.summary(), null, List.of(), List.of(), null, alignment != null);
        }
        List<RoutePoint> routePoints = geometryService.sanitizeRoutePoints(alignment.routePoints());
        if (!geometryService.isAlignmentPlausible(routePoints, latitude, longitude, distanceKm, minimumRoutePointCountForSource(source), raceType)) {
            return new RaceCourseMapResult(imageReference, source, false, alignment.confidence(), "Hermes found route hints but the alignment failed the plausibility checks.", null, List.of(), List.of(), null, true);
        }
        return buildAlignedResult(new ResolvedCandidateAsset(imageReference, imageBytes), new CourseMapCandidate(imageReference, source, alignment.confidence()), alignment, routePoints, latitude, longitude, distanceKm, raceType);
    }

    private RaceCourseMapResult buildAlignedResult(ResolvedCandidateAsset asset, CourseMapCandidate candidate, CourseMapAlignment alignment, List<RoutePoint> routePoints, Double latitude, Double longitude, Double distanceKm, PromptRaceType raceType) {
        List<RoutePoint> snapped = snapRouteToRoads(routePoints);
        List<RoutePoint> finalPoints = geometryService.isAlignmentPlausible(snapped, latitude, longitude, distanceKm, MIN_ALIGNMENT_ROUTE_POINTS, raceType) ? snapped : routePoints;
        OverlayBounds bounds = sanitizeOverlayBounds(alignment.overlayBounds(), finalPoints);
        List<RoutePoint> sampled = geometryService.resampleRoute(finalPoints, 25);
        // Elevation logic simplified for coordination
        return new RaceCourseMapResult(asset.imageUrl(), candidate.source(), true, alignment.confidence(), alignment.summary(), bounds, finalPoints, List.of(), null, true);
    }

    private void ensurePendingAlignedForPublish(RaceCourseMapAsset asset, String actorEmail) {
        if (asset == null || isStoredAlignedResult(toResult(asset, false))) return;
        ResolvedCandidateAsset stored = imageService.resolveUploadedReference(asset.getPendingImageUrl());
        if (stored == null) throw new IllegalArgumentException("No pending course-map preview to publish.");
        String source = (asset.getPendingSource() == null || asset.getPendingSource().isBlank()) ? "admin-upload" : asset.getPendingSource();
        RaceCourseMapResult resolved = analyzeResolvedImage(source, stored.imageUrl(), stored.imageBytes(), asset.getRaceName(), asset.getCity(), asset.getCountry(), asset.getLatitude(), asset.getLongitude(), asset.getDistanceKm());
        if (!isStoredAlignedResult(resolved)) throw new IllegalArgumentException("Pending course-map must align before publishing live.");
        persistPending(asset.getRaceId(), asset.getRaceName(), asset.getCity(), asset.getCountry(), asset.getOfficialWebsite(), asset.getLatitude(), asset.getLongitude(), asset.getDistanceKm(), resolved, actorEmail);
    }

    private RaceCourseMapResult tryUpgradeLiveAsset(RaceCourseMapAsset asset) {
        if (asset == null || asset.getLiveImageUrl() == null || asset.getLiveImageUrl().isBlank()) return null;
        ResolvedCandidateAsset resolved = imageService.resolveUploadedReference(asset.getLiveImageUrl());
        if (resolved == null) return null;
        String source = (asset.getLiveSource() == null || asset.getLiveSource().isBlank()) ? "published-live" : asset.getLiveSource();
        RaceCourseMapResult upgraded = analyzeResolvedImage(source, resolved.imageUrl(), resolved.imageBytes(), asset.getRaceName(), asset.getCity(), asset.getCountry(), asset.getLatitude(), asset.getLongitude(), asset.getDistanceKm());
        if (!isStoredAlignedResult(upgraded)) return null;
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

    private List<RoutePoint> snapRouteToRoads(List<RoutePoint> routePoints) {
        if (osrmMapMatchingClient == null || routePoints == null || routePoints.size() < 2) return routePoints == null ? List.of() : routePoints;
        try {
            List<RawBreadcrumbPointDTO> raw = routePoints.stream().map(p -> new RawBreadcrumbPointDTO(p.lat(), p.lng())).toList();
            List<MatchedBreadcrumbPointDTO> snapped = osrmMapMatchingClient.matchOrderedBreadcrumbs(raw);
            if (snapped == null || snapped.size() != routePoints.size()) return routePoints;
            List<RoutePoint> result = new ArrayList<>(snapped.size());
            for (int i = 0; i < snapped.size(); i++) result.add(new RoutePoint(snapped.get(i).latitude(), snapped.get(i).longitude(), routePoints.get(i).label()));
            return List.copyOf(result);
        } catch (Exception ignored) { return routePoints; }
    }

    private OverlayBounds sanitizeOverlayBounds(OverlayBounds raw, List<RoutePoint> routePoints) {
        if (raw != null && routeFitsInsideBounds(routePoints, raw)) return raw;
        return geometryService.boundsFromRoute(routePoints);
    }

    private boolean routeFitsInsideBounds(List<RoutePoint> points, OverlayBounds bounds) {
        for (RoutePoint p : points) {
            if (p.lat() < bounds.south() - 0.02 || p.lat() > bounds.north() + 0.02) return false;
            if (p.lng() < bounds.west() - 0.02 || p.lng() > bounds.east() + 0.02) return false;
        }
        return true;
    }

    private int minimumAlignmentConfidenceForSource(String source) {
        return (source != null && source.startsWith("admin-")) ? MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE : MIN_ALIGNMENT_CONFIDENCE;
    }

    private int minimumRoutePointCountForSource(String source) {
        return (source != null && (source.startsWith("admin-") || source.startsWith("published-live"))) ? 5 : MIN_ALIGNMENT_ROUTE_POINTS;
    }

    private boolean isStoredAlignedResult(RaceCourseMapResult result) {
        return result != null && result.courseMapDetected() && result.overlayBounds() != null && result.routePoints() != null && result.routePoints().size() > 1;
    }

    private void persistPending(String raceId, String raceName, String city, String country, String websiteUrl, Double latitude, Double longitude, Double distanceKm, RaceCourseMapResult resolved, String actorEmail) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElseGet(RaceCourseMapAsset::new);
        asset.setRaceId(raceId); asset.setRaceName(raceName); asset.setCity(city); asset.setCountry(country); asset.setOfficialWebsite(websiteUrl); asset.setLatitude(latitude); asset.setLongitude(longitude); asset.setDistanceKm(distanceKm);
        asset.setPendingImageUrl(resolved.imageUrl()); asset.setPendingSource(resolved.source()); asset.setPendingConfidence(resolved.confidence()); asset.setPendingSummary(resolved.summary());
        asset.setPendingOverlayBoundsJson(writeJson(resolved.overlayBounds())); asset.setPendingRoutePointsJson(writeJson(resolved.routePoints())); asset.setPendingElevationSamplesJson(writeJson(resolved.elevationSamples()));
        asset.setPendingTotalClimbMeters(resolved.totalClimbMeters()); asset.setPendingAiAssisted(resolved.aiAssisted()); asset.setPendingUpdatedAt(LocalDateTime.now()); asset.setPendingUpdatedByEmail(actorEmail);
        raceCourseMapAssetRepository.save(asset);
    }

    private void clearPending(RaceCourseMapAsset asset) {
        asset.setPendingImageUrl(null); asset.setPendingSource(null); asset.setPendingConfidence(null); asset.setPendingSummary(null); asset.setPendingOverlayBoundsJson(null); asset.setPendingRoutePointsJson(null); asset.setPendingElevationSamplesJson(null); asset.setPendingTotalClimbMeters(null); asset.setPendingAiAssisted(null); asset.setPendingUpdatedAt(null); asset.setPendingUpdatedByEmail(null);
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
                imageUrl == null ? "" : imageUrl, source == null ? "" : source, routePointsJson != null && !routePointsJson.isBlank(),
                confidence == null ? 0 : confidence, summary == null ? "" : summary,
                readJson(overlayBoundsJson, new TypeReference<OverlayBounds>() {}, null),
                readJson(routePointsJson, new TypeReference<List<RoutePoint>>() {}, List.of()),
                readJson(elevationSamplesJson, new TypeReference<List<Integer>>() {}, List.of()),
                totalClimb, Boolean.TRUE.equals(aiAssisted)
        );
    }

    private RaceCourseMapAdminRow toAdminRow(RaceCourseMapAsset asset) {
        return new RaceCourseMapAdminRow(asset.getRaceId(), asset.getRaceName(), asset.getCity(), asset.getCountry(), buildPreviewSnapshot(asset, false), buildPreviewSnapshot(asset, true), asset.getUpdatedAt() == null ? null : asset.getUpdatedAt().toString(), asset.getPendingImageUrl() != null && !asset.getPendingImageUrl().isBlank());
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
        String updatedAt = pending ? (asset.getPendingUpdatedAt() == null ? null : asset.getPendingUpdatedAt().toString()) : (asset.getLiveUpdatedAt() == null ? null : asset.getLiveUpdatedAt().toString());
        if ((imageUrl == null || imageUrl.isBlank()) && (summary == null || summary.isBlank())) return null;
        List<RoutePoint> routePoints = readJson(routePointsJson, new TypeReference<List<RoutePoint>>() {}, List.of());
        return new PreviewSnapshot(imageUrl, imageUrl, source, summary, confidence, updatedAt, readJson(overlayBoundsJson, new TypeReference<OverlayBounds>() {}, null), routePoints, readJson(elevationSamplesJson, new TypeReference<List<Integer>>() {}, List.of()), totalClimbMeters, Boolean.TRUE.equals(aiAssisted), !routePoints.isEmpty());
    }

    private PreviewSnapshot toPreviewSnapshot(RaceCourseMapResult result, LocalDateTime updatedAt) {
        if (result == null || ((result.imageUrl() == null || result.imageUrl().isBlank()) && (result.summary() == null || result.summary().isBlank()))) return null;
        return new PreviewSnapshot(result.imageUrl(), result.imageUrl(), result.source(), result.summary(), result.confidence(), updatedAt == null ? null : updatedAt.toString(), result.overlayBounds(), result.routePoints() == null ? List.of() : result.routePoints(), result.elevationSamples() == null ? List.of() : result.elevationSamples(), result.totalClimbMeters(), result.aiAssisted(), result.courseMapDetected());
    }

    private PreviewSnapshot materializePreviewImage(PreviewSnapshot snapshot) {
        if (snapshot == null) return null;
        String previewImageUrl = imageService.buildDisplayablePreviewImageUrl(snapshot.imageUrl());
        if (Objects.equals(previewImageUrl, snapshot.previewImageUrl())) return snapshot;
        return new PreviewSnapshot(snapshot.imageUrl(), previewImageUrl, snapshot.source(), snapshot.summary(), snapshot.confidence(), snapshot.updatedAt(), snapshot.overlayBounds(), snapshot.routePoints(), snapshot.elevationSamples(), snapshot.totalClimbMeters(), snapshot.aiAssisted(), snapshot.courseMapDetected());
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try { return objectMapper.writeValueAsString(value); } catch (Exception ignored) { return null; }
    }

    private <T> T readJson(String raw, TypeReference<T> typeReference, T fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        try { return objectMapper.readValue(raw, typeReference); } catch (Exception ignored) { return fallback; }
    }

    private String normalize(String value) { return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT); }
    private String normalizeNumber(Double value) { return value == null ? "" : String.format(java.util.Locale.ROOT, "%.6f", value); }

    private PromptRaceType inferPromptRaceType(String raceName, String city, String country, String websiteUrl) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country), normalize(websiteUrl));
        if (combined.contains("out and back") || combined.contains("out-and-back") || combined.contains("outandback")) return PromptRaceType.OUT_AND_BACK;
        if (combined.contains("loop") || combined.contains("circuit")) return PromptRaceType.LOOP;
        return PromptRaceType.POINT_TO_POINT;
    }

    private String classifyAdminUploadSource(String ref) {
        if (isImageDataUrl(ref)) return "admin-upload";
        return (ref != null && ref.toLowerCase(java.util.Locale.ROOT).contains(".pdf")) ? "admin-document-url" : "admin-image-url";
    }

    private boolean isImageDataUrl(String url) { return url != null && url.regionMatches(true, 0, "data:image/", 0, 11); }

    private boolean shouldRefresh(RaceCourseMapResult result) { return result == null || (!result.courseMapDetected() && (result.imageUrl() == null || result.imageUrl().isBlank())); }

    private RaceCourseMapResult emptyResult(String summary) { return new RaceCourseMapResult("", "", false, 0, summary, null, List.of(), List.of(), null, false); }

    private RaceCourseMapResult candidateOnlyResult(String imageUrl, String source, String summary) { return new RaceCourseMapResult(imageUrl, source, false, 0, summary, null, List.of(), List.of(), null, false); }

    // --- Private records and enums retained for internal use or passed between services ---

    public record ResolvedCandidateAsset(String imageUrl, byte[] imageBytes) {}
    public record CourseMapCandidate(String imageUrl, String source, int score) {}
    public record CourseMapAlignment(boolean isCourseMap, int confidence, String summary, OverlayBounds overlayBounds, List<RoutePoint> routePoints, String startLabel, String finishLabel) {}
    private record RetryableAlignmentCandidate(CourseMapCandidate candidate, ResolvedCandidateAsset asset, double score) {}
    public record AlignmentRatioWindow(double minRatio, double maxRatio) {}
    public record SegmentIntersection(int firstSegmentEndIndex, int secondSegmentEndIndex) {}
    public record RouteGeometryDiagnosis(int selfIntersectionCount, int allowedSelfIntersections, int startDistanceBacktrackCount, String feedbackPrompt) {
        public boolean needsCorrectionPrompt() { return feedbackPrompt != null && !feedbackPrompt.isBlank(); }
        public double selfIntersectionPenalty() { return Math.max(0, selfIntersectionCount - allowedSelfIntersections) * 12.0; }
        public double startDistanceBacktrackPenalty() { return startDistanceBacktrackCount * 4.0; }
    }
    public enum PromptRaceType {
        POINT_TO_POINT("point-to-point"), LOOP("loop"), OUT_AND_BACK("out-and-back");
        private final String promptValue;
        PromptRaceType(String promptValue) { this.promptValue = promptValue; }
        public String promptValue() { return promptValue; }
    }
    private record CachedResult(RaceCourseMapResult result, Instant expiresAt) {
        private boolean isExpired() { return Instant.now().isAfter(expiresAt); }
    }
}
