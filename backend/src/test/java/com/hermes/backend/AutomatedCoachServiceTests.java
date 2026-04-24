package com.hermes.backend;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AutomatedCoachServiceTests {

    @Test
    void getTodayWithReadinessCreatesScheduleWhenMissing() {
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        
        Runner runner = runner();
        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));
        
        AutomatedCoachService s = service(stateRepository, scheduleRepository, mock(CoachTrainingBlockRepository.class));
        
        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>());

        // The real service will save if today's workout is missing from the list
        // and add it to the list.
        s.getTodayWithReadiness(runner);

        verify(scheduleRepository, atLeastOnce()).save(any(CoachScheduledWorkout.class));
    }

    @Test
    void applyReadinessGateDowngradesHardRunsOnLowSleep() {
        CoachRunnerStateRepository stateRepository = mock(CoachRunnerStateRepository.class);
        CoachScheduledWorkoutRepository scheduleRepository = mock(CoachScheduledWorkoutRepository.class);
        
        Runner runner = runner();

        CoachRunnerState state = new CoachRunnerState();
        state.setRunner(runner);
        state.setLastSleepScore(45);
        when(stateRepository.findByRunner(runner)).thenReturn(Optional.of(state));

        CoachScheduledWorkout workout = new CoachScheduledWorkout();
        workout.setRunner(runner);
        workout.setWorkoutType(CoachWorkoutType.INTERVALS);
        workout.setPlannedDistanceKm(10.0);
        workout.setScheduledDate(LocalDate.now());

        when(scheduleRepository.findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(eq(runner), any(), any()))
                .thenReturn(new ArrayList<>(List.of(workout)));
        
        AutomatedCoachService s = service(stateRepository, scheduleRepository, mock(CoachTrainingBlockRepository.class));

        AutomatedCoachService.CoachTodayDto today = s.getTodayWithReadiness(runner);

        assertThat(today.today().workoutType()).isEqualTo(CoachWorkoutType.EASY.name());
        assertThat(today.today().readinessAdjusted()).isTrue();
    }

    private AutomatedCoachService service(
            CoachRunnerStateRepository stateRepository,
            CoachScheduledWorkoutRepository scheduleRepository,
            CoachTrainingBlockRepository blockRepository
    ) {
        return new AutomatedCoachService(
                mock(RunnerRepository.class),
                mock(ActivityRepository.class),
                stateRepository,
                scheduleRepository,
                blockRepository,
                mock(CoachFeedbackAlertRepository.class),
                mock(ShoeTracker.class),
                mock(CoachRouteService.class),
                mock(ReadinessService.class)
        );
    }

    private Runner runner() {
        Runner runner = new Runner();
        runner.setId(7L);
        runner.setEmail("runner@hermes.test");
        runner.setRole("USER");
        return runner;
    }
}
