package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityEditedEvent;
import com.hermes.backend.activity.ActivityIngestedEvent;
import com.hermes.backend.activity.ActivityPointsStoredEvent;
import com.hermes.backend.runner.RunnerZonesChangedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Keeps a run's effort score and zone times in step with what happens to the run: it is ingested, its
 * heart-rate stream arrives, the runner rates it, or the zones change.
 *
 * <p>Every handler is allowed to fail quietly. The numbers are derived, and they are computed again when
 * the run is opened, so a failure here must never undo or delay the import or the edit that caused it.</p>
 */
@Component
class TrainingMetricsListener {

    private static final Logger log = LoggerFactory.getLogger(TrainingMetricsListener.class);

    private final TrainingMetricsService service;
    private final TrainingMetricsRecomputeService recompute;
    private final TrainingMetricsExecutors executors;

    TrainingMetricsListener(TrainingMetricsService service,
                            TrainingMetricsRecomputeService recompute,
                            TrainingMetricsExecutors executors) {
        this.service = service;
        this.recompute = recompute;
        this.executors = executors;
    }

    /** After commit, so the run's points (saved in the same transaction by file imports) are there to read. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onActivityIngested(ActivityIngestedEvent event) {
        executors.ingest(() -> compute(event.runnerId(), event.activityId()));
    }

    /** A Strava run is ingested before its stream is fetched; this is the second chance, with the stream. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onPointsStored(ActivityPointsStoredEvent event) {
        executors.ingest(() -> compute(event.runnerId(), event.activityId()));
    }

    /**
     * Runs on the editing request itself, so the runner's next read of the run already shows the new
     * score. The edit has been saved by then.
     */
    @EventListener
    void onActivityEdited(ActivityEditedEvent event) {
        if (event.fields().contains(ActivityEditedEvent.PERCEIVED_EXERTION)) {
            compute(event.runnerId(), event.activityId());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onZonesChanged(RunnerZonesChangedEvent event) {
        recompute.queue(event.runnerId());
    }

    private void compute(Long runnerId, Long activityId) {
        try {
            service.computeAndStore(runnerId, activityId);
        } catch (RuntimeException failure) {
            log.warn("Training metrics for activity {} were not computed ({})", activityId, failure.getClass().getSimpleName());
        }
    }
}
