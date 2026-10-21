package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.HeartRateZones;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Works out, stores and refreshes the effort score and heart-rate zone times of runs (see {@link EffortModel}
 * and {@link HrZoneAnalysis}).
 *
 * <p>A run's row is recomputed whenever anything it was computed from has changed: the heart-rate stream
 * arrives, the runner rates the run, the zones or the model change, the runner's time zone moves the run to
 * another day. {@link #freshMetrics} checks that on every read, so a run is never shown with numbers that
 * belong to old zones, whether or not a background job has caught up yet.</p>
 *
 * <p>Computing the same run twice is harmless: the result is a pure function of the stored inputs, and the
 * row is replaced. Computations for one runner run one at a time, which keeps two threads from racing to
 * insert the same row; a second server instance is caught by the unique index and retried.</p>
 */
@Service
public class TrainingMetricsService {

    /** Bump when the effort model changes, so every stored row is recomputed. */
    static final int MODEL_VERSION = 1;

    private static final Logger log = LoggerFactory.getLogger(TrainingMetricsService.class);

    /** A run and its up-to-date metrics, which is what every screen about one run needs. */
    public record RunMetrics(Activity activity, ActivityTrainingMetrics metrics) {
    }
    private static final int LOCK_STRIPES = 64;

    private final ActivityRepository activities;
    private final ActivityDataAccess activityData;
    private final ActivityTrainingMetricsRepository metrics;
    private final TrainingZonesService zonesService;
    private final TransactionTemplate transaction;
    private final Object[] runnerLocks = new Object[LOCK_STRIPES];

    public TrainingMetricsService(ActivityRepository activities,
                                  ActivityDataAccess activityData,
                                  ActivityTrainingMetricsRepository metrics,
                                  TrainingZonesService zonesService,
                                  PlatformTransactionManager transactionManager) {
        this.activities = activities;
        this.activityData = activityData;
        this.metrics = metrics;
        this.zonesService = zonesService;
        this.transaction = new TransactionTemplate(transactionManager);
        // Each computation is a unit of work of its own. It is also often started from an after-commit
        // callback, where the transaction that just committed is still bound to the thread: joining it
        // would write rows that never get committed, so always begin a new one.
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        for (int i = 0; i < LOCK_STRIPES; i++) {
            runnerLocks[i] = new Object();
        }
    }

    /**
     * The metrics of one of this runner's runs, computed first if there are none yet or they are out of
     * date. Empty when the runner has no such run.
     */
    public Optional<RunMetrics> freshMetrics(Runner runner, Long activityId) {
        Optional<Activity> activity = activities.findByIdAndRunner(activityId, runner);
        if (activity.isEmpty() || activity.get().getActivityType() != ActivityType.RUN) {
            return Optional.empty();
        }
        Optional<ActivityTrainingMetrics> stored = metrics.findByActivityIdAndRunnerId(activityId, runner.getId());
        HeartRateZones zones = zonesService.resolve(runner).zones();
        if (stored.isPresent() && !isOutOfDate(stored.get(), activity.get(), runner, zones)) {
            return Optional.of(new RunMetrics(activity.get(), stored.get()));
        }
        return computeAndStore(runner.getId(), activityId).map(row -> new RunMetrics(activity.get(), row));
    }

    boolean isOutOfDate(ActivityTrainingMetrics row, Activity activity, Runner runner, HeartRateZones zones) {
        if (row.isStale() || row.getModelVersion() != MODEL_VERSION) {
            return true;
        }
        if (!sameZones(row, zones)) {
            return true;
        }
        if (!Objects.equals(row.getPerceivedExertionUsed(), ratingOf(activity))) {
            return true;
        }
        if (!Objects.equals(row.getLocalDate(), ActivityLocalDates.of(activity, runner))) {
            return true;
        }
        if (row.getHrCoveredSeconds() == 0 && activityData.hasHeartRatePoints(activity.getId())) {
            // The row was made before the run's heart-rate stream arrived and nobody has recomputed it since.
            return true;
        }
        return EffortModel.PACE_MODEL.equals(row.getEffortSource()) && calibrationScale(runner.getId()) != null;
    }

    private static boolean sameZones(ActivityTrainingMetrics row, HeartRateZones zones) {
        try {
            return row.zonesUsed().equals(zones);
        } catch (IllegalArgumentException damagedRow) {
            return false;
        }
    }

    /**
     * Computes and stores the metrics of a run, replacing any earlier row.
     *
     * @param runnerId whose run it must be; nothing is computed for a run that belongs to someone else
     * @return the stored row, or empty when there is no such run of that runner
     */
    public Optional<ActivityTrainingMetrics> computeAndStore(Long runnerId, Long activityId) {
        if (runnerId == null || activityId == null) {
            return Optional.empty();
        }
        synchronized (runnerLocks[(int) Math.floorMod(runnerId, (long) LOCK_STRIPES)]) {
            for (int attempt = 1; ; attempt++) {
                try {
                    return Optional.ofNullable(transaction.execute(status -> compute(runnerId, activityId)));
                } catch (DataIntegrityViolationException duplicateRow) {
                    if (attempt >= 2) {
                        throw duplicateRow;
                    }
                    log.debug("Training metrics for activity {} were inserted concurrently; trying again", activityId);
                }
            }
        }
    }

    private ActivityTrainingMetrics compute(Long runnerId, Long activityId) {
        Activity activity = activities.findById(activityId).orElse(null);
        if (activity == null) {
            return null;
        }
        Runner runner = activity.getRunner();
        if (runner == null || !Objects.equals(runner.getId(), runnerId)) {
            return null;
        }
        if (activity.getActivityType() != ActivityType.RUN) {
            metrics.deleteByActivityIds(List.of(activityId));
            return null;
        }

        HeartRateZones zones = zonesService.resolve(runner).zones();
        // The activity was just checked to belong to this runner, which is what reading its points requires.
        ActivityDataAccess.HeartRateStream stream = activityData.findHeartRateStream(activityId);
        HrZoneAnalysis.Result hr = HrZoneAnalysis.analyze(stream.elapsedSeconds(), stream.heartRates(), stream.size(), zones);

        EffortModel.Input input = new EffortModel.Input(movingSecondsOf(activity), distanceKmOf(activity),
                ratingOf(activity), activity.getAverageHeartRate(), hr, zones, null);
        EffortModel.Result effort = EffortModel.compute(input);
        if (EffortModel.PACE_MODEL.equals(effort.source())) {
            Double scale = calibrationScale(runnerId);
            if (scale != null) {
                effort = EffortModel.compute(new EffortModel.Input(input.movingSeconds(), input.distanceKm(),
                        input.perceivedExertion(), input.averageHeartRate(), hr, zones, scale));
            }
        }

        ActivityTrainingMetrics row = metrics.findByActivityIdAndRunnerId(activityId, runnerId)
                .orElseGet(() -> new ActivityTrainingMetrics(activity, runner));
        row.setLocalDate(ActivityLocalDates.of(activity, runner));
        row.setEffortScore(effort.score());
        row.setEffortSource(effort.source());
        row.setHrEffort(effort.hrEffort());
        row.setPaceEffort(effort.paceEffort());
        row.setZoneSeconds(roundedSeconds(hr.zoneSeconds()));
        row.setHrCoveredSeconds((int) Math.round(hr.coveredSeconds()));
        row.setZonesUsed(zones);
        row.setPerceivedExertionUsed(ratingOf(activity));
        row.setModelVersion(MODEL_VERSION);
        row.setStale(false);
        row.setComputedAt(LocalDateTime.now());
        return metrics.save(row);
    }

    /**
     * The factor that puts this runner's pace-model scores on the heart-rate scale, or null while they have
     * too few runs with both to say.
     */
    Double calibrationScale(Long runnerId) {
        List<Object[]> rows = metrics.calibrationSums(runnerId);
        if (rows.isEmpty()) {
            return null;
        }
        Object[] sums = rows.get(0);
        return EffortModel.calibrationScale(((Number) sums[0]).longValue(), ((Number) sums[1]).doubleValue(),
                ((Number) sums[2]).doubleValue());
    }

    private static int[] roundedSeconds(double[] seconds) {
        int[] rounded = new int[seconds.length];
        for (int i = 0; i < seconds.length; i++) {
            rounded[i] = (int) Math.round(seconds[i]);
        }
        return rounded;
    }

    private static Integer ratingOf(Activity activity) {
        return EffortModel.validRating(activity.getPerceivedExertion()) ? activity.getPerceivedExertion() : null;
    }

    private static double movingSecondsOf(Activity activity) {
        if (activity.getMovingTimeSeconds() > 0) {
            return activity.getMovingTimeSeconds();
        }
        Long duration = activity.getDurationSeconds();
        return duration != null && duration > 0 ? duration : 0;
    }

    private static double distanceKmOf(Activity activity) {
        if (activity.getDistanceKm() > 0) {
            return activity.getDistanceKm();
        }
        Double meters = activity.getDistanceMeters();
        return meters != null && meters > 0 ? meters / 1000.0 : 0;
    }
}
