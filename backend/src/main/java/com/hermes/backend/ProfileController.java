package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonValue;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;

@RestController
@RequestMapping("/api")
public class ProfileController {
    private static final Duration HEATMAP_CACHE_TTL = Duration.ofMinutes(5);
    private static final int DEFAULT_HEATMAP_PAGE_LIMIT = 50000;
    private static final int DEFAULT_HEATMAP_COVERAGE_LIMIT = 60000;
    private static final int MAX_HEATMAP_PAGE_LIMIT = 100000;
    private static final int MAX_SETTINGS_MANTRA_LENGTH = 180;
    private static final int PROFILE_DASHBOARD_INITIAL_RUN_LIMIT = 180;
    private static final long MAX_PROFILE_AVATAR_UPLOAD_BYTES = 3L * 1024 * 1024;
    private static final int MAX_PROFILE_AVATAR_SOURCE_DIMENSION = 4096;
    private static final long MAX_PROFILE_AVATAR_SOURCE_PIXELS = 16_000_000L;
    private static final int PROFILE_AVATAR_RENDER_DIMENSION = 512;
    private static final Set<String> PROFILE_AVATAR_CONTENT_TYPES = Set.of("image/jpeg", "image/jpg", "image/png");

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

    @PutMapping(value = "/profile/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateAvatar(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        final byte[] normalizedImage;
        try {
            normalizedImage = normalizeAvatarImage(image);
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, ex.getMessage());
        } catch (IOException ex) {
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "Could not process profile image. Please try again.");
        }

        Runner runner = runnerOptional.get();
        runner.setAvatarImage(normalizedImage);
        runnerRepository.save(runner);
        return ResponseEntity.ok(toProfileResponse(runner));
    }

    @DeleteMapping("/profile/me/avatar")
    public ResponseEntity<?> deleteAvatar(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        runner.setAvatarImage(null);
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
        // Keep first paint bounded to the data the Profile route needs to
        // render. Coach, PR, race, muscle, and quota widgets lazy-load behind
        // deferredEnrichment so intermittent slow dependencies do not hold the
        // whole dashboard response open.
        List<ActivityRepository.AnalysisActivitySummaryProjection> activitySummaries = findRunnerRunSummaries(runner);

        return ResponseEntity.ok(new ProfileDashboardResponse(
                toProfileResponse(runner),
                toRunSummaryFeedItems(activitySummaries),
                null,
                null,
                null,
                List.of(),
                null,
                Map.of(),
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
        List<ActivityRepository.AnalysisActivitySummaryProjection> activitySummaries = findRunnerRunSummaries(runner);
        return ResponseEntity.ok(new TodayDashboardResponse(
                toProfileResponse(runner),
                toRunSummaryFeedItems(activitySummaries),
                safeValue(() -> automatedCoachService.getTodayWithReadiness(runner), null),
                safeValue(() -> acclimatizationService.buildContext(runner), null),
                safeValue(() -> findRunnerRaces(runner), List.of()),
                safeValue(() -> findRunnerShoes(runner), List.of())
        ));
    }
    public ResponseEntity<?> heatmap(String authorizationHeader) {
        return heatmap(authorizationHeader, null, null, null);
    }

    public ResponseEntity<?> heatmap(String authorizationHeader, Long offset, Integer limit) {
        return heatmap(authorizationHeader, offset, limit, null);
    }

    @GetMapping("/profile/heatmap")
    public ResponseEntity<?> heatmap(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "offset", required = false) Long offset,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "coverage", required = false) Boolean coverage
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        if (activityRepository.existsByRunnerAndActivityTypeIsNull(runner)) {
            activityNormalizationService.backfillActivityTypes(runner);
        }

        String heatmapCacheKey = HeatmapCacheKey.forRunner(runner.getId());

        long activityCount = activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN);
        if (activityCount <= 0) {
            HeatmapResponse response = new HeatmapResponse(List.of(), 0, 0, 0, null, new HeatmapDiagnostics(0, 0, 0, true), null);
            cacheStore.put(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, response, HEATMAP_CACHE_TTL);
            return ResponseEntity.ok(response);
        }

        long sourcePointCount = activityPointRepository.countHeatmapPointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        );
        if (sourcePointCount <= 0) {
            HeatmapResponse response = new HeatmapResponse(List.of(), 0, 0, activityCount, null, new HeatmapDiagnostics(0, 0, 0, true), null);
            cacheStore.put(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, response, HEATMAP_CACHE_TTL);
            return ResponseEntity.ok(response);
        }

        HeatmapBounds bounds = buildBoundsFromAggregateRows(activityPointRepository.findHeatmapBoundsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        ));

        if (Boolean.TRUE.equals(coverage)) {
            int safeLimit = Math.max(1, Math.min(MAX_HEATMAP_PAGE_LIMIT, limit == null ? DEFAULT_HEATMAP_COVERAGE_LIMIT : limit));
            int stride = Math.max(1, (int) Math.ceil(sourcePointCount * 1.0 / safeLimit));
            List<Object[]> activityPoints = activityPointRepository.findHeatmapCoveragePointsByRunnerAndType(
                    runner.getId(),
                    ActivityType.RUN.name(),
                    stride,
                    safeLimit
            );
            List<Object[]> validActivityPoints = filterValidHeatmapRows(activityPoints);
            List<HeatPoint> points = buildHeatPoints(validActivityPoints);
            HeatmapResponse response = new HeatmapResponse(
                    points,
                    sourcePointCount,
                    points.size(),
                    activityCount,
                    bounds,
                    new HeatmapDiagnostics(sourcePointCount, activityPoints.size(), points.size(), points.size() >= sourcePointCount),
                    new HeatmapPage(0L, safeLimit, points.size(), points.size() < sourcePointCount)
            );
            return ResponseEntity.ok(response);
        }

        if (offset != null || limit != null) {
            long safeOffset = Math.max(0L, offset == null ? 0L : offset);
            int safeLimit = Math.max(1, Math.min(MAX_HEATMAP_PAGE_LIMIT, limit == null ? DEFAULT_HEATMAP_PAGE_LIMIT : limit));
            List<Object[]> activityPoints = activityPointRepository.findHeatmapPointsPageByRunnerAndType(
                    runner.getId(),
                    ActivityType.RUN.name(),
                    safeLimit,
                    safeOffset
            );
            List<Object[]> validActivityPoints = filterValidHeatmapRows(activityPoints);
            List<HeatPoint> points = buildHeatPoints(validActivityPoints);
            HeatmapResponse response = new HeatmapResponse(
                    points,
                    sourcePointCount,
                    points.size(),
                    activityCount,
                    bounds,
                    new HeatmapDiagnostics(sourcePointCount, activityPoints.size(), points.size(), safeOffset + points.size() >= sourcePointCount),
                    new HeatmapPage(safeOffset, safeLimit, points.size(), safeOffset + points.size() < sourcePointCount)
            );
            return ResponseEntity.ok(response);
        }

        HeatmapResponse cached = cacheStore.get(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, HeatmapResponse.class).orElse(null);
        if (isCompleteHeatmapResponse(cached, sourcePointCount)) {
            return ResponseEntity.ok(cached);
        }
        if (cached != null) {
            cacheStore.evict(HeatmapCacheKey.NAMESPACE, heatmapCacheKey);
        }

        List<Object[]> activityPoints = activityPointRepository.findAllHeatmapPointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        );
        List<Object[]> validActivityPoints = filterValidHeatmapRows(activityPoints);
        List<HeatPoint> points = buildHeatPoints(validActivityPoints);

        HeatmapResponse response = new HeatmapResponse(
                points,
                sourcePointCount,
                points.size(),
                activityCount,
                bounds,
                new HeatmapDiagnostics(sourcePointCount, activityPoints.size(), points.size(), points.size() == sourcePointCount),
                null
        );
        if (isCompleteHeatmapResponse(response, sourcePointCount)) {
            cacheStore.put(HeatmapCacheKey.NAMESPACE, heatmapCacheKey, response, HEATMAP_CACHE_TTL);
        } else {
            cacheStore.evict(HeatmapCacheKey.NAMESPACE, heatmapCacheKey);
        }
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

    private List<ActivityRepository.AnalysisActivitySummaryProjection> findRunnerRunSummaries(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        return safeValue(
                () -> activityRepository.findAnalysisSummariesByRunnerAndActivityType(
                        runner,
                        ActivityType.RUN,
                        PageRequest.of(0, PROFILE_DASHBOARD_INITIAL_RUN_LIMIT)
                ),
                List.of()
        );
    }

    private List<Map<String, Object>> toRunSummaryFeedItems(
            List<ActivityRepository.AnalysisActivitySummaryProjection> activities
    ) {
        if (activities == null || activities.isEmpty()) {
            return List.of();
        }
        return activities.stream().map(this::toRunSummaryFeedItem).toList();
    }

    private Map<String, Object> toRunSummaryFeedItem(ActivityRepository.AnalysisActivitySummaryProjection activity) {
        Map<String, Object> body = new HashMap<>();
        body.put("id", activity.getId());
        body.put("name", activity.getName());
        body.put("distanceKm", activity.getDistanceKm());
        body.put("movingTimeSeconds", activity.getMovingTimeSeconds());
        body.put("startDate", activity.getStartDate());
        body.put("startTime", activity.getStartTime());
        body.put("distanceMeters", activity.getDistanceMeters());
        body.put("durationSeconds", activity.getDurationSeconds());
        body.put("averageHeartRate", activity.getAverageHeartRate());
        body.put("maxHeartRate", activity.getMaxHeartRate());
        body.put("totalElevationGain", activity.getTotalElevationGain());
        body.put("averageCadence", activity.getAverageCadence());
        body.put("maxSpeedMps", activity.getMaxSpeedMps());
        body.put("pacePenaltySecPerKm", activity.getPacePenaltySecPerKm());
        body.put("weatherAdjusted", activity.getWeatherAdjusted());
        body.put("shoeId", activity.getShoeId());
        body.put("shoeName", formatShoeName(activity.getShoeBrand(), activity.getShoeModel(), activity.getShoeNickname()));
        return body;
    }

    private String formatShoeName(String brand, String model, String nickname) {
        String safeBrand = brand == null ? "" : brand;
        String safeModel = model == null ? "" : model;
        String combined = (safeBrand + " " + safeModel).trim();
        return combined.isEmpty() ? nickname : combined;
    }

    private List<RaceEventResponse> findRunnerRaces(Runner runner) {
        if (runner == null) {
            return List.of();
        }
        List<RaceEvent> races = raceEventRepository.findByRunnerOrderByEventDateAsc(runner);
        if (races == null || races.isEmpty()) {
            return List.of();
        }
        List<Activity> activities = findRunnerRuns(runner);
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

    private HeatmapBounds buildBoundsFromAggregateRows(List<Object[]> boundsRows) {
        if (boundsRows == null || boundsRows.isEmpty()) {
            return null;
        }
        return buildBoundsFromSamples(boundsRows.get(0));
    }
    private HeatmapBounds buildBoundsFromSamples(Object[] boundsRow) {
        if (boundsRow == null || boundsRow.length < 4) {
            return null;
        }
        Double minLatitude = toNullableDouble(boundsRow[0]);
        Double minLongitude = toNullableDouble(boundsRow[1]);
        Double maxLatitude = toNullableDouble(boundsRow[2]);
        Double maxLongitude = toNullableDouble(boundsRow[3]);
        if (!isValidGpsCoordinate(minLatitude, minLongitude) || !isValidGpsCoordinate(maxLatitude, maxLongitude)) {
            return null;
        }
        return new HeatmapBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);
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
            Double lat = toNullableDouble(point[1]);
            Double lng = toNullableDouble(point[2]);
            if (!isValidGpsCoordinate(lat, lng)) {
                continue;
            }
            minLatitude = Math.min(minLatitude, lat);
            maxLatitude = Math.max(maxLatitude, lat);
            minLongitude = Math.min(minLongitude, lng);
            maxLongitude = Math.max(maxLongitude, lng);
        }

        if (minLatitude == Double.MAX_VALUE) {
            return null;
        }

        return new HeatmapBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);
    }

    private boolean isCompleteHeatmapResponse(HeatmapResponse response, long sourcePointCount) {
        if (response == null || response.pointCount() != sourcePointCount || response.sampledPointCount() != sourcePointCount) {
            return false;
        }
        return response.points() != null && response.points().size() == sourcePointCount;
    }

    private List<Object[]> filterValidHeatmapRows(List<Object[]> activityPoints) {
        if (activityPoints.isEmpty()) {
            return List.of();
        }

        List<Object[]> validRows = new ArrayList<>(activityPoints.size());
        for (Object[] point : activityPoints) {
            if (point == null || point.length < 3) {
                continue;
            }
            if (isValidGpsCoordinate(toNullableDouble(point[1]), toNullableDouble(point[2]))) {
                validRows.add(point);
            }
        }
        return validRows;
    }

    private boolean isValidGpsCoordinate(Double latitude, Double longitude) {
        return latitude != null
                && longitude != null
                && Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && latitude >= -90.0
                && latitude <= 90.0
                && longitude >= -180.0
                && longitude <= 180.0;
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
                    toNullableDouble(point[1]),
                    toNullableDouble(point[2]),
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

    private Double toNullableDouble(Object value) {
        if (value instanceof Number number) {
            double parsed = number.doubleValue();
            return Double.isFinite(parsed) ? parsed : null;
        }
        if (value instanceof String text) {
            try {
                double parsed = Double.parseDouble(text);
                return Double.isFinite(parsed) ? parsed : null;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
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
                avatarDataUrl(runner),
                stravaLinked,
                showLanguageSettingsHint
        );
    }

    private byte[] normalizeAvatarImage(MultipartFile image) throws IOException {
        if (image == null || image.isEmpty() || image.getSize() <= 0) {
            throw new IllegalArgumentException("Profile image is required.");
        }
        if (image.getSize() > MAX_PROFILE_AVATAR_UPLOAD_BYTES) {
            throw new IllegalArgumentException("Profile image must be 3 MB or smaller.");
        }
        String contentType = image.getContentType();
        if (contentType == null || !PROFILE_AVATAR_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Upload a PNG or JPEG profile image.");
        }

        byte[] sourceBytes = image.getBytes();
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(sourceBytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("Upload a valid PNG or JPEG profile image.");
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int sourceWidth = reader.getWidth(0);
                int sourceHeight = reader.getHeight(0);
                if (sourceWidth <= 0 || sourceHeight <= 0
                        || sourceWidth > MAX_PROFILE_AVATAR_SOURCE_DIMENSION
                        || sourceHeight > MAX_PROFILE_AVATAR_SOURCE_DIMENSION
                        || (long) sourceWidth * sourceHeight > MAX_PROFILE_AVATAR_SOURCE_PIXELS) {
                    throw new IllegalArgumentException("Profile image dimensions are too large.");
                }

                BufferedImage source = reader.read(0);
                if (source == null) {
                    throw new IllegalArgumentException("Upload a valid PNG or JPEG profile image.");
                }

                double scale = Math.min(1d, PROFILE_AVATAR_RENDER_DIMENSION / (double) Math.max(sourceWidth, sourceHeight));
                int targetWidth = Math.max(1, (int) Math.round(sourceWidth * scale));
                int targetHeight = Math.max(1, (int) Math.round(sourceHeight * scale));
                BufferedImage normalized = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_ARGB);
                Graphics2D graphics = normalized.createGraphics();
                try {
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                    graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                    graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
                } finally {
                    graphics.dispose();
                }

                ByteArrayOutputStream output = new ByteArrayOutputStream();
                if (!ImageIO.write(normalized, "png", output)) {
                    throw new IOException("PNG writer unavailable");
                }
                return output.toByteArray();
            } finally {
                reader.dispose();
            }
        }
    }

    private String avatarDataUrl(Runner runner) {
        byte[] avatarImage = runner.getAvatarImage();
        if (avatarImage == null || avatarImage.length == 0) {
            return null;
        }
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(avatarImage);
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
            String avatarUrl,
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
        @JsonValue
        public Object[] toJson() {
            return new Object[]{activityId, latitude, longitude, speedRatio};
        }
    }

    public record HeatmapBounds(
            double minLatitude,
            double minLongitude,
            double maxLatitude,
            double maxLongitude
    ) {
    }

    public record HeatmapDiagnostics(
            long sourceGpsPointCount,
            int queriedGpsPointCount,
            int returnedGpsPointCount,
            boolean complete
    ) {
    }
    public record HeatmapPage(
            long offset,
            int limit,
            int returnedPointCount,
            boolean hasMore
    ) {
    }

    public record HeatmapResponse(
            List<HeatPoint> points,
            long pointCount,
            int sampledPointCount,
            long activityCount,
            HeatmapBounds bounds,
            HeatmapDiagnostics diagnostics,
            HeatmapPage page
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
