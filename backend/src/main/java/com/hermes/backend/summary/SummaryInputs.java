package com.hermes.backend.summary;

import java.time.LocalDate;
import java.util.List;

/**
 * Everything the rules of the run summary look at, as plain values: the run, the runs before it, what its stream says and
 * how fresh the runner was going in. The rules are pure functions of this, so each can be tested with a handful of numbers.
 *
 * @param before the runner's earlier runs (days before the run's day), newest first or in any order
 * @param splits null when the run has no usable stream
 * @param drift  null when the run has no usable heart rate and distance stream
 * @param form   null when fitness and form cannot be said yet (less than two weeks of effort before the run)
 */
record SummaryInputs(Run run, List<RecentRun> before, Splits splits, Drift drift, Form form) {

    /**
     * @param runType     RACE, LONG_RUN, WORKOUT, or null for a run the runner has not labelled
     * @param zoneSeconds seconds in zones 1 to 5, null when the run has no heart-rate stream
     */
    record Run(Long id, String runType, LocalDate day, double distanceKm, int movingSeconds, Double effort,
               Double climbMetres, int[] zoneSeconds) {
    }

    /** One of the runner's earlier runs, with what the comparisons use of it. */
    record RecentRun(Long id, LocalDate day, String runType, double distanceKm, int movingSeconds, Double effort) {
    }

    /**
     * @param paces         seconds per kilometre of each full kilometre, in order; grade-adjusted when {@code gradeAdjusted}
     * @param gradeAdjusted whether {@code paces} are grade-adjusted (the run had elevation to adjust for)
     * @param paceSecPerKm  the whole run's moving pace on the clock; null when unknown
     * @param gapSecPerKm   the whole run's grade-adjusted pace; null without elevation
     */
    record Splits(List<Double> paces, boolean gradeAdjusted, Double paceSecPerKm, Double gapSecPerKm) {
    }

    record Drift(double percent, double firstHalfHeartRate, double secondHalfHeartRate) {
    }

    /** The state going into the run: the end of the day before it. */
    record Form(LocalDate day, double fitness, double fatigue, double form) {
    }
}
