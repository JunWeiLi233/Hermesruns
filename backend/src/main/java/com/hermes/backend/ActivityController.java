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
    private static final int POINTS_BATCH_SIZE = 500;
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;

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
            // Prevent weird ranges that could stress queries or return unexpected data.
            if (year < 1900 || year > 2100) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid year.");
            }
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

        Optional<Activity> activityOpt = activityRepository.findByIdAndRunner(id, activeUser.get());
        if (activityOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Activity not found");
        }

        Activity activity = activityOpt.get();

        // FIT/GPX/TCX imports: return locally stored points (projection, not entities).
        List<LatLngPoint> localPoints = fetchLatLngPoints(activity.getId());
        if (!localPoints.isEmpty()) {
            return ResponseEntity.ok(localPoints);
        }

        // Strava imports: fetch GPS stream on-demand then cache to DB
        String stravaId = activity.getStravaId();
        String stravaToken = resolveRunnerStravaAccessToken(activeUser.get());
        if (stravaId != null && stravaToken != null) {
            try {
                fetchAndCacheStravaStream(activity, stravaId, stravaToken);
                // Query again to return an identical payload shape for local/Strava points.
                List<LatLngPoint> cached = fetchLatLngPoints(activity.getId());
                return ResponseEntity.ok(cached);
            } catch (Exception e) {
                System.err.println("Failed to fetch Strava stream for activity " + stravaId + ": " + e.getMessage());
            }
        }

        return ResponseEntity.ok(List.of());
    }

    private List<LatLngPoint> fetchLatLngPoints(Long activityId) {
        List<Object[]> coords = activityPointRepository.findLatLngByActivityIdOrdered(activityId);
        if (coords == null || coords.isEmpty()) return List.of();

        List<LatLngPoint> out = new ArrayList<>(coords.size());
        for (Object[] row : coords) {
            if (row == null || row.length < 2) continue;
            Double lat = ((Number) row[0]).doubleValue();
            Double lng = ((Number) row[1]).doubleValue();
            if (lat == null || lng == null) continue;
            out.add(new LatLngPoint(lat, lng));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private void fetchAndCacheStravaStream(Activity activity, String stravaId, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        ResponseEntity<List<Map<String, Object>>> response = this.restTemplate.exchange(
                "https://www.strava.com/api/v3/activities/" + stravaId + "/streams?keys=latlng",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
        );

        List<Map<String, Object>> streams = response.getBody();
        if (streams == null) return;

        for (Map<String, Object> stream : streams) {
            if ("latlng".equals(stream.get("type"))) {
                List<List<Double>> data = (List<List<Double>>) stream.get("data");
                if (data == null || data.isEmpty()) return;

                int total = data.size();
                int stride = total > MAX_POINTS_PER_ACTIVITY
                        ? Math.max(1, (int) Math.ceil(total / (double) MAX_POINTS_PER_ACTIVITY))
                        : 1;

                List<ActivityPoint> batch = new ArrayList<>(POINTS_BATCH_SIZE);
                int seq = 0;

                for (int i = 0; i < total; i += stride) {
                    List<Double> coord = data.get(i);
                    if (coord == null || coord.size() < 2) continue;

                    ActivityPoint point = new ActivityPoint();
                    point.setActivity(activity);
                    point.setLatitude(coord.get(0));
                    point.setLongitude(coord.get(1));
                    point.setSequenceIndex(seq++);
                    batch.add(point);

                    if (batch.size() >= POINTS_BATCH_SIZE) {
                        activityPointRepository.saveAll(batch);
                        activityPointRepository.flush();
                        batch.clear();
                    }
                }

                if (!batch.isEmpty()) {
                    activityPointRepository.saveAll(batch);
                    activityPointRepository.flush();
                }

                return;
            }
        }
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

    public record LatLngPoint(double latitude, double longitude) {}
}
