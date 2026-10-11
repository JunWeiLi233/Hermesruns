package com.hermes.backend.activity;

import com.hermes.backend.activity.ActivityAnalyticsHelper.SamplePoint;
import java.util.Arrays;
import java.util.List;

/**
 * A run's stream tidied for analysis: time and distance counted from the first reading, in order, with no reading that
 * goes back, and elevation where there was one. Shared by the pace profile and the best efforts, so both see the same
 * run.
 *
 * <p>A reading with no time or distance is dropped, so is one that goes back in time or distance, and two readings in
 * the same second become one (the later distance wins). When the stream cannot be used, {@code problem} says why (one
 * of the reasons in {@link PaceProfileResponse}) and the arrays are null.</p>
 *
 * @param t elapsed seconds from the first reading, strictly increasing
 * @param d metres from the first reading, never decreasing
 * @param z elevation in metres, NaN where a reading has none
 * @param n how many readings are left
 */
record RunStream(double[] t, double[] d, double[] z, int n, String problem) {

    /** The samples of a run that say when they were recorded, and why there are none when they cannot be used. */
    record Samples(List<SamplePoint> points, String problem) {
    }

    private static RunStream unusable(String problem) {
        return new RunStream(null, null, null, 0, problem);
    }

    boolean usable() {
        return problem == null;
    }

    /**
     * Reads the samples out of a run's stored points, keeping only the readings that say when they were recorded. The
     * other analytics give the rest a time spread evenly along the distance, which would draw an even pace the runner
     * never ran, and for a track with no times at all (a GPX file of a route) an even pace for the whole run. A run where
     * fewer than half of the readings carry a time has no usable samples.
     *
     * @param rows the rows {@code ActivityDataAccess#findAnalyticsSamplesByActivityId} returns
     */
    static Samples samples(List<Object[]> rows, Activity activity) {
        if (rows == null || rows.size() < 2) {
            return new Samples(List.of(), PaceProfileResponse.NO_POINTS);
        }
        List<Object[]> timed = rows.stream().filter(row -> row != null && row.length > 2 && row[2] != null).toList();
        // Fewer than half of the readings (an odd count is not rounded in the track's favour) is no stream.
        if (timed.size() < 2 || timed.size() * 2 < rows.size()) {
            return new Samples(List.of(), PaceProfileResponse.NO_TIMES);
        }
        return new Samples(ActivityTelemetryResponseBuilder.buildAnalyticsSamplePoints(timed, activity), null);
    }

    /**
     * @param minMeters  a stream shorter than this (from its first reading to its last) is {@code TOO_SHORT}
     * @param minSeconds a stream that lasts less than this is {@code TOO_SHORT}
     */
    static RunStream of(List<SamplePoint> points, double minMeters, double minSeconds) {
        if (points == null || points.size() < 2) {
            return unusable(PaceProfileResponse.NO_POINTS);
        }
        double[] t = new double[points.size()];
        double[] d = new double[points.size()];
        double[] z = new double[points.size()];
        int n = 0;
        int usable = 0;
        for (SamplePoint p : points) {
            if (p == null || p.elapsedSeconds() == null || p.distanceMeters() == null) {
                continue;
            }
            double time = p.elapsedSeconds();
            double distance = p.distanceMeters();
            if (!Double.isFinite(distance) || distance < 0) {
                continue;
            }
            usable++;
            double elevation = p.elevationMeters() == null || !Double.isFinite(p.elevationMeters())
                    ? Double.NaN
                    : p.elevationMeters();
            if (n > 0) {
                if (time < t[n - 1] || distance < d[n - 1]) {
                    continue;
                }
                if (time == t[n - 1]) {
                    if (distance > d[n - 1]) {
                        d[n - 1] = distance;
                        if (!Double.isNaN(elevation)) {
                            z[n - 1] = elevation;
                        }
                    }
                    continue;
                }
            }
            t[n] = time;
            d[n] = distance;
            z[n] = elevation;
            n++;
        }
        if (usable < 2) {
            return unusable(PaceProfileResponse.NO_POINTS);
        }
        if (n < 2 || d[n - 1] - d[0] < minMeters || t[n - 1] - t[0] < minSeconds) {
            return unusable(PaceProfileResponse.TOO_SHORT);
        }
        double t0 = t[0];
        double d0 = d[0];
        double[] tt = new double[n];
        double[] dd = new double[n];
        for (int i = 0; i < n; i++) {
            tt[i] = t[i] - t0;
            dd[i] = d[i] - d0;
        }
        return new RunStream(tt, dd, Arrays.copyOf(z, n), n, null);
    }
}
