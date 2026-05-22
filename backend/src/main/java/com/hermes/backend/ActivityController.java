package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {
    private static final Logger logger = LoggerFactory.getLogger(ActivityController.class);
    private static final int POINTS_BATCH_SIZE = 500;
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;
    private static final int ROUTE_PREVIEW_POINT_LIMIT = ActivityAnalyticsHelper.ROUTE_PREVIEW_POINT_LIMIT;
    private static final int MAX_ROUTE_PREVIEW_PATH_LENGTH = 255;
    private static final int MAX_ANALYSIS_SUMMARY_LIMIT = 500;
    private static final Duration ACTIVITY_ANALYTICS_CACHE_TTL = Duration.ofMinutes(10);

    private final AuthService authService;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final RunnerRepository runnerRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final ElevationCorrectionService elevationCorrectionService;
    private final AcclimatizationService acclimatizationService;
    private final ReadinessService readinessService;
    private final RestTemplate restTemplate;
    private final TtlCacheStore cacheStore;

    @Autowired
    public ActivityController(AuthService authService, ActivityRepository activityRepository,
                              ActivityPointRepository activityPointRepository, RunnerRepository runnerRepository,
                              SecretEncryptionService secretEncryptionService,
                              ElevationCorrectionService elevationCorrectionService,
                              AcclimatizationService acclimatizationService,
                              ReadinessService readinessService,
                              RestTemplate restTemplate,
                              TtlCacheStore cacheStore) {
        this.authService = authService;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.runnerRepository = runnerRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.elevationCorrectionService = elevationCorrectionService;
        this.acclimatizationService = acclimatizationService;
        this.readinessService = readinessService;
        this.restTemplate = restTemplate;
        this.cacheStore = cacheStore;
    }

    public ActivityController(AuthService authService, ActivityRepository activityRepository,
                              ActivityPointRepository activityPointRepository, RunnerRepository runnerRepository,
                              SecretEncryptionService secretEncryptionService,
                              ElevationCorrectionService elevationCorrectionService,
                              AcclimatizationService acclimatizationService,
                              ReadinessService readinessService,
                              RestTemplate restTemplate) {
        this(authService, activityRepository, activityPointRepository, runnerRepository, secretEncryptionService,
                elevationCorrectionService, acclimatizationService, readinessService, restTemplate,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    @GetMapping
    public ResponseEntity<?> getUserRuns(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);

        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(activeUser.get(), ActivityType.RUN);
        hydrateMissingRoutePreviews(runs);
        return ResponseEntity.ok(runs.stream().map(this::toRunFeedItem).toList());
    }

    @GetMapping("/analysis")
    public ResponseEntity<?> getAnalysisRuns(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "limit", required = false) Integer limit
    ) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);

        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        int boundedLimit = normalizeAnalysisSummaryLimit(limit);
        List<ActivityRepository.AnalysisActivitySummaryProjection> runs =
                boundedLimit > 0
                        ? activityRepository.findAnalysisSummariesByRunnerAndActivityType(
                                activeUser.get(),
                                ActivityType.RUN,
                                PageRequest.of(0, boundedLimit)
                        )
                        : activityRepository.findAnalysisSummariesByRunnerAndActivityType(activeUser.get(), ActivityType.RUN);
        List<AnalysisActivitySummary> response = runs.stream()
                .map(run -> {
                    ActivityWeatherCorrection.Value correction = ActivityWeatherCorrection.fromRawFields(
                            run.getDistanceKm(),
                            run.getDistanceMeters(),
                            run.getMovingTimeSeconds(),
                            null,
                            run.getPacePenaltySecPerKm(),
                            run.getWeatherAdjusted()
                    );
                    return new AnalysisActivitySummary(
                            run.getId(),
                            run.getName(),
                            run.getDistanceKm(),
                            run.getDistanceMeters(),
                            run.getMovingTimeSeconds(),
                            run.getStartDate(),
                            run.getStartTime(),
                            run.getAverageHeartRate(),
                            run.getMaxHeartRate(),
                            run.getAverageCadence(),
                            run.getMaxSpeedMps(),
                            correction.pacePenaltySecPerKm(),
                            correction.weatherAdjusted(),
                            correction.weatherAdjustedMovingTimeSeconds(),
                            correction.weatherAdjustedPaceSecPerKm(),
                            correction.weatherCorrectionFactor()
                    );
                })
                .toList();
        return ResponseEntity.ok(response);
    }

    private int normalizeAnalysisSummaryLimit(Integer limit) {
        if (limit == null) {
            return 0;
        }
        if (limit <= 0) {
            return 0;
        }
        return Math.min(limit, MAX_ANALYSIS_SUMMARY_LIMIT);
    }

    @GetMapping("/heatmap")
    public ResponseEntity<?> getHeatmapPoints(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false) Integer year) {

        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        Runner runner = activeUser.get();
        List<Object[]> coords;
        if (year != null) {
            // Prevent weird ranges that could stress queries or return unexpected data.
            if (year < 1900 || year > 2100) {
                return err(HttpStatus.BAD_REQUEST, "INVALID_PARAM", "Invalid year.");
            }
            java.time.LocalDateTime yearStart = java.time.LocalDateTime.of(year, 1, 1, 0, 0);
            java.time.LocalDateTime yearEnd = java.time.LocalDateTime.of(year + 1, 1, 1, 0, 0);
            coords = activityPointRepository.findHeatmapCoordsByRunnerAndTypeAndYear(
                    runner, ActivityType.RUN, yearStart, yearEnd, year + "%");
        } else {
            coords = activityPointRepository.findHeatmapCoordsByRunnerAndType(runner, ActivityType.RUN);
        }

        List<double[]> latlngs = coords.stream()
                .map(row -> new double[]{((Number) row[0]).doubleValue(), ((Number) row[1]).doubleValue()})
                .toList();

        return ResponseEntity.ok(latlngs);
    }

    @GetMapping("/{id}/points")
    public ResponseEntity<?> getActivityPoints(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }

        Activity activity = activityOpt.get();

        // FIT/GPX/TCX imports: return locally stored points (projection, not entities).
        List<LatLngPoint> localPoints = fetchLatLngPoints(activity.getId());
        if (!localPoints.isEmpty()) {
            cacheRoutePreviewIfMissing(activity, localPoints);
            return ResponseEntity.ok(localPoints);
        }

        // Strava imports: fetch GPS stream on-demand then cache to DB
        String stravaId = activity.getStravaId();
        String stravaToken = resolveRunnerStravaAccessToken(activeUser.get());
        if (stravaId != null && stravaToken != null) {
            try {
                fetchAndCacheStravaStream(activity, stravaId, stravaToken);
                // Query again to return an identical payload shape for local/Strava points.
                List<LatLngPoint> cached = fetchLatLngPoints(activity.getId());
                cacheRoutePreviewIfMissing(activity, cached);
                return ResponseEntity.ok(cached);
            } catch (Exception e) {
                logger.warn("Failed to fetch Strava stream for activity {}: {}", stravaId, e.getMessage(), e);
            }
        }

        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/{id}/analytics")
    public ResponseEntity<?> getActivityAnalytics(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        Activity activity = activityOpt.get();
        String responseLanguage = normalizeResponseLanguage(acceptLanguage);
        String analyticsCacheKey = activeUser.get().getId() + ":" + activity.getId() + ":" + responseLanguage;

        if (!activityPointRepository.existsByActivity(activity) && activity.getStravaId() != null) {
            String stravaToken = resolveRunnerStravaAccessToken(activeUser.get());
            if (stravaToken != null && !stravaToken.isBlank()) {
                try {
                    fetchAndCacheStravaStream(activity, activity.getStravaId(), stravaToken);
                } catch (Exception ignored) {
                }
            }
        }

        Optional<Map<String, Object>> cached = cacheStore.get(
                "activity-analytics",
                analyticsCacheKey,
                new TypeReference<>() {}
        );
        if (cached.isPresent()) {
            return ResponseEntity.ok(cached.get());
        }

        List<Object[]> rows = activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(activity.getId());
        if (rows.isEmpty()) {
            ActivityAnalyticsHelper.PostRunAnalytics response = new ActivityAnalyticsHelper.PostRunAnalytics(List.of(), List.of(), null, null, null, null, null, null);
            return ResponseEntity.ok(response);
        }

        List<ActivityAnalyticsHelper.SamplePoint> pts = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            if (r == null || r.length < 2) continue;
            pts.add(new ActivityAnalyticsHelper.SamplePoint(
                    ((Number) r[0]).doubleValue(),
                    ((Number) r[1]).doubleValue(),
                    r[2] == null ? null : ((Number) r[2]).intValue(),
                    r[3] == null ? null : ((Number) r[3]).doubleValue(),
                    ActivityAnalyticsHelper.resolveElevationForAnalytics(r),
                    r[5] == null ? null : ((Number) r[5]).intValue(),
                    r[6] == null ? null : ((Number) r[6]).intValue()
            ));
        }
        ActivityAnalyticsHelper.normalizeSamples(pts, activity);

        ActivityAnalyticsHelper.PostRunDebrief debrief = buildPostRunDebrief(activity, pts, responseLanguage);

        List<ActivityAnalyticsHelper.LapBreakdown> rawLaps = ActivityAnalyticsHelper.buildLapBreakdown(pts);
        List<ActivityLap> enrichedLaps = rawLaps.stream().map(lap -> {
            double startM = (lap.lapIndex() - 1) * 1000.0;
            double endM = lap.lapIndex() * 1000.0;
            Double elevGain = ActivityLap.computeElevationGain(pts, startM, endM);
            return new ActivityLap(
                    lap.lapIndex(),
                    lap.distanceKm(),
                    lap.durationSeconds(),
                    lap.pace(),
                    lap.averageHeartRate(),
                    lap.averageCadence(),
                    elevGain
            );
        }).toList();

        Map<String, Object> analyticsResponse = new LinkedHashMap<>();
        analyticsResponse.put("laps", enrichedLaps);
        analyticsResponse.put("elevationProfile", ActivityAnalyticsHelper.buildElevationProfile(pts));
        analyticsResponse.put("averageCadence", ActivityAnalyticsHelper.averageCadence(pts, activity));
        analyticsResponse.put("averageStrideLengthMeters", ActivityAnalyticsHelper.averageStrideMeters(pts));
        analyticsResponse.put("cardiacDrift", ActivityAnalyticsHelper.computeCardiacDrift(pts));
        analyticsResponse.put("minElevationMeters", ActivityAnalyticsHelper.minElevation(pts));
        analyticsResponse.put("maxElevationMeters", ActivityAnalyticsHelper.maxElevation(pts));
        analyticsResponse.put("debrief", debrief);

        cacheStore.put("activity-analytics", analyticsCacheKey, analyticsResponse, ACTIVITY_ANALYTICS_CACHE_TTL);
        return ResponseEntity.ok(analyticsResponse);
    }

    private static String normalizeResponseLanguage(String acceptLanguage) {
        if (acceptLanguage == null || acceptLanguage.isBlank()) return "en";
        return acceptLanguage.toLowerCase(Locale.ROOT).contains("zh") ? "zh-CN" : "en";
    }

    private ActivityAnalyticsHelper.PostRunDebrief buildPostRunDebrief(Activity activity, List<ActivityAnalyticsHelper.SamplePoint> pts, String responseLanguage) {
        if (activity.getRunner() == null) return null;
        
        java.time.LocalDate runDate = activity.getStartTime() != null 
                ? activity.getStartTime().toLocalDate() 
                : (activity.getStartDate() != null ? java.time.LocalDate.parse(activity.getStartDate()) : null);
        
        if (runDate == null) return null;

        ReadinessService.ReadinessDay readiness = readinessService.getDailyReadiness(activity.getRunner(), runDate);
        ActivityAnalyticsHelper.CardiacDrift drift = ActivityAnalyticsHelper.computeCardiacDrift(pts);
        boolean zh = "zh-CN".equals(responseLanguage);

        StringBuilder interpretation = new StringBuilder();
        String nextDayGuidance;

        if (readiness.score() >= 80) {
            interpretation.append(zh ? "\u4f60\u5728\u8f83\u9ad8\u7684\u8dd1\u524d\u72b6\u6001\u4e0b\u5f00\u59cb\u8fd9\u6b21\u8bad\u7ec3\uff08" : "You started this run with high readiness (")
                    .append(readiness.score())
                    .append(zh ? "%\uff09\u3002 " : "%). ");
            if (drift != null && drift.driftPercent() < 5) {
                interpretation.append(zh ? "\u5fc3\u8840\u7ba1\u7cfb\u7edf\u53cd\u9988\u5f88\u597d\uff0c\u5fc3\u7387\u6f02\u79fb\u5f88\u5c0f\u3002" : "Your cardiovascular system responded excellently with minimal drift.");
                nextDayGuidance = zh ? "\u660e\u5929\u53ef\u4ee5\u6309\u8ba1\u5212\u63a8\u8fdb\u8bad\u7ec3\u3002" : "Green light for tomorrow's planned session.";
            } else if (drift != null && drift.driftPercent() > 10) {
                interpretation.append(zh ? "\u4e0d\u8fc7\u5fc3\u7387\u6f02\u79fb\u9ad8\u4e8e\u9884\u671f\uff0c\u8bf4\u660e\u8fd9\u6b21\u8d1f\u8377\u6bd4\u5e73\u65f6\u66f4\u91cd\u3002" : "However, we saw higher than expected cardiac drift, suggesting the effort was more taxing than usual.");
                nextDayGuidance = zh ? "\u660e\u5929\u5efa\u8bae\u7a0d\u5fae\u964d\u4f4e\u5f3a\u5ea6\uff0c\u8ba9\u8eab\u4f53\u5438\u6536\u4eca\u5929\u7684\u8bad\u7ec3\u3002" : "Consider a slightly easier effort tomorrow to absorb today's work.";
            } else {
                interpretation.append(zh ? "\u8eab\u4f53\u5bf9\u8fd9\u6b21\u8bad\u7ec3\u8d1f\u8377\u7684\u627f\u53d7\u7b26\u5408\u9884\u671f\u3002" : "The body handled the workload as expected.");
                nextDayGuidance = zh ? "\u7ee7\u7eed\u6309\u5f53\u524d\u8bad\u7ec3\u5b89\u6392\u63a8\u8fdb\u3002" : "Continue with your scheduled training block.";
            }
        } else if (readiness.score() < 60) {
            interpretation.append(zh ? "\u4f60\u4eca\u5929\u662f\u5728\u660e\u663e\u75b2\u52b3\u4e0b\u5b8c\u6210\u8bad\u7ec3\uff08\u72b6\u6001\uff1a" : "You pushed through significant fatigue today (Readiness: ")
                    .append(readiness.score())
                    .append(zh ? "%\uff09\u3002 " : "%). ");
            if (drift != null && drift.driftPercent() > 8) {
                interpretation.append(zh ? "\u8f83\u9ad8\u7684\u5fc3\u7387\u6f02\u79fb\u786e\u8ba4\u8eab\u4f53\u6b63\u627f\u53d7\u538b\u529b\u3002" : "The high cardiac drift confirms your body is under stress.");
                nextDayGuidance = zh ? "\u660e\u5929\u5efa\u8bae\u5f3a\u5236\u8f7b\u677e\u8dd1\u6216\u4f11\u606f\u3002" : "Mandatory easy day or rest recommended tomorrow.";
            } else {
                interpretation.append(zh ? "\u5c3d\u7ba1\u8dd1\u524d\u72b6\u6001\u504f\u4f4e\uff0c\u4f60\u7684\u6548\u7387\u4ecd\u4fdd\u6301\u5f97\u4e0d\u9519\u3002" : "Impressively, your efficiency held up despite the low readiness signal.");
                nextDayGuidance = zh ? "\u4eca\u665a\u4f18\u5148\u4fdd\u8bc1\u7761\u7720\uff0c\u5e2e\u52a9\u8bad\u7ec3\u8282\u594f\u56de\u5230\u6b63\u8f68\u3002" : "Prioritize sleep tonight to stay on track.";
            }
        } else {
            interpretation.append(zh ? "\u8fd9\u6b21\u662f\u5728\u57fa\u7840\u72b6\u6001\u4e0b\u5b8c\u6210\u7684\u4e00\u6b21\u624e\u5b9e\u8bad\u7ec3\uff08" : "A solid effort on a baseline readiness day (")
                    .append(readiness.score())
                    .append(zh ? "%\uff09\u3002" : "%).");
            nextDayGuidance = zh ? "\u660e\u65e9\u5148\u542c\u8eab\u4f53\u53cd\u9988\uff0c\u518d\u51b3\u5b9a\u662f\u5426\u63a8\u8fdb\u9ad8\u5f3a\u5ea6\u8bad\u7ec3\u3002" : "Listen to your body tomorrow morning before pushing hard.";
        }

        return new ActivityAnalyticsHelper.PostRunDebrief(interpretation.toString(), readiness.score(), nextDayGuidance);
    }

    /**
     * GET /api/activities/{id}/hr-samples
     *
     * Returns per-second heart-rate samples stored for this activity.
     * Response: [ { "t": <elapsedSeconds>, "bpm": <heartRate> }, ... ]
     *
     * If the activity has no per-point HR data (summary-only import), returns an empty list.
     * The endpoint does NOT downsample; up to 10 000 points are returned directly from DB.
     * Frontend should render the full series as a dense line chart.
     */
    @GetMapping("/{id}/hr-samples")
    public ResponseEntity<?> getHeartRateSamples(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }

        List<Object[]> rows = activityPointRepository.findHrSamplesByActivityIdOrdered(id);
        List<Map<String, Integer>> samples = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) continue;
            Map<String, Integer> sample = new LinkedHashMap<>();
            sample.put("t", ((Number) row[0]).intValue());
            sample.put("bpm", ((Number) row[1]).intValue());
            samples.add(sample);
        }
        return ResponseEntity.ok(samples);
    }

    /**
     * GET /api/activities/{id}/improvement
     *
     * Returns a pace-improvement metric comparing this run against the runner's last 5 runs
     * in the same distance bucket (±15%). Requires at least 3 baseline runs before this run.
     *
     * Response when available:
     * { baseRunCount, available: true, paceDeltaSecondsPerKm, paceImproved, distanceBucket, basis }
     *
     * Response when insufficient data:
     * { baseRunCount, available: false, paceDeltaSecondsPerKm: null, paceImproved: null,
     *   distanceBucket, basis }
     */
    @GetMapping("/{id}/improvement")
    public ResponseEntity<?> getImprovementMetric(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }

        Activity activity = activityOpt.get();
        double distKm = activity.getDistanceKm() > 0
                ? activity.getDistanceKm()
                : (activity.getDistanceMeters() != null ? activity.getDistanceMeters() / 1000.0 : 0.0);
        long movingSec = activity.getMovingTimeSeconds() > 0
                ? activity.getMovingTimeSeconds()
                : (activity.getDurationSeconds() != null ? activity.getDurationSeconds() : 0L);

        if (distKm <= 0 || movingSec <= 0) {
            return ResponseEntity.ok(new ActivityImprovementMetric(0, false, null, null,
                    "unknown", "Insufficient data for this activity."));
        }

        double thisPaceSecPerKm = movingSec / distKm;
        double minKm = distKm * 0.85;
        double maxKm = distKm * 1.15;
        String bucket = String.format(Locale.ROOT, "%.0f–%.0f km",
                Math.floor(minKm), Math.ceil(maxKm));

        java.time.LocalDateTime beforeTime = activity.getStartTime() != null
                ? activity.getStartTime()
                : activity.getCreatedAt();
        if (beforeTime == null) beforeTime = java.time.LocalDateTime.now();

        org.springframework.data.domain.Page<Activity> baselinePage =
                activityRepository.findRecentRunsInDistanceBucket(
                        activeUser.get(),
                        ActivityType.RUN,
                        beforeTime,
                        minKm,
                        maxKm,
                        org.springframework.data.domain.PageRequest.of(0, 5)
                );

        List<Activity> baseline = baselinePage.getContent();
        int baseRunCount = baseline.size();

        if (baseRunCount < 3) {
            return ResponseEntity.ok(new ActivityImprovementMetric(baseRunCount, false, null, null,
                    bucket, "last 5 runs of similar distance"));
        }

        double avgBaselinePace = baseline.stream()
                .mapToDouble(a -> {
                    double dk = a.getDistanceKm() > 0 ? a.getDistanceKm()
                            : (a.getDistanceMeters() != null ? a.getDistanceMeters() / 1000.0 : 0.0);
                    long ms = a.getMovingTimeSeconds() > 0 ? a.getMovingTimeSeconds()
                            : (a.getDurationSeconds() != null ? a.getDurationSeconds() : 0L);
                    return (dk > 0 && ms > 0) ? ms / dk : 0.0;
                })
                .filter(p -> p > 0)
                .average()
                .orElse(0.0);

        if (avgBaselinePace <= 0) {
            return ResponseEntity.ok(new ActivityImprovementMetric(baseRunCount, false, null, null,
                    bucket, "last 5 runs of similar distance"));
        }

        double delta = ActivityAnalyticsHelper.round2(thisPaceSecPerKm - avgBaselinePace);
        boolean improved = delta < 0;

        return ResponseEntity.ok(new ActivityImprovementMetric(
                baseRunCount,
                true,
                delta,
                improved,
                bucket,
                "last " + baseRunCount + " runs of similar distance"
        ));
    }

    @GetMapping("/{id}/elevation/status")
    public ResponseEntity<?> getElevationStatus(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        return ResponseEntity.ok(elevationCorrectionService.computeStatus(activityOpt.get()));
    }

    @PostMapping("/{id}/elevation/recalibrate")
    public ResponseEntity<?> recalibrateElevation(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) ElevationCorrectionService.RecalibrateRequest request) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        ElevationCorrectionService.RecalibrateResult result = elevationCorrectionService.recalibrate(activityOpt.get(), request);
        return ResponseEntity.ok(result);
    }

    private static ResponseEntity<Map<String, String>> err(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }

    private void hydrateMissingRoutePreviews(List<Activity> runs) {
        if (runs == null || runs.isEmpty()) {
            return;
        }

        List<Long> missingIds = runs.stream()
                .filter(activity -> activity != null && activity.getId() != null && !hasRoutePreview(activity))
                .map(Activity::getId)
                .toList();
        if (missingIds.isEmpty()) {
            return;
        }

        Map<Long, List<PreviewSample>> samplesByActivityId = new java.util.LinkedHashMap<>();
        for (Object[] row : activityPointRepository.findRoutePreviewSamplesByActivityIds(missingIds, ROUTE_PREVIEW_POINT_LIMIT)) {
            if (row == null || row.length < 4 || !(row[0] instanceof Number activityIdNumber)) {
                continue;
            }
            double latitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double longitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            int sequenceIndex = row[3] instanceof Number number ? number.intValue() : 0;
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
                continue;
            }
            long activityId = activityIdNumber.longValue();
            samplesByActivityId.computeIfAbsent(activityId, ignored -> new ArrayList<>())
                    .add(new PreviewSample(latitude, longitude, sequenceIndex));
        }

        List<Activity> dirtyActivities = new ArrayList<>();
        for (Activity activity : runs) {
            if (activity == null || activity.getId() == null || hasRoutePreview(activity)) {
                continue;
            }
            RoutePreview routePreview = buildRoutePreview(samplesByActivityId.get(activity.getId()));
            if (routePreview == null) {
                continue;
            }
            applyRoutePreview(activity, routePreview);
            dirtyActivities.add(activity);
        }

        if (!dirtyActivities.isEmpty()) {
            activityRepository.saveAll(dirtyActivities);
        }
    }

    private Map<String, Object> toRunFeedItem(Activity activity) {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        ActivityWeatherCorrection.Value correction = ActivityWeatherCorrection.from(activity);
        body.put("id", activity.getId());
        body.put("name", activity.getName());
        body.put("stravaId", activity.getStravaId());
        body.put("distanceKm", activity.getDistanceKm());
        body.put("movingTimeSeconds", activity.getMovingTimeSeconds());
        body.put("startDate", activity.getStartDate());
        body.put("provider", activity.getProvider() == null ? null : activity.getProvider().name());
        body.put("activityType", activity.getActivityType() == null ? null : activity.getActivityType().name());
        body.put("startTime", activity.getStartTime());
        body.put("distanceMeters", activity.getDistanceMeters());
        body.put("durationSeconds", activity.getDurationSeconds());
        body.put("sourceFileName", activity.getSourceFileName());
        body.put("createdAt", activity.getCreatedAt());
        body.put("averageHeartRate", activity.getAverageHeartRate());
        body.put("maxHeartRate", activity.getMaxHeartRate());
        body.put("totalElevationGain", activity.getTotalElevationGain());
        body.put("calories", activity.getCalories());
        body.put("averageCadence", activity.getAverageCadence());
        body.put("averageWatts", activity.getAverageWatts());
        body.put("maxSpeedMps", activity.getMaxSpeedMps());
        body.put("sufferScore", activity.getSufferScore());
        body.put("pacePenaltySecPerKm", correction.pacePenaltySecPerKm());
        body.put("weatherAdjusted", correction.weatherAdjusted());
        body.put("weatherAdjustedMovingTimeSeconds", correction.weatherAdjustedMovingTimeSeconds());
        body.put("weatherAdjustedPaceSecPerKm", correction.weatherAdjustedPaceSecPerKm());
        body.put("weatherCorrectionFactor", correction.weatherCorrectionFactor());
        body.put("shoeId", activity.getShoeId());
        body.put("shoeName", activity.getShoeName());
        body.put("routePreview", hasRoutePreview(activity)
                ? Map.of(
                        "path", activity.getRoutePreviewPath(),
                        "startX", activity.getRoutePreviewStartX(),
                        "startY", activity.getRoutePreviewStartY(),
                        "finishX", activity.getRoutePreviewFinishX(),
                        "finishY", activity.getRoutePreviewFinishY()
                )
                : null);
        return body;
    }

    private List<LatLngPoint> fetchLatLngPoints(Long activityId) {
        List<Object[]> coords = activityPointRepository.findLatLngByActivityIdOrdered(activityId);
        if (coords == null || coords.isEmpty()) return List.of();

        List<LatLngPoint> out = new ArrayList<>(coords.size());
        for (Object[] row : coords) {
            if (row == null || row.length < 2) continue;
            Double lat = ((Number) row[0]).doubleValue();
            Double lng = ((Number) row[1]).doubleValue();
            if (lat == null || lng == null) continue;
            out.add(new LatLngPoint(lat, lng));
        }
        return out;
    }

    private void cacheRoutePreviewIfMissing(Activity activity, List<LatLngPoint> points) {
        if (activity == null || hasRoutePreview(activity) || points == null || points.size() < 2) {
            return;
        }
        List<PreviewSample> samples = new ArrayList<>(points.size());
        for (int index = 0; index < points.size(); index++) {
            LatLngPoint point = points.get(index);
            samples.add(new PreviewSample(point.latitude(), point.longitude(), index));
        }
        RoutePreview routePreview = buildRoutePreview(samples);
        if (routePreview == null) {
            return;
        }
        applyRoutePreview(activity, routePreview);
        activityRepository.save(activity);
    }

    private boolean hasRoutePreview(Activity activity) {
        return activity != null
                && activity.getRoutePreviewPath() != null
                && !activity.getRoutePreviewPath().isBlank()
                && activity.getRoutePreviewStartX() != null
                && activity.getRoutePreviewStartY() != null
                && activity.getRoutePreviewFinishX() != null
                && activity.getRoutePreviewFinishY() != null;
    }

    private void applyRoutePreview(Activity activity, RoutePreview routePreview) {
        activity.setRoutePreviewPath(routePreview.path());
        activity.setRoutePreviewStartX(routePreview.startX());
        activity.setRoutePreviewStartY(routePreview.startY());
        activity.setRoutePreviewFinishX(routePreview.finishX());
        activity.setRoutePreviewFinishY(routePreview.finishY());
    }

    private RoutePreview buildRoutePreview(List<PreviewSample> samples) {
        if (samples == null || samples.size() < 2) {
            return null;
        }

        double minLatitude = Double.POSITIVE_INFINITY;
        double maxLatitude = Double.NEGATIVE_INFINITY;
        double minLongitude = Double.POSITIVE_INFINITY;
        double maxLongitude = Double.NEGATIVE_INFINITY;
        for (PreviewSample sample : samples) {
            minLatitude = Math.min(minLatitude, sample.latitude());
            maxLatitude = Math.max(maxLatitude, sample.latitude());
            minLongitude = Math.min(minLongitude, sample.longitude());
            maxLongitude = Math.max(maxLongitude, sample.longitude());
        }

        double latitudeSpan = Math.max(0.0001, maxLatitude - minLatitude);
        double longitudeSpan = Math.max(0.0001, maxLongitude - minLongitude);
        double padding = 12.0;
        double width = 100.0;
        double height = 100.0;
        double innerWidth = width - (padding * 2.0);
        double innerHeight = height - (padding * 2.0);
        int stride = Math.max(1, samples.size() / ROUTE_PREVIEW_POINT_LIMIT);
        while (stride < samples.size()) {
            List<PreviewPoint> normalized = buildNormalizedPreviewPoints(
                    samples,
                    stride,
                    minLatitude,
                    latitudeSpan,
                    minLongitude,
                    longitudeSpan,
                    padding,
                    innerWidth,
                    innerHeight
            );
            if (normalized.size() < 2) {
                return null;
            }

            String path = buildPreviewPath(normalized);
            if (path.length() <= MAX_ROUTE_PREVIEW_PATH_LENGTH || stride >= samples.size() - 1) {
                PreviewPoint start = normalized.get(0);
                PreviewPoint finish = normalized.get(normalized.size() - 1);
                return new RoutePreview(path, start.x(), start.y(), finish.x(), finish.y());
            }
            stride += 1;
        }
        return null;
    }

    private List<PreviewPoint> buildNormalizedPreviewPoints(
            List<PreviewSample> samples,
            int stride,
            double minLatitude,
            double latitudeSpan,
            double minLongitude,
            double longitudeSpan,
            double padding,
            double innerWidth,
            double innerHeight
    ) {
        List<PreviewPoint> normalized = new ArrayList<>();
        for (int index = 0; index < samples.size(); index += stride) {
            normalized.add(normalizePreviewPoint(samples.get(index), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight));
        }
        PreviewPoint lastPoint = normalizePreviewPoint(samples.get(samples.size() - 1), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight);
        if (normalized.isEmpty() || !samePreviewPoint(normalized.get(normalized.size() - 1), lastPoint)) {
            normalized.add(lastPoint);
        }
        return normalized;
    }

    private String buildPreviewPath(List<PreviewPoint> normalized) {
        StringBuilder path = new StringBuilder();
        for (int index = 0; index < normalized.size(); index++) {
            PreviewPoint point = normalized.get(index);
            if (index > 0) {
                path.append(' ');
            }
            path.append(index == 0 ? 'M' : 'L')
                    .append(' ')
                    .append(formatPreviewCoordinate(point.x()))
                    .append(' ')
                    .append(formatPreviewCoordinate(point.y()));
        }
        return path.toString();
    }

    private PreviewPoint normalizePreviewPoint(
            PreviewSample sample,
            double minLatitude,
            double latitudeSpan,
            double minLongitude,
            double longitudeSpan,
            double padding,
            double innerWidth,
            double innerHeight
    ) {
        double x = padding + (((sample.longitude() - minLongitude) / longitudeSpan) * innerWidth);
        double y = padding + (innerHeight - (((sample.latitude() - minLatitude) / latitudeSpan) * innerHeight));
        return new PreviewPoint(x, y);
    }

    private boolean samePreviewPoint(PreviewPoint left, PreviewPoint right) {
        return Math.abs(left.x() - right.x()) < 0.001 && Math.abs(left.y() - right.y()) < 0.001;
    }

    private String formatPreviewCoordinate(double value) {
        return String.format(Locale.ROOT, "%.2f", value);
    }

    @SuppressWarnings("unchecked")
    private void fetchAndCacheStravaStream(Activity activity, String stravaId, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        ResponseEntity<List<Map<String, Object>>> response = this.restTemplate.exchange(
                "https://www.strava.com/api/v3/activities/" + stravaId + "/streams?keys=latlng,time,distance,altitude,heartrate,cadence",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
        );

        List<Map<String, Object>> streams = response.getBody();
        if (streams == null) return;

        List<List<Double>> latlng = null;
        List<Number> time = null;
        List<Number> distance = null;
        List<Number> altitude = null;
        List<Number> heartRate = null;
        List<Number> cadence = null;
        for (Map<String, Object> stream : streams) {
            if (!stream.containsKey("type")) continue;
            String type = String.valueOf(stream.get("type"));
            Object dataObj = stream.get("data");
            if ("latlng".equals(type) && dataObj instanceof List<?> l) latlng = (List<List<Double>>) l;
            if ("time".equals(type) && dataObj instanceof List<?> l) time = (List<Number>) l;
            if ("distance".equals(type) && dataObj instanceof List<?> l) distance = (List<Number>) l;
            if ("altitude".equals(type) && dataObj instanceof List<?> l) altitude = (List<Number>) l;
            if ("heartrate".equals(type) && dataObj instanceof List<?> l) heartRate = (List<Number>) l;
            if ("cadence".equals(type) && dataObj instanceof List<?> l) cadence = (List<Number>) l;
        }
        if (latlng == null || latlng.isEmpty()) return;

        int total = latlng.size();
        int stride = total > MAX_POINTS_PER_ACTIVITY
                ? Math.max(1, (int) Math.ceil(total / (double) MAX_POINTS_PER_ACTIVITY))
                : 1;

        List<ActivityPoint> batch = new ArrayList<>(POINTS_BATCH_SIZE);
        int seq = 0;

        for (int i = 0; i < total; i += stride) {
            List<Double> coord = latlng.get(i);
            if (coord == null || coord.size() < 2) continue;

            ActivityPoint point = new ActivityPoint();
            point.setActivity(activity);
            point.setLatitude(coord.get(0));
            point.setLongitude(coord.get(1));
            point.setSequenceIndex(seq++);
            point.setElapsedSeconds(numberAt(time, i) == null ? null : numberAt(time, i).intValue());
            point.setDistanceMeters(numberAt(distance, i) == null ? null : numberAt(distance, i).doubleValue());
            point.setElevationMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
            point.setElevationRawMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
            point.setHeartRate(numberAt(heartRate, i) == null ? null : numberAt(heartRate, i).intValue());
            Number cad = numberAt(cadence, i);
            point.setCadence(cad == null ? null : (int) Math.round(cad.doubleValue() * 2.0));
            batch.add(point);

            if (batch.size() >= POINTS_BATCH_SIZE) {
                activityPointRepository.saveAll(batch);
                activityPointRepository.flush();
                batch.clear();
            }
        }

        if (!batch.isEmpty()) {
            activityPointRepository.saveAll(batch);
            activityPointRepository.flush();
        }
    }

    private static Number numberAt(List<Number> list, int i) {
        if (list == null || i < 0 || i >= list.size()) return null;
        return list.get(i);
    }

    private String resolveRunnerStravaAccessToken(Runner runner) {
        String storedToken = runner.getStravaAccessToken();
        if (storedToken == null || storedToken.isBlank()) {
            return null;
        }

        String decryptedToken = secretEncryptionService.decrypt(storedToken);
        if (!secretEncryptionService.isEncrypted(storedToken) && secretEncryptionService.isConfigured()) {
            runner.setStravaAccessToken(secretEncryptionService.encrypt(decryptedToken));
            runnerRepository.save(runner);
        }
        return decryptedToken;
    }

    public record LatLngPoint(double latitude, double longitude) {}
    private record PreviewSample(double latitude, double longitude, int sequenceIndex) {}
    private record PreviewPoint(double x, double y) {}
    private record RoutePreview(String path, double startX, double startY, double finishX, double finishY) {}
    public record AnalysisActivitySummary(
            Long id,
            String name,
            Double distanceKm,
            Double distanceMeters,
            Integer movingTimeSeconds,
            String startDate,
            java.time.LocalDateTime startTime,
            Double averageHeartRate,
            Double maxHeartRate,
            Double averageCadence,
            Double maxSpeedMps,
            Integer pacePenaltySecPerKm,
            Boolean weatherAdjusted,
            Integer weatherAdjustedMovingTimeSeconds,
            Double weatherAdjustedPaceSecPerKm,
            Double weatherCorrectionFactor
    ) {}
}
