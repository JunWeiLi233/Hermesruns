package com.hermes.backend.summary;

/**
 * Every number a rule of the run summary turns on, in one place. A finding carries the ones it used, so what the page says
 * about how a sentence was worked out is read from here and cannot drift from the rule (see docs/README-ANALYSIS.md,
 * "Run Summary"). They are Hermes' own conventions to make a run readable, not measurements.
 */
final class SummaryThresholds {

    private SummaryThresholds() {
    }

    // ----- when there is anything to say -----

    /** A run shorter than this, or moving for less, is not summarised. */
    static final double MIN_KM = 1.0;
    static final int MIN_MOVING_SECONDS = 300;

    // ----- the runs it is compared with -----

    /** The window of earlier runs a pace is compared with, a usual effort is taken from, and a longest run is looked for in. */
    static final int PACE_DAYS = 30;
    static final int EFFORT_DAYS = 90;
    static final int LONGEST_DAYS = 28;
    /** A run is like this one when its distance is between these shares of it (workouts are compared on effort alone). */
    static final double SIMILAR_MIN = 0.7;
    static final double SIMILAR_MAX = 1.4;
    static final int MIN_PACE_RUNS = 3;
    static final int MIN_EFFORT_RUNS = 5;
    static final int MIN_WORKOUT_RUNS = 3;
    /** The most effort in the window only counts as a record when there are at least this many runs to be the most among. */
    static final int MIN_HARDEST_RUNS = 8;
    static final int MIN_LONGEST_RUNS = 4;
    static final double LONGEST_MIN_KM = 5.0;

    // ----- what counts as faster, harder, even -----

    /** Pace: more than this share faster or slower than the recent runs. */
    static final double PACE_BAND = 0.03;
    /** Effort: this many times the usual effort or more is harder, this many or less is easier. */
    static final double EFFORT_HIGH = 1.25;
    static final double EFFORT_LOW = 0.75;

    // ----- pacing -----

    /** Fewer full kilometres than this are not enough to compare two halves. */
    static final int MIN_SPLITS = 4;
    /** The second half is faster or slower than the first by at least this share. */
    static final double SPLIT_BAND = 0.02;
    /** Kilometre paces that vary by more than this (standard deviation over the mean) are a run with changes of pace. */
    static final double VARIABLE_CV = 0.10;

    // ----- heart rate -----

    /** Drift in percent: above the first is a slight rise, above the second a high one. */
    static final double DRIFT_MODERATE = 5.0;
    static final double DRIFT_HIGH = 10.0;
    /** Drift needs at least this long a run. */
    static final int DRIFT_MIN_SECONDS = 1200;
    /** Time in zones needs at least this much heart rate to go on. */
    static final int ZONES_MIN_SECONDS = 600;
    /** Easy: zones 1 and 2 hold at least this share. Hard: zones 4 and 5 hold at least this share (checked first). */
    static final double EASY_SHARE = 0.70;
    static final double HARD_SHARE = 0.30;

    // ----- form (the same words as the fitness card: see "Saying form in a word") -----

    static final double FORM_BAND = 0.10;
    static final double FORM_MIN_SWING = 3.0;

    // ----- climbing -----

    /** Metres climbed per kilometre from which a run is called hilly. */
    static final double HILLY_METRES_PER_KM = 12.0;
    /** The grade-adjusted pace is mentioned when it differs from the pace on the clock by at least this many seconds per km. */
    static final double GAP_NOTICEABLE_SECONDS = 5.0;

    // ----- how much is shown -----

    /** Besides the headline, at most this many lines. */
    static final int MAX_SUPPORTING = 4;
    /** Lines that say "as usual" are only shown when fewer than this many lines say something more. */
    static final int FILLERS_ONLY_BELOW = 2;
}
