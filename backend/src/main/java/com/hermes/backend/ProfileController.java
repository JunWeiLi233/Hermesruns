package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final ActivityNormalizationService activityNormalizationService;

    public ProfileController(
            AuthService authService,
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            ActivityNormalizationService activityNormalizationService
    ) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.activityNormalizationService = activityNormalizationService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        return ResponseEntity.ok(toProfileResponse(runnerOptional.get()));
    }

    @PatchMapping("/me/name")
    public ResponseEntity<?> updateDisplayName(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody UpdateDisplayNameRequest request
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        String displayName = request == null ? null : request.displayName();
        String normalizedDisplayName = displayName == null ? "" : displayName.trim();
        if (normalizedDisplayName.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "Display name is required.");
        }

        if (normalizedDisplayName.length() > 60) {
            return error(HttpStatus.BAD_REQUEST, "Display name must be 60 characters or fewer.");
        }

        Runner runner = runnerOptional.get();
        runner.setDisplayName(normalizedDisplayName);
        runnerRepository.save(runner);
        return ResponseEntity.ok(toProfileResponse(runner));
    }

    @GetMapping("/heatmap")
    public ResponseEntity<?> heatmap(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }

        Runner runner = runnerOptional.get();
        activityNormalizationService.backfillActivityTypes(runner);
        List<ActivityPoint> activityPoints = activityPointRepository.findHeatmapPointsByRunnerAndActivityType(
                runner,
                ActivityType.RUN
        );
        HeatmapBounds bounds = buildBounds(activityPoints);
        List<HeatPoint> points = activityPoints.stream()
                .map(point -> new HeatPoint(point.getLatitude(), point.getLongitude(), 1.0))
                .toList();

        return ResponseEntity.ok(new HeatmapResponse(
                points,
                points.size(),
                activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN),
                bounds
        ));
    }

    private HeatmapBounds buildBounds(List<ActivityPoint> activityPoints) {
        if (activityPoints.isEmpty()) {
            return null;
        }

        double minLatitude = Double.MAX_VALUE;
        double maxLatitude = -Double.MAX_VALUE;
        double minLongitude = Double.MAX_VALUE;
        double maxLongitude = -Double.MAX_VALUE;

        for (ActivityPoint point : activityPoints) {
            minLatitude = Math.min(minLatitude, point.getLatitude());
            maxLatitude = Math.max(maxLatitude, point.getLatitude());
            minLongitude = Math.min(minLongitude, point.getLongitude());
            maxLongitude = Math.max(maxLongitude, point.getLongitude());
        }

        return new HeatmapBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);
    }

    private ProfileResponse toProfileResponse(Runner runner) {
        return new ProfileResponse(runner.getEmail(), runner.getDisplayName());
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    public record ProfileResponse(String email, String displayName) {
    }

    public record UpdateDisplayNameRequest(String displayName) {
    }

    public record HeatPoint(double latitude, double longitude, double intensity) {
    }

    public record HeatmapBounds(
            double minLatitude,
            double minLongitude,
            double maxLatitude,
            double maxLongitude
    ) {
    }

    public record HeatmapResponse(
            List<HeatPoint> points,
            int pointCount,
            long activityCount,
            HeatmapBounds bounds
    ) {
    }
}
