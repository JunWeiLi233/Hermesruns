package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/weather")
public class WeatherContextController {
    private final AuthService authService;
    private final AcclimatizationService acclimatizationService;
    private final WeatherAdjustedFitnessService fitnessService;
    private final ActivityRepository activityRepository;

    public WeatherContextController(AuthService authService,
                                  AcclimatizationService acclimatizationService,
                                  WeatherAdjustedFitnessService fitnessService,
                                  ActivityRepository activityRepository) {
        this.authService = authService;
        this.acclimatizationService = acclimatizationService;
        this.fitnessService = fitnessService;
        this.activityRepository = activityRepository;
    }

    @GetMapping("/context")
    public ResponseEntity<?> getContext(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        try {
            AcclimatizationService.WeatherContextResponse response = acclimatizationService.buildContext(runnerOpt.get());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException exception) {
            return error(HttpStatus.BAD_REQUEST, exception.getMessage());
        } catch (Exception exception) {
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "Server error");
        }
    }

    @GetMapping("/fitness-interpretation")
    public ResponseEntity<?> getFitnessInterpretation(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        List<Activity> recentRuns = activityRepository.findRunsBetween(
                runnerOpt.get(),
                ActivityType.RUN,
                java.time.LocalDateTime.now().minusDays(90),
                java.time.LocalDateTime.now().plusDays(1)
        );

        WeatherAdjustedFitnessService.WeatherAdjustedFitnessResult result = fitnessService.calculateAdjustedFitness(recentRuns);
        return ResponseEntity.ok(result);
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
