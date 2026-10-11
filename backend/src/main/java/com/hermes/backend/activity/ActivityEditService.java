package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.EntityManager;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies one edit to one of a runner's runs: all of it or none of it, on the row as it is now.
 *
 * <p>The run's row is taken first and held until the edit commits, so two requests about one run take turns instead of each
 * writing back what it read earlier (a title saved in one tab is not undone by the notes saved in another), a request that fails
 * part-way changes nothing (its title, its rating and its tags are one transaction), and two requests that both set tags cannot
 * collide on the unique index of the tags. What the edit changed is announced after it commits
 * ({@link ActivityEditedEvent}), so whatever is derived from it reads the saved run.</p>
 *
 * <p>Whether a value is acceptable on its own (a title that is not empty, tags that are words) is the caller's to check first;
 * what depends on the run as it is (a rating that has to be there to be used) is checked here, on the locked row.</p>
 */
@Service
public class ActivityEditService {

    /** What an edit asks for. A field that is not named is not touched; the values of the others are already checked. */
    public record Request(boolean ratingGiven, Integer rating, boolean useGiven, boolean useRating,
                          boolean nameGiven, String name, boolean notesGiven, String notes,
                          boolean runTypeGiven, String runType, boolean tagsGiven, List<String> tags) {
    }

    /** The run after the edit, what changed, and its labels when the edit named the run type or the tags. */
    public record Outcome(Activity activity, Set<String> changed, RunLabelService.Labels labels) {
    }

    /** An edit that cannot be made because of how the run is, for a reason the runner can fix. */
    public static final class Refused extends RuntimeException {
        private final String code;

        Refused(String code, String message) {
            super(message);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }

    private final ActivityRepository activities;
    private final RunLabelService labelService;
    private final ApplicationEventPublisher events;
    private final EntityManager entityManager;

    public ActivityEditService(ActivityRepository activities, RunLabelService labelService, ApplicationEventPublisher events,
                               EntityManager entityManager) {
        this.activities = activities;
        this.labelService = labelService;
        this.events = events;
        this.entityManager = entityManager;
    }

    /**
     * @return the outcome, or empty when the run is not this runner's (or is not there)
     * @throws Refused when the run is not as the edit needs it: the rating cannot be used before there is one
     */
    @Transactional
    public Optional<Outcome> apply(Runner runner, Long activityId, Request request) {
        Activity activity = activities.findByIdForUpdate(activityId).orElse(null);
        if (activity == null || activity.getRunner() == null || !Objects.equals(activity.getRunner().getId(), runner.getId())) {
            return Optional.empty();
        }
        // The row is ours now. When the run is already in this session (it was read earlier in the request), the query above
        // hands back that copy as it was read; read it again, so that what is changed is the run as it is and not as it was.
        entityManager.refresh(activity);

        Integer ratingAfter = request.ratingGiven() ? request.rating() : activity.getPerceivedExertion();
        boolean useAfter = request.useGiven() ? request.useRating() : activity.isUseRatingForEffort();
        if (request.useGiven() && request.useRating() && ratingAfter == null) {
            throw new Refused("RATING_REQUIRED", "Rate how the run felt before asking for the rating to be used.");
        }
        if (ratingAfter == null) {
            // Without a rating there is nothing to use: clearing the rating clears the choice with it.
            useAfter = false;
        }

        Set<String> changed = new LinkedHashSet<>();
        if (request.ratingGiven() && !Objects.equals(activity.getPerceivedExertion(), request.rating())) {
            activity.setPerceivedExertion(request.rating());
            changed.add(ActivityEditedEvent.PERCEIVED_EXERTION);
        }
        if (useAfter != activity.isUseRatingForEffort()) {
            activity.setUseRatingForEffort(useAfter);
            changed.add(ActivityEditedEvent.USE_RATING_FOR_EFFORT);
        }
        if (request.nameGiven() && !Objects.equals(request.name(), activity.getName())) {
            activity.setName(request.name());
            // A title of the runner's own: a Strava re-sync leaves it alone from now on.
            activity.setNameEdited(true);
            changed.add(ActivityEditedEvent.NAME);
        }
        if (request.notesGiven() && !Objects.equals(request.notes(), activity.getNotes())) {
            activity.setNotes(request.notes());
            changed.add(ActivityEditedEvent.NOTES);
        }
        RunLabelService.Labels labels = null;
        if (request.runTypeGiven() || request.tagsGiven()) {
            RunLabelService.Applied applied = labelService.apply(runner, activity,
                    new RunLabelService.Change(request.runTypeGiven(), request.runType(), request.tagsGiven(), request.tags()),
                    request.tags());
            labels = applied.labels();
            if (applied.runTypeChanged()) {
                changed.add(ActivityEditedEvent.RUN_TYPE);
            }
            if (applied.tagsChanged()) {
                changed.add(ActivityEditedEvent.TAGS);
            }
        }
        if (!changed.isEmpty()) {
            activities.save(activity);
            events.publishEvent(new ActivityEditedEvent(runner.getId(), activityId, changed));
        }
        return Optional.of(new Outcome(activity, changed, labels));
    }
}
