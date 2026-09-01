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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
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
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class StravaSyncService {

    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;

    /** Page size used for GET /athlete/activities; a full page means the window may not be drained yet. */
    private static final int STRAVA_ACTIVITIES_PAGE_SIZE = 200;

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
    private final ActivityDataAccess activityDataAccess;

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

    @Value("${strava.sync.cursor-buffer-seconds:21600}")
    private long cursorBufferSeconds = 21600;

    @Value("${strava.sync.bootstrap-lookback-days:14}")
    private long bootstrapLookbackDays = 14;

    @Value("${strava.sync.no-gps-retry-days:30}")
    private int noGpsRetryDays = 30;

    /** Wall-clock ms of the most recent NEW_OR_UPDATED_RUN import; 0 = nothing imported yet. */
    private final AtomicLong lastImportedActivityAtMs = new AtomicLong(0);

    public StravaSyncService(ActivityRepository activityRepository,
                             ActivityPointRepository activityPointRepository,
                             RunnerRepository runnerRepository,
                             RestTemplate restTemplate,
                             AcclimatizationService acclimatizationService,
                             AutomatedCoachService automatedCoachService,
                             ApplicationEventPublisher applicationEventPublisher,
                             AiUsageService aiUsageService,
                             StravaTokenService stravaTokenService,
                             ActivityDataAccess activityDataAccess) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.runnerRepository = runnerRepository;
        this.restTemplate = restTemplate;
        this.acclimatizationService = acclimatizationService;
        this.automatedCoachService = automatedCoachService;
        this.applicationEventPublisher = applicationEventPublisher;
        this.aiUsageService = aiUsageService;
        this.stravaTokenService = stravaTokenService;
        this.activityDataAccess = activityDataAccess;
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

        final long syncStartEpoch = Instant.now().getEpochSecond();
        final Long afterEpoch;
        if (!recentOnly) {
            afterEpoch = null;
        } else if (runner.getStravaListCursorEpoch() != null) {
            afterEpoch = Math.max(0L, runner.getStravaListCursorEpoch() - Math.max(0L, cursorBufferSeconds));
        } else {
            long bootstrapLookbackSeconds = java.util.concurrent.TimeUnit.DAYS.toSeconds(
                    Math.max(0L, bootstrapLookbackDays)
            );
            afterEpoch = bootstrapLookbackSeconds >= syncStartEpoch
                    ? 0L
                    : syncStartEpoch - bootstrapLookbackSeconds;
        }

        int page = 1;
        int lastPageSize = 0;
        final int maxPages = recentOnly ? Math.max(1, stravaRecentSyncMaxPages) : Math.max(1, stravaFullSyncMaxPages);
        boolean[] gpsRateLimited = {false};
        try {
            while (page <= maxPages) {
                String activitiesUrl = "https://www.strava.com/api/v3/athlete/activities?per_page="
                        + STRAVA_ACTIVITIES_PAGE_SIZE + "&page=" + page;
                if (afterEpoch != null) {
                    activitiesUrl = activitiesUrl + "&after=" + afterEpoch;
                }
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
                        tracker.markFailed(stravaListFetchFailureMessage(unauthorized));
                        return;
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
                    advanceStravaListCursor(runnerId, syncStartEpoch);
                    return;
                }

                tracker.incrementProcessedPages();
                lastPageSize = activities.size();
                for (Map<String, Object> activityData : activities) {
                    StravaActivitySyncResult r = syncSingleStravaActivity(
                            runner, tracker, activityData, gpsRateLimited, restTemplate, headers, currentAccessToken);
                    if (r == StravaActivitySyncResult.SKIPPED_NON_RUN) {
                        continue;
                    }
                }

                page++;
            }
            tracker.markCompleted();
            // Only treat the window as drained when the last page was not full:
            // exiting by page cap on a full 200-item page means older activities
            // may still be inside the window, so keep the old cursor and let the
            // next cycle re-cover the remainder.
            if (lastPageSize < STRAVA_ACTIVITIES_PAGE_SIZE) {
                advanceStravaListCursor(runnerId, syncStartEpoch);
            }
        } catch (Exception exception) {
            String message = stravaListFetchFailureMessage(exception);
            tracker.markFailed(message);
            log.warn("Strava activity list sync failed for runner {}: {} ({})",
                    runnerId, message, exception.getClass().getSimpleName(), exception);
        }
    }

    /**
     * Persist the incremental list-sync high-water mark after a successful sync.
     * Reloads the freshest runner entity because the in-flight {@code runner}
     * reference may have been replaced during a 401 token refresh.
     */
    private void advanceStravaListCursor(Long runnerId, long syncStartEpoch) {
        try {
            Runner currentRunner = runnerRepository.findById(runnerId).orElse(null);
            if (currentRunner == null) {
                return;
            }
            currentRunner.setStravaListCursorEpoch(syncStartEpoch);
            runnerRepository.save(currentRunner);
        } catch (Exception e) {
            // A failed cursor write only means the next sync re-lists a slightly
            // larger window; never fail the completed sync because of it.
            log.warn("Strava sync: failed to advance list cursor for runner {}: {}", runnerId, e.getMessage());
        }
    }

    /** True when an activity was imported or updated at/after the given epoch ms. */
    public boolean hasImportedActivitySince(long epochMs) {
        return lastImportedActivityAtMs.get() >= epochMs;
    }

    private String stravaListFetchFailureMessage(Exception exception) {
        if (exception instanceof HttpStatusCodeException statusException) {
            HttpStatus status = HttpStatus.resolve(statusException.getStatusCode().value());
            if (status == HttpStatus.FORBIDDEN && isInactiveStravaApplicationResponse(statusException)) {
                return "Strava application is inactive. Reactivate the Strava API app or update the credentials, then reconnect Strava.";
            }
            if (status == HttpStatus.UNAUTHORIZED) {
                return "Strava authorization expired. Please relink your Strava account.";
            }
            if (status == HttpStatus.FORBIDDEN) {
                return "Strava authorization was rejected. Please relink your Strava account.";
            }
            if (status == HttpStatus.TOO_MANY_REQUESTS) {
                return "Strava rate limit reached. Try again later.";
            }
            if (status != null && status.is5xxServerError()) {
                return "Strava is temporarily unavailable. Try again later.";
            }
            return "Strava sync failed with HTTP " + statusException.getStatusCode().value() + ".";
        }
        if (exception instanceof ResourceAccessException) {
            return "Cannot reach Strava from this backend. Check the network and try again.";
        }
        return "Unable to sync Strava activities right now.";
    }

    private boolean isInactiveStravaApplicationResponse(HttpStatusCodeException exception) {
        String body = exception.getResponseBodyAsString();
        if (body == null || body.isBlank()) {
            return false;
        }
        String normalized = body.toLowerCase(java.util.Locale.ROOT);
        return normalized.contains("application")
                && normalized.contains("status")
                && normalized.contains("inactive");
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
        ActivitySyncSnapshot beforeSync = existingActivity ? ActivitySyncSnapshot.capture(activity) : null;
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
        // movingTimeSeconds originates from the Strava activity payload (remote,
        // user-influenced data). A raw (int) cast would silently wrap on values
        // outside the int range, so clamp to the non-negative int window: a
        // real moving-time in seconds always fits comfortably inside it.
        activity.setMovingTimeSeconds(safeIntSeconds(movingTimeSeconds));
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

        boolean changedExistingActivity = existingActivity
                && !Objects.equals(beforeSync, ActivitySyncSnapshot.capture(activity));

        Activity saved = activityRepository.save(activity);

        if (!existingActivity || previousType != ActivityType.RUN) {
            publishActivityIngested(saved);
        } else if (changedExistingActivity) {
            automatedCoachService.reaggregateRunner(runner.getId());
        }

        if (existingActivity && previousType == ActivityType.RUN && !changedExistingActivity) {
            tracker.incrementSkippedDuplicates();
            return StravaActivitySyncResult.DUPLICATE_RUN;
        }

        if (!gpsRateLimited[0]
                && !activityPointRepository.existsByActivity(saved)
                && !saved.isNoGpsRetryWindowActive(noGpsRetryDays)) {
            gpsRateLimited[0] = !fetchAndSaveGpsStream(saved, stravaId, accessToken, restTemplate, headers);
        }

        tracker.incrementImportedRuns();
        lastImportedActivityAtMs.set(System.currentTimeMillis());
        return StravaActivitySyncResult.NEW_OR_UPDATED_RUN;
    }

    private void publishActivityIngested(Activity activity) {
        if (applicationEventPublisher != null
                && activity != null
                && activity.getRunner() != null
                && activity.getRunner().getId() != null
                && activity.getId() != null) {
            applicationEventPublisher.publishEvent(new ActivityIngestedEvent(activity.getRunner().getId(), activity.getId()));
        }
    }

    private record ActivitySyncSnapshot(
            ActivityType activityType,
            String stravaId,
            String name,
            Double distanceMeters,
            double distanceKm,
            Long durationSeconds,
            int movingTimeSeconds,
            String startDate,
            LocalDateTime startTime,
            Double averageHeartRate,
            Double maxHeartRate,
            Double totalElevationGain,
            Integer calories,
            Double averageCadence,
            Double averageWatts,
            Double maxSpeedMps,
            Integer sufferScore,
            Integer pacePenaltySecPerKm,
            Boolean weatherAdjusted
    ) {
        static ActivitySyncSnapshot capture(Activity activity) {
            return new ActivitySyncSnapshot(
                    activity.getActivityType(),
                    activity.getStravaId(),
                    activity.getName(),
                    activity.getDistanceMeters(),
                    activity.getDistanceKm(),
                    activity.getDurationSeconds(),
                    activity.getMovingTimeSeconds(),
                    activity.getStartDate(),
                    activity.getStartTime(),
                    activity.getAverageHeartRate(),
                    activity.getMaxHeartRate(),
                    activity.getTotalElevationGain(),
                    activity.getCalories(),
                    activity.getAverageCadence(),
                    activity.getAverageWatts(),
                    activity.getMaxSpeedMps(),
                    activity.getSufferScore(),
                    activity.getPacePenaltySecPerKm(),
                    activity.getWeatherAdjusted()
            );
        }
    }

    private boolean fetchAndSaveGpsStream(Activity activity, String stravaId, String accessToken,
                                          RestTemplate restTemplate, HttpHeaders headers) {
        List<ActivityPoint> points = null;
        try {
            String url = "https://www.strava.com/api/v3/activities/" + stravaId
                    + "/streams?keys=latlng,time,distance,altitude,heartrate,cadence";
            ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {});

            List<Map<String, Object>> streams = response.getBody();
            if (streams == null) return true;
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
            if (latlng == null || latlng.isEmpty()) {
                // Treadmill / no-GPS activity: tombstone it so the stream is not
                // re-fetched every sync cycle within the retry window.
                markNoGpsTombstone(activity);
                return true;
            }

            int total = latlng.size();
            int stride = total > MAX_POINTS_PER_ACTIVITY
                    ? Math.max(1, (int) Math.ceil(total / (double) MAX_POINTS_PER_ACTIVITY))
                    : 1;

            points = new ArrayList<>(Math.min(total, MAX_POINTS_PER_ACTIVITY));
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

            if (points.isEmpty()) {
                // latlng was present but every coordinate was invalid: tombstone it
                // like the no-latlng case so the stream is not re-fetched every cycle.
                markNoGpsTombstone(activity);
                return true;
            }

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

        if (points != null && !points.isEmpty()) {
            activityDataAccess.savePointsIfAbsentAtomically(activity.getId(), points);
            clearNoGpsTombstone(activity);
        }
        log.info("GPS cached: {} ({} pts)", stravaId, points == null ? 0 : points.size());
        return true;
    }

    /** Record that this activity's stream has no usable GPS data and persist the tombstone. */
    private void markNoGpsTombstone(Activity activity) {
        activity.setGpsStreamState(Activity.GPS_STREAM_STATE_NO_GPS);
        activity.setGpsStreamCheckedAt(LocalDateTime.now());
        activityRepository.save(activity);
    }

    /** Clear a stale no-GPS tombstone once real GPS points were saved. */
    private void clearNoGpsTombstone(Activity activity) {
        if (activity.getGpsStreamState() == null) {
            return;
        }
        activity.setGpsStreamState(null);
        activity.setGpsStreamCheckedAt(LocalDateTime.now());
        activityRepository.save(activity);
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
                    activityDataAccess.deletePointsForActivity(activity.getId());
                    activityRepository.delete(activity);
                    automatedCoachService.reaggregateRunner(runner.getId());
                });
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

    private static Number numberAt(List<?> list, int i) {
        if (list == null || i < 0 || i >= list.size()) return null;
        Object value = list.get(i);
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

    /**
     * Clamp a remote moving-time-in-seconds value into the non-negative int
     * range before it is stored as {@code movingTimeSeconds}. Strava payloads
     * are user-influenced, so a raw {@code (int)} cast could wrap a malformed
     * or absurdly large {@code long} into a nonsensical negative duration. A
     * legitimate run's moving time always fits inside an int (max ~68 years).
     */
    private static int safeIntSeconds(long movingTimeSeconds) {
        if (movingTimeSeconds <= 0L) {
            return 0;
        }
        if (movingTimeSeconds > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) movingTimeSeconds;
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
