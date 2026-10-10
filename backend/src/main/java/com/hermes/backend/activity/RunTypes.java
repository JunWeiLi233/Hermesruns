package com.hermes.backend.activity;

import java.util.List;

/**
 * The kinds of run a runner can say a run was: a race, a long run or a workout (intervals, tempo, hill repeats). A run
 * that is none of them has no type. They are plain strings, like the other labels a runner chooses: Hibernate's schema
 * update never changes an existing enum check constraint, so a new type could not be added to a populated table.
 */
public final class RunTypes {

    public static final String RACE = "RACE";
    public static final String LONG_RUN = "LONG_RUN";
    public static final String WORKOUT = "WORKOUT";

    /** In the order the screens list them. */
    public static final List<String> ALL = List.of(RACE, LONG_RUN, WORKOUT);

    private RunTypes() {
    }

    public static boolean isValid(String value) {
        return value != null && ALL.contains(value);
    }
}
