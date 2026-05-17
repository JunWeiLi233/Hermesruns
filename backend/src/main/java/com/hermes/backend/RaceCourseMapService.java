package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Locale;

@Service
public class RaceCourseMapService {
    private static final Duration CACHE_TTL = Duration.ofHours(24);
    private static final int MIN_ALIGNMENT_CONFIDENCE = 68;
    private static final int MIN_DIRECTIVE_RETRY_CONFIDENCE = 55;
    private static final int MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE = 58;
    private static final int MIN_ALIGNMENT_ROUTE_POINTS = 12;
    private static final int MIN_DIRECTIVE_RETRY_ROUTE_POINTS = 20;
    private static final int MAX_URL_LENGTH = 500;
    private static final int MAX_CANDIDATES = 6;
    private static final int MAX_AI_ANALYSIS_ATTEMPTS = 4;
    private static final double ELEVATION_SAMPLES_PER_KILOMETER = 20.0;
    private static final int DEFAULT_ELEVATION_SAMPLE_COUNT = 25;
    private static final int CLIMB_DELTA_THRESHOLD_METERS = 1;
    private static final int ABRUPT_ELEVATION_DELTA_THRESHOLD_METERS = 8;
    private static final String AUTO_ACQUIRE_SOURCE = "admin-auto-acquire";
    private static final int MAX_AUTO_ACQUIRE_CANDIDATES = 6;
    private static final String STAGED_UPLOAD_SUMMARY = "Hermes saved this upload and queued it for automatic Qwen scanning.";

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
    private final TtlCacheStore cacheStore;

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
        this(restTemplate, objectMapper, systemConfigService, raceCourseMapAssetRepository, osrmMapMatchingClient,
                geometryService, searchService, imageService, aiService, marathonRouteExtractionService,
                marathonRouteGeoreferencingService, scanWatcher,
                TtlCacheStore.inMemoryForTests(objectMapper.copy(), Clock.systemUTC()));
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
            MarathonRouteGeoreferencingService marathonRouteGeoreferencingService,
            CourseMapScanWatcher scanWatcher,
            TtlCacheStore cacheStore
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
        this.cacheStore = cacheStore;
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
        CachedResult cached = cacheStore.get("race-course-map", cacheKey, CachedResult.class).orElse(null);
        if (cached != null && !shouldRefresh(cached.result())) {
            return cached.result();
        }

