package com.hermes.backend.coaching;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in runner's training log. Own data only: the runner comes from the session, never from the request. */
@RestController
@RequestMapping("/api/training")
public class TrainingLogController {

    private final AuthService authService;
    private final TrainingLogService service;

    public TrainingLogController(AuthService authService, TrainingLogService service) {
        this.authService = authService;
        this.service = service;
    }

    /**
     * @param to      a day: the newest week returned is the week of it (default and latest allowed: the runner's today)
     * @param weeks   how many weeks, 1 to 26; default 12
     * @param runType keep only runs of this type: RACE, LONG_RUN or WORKOUT
     * @param tag     keep only runs with this tag; repeat it to ask for runs that have every one of them
     */
    @GetMapping("/log")
    public ResponseEntity<?> log(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestParam(value = "to", required = false) String to,
            @RequestParam(value = "weeks", required = false) String weeks,
            @RequestParam(value = "runType", required = false) String runType,
            @RequestParam(value = "tag", required = false) List<String> tag) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
        }
        try {
            return ResponseEntity.ok(service.log(runner.get(), day(to), count(weeks),
                    runType == null || runType.isBlank() ? null : runType.trim(), tag));
        } catch (IllegalArgumentException refused) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", refused.getMessage(), "code", "INVALID_LOG_REQUEST"));
        }
    }

    private static LocalDate day(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException notADate) {
            throw new IllegalArgumentException("'to' must be a day written yyyy-MM-dd.");
        }
    }

    private static Integer count(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException notANumber) {
            throw new IllegalArgumentException("'weeks' must be a whole number.");
        }
    }
}
