package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/training/muscle")
public class MuscleTrainingController {

    private final MuscleTrainingPlannerService plannerService;
    private final AutomatedCoachService automatedCoachService;
    private final AuthService authService;

    public MuscleTrainingController(MuscleTrainingPlannerService plannerService, AutomatedCoachService automatedCoachService, AuthService authService) {
        this.plannerService = plannerService;
        this.automatedCoachService = automatedCoachService;
        this.authService = authService;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authHeader);
        if (runner.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        return ResponseEntity.ok(plannerService.getProfile(runner.get()));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody MuscleProfileUpdate update
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authHeader);
        if (runner.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        return ResponseEntity.ok(plannerService.updateProfile(runner.get(), update));
    }

    @GetMapping("/plan")
    public ResponseEntity<?> getPlan(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        Runner runner = runnerOpt.get();

        AutomatedCoachService.CoachStateDto coachState = automatedCoachService.getCoachState(runner);
        List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule = automatedCoachService.getSchedule(runner, 7);

        return ResponseEntity.ok(plannerService.getPlan(runner, coachState, schedule));
    }

    @GetMapping("/today")
    public ResponseEntity<?> getTodayCheckIn(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authHeader);
        if (runner.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        TodayCheckInDto todayCheckIn = plannerService.getTodayCheckIn(runner.get());
        if (todayCheckIn == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(todayCheckIn);
    }

    @PutMapping("/today")
    public ResponseEntity<?> updateTodayCheckIn(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody TodayCheckInUpdate update
    ) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authHeader);
        if (runner.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        try {
            return ResponseEntity.ok(plannerService.updateTodayCheckIn(runner.get(), update));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("error", exception.getMessage()));
        }
    }

    @DeleteMapping("/today")
    public ResponseEntity<?> clearTodayCheckIn(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runner = authService.findByAuthorizationHeader(authHeader);
        if (runner.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        plannerService.clearTodayCheckIn(runner.get());
        return ResponseEntity.noContent().build();
    }
}
