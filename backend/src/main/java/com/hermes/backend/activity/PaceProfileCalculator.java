package com.hermes.backend.activity;

import com.hermes.backend.activity.ActivityAnalyticsHelper.SamplePoint;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.Function;

/**
 * Works a run's stream of time, distance and elevation into splits, a smoothed pace line and grade-adjusted paces.
 * Pure: no database, no clock. The formulas and the numbers below are written up in docs/README-ANALYSIS.md.
 *
 * <p>The stream is first tidied: readings with no time or distance are dropped, a reading that goes back in time or
 * distance is dropped, and two readings in the same second become one. Then, along the run:</p>
 * <ul>
 *   <li><b>Moving time and distance.</b> A stretch between two readings counts as running when it was covered at 0.5 m/s
 *       or more. Standing at a crossing or a pause by the watch is left out of every pace, both its seconds and the
 *       metres a watch drifts while standing, so a pace is moving seconds over metres run.</li>
 *   <li><b>Grade.</b> Elevation is cleaned (median of five readings, then an average over 40 m of the run) and the grade
 *       at a point is the rise over the 80 m around it, so a GPS altitude that jumps a few metres does not read as a
 *       hill. Beyond 30% it counts as 30%.</li>
 *   <li><b>Grade-adjusted pace.</b> Each stretch is worth {@link GradeAdjustedPace#costRatio} times its length in
 *       flat-equivalent metres, so a split's grade-adjusted pace is its moving seconds per flat-equivalent kilometre.</li>
 * </ul>
 */
final class PaceProfileCalculator {

    /** Slower than this over a stretch and the runner is counted as standing still, m/s. */
    static final double STOPPED_SPEED_MPS = 0.5;
    /** A pace outside this range, of a split or of the smoothed line, is a GPS jump or a crawl, not a pace, s/km. */
    static final double FASTEST_PLAUSIBLE_PACE = 100.0;
    static final double SLOWEST_PLAUSIBLE_PACE = 1800.0;
    static final double SPLIT_METERS = 1000.0;
    /** What is left after the last full kilometre only counts as a split if it is at least this long. */
    static final double MIN_PARTIAL_SPLIT_METERS = 100.0;
    /** A stream shorter than this has no profile. It is also the shortest leftover that counts as a split, so every profile has a split. */
    static final double MIN_STREAM_METERS = 100.0;
    static final double MIN_STREAM_SECONDS = 10.0;
    /** Elevation is averaged over this far each side of a point. */
    static final double ELEVATION_HALF_WINDOW_METERS = 20.0;
    /** Grade is the rise over this far each side of a point. */
    static final double GRADE_HALF_WINDOW_METERS = 40.0;
    static final int MEDIAN_WINDOW = 5;
    /** Elevation must be there for at least this many readings and this share of the stream, over this much distance. */
    static final int MIN_ELEVATION_READINGS = 10;
    static final double MIN_ELEVATION_COVERAGE = 0.8;
    static final double MIN_ELEVATION_SPAN_METERS = 200.0;
    /** The smoothed series has about this many samples, however long the run. */
    static final int TARGET_SERIES_POINTS = 600;
    static final int MIN_STEP_SECONDS = 5;
    static final int MIN_WINDOW_SECONDS = 30;
    /** A window shorter than this has not moved, so it has no pace. */
    static final double MIN_WINDOW_METERS = 3.0;

    private PaceProfileCalculator() {
    }

