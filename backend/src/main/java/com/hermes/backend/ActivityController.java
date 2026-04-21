package com.hermes.backend;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {
    private static final int POINTS_BATCH_SIZE = 500;
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;
    private static final int ROUTE_PREVIEW_POINT_LIMIT = 40;

    private final AuthService authService;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final RunnerRepository runnerRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final ElevationCorrectionService elevationCorrectionService;
    private final AcclimatizationService acclimatizationService;
    private final ReadinessService readinessService;
    private final RestTemplate restTemplate;

    public ActivityController(AuthService authService, ActivityRepository activityRepository,
                              ActivityPointRepository activityPointRepository, RunnerRepository runnerRepository,
                              SecretEncryptionService secretEncryptionService,
                              ElevationCorrectionService elevationCorrectionService,
                              AcclimatizationService acclimatizationService,
                              ReadinessService readinessService,
                              RestTemplate restTemplate) {
        this.authService = authService;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.runnerRepository = runnerRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.elevationCorrectionService = elevationCorrectionService;
        this.acclimatizationService = acclimatizationService;
        this.readinessService = readinessService;
        this.restTemplate = restTemplate;
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
    public ResponseEntity<?> getAnalysisRuns(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);

        if (activeUser.isEmpty()) {
            return err(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }

        List<ActivityRepository.AnalysisActivitySummaryProjection> runs =
                activityRepository.findAnalysisSummariesByRunnerAndActivityType(activeUser.get(), ActivityType.RUN);
        List<AnalysisActivitySummary> response = runs.stream()
                .map(run -> new AnalysisActivitySummary(
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
                        run.getMaxSpeedMps()
                ))
                .toList();
        return ResponseEntity.ok(response);
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
                System.err.println("Failed to fetch Strava stream for activity " + stravaId + ": " + e.getMessage());
            }
        }

        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/{id}/analytics")
    public ResponseEntity<?> getActivityAnalytics(
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

        if (!activityPointRepository.existsByActivity(activity) && activity.getStravaId() != null) {
            String stravaToken = resolveRunnerStravaAccessToken(activeUser.get());
            if (stravaToken != null && !stravaToken.isBlank()) {
                try {
                    fetchAndCacheStravaStream(activity, activity.getStravaId(), stravaToken);
                } catch (Exception ignored) {
                }
            }
        }

        List<Object[]> rows = activityPointRepository.findAnalyticsSamplesByActivityIdOrdered(activity.getId());
        if (rows.isEmpty()) {
            return ResponseEntity.ok(new PostRunAnalytics(List.of(), List.of(), null, null, null, null, null));
        }

        List<SamplePoint> pts = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            if (r == null || r.length < 2) continue;
            pts.add(new SamplePoint(
                    ((Number) r[0]).doubleValue(),
                    ((Number) r[1]).doubleValue(),
                    r[2] == null ? null : ((Number) r[2]).intValue(),
                    r[3] == null ? null : ((Number) r[3]).doubleValue(),
                    resolveElevationForAnalytics(r),
                    r[5] == null ? null : ((Number) r[5]).intValue(),
                    r[6] == null ? null : ((Number) r[6]).intValue()
            ));
        }
        normalizeSamples(pts, activity);

        PostRunDebrief debrief = buildPostRunDebrief(activity, pts);

        return ResponseEntity.ok(new PostRunAnalytics(
                buildLapBreakdown(pts),
                buildElevationProfile(pts),
                averageCadence(pts, activity),
                averageStrideMeters(pts),
                computeCardiacDrift(pts),
                minElevation(pts),
                maxElevation(pts),
                debrief
        ));
    }

    private PostRunDebrief buildPostRunDebrief(Activity activity, List<SamplePoint> pts) {
        if (activity.getRunner() == null) return null;
        
        java.time.LocalDate runDate = activity.getStartTime() != null 
                ? activity.getStartTime().toLocalDate() 
                : (activity.getStartDate() != null ? java.time.LocalDate.parse(activity.getStartDate()) : null);
        
        if (runDate == null) return null;

        ReadinessService.ReadinessDay readiness = readinessService.getDailyReadiness(activity.getRunner(), runDate);
        CardiacDrift drift = computeCardiacDrift(pts);

        StringBuilder interpretation = new StringBuilder();
        String nextDayGuidance;

        if (readiness.score() >= 80) {
            interpretation.append("You started this run with high readiness (").append(readiness.score()).append("%). ");
            if (drift != null && drift.driftPercent() < 5) {
                interpretation.append("Your cardiovascular system responded excellently with minimal drift.");
                nextDayGuidance = "Green light for tomorrow's planned session.";
            } else if (drift != null && drift.driftPercent() > 10) {
                interpretation.append("However, we saw higher than expected cardiac drift, suggesting the effort was more taxing than usual.");
                nextDayGuidance = "Consider a slightly easier effort tomorrow to absorb today's work.";
            } else {
                interpretation.append("The body handled the workload as expected.");
                nextDayGuidance = "Continue with your scheduled training block.";
            }
        } else if (readiness.score() < 60) {
            interpretation.append("You pushed through significant fatigue today (Readiness: ").append(readiness.score()).append("%). ");
            if (drift != null && drift.driftPercent() > 8) {
                interpretation.append("The high cardiac drift confirms your body is under stress.");
                nextDayGuidance = "Mandatory easy day or rest recommended tomorrow.";
            } else {
                interpretation.append("Impressively, your efficiency held up despite the low readiness signal.");
                nextDayGuidance = "Prioritize sleep tonight to stay on track.";
            }
        } else {
            interpretation.append("A solid effort on a baseline readiness day (").append(readiness.score()).append("%).");
            nextDayGuidance = "Listen to your body tomorrow morning before pushing hard.";
        }

        return new PostRunDebrief(interpretation.toString(), readiness.score(), nextDayGuidance);
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

        List<PreviewPoint> normalized = new ArrayList<>();
        for (int index = 0; index < samples.size(); index += stride) {
            normalized.add(normalizePreviewPoint(samples.get(index), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight));
        }
        PreviewPoint lastPoint = normalizePreviewPoint(samples.get(samples.size() - 1), minLatitude, latitudeSpan, minLongitude, longitudeSpan, padding, innerWidth, innerHeight);
        if (normalized.isEmpty() || !samePreviewPoint(normalized.get(normalized.size() - 1), lastPoint)) {
            normalized.add(lastPoint);
        }
        if (normalized.size() < 2) {
            return null;
        }

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

        PreviewPoint start = normalized.get(0);
        PreviewPoint finish = normalized.get(normalized.size() - 1);
        return new RoutePreview(path.toString(), start.x(), start.y(), finish.x(), finish.y());
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

    private static Double resolveElevationForAnalytics(Object[] row) {
        Double legacy = row.length > 4 && row[4] != null ? ((Number) row[4]).doubleValue() : null;
        Double raw = row.length > 7 && row[7] != null ? ((Number) row[7]).doubleValue() : null;
        Double corrected = row.length > 8 && row[8] != null ? ((Number) row[8]).doubleValue() : null;
        if (corrected != null) return corrected;
        if (raw != null) return raw;
        return legacy;
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

    private static void normalizeSamples(List<SamplePoint> pts, Activity activity) {
        if (pts.isEmpty()) return;
        double cum = 0;
        for (int i = 0; i < pts.size(); i++) {
            SamplePoint p = pts.get(i);
            if (p.distanceMeters() != null && p.distanceMeters() >= 0) {
                cum = Math.max(cum, p.distanceMeters());
                continue;
            }
            if (i > 0) {
                SamplePoint prev = pts.get(i - 1);
                cum += haversineMeters(prev.latitude(), prev.longitude(), p.latitude(), p.longitude());
            }
            pts.set(i, p.withDistanceMeters(cum));
        }

        Integer maxKnownSec = null;
        for (SamplePoint p : pts) {
            if (p.elapsedSeconds() != null) maxKnownSec = p.elapsedSeconds();
        }
        int totalSec = maxKnownSec != null && maxKnownSec > 0
                ? maxKnownSec
                : (activity.getMovingTimeSeconds() > 0 ? activity.getMovingTimeSeconds()
                : (activity.getDurationSeconds() != null ? activity.getDurationSeconds().intValue() : 0));
        double totalDist = pts.get(pts.size() - 1).distanceMeters() == null ? 0 : pts.get(pts.size() - 1).distanceMeters();
        if (totalSec > 0 && totalDist > 0) {
            for (int i = 0; i < pts.size(); i++) {
                SamplePoint p = pts.get(i);
                if (p.elapsedSeconds() != null) continue;
                int sec = (int) Math.round((p.distanceMeters() / totalDist) * totalSec);
                pts.set(i, p.withElapsedSeconds(sec));
            }
        }
    }

    private static List<LapBreakdown> buildLapBreakdown(List<SamplePoint> pts) {
        List<LapBreakdown> out = new ArrayList<>();
        if (pts.isEmpty()) return out;
        double total = pts.get(pts.size() - 1).distanceMeters() == null ? 0 : pts.get(pts.size() - 1).distanceMeters();
        if (total <= 0) return out;
        int laps = (int) Math.floor(total / 1000.0);
        for (int lap = 1; lap <= laps; lap++) {
            double startM = (lap - 1) * 1000.0;
            double endM = lap * 1000.0;
            Double startSec = interpolateSecondsAtDistance(pts, startM);
            Double endSec = interpolateSecondsAtDistance(pts, endM);
            if (startSec == null || endSec == null || endSec <= startSec) continue;
            out.add(new LapBreakdown(
                    lap,
                    1.0,
                    (int) Math.round(endSec - startSec),
                    formatPace(endSec - startSec),
                    averageHrBetweenDistance(pts, startM, endM),
                    averageCadenceBetweenDistance(pts, startM, endM)
            ));
        }
        return out;
    }

    private static List<ElevationSample> buildElevationProfile(List<SamplePoint> pts) {
        List<ElevationSample> out = new ArrayList<>();
        if (pts.isEmpty()) return out;
        int target = 240;
        int stride = pts.size() > target ? (int) Math.ceil(pts.size() / (double) target) : 1;
        for (int i = 0; i < pts.size(); i += stride) {
            SamplePoint p = pts.get(i);
            if (p.distanceMeters() == null || p.elevationMeters() == null) continue;
            out.add(new ElevationSample(p.distanceMeters() / 1000.0, p.elevationMeters()));
        }
        return out;
    }

    private static Double averageCadence(List<SamplePoint> pts, Activity activity) {
        int s = 0;
        int n = 0;
        for (SamplePoint p : pts) {
            if (p.cadence() != null && p.cadence() > 0) {
                s += p.cadence();
                n++;
            }
        }
        return n > 0 ? s / (double) n : activity.getAverageCadence();
    }

    private static Double averageStrideMeters(List<SamplePoint> pts) {
        double s = 0;
        int n = 0;
        for (int i = 1; i < pts.size(); i++) {
            SamplePoint a = pts.get(i - 1);
            SamplePoint b = pts.get(i);
            if (a.distanceMeters() == null || b.distanceMeters() == null
                    || a.elapsedSeconds() == null || b.elapsedSeconds() == null
                    || b.cadence() == null || b.cadence() <= 0) continue;
            double dd = b.distanceMeters() - a.distanceMeters();
            double dt = b.elapsedSeconds() - a.elapsedSeconds();
            if (dd <= 0 || dt <= 0) continue;
            double speed = dd / dt;
            double stride = speed / (b.cadence() / 60.0);
            if (Double.isFinite(stride) && stride > 0 && stride < 3.5) {
                s += stride;
                n++;
            }
        }
        return n > 0 ? s / n : null;
    }

    private static CardiacDrift computeCardiacDrift(List<SamplePoint> pts) {
        if (pts.size() < 10) return null;
        double totalDist = pts.get(pts.size() - 1).distanceMeters() == null ? 0 : pts.get(pts.size() - 1).distanceMeters();
        if (totalDist <= 0) return null;
        double mid = totalDist / 2.0;
        Metrics first = paceHrMetrics(pts, 0, mid);
        Metrics second = paceHrMetrics(pts, mid, totalDist);
        if (first == null || second == null || first.avgHr <= 0 || second.avgHr <= 0) return null;
        double eff1 = (1000.0 / first.paceSecPerKm) / first.avgHr;
        double eff2 = (1000.0 / second.paceSecPerKm) / second.avgHr;
        if (eff1 <= 0 || eff2 <= 0) return null;
        double driftPct = ((eff1 - eff2) / eff1) * 100.0;
        return new CardiacDrift(
                round2(driftPct),
                round2(first.avgHr),
                round2(second.avgHr),
                formatPace(first.paceSecPerKm),
                formatPace(second.paceSecPerKm)
        );
    }

    private static Metrics paceHrMetrics(List<SamplePoint> pts, double fromDist, double toDist) {
        Double s0 = interpolateSecondsAtDistance(pts, fromDist);
        Double s1 = interpolateSecondsAtDistance(pts, toDist);
        if (s0 == null || s1 == null || s1 <= s0 || toDist <= fromDist) return null;
        int hrSum = 0;
        int hrCount = 0;
        for (SamplePoint p : pts) {
            if (p.distanceMeters() == null || p.heartRate() == null || p.heartRate() <= 0) continue;
            if (p.distanceMeters() >= fromDist && p.distanceMeters() <= toDist) {
                hrSum += p.heartRate();
                hrCount++;
            }
        }
        if (hrCount == 0) return null;
        double paceSecPerKm = ((s1 - s0) / (toDist - fromDist)) * 1000.0;
        return new Metrics(hrSum / (double) hrCount, paceSecPerKm);
    }

    private static Double interpolateSecondsAtDistance(List<SamplePoint> pts, double targetDistM) {
        if (pts.isEmpty()) return null;
        for (int i = 1; i < pts.size(); i++) {
            SamplePoint a = pts.get(i - 1);
            SamplePoint b = pts.get(i);
            if (a.distanceMeters() == null || b.distanceMeters() == null
                    || a.elapsedSeconds() == null || b.elapsedSeconds() == null) continue;
            if (targetDistM > b.distanceMeters()) continue;
            double span = b.distanceMeters() - a.distanceMeters();
            if (span <= 0) return b.elapsedSeconds().doubleValue();
            double r = (targetDistM - a.distanceMeters()) / span;
            return a.elapsedSeconds() + r * (b.elapsedSeconds() - a.elapsedSeconds());
        }
        SamplePoint last = pts.get(pts.size() - 1);
        return last.elapsedSeconds() == null ? null : last.elapsedSeconds().doubleValue();
    }

    private static Integer averageHrBetweenDistance(List<SamplePoint> pts, double startM, double endM) {
        int s = 0, n = 0;
        for (SamplePoint p : pts) {
            if (p.distanceMeters() == null || p.heartRate() == null || p.heartRate() <= 0) continue;
            if (p.distanceMeters() >= startM && p.distanceMeters() <= endM) {
                s += p.heartRate();
                n++;
            }
        }
        return n > 0 ? Math.round(s / (float) n) : null;
    }

    private static Integer averageCadenceBetweenDistance(List<SamplePoint> pts, double startM, double endM) {
        int s = 0, n = 0;
        for (SamplePoint p : pts) {
            if (p.distanceMeters() == null || p.cadence() == null || p.cadence() <= 0) continue;
            if (p.distanceMeters() >= startM && p.distanceMeters() <= endM) {
                s += p.cadence();
                n++;
            }
        }
        return n > 0 ? Math.round(s / (float) n) : null;
    }

    private static Double minElevation(List<SamplePoint> pts) {
        Double min = null;
        for (SamplePoint p : pts) {
            if (p.elevationMeters() == null) continue;
            min = min == null ? p.elevationMeters() : Math.min(min, p.elevationMeters());
        }
        return min;
    }

    private static Double maxElevation(List<SamplePoint> pts) {
        Double max = null;
        for (SamplePoint p : pts) {
            if (p.elevationMeters() == null) continue;
            max = max == null ? p.elevationMeters() : Math.max(max, p.elevationMeters());
        }
        return max;
    }

    private static String formatPace(double secPerKm) {
        if (!Double.isFinite(secPerKm) || secPerKm <= 0) return null;
        int totalSec = (int) Math.round(secPerKm);
        int min = totalSec / 60;
        int sec = totalSec % 60;
        return String.format(Locale.ROOT, "%d:%02d /km", min, sec);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        final double r = 6_371_000d;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
            Double maxSpeedMps
    ) {}
    private record SamplePoint(
            double latitude,
            double longitude,
            Integer elapsedSeconds,
            Double distanceMeters,
            Double elevationMeters,
            Integer heartRate,
            Integer cadence
    ) {
        SamplePoint withElapsedSeconds(Integer elapsedSeconds) {
            return new SamplePoint(latitude, longitude, elapsedSeconds, distanceMeters, elevationMeters, heartRate, cadence);
        }
        SamplePoint withDistanceMeters(Double distanceMeters) {
            return new SamplePoint(latitude, longitude, elapsedSeconds, distanceMeters, elevationMeters, heartRate, cadence);
        }
    }
    private record Metrics(double avgHr, double paceSecPerKm) {}
    public record LapBreakdown(
            int lapIndex,
            double distanceKm,
            int durationSeconds,
            String pace,
            Integer averageHeartRate,
            Integer averageCadence
    ) {}
    public record ElevationSample(double distanceKm, double elevationMeters) {}
    public record CardiacDrift(
            double driftPercent,
            double firstHalfAverageHeartRate,
            double secondHalfAverageHeartRate,
            String firstHalfPace,
            String secondHalfPace
    ) {}
    public record PostRunDebrief(
            String interpretation,
            Integer readinessScore,
            String nextDayGuidance
    ) {}
    public record PostRunAnalytics(
            List<LapBreakdown> laps,
            List<ElevationSample> elevationProfile,
            Double averageCadence,
            Double averageStrideLengthMeters,
            CardiacDrift cardiacDrift,
            Double minElevationMeters,
            Double maxElevationMeters,
            PostRunDebrief debrief
    ) {}
}
