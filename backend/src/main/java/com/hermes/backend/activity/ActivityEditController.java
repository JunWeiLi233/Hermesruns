package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
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
 * Edits the details of one of the signed-in runner's runs: how hard it felt (a rating of 1 to 10), what kind of run it was
 * and the tags on it. It has a controller of its own because {@link ActivityController} is held to a method-count ceiling.
 */
@RestController
@RequestMapping("/api/activities")
public class ActivityEditController {

    private static final Set<String> EDITABLE = Set.of(
            ActivityEditedEvent.PERCEIVED_EXERTION, ActivityEditedEvent.RUN_TYPE, ActivityEditedEvent.TAGS);

    private final AuthService authService;
    private final ActivityDataAccess activityDataAccess;
    private final RunLabelService labelService;
    private final ApplicationEventPublisher events;

    public ActivityEditController(AuthService authService, ActivityDataAccess activityDataAccess,
                                  RunLabelService labelService, ApplicationEventPublisher events) {
        this.authService = authService;
        this.activityDataAccess = activityDataAccess;
        this.labelService = labelService;
        this.events = events;
    }

    /**
     * Sets or clears what the runner says about a run. A request names the fields to change and nothing else is touched:
     * {@code perceivedExertion} (a whole number from 1 to 10, or null), {@code runType} (race, long run, workout or null)
     * and {@code tags} (the whole list the run should have, up to six, or null for none). Every value is checked before
     * any is saved, so a refused request changes nothing. A field that cannot be edited is refused instead of ignored, so
     * a typo does not look like a save. The answer holds the fields the request named, as they are now. Returns 404 for a
     * run that is not the caller's, without saying whether it exists.
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

        // Check everything first, so that a request with one bad value saves none of its good ones.
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

        Activity activity = found.get();
        Set<String> changed = new LinkedHashSet<>();
        if (ratingGiven && !Objects.equals(activity.getPerceivedExertion(), rating)) {
            activity.setPerceivedExertion(rating);
            activityDataAccess.save(activity);
            changed.add(ActivityEditedEvent.PERCEIVED_EXERTION);
        }
        RunLabelService.Labels labels = null;
        if (runTypeGiven || tagsGiven) {
            RunLabelService.Applied applied = labelService.apply(runner.get(), activity,
                    new RunLabelService.Change(runTypeGiven, runType, tagsGiven, tags), tags);
            labels = applied.labels();
            if (applied.runTypeChanged()) {
                changed.add(ActivityEditedEvent.RUN_TYPE);
            }
            if (applied.tagsChanged()) {
                changed.add(ActivityEditedEvent.TAGS);
            }
        }
        if (!changed.isEmpty()) {
            events.publishEvent(new ActivityEditedEvent(runner.get().getId(), id, changed));
        }

        Map<String, Object> saved = new LinkedHashMap<>();
        saved.put("id", id);
        if (ratingGiven) {
            saved.put("perceivedExertion", rating);
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
