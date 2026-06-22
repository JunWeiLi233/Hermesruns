package com.hermes.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class LocalSharedRunnerBootstrapService {
    public static final String DEFAULT_EMAIL = "strava+140971747@hermes.local";
    public static final long DEFAULT_STRAVA_ATHLETE_ID = 140971747L;

    private static final String DEFAULT_DISPLAY_NAME = "Hermes Shared Runner";
    private static final int ACTIVITY_SEED_COUNT = 21;
    private static final double METERS_PER_DEG_LAT = 111_320.0;
    private static final String SHARED_RUNNER_SOURCE_FILE = "local-shared-runner-bootstrap";
    private static final String SHARED_RUNNER_SEED_VERSION = "local-shared-runner-loop-v14";

    private final RunnerRepository runnerRepository;
    private final ShoeRepository shoeRepository;
    private final ActivityRepository activityRepository;
    private final AuthService authService;

    public LocalSharedRunnerBootstrapService(
            RunnerRepository runnerRepository,
            ShoeRepository shoeRepository,
            ActivityRepository activityRepository,
            AuthService authService
    ) {
        this.runnerRepository = runnerRepository;
        this.shoeRepository = shoeRepository;
        this.activityRepository = activityRepository;
        this.authService = authService;
    }

    @Transactional
    public BootstrapResult bootstrap(BootstrapConfig config) {
        if (config == null) {
            throw new IllegalArgumentException("Local shared runner bootstrap config is required.");
        }

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
        if (config.seedMockData() && shouldSeedActivities(runner, existingActivityCount)) {
            ShoeSeedResult shoeSeedResult = ensureShoes(runner);
            seededShoes = shoeSeedResult.seededShoes();
            seededActivities = seedSharedRunnerActivities(runner, shoeSeedResult.availableShoes());
        }

        return new BootstrapResult(
                normalizedEmail,
                config.stravaAthleteId(),
                seededShoes,
                seededActivities
        );
    }

    private boolean shouldSeedActivities(Runner runner, long existingActivityCount) {
        return existingActivityCount == 0
                || !activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                        runner,
                        ImportProvider.STRAVA,
                        SHARED_RUNNER_SEED_VERSION + "-1"
                );
    }

    private void applyRunnerDefaults(Runner runner, String normalizedEmail, BootstrapConfig config) {
        runner.setEmail(normalizedEmail);
        runner.setDeleted(false);
        runner.setStatus("ACTIVE_STRAVA");
        runner.setRole("USER");
        runner.setEmailVerified(true);
        runner.setDisplayName(defaultIfBlank(config.displayName(), DEFAULT_DISPLAY_NAME));
        runner.setStravaAthleteId(config.stravaAthleteId());
        runner.setStravaUsername("hermes-local-shared-runner");
        runner.setMaxHeartRateBpm(192);
        runner.setRestingHeartRateBpm(48);
        runner.setSubscriptionTier("PRO");
        runner.setAiWelcomeScansRemaining(5);
        runner.setAiExperiencePhase("REGULAR_USER");
        runner.setAiFreeScansRemaining(3);
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

    private int seedSharedRunnerActivities(Runner runner, List<Shoe> shoes) {
        double[] distancesKm = {
                6.2, 8.0, 10.5, 5.0, 12.3, 7.4,
                16.0, 9.2, 21.1, 6.8, 13.4, 18.2,
                5.6, 11.0, 24.0, 8.8, 14.5, 32.0,
                18.0, 16.0, 14.0
        };
        String[] names = {
                "Local easy loop", "Harbor tempo", "North bridge progression",
                "Recovery shuffle", "Shared runner steady 12K", "Hill repeat sampler",
                "Queens rhythm run", "Park loop tune-up", "Half marathon rehearsal",
                "Morning commute run", "Aerobic builder", "Long bridge return",
                "Shakeout", "Threshold sampler", "Marathon block long run",
                "Evening aerobic", "Progressive medium-long", "Final long run",
                "Central Park north loop", "Brooklyn park loop", "Queens bay loop"
        };

        LocalDate anchorDate = LocalDate.now().minusDays(1);
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
            addRouteSamples(activity, index, distanceKm, durationSeconds, index >= 18 ? 144 : 72);

            activityRepository.save(activity);
            seeded++;
        }
        return seeded;
    }

    private Shoe selectShoe(List<Shoe> shoes, int index) {
        if (shoes == null || shoes.isEmpty()) {
            return null;
        }
        return shoes.get(index % shoes.size());
    }

    private static void addRouteSamples(Activity activity, int activityIndex, double distanceKm, int durationSeconds, int samples) {
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
        if (activityIndex == 18) {
            return new double[][]{
                    {40.7726, -73.9632},
                    {40.7788, -73.9618},
                    {40.7890, -73.9568},
                    {40.7956, -73.9502},
                    {40.7962, -73.9472},
                    {40.7924, -73.9458},
                    {40.7834, -73.9516},
                    {40.7754, -73.9584},
                    {40.7724, -73.9616},
            };
        }
        if (activityIndex == 19) {
            return new double[][]{
                    {40.6500, -73.9648},
                    {40.6570, -73.9632},
                    {40.6652, -73.9578},
                    {40.6712, -73.9516},
                    {40.6700, -73.9474},
                    {40.6626, -73.9478},
                    {40.6540, -73.9542},
                    {40.6492, -73.9620},
            };
        }
        if (activityIndex == 20) {
            return new double[][]{
                    {40.7488, -73.8068},
                    {40.7745, -73.8072},
                    {40.7950, -73.8068},
                    {40.7980, -73.8016},
                    {40.7845, -73.7922},
                    {40.7620, -73.7800},
                    {40.7378, -73.7722},
                    {40.7352, -73.7796},
                    {40.7540, -73.7930},
                    {40.7755, -73.8020},
            };
        }
        double baseLatitude = 40.7345 + (activityIndex / 6) * 0.0062 + (activityIndex % 3) * 0.0009;
        double baseLongitude = -73.8285 + (activityIndex % 6) * 0.0046;
        double widthMeters = 260.0 + distanceKm * 22.0 + (activityIndex % 4) * 28.0;
        double heightMeters = 180.0 + distanceKm * 16.0 + (activityIndex % 3) * 24.0;
        double cosLat = Math.cos(Math.toRadians(baseLatitude));
        double widthLng = widthMeters / (METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / METERS_PER_DEG_LAT;

        return new double[][]{
                {baseLatitude, baseLongitude},
                {baseLatitude, baseLongitude + widthLng},
                {baseLatitude + heightLat, baseLongitude + widthLng},
                {baseLatitude + heightLat, baseLongitude},
        };
    }

    private static double[] interpolateLoopVertex(double[][] vertices, double progress) {
        double normalized = progress >= 1.0 ? 0.0 : progress - Math.floor(progress);
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

    private static String defaultIfBlank(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public record BootstrapConfig(
            String email,
            String password,
            Long stravaAthleteId,
            String displayName,
            boolean seedMockData
    ) {
        public static BootstrapConfig localDefault(String password) {
            return new BootstrapConfig(
                    DEFAULT_EMAIL,
                    password,
                    DEFAULT_STRAVA_ATHLETE_ID,
                    DEFAULT_DISPLAY_NAME,
                    true
            );
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
}
