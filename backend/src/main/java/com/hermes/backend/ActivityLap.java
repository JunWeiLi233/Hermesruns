package com.hermes.backend;

/**
 * Response DTO for a single per-km lap breakdown, including elevation gain.
 * Laps are computed on-the-fly from per-second sample points; this class is
 * NOT a JPA entity — no schema change is required.
 */
public record ActivityLap(
        int lapIndex,
        double distanceKm,
        int durationSeconds,
        String pace,
        Integer averageHeartRate,
        Integer averageCadence,
        Double elevationGainMeters
) {

    /** Compute the sum of positive elevation differences within a sample window. */
    static Double computeElevationGain(java.util.List<ActivityAnalyticsHelper.SamplePoint> pts,
                                       double startDistM, double endDistM) {
        double gain = 0.0;
        Double prev = null;
        boolean any = false;
        for (ActivityAnalyticsHelper.SamplePoint p : pts) {
            if (p.distanceMeters() == null || p.elevationMeters() == null) continue;
            if (p.distanceMeters() < startDistM || p.distanceMeters() > endDistM) continue;
            any = true;
            if (prev != null && p.elevationMeters() > prev) {
                gain += p.elevationMeters() - prev;
            }
            prev = p.elevationMeters();
        }
        return any ? ActivityAnalyticsHelper.round2(gain) : null;
    }
}
