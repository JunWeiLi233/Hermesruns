package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * When a run is analysed and when it is left alone, with the collaborators faked: two requests (or a request and the
 * startup pass) read the same list of waiting runs, and the second must not do again what the first has just done.
 */
class RunRecordsCoordinatorTests {

    private static final Long RUNNER_ID = 5L;
    private static final Long RUN_ID = 77L;

    private final ActivityRepository activities = mock(ActivityRepository.class);
    private final ActivityRecordsRepository records = mock(ActivityRecordsRepository.class);
    private final ActivityDataAccess activityData = mock(ActivityDataAccess.class);
    private final BestEffortService bestEfforts = mock(BestEffortService.class);
    private final RouteMatchService routes = mock(RouteMatchService.class);
    private final RunRecordsCoordinator coordinator = new RunRecordsCoordinator(
            activities, records, activityData, bestEfforts, routes, mock(PlatformTransactionManager.class));

    private Runner runner(Long id) {
        Runner runner = new Runner();
        runner.setId(id);
        return runner;
    }

    private Activity run(Integer recordsVersion, ActivityType type) {
        Activity activity = new Activity();
        activity.setId(RUN_ID);
        activity.setRunner(runner(RUNNER_ID));
        activity.setActivityType(type);
        activity.setRecordsVersion(recordsVersion);
        when(activities.findById(RUN_ID)).thenReturn(Optional.of(activity));
        return activity;
    }

    private void verifyAnalysed(int times) {
        verify(bestEfforts, times(times)).replaceFor(any(), any(), any());
        verify(routes, times(times)).assign(any(), any(), any());
    }

    @Test
    void aRunWithNoVersionOrAnOldOneIsAnalysedAndMarkedWithTheCurrentVersion() {
        Activity fresh = run(null, ActivityType.RUN);
        assertThat(coordinator.processIfPending(RUNNER_ID, RUN_ID)).isTrue();
        assertThat(fresh.getRecordsVersion()).isEqualTo(BestEffortService.MODEL_VERSION);

        Activity old = run(BestEffortService.MODEL_VERSION - 1, ActivityType.RUN);
        assertThat(coordinator.processIfPending(RUNNER_ID, RUN_ID)).isTrue();
        assertThat(old.getRecordsVersion()).isEqualTo(BestEffortService.MODEL_VERSION);

        verifyAnalysed(2);
    }

    @Test
    void aRunThatIsUpToDateIsLeftAloneByAnyoneWhoFoundItWaitingEarlier() {
        run(BestEffortService.MODEL_VERSION, ActivityType.RUN);

        assertThat(coordinator.processIfPending(RUNNER_ID, RUN_ID)).isFalse();

        verifyAnalysed(0);
    }

    @Test
    void anExplicitAnalysisStillDoesTheRunAgain() {
        run(BestEffortService.MODEL_VERSION, ActivityType.RUN);

        assertThat(coordinator.process(RUNNER_ID, RUN_ID)).isTrue();

        verifyAnalysed(1);
    }

    @Test
    void aRunOfAnotherRunnerIsNeverAnalysed() {
        run(null, ActivityType.RUN);

        assertThat(coordinator.process(999L, RUN_ID)).isFalse();
        assertThat(coordinator.processIfPending(999L, RUN_ID)).isFalse();

        verifyAnalysed(0);
    }

    @Test
    void aRunThatDoesNotExistOrWithoutAnIdIsNothing() {
        when(activities.findById(RUN_ID)).thenReturn(Optional.empty());

        assertThat(coordinator.process(RUNNER_ID, RUN_ID)).isFalse();
        assertThat(coordinator.processIfPending(RUNNER_ID, RUN_ID)).isFalse();
        assertThat(coordinator.process(null, RUN_ID)).isFalse();
        assertThat(coordinator.processIfPending(RUNNER_ID, null)).isFalse();

        verifyAnalysed(0);
    }

    @Test
    void anActivityThatIsNotARunIsClearedWhenAnalysedOnPurposeAndNeverFoundWaiting() {
        Activity ride = run(null, ActivityType.UNKNOWN);
        ride.setRouteMatchGroupId(3L);

        assertThat(coordinator.processIfPending(RUNNER_ID, RUN_ID)).isFalse();
        verify(bestEfforts, never()).clearFor(any(), any());
        assertThat(ride.getRouteMatchGroupId()).isEqualTo(3L);

        assertThat(coordinator.process(RUNNER_ID, RUN_ID)).isTrue();
        verify(bestEfforts).clearFor(eq(ride), any());
        assertThat(ride.getRouteMatchGroupId()).isNull();
        assertThat(ride.getRecordsVersion()).isEqualTo(BestEffortService.MODEL_VERSION);
        verifyAnalysed(0);
    }

    @Test
    void aRequestThatFindsTheRunAlreadyAnalysedByTheTimeItsTurnComesDoesNotDoItAgain() {
        Runner owner = runner(RUNNER_ID);
        run(BestEffortService.MODEL_VERSION, ActivityType.RUN);
        // The list of waiting runs was read before the other request finished with this one.
        when(records.findPendingRunIds(eq(RUNNER_ID), eq(ActivityType.RUN), eq(BestEffortService.MODEL_VERSION), any(Pageable.class)))
                .thenReturn(List.of(RUN_ID))
                .thenReturn(List.of());
        when(records.countPendingRuns(RUNNER_ID, ActivityType.RUN, BestEffortService.MODEL_VERSION)).thenReturn(0L);

        long waiting = coordinator.ensurePending(owner, Duration.ofSeconds(5), 10);

        assertThat(waiting).isZero();
        verifyAnalysed(0);
    }

