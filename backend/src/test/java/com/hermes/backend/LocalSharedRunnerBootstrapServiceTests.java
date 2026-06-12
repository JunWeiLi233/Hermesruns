package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
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
        when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                existing,
                ImportProvider.STRAVA,
                "local-shared-runner-loop-v3-1"
        )).thenReturn(true);

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
    void bootstrapCreatesFlushingConquerorAccountCoveringTheFullFlushingBoard() {
        when(authService.normalizeEmail("territory-flushing-conqueror@hermes.local")).thenReturn("territory-flushing-conqueror@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-flushing-conqueror@hermes.local")).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(140971758L);
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(50_000L + Math.abs(activity.getName().hashCode() % 1_000L));
            return activity;
        });

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.flushingConquerorDefault("local-flushing-conqueror-test-password")
        );

        assertThat(result.email()).isEqualTo("territory-flushing-conqueror@hermes.local");
        assertThat(result.seededActivities()).isEqualTo(3);
        assertThat(result.seededShoes()).isEqualTo(3);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(3)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .allSatisfy(activity -> {
                    assertThat(activity.getName()).contains("Flushing conqueror");
                    assertThat(activity.getStartTime()).isBefore(LocalDateTime.of(2026, 6, 8, 15, 2, 19));
                    assertThat(activity.getStartTime()).isAfter(LocalDateTime.of(2026, 6, 7, 6, 0));
                    assertThat(activity.getPoints()).hasSizeGreaterThanOrEqualTo(370);
                    assertThat(diagonalSegmentCount(activity)).isGreaterThan(80);
                });

        ArgumentCaptor<TerritoryPolygon> polygonCaptor = ArgumentCaptor.forClass(TerritoryPolygon.class);
        verify(territoryPolygonRepository, times(3)).save(polygonCaptor.capture());
        List<TerritoryPolygonComputer.MaskCell> allCells = polygonCaptor.getAllValues().stream()
                .flatMap(polygon -> TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()).cells().stream())
                .toList();

        assertThat(polygonCaptor.getAllValues())
                .allSatisfy(polygon -> {
                    assertThat(polygon.getUserId()).isEqualTo(140971758L);
                    assertThat(polygon.getAreaSquareMeters()).isGreaterThan(1_000_000.0);
                    assertThat(TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()).cells())
                            .hasSizeGreaterThan(1_000);
                });
        assertThat(allCells).isNotEmpty();
        assertThat(allCells.stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).min().orElseThrow())
                .isLessThan(40.730);
        assertThat(allCells.stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).max().orElseThrow())
                .isGreaterThan(40.775);
        assertThat(allCells.stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).min().orElseThrow())
                .isLessThan(-73.855);
        assertThat(allCells.stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).max().orElseThrow())
                .isGreaterThan(-73.780);

        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-flushing-conqueror@hermes.local".equals(runner.getEmail())
                        && "Hermes Flushing Conqueror".equals(runner.getDisplayName())
                        && "hermes-flushing-conqueror".equals(runner.getStravaUsername())
                        && Long.valueOf(140971758L).equals(runner.getStravaAthleteId())
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
    void worldTerritoryDefaultsCreateOneHundredMockAccountsForEveryCountry() {
        List<LocalSharedRunnerBootstrapService.BootstrapConfig> configs =
                LocalSharedRunnerBootstrapService.BootstrapConfig.worldTerritoryDefaults("local-world-territory-password");

        assertThat(LocalSharedRunnerBootstrapService.WORLD_TERRITORY_COUNTRIES).isNotEmpty();
        assertThat(configs).hasSize(LocalSharedRunnerBootstrapService.WORLD_TERRITORY_COUNTRIES.size() * 100);
        assertThat(configs)
                .extracting(LocalSharedRunnerBootstrapService.BootstrapConfig::email)
                .contains(
                        "territory-world-us-001@hermes.local",
                        "territory-world-us-100@hermes.local",
                        "territory-world-cn-001@hermes.local",
                        "territory-world-jp-001@hermes.local",
                        "territory-world-gb-001@hermes.local"
                );
        assertThat(configs)
                .extracting(LocalSharedRunnerBootstrapService.BootstrapConfig::displayName)
                .contains(
                        "Alice United States Territory 001",
                        "Bob United States Territory 002",
                        "Alice China Territory 001"
                );
        assertThat(configs)
                .extracting(LocalSharedRunnerBootstrapService.BootstrapConfig::stravaAthleteId)
                .doesNotHaveDuplicates();

        for (LocalSharedRunnerBootstrapService.WorldTerritoryCountry country : LocalSharedRunnerBootstrapService.WORLD_TERRITORY_COUNTRIES) {
            assertThat(configs)
                    .filteredOn(config -> config.worldCountry().equals(country))
                    .hasSize(100)
                    .allSatisfy(config -> {
                        assertThat(config.seedProfile()).isEqualTo(LocalSharedRunnerBootstrapService.SeedProfile.WORLD_TERRITORY);
                        assertThat(config.seedMockData()).isTrue();
                        assertThat(config.displayName()).contains(country.countryName());
                        assertThat(config.displayName()).matches("^[A-Z][a-z]+ .+ Territory \\d{3}$");
                    });
        }
    }

    @Test
    void worldTerritoryFallbackAnchorsStayFarEnoughApartForVisibleCountryOwners() {
        List<LocalSharedRunnerBootstrapService.WorldTerritoryCountry> countries =
                LocalSharedRunnerBootstrapService.WORLD_TERRITORY_COUNTRIES;

        assertThat(countries).hasSizeGreaterThan(200);
        for (int leftIndex = 0; leftIndex < countries.size(); leftIndex += 1) {
            LocalSharedRunnerBootstrapService.WorldTerritoryCountry left = countries.get(leftIndex);
            for (int rightIndex = leftIndex + 1; rightIndex < countries.size(); rightIndex += 1) {
                LocalSharedRunnerBootstrapService.WorldTerritoryCountry right = countries.get(rightIndex);
                double meters = approxDistanceMeters(
                        left.anchorLatitude(),
                        left.anchorLongitude(),
                        right.anchorLatitude(),
                        right.anchorLongitude()
                );
                assertThat(meters)
                        .as("%s and %s anchors should not overlap enough to erase all owners",
                                left.isoCode(),
                                right.isoCode())
                        .isGreaterThan(20_000.0);
            }
        }
    }

    @Test
    void bootstrapCreatesWorldTerritoryNeighborsWithOverlappingConquestMasks() {
        when(authService.normalizeEmail(any(String.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(runnerRepository.findByEmailIgnoreCase(any(String.class))).thenReturn(Optional.empty());
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> {
            Runner runner = invocation.getArgument(0);
            if (runner.getId() == null) runner.setId(runner.getStravaAthleteId());
            return runner;
        });
        when(activityRepository.countByRunner(any(Runner.class))).thenReturn(0L);
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(any(Runner.class))).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(60_000L + Math.abs(activity.getName().hashCode() % 10_000L));
            return activity;
        });

        LocalSharedRunnerBootstrapService service = newService();
        LocalSharedRunnerBootstrapService.BootstrapResult first = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.worldTerritoryDefault(
                        "local-world-territory-password",
                        worldCountry("US"),
                        1,
                        0,
                        true
                )
        );
        LocalSharedRunnerBootstrapService.BootstrapResult second = service.bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.worldTerritoryDefault(
                        "local-world-territory-password",
                        worldCountry("US"),
                        2,
                        1,
                        true
                )
        );

        assertThat(first.seededActivities()).isEqualTo(1);
        assertThat(second.seededActivities()).isEqualTo(1);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(2)).save(activityCaptor.capture());
        List<Activity> activities = activityCaptor.getAllValues();
        assertThat(activities)
                .extracting(Activity::getSourceChecksum)
                .containsExactly(
                        "local-world-territory-loop-v3-country-grid-us-001-1",
                        "local-world-territory-loop-v3-country-grid-us-002-1"
                );
        assertThat(activities.get(1).getStartTime()).isAfter(activities.get(0).getStartTime());
        assertThat(activities)
                .allSatisfy(activity -> {
                    assertThat(activity.getName()).contains("United States territory conquest");
                    assertThat(activity.getPoints()).hasSizeGreaterThanOrEqualTo(48);
                });

        ArgumentCaptor<TerritoryPolygon> polygonCaptor = ArgumentCaptor.forClass(TerritoryPolygon.class);
        verify(territoryPolygonRepository, times(2)).save(polygonCaptor.capture());
        List<TerritoryPolygonComputer.DecodedTerritoryMask> masks = polygonCaptor.getAllValues().stream()
                .map(polygon -> TerritoryPolygonComputer.decodeMaskCells(polygon.getCoordinates()))
                .toList();
        assertThat(masks).hasSize(2);
        assertThat(masks)
                .allSatisfy(mask -> assertThat(mask.cells()).hasSizeGreaterThan(28));
        assertThat(masks)
                .allSatisfy(mask -> {
                    assertThat(maskLatitudeSpanMeters(mask)).isGreaterThan(900.0);
                    assertThat(maskLongitudeSpanMeters(mask)).isGreaterThan(900.0);
                });
        assertThat(maskBoundsOverlap(masks.get(0), masks.get(1))).isTrue();

        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-world-us-001@hermes.local".equals(runner.getEmail())
                        && "Alice United States Territory 001".equals(runner.getDisplayName())
                        && "hermes-world-us-001".equals(runner.getStravaUsername())
                        && Long.valueOf(140972000L).equals(runner.getStravaAthleteId())
        ));
        verify(runnerRepository).save(org.mockito.ArgumentMatchers.argThat(runner ->
                "territory-world-us-002@hermes.local".equals(runner.getEmail())
                        && "Bob United States Territory 002".equals(runner.getDisplayName())
                        && "hermes-world-us-002".equals(runner.getStravaUsername())
                        && Long.valueOf(140972001L).equals(runner.getStravaAthleteId())
        ));
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

    @Test
    void bootstrapRepairsNowBasedFlushingConquerorSeedBeforeReseeding() {
        Runner existing = new Runner();
        existing.setId(140971758L);
        existing.setEmail("territory-flushing-conqueror@hermes.local");
        Activity oldNowBasedSeed = new Activity();
        oldNowBasedSeed.setId(510L);
        oldNowBasedSeed.setRunner(existing);
        oldNowBasedSeed.setSourceFileName("local-flushing-conqueror-territory-bootstrap");
        oldNowBasedSeed.setSourceChecksum("local-flushing-conqueror-loop-v1-1");
        Activity unrelatedRun = new Activity();
        unrelatedRun.setId(511L);
        unrelatedRun.setRunner(existing);
        unrelatedRun.setSourceChecksum("manual-user-run");

        when(authService.normalizeEmail("territory-flushing-conqueror@hermes.local")).thenReturn("territory-flushing-conqueror@hermes.local");
        when(runnerRepository.findByEmailIgnoreCase("territory-flushing-conqueror@hermes.local")).thenReturn(Optional.of(existing));
        when(runnerRepository.save(any(Runner.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityRepository.countByRunner(existing)).thenReturn(2L, 1L);
        when(activityRepository.existsByRunnerAndProviderAndSourceChecksum(
                existing,
                ImportProvider.STRAVA,
                "local-flushing-conqueror-loop-v2-1"
        )).thenReturn(false);
        when(activityRepository.findByRunnerOrderByIdDesc(existing)).thenReturn(List.of(oldNowBasedSeed, unrelatedRun));
        when(shoeRepository.findByRunnerOrderByCreatedAtDesc(existing)).thenReturn(List.of());
        when(activityRepository.save(any(Activity.class))).thenAnswer(invocation -> {
            Activity activity = invocation.getArgument(0);
            if (activity.getId() == null) activity.setId(20_000L + Math.abs(activity.getName().hashCode() % 1_000L));
            return activity;
        });

        LocalSharedRunnerBootstrapService.BootstrapResult result = newService().bootstrap(
                LocalSharedRunnerBootstrapService.BootstrapConfig.flushingConquerorDefault("local-flushing-conqueror-test-password")
        );

        assertThat(result.seededActivities()).isEqualTo(3);
        verify(territoryPolygonRepository).deleteByActivityId(510L);
        verify(activityRepository).delete(oldNowBasedSeed);
        verify(activityRepository, never()).delete(unrelatedRun);

        ArgumentCaptor<Activity> activityCaptor = ArgumentCaptor.forClass(Activity.class);
        verify(activityRepository, times(3)).save(activityCaptor.capture());
        assertThat(activityCaptor.getAllValues())
                .extracting(Activity::getSourceChecksum)
                .containsExactly(
                        "local-flushing-conqueror-loop-v2-1",
                        "local-flushing-conqueror-loop-v2-2",
                        "local-flushing-conqueror-loop-v2-3"
                );
        assertThat(activityCaptor.getAllValues())
                .allSatisfy(activity -> assertThat(activity.getStartTime())
                        .isBefore(LocalDateTime.of(2026, 6, 8, 15, 2, 19)));
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
        return sharedRouteCoordinate(activityIndex, sample, sampleCount)[0];
    }

    private static double sharedRouteLongitude(int activityIndex, int sample, int sampleCount) {
        return sharedRouteCoordinate(activityIndex, sample, sampleCount)[1];
    }

    private static double[] sharedRouteCoordinate(int activityIndex, int sample, int sampleCount) {
        double progress = sample / (double) (sampleCount - 1);
        double[][] vertices = sharedRouteVertices(activityIndex, 6.2);
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

    private static double maskLatitudeSpanMeters(TerritoryPolygonComputer.DecodedTerritoryMask mask) {
        double minLat = mask.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).min().orElseThrow();
        double maxLat = mask.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).max().orElseThrow();
        return (maxLat - minLat) * TerritoryPolygonComputer.METERS_PER_DEG_LAT;
    }

    private static double maskLongitudeSpanMeters(TerritoryPolygonComputer.DecodedTerritoryMask mask) {
        double centerLat = mask.cells().stream()
                .mapToDouble(TerritoryPolygonComputer.MaskCell::latitude)
                .average()
                .orElseThrow();
        double minLng = mask.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).min().orElseThrow();
        double maxLng = mask.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).max().orElseThrow();
        return (maxLng - minLng) * TerritoryPolygonComputer.METERS_PER_DEG_LAT * Math.cos(Math.toRadians(centerLat));
    }

    private static boolean maskBoundsOverlap(
            TerritoryPolygonComputer.DecodedTerritoryMask first,
            TerritoryPolygonComputer.DecodedTerritoryMask second
    ) {
        double firstMinLat = first.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).min().orElseThrow();
        double firstMaxLat = first.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).max().orElseThrow();
        double firstMinLng = first.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).min().orElseThrow();
        double firstMaxLng = first.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).max().orElseThrow();
        double secondMinLat = second.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).min().orElseThrow();
        double secondMaxLat = second.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::latitude).max().orElseThrow();
        double secondMinLng = second.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).min().orElseThrow();
        double secondMaxLng = second.cells().stream().mapToDouble(TerritoryPolygonComputer.MaskCell::longitude).max().orElseThrow();
        return firstMinLat <= secondMaxLat
                && firstMaxLat >= secondMinLat
                && firstMinLng <= secondMaxLng
                && firstMaxLng >= secondMinLng;
    }

    private static double approxDistanceMeters(double firstLat, double firstLng, double secondLat, double secondLng) {
        double meanLat = Math.toRadians((firstLat + secondLat) / 2.0);
        double dy = (secondLat - firstLat) * TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double dx = (secondLng - firstLng) * TerritoryPolygonComputer.METERS_PER_DEG_LAT * Math.cos(meanLat);
        return Math.hypot(dx, dy);
    }

    private static LocalSharedRunnerBootstrapService.WorldTerritoryCountry worldCountry(String isoCode) {
        return LocalSharedRunnerBootstrapService.WORLD_TERRITORY_COUNTRIES.stream()
                .filter(country -> country.isoCode().equalsIgnoreCase(isoCode))
                .findFirst()
                .orElseThrow();
    }

}