    /**
     * @param points the run's samples in order, with distance and elapsed seconds already filled in the way
     *               {@link ActivityAnalyticsHelper#normalizeSamples} does
     */
    static PaceProfileResponse compute(List<SamplePoint> points) {
        Track track = Track.of(points);
        if (track == null) {
            return PaceProfileResponse.noStream();
        }
        int n = track.n();
        double[] t = track.t();
        double[] d = track.d();
        Terrain terrain = Terrain.of(track);

        // Running totals along the stream, counting only the stretches that were run: seconds, metres, and the
        // metres worked out as flat-equivalent. The three always cover the same stretches, so a pace and its
        // grade-adjusted pace differ only by the grade.
        double[] moving = new double[n];
        double[] runMeters = new double[n];
        double[] equivalent = new double[n];
        for (int i = 1; i < n; i++) {
            double seconds = t[i] - t[i - 1];
            double meters = d[i] - d[i - 1];
            boolean running = meters / seconds >= STOPPED_SPEED_MPS;
            double ratio = terrain == null ? 1.0 : GradeAdjustedPace.costRatio(terrain.grade((d[i - 1] + d[i]) / 2.0));
            moving[i] = moving[i - 1] + (running ? seconds : 0.0);
            runMeters[i] = runMeters[i - 1] + (running ? meters : 0.0);
            equivalent[i] = equivalent[i - 1] + (running ? meters * ratio : 0.0);
        }

        double distance = d[n - 1];
        double elapsed = t[n - 1];
        double movingSeconds = moving[n - 1];

        List<PaceProfileResponse.Split> splits = splits(d, moving, runMeters, equivalent, n, distance, terrain);
        PaceProfileResponse.Summary summary = new PaceProfileResponse.Summary(
                round1(distance),
                round1(elapsed),
                round1(movingSeconds),
                round1(elapsed - movingSeconds),
                paceOf(movingSeconds, runMeters[n - 1]),
                terrain == null ? null : paceOf(movingSeconds, equivalent[n - 1]));

        PaceProfileResponse.Marker paceMarker = marker(splits, PaceProfileResponse.Split::paceSecPerKm);
        PaceProfileResponse.Marker gapMarker = marker(splits, PaceProfileResponse.Split::gapSecPerKm);
        PaceProfileResponse.Markers markers = paceMarker == null && gapMarker == null
                ? null
                : new PaceProfileResponse.Markers(paceMarker, gapMarker);

        return new PaceProfileResponse(true, terrain != null, summary, splits, markers,
                series(t, d, moving, runMeters, equivalent, n, terrain));
    }

    // ----- splits -----

    private static List<PaceProfileResponse.Split> splits(double[] d, double[] moving, double[] runMeters,
                                                          double[] equivalent, int n, double distance, Terrain terrain) {
        List<PaceProfileResponse.Split> splits = new ArrayList<>();
        int full = (int) Math.floor(distance / SPLIT_METERS + 1e-9);
        for (int k = 1; k <= full; k++) {
            splits.add(split(k, (k - 1) * SPLIT_METERS, Math.min(k * SPLIT_METERS, distance), false,
                    d, moving, runMeters, equivalent, n, terrain));
        }
        double rest = distance - full * SPLIT_METERS;
        if (rest >= MIN_PARTIAL_SPLIT_METERS) {
            splits.add(split(full + 1, full * SPLIT_METERS, distance, true, d, moving, runMeters, equivalent, n, terrain));
        }
        return splits;
    }

    /**
     * A split is cut where the stream's distance crosses a kilometre; its pace is over the metres run inside it, and it
     * has none when that is not a pace a runner could have (see {@link #plausiblePace}).
     */
    private static PaceProfileResponse.Split split(int index, double from, double to, boolean partial, double[] d,
                                                   double[] moving, double[] runMeters, double[] equivalent, int n,
                                                   Terrain terrain) {
        double seconds = interpolate(d, moving, n, to) - interpolate(d, moving, n, from);
        double metersRun = interpolate(d, runMeters, n, to) - interpolate(d, runMeters, n, from);
        double flatMeters = interpolate(d, equivalent, n, to) - interpolate(d, equivalent, n, from);
        Double pace = plausiblePace(seconds, metersRun);
        Double gap = pace != null && terrain != null && flatMeters > 0
                ? Double.valueOf(round1(seconds / (flatMeters / 1000.0)))
                : null;
        Double elevationChange = terrain == null ? null : Double.valueOf(round1(terrain.at(to) - terrain.at(from)));
        return new PaceProfileResponse.Split(index, round1(to - from), round1(seconds), pace, gap, elevationChange, partial);
    }

    /** The fastest and the slowest full split by one measure; null if fewer than two have it or they are the same. */
    private static PaceProfileResponse.Marker marker(List<PaceProfileResponse.Split> splits,
                                                     Function<PaceProfileResponse.Split, Double> measure) {
        PaceProfileResponse.Split fastest = null;
        PaceProfileResponse.Split slowest = null;
        int counted = 0;
        for (PaceProfileResponse.Split split : splits) {
            Double value = measure.apply(split);
            if (split.partial() || value == null) {
                continue;
            }
            counted++;
            if (fastest == null || value < measure.apply(fastest)) {
                fastest = split;
            }
            if (slowest == null || value > measure.apply(slowest)) {
                slowest = split;
            }
        }
        if (counted < 2 || fastest == slowest) {
            return null;
        }
        return new PaceProfileResponse.Marker(fastest.index(), slowest.index());
    }

