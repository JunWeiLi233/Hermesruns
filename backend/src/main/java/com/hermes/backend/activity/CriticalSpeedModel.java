package com.hermes.backend.activity;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The critical speed of a runner, from their best times over several distances: the straight line that distance makes
 * against time. Pure arithmetic on what it is given, like {@link GradeAdjustedPace}: nothing is stored or guessed.
 *
 * <p>The model is the classic two-parameter one (Monod and Scherrer, 1965; Hill, 1993; Jones et al., 2010): the distance a
 * runner covers in a maximal effort of {@code t} seconds is {@code d = D' + CS x t}. {@code CS}, the critical speed, is the
 * slope: the speed the line says could be held for ever, which no one can, so read it as a threshold-like pace and not as
 * a pace to race at. {@code D'}, the intercept, is a distance the runner can cover above that speed before they are spent.
 * The line is fitted by least squares through the best efforts that last between three and forty minutes: shorter ones
 * lean on other energy supplies and longer ones fall below the line, so both are drawn but left out of the fit.</p>
 *
 * <p>The numbers are conventions of HermesRuns where the literature gives a range: which durations count, how many
 * efforts it takes, how far apart in length they must be, and how large an error still counts as a fit. They are
 * constants here and in the document.</p>
 */
final class CriticalSpeedModel {

    /** Efforts shorter than this (three minutes) are left out of the fit. */
    static final double MIN_SECONDS = 180;
    /** Efforts longer than this (forty minutes) are left out of the fit. */
    static final double MAX_SECONDS = 2400;
    /** The fewest efforts a line is fitted through. */
    static final int MIN_POINTS = 3;
    /** The longest effort must last at least this many times the shortest, or the slope is a guess. */
    static final double MIN_SPREAD = 2.5;
    /** A fit whose worst effort is off by no more than this share (percent) of its time is a fit. */
    static final double OK_ERROR_PERCENT = 5;
    /** A fit whose worst effort is off by more than the share above but no more than this is shown with a warning. */
    static final double ROUGH_ERROR_PERCENT = 10;

    /** How the fit went. {@code OK} and {@code ROUGH} have numbers; the others say what is missing or wrong. */
    enum Status {
        OK, ROUGH, TOO_FEW_POINTS, NARROW_RANGE, NEGATIVE_D_PRIME, NO_FIT;

        String code() {
            return name().toLowerCase(Locale.ROOT);
        }

        boolean hasNumbers() {
            return this == OK || this == ROUGH;
        }
    }

    /** @param seconds the best time over {@code meters}, in seconds */
    record Point(String key, double meters, double seconds) {
    }

    /**
     * @param criticalSpeed metres a second; NaN when {@code status} has no numbers
     * @param dPrime        metres; NaN when {@code status} has no numbers
     * @param maxErrorPercent the worst gap, in percent of an effort's own time, between the time the line gives for its
     *                      distance and the time it took; NaN when {@code status} has no numbers
     * @param pointsUsed    how many efforts lasted between {@link #MIN_SECONDS} and {@link #MAX_SECONDS}
     * @param usedKeys      the distance keys the line was fitted through, empty when there is no line
     */
    record Fit(Status status, double criticalSpeed, double dPrime, double maxErrorPercent, int pointsUsed,
               double minSeconds, double maxSeconds, List<String> usedKeys) {

        /** The time the line gives for a distance, in seconds. */
        double timeFor(double meters) {
            return (meters - dPrime) / criticalSpeed;
        }

        /** The pace of the critical speed, in seconds a kilometre. */
        double criticalPaceSecondsPerKm() {
            return 1000.0 / criticalSpeed;
        }
    }

    private CriticalSpeedModel() {
    }

    /** Whether an effort of this length is one the line is fitted through. */
    static boolean inDomain(double seconds) {
        return seconds >= MIN_SECONDS && seconds <= MAX_SECONDS;
    }

    /** Fits the line through the efforts of {@code candidates} that are in the domain, or says why it cannot. */
    static Fit fit(List<Point> candidates) {
        List<Point> used = new ArrayList<>();
        for (Point point : candidates == null ? List.<Point>of() : candidates) {
            if (point != null && point.meters() > 0 && Double.isFinite(point.seconds()) && inDomain(point.seconds())) {
                used.add(point);
            }
        }
        double shortest = used.stream().mapToDouble(Point::seconds).min().orElse(Double.NaN);
        double longest = used.stream().mapToDouble(Point::seconds).max().orElse(Double.NaN);
        if (used.size() < MIN_POINTS) {
            return unusable(Status.TOO_FEW_POINTS, used, shortest, longest);
        }
        if (longest / shortest < MIN_SPREAD) {
            return unusable(Status.NARROW_RANGE, used, shortest, longest);
        }

        double n = used.size();
        double meanT = used.stream().mapToDouble(Point::seconds).sum() / n;
        double meanD = used.stream().mapToDouble(Point::meters).sum() / n;
        double sxx = 0;
        double sxy = 0;
        for (Point point : used) {
            sxx += (point.seconds() - meanT) * (point.seconds() - meanT);
            sxy += (point.seconds() - meanT) * (point.meters() - meanD);
        }
        double slope = sxy / sxx;
        double intercept = meanD - slope * meanT;
        if (!(slope > 0)) {
            return unusable(Status.NO_FIT, used, shortest, longest);
        }
        if (intercept < 0) {
            return unusable(Status.NEGATIVE_D_PRIME, used, shortest, longest);
        }

        double worst = 0;
        for (Point point : used) {
            double modelled = (point.meters() - intercept) / slope;
            worst = Math.max(worst, Math.abs(modelled - point.seconds()) / point.seconds() * 100.0);
        }
        Status status = worst <= OK_ERROR_PERCENT ? Status.OK : worst <= ROUGH_ERROR_PERCENT ? Status.ROUGH : Status.NO_FIT;
        if (!status.hasNumbers()) {
            return unusable(status, used, shortest, longest);
        }
        return new Fit(status, slope, intercept, worst, used.size(), shortest, longest, used.stream().map(Point::key).toList());
    }

    private static Fit unusable(Status status, List<Point> used, double shortest, double longest) {
        return new Fit(status, Double.NaN, Double.NaN, Double.NaN, used.size(), shortest, longest, List.of());
    }
}
