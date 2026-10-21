package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.HeartRateZones;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * Brings the stored metrics of a runner's whole history up to date: the runs that have none yet, and the
 * runs whose row was computed with other zones, another model, or was flagged. Used when the zones change,
 * after a restart, and by the administrator's recompute job.
 *
 * <p>Runs are walked in batches by id, so a run that cannot be computed is skipped once rather than retried
 * forever, and the walk always ends. Background requests ({@link #queue}) for one runner are coalesced: a
 * request that arrives while their recompute is running makes it go round once more, which picks up zones
 * changed in the meantime. The administrator's job calls {@link #recomputeRunner} directly, so it can overlap
 * with a background pass for the same runner; that only repeats work, because {@code TrainingMetricsService}
 * writes the rows of one runner one at a time.</p>
 */
@Service
public class TrainingMetricsRecomputeService {

    private static final Logger log = LoggerFactory.getLogger(TrainingMetricsRecomputeService.class);

    /** @param recomputed runs whose row was written; @param failed runs that could not be computed */
    public record Outcome(int recomputed, int failed) {
    }

    private final ActivityTrainingMetricsRepository metrics;
    private final TrainingMetricsService service;
    private final TrainingZonesService zonesService;
    private final RunnerRepository runners;
    private final TrainingMetricsExecutors executors;
    private final int batchSize;

    /** Runners being recomputed, each mapped to whether another pass was requested while it ran. */
    private final Map<Long, Boolean> running = new HashMap<>();

    public TrainingMetricsRecomputeService(ActivityTrainingMetricsRepository metrics,
                                           TrainingMetricsService service,
                                           TrainingZonesService zonesService,
                                           RunnerRepository runners,
                                           TrainingMetricsExecutors executors,
                                           @Value("${app.training.recompute-batch:50}") int batchSize) {
        this.metrics = metrics;
        this.service = service;
        this.zonesService = zonesService;
        this.runners = runners;
        this.executors = executors;
        this.batchSize = Math.max(1, batchSize);
    }

    /** Recomputes a runner's history in the background. Asking again while it runs just makes it go round once more. */
    public void queue(Long runnerId) {
        synchronized (running) {
            if (running.containsKey(runnerId)) {
                running.put(runnerId, true);
                return;
            }
            running.put(runnerId, false);
        }
        executors.bulk(() -> runUntilQuiet(runnerId));
    }

    private void runUntilQuiet(Long runnerId) {
        boolean again;
        do {
            try {
                recomputeRunner(runnerId, false);
            } catch (RuntimeException failure) {
                log.warn("Recomputing training metrics for runner {} failed ({})", runnerId, failure.getClass().getSimpleName());
            }
            synchronized (running) {
                again = Boolean.TRUE.equals(running.get(runnerId));
                if (again) {
                    running.put(runnerId, false);
                } else {
                    running.remove(runnerId);
                }
            }
        } while (again);
    }

    /**
     * Recomputes, on the calling thread, every run of the runner that needs it.
     *
     * @param force recompute every run, not only the ones noticed as out of date
     */
    public Outcome recomputeRunner(Long runnerId, boolean force) {
        Runner runner = runners.findById(runnerId).orElse(null);
        if (runner == null) {
            return new Outcome(0, 0);
        }
        if (force) {
            metrics.markAllStale(runnerId);
        }
        HeartRateZones zones = zonesService.resolve(runner).zones();
        int recomputed = 0;
        int failed = 0;

        long after = 0;
        List<Long> ids;
        while (!(ids = metrics.findStaleActivityIds(runnerId, after, TrainingMetricsService.MODEL_VERSION,
                zones.maxHeartRate(), zones.boundary(0), zones.boundary(1), zones.boundary(2), zones.boundary(3),
                PageRequest.of(0, batchSize))).isEmpty()) {
            int[] counts = computeAll(runnerId, ids);
            recomputed += counts[0];
            failed += counts[1];
            after = ids.get(ids.size() - 1);
        }

        after = 0;
        while (!(ids = metrics.findRunIdsWithoutMetrics(runnerId, ActivityType.RUN, after,
                PageRequest.of(0, batchSize))).isEmpty()) {
            int[] counts = computeAll(runnerId, ids);
            recomputed += counts[0];
            failed += counts[1];
            after = ids.get(ids.size() - 1);
        }
        return new Outcome(recomputed, failed);
    }

    private int[] computeAll(Long runnerId, List<Long> activityIds) {
        int done = 0;
        int failed = 0;
        for (Long activityId : activityIds) {
            try {
                if (service.computeAndStore(runnerId, activityId).isPresent()) {
                    done++;
                }
            } catch (RuntimeException failure) {
                failed++;
                log.warn("Training metrics for activity {} could not be computed ({})", activityId, failure.getClass().getSimpleName());
            }
        }
        return new int[] {done, failed};
    }
}