    @Test
    void aRunNobodyHasAnalysedYetIsAnalysedByTheRequestThatFindsItWaiting() {
        Runner owner = runner(RUNNER_ID);
        run(null, ActivityType.RUN);
        when(records.findPendingRunIds(eq(RUNNER_ID), eq(ActivityType.RUN), eq(BestEffortService.MODEL_VERSION), any(Pageable.class)))
                .thenReturn(List.of(RUN_ID))
                .thenReturn(List.of());
        when(records.countPendingRuns(RUNNER_ID, ActivityType.RUN, BestEffortService.MODEL_VERSION)).thenReturn(0L);

        coordinator.ensurePending(owner, Duration.ofSeconds(5), 10);

        verifyAnalysed(1);
    }

    @Test
    void ensureAnalysedDoesTheRunOnlyWhenItIsWaiting() {
        Runner owner = runner(RUNNER_ID);
        Activity waiting = run(null, ActivityType.RUN);
        when(activities.findByIdAndRunner(RUN_ID, owner)).thenReturn(Optional.of(waiting));

        coordinator.ensureAnalysed(owner, RUN_ID);
        coordinator.ensureAnalysed(owner, RUN_ID);

        verifyAnalysed(1);
    }

    @Test
    void aRunReadAsWaitingThatAnotherRequestAnalysedBeforeItsTurnIsNotDoneAgain() {
        Runner owner = runner(RUNNER_ID);
        // The copy this request read said the run was waiting; by the time it holds the lock the stored run is up to date.
        Activity staleCopy = new Activity();
        staleCopy.setId(RUN_ID);
        staleCopy.setRunner(owner);
        staleCopy.setActivityType(ActivityType.RUN);
        when(activities.findByIdAndRunner(RUN_ID, owner)).thenReturn(Optional.of(staleCopy));
        run(BestEffortService.MODEL_VERSION, ActivityType.RUN);

        coordinator.ensureAnalysed(owner, RUN_ID);

        verifyAnalysed(0);
    }

    @Test
    void aRowAnotherServerInsertedMeanwhileMeansTryingAgainOnce() {
        Activity activity = run(null, ActivityType.RUN);
        when(activities.findById(RUN_ID))
                .thenThrow(new DataIntegrityViolationException("duplicate key"))
                .thenReturn(Optional.of(activity));

        assertThat(coordinator.process(RUNNER_ID, RUN_ID)).isTrue();

        verify(activities, times(2)).findById(RUN_ID);
        verifyAnalysed(1);
    }

    @Test
    void aSecondDuplicateKeyIsNotHiddenFromTheCaller() {
        run(null, ActivityType.RUN);
        when(activities.findById(RUN_ID)).thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThatThrownBy(() -> coordinator.process(RUNNER_ID, RUN_ID)).isInstanceOf(DataIntegrityViolationException.class);

        verify(activities, times(2)).findById(RUN_ID);
        verifyAnalysed(0);
    }

    @Test
    void aBudgetThatIsUsedUpAnalysesNothingAndSaysHowManyRunsAreWaiting() {
        Runner owner = runner(RUNNER_ID);
        run(null, ActivityType.RUN);
        when(records.countPendingRuns(RUNNER_ID, ActivityType.RUN, BestEffortService.MODEL_VERSION)).thenReturn(4L);

        long waiting = coordinator.ensurePending(owner, Duration.ZERO, 10);

        assertThat(waiting).isEqualTo(4L);
        verifyAnalysed(0);
        verify(records, never()).findPendingRunIds(any(), any(), anyInt(), any(Pageable.class));
    }

    @Test
    void aRunThatCannotBeAnalysedIsMarkedDoneSoItDoesNotHoldTheRecordsUpForEver() {
        Runner owner = runner(RUNNER_ID);
        Activity broken = run(null, ActivityType.RUN);
        org.mockito.Mockito.doThrow(new IllegalStateException("bad points")).when(bestEfforts).replaceFor(any(), any(), any());
        when(records.findPendingRunIds(eq(RUNNER_ID), eq(ActivityType.RUN), eq(BestEffortService.MODEL_VERSION), any(Pageable.class)))
                .thenReturn(List.of(RUN_ID))
                .thenReturn(List.of());

        coordinator.ensurePending(owner, Duration.ofSeconds(5), 10);

        assertThat(broken.getRecordsVersion()).isEqualTo(BestEffortService.MODEL_VERSION);
    }

    @Test
    void theLimitStopsAnalysisBeforeTheListOfWaitingRunsIsEmpty() {
        Runner owner = runner(RUNNER_ID);
        run(null, ActivityType.RUN);
        when(records.findPendingRunIds(eq(RUNNER_ID), eq(ActivityType.RUN), eq(BestEffortService.MODEL_VERSION), any(Pageable.class)))
                .thenReturn(List.of(RUN_ID));
        when(records.countPendingRuns(RUNNER_ID, ActivityType.RUN, BestEffortService.MODEL_VERSION)).thenReturn(12L);

        long waiting = coordinator.ensurePending(owner, Duration.ofSeconds(5), 1);

        assertThat(waiting).isEqualTo(12L);
        verify(records, times(1)).findPendingRunIds(any(), any(), anyInt(), any(Pageable.class));
        verifyAnalysed(1);
    }
}
