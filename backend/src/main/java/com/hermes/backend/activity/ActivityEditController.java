package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Edits the rating, type and tags of one of the signed-in runner's runs.
 * It has a controller of its own because {@link ActivityController} is held to a method-count ceiling.
 */
@RestController
@RequestMapping("/api/activities")
public class ActivityEditController {

    private final AuthService authService;
    private final ActivityDataAccess activityDataAccess;
    private final ApplicationEventPublisher events;

    @Autowired
    private RunLabelService labelService;

    public ActivityEditController(AuthService authService, ActivityDataAccess activityDataAccess, ApplicationEventPublisher events) {
        this.authService = authService;
        this.activityDataAccess = activityDataAccess;
        this.events = events;
    }

    /**
     * Sets or clears the perceived exertion of a run: a whole number from 1 to 10, or null to take the rating
     * back. A field that cannot be edited is refused instead of ignored, so a typo does not look like a save.
     * Returns 404 for a run that is not the caller's, without saying whether it exists.
     */
    @PatchMapping("/{id}")
    @Transactional
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
            if (!Set.of(ActivityEditedEvent.PERCEIVED_EXERTION, "runType", "tags").contains(field)) {
                return error(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FIELD", "This field cannot be edited: " + field);
            }
        }

        Integer rating = null;
        Object raw = body.get(ActivityEditedEvent.PERCEIVED_EXERTION);
        if (raw != null) {
            if (!(raw instanceof Number number) || number.doubleValue() != Math.rint(number.doubleValue())
                    || number.doubleValue() < 1 || number.doubleValue() > 10) {
                return error(HttpStatus.BAD_REQUEST, "INVALID_PERCEIVED_EXERTION",
                        "Perceived exertion must be a whole number from 1 to 10, or null to clear it.");
            }
            rating = number.intValue();
        }

        boolean typeGiven = body.containsKey("runType");
        Object rawType = body.get("runType");
        if (typeGiven && rawType != null && (!(rawType instanceof String type) || !RunTypes.isValid(type))) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_RUN_TYPE", "A run type is race, long run or workout.");
        }
        boolean tagsGiven = body.containsKey("tags");
        Object rawTags = body.get("tags");
        if (tagsGiven && rawTags != null && !(rawTags instanceof List<?>)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_TAGS", "Tags must be a list of text, or null to clear them.");
        }
        List<String> cleanTags;
        try {
            cleanTags = tagsGiven && rawTags != null ? RunLabelService.cleanTags((List<?>) rawTags) : List.of();
        } catch (IllegalArgumentException refused) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_TAGS", refused.getMessage());
        }

        Activity activity = found.get();
        if (body.containsKey(ActivityEditedEvent.PERCEIVED_EXERTION) && !Objects.equals(activity.getPerceivedExertion(), rating)) {
            activity.setPerceivedExertion(rating);
            activityDataAccess.saveMetadata(activity);
            events.publishEvent(new ActivityEditedEvent(runner.get().getId(), id, Set.of(ActivityEditedEvent.PERCEIVED_EXERTION)));
        }
        Map<String, Object> saved = new LinkedHashMap<>();
        saved.put("id", id);
        if (body.containsKey(ActivityEditedEvent.PERCEIVED_EXERTION)) saved.put("perceivedExertion", rating);
        if (typeGiven || tagsGiven) {
            RunLabelService.Applied applied = labelService.apply(runner.get(), activity,
                    new RunLabelService.Change(typeGiven, (String) rawType, tagsGiven, cleanTags), cleanTags);
            if (typeGiven) saved.put("runType", applied.labels().runType());
            if (tagsGiven) saved.put("tags", applied.labels().tags());
        }
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{id}/labels")
    public ResponseEntity<?> labels(@PathVariable("id") Long id,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Invalid or expired session token.");
        Optional<Activity> activity = activityDataAccess.findActivityForRunner(id, runner.get());
        if (activity.isEmpty()) return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Activity not found.");
        RunLabelService.Labels labels = labelService.labels(activity.get());
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("id", id);
        answer.put("runType", labels.runType());
        answer.put("tags", labels.tags());
        answer.put("runTypes", RunTypes.ALL);
        answer.put("maxTags", RunLabelService.MAX_TAGS);
        answer.put("maxTagLength", RunLabelService.MAX_TAG_LENGTH);
        answer.put("suggestions", labelService.usage(runner.get().getId(), RunLabelService.SUGGESTIONS));
        return ResponseEntity.ok(answer);
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "code", code));
    }
}