    // ----- the smoothed series -----

    private static PaceProfileResponse.Series series(double[] t, double[] d, double[] moving, double[] runMeters,
                                                     double[] equivalent, int n, Terrain terrain) {
        double total = t[n - 1];
        int step = Math.max(MIN_STEP_SECONDS, roundUpToFive((int) Math.ceil(total / TARGET_SERIES_POINTS)));
        int window = Math.max(MIN_WINDOW_SECONDS, 3 * step);
        int count = (int) Math.floor(total / step) + 1;

        List<Integer> times = new ArrayList<>(count);
        List<Double> distances = new ArrayList<>(count);
        List<Double> paces = new ArrayList<>(count);
        List<Double> gaps = new ArrayList<>(count);
        List<Double> elevations = new ArrayList<>(count);

        for (int k = 0; k < count; k++) {
            double at = (double) k * step;
            double from = Math.max(0.0, at - window / 2.0);
            double to = Math.min(total, at + window / 2.0);
            double meters = interpolate(t, runMeters, n, to) - interpolate(t, runMeters, n, from);
            double seconds = interpolate(t, moving, n, to) - interpolate(t, moving, n, from);

            Double pace = meters >= MIN_WINDOW_METERS ? plausiblePace(seconds, meters) : null;
            Double gap = null;
            if (pace != null && terrain != null) {
                double flatMeters = interpolate(t, equivalent, n, to) - interpolate(t, equivalent, n, from);
                if (flatMeters > 0) {
                    gap = round1(seconds / (flatMeters / 1000.0));
                }
            }
            double distanceHere = interpolate(t, d, n, at);
            times.add(k * step);
            distances.add(Math.round(distanceHere) / 1000.0);
            paces.add(pace);
            gaps.add(gap);
            elevations.add(terrain == null ? null : round1(terrain.at(distanceHere)));
        }
        return new PaceProfileResponse.Series(step, window, times, distances, paces, gaps, elevations);
    }

    // ----- the cleaned stream -----

    /** Time and distance from the first reading, and elevation where there was one (NaN where there was none). */
    private record Track(double[] t, double[] d, double[] z, int n) {

        static Track of(List<SamplePoint> points) {
            if (points == null || points.size() < 2) {
                return null;
            }
            double[] t = new double[points.size()];
            double[] d = new double[points.size()];
            double[] z = new double[points.size()];
            int n = 0;
            for (SamplePoint p : points) {
                if (p == null || p.elapsedSeconds() == null || p.distanceMeters() == null) {
                    continue;
                }
                double time = p.elapsedSeconds();
                double distance = p.distanceMeters();
                if (!Double.isFinite(distance) || distance < 0) {
                    continue;
                }
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
            if (n < 2 || d[n - 1] - d[0] < MIN_STREAM_METERS || t[n - 1] - t[0] < MIN_STREAM_SECONDS) {
                return null;
            }
            double t0 = t[0];
            double d0 = d[0];
            double[] tt = new double[n];
            double[] dd = new double[n];
            for (int i = 0; i < n; i++) {
                tt[i] = t[i] - t0;
                dd[i] = d[i] - d0;
            }
            return new Track(tt, dd, Arrays.copyOf(z, n), n);
        }
    }

    // ----- elevation and grade -----

    /** The run's elevation after cleaning, looked up by distance along the run. */
    private static final class Terrain {
        private final double[] d;
        private final double[] z;

        private Terrain(double[] d, double[] z) {
            this.d = d;
            this.z = z;
        }

