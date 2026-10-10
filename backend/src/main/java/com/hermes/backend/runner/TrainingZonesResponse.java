package com.hermes.backend.runner;

import java.util.ArrayList;
import java.util.List;

/**
 * The zone settings screen's view of a runner's heart-rate zones.
 *
 * @param suggestedMaxHeartRate a max heart rate the runner's own runs point to; null when there are too few runs
 * @param recomputeQueued       true when the zones just changed and the runner's past runs are being recomputed;
 *                              null on a plain read
 */
public record TrainingZonesResponse(MaxHeartRate maxHeartRate, TrainingZonesService.MaxHeartRateSuggestion suggestedMaxHeartRate,
                                    HeartRate heartRate, Limits limits, Boolean recomputeQueued) {

    /** @param source PROFILE when the runner set it, DEFAULT when Hermes is assuming 190 */
    public record MaxHeartRate(int bpm, String source) {
    }

    /**
     * @param source             AUTO (percentages of the max heart rate) or MANUAL (the runner's own boundaries)
     * @param boundaries         the first bpm of zones 2 to 5
     * @param defaultBoundaries  what the automatic boundaries would be for this max heart rate
     */
    public record HeartRate(String source, List<Integer> boundaries, List<Integer> defaultBoundaries, List<Zone> zones) {
    }

    /** @param fromBpm null for zone 1; @param toBpm null for zone 5 */
    public record Zone(int zone, Integer fromBpm, Integer toBpm) {
    }

    public record Limits(int minMaxHeartRate, int maxMaxHeartRate, int defaultMaxHeartRate, int minBoundary, int maxBoundary) {
    }

    static TrainingZonesResponse of(TrainingZonesService.ResolvedZones resolved,
                                    TrainingZonesService.MaxHeartRateSuggestion suggestion,
                                    int[] defaultBoundaries,
                                    Boolean recomputeQueued) {
        HeartRateZones zones = resolved.zones();
        List<Zone> zoneList = new ArrayList<>(HeartRateZones.ZONE_COUNT);
        for (int i = 0; i < HeartRateZones.ZONE_COUNT; i++) {
            Integer from = i == 0 ? null : zones.boundary(i - 1);
            Integer to = i == HeartRateZones.BOUNDARY_COUNT ? null : zones.boundary(i) - 1;
            zoneList.add(new Zone(i + 1, from, to));
        }
        return new TrainingZonesResponse(
                new MaxHeartRate(zones.maxHeartRate(), resolved.maxHeartRateSource()),
                suggestion,
                new HeartRate(resolved.boundarySource(), boxed(zones.boundaries()), boxed(defaultBoundaries), zoneList),
                new Limits(HeartRateZones.MIN_MAX_HEART_RATE, HeartRateZones.MAX_MAX_HEART_RATE,
                        HeartRateZones.DEFAULT_MAX_HEART_RATE, HeartRateZones.MIN_BOUNDARY, HeartRateZones.MAX_BOUNDARY),
                recomputeQueued);
    }

    private static List<Integer> boxed(int[] values) {
        List<Integer> boxed = new ArrayList<>(values.length);
        for (int value : values) {
            boxed.add(value);
        }
        return boxed;
    }
}
