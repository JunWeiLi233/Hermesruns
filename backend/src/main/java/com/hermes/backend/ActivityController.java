package com.hermes.backend;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {
    private final AuthService authService;
    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final RunnerRepository runnerRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final RestTemplate restTemplate;

    public ActivityController(AuthService authService, ActivityRepository activityRepository,
                              ActivityPointRepository activityPointRepository, RunnerRepository runnerRepository,
                              SecretEncryptionService secretEncryptionService, RestTemplate restTemplate) {
        this.authService = authService;
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.runnerRepository = runnerRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.restTemplate = restTemplate;
    }

    @GetMapping
    public ResponseEntity<?> getUserRuns(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);

        if (activeUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        }

        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(activeUser.get(), ActivityType.RUN);
        return ResponseEntity.ok(runs);
    }

    @GetMapping("/heatmap")
    public ResponseEntity<?> getHeatmapPoints(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false) Integer year) {

        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        }

        Runner runner = activeUser.get();
        List<Object[]> coords;
        if (year != null) {
            java.time.LocalDateTime yearStart = java.time.LocalDateTime.of(year, 1, 1, 0, 0);
            java.time.LocalDateTime yearEnd = java.time.LocalDateTime.of(year + 1, 1, 1, 0, 0);
            coords = activityPointRepository.findHeatmapCoordsByRunnerAndTypeAndYear(
                    runner, ActivityType.RUN, yearStart, yearEnd, year + "%");
        } else {
            coords = activityPointRepository.findHeatmapCoordsByRunnerAndType(runner, ActivityType.RUN);
        }

        List<double[]> latlngs = coords.stream()
                .map(row -> new double[]{((Number) row[0]).doubleValue(), ((Number) row[1]).doubleValue()})
                .toList();

        return ResponseEntity.ok(latlngs);
    }

    @GetMapping("/{id}/points")
    public ResponseEntity<?> getActivityPoints(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        Optional<Runner> activeUser = authService.findByAuthorizationHeader(authHeader);
        if (activeUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid Session");
        }

        Optional<Activity> activityOpt = activityRepository.findById(id);
        if (activityOpt.isEmpty() || !activityOpt.get().getRunner().getId().equals(activeUser.get().getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Activity not found");
        }

        Activity activity = activityOpt.get();

        // FIT/GPX/TCX imports: return locally stored points
        List<ActivityPoint> localPoints = activity.getPoints();
        if (!localPoints.isEmpty()) {
            return ResponseEntity.ok(localPoints);
        }

        // Strava imports: fetch GPS stream on-demand then cache to DB
        String stravaId = activity.getStravaId();
        String stravaToken = resolveRunnerStravaAccessToken(activeUser.get());
        if (stravaId != null && stravaToken != null) {
            try {
                List<ActivityPoint> stravaPoints = fetchStravaStream(stravaId, stravaToken);
                if (!stravaPoints.isEmpty()) {
                    stravaPoints.forEach(p -> p.setActivity(activity));
                    activityPointRepository.saveAll(stravaPoints);
                }
                return ResponseEntity.ok(stravaPoints);
            } catch (Exception e) {
                System.err.println("Failed to fetch Strava stream for activity " + stravaId + ": " + e.getMessage());
            }
        }

        return ResponseEntity.ok(List.of());
    }

    @SuppressWarnings("unchecked")
    private List<ActivityPoint> fetchStravaStream(String stravaId, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        ResponseEntity<List<Map<String, Object>>> response = this.restTemplate.exchange(
                "https://www.strava.com/api/v3/activities/" + stravaId + "/streams?keys=latlng",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
        );

        List<Map<String, Object>> streams = response.getBody();
        if (streams == null) return List.of();

        for (Map<String, Object> stream : streams) {
            if ("latlng".equals(stream.get("type"))) {
                List<List<Double>> data = (List<List<Double>>) stream.get("data");
                if (data == null) return List.of();

                List<ActivityPoint> points = new ArrayList<>();
                for (int i = 0; i < data.size(); i++) {
                    List<Double> coord = data.get(i);
                    ActivityPoint point = new ActivityPoint();
                    point.setLatitude(coord.get(0));
                    point.setLongitude(coord.get(1));
                    point.setSequenceIndex(i);
                    points.add(point);
                }
                return points;
            }
        }

        return List.of();
    }

    private String resolveRunnerStravaAccessToken(Runner runner) {
        String storedToken = runner.getStravaAccessToken();
        if (storedToken == null || storedToken.isBlank()) {
            return null;
        }

        String decryptedToken = secretEncryptionService.decrypt(storedToken);
        if (!secretEncryptionService.isEncrypted(storedToken) && secretEncryptionService.isConfigured()) {
            runner.setStravaAccessToken(secretEncryptionService.encrypt(decryptedToken));
            runnerRepository.save(runner);
        }
        return decryptedToken;
    }
}
