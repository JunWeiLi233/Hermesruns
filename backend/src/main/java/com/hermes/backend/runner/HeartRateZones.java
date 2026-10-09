package com.hermes.backend.runner;

import java.util.Arrays;

/**
 * A runner's five heart-rate zones, defined by the max heart rate and four boundaries.
 *
 * <p>A boundary is the first bpm of the next zone, so zone 1 is below boundary 1, zone 2 starts at
 * boundary 1, and zone 5 starts at boundary 4 and has no upper edge. Heart rate rises with the zone
 * number.</p>
 */
public final class HeartRateZones {

    public static final int ZONE_COUNT = 5;
    public static final int BOUNDARY_COUNT = ZONE_COUNT - 1;

    /** Lowest and highest max heart rate Hermes accepts; the coach profile endpoint uses the same range. */
    public static final int MIN_MAX_HEART_RATE = 120;
    public static final int MAX_MAX_HEART_RATE = 230;
    /** Max heart rate assumed when the runner has not set one (also what the coach assumes). */
    public static final int DEFAULT_MAX_HEART_RATE = 190;
    /** The lowest bpm a boundary may be set to, and the highest. */
    public static final int MIN_BOUNDARY = 40;
    public static final int MAX_BOUNDARY = MAX_MAX_HEART_RATE;
    /** Below this share of max heart rate the effort score counts no time at all (standing, walking). */
    public static final double EFFORT_FLOOR_FRACTION = 0.50;

    /** Where the boundaries came from. */
    public static final String SOURCE_AUTO = "AUTO";
    public static final String SOURCE_MANUAL = "MANUAL";

    /** Where the max heart rate came from. */
    public static final String MAX_SOURCE_PROFILE = "PROFILE";
    public static final String MAX_SOURCE_DEFAULT = "DEFAULT";

    private final int maxHeartRate;
    private final int[] boundaries;

    public HeartRateZones(int maxHeartRate, int[] boundaries) {
        this.maxHeartRate = maxHeartRate;
        this.boundaries = Arrays.copyOf(boundaries, boundaries.length);
        String problem = validate(this.boundaries);
        if (problem != null) {
            throw new IllegalArgumentException(problem);
        }
    }

    /** The default zones for a max heart rate: boundaries at the given percentages of it, rounded. */
    public static HeartRateZones defaults(int maxHeartRate, int[] percentages) {
        int[] boundaries = new int[BOUNDARY_COUNT];
        for (int i = 0; i < BOUNDARY_COUNT; i++) {
            boundaries[i] = (int) Math.round(maxHeartRate * percentages[i] / 100.0);
        }
        return new HeartRateZones(maxHeartRate, boundaries);
    }

    /**
     * Why a set of boundaries is not acceptable, or null when it is: exactly four, each between the
     * allowed minimum and maximum, strictly increasing so that no zone is empty.
     */
    public static String validate(int[] boundaries) {
        if (boundaries == null || boundaries.length != BOUNDARY_COUNT) {
            return "Heart-rate zones need exactly " + BOUNDARY_COUNT + " boundaries.";
        }
        for (int i = 0; i < boundaries.length; i++) {
            if (boundaries[i] < MIN_BOUNDARY || boundaries[i] > MAX_BOUNDARY) {
                return "Each zone boundary must be between " + MIN_BOUNDARY + " and " + MAX_BOUNDARY + " bpm.";
            }
            if (i > 0 && boundaries[i] <= boundaries[i - 1]) {
                return "Zone boundaries must increase: each zone has to start at a higher heart rate than the one before.";
            }
        }
        return null;
    }

    public int maxHeartRate() {
        return maxHeartRate;
    }

    /** A copy of the four boundaries. */
    public int[] boundaries() {
        return Arrays.copyOf(boundaries, boundaries.length);
    }

    public int boundary(int index) {
        return boundaries[index];
    }

    /** The zone, 0 to 4, that a heart rate falls in. */
    public int zoneIndexFor(int bpm) {
        int zone = 0;
        while (zone < BOUNDARY_COUNT && bpm >= boundaries[zone]) {
            zone++;
        }
        return zone;
    }

    /** Heart rates below this do not count towards effort. */
    public int effortFloorBpm() {
        return (int) Math.round(maxHeartRate * EFFORT_FLOOR_FRACTION);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof HeartRateZones zones
                && zones.maxHeartRate == maxHeartRate
                && Arrays.equals(zones.boundaries, boundaries);
    }

    @Override
    public int hashCode() {
        return 31 * maxHeartRate + Arrays.hashCode(boundaries);
    }

    @Override
    public String toString() {
        return "HeartRateZones[max=" + maxHeartRate + ", boundaries=" + Arrays.toString(boundaries) + "]";
    }
}
