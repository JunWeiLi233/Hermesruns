package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CoachRouteServiceTests {

    @Test
    void buildRouteRecommendationHandlesActivitiesWithoutResolvableDistance() {
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository activityPointRepository = mock(ActivityPointRepository.class);
        CoachRouteService service = new CoachRouteService(activityRepository, activityPointRepository);

        Runner runner = runner();
        Activity activity = activity(101L, 0.0, null);
        Activity nearbyActivity = activity(102L, 8.1, null);
        CoachScheduledWorkout today = workout(LocalDate.of(2026, 6, 10), null);
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

        CoachRouteRecommendationDto recommendation = service.buildRouteRecommendation(
                runner,
                today,
                List.of(today, future)
        );

        assertThat(recommendation).isNotNull();
        assertThat(recommendation.targetDistanceKm()).isEqualTo(8.0);
        assertThat(recommendation.representativeDistanceKm()).isEqualTo(8.1);
        assertThat(recommendation.confidence()).isEqualTo("distance-match");
        assertThat(recommendation.activityCount()).isEqualTo(2);
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
        workout.setPlannedDistanceKm(plannedDistanceKm);
        return workout;
    }
}
