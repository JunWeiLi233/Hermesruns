package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
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

    @SuppressWarnings("unused")
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final SystemConfigService systemConfigService;
    private final RaceCourseMapAssetRepository raceCourseMapAssetRepository;
    private final OsrmMapMatchingClient osrmMapMatchingClient;

    private final RaceCourseMapGeometryService geometryService;
    private final RaceCourseMapSearchService searchService;
    private final RaceCourseMapImageService imageService;
    private final RaceCourseMapAiService aiService;
    private final MarathonRouteExtractionService marathonRouteExtractionService;
    private final MarathonRouteGeoreferencingService marathonRouteGeoreferencingService;
    private final CourseMapScanWatcher scanWatcher;

    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();

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
        this(restTemplate, objectMapper, systemConfigService, raceCourseMapAssetRepository, null, geometryService, searchService, imageService, aiService, null, null, new CourseMapScanWatcher());
    }

    public RaceCourseMapService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository raceCourseMapAssetRepository,
            OsrmMapMatchingClient osrmMapMatchingClient,
            RaceCourseMapGeometryService geometryService,
            RaceCourseMapSearchService searchService,
            RaceCourseMapImageService imageService,
            RaceCourseMapAiService aiService,
            MarathonRouteExtractionService marathonRouteExtractionService,
            MarathonRouteGeoreferencingService marathonRouteGeoreferencingService
    ) {
        this(restTemplate, objectMapper, systemConfigService, raceCourseMapAssetRepository, osrmMapMatchingClient, geometryService, searchService, imageService, aiService, marathonRouteExtractionService, marathonRouteGeoreferencingService, new CourseMapScanWatcher());
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
            RaceCourseMapAiService aiService,
            MarathonRouteExtractionService marathonRouteExtractionService,
            MarathonRouteGeoreferencingService marathonRouteGeoreferencingService,
            CourseMapScanWatcher scanWatcher
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
        this.marathonRouteExtractionService = marathonRouteExtractionService;
        this.marathonRouteGeoreferencingService = marathonRouteGeoreferencingService;
        this.scanWatcher = scanWatcher;
    }

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
        this(restTemplate, objectMapper, systemConfigService, raceCourseMapAssetRepository, osrmMapMatchingClient, geometryService, searchService, imageService, aiService, null, null, new CourseMapScanWatcher());
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

        RaceCourseMapResult resolved = emptyResult("Upload a course map in the admin workspace before Hermes can analyze or publish it.");
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
            return liveResult;
        }
        return emptyResult("Upload and publish a course map in the admin workspace before it appears on the race page.");
    }

    public String materializePreviewImageUrl(String imageUrl) {
        return imageService.buildDisplayablePreviewImageUrl(imageUrl);
    }

    public String materializeTransparentOverlayImageUrl(String imageUrl) {
        return imageService.buildTransparentCourseMapOverlayImageUrl(imageUrl);
    }

    public RaceCourseMapResult uploadPendingCourseMap(
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm, String imageReference, String actorEmail
    ) {
        String validated = SafeUrlValidator.validateHttpUrlOrImageDataUrlOrNull(imageReference, 2_000_000, "imageUrl");
        ResolvedCandidateAsset uploadedAsset = imageService.resolveUploadedReference(validated);
        if (uploadedAsset == null) throw new IllegalArgumentException("Unable to read course-map image.");
        ResolvedCandidateAsset storedAsset = imageService.storeCourseMapUpload(raceId, uploadedAsset);
        String source = classifyAdminUploadSource(validated);
        RaceCourseMapResult resolved = buildStagedUploadResult(storedAsset, source);
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail);
        return resolved;
    }

    public RaceCourseMapResult scanPendingCourseMap(
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm, String actorEmail
    ) {
        return reanalyzePendingCourseMap(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, actorEmail);
    }

    public RaceCourseMapResult reanalyzePendingCourseMap(
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm, String actorEmail
    ) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (asset == null || asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("race_course_map_pending_missing");
        }
        RaceCourseMapResult existingPending = toResult(asset, false);
        ResolvedCandidateAsset storedAsset = imageService.resolveUploadedReference(asset.getPendingImageUrl());
        if (storedAsset == null) throw new IllegalArgumentException("race_course_map_pending_missing");
        String source = asset.getPendingSource() == null || asset.getPendingSource().isBlank()
                ? classifyAdminUploadSource(asset.getPendingImageUrl())
                : asset.getPendingSource();
        RaceCourseMapResult resolved = analyzeUploadedAssetWithFallback(
                source,
                storedAsset,
                raceName,
                city,
                country,
                latitude,
                longitude,
                distanceKm,
                "Hermes re-scanned the upload but could not align it confidently yet."
        );
        resolved = keepExistingAlignmentWhenReanalysisRegresses(existingPending, resolved);
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail);
        return resolved;
    }

    public void acceptPendingCourseMap(String raceId, String actorEmail) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId)
                .orElseThrow(() -> new IllegalArgumentException("Race course-map asset not found."));
        if (asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("No pending course-map preview to publish.");
        }
        ensurePendingAlignedForPublish(asset);
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
        clearPending(asset);
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
        PreviewSnapshot currentLivePreview = null;
        try {
            RaceCourseMapResult currentLiveResult = resolveCourseMapWithStorage(
                    asset.getRaceId(), asset.getRaceName(), asset.getCity(), asset.getCountry(),
                    asset.getOfficialWebsite(), asset.getLatitude(), asset.getLongitude(), asset.getDistanceKm()
            );
            currentLivePreview = materializePreviewImage(toPreviewSnapshot(currentLiveResult, asset.getLiveUpdatedAt()));
        } catch (Exception ignored) {
            currentLivePreview = null;
        }
        return new RaceCourseMapAdminDetail(
                asset.getRaceId(), asset.getRaceName(), asset.getCity(), asset.getCountry(),
                materializePreviewImage(buildPreviewSnapshot(asset, false)),
                materializePreviewImage(buildPreviewSnapshot(asset, true)),
                currentLivePreview
        );
    }

    private RaceCourseMapResult analyzeResolvedImage(String source, String imageReference, byte[] imageBytes, String raceName, String city, String country, Double latitude, Double longitude, Double distanceKm) {
        PromptRaceType raceType = inferPromptRaceType(raceName, city, country, imageReference);
        String mediaType = imageService.detectMediaTypeFromBytes(imageBytes, imageReference);
        scanWatcher.record("course_map.analysis_started", "running", "Course-map image entered Qwen alignment analysis.", Map.of(
                "source", source == null ? "" : source,
                "mediaType", mediaType == null ? "" : mediaType,
                "imageBytes", imageBytes == null ? 0 : imageBytes.length,
                "raceType", raceType == null ? "" : raceType.name(),
                "distanceKm", distanceKm == null ? "" : distanceKm
        ));
        if (!imageService.isCandidateImageLargeEnough(imageBytes)) {
            scanWatcher.record("course_map.image_too_small", "failed", "Course-map image was too small or unreadable.");
            return emptyResult("Course-map image is too small or unreadable.");
        }
        if (!systemConfigService.isAiConfigured()) {
            scanWatcher.record("course_map.ai_not_configured", "failed", "AI course-map alignment is not configured.");
            return new RaceCourseMapResult(imageReference, source, false, 0, "AI course-map alignment is not configured.", null, List.of(), List.of(), null, false);
        }
        CourseMapAlignment alignment = aiService.analyzeCandidate(imageReference, imageBytes, raceName, city, country, latitude, longitude, distanceKm, false, raceType, mediaType);
        int minConf = minimumAlignmentConfidenceForSource(source);
        if (alignment != null && alignment.isCourseMap() && alignment.confidence() < minConf && alignment.confidence() >= MIN_DIRECTIVE_RETRY_CONFIDENCE && geometryService.sanitizeRoutePoints(alignment.routePoints()).size() >= MIN_DIRECTIVE_RETRY_ROUTE_POINTS) {
            scanWatcher.record("course_map.directive_retry_requested", "running", "Qwen found route hints below confidence threshold; retrying with stricter route extraction.", Map.of(
                    "confidence", alignment.confidence(),
                    "minimumConfidence", minConf,
                    "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size()
            ));
            CourseMapAlignment retried = aiService.analyzeCandidate(imageReference, imageBytes, raceName, city, country, latitude, longitude, distanceKm, true, raceType, mediaType);
            if (retried != null && retried.isCourseMap()) alignment = retried;
        }
        if (alignment == null || !alignment.isCourseMap() || alignment.confidence() < minConf) {
            scanWatcher.record("course_map.alignment_rejected", "failed", "Qwen alignment was missing or below the confidence threshold.", Map.of(
                    "confidence", alignment == null ? 0 : alignment.confidence(),
                    "minimumConfidence", minConf,
                    "isCourseMap", alignment != null && alignment.isCourseMap()
            ));
            return new RaceCourseMapResult(imageReference, source, false, alignment == null ? 0 : alignment.confidence(), alignment == null ? "Hermes could not align this course-map confidently yet." : alignment.summary(), null, List.of(), List.of(), null, alignment != null);
        }
        List<RoutePoint> routePoints = prepareRoutePointsForPlausibility(
                geometryService.sanitizeRoutePoints(alignment.routePoints()),
                distanceKm,
                minimumRoutePointCountForSource(source)
        );
        RaceCourseMapGeometryService.AlignmentPlausibilityVerdict plausibilityVerdict = geometryService.assessAlignmentPlausibility(
                routePoints,
                latitude,
                longitude,
                distanceKm,
                minimumRoutePointCountForSource(source),
                raceType
        );
        if (!plausibilityVerdict.plausible()) {
            scanWatcher.record("course_map.plausibility_failed", "failed", "Qwen route hints failed course-map plausibility checks.", Map.of(
                    "reason", plausibilityVerdict.reason() == null ? "" : plausibilityVerdict.reason(),
                    "routePoints", routePoints.size(),
                    "routeDistanceKm", Math.round(geometryService.polylineDistanceKm(routePoints) * 100.0) / 100.0,
                    "targetDistanceKm", distanceKm == null ? "" : distanceKm,
                    "raceType", raceType.name()
            ));
            RaceCourseMapResult cityLevelResult = buildCityLevelAdminRoadMarathonResultIfEligible(
                    imageReference,
                    source,
                    alignment,
                    routePoints,
                    raceName,
                    city,
                    country,
                    latitude,
                    longitude,
                    distanceKm,
                    plausibilityVerdict.reason(),
                    raceType
            );
            if (cityLevelResult != null) {
                scanWatcher.record("course_map.city_level_match_accepted", "completed", "Stylized standard road-marathon map accepted as a city-level match.", Map.of(
                        "confidence", cityLevelResult.confidence()
                ));
                return cityLevelResult;
            }
            return new RaceCourseMapResult(
                    imageReference,
                    source,
                    true,
                    alignment.confidence(),
                    "Hermes found route hints but the alignment failed the plausibility checks: "
                            + plausibilityVerdict.reason()
                            + ". "
                            + buildRouteDiagnostics(routePoints, distanceKm, raceType),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    true
            );
        }
        scanWatcher.record("course_map.plausibility_passed", "completed", "Qwen route alignment passed plausibility checks.", Map.of(
                "routePoints", routePoints.size(),
                "confidence", alignment.confidence()
        ));
        return buildAlignedResult(new ResolvedCandidateAsset(imageReference, imageBytes), new CourseMapCandidate(imageReference, source, alignment.confidence()), alignment, routePoints, latitude, longitude, distanceKm, raceType);
    }

    private RaceCourseMapResult buildCityLevelAdminRoadMarathonResultIfEligible(
            String imageReference,
            String source,
            CourseMapAlignment alignment,
            List<RoutePoint> routePoints,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String plausibilityReason,
            PromptRaceType raceType
    ) {
        if (alignment == null || source == null || !source.startsWith("admin-")) return null;
        if (!isStandardCityRoadMarathonCandidate(raceName, city, country, distanceKm)) return null;
        List<RoutePoint> safePoints = routePoints == null ? List.of() : routePoints;
        if (safePoints.size() < minimumRoutePointCountForSource(source)) return null;
        if (latitude == null || longitude == null) return null;
        double routeDistanceKm = geometryService.polylineDistanceKm(safePoints);
        if (routeDistanceKm < 3.0) return null;
        double centroidDistanceKm = geometryService.routeCentroidDistanceKm(safePoints, latitude, longitude);
        double maxCityLevelDistanceKm = Math.max(35.0, distanceKm == null ? 0.0 : distanceKm);
        if (centroidDistanceKm > maxCityLevelDistanceKm) return null;
        List<RoutePoint> labeledRoutePoints = addRouteEndpointLabels(safePoints);
        OverlayBounds bounds = geometryService.boundsFromRoute(labeledRoutePoints);
        String cityLabel = city == null || city.isBlank() ? "the race city" : city.trim();
        String summary = "Hermes accepted this upload as a city-level course-map match for a standard road marathon. "
                + "The route hints are centered in " + cityLabel
                + ", but the stylized map is not precise enough for a distance-accurate overlay: "
                + plausibilityReason
                + ". "
                + buildRouteDiagnostics(labeledRoutePoints, distanceKm, raceType);
        return new RaceCourseMapResult(
                imageReference,
                source,
                true,
                alignment.confidence(),
                summary,
                bounds,
                labeledRoutePoints,
                List.of(),
                null,
                true
        );
    }

    private boolean isStandardCityRoadMarathonCandidate(String raceName, String city, String country, Double distanceKm) {
        if (distanceKm == null || distanceKm < 40.0 || distanceKm > 45.0) return false;
        if (city == null || city.isBlank()) return false;
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        if (!combined.contains("marathon")) return false;
        return !containsNonRoadRaceSignal(combined);
    }

    private boolean containsNonRoadRaceSignal(String value) {
        return value.contains("trail")
                || value.contains("ultra")
                || value.contains("mountain")
                || value.contains("fell")
                || value.contains("cross country")
                || value.contains("xc ")
                || value.contains("relay")
                || value.contains("obstacle");
    }

    private String buildRouteDiagnostics(List<RoutePoint> routePoints, Double distanceKm, PromptRaceType raceType) {
        List<RoutePoint> safePoints = routePoints == null ? List.of() : routePoints;
        double routeDistanceKm = geometryService.polylineDistanceKm(safePoints);
        String expected = distanceKm == null || distanceKm <= 0
                ? "unknown target distance"
                : String.format(java.util.Locale.ROOT, "%.1f km target", distanceKm);
        return "Qwen returned %d route points over %.1f km for %s (%s).".formatted(
                safePoints.size(),
                routeDistanceKm,
                raceType.promptValue(),
                expected
        );
    }

    private List<RoutePoint> prepareRoutePointsForPlausibility(
            List<RoutePoint> routePoints,
            Double distanceKm,
            int minimumRoutePoints
    ) {
        if (routePoints == null || routePoints.isEmpty()) return List.of();
        if (routePoints.size() >= minimumRoutePoints) return routePoints;
        if (routePoints.size() < 6 || distanceKm == null || distanceKm <= 0) return routePoints;

        double routeDistanceKm = geometryService.polylineDistanceKm(routePoints);
        AlignmentRatioWindow coarseWindow = new AlignmentRatioWindow(0.55, 1.45);
        if (routeDistanceKm < distanceKm * coarseWindow.minRatio() || routeDistanceKm > distanceKm * coarseWindow.maxRatio()) {
            return routePoints;
        }

        int targetCount = Math.max(minimumRoutePoints, Math.min(48, routePoints.size() * 2));
        List<RoutePoint> resampled = geometryService.resampleRoute(routePoints, targetCount);
        if (resampled.isEmpty()) {
            return routePoints;
        }
        List<RoutePoint> labeled = new ArrayList<>(resampled);
        RoutePoint first = labeled.get(0);
        RoutePoint last = labeled.get(labeled.size() - 1);
        labeled.set(0, new RoutePoint(first.lat(), first.lng(), routePoints.get(0).label()));
        labeled.set(labeled.size() - 1, new RoutePoint(last.lat(), last.lng(), routePoints.get(routePoints.size() - 1).label()));
        return List.copyOf(labeled);
    }

    private RaceCourseMapResult analyzeUploadedAssetWithFallback(
            String source,
            ResolvedCandidateAsset asset,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String fallbackSummary
    ) {
        RaceCourseMapResult resolved = null;
        try {
            RaceCourseMapResult stylizedCityLevel = buildStylizedCityRoadMarathonFallbackIfEligible(
                    source,
                    asset,
                    raceName,
                    city,
                    country,
                    latitude,
                    longitude,
                    distanceKm,
                    null,
                    false
            );
            if (stylizedCityLevel != null) {
                return stylizedCityLevel;
            }
            if (shouldPreferPipelinePreview(source)) {
                try {
                    RaceCourseMapResult preferredPipeline = tryPipelineFallbackForUpload(source, asset, raceName, city, country, distanceKm, null);
                    if (preferredPipeline != null) {
                        return preferredPipeline;
                    }
                } catch (RuntimeException ignored) {
                    // Fall back to direct alignment when the preview pipeline is unavailable or incomplete.
                }
            }
            resolved = analyzeResolvedImage(source, asset.imageUrl(), asset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm);
            RaceCourseMapResult pipelineFallback = null;
            RuntimeException pipelineFailure = null;
            try {
                pipelineFallback = tryPipelineFallbackForUpload(source, asset, raceName, city, country, distanceKm, resolved);
            } catch (RuntimeException ex) {
                pipelineFailure = ex;
            }
            if (pipelineFallback != null) {
                return pipelineFallback;
            }
            if (pipelineFailure != null) {
                resolved = appendPipelineFailureSummary(resolved, source, asset, fallbackSummary, pipelineFailure);
            }
            if (shouldUseStylizedCityFallbackAfterQwen(resolved)) {
                RaceCourseMapResult postQwenStylizedCityLevel = buildStylizedCityRoadMarathonFallbackIfEligible(
                        source,
                        asset,
                        raceName,
                        city,
                        country,
                        latitude,
                        longitude,
                        distanceKm,
                        resolved == null ? null : resolved.summary(),
                        true
                );
                if (postQwenStylizedCityLevel != null) {
                    return postQwenStylizedCityLevel;
                }
            }
            if ((resolved.imageUrl() == null || resolved.imageUrl().isBlank()) && asset.imageUrl() != null && !asset.imageUrl().isBlank()) {
                return new RaceCourseMapResult(asset.imageUrl(), source, false, 0, fallbackSummary, null, List.of(), List.of(), null, false);
            }
            if (shouldUseMaterializedUploadPreview(resolved.imageUrl(), asset.imageUrl())) {
                return new RaceCourseMapResult(
                        asset.imageUrl(),
                        source,
                        resolved.courseMapDetected(),
                        resolved.confidence(),
                        resolved.summary(),
                        resolved.overlayBounds(),
                        resolved.routePoints(),
                        resolved.elevationSamples(),
                        resolved.totalClimbMeters(),
                        resolved.aiAssisted()
                );
            }
            return resolved;
        } catch (RuntimeException ex) {
            scanWatcher.record("course_map.direct_alignment_failed", "failed", "Direct course-map alignment failed before producing a publishable result.", Map.of(
                    "error", safeExceptionMessage(ex)
            ));
            try {
                RaceCourseMapResult pipelineFallback = tryPipelineFallbackForUpload(source, asset, raceName, city, country, distanceKm, resolved);
                if (pipelineFallback != null) {
                    return pipelineFallback;
                }
            } catch (RuntimeException pipelineFailure) {
                RaceCourseMapResult stylizedCityLevel = buildStylizedCityRoadMarathonFallbackIfEligible(
                        source,
                        asset,
                        raceName,
                        city,
                        country,
                        latitude,
                        longitude,
                        distanceKm,
                        safeExceptionMessage(ex),
                        true
                );
                if (stylizedCityLevel != null) {
                    return stylizedCityLevel;
                }
                return appendPipelineFailureSummary(resolved, source, asset, fallbackSummary, pipelineFailure);
            }
            RaceCourseMapResult stylizedCityLevel = buildStylizedCityRoadMarathonFallbackIfEligible(
                    source,
                    asset,
                    raceName,
                    city,
                    country,
                    latitude,
                    longitude,
                    distanceKm,
                    safeExceptionMessage(ex),
                    true
            );
            if (stylizedCityLevel != null) {
                return stylizedCityLevel;
            }
            return new RaceCourseMapResult(asset.imageUrl(), source, false, 0, fallbackSummary, null, List.of(), List.of(), null, false);
        }
    }

    private RaceCourseMapResult buildStylizedCityRoadMarathonFallbackIfEligible(
            String source,
            ResolvedCandidateAsset asset,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String directFailureReason,
            boolean allowDecodedStylizedFallback
    ) {
        if (asset == null || source == null || !source.startsWith("admin-")) return null;
        if (!isStandardCityRoadMarathonCandidate(raceName, city, country, distanceKm)) return null;
        if (latitude == null || longitude == null) return null;
        StylizedRouteMapSignal signal = detectStylizedRouteMapSignal(asset.imageBytes(), asset.imageUrl());
        Map<String, Object> signalDetails = Map.of(
                "decoded", signal.decoded(),
                "redPixels", signal.redPixels(),
                "sampledPixels", signal.sampledPixels(),
                "redRatio", signal.roundedRedRatio(),
                "lightRoadRatio", signal.roundedLightRoadRatio()
        );
        if (!signal.accepted()) {
            scanWatcher.record("course_map.stylized_city_fallback_rejected", "completed", "Upload did not match the strict stylized city-road marathon map signal.", signalDetails);
            return null;
        }
        if (directFailureReason == null || directFailureReason.isBlank()) {
            scanWatcher.record("course_map.stylized_city_fallback_deferred", "running", "Stylized city-road marathon map will run Qwen before city-level fallback.", signalDetails);
            return null;
        }
        if (signal.decoded() && !allowDecodedStylizedFallback) {
            scanWatcher.record("course_map.stylized_city_fallback_deferred", "running", "Decoded stylized city-road marathon map will run Qwen before city-level fallback.", signalDetails);
            return null;
        }
        if (isOperationalQwenFailure(directFailureReason)) {
            scanWatcher.record("course_map.stylized_city_fallback_deferred", "failed", "Qwen timed out or failed operationally, so Hermes will not accept a city-level fallback.", signalDetails);
            return null;
        }
        OverlayBounds cityBounds = buildCityLevelBounds(latitude, longitude, distanceKm);
        String cityLabel = city == null || city.isBlank() ? "the race city" : city.trim();
        String failureNote = directFailureReason == null || directFailureReason.isBlank()
                ? "Qwen did not return usable route geometry before city-level fallback."
                : "Direct Qwen alignment failed first: " + directFailureReason;
        String summary = "Hermes accepted this stylized upload as a city-level course-map match for a standard road marathon in "
                + cityLabel
                + ". The upload is treated as a city-level map reference, not a distance-accurate route overlay. "
                + failureNote;
        scanWatcher.record("course_map.stylized_city_fallback_accepted", "completed", "Stylized standard city road-marathon map accepted as a city-level match.", signalDetails);
        return new RaceCourseMapResult(
                asset.imageUrl(),
                source,
                true,
                MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE,
                summary,
                cityBounds,
                List.of(),
                List.of(),
                null,
                true
        );
    }

    private boolean isOperationalQwenFailure(String directFailureReason) {
        if (directFailureReason == null || directFailureReason.isBlank()) return false;
        String normalized = directFailureReason.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("timed out")
                || normalized.contains("timeout")
                || normalized.contains("interrupted")
                || normalized.contains("failed to start qwen")
                || normalized.contains("qwen worker process")
                || normalized.contains("produced no stdout")
                || normalized.contains("exit code");
    }

    private boolean shouldUseStylizedCityFallbackAfterQwen(RaceCourseMapResult resolved) {
        if (resolved == null) return true;
        boolean hasRouteGeometry = resolved.routePoints() != null && !resolved.routePoints().isEmpty();
        if (!resolved.courseMapDetected()) return true;
        return !hasRouteGeometry && resolved.overlayBounds() == null;
    }

    private OverlayBounds buildCityLevelBounds(Double latitude, Double longitude, Double distanceKm) {
        double raceDistanceKm = distanceKm == null || distanceKm <= 0 ? 42.195 : distanceKm;
        double latitudeSpan = Math.max(0.12, Math.min(0.46, raceDistanceKm / 111.0));
        double longitudeScale = Math.max(0.35, Math.cos(Math.toRadians(latitude)));
        double longitudeSpan = Math.max(0.12, Math.min(0.58, latitudeSpan / longitudeScale));
        return new OverlayBounds(
                latitude + latitudeSpan / 2.0,
                latitude - latitudeSpan / 2.0,
                longitude + longitudeSpan / 2.0,
                longitude - longitudeSpan / 2.0
        );
    }

    private StylizedRouteMapSignal detectStylizedRouteMapSignal(byte[] imageBytes, String imageReference) {
        if (imageBytes == null || imageBytes.length == 0) {
            return StylizedRouteMapSignal.rejected();
        }
        java.awt.image.BufferedImage image = imageService.decodeImage(imageBytes);
        if (image == null || image.getWidth() < 400 || image.getHeight() < 400) {
            if (isLikelyUndecodableCourseMapRaster(imageBytes, imageReference)) {
                return new StylizedRouteMapSignal(true, false, 0, 0, 0.0, 0.0);
            }
            return StylizedRouteMapSignal.rejected();
        }
        long totalPixels = (long) image.getWidth() * image.getHeight();
        int stride = Math.max(1, (int) Math.sqrt(Math.max(1.0, totalPixels / 50_000.0)));
        long sampled = 0;
        long routeRed = 0;
        long lightRoad = 0;
        for (int y = 0; y < image.getHeight(); y += stride) {
            for (int x = 0; x < image.getWidth(); x += stride) {
                int argb = image.getRGB(x, y);
                int alpha = (argb >>> 24) & 0xFF;
                if (alpha < 96) continue;
                int red = (argb >>> 16) & 0xFF;
                int green = (argb >>> 8) & 0xFF;
                int blue = argb & 0xFF;
                sampled++;
                if (isRouteRedPixel(red, green, blue)) {
                    routeRed++;
                }
                if (red > 180 && green > 180 && blue > 180) {
                    lightRoad++;
                }
            }
        }
        double redRatio = sampled == 0 ? 0.0 : (double) routeRed / (double) sampled;
        double lightRoadRatio = sampled == 0 ? 0.0 : (double) lightRoad / (double) sampled;
        boolean accepted = routeRed >= 250
                && redRatio >= 0.0015
                && redRatio <= 0.16
                && lightRoadRatio >= 0.01;
        return new StylizedRouteMapSignal(accepted, true, routeRed, sampled, redRatio, lightRoadRatio);
    }

    private boolean isRouteRedPixel(int red, int green, int blue) {
        return red >= 145
                && green <= 110
                && blue <= 120
                && red > green * 1.35
                && red > blue * 1.25;
    }

    private boolean isLikelyUndecodableCourseMapRaster(byte[] imageBytes, String imageReference) {
        if (imageBytes == null || imageBytes.length < 50_000) return false;
        String mediaType = imageService.detectMediaTypeFromBytes(imageBytes, imageReference);
        return "image/webp".equalsIgnoreCase(mediaType) || "image/avif".equalsIgnoreCase(mediaType);
    }

    private RaceCourseMapResult tryPipelineFallbackForUpload(
            String source,
            ResolvedCandidateAsset asset,
            String raceName,
            String city,
            String country,
            Double distanceKm,
            RaceCourseMapResult directResult
    ) {
        if (!isPipelineFallbackEligible(source, directResult)) return null;
        if (marathonRouteExtractionService == null || marathonRouteGeoreferencingService == null) return null;
        if (!marathonRouteGeoreferencingService.isConfiguredForPipelineFallback()) return null;
        String pipelineInput = buildInlinePipelineImageReference(asset);
        RoutePathExtractionResultDTO extractionResult = marathonRouteExtractionService.extractRoutePath(
                pipelineInput,
                raceName,
                city,
                country,
                distanceKm
        );
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult =
                marathonRouteGeoreferencingService.georeferenceRoute(
                        pipelineInput,
                        raceName,
                        city,
                        country,
                        extractionResult
                );
        List<RoutePoint> rawRoutePoints = georefResult.rawBreadcrumbs() == null
                ? List.of()
                : georefResult.rawBreadcrumbs().stream()
                .map(point -> new RoutePoint(point.latitude(), point.longitude(), null))
                .toList();
        List<RoutePoint> routePoints = geometryService.sanitizeRoutePoints(snapRouteToRoads(rawRoutePoints));
        if (!geometryService.isAlignmentPlausible(routePoints, null, null, distanceKm, minimumRoutePointCountForSource(source), inferPromptRaceType(raceName, city, country, null))) {
            return null;
        }
        List<RoutePoint> labeledRoutePoints = addRouteEndpointLabels(routePoints);
        OverlayBounds bounds = geometryService.boundsFromRoute(labeledRoutePoints);
        int confidence = Math.max(minimumAlignmentConfidenceForSource(source), Math.max(72, directResult == null ? 0 : directResult.confidence()));
        String summary = "Hermes aligned this upload through the extraction pipeline fallback after the direct AI scan could not produce a trustworthy route preview.";
        return new RaceCourseMapResult(asset.imageUrl(), source, true, confidence, summary, bounds, labeledRoutePoints, List.of(), null, true);
    }

    private boolean isPipelineFallbackEligible(String source, RaceCourseMapResult directResult) {
        if (source == null || !source.startsWith("admin-")) return false;
        if (directResult == null) return true;
        if (isStoredAlignedResult(directResult)) return false;
        return directResult.courseMapDetected()
                || directResult.aiAssisted()
                || (directResult.imageUrl() != null && !directResult.imageUrl().isBlank());
    }

    private boolean shouldPreferPipelinePreview(String source) {
        return source != null
                && source.startsWith("admin-")
                && marathonRouteExtractionService != null
                && marathonRouteGeoreferencingService != null
                && marathonRouteGeoreferencingService.isConfiguredForPipelineFallback();
    }

    private String buildInlinePipelineImageReference(ResolvedCandidateAsset asset) {
        String mediaType = imageService.detectMediaTypeFromBytes(asset.imageBytes(), asset.imageUrl());
        if (mediaType == null || mediaType.isBlank()) {
            mediaType = "image/png";
        }
        return "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(asset.imageBytes());
    }

    private List<RoutePoint> addRouteEndpointLabels(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.isEmpty()) return List.of();
        List<RoutePoint> labeled = new ArrayList<>(routePoints.size());
        for (int index = 0; index < routePoints.size(); index++) {
            RoutePoint point = routePoints.get(index);
            String label = point.label();
            if (index == 0 && (label == null || label.isBlank())) {
                label = "Start";
            } else if (index == routePoints.size() - 1 && (label == null || label.isBlank())) {
                label = "Finish";
            }
            labeled.add(new RoutePoint(point.lat(), point.lng(), label));
        }
        return List.copyOf(labeled);
    }

    private RaceCourseMapResult appendPipelineFailureSummary(
            RaceCourseMapResult baseResult,
            String source,
            ResolvedCandidateAsset asset,
            String fallbackSummary,
            RuntimeException pipelineFailure
    ) {
        String baseSummary = baseResult != null && baseResult.summary() != null && !baseResult.summary().isBlank()
                ? baseResult.summary()
                : fallbackSummary;
        // The extraction/geocoding fallback is an internal rescue path. If it fails,
        // keep the direct scan summary user-facing instead of leaking provider errors.
        return new RaceCourseMapResult(
                asset.imageUrl(),
                source,
                baseResult != null && baseResult.courseMapDetected(),
                baseResult == null ? 0 : baseResult.confidence(),
                baseSummary,
                baseResult == null ? null : baseResult.overlayBounds(),
                baseResult == null || baseResult.routePoints() == null ? List.of() : baseResult.routePoints(),
                baseResult == null || baseResult.elevationSamples() == null ? List.of() : baseResult.elevationSamples(),
                baseResult == null ? null : baseResult.totalClimbMeters(),
                baseResult != null && baseResult.aiAssisted()
        );
    }

    private boolean shouldUseMaterializedUploadPreview(String resolvedImageUrl, String materializedImageUrl) {
        if (materializedImageUrl == null || materializedImageUrl.isBlank()) return false;
        if (resolvedImageUrl == null || resolvedImageUrl.isBlank()) return true;
        if (Objects.equals(resolvedImageUrl, materializedImageUrl)) return false;
        return isImageDataUrl(resolvedImageUrl) || isPdfDataUrl(resolvedImageUrl);
    }

    private RaceCourseMapResult buildAlignedResult(ResolvedCandidateAsset asset, CourseMapCandidate candidate, CourseMapAlignment alignment, List<RoutePoint> routePoints, Double latitude, Double longitude, Double distanceKm, PromptRaceType raceType) {
        List<RoutePoint> snapped = snapRouteToRoads(routePoints);
        List<RoutePoint> finalPoints = geometryService.isAlignmentPlausible(snapped, latitude, longitude, distanceKm, MIN_ALIGNMENT_ROUTE_POINTS, raceType) ? snapped : routePoints;
        OverlayBounds bounds = sanitizeOverlayBounds(alignment.overlayBounds(), finalPoints);
        // Elevation logic simplified for coordination
        return new RaceCourseMapResult(asset.imageUrl(), candidate.source(), true, alignment.confidence(), alignment.summary(), bounds, finalPoints, List.of(), null, true);
    }

    private RaceCourseMapResult buildStagedUploadResult(ResolvedCandidateAsset asset, String source) {
        return new RaceCourseMapResult(
                asset.imageUrl(),
                source,
                false,
                0,
                "Hermes saved this upload. Click Re-analyze to run Qwen on the stored course-map image.",
                null,
                List.of(),
                List.of(),
                null,
                false
        );
    }

    private void ensurePendingAlignedForPublish(RaceCourseMapAsset asset) {
        if (asset == null) return;
        RaceCourseMapResult pending = toResult(asset, false);
        if (isStoredAlignedResult(pending) || isStoredCityLevelReferenceResult(pending)) return;
        throw new IllegalArgumentException("Pending course-map must align or be accepted as a city-level reference before publishing live.");
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

    private boolean isStoredCityLevelReferenceResult(RaceCourseMapResult result) {
        return result != null
                && result.courseMapDetected()
                && result.overlayBounds() != null
                && (result.routePoints() == null || result.routePoints().isEmpty())
                && result.confidence() >= MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE
                && result.aiAssisted()
                && isCityLevelReferenceSummary(result.summary());
    }

    private boolean isCityLevelReferenceSummary(String summary) {
        String normalized = summary == null ? "" : summary.toLowerCase(java.util.Locale.ROOT);
        if (hasOperationalQwenFailureSummary(summary)) return false;
        return normalized.contains("city-level course-map match")
                && normalized.contains("not a distance-accurate route overlay");
    }

    private boolean hasOperationalQwenFailureSummary(String summary) {
        if (summary == null || summary.isBlank()) return false;
        String normalized = summary.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("direct qwen alignment failed first")
                && isOperationalQwenFailure(summary);
    }

    private String sanitizeStoredCourseMapSummary(String summary) {
        if (!hasOperationalQwenFailureSummary(summary)) return summary;
        return "Hermes needs a fresh Qwen re-scan for this stored course-map preview because the previous local Qwen alignment timed out before producing usable route geometry.";
    }

    private RaceCourseMapResult keepExistingAlignmentWhenReanalysisRegresses(RaceCourseMapResult existingResult, RaceCourseMapResult reanalysisResult) {
        if (isStoredAlignedResult(existingResult) && !isStoredAlignedResult(reanalysisResult)) {
            scanWatcher.record("course_map.reanalysis_preserved_existing", "completed", "Fresh Qwen reanalysis failed, so Hermes kept the previous aligned pending map.", Map.of(
                    "existingRoutePoints", existingResult.routePoints() == null ? 0 : existingResult.routePoints().size(),
                    "freshConfidence", reanalysisResult == null ? 0 : reanalysisResult.confidence()
            ));
            return existingResult;
        }
        return reanalysisResult;
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
        String summary = sanitizeStoredCourseMapSummary(live ? asset.getLiveSummary() : asset.getPendingSummary());
        String overlayBoundsJson = live ? asset.getLiveOverlayBoundsJson() : asset.getPendingOverlayBoundsJson();
        String routePointsJson = live ? asset.getLiveRoutePointsJson() : asset.getPendingRoutePointsJson();
        String elevationSamplesJson = live ? asset.getLiveElevationSamplesJson() : asset.getPendingElevationSamplesJson();
        Integer totalClimb = live ? asset.getLiveTotalClimbMeters() : asset.getPendingTotalClimbMeters();
        Boolean aiAssisted = live ? asset.getLiveAiAssisted() : asset.getPendingAiAssisted();
        OverlayBounds overlayBounds = readJson(overlayBoundsJson, new TypeReference<OverlayBounds>() {}, null);
        List<RoutePoint> routePoints = readJson(routePointsJson, new TypeReference<List<RoutePoint>>() {}, List.of());
        boolean detected = !routePoints.isEmpty()
                || (overlayBounds != null
                && routePoints.isEmpty()
                && confidence != null
                && confidence >= MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE
                && Boolean.TRUE.equals(aiAssisted)
                && isCityLevelReferenceSummary(summary));
        return new RaceCourseMapResult(
                imageUrl == null ? "" : imageUrl, source == null ? "" : source, detected,
                confidence == null ? 0 : confidence, summary == null ? "" : summary,
                overlayBounds,
                routePoints,
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
        String rawSummary = pending ? asset.getPendingSummary() : asset.getLiveSummary();
        boolean staleOperationalQwenFailure = hasOperationalQwenFailureSummary(rawSummary);
        String summary = sanitizeStoredCourseMapSummary(rawSummary);
        String overlayBoundsJson = pending ? asset.getPendingOverlayBoundsJson() : asset.getLiveOverlayBoundsJson();
        String routePointsJson = pending ? asset.getPendingRoutePointsJson() : asset.getLiveRoutePointsJson();
        String elevationSamplesJson = pending ? asset.getPendingElevationSamplesJson() : asset.getLiveElevationSamplesJson();
        Integer totalClimbMeters = pending ? asset.getPendingTotalClimbMeters() : asset.getLiveTotalClimbMeters();
        Boolean aiAssisted = pending ? asset.getPendingAiAssisted() : asset.getLiveAiAssisted();
        String updatedAt = pending ? (asset.getPendingUpdatedAt() == null ? null : asset.getPendingUpdatedAt().toString()) : (asset.getLiveUpdatedAt() == null ? null : asset.getLiveUpdatedAt().toString());
        if ((imageUrl == null || imageUrl.isBlank()) && (summary == null || summary.isBlank())) return null;
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
                (Boolean.TRUE.equals(aiAssisted) && !staleOperationalQwenFailure) || !routePoints.isEmpty()
        );
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
    private String safeExceptionMessage(RuntimeException exception) {
        return exception == null || exception.getMessage() == null || exception.getMessage().isBlank()
                ? "runtime failure"
                : exception.getMessage();
    }

    private PromptRaceType inferPromptRaceType(String raceName, String city, String country, String websiteUrl) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country), normalize(websiteUrl));
        if (combined.contains("out and back") || combined.contains("out-and-back") || combined.contains("outandback")) return PromptRaceType.OUT_AND_BACK;
        if (combined.contains("loop") || combined.contains("circuit")) return PromptRaceType.LOOP;
        if (combined.contains("chicago marathon") || combined.contains("chicagomarathon.com")) return PromptRaceType.LOOP;
        return PromptRaceType.POINT_TO_POINT;
    }

    private String classifyAdminUploadSource(String ref) {
        if (isPdfDataUrl(ref)) return "admin-document-url";
        if (isImageDataUrl(ref)) return "admin-upload";
        return (ref != null && ref.toLowerCase(java.util.Locale.ROOT).contains(".pdf")) ? "admin-document-url" : "admin-image-url";
    }

    private boolean isImageDataUrl(String url) { return url != null && url.regionMatches(true, 0, "data:image/", 0, 11); }
    private boolean isPdfDataUrl(String url) { return url != null && url.regionMatches(true, 0, "data:application/pdf", 0, 20); }

    private boolean shouldRefresh(RaceCourseMapResult result) { return result == null || (!result.courseMapDetected() && (result.imageUrl() == null || result.imageUrl().isBlank())); }

    private RaceCourseMapResult emptyResult(String summary) { return new RaceCourseMapResult("", "", false, 0, summary, null, List.of(), List.of(), null, false); }

    // --- Private records and enums retained for internal use or passed between services ---

    public record ResolvedCandidateAsset(String imageUrl, byte[] imageBytes) {}
    public record CourseMapCandidate(String imageUrl, String source, int score) {}
    public record CourseMapAlignment(boolean isCourseMap, int confidence, String summary, OverlayBounds overlayBounds, List<RoutePoint> routePoints, String startLabel, String finishLabel) {}
    private record RetryableAlignmentCandidate(CourseMapCandidate candidate, ResolvedCandidateAsset asset, double score) {}
    public record AlignmentRatioWindow(double minRatio, double maxRatio) {}
    private record StylizedRouteMapSignal(boolean accepted, boolean decoded, long redPixels, long sampledPixels, double redRatio, double lightRoadRatio) {
        private static StylizedRouteMapSignal rejected() {
            return new StylizedRouteMapSignal(false, false, 0, 0, 0.0, 0.0);
        }

        private double roundedRedRatio() {
            return Math.round(redRatio * 10_000.0) / 10_000.0;
        }

        private double roundedLightRoadRatio() {
            return Math.round(lightRoadRatio * 10_000.0) / 10_000.0;
        }
    }
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
