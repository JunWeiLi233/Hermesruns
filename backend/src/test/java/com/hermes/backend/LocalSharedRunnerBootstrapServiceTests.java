package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LocalSharedRunnerBootstrapServiceTests {
    private final RunnerRepository runnerRepository = mock(RunnerRepository.class);
    private final ShoeRepository shoeRepository = mock(ShoeRepository.class);
    private final ActivityRepository activityRepository = mock(ActivityRepository.class);
    private final ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
    private final AuthService authService = mock(AuthService.class);

    @Test
    void bootstrapCreatesSyntheticStravaRunnerWithPasswordAndMockDataWhenEmpty() {
        when(authService.normalizeEmail("strava+140971747@hermes.local")).thenReturn("strava+140971747@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(42L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            runner.setPassword("hashed-local-password");
            return null;
        }).when(authService).storePassword(any(Runner.class), any(String.class));

        LocalSharedRunnerBootstrapService service = new LocalSharedRunnerBootstrapService(
                runnerRepository,
                shoeRepository,
                activityRepository,
                activityPointRepository,
                authService
        );

        LocalSharedRunnerBootstrapService.BootstrapResult result = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.localDefault("local-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(18);
        assertThat(result.seededShoes()).isEqualTo(3);
        verify(authService).storePassword(any(Runner.class), any(String.class));
        verify(activityRepository, times(18)).save(any(Activity.class));
        verify(shoeRepository, times(3)).save(any(Shoe.class));
        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "strava+140971747@hermes.local".equals(runner.getEmail())
                        && "USER".equals(runner.getRole())
                        && "ACTIVE_STRAVA".equals(runner.getStatus())
                        && runner.isEmailVerified()
                        && Long.valueOf(140971747L).equals(runner.getStravaAthleteId())
                        && runner.getStravaAccessToken() == null
                        && runner.getStravaRefreshToken() == null
        ));
    }

    @Test
    void bootstrapDoesNotDuplicateMockDataWhenRunnerAlreadyHasActivities() {
        Runner existing = new Runner();
        existing.setId(7L);
        existing.setEmail("strava+140971747@hermes.local");
        when(authService.normalizeEmail("strava+140971747@hermes.local")).thenReturn("strava+140971747@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.of(existing));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityRepository.countByRunner(existing)).thenReturn(4L);

        LocalSharedRunnerBootstrapService service = new LocalSharedRunnerBootstrapService(
                runnerRepository,
                shoeRepository,
                activityRepository,
                activityPointRepository,
                authService
        );

        LocalSharedRunnerBootstrapService.BootstrapResult result = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.localDefault("local-test-password")
        );

        assertThat(result.seededActivities()).isZero();
        assertThat(result.seededShoes()).isZero();
        verify(activityRepository, never()).save(any(Activity.class));
        verify(shoeRepository, never()).save(any(Shoe.class));
    }

    @Test
    void bootstrapCreatesReservedTerritoryRivalWithOverlappingConquestRoutes() {
        when(authService.normalizeEmail("territory-rival@hermes.local")).thenReturn("territory-rival@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-rival@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971748L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        doAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            runner.setPassword("hashed-territory-rival-password");
            return null;
        }).when(authService).storePassword(any(Runner.class), any(String.class));

        LocalSharedRunnerBootstrapService service = new LocalSharedRunnerBootstrapService(
                runnerRepository,
                shoeRepository,
                activityRepository,
                activityPointRepository,
                authService
        );

        LocalSharedRunnerBootstrapService.BootstrapResult result = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.territoryRivalDefault("local-rival-test-password")
        );

        assertThat(result.email()).isEqualTo("territory-rival@hermes.local");
        assertThat(result.seededActivities()).isEqualTo(6);
        assertThat(result.seededShoes()).isEqualTo(3);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(6)).save(activityCaptor.capture());
        List<Activity> seededActivities = activityCaptor.getAllValues();
        assertThat(seededActivities)
                .allSatisfy(activity -> {
                    assertThat(activity.getName()).contains("Territory rival");
                    assertThat(activity.getPoints()).hasSize(32);
                });

        Activity firstRivalActivity = seededActivities.get(0);
        ActivityPoint firstPoint = firstRivalActivity.getPoints().get(0);
        assertThat(firstPoint.getLatitude()).isCloseTo(sharedRouteLatitude(12, 0, 14), within(0.0000001));
        assertThat(firstPoint.getLongitude()).isCloseTo(sharedRouteLongitude(12, 0, 14), within(0.0000001));
        List<String> rivalCells = firstRivalActivity.getPoints().stream()
                .map(point -> territoryCellKey(point.getLatitude(), point.getLongitude()))
                .distinct()
                .toList();
        List<String> sharedRunnerCells = IntStream.range(0, 14)
                .mapToObj(sample -> territoryCellKey(sharedRouteLatitude(12, sample, 14), sharedRouteLongitude(12, sample, 14)))
                .distinct()
                .toList();
        long overlappingCells = sharedRunnerCells.stream()
                .filter(rivalCells::contains)
                .count();
        assertThat(overlappingCells).isGreaterThanOrEqualTo(3L);

        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-rival@hermes.local".equals(runner.getEmail())
                        && "Hermes Temporal Rival".equals(runner.getDisplayName())
                        && "hermes-temporal-territory-rival".equals(runner.getStravaUsername())
                        && Long.valueOf(140971748L).equals(runner.getStravaAthleteId())
        ));
    }

    @Test
    void bootstrapTerritoryRivalCopiesLowPressureCellsFromCurrentSharedRunner() {
        Runner sharedRunner = new Runner();
        sharedRunner.setId(140971747L);
        sharedRunner.setEmail("strava+140971747@hermes.local");

        when(authService.normalizeEmail("territory-rival@hermes.local")).thenReturn("territory-rival@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-rival@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.of(sharedRunner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971748L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        List<Object[]> seedCells = List.<Object[]>of(
                new Object[]{Math.floor(40.73225 / 0.0065), Math.floor(-73.84325 / 0.0065), 40.73225, -73.84325, 17L},
                new Object[]{Math.floor(40.73875 / 0.0065), Math.floor(-73.79775 / 0.0065), 40.73875, -73.79775, 29L},
                new Object[]{Math.floor(40.75175 / 0.0065), Math.floor(-73.82375 / 0.0065), 40.75175, -73.82375, 6759L}
        );
        when(activityPointRepository.findTerritorySeedCellsByRunner(
                140971747L,
                ActivityType.RUN.name(),
                0.0065,
                8,
                25000,
                5
        )).thenReturn(seedCells);
        doAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            runner.setPassword("hashed-territory-rival-password");
            return null;
        }).when(authService).storePassword(any(Runner.class), any(String.class));

        LocalSharedRunnerBootstrapService service = new LocalSharedRunnerBootstrapService(
                runnerRepository,
                shoeRepository,
                activityRepository,
                activityPointRepository,
                authService
        );

        LocalSharedRunnerBootstrapService.BootstrapResult result = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.territoryRivalDefault("local-rival-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(3);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(3)).save(activityCaptor.capture());
        List<Activity> activities = activityCaptor.getAllValues();
        assertThat(activities.get(0).getPoints()).hasSize(25);
        assertThat(activities.get(1).getPoints()).hasSize(37);
        assertThat(activities.get(2).getPoints()).hasSize(180);
        assertThat(activities.get(0).getPoints())
                .allSatisfy(point -> assertThat(territoryCellKey(point.getLatitude(), point.getLongitude()))
                        .isEqualTo(territoryCellKey(40.73225, -73.84325)));
        assertThat(activities.get(1).getPoints())
                .allSatisfy(point -> assertThat(territoryCellKey(point.getLatitude(), point.getLongitude()))
                        .isEqualTo(territoryCellKey(40.73875, -73.79775)));
        assertThat(activities.get(2).getPoints())
                .allSatisfy(point -> assertThat(territoryCellKey(point.getLatitude(), point.getLongitude()))
                        .isEqualTo(territoryCellKey(40.75175, -73.82375)));
    }

    @Test
    void bootstrapTerritoryRivalRepairsOldSeedWithoutLiveConflictMarker() {
        Runner rival = new Runner();
        rival.setId(140971748L);
        rival.setEmail("territory-rival@hermes.local");
        Runner sharedRunner = new Runner();
        sharedRunner.setId(140971747L);
        sharedRunner.setEmail("strava+140971747@hermes.local");

        when(authService.normalizeEmail("territory-rival@hermes.local")).thenReturn("territory-rival@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-rival@hermes.local")).thenReturn(Optional.of(rival));
        when(runnerRepository.findByEmailIgnoreCase("strava+140971747@hermes.local")).thenReturn(Optional.of(sharedRunner));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityRepository.countByRunner(rival)).thenReturn(5L);
        when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                rival,
                ImportProvider.STRAVA,
                "local-territory-rival-live-v5-marker"
        )).thenReturn(false);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(rival)).thenReturn(List.of());
        List<Object[]> seedCells = List.<Object[]>of(
                new Object[]{Math.floor(40.73875 / 0.0065), Math.floor(-73.79775 / 0.0065), 40.73875, -73.79775, 29L}
        );
        when(activityPointRepository.findTerritorySeedCellsByRunner(
                140971747L,
                ActivityType.RUN.name(),
                0.0065,
                8,
                25000,
                5
        )).thenReturn(seedCells);

        LocalSharedRunnerBootstrapService service = new LocalSharedRunnerBootstrapService(
                runnerRepository,
                shoeRepository,
                activityRepository,
                activityPointRepository,
                authService
        );

        LocalSharedRunnerBootstrapService.BootstrapResult result = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.territoryRivalDefault("local-rival-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(1);
        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository).save(activityCaptor.capture());
        assertThat(activityCaptor.getValue().getSourceChecksum()).isEqualTo("local-territory-rival-live-v5-marker");
    }

    private static double sharedRouteLatitude(int activityIndex, int sample, int sampleCount) {
        double progress = sample / (double) (sampleCount - 1);
        double routePhase = activityIndex * 0.37;
        double baseLatitude = 42.3520 + (activityIndex % 4) * 0.003;
        return baseLatitude + Math.sin(progress * Math.PI * 2.0 + routePhase) * 0.008 + progress * 0.011;
    }

    private static double sharedRouteLongitude(int activityIndex, int sample, int sampleCount) {
        double progress = sample / (double) (sampleCount - 1);
        double routePhase = activityIndex * 0.37;
        double baseLongitude = -71.0720 + (activityIndex % 5) * 0.004;
        return baseLongitude + Math.cos(progress * Math.PI * 2.0 + routePhase) * 0.010 + progress * 0.006;
    }

    private static String territoryCellKey(double latitude, double longitude) {
        double cellDegrees = 0.0065;
        return (int) Math.floor(latitude / cellDegrees) + ":" + (int) Math.floor(longitude / cellDegrees);
    }

}
