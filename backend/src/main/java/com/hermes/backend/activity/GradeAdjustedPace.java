package com.hermes.backend.activity;

/**
 * Grade-adjusted pace: the flat pace that is worth the same effort as the pace run on a slope. A climb makes it
 * faster than the pace run, a gentle descent slower, and a descent steep enough to need braking faster again.
 *
 * <p>The effort of one metre on a slope, as a multiple of one metre on the flat, is a quadratic in the slope
 * {@code s} (a fraction): {@code 1 + 2.896 s + 15.14 s^2}. Strava does not publish its formula. Its model is
 * described as an empirical one, fitted to the pace runners held at the same heart rate on different grades, from the
 * data of hundreds of thousands of athletes (Strava's 2017 engineering post "An Improved GAP Model", as summarised at
 * https://pickletech.eu/blog-gap/; the post itself could not be read when this was written). This quadratic is the
 * rough fit that Fellrnr.com publishes for it (https://fellrnr.com/wiki/Grade_Adjusted_Pace), and it agrees with what
 * is public about Strava's numbers:</p>
 * <ul>
 *   <li>Strava's help centre says the downhill adjustment peaks around -10% and then eases off. The quadratic's
 *       easiest slope is -9.6%, where a metre is worth 0.86 of a flat one.</li>
 *   <li>Analyses of a Strava data export find the adjusted pace is no longer slower than the pace run on a descent of
 *       about -18% (https://aaron-schroeder.github.io/reverse-engineering/grade-adjusted-pace.html). The quadratic
 *       crosses 1 at -19.1%.</li>
 *   <li>The 2017 post's example, as quoted at https://pickletech.eu/blog-gap/: the pace that matches 3:30 /km on the
 *       flat is 5:08 /km on a 10% climb. The quadratic says 5:03.</li>
 * </ul>
 * <p>It replaced a Minetti et al. (2002) treadmill cost of running with half of the descent saving counted. That made
 * a 10% climb about 13% dearer than Strava's example (1.66 against 1.47) and steep descents worth far more than anyone
 * runs.</p>
 *
 * <p>Choices here are Hermes' own:</p>
 * <ul>
 *   <li>A climb steeper than 30% counts as 30%, and a descent steeper than 20% as 20%. A GPS or barometer trace is too
 *       noisy to trust a steeper one, and Strava itself has little data there.</li>
 *   <li>The runner's own pace does not matter. Strava's model is reported to adjust a fast runner's climbs more than a
 *       slow runner's, so for a slower runner this reads a little fast on a climb.</li>
 * </ul>
 * <p>The numbers will be close to Strava's, not the same: its elevation comes from its own terrain data and its model
 * is not public.</p>
 */
final class GradeAdjustedPace {

    /** The steepest climb that counts, as a fraction. */
    static final double CLIMB_LIMIT = 0.30;

    /** The steepest descent that counts, as a fraction. */
    static final double DESCENT_LIMIT = 0.20;

    /** Effort of a metre at slope s, as a multiple of a flat metre: 1 + LINEAR s + QUADRATIC s^2. */
    static final double LINEAR = 2.896;
    static final double QUADRATIC = 15.14;

    private GradeAdjustedPace() {
    }

    /**
     * How many flat metres of effort one metre at this slope is worth: 1 on the flat, above 1 on a climb, below 1 on
     * a gentle descent (the least, 0.86, at -9.6%) and back above 1 on a descent steeper than about -19%.
     *
     * @param grade the slope as a fraction (0.1 is a 10% climb, -0.1 a 10% descent); a climb beyond 30% counts as
     *              30%, a descent beyond 20% as 20%, and an unknown slope counts as flat
     */
    static double effortRatio(double grade) {
        if (Double.isNaN(grade)) {
            return 1.0;
        }
        double slope = Math.max(-DESCENT_LIMIT, Math.min(CLIMB_LIMIT, grade));
        return 1.0 + (LINEAR + QUADRATIC * slope) * slope;
    }

    /**
     * The flat pace worth the same effort as {@code paceSecPerKm} was on this slope. A pace that is not a number, or
     * zero, stays as it is.
     */
    static double adjust(double paceSecPerKm, double grade) {
        if (Double.isNaN(paceSecPerKm) || paceSecPerKm == 0.0) {
            return paceSecPerKm;
        }
        return paceSecPerKm / effortRatio(grade);
    }
}
