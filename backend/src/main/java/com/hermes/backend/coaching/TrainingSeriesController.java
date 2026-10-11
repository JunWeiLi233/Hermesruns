package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in runner's fitness, fatigue and form over time, and their weekly effort against their usual range.
 * Own data only: the runner comes from the session, never from the request.
 */
@RestController
@RequestMapping("/api/training")
public class TrainingSeriesController {

    private final AuthService authService;
    private final TrainingSeriesService service;

    public TrainingSeriesController(AuthService authService, TrainingSeriesService service) {
        this.authService = authService;
        this.service = service;
    }

    /**
     * @param from first day, {@code yyyy-MM-dd}; default 180 days before {@code to}
     * @param to   last day, {@code yyyy-MM-dd}; default and latest allowed is the runner's today
     */
    @GetMapping("/series")
    public ResponseEntity<?> series(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "to", required = false) String to) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        try {
            return ResponseEntity.ok(service.series(runner.get(), date(from, "from"), date(to, "to")));
        } catch (IllegalArgumentException refused) {
            return invalid(refused.getMessage());
        }
    }

    /** @param weeks how many weeks to return, 1 to 52, this week included; default 12 */
    @GetMapping("/weekly-effort")
    public ResponseEntity<?> weeklyEffort(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "weeks", required = false) String weeks) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        try {
            return ResponseEntity.ok(service.weekly(runner.get(), weeks(weeks)));
        } catch (IllegalArgumentException refused) {
            return invalid(refused.getMessage());
        }
    }

    private static LocalDate date(String value, String name) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException notADate) {
            throw new IllegalArgumentException("'" + name + "' must be a day written yyyy-MM-dd.");
        }
    }

    private static Integer weeks(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException notANumber) {
            throw new IllegalArgumentException("'weeks' must be a whole number.");
        }
    }

    private static ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
    }

    private static ResponseEntity<Map<String, String>> invalid(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", message, "code", "INVALID_RANGE"));
    }
}
