package com.hermes.backend.runner;

import com.hermes.backend.auth.AuthService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The race the signed-in runner cut their pace zones from. Own data only: the runner comes from the session, never from the
 * request. Every answer is the race as it is afterwards (or null) with the limits the form needs.
 */
@RestController
@RequestMapping("/api/training/pace-zones")
public class PaceZoneRaceController {

    private final AuthService authService;
    private final PaceZoneRaceService service;

    public PaceZoneRaceController(AuthService authService, PaceZoneRaceService service) {
        this.authService = authService;
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<?> get(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(view(service.get(runner.get()).orElse(null)));
    }

    /** Body: {@code distanceMeters}, {@code seconds} (a whole number) and {@code date} ({@code yyyy-MM-dd}). */
    @PutMapping
    public ResponseEntity<?> set(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) Map<String, Object> body) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        Map<String, Object> given = body == null ? Map.of() : body;
        try {
            double distance = number(given.get("distanceMeters"), "The distance must be a number of metres.");
            double seconds = number(given.get("seconds"), "The time must be a number of seconds.");
            if (seconds != Math.rint(seconds) || seconds > Integer.MAX_VALUE) {
                throw new IllegalArgumentException("The time must be a whole number of seconds.");
            }
            LocalDate date = date(given.get("date"));
            return ResponseEntity.ok(view(service.set(runner.get(), distance, (int) seconds, date)));
        } catch (IllegalArgumentException refused) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", refused.getMessage(), "code", "INVALID_RACE"));
        }
    }

    @DeleteMapping
    public ResponseEntity<?> clear(@RequestHeader(value = "Authorization", required = false) String authorizationHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authorizationHeader);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        service.clear(runner.get());
        return ResponseEntity.ok(view(null));
    }

    private static double number(Object value, String message) {
        if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue())) {
            throw new IllegalArgumentException(message);
        }
        return number.doubleValue();
    }

    private static LocalDate date(Object value) {
        if (!(value instanceof String text)) {
            throw new IllegalArgumentException("Give the date of the race.");
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (DateTimeParseException notADate) {
            throw new IllegalArgumentException("The date must be written year-month-day, like 2026-09-20.");
        }
    }

    private static Map<String, Object> view(PaceZoneRaceService.Race race) {
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("race", race == null ? null : raceView(race));
        Map<String, Object> limits = new LinkedHashMap<>();
        limits.put("minDistanceMeters", PaceZoneRaceService.MIN_DISTANCE_METERS);
        limits.put("maxDistanceMeters", PaceZoneRaceService.MAX_DISTANCE_METERS);
        limits.put("minSeconds", PaceZoneRaceService.MIN_SECONDS);
        limits.put("maxSeconds", PaceZoneRaceService.MAX_SECONDS);
        limits.put("minPaceSecondsPerKm", PaceZoneRaceService.MIN_PACE_SECONDS_PER_KM);
        limits.put("maxPaceSecondsPerKm", PaceZoneRaceService.MAX_PACE_SECONDS_PER_KM);
        limits.put("maxAgeDays", PaceZoneRaceService.MAX_AGE_DAYS);
        answer.put("limits", limits);
        return answer;
    }

    private static Map<String, Object> raceView(PaceZoneRaceService.Race race) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("distanceMeters", race.distanceMeters());
        view.put("seconds", race.seconds());
        view.put("date", race.date().toString());
        view.put("updatedAt", race.updatedAt() == null ? null : race.updatedAt().toString());
        return view;
    }

    private static ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid or expired session token.", "code", "UNAUTHORIZED"));
    }
}
