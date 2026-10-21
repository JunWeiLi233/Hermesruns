package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Analyses a run for its records: its best efforts and the route it took. One pass over its stored points feeds both, and
 * the run is marked with the version of the analysis that ran ({@code Activity.recordsVersion}), so a run with nothing to
 * find is not looked at again and a new version of the analysis picks up every run.
 *
 * <p>Analysing a run twice is harmless: the result is replaced. Analyses for one runner run one at a time, which keeps
 * two threads from racing to insert the same row; a second server instance is caught by the unique index and retried.</p>
 */
@Service
public class RunRecordsCoordinator {

    private static final Logger log = LoggerFactory.getLogger(RunRecordsCoordinator.class);
    private static final int LOCK_STRIPES = 64;

    private final ActivityRepository activities;
    private final ActivityRecordsRepository records;
    private final ActivityDataAccess activityData;
    private final BestEffortService bestEfforts;
    private final RouteMatchService routes;
    private final TransactionTemplate transaction;
    private final Object[] runnerLocks = new Object[LOCK_STRIPES];

    public RunRecordsCoordinator(ActivityRepository activities,
                                 ActivityRecordsRepository records,
                                 ActivityDataAccess activityData,
                                 BestEffortService bestEfforts,
                                 RouteMatchService routes,
                                 PlatformTransactionManager transactionManager) {
        this.activities = activities;
        this.records = records;
        this.activityData = activityData;
        this.bestEfforts = bestEfforts;
        this.routes = routes;
        this.transaction = new TransactionTemplate(transactionManager);
        // Each analysis is a unit of work of its own, and is often started from an after-commit callback, where the
        // transaction that just committed is still bound to the thread: joining it would write rows that never get
        // committed, so always begin a new one.
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        for (int i = 0; i < LOCK_STRIPES; i++) {
            runnerLocks[i] = new Object();
        }
    }

    /**
     * Analyses one run now, whether or not it has been analysed before: a run whose stream just arrived, or whose
     * time was edited, is analysed again.
     *
     * @param runnerId whose run it must be; nothing is done for a run that belongs to someone else
     * @return true when the run was analysed
     */
    public boolean process(Long runnerId, Long activityId) {
        return run(runnerId, activityId, false);
    }

    /**
     * Analyses one run now unless it has been analysed at the current version since the caller found it waiting: two
     * requests, or a request and the startup pass, read the same list of waiting runs and would otherwise do each run
     * twice.
     *
     * @return true when the run was analysed
     */
    public boolean processIfPending(Long runnerId, Long activityId) {
        return run(runnerId, activityId, true);
    }

    private boolean run(Long runnerId, Long activityId, boolean onlyIfPending) {
        if (runnerId == null || activityId == null) {
            return false;
        }
        synchronized (lockFor(runnerId)) {
            for (int attempt = 1; ; attempt++) {
                try {
                    return Boolean.TRUE.equals(transaction.execute(status -> analyse(runnerId, activityId, onlyIfPending)));
                } catch (DataIntegrityViolationException duplicateRow) {
                    if (attempt >= 2) {
                        throw duplicateRow;
                    }
                    log.debug("Records of activity {} were inserted concurrently; trying again", activityId);
                }
            }
        }
    }

    private Object lockFor(Long runnerId) {
        return runnerLocks[(int) Math.floorMod(runnerId, (long) LOCK_STRIPES)];
    }

    private boolean analyse(Long runnerId, Long activityId, boolean onlyIfPending) {
        Activity activity = activities.findById(activityId).orElse(null);
        if (activity == null) {
            return false;
        }
        Runner runner = activity.getRunner();
        if (runner == null || !Objects.equals(runner.getId(), runnerId)) {
            return false;
        }
        if (onlyIfPending && !isPending(activity)) {
            return false;
        }
        if (activity.getActivityType() != ActivityType.RUN) {
            bestEfforts.clearFor(activity, runner);
            activity.setRouteMatchGroupId(null);
        } else {
            // The activity was just checked to belong to this runner, which is what reading its points requires.
            List<Object[]> rows = activityData.findAnalyticsSamplesByActivityId(activityId);
            RunStream stream = null;
            RunStream.Samples samples = RunStream.samples(rows, activity);
            if (samples.problem() == null) {
                RunStream tidied = RunStream.of(samples.points(), 0.0, 0.0);
                stream = tidied.usable() ? tidied : null;
            }
            bestEfforts.replaceFor(activity, runner, stream);
            routes.assign(activity, runner, latLngsOf(rows));
        }
        activity.setRecordsVersion(BestEffortService.MODEL_VERSION);
        activities.save(activity);
        return true;
    }

    private static List<double[]> latLngsOf(List<Object[]> rows) {
        List<double[]> latLngs = new ArrayList<>(rows == null ? 0 : rows.size());
        if (rows != null) {
            for (Object[] row : rows) {
                if (row != null && row.length > 1 && row[0] instanceof Number lat && row[1] instanceof Number lon) {
                    latLngs.add(new double[] {lat.doubleValue(), lon.doubleValue()});
                }
            }
        }
        return latLngs;
    }

    /** Analyses a run now if it has not been analysed at the current version. */
    public void ensureAnalysed(Runner runner, Long activityId) {
        Optional<Activity> activity = activities.findByIdAndRunner(activityId, runner);
        if (activity.isPresent() && isPending(activity.get())) {
            processIfPending(runner.getId(), activityId);
        }
    }

    private static boolean isPending(Activity activity) {
        return activity.getActivityType() == ActivityType.RUN
                && (activity.getRecordsVersion() == null || activity.getRecordsVersion() < BestEffortService.MODEL_VERSION);
    }

    /**
     * Analyses the runner's runs that have not been, newest first, for as long as {@code budget} lasts and for at most
     * {@code limit} runs, so a page that needs complete records does not wait for a long history.
     *
     * @return how many runs are still waiting; 0 means the records are complete
     */
    public long ensurePending(Runner runner, Duration budget, int limit) {
        long deadline = System.nanoTime() + budget.toNanos();
        int attempted = 0;
        while (attempted < limit && System.nanoTime() < deadline) {
            List<Long> batch = records.findPendingRunIds(runner.getId(), ActivityType.RUN, BestEffortService.MODEL_VERSION,
                    PageRequest.of(0, Math.min(10, limit - attempted)));
            if (batch.isEmpty()) {
                return 0;
            }
            for (Long activityId : batch) {
                if (System.nanoTime() >= deadline) {
                    break;
                }
                try {
                    processIfPending(runner.getId(), activityId);
                } catch (RuntimeException failure) {
                    log.warn("Records of activity {} could not be worked out ({})", activityId, failure.getClass().getSimpleName());
                    markDone(activityId);
                }
                attempted++;
            }
        }
        return records.countPendingRuns(runner.getId(), ActivityType.RUN, BestEffortService.MODEL_VERSION);
    }

    /** A run whose analysis keeps failing is marked done so it does not hold the records up for ever. */
    private void markDone(Long activityId) {
        try {
            transaction.executeWithoutResult(status -> activities.findById(activityId).ifPresent(activity -> {
                activity.setRecordsVersion(BestEffortService.MODEL_VERSION);
                activities.save(activity);
            }));
        } catch (RuntimeException ignored) {
            // The run stays pending and is tried again on the next read.
        }
    }
}