        /** Null when the stream has too little elevation to say anything about grade. */
        static Terrain of(Track track) {
            int readings = 0;
            for (int i = 0; i < track.n(); i++) {
                if (!Double.isNaN(track.z()[i])) {
                    readings++;
                }
            }
            if (readings < MIN_ELEVATION_READINGS || readings < MIN_ELEVATION_COVERAGE * track.n()) {
                return null;
            }
            double[] distance = new double[readings];
            double[] elevation = new double[readings];
            int next = 0;
            for (int i = 0; i < track.n(); i++) {
                if (!Double.isNaN(track.z()[i])) {
                    distance[next] = track.d()[i];
                    elevation[next] = track.z()[i];
                    next++;
                }
            }
            if (distance[readings - 1] - distance[0] < MIN_ELEVATION_SPAN_METERS) {
                return null;
            }
            return new Terrain(distance, average(distance, median(elevation)));
        }

        double at(double distance) {
            return interpolate(d, z, d.length, distance);
        }

        /** The slope around this distance as a fraction; 0 where there is too little elevation to tell. */
        double grade(double distance) {
            double from = Math.max(d[0], distance - GRADE_HALF_WINDOW_METERS);
            double to = Math.min(d[d.length - 1], distance + GRADE_HALF_WINDOW_METERS);
            if (to - from < 20.0) {
                return 0.0;
            }
            return (at(to) - at(from)) / (to - from);
        }

        /** Each reading becomes the median of the five around it, which removes a single wild reading. */
        private static double[] median(double[] values) {
            double[] out = new double[values.length];
            double[] window = new double[MEDIAN_WINDOW];
            int half = MEDIAN_WINDOW / 2;
            for (int i = 0; i < values.length; i++) {
                int from = Math.max(0, i - half);
                int to = Math.min(values.length - 1, i + half);
                int size = to - from + 1;
                System.arraycopy(values, from, window, 0, size);
                Arrays.sort(window, 0, size);
                out[i] = window[size / 2];
            }
            return out;
        }

        /** Each reading becomes the average of those within 20 m of it, with the window cut short at either end. */
        private static double[] average(double[] distance, double[] values) {
            int m = values.length;
            double[] prefix = new double[m + 1];
            for (int i = 0; i < m; i++) {
                prefix[i + 1] = prefix[i] + values[i];
            }
            double[] out = new double[m];
            for (int i = 0; i < m; i++) {
                double half = Math.min(ELEVATION_HALF_WINDOW_METERS,
                        Math.min(distance[i] - distance[0], distance[m - 1] - distance[i]));
                int lo = lowerBound(distance, m, distance[i] - half);
                int hi = lowerBound(distance, m, Math.nextUp(distance[i] + half)) - 1;
                out[i] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
            }
            return out;
        }
    }

    // ----- small helpers -----

    /** The first index whose value is at least {@code target}, or {@code n} when there is none. */
    private static int lowerBound(double[] x, int n, double target) {
        int lo = 0;
        int hi = n;
        while (lo < hi) {
            int mid = (lo + hi) >>> 1;
            if (x[mid] < target) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /** {@code y} at {@code target}, between the two readings of {@code x} either side of it; held at the ends. */
    private static double interpolate(double[] x, double[] y, int n, double target) {
        if (target <= x[0]) {
            return y[0];
        }
        if (target >= x[n - 1]) {
            return y[n - 1];
        }
        int hi = lowerBound(x, n, target);
        double x0 = x[hi - 1];
        double x1 = x[hi];
        if (x1 <= x0) {
            return y[hi];
        }
        return y[hi - 1] + (y[hi] - y[hi - 1]) * (target - x0) / (x1 - x0);
    }

    /**
     * Moving seconds per kilometre over these metres run. Null when nothing was run, or when the result is not a pace a
     * runner could have: a GPS jump makes one faster than 1:40, and a crawl just above the standing-still speed one
     * slower than 30:00.
     */
    private static Double plausiblePace(double seconds, double meters) {
        if (seconds < 1.0 || meters <= 0) {
            return null;
        }
        double pace = seconds / (meters / 1000.0);
        return pace >= FASTEST_PLAUSIBLE_PACE && pace <= SLOWEST_PLAUSIBLE_PACE ? Double.valueOf(round1(pace)) : null;
    }

    private static Double paceOf(double seconds, double meters) {
        if (seconds < 1.0 || meters <= 0) {
            return null;
        }
        return round1(seconds / (meters / 1000.0));
    }

    private static int roundUpToFive(int value) {
        return ((value + 4) / 5) * 5;
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
