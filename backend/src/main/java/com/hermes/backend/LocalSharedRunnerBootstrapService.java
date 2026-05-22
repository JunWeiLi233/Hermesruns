package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class LocalSharedRunnerBootstrapService {
    public static final String DEFAULT_EMAIL = "strava+140971747@hermes.local";
    public static final long DEFAULT_STRAVA_ATHLETE_ID = 140971747L;
    public static final String TERRITORY_RIVAL_EMAIL = "territory-rival@hermes.local";
    public static final long TERRITORY_RIVAL_STRAVA_ATHLETE_ID = 140971748L;
    private static final String DEFAULT_DISPLAY_NAME = "Hermes Shared Runner";
    private static final String TERRITORY_RIVAL_DISPLAY_NAME = "Hermes Temporal Rival";
    private static final int ACTIVITY_SEED_COUNT = 18;
    private static final int TERRITORY_RIVAL_ACTIVITY_SEED_COUNT = 6;
    private static final int TERRITORY_RIVAL_CONFLICT_START_INDEX = ACTIVITY_SEED_COUNT - TERRITORY_RIVAL_ACTIVITY_SEED_COUNT;
    private static final double TERRITORY_CELL_DEGREES = 0.0065;
    private static final int TERRITORY_RIVAL_MAX_DYNAMIC_CELLS = 5;
    private static final int TERRITORY_RIVAL_MAX_DYNAMIC_SAMPLES_PER_CELL = 180;
    private static final int TERRITORY_RIVAL_MIN_DYNAMIC_SOURCE_SAMPLES = 8;
    private static final int TERRITORY_RIVAL_SOURCE_SAMPLE_WINDOW = 25_000;
    private static final String TERRITORY_RIVAL_LIVE_SEED_MARKER = "local-territory-rival-live-v5-marker";

    private final RunnerRepository runnerRepository;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final AuthService authService;

    public LocalSharedRunnerBootstrapService(
            RunnerRepository runnerRepository,
            ShoeRepository shoeRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            AuthService authService
    ) {
        this.runnerRepository = runnerRepository;
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.authService = authService;
    }

    @Transactional
    public BootstrapResult bootstrap(BootstrapConfig config) {
        if (config == null) {
            throw new IllegalArgumentException("Local shared runner bootstrap config is required.");
        }
        SeedProfile seedProfile = config.effectiveSeedProfile();

        String normalizedEmail = authService.normalizeEmail(config.email());
        if (isBlank(normalizedEmail)) {
            throw new IllegalArgumentException("Local shared runner email is required.");
        }
        if (isBlank(config.password())) {
            throw new IllegalArgumentException("Local shared runner password is required.");
        }

        Runner runner = runnerRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(Runner::new);
        applyRunnerDefaults(runner, normalizedEmail, config);
        authService.storePassword(runner, config.password());
        runner = runnerRepository.save(runner);

        int seededShoes = 0;
        int seededActivities = 0;
        long existingActivityCount = activityRepository.countByRunner(runner);
        if (config.seedMockData() && shouldSeedActivities(runner, seedProfile, existingActivityCount)) {
            ShoeSeedResult shoeSeedResult = ensureShoes(runner);
            seededShoes = shoeSeedResult.seededShoes();
            seededActivities = seedActivities(runner, shoeSeedResult.availableShoes(), seedProfile);
        }

        return new BootstrapResult(
                normalizedEmail,
                config.stravaAthleteId(),
                seededShoes,
                seededActivities
        );
    }

    private boolean shouldSeedActivities(Runner runner, SeedProfile seedProfile, long existingActivityCount) {
        if (existingActivityCount == 0) {
            return true;
        }
        return seedProfile == SeedProfile.TERRITORY_RIVAL
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                runner,
                ImportProvider.STRAVA,
                TERRITORY_RIVAL_LIVE_SEED_MARKER
        );
    }

    private void applyRunnerDefaults(Runner runner, String normalizedEmail, BootstrapConfig config) {
        SeedProfile seedProfile = config.effectiveSeedProfile();
        runner.setEmail(normalizedEmail);
        runner.setDeleted(false);
        runner.setStatus("ACTIVE_STRAVA");
        runner.setRole("USER");
        runner.setEmailVerified(true);
        runner.setDisplayName(defaultIfBlank(config.displayName(), defaultDisplayName(seedProfile)));
        runner.setStravaAthleteId(config.stravaAthleteId());
        runner.setStravaUsername(defaultStravaUsername(seedProfile));
        runner.setMaxHeartRateBpm(seedProfile == SeedProfile.TERRITORY_RIVAL ? 188 : 192);
        runner.setRestingHeartRateBpm(seedProfile == SeedProfile.TERRITORY_RIVAL ? 51 : 48);
        runner.setSubscriptionTier("PRO");
        runner.setAiWelcomeScansRemaining(5);
        runner.setAiExperiencePhase("REGULAR_USER");
        runner.setAiFreeScansRemaining(3);
    }

    private static String defaultDisplayName(SeedProfile seedProfile) {
        return seedProfile == SeedProfile.TERRITORY_RIVAL ? TERRITORY_RIVAL_DISPLAY_NAME : DEFAULT_DISPLAY_NAME;
    }

    private static String defaultStravaUsername(SeedProfile seedProfile) {
        return seedProfile == SeedProfile.TERRITORY_RIVAL
                ? "hermes-temporal-territory-rival"
                : "hermes-local-shared-runner";
    }

    private ShoeSeedResult ensureShoes(Runner runner) {
        List<Shoe> existingShoes = shoeRepository.findByRunnerOrderByCreatedAtDesc(runner);
        if (existingShoes != null && !existingShoes.isEmpty()) {
            return new ShoeSeedResult(existingShoes, 0);
        }

        List<Shoe> seededShoes = new ArrayList<>();
        seededShoes.add(saveShoe(runner, "Nike", "Vaporfly 3", "Race day", "nike|vaporfly-3", 600.0, 72.0, true));
        seededShoes.add(saveShoe(runner, "ASICS", "Superblast 2", "Long run", "asics|superblast-2", 750.0, 140.0, false));
        seededShoes.add(saveShoe(runner, "Saucony", "Endorphin Speed 4", "Workout", "saucony|endorphin-speed-4", 650.0, 96.0, false));
        return new ShoeSeedResult(seededShoes, seededShoes.size());
    }

    private Shoe saveShoe(
            Runner runner,
            String brand,
            String model,
            String nickname,
            String identityKey,
            double maxDistanceKm,
            double initialDistanceKm,
            boolean primary
    ) {
        Shoe shoe = new Shoe();
        shoe.setRunner(runner);
        shoe.setBrand(brand);
        shoe.setModel(model);
        shoe.setNickname(nickname);
        shoe.setIdentityKey(identityKey);
        shoe.setMaxDistanceKm(maxDistanceKm);
        shoe.setInitialDistanceKm(initialDistanceKm);
        shoe.setIsPrimary(primary);
        shoe.setRetired(false);
        shoe.setPhotoVerified(true);
        Shoe saved = shoeRepository.save(shoe);
        return saved != null ? saved : shoe;
    }

    private int seedActivities(Runner runner, List<Shoe> shoes, SeedProfile seedProfile) {
        if (seedProfile == SeedProfile.TERRITORY_RIVAL) {
            return seedTerritoryRivalActivities(runner, shoes);
        }
        return seedSharedRunnerActivities(runner, shoes);
    }

    private int seedSharedRunnerActivities(Runner runner, List<Shoe> shoes) {
        double[] distancesKm = {
                6.2, 8.0, 10.5, 5.0, 12.3, 7.4,
                16.0, 9.2, 21.1, 6.8, 13.4, 18.2,
                5.6, 11.0, 24.0, 8.8, 14.5, 32.0
        };
        String[] names = {
                "Local easy loop", "Harbor tempo", "North bridge progression",
                "Recovery shuffle", "Shared runner steady 12K", "Hill repeat sampler",
                "Long run dress rehearsal", "Track cruise intervals", "Half marathon simulation",
                "Coffee run", "Medium-long aerobic", "Fuel practice long run",
                "Shakeout with strides", "Threshold ladder", "Marathon block long run",
                "Park fartlek", "Shared runner aerobic build", "Peak week long run"
        };

        LocalDate anchorDate = LocalDate.now().minusDays(5);
        int seeded = 0;
        for (int index = 0; index < ACTIVITY_SEED_COUNT; index++) {
            double distanceKm = distancesKm[index];
            int paceSecondsPerKm = 292 + (index % 6) * 12 + (distanceKm >= 18 ? 18 : 0);
            int durationSeconds = (int) Math.round(distanceKm * paceSecondsPerKm);
            LocalDateTime startTime = anchorDate
                    .minusDays((long) (ACTIVITY_SEED_COUNT - index) * 3L)
                    .atTime(6 + (index % 4), 15 + (index % 3) * 10);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName(names[index]);
            activity.setStravaId("local-shared-140971747-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName("local-shared-runner-bootstrap");
            activity.setSourceChecksum("local-shared-140971747-" + (index + 1));
            activity.setAverageHeartRate(136.0 + (index % 5) * 4.0 + (distanceKm >= 18 ? 5.0 : 0.0));
            activity.setMaxHeartRate(168.0 + (index % 4) * 3.0);
            activity.setAverageCadence(170.0 + (index % 7));
            activity.setAverageWatts(218.0 + (index % 6) * 9.0);
            activity.setMaxSpeedMps(5.1 + (index % 5) * 0.15);
            activity.setTotalElevationGain(18.0 + distanceKm * (2.2 + (index % 4) * 0.5));
            activity.setCalories((int) Math.round(distanceKm * 68.0));
            activity.setSufferScore(24 + (int) Math.round(distanceKm * 1.6));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, index));
            addRouteSamples(activity, index, distanceKm, durationSeconds);

            activityRepository.save(activity);
            seeded++;
        }
        return seeded;
    }

    private int seedTerritoryRivalActivities(Runner runner, List<Shoe> shoes) {
        List<TerritoryConflictSeedCell> liveConflictCells = findLiveSharedRunnerConflictCells();
        if (!liveConflictCells.isEmpty()) {
            return seedTerritoryRivalActivitiesFromLiveCells(runner, shoes, liveConflictCells);
        }
        return seedStaticTerritoryRivalActivities(runner, shoes);
    }

    private int seedStaticTerritoryRivalActivities(Runner runner, List<Shoe> shoes) {
        double[] distancesKm = {5.4, 6.1, 7.0, 5.8, 8.2, 6.6};
        String[] names = {
                "Territory rival conflict sweep",
                "Territory rival grid pressure",
                "Territory rival park takeover",
                "Territory rival contested loop",
                "Territory rival re-capture run",
                "Territory rival boundary check"
        };

        LocalDate anchorDate = LocalDate.now().minusDays(1);
        int seeded = 0;
        for (int index = 0; index < TERRITORY_RIVAL_ACTIVITY_SEED_COUNT; index++) {
            double distanceKm = distancesKm[index];
            int paceSecondsPerKm = 300 + (index % 3) * 8;
            int durationSeconds = (int) Math.round(distanceKm * paceSecondsPerKm);
            LocalDateTime startTime = anchorDate
                    .minusDays((long) (TERRITORY_RIVAL_ACTIVITY_SEED_COUNT - index) * 2L)
                    .atTime(5 + (index % 3), 35 + (index % 2) * 10);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName(names[index]);
            activity.setStravaId("local-territory-rival-140971748-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName("local-territory-rival-bootstrap");
            activity.setSourceChecksum("local-territory-rival-140971748-" + (index + 1));
            activity.setAverageHeartRate(132.0 + (index % 4) * 5.0);
            activity.setMaxHeartRate(166.0 + (index % 3) * 4.0);
            activity.setAverageCadence(168.0 + (index % 5));
            activity.setAverageWatts(205.0 + (index % 4) * 11.0);
            activity.setMaxSpeedMps(4.9 + (index % 4) * 0.12);
            activity.setTotalElevationGain(14.0 + distanceKm * (1.8 + (index % 3) * 0.45));
            activity.setCalories((int) Math.round(distanceKm * 65.0));
            activity.setSufferScore(20 + (int) Math.round(distanceKm * 1.4));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, index));

            int contestedSharedActivityIndex = TERRITORY_RIVAL_CONFLICT_START_INDEX + index;
            addRouteSamples(activity, contestedSharedActivityIndex, distanceKm, durationSeconds, 32);

            activityRepository.save(activity);
            seeded++;
        }
        return seeded;
    }

    private int seedTerritoryRivalActivitiesFromLiveCells(
            Runner runner,
            List<Shoe> shoes,
            List<TerritoryConflictSeedCell> conflictCells
    ) {
        LocalDateTime anchorTime = LocalDateTime.now().minusMinutes(15);
        int seeded = 0;
        for (int index = 0; index < conflictCells.size(); index++) {
            TerritoryConflictSeedCell cell = conflictCells.get(index);
            int sampleCount = dynamicRivalSampleCount(cell.sourceSampleCount());
            double distanceKm = Math.max(1.2, sampleCount * 0.018);
            int durationSeconds = Math.max(900, sampleCount * 7);
            LocalDateTime startTime = anchorTime.minusMinutes((long) (conflictCells.size() - index) * 8L);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName("Territory rival live conflict " + (index + 1));
            activity.setStravaId("local-territory-rival-live-v5-140971748-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName("local-territory-rival-live-conflict-bootstrap");
            activity.setSourceChecksum(index == 0
                    ? TERRITORY_RIVAL_LIVE_SEED_MARKER
                    : "local-territory-rival-live-v5-" + (index + 1) + "-" + cell.key());
            activity.setAverageHeartRate(132.0 + (index % 4) * 5.0);
            activity.setMaxHeartRate(166.0 + (index % 3) * 4.0);
            activity.setAverageCadence(168.0 + (index % 5));
            activity.setAverageWatts(205.0 + (index % 4) * 11.0);
            activity.setMaxSpeedMps(4.9 + (index % 4) * 0.12);
            activity.setTotalElevationGain(12.0 + distanceKm * 1.7);
            activity.setCalories((int) Math.round(distanceKm * 65.0));
            activity.setSufferScore(18 + (int) Math.round(distanceKm * 1.2));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, index));
            addTerritoryCellPressureSamples(activity, cell, distanceKm, durationSeconds, sampleCount);

            activityRepository.save(activity);
            seeded++;
        }
        return seeded;
    }

    private List<TerritoryConflictSeedCell> findLiveSharedRunnerConflictCells() {
        Optional<Runner> sharedRunner = runnerRepository.findByEmailIgnoreCase(DEFAULT_EMAIL);
        if (sharedRunner.isEmpty() || activityPointRepository == null) {
            return List.of();
        }
        List<Object[]> rows = activityPointRepository.findTerritorySeedCellsByRunner(
                sharedRunner.get().getId(),
                ActivityType.RUN.name(),
                TERRITORY_CELL_DEGREES,
                TERRITORY_RIVAL_MIN_DYNAMIC_SOURCE_SAMPLES,
                TERRITORY_RIVAL_SOURCE_SAMPLE_WINDOW,
                TERRITORY_RIVAL_MAX_DYNAMIC_CELLS
        );
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }

        List<TerritoryConflictSeedCell> cells = new ArrayList<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 5) {
                continue;
            }
            double latCell = doubleAt(row, 0);
            double lngCell = doubleAt(row, 1);
            double centerLat = latCell * TERRITORY_CELL_DEGREES + TERRITORY_CELL_DEGREES / 2.0;
            double centerLng = lngCell * TERRITORY_CELL_DEGREES + TERRITORY_CELL_DEGREES / 2.0;
            int sampleCount = intAt(row, 4);
            if (!isValidCoordinate(centerLat, centerLng) || sampleCount < TERRITORY_RIVAL_MIN_DYNAMIC_SOURCE_SAMPLES) {
                continue;
            }
            cells.add(new TerritoryConflictSeedCell(
                    row[0] + ":" + row[1],
                    territoryCellCenterLat(centerLat),
                    territoryCellCenterLng(centerLng),
                    sampleCount
            ));
        }
        return cells;
    }

    private static int dynamicRivalSampleCount(int sourceSampleCount) {
        return Math.min(
                TERRITORY_RIVAL_MAX_DYNAMIC_SAMPLES_PER_CELL,
                Math.max(sourceSampleCount + 8, 24)
        );
    }

    private static void addTerritoryCellPressureSamples(
            Activity activity,
            TerritoryConflictSeedCell cell,
            double distanceKm,
            int durationSeconds,
            int samples
    ) {
        double latRadius = TERRITORY_CELL_DEGREES * 0.18;
        double lngRadius = TERRITORY_CELL_DEGREES * 0.18;
        for (int sample = 0; sample < samples; sample++) {
            double progress = samples <= 1 ? 0.0 : sample / (double) (samples - 1);
            double angle = progress * Math.PI * 2.0 * 3.0;
            ActivityPoint point = new ActivityPoint();
            point.setSequenceIndex(sample);
            point.setLatitude(cell.centerLat() + Math.sin(angle) * latRadius);
            point.setLongitude(cell.centerLng() + Math.cos(angle) * lngRadius);
            point.setElapsedSeconds((int) Math.round(durationSeconds * progress));
            point.setDistanceMeters(distanceKm * 1000.0 * progress);
            double elevation = 10.0 + Math.sin(angle * 0.5) * 3.0;
            point.setElevationMeters(elevation);
            point.setElevationRawMeters(elevation);
            point.setHeartRate(130 + sample % 12);
            point.setCadence(166 + sample % 8);
            activity.addPoint(point);
        }
    }

    private Shoe selectShoe(List<Shoe> shoes, int index) {
        if (shoes == null || shoes.isEmpty()) {
            return null;
        }
        return shoes.get(index % shoes.size());
    }

    private void addRouteSamples(Activity activity, int activityIndex, double distanceKm, int durationSeconds) {
        addRouteSamples(activity, activityIndex, distanceKm, durationSeconds, 14);
    }

    private void addRouteSamples(Activity activity, int activityIndex, double distanceKm, int durationSeconds, int samples) {
        for (int sample = 0; sample < samples; sample++) {
            double progress = sample / (double) (samples - 1);
            ActivityPoint point = new ActivityPoint();
            point.setSequenceIndex(sample);
            point.setLatitude(sharedRouteLatitude(activityIndex, sample, samples));
            point.setLongitude(sharedRouteLongitude(activityIndex, sample, samples));
            point.setElapsedSeconds((int) Math.round(durationSeconds * progress));
            point.setDistanceMeters(distanceKm * 1000.0 * progress);
            double routePhase = activityIndex * 0.37;
            double elevation = 12.0 + Math.sin(progress * Math.PI * 3.0 + routePhase) * 5.0 + activityIndex % 6;
            point.setElevationMeters(elevation);
            point.setElevationRawMeters(elevation);
            point.setHeartRate(128 + activityIndex % 7 + sample % 9);
            point.setCadence(164 + activityIndex % 8 + sample % 6);
            activity.addPoint(point);
        }
    }

    private static double sharedRouteLatitude(int activityIndex, int sample, int samples) {
        double progress = sample / (double) (samples - 1);
        double routePhase = activityIndex * 0.37;
        double baseLatitude = 42.3520 + (activityIndex % 4) * 0.003;
        return baseLatitude + Math.sin(progress * Math.PI * 2.0 + routePhase) * 0.008 + progress * 0.011;
    }

    private static double sharedRouteLongitude(int activityIndex, int sample, int samples) {
        double progress = sample / (double) (samples - 1);
        double routePhase = activityIndex * 0.37;
        double baseLongitude = -71.0720 + (activityIndex % 5) * 0.004;
        return baseLongitude + Math.cos(progress * Math.PI * 2.0 + routePhase) * 0.010 + progress * 0.006;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String defaultIfBlank(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim();
    }

    private static boolean isValidCoordinate(double latitude, double longitude) {
        return Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && latitude >= -90.0
                && latitude <= 90.0
                && longitude >= -180.0
                && longitude <= 180.0;
    }

    private static double territoryCellCenterLat(double latitude) {
        return Math.floor(latitude / TERRITORY_CELL_DEGREES) * TERRITORY_CELL_DEGREES + TERRITORY_CELL_DEGREES / 2.0;
    }

    private static double territoryCellCenterLng(double longitude) {
        return Math.floor(longitude / TERRITORY_CELL_DEGREES) * TERRITORY_CELL_DEGREES + TERRITORY_CELL_DEGREES / 2.0;
    }

    private static double doubleAt(Object[] row, int index) {
        if (row.length <= index || row[index] == null) {
            return 0.0;
        }
        Object value = row[index];
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        return Double.parseDouble(value.toString());
    }

    private static int intAt(Object[] row, int index) {
        if (row.length <= index || row[index] == null) {
            return 0;
        }
        Object value = row[index];
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(value.toString());
    }

    public record BootstrapConfig(
            String email,
            String password,
            Long stravaAthleteId,
            String displayName,
            boolean seedMockData,
            SeedProfile seedProfile
    ) {
        public BootstrapConfig(
                String email,
                String password,
                Long stravaAthleteId,
                String displayName,
                boolean seedMockData
        ) {
            this(email, password, stravaAthleteId, displayName, seedMockData, SeedProfile.SHARED_RUNNER);
        }

        public static BootstrapConfig localDefault(String password) {
            return new BootstrapConfig(
                    DEFAULT_EMAIL,
                    password,
                    DEFAULT_STRAVA_ATHLETE_ID,
                    DEFAULT_DISPLAY_NAME,
                    true,
                    SeedProfile.SHARED_RUNNER
            );
        }

        public static BootstrapConfig territoryRivalDefault(String password) {
            return new BootstrapConfig(
                    TERRITORY_RIVAL_EMAIL,
                    password,
                    TERRITORY_RIVAL_STRAVA_ATHLETE_ID,
                    TERRITORY_RIVAL_DISPLAY_NAME,
                    true,
                    SeedProfile.TERRITORY_RIVAL
            );
        }

        SeedProfile effectiveSeedProfile() {
            return seedProfile == null ? SeedProfile.SHARED_RUNNER : seedProfile;
        }
    }

    public record BootstrapResult(
            String email,
            Long stravaAthleteId,
            int seededShoes,
            int seededActivities
    ) {
    }

    private record ShoeSeedResult(List<Shoe> availableShoes, int seededShoes) {
    }

    private record TerritoryConflictSeedCell(String key, double centerLat, double centerLng, int sourceSampleCount) {
    }

    public enum SeedProfile {
        SHARED_RUNNER,
        TERRITORY_RIVAL
    }
}
