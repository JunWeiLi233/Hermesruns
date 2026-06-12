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
    private final TerritoryPolygonRepository territoryPolygonRepository = mock(TerritoryPolygonRepository.class);
    private final TerritoryPolygonComputer territoryPolygonComputer = new TerritoryPolygonComputer();
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

        LocalSharedRunnerBootstrapService service = newService();

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

        LocalSharedRunnerBootstrapService service = newService();

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

        LocalSharedRunnerBootstrapService service = newService();

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

        LocalSharedRunnerBootstrapService service = newService();

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

        LocalSharedRunnerBootstrapService service = newService();

        LocalSharedRunnerBootstrapService.BootstrapResult result = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.territoryRivalDefault("local-rival-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(1);
        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository).save(activityCaptor.capture());
        assertThat(activityCaptor.getValue().getSourceChecksum()).isEqualTo("local-territory-rival-live-v5-marker");
    }

    @Test
    void bootstrapCreatesFlushingTerritoryAccountWithReadyLandMasks() {
        when(authService.normalizeEmail("territory-flushing@hermes.local")).thenReturn("territory-flushing@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-flushing@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971749L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(9_000L + activity.getName().hashCode() % 1_000L);
            return activity;
        });

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.flushingTerritoryDefault("local-flushing-test-password")
        );

        assertThat(result.email()).isEqualTo("territory-flushing@hermes.local");
        assertThat(result.seededActivities()).isEqualTo(3);
        assertThat(result.seededShoes()).isEqualTo(3);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(3)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .allSatisfy(activity -> {
                    assertThat(activity.getName()).contains("Flushing");
                    assertThat(activity.getPoints()).hasSizeGreaterThanOrEqualTo(330);
                    assertThat(diagonalSegmentCount(activity)).isGreaterThan(60);
                    assertThat(activity.getPoints())
                            .anySatisfy(point -> {
                                assertThat(point.getLatitude()).isBetween(40.731, 40.781);
                                assertThat(point.getLongitude()).isBetween(-73.858, -73.778);
                            });
                });

        verify(territoryPolygonRepository, times(3)).deleteByActivityId(any(Long.class));
        ArgumentCaptor<TerritoryPolygon> polygonCaptor = ArgumentCaptor.forClass(TerritoryPolygon.class);
        verify(territoryPolygonRepository, times(3)).save(polygonCaptor.capture());
        assertThat(polygonCaptor.getAllValues())
                .allSatisfy(polygon -> {
                    assertThat(polygon.getUserId()).isEqualTo(140971749L);
                    assertThat(polygon.getAreaSquareMeters()).isGreaterThan(1_000_000.0);
                    assertThat(TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()).cells())
                            .hasSizeGreaterThan(1_000);
                });

        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-flushing@hermes.local".equals(runner.getEmail())
                        && "Hermes Flushing Territory Tester".equals(runner.getDisplayName())
                        && "hermes-flushing-territory-tester".equals(runner.getStravaUsername())
                        && Long.valueOf(140971749L).equals(runner.getStravaAthleteId())
        ));
    }

    @Test
    void bootstrapCreatesInnerFlushingTerritoryAccountInsideOuterFlushingMask() {
        when(authService.normalizeEmail("territory-flushing-inner@hermes.local")).thenReturn("territory-flushing-inner@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-flushing-inner@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971750L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(20_000L + Math.abs(activity.getName().hashCode() % 1_000L));
            return activity;
        });

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.innerFlushingTerritoryDefault("local-inner-flushing-test-password")
        );

        assertThat(result.email()).isEqualTo("territory-flushing-inner@hermes.local");
        assertThat(result.seededActivities()).isEqualTo(2);
        assertThat(result.seededShoes()).isEqualTo(3);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(2)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .allSatisfy(activity -> {
                    assertThat(activity.getName()).contains("Inner Flushing");
                    assertThat(activity.getPoints()).hasSizeGreaterThanOrEqualTo(190);
                    assertThat(activity.getPoints())
                            .allSatisfy(point -> {
                                assertThat(point.getLatitude()).isBetween(40.742, 40.760);
                                assertThat(point.getLongitude()).isBetween(-73.834, -73.803);
                            });
                });

        ArgumentCaptor<TerritoryPolygon> polygonCaptor = ArgumentCaptor.forClass(TerritoryPolygon.class);
        verify(territoryPolygonRepository, times(2)).save(polygonCaptor.capture());
        assertThat(polygonCaptor.getAllValues())
                .allSatisfy(polygon -> {
                    assertThat(polygon.getUserId()).isEqualTo(140971750L);
                    assertThat(polygon.getAreaSquareMeters()).isGreaterThan(250_000.0);
                    assertThat(TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()).cells())
                            .hasSizeGreaterThan(250);
                });

        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-flushing-inner@hermes.local".equals(runner.getEmail())
                        && "Hermes Inner Flushing Occupier".equals(runner.getDisplayName())
                        && "hermes-inner-flushing-occupier".equals(runner.getStravaUsername())
                        && Long.valueOf(140971750L).equals(runner.getStravaAthleteId())
        ));
    }

    @Test
    void bootstrapCreatesBerlinTerritoryAccountWithConquerableLandMasks() {
        when(authService.normalizeEmail("territory-berlin@hermes.local")).thenReturn("territory-berlin@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-berlin@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971751L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(30_000L + Math.abs(activity.getName().hashCode() % 1_000L));
            return activity;
        });

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.berlinTerritoryDefault("local-berlin-test-password")
        );

        assertThat(result.email()).isEqualTo("territory-berlin@hermes.local");
        assertThat(result.seededActivities()).isEqualTo(3);
        assertThat(result.seededShoes()).isEqualTo(3);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(3)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .allSatisfy(activity -> {
                    assertThat(activity.getName()).contains("Berlin");
                    assertThat(activity.getPoints()).hasSizeGreaterThanOrEqualTo(240);
                    assertThat(activity.getPoints())
                            .allSatisfy(point -> {
                                assertThat(point.getLatitude()).isBetween(52.500, 52.535);
                                assertThat(point.getLongitude()).isBetween(13.352, 13.442);
                            });
                });

        ArgumentCaptor<TerritoryPolygon> polygonCaptor = ArgumentCaptor.forClass(TerritoryPolygon.class);
        verify(territoryPolygonRepository, times(3)).save(polygonCaptor.capture());
        List<TerritoryPolygonComputer.DecodedTerritoryMask> berlinMasks = polygonCaptor.getAllValues().stream()
                .map(polygon -> TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()))
                .toList();
        assertThat(polygonCaptor.getAllValues())
                .allSatisfy(polygon -> {
                    assertThat(polygon.getUserId()).isEqualTo(140971751L);
                    assertThat(polygon.getAreaSquareMeters()).isGreaterThan(500_000.0);
                    assertThat(TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()).cells())
                            .hasSizeGreaterThan(500);
                });
        List<Double> centerLongitudes = berlinMasks.stream()
                .map(this::maskCenterLongitude)
                .sorted()
                .toList();
        assertThat(centerLongitudes.get(1) - centerLongitudes.get(0)).isGreaterThan(0.012);
        assertThat(centerLongitudes.get(2) - centerLongitudes.get(1)).isGreaterThan(0.012);

        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-berlin@hermes.local".equals(runner.getEmail())
                        && "Hermes Berlin Land Conqueror".equals(runner.getDisplayName())
                        && "hermes-berlin-land-conqueror".equals(runner.getStravaUsername())
                        && Long.valueOf(140971751L).equals(runner.getStravaAthleteId())
        ));
    }

    @Test
    void bootstrapCreatesBerlinRivalAccountForMultiColorTerritoryCompetition() {
        when(authService.normalizeEmail("territory-berlin-blue@hermes.local")).thenReturn("territory-berlin-blue@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-berlin-blue@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971752L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(40_000L + Math.abs(activity.getName().hashCode() % 1_000L));
            return activity;
        });

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.berlinRivalDefault(
                        "local-berlin-rival-test-password",
                        LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_BLUE
                )
        );

        assertThat(result.email()).isEqualTo("territory-berlin-blue@hermes.local");
        assertThat(result.seededActivities()).isEqualTo(3);
        assertThat(result.seededShoes()).isEqualTo(3);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(3)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .extracting(Activity::getSourceChecksum)
                .containsExactly(
                        "local-berlin-rival-loop-v5-1-1",
                        "local-berlin-rival-loop-v5-1-2",
                        "local-berlin-rival-loop-v5-1-3"
                );
        assertThat(activityCaptor.getAllValues())
                .allSatisfy(activity -> {
                    assertThat(activity.getName()).contains("Berlin");
                    assertThat(activity.getName()).contains("blue rival");
                    assertThat(activity.getPoints()).hasSizeGreaterThanOrEqualTo(240);
                });
        assertThat(activityCaptor.getAllValues().get(0).getPoints())
                .allSatisfy(point -> {
                    assertThat(point.getLatitude()).isBetween(52.514, 52.536);
                    assertThat(point.getLongitude()).isBetween(13.350, 13.383);
                });

        ArgumentCaptor<TerritoryPolygon> polygonCaptor = ArgumentCaptor.forClass(TerritoryPolygon.class);
        verify(territoryPolygonRepository, times(3)).save(polygonCaptor.capture());
        assertThat(polygonCaptor.getAllValues())
                .allSatisfy(polygon -> {
                    assertThat(polygon.getUserId()).isEqualTo(140971752L);
                    assertThat(polygon.getAreaSquareMeters()).isGreaterThan(250_000.0);
                    assertThat(TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()).cells())
                            .hasSizeGreaterThan(250);
                });

        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-berlin-blue@hermes.local".equals(runner.getEmail())
                        && "Hermes Berlin Blue Rival".equals(runner.getDisplayName())
                        && "hermes-berlin-blue-rival".equals(runner.getStravaUsername())
                        && Long.valueOf(140971752L).equals(runner.getStravaAthleteId())
        ));
    }

    @Test
    void berlinDenseRivalProfilesUseDistinctAccountsForPackedTerritoryBoard() {
        assertThat(LocalSharedRunnerBootstrapService.BootstrapConfig.berlinRivalDefault(
                "local-berlin-rival-test-password",
                LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_PINK
        ))
                .extracting(
                        LocalSharedRunnerBootstrapService.BootstrapConfig::email,
                        LocalSharedRunnerBootstrapService.BootstrapConfig::stravaAthleteId,
                        LocalSharedRunnerBootstrapService.BootstrapConfig::displayName
                )
                .containsExactly(
                        "territory-berlin-pink@hermes.local",
                        140971755L,
                        "Hermes Berlin Pink Rival"
                );
        assertThat(LocalSharedRunnerBootstrapService.BootstrapConfig.berlinRivalDefault(
                "local-berlin-rival-test-password",
                LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_LIME
        ))
                .extracting(
                        LocalSharedRunnerBootstrapService.BootstrapConfig::email,
                        LocalSharedRunnerBootstrapService.BootstrapConfig::stravaAthleteId,
                        LocalSharedRunnerBootstrapService.BootstrapConfig::displayName
                )
                .containsExactly(
                        "territory-berlin-lime@hermes.local",
                        140971756L,
                        "Hermes Berlin Lime Rival"
                );
        assertThat(LocalSharedRunnerBootstrapService.BootstrapConfig.berlinRivalDefault(
                "local-berlin-rival-test-password",
                LocalSharedRunnerBootstrapService.SeedProfile.BERLIN_RIVAL_CYAN
        ))
                .extracting(
                        LocalSharedRunnerBootstrapService.BootstrapConfig::email,
                        LocalSharedRunnerBootstrapService.BootstrapConfig::stravaAthleteId,
                        LocalSharedRunnerBootstrapService.BootstrapConfig::displayName
                )
                .containsExactly(
                        "territory-berlin-cyan@hermes.local",
                        140971757L,
                        "Hermes Berlin Cyan Rival"
                );
    }

    @Test
    void bootstrapRepairsOldRectangularFlushingSeedBeforeReseeding() {
        Runner existing = new Runner();
        existing.setId(140971749L);
        existing.setEmail("territory-flushing@hermes.local");
        Activity oldRectangularSeed = new Activity();
        oldRectangularSeed.setId(410L);
        oldRectangularSeed.setRunner(existing);
        oldRectangularSeed.setSourceFileName("local-flushing-territory-bootstrap");
        oldRectangularSeed.setSourceChecksum("local-flushing-territory-loop-v1-1");
        Activity unrelatedRun = new Activity();
        unrelatedRun.setId(411L);
        unrelatedRun.setRunner(existing);
        unrelatedRun.setSourceChecksum("manual-user-run");

        when(authService.normalizeEmail("territory-flushing@hermes.local")).thenReturn("territory-flushing@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-flushing@hermes.local")).thenReturn(Optional.of(existing));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityRepository.countByRunner(existing)).thenReturn(2L, 1L);
        when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                existing,
                ImportProvider.STRAVA,
                "local-flushing-territory-loop-v2-1"
        )).thenReturn(false);
        when(activityRepository.findByRunnerOrderByIdDesc(existing)).thenReturn(List.of(oldRectangularSeed, unrelatedRun));
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(existing)).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(10_000L + activity.getName().hashCode() % 1_000L);
            return activity;
        });

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.flushingTerritoryDefault("local-flushing-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(3);
        verify(territoryPolygonRepository).deleteByActivityId(410L);
        verify(activityRepository).delete(oldRectangularSeed);
        verify(activityRepository, never()).delete(unrelatedRun);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(3)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .extracting(Activity::getSourceChecksum)
                .containsExactly(
                        "local-flushing-territory-loop-v2-1",
                        "local-flushing-territory-loop-v2-2",
                        "local-flushing-territory-loop-v2-3"
                );
    }

    private static long diagonalSegmentCount(Activity activity) {
        List<ActivityPoint> points = activity.getPoints();
        long diagonals = 0;
        for (int i = 1; i < points.size(); i += 1) {
            ActivityPoint previous = points.get(i - 1);
            ActivityPoint current = points.get(i);
            if (Math.abs(current.getLatitude() - previous.getLatitude()) > 0.0000001
                    && Math.abs(current.getLongitude() - previous.getLongitude()) > 0.0000001) {
                diagonals += 1;
            }
        }
        return diagonals;
    }

    private LocalSharedRunnerBootstrapService newService() {
        return new LocalSharedRunnerBootstrapService(
                runnerRepository,
                shoeRepository,
                activityRepository,
                activityPointRepository,
                territoryPolygonRepository,
                territoryPolygonComputer,
                authService
        );
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

    private double maskCenterLongitude(TerritoryPolygonComputer.DecodedTerritoryMask mask) {
        return mask.cells().stream()
                .mapToDouble(TerritoryPolygonComputer.MaskCell::longitude)
                .average()
                .orElseThrow();
    }

}
