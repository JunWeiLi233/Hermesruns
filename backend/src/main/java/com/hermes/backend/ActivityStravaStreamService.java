package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class ActivityStravaStreamService {
    private static final Logger logger = LoggerFactory.getLogger(ActivityStravaStreamService.class);
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;

    private final ActivityDataAccess activityDataAccess;
    private final RunnerRepository runnerRepository;
    private final SecretEncryptionService secretEncryptionService;
    private final RestTemplate restTemplate;

    public ActivityStravaStreamService(
            ActivityDataAccess activityDataAccess,
            RunnerRepository runnerRepository,
            SecretEncryptionService secretEncryptionService,
            RestTemplate restTemplate
    ) {
        this.activityDataAccess = activityDataAccess;
        this.runnerRepository = runnerRepository;
        this.secretEncryptionService = secretEncryptionService;
        this.restTemplate = restTemplate;
    }

    public void hydrateActivityPointsIfMissing(Activity activity, Runner runner) {
        if (activity == null || runner == null || activity.getStravaId() == null || activityDataAccess.hasPoints(activity)) {
            return;
        }
        String stravaToken = resolveRunnerStravaAccessToken(runner);
        if (stravaToken == null || stravaToken.isBlank()) {
            return;
        }
        try {
            fetchAndCacheStravaStream(activity, activity.getStravaId(), stravaToken);
        } catch (Exception exception) {
            logger.warn("Failed to prefetch Strava points for activity {}: {}", activity.getStravaId(), exception.getMessage());
        }
    }

    public void fetchAndCacheStravaStream(Activity activity, String stravaId, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                "https://www.strava.com/api/v3/activities/" + stravaId + "/streams?keys=latlng,time,distance,altitude,heartrate,cadence",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<List<Map<String, Object>>>() {}
        );

        List<Map<String, Object>> streams = response.getBody();
        if (streams == null) return;

        List<?> latlng = null;
        List<?> time = null;
        List<?> distance = null;
        List<?> altitude = null;
        List<?> heartRate = null;
        List<?> cadence = null;
        for (Map<String, Object> stream : streams) {
            if (stream == null || !stream.containsKey("type")) continue;
            String type = String.valueOf(stream.get("type"));
            Object dataObj = stream.get("data");
            if ("latlng".equals(type) && dataObj instanceof List<?> l) latlng = l;
            if ("time".equals(type) && dataObj instanceof List<?> l) time = l;
            if ("distance".equals(type) && dataObj instanceof List<?> l) distance = l;
            if ("altitude".equals(type) && dataObj instanceof List<?> l) altitude = l;
            if ("heartrate".equals(type) && dataObj instanceof List<?> l) heartRate = l;
            if ("cadence".equals(type) && dataObj instanceof List<?> l) cadence = l;
        }
        if (latlng == null || latlng.isEmpty()) return;

        int total = latlng.size();
        int stride = total > MAX_POINTS_PER_ACTIVITY
                ? Math.max(1, (int) Math.ceil(total / (double) MAX_POINTS_PER_ACTIVITY))
                : 1;

        List<ActivityPoint> points = new ArrayList<>(Math.min(total, MAX_POINTS_PER_ACTIVITY));
        int seq = 0;

        for (int i = 0; i < total; i += stride) {
            Object coordObj = latlng.get(i);
            if (!(coordObj instanceof List<?> coord) || coord.size() < 2) continue;
            if (!(coord.get(0) instanceof Number latitude)
                    || !(coord.get(1) instanceof Number longitude)
                    || !isValidLatLng(latitude, longitude)) {
                continue;
            }

            ActivityPoint point = new ActivityPoint();
            point.setActivity(activity);
            point.setLatitude(latitude.doubleValue());
            point.setLongitude(longitude.doubleValue());
            point.setSequenceIndex(seq++);
            point.setElapsedSeconds(numberAt(time, i) == null ? null : numberAt(time, i).intValue());
            point.setDistanceMeters(numberAt(distance, i) == null ? null : numberAt(distance, i).doubleValue());
            point.setElevationMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
            point.setElevationRawMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
            point.setHeartRate(numberAt(heartRate, i) == null ? null : numberAt(heartRate, i).intValue());
            Number cad = numberAt(cadence, i);
            point.setCadence(cad == null ? null : (int) Math.round(cad.doubleValue() * 2.0));
            points.add(point);
        }

        if (!points.isEmpty()) {
            activityDataAccess.savePointsIfAbsentAtomically(activity.getId(), points);
        }
    }

    public String resolveRunnerStravaAccessToken(Runner runner) {
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

    private static Number numberAt(List<?> list, int index) {
        if (list == null || index < 0 || index >= list.size()) return null;
        Object value = list.get(index);
        return value instanceof Number number ? number : null;
    }

    private static boolean isValidLatLng(Number latitude, Number longitude) {
        double latitudeValue = latitude.doubleValue();
        double longitudeValue = longitude.doubleValue();
        return Double.isFinite(latitudeValue)
                && Double.isFinite(longitudeValue)
                && latitudeValue >= -90d
                && latitudeValue <= 90d
                && longitudeValue >= -180d
                && longitudeValue <= 180d;
    }
}
