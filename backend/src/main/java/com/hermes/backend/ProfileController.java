package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

@RestController
@RequestMapping("/api")
public class ProfileController {
    private static final int MAX_HEATMAP_POINTS = 24000;
    private static final int GUARANTEED_RECENT_HEATMAP_ACTIVITIES = 5;
    private static final Duration HEATMAP_CACHE_TTL = Duration.ofMinutes(5);
    private static final int MAX_SETTINGS_MANTRA_LENGTH = 180;

    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final ActivityNormalizationService activityNormalizationService;
    private final PersonalRecordService personalRecordService;
    private final QuotaService quotaService;
    private final AutomatedCoachService automatedCoachService;
    private final RaceEventRepository raceEventRepository;
    private final MuscleTrainingPlannerService muscleTrainingPlannerService;
    private final AcclimatizationService acclimatizationService;
    private final ShoeRepository shoeRepository;
    private final TtlCacheStore cacheStore;

    @Autowired
    public ProfileController(
            AuthService authService,
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            ActivityNormalizationService activityNormalizationService,
            PersonalRecordService personalRecordService,
            QuotaService quotaService,
            AutomatedCoachService automatedCoachService,
            RaceEventRepository raceEventRepository,
            MuscleTrainingPlannerService muscleTrainingPlannerService,
            AcclimatizationService acclimatizationService,
            ShoeRepository shoeRepository,
            TtlCacheStore cacheStore
    ) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.activityNormalizationService = activityNormalizationService;
        this.personalRecordService = personalRecordService;
        this.quotaService = quotaService;
        this.automatedCoachService = automatedCoachService;
        this.raceEventRepository = raceEventRepository;
        this.muscleTrainingPlannerService = muscleTrainingPlannerService;
        this.acclimatizationService = acclimatizationService;
        this.shoeRepository = shoeRepository;
        this.cacheStore = cacheStore;
    }

    public ProfileController(
            AuthService authService,
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            ActivityNormalizationService activityNormalizationService,
            PersonalRecordService personalRecordService,
            QuotaService quotaService,
            AutomatedCoachService automatedCoachService,
            RaceEventRepository raceEventRepository,
            MuscleTrainingPlannerService muscleTrainingPlannerService,
            AcclimatizationService acclimatizationService,
            ShoeRepository shoeRepository
    ) {
        this(authService, runnerRepository, activityRepository, activityPointRepository, activityNormalizationService,
                personalRecordService, quotaService, automatedCoachService, raceEventRepository,
                muscleTrainingPlannerService, acclimatizationService, shoeRepository,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    @GetMapping("/profile/me")
    public ResponseEntity<?> me(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        return ResponseEntity.ok(toProfileResponse(runnerOptional.get()));
    }

    @GetMapping("/profile/quota")
    public ResponseEntity<?> getQuota(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(quotaService.getQuotaStatus(runnerOptional.get()));
    }

    @PatchMapping("/profile/me/name")
    public ResponseEntity<?> updateDisplayName(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody UpdateDisplayNameRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        String displayName = request == null ? null : request.displayName();
        String normalizedDisplayName = displayName == null ? "" : displayName.trim();
        if (normalizedDisplayName.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Display name is required.");
        }

        if (normalizedDisplayName.length() > 60) {
            return error(HttpStatus.BAD_REQUEST, "Display name must be 60 characters or fewer.");
        }

        try {
            InputSanitizer.rejectControlAndHtmlChars(normalizedDisplayName, "displayName");
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, "Display name contains invalid characters.");
        }

        Runner runner = runnerOptional.get();
        runner.setDisplayName(normalizedDisplayName);
        runnerRepository.save(runner);
        return ResponseEntity.ok(toProfileResponse(runner));
    }

    @GetMapping("/profile/preferences")
    public ResponseEntity<?> getPreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        return ResponseEntity.ok(toProfilePreferencesResponse(runnerOptional.get()));
    }

    @PutMapping("/profile/preferences")
    public ResponseEntity<?> updatePreferences(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody ProfilePreferencesRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        String mantra = request == null || request.mantra() == null ? "" : request.mantra().trim();
        if (mantra.length() > MAX_SETTINGS_MANTRA_LENGTH) {
            return error(HttpStatus.BAD_REQUEST, "Training mantra must be 180 characters or fewer.");
        }
        if (!mantra.isBlank()) {
            try {
                InputSanitizer.rejectControlAndHtmlChars(mantra, "mantra");
            } catch (IllegalArgumentException ex) {
                return error(HttpStatus.BAD_REQUEST, "Training mantra contains invalid characters.");
            }
        }

        Runner runner = runnerOptional.get();
        runner.setSettingsMantra(mantra);
        runner.setWeeklyDigestEnabled(request != null && Boolean.TRUE.equals(request.weeklyDigestEnabled()));
        runnerRepository.save(runner);
        return ResponseEntity.ok(toProfilePreferencesResponse(runner));
    }

    @GetMapping("/profile/dashboard")
    public ResponseEntity<?> profileDashboard(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        // The original layout ran 8 expensive ops sequentially. The long-pole
        // was `automatedCoachService.getTodayWithReadiness`, which makes a
        // synchronous HTTP call to Open-Meteo through AcclimatizationService
        // and could block the entire endpoint for up to the RestTemplate read
        // timeout. Two wins now: (a) drop the Today payload from the eager
        // response and let the frontend lazy-load `/api/coach/today` via the
        // existing deferredEnrichment flow, (b) run the remaining independent
        // lookups concurrently so wall-clock time is close to the slowest
        // single op rather than the sum of all six.
        List<Activity> activities = findRunnerRuns(runner);

        java.util.concurrent.CompletableFuture<AutomatedCoachService.CoachStateDto> coachStateFuture =
                java.util.concurrent.CompletableFuture.supplyAsync(() ->
                        safeValue(() -> automatedCoachService.getCoachState(runner), null));
        java.util.concurrent.CompletableFuture<List<AutomatedCoachService.CoachScheduledWorkoutDto>> scheduleFuture =
                java.util.concurrent.CompletableFuture.supplyAsync(() ->
                        safeValue(() -> automatedCoachService.getSchedule(runner, 7), List.<AutomatedCoachService.CoachScheduledWorkoutDto>of()));
        java.util.concurrent.CompletableFuture<Object> personalRecordsFuture =
                java.util.concurrent.CompletableFuture.supplyAsync(() ->
                        safeValue(() -> personalRecordService.buildForRunner(runner), null));
        java.util.concurrent.CompletableFuture<List<RaceEventResponse>> racesFuture =
                java.util.concurrent.CompletableFuture.supplyAsync(() ->
                        safeValue(() -> findRunnerRaces(runner, activities), List.<RaceEventResponse>of()));
        java.util.concurrent.CompletableFuture<Object> quotaFuture =
                java.util.concurrent.CompletableFuture.supplyAsync(() ->
                        safeValue(() -> quotaService.getQuotaStatus(runner), Map.<String, Object>of()));

        AutomatedCoachService.CoachStateDto coachState = coachStateFuture.join();
        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = scheduleFuture.join();
        // Muscle plan depends on coachState + schedule, so it runs after the
        // first wave resolves. Still on the request thread but bounded.
        Object musclePlan =
                safeValue(() -> muscleTrainingPlannerService.getPlan(runner, coachState, schedule), null);

        return ResponseEntity.ok(new ProfileDashboardResponse(
                toProfileResponse(runner),
                toRunFeedItems(activities),
                coachState,
                null,
                personalRecordsFuture.join(),
                racesFuture.join(),
                musclePlan,
                quotaFuture.join(),
                true
        ));
    }

    @GetMapping("/today/dashboard")
    public ResponseEntity<?> todayDashboard(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        List<Activity> activities = findRunnerRuns(runner);
        return ResponseEntity.ok(new TodayDashboardResponse(
                toProfileResponse(runner),
                toRunFeedItems(activities),
                safeValue(() -> automatedCoachService.getTodayWithReadiness(runner), null),
                safeValue(() -> acclimatizationService.buildContext(runner), null),
                safeValue(() -> findRunnerRaces(runner, activities), List.of()),
                safeValue(() -> findRunnerShoes(runner), List.of())
        ));
    }

    @GetMapping("/profile/heatmap")
    public ResponseEntity<?> heatmap(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        if (activityRepository.existsByRunnerAndActivityTypeIsNull(runner)) {
            activityNormalizationService.backfillActivityTypes(runner);
        }

        String heatmapCacheKey = String.valueOf(runner.getId());
        HeatmapResponse cached = cacheStore.get("profile-heatmap", heatmapCacheKey, HeatmapResponse.class).orElse(null);
        if (cached != null) {
            return ResponseEntity.ok(cached);
        }

        long activityCount = activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN);
        if (activityCount <= 0) {
            HeatmapResponse response = new HeatmapResponse(List.of(), 0, 0, 0, null);
            cacheStore.put("profile-heatmap", heatmapCacheKey, response, HEATMAP_CACHE_TTL);
            return ResponseEntity.ok(response);
        }

        long sourcePointCount = activityPointRepository.countHeatmapPointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        );
        if (sourcePointCount <= 0) {
            HeatmapResponse response = new HeatmapResponse(List.of(), 0, 0, activityCount, null);
            cacheStore.put("profile-heatmap", heatmapCacheKey, response, HEATMAP_CACHE_TTL);
            return ResponseEntity.ok(response);
        }

        List<Long> recentActivityIds = activityRepository.findRecentIdsByRunnerAndActivityType(
                runner.getId(),
                ActivityType.RUN.name(),
                GUARANTEED_RECENT_HEATMAP_ACTIVITIES
        );
        List<Object[]> activityPoints = new ArrayList<>();
        if (!recentActivityIds.isEmpty()) {
            activityPoints.addAll(activityPointRepository.findHeatmapPointsByActivityIds(recentActivityIds));
        }

        if (activityPoints.size() < MAX_HEATMAP_POINTS) {
            int remainingBudget = MAX_HEATMAP_POINTS - activityPoints.size();
            long olderPointCount = recentActivityIds.isEmpty()
                    ? sourcePointCount
                    : activityPointRepository.countHeatmapPointsByRunnerAndTypeExcludingActivities(
                            runner.getId(),
                            ActivityType.RUN.name(),
                            recentActivityIds
                    );

            if (olderPointCount > 0 && remainingBudget > 0) {
                long olderActivityCount = Math.max(0L, activityCount - recentActivityIds.size());
                int targetPointsPerActivity = olderActivityCount > 0
                        ? (int) Math.max(6L, Math.min(40L, remainingBudget / olderActivityCount))
                        : remainingBudget;
                activityPoints.addAll(activityPointRepository.findHeatmapSamplesByRunnerAndType(
                        runner.getId(),
                        ActivityType.RUN.name(),
                        recentActivityIds,
                        targetPointsPerActivity,
                        remainingBudget
                ));
            }
        } else if (activityPoints.size() > MAX_HEATMAP_POINTS) {
            activityPoints = new ArrayList<>(activityPoints.subList(0, MAX_HEATMAP_POINTS));
        }

        HeatmapBounds bounds = buildBoundsFromSamples(activityPoints);
        List<HeatPoint> points = buildHeatPoints(activityPoints);

        HeatmapResponse response = new HeatmapResponse(
                points,
                sourcePointCount,
                points.size(),
                activityCount,
                bounds
        );
        cacheStore.put("profile-heatmap", heatmapCacheKey, response, HEATMAP_CACHE_TTL);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/profile/personal-records")
    public ResponseEntity<?> personalRecords(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(personalRecordService.buildForRunner(runnerOptional.get()));
    }

    private List<Activity> findRunnerRuns(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        return safeValue(
                () -> activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN),
                List.of()
        );
    }

    private List<Map<String, Object>> toRunFeedItems(List<Activity> activities) {
        if (activities == null || activities.isEmpty()) {
            return List.of();
        }
        return activities.stream().map(this::toRunFeedItem).toList();
    }

    private Map<String, Object> toRunFeedItem(Activity activity) {
        Map<String, Object> body = new HashMap<>();
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
        body.put("pacePenaltySecPerKm", activity.getPacePenaltySecPerKm());
        body.put("weatherAdjusted", activity.getWeatherAdjusted());
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

    private boolean hasRoutePreview(Activity activity) {
        return activity != null
                && activity.getRoutePreviewPath() != null
                && !activity.getRoutePreviewPath().isBlank()
                && activity.getRoutePreviewStartX() != null
                && activity.getRoutePreviewStartY() != null
                && activity.getRoutePreviewFinishX() != null
                && activity.getRoutePreviewFinishY() != null;
    }

    private List<RaceEventResponse> findRunnerRaces(Runner runner, List<Activity> runActivities) {
        if (runner == null) {
            return List.of();
        }
        List<RaceEvent> races = raceEventRepository.findByRunnerOrderByEventDateAsc(runner);
        if (races == null || races.isEmpty()) {
            return List.of();
        }
        List<Activity> activities = runActivities == null ? List.of() : runActivities;
        return races.stream().map(race -> toRaceResponse(race, activities)).toList();
    }

    private RaceEventResponse toRaceResponse(RaceEvent raceEvent, List<Activity> runActivities) {
        Activity matchedActivity = resolveMatchedActivity(raceEvent, runActivities);
        boolean completed = matchedActivity != null
                || raceEvent.getRegistrationStatus() == RaceRegistrationStatus.COMPLETED;
        long countdownDays = raceEvent.getEventDate() == null
                ? 0
                : java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), raceEvent.getEventDate());

        return new RaceEventResponse(
                raceEvent.getId(),
                raceEvent.getName(),
                raceEvent.getOrganization(),
                raceEvent.getLocation(),
                raceEvent.getEventDate(),
                raceEvent.getDistanceKm(),
                raceEvent.getRegistrationStatus() == null ? null : raceEvent.getRegistrationStatus().name(),
                raceEvent.getGoalTimeSeconds(),
                raceEvent.getNotes(),
                raceEvent.isNyrrNinePlusOneEligible(),
                raceEvent.getCompletedActivityId(),
                completed,
                countdownDays,
                matchedActivity == null ? null : new LinkedActivitySummary(
                        matchedActivity.getId(),
                        matchedActivity.getName(),
                        matchedActivity.getStartTime(),
                        matchedActivity.getStartDate(),
                        matchedActivity.getDistanceKm(),
                        matchedActivity.getMovingTimeSeconds()
                )
        );
    }

    private Activity resolveMatchedActivity(RaceEvent raceEvent, List<Activity> runActivities) {
        if (raceEvent == null || runActivities == null || runActivities.isEmpty()) {
            return null;
        }

        if (raceEvent.getCompletedActivityId() != null) {
            for (Activity activity : runActivities) {
                if (raceEvent.getCompletedActivityId().equals(activity.getId())) {
                    return activity;
                }
            }
        }

        if (raceEvent.getEventDate() == null) {
            return null;
        }

        Activity best = null;
        long bestDayDelta = Long.MAX_VALUE;
        double bestDistanceDelta = Double.MAX_VALUE;
        for (Activity activity : runActivities) {
            java.time.LocalDate activityDate = extractActivityDate(activity);
            if (activityDate == null) {
                continue;
            }

            long dayDelta = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(raceEvent.getEventDate(), activityDate));
            if (dayDelta > 2) {
                continue;
            }

            double activityKm = resolveDistanceKm(activity);
            if (activityKm <= 0) {
                continue;
            }

            double distanceDelta = Math.abs(activityKm - Optional.ofNullable(raceEvent.getDistanceKm()).orElse(activityKm));
            if (raceEvent.getDistanceKm() != null && raceEvent.getDistanceKm() > 0) {
                double toleranceKm = Math.max(1.5, raceEvent.getDistanceKm() * 0.15);
                if (distanceDelta > toleranceKm) {
                    continue;
                }
            }

            if (dayDelta < bestDayDelta || (dayDelta == bestDayDelta && distanceDelta < bestDistanceDelta)) {
                best = activity;
                bestDayDelta = dayDelta;
                bestDistanceDelta = distanceDelta;
            }
        }
        return best;
    }

    private java.time.LocalDate extractActivityDate(Activity activity) {
        if (activity.getStartTime() != null) {
            return activity.getStartTime().toLocalDate();
        }
        if (activity.getStartDate() != null && !activity.getStartDate().isBlank()) {
            String value = activity.getStartDate();
            if (value.length() >= 10) {
                try {
                    return java.time.LocalDate.parse(value.substring(0, 10));
                } catch (Exception ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private double resolveDistanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) {
            return activity.getDistanceMeters() / 1000.0;
        }
        return 0;
    }

    private List<Shoe> findRunnerShoes(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        List<Shoe> shoes = shoeRepository.findByRunnerAndRetiredFalseOrderByCreatedAtDesc(runner);
        if (shoes == null || shoes.isEmpty()) {
            return List.of();
        }
        Map<Long, Double> distanceMap = buildShoeDistanceMap(runner);
        shoes.forEach(shoe -> attachCurrentDistance(shoe, distanceMap));
        return shoes;
    }

    private Map<Long, Double> buildShoeDistanceMap(Runner runner) {
        Map<Long, Double> distanceMap = new HashMap<>();
        List<Object[]> rows = activityRepository.sumDistanceKmByRunner(runner);
        if (rows == null) {
            return distanceMap;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || !(row[0] instanceof Number id) || !(row[1] instanceof Number distance)) {
                continue;
            }
            distanceMap.put(id.longValue(), distance.doubleValue());
        }
        return distanceMap;
    }

    private void attachCurrentDistance(Shoe shoe, Map<Long, Double> distanceMap) {
        double activityKm = distanceMap.getOrDefault(shoe.getId(), 0.0);
        double initial = shoe.getInitialDistanceKm() != null ? shoe.getInitialDistanceKm() : 0.0;
        shoe.setCurrentDistanceKm(Math.round((activityKm + initial) * 100.0) / 100.0);
    }

    private <T> T safeValue(Supplier<T> supplier, T fallback) {
        try {
            T value = supplier.get();
            return value == null ? fallback : value;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private HeatmapBounds buildBoundsFromSamples(List<Object[]> points) {
        if (points.isEmpty()) {
            return null;
        }

        double minLatitude = Double.MAX_VALUE;
        double maxLatitude = -Double.MAX_VALUE;
        double minLongitude = Double.MAX_VALUE;
        double maxLongitude = -Double.MAX_VALUE;

        for (Object[] point : points) {
            double lat = toDouble(point[1]);
            double lng = toDouble(point[2]);
            minLatitude = Math.min(minLatitude, lat);
            maxLatitude = Math.max(maxLatitude, lat);
            minLongitude = Math.min(minLongitude, lng);
            maxLongitude = Math.max(maxLongitude, lng);
        }

        return new HeatmapBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);
    }

    private List<HeatPoint> buildHeatPoints(List<Object[]> activityPoints) {
        if (activityPoints.isEmpty()) {
            return List.of();
        }

        List<Double> rawSpeeds = new ArrayList<>();
        Long previousActivityId = null;
        Double previousDistance = null;
        Integer previousElapsed = null;
        Double previousSpeed = null;

        for (Object[] point : activityPoints) {
            Long activityId = toLong(point[0]);
            boolean sameActivity = previousActivityId != null && previousActivityId.equals(activityId);
            if (!sameActivity) {
                previousSpeed = null;
            }
            Double speedMetersPerSecond = extractSegmentSpeed(point, sameActivity, previousDistance, previousElapsed);
            if (speedMetersPerSecond == null) {
                speedMetersPerSecond = previousSpeed;
            } else {
                previousSpeed = speedMetersPerSecond;
            }
            rawSpeeds.add(speedMetersPerSecond);
            previousActivityId = activityId;
            previousDistance = extractPointDistance(point);
            previousElapsed = extractPointElapsed(point);
        }

        List<Double> normalizedSpeeds = new ArrayList<>(rawSpeeds.size());
        for (Double rawSpeed : rawSpeeds) {
            if (rawSpeed != null && rawSpeed > 0) {
                normalizedSpeeds.add(rawSpeed);
            }
        }
        Collections.sort(normalizedSpeeds);
        boolean hasSpeedRange = normalizedSpeeds.size() > 1;
        List<HeatPoint> points = new ArrayList<>(activityPoints.size());

        for (int i = 0; i < activityPoints.size(); i++) {
            Object[] point = activityPoints.get(i);
            Double rawSpeed = rawSpeeds.get(i);
            double speedRatio = hasSpeedRange && rawSpeed != null
                    ? toPercentileRatio(normalizedSpeeds, rawSpeed)
                    : 0.5;
            points.add(new HeatPoint(
                    toLong(point[0]),
                    toDouble(point[1]),
                    toDouble(point[2]),
                    1.0,
                    speedRatio
            ));
        }

        return points;
    }

    private Double extractSegmentSpeed(Object[] point, boolean sameActivity, Double previousDistance, Integer previousElapsed) {
        if (point == null || point.length < 5) {
            return null;
        }
        Double pointDistance = extractPointDistance(point);
        Integer pointElapsed = extractPointElapsed(point);

        if (pointDistance == null || pointElapsed == null || pointElapsed <= 0) {
            return null;
        }
        if (!sameActivity || previousDistance == null || previousElapsed == null) {
            return null;
        }

        double distanceDelta = pointDistance - previousDistance;
        int elapsedDelta = pointElapsed - previousElapsed;

        if (distanceDelta <= 0 || elapsedDelta <= 0) {
            return null;
        }

        return distanceDelta / elapsedDelta;
    }

    private Double extractPointDistance(Object[] point) {
        if (point == null || point.length < 4) {
            return null;
        }
        return point[3] instanceof Number number ? number.doubleValue() : null;
    }

    private Integer extractPointElapsed(Object[] point) {
        if (point == null || point.length < 5) {
            return null;
        }
        return point[4] instanceof Number number ? number.intValue() : null;
    }

    private double toPercentileRatio(List<Double> sortedSpeeds, double rawSpeed) {
        if (sortedSpeeds == null || sortedSpeeds.size() <= 1) {
            return 0.5;
        }

        int insertionIndex = Collections.binarySearch(sortedSpeeds, rawSpeed);
        if (insertionIndex < 0) {
            insertionIndex = -insertionIndex - 1;
        } else {
            while (insertionIndex < sortedSpeeds.size() - 1
                    && Double.compare(sortedSpeeds.get(insertionIndex + 1), rawSpeed) == 0) {
                insertionIndex += 1;
            }
        }

        return clamp((double) insertionIndex / (sortedSpeeds.size() - 1), 0.0, 1.0);
    }

    private double toDouble(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0.0;
    }

    private long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private ProfileResponse toProfileResponse(Runner runner) {
        boolean stravaLinked = runner.getStravaAthleteId() != null
                && runner.getStravaRefreshToken() != null
                && !runner.getStravaRefreshToken().isBlank();
        boolean showLanguageSettingsHint = runner.getCreatedAt() != null
                && runner.getCreatedAt().isAfter(LocalDateTime.now().minusHours(24));
        return new ProfileResponse(
                runner.getEmail(),
                runner.getDisplayName(),
                stravaLinked,
                showLanguageSettingsHint
        );
    }

    private ProfilePreferencesResponse toProfilePreferencesResponse(Runner runner) {
        return new ProfilePreferencesResponse(
                runner.getSettingsMantra() == null ? "" : runner.getSettingsMantra(),
                runner.isWeeklyDigestEnabled()
        );
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    public record ProfileResponse(
            String email,
            String displayName,
            boolean stravaLinked,
            boolean showLanguageSettingsHint
    ) {
    }

    public record ProfileDashboardResponse(
            ProfileResponse profile,
            List<Map<String, Object>> activities,
            AutomatedCoachService.CoachStateDto coachState,
            AutomatedCoachService.CoachTodayDto coachToday,
            Object personalRecords,
            List<RaceEventResponse> races,
            Object musclePlan,
            Object quota,
            boolean deferredEnrichment
    ) {
    }

    public record TodayDashboardResponse(
            ProfileResponse profile,
            List<Map<String, Object>> activities,
            AutomatedCoachService.CoachTodayDto coachToday,
            Object weather,
            List<RaceEventResponse> races,
            List<Shoe> shoes
    ) {
    }

    public record UpdateDisplayNameRequest(String displayName) {
    }

    public record ProfilePreferencesRequest(String mantra, Boolean weeklyDigestEnabled) {
    }

    public record ProfilePreferencesResponse(String mantra, boolean weeklyDigestEnabled) {
    }

    public record HeatPoint(long activityId, double latitude, double longitude, double intensity, double speedRatio) {
    }

    public record HeatmapBounds(
            double minLatitude,
            double minLongitude,
            double maxLatitude,
            double maxLongitude
    ) {
    }

    public record HeatmapResponse(
            List<HeatPoint> points,
            long pointCount,
            int sampledPointCount,
            long activityCount,
            HeatmapBounds bounds
    ) {
    }

    public record LinkedActivitySummary(
            Long id,
            String name,
            java.time.LocalDateTime startTime,
            String startDate,
            double distanceKm,
            int movingTimeSeconds
    ) {
    }

    public record RaceEventResponse(
            Long id,
            String name,
            String organization,
            String location,
            java.time.LocalDate eventDate,
            Double distanceKm,
            String registrationStatus,
            Integer goalTimeSeconds,
            String notes,
            boolean nyrrNinePlusOneEligible,
            Long completedActivityId,
            boolean completed,
            long countdownDays,
            LinkedActivitySummary matchedActivity
    ) {
    }
}
