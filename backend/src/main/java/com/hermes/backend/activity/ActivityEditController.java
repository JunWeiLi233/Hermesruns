package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Edits the details of one of the signed-in runner's runs: its title, the notes on it, how hard it felt (a rating of 1 to 10,
 * and whether the effort score should come from it), what kind of run it was and the tags on it. The shoe has its own route
 * (see ShoeController). It has a controller of its own because {@link ActivityController} is held to a method-count ceiling.
 */
@RestController
@RequestMapping("/api/activities")
public class ActivityEditController {

    private static final Set<String> EDITABLE = Set.of(
            ActivityEditedEvent.PERCEIVED_EXERTION, ActivityEditedEvent.RUN_TYPE, ActivityEditedEvent.TAGS,
            ActivityEditedEvent.NAME, ActivityEditedEvent.NOTES, ActivityEditedEvent.USE_RATING_FOR_EFFORT);

    private final AuthService authService;
    private final ActivityDataAccess activityDataAccess;
    private final RunLabelService labelService;
    private final ActivityEditService editService;

    public ActivityEditController(AuthService authService, ActivityDataAccess activityDataAccess,
                                  RunLabelService labelService, ActivityEditService editService) {
        this.authService = authService;
        this.activityDataAccess = activityDataAccess;
        this.labelService = labelService;
        this.editService = editService;
    }

