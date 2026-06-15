package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {
    private static final Logger logger = LoggerFactory.getLogger(ActivityController.class);
    private static final int ROUTE_THUMB_PREVIEW_POINT_LIMIT = 240;
    private static final int MAX_ANALYSIS_SUMMARY_LIMIT = 500;
    private static final int MAX_ROUTE_PREVIEW_BATCH_SIZE = 50;
    private static final Duration ACTIVITY_ANALYTICS_CACHE_TTL = Duration.ofMinutes(10);

    private final AuthService authService;
    private final ActivityDataAccess activityDataAccess;
    private final ActivityStravaStreamService stravaStreamService;
    private final ElevationCorrectionService elevationCorrectionService;
    private final AcclimatizationService acclimatizationService;
    private final ReadinessService readinessService;
    private final TtlCacheStore cacheStore;

    @Autowired
    public ActivityController(AuthService authService,
                              ActivityDataAccess activityDataAccess,
                              ActivityStravaStreamService stravaStreamService,
                              ElevationCorrectionService elevationCorrectionService,
                              AcclimatizationService acclimatizationService,
                              ReadinessService readinessService,
                              TtlCacheStore cacheStore) {
        this.authService = authService;
        this.activityDataAccess = activityDataAccess;
        this.stravaStreamService = stravaStreamService;
        this.elevationCorrectionService = elevationCorrectionService;
        this.acclimatizationService = acclimatizationService;
        this.readinessService = readinessService;
        this.cacheStore = cacheStore;
    }

    public ActivityController(AuthService authService,
                              ActivityDataAccess activityDataAccess,
                              ActivityStravaStreamService stravaStreamService,
                              ElevationCorrectionService elevationCorrectionService,
                              AcclimatizationService acclimatizationService,
                              ReadinessService readinessService) {
        this(authService, activityDataAccess, stravaStreamService,
                elevationCorrectionService, acclimatizationService, readinessService,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    @GetMapping
    public ResponseEntity<?> getUserRuns(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);

        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        List<Activity> runs = activityDataAccess.findRunsForRunner(activeUser.get());
        ActivityRoutePreviewHelper.hydrateMissingRoutePreviews(runs, activityDataAccess);
        return ResponseEntity.ok(runs.stream().map(ActivityRoutePreviewHelper::toRunFeedItem).toList());
    }

    @GetMapping("/route-previews")
    public ResponseEntity<?> getRoutePreviewBatch(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "ids", required = false) String idsParam
    ) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        final List<Long> requestedIds;
        try {
            requestedIds = parseRoutePreviewIds(idsParam);
        } catch (IllegalArgumentException exception) {
            return err(HttpStatus.BAD_REQUEST, "INVALID_PARAM", exception.getMessage());
        }
        if (requestedIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        Runner runner = activeUser.get();
        List<Activity> ownedActivities = activityDataAccess.findActivitiesByIdsForRunner(requestedIds, runner);
        if (ownedActivities.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        Map<Long, Activity> activityById = new HashMap<>();
        for (Activity activity : ownedActivities) {
            if (activity == null || activity.getId() == null) continue;
            stravaStreamService.hydrateActivityPointsIfMissing(activity, runner);
            activityById.put(activity.getId(), activity);
        }

        List<Long> ownedIds = requestedIds.stream()
                .filter(activityById::containsKey)
                .toList();
        if (ownedIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        Map<Long, List<ActivityRoutePreviewHelper.LatLngPoint>> pointsByActivityId = new LinkedHashMap<>();
        for (Object[] row : activityDataAccess.findRoutePreviewSamplesByActivityIds(ownedIds, ROUTE_THUMB_PREVIEW_POINT_LIMIT)) {
            if (row == null || row.length < 4 || !(row[0] instanceof Number activityIdNumber)) {
                continue;
            }
            double latitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double longitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
                continue;
            }
            long activityId = activityIdNumber.longValue();
            pointsByActivityId.computeIfAbsent(activityId, ignored -> new ArrayList<>())
                    .add(new ActivityRoutePreviewHelper.LatLngPoint(latitude, longitude));
        }

        Map<Long, ActivityRoutePreviewHelper.GeoBbox> bboxByActivityId = new LinkedHashMap<>();
        Map<Long, Long> pointCountByActivityId = new LinkedHashMap<>();
        for (Object[] row : activityDataAccess.findRoutePreviewBboxesByActivityIds(ownedIds)) {
            if (row == null || row.length < 6 || !(row[0] instanceof Number activityIdNumber)) {
                continue;
            }
            double minLatitude = row[1] instanceof Number number ? number.doubleValue() : Double.NaN;
            double maxLatitude = row[2] instanceof Number number ? number.doubleValue() : Double.NaN;
            double minLongitude = row[3] instanceof Number number ? number.doubleValue() : Double.NaN;
            double maxLongitude = row[4] instanceof Number number ? number.doubleValue() : Double.NaN;
            long pointCount = row[5] instanceof Number number ? number.longValue() : 0L;
            if (!Double.isFinite(minLatitude) || !Double.isFinite(maxLatitude)
                    || !Double.isFinite(minLongitude) || !Double.isFinite(maxLongitude)) {
                continue;
            }
            long activityId = activityIdNumber.longValue();
            bboxByActivityId.put(
                    activityId,
                    new ActivityRoutePreviewHelper.GeoBbox(minLatitude, maxLatitude, minLongitude, maxLongitude)
            );
            pointCountByActivityId.put(activityId, Math.max(0L, pointCount));
        }

        List<ActivityRoutePreviewHelper.RoutePreviewBatchItem> response = ownedIds.stream()
                .map(activityId -> new ActivityRoutePreviewHelper.RoutePreviewBatchItem(
                        activityId,
                        pointsByActivityId.getOrDefault(activityId, List.of()),
                        bboxByActivityId.get(activityId),
                        pointCountByActivityId.getOrDefault(activityId, 0L)
                ))
                .toList();
        return ResponseEntity.ok(response);
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
                activityDataAccess.findAnalysisSummaries(activeUser.get(), boundedLimit);
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

    private List<Long> parseRoutePreviewIds(String idsParam) {
        if (idsParam == null || idsParam.isBlank()) {
            return List.of();
        }

        Set<Long> ids = new LinkedHashSet<>();
        for (String rawToken : idsParam.split(",")) {
            String token = rawToken == null ? "" : rawToken.trim();
            if (token.isEmpty()) continue;
            long id;
            try {
                id = Long.parseLong(token);
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException("Invalid activity id list.");
            }
            if (id <= 0) {
                throw new IllegalArgumentException("Invalid activity id list.");
            }
            ids.add(id);
            if (ids.size() > MAX_ROUTE_PREVIEW_BATCH_SIZE) {
                throw new IllegalArgumentException("Too many activity ids requested.");
            }
        }
        return List.copyOf(ids);
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
            coords = activityDataAccess.findHeatmapCoordsByRunnerAndYear(runner, yearStart, yearEnd, year + "%");
        } else {
            coords = activityDataAccess.findHeatmapCoordsByRunner(runner);
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

        Optional<Activity> activityOpt = activityDataAccess.findActivityForRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }

        Activity activity = activityOpt.get();

        // FIT/GPX/TCX imports: return locally stored points (projection, not entities).
        List<ActivityRoutePreviewHelper.LatLngPoint> localPoints =
                ActivityRoutePreviewHelper.fetchLatLngPoints(activity.getId(), activityDataAccess);
        if (!localPoints.isEmpty()) {
            ActivityRoutePreviewHelper.cacheRoutePreviewIfMissing(activity, localPoints, activityDataAccess);
            return ResponseEntity.ok(localPoints);
        }

        // Strava imports: fetch GPS stream on-demand then cache to DB
        String stravaId = activity.getStravaId();
        String stravaToken = stravaStreamService.resolveRunnerStravaAccessToken(activeUser.get());
        if (stravaId != null && stravaToken != null) {
            try {
                stravaStreamService.fetchAndCacheStravaStream(activity, stravaId, stravaToken);
                // Query again to return an identical payload shape for local/Strava points.
                List<ActivityRoutePreviewHelper.LatLngPoint> cached =
                        ActivityRoutePreviewHelper.fetchLatLngPoints(activity.getId(), activityDataAccess);
                ActivityRoutePreviewHelper.cacheRoutePreviewIfMissing(activity, cached, activityDataAccess);
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

        Optional<Activity> activityOpt = activityDataAccess.findActivityForRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        Activity activity = activityOpt.get();
        String responseLanguage = ActivityTelemetryResponseBuilder.normalizeResponseLanguage(acceptLanguage);
        String analyticsCacheKey = activeUser.get().getId() + ":" + activity.getId() + ":" + responseLanguage;

        if (!activityDataAccess.hasPoints(activity) && activity.getStravaId() != null) {
            String stravaToken = stravaStreamService.resolveRunnerStravaAccessToken(activeUser.get());
            if (stravaToken != null && !stravaToken.isBlank()) {
                try {
                    stravaStreamService.fetchAndCacheStravaStream(activity, activity.getStravaId(), stravaToken);
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

        List<Object[]> rows = activityDataAccess.findAnalyticsSamplesByActivityId(activity.getId());
        if (rows.isEmpty()) {
            ActivityAnalyticsHelper.PostRunAnalytics response = new ActivityAnalyticsHelper.PostRunAnalytics(List.of(), List.of(), null, null, null, null, null, null);
            return ResponseEntity.ok(response);
        }

        List<ActivityAnalyticsHelper.SamplePoint> pts = ActivityTelemetryResponseBuilder.buildAnalyticsSamplePoints(rows, activity);

        ActivityAnalyticsHelper.PostRunDebrief debrief =
                ActivityTelemetryResponseBuilder.buildPostRunDebrief(activity, pts, responseLanguage, readinessService);

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

    @GetMapping("/{id}/telemetry")
    public ResponseEntity<?> getActivityTelemetry(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        Optional<Activity> activityOpt = activityDataAccess.findActivityForRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }

        Activity activity = activityOpt.get();
        if (!activityDataAccess.hasPoints(activity) && activity.getStravaId() != null) {
            String stravaToken = stravaStreamService.resolveRunnerStravaAccessToken(activeUser.get());
            if (stravaToken != null && !stravaToken.isBlank()) {
                try {
                    stravaStreamService.fetchAndCacheStravaStream(activity, activity.getStravaId(), stravaToken);
                } catch (Exception exception) {
                    logger.warn("Failed to hydrate telemetry stream for activity {}: {}", activity.getId(), exception.getMessage());
                }
            }
        }

        List<ActivityAnalyticsHelper.SamplePoint> pts = ActivityTelemetryResponseBuilder.buildAnalyticsSamplePoints(
                activityDataAccess.findAnalyticsSamplesByActivityId(activity.getId()),
                activity
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("sampleCount", pts.size());
        response.put("resolution", "source_elapsed_seconds");
        response.put("series", ActivityTelemetryResponseBuilder.buildTelemetrySeries(pts));
        response.put("trainingEffect", ActivityTelemetryResponseBuilder.estimateTrainingEffect(activity, pts));
        return ResponseEntity.ok(response);
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

        Optional<Activity> activityOpt = activityDataAccess.findActivityForRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }

        List<Object[]> rows = activityDataAccess.findHrSamplesByActivityId(activityOpt.get().getId());
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

        Optional<Activity> activityOpt = activityDataAccess.findActivityForRunner(id, activeUser.get());
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
                activityDataAccess.findRecentRunsInDistanceBucket(
                        activeUser.get(),
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
        Optional<Activity> activityOpt = activityDataAccess.findActivityForRunner(id, activeUser.get());
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
        Optional<Activity> activityOpt = activityDataAccess.findActivityForRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return err(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        ElevationCorrectionService.RecalibrateResult result = elevationCorrectionService.recalibrate(activityOpt.get(), request);
        return ResponseEntity.ok(result);
    }

    private static ResponseEntity<Map<String, String>> err(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }

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
