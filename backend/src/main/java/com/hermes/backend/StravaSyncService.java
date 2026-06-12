package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PreDestroy;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class StravaSyncService {

    private static final int STRAVA_POINTS_BATCH_SIZE = 500;
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;

    private static final Logger log = LoggerFactory.getLogger(StravaSyncService.class);

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final RunnerRepository runnerRepository;
    private final RestTemplate restTemplate;
    private final AcclimatizationService acclimatizationService;
    private final AutomatedCoachService automatedCoachService;
    private final ApplicationEventPublisher applicationEventPublisher;
    private final AiUsageService aiUsageService;
    private final StravaTokenService stravaTokenService;

    private final ConcurrentMap<Long, StravaSyncTracker> stravaSyncStates = new ConcurrentHashMap<>();

    private final ExecutorService stravaBackgroundExecutor = Executors.newFixedThreadPool(
            2,
            r -> {
                Thread t = new Thread(r, "strava-sync-worker");
                t.setDaemon(true);
                return t;
            }
    );

    @Value("${strava.sync.max-pages-recent:5}")
    private int stravaRecentSyncMaxPages;

    @Value("${strava.sync.max-pages-full:50}")
    private int stravaFullSyncMaxPages;

    public StravaSyncService(ActivityRepository activityRepository,
                             ActivityPointRepository activityPointRepository,
                             RunnerRepository runnerRepository,
                             RestTemplate restTemplate,
                             AcclimatizationService acclimatizationService,
                             AutomatedCoachService automatedCoachService,
                             ApplicationEventPublisher applicationEventPublisher,
                             AiUsageService aiUsageService,
                             StravaTokenService stravaTokenService) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.runnerRepository = runnerRepository;
        this.restTemplate = restTemplate;
        this.acclimatizationService = acclimatizationService;
        this.automatedCoachService = automatedCoachService;
        this.applicationEventPublisher = applicationEventPublisher;
        this.aiUsageService = aiUsageService;
        this.stravaTokenService = stravaTokenService;
    }

    @PreDestroy
    void shutdown() {
        stravaBackgroundExecutor.shutdownNow();
    }

    public enum SyncLaunchResult {
        STARTED,
        ALREADY_RUNNING,
        NOT_LINKED,
        RELINK_REQUIRED
    }

    public enum SingleActivitySyncResult {
        SUCCESS,
        ALREADY_RUNNING,
        RETRYABLE_FAILURE,
        PERMANENT_FAILURE
    }

    private enum StravaActivitySyncResult {
        SKIPPED_NON_RUN,
        NEW_OR_UPDATED_RUN,
        DUPLICATE_RUN
    }

    public record StravaSyncStatusResponse(
            String status,
            int importedRuns,
            int skippedNonRuns,
            int skippedDuplicates,
            int processedActivities,
            int processedPages,
            String error,
            boolean active,
            String trigger,
            boolean recentOnly,
            String updatedAt
    ) {
        public static StravaSyncStatusResponse idle() {
            return new StravaSyncStatusResponse("IDLE", 0, 0, 0, 0, 0, null, false, "none", false, null);
        }
    }

    static final class StravaSyncTracker {
        private String status = "IDLE";
        private int importedRuns;
        private int skippedNonRuns;
        private int skippedDuplicates;
        private int processedActivities;
        private int processedPages;
        private String error;
        private String trigger = "none";
        private boolean recentOnly;
        private long lastUpdatedMs = System.currentTimeMillis();

        synchronized void resetForNewSync(String nextTrigger, boolean nextRecentOnly) {
            status = "PENDING";
            importedRuns = 0;
            skippedNonRuns = 0;
            skippedDuplicates = 0;
            processedActivities = 0;
            processedPages = 0;
            error = null;
            trigger = nextTrigger == null || nextTrigger.isBlank() ? "unknown" : nextTrigger;
            recentOnly = nextRecentOnly;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized boolean tryBeginSync(String nextTrigger, boolean nextRecentOnly) {
            if ("RUNNING".equals(status)) {
                return false;
            }
            if ("PENDING".equals(status)) {
                status = "RUNNING";
                lastUpdatedMs = System.currentTimeMillis();
                return true;
            }
            resetForNewSync(nextTrigger, nextRecentOnly);
            status = "RUNNING";
            return true;
        }

        synchronized boolean tryQueueSync(String nextTrigger, boolean nextRecentOnly) {
            if ("RUNNING".equals(status) || "PENDING".equals(status)) {
                return false;
            }
            resetForNewSync(nextTrigger, nextRecentOnly);
            status = "PENDING";
            return true;
        }

        synchronized void incrementImportedRuns() {
            importedRuns++;
            processedActivities++;
        }

        synchronized void incrementSkippedNonRuns() {
            skippedNonRuns++;
            processedActivities++;
        }

        synchronized void incrementSkippedDuplicates() {
            skippedDuplicates++;
            processedActivities++;
        }

        synchronized void incrementProcessedPages() {
            processedPages++;
        }

        synchronized void markCompleted() {
            status = "COMPLETED";
            error = null;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized void markFailed(String message) {
            status = "FAILED";
            error = message;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized boolean isStale(long cutoffMs) {
            return lastUpdatedMs < cutoffMs && !"RUNNING".equals(status) && !"PENDING".equals(status);
        }

        synchronized StravaSyncStatusResponse snapshot() {
            return new StravaSyncStatusResponse(
                    status,
                    importedRuns,
                    skippedNonRuns,
                    skippedDuplicates,
                    processedActivities,
                    processedPages,
                    error,
                    "RUNNING".equals(status) || "PENDING".equals(status),
                    trigger,
                    recentOnly,
                    Instant.ofEpochMilli(lastUpdatedMs).toString()
            );
        }
    }

    public StravaSyncStatusResponse snapshotSyncStatus(Long runnerId) {
        StravaSyncTracker tracker = stravaSyncStates.get(runnerId);
        return tracker == null ? StravaSyncStatusResponse.idle() : tracker.snapshot();
    }

    public SyncLaunchResult scheduleStravaSync(Runner runner, String accessToken, boolean recentOnly, String trigger) {
        if (!stravaTokenService.isRunnerStravaLinked(runner)) {
            return SyncLaunchResult.NOT_LINKED;
        }
        if (accessToken == null || accessToken.isBlank()) {
            return SyncLaunchResult.RELINK_REQUIRED;
        }

        StravaSyncTracker tracker = stravaSyncStates.computeIfAbsent(runner.getId(), ignored -> new StravaSyncTracker());
        if (!tracker.tryQueueSync(trigger, recentOnly)) {
            return SyncLaunchResult.ALREADY_RUNNING;
        }
        CompletableFuture.runAsync(
                () -> fetchAndSaveStravaActivities(accessToken, runner.getId(), recentOnly, trigger),
                stravaBackgroundExecutor
        );
        return SyncLaunchResult.STARTED;
    }

    public void fetchAndSaveStravaActivities(String accessToken, Long runnerId, boolean recentOnly, String trigger) {
        StravaSyncTracker tracker = stravaSyncStates.computeIfAbsent(runnerId, ignored -> new StravaSyncTracker());
        if (!tracker.tryBeginSync(trigger, recentOnly)) {
            return;
        }

        Optional<Runner> runnerOptional = runnerRepository.findById(runnerId);
        if (runnerOptional.isEmpty()) {
            tracker.markFailed("Runner account could not be found for Strava sync.");
            return;
        }

        Runner runner = runnerOptional.get();
        RestTemplate restTemplate = this.restTemplate;
        HttpHeaders headers = new HttpHeaders();
        String currentAccessToken = accessToken;
        headers.setBearerAuth(currentAccessToken);

        int page = 1;
        final int maxPages = recentOnly ? Math.max(1, stravaRecentSyncMaxPages) : Math.max(1, stravaFullSyncMaxPages);
        boolean[] gpsRateLimited = {false};
        try {
            while (page <= maxPages) {
                String activitiesUrl = "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=" + page;
                ResponseEntity<List<Map<String, Object>>> response;
                try {
                    response = restTemplate.exchange(
                            activitiesUrl,
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            new ParameterizedTypeReference<List<Map<String, Object>>>() {
                            }
                    );
                } catch (org.springframework.web.client.HttpClientErrorException.Unauthorized unauthorized) {
                    Runner freshRunner = runnerRepository.findById(runnerId).orElse(runner);
                    String refreshedAccessToken;
                    try {
                        refreshedAccessToken = stravaTokenService.resolveRunnerStravaAccessToken(freshRunner);
                    } catch (Exception tokenException) {
                        tracker.markFailed("Stored Strava token is invalid; please relink Strava.");
                        return;
                    }

                    if (refreshedAccessToken == null || refreshedAccessToken.isBlank()
                            || Objects.equals(refreshedAccessToken, currentAccessToken)) {
                        throw unauthorized;
                    }

                    runner = freshRunner;
                    currentAccessToken = refreshedAccessToken;
                    headers.setBearerAuth(currentAccessToken);
                    response = restTemplate.exchange(
                            activitiesUrl,
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            new ParameterizedTypeReference<List<Map<String, Object>>>() {
                            }
                    );
                }

                List<Map<String, Object>> activities = response.getBody();
                if (activities == null || activities.isEmpty()) {
                    tracker.markCompleted();
                    return;
                }

                tracker.incrementProcessedPages();
                int runsOnPage = 0;
                int newOrUpdatedRunsOnPage = 0;
                for (Map<String, Object> activityData : activities) {
                    StravaActivitySyncResult r = syncSingleStravaActivity(
                            runner, tracker, activityData, gpsRateLimited, restTemplate, headers, currentAccessToken);
                    if (r == StravaActivitySyncResult.SKIPPED_NON_RUN) {
                        continue;
                    }
                    runsOnPage++;
                    if (r == StravaActivitySyncResult.NEW_OR_UPDATED_RUN) {
                        newOrUpdatedRunsOnPage++;
                    }
                }

                if (runsOnPage > 0 && newOrUpdatedRunsOnPage == 0) {
                    tracker.markCompleted();
                    return;
                }

                page++;
            }
            tracker.markCompleted();
        } catch (Exception exception) {
            tracker.markFailed("Unable to sync Strava activities right now.");
        }
    }

    private StravaActivitySyncResult syncSingleStravaActivity(Runner runner, StravaSyncTracker tracker, Map<String, Object> activityData,
                                                              boolean[] gpsRateLimited, RestTemplate restTemplate, HttpHeaders headers,
                                                              String accessToken) {
        ActivityType activityType = ActivityTypeResolver.fromSportLabels(
                stringValue(activityData.get("sport_type")),
                stringValue(activityData.get("type")),
                stringValue(activityData.get("name"))
        );

        if (activityType != ActivityType.RUN) {
            tracker.incrementSkippedNonRuns();
            return StravaActivitySyncResult.SKIPPED_NON_RUN;
        }

        String stravaId = stringValue(activityData.get("id"));
        if (stravaId == null || stravaId.isBlank()) {
            tracker.incrementSkippedNonRuns();
            return StravaActivitySyncResult.SKIPPED_NON_RUN;
        }

        String checksum = "STRAVA_" + stravaId;
        Activity activity = activityRepository
                .findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, checksum)
                .orElseGet(Activity::new);

        boolean existingActivity = activity.getId() != null;
        ActivityType previousType = activity.getActivityType();

        if (!existingActivity) {
            activity.setRunner(runner);
            activity.setProvider(ImportProvider.STRAVA);
            activity.setSourceChecksum(checksum);
            activity.setCreatedAt(LocalDateTime.now());
        }

        String activityName = resolveStravaActivityName(activityData, stravaId);
        Double distanceMetersVal = doubleValue(activityData.get("distance"));
        double distanceMeters = distanceMetersVal != null ? distanceMetersVal : 0d;
        Long movingTimeVal = longValue(activityData.get("moving_time"));
        long movingTimeSeconds = movingTimeVal != null ? movingTimeVal : 0L;
        String startDate = stringValue(activityData.get("start_date_local"));

        activity.setActivityType(ActivityType.RUN);
        activity.setStravaId(stravaId);
        activity.setName(activityName);
        activity.setDistanceMeters(distanceMeters > 0d ? distanceMeters : null);
        activity.setDistanceKm(distanceMeters > 0d ? distanceMeters / 1000d : 0d);
        activity.setDurationSeconds(movingTimeSeconds > 0L ? movingTimeSeconds : null);
        activity.setMovingTimeSeconds((int) movingTimeSeconds);
        activity.setStartDate(startDate);
        activity.setStartTime(parseDateTime(startDate));

        activity.setAverageHeartRate(doubleValue(activityData.get("average_heartrate")));
        activity.setMaxHeartRate(doubleValue(activityData.get("max_heartrate")));
        activity.setTotalElevationGain(doubleValue(activityData.get("total_elevation_gain")));
        activity.setCalories(intValue(activityData.get("calories")));
        Double cadence = doubleValue(activityData.get("average_cadence"));
        activity.setAverageCadence(cadence != null ? cadence * 2 : null);
        activity.setAverageWatts(doubleValue(activityData.get("average_watts")));
        activity.setMaxSpeedMps(doubleValue(activityData.get("max_speed")));
        activity.setSufferScore(intValue(activityData.get("suffer_score")));

        try {
            Integer penalty = acclimatizationService.calculatePenaltyForActivity(activity);
            activity.setPacePenaltySecPerKm(penalty);
            activity.setWeatherAdjusted(penalty != null && penalty > 0);
        } catch (Exception e) {
            log.warn("Weather adjustment calculation failed during sync: {}", e.getMessage());
        }

        Activity saved = activityRepository.save(activity);

        if (!gpsRateLimited[0] && !activityPointRepository.existsByActivity(saved)) {
            gpsRateLimited[0] = !fetchAndSaveGpsStream(saved, stravaId, accessToken, restTemplate, headers);
        }

        if (existingActivity && previousType == ActivityType.RUN) {
            tracker.incrementSkippedDuplicates();
            return StravaActivitySyncResult.DUPLICATE_RUN;
        }
        tracker.incrementImportedRuns();
        return StravaActivitySyncResult.NEW_OR_UPDATED_RUN;
    }

    @SuppressWarnings("unchecked")
    private boolean fetchAndSaveGpsStream(Activity activity, String stravaId, String accessToken,
                                          RestTemplate restTemplate, HttpHeaders headers) {
        try {
            String url = "https://www.strava.com/api/v3/activities/" + stravaId
                    + "/streams?keys=latlng,time,distance,altitude,heartrate,cadence";
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {});

            List<Map<String, Object>> streams = response.getBody();
            if (streams == null) return true;
            List<List<Double>> latlng = null;
            List<Number> time = null;
            List<Number> distance = null;
            List<Number> altitude = null;
            List<Number> heartRate = null;
            List<Number> cadence = null;
            for (Map<String, Object> stream : streams) {
                if (!stream.containsKey("type")) continue;
                String type = String.valueOf(stream.get("type"));
                Object dataObj = stream.get("data");
                if ("latlng".equals(type) && dataObj instanceof List<?> l) latlng = (List<List<Double>>) l;
                if ("time".equals(type) && dataObj instanceof List<?> l) time = (List<Number>) l;
                if ("distance".equals(type) && dataObj instanceof List<?> l) distance = (List<Number>) l;
                if ("altitude".equals(type) && dataObj instanceof List<?> l) altitude = (List<Number>) l;
                if ("heartrate".equals(type) && dataObj instanceof List<?> l) heartRate = (List<Number>) l;
                if ("cadence".equals(type) && dataObj instanceof List<?> l) cadence = (List<Number>) l;
            }
            if (latlng == null || latlng.isEmpty()) return true;

            final int batchSize = STRAVA_POINTS_BATCH_SIZE;
            int total = latlng.size();
            int stride = total > MAX_POINTS_PER_ACTIVITY
                    ? Math.max(1, (int) Math.ceil(total / (double) MAX_POINTS_PER_ACTIVITY))
                    : 1;

            List<ActivityPoint> batch = new ArrayList<>(batchSize);
            int totalSaved = 0;
            int seq = 0;

            for (int i = 0; i < total; i += stride) {
                List<Double> coord = latlng.get(i);
                if (coord == null || coord.size() < 2) continue;

                ActivityPoint point = new ActivityPoint();
                point.setActivity(activity);
                point.setLatitude(coord.get(0));
                point.setLongitude(coord.get(1));
                point.setSequenceIndex(seq++);
                point.setElapsedSeconds(numberAt(time, i) == null ? null : numberAt(time, i).intValue());
                point.setDistanceMeters(numberAt(distance, i) == null ? null : numberAt(distance, i).doubleValue());
                point.setElevationMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
                point.setElevationRawMeters(numberAt(altitude, i) == null ? null : numberAt(altitude, i).doubleValue());
                point.setHeartRate(numberAt(heartRate, i) == null ? null : numberAt(heartRate, i).intValue());
                Number cad = numberAt(cadence, i);
                point.setCadence(cad == null ? null : (int) Math.round(cad.doubleValue() * 2.0));
                batch.add(point);

                if (batch.size() >= batchSize) {
                    activityPointRepository.saveAll(batch);
                    activityPointRepository.flush();
                    totalSaved += batch.size();
                    batch.clear();
                }
            }

            if (!batch.isEmpty()) {
                activityPointRepository.saveAll(batch);
                activityPointRepository.flush();
                totalSaved += batch.size();
            }

            log.info("GPS cached: {} ({} pts)", stravaId, totalSaved);
            return true;

        } catch (org.springframework.web.client.HttpClientErrorException e) {
            if (e.getStatusCode().value() == 429) {
                log.warn("GPS rate limited — remaining GPS will sync on first run view");
                return false;
            }
            log.warn("GPS fetch skipped for {}: {}", stravaId, e.getMessage());
            return true;
        } catch (Exception e) {
            log.warn("GPS fetch skipped for {}: {}", stravaId, e.getMessage());
            return true;
        }
    }

    public SingleActivitySyncResult syncStravaActivityById(Runner runner, long stravaActivityId) {
        String accessToken = stravaTokenService.resolveRunnerStravaAccessToken(runner);
        if (accessToken == null || accessToken.isBlank()) return SingleActivitySyncResult.PERMANENT_FAILURE;

        StravaSyncTracker tracker = stravaSyncStates.computeIfAbsent(runner.getId(), ignored -> new StravaSyncTracker());
        if (!tracker.tryBeginSync("webhook_activity", true)) {
            return SingleActivitySyncResult.ALREADY_RUNNING;
        }
        try {
            RestTemplate restTemplate = this.restTemplate;
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);

            String url = "https://www.strava.com/api/v3/activities/" + stravaActivityId;
            @SuppressWarnings("unchecked")
            Map<String, Object> activityData = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<Map<String, Object>>() {}).getBody();

            if (activityData == null) {
                tracker.markFailed("Strava activity payload was empty.");
                return SingleActivitySyncResult.RETRYABLE_FAILURE;
            }

            boolean[] gpsRateLimited = {false};
            syncSingleStravaActivity(runner, tracker, activityData, gpsRateLimited, restTemplate, headers, accessToken);
            tracker.markCompleted();
            return SingleActivitySyncResult.SUCCESS;
        } catch (org.springframework.web.client.HttpClientErrorException exception) {
            if (exception.getStatusCode() == HttpStatus.NOT_FOUND || exception.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                tracker.markFailed("Strava activity is not ready yet.");
                return SingleActivitySyncResult.RETRYABLE_FAILURE;
            }
            tracker.markFailed("Unable to sync Strava activity right now.");
            log.warn("Strava webhook sync failed for activity {}: {}", stravaActivityId, exception.getMessage());
            return SingleActivitySyncResult.PERMANENT_FAILURE;
        } catch (Exception e) {
            tracker.markFailed("Unable to sync Strava activity right now.");
            log.warn("Strava webhook sync failed for activity {}: {}", stravaActivityId, e.getMessage());
            return SingleActivitySyncResult.RETRYABLE_FAILURE;
        }
    }

    public void deleteStravaActivity(Runner runner, long stravaActivityId) {
        String checksum = "STRAVA_" + stravaActivityId;
        activityRepository.findByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.STRAVA, checksum)
                .ifPresent(activity -> {
                    activityPointRepository.deleteByActivity(activity);
                    activityRepository.delete(activity);
                    automatedCoachService.reaggregateRunner(runner.getId());
                });
    }

    private void savePointsInBatches(List<ActivityPoint> points) {
        final int batchSize = 500;
        for (int i = 0; i < points.size(); i += batchSize) {
            activityPointRepository.saveAll(points.subList(i, Math.min(i + batchSize, points.size())));
            activityPointRepository.flush();
        }
    }

    @Scheduled(fixedDelay = 600_000)
    void cleanupStaleSyncTrackers() {
        long cutoff = System.currentTimeMillis() - 1_800_000;
        stravaSyncStates.entrySet().removeIf(entry -> entry.getValue().isStale(cutoff));
    }

    private static String resolveStravaActivityName(Map<String, Object> activityData, String stravaId) {
        String explicitName = stringValue(activityData.get("name"));
        if (explicitName != null && !explicitName.isBlank()) {
            return explicitName;
        }
        return "Strava Run " + stravaId;
    }

    private static LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return OffsetDateTime.parse(value.trim()).toLocalDateTime();
        } catch (Exception ignored) {
            try {
                return LocalDateTime.parse(value.trim());
            } catch (Exception secondIgnored) {
                return null;
            }
        }
    }

    private static Number numberAt(List<Number> list, int i) {
        if (list == null || i < 0 || i >= list.size()) return null;
        return list.get(i);
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            try {
                return Long.parseLong(stringValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static Double doubleValue(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            try {
                return Double.parseDouble(stringValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static Integer intValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            try {
                return Integer.parseInt(stringValue);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
