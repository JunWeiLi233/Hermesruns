package com.hermes.backend;

/**
 * Polarized intensity buckets using %HRmax (session average).
 * <ul>
 *   <li>Low (Z1–2): &lt; 70% HRmax</li>
 *   <li>Grey (Z3): 70–80% HRmax — "moderately hard" trap</li>
 *   <li>High (Z4–5): &gt; 80% HRmax</li>
 * </ul>
 */
public final class CoachHrZoneClassifier {
    /** Below this ratio of avg HR to max HR counts as easy / polarized low. */
    public static final double LOW_MAX_RATIO = 0.70;
    /** Above this ratio counts as high intensity for 80/20 accounting. */
    public static final double HIGH_MIN_RATIO = 0.80;

    private CoachHrZoneClassifier() {}

    public static CoachHrBand classify(Double averageHeartRate, double hrMax) {
        if (averageHeartRate == null || averageHeartRate <= 0 || hrMax < 130 || hrMax > 230) {
            return CoachHrBand.UNKNOWN;
        }
        double r = averageHeartRate / hrMax;
        if (r < LOW_MAX_RATIO) {
            return CoachHrBand.LOW;
        }
        if (r <= HIGH_MIN_RATIO) {
            return CoachHrBand.GREY;
        }
        return CoachHrBand.HIGH;
    }

    public static double clampHrMax(double candidate) {
        if (candidate < 130) {
            return 185;
        }
        return Math.min(220, Math.max(130, candidate));
    }
}
