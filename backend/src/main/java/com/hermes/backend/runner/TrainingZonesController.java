package com.hermes.backend.runner;

import com.hermes.backend.auth.AuthService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Reads and changes the heart-rate zones of the signed-in runner. */
@RestController
@RequestMapping("/api/training/zones")
public class TrainingZonesController {

    /**
     * A change to the zones. Fields left out stay as they are. The numbers are bound as decimals on purpose:
     * binding them straight to integers would quietly cut 180.9 to 180, so a fraction is refused here instead.
     *
     * @param maxHeartRateBpm          a new max heart rate, 120 to 230
     * @param clearMaxHeartRate        true to go back to the default max heart rate
     * @param heartRateBoundaries      the first bpm of zones 2 to 5, four whole numbers that increase
     * @param resetHeartRateBoundaries true to go back to the automatic boundaries
     */
    public record UpdateBody(Double maxHeartRateBpm, Boolean clearMaxHeartRate, List<Double> heartRateBoundaries,
                             Boolean resetHeartRateBoundaries) {
    }

    private final AuthService authService;
    private final TrainingZonesService service;

    public TrainingZonesController(AuthService authService, TrainingZonesService service) {
        this.authService = authService;
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> zones(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(view(runner.get(), service.resolve(runner.get()), null));
    }

    @PutMapping
    public ResponseEntity<?> update(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) UpdateBody body) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        UpdateBody change = body == null ? new UpdateBody(null, null, null, null) : body;
        try {
            Integer maxHeartRate = wholeNumber(change.maxHeartRateBpm(), "Max heart rate");
            int[] boundaries = null;
            if (change.heartRateBoundaries() != null) {
                boundaries = new int[change.heartRateBoundaries().size()];
                for (int i = 0; i < boundaries.length; i++) {
                    Double boundary = change.heartRateBoundaries().get(i);
                    if (boundary == null) {
                        throw new IllegalArgumentException("Every zone boundary must be a whole number of beats per minute.");
                    }
                    boundaries[i] = wholeNumber(boundary, "Every zone boundary");
                }
            }
            TrainingZonesService.UpdateResult result = service.update(runner.get(), new TrainingZonesService.Update(
                    maxHeartRate, Boolean.TRUE.equals(change.clearMaxHeartRate()), boundaries,
                    Boolean.TRUE.equals(change.resetHeartRateBoundaries())));
            return ResponseEntity.ok(view(runner.get(), result.zones(), result.changed()));
        } catch (IllegalArgumentException refused) {
            return invalid(refused.getMessage());
        }
    }

    /**
     * The whole number a decimal stands for. A fraction is refused; a number too big for an int is cut to the
     * nearest int, which the zone rules then refuse for being outside the allowed beats per minute.
     */
    private static Integer wholeNumber(Double value, String what) {
        if (value == null) {
            return null;
        }
        if (value.isNaN() || value.isInfinite() || value != Math.rint(value)) {
            throw new IllegalArgumentException(what + " must be a whole number of beats per minute.");
        }
        return (int) value.doubleValue();
    }

    private TrainingZonesResponse view(Runner runner, TrainingZonesService.ResolvedZones resolved, Boolean recomputeQueued) {
        return TrainingZonesResponse.of(resolved, service.suggestMaxHeartRate(runner).orElse(null),
                service.defaultBoundaries(resolved.zones().maxHeartRate()), recomputeQueued);
    }

    private static ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
    }

    private static ResponseEntity<Map<String, String>> invalid(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", message, "code", "INVALID_ZONES"));
    }
}
