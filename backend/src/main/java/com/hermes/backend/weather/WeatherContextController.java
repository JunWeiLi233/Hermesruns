package com.hermes.backend.weather;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/weather")
public class WeatherContextController {
    private final AuthService authService;
    private final AcclimatizationService acclimatizationService;
    private final WeatherAdjustedFitnessService fitnessService;
    private final ActivityRepository activityRepository;
    private final WeatherForecastService forecastService;

    public WeatherContextController(AuthService authService,
                                  AcclimatizationService acclimatizationService,
                                  WeatherAdjustedFitnessService fitnessService,
                                  ActivityRepository activityRepository,
                                  WeatherForecastService forecastService) {
        this.authService = authService;
        this.acclimatizationService = acclimatizationService;
        this.fitnessService = fitnessService;
        this.activityRepository = activityRepository;
        this.forecastService = forecastService;
    }

    @GetMapping("/forecast")
    public ResponseEntity<?> getForecast(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude
    ) {
        if (authService.findByAuthorizationHeader(authHeader).isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }
        if (!isValidGpsCoordinate(latitude, longitude)) {
            return error(HttpStatus.BAD_REQUEST, "Invalid weather coordinates.");
        }

        try {
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).mustRevalidate())
                    .body(forecastService.fetchForecast(latitude, longitude));
        } catch (WeatherProviderRateLimitedException exception) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "Weather provider rate limited. Please try again later.");
        } catch (Exception exception) {
            return error(HttpStatus.BAD_GATEWAY, "Weather provider unavailable.");
        }
    }

    public ResponseEntity<?> getContext(String authHeader) {
        return getContext(authHeader, null, null);
    }

    @GetMapping("/context")
    public ResponseEntity<?> getContext(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "latitude", required = false) Double latitude,
            @RequestParam(value = "longitude", required = false) Double longitude
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(authHeader);
        if (runnerOpt.isEmpty()) {
            return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
        }

        if ((latitude != null || longitude != null) && !isValidGpsCoordinate(latitude, longitude)) {
            return error(HttpStatus.BAD_REQUEST, "Invalid weather coordinates.");
        }

        try {
            AcclimatizationService.WeatherContextResponse response = latitude != null
                    ? acclimatizationService.buildContext(runnerOpt.get(), latitude, longitude)
                    : acclimatizationService.buildContext(runnerOpt.get());
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.maxAge(15, TimeUnit.MINUTES).mustRevalidate())
                    .body(response);
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

    private boolean isValidGpsCoordinate(Double latitude, Double longitude) {
        return latitude != null
                && longitude != null
                && Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && latitude >= -90.0
                && latitude <= 90.0
                && longitude >= -180.0
                && longitude <= 180.0;
    }
}
