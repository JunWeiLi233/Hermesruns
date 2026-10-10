package com.hermes.backend.activity;

import java.util.Set;

/**
 * Published after the runner edits fields of one of their runs. Anything derived from those fields (the
 * effort score derives from the perceived exertion) listens for this instead of being called by the
 * activity package, which keeps the dependency pointing one way.
 *
 * @param fields the names of the fields that changed, for example {@code perceivedExertion}
 */
public record ActivityEditedEvent(Long runnerId, Long activityId, Set<String> fields) {

    public static final String PERCEIVED_EXERTION = "perceivedExertion";

    public ActivityEditedEvent {
        fields = fields == null ? Set.of() : Set.copyOf(fields);
    }
}
