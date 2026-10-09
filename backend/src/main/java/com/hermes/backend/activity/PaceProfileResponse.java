package com.hermes.backend.activity;

import java.util.List;

/**
 * What the run page's pace analysis draws: the kilometre splits, a smoothed pace line, the fastest and slowest
 * splits, and a grade-adjusted version of each pace. Built by {@link PaceProfileCalculator}, never stored.
 *
 * <p>Every pace is in seconds per kilometre and is a moving pace: time spent standing still is left out. The
 * grade-adjusted figures are {@code null} when the run has no usable elevation (see {@link GradeAdjustedPace}).</p>
 *
 * @param hasStream    false when the run has no usable stream of distance and time; every other part is then empty
 * @param hasElevation true when there was enough elevation to adjust for grade
 * @param splits       the full kilometres in order, then the stretch left over if it is at least 100 m
 * @param markers      the fastest and slowest full splits; null when there are fewer than two full splits or they
 *                     are all the same
 * @param smoothed     pace sampled at an even step along the run's time, for the pace line and for pace zones
 */
public record PaceProfileResponse(boolean hasStream, boolean hasElevation, Summary summary, List<Split> splits,
                                  Markers markers, Series smoothed) {

    /**
     * @param distanceMeters  the distance of the stream, from its first reading to its last
     * @param elapsedSeconds  from the first reading to the last
     * @param movingSeconds   the part of that spent moving (not standing still)
     * @param stoppedSeconds  elapsed minus moving
     * @param paceSecPerKm    moving seconds per kilometre; null if the runner never moved
     * @param gapSecPerKm     the grade-adjusted pace over the whole run: moving seconds per flat-equivalent kilometre
     */
    public record Summary(double distanceMeters, double elapsedSeconds, double movingSeconds, double stoppedSeconds,
                          Double paceSecPerKm, Double gapSecPerKm) {
    }

    /**
     * @param index                1-based
     * @param distanceMeters       1000, or what is left over for a partial split
     * @param seconds              moving seconds
     * @param paceSecPerKm         moving seconds per kilometre run; null when none of the split was run, or when the
     *                             result is not a plausible pace (faster than 1:40 or slower than 30:00 per km)
     * @param gapSecPerKm          the same grade-adjusted; null whenever the pace is, and without elevation
     * @param elevationChangeMeters the smoothed elevation at the end minus at the start; null without elevation
     * @param partial              true for the stretch after the last full kilometre
     */
    public record Split(int index, double distanceMeters, double seconds, Double paceSecPerKm, Double gapSecPerKm,
                        Double elevationChangeMeters, boolean partial) {
    }

    /** The fastest and slowest full splits by pace and by grade-adjusted pace; either may be null. */
    public record Markers(Marker pace, Marker gap) {
    }

    /** Split indexes, 1-based. */
    public record Marker(int fastestSplit, int slowestSplit) {
    }

    /**
     * Columns of equal length. Each sample stands for {@code stepSeconds} of the run, so time in a pace zone is the
     * number of samples in it times the step. A null pace is a stretch where the runner stood still.
     *
     * @param stepSeconds   the time between samples
     * @param windowSeconds the width of the window each pace is averaged over
     * @param t             seconds from the first reading
     */
    public record Series(int stepSeconds, int windowSeconds, List<Integer> t, List<Double> distanceKm,
                         List<Double> paceSecPerKm, List<Double> gapSecPerKm, List<Double> elevationMeters) {
    }

    static PaceProfileResponse noStream() {
        return new PaceProfileResponse(false, false, null, List.of(), null, null);
    }
}
