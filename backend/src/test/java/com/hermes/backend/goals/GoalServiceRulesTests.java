package com.hermes.backend.goals;

import com.hermes.backend.coaching.TrainingLogRepository;
import com.hermes.backend.runner.Runner;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The two ways a second goal for the same period and metric is turned away. The database allows one such goal per runner
 * (that is what stops two requests arriving together), but a goal that is already there is refused before anything is
 * written, so an ordinary second try never costs a failed insert. Seen from outside both look the same, so these tests
 * watch the repository.
 */
class GoalServiceRulesTests {

    private final GoalRepository goals = mock(GoalRepository.class);
    private final TrainingLogRepository runs = mock(TrainingLogRepository.class);
    private final GoalService service = new GoalService(goals, runs, Clock.fixed(Instant.parse("2026-10-07T12:00:00Z"), ZoneOffset.UTC));
    private final Runner runner = runnerWithId(7L);

    private static Runner runnerWithId(long id) {
        Runner runner = new Runner("goal-rules@hermes.test", "active");
        ReflectionTestUtils.setField(runner, "id", id);
        return runner;
    }

    @Test
    void aGoalThatIsAlreadyThereIsRefusedBeforeAnythingIsWritten() {
        when(goals.existsByRunnerIdAndPeriodAndMetric(7L, "MONTH", "DISTANCE")).thenReturn(true);

        assertThatThrownBy(() -> service.create(runner, "MONTH", "DISTANCE", 150))
                .isInstanceOf(GoalService.GoalConflictException.class)
                .hasMessageContaining("Change its target");

        verify(goals, never()).saveAndFlush(any());
    }

    @Test
    void twoRequestsArrivingTogetherAreStillRefusedWhenTheTableSaysNo() {
        when(goals.existsByRunnerIdAndPeriodAndMetric(7L, "MONTH", "DISTANCE")).thenReturn(false);
        when(goals.saveAndFlush(any(Goal.class))).thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> service.create(runner, "MONTH", "DISTANCE", 150))
                .isInstanceOf(GoalService.GoalConflictException.class)
                .hasMessageContaining("Change its target");
    }

    @Test
    void aGoalThatIsNewIsWrittenOnceWithTheCleanedTarget() {
        when(goals.existsByRunnerIdAndPeriodAndMetric(7L, "WEEK", "DISTANCE")).thenReturn(false);
        when(goals.saveAndFlush(any(Goal.class))).thenAnswer(call -> call.getArgument(0));

        service.create(runner, "WEEK", "DISTANCE", 33.456);

        ArgumentCaptor<Goal> written = ArgumentCaptor.forClass(Goal.class);
        verify(goals).saveAndFlush(written.capture());
        assertThat(written.getValue().getPeriod()).isEqualTo("WEEK");
        assertThat(written.getValue().getMetric()).isEqualTo("DISTANCE");
        assertThat(written.getValue().getTarget()).isEqualTo(33.46);
    }

    @Test
    void aRequestThatIsNotAGoalDoesNotEvenAskTheTable() {
        assertThatThrownBy(() -> service.create(runner, "DAY", "DISTANCE", 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(runner, "WEEK", "PACE", 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(runner, "WEEK", "DISTANCE", 0)).isInstanceOf(IllegalArgumentException.class);

        verify(goals, never()).existsByRunnerIdAndPeriodAndMetric(any(), any(), any());
        verify(goals, never()).saveAndFlush(any());
    }
}
