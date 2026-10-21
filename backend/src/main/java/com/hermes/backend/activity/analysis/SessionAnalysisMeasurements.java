package com.hermes.backend.activity.analysis;

import java.util.List;

/** Measurements never normalize or mutate the original samples. */
public final class SessionAnalysisMeasurements {
    /** Integration rule, not a physiological or universal data-quality threshold. */
    public static final int MAX_INTEGRATED_GAP_SECONDS = 10;
    private SessionAnalysisMeasurements() {}
    public record Sample(Integer seconds, Double distanceMeters, Integer heartRate, Integer cadence) {}
    public record Measurement(Double durationSeconds, Double elapsedDurationSeconds, Double distanceMeters,
            Double paceSecondsPerKm, Double averageHeartRate, double hrCoverageSeconds,
            double hrCoverageFraction, Double averageCadence, double cadenceCoverageSeconds,
            String measurementProvenance) {}

    public static Measurement measure(List<Sample> samples, Integer start, Integer end,
            Double duration, Double distance, String provenance) {
        Double elapsed = start != null && end != null && end >= start ? (double)(end - start) : null;
        double[] hr = integrate(samples, start, end, true), cadence = integrate(samples, start, end, false);
        return new Measurement(duration, elapsed, distance,
                duration != null && duration > 0 && distance != null && distance > 0 ? duration * 1000 / distance : null,
                hr[1] > 0 ? hr[0] / hr[1] : null, hr[1], elapsed != null && elapsed > 0 ? hr[1] / elapsed : 0,
                cadence[1] > 0 ? cadence[0] / cadence[1] : null, cadence[1], provenance);
    }
    public static Double boundaryDistance(List<Sample> samples, int start, int end) {
        Double left = null, right = null;
        Double previousDistance = null;
        Integer previousSeconds = null;
        for (Sample s : samples) {
            if (s.seconds() == null || s.distanceMeters() == null || !Double.isFinite(s.distanceMeters()) || s.distanceMeters() < 0) continue;
            if (s.seconds() >= start && s.seconds() <= end) {
                if (previousDistance != null && (s.distanceMeters() < previousDistance || s.seconds() < previousSeconds)) return null;
                previousDistance = s.distanceMeters(); previousSeconds = s.seconds();
            }
            if (s.seconds() == start) {
                if (left != null && !left.equals(s.distanceMeters())) return null;
                left = s.distanceMeters();
            }
            if (s.seconds() == end) {
                if (right != null && !right.equals(s.distanceMeters())) return null;
                right = s.distanceMeters();
            }
        }
        return left != null && right != null && right >= left ? right - left : null;
    }
    private static double[] integrate(List<Sample> samples, Integer start, Integer end, boolean hr) {
        double weighted = 0, covered = 0;
        if (start == null || end == null || end <= start) return new double[]{0, 0};
        Sample previous = null;
        for (Sample current : samples) {
            if (current.seconds() == null) { previous = null; continue; }
            if (previous != null) {
                int dt = current.seconds() - previous.seconds();
                if (dt < 0) continue; // Ignore nonmonotone samples without double-counting older windows.
                Integer a = hr ? previous.heartRate() : previous.cadence();
                Integer b = hr ? current.heartRate() : current.cadence();
                int from = Math.max(start, previous.seconds()), to = Math.min(end, current.seconds());
                if (dt > 0 && dt <= MAX_INTEGRATED_GAP_SECONDS && to > from && a != null && a > 0 && b != null && b > 0) {
                    double x = a + (b - a) * (from - previous.seconds()) / (double)dt;
                    double y = a + (b - a) * (to - previous.seconds()) / (double)dt;
                    weighted += (x + y) * .5 * (to - from); covered += to - from;
                }
            }
            previous = current;
        }
        return new double[]{weighted, covered};
    }
}
