package com.hermes.backend.activity;

/**
 * Grade-adjusted pace: the pace on the flat that would cost the runner the same energy as the pace they ran on a
 * slope. A climb makes it faster than the pace run, a descent slower.
 *
 * <p>The energy cost of running one metre at a slope is Minetti et al. (2002), a polynomial fitted to treadmill
 * measurements at slopes from -45% to +45% (J per kg per metre, slope as a fraction):
 * {@code 155.4 s^5 - 30.4 s^4 - 43.3 s^3 + 46.3 s^2 + 19.5 s + 3.6}. Dividing by the flat cost, 3.6, gives how many
 * times dearer a metre is on that slope. Two choices here are Hermes' own, not Minetti's:</p>
 * <ul>
 *   <li>A slope beyond 30% counts as 30%, because a GPS or barometer trace is too noisy to trust a steeper one.</li>
 *   <li>On a descent only half of the saving Minetti measured is counted. His runners kept the effort steady on a
 *       treadmill; a runner on a road or a trail brakes and takes the impact on the way down and does not turn all of
 *       the saving into speed. Without this, a 5:00 /km run down a 10% hill would be worth 8:21 /km on the flat,
 *       far more than any runner finds. With it, 6:16 /km.</li>
 * </ul>
 * <p>These numbers will not match Strava's, whose model is its own fit to heart-rate data.</p>
 */
final class GradeAdjustedPace {

    /** The steepest slope that counts, as a fraction. */
    static final double GRADE_LIMIT = 0.30;

    /** The part of Minetti's descent saving that is counted. */
    static final double DOWNHILL_SHARE = 0.5;

    /** Minetti's cost of running one metre on the flat, J per kg. */
    private static final double FLAT_COST = 3.6;

    private GradeAdjustedPace() {
    }

    /**
     * How many times dearer a metre is at this slope than on the flat: 1 on the flat, above 1 on a climb, below 1 on
     * a gentle descent.
     *
     * @param grade the slope as a fraction (0.1 is a 10% climb, -0.1 a 10% descent); beyond +/-30% it counts as
     *              30%, and an unknown slope counts as flat
     */
    static double costRatio(double grade) {
        if (Double.isNaN(grade)) {
            return 1.0;
        }
        double slope = Math.max(-GRADE_LIMIT, Math.min(GRADE_LIMIT, grade));
        double cost = ((((155.4 * slope - 30.4) * slope - 43.3) * slope + 46.3) * slope + 19.5) * slope + FLAT_COST;
        double ratio = cost / FLAT_COST;
        if (slope < 0 && ratio < 1.0) {
            ratio = 1.0 - DOWNHILL_SHARE * (1.0 - ratio);
        }
        return ratio;
    }

    /**
     * The flat pace that costs the same as {@code paceSecPerKm} did on this slope. A pace that is not a number, or
     * zero, stays as it is.
     */
    static double adjust(double paceSecPerKm, double grade) {
        if (Double.isNaN(paceSecPerKm) || paceSecPerKm == 0.0) {
            return paceSecPerKm;
        }
        return paceSecPerKm / costRatio(grade);
    }
}
