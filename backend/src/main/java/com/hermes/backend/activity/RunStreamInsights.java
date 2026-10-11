package com.hermes.backend.activity;

import java.util.List;
import org.springframework.stereotype.Service;

/**
 * What a run's stored stream says, for callers outside this package (the run summary): the pace profile and the heart-rate
 * drift. The calculators stay package-private; this is the one door. Nothing is stored: both are worked out from the run's
 * points on each call, with one read of them.
 */
@Service
public class RunStreamInsights {

    /**
     * How much more heart rate the second half of a run took for the same pace as the first (see
     * {@code ActivityAnalyticsHelper.computeCardiacDrift}): positive when the second half was less efficient.
     *
     * @param percent                 the drop in efficiency, pace per heartbeat, from the first half to the second
     * @param firstHalfHeartRate      the average heart rate of the first half of the distance
     * @param secondHalfHeartRate     the average heart rate of the second half
     */
    public record Drift(double percent, double firstHalfHeartRate, double secondHalfHeartRate) {
    }

    /**
     * @param paceProfile the run's pace profile, one that says why it has no stream when it has none
     * @param drift       null when the run has no usable heart rate or distance stream
     */
    public record Readings(PaceProfileResponse paceProfile, Drift drift) {
    }

    private final ActivityDataAccess activityData;

    public RunStreamInsights(ActivityDataAccess activityData) {
        this.activityData = activityData;
    }

    /** The pace profile and the drift of one run, from one read of its points. */
    public Readings read(Activity activity) {
        List<Object[]> rows = activityData.findAnalyticsSamplesByActivityId(activity.getId());
        RunStream.Samples samples = RunStream.samples(rows, activity);
        PaceProfileResponse profile = samples.problem() != null
                ? PaceProfileResponse.noStream(samples.problem())
                : PaceProfileCalculator.compute(samples.points());
        return new Readings(profile, drift(rows, activity));
    }

    private static Drift drift(List<Object[]> rows, Activity activity) {
        if (rows.isEmpty()) {
            return null;
        }
        ActivityAnalyticsHelper.CardiacDrift drift = ActivityAnalyticsHelper.computeCardiacDrift(
                ActivityTelemetryResponseBuilder.buildAnalyticsSamplePoints(rows, activity));
        return drift == null ? null : new Drift(drift.driftPercent(), drift.firstHalfAverageHeartRate(), drift.secondHalfAverageHeartRate());
    }
}
