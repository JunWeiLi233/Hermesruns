package com.hermes.backend.coaching;

import com.hermes.backend.runner.HeartRateZones;

/**
 * How a runner's running time was spread over low, moderate and high effort, from the time each run spent in its five
 * heart-rate zones. Pure arithmetic on what it is given, like {@link FitnessModel}: no stored state, nothing guessed.
 *
 * <p>The three bands are made from the zone numbers, so they follow whatever edges the runner's zones have: zones 1 to
 * 3 are the low band (below 80% of maximum heart rate with the default edges), zone 4 the moderate band (80% to under
 * 90%) and zone 5 the high band. That is a rough stand-in for the three zones of the research, which are cut at the
 * lactate or ventilatory thresholds: those sit at different heart rates in different people.</p>
 *
 * <p>The name given to the spread follows the Polarization-Index of Treff, Winkert, Sareban, Steinacker and Sperlich
 * (Frontiers in Physiology, 2019): {@code PI = log10((low / moderate) x high x 100)} with the three shares as fractions
 * of one, an empty moderate share replaced by 1%, a high share of zero giving 0, and no index at all when the high share
 * is larger than the low one. A spread is polarized when low is the largest share, high is larger than moderate and the
 * index is above 2. The other names are HermesRuns' reading of the same shares and are said so in the document.</p>
 */
final class IntensityModel {

    /** Zones 1 to this number make the low band; the next zone is the moderate band; the zone after it is the high band. */
    static final int LOW_ZONE_COUNT = 3;
    /** A spread with an index above this, and the right order of shares, is called polarized (Treff et al., 2019). */
    static final double POLARIZED_INDEX = 2.0;
    /** The share put in place of an empty moderate share, so the index has no zero in its denominator (Treff et al., 2019). */
    static final double EMPTY_MODERATE_SHARE = 0.01;
    /** Fewer runs with a heart rate than this say too little about a pattern. */
    static final int MIN_RUNS = 3;
    /** Less heart-rate time than this (one hour) says too little about a pattern. */
    static final long MIN_COVERED_SECONDS = 3600;

    /** The name given to a spread, or {@code INSUFFICIENT} when there is too little heart-rate time to name one. */
    enum Pattern {
        INSUFFICIENT, POLARIZED, PYRAMIDAL, THRESHOLD, HIGH, MIXED;

        String code() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    /** Shares of the heart-rate time, each between 0 and 1, adding up to 1. */
    record Shares(double low, double moderate, double high) {
    }

    /**
     * @param shares            null when there is no heart-rate time at all
     * @param polarizationIndex null when the index is not defined for these shares
     */
    record Reading(Shares shares, Double polarizationIndex, Pattern pattern) {
    }

    private IntensityModel() {
    }

    /** The shares of the time in zones 1 to 5; null when the zones hold no time. */
    static Shares shares(long[] zoneSeconds) {
        if (zoneSeconds == null || zoneSeconds.length != HeartRateZones.ZONE_COUNT) {
            throw new IllegalArgumentException("A run has " + HeartRateZones.ZONE_COUNT + " heart-rate zones.");
        }
        double low = 0;
        double moderate = 0;
        double high = 0;
        for (int zone = 0; zone < zoneSeconds.length; zone++) {
            long seconds = Math.max(0, zoneSeconds[zone]);
            if (zone < LOW_ZONE_COUNT) {
                low += seconds;
            } else if (zone == LOW_ZONE_COUNT) {
                moderate += seconds;
            } else {
                high += seconds;
            }
        }
        double total = low + moderate + high;
        return total <= 0 ? null : new Shares(low / total, moderate / total, high / total);
    }

    /**
     * The Polarization-Index of these shares, or null when it is not defined (the high share is larger than the low one).
     * Zero when there is no high share at all.
     */
    static Double polarizationIndex(Shares shares) {
        if (shares == null) {
            return null;
        }
        if (shares.high() == 0) {
            return 0.0;
        }
        if (shares.high() > shares.low()) {
            return null;
        }
        double moderate = shares.moderate() == 0 ? EMPTY_MODERATE_SHARE : shares.moderate();
        return Math.log10((shares.low() / moderate) * shares.high() * 100.0);
    }

    /** The name for a spread. */
    static Pattern pattern(Shares shares, Double index, int runsWithHeartRate, long coveredSeconds) {
        if (shares == null || runsWithHeartRate < MIN_RUNS || coveredSeconds < MIN_COVERED_SECONDS) {
            return Pattern.INSUFFICIENT;
        }
        double low = shares.low();
        double moderate = shares.moderate();
        double high = shares.high();
        // The middle band holds the most time (or as much as the largest): threshold-heavy, whatever the rest.
        if (moderate >= low && moderate >= high) {
            return Pattern.THRESHOLD;
        }
        if (low > moderate && low > high) {
            if (high > moderate && index != null && index > POLARIZED_INDEX) {
                return Pattern.POLARIZED;
            }
            return moderate >= high ? Pattern.PYRAMIDAL : Pattern.MIXED;
        }
        if (high > low && high > moderate) {
            return Pattern.HIGH;
        }
        return Pattern.MIXED;
    }

    /** The shares, the index and the name of the time in zones 1 to 5 of some runs. */
    static Reading read(long[] zoneSeconds, int runsWithHeartRate) {
        Shares shares = shares(zoneSeconds);
        long covered = 0;
        for (long seconds : zoneSeconds) {
            covered += Math.max(0, seconds);
        }
        Double index = polarizationIndex(shares);
        return new Reading(shares, index, pattern(shares, index, runsWithHeartRate, covered));
    }
}
