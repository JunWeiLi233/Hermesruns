package com.hermes.backend.coaching;

import com.hermes.backend.runner.HeartRateZones;

/**
 * Time in each heart-rate zone for one run, from its heart-rate samples.
 *
 * <p>Each sample stands for the time until the next one, capped at {@value #MAX_SAMPLE_GAP_SECONDS} s so a
 * pause (the watch kept recording, or the file has a hole) does not count as time in a zone. Heart rates
 * outside {@value #MIN_VALID_BPM}-{@value #MAX_VALID_BPM} bpm are sensor errors and count for nothing.</p>
 *
 * <p>Also returns the weighted minutes behind the effort score: each minute counts 1 to 5 for the zone
 * it was spent in (the Edwards TRIMP weighting), and a minute below half of max heart rate counts 0.</p>
 */
final class HrZoneAnalysis {

    static final int MAX_SAMPLE_GAP_SECONDS = 30;
    static final int MIN_VALID_BPM = 30;
    static final int MAX_VALID_BPM = HeartRateZones.MAX_MAX_HEART_RATE;

    private HrZoneAnalysis() {
    }

    /**
     * @param zoneSeconds     measured seconds in zones 1 to 5, fractional until the caller rounds them
     * @param coveredSeconds  seconds the valid samples stand for, the sum of {@code zoneSeconds}
     * @param weightedMinutes minutes weighted 1 to 5 by zone, counting only heart rates at or above the effort floor
     */
    record Result(double[] zoneSeconds, double coveredSeconds, double weightedMinutes) {

        static Result empty() {
            return new Result(new double[HeartRateZones.ZONE_COUNT], 0, 0);
        }

        boolean hasSamples() {
            return coveredSeconds > 0;
        }
    }

    /**
     * @param elapsedSeconds seconds from the start of the run for each sample, in sample order
     * @param heartRates     beats per minute for each sample
     * @param count          how many leading entries of the arrays are samples
     */
    static Result analyze(int[] elapsedSeconds, int[] heartRates, int count, HeartRateZones zones) {
        if (count <= 0) {
            return Result.empty();
        }
        double[] zoneSeconds = new double[HeartRateZones.ZONE_COUNT];
        double covered = 0;
        double weighted = 0;
        int floor = zones.effortFloorBpm();
        int lastGap = 1;
        for (int i = 0; i < count; i++) {
            int gap = i + 1 < count ? elapsedSeconds[i + 1] - elapsedSeconds[i] : lastGap;
            if (gap <= 0) {
                continue;
            }
            gap = Math.min(gap, MAX_SAMPLE_GAP_SECONDS);
            lastGap = gap;
            int bpm = heartRates[i];
            if (bpm < MIN_VALID_BPM || bpm > MAX_VALID_BPM) {
                continue;
            }
            int zone = zones.zoneIndexFor(bpm);
            zoneSeconds[zone] += gap;
            covered += gap;
            if (bpm >= floor) {
                weighted += (gap / 60.0) * (zone + 1);
            }
        }
        return new Result(zoneSeconds, covered, weighted);
    }
}
