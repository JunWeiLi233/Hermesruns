package com.hermes.backend.activity;

import java.util.Collection;

/**
 * How much a runner climbed, worked out from a profile of elevations (a GPX, TCX or FIT file carries the elevation of
 * every point, not the climb).
 *
 * <p>Adding up every rise from one point to the next counts the sensor's noise as hills: a barometer that flickers a metre
 * either way on a flat road would "climb" hundreds of metres. So a rise or a fall only counts once it is bigger than
 * {@link #NOISE_THRESHOLD_METERS}: the profile is followed from peak to valley to peak, and the climb is the sum of the
 * valley-to-peak rises. A smooth hill is counted in full.</p>
 */
public final class ElevationAscent {

    /** A change smaller than this is the noise of the sensor, not a hill. */
    static final double NOISE_THRESHOLD_METERS = 3.0;

    private ElevationAscent() {}

    /**
     * The climb in metres, to one decimal; null when there are fewer than two elevations to go on (a run with no elevation
     * data has no climb figure, which is not the same as a climb of zero). Elevations that are null or not a number are
     * skipped.
     */
    public static Double of(Collection<Double> elevations) {
        if (elevations == null) return null;
        int seen = 0;
        double pivot = 0;
        double running = 0;
        int direction = 0;
        double ascent = 0;
        for (Double elevation : elevations) {
            if (elevation == null || !Double.isFinite(elevation)) continue;
            seen++;
            if (seen == 1) {
                pivot = elevation;
                running = elevation;
                continue;
            }
            if (direction == 0) {
                if (elevation - pivot >= NOISE_THRESHOLD_METERS) {
                    direction = 1;
                    running = elevation;
                } else if (pivot - elevation >= NOISE_THRESHOLD_METERS) {
                    direction = -1;
                    running = elevation;
                }
            } else if (direction == 1) {
                if (elevation > running) {
                    running = elevation;
                } else if (running - elevation >= NOISE_THRESHOLD_METERS) {
                    // The run's high point is confirmed: the rise up to it counts.
                    ascent += running - pivot;
                    pivot = running;
                    running = elevation;
                    direction = -1;
                }
            } else {
                if (elevation < running) {
                    running = elevation;
                } else if (elevation - running >= NOISE_THRESHOLD_METERS) {
                    // The low point is confirmed: the next rise starts from it.
                    pivot = running;
                    running = elevation;
                    direction = 1;
                }
            }
        }
        if (seen < 2) return null;
        if (direction == 1) ascent += running - pivot;
        return Math.round(ascent * 10.0) / 10.0;
    }
}
