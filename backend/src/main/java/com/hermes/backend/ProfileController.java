package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {
    private static final int MAX_HEATMAP_POINTS = 24000;
    private static final int GUARANTEED_RECENT_HEATMAP_ACTIVITIES = 5;

    private final AuthService authService;
    private final RunnerRepository runnerRepository;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final ActivityNormalizationService activityNormalizationService;
    private final PersonalRecordService personalRecordService;

    public ProfileController(
            AuthService authService,
            RunnerRepository runnerRepository,
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            ActivityNormalizationService activityNormalizationService,
            PersonalRecordService personalRecordService
    ) {
        this.authService = authService;
        this.runnerRepository = runnerRepository;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.activityNormalizationService = activityNormalizationService;
        this.personalRecordService = personalRecordService;
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

        try {
            InputSanitizer.rejectControlAndHtmlChars(normalizedDisplayName, "displayName");
        } catch (IllegalArgumentException ex) {
            return error(HttpStatus.BAD_REQUEST, "Display name contains invalid characters.");
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
        if (activityRepository.existsByRunnerAndActivityTypeIsNull(runner)) {
            activityNormalizationService.backfillActivityTypes(runner);
        }

        long activityCount = activityRepository.countByRunnerAndActivityType(runner, ActivityType.RUN);
        if (activityCount <= 0) {
            return ResponseEntity.ok(new HeatmapResponse(List.of(), 0, 0, null));
        }

        long sourcePointCount = activityPointRepository.countHeatmapPointsByRunnerAndType(
                runner.getId(),
                ActivityType.RUN.name()
        );
        if (sourcePointCount <= 0) {
            return ResponseEntity.ok(new HeatmapResponse(List.of(), 0, activityCount, null));
        }

        List<Long> recentActivityIds = activityRepository.findRecentIdsByRunnerAndActivityType(
                runner.getId(),
                ActivityType.RUN.name(),
                GUARANTEED_RECENT_HEATMAP_ACTIVITIES
        );
        List<Object[]> activityPoints = new ArrayList<>();
        if (!recentActivityIds.isEmpty()) {
            activityPoints.addAll(activityPointRepository.findHeatmapPointsByActivityIds(recentActivityIds));
        }

        if (activityPoints.size() < MAX_HEATMAP_POINTS) {
            int remainingBudget = MAX_HEATMAP_POINTS - activityPoints.size();
            long olderPointCount = recentActivityIds.isEmpty()
                    ? sourcePointCount
                    : activityPointRepository.countHeatmapPointsByRunnerAndTypeExcludingActivities(
                            runner.getId(),
                            ActivityType.RUN.name(),
                            recentActivityIds
                    );

            if (olderPointCount > 0 && remainingBudget > 0) {
                int stride = (int) Math.max(1L, (olderPointCount + remainingBudget - 1) / remainingBudget);
                activityPoints.addAll(activityPointRepository.findHeatmapSamplesByRunnerAndType(
                        runner.getId(),
                        ActivityType.RUN.name(),
                        recentActivityIds,
                        stride,
                        remainingBudget
                ));
            }
        } else if (activityPoints.size() > MAX_HEATMAP_POINTS) {
            activityPoints = new ArrayList<>(activityPoints.subList(0, MAX_HEATMAP_POINTS));
        }

        HeatmapBounds bounds = buildBoundsFromSamples(activityPoints);
        List<HeatPoint> points = buildHeatPoints(activityPoints);

        return ResponseEntity.ok(new HeatmapResponse(
                points,
                points.size(),
                activityCount,
                bounds
        ));
    }

    @GetMapping("/personal-records")
    public ResponseEntity<?> personalRecords(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        Optional<Runner> runnerOptional = authService.findByAuthorizationHeader(authorizationHeader);
        if (runnerOptional.isEmpty()) {
            return unauthorized();
        }
        return ResponseEntity.ok(personalRecordService.buildForRunner(runnerOptional.get()));
    }

    private HeatmapBounds buildBoundsFromSamples(List<Object[]> points) {
        if (points.isEmpty()) {
            return null;
        }

        double minLatitude = Double.MAX_VALUE;
        double maxLatitude = -Double.MAX_VALUE;
        double minLongitude = Double.MAX_VALUE;
        double maxLongitude = -Double.MAX_VALUE;

        for (Object[] point : points) {
            double lat = toDouble(point[1]);
            double lng = toDouble(point[2]);
            minLatitude = Math.min(minLatitude, lat);
            maxLatitude = Math.max(maxLatitude, lat);
            minLongitude = Math.min(minLongitude, lng);
            maxLongitude = Math.max(maxLongitude, lng);
        }

        return new HeatmapBounds(minLatitude, minLongitude, maxLatitude, maxLongitude);
    }

    private List<HeatPoint> buildHeatPoints(List<Object[]> activityPoints) {
        if (activityPoints.isEmpty()) {
            return List.of();
        }

        List<Double> rawSpeeds = new ArrayList<>();
        Double previousSpeed = null;

        for (Object[] point : activityPoints) {
            Double speedMetersPerSecond = extractPointSpeed(point);
            if (speedMetersPerSecond == null) {
                speedMetersPerSecond = previousSpeed;
            } else {
                previousSpeed = speedMetersPerSecond;
            }
            rawSpeeds.add(speedMetersPerSecond);
        }

        double minSpeed = Double.MAX_VALUE;
        double maxSpeed = -Double.MAX_VALUE;

        for (Double rawSpeed : rawSpeeds) {
            if (rawSpeed == null) {
                continue;
            }
            minSpeed = Math.min(minSpeed, rawSpeed);
            maxSpeed = Math.max(maxSpeed, rawSpeed);
        }

        boolean hasSpeedRange = minSpeed != Double.MAX_VALUE && maxSpeed > minSpeed;
        List<HeatPoint> points = new ArrayList<>(activityPoints.size());

        for (int i = 0; i < activityPoints.size(); i++) {
            Object[] point = activityPoints.get(i);
            Double rawSpeed = rawSpeeds.get(i);
            double speedRatio = hasSpeedRange && rawSpeed != null
                    ? clamp((rawSpeed - minSpeed) / (maxSpeed - minSpeed), 0.0, 1.0)
                    : 0.5;
            points.add(new HeatPoint(
                    toLong(point[0]),
                    toDouble(point[1]),
                    toDouble(point[2]),
                    1.0,
                    speedRatio
            ));
        }

        return points;
    }

    private Double extractPointSpeed(Object[] point) {
        if (point == null || point.length < 5) {
            return null;
        }
        Double pointDistance = point[3] instanceof Number number ? number.doubleValue() : null;
        Integer pointElapsed = point[4] instanceof Number number ? number.intValue() : null;

        if (pointDistance == null || pointElapsed == null || pointElapsed <= 0) {
            return null;
        }
        if (pointDistance <= 0) {
            return null;
        }

        return pointDistance / pointElapsed;
    }

    private double toDouble(Object value) {
        return value instanceof Number number ? number.doubleValue() : 0.0;
    }

    private long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private ProfileResponse toProfileResponse(Runner runner) {
        boolean stravaLinked = runner.getStravaAthleteId() != null
                && runner.getStravaRefreshToken() != null
                && !runner.getStravaRefreshToken().isBlank();
        boolean showLanguageSettingsHint = runner.getCreatedAt() != null
                && runner.getCreatedAt().isAfter(LocalDateTime.now().minusHours(24));
        return new ProfileResponse(
                runner.getEmail(),
                runner.getDisplayName(),
                stravaLinked,
                showLanguageSettingsHint
        );
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    public record ProfileResponse(
            String email,
            String displayName,
            boolean stravaLinked,
            boolean showLanguageSettingsHint
    ) {
    }

    public record UpdateDisplayNameRequest(String displayName) {
    }

    public record HeatPoint(long activityId, double latitude, double longitude, double intensity, double speedRatio) {
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
