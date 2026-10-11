package com.hermes.backend.activity;

import com.hermes.backend.activity.BestEffortDistances.Distance;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * The fastest continuous stretch of each standard distance inside one run: the window of that many metres that took the
 * least elapsed time. Pure: no database, no clock.
 *
 * <p>The run is treated as a straight line between readings. Distance is then a piecewise linear function of time, and the
 * time a window takes, {@code arrival(s + D) - departure(s)}, is piecewise linear in where it starts, {@code s}. Its
 * smallest value is therefore at a breakpoint: a window that starts at a reading, or one that ends at a reading. Both
 * kinds are tried, so the answer is exact for the stream and does not depend on where the readings happen to fall (a
 * search that only starts windows at readings misses a window whose fast stretch ends at a reading).</p>
 *
 * <p>Standing still is part of a window when it happens inside it, and is not when it happens at its edge: a window
 * starts when the runner leaves a spot (the last reading there) and ends when the runner arrives (the first reading at
 * the end).</p>
 *
 * <p>Two guards keep a GPS glitch from becoming a record:</p>
 * <ul>
 *   <li>a window faster than 10 m/s on average (1:40 per km) is not an effort, and neither is a window that takes in
 *       a single stretch between two readings covered faster than 12.5 m/s, which is the position jumping and not a
 *       runner;</li>
 *   <li>under a kilometre the window is located to the nearest reading, so with readings more than 15 s apart (median)
 *       the short distances are not worked out at all.</li>
 * </ul>
 */
final class BestEffortCalculator {

    /** The fastest a window may be on average, m/s: a 1:40 per km pace. */
    static final double FASTEST_PLAUSIBLE_SPEED_MPS = 10.0;
    /** A stretch between two readings covered faster than this is a jump of the position, m/s. */
    static final double MAX_SEGMENT_SPEED_MPS = 12.5;
    /** Distances shorter than this need readings close together. */
    static final double SHORT_DISTANCE_METERS = 1000.0;
    static final double MAX_MEDIAN_INTERVAL_SECONDS = 15.0;

    private static final double EPSILON = 1e-6;

    /** @param startOffsetSeconds and @param endOffsetSeconds where the window sits in the run, seconds from its first reading */
    record Effort(String key, double distanceMeters, double elapsedSeconds, int startOffsetSeconds, int endOffsetSeconds) {
    }

    private BestEffortCalculator() {
    }

    /** The efforts the stream is long enough for, in the order of {@code distances}. Empty for an unusable stream. */
    static List<Effort> compute(RunStream stream, List<Distance> distances) {
        if (stream == null || !stream.usable()) {
            return List.of();
        }
        Nodes nodes = Nodes.of(stream);
        if (nodes.m < 2) {
            return List.of();
        }
        double medianInterval = medianInterval(stream.t(), stream.n());
        List<Effort> efforts = new ArrayList<>();
        for (Distance distance : distances) {
            if (distance.meters() > nodes.span() + EPSILON) {
                continue;
            }
            if (distance.meters() < SHORT_DISTANCE_METERS && medianInterval > MAX_MEDIAN_INTERVAL_SECONDS) {
                continue;
            }
            Effort best = best(nodes, distance);
            if (best != null) {
                efforts.add(best);
            }
        }
        return efforts;
    }

    private static Effort best(Nodes nodes, Distance distance) {
        double length = distance.meters();
        double span = nodes.span();
        double shortest = Double.POSITIVE_INFINITY;
        double bestStart = 0;
        double bestEnd = 0;
        for (int k = 0; k < nodes.m; k++) {
            for (double candidate : new double[] {nodes.distance[k], nodes.distance[k] - length}) {
                double start = Math.max(0.0, Math.min(candidate, span - length));
                if (Math.abs(start - candidate) > EPSILON * Math.max(1.0, span)) {
                    continue; // the window would start before the run or end after it
                }
                double end = start + length;
                if (nodes.overlapsJump(start, end)) {
                    continue;
                }
                double leaves = nodes.departure(start);
                double arrives = nodes.arrival(end);
                double elapsed = arrives - leaves;
                if (!(elapsed > 0) || length / elapsed > FASTEST_PLAUSIBLE_SPEED_MPS) {
                    continue;
                }
                if (elapsed < shortest) {
                    shortest = elapsed;
                    bestStart = leaves;
                    bestEnd = arrives;
                }
            }
        }
        if (Double.isInfinite(shortest)) {
            return null;
        }
        return new Effort(distance.key(), length, Math.round(shortest * 10.0) / 10.0,
                (int) Math.round(bestStart), (int) Math.round(bestEnd));
    }

