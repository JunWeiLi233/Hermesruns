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
}