    /**
     * Sets or clears what the runner says about a run. A request names the fields to change and nothing else is touched:
     * {@code name} (the title, which cannot be emptied), {@code notes} (text, or null for none),
     * {@code perceivedExertion} (a whole number from 1 to 10, or null), {@code useRatingForEffort} (true or false: score the
     * run from the rating even though it has a heart rate; it needs a rating, and clearing the rating clears it),
     * {@code runType} (race, long run, workout or null) and {@code tags} (the whole list the run should have, up to six, or
     * null for none). Every value is checked before any is saved, so a refused request changes nothing. A field that cannot be
     * edited is refused instead of ignored, so a typo does not look like a save. The answer holds the fields the request
     * named, as they are now. Returns 404 for a run that is not the caller's, without saying whether it exists. The edit is
     * made by {@link ActivityEditService}, all of it or none of it.
     */
    @PatchMapping("/{id}")
    public ResponseEntity<?> editActivity(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        Optional<Activity> found = activityDataAccess.findActivityForRunner(id, runner.get());
        if (found.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        if (body == null || body.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, "NOTHING_TO_CHANGE", "Say what to change.");
        }
        for (String field : body.keySet()) {
            if (!EDITABLE.contains(field)) {
                return error(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FIELD", "This field cannot be edited: " + field);
            }
        }

        // Check everything that can be checked on its own first, so that a request with one bad value saves none of its good ones.
        Integer rating = null;
        boolean ratingGiven = body.containsKey(ActivityEditedEvent.PERCEIVED_EXERTION);
        if (ratingGiven) {
            Object raw = body.get(ActivityEditedEvent.PERCEIVED_EXERTION);
            if (raw != null) {
                if (!(raw instanceof Number number) || number.doubleValue() != Math.rint(number.doubleValue())
                        || number.doubleValue() < 1 || number.doubleValue() > 10) {
                    return error(HttpStatus.BAD_REQUEST, "INVALID_PERCEIVED_EXERTION",
                            "Perceived exertion must be a whole number from 1 to 10, or null to clear it.");
                }
                rating = number.intValue();
            }
        }
        boolean useGiven = body.containsKey(ActivityEditedEvent.USE_RATING_FOR_EFFORT);
        boolean useRating = false;
        if (useGiven) {
            if (!(body.get(ActivityEditedEvent.USE_RATING_FOR_EFFORT) instanceof Boolean flag)) {
                return error(HttpStatus.BAD_REQUEST, "INVALID_USE_RATING_FOR_EFFORT", "Use the rating for effort is true or false.");
            }
            useRating = flag;
        }
        boolean nameGiven = body.containsKey(ActivityEditedEvent.NAME);
        String name = null;
        if (nameGiven) {
            try {
                name = RunTexts.cleanName(body.get(ActivityEditedEvent.NAME));
            } catch (IllegalArgumentException refused) {
                return error(HttpStatus.BAD_REQUEST, "INVALID_NAME", refused.getMessage());
            }
        }
        boolean notesGiven = body.containsKey(ActivityEditedEvent.NOTES);
        String notes = null;
        if (notesGiven) {
            try {
                notes = RunTexts.cleanNotes(body.get(ActivityEditedEvent.NOTES));
            } catch (IllegalArgumentException refused) {
                return error(HttpStatus.BAD_REQUEST, "INVALID_NOTES", refused.getMessage());
            }
        }
        boolean runTypeGiven = body.containsKey(ActivityEditedEvent.RUN_TYPE);
        String runType = null;
        if (runTypeGiven) {
            Object raw = body.get(ActivityEditedEvent.RUN_TYPE);
            if (raw != null && !(raw instanceof String text && RunTypes.isValid(text))) {
                return error(HttpStatus.BAD_REQUEST, "INVALID_RUN_TYPE",
                        "A run type is one of " + String.join(", ", RunTypes.ALL) + ", or null for none.");
            }
            runType = (String) raw;
        }
        boolean tagsGiven = body.containsKey(ActivityEditedEvent.TAGS);
        List<String> tags = List.of();
        if (tagsGiven) {
            Object raw = body.get(ActivityEditedEvent.TAGS);
            if (raw != null) {
                if (!(raw instanceof List<?> list)) {
                    return error(HttpStatus.BAD_REQUEST, "INVALID_TAGS", "Tags must be a list of words, or null for none.");
                }
                try {
                    tags = RunLabelService.cleanTags(list);
                } catch (IllegalArgumentException refused) {
                    return error(HttpStatus.BAD_REQUEST, "INVALID_TAGS", refused.getMessage());
                }
            }
        }

        ActivityEditService.Outcome outcome;
        try {
            Optional<ActivityEditService.Outcome> made = editService.apply(runner.get(), id, new ActivityEditService.Request(
                    ratingGiven, rating, useGiven, useRating, nameGiven, name, notesGiven, notes, runTypeGiven, runType, tagsGiven, tags));
            if (made.isEmpty()) {
                return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
            }
            outcome = made.get();
        } catch (ActivityEditService.Refused refused) {
            return error(HttpStatus.BAD_REQUEST, refused.code(), refused.getMessage());
        }
        Activity activity = outcome.activity();
        Set<String> changed = outcome.changed();
        RunLabelService.Labels labels = outcome.labels();

        Map<String, Object> saved = new LinkedHashMap<>();
        saved.put("id", id);
        if (nameGiven) {
            saved.put("name", activity.getName());
        }
        if (notesGiven) {
            saved.put("notes", activity.getNotes());
        }
        if (ratingGiven) {
            saved.put("perceivedExertion", rating);
        }
        if (useGiven || changed.contains(ActivityEditedEvent.USE_RATING_FOR_EFFORT)) {
            saved.put("useRatingForEffort", activity.isUseRatingForEffort());
        }
        if (runTypeGiven) {
            saved.put("runType", labels == null ? activity.getRunType() : labels.runType());
        }
        if (tagsGiven) {
            saved.put("tags", labels == null ? List.of() : labels.tags());
        }
        return ResponseEntity.ok(saved);
    }

    /**
     * Everything the edit drawer shows for one run, in one answer: the title, the notes, the rating and whether it is used for
     * the effort score, the run type and tags with the runner's most used tags to offer, the shoe, and the limits the form
     * checks against so the page and the server say the same thing. Returns 404 for a run that is not the caller's, without
     * saying whether it exists.
     */
    @GetMapping("/{id}/edit")
    public ResponseEntity<?> editableDetails(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        Optional<Activity> found = activityDataAccess.findActivityForRunner(id, runner.get());
        if (found.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        Activity activity = found.get();
        RunLabelService.Labels labels = labelService.labels(activity);
        Map<String, Object> limits = new LinkedHashMap<>();
        limits.put("maxNameLength", RunTexts.MAX_NAME_LENGTH);
        limits.put("maxNotesLength", RunTexts.MAX_NOTES_LENGTH);
        limits.put("maxTags", RunLabelService.MAX_TAGS);
        limits.put("maxTagLength", RunLabelService.MAX_TAG_LENGTH);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", id);
        body.put("name", activity.getName());
        body.put("notes", activity.getNotes());
        body.put("perceivedExertion", activity.getPerceivedExertion());
        body.put("useRatingForEffort", activity.isUseRatingForEffort());
        body.put("runType", labels.runType());
        body.put("tags", labels.tags());
        body.put("shoeId", activity.getShoeId());
        body.put("runTypes", RunTypes.ALL);
        body.put("suggestions", labelService.usage(runner.get().getId(), RunLabelService.SUGGESTIONS));
        body.put("limits", limits);
        return ResponseEntity.ok(body);
    }

    /**
     * A run's run type and tags, and the runner's most used tags to offer when they add one. Returns 404 for a run that is
     * not the caller's, without saying whether it exists.
     */
    @GetMapping("/{id}/labels")
    public ResponseEntity<?> labels(
            @PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        }
        Optional<Activity> found = activityDataAccess.findActivityForRunner(id, runner.get());
        if (found.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        }
        RunLabelService.Labels labels = labelService.labels(found.get());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", id);
        body.put("runType", labels.runType());
        body.put("tags", labels.tags());
        body.put("runTypes", RunTypes.ALL);
        body.put("maxTags", RunLabelService.MAX_TAGS);
        body.put("maxTagLength", RunLabelService.MAX_TAG_LENGTH);
        body.put("suggestions", labelService.usage(runner.get().getId(), RunLabelService.SUGGESTIONS));
        return ResponseEntity.ok(body);
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}