        RaceCourseMapResult resolved = doResolveCourseMap(raceName, city, country, websiteUrl, latitude, longitude, distanceKm);
        cacheStore.put("race-course-map", cacheKey, new CachedResult(resolved), CACHE_TTL);
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
        RaceCourseMapResult resolved = resolveCourseMap(raceName, city, country, websiteUrl, latitude, longitude, distanceKm);
        if ((resolved.imageUrl() != null && !resolved.imageUrl().isBlank()) || resolved.courseMapDetected()) {
            persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, "system-scan");
        }
        return resolved;
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
        if (searchService == null || imageService == null) {
            return emptyResult("No course-map candidate found yet.");
        }

        String safeWebsite = SafeUrlValidator.validateHttpUrlOrNull(websiteUrl, MAX_URL_LENGTH, "officialWebsite");
        if (!isCourseMapAiAvailable() && !isFixtureCourseMapWebsite(safeWebsite)) {
            return emptyResult("Upload a course map in the admin workspace before Hermes can analyze or publish it.");
        }
        LinkedHashMap<String, CourseMapCandidate> candidates = new LinkedHashMap<>();
        if (safeWebsite != null) {
            searchService.collectOfficialPageCandidates(candidates, safeWebsite);
        }
        if (candidates.isEmpty()) {
            candidates.putAll(searchService.collectCandidates(raceName, city, country, safeWebsite, distanceKm));
        }
        if (candidates.isEmpty()) {
            return emptyResult("Upload a course map in the admin workspace before Hermes can analyze or publish it.");
        }

        List<CourseMapCandidate> ranked = candidates.values().stream()
                .sorted((left, right) -> Integer.compare(right.score(), left.score()))
                .limit(MAX_CANDIDATES)
                .toList();

        ResolvedCandidateAsset fallbackAsset = null;
        CourseMapCandidate fallbackCandidate = null;
        RaceCourseMapResult bestPartialResult = null;
        int aiAnalysisAttempts = 0;
        for (CourseMapCandidate candidate : ranked) {
            List<ResolvedCandidateAsset> resolvedAssets;
            try {
                resolvedAssets = imageService.resolveCandidateAssets(candidate);
            } catch (RuntimeException ignored) {
                continue;
            }
            for (ResolvedCandidateAsset asset : resolvedAssets) {
                if (asset == null || asset.imageBytes() == null || asset.imageBytes().length == 0) {
                    continue;
                }
                if (fallbackAsset == null) {
                    fallbackAsset = asset;
                    fallbackCandidate = candidate;
                }
                if (!isCourseMapAiAvailable()) {
                    return candidateOnlyResult(asset.imageUrl(), candidate.source(), "AI course-map alignment is not configured.");
                }
                if (aiAnalysisAttempts >= MAX_AI_ANALYSIS_ATTEMPTS) {
                    return cappedAnalysisResult(bestPartialResult, fallbackAsset, fallbackCandidate);
                }
                aiAnalysisAttempts += 1;

                RaceCourseMapResult resolved = analyzeResolvedImage(
                        candidate.source(),
                        asset.imageUrl(),
                        asset.imageBytes(),
                        raceName,
                        city,
                        country,
                        latitude,
                        longitude,
                        distanceKm
                );
                if (isStoredAlignedResult(resolved)) {
                    return resolved;
                }
                if (resolved != null
                        && resolved.imageUrl() != null
                        && !resolved.imageUrl().isBlank()
                        && (bestPartialResult == null || resolved.confidence() > bestPartialResult.confidence())) {
                    bestPartialResult = resolved;
                }
            }
        }

        if (bestPartialResult != null) {
            return bestPartialResult;
        }
        if (fallbackAsset != null && fallbackCandidate != null) {
            return candidateOnlyResult(
                    fallbackAsset.imageUrl(),
                    fallbackCandidate.source(),
                    "Hermes found a likely course-map image but could not align it confidently yet."
            );
        }
        return emptyResult("Upload a course map in the admin workspace before Hermes can analyze or publish it.");
    }

    public CourseMapAcquisitionResult acquireAndPublishCourseMap(
            CourseMapAcquisitionRequest request,
            String actorEmail,
            boolean onlyMissing
    ) {
        if (request == null || request.raceId() == null || request.raceId().isBlank()) {
            throw new IllegalArgumentException("race_course_map_request_missing");
        }
        if (!isStandardCityRoadMarathonCandidate(request.raceName(), request.city(), request.country(), request.distanceKm())) {
            return acquisitionResult(request, "skipped_non_standard", false, 0, 0, "Race is not a standard city road marathon.");
        }
        if (onlyMissing && hasPublishableLiveCourseMap(request.raceId())) {
            return acquisitionResult(request, "skipped_live", false, 0, 0, "Race already has a published route-backed course map.");
        }

        scanWatcher.record("course_map.bulk_acquire_started", "running", "Hermes started automatic course-map acquisition.", Map.of(
                "raceId", request.raceId(),
                "raceName", request.raceName() == null ? "" : request.raceName(),
                "city", request.city() == null ? "" : request.city(),
                "country", request.country() == null ? "" : request.country()
        ));

        int candidatesTried = 0;
        int bestConfidence = 0;
        String bestSummary = "";
        List<ResolvedCandidateAsset> localAssets = imageService.resolveLocalCourseMapAssets(request.raceId());
        scanWatcher.record("course_map.bulk_local_candidates_collected", "completed", "Hermes collected locally stored course-map images for this race.", Map.of(
                "localCandidates", localAssets.size()
        ));
        for (ResolvedCandidateAsset localAsset : localAssets) {
            candidatesTried++;
            AcquisitionAttemptResult attempt = analyzeAndPublishAcquisitionAsset(request, actorEmail, localAsset);
            if (attempt.result() != null && attempt.result().confidence() > bestConfidence) {
                bestConfidence = attempt.result().confidence();
                bestSummary = attempt.result().summary();
            }
            if (attempt.published()) {
                return acquisitionResult(request, "published", true, candidatesTried, attempt.result().confidence(), attempt.result().summary());
            }
        }

        if (searchService == null) {
            return acquisitionResult(request, localAssets.isEmpty() ? "no_candidates" : "not_publishable", false, candidatesTried, bestConfidence, bestSummary);
        }

        List<CourseMapCandidate> remoteCandidates = searchService.collectCandidates(
                        request.raceName(),
                        request.city(),
                        request.country(),
                        request.websiteUrl(),
                        request.distanceKm()
                )
                .values()
                .stream()
                .sorted((left, right) -> Integer.compare(right.score(), left.score()))
                .limit(MAX_AUTO_ACQUIRE_CANDIDATES)
                .toList();
        scanWatcher.record("course_map.bulk_candidates_collected", "completed", "Hermes collected official/search course-map candidates for this race.", Map.of(
                "remoteCandidates", remoteCandidates.size(),
                "maxRemoteCandidates", MAX_AUTO_ACQUIRE_CANDIDATES
        ));
        for (CourseMapCandidate candidate : remoteCandidates) {
            List<ResolvedCandidateAsset> resolvedAssets;
            try {
                resolvedAssets = imageService.resolveCandidateAssets(candidate);
            } catch (RuntimeException ex) {
                scanWatcher.record("course_map.bulk_candidate_fetch_failed", "failed", "Hermes could not fetch this course-map candidate.", Map.of(
                        "candidateUrl", candidate.imageUrl() == null ? "" : candidate.imageUrl(),
                        "source", candidate.source() == null ? "" : candidate.source(),
                        "error", safeExceptionMessage(ex)
                ));
                continue;
            }
            for (ResolvedCandidateAsset asset : resolvedAssets) {
                candidatesTried++;
                AcquisitionAttemptResult attempt = analyzeAndPublishAcquisitionAsset(request, actorEmail, asset);
                if (attempt.result() != null && attempt.result().confidence() > bestConfidence) {
                    bestConfidence = attempt.result().confidence();
                    bestSummary = attempt.result().summary();
                }
                if (attempt.published()) {
                    return acquisitionResult(request, "published", true, candidatesTried, attempt.result().confidence(), attempt.result().summary());
                }
            }
        }

        String status = candidatesTried == 0 ? "no_candidates" : "not_publishable";
        String summary = bestSummary == null || bestSummary.isBlank()
                ? "Hermes did not find a candidate that could produce trustworthy OpenStreetMap-ready route geometry."
                : bestSummary;
        return acquisitionResult(request, status, false, candidatesTried, bestConfidence, summary);
    }

    public String materializePreviewImageUrl(String imageUrl) {
        return imageService.buildDisplayablePreviewImageUrl(imageUrl);
    }

    public String materializeTransparentOverlayImageUrl(String imageUrl) {
        return imageService.buildTransparentCourseMapOverlayImageUrl(imageUrl);
    }

    public RaceCourseMapImageService.DisplayableCourseMapImage resolveDisplayableLocalImage(String imageReference) {
        return imageService.resolveDisplayableLocalImage(imageReference);
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
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail, true);
        RaceCourseMapResult undecodableCityLevel = buildStylizedCityRoadMarathonFallbackIfEligible(
                source,
                storedAsset,
                raceName,
                city,
                country,
                latitude,
                longitude,
                distanceKm,
                "Qwen was skipped for an undecodable modern raster upload.",
                false
        );
        if (undecodableCityLevel != null) {
            persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, undecodableCityLevel, actorEmail, true);
            return undecodableCityLevel;
        }
        if (shouldAnalyzeUploadImmediately(validated)) {
            try {
                RaceCourseMapResult analyzed = analyzeUploadedAssetWithFallback(
                        source,
                        storedAsset,
                        raceName,
                        city,
                        country,
                        latitude,
                        longitude,
                        distanceKm,
                        STAGED_UPLOAD_SUMMARY
                );
                persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, analyzed, actorEmail, true);
                return analyzed;
            } catch (RuntimeException ignored) {
                return resolved;
            }
        }
        return resolved;
    }

    public RaceCourseMapResult scanPendingCourseMap(
            String raceId, String raceName, String city, String country, String websiteUrl,
            Double latitude, Double longitude, Double distanceKm, String actorEmail
    ) {
        RaceCourseMapAsset existingAsset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (existingAsset != null && existingAsset.getPendingImageUrl() != null && !existingAsset.getPendingImageUrl().isBlank()) {
            return reanalyzePendingCourseMap(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, actorEmail);
        }
        return acquirePendingCourseMapScanCandidate(
                new CourseMapAcquisitionRequest(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm),
                actorEmail
        );
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

    public void markPendingCourseMapScanFailed(String raceId, String failureSummary, String actorEmail) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (asset == null || asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            return;
        }
        RaceCourseMapResult currentPending = toResult(asset, false);
        if (isStoredAlignedResult(currentPending) || isStoredCityLevelReferenceResult(currentPending)) {
            return;
        }
        String safeSummary = failureSummary == null || failureSummary.isBlank()
                ? "Course-map scan failed before Hermes could replace the staged upload preview."
                : failureSummary;
        asset.setPendingConfidence(0);
        asset.setPendingSummary(sanitizeStoredCourseMapSummary(safeSummary));
        asset.setPendingOverlayBoundsJson(null);
        asset.setPendingRoutePointsJson("[]");
        asset.setPendingElevationSamplesJson("[]");
        asset.setPendingTotalClimbMeters(null);
        asset.setPendingAiAssisted(false);
        asset.setPendingUpdatedAt(LocalDateTime.now());
        asset.setPendingUpdatedByEmail(actorEmail);
        raceCourseMapAssetRepository.save(asset);
    }

    public void acceptPendingCourseMap(String raceId, String actorEmail) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId)
                .orElseThrow(() -> new IllegalArgumentException("Race course-map asset not found."));
        if (asset.getPendingImageUrl() == null || asset.getPendingImageUrl().isBlank()) {
            throw new IllegalArgumentException("No pending course-map preview to publish.");
        }
        ensurePendingAlignedForPublish(asset, actorEmail);
        applyLiveResult(asset, toResult(asset, false), actorEmail, LocalDateTime.now());
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
        scanWatcher.beginStep("course_map.image_materialize", "Validating course-map image size and format.");
        scanWatcher.record("course_map.analysis_started", "RUNNING", "Course-map image entered Qwen alignment analysis.", Map.of(
                "source", source == null ? "" : source,
                "mediaType", mediaType == null ? "" : mediaType,
                "imageBytes", imageBytes == null ? 0 : imageBytes.length,
                "raceType", raceType == null ? "" : raceType.name(),
                "distanceKm", distanceKm == null ? "" : distanceKm
        ));
        if (!imageService.isCandidateImageLargeEnough(imageBytes)) {
            scanWatcher.completeStep("course_map.image_materialize", "FAILED", "Course-map image was too small or unreadable.");
            scanWatcher.record("course_map.image_too_small", "FAILED", "Course-map image was too small or unreadable.");
            return emptyResult("Course-map image is too small or unreadable.");
        }
        scanWatcher.completeStep("course_map.image_materialize", "SUCCESS", "Course-map image passed size validation.");

        scanWatcher.beginStep("course_map.ai_config_check", "Checking AI provider configuration.");
        if (!isCourseMapAiAvailable()) {
            String message = "Course-map AI is not configured. Use local Qwen with app.ai.course-map.provider=qwen-local or configure APP_AI_API_KEY for cloud-backed course-map scans.";
            scanWatcher.completeStep("course_map.ai_config_check", "FAILED", message);
            scanWatcher.record("course_map.ai_not_configured", "FAILED", message);
            return new RaceCourseMapResult(imageReference, source, false, 0, message, null, List.of(), List.of(), null, false);
        }
        scanWatcher.completeStep("course_map.ai_config_check", "SUCCESS", "Course-map AI provider is configured.");

        scanWatcher.beginStep("course_map.ai_alignment", "Running Qwen vision alignment on the course-map image.");
        boolean preserveRejectedAlignment = isAdminCourseMapSource(source);
        CourseMapAlignment alignment = aiService.analyzeCandidate(imageReference, imageBytes, raceName, city, country, latitude, longitude, distanceKm, false, raceType, mediaType, preserveRejectedAlignment);
        int minConf = minimumAlignmentConfidenceForSource(source);
        boolean directiveRetryAccepted = false;
        if (alignment != null && alignment.isCourseMap() && alignment.confidence() < minConf && alignment.confidence() >= MIN_DIRECTIVE_RETRY_CONFIDENCE && geometryService.sanitizeRoutePoints(alignment.routePoints()).size() >= MIN_DIRECTIVE_RETRY_ROUTE_POINTS) {
            scanWatcher.record("course_map.directive_retry_requested", "RUNNING", "Qwen found route hints below confidence threshold; retrying with stricter route extraction.", Map.of(
                    "confidence", alignment.confidence(),
                    "minimumConfidence", minConf,
                    "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size()
            ));
            CourseMapAlignment retried = aiService.analyzeCandidate(imageReference, imageBytes, raceName, city, country, latitude, longitude, distanceKm, true, raceType, mediaType, preserveRejectedAlignment);
            if (retried != null && retried.isCourseMap()) {
                alignment = retried;
                directiveRetryAccepted = retried.confidence() >= MIN_DIRECTIVE_RETRY_CONFIDENCE;
            }
        }
        if (directiveRetryAccepted) {
            minConf = MIN_DIRECTIVE_RETRY_CONFIDENCE;
        }
        if (alignment == null || !alignment.isCourseMap() || alignment.confidence() < minConf) {
            scanWatcher.completeStep("course_map.ai_alignment", "FAILED", "Qwen alignment was missing or below the confidence threshold.", Map.of(
                    "confidence", alignment == null ? 0 : alignment.confidence(),
                    "minimumConfidence", minConf,
                    "isCourseMap", alignment != null && alignment.isCourseMap()
            ));
            scanWatcher.record("course_map.alignment_rejected", "FAILED", "Qwen alignment was missing or below the confidence threshold.", Map.of(
                    "confidence", alignment == null ? 0 : alignment.confidence(),
                    "minimumConfidence", minConf,
                    "isCourseMap", alignment != null && alignment.isCourseMap()
            ));
            return new RaceCourseMapResult(imageReference, source, false, alignment == null ? 0 : alignment.confidence(), alignment == null ? "Hermes could not align this course-map confidently yet." : alignment.summary(), null, List.of(), List.of(), null, alignment != null);
        }
        scanWatcher.completeStep("course_map.ai_alignment", "SUCCESS", "Qwen produced a course-map alignment.", Map.of(
                "confidence", alignment.confidence(),
                "routePoints", alignment.routePoints() == null ? 0 : alignment.routePoints().size()
        ));

        scanWatcher.beginStep("course_map.plausibility_check", "Validating alignment against route plausibility rules.");
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
            scanWatcher.completeStep("course_map.plausibility_check", "FAILED", "Qwen route hints failed course-map plausibility checks.", Map.of(
                    "reason", plausibilityVerdict.reason() == null ? "" : plausibilityVerdict.reason(),
                    "routePoints", routePoints.size(),
                    "routeDistanceKm", Math.round(geometryService.polylineDistanceKm(routePoints) * 100.0) / 100.0,
                    "targetDistanceKm", distanceKm == null ? "" : distanceKm,
                    "raceType", raceType.name()
            ));
            scanWatcher.record("course_map.plausibility_failed", "FAILED", "Qwen route hints failed course-map plausibility checks.", Map.of(
                    "reason", plausibilityVerdict.reason() == null ? "" : plausibilityVerdict.reason(),
                    "routePoints", routePoints.size(),
                    "routeDistanceKm", Math.round(geometryService.polylineDistanceKm(routePoints) * 100.0) / 100.0,
                    "targetDistanceKm", distanceKm == null ? "" : distanceKm,
                    "raceType", raceType.name()
            ));
            scanWatcher.beginStep("course_map.city_level_fallback", "Checking city-level reference eligibility.");
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
                scanWatcher.completeStep("course_map.city_level_fallback", "SUCCESS", "Stylized standard road-marathon map accepted as a city-level match.", Map.of(
                        "confidence", cityLevelResult.confidence()
                ));
                scanWatcher.record("course_map.city_level_match_accepted", "SUCCESS", "Stylized standard road-marathon map accepted as a city-level match.", Map.of(
                        "confidence", cityLevelResult.confidence()
                ));
                return cityLevelResult;
            }
            scanWatcher.completeStep("course_map.city_level_fallback", "SKIPPED", "City-level reference not eligible for this alignment.");
            if (!isAdminCourseMapSource(source)) {
                return new RaceCourseMapResult(
                        imageReference,
                        source,
                        false,
                        alignment.confidence(),
                        "Hermes could not align this course-map confidently yet.",
                        null,
                        List.of(),
                        List.of(),
                        null,
                        true
                );
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
        scanWatcher.completeStep("course_map.plausibility_check", "SUCCESS", "Qwen route alignment passed plausibility checks.", Map.of(
                "routePoints", routePoints.size(),
                "confidence", alignment.confidence()
        ));
        scanWatcher.record("course_map.plausibility_passed", "SUCCESS", "Qwen route alignment passed plausibility checks.", Map.of(
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
        if (alignment == null || !isAdminCourseMapSource(source)) return null;
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
            scanWatcher.beginStep("course_map.stylized_city_check", "Checking if the upload is a pre-qualified stylized city-road marathon map.");
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
                scanWatcher.completeStep("course_map.stylized_city_check", "SUCCESS", "Stylized city-road marathon map accepted before Qwen.");
                return stylizedCityLevel;
            }
            scanWatcher.completeStep("course_map.stylized_city_check", "SKIPPED", "Upload did not pre-qualify for stylized city-level fallback.");

            if (shouldPreferPipelinePreview(source)) {
                scanWatcher.beginStep("course_map.pipeline_preferred", "Running CV/georeference pipeline as the preferred preview path.");
                try {
                    RaceCourseMapResult preferredPipeline = tryPipelineFallbackForUpload(source, asset, raceName, city, country, latitude, longitude, distanceKm, null);
                    if (preferredPipeline != null) {
                        scanWatcher.completeStep("course_map.pipeline_preferred", "SUCCESS", "Preferred CV/georeference fallback produced a usable result.");
                        return preferredPipeline;
                    }
                    scanWatcher.completeStep("course_map.pipeline_preferred", "SKIPPED", "Preferred pipeline did not produce a usable result.");
                } catch (RuntimeException ex) {
                    scanWatcher.completeStep("course_map.pipeline_preferred", "FAILED", "Preferred CV/georeference fallback failed.", Map.of(
                            "error", safeExceptionMessage(ex)
                    ));
                    scanWatcher.record("course_map.pipeline_preferred_failed", "FAILED", "Preferred CV/georeference fallback failed before direct Qwen alignment.", Map.of(
                            "error", safeExceptionMessage(ex)
                    ));
                    // Fall back to direct alignment when the preview pipeline is unavailable or incomplete.
                }
            }

            scanWatcher.beginStep("course_map.direct_alignment", "Running direct Qwen vision alignment on the course-map image.");
            resolved = analyzeResolvedImage(source, asset.imageUrl(), asset.imageBytes(), raceName, city, country, latitude, longitude, distanceKm);
            scanWatcher.completeStep("course_map.direct_alignment", resolved.courseMapDetected() ? "SUCCESS" : "FAILED", "Direct Qwen alignment completed.", Map.of(
                    "confidence", resolved.confidence(),
                    "courseMapDetected", resolved.courseMapDetected()
            ));

            scanWatcher.beginStep("course_map.pipeline_fallback", "Running CV/georeference extraction pipeline as post-Qwen fallback.");
            RaceCourseMapResult pipelineFallback = null;
            RuntimeException pipelineFailure = null;
            try {
                pipelineFallback = tryPipelineFallbackForUpload(source, asset, raceName, city, country, latitude, longitude, distanceKm, resolved);
            } catch (RuntimeException ex) {
                pipelineFailure = ex;
            }
            if (pipelineFallback != null) {
                scanWatcher.completeStep("course_map.pipeline_fallback", "SUCCESS", "CV/georeference pipeline fallback produced a usable result.");
                return pipelineFallback;
            }
            if (pipelineFailure != null) {
                scanWatcher.completeStep("course_map.pipeline_fallback", "FAILED", "CV/georeference pipeline fallback failed.", Map.of(
                        "error", safeExceptionMessage(pipelineFailure)
                ));
                resolved = appendPipelineFailureSummary(resolved, source, asset, fallbackSummary, pipelineFailure);
            } else {
                scanWatcher.completeStep("course_map.pipeline_fallback", "SKIPPED", "CV/georeference pipeline fallback was not needed or not eligible.");
            }

            scanWatcher.beginStep("course_map.post_qwen_stylized_fallback", "Checking post-Qwen stylized city-level fallback eligibility.");
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
                    scanWatcher.completeStep("course_map.post_qwen_stylized_fallback", "SUCCESS", "Post-Qwen stylized city-level fallback accepted.");
                    return postQwenStylizedCityLevel;
                }
            }
            scanWatcher.completeStep("course_map.post_qwen_stylized_fallback", "SKIPPED", "Post-Qwen stylized city-level fallback was not eligible.");
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
                RaceCourseMapResult pipelineFallback = tryPipelineFallbackForUpload(source, asset, raceName, city, country, latitude, longitude, distanceKm, resolved);
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

    private AcquisitionAttemptResult analyzeAndPublishAcquisitionAsset(
            CourseMapAcquisitionRequest request,
            String actorEmail,
            ResolvedCandidateAsset asset
    ) {
        if (asset == null || asset.imageBytes() == null || asset.imageBytes().length == 0) {
            return new AcquisitionAttemptResult(null, false);
        }
        try {
            ResolvedCandidateAsset storedAsset = imageService.storeCourseMapUpload(request.raceId(), asset);
            RaceCourseMapResult resolved = analyzeUploadedAssetWithFallback(
                    AUTO_ACQUIRE_SOURCE,
                    storedAsset,
                    request.raceName(),
                    request.city(),
                    request.country(),
                    request.latitude(),
                    request.longitude(),
                    request.distanceKm(),
                    "Hermes found a course-map candidate but could not align it confidently yet."
            );
            if (isStoredAlignedResult(resolved)) {
                persistPending(
                        request.raceId(),
                        request.raceName(),
                        request.city(),
                        request.country(),
                        request.websiteUrl(),
                        request.latitude(),
                        request.longitude(),
                        request.distanceKm(),
                        resolved,
                        actorEmail
                );
                acceptPendingCourseMap(request.raceId(), actorEmail);
                scanWatcher.record("course_map.bulk_candidate_published", "completed", "Hermes published a route-backed course map for this race.", Map.of(
                        "imageUrl", resolved.imageUrl() == null ? "" : resolved.imageUrl(),
                        "confidence", resolved.confidence(),
                        "routePoints", resolved.routePoints() == null ? 0 : resolved.routePoints().size()
                ));
                return new AcquisitionAttemptResult(resolved, true);
            }
            if (isStoredCityLevelReferenceResult(resolved)) {
                boolean quarantined = imageService.quarantineLocalCourseMapReference(resolved.imageUrl());
                scanWatcher.record("course_map.bulk_candidate_city_reference_rejected", "completed", "Hermes rejected a city-level map reference because bulk publishing requires route-backed geometry.", Map.of(
                        "imageUrl", resolved.imageUrl() == null ? "" : resolved.imageUrl(),
                        "confidence", resolved.confidence(),
                        "quarantined", quarantined
                ));
                return new AcquisitionAttemptResult(resolved, false);
            }
            scanWatcher.record("course_map.bulk_candidate_not_publishable", "completed", "Course-map candidate did not produce publishable route geometry.", Map.of(
                    "imageUrl", resolved == null || resolved.imageUrl() == null ? "" : resolved.imageUrl(),
                    "confidence", resolved == null ? 0 : resolved.confidence(),
                    "routePoints", resolved == null || resolved.routePoints() == null ? 0 : resolved.routePoints().size()
            ));
            return new AcquisitionAttemptResult(resolved, false);
        } catch (RuntimeException ex) {
            scanWatcher.record("course_map.bulk_candidate_analysis_failed", "failed", "Hermes could not analyze this course-map candidate.", Map.of(
                    "imageUrl", asset.imageUrl() == null ? "" : asset.imageUrl(),
                    "error", safeExceptionMessage(ex)
            ));
            return new AcquisitionAttemptResult(
                    new RaceCourseMapResult(
                            asset.imageUrl(),
                            AUTO_ACQUIRE_SOURCE,
                            false,
                            0,
                            safeExceptionMessage(ex),
                            null,
                            List.of(),
                            List.of(),
                            null,
                            true
                    ),
                    false
            );
        }
    }

    private RaceCourseMapResult acquirePendingCourseMapScanCandidate(CourseMapAcquisitionRequest request, String actorEmail) {
        if (request == null || request.raceId() == null || request.raceId().isBlank()) {
            throw new IllegalArgumentException("race_course_map_request_missing");
        }
        scanWatcher.record("course_map.admin_scan_started", "running", "Hermes started admin course-map candidate scanning.", Map.of(
                "raceId", request.raceId(),
                "raceName", request.raceName() == null ? "" : request.raceName()
        ));

        RaceCourseMapResult bestResult = null;
        List<ResolvedCandidateAsset> localAssets = imageService.resolveLocalCourseMapAssets(request.raceId());
        for (ResolvedCandidateAsset localAsset : localAssets) {
            bestResult = chooseBetterPendingScanResult(bestResult, analyzePendingScanAsset(request, localAsset));
            if (isStoredAlignedResult(bestResult)) {
                break;
            }
        }
        if (!localAssets.isEmpty() && bestResult != null && !isStoredAlignedResult(bestResult)) {
            scanWatcher.record("course_map.admin_scan_local_upload_not_replaced", "completed", "Hermes kept the local uploaded course map pending instead of replacing it with a remote candidate.", Map.of(
                    "raceId", request.raceId(),
                    "confidence", bestResult.confidence()
            ));
            persistPending(
                    request.raceId(),
                    request.raceName(),
                    request.city(),
                    request.country(),
                    request.websiteUrl(),
                    request.latitude(),
                    request.longitude(),
                    request.distanceKm(),
                    bestResult,
                    actorEmail
            );
            return bestResult;
        }

        if (!isStoredAlignedResult(bestResult) && searchService != null) {
            List<CourseMapCandidate> remoteCandidates = searchService.collectCandidates(
                            request.raceName(),
                            request.city(),
                            request.country(),
                            request.websiteUrl(),
                            request.distanceKm()
                    )
                    .values()
                    .stream()
                    .sorted((left, right) -> Integer.compare(right.score(), left.score()))
                    .limit(MAX_AUTO_ACQUIRE_CANDIDATES)
                    .toList();
            scanWatcher.record("course_map.admin_scan_candidates_collected", "completed", "Hermes collected course-map candidates for admin review.", Map.of(
                    "localCandidates", localAssets.size(),
                    "remoteCandidates", remoteCandidates.size()
            ));
            for (CourseMapCandidate candidate : remoteCandidates) {
                List<ResolvedCandidateAsset> resolvedAssets;
                try {
                    resolvedAssets = imageService.resolveCandidateAssets(candidate);
                } catch (RuntimeException ex) {
                    scanWatcher.record("course_map.admin_scan_candidate_fetch_failed", "failed", "Hermes could not fetch this course-map candidate.", Map.of(
                            "candidateUrl", candidate.imageUrl() == null ? "" : candidate.imageUrl(),
                            "error", safeExceptionMessage(ex)
                    ));
                    continue;
                }
                for (ResolvedCandidateAsset asset : resolvedAssets) {
                    bestResult = chooseBetterPendingScanResult(bestResult, analyzePendingScanAsset(request, asset));
                    if (isStoredAlignedResult(bestResult)) {
                        break;
                    }
                }
                if (isStoredAlignedResult(bestResult)) {
                    break;
                }
            }
        }

        if (bestResult == null) {
            scanWatcher.record("course_map.admin_scan_no_candidates", "completed", "Hermes did not find a course-map candidate to stage.", Map.of(
                    "raceId", request.raceId()
            ));
            return emptyResult("Hermes did not find a course-map candidate to stage as a pending preview.");
        }
        persistPending(
                request.raceId(),
                request.raceName(),
                request.city(),
                request.country(),
                request.websiteUrl(),
                request.latitude(),
                request.longitude(),
                request.distanceKm(),
                bestResult,
                actorEmail
        );
        return bestResult;
    }

    private RaceCourseMapResult analyzePendingScanAsset(CourseMapAcquisitionRequest request, ResolvedCandidateAsset asset) {
        if (asset == null || asset.imageBytes() == null || asset.imageBytes().length == 0) {
            return null;
        }
        try {
            ResolvedCandidateAsset storedAsset = imageService.storeCourseMapUpload(request.raceId(), asset);
            return analyzeUploadedAssetWithFallback(
                    AUTO_ACQUIRE_SOURCE,
                    storedAsset,
                    request.raceName(),
                    request.city(),
                    request.country(),
                    request.latitude(),
                    request.longitude(),
                    request.distanceKm(),
                    "Hermes found a course-map candidate but could not align it confidently yet."
            );
        } catch (RuntimeException ex) {
            scanWatcher.record("course_map.admin_scan_candidate_analysis_failed", "failed", "Hermes could not analyze this course-map candidate.", Map.of(
                    "imageUrl", asset.imageUrl() == null ? "" : asset.imageUrl(),
                    "error", safeExceptionMessage(ex)
            ));
            return new RaceCourseMapResult(
                    asset.imageUrl(),
                    AUTO_ACQUIRE_SOURCE,
                    false,
                    0,
                    safeExceptionMessage(ex),
                    null,
                    List.of(),
                    List.of(),
                    null,
                    true
            );
        }
    }

    private RaceCourseMapResult chooseBetterPendingScanResult(RaceCourseMapResult current, RaceCourseMapResult candidate) {
        if (candidate == null) return current;
        if (current == null) return candidate;
        boolean candidateAligned = isStoredAlignedResult(candidate);
        boolean currentAligned = isStoredAlignedResult(current);
        if (candidateAligned && !currentAligned) return candidate;
        if (!candidateAligned && currentAligned) return current;
        if (candidate.confidence() > current.confidence()) return candidate;
        if (candidate.confidence() == current.confidence()
                && candidate.imageUrl() != null && !candidate.imageUrl().isBlank()
                && (current.imageUrl() == null || current.imageUrl().isBlank())) {
            return candidate;
        }
        return current;
    }

    private CourseMapAcquisitionResult acquisitionResult(
            CourseMapAcquisitionRequest request,
            String status,
            boolean published,
            int candidatesTried,
            int confidence,
            String summary
    ) {
        return new CourseMapAcquisitionResult(
                request.raceId(),
                request.raceName(),
                status,
                published,
                candidatesTried,
                confidence,
                summary == null ? "" : summary
        );
    }

    private boolean hasPublishableLiveCourseMap(String raceId) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElse(null);
        if (asset == null) return false;
        if (asset.getLiveImageUrl() == null || asset.getLiveImageUrl().isBlank()) return false;
        List<RoutePoint> routePoints = readJson(asset.getLiveRoutePointsJson(), new TypeReference<List<RoutePoint>>() {}, List.of());
        return routePoints.size() > 1;
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
            Double latitude,
            Double longitude,
            Double distanceKm,
            RaceCourseMapResult directResult
    ) {
        if (!isPipelineFallbackEligible(source, directResult)) return null;
        if (marathonRouteExtractionService == null || marathonRouteGeoreferencingService == null) return null;
        if (!marathonRouteGeoreferencingService.isConfiguredForPipelineFallback()) return null;
        String pipelineInput = buildInlinePipelineImageReference(asset);
        scanWatcher.record("course_map.pipeline_fallback_started", "running", "Hermes started CV route extraction and anchor georeferencing fallback.");
        RoutePathExtractionResultDTO extractionResult = marathonRouteExtractionService.extractRoutePath(
                pipelineInput,
                raceName,
                city,
                country,
                distanceKm
        );
        scanWatcher.record("course_map.pipeline_route_extracted", "completed", "CV route extraction produced image-space route points.", Map.of(
                "pointCount", extractionResult == null ? 0 : extractionResult.pointCount(),
                "maskPixelCount", extractionResult == null ? 0 : extractionResult.maskPixelCount(),
                "skeletonPixelCount", extractionResult == null ? 0 : extractionResult.skeletonPixelCount(),
                "selectedRouteHexColor", extractionResult == null || extractionResult.routeParameters() == null ? "" : extractionResult.routeParameters().routeHexColor(),
                "routeSource", extractionResult == null ? "" : extractionResult.routeSource(),
                "candidateErrorCount", extractionResult == null || extractionResult.candidateErrors() == null ? 0 : extractionResult.candidateErrors().size()
        ));
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult;
        try {
            georefResult = marathonRouteGeoreferencingService.georeferenceRoute(
                    pipelineInput,
                    raceName,
                    city,
                    country,
                    extractionResult,
                    latitude,
                    longitude,
                    distanceKm
            );
        } catch (RuntimeException ex) {
            scanWatcher.record("course_map.generic_bounds_fallback_rejected", "failed", "Hermes rejected generic route-bounds projection because route-backed maps require visible anchor georeferencing.", Map.of(
                    "error", safeExceptionMessage(ex)
            ));
            throw ex;
        }
        scanWatcher.record("course_map.pipeline_georeferenced", "completed", "Anchor transform projected image route into world coordinates.", Map.of(
                "pixelAnchors", georefResult.pixelAnchors() == null ? 0 : georefResult.pixelAnchors().size(),
                "geocodedAnchors", georefResult.geocodedAnchors() == null ? 0 : georefResult.geocodedAnchors().size(),
                "rawBreadcrumbs", georefResult.rawBreadcrumbs() == null ? 0 : georefResult.rawBreadcrumbs().size(),
                "georeferenceMethod", "anchor-transform"
        ));
        List<RoutePoint> rawRoutePoints = georefResult.rawBreadcrumbs() == null
                ? List.of()
                : georefResult.rawBreadcrumbs().stream()
                .map(point -> new RoutePoint(point.latitude(), point.longitude(), null))
                .toList();
        List<RoutePoint> routePoints = geometryService.sanitizeRoutePoints(snapRouteToRoads(rawRoutePoints));
        PromptRaceType raceType = inferPromptRaceType(raceName, city, country, null);
        KnownCourseRouteVerdict knownCourseVerdict = assessKnownCourseRoute(routePoints, raceName, city, country);
        if (!knownCourseVerdict.accepted()) {
            scanWatcher.record("course_map.pipeline_known_course_failed", "failed", "CV/georeferenced route failed known-course geography checks.", Map.of(
                    "reason", knownCourseVerdict.reason(),
                    "routePoints", routePoints.size()
            ));
            return null;
        }
        if (!geometryService.isAlignmentPlausible(routePoints, null, null, distanceKm, minimumRoutePointCountForSource(source), raceType)) {
            List<RoutePoint> distanceCalibrated = scaleRouteToTargetDistanceIfUseful(routePoints, distanceKm);
            if (!distanceCalibrated.isEmpty()
                    && geometryService.isAlignmentPlausible(distanceCalibrated, null, null, distanceKm, minimumRoutePointCountForSource(source), raceType)) {
                scanWatcher.record("course_map.pipeline_distance_calibrated", "completed", "CV/georeferenced route scale was calibrated against the known race distance.", Map.of(
                        "originalDistanceKm", Math.round(geometryService.polylineDistanceKm(routePoints) * 100.0) / 100.0,
                        "calibratedDistanceKm", Math.round(geometryService.polylineDistanceKm(distanceCalibrated) * 100.0) / 100.0,
                        "targetDistanceKm", distanceKm == null ? "" : distanceKm
                ));
                routePoints = distanceCalibrated;
            }
        }
        knownCourseVerdict = assessKnownCourseRoute(routePoints, raceName, city, country);
        if (!knownCourseVerdict.accepted()) {
            scanWatcher.record("course_map.pipeline_known_course_failed", "failed", "Distance-calibrated route failed known-course geography checks.", Map.of(
                    "reason", knownCourseVerdict.reason(),
                    "routePoints", routePoints.size()
            ));
            return null;
        }
        if (!geometryService.isAlignmentPlausible(routePoints, null, null, distanceKm, minimumRoutePointCountForSource(source), raceType)) {
            scanWatcher.record("course_map.pipeline_plausibility_failed", "failed", "CV/georeferenced route failed course-map plausibility checks.", Map.of(
                    "routePoints", routePoints.size(),
                    "routeDistanceKm", Math.round(geometryService.polylineDistanceKm(routePoints) * 100.0) / 100.0
            ));
            return null;
        }
        List<RoutePoint> labeledRoutePoints = addRouteEndpointLabels(routePoints);
        OverlayBounds bounds = geometryService.boundsFromRoute(labeledRoutePoints);
        int confidence = Math.max(minimumAlignmentConfidenceForSource(source), Math.max(72, directResult == null ? 0 : directResult.confidence()));
        String summary = "Hermes aligned this upload through the extraction pipeline fallback after the direct AI scan could not produce a trustworthy route preview.";
        return new RaceCourseMapResult(asset.imageUrl(), source, true, confidence, summary, bounds, labeledRoutePoints, List.of(), null, true);
    }

    private KnownCourseRouteVerdict assessKnownCourseRoute(List<RoutePoint> routePoints, String raceName, String city, String country) {
        if (!isBostonCourseContext(raceName, city, country)) {
            return new KnownCourseRouteVerdict(true, "not a Boston Marathon course");
        }
        if (routePoints == null || routePoints.size() < 2) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route has no usable point-to-point geometry");
        }
        OverlayBounds bounds = geometryService.boundsFromRoute(routePoints);
        if (bounds.west() > -71.45 || bounds.east() < -71.11 || (bounds.east() - bounds.west()) < 0.32) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route does not span the Hopkinton-to-Boston west-east corridor");
        }
        RoutePoint first = routePoints.get(0);
        RoutePoint last = routePoints.get(routePoints.size() - 1);
        double firstToStart = geometryService.haversineKm(first.lat(), first.lng(), 42.2295, -71.5218);
        double firstToFinish = geometryService.haversineKm(first.lat(), first.lng(), 42.3499, -71.0784);
        double lastToStart = geometryService.haversineKm(last.lat(), last.lng(), 42.2295, -71.5218);
        double lastToFinish = geometryService.haversineKm(last.lat(), last.lng(), 42.3499, -71.0784);
        boolean endpointsMatch = (firstToStart <= 9.0 && lastToFinish <= 9.0)
                || (firstToFinish <= 9.0 && lastToStart <= 9.0);
        if (!endpointsMatch) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route endpoints do not land near Hopkinton start and Boylston/Copley finish");
        }
        boolean passesInteriorCourse = routePoints.stream().anyMatch(point -> geometryService.haversineKm(point.lat(), point.lng(), 42.2834, -71.3495) <= 9.0)
                && routePoints.stream().anyMatch(point -> geometryService.haversineKm(point.lat(), point.lng(), 42.2965, -71.2926) <= 9.0)
                && routePoints.stream().anyMatch(point -> geometryService.haversineKm(point.lat(), point.lng(), 42.3389, -71.2092) <= 11.0);
        if (!passesInteriorCourse) {
            return new KnownCourseRouteVerdict(false, "Boston Marathon route misses the Natick-Wellesley-Newton course corridor");
        }
        return new KnownCourseRouteVerdict(true, "Boston Marathon course geography accepted");
    }

    private boolean isBostonCourseContext(String raceName, String city, String country) {
        String combined = String.join(" ", normalize(raceName), normalize(city), normalize(country));
        return combined.contains("boston") && combined.contains("marathon");
    }

    private List<RoutePoint> scaleRouteToTargetDistanceIfUseful(List<RoutePoint> routePoints, Double distanceKm) {
        if (routePoints == null || routePoints.size() < 5 || distanceKm == null || distanceKm <= 0) {
            return List.of();
        }
        double currentDistanceKm = geometryService.polylineDistanceKm(routePoints);
        if (currentDistanceKm <= 0) {
            return List.of();
        }
        double scale = distanceKm / currentDistanceKm;
        if (scale < 0.25 || scale > 4.0) {
            return List.of();
        }
        double centroidLat = 0.0;
        double centroidLng = 0.0;
        for (RoutePoint point : routePoints) {
            centroidLat += point.lat();
            centroidLng += point.lng();
        }
        centroidLat /= routePoints.size();
        centroidLng /= routePoints.size();
        List<RoutePoint> scaled = new ArrayList<>(routePoints.size());
        for (RoutePoint point : routePoints) {
            double lat = centroidLat + ((point.lat() - centroidLat) * scale);
            double lng = centroidLng + ((point.lng() - centroidLng) * scale);
            scaled.add(new RoutePoint(lat, lng, point.label()));
        }
        return geometryService.sanitizeRoutePoints(scaled);
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

    private boolean isCourseMapAiAvailable() {
        return systemConfigService.isCourseMapAiConfigured() || systemConfigService.isAiConfigured();
    }

    private boolean isFixtureCourseMapWebsite(String websiteUrl) {
        if (websiteUrl == null || websiteUrl.isBlank()) return false;
        try {
            String host = URI.create(websiteUrl).getHost();
            return host != null && (host.equalsIgnoreCase("example.com") || host.endsWith(".example.com"));
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isAdminCourseMapSource(String source) {
        return source != null && source.startsWith("admin-");
    }

    private RaceCourseMapResult cappedAnalysisResult(
            RaceCourseMapResult bestPartialResult,
            ResolvedCandidateAsset fallbackAsset,
            CourseMapCandidate fallbackCandidate
    ) {
        String imageUrl = bestPartialResult != null && bestPartialResult.imageUrl() != null && !bestPartialResult.imageUrl().isBlank()
                ? bestPartialResult.imageUrl()
                : fallbackAsset == null ? "" : fallbackAsset.imageUrl();
        String source = bestPartialResult != null && bestPartialResult.source() != null && !bestPartialResult.source().isBlank()
                ? bestPartialResult.source()
                : fallbackCandidate == null ? "" : fallbackCandidate.source();
        int confidence = bestPartialResult == null ? 0 : bestPartialResult.confidence();
        return new RaceCourseMapResult(
                imageUrl,
                source,
                false,
                confidence,
                "Hermes capped AI course-map analysis after " + MAX_AI_ANALYSIS_ATTEMPTS + " candidate images without a confident alignment.",
                null,
                List.of(),
                List.of(),
                null,
                true
        );
    }

    private RaceCourseMapResult candidateOnlyResult(String imageUrl, String source, String summary) {
        return new RaceCourseMapResult(
                imageUrl == null ? "" : imageUrl,
                source == null ? "" : source,
                false,
                0,
                summary,
                null,
                List.of(),
                List.of(),
                null,
                false
        );
    }

    private RaceCourseMapResult buildAlignedResult(ResolvedCandidateAsset asset, CourseMapCandidate candidate, CourseMapAlignment alignment, List<RoutePoint> routePoints, Double latitude, Double longitude, Double distanceKm, PromptRaceType raceType) {
        List<RoutePoint> snapped = snapRouteToRoads(routePoints);
        List<RoutePoint> finalPoints = geometryService.isAlignmentPlausible(snapped, latitude, longitude, distanceKm, MIN_ALIGNMENT_ROUTE_POINTS, raceType) ? snapped : routePoints;
        OverlayBounds bounds = sanitizeOverlayBounds(alignment.overlayBounds(), finalPoints);
        List<RoutePoint> sampledRoute = geometryService.resampleRoute(finalPoints, elevationSampleCount(distanceKm, finalPoints));
        List<Integer> elevationSamples = smoothElevationSamples(fetchElevationSamples(sampledRoute));
        Integer totalClimbMeters = computeTotalClimbMeters(elevationSamples);
        return new RaceCourseMapResult(asset.imageUrl(), candidate.source(), true, alignment.confidence(), alignment.summary(), bounds, finalPoints, elevationSamples, totalClimbMeters, true);
    }

    private int elevationSampleCount(Double distanceKm, List<RoutePoint> routePoints) {
        int routePointCount = routePoints == null ? 0 : routePoints.size();
        if (distanceKm == null || distanceKm <= 0) {
            return Math.max(DEFAULT_ELEVATION_SAMPLE_COUNT, routePointCount);
        }
        int distanceBasedCount = (int) Math.ceil(distanceKm * ELEVATION_SAMPLES_PER_KILOMETER) + 1;
        return Math.max(Math.max(DEFAULT_ELEVATION_SAMPLE_COUNT, routePointCount), distanceBasedCount);
    }

    private List<Integer> fetchElevationSamples(List<RoutePoint> routePoints) {
        if (routePoints == null || routePoints.isEmpty()) return List.of();
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
        URI uri = URI.create("https://api.open-meteo.com/v1/elevation?latitude="
                + latitudes
                + "&longitude="
                + longitudes);
        try {
            RequestEntity<Void> request = new RequestEntity<>(HttpMethod.GET, uri);
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(request, new ParameterizedTypeReference<>() {});
            Object elevations = response.getBody() != null ? response.getBody().get("elevation") : null;
            if (!(elevations instanceof List<?> list)) return List.of();
            List<Integer> samples = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Number number) {
                    samples.add((int) Math.round(number.doubleValue()));
                }
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
            if (delta >= CLIMB_DELTA_THRESHOLD_METERS) {
                climb += delta;
            }
        }
        return climb;
    }

    private List<Integer> smoothElevationSamples(List<Integer> samples) {
        if (samples == null || samples.size() < 3) return samples == null ? List.of() : samples;
        List<Integer> smoothed = new ArrayList<>(samples.size());
        smoothed.add(Math.round((samples.get(0) + samples.get(1)) / 2.0f));
        for (int i = 1; i < samples.size() - 1; i++) {
            int previousDelta = Math.abs(samples.get(i) - samples.get(i - 1));
            int nextDelta = Math.abs(samples.get(i + 1) - samples.get(i));
            if (previousDelta >= ABRUPT_ELEVATION_DELTA_THRESHOLD_METERS
                    || nextDelta >= ABRUPT_ELEVATION_DELTA_THRESHOLD_METERS) {
                smoothed.add(samples.get(i));
                continue;
            }
            smoothed.add(Math.round((samples.get(i - 1) + samples.get(i) + samples.get(i + 1)) / 3.0f));
        }
        int finalDelta = Math.abs(samples.get(samples.size() - 1) - samples.get(samples.size() - 2));
        if (finalDelta >= ABRUPT_ELEVATION_DELTA_THRESHOLD_METERS) {
            smoothed.add(samples.get(samples.size() - 1));
        } else {
            smoothed.add(Math.round((samples.get(samples.size() - 2) + samples.get(samples.size() - 1)) / 2.0f));
        }
        return smoothed;
    }

    private RaceCourseMapResult buildStagedUploadResult(ResolvedCandidateAsset asset, String source) {
        return new RaceCourseMapResult(
                asset.imageUrl(),
                source,
                false,
                0,
                STAGED_UPLOAD_SUMMARY,
                null,
                List.of(),
                List.of(),
                null,
                false
        );
    }

    private void ensurePendingAlignedForPublish(RaceCourseMapAsset asset, String actorEmail) {
        if (asset == null) return;
        RaceCourseMapResult pending = toResult(asset, false);
        if (isStoredAlignedResult(pending) || isStoredCityLevelReferenceResult(pending)) return;
        RaceCourseMapResult cityLevelReference = buildAdminUploadCityLevelReferenceForPublish(asset, pending);
        if (cityLevelReference != null) {
            applyPendingResult(asset, cityLevelReference, actorEmail);
            return;
        }
        throw new IllegalArgumentException("Pending course-map must align before publishing live.");
    }

    private RaceCourseMapResult buildAdminUploadCityLevelReferenceForPublish(RaceCourseMapAsset asset, RaceCourseMapResult pending) {
        if (asset == null || pending == null) return null;
        if (pending.courseMapDetected()) return null;
        if (pending.imageUrl() == null || pending.imageUrl().isBlank()) return null;
        if (!isAdminCourseMapSource(pending.source())) return null;
        if (!isLocalCourseMapReference(pending.imageUrl())) return null;
        if (!isStandardCityRoadMarathonCandidate(asset.getRaceName(), asset.getCity(), asset.getCountry(), asset.getDistanceKm())) {
            return null;
        }
        if (asset.getLatitude() == null || asset.getLongitude() == null) return null;
        String summary = pending.summary();
        if (isStagedUploadSummary(summary)) return null;
        if (isOperationalQwenFailure(summary) || hasImplausibleRouteGeometrySummary(summary)) return null;
        OverlayBounds cityBounds = buildCityLevelBounds(asset.getLatitude(), asset.getLongitude(), asset.getDistanceKm());
        String cityLabel = asset.getCity() == null || asset.getCity().isBlank() ? "the race city" : asset.getCity().trim();
        String failureNote = summary == null || summary.isBlank()
                ? "Qwen could not extract reliable route geometry from the stored upload."
                : "Qwen could not extract reliable route geometry from the stored upload: " + summary;
        String acceptedSummary = "Hermes accepted this uploaded course map as a city-level course-map match for a standard road marathon in "
                + cityLabel
                + ". The upload is treated as a real course-map image reference, not a distance-accurate route overlay. "
                + failureNote;
        scanWatcher.record("course_map.admin_upload_city_reference_accepted", "completed", "Admin-uploaded standard road-marathon map accepted as a city-level reference after geometry extraction missed.", Map.of(
                "raceId", asset.getRaceId() == null ? "" : asset.getRaceId(),
                "source", pending.source(),
                "confidence", MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE
        ));
        return new RaceCourseMapResult(
                pending.imageUrl(),
                pending.source(),
                true,
                MIN_ADMIN_PREVIEW_ALIGNMENT_CONFIDENCE,
                acceptedSummary,
                cityBounds,
                List.of(),
                List.of(),
                null,
                true
        );
    }

    private boolean isStagedUploadSummary(String summary) {
        if (summary == null || summary.isBlank()) return false;
        String normalized = summary.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("saved this upload")
                && normalized.contains("queued it for automatic qwen scanning");
    }

    private boolean hasImplausibleRouteGeometrySummary(String summary) {
        if (summary == null || summary.isBlank()) return false;
        String normalized = summary.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("failed the plausibility checks")
                || normalized.contains("outside expected range")
                || normalized.contains("route points covering")
                || normalized.contains("route length")
                || normalized.contains("starts too far")
                || normalized.contains("far from the known");
    }

    private void applyPendingResult(RaceCourseMapAsset asset, RaceCourseMapResult resolved, String actorEmail) {
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

    private boolean hasLegacyManualReanalyzeUploadSummary(String summary) {
        if (summary == null || summary.isBlank()) return false;
        String normalized = summary.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("hermes saved this upload")
                && normalized.contains("click re-analyze")
                && normalized.contains("stored course-map image");
    }

    private String sanitizeStoredCourseMapSummary(String summary) {
        if (hasLegacyManualReanalyzeUploadSummary(summary)) {
            return STAGED_UPLOAD_SUMMARY;
        }
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
        persistPending(raceId, raceName, city, country, websiteUrl, latitude, longitude, distanceKm, resolved, actorEmail, false);
    }

    private void persistPending(String raceId, String raceName, String city, String country, String websiteUrl, Double latitude, Double longitude, Double distanceKm, RaceCourseMapResult resolved, String actorEmail, boolean clearLiveBeforePending) {
        RaceCourseMapAsset asset = raceCourseMapAssetRepository.findByRaceId(raceId).orElseGet(RaceCourseMapAsset::new);
        LocalDateTime updatedAt = LocalDateTime.now();
        if (clearLiveBeforePending) {
            clearLiveCourseMap(asset);
        }
        asset.setRaceId(raceId); asset.setRaceName(raceName); asset.setCity(city); asset.setCountry(country); asset.setOfficialWebsite(websiteUrl); asset.setLatitude(latitude); asset.setLongitude(longitude); asset.setDistanceKm(distanceKm);
        asset.setPendingImageUrl(resolved.imageUrl()); asset.setPendingSource(resolved.source()); asset.setPendingConfidence(resolved.confidence()); asset.setPendingSummary(resolved.summary());
        asset.setPendingOverlayBoundsJson(writeJson(resolved.overlayBounds())); asset.setPendingRoutePointsJson(writeJson(resolved.routePoints())); asset.setPendingElevationSamplesJson(writeJson(resolved.elevationSamples()));
        asset.setPendingTotalClimbMeters(resolved.totalClimbMeters()); asset.setPendingAiAssisted(resolved.aiAssisted()); asset.setPendingUpdatedAt(updatedAt); asset.setPendingUpdatedByEmail(actorEmail);
        if (isStoredAlignedResult(resolved)) {
            applyLiveResult(asset, resolved, actorEmail, updatedAt);
        }
        raceCourseMapAssetRepository.save(asset);
    }

    private void clearPending(RaceCourseMapAsset asset) {
        asset.setPendingImageUrl(null); asset.setPendingSource(null); asset.setPendingConfidence(null); asset.setPendingSummary(null); asset.setPendingOverlayBoundsJson(null); asset.setPendingRoutePointsJson(null); asset.setPendingElevationSamplesJson(null); asset.setPendingTotalClimbMeters(null); asset.setPendingAiAssisted(null); asset.setPendingUpdatedAt(null); asset.setPendingUpdatedByEmail(null);
    }

    private void applyLiveResult(RaceCourseMapAsset asset, RaceCourseMapResult resolved, String actorEmail, LocalDateTime updatedAt) {
        asset.setLiveImageUrl(resolved.imageUrl());
        asset.setLiveSource(resolved.source());
        asset.setLiveConfidence(resolved.confidence());
        asset.setLiveSummary(resolved.summary());
        asset.setLiveOverlayBoundsJson(writeJson(resolved.overlayBounds()));
        asset.setLiveRoutePointsJson(writeJson(resolved.routePoints()));
        asset.setLiveElevationSamplesJson(writeJson(resolved.elevationSamples()));
        asset.setLiveTotalClimbMeters(resolved.totalClimbMeters());
        asset.setLiveAiAssisted(resolved.aiAssisted());
        asset.setLiveUpdatedAt(updatedAt);
        asset.setLiveUpdatedByEmail(actorEmail);
        if (isStoredAlignedResult(resolved)) {
            String artifactJson = buildLocalRouteArtifactJson(asset, resolved, actorEmail, updatedAt);
            String routeReference = imageService.replaceSuccessfulCourseMapRoute(asset.getRaceId(), asset.getLocalRouteArtifactRef(), artifactJson);
            asset.setLocalRouteArtifactRef(routeReference);
            asset.setLocalRouteUpdatedAt(updatedAt);
            asset.setLocalRouteUpdatedByEmail(actorEmail);
        } else {
            clearLocalRouteArtifact(asset);
        }
    }

    private void clearLiveCourseMap(RaceCourseMapAsset asset) {
        clearLocalRouteArtifact(asset);
        asset.setLiveImageUrl(null);
        asset.setLiveSource(null);
        asset.setLiveConfidence(null);
        asset.setLiveSummary(null);
        asset.setLiveOverlayBoundsJson(null);
        asset.setLiveRoutePointsJson(null);
        asset.setLiveElevationSamplesJson(null);
        asset.setLiveTotalClimbMeters(null);
        asset.setLiveAiAssisted(null);
        asset.setLiveUpdatedAt(null);
        asset.setLiveUpdatedByEmail(null);
    }

    private void clearLocalRouteArtifact(RaceCourseMapAsset asset) {
        imageService.deleteSuccessfulCourseMapRoute(asset.getLocalRouteArtifactRef());
        asset.setLocalRouteArtifactRef(null);
        asset.setLocalRouteUpdatedAt(null);
        asset.setLocalRouteUpdatedByEmail(null);
    }

    private String buildLocalRouteArtifactJson(RaceCourseMapAsset asset, RaceCourseMapResult resolved, String actorEmail, LocalDateTime updatedAt) {
        Map<String, Object> artifact = new LinkedHashMap<>();
        artifact.put("raceId", asset.getRaceId());
        artifact.put("raceName", asset.getRaceName());
        artifact.put("city", asset.getCity());
        artifact.put("country", asset.getCountry());
        artifact.put("officialWebsite", asset.getOfficialWebsite());
        artifact.put("imageUrl", resolved.imageUrl());
        artifact.put("source", resolved.source());
        artifact.put("confidence", resolved.confidence());
        artifact.put("summary", resolved.summary());
        artifact.put("overlayBounds", resolved.overlayBounds());
        artifact.put("routePoints", resolved.routePoints());
        artifact.put("elevationSamples", resolved.elevationSamples());
        artifact.put("totalClimbMeters", resolved.totalClimbMeters());
        artifact.put("aiAssisted", resolved.aiAssisted());
        artifact.put("updatedAt", updatedAt == null ? null : updatedAt.toString());
        artifact.put("updatedByEmail", actorEmail);
        return writeJson(artifact);
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
        String previewImageUrl = imageService.buildDisplayablePreviewImageUrl(imageUrl);
        return new PreviewSnapshot(
                imageUrl,
                previewImageUrl,
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
        return new PreviewSnapshot(result.imageUrl(), imageService.buildDisplayablePreviewImageUrl(result.imageUrl()), result.source(), result.summary(), result.confidence(), updatedAt == null ? null : updatedAt.toString(), result.overlayBounds(), result.routePoints() == null ? List.of() : result.routePoints(), result.elevationSamples() == null ? List.of() : result.elevationSamples(), result.totalClimbMeters(), result.aiAssisted(), result.courseMapDetected());
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

    private boolean shouldAnalyzeUploadImmediately(String ref) {
        return isHttpUrl(ref) && !isPdfFileUrl(ref);
    }

    private boolean isImageDataUrl(String url) { return url != null && url.regionMatches(true, 0, "data:image/", 0, 11); }
    private boolean isPdfDataUrl(String url) { return url != null && url.regionMatches(true, 0, "data:application/pdf", 0, 20); }
    private boolean isLocalCourseMapReference(String url) { return url != null && url.regionMatches(true, 0, "local-course-map:", 0, 17); }
    private boolean isHttpUrl(String url) {
        return url != null
                && (url.regionMatches(true, 0, "http://", 0, 7)
                || url.regionMatches(true, 0, "https://", 0, 8));
    }
    private boolean isPdfFileUrl(String url) {
        return url != null && url.toLowerCase(java.util.Locale.ROOT).contains(".pdf");
    }

    private boolean shouldRefresh(RaceCourseMapResult result) { return result == null || (!result.courseMapDetected() && (result.imageUrl() == null || result.imageUrl().isBlank())); }

    private RaceCourseMapResult emptyResult(String summary) { return new RaceCourseMapResult("", "", false, 0, summary, null, List.of(), List.of(), null, false); }

    // --- Private records and enums retained for internal use or passed between services ---

    public record ResolvedCandidateAsset(String imageUrl, byte[] imageBytes) {}
    public record CourseMapCandidate(String imageUrl, String source, int score) {}
    public record CourseMapAcquisitionRequest(String raceId, String raceName, String city, String country, String websiteUrl, Double latitude, Double longitude, Double distanceKm) {}
    public record CourseMapAcquisitionResult(String raceId, String raceName, String status, boolean published, int candidatesTried, int confidence, String summary) {}
    public record CourseMapAlignment(boolean isCourseMap, int confidence, String summary, OverlayBounds overlayBounds, List<RoutePoint> routePoints, String startLabel, String finishLabel) {}
    private record RetryableAlignmentCandidate(CourseMapCandidate candidate, ResolvedCandidateAsset asset, double score) {}
    private record AcquisitionAttemptResult(RaceCourseMapResult result, boolean published) {}
    public record AlignmentRatioWindow(double minRatio, double maxRatio) {}
    private record KnownCourseRouteVerdict(boolean accepted, String reason) {}
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
    private record CachedResult(RaceCourseMapResult result) {
    }
}
