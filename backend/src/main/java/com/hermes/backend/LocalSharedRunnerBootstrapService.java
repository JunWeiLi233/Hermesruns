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
    public static final String FLUSHING_TERRITORY_EMAIL = "territory-flushing@hermes.local";
    public static final long FLUSHING_TERRITORY_STRAVA_ATHLETE_ID = 140971749L;
    public static final String INNER_FLUSHING_TERRITORY_EMAIL = "territory-flushing-inner@hermes.local";
    public static final long INNER_FLUSHING_TERRITORY_STRAVA_ATHLETE_ID = 140971750L;
    public static final String BERLIN_TERRITORY_EMAIL = "territory-berlin@hermes.local";
    public static final long BERLIN_TERRITORY_STRAVA_ATHLETE_ID = 140971751L;
    public static final String BERLIN_RIVAL_BLUE_EMAIL = "territory-berlin-blue@hermes.local";
    public static final long BERLIN_RIVAL_BLUE_STRAVA_ATHLETE_ID = 140971752L;
    public static final String BERLIN_RIVAL_GREEN_EMAIL = "territory-berlin-green@hermes.local";
    public static final long BERLIN_RIVAL_GREEN_STRAVA_ATHLETE_ID = 140971753L;
    public static final String BERLIN_RIVAL_GOLD_EMAIL = "territory-berlin-gold@hermes.local";
    public static final long BERLIN_RIVAL_GOLD_STRAVA_ATHLETE_ID = 140971754L;
    public static final String BERLIN_RIVAL_PINK_EMAIL = "territory-berlin-pink@hermes.local";
    public static final long BERLIN_RIVAL_PINK_STRAVA_ATHLETE_ID = 140971755L;
    public static final String BERLIN_RIVAL_LIME_EMAIL = "territory-berlin-lime@hermes.local";
    public static final long BERLIN_RIVAL_LIME_STRAVA_ATHLETE_ID = 140971756L;
    public static final String BERLIN_RIVAL_CYAN_EMAIL = "territory-berlin-cyan@hermes.local";
    public static final long BERLIN_RIVAL_CYAN_STRAVA_ATHLETE_ID = 140971757L;
    private static final String DEFAULT_DISPLAY_NAME = "Hermes Shared Runner";
    private static final String TERRITORY_RIVAL_DISPLAY_NAME = "Hermes Temporal Rival";
    private static final String FLUSHING_TERRITORY_DISPLAY_NAME = "Hermes Flushing Territory Tester";
    private static final String INNER_FLUSHING_TERRITORY_DISPLAY_NAME = "Hermes Inner Flushing Occupier";
    private static final String BERLIN_TERRITORY_DISPLAY_NAME = "Hermes Berlin Land Conqueror";
    private static final String BERLIN_RIVAL_BLUE_DISPLAY_NAME = "Hermes Berlin Blue Rival";
    private static final String BERLIN_RIVAL_GREEN_DISPLAY_NAME = "Hermes Berlin Green Rival";
    private static final String BERLIN_RIVAL_GOLD_DISPLAY_NAME = "Hermes Berlin Gold Rival";
    private static final String BERLIN_RIVAL_PINK_DISPLAY_NAME = "Hermes Berlin Pink Rival";
    private static final String BERLIN_RIVAL_LIME_DISPLAY_NAME = "Hermes Berlin Lime Rival";
    private static final String BERLIN_RIVAL_CYAN_DISPLAY_NAME = "Hermes Berlin Cyan Rival";
    private static final int ACTIVITY_SEED_COUNT = 18;
    private static final int TERRITORY_RIVAL_ACTIVITY_SEED_COUNT = 6;
    private static final int FLUSHING_TERRITORY_ACTIVITY_SEED_COUNT = 3;
    private static final int INNER_FLUSHING_TERRITORY_ACTIVITY_SEED_COUNT = 2;
    private static final int BERLIN_TERRITORY_ACTIVITY_SEED_COUNT = 3;
    private static final int TERRITORY_RIVAL_CONFLICT_START_INDEX = ACTIVITY_SEED_COUNT - TERRITORY_RIVAL_ACTIVITY_SEED_COUNT;
    private static final double TERRITORY_CELL_DEGREES = 0.0065;
    private static final int TERRITORY_RIVAL_MAX_DYNAMIC_CELLS = 5;
    private static final int TERRITORY_RIVAL_MAX_DYNAMIC_SAMPLES_PER_CELL = 180;
    private static final int TERRITORY_RIVAL_MIN_DYNAMIC_SOURCE_SAMPLES = 8;
    private static final int TERRITORY_RIVAL_SOURCE_SAMPLE_WINDOW = 25_000;
    private static final String TERRITORY_RIVAL_LIVE_SEED_MARKER = "local-territory-rival-live-v5-marker";
    private static final String FLUSHING_TERRITORY_SOURCE_FILE = "local-flushing-territory-bootstrap";
    private static final String FLUSHING_TERRITORY_SEED_PREFIX = "local-flushing-territory-loop-";
    private static final String FLUSHING_TERRITORY_SEED_VERSION = "local-flushing-territory-loop-v2";
    private static final String INNER_FLUSHING_TERRITORY_SOURCE_FILE = "local-inner-flushing-territory-bootstrap";
    private static final String INNER_FLUSHING_TERRITORY_SEED_VERSION = "local-inner-flushing-territory-loop-v1";
    private static final String BERLIN_TERRITORY_SOURCE_FILE = "local-berlin-territory-bootstrap";
    private static final String BERLIN_TERRITORY_SEED_PREFIX = "local-berlin-territory-loop-";
    private static final String BERLIN_TERRITORY_SEED_VERSION = "local-berlin-territory-loop-v5";
    private static final String BERLIN_RIVAL_SOURCE_FILE = "local-berlin-rival-territory-bootstrap";
    private static final String BERLIN_RIVAL_SEED_PREFIX = "local-berlin-rival-loop-";
    private static final String BERLIN_RIVAL_SEED_VERSION = "local-berlin-rival-loop-v5";

    private final RunnerRepository runnerRepository;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final TerritoryPolygonRepository territoryPolygonRepository;
    private final TerritoryPolygonComputer territoryPolygonComputer;
    private final AuthService authService;

    public LocalSharedRunnerBootstrapService(
            RunnerRepository runnerRepository,
            ShoeRepository shoeRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            TerritoryPolygonRepository territoryPolygonRepository,
            TerritoryPolygonComputer territoryPolygonComputer,
            AuthService authService
    ) {
        this.runnerRepository = runnerRepository;
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.territoryPolygonRepository = territoryPolygonRepository;
        this.territoryPolygonComputer = territoryPolygonComputer;
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
        if (config.seedMockData() && seedProfile == SeedProfile.FLUSHING_TERRITORY) {
            existingActivityCount = repairOldFlushingTerritorySeedIfNeeded(runner, existingActivityCount);
        }
        if (config.seedMockData() && seedProfile == SeedProfile.BERLIN_TERRITORY) {
            existingActivityCount = repairOldBerlinTerritorySeedIfNeeded(runner, existingActivityCount);
        }
        if (config.seedMockData() && isBerlinRival(seedProfile)) {
            existingActivityCount = repairOldBerlinRivalSeedIfNeeded(runner, existingActivityCount, seedProfile);
        }
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
        return (seedProfile == SeedProfile.TERRITORY_RIVAL
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        TERRITORY_RIVAL_LIVE_SEED_MARKER
                ))
                || (seedProfile == SeedProfile.FLUSHING_TERRITORY
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        FLUSHING_TERRITORY_SEED_VERSION + "-1"
                ))
                || (seedProfile == SeedProfile.INNER_FLUSHING_TERRITORY
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        INNER_FLUSHING_TERRITORY_SEED_VERSION + "-1"
                ))
                || (seedProfile == SeedProfile.BERLIN_TERRITORY
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        BERLIN_TERRITORY_SEED_VERSION + "-1"
                ))
                || (isBerlinRival(seedProfile)
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        BERLIN_RIVAL_SEED_VERSION + "-" + berlinRivalIndex(seedProfile) + "-1"
                ));
    }

    private long repairOldFlushingTerritorySeedIfNeeded(Runner runner, long existingActivityCount) {
        if (runner == null || existingActivityCount == 0 || activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                runner,
                ImportProvider.STRAVA,
                FLUSHING_TERRITORY_SEED_VERSION + "-1"
        )) {
            return existingActivityCount;
        }

        List<Activity> activities = activityRepository.findByRunnerOrderByIdDesc(runner);
        for (Activity activity : activities) {
            if (!isLocalFlushingTerritorySeed(activity)) {
                continue;
            }
            if (activity.getId() != null) {
                territoryPolygonRepository.deleteByActivityId(activity.getId());
            }
            activityRepository.delete(activity);
        }
        return activityRepository.countByRunner(runner);
    }

    private static boolean isLocalFlushingTerritorySeed(Activity activity) {
        if (activity == null) {
            return false;
        }
        String checksum = activity.getSourceChecksum();
        String sourceFile = activity.getSourceFileName();
        return (checksum != null && checksum.startsWith(FLUSHING_TERRITORY_SEED_PREFIX))
                || FLUSHING_TERRITORY_SOURCE_FILE.equals(sourceFile);
    }

    private long repairOldBerlinTerritorySeedIfNeeded(Runner runner, long existingActivityCount) {
        if (runner == null || existingActivityCount == 0 || activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                runner,
                ImportProvider.STRAVA,
                BERLIN_TERRITORY_SEED_VERSION + "-1"
        )) {
            return existingActivityCount;
        }

        List<Activity> activities = activityRepository.findByRunnerOrderByIdDesc(runner);
        for (Activity activity : activities) {
            if (!isLocalBerlinTerritorySeed(activity)) {
                continue;
            }
            if (activity.getId() != null) {
                territoryPolygonRepository.deleteByActivityId(activity.getId());
            }
            activityRepository.delete(activity);
        }
        return activityRepository.countByRunner(runner);
    }

    private static boolean isLocalBerlinTerritorySeed(Activity activity) {
        if (activity == null) {
            return false;
        }
        String checksum = activity.getSourceChecksum();
        String sourceFile = activity.getSourceFileName();
        return (checksum != null && checksum.startsWith(BERLIN_TERRITORY_SEED_PREFIX))
                || BERLIN_TERRITORY_SOURCE_FILE.equals(sourceFile);
    }

    private long repairOldBerlinRivalSeedIfNeeded(Runner runner, long existingActivityCount, SeedProfile seedProfile) {
        if (runner == null || existingActivityCount == 0 || activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                runner,
                ImportProvider.STRAVA,
                BERLIN_RIVAL_SEED_VERSION + "-" + berlinRivalIndex(seedProfile) + "-1"
        )) {
            return existingActivityCount;
        }

        List<Activity> activities = activityRepository.findByRunnerOrderByIdDesc(runner);
        for (Activity activity : activities) {
            if (!isLocalBerlinRivalSeed(activity)) {
                continue;
            }
            if (activity.getId() != null) {
                territoryPolygonRepository.deleteByActivityId(activity.getId());
            }
            activityRepository.delete(activity);
        }
        return activityRepository.countByRunner(runner);
    }

    private static boolean isLocalBerlinRivalSeed(Activity activity) {
        if (activity == null) {
            return false;
        }
        String checksum = activity.getSourceChecksum();
        String sourceFile = activity.getSourceFileName();
        return (checksum != null && checksum.startsWith(BERLIN_RIVAL_SEED_PREFIX))
                || BERLIN_RIVAL_SOURCE_FILE.equals(sourceFile);
    }

    private static boolean isBerlinRival(SeedProfile seedProfile) {
        return seedProfile == SeedProfile.BERLIN_RIVAL_BLUE
                || seedProfile == SeedProfile.BERLIN_RIVAL_GREEN
                || seedProfile == SeedProfile.BERLIN_RIVAL_GOLD
                || seedProfile == SeedProfile.BERLIN_RIVAL_PINK
                || seedProfile == SeedProfile.BERLIN_RIVAL_LIME
                || seedProfile == SeedProfile.BERLIN_RIVAL_CYAN;
    }

    private static int berlinRivalIndex(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case BERLIN_RIVAL_BLUE -> 1;
            case BERLIN_RIVAL_GREEN -> 2;
            case BERLIN_RIVAL_GOLD -> 3;
            case BERLIN_RIVAL_PINK -> 4;
            case BERLIN_RIVAL_LIME -> 5;
            case BERLIN_RIVAL_CYAN -> 6;
            default -> 0;
        };
    }

    private static String berlinRivalEmail(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case BERLIN_RIVAL_BLUE -> BERLIN_RIVAL_BLUE_EMAIL;
            case BERLIN_RIVAL_GREEN -> BERLIN_RIVAL_GREEN_EMAIL;
            case BERLIN_RIVAL_GOLD -> BERLIN_RIVAL_GOLD_EMAIL;
            case BERLIN_RIVAL_PINK -> BERLIN_RIVAL_PINK_EMAIL;
            case BERLIN_RIVAL_LIME -> BERLIN_RIVAL_LIME_EMAIL;
            case BERLIN_RIVAL_CYAN -> BERLIN_RIVAL_CYAN_EMAIL;
            default -> BERLIN_RIVAL_BLUE_EMAIL;
        };
    }

    private static Long berlinRivalAthleteId(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case BERLIN_RIVAL_BLUE -> BERLIN_RIVAL_BLUE_STRAVA_ATHLETE_ID;
            case BERLIN_RIVAL_GREEN -> BERLIN_RIVAL_GREEN_STRAVA_ATHLETE_ID;
            case BERLIN_RIVAL_GOLD -> BERLIN_RIVAL_GOLD_STRAVA_ATHLETE_ID;
            case BERLIN_RIVAL_PINK -> BERLIN_RIVAL_PINK_STRAVA_ATHLETE_ID;
            case BERLIN_RIVAL_LIME -> BERLIN_RIVAL_LIME_STRAVA_ATHLETE_ID;
            case BERLIN_RIVAL_CYAN -> BERLIN_RIVAL_CYAN_STRAVA_ATHLETE_ID;
            default -> BERLIN_RIVAL_BLUE_STRAVA_ATHLETE_ID;
        };
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
        return switch (seedProfile) {
            case TERRITORY_RIVAL -> TERRITORY_RIVAL_DISPLAY_NAME;
            case FLUSHING_TERRITORY -> FLUSHING_TERRITORY_DISPLAY_NAME;
            case INNER_FLUSHING_TERRITORY -> INNER_FLUSHING_TERRITORY_DISPLAY_NAME;
            case BERLIN_TERRITORY -> BERLIN_TERRITORY_DISPLAY_NAME;
            case BERLIN_RIVAL_BLUE -> BERLIN_RIVAL_BLUE_DISPLAY_NAME;
            case BERLIN_RIVAL_GREEN -> BERLIN_RIVAL_GREEN_DISPLAY_NAME;
            case BERLIN_RIVAL_GOLD -> BERLIN_RIVAL_GOLD_DISPLAY_NAME;
            case BERLIN_RIVAL_PINK -> BERLIN_RIVAL_PINK_DISPLAY_NAME;
            case BERLIN_RIVAL_LIME -> BERLIN_RIVAL_LIME_DISPLAY_NAME;
            case BERLIN_RIVAL_CYAN -> BERLIN_RIVAL_CYAN_DISPLAY_NAME;
            case SHARED_RUNNER -> DEFAULT_DISPLAY_NAME;
        };
    }

    private static String defaultStravaUsername(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case TERRITORY_RIVAL -> "hermes-temporal-territory-rival";
            case FLUSHING_TERRITORY -> "hermes-flushing-territory-tester";
            case INNER_FLUSHING_TERRITORY -> "hermes-inner-flushing-occupier";
            case BERLIN_TERRITORY -> "hermes-berlin-land-conqueror";
            case BERLIN_RIVAL_BLUE -> "hermes-berlin-blue-rival";
            case BERLIN_RIVAL_GREEN -> "hermes-berlin-green-rival";
            case BERLIN_RIVAL_GOLD -> "hermes-berlin-gold-rival";
            case BERLIN_RIVAL_PINK -> "hermes-berlin-pink-rival";
            case BERLIN_RIVAL_LIME -> "hermes-berlin-lime-rival";
            case BERLIN_RIVAL_CYAN -> "hermes-berlin-cyan-rival";
            case SHARED_RUNNER -> "hermes-local-shared-runner";
        };
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
        if (seedProfile == SeedProfile.FLUSHING_TERRITORY) {
            return seedFlushingTerritoryActivities(runner, shoes);
        }
        if (seedProfile == SeedProfile.INNER_FLUSHING_TERRITORY) {
            return seedInnerFlushingTerritoryActivities(runner, shoes);
        }
        if (seedProfile == SeedProfile.BERLIN_TERRITORY) {
            return seedBerlinTerritoryActivities(runner, shoes);
        }
        if (isBerlinRival(seedProfile)) {
            return seedBerlinRivalActivities(runner, shoes, seedProfile);
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

    private int seedFlushingTerritoryActivities(Runner runner, List<Shoe> shoes) {
        double[][][] routes = {
                {
                        {40.7314, -73.8528},
                        {40.7425, -73.8570},
                        {40.7594, -73.8502},
                        {40.7746, -73.8330},
                        {40.7802, -73.8084},
                        {40.7700, -73.7860},
                        {40.7522, -73.7796},
                        {40.7352, -73.7905},
                        {40.7310, -73.8176},
                },
                {
                        {40.7368, -73.8465},
                        {40.7488, -73.8486},
                        {40.7602, -73.8380},
                        {40.7665, -73.8194},
                        {40.7614, -73.8012},
                        {40.7480, -73.7928},
                        {40.7371, -73.8038},
                        {40.7351, -73.8254},
                },
                {
                        {40.7332, -73.8428},
                        {40.7444, -73.8458},
                        {40.7527, -73.8336},
                        {40.7518, -73.8112},
                        {40.7470, -73.7836},
                        {40.7380, -73.7908},
                        {40.7331, -73.8108},
                },
        };
        String[] names = {
                "Flushing full territory occupation loop",
                "Flushing downtown dense claim loop",
                "Flushing east-west reinforcement loop",
        };
        double[] distancesKm = {23.8, 14.2, 12.6};

        LocalDate anchorDate = LocalDate.now().minusDays(1);
        int seeded = 0;
        for (int index = 0; index < FLUSHING_TERRITORY_ACTIVITY_SEED_COUNT; index++) {
            double distanceKm = distancesKm[index];
            int paceSecondsPerKm = 330 + index * 10;
            int durationSeconds = (int) Math.round(distanceKm * paceSecondsPerKm);
            LocalDateTime startTime = anchorDate
                    .minusDays((long) (FLUSHING_TERRITORY_ACTIVITY_SEED_COUNT - index) * 2L)
                    .atTime(5 + index, 20);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName(names[index]);
            activity.setStravaId("local-flushing-territory-140971749-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName(FLUSHING_TERRITORY_SOURCE_FILE);
            activity.setSourceChecksum(FLUSHING_TERRITORY_SEED_VERSION + "-" + (index + 1));
            activity.setAverageHeartRate(134.0 + index * 3.0);
            activity.setMaxHeartRate(170.0 + index * 2.0);
            activity.setAverageCadence(166.0 + index);
            activity.setAverageWatts(210.0 + index * 8.0);
            activity.setMaxSpeedMps(4.8 + index * 0.1);
            activity.setTotalElevationGain(22.0 + distanceKm * 1.2);
            activity.setCalories((int) Math.round(distanceKm * 66.0));
            activity.setSufferScore(28 + (int) Math.round(distanceKm * 1.5));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, index));
            addFlushingLoopSamples(activity, routes[index], distanceKm, durationSeconds, 48);

            Activity saved = activityRepository.save(activity);
            persistSeededTerritoryMask(saved != null ? saved : activity);
            seeded++;
        }
        return seeded;
    }

    private int seedInnerFlushingTerritoryActivities(Runner runner, List<Shoe> shoes) {
        double[][][] routes = {
                {
                        {40.7428, -73.8328},
                        {40.7478, -73.8338},
                        {40.7546, -73.8280},
                        {40.7588, -73.8176},
                        {40.7560, -73.8074},
                        {40.7486, -73.8038},
                        {40.7436, -73.8106},
                        {40.7428, -73.8226},
                },
                {
                        {40.7446, -73.8288},
                        {40.7504, -73.8300},
                        {40.7562, -73.8238},
                        {40.7568, -73.8140},
                        {40.7522, -73.8064},
                        {40.7460, -73.8116},
                        {40.7441, -73.8214},
                },
        };
        String[] names = {
                "Inner Flushing occupation loop",
                "Inner Flushing center capture loop",
        };
        double[] distancesKm = {7.8, 5.9};

        LocalDate anchorDate = LocalDate.now();
        int seeded = 0;
        for (int index = 0; index < INNER_FLUSHING_TERRITORY_ACTIVITY_SEED_COUNT; index++) {
            double distanceKm = distancesKm[index];
            int paceSecondsPerKm = 318 + index * 8;
            int durationSeconds = (int) Math.round(distanceKm * paceSecondsPerKm);
            LocalDateTime startTime = anchorDate
                    .minusDays((long) (INNER_FLUSHING_TERRITORY_ACTIVITY_SEED_COUNT - index))
                    .atTime(9 + index, 10);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName(names[index]);
            activity.setStravaId("local-inner-flushing-territory-140971750-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName(INNER_FLUSHING_TERRITORY_SOURCE_FILE);
            activity.setSourceChecksum(INNER_FLUSHING_TERRITORY_SEED_VERSION + "-" + (index + 1));
            activity.setAverageHeartRate(138.0 + index * 4.0);
            activity.setMaxHeartRate(172.0 + index * 2.0);
            activity.setAverageCadence(168.0 + index);
            activity.setAverageWatts(218.0 + index * 7.0);
            activity.setMaxSpeedMps(4.9 + index * 0.08);
            activity.setTotalElevationGain(12.0 + distanceKm);
            activity.setCalories((int) Math.round(distanceKm * 65.0));
            activity.setSufferScore(20 + (int) Math.round(distanceKm * 1.4));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, index));
            addFlushingLoopSamples(activity, routes[index], distanceKm, durationSeconds, 32);

            Activity saved = activityRepository.save(activity);
            persistSeededTerritoryMask(saved != null ? saved : activity);
            seeded++;
        }
        return seeded;
    }

    private int seedBerlinTerritoryActivities(Runner runner, List<Shoe> shoes) {
        double[][][] routes = {
                {
                        {52.5046, 13.3548},
                        {52.5112, 13.3526},
                        {52.5168, 13.3568},
                        {52.5152, 13.3648},
                        {52.5210, 13.3710},
                        {52.5174, 13.3790},
                        {52.5108, 13.3762},
                        {52.5060, 13.3818},
                        {52.5016, 13.3734},
                        {52.5042, 13.3656},
                        {52.5008, 13.3606},
                },
                {
                        {52.5056, 13.3818},
                        {52.5122, 13.3780},
                        {52.5188, 13.3824},
                        {52.5170, 13.3904},
                        {52.5234, 13.3978},
                        {52.5194, 13.4072},
                        {52.5122, 13.4044},
                        {52.5080, 13.4110},
                        {52.5022, 13.4034},
                        {52.5058, 13.3942},
                        {52.5014, 13.3886},
                },
                {
                        {52.5062, 13.4108},
                        {52.5134, 13.4076},
                        {52.5188, 13.4122},
                        {52.5174, 13.4208},
                        {52.5244, 13.4272},
                        {52.5200, 13.4368},
                        {52.5136, 13.4338},
                        {52.5090, 13.4406},
                        {52.5030, 13.4322},
                        {52.5068, 13.4232},
                        {52.5026, 13.4168},
                },
        };
        String[] names = {
                "Berlin Tiergarten district conquest loop",
                "Berlin Mitte district conquest loop",
                "Berlin Alexanderplatz district conquest loop",
        };
        double[] distancesKm = {7.8, 7.2, 7.6};

        LocalDate anchorDate = LocalDate.now().minusDays(1);
        int seeded = 0;
        for (int index = 0; index < BERLIN_TERRITORY_ACTIVITY_SEED_COUNT; index++) {
            double distanceKm = distancesKm[index];
            int paceSecondsPerKm = 326 + index * 9;
            int durationSeconds = (int) Math.round(distanceKm * paceSecondsPerKm);
            LocalDateTime startTime = anchorDate
                    .minusDays((long) (BERLIN_TERRITORY_ACTIVITY_SEED_COUNT - index))
                    .atTime(6 + index, 45);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName(names[index]);
            activity.setStravaId("local-berlin-territory-140971751-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName(BERLIN_TERRITORY_SOURCE_FILE);
            activity.setSourceChecksum(BERLIN_TERRITORY_SEED_VERSION + "-" + (index + 1));
            activity.setAverageHeartRate(136.0 + index * 4.0);
            activity.setMaxHeartRate(171.0 + index * 3.0);
            activity.setAverageCadence(167.0 + index);
            activity.setAverageWatts(214.0 + index * 9.0);
            activity.setMaxSpeedMps(4.85 + index * 0.1);
            activity.setTotalElevationGain(18.0 + distanceKm * 1.4);
            activity.setCalories((int) Math.round(distanceKm * 66.0));
            activity.setSufferScore(24 + (int) Math.round(distanceKm * 1.45));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, index));
            addFlushingLoopSamples(activity, routes[index], distanceKm, durationSeconds, 48);

            Activity saved = activityRepository.save(activity);
            persistSeededTerritoryMask(saved != null ? saved : activity);
            seeded++;
        }
        return seeded;
    }

    private int seedBerlinRivalActivities(Runner runner, List<Shoe> shoes, SeedProfile seedProfile) {
        double[][][] routes = berlinRivalRoutes(seedProfile);
        String[] names = berlinRivalNames(seedProfile);
        double[] distancesKm = berlinRivalDistances(seedProfile);
        int rivalIndex = berlinRivalIndex(seedProfile) - 1;
        int seeded = 0;
        for (int index = 0; index < routes.length; index += 1) {
            double distanceKm = distancesKm[Math.min(index, distancesKm.length - 1)];
            int durationSeconds = (int) Math.round(distanceKm * (338 + rivalIndex * 5 + index * 4));
            LocalDateTime startTime = LocalDate.now()
                    .minusDays(12L + rivalIndex * 2L + index)
                    .atTime(6 + rivalIndex, 5 + index * 10);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName(names[Math.min(index, names.length - 1)]);
            activity.setStravaId("local-berlin-rival-" + runner.getStravaAthleteId() + "-" + berlinRivalIndex(seedProfile) + "-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName(BERLIN_RIVAL_SOURCE_FILE);
            activity.setSourceChecksum(BERLIN_RIVAL_SEED_VERSION + "-" + berlinRivalIndex(seedProfile) + "-" + (index + 1));
            activity.setAverageHeartRate(132.0 + rivalIndex * 3.0 + index);
            activity.setMaxHeartRate(166.0 + rivalIndex * 3.0 + index);
            activity.setAverageCadence(164.0 + rivalIndex + index);
            activity.setAverageWatts(204.0 + rivalIndex * 8.0 + index * 5.0);
            activity.setMaxSpeedMps(4.55 + rivalIndex * 0.08 + index * 0.04);
            activity.setTotalElevationGain(10.0 + distanceKm);
            activity.setCalories((int) Math.round(distanceKm * 64.0));
            activity.setSufferScore(16 + (int) Math.round(distanceKm * 1.3));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, rivalIndex + index));
            addFlushingLoopSamples(activity, routes[index], distanceKm, durationSeconds, 42);

            Activity saved = activityRepository.save(activity);
            persistSeededTerritoryMask(saved != null ? saved : activity);
            seeded++;
        }
        return seeded;
    }

    private static double[][][] berlinRivalRoutes(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case BERLIN_RIVAL_BLUE -> new double[][][] {
                    {
                            {52.5160, 13.3528}, {52.5238, 13.3512}, {52.5318, 13.3576},
                            {52.5296, 13.3672}, {52.5352, 13.3750}, {52.5264, 13.3816},
                            {52.5206, 13.3760}, {52.5228, 13.3662}, {52.5150, 13.3618},
                    },
                    {
                            {52.5188, 13.3778}, {52.5270, 13.3748}, {52.5342, 13.3816},
                            {52.5316, 13.3916}, {52.5370, 13.3992}, {52.5288, 13.4054},
                            {52.5220, 13.4000}, {52.5244, 13.3892}, {52.5164, 13.3842},
                    },
                    {
                            {52.5190, 13.4020}, {52.5268, 13.3984}, {52.5344, 13.4050},
                            {52.5320, 13.4152}, {52.5372, 13.4232}, {52.5284, 13.4290},
                            {52.5220, 13.4234}, {52.5240, 13.4120}, {52.5162, 13.4070},
                    },
            };
            case BERLIN_RIVAL_GREEN -> new double[][][] {
                    {
                            {52.4942, 13.3602}, {52.5016, 13.3544}, {52.5076, 13.3598},
                            {52.5044, 13.3688}, {52.5096, 13.3774}, {52.5020, 13.3836},
                            {52.4960, 13.3780}, {52.4984, 13.3686}, {52.4922, 13.3650},
                    },
                    {
                            {52.4948, 13.3850}, {52.5024, 13.3790}, {52.5088, 13.3850},
                            {52.5060, 13.3940}, {52.5112, 13.4030}, {52.5030, 13.4098},
                            {52.4968, 13.4038}, {52.4990, 13.3940}, {52.4928, 13.3904},
                    },
                    {
                            {52.4954, 13.4100}, {52.5030, 13.4040}, {52.5092, 13.4102},
                            {52.5064, 13.4196}, {52.5118, 13.4286}, {52.5036, 13.4350},
                            {52.4972, 13.4294}, {52.4994, 13.4198}, {52.4932, 13.4158},
                    },
            };
            case BERLIN_RIVAL_GOLD -> new double[][][] {
                    {
                            {52.5098, 13.4360}, {52.5176, 13.4314}, {52.5240, 13.4378},
                            {52.5220, 13.4474}, {52.5280, 13.4552}, {52.5196, 13.4622},
                            {52.5128, 13.4564}, {52.5150, 13.4460}, {52.5074, 13.4414},
                    },
                    {
                            {52.5008, 13.4350}, {52.5084, 13.4292}, {52.5146, 13.4352},
                            {52.5124, 13.4446}, {52.5182, 13.4530}, {52.5100, 13.4600},
                            {52.5032, 13.4546}, {52.5058, 13.4446}, {52.4986, 13.4404},
                    },
                    {
                            {52.4918, 13.4320}, {52.4994, 13.4266}, {52.5056, 13.4324},
                            {52.5036, 13.4416}, {52.5092, 13.4502}, {52.5008, 13.4566},
                            {52.4944, 13.4512}, {52.4964, 13.4416}, {52.4898, 13.4378},
                    },
            };
            case BERLIN_RIVAL_PINK -> new double[][][] {
                    {
                            {52.5078, 13.3522}, {52.5144, 13.3484}, {52.5202, 13.3536},
                            {52.5180, 13.3622}, {52.5228, 13.3706}, {52.5152, 13.3748},
                            {52.5090, 13.3708}, {52.5112, 13.3610}, {52.5044, 13.3578},
                    },
                    {
                            {52.5060, 13.3724}, {52.5128, 13.3688}, {52.5180, 13.3746},
                            {52.5154, 13.3838}, {52.5208, 13.3916}, {52.5132, 13.3964},
                            {52.5078, 13.3902}, {52.5102, 13.3816}, {52.5038, 13.3776},
                    },
                    {
                            {52.5046, 13.3970}, {52.5114, 13.3924}, {52.5166, 13.3982},
                            {52.5140, 13.4078}, {52.5192, 13.4164}, {52.5114, 13.4210},
                            {52.5056, 13.4148}, {52.5078, 13.4058}, {52.5014, 13.4016},
                    },
            };
            case BERLIN_RIVAL_LIME -> new double[][][] {
                    {
                            {52.4966, 13.3508}, {52.5030, 13.3464}, {52.5090, 13.3514},
                            {52.5064, 13.3604}, {52.5120, 13.3684}, {52.5048, 13.3732},
                            {52.4988, 13.3680}, {52.5012, 13.3590}, {52.4948, 13.3548},
                    },
                    {
                            {52.4972, 13.3758}, {52.5034, 13.3716}, {52.5092, 13.3770},
                            {52.5068, 13.3862}, {52.5120, 13.3942}, {52.5044, 13.3990},
                            {52.4990, 13.3938}, {52.5014, 13.3846}, {52.4952, 13.3804},
                    },
                    {
                            {52.4974, 13.4018}, {52.5038, 13.3974}, {52.5098, 13.4030},
                            {52.5074, 13.4122}, {52.5128, 13.4206}, {52.5050, 13.4256},
                            {52.4992, 13.4202}, {52.5018, 13.4108}, {52.4954, 13.4066},
                    },
            };
            case BERLIN_RIVAL_CYAN -> new double[][][] {
                    {
                            {52.5130, 13.4218}, {52.5198, 13.4182}, {52.5250, 13.4240},
                            {52.5228, 13.4336}, {52.5284, 13.4414}, {52.5206, 13.4462},
                            {52.5150, 13.4408}, {52.5172, 13.4314}, {52.5108, 13.4274},
                    },
                    {
                            {52.5036, 13.4210}, {52.5100, 13.4168}, {52.5158, 13.4226},
                            {52.5134, 13.4320}, {52.5188, 13.4398}, {52.5114, 13.4450},
                            {52.5054, 13.4394}, {52.5080, 13.4298}, {52.5012, 13.4256},
                    },
                    {
                            {52.4938, 13.4212}, {52.5002, 13.4168}, {52.5062, 13.4224},
                            {52.5036, 13.4318}, {52.5092, 13.4404}, {52.5016, 13.4458},
                            {52.4958, 13.4400}, {52.4980, 13.4306}, {52.4918, 13.4266},
                    },
            };
            default -> new double[][][] {};
        };
    }

    private static String[] berlinRivalNames(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case BERLIN_RIVAL_BLUE -> new String[] {
                    "Berlin north blue rival claim loop",
                    "Berlin canal blue rival claim loop",
                    "Berlin northeast blue rival claim loop",
            };
            case BERLIN_RIVAL_GREEN -> new String[] {
                    "Berlin south green rival claim loop",
                    "Berlin Kreuzberg green rival claim loop",
                    "Berlin southeast green rival claim loop",
            };
            case BERLIN_RIVAL_GOLD -> new String[] {
                    "Berlin east gold rival claim loop",
                    "Berlin southeast gold rival claim loop",
                    "Berlin far-east gold rival claim loop",
            };
            case BERLIN_RIVAL_PINK -> new String[] {
                    "Berlin west pink rival claim loop",
                    "Berlin Spree pink rival claim loop",
                    "Berlin central pink rival claim loop",
            };
            case BERLIN_RIVAL_LIME -> new String[] {
                    "Berlin southwest lime rival claim loop",
                    "Berlin checkpoint lime rival claim loop",
                    "Berlin southeast lime rival claim loop",
            };
            case BERLIN_RIVAL_CYAN -> new String[] {
                    "Berlin northeast cyan rival claim loop",
                    "Berlin east cyan rival claim loop",
                    "Berlin southeast cyan rival claim loop",
            };
            default -> new String[] {"Berlin rival claim loop"};
        };
    }

    private static double[] berlinRivalDistances(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case BERLIN_RIVAL_BLUE -> new double[] {4.8, 4.6, 4.7};
            case BERLIN_RIVAL_GREEN -> new double[] {5.1, 5.0, 5.2};
            case BERLIN_RIVAL_GOLD -> new double[] {5.4, 5.2, 5.6};
            case BERLIN_RIVAL_PINK -> new double[] {4.9, 4.7, 4.8};
            case BERLIN_RIVAL_LIME -> new double[] {4.7, 4.8, 4.9};
            case BERLIN_RIVAL_CYAN -> new double[] {5.0, 5.1, 5.0};
            default -> new double[] {4.8};
        };
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

    private void persistSeededTerritoryMask(Activity activity) {
        if (activity == null || activity.getId() == null || territoryPolygonRepository == null || territoryPolygonComputer == null) {
            return;
        }
        List<double[]> points = activity.getPoints().stream()
                .filter(point -> point != null
                        && isValidCoordinate(point.getLatitude(), point.getLongitude()))
                .map(point -> new double[]{point.getLatitude(), point.getLongitude()})
                .toList();
        List<TerritoryPolygonComputer.DetectedTerritoryMask> masks = territoryPolygonComputer.detectTerritoryMasks(points);
        territoryPolygonRepository.deleteByActivityId(activity.getId());
        for (TerritoryPolygonComputer.DetectedTerritoryMask mask : masks) {
            TerritoryPolygon polygon = new TerritoryPolygon();
            polygon.setUserId(activity.getRunner().getId());
            polygon.setActivityId(activity.getId());
            polygon.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(mask.cells(), mask.cellMeters()));
            polygon.setAreaSquareMeters(mask.areaSquareMeters());
            territoryPolygonRepository.save(polygon);
        }
    }

    private static void addFlushingLoopSamples(
            Activity activity,
            double[][] vertices,
            double distanceKm,
            int durationSeconds,
            int samplesPerSegment
    ) {
        if (vertices == null || vertices.length < 3) {
            return;
        }
        int sequence = 0;
        int totalSamples = vertices.length * samplesPerSegment;
        for (int index = 0; index < vertices.length; index += 1) {
            double[] start = vertices[index];
            double[] end = vertices[(index + 1) % vertices.length];
            sequence = addFlushingSegment(
                    activity,
                    sequence,
                    start[0],
                    start[1],
                    end[0],
                    end[1],
                    samplesPerSegment,
                    totalSamples,
                    durationSeconds,
                    distanceKm
            );
        }
        addFlushingPoint(activity, sequence, vertices[0][0], vertices[0][1], durationSeconds, distanceKm * 1000.0);
    }

    private static int addFlushingSegment(
            Activity activity,
            int startSequence,
            double startLat,
            double startLng,
            double endLat,
            double endLng,
            int samples,
            int totalSamples,
            int durationSeconds,
            double distanceKm
    ) {
        int sequence = startSequence;
        for (int i = 0; i < samples; i++) {
            if (sequence > 0 && i == 0) {
                continue;
            }
            double progress = i / (double) (samples - 1);
            double routeProgress = sequence / (double) Math.max(1, totalSamples - 1);
            addFlushingPoint(
                    activity,
                    sequence,
                    startLat + (endLat - startLat) * progress,
                    startLng + (endLng - startLng) * progress,
                    (int) Math.round(durationSeconds * routeProgress),
                    distanceKm * 1000.0 * routeProgress
            );
            sequence += 1;
        }
        return sequence;
    }

    private static void addFlushingPoint(
            Activity activity,
            int sequence,
            double latitude,
            double longitude,
            int elapsedSeconds,
            double distanceMeters
    ) {
        ActivityPoint point = new ActivityPoint();
        point.setSequenceIndex(sequence);
        point.setLatitude(latitude);
        point.setLongitude(longitude);
        point.setElapsedSeconds(elapsedSeconds);
        point.setDistanceMeters(distanceMeters);
        double elevation = 8.0 + Math.sin(sequence * 0.13) * 4.0;
        point.setElevationMeters(elevation);
        point.setElevationRawMeters(elevation);
        point.setHeartRate(128 + sequence % 18);
        point.setCadence(164 + sequence % 9);
        activity.addPoint(point);
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

        public static BootstrapConfig flushingTerritoryDefault(String password) {
            return new BootstrapConfig(
                    FLUSHING_TERRITORY_EMAIL,
                    password,
                    FLUSHING_TERRITORY_STRAVA_ATHLETE_ID,
                    FLUSHING_TERRITORY_DISPLAY_NAME,
                    true,
                    SeedProfile.FLUSHING_TERRITORY
            );
        }

        public static BootstrapConfig innerFlushingTerritoryDefault(String password) {
            return new BootstrapConfig(
                    INNER_FLUSHING_TERRITORY_EMAIL,
                    password,
                    INNER_FLUSHING_TERRITORY_STRAVA_ATHLETE_ID,
                    INNER_FLUSHING_TERRITORY_DISPLAY_NAME,
                    true,
                    SeedProfile.INNER_FLUSHING_TERRITORY
            );
        }

        public static BootstrapConfig berlinTerritoryDefault(String password) {
            return new BootstrapConfig(
                    BERLIN_TERRITORY_EMAIL,
                    password,
                    BERLIN_TERRITORY_STRAVA_ATHLETE_ID,
                    BERLIN_TERRITORY_DISPLAY_NAME,
                    true,
                    SeedProfile.BERLIN_TERRITORY
            );
        }

        public static BootstrapConfig berlinRivalDefault(String password, SeedProfile seedProfile) {
            if (!isBerlinRival(seedProfile)) {
                throw new IllegalArgumentException("Berlin rival seed profile is required.");
            }
            return new BootstrapConfig(
                    berlinRivalEmail(seedProfile),
                    password,
                    berlinRivalAthleteId(seedProfile),
                    defaultDisplayName(seedProfile),
                    true,
                    seedProfile
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
        TERRITORY_RIVAL,
        FLUSHING_TERRITORY,
        INNER_FLUSHING_TERRITORY,
        BERLIN_TERRITORY,
        BERLIN_RIVAL_BLUE,
        BERLIN_RIVAL_GREEN,
        BERLIN_RIVAL_GOLD,
        BERLIN_RIVAL_PINK,
        BERLIN_RIVAL_LIME,
        BERLIN_RIVAL_CYAN
    }
}
