package com.hermes.backend.activity;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Analyses a run for its best efforts and its route when it is ingested, and again when its stream arrives (a Strava run
 * is saved before its stream is fetched).
 *
 * <p>Every handler is allowed to fail quietly. The records are derived and are worked out again when they are read, so a
 * failure here must never undo or delay the import that caused it.</p>
 */
@Component
class RunRecordsListener {

    private static final Logger log = LoggerFactory.getLogger(RunRecordsListener.class);

    private final RunRecordsCoordinator coordinator;
    private final RunRecordsExecutors executors;

    RunRecordsListener(RunRecordsCoordinator coordinator, RunRecordsExecutors executors) {
        this.coordinator = coordinator;
        this.executors = executors;
    }

    /** After commit, so the run's points (saved in the same transaction by file imports) are there to read. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onActivityIngested(ActivityIngestedEvent event) {
        executors.ingest(() -> analyse(event.runnerId(), event.activityId()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onPointsStored(ActivityPointsStoredEvent event) {
        executors.ingest(() -> analyse(event.runnerId(), event.activityId()));
    }

    private void analyse(Long runnerId, Long activityId) {
        try {
            coordinator.process(runnerId, activityId);
        } catch (RuntimeException failure) {
            log.warn("Records of activity {} were not worked out ({})", activityId, failure.getClass().getSimpleName());
        }
    }
}
