package com.hermes.backend.imports;

import java.util.List;

/**
 * The average and the highest heart rate of a track, for the files that carry heart rate only as a reading on each
 * point (GPX, TCX). A FIT file gives its own session summary; these two give none, so the run page showed "--" for both
 * and the max-heart-rate suggestion, which reads the summary, never had anything to go on.
 *
 * <p>The average is weighted by time: a watch records at the pace of the run, not of the clock, and a plain mean of
 * readings would lean towards the stretches where the points are closest together. A gap longer than
 * {@value #LONGEST_COUNTED_GAP_SECONDS} s (a pause, a lost signal) counts for that long at the reading before it, no more.
 * Readings that no heart could produce (strap noise) are left out.</p>
 */
record HeartRateSummary(double average, double max) {

    private static final int MIN_BPM = 30;
    private static final int MAX_BPM = 230;
    static final int LONGEST_COUNTED_GAP_SECONDS = 30;

    /** The summary of a track, or null when it holds no usable heart rate. */
    static HeartRateSummary of(List<ParsedTrackPoint> points) {
        if (points == null || points.isEmpty()) {
            return null;
        }
        double weightedSum = 0;
        double weight = 0;
        double plainSum = 0;
        int count = 0;
        int max = 0;
        for (int i = 0; i < points.size(); i++) {
            Integer heartRate = points.get(i).heartRate();
            if (heartRate == null || heartRate < MIN_BPM || heartRate > MAX_BPM) {
                continue;
            }
            count++;
            plainSum += heartRate;
            max = Math.max(max, heartRate);
            int seconds = secondsUntilNextTimedPoint(points, i);
            weightedSum += (double) heartRate * seconds;
            weight += seconds;
        }
        if (count == 0) {
            return null;
        }
        double average = weight > 0 ? weightedSum / weight : plainSum / count;
        return new HeartRateSummary(Math.round(average * 10.0) / 10.0, max);
    }

    private static int secondsUntilNextTimedPoint(List<ParsedTrackPoint> points, int index) {
        Integer from = points.get(index).elapsedSeconds();
        if (from == null) {
            return 0;
        }
        for (int next = index + 1; next < points.size(); next++) {
            Integer to = points.get(next).elapsedSeconds();
            if (to != null) {
                return Math.max(0, Math.min(LONGEST_COUNTED_GAP_SECONDS, to - from));
            }
        }
        return 0;
    }
}
