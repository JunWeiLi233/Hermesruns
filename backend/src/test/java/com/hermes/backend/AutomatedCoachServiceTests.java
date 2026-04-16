package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AutomatedCoachServiceTests {

    @Test
    void getCoachStateRecoversWhenConcurrentStateInsertWinsRace() {
        Runner runner = runner();
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        AutomatedCoachService service = service(stateRepository, scheduleRepository, blockRepository);

        CoachRunnerState existingState = aggregatedState(runner);
        LocalDate today = LocalDate.now();

        when(stateRepository.findByRunner(runner))
                .thenReturn(Optional.empty(), Optional.of(existingState), Optional.of(existingState));
        when(stateRepository.save(any(CoachRunnerState.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate coach state"));
        when(scheduleRepository.findByRunnerAndScheduledDateBetween(runner, today, today.plusDays(13)))
                .thenReturn(fullSchedule(runner, today, 14));
        when(blockRepository.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.empty());

        AutomatedCoachService.CoachStateDto state = service.getCoachState(runner);

        assertThat(state.volumeKm7d()).isEqualTo(42.0);
        verify(stateRepository).save(any(CoachRunnerState.class));
    }

    @Test
    void getCoachStateRecoversWhenConcurrentScheduleInsertWinsRace() {
        Runner runner = runner();
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        AutomatedCoachService service = service(stateRepository, scheduleRepository, blockRepository);

        CoachRunnerState existingState = aggregatedState(runner);
        LocalDate today = LocalDate.now();
        List<CoachScheduledWorkout> completeSchedule = fullSchedule(runner, today, 14);

        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(existingState));
        when(blockRepository.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.empty());
        when(scheduleRepository.findByRunnerAndScheduledDateBetween(runner, today, today.plusDays(13)))
                .thenReturn(List.of(), completeSchedule);
        when(scheduleRepository.saveAll(anyList()))
                .thenThrow(new DataIntegrityViolationException("duplicate coach schedule"));

        assertThatCode(() -> service.getCoachState(runner)).doesNotThrowAnyException();

        verify(scheduleRepository).saveAll(anyList());
    }

    @Test
    void getCoachStateIncludesCalculatedStaminaSignal() {
        Runner runner = runner();
        runner.setMaxHeartRateBpm(186);
        runner.setRestingHeartRateBpm(48);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        AutomatedCoachService service = service(stateRepository, scheduleRepository, blockRepository);

        CoachRunnerState state = aggregatedState(runner);
        state.setBaselineRestingHr(48);
        state.setLastNightRestingHr(49);
        state.setLastSleepScore(84);
        state.setEstimatedHrMaxBpm(186.0);
        state.setLastHrvMs(58);

        LocalDate today = LocalDate.now();
        CoachScheduledWorkout todayWorkout = new CoachScheduledWorkout();
        todayWorkout.setRunner(runner);
        todayWorkout.setScheduledDate(today);
        todayWorkout.setWorkoutType(CoachWorkoutType.EASY);
        todayWorkout.setPlannedDistanceKm(10.0);
        todayWorkout.setPlannedDurationMinutes(50);

        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));
        when(scheduleRepository.findByRunnerAndScheduledDateBetween(runner, today, today.plusDays(13)))
                .thenReturn(fullSchedule(runner, today, 14));
        when(scheduleRepository.findByRunnerAndScheduledDate(runner, today)).thenReturn(Optional.of(todayWorkout));
        when(blockRepository.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.empty());

        AutomatedCoachService.CoachStateDto dto = service.getCoachState(runner);

        assertThat(dto.stamina()).isNotNull();
        assertThat(dto.stamina().recoveryCapPercent()).isEqualTo(100);
        assertThat(dto.stamina().scorePercent()).isEqualTo(98);
        assertThat(dto.stamina().targetPaceSecondsPerKm()).isEqualTo(300);
        assertThat(dto.stamina().targetHeartRateBpm()).isEqualTo(115);
        assertThat(dto.stamina().direction()).isEqualTo("down");
    }

    @Test
    void getTodayWithReadinessPrefersRouteAreaFromRunsClosestToTodayDistance() {
        Runner runner = runner();
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository pointRepository = mock(ActivityPointRepository.class);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        AutomatedCoachService service = service(activityRepository, pointRepository, stateRepository, scheduleRepository, blockRepository);

        CoachRunnerState state = aggregatedState(runner);
        LocalDate today = LocalDate.now();
        CoachScheduledWorkout todayWorkout = workout(runner, today, CoachWorkoutType.EASY, 10.0, 50);
        CoachScheduledWorkout tomorrowWorkout = workout(runner, today.plusDays(1), CoachWorkoutType.LONG_RUN, 18.0, 95);

        Activity recentMismatch = runActivity(runner, 201L, 13.2, LocalDateTime.now().minusDays(1));
        Activity olderCloseMatch = runActivity(runner, 202L, 10.1, LocalDateTime.now().minusDays(2));

        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));
        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, today, today.plusDays(13)))
                .thenReturn(List.of(todayWorkout, tomorrowWorkout));
        when(activityRepository.findRecentIdsByRunnerAndActivityType(runner.getId(), ActivityType.RUN.name(), 18))
                .thenReturn(List.of(recentMismatch.getId(), olderCloseMatch.getId()));
        when(activityRepository.findAllById(List.of(recentMismatch.getId(), olderCloseMatch.getId())))
                .thenReturn(List.of(recentMismatch, olderCloseMatch));
        when(pointRepository.findHeatmapPointsByActivityIds(List.of(recentMismatch.getId(), olderCloseMatch.getId())))
                .thenReturn(List.of(
                        point(recentMismatch.getId(), 40.4000, -73.9000, 0.0, 0),
                        point(recentMismatch.getId(), 40.4014, -73.8990, 6600.0, 1800),
                        point(recentMismatch.getId(), 40.4028, -73.8980, 13200.0, 3600),
                        point(olderCloseMatch.getId(), 40.7200, -73.9800, 0.0, 0),
                        point(olderCloseMatch.getId(), 40.7270, -73.9720, 5050.0, 1500),
                        point(olderCloseMatch.getId(), 40.7340, -73.9640, 10100.0, 3000)
                ));
        when(blockRepository.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.empty());

        AutomatedCoachService.CoachTodayDto dto = service.getTodayWithReadiness(runner);

        assertThat(dto.routeRecommendation()).isNotNull();
        assertThat(dto.routeRecommendation().targetDistanceKm()).isEqualTo(10.0);
        assertThat(dto.routeRecommendation().representativeDistanceKm()).isEqualTo(10.1);
        assertThat(dto.routeRecommendation().confidence()).isEqualTo("distance-match");
        assertThat(dto.routeRecommendation().preview()).isNotNull();
    }

    @Test
    void getTodayWithReadinessFallsBackToNextPlannedDistanceAndBestAvailableRoute() {
        Runner runner = runner();
        ActivityRepository activityRepository = mock(ActivityRepository.class);
        ActivityPointRepository pointRepository = mock(ActivityPointRepository.class);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachTrainingBlockRepository blockRepository = mock(CoachTrainingBlockRepository.class);
        AutomatedCoachService service = service(activityRepository, pointRepository, stateRepository, scheduleRepository, blockRepository);

        CoachRunnerState state = aggregatedState(runner);
        LocalDate today = LocalDate.now();
        CoachScheduledWorkout todayWorkout = workout(runner, today, CoachWorkoutType.REST, null, null);
        todayWorkout.setReadinessAdjusted(true);
        CoachScheduledWorkout nextWorkout = workout(runner, today.plusDays(1), CoachWorkoutType.LONG_RUN, 16.0, 92);

        Activity closestAvailable = runActivity(runner, 301L, 8.0, LocalDateTime.now().minusDays(1));
        Activity fartherRun = runActivity(runner, 302L, 6.5, LocalDateTime.now().minusDays(2));

        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));
        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(runner, today, today.plusDays(13)))
                .thenReturn(List.of(todayWorkout, nextWorkout));
        when(activityRepository.findRecentIdsByRunnerAndActivityType(runner.getId(), ActivityType.RUN.name(), 18))
                .thenReturn(List.of(closestAvailable.getId(), fartherRun.getId()));
        when(activityRepository.findAllById(List.of(closestAvailable.getId(), fartherRun.getId())))
                .thenReturn(List.of(closestAvailable, fartherRun));
        when(pointRepository.findHeatmapPointsByActivityIds(List.of(closestAvailable.getId(), fartherRun.getId())))
                .thenReturn(List.of(
                        point(closestAvailable.getId(), 40.6800, -73.9900, 0.0, 0),
                        point(closestAvailable.getId(), 40.6890, -73.9820, 4000.0, 1350),
                        point(closestAvailable.getId(), 40.6980, -73.9740, 8000.0, 2700),
                        point(fartherRun.getId(), 40.6100, -74.0400, 0.0, 0),
                        point(fartherRun.getId(), 40.6150, -74.0320, 3250.0, 1200),
                        point(fartherRun.getId(), 40.6200, -74.0240, 6500.0, 2400)
                ));
        when(blockRepository.findByRunnerAndActiveTrue(runner)).thenReturn(Optional.empty());

        AutomatedCoachService.CoachTodayDto dto = service.getTodayWithReadiness(runner);

        assertThat(dto.routeRecommendation()).isNotNull();
        assertThat(dto.routeRecommendation().targetDistanceKm()).isEqualTo(16.0);
        assertThat(dto.routeRecommendation().representativeDistanceKm()).isEqualTo(8.0);
        assertThat(dto.routeRecommendation().confidence()).isEqualTo("best-available");
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository
    ) {
        return service(
                mock(ActivityRepository.class),
                mock(ActivityPointRepository.class),
                stateRepository,
                scheduleRepository,
                blockRepository
        );
    }

    private AutomatedCoachService service(
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository
    ) {
        return new AutomatedCoachService(
                mock(RunnerRepository.class),
                activityRepository,
                activityPointRepository,
                stateRepository,
                scheduleRepository,
                blockRepository,
                mock(CoachFeedbackAlertRepository.class)
        );
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }

    private CoachRunnerState aggregatedState(Runner runner) {
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setVolumeKm7d(42.0);
        state.setVolumeKm28d(156.0);
        state.setMinutesLowZ1Z2Last7d(180);
        state.setMinutesGreyZ3Last7d(25);
        state.setMinutesHighZ4Z5Last7d(40);
        state.setMinutesUnknownHrLast7d(0);
        state.setHighIntensityRatioLast7d(0.18);
        state.setLastAggregatedAt(LocalDateTime.now().minusMinutes(5));
        return state;
    }

    private List<CoachScheduledWorkout> fullSchedule(Runner runner, LocalDate start, int days) {
        List<CoachScheduledWorkout> rows = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            CoachScheduledWorkout workout = new CoachScheduledWorkout();
            workout.setRunner(runner);
            workout.setScheduledDate(start.plusDays(i));
            workout.setWorkoutType(CoachWorkoutType.EASY);
            rows.add(workout);
        }
        return rows;
    }

    private CoachScheduledWorkout workout(
            Runner runner,
            LocalDate scheduledDate,
            CoachWorkoutType workoutType,
            Double plannedDistanceKm,
            Integer plannedDurationMinutes
    ) {
        CoachScheduledWorkout workout = new CoachScheduledWorkout();
        workout.setRunner(runner);
        workout.setScheduledDate(scheduledDate);
        workout.setWorkoutType(workoutType);
        workout.setPlannedDistanceKm(plannedDistanceKm);
        workout.setPlannedDurationMinutes(plannedDurationMinutes);
        return workout;
    }

    private Activity runActivity(Runner runner, Long id, double distanceKm, LocalDateTime startedAt) {
        Activity activity = new Activity();
        forceActivityId(activity, id);
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(distanceKm);
        activity.setStartTime(startedAt);
        return activity;
    }

    private Object[] point(Long activityId, double latitude, double longitude, double distanceMeters, int elapsedSeconds) {
        return new Object[]{activityId, latitude, longitude, distanceMeters, elapsedSeconds};
    }

    private void forceActivityId(Activity activity, Long id) {
        try {
            java.lang.reflect.Field field = Activity.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(activity, id);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError("Unable to seed activity id for test setup", e);
        }
    }
}
