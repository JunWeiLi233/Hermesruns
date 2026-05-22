package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/coach")
public class CoachController {

    private final AuthService authService;
    private final AutomatedCoachService automatedCoachService;
    private final ReadinessService readinessService;

    public CoachController(AuthService authService, AutomatedCoachService automatedCoachService, ReadinessService readinessService) {
        this.authService = authService;
        this.automatedCoachService = automatedCoachService;
        this.readinessService = readinessService;
    }

    @GetMapping("/readiness-trend")
    public ResponseEntity<?> getReadinessTrend(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(defaultValue = "7") int days
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(readinessService.getReadinessTrend(runner.get(), days));
    }

    @GetMapping("/state")
    public ResponseEntity<?> getState(@RequestHeader(value = "Authorization", required = false) String auth) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(automatedCoachService.getCoachState(runner.get()));
    }

    @GetMapping("/schedule")
    public ResponseEntity<?> getSchedule(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestParam(defaultValue = "14") int days
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(automatedCoachService.getSchedule(runner.get(), days));
    }

    @GetMapping("/today")
    public ResponseEntity<?> getToday(@RequestHeader(value = "Authorization", required = false) String auth) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(automatedCoachService.getTodayWithReadiness(runner.get()));
    }

    @PostMapping("/recovery")
    public ResponseEntity<?> postRecovery(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody RecoveryBody body
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        try {
            automatedCoachService.logRecoveryMetrics(
                    runner.get(),
                    body != null ? body.restingHeartRateBpm() : null,
                    body != null ? body.sleepScore() : null,
                    body != null ? body.hrvMs() : null,
                    body != null ? body.stressScore() : null
            );
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (IllegalArgumentException e) {
            return error(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @PatchMapping("/profile")
    public ResponseEntity<?> patchProfile(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody CoachProfileBody body
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        try {
            automatedCoachService.updateCoachProfile(
                    runner.get(),
                    body != null ? body.maxHeartRateBpm() : null,
                    body != null ? body.restingHeartRateBpm() : null
            );
            return ResponseEntity.ok(automatedCoachService.getCoachState(runner.get()));
        } catch (IllegalArgumentException e) {
            return error(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @PostMapping("/training-block")
    public ResponseEntity<?> startBlock(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody TrainingBlockBody body
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        if (body == null || body.raceDistanceKm() == null || body.raceDistanceKm() <= 0) {
            return error(HttpStatus.BAD_REQUEST, "raceDistanceKm is required.");
        }
        try {
            if (body.name() != null) {
                InputSanitizer.rejectControlAndHtmlChars(body.name(), "name");
            }
        } catch (IllegalArgumentException e) {
            return error(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        automatedCoachService.startTrainingBlock(
                runner.get(),
                body.raceDistanceKm(),
                body.targetRaceDate(),
                body.name()
        );
        return ResponseEntity.ok(automatedCoachService.getCoachState(runner.get()));
    }

    @PostMapping("/training-block/stop")
    public ResponseEntity<?> stopBlock(@RequestHeader(value = "Authorization", required = false) String auth) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        automatedCoachService.stopTrainingBlock(runner.get());
        return ResponseEntity.ok(automatedCoachService.getCoachState(runner.get()));
    }

    @GetMapping("/alerts")
    public ResponseEntity<?> listAlerts(@RequestHeader(value = "Authorization", required = false) String auth) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(automatedCoachService.listAlerts(runner.get()));
    }

    @PostMapping("/alerts/{id}/dismiss")
    public ResponseEntity<?> dismissAlert(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable Long id
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(auth);
        if (runner.isEmpty()) {
            return unauthorized();
        }
        boolean ok = automatedCoachService.dismissAlert(runner.get(), id);
        if (!ok) {
            return error(HttpStatus.NOT_FOUND, "Alert not found.");
        }
        return ResponseEntity.ok(Map.of("ok", true));
    }

    public record RecoveryBody(Integer restingHeartRateBpm, Integer sleepScore, Integer hrvMs, Integer stressScore) {}

    public record CoachProfileBody(Integer maxHeartRateBpm, Integer restingHeartRateBpm) {}

    public record TrainingBlockBody(Double raceDistanceKm, LocalDate targetRaceDate, String name) {}

    private ResponseEntity<Map<String, String>> unauthorized() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }
}