    private static double medianInterval(double[] t, int n) {
        double[] gaps = new double[n - 1];
        for (int i = 1; i < n; i++) {
            gaps[i - 1] = t[i] - t[i - 1];
        }
        Arrays.sort(gaps);
        return gaps[gaps.length / 2];
    }

    /**
     * The stream as places the runner stood on the way: one node per distance, with the time they arrived (the first
     * reading there) and the time they left (the last). Between two nodes the runner moves in a straight line from the
     * leaving time to the next arrival time.
     */
    private static final class Nodes {
        final int m;
        final double[] distance;
        final double[] arrive;
        final double[] leave;
        /** jumps[k] = how many of the stretches before node k (from node 0) are position jumps. */
        final int[] jumps;

        private Nodes(int m, double[] distance, double[] arrive, double[] leave, int[] jumps) {
            this.m = m;
            this.distance = distance;
            this.arrive = arrive;
            this.leave = leave;
            this.jumps = jumps;
        }

        static Nodes of(RunStream stream) {
            int n = stream.n();
            double[] distance = new double[n];
            double[] arrive = new double[n];
            double[] leave = new double[n];
            int m = 0;
            for (int i = 0; i < n; i++) {
                double d = stream.d()[i];
                double t = stream.t()[i];
                if (m > 0 && d == distance[m - 1]) {
                    leave[m - 1] = t;
                } else {
                    distance[m] = d;
                    arrive[m] = t;
                    leave[m] = t;
                    m++;
                }
            }
            int[] jumps = new int[m];
            for (int k = 1; k < m; k++) {
                double seconds = arrive[k] - leave[k - 1];
                boolean jump = seconds <= 0 || (distance[k] - distance[k - 1]) / seconds > MAX_SEGMENT_SPEED_MPS;
                jumps[k] = jumps[k - 1] + (jump ? 1 : 0);
            }
            return new Nodes(m, distance, arrive, leave, jumps);
        }

        double span() {
            return distance[m - 1] - distance[0];
        }

        /** True when the window from {@code start} to {@code end} metres takes in a stretch that is a position jump. */
        boolean overlapsJump(double start, double end) {
            int first = floor(start);              // the stretch that holds the start is after this node
            int last = lowerBound(end);            // the stretch that holds the end is before this node
            if (first < 0) {
                first = 0;
            }
            if (last >= m) {
                last = m - 1;
            }
            return last > first && jumps[last] - jumps[first] > 0;
        }

        /** When the runner was first at {@code x} metres. */
        double arrival(double x) {
            int k = lowerBound(x);
            if (k <= 0) {
                return arrive[0];
            }
            if (k >= m) {
                return arrive[m - 1];
            }
            if (distance[k] == x) {
                return arrive[k];
            }
            double fraction = (x - distance[k - 1]) / (distance[k] - distance[k - 1]);
            return leave[k - 1] + fraction * (arrive[k] - leave[k - 1]);
        }

        /** When the runner was last at {@code s} metres. */
        double departure(double s) {
            int j = floor(s);
            if (j < 0) {
                return leave[0];
            }
            if (j >= m - 1 || distance[j] == s) {
                return leave[Math.min(j, m - 1)];
            }
            double fraction = (s - distance[j]) / (distance[j + 1] - distance[j]);
            return leave[j] + fraction * (arrive[j + 1] - leave[j]);
        }

        /** The first node at or beyond {@code x}; {@code m} when there is none. */
        private int lowerBound(double x) {
            int low = 0;
            int high = m;
            while (low < high) {
                int middle = (low + high) >>> 1;
                if (distance[middle] < x) {
                    low = middle + 1;
                } else {
                    high = middle;
                }
            }
            return low;
        }

        /** The last node at or before {@code x}; -1 when there is none. */
        private int floor(double x) {
            int low = 0;
            int high = m;
            while (low < high) {
                int middle = (low + high) >>> 1;
                if (distance[middle] <= x) {
                    low = middle + 1;
                } else {
                    high = middle;
                }
            }
            return low - 1;
        }
    }
}
