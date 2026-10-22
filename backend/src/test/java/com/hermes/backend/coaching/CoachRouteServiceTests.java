package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CoachRouteServiceTests {

    @Test
    void restDaysNeverRecommendAHistoricalRunningRoute() {
        ActivityRepository activities = mock(ActivityRepository.class);
        ActivityPointRepository points = mock(ActivityPointRepository.class);
        var service = new CoachRouteService(activities, points);
        CoachScheduledWorkout rest = workout(LocalDate.of(2026, 10, 16), 5.0);
        rest.setWorkoutType(CoachWorkoutType.REST);
        assertThat(service.buildRouteRecommendation(runner(), rest, List.of())).isNull();
        org.mockito.Mockito.verifyNoInteractions(points, activities);
    }

    @Test
    void buildRouteRecommendationHandlesActivitiesWithoutResolvableDistance() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);

        Runner runner = runner();
        Activity activity = activity(101L, 0.0, null);
        Activity nearbyActivity = activity(102L, 8.1, null);
        CoachScheduledWorkout today = workout(LocalDate.of(2026, 6, 10), 8.0);
        CoachScheduledWorkout future = workout(LocalDate.of(2026, 6, 11), 8.0);

        when(activityRepository.findRecentIdsByRunnerAndActivityType(runner.getId(), ActivityType.RUN.name(), 18))
                .thenReturn(List.of(activity.getId(), nearbyActivity.getId()));
        when(activityRepository.findAllById(List.of(activity.getId(), nearbyActivity.getId())))
                .thenReturn(List.of(activity, nearbyActivity));
        when(activityPointRepository.findHeatmapPointsByActivityIds(List.of(activity.getId(), nearbyActivity.getId())))
                .thenReturn(List.of(
                        new Object[]{activity.getId(), 40.7128, -74.0060, null, 0},
                        new Object[]{activity.getId(), 40.7134, -74.0048, null, 240},
                        new Object[]{nearbyActivity.getId(), 40.7130, -74.0059, 0.0, 0},
                        new Object[]{nearbyActivity.getId(), 40.7136, -74.0047, 8_100.0, 241}
                ));
        List<Object[]> pointRows = activityPointRepository.findHeatmapPointsByActivityIds(List.of(activity.getId(), nearbyActivity.getId()));
        com.hermes.backend.routing.RouteHistoryTestSupport.stubHistory(activityPointRepository, runner.getId(), pointRows);

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner,
                today,
                List.of(today, future)
        );

        assertThat(recommendation).isNotNull();
        assertThat(recommendation.targetDistanceKm()).isEqualTo(8.0);
        assertThat(recommendation.representativeDistanceKm()).isEqualTo(8.1);
        assertThat(recommendation.confidence()).isEqualTo("distance-match");
        assertThat(recommendation.activityCount()).isEqualTo(1);
        assertThat(recommendation.preview().path()).startsWith("M ");
        assertThat(recommendation.waypoints()).containsExactly(
                new CoachRouteWaypointDto(40.7130, -74.0059),
                new CoachRouteWaypointDto(40.7136, -74.0047)
        );
    }

    @Test
    void buildRouteRecommendationUsesRecentRunDistanceWhenTargetDistanceMatches() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);

        Runner runner = runner();
        Activity activity = activity(202L, 10.0, null);
        CoachScheduledWorkout today = workout(LocalDate.of(2026, 6, 10), 10.0);

        when(activityRepository.findRecentIdsByRunnerAndActivityType(runner.getId(), ActivityType.RUN.name(), 18))
                .thenReturn(List.of(activity.getId()));
        when(activityRepository.findAllById(List.of(activity.getId()))).thenReturn(List.of(activity));
        when(activityPointRepository.findHeatmapPointsByActivityIds(List.of(activity.getId())))
                .thenReturn(List.of(
                        new Object[]{activity.getId(), 34.0000, -118.2000, 0.0, 0},
                        new Object[]{activity.getId(), 34.0010, -118.1980, 10_000.0, 3000}
                ));
        List<Object[]> pointRows = activityPointRepository.findHeatmapPointsByActivityIds(List.of(activity.getId()));
        com.hermes.backend.routing.RouteHistoryTestSupport.stubHistory(activityPointRepository, runner.getId(), pointRows);

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner,
                today,
                List.of(today)
        );

        assertThat(recommendation).isNotNull();
        assertThat(recommendation.targetDistanceKm()).isEqualTo(10.0);
        assertThat(recommendation.representativeDistanceKm()).isEqualTo(10.0);
        assertThat(recommendation.confidence()).isEqualTo("distance-match");
    }

    @Test
    void buildRouteRecommendationPrioritizesAnOlderDenseLocationOverRecentDistanceMatches() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);
        Runner runner = runner();
        List<Activity> activities = new ArrayList<>();
        List<Long> recentIds = new ArrayList<>();
        List<Object[]> pointRows = new ArrayList<>();
        for (long id = 218; id >= 201; id--) {
            activities.add(activity(id, 5.0, null));
            recentIds.add(id);
            pointRows.add(new Object[]{id, 41.0 + id * 0.01, -74.0060, 0.0, 0});
            pointRows.add(new Object[]{id, 41.0002 + id * 0.01, -74.0062, 5_000.0, 1800});
        }
        activities.add(activity(100L, 6.2, null));
        for (int index = 0; index < 45; index++) {
            pointRows.add(new Object[]{100L, 40.7121 + index * 0.00001, -74.0061, index * 140.0, index * 40});
        }
        when(activityRepository.findRecentIdsByRunnerAndActivityType(runner.getId(), ActivityType.RUN.name(), 18))
                .thenReturn(recentIds);
        when(activityRepository.findAllById(org.mockito.ArgumentMatchers.anyList())).thenReturn(activities);
        com.hermes.backend.routing.RouteHistoryTestSupport.stubHistory(activityPointRepository, runner.getId(), pointRows);
        when(activityPointRepository.findHeatmapPointsByActivityIds(recentIds))
                .thenReturn(pointRows.stream().filter(row -> !Long.valueOf(100L).equals(row[0])).toList());

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner, workout(LocalDate.of(2026, 6, 10), 6.0), List.of());

        assertThat(recommendation).isNotNull();
        assertThat(recommendation.representativeDistanceKm()).isEqualTo(6.2);
        assertThat(recommendation.targetDistanceKm()).isEqualTo(6.0);
        assertThat(recommendation.waypoints().get(0).lat()).isEqualTo(40.7121);
        assertThat(recommendation.confidence()).isEqualTo("distance-match");
    }

    @Test
    void buildRouteRecommendationChoosesClosestRecordedDistanceInsideTheHotspot() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);
        Runner runner = runner();
        List<Long> ids = List.of(3L, 2L, 1L);
        List<Object[]> pointRows = List.of(
                new Object[]{3L, 40.7301, -73.9901, 0.0, 0},
                new Object[]{3L, 40.7302, -73.9902, 5_000.0, 1800},
                new Object[]{2L, 40.7121, -74.0061, 0.0, 0},
                new Object[]{2L, 40.7122, -74.0062, 6_200.0, 2000},
                new Object[]{1L, 40.7123, -74.0063, 0.0, 0},
                new Object[]{1L, 40.7124, -74.0064, 5_200.0, 1850}
        );
        stubRuns(activityRepository, activityPointRepository, runner, ids,
                List.of(activity(3L, 5.0, null), activity(2L, 6.2, null), activity(1L, 5.2, null)), pointRows);

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner, workout(LocalDate.of(2026, 6, 10), 5.0), List.of());

        assertThat(recommendation).isNotNull();
        assertThat(recommendation.representativeDistanceKm()).isEqualTo(5.2);
        assertThat(recommendation.activityCount()).isEqualTo(2);
        assertThat(recommendation.waypoints().get(0)).isEqualTo(new CoachRouteWaypointDto(40.7123, -74.0063));
    }

    @Test
    void buildRouteRecommendationDoesNotBorrowAFutureRunTargetOnRestDays() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);
        Runner runner = runner();
        stubRuns(activityRepository, activityPointRepository, runner, List.of(1L), List.of(activity(1L, 6.0, null)),
                List.of(new Object[]{1L, 40.7121, -74.0061, 0.0, 0},
                        new Object[]{1L, 40.7122, -74.0062, 6_000.0, 2000}));
        CoachScheduledWorkout today = workout(LocalDate.of(2026, 6, 10), 5.0);
        today.setWorkoutType(CoachWorkoutType.REST);

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner, today, List.of(today, workout(LocalDate.of(2026, 6, 11), 8.0)));

        assertThat(recommendation).isNull();
    }

    @Test
    void buildRouteRecommendationDoesNotCallFiftyPercentExtraADistanceMatch() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);
        Runner runner = runner();
        stubRuns(activityRepository, activityPointRepository, runner, List.of(1L), List.of(activity(1L, 1.5, null)),
                List.of(new Object[]{1L, 40.7121, -74.0061, 0.0, 0},
                        new Object[]{1L, 40.7122, -74.0062, 1_500.0, 600}));

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner, workout(LocalDate.of(2026, 6, 10), 1.0), List.of());

        assertThat(recommendation).isNull();
    }

    @Test
    void buildRouteRecommendationRequiresRecordedDistanceEvidence() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);
        Runner runner = runner();
        stubRuns(activityRepository, activityPointRepository, runner, List.of(1L), List.of(activity(1L, Double.POSITIVE_INFINITY, null)),
                List.of(new Object[]{1L, 40.7121, -74.0061, null, 0},
                        new Object[]{1L, 40.7122, -74.0062, null, 600}));

        assertThat(service.buildRouteRecommendation(
                runner, workout(LocalDate.of(2026, 6, 10), 5.0), List.of())).isNull();
    }

    @Test
    void buildRouteRecommendationPreservesTheHotspotVisitWhenSimplifyingALongTrace() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);
        Runner runner = runner();
        List<Object[]> pointRows = new ArrayList<>();
        for (int index = 0; index <= 100; index++) {
            pointRows.add(new Object[]{2L, index == 51 ? 40.7121 : 40.8 + index * 0.0001,
                    index == 51 ? -74.0061 : -74.0201, index * 50.0, index * 18});
        }
        for (int index = 0; index < 300; index++) {
            pointRows.add(new Object[]{1L, 40.7122 + index * 0.000001, -74.0062, index * 24.0, index * 8});
        }
        stubRuns(activityRepository, activityPointRepository, runner, List.of(2L, 1L),
                List.of(activity(2L, 5.0, null), activity(1L, 7.0, null)), pointRows);

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner, workout(LocalDate.of(2026, 6, 10), 5.0), List.of());

        assertThat(recommendation).isNotNull();
        assertThat(recommendation.representativeDistanceKm()).isEqualTo(5.0);
        assertThat(recommendation.waypoints()).contains(new CoachRouteWaypointDto(40.7121, -74.0061));
        assertThat(recommendation.waypoints().get(0)).isEqualTo(new CoachRouteWaypointDto(40.8, -74.0201));
        assertThat(recommendation.waypoints().get(recommendation.waypoints().size() - 1))
                .isEqualTo(new CoachRouteWaypointDto(40.8 + 100 * 0.0001, -74.0201));
    }

    private void stubRuns(ActivityRepository activityRepository, ActivityPointRepository activityPointRepository,
                          Runner runner, List<Long> ids, List<Activity> activities, List<Object[]> pointRows) {
        when(activityRepository.findRecentIdsByRunnerAndActivityType(runner.getId(), ActivityType.RUN.name(), 18))
                .thenReturn(ids);
        when(activityRepository.findAllById(org.mockito.ArgumentMatchers.anyList())).thenAnswer(invocation -> {
            List<Long> requestedIds = invocation.getArgument(0);
            return activities.stream().filter(activity -> requestedIds.contains(activity.getId())).toList();
        });
        when(activityPointRepository.findHeatmapPointsByActivityIds(ids)).thenReturn(pointRows);
        com.hermes.backend.routing.RouteHistoryTestSupport.stubHistory(activityPointRepository, runner.getId(), pointRows);
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setRole("USER");
        runner.setEmail("runner@hermes.test");
        return runner;
    }

    private Activity activity(Long id, double distanceKm, Double distanceMeters) {
        Activity activity = new Activity();
        activity.setId(id);
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(distanceKm);
        activity.setDistanceMeters(distanceMeters);
        return activity;
    }

    private CoachScheduledWorkout workout(LocalDate date, Double plannedDistanceKm) {
        CoachScheduledWorkout workout = new CoachScheduledWorkout();
        workout.setScheduledDate(date);
        workout.setWorkoutType(CoachWorkoutType.EASY);
        workout.setPlannedDistanceKm(plannedDistanceKm);
        return workout;
    }
}
