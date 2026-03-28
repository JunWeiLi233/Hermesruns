package com.hermes.backend;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/training/muscle")
public class MuscleTrainingController {

    private final AuthService authService;
    private final MuscleTrainingPlannerService plannerService;

    public MuscleTrainingController(AuthService authService, MuscleTrainingPlannerService plannerService) {
        this.authService = authService;
        this.plannerService = plannerService;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(plannerService.getProfile(runnerOpt.get()));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) MuscleTrainingPlannerService.MuscleProfileUpdate update
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }
        try {
            return ResponseEntity.ok(plannerService.updateProfile(
                    runnerOpt.get(),
                    update == null ? new MuscleTrainingPlannerService.MuscleProfileUpdate(null, null, null, null, null) : update
            ));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", exception.getMessage()));
        }
    }

    @GetMapping("/plan")
    public ResponseEntity<?> getPlan(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(plannerService.getPlan(runnerOpt.get()));
    }

    @GetMapping("/check-in/today")
    public ResponseEntity<?> getTodayCheckIn(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }
        MuscleTrainingPlannerService.TodayCheckInDto checkIn = plannerService.getTodayCheckIn(runnerOpt.get());
        if (checkIn == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(checkIn);
    }

    @PutMapping("/check-in/today")
    public ResponseEntity<?> updateTodayCheckIn(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) MuscleTrainingPlannerService.TodayCheckInUpdate update
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }
        try {
            return ResponseEntity.ok(plannerService.updateTodayCheckIn(runnerOpt.get(), update));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", exception.getMessage()));
        }
    }

    @DeleteMapping("/check-in/today")
    public ResponseEntity<?> clearTodayCheckIn(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }
        plannerService.clearTodayCheckIn(runnerOpt.get());
        return ResponseEntity.noContent()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .build();
    }

    @GetMapping("/recommendation")
    public ResponseEntity<?> getRecommendation(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        return getPlan(authHeader);
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid Session"));
    }
}
