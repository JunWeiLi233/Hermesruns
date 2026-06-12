package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

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
    public static final String FLUSHING_CONQUEROR_EMAIL = "territory-flushing-conqueror@hermes.local";
    public static final long FLUSHING_CONQUEROR_STRAVA_ATHLETE_ID = 140971758L;
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
    public static final int WORLD_TERRITORY_ACCOUNTS_PER_COUNTRY = 100;
    public static final long WORLD_TERRITORY_STRAVA_ATHLETE_ID_BASE = 140972000L;
    public static final List<WorldTerritoryCountry> WORLD_TERRITORY_COUNTRIES = createWorldTerritoryCountries();
    private static final String DEFAULT_DISPLAY_NAME = "Hermes Shared Runner";
    private static final String TERRITORY_RIVAL_DISPLAY_NAME = "Hermes Temporal Rival";
    private static final String FLUSHING_TERRITORY_DISPLAY_NAME = "Hermes Flushing Territory Tester";
    private static final String INNER_FLUSHING_TERRITORY_DISPLAY_NAME = "Hermes Inner Flushing Occupier";
    private static final String FLUSHING_CONQUEROR_DISPLAY_NAME = "Hermes Flushing Conqueror";
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
    private static final int FLUSHING_CONQUEROR_ACTIVITY_SEED_COUNT = 3;
    private static final int BERLIN_TERRITORY_ACTIVITY_SEED_COUNT = 3;
    private static final int TERRITORY_RIVAL_CONFLICT_START_INDEX = ACTIVITY_SEED_COUNT - TERRITORY_RIVAL_ACTIVITY_SEED_COUNT;
    private static final double TERRITORY_CELL_DEGREES = 0.0065;
    private static final int TERRITORY_RIVAL_MAX_DYNAMIC_CELLS = 5;
    private static final int TERRITORY_RIVAL_MAX_DYNAMIC_SAMPLES_PER_CELL = 180;
    private static final int TERRITORY_RIVAL_MIN_DYNAMIC_SOURCE_SAMPLES = 8;
    private static final int TERRITORY_RIVAL_SOURCE_SAMPLE_WINDOW = 25_000;
    private static final String TERRITORY_RIVAL_LIVE_SEED_MARKER = "local-territory-rival-live-v5-marker";
    private static final String SHARED_RUNNER_SOURCE_FILE = "local-shared-runner-bootstrap";
    private static final String SHARED_RUNNER_SEED_PREFIX = "local-shared-runner-loop-";
    private static final String SHARED_RUNNER_SEED_VERSION = "local-shared-runner-loop-v3";
    private static final String FLUSHING_TERRITORY_SOURCE_FILE = "local-flushing-territory-bootstrap";
    private static final String FLUSHING_TERRITORY_SEED_PREFIX = "local-flushing-territory-loop-";
    private static final String FLUSHING_TERRITORY_SEED_VERSION = "local-flushing-territory-loop-v2";
    private static final String INNER_FLUSHING_TERRITORY_SOURCE_FILE = "local-inner-flushing-territory-bootstrap";
    private static final String INNER_FLUSHING_TERRITORY_SEED_VERSION = "local-inner-flushing-territory-loop-v1";
    private static final String FLUSHING_CONQUEROR_SOURCE_FILE = "local-flushing-conqueror-territory-bootstrap";
    private static final String FLUSHING_CONQUEROR_SEED_PREFIX = "local-flushing-conqueror-loop-";
    private static final String FLUSHING_CONQUEROR_SEED_VERSION = "local-flushing-conqueror-loop-v2";
    private static final LocalDateTime FLUSHING_CONQUEROR_ANCHOR_TIME = LocalDateTime.of(2026, 6, 7, 10, 0);
    private static final String BERLIN_TERRITORY_SOURCE_FILE = "local-berlin-territory-bootstrap";
    private static final String BERLIN_TERRITORY_SEED_PREFIX = "local-berlin-territory-loop-";
    private static final String BERLIN_TERRITORY_SEED_VERSION = "local-berlin-territory-loop-v5";
    private static final String BERLIN_RIVAL_SOURCE_FILE = "local-berlin-rival-territory-bootstrap";
    private static final String BERLIN_RIVAL_SEED_PREFIX = "local-berlin-rival-loop-";
    private static final String BERLIN_RIVAL_SEED_VERSION = "local-berlin-rival-loop-v5";
    private static final String WORLD_TERRITORY_SOURCE_FILE = "local-world-territory-bootstrap";
    private static final String WORLD_TERRITORY_SEED_PREFIX = "local-world-territory-loop-";
    private static final String WORLD_TERRITORY_SEED_VERSION = "local-world-territory-loop-v3-country-grid";
    private static final LocalDateTime WORLD_TERRITORY_ANCHOR_TIME = LocalDateTime.of(2026, 6, 6, 0, 0);
    private static final int WORLD_TERRITORY_GRID_COLUMNS = 10;
    private static final double WORLD_TERRITORY_CENTER_SPACING_METERS = 760.0;
    private static final double WORLD_TERRITORY_LOOP_RADIUS_METERS = 610.0;
    private static final double WORLD_TERRITORY_MASK_CELL_METERS = 160.0;
    private static final double WORLD_TERRITORY_MASK_RADIUS_METERS = 520.0;
    private static final List<String> WORLD_TERRITORY_FAKE_NAMES = List.of(
            "Alice", "Bob", "Chloe", "Daniel", "Emma", "Felix", "Grace", "Hugo", "Ivy", "Jack",
            "Kira", "Leo", "Maya", "Noah", "Olivia", "Pavel", "Quinn", "Rina", "Sofia", "Theo"
    );

    private final RunnerRepository runnerRepository;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final TerritoryPolygonRepository territoryPolygonRepository;
    private final TerritoryPolygonComputer territoryPolygonComputer;
    private final AuthService authService;
    private final ConcurrentMap<String, String> localWorldPasswordHashes = new ConcurrentHashMap<>();

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
        storeBootstrapPassword(runner, config);
        runner = runnerRepository.save(runner);

        int seededShoes = 0;
        int seededActivities = 0;
        long existingActivityCount = activityRepository.countByRunner(runner);
        if (config.seedMockData() && seedProfile == SeedProfile.SHARED_RUNNER) {
            existingActivityCount = repairOldSharedRunnerSeedIfNeeded(runner, existingActivityCount);
        }
        if (config.seedMockData() && seedProfile == SeedProfile.FLUSHING_TERRITORY) {
            existingActivityCount = repairOldFlushingTerritorySeedIfNeeded(runner, existingActivityCount);
        }
        if (config.seedMockData() && seedProfile == SeedProfile.BERLIN_TERRITORY) {
            existingActivityCount = repairOldBerlinTerritorySeedIfNeeded(runner, existingActivityCount);
        }
        if (config.seedMockData() && seedProfile == SeedProfile.FLUSHING_CONQUEROR) {
            existingActivityCount = repairOldFlushingConquerorSeedIfNeeded(runner, existingActivityCount);
        }
        if (config.seedMockData() && isBerlinRival(seedProfile)) {
            existingActivityCount = repairOldBerlinRivalSeedIfNeeded(runner, existingActivityCount, seedProfile);
        }
        if (config.seedMockData() && seedProfile == SeedProfile.WORLD_TERRITORY) {
            existingActivityCount = repairOldWorldTerritorySeedIfNeeded(runner, config, existingActivityCount);
        }
        if (config.seedMockData() && shouldSeedActivities(runner, config, existingActivityCount)) {
            ShoeSeedResult shoeSeedResult = ensureShoes(runner);
            seededShoes = shoeSeedResult.seededShoes();
            seededActivities = seedActivities(runner, shoeSeedResult.availableShoes(), config);
        }

        return new BootstrapResult(
                normalizedEmail,
                config.stravaAthleteId(),
                seededShoes,
                seededActivities
        );
    }

    private void storeBootstrapPassword(Runner runner, BootstrapConfig config) {
        if (config.effectiveSeedProfile() != SeedProfile.WORLD_TERRITORY) {
            authService.storePassword(runner, config.password());
            return;
        }

        runner.setPassword(localWorldPasswordHashes.computeIfAbsent(config.password(), this::hashLocalPasswordOnce));
    }

    private String hashLocalPasswordOnce(String password) {
        Runner scratch = new Runner();
        authService.storePassword(scratch, password);
        return scratch.getPassword();
    }

    private boolean shouldSeedActivities(Runner runner, BootstrapConfig config, long existingActivityCount) {
        SeedProfile seedProfile = config.effectiveSeedProfile();
        if (existingActivityCount == 0) {
            return true;
        }
        return (seedProfile == SeedProfile.TERRITORY_RIVAL
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        TERRITORY_RIVAL_LIVE_SEED_MARKER
                ))
                || (seedProfile == SeedProfile.SHARED_RUNNER
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        SHARED_RUNNER_SEED_VERSION + "-1"
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
                || (seedProfile == SeedProfile.FLUSHING_CONQUEROR
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        FLUSHING_CONQUEROR_SEED_VERSION + "-1"
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
                ))
                || (seedProfile == SeedProfile.WORLD_TERRITORY
                && !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        worldTerritorySourceChecksum(config, 1)
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

    private long repairOldSharedRunnerSeedIfNeeded(Runner runner, long existingActivityCount) {
        if (runner == null || existingActivityCount == 0 || activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                runner,
                ImportProvider.STRAVA,
                SHARED_RUNNER_SEED_VERSION + "-1"
        )) {
            return existingActivityCount;
        }

        List<Activity> activities = activityRepository.findByRunnerOrderByIdDesc(runner);
        for (Activity activity : activities) {
            if (!isLocalSharedRunnerSeed(activity)) {
                continue;
            }
            if (activity.getId() != null) {
                territoryPolygonRepository.deleteByActivityId(activity.getId());
            }
            activityRepository.delete(activity);
        }
        return activityRepository.countByRunner(runner);
    }

    private static boolean isLocalSharedRunnerSeed(Activity activity) {
        if (activity == null) {
            return false;
        }
        String checksum = activity.getSourceChecksum();
        String sourceFile = activity.getSourceFileName();
        return (checksum != null && checksum.startsWith(SHARED_RUNNER_SEED_PREFIX))
                || SHARED_RUNNER_SOURCE_FILE.equals(sourceFile);
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

    private long repairOldFlushingConquerorSeedIfNeeded(Runner runner, long existingActivityCount) {
        if (runner == null || existingActivityCount == 0 || activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                runner,
                ImportProvider.STRAVA,
                FLUSHING_CONQUEROR_SEED_VERSION + "-1"
        )) {
            return existingActivityCount;
        }

        List<Activity> activities = activityRepository.findByRunnerOrderByIdDesc(runner);
        for (Activity activity : activities) {
            if (!isLocalFlushingConquerorSeed(activity)) {
                continue;
            }
            if (activity.getId() != null) {
                territoryPolygonRepository.deleteByActivityId(activity.getId());
            }
            activityRepository.delete(activity);
        }
        return activityRepository.countByRunner(runner);
    }

    private static boolean isLocalFlushingConquerorSeed(Activity activity) {
        if (activity == null) {
            return false;
        }
        String checksum = activity.getSourceChecksum();
        String sourceFile = activity.getSourceFileName();
        return (checksum != null && checksum.startsWith(FLUSHING_CONQUEROR_SEED_PREFIX))
                || FLUSHING_CONQUEROR_SOURCE_FILE.equals(sourceFile);
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

    private long repairOldWorldTerritorySeedIfNeeded(Runner runner, BootstrapConfig config, long existingActivityCount) {
        if (runner == null || existingActivityCount == 0 || activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                runner,
                ImportProvider.STRAVA,
                worldTerritorySourceChecksum(config, 1)
        )) {
            return existingActivityCount;
        }

        List<Activity> activities = activityRepository.findByRunnerOrderByIdDesc(runner);
        for (Activity activity : activities) {
            if (!isLocalWorldTerritorySeed(activity)) {
                continue;
            }
            if (activity.getId() != null) {
                territoryPolygonRepository.deleteByActivityId(activity.getId());
            }
            activityRepository.delete(activity);
        }
        return activityRepository.countByRunner(runner);
    }

    private static boolean isLocalWorldTerritorySeed(Activity activity) {
        if (activity == null) {
            return false;
        }
        String checksum = activity.getSourceChecksum();
        String sourceFile = activity.getSourceFileName();
        return (checksum != null && checksum.startsWith(WORLD_TERRITORY_SEED_PREFIX))
                || WORLD_TERRITORY_SOURCE_FILE.equals(sourceFile);
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
        runner.setStravaUsername(defaultStravaUsername(config));
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
            case FLUSHING_CONQUEROR -> FLUSHING_CONQUEROR_DISPLAY_NAME;
            case BERLIN_TERRITORY -> BERLIN_TERRITORY_DISPLAY_NAME;
            case BERLIN_RIVAL_BLUE -> BERLIN_RIVAL_BLUE_DISPLAY_NAME;
            case BERLIN_RIVAL_GREEN -> BERLIN_RIVAL_GREEN_DISPLAY_NAME;
            case BERLIN_RIVAL_GOLD -> BERLIN_RIVAL_GOLD_DISPLAY_NAME;
            case BERLIN_RIVAL_PINK -> BERLIN_RIVAL_PINK_DISPLAY_NAME;
            case BERLIN_RIVAL_LIME -> BERLIN_RIVAL_LIME_DISPLAY_NAME;
            case BERLIN_RIVAL_CYAN -> BERLIN_RIVAL_CYAN_DISPLAY_NAME;
            case WORLD_TERRITORY -> "Hermes World Territory Runner";
            case SHARED_RUNNER -> DEFAULT_DISPLAY_NAME;
        };
    }

    private static String defaultStravaUsername(BootstrapConfig config) {
        if (config != null && config.effectiveSeedProfile() == SeedProfile.WORLD_TERRITORY) {
            WorldTerritoryCountry country = config.worldCountry();
            int accountIndex = normalizedWorldAccountIndex(config.worldAccountIndex());
            String slug = country != null ? country.slug() : "world";
            return "hermes-world-" + slug + "-" + paddedWorldIndex(accountIndex);
        }
        return defaultStravaUsername(config == null ? SeedProfile.SHARED_RUNNER : config.effectiveSeedProfile());
    }

    private static String defaultStravaUsername(SeedProfile seedProfile) {
        return switch (seedProfile) {
            case TERRITORY_RIVAL -> "hermes-temporal-territory-rival";
            case FLUSHING_TERRITORY -> "hermes-flushing-territory-tester";
            case INNER_FLUSHING_TERRITORY -> "hermes-inner-flushing-occupier";
            case FLUSHING_CONQUEROR -> "hermes-flushing-conqueror";
            case BERLIN_TERRITORY -> "hermes-berlin-land-conqueror";
            case BERLIN_RIVAL_BLUE -> "hermes-berlin-blue-rival";
            case BERLIN_RIVAL_GREEN -> "hermes-berlin-green-rival";
            case BERLIN_RIVAL_GOLD -> "hermes-berlin-gold-rival";
            case BERLIN_RIVAL_PINK -> "hermes-berlin-pink-rival";
            case BERLIN_RIVAL_LIME -> "hermes-berlin-lime-rival";
            case BERLIN_RIVAL_CYAN -> "hermes-berlin-cyan-rival";
            case WORLD_TERRITORY -> "hermes-world-territory-runner";
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

    private int seedActivities(Runner runner, List<Shoe> shoes, BootstrapConfig config) {
        SeedProfile seedProfile = config.effectiveSeedProfile();
        if (seedProfile == SeedProfile.TERRITORY_RIVAL) {
            return seedTerritoryRivalActivities(runner, shoes);
        }
        if (seedProfile == SeedProfile.FLUSHING_TERRITORY) {
            return seedFlushingTerritoryActivities(runner, shoes);
        }
        if (seedProfile == SeedProfile.INNER_FLUSHING_TERRITORY) {
            return seedInnerFlushingTerritoryActivities(runner, shoes);
        }
        if (seedProfile == SeedProfile.FLUSHING_CONQUEROR) {
            return seedFlushingConquerorActivities(runner, shoes);
        }
        if (seedProfile == SeedProfile.BERLIN_TERRITORY) {
            return seedBerlinTerritoryActivities(runner, shoes);
        }
        if (isBerlinRival(seedProfile)) {
            return seedBerlinRivalActivities(runner, shoes, seedProfile);
        }
        if (seedProfile == SeedProfile.WORLD_TERRITORY) {
            return seedWorldTerritoryActivities(runner, shoes, config);
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
            activity.setSourceFileName(SHARED_RUNNER_SOURCE_FILE);
            activity.setSourceChecksum(SHARED_RUNNER_SEED_VERSION + "-" + (index + 1));
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
            persistSeededTerritoryMask(activity);
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

    private int seedFlushingConquerorActivities(Runner runner, List<Shoe> shoes) {
        double[][][] routes = {
                {
                        {40.7248, -73.8588},
                        {40.7422, -73.8662},
                        {40.7678, -73.8544},
                        {40.7830, -73.8290},
                        {40.7788, -73.7938},
                        {40.7552, -73.7720},
                        {40.7318, -73.7838},
                        {40.7238, -73.8188},
                },
                {
                        {40.7306, -73.8496},
                        {40.7502, -73.8542},
                        {40.7698, -73.8388},
                        {40.7714, -73.8070},
                        {40.7524, -73.7852},
                        {40.7334, -73.7956},
                        {40.7280, -73.8248},
                },
                {
                        {40.7356, -73.8420},
                        {40.7528, -73.8466},
                        {40.7636, -73.8272},
                        {40.7604, -73.8002},
                        {40.7440, -73.7878},
                        {40.7328, -73.8062},
                        {40.7314, -73.8296},
                },
        };
        String[] names = {
                "Flushing conqueror full-board loop",
                "Flushing conqueror central compression loop",
                "Flushing conqueror inner seal loop",
        };
        double[] distancesKm = {26.4, 18.1, 13.7};

        int seeded = 0;
        for (int index = 0; index < FLUSHING_CONQUEROR_ACTIVITY_SEED_COUNT; index++) {
            double distanceKm = distancesKm[index];
            int paceSecondsPerKm = 316 + index * 9;
            int durationSeconds = (int) Math.round(distanceKm * paceSecondsPerKm);
            LocalDateTime startTime = FLUSHING_CONQUEROR_ANCHOR_TIME
                    .minusHours(FLUSHING_CONQUEROR_ACTIVITY_SEED_COUNT - index);

            Activity activity = new Activity();
            activity.setRunner(runner);
            activity.setName(names[index]);
            activity.setStravaId("local-flushing-conqueror-140971758-" + (index + 1));
            activity.setProvider(ImportProvider.STRAVA);
            activity.setActivityType(ActivityType.RUN);
            activity.setDistanceKm(distanceKm);
            activity.setDistanceMeters(distanceKm * 1000.0);
            activity.setMovingTimeSeconds(durationSeconds);
            activity.setDurationSeconds((long) durationSeconds);
            activity.setStartTime(startTime);
            activity.setStartDate(startTime.toString());
            activity.setSourceFileName(FLUSHING_CONQUEROR_SOURCE_FILE);
            activity.setSourceChecksum(FLUSHING_CONQUEROR_SEED_VERSION + "-" + (index + 1));
            activity.setAverageHeartRate(141.0 + index * 3.0);
            activity.setMaxHeartRate(176.0 + index * 2.0);
            activity.setAverageCadence(170.0 + index);
            activity.setAverageWatts(224.0 + index * 7.0);
            activity.setMaxSpeedMps(5.0 + index * 0.08);
            activity.setTotalElevationGain(18.0 + distanceKm * 1.1);
            activity.setCalories((int) Math.round(distanceKm * 67.0));
            activity.setSufferScore(32 + (int) Math.round(distanceKm * 1.4));
            activity.setWeatherAdjusted(false);
            activity.setShoe(selectShoe(shoes, index));
            addFlushingLoopSamples(activity, routes[index], distanceKm, durationSeconds, 54);

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

    private int seedWorldTerritoryActivities(Runner runner, List<Shoe> shoes, BootstrapConfig config) {
        WorldTerritoryCountry country = config.worldCountry();
        if (country == null) {
            return 0;
        }

        int accountIndex = normalizedWorldAccountIndex(config.worldAccountIndex());
        int globalIndex = Math.max(0, config.worldGlobalIndex());
        double distanceKm = 7.6 + (accountIndex % 7) * 0.24;
        int durationSeconds = (int) Math.round(distanceKm * (310 + (accountIndex % 5) * 7));
        LocalDateTime startTime = WORLD_TERRITORY_ANCHOR_TIME.plusMinutes(globalIndex * 7L);

        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setName(country.cityName() + " " + country.countryName() + " territory conquest " + paddedWorldIndex(accountIndex));
        activity.setStravaId("local-world-territory-" + country.slug() + "-" + paddedWorldIndex(accountIndex));
        activity.setProvider(ImportProvider.STRAVA);
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(distanceKm);
        activity.setDistanceMeters(distanceKm * 1000.0);
        activity.setMovingTimeSeconds(durationSeconds);
        activity.setDurationSeconds((long) durationSeconds);
        activity.setStartTime(startTime);
        activity.setStartDate(startTime.toString());
        activity.setSourceFileName(WORLD_TERRITORY_SOURCE_FILE);
        activity.setSourceChecksum(worldTerritorySourceChecksum(config, 1));
        activity.setAverageHeartRate(130.0 + (accountIndex % 14));
        activity.setMaxHeartRate(164.0 + (accountIndex % 11));
        activity.setAverageCadence(164.0 + (accountIndex % 8));
        activity.setAverageWatts(196.0 + (accountIndex % 12) * 4.0);
        activity.setMaxSpeedMps(4.45 + (accountIndex % 6) * 0.08);
        activity.setTotalElevationGain(8.0 + (accountIndex % 9) * 1.6);
        activity.setCalories((int) Math.round(distanceKm * 64.0));
        activity.setSufferScore(14 + accountIndex % 18);
        activity.setWeatherAdjusted(false);
        activity.setShoe(selectShoe(shoes, accountIndex));
        addFlushingLoopSamples(activity, worldTerritoryRouteVertices(country, accountIndex), distanceKm, durationSeconds, 9);

        Activity saved = activityRepository.save(activity);
        persistSeededTerritoryMask(saved != null ? saved : activity);
        return 1;
    }

    private static double[][] worldTerritoryRouteVertices(WorldTerritoryCountry country, int accountIndex) {
        int zeroIndex = Math.max(0, accountIndex - 1);
        int row = zeroIndex / WORLD_TERRITORY_GRID_COLUMNS;
        int col = zeroIndex % WORLD_TERRITORY_GRID_COLUMNS;
        double centerLat = country.anchorLatitude()
                + metersToLatitudeDegrees((row - 4.5) * WORLD_TERRITORY_CENTER_SPACING_METERS);
        double centerLng = country.anchorLongitude()
                + metersToLongitudeDegrees((col - 4.5) * WORLD_TERRITORY_CENTER_SPACING_METERS, centerLat);
        double radiusMeters = WORLD_TERRITORY_LOOP_RADIUS_METERS + (zeroIndex % 4) * 4.0;
        double latRadius = metersToLatitudeDegrees(radiusMeters);
        double lngRadius = metersToLongitudeDegrees(radiusMeters, centerLat);
        double skew = (zeroIndex % 3 - 1) * 0.12;
        return new double[][]{
                {centerLat - latRadius, centerLng - lngRadius * (0.42 + skew)},
                {centerLat - latRadius * 0.34, centerLng - lngRadius},
                {centerLat + latRadius * 0.58, centerLng - lngRadius * 0.78},
                {centerLat + latRadius, centerLng + lngRadius * (0.20 - skew)},
                {centerLat + latRadius * 0.30, centerLng + lngRadius},
                {centerLat - latRadius * 0.66, centerLng + lngRadius * 0.70},
        };
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
        if (WORLD_TERRITORY_SOURCE_FILE.equals(activity.getSourceFileName())) {
            persistWorldTerritoryMask(activity);
            return;
        }
        List<double[]> points = activity.getPoints().stream()
                .filter(point -> point != null
                        && isValidCoordinate(point.getLatitude(), point.getLongitude()))
                .map(point -> new double[]{point.getLatitude(), point.getLongitude()})
                .toList();
        List<TerritoryPolygonComputer.DetectedTerritoryMask> masks = territoryPolygonComputer.detectTerritoryMasks(points);
        territoryPolygonRepository.deleteByActivityId(activity.getId());
        if (masks.isEmpty()) {
            TerritoryPolygon marker = new TerritoryPolygon();
            marker.setUserId(activity.getRunner().getId());
            marker.setActivityId(activity.getId());
            marker.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                    List.of(),
                    TerritoryPolygonComputer.LAND_MASK_CELL_METERS,
                    TerritoryPolygonComputer.TerritoryMaskKind.LAND
            ));
            marker.setAreaSquareMeters(0.0);
            territoryPolygonRepository.save(marker);
            return;
        }
        for (TerritoryPolygonComputer.DetectedTerritoryMask mask : masks) {
            TerritoryPolygon polygon = new TerritoryPolygon();
            polygon.setUserId(activity.getRunner().getId());
            polygon.setActivityId(activity.getId());
            polygon.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(mask.cells(), mask.cellMeters()));
            polygon.setAreaSquareMeters(mask.areaSquareMeters());
            territoryPolygonRepository.save(polygon);
        }
    }

    private void persistWorldTerritoryMask(Activity activity) {
        List<ActivityPoint> points = activity.getPoints().stream()
                .filter(point -> point != null
                        && isValidCoordinate(point.getLatitude(), point.getLongitude()))
                .toList();
        if (points.isEmpty() || activity.getRunner() == null || activity.getRunner().getId() == null) {
            return;
        }

        double centerLat = points.stream().mapToDouble(ActivityPoint::getLatitude).average().orElse(Double.NaN);
        double centerLng = points.stream().mapToDouble(ActivityPoint::getLongitude).average().orElse(Double.NaN);
        if (!isValidCoordinate(centerLat, centerLng)) {
            return;
        }

        List<TerritoryPolygonComputer.MaskCell> cells = worldTerritoryCoarseMaskCells(centerLat, centerLng);
        if (cells.isEmpty()) {
            return;
        }

        territoryPolygonRepository.deleteByActivityId(activity.getId());
        TerritoryPolygon polygon = new TerritoryPolygon();
        polygon.setUserId(activity.getRunner().getId());
        polygon.setActivityId(activity.getId());
        polygon.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(cells, WORLD_TERRITORY_MASK_CELL_METERS));
        polygon.setAreaSquareMeters(cells.size() * WORLD_TERRITORY_MASK_CELL_METERS * WORLD_TERRITORY_MASK_CELL_METERS);
        territoryPolygonRepository.save(polygon);
    }

    private static List<TerritoryPolygonComputer.MaskCell> worldTerritoryCoarseMaskCells(double centerLat, double centerLng) {
        double cosLat = Math.cos(Math.toRadians(centerLat));
        if (Math.abs(cosLat) < 1e-6) {
            return List.of();
        }

        int radiusCells = Math.max(1, (int) Math.ceil(WORLD_TERRITORY_MASK_RADIUS_METERS / WORLD_TERRITORY_MASK_CELL_METERS));
        List<TerritoryPolygonComputer.MaskCell> cells = new ArrayList<>();
        for (int y = -radiusCells; y <= radiusCells; y += 1) {
            for (int x = -radiusCells; x <= radiusCells; x += 1) {
                double metersX = x * WORLD_TERRITORY_MASK_CELL_METERS;
                double metersY = y * WORLD_TERRITORY_MASK_CELL_METERS;
                if (Math.hypot(metersX, metersY) > WORLD_TERRITORY_MASK_RADIUS_METERS) {
                    continue;
                }
                double latitude = centerLat + metersToLatitudeDegrees(metersY);
                double longitude = centerLng + metersToLongitudeDegrees(metersX, centerLat);
                cells.add(new TerritoryPolygonComputer.MaskCell(round6(latitude), round6(longitude)));
            }
        }
        return cells;
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
        addRouteSamples(activity, activityIndex, distanceKm, durationSeconds, 32);
    }

    private void addRouteSamples(Activity activity, int activityIndex, double distanceKm, int durationSeconds, int samples) {
        double[][] vertices = sharedRouteVertices(activityIndex, distanceKm);
        for (int sample = 0; sample < samples; sample++) {
            double progress = sample / (double) (samples - 1);
            double[] coordinate = interpolateLoopVertex(vertices, progress);
            ActivityPoint point = new ActivityPoint();
            point.setSequenceIndex(sample);
            point.setLatitude(coordinate[0]);
            point.setLongitude(coordinate[1]);
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

    private static double[][] sharedRouteVertices(int activityIndex, double distanceKm) {
        double baseLatitude = 40.7345 + (activityIndex / 6) * 0.0062 + (activityIndex % 3) * 0.0009;
        double baseLongitude = -73.8285 + (activityIndex % 6) * 0.0046;
        double widthMeters = 260.0 + distanceKm * 22.0 + (activityIndex % 4) * 28.0;
        double heightMeters = 180.0 + distanceKm * 16.0 + (activityIndex % 3) * 24.0;
        double notchMeters = Math.max(30.0, Math.min(widthMeters * 0.22, 110.0));
        double tailMeters = (activityIndex % 3 == 0) ? 0.0 : Math.min(36.0, distanceKm * 1.8);
        double cosLat = Math.cos(Math.toRadians(baseLatitude));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double notchLng = notchMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double tailLat = tailMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;

        return switch (activityIndex % 6) {
            case 0 -> new double[][]{
                    {baseLatitude, baseLongitude},
                    {baseLatitude, baseLongitude + widthLng},
                    {baseLatitude + heightLat, baseLongitude + widthLng},
                    {baseLatitude + heightLat, baseLongitude},
            };
            case 1 -> new double[][]{
                    {baseLatitude, baseLongitude},
                    {baseLatitude - tailLat, baseLongitude},
                    {baseLatitude, baseLongitude + widthLng * 0.86},
                    {baseLatitude + heightLat * 0.34, baseLongitude + widthLng},
                    {baseLatitude + heightLat, baseLongitude + widthLng * 0.76},
                    {baseLatitude + heightLat * 0.92, baseLongitude + notchLng},
                    {baseLatitude + heightLat * 0.42, baseLongitude},
            };
            case 2 -> new double[][]{
                    {baseLatitude, baseLongitude + widthLng * 0.14},
                    {baseLatitude + heightLat * 0.18, baseLongitude + widthLng},
                    {baseLatitude + heightLat * 0.82, baseLongitude + widthLng},
                    {baseLatitude + heightLat, baseLongitude + widthLng * 0.18},
                    {baseLatitude + heightLat * 0.52, baseLongitude},
            };
            case 3 -> new double[][]{
                    {baseLatitude, baseLongitude},
                    {baseLatitude - tailLat, baseLongitude + notchLng * 0.25},
                    {baseLatitude, baseLongitude + widthLng},
                    {baseLatitude + heightLat * 0.55, baseLongitude + widthLng},
                    {baseLatitude + heightLat, baseLongitude + widthLng * 0.62},
                    {baseLatitude + heightLat * 0.92, baseLongitude},
            };
            case 4 -> new double[][]{
                    {baseLatitude, baseLongitude + widthLng * 0.22},
                    {baseLatitude + heightLat * 0.12, baseLongitude + widthLng},
                    {baseLatitude + heightLat * 0.48, baseLongitude + widthLng * 0.84},
                    {baseLatitude + heightLat, baseLongitude + widthLng * 0.58},
                    {baseLatitude + heightLat * 0.88, baseLongitude},
                    {baseLatitude + heightLat * 0.32, baseLongitude},
            };
            default -> new double[][]{
                    {baseLatitude, baseLongitude},
                    {baseLatitude, baseLongitude + widthLng * 0.52},
                    {baseLatitude + heightLat * 0.28, baseLongitude + widthLng},
                    {baseLatitude + heightLat, baseLongitude + widthLng * 0.78},
                    {baseLatitude + heightLat * 0.88, baseLongitude},
                    {baseLatitude + heightLat * 0.36, baseLongitude},
            };
        };
    }

    private static double[] interpolateLoopVertex(double[][] vertices, double progress) {
        if (vertices == null || vertices.length == 0) {
            return new double[]{40.7345, -73.8285};
        }
        if (vertices.length == 1) {
            return new double[]{vertices[0][0], vertices[0][1]};
        }
        double normalized = progress - Math.floor(progress);
        if (progress >= 1.0) {
            normalized = 0.0;
        }
        double scaled = normalized * vertices.length;
        int startIndex = (int) Math.floor(scaled) % vertices.length;
        int endIndex = (startIndex + 1) % vertices.length;
        double segmentProgress = scaled - Math.floor(scaled);
        double startLat = vertices[startIndex][0];
        double startLng = vertices[startIndex][1];
        double endLat = vertices[endIndex][0];
        double endLng = vertices[endIndex][1];
        return new double[]{
                startLat + (endLat - startLat) * segmentProgress,
                startLng + (endLng - startLng) * segmentProgress
        };
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

    private static double metersToLatitudeDegrees(double meters) {
        return meters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
    }

    private static double metersToLongitudeDegrees(double meters, double latitude) {
        double cosLat = Math.cos(Math.toRadians(latitude));
        if (Math.abs(cosLat) < 1e-6) {
            return 0.0;
        }
        return meters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
    }

    private static int normalizedWorldAccountIndex(int accountIndex) {
        return Math.max(1, accountIndex);
    }

    private static String paddedWorldIndex(int accountIndex) {
        int normalized = normalizedWorldAccountIndex(accountIndex);
        if (normalized < 10) {
            return "00" + normalized;
        }
        if (normalized < 100) {
            return "0" + normalized;
        }
        return String.valueOf(normalized);
    }

    private static String worldTerritorySourceChecksum(BootstrapConfig config, int activityIndex) {
        WorldTerritoryCountry country = config != null ? config.worldCountry() : null;
        String slug = country != null ? country.slug() : "world";
        int accountIndex = normalizedWorldAccountIndex(config != null ? config.worldAccountIndex() : 1);
        return WORLD_TERRITORY_SEED_VERSION + "-" + slug + "-" + paddedWorldIndex(accountIndex) + "-" + activityIndex;
    }

    private static String worldTerritoryEmail(WorldTerritoryCountry country, int accountIndex) {
        return "territory-world-" + country.slug() + "-" + paddedWorldIndex(accountIndex) + "@hermes.local";
    }

    private static String worldTerritoryDisplayName(WorldTerritoryCountry country, int accountIndex) {
        String fakeName = WORLD_TERRITORY_FAKE_NAMES.get(Math.floorMod(accountIndex - 1, WORLD_TERRITORY_FAKE_NAMES.size()));
        return fakeName + " " + country.countryName() + " Territory " + paddedWorldIndex(accountIndex);
    }

    public record BootstrapConfig(
            String email,
            String password,
            Long stravaAthleteId,
            String displayName,
            boolean seedMockData,
            SeedProfile seedProfile,
            WorldTerritoryCountry worldCountry,
            int worldAccountIndex,
            int worldGlobalIndex
    ) {
        public BootstrapConfig(
                String email,
                String password,
                Long stravaAthleteId,
                String displayName,
                boolean seedMockData,
            SeedProfile seedProfile
        ) {
            this(email, password, stravaAthleteId, displayName, seedMockData, seedProfile, null, 0, 0);
        }

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

        public static BootstrapConfig flushingConquerorDefault(String password) {
            return new BootstrapConfig(
                    FLUSHING_CONQUEROR_EMAIL,
                    password,
                    FLUSHING_CONQUEROR_STRAVA_ATHLETE_ID,
                    FLUSHING_CONQUEROR_DISPLAY_NAME,
                    true,
                    SeedProfile.FLUSHING_CONQUEROR
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

        public static List<BootstrapConfig> worldTerritoryDefaults(String password) {
            return worldTerritoryDefaults(password, WORLD_TERRITORY_ACCOUNTS_PER_COUNTRY, true);
        }

        public static List<BootstrapConfig> worldTerritoryDefaults(
                String password,
                int accountsPerCountry,
                boolean seedMockData
        ) {
            int count = Math.max(0, accountsPerCountry);
            List<BootstrapConfig> configs = new ArrayList<>();
            List<WorldTerritoryCountry> countries = WORLD_TERRITORY_COUNTRIES;
            for (int countryIndex = 0; countryIndex < countries.size(); countryIndex += 1) {
                WorldTerritoryCountry country = countries.get(countryIndex);
                for (int accountIndex = 1; accountIndex <= count; accountIndex += 1) {
                    int globalIndex = countryIndex * count + accountIndex - 1;
                    configs.add(worldTerritoryDefault(password, country, accountIndex, globalIndex, seedMockData));
                }
            }
            return configs;
        }

        public static BootstrapConfig worldTerritoryDefault(
                String password,
                WorldTerritoryCountry country,
                int accountIndex,
                int globalIndex,
                boolean seedMockData
        ) {
            if (country == null) {
                throw new IllegalArgumentException("World territory country is required.");
            }
            int normalizedIndex = normalizedWorldAccountIndex(accountIndex);
            return new BootstrapConfig(
                    worldTerritoryEmail(country, normalizedIndex),
                    password,
                    WORLD_TERRITORY_STRAVA_ATHLETE_ID_BASE + Math.max(0, globalIndex),
                    worldTerritoryDisplayName(country, normalizedIndex),
                    seedMockData,
                    SeedProfile.WORLD_TERRITORY,
                    country,
                    normalizedIndex,
                    Math.max(0, globalIndex)
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

    private static List<WorldTerritoryCountry> createWorldTerritoryCountries() {
        String[] isoCodes = Locale.getISOCountries();
        Arrays.sort(isoCodes);
        List<WorldTerritoryCountry> countries = new ArrayList<>();
        int fallbackIndex = 0;
        for (String isoCode : isoCodes) {
            Locale locale = new Locale("", isoCode);
            String countryName = locale.getDisplayCountry(Locale.ENGLISH);
            if (countryName == null || countryName.isBlank()) {
                continue;
            }
            double[] anchor = worldTerritoryCountryAnchor(isoCode, fallbackIndex);
            if (!hasNamedWorldTerritoryAnchor(isoCode)) {
                fallbackIndex += 1;
            }
            countries.add(new WorldTerritoryCountry(
                    isoCode,
                    isoCode.toLowerCase(Locale.ROOT),
                    countryName,
                    countryName + " Test City",
                    anchor[0],
                    anchor[1]
            ));
        }
        return List.copyOf(countries);
    }

    private static boolean hasNamedWorldTerritoryAnchor(String isoCode) {
        return switch (String.valueOf(isoCode).toUpperCase(Locale.ROOT)) {
            case "US", "CN", "JP", "GB", "FR", "DE", "BR", "AU", "ZA", "CA", "MX", "IN", "RU",
                 "KR", "SG", "IT", "ES", "AR", "CL", "EG", "KE", "NG" -> true;
            default -> false;
        };
    }

    private static double[] worldTerritoryCountryAnchor(String isoCode, int fallbackIndex) {
        return switch (String.valueOf(isoCode).toUpperCase(Locale.ROOT)) {
            case "US" -> new double[]{40.7128, -74.0060};
            case "CN" -> new double[]{39.9042, 116.4074};
            case "JP" -> new double[]{35.6762, 139.6503};
            case "GB" -> new double[]{51.5074, -0.1278};
            case "FR" -> new double[]{48.8566, 2.3522};
            case "DE" -> new double[]{52.5200, 13.4050};
            case "BR" -> new double[]{-23.5505, -46.6333};
            case "AU" -> new double[]{-33.8688, 151.2093};
            case "ZA" -> new double[]{-26.2041, 28.0473};
            case "CA" -> new double[]{43.6532, -79.3832};
            case "MX" -> new double[]{19.4326, -99.1332};
            case "IN" -> new double[]{19.0760, 72.8777};
            case "RU" -> new double[]{55.7558, 37.6173};
            case "KR" -> new double[]{37.5665, 126.9780};
            case "SG" -> new double[]{1.3521, 103.8198};
            case "IT" -> new double[]{41.9028, 12.4964};
            case "ES" -> new double[]{40.4168, -3.7038};
            case "AR" -> new double[]{-34.6037, -58.3816};
            case "CL" -> new double[]{-33.4489, -70.6693};
            case "EG" -> new double[]{30.0444, 31.2357};
            case "KE" -> new double[]{-1.2864, 36.8172};
            case "NG" -> new double[]{6.5244, 3.3792};
            default -> worldTerritoryFallbackAnchor(fallbackIndex);
        };
    }

    private static double[] worldTerritoryFallbackAnchor(int fallbackIndex) {
        int safeIndex = Math.max(0, fallbackIndex);
        int columns = 19;
        int row = safeIndex / columns;
        int column = safeIndex % columns;
        double latitude = -66.0 + row * 12.0;
        double longitude = -171.0 + column * 18.0;
        return new double[]{round6(latitude), round6(longitude)};
    }

    private static double round6(double value) {
        return Math.round(value * 1_000_000.0) / 1_000_000.0;
    }

    public record WorldTerritoryCountry(
            String isoCode,
            String slug,
            String countryName,
            String cityName,
            double anchorLatitude,
            double anchorLongitude
    ) {
    }

    public enum SeedProfile {
        SHARED_RUNNER,
        TERRITORY_RIVAL,
        FLUSHING_TERRITORY,
        INNER_FLUSHING_TERRITORY,
        FLUSHING_CONQUEROR,
        BERLIN_TERRITORY,
        BERLIN_RIVAL_BLUE,
        BERLIN_RIVAL_GREEN,
        BERLIN_RIVAL_GOLD,
        BERLIN_RIVAL_PINK,
        BERLIN_RIVAL_LIME,
        BERLIN_RIVAL_CYAN,
        WORLD_TERRITORY
    }

}
