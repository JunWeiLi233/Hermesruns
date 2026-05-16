package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class GarminConnectImportService {
    private static final Logger logger = LoggerFactory.getLogger(GarminConnectImportService.class);

    private static final int MAX_ACTIVITIES = 200;
    private static final int POINTS_BATCH_SIZE = 500;
    private static final int MAX_POINTS_PER_ACTIVITY = 100_000;

    private final ActivityRepository activityRepository;
    private final ActivityPointRepository activityPointRepository;
    private final FitActivityFileParser fitParser;
    private final ObjectMapper objectMapper;
    private final ConcurrentMap<Long, GarminSyncTracker> syncStates = new ConcurrentHashMap<>();

    private final ExecutorService executor = Executors.newFixedThreadPool(
            1,
            r -> {
                Thread t = new Thread(r, "garmin-connect-import");
                t.setDaemon(true);
                return t;
            }
    );

    public GarminConnectImportService(
            ActivityRepository activityRepository,
            ActivityPointRepository activityPointRepository,
            FitActivityFileParser fitParser,
            ObjectMapper objectMapper
    ) {
        this.activityRepository = activityRepository;
        this.activityPointRepository = activityPointRepository;
        this.fitParser = fitParser;
        this.objectMapper = objectMapper;
    }

    /**
     * Start an async Garmin Connect import for the given runner.
     *
     * @return false if an import is already running for this runner.
     */
    public boolean startImport(Runner runner, String garminEmail, String garminPassword, int limit) {
        GarminSyncTracker tracker = syncStates.computeIfAbsent(runner.getId(), ignored -> new GarminSyncTracker());
        if (!tracker.tryBegin()) {
            return false;
        }

        int clampedLimit = Math.min(Math.max(1, limit), MAX_ACTIVITIES);

        executor.submit(() -> {
            try {
                runImport(runner, garminEmail, garminPassword, clampedLimit, tracker);
            } catch (Exception e) {
                markDownloadFailure(tracker, "Import failed: " + safeMessage(e), Map.of());
            }
        });

        return true;
    }

    public GarminSyncStatus getStatus(Long runnerId) {
        GarminSyncTracker tracker = syncStates.get(runnerId);
        if (tracker == null) {
            return GarminSyncStatus.idle();
        }
        return tracker.snapshot();
    }

    public long getRateLimitRetryAfterSeconds(Long runnerId) {
        GarminSyncTracker tracker = syncStates.get(runnerId);
        return tracker == null ? 0 : tracker.retryAfterSeconds();
    }

    private void runImport(Runner runner, String email, String password, int limit, GarminSyncTracker tracker) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("hermes-garmin-");
            Map<String, Object> result = callPythonDownloader(email, password, tempDir.toString(), limit);

            Boolean success = (Boolean) result.get("success");
            if (!Boolean.TRUE.equals(success)) {
                String error = (String) result.get("error");
                markDownloadFailure(tracker, error != null ? error : "Garmin download failed.", result);
                return;
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> activities = (List<Map<String, Object>>) result.get("activities");
            if (activities == null || activities.isEmpty()) {
                tracker.markCompleted("No new running activities found on Garmin Connect.");
                return;
            }

            Number skippedNum = (Number) result.get("skipped");
            if (skippedNum != null) {
                tracker.addSkippedNonRuns(skippedNum.intValue());
            }

            for (Map<String, Object> activityMeta : activities) {
                try {
                    importSingleActivity(runner, activityMeta, tracker);
                } catch (Exception e) {
                    logger.warn("[Hermes] Garmin import skipped activity: {}", safeMessage(e), e);
                }
            }

            tracker.markCompleted(null);
        } catch (Exception e) {
            markDownloadFailure(tracker, "Import failed: " + safeMessage(e), Map.of());
        } finally {
            if (tempDir != null) {
                deleteTempDir(tempDir);
            }
        }
    }

    private void markDownloadFailure(GarminSyncTracker tracker, String message, Map<String, Object> result) {
        Object errorCode = result == null ? null : result.get("errorCode");
        if (GarminRateLimitSupport.isRateLimited(errorCode, message)) {
            long retryAfterSeconds = GarminRateLimitSupport.retryAfterSeconds(
                    result == null ? null : result.get("retryAfterSeconds")
            );
            tracker.markRateLimited(GarminRateLimitSupport.message(retryAfterSeconds), retryAfterSeconds);
            return;
        }
        tracker.markFailed(message);
    }

    private void importSingleActivity(Runner runner, Map<String, Object> meta, GarminSyncTracker tracker) throws IOException {
        String filePath = (String) meta.get("filePath");
        String garminActivityId = (String) meta.get("activityId");
        if (filePath == null || garminActivityId == null) {
            return;
        }

        Path fitFile = Path.of(filePath);
        if (!Files.exists(fitFile)) {
            return;
        }

        String checksum = "GARMIN_CONNECT_" + garminActivityId;
        if (activityRepository.existsByRunnerAndProviderAndSourceChecksum(runner, ImportProvider.GARMIN, checksum)) {
            tracker.addDuplicates(1);
            return;
        }

        byte[] fileBytes = Files.readAllBytes(fitFile);

        ParsedActivityData parsed;
        try {
            parsed = fitParser.parse(fitFile.getFileName().toString(), fileBytes);
        } catch (IllegalArgumentException e) {
            tracker.addSkippedNonRuns(1);
            return;
        }

        if (parsed.activityType() != ActivityType.RUN) {
            tracker.addSkippedNonRuns(1);
            return;
        }

        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setProvider(ImportProvider.GARMIN);
        activity.setActivityType(ActivityType.RUN);
        activity.setSourceChecksum(checksum);
        activity.setSourceFileName(fitFile.getFileName().toString());
        activity.setCreatedAt(LocalDateTime.now());

        String activityName = stringVal(meta.get("name"));
        activity.setName(activityName != null && !activityName.isBlank()
                ? activityName
                : parsed.name());

        activity.setStartTime(parsed.startTime());
        activity.setDistanceMeters(parsed.distanceMeters());
        activity.setDurationSeconds(parsed.durationSeconds());
        activity.setDistanceKm(parsed.distanceMeters() == null ? 0d : parsed.distanceMeters() / 1000d);
        activity.setMovingTimeSeconds(parsed.durationSeconds() == null ? 0 : Math.toIntExact(parsed.durationSeconds()));
        activity.setStartDate(parsed.startTime() == null ? null : parsed.startTime().toString());

        activity.setAverageHeartRate(coalesceDbl(parsed.averageHeartRate(), dblVal(meta.get("avgHr"))));
        activity.setMaxHeartRate(coalesceDbl(parsed.maxHeartRate(), dblVal(meta.get("maxHr"))));
        activity.setCalories(intVal(meta.get("calories")));
        activity.setTotalElevationGain(dblVal(meta.get("elevationGain")));

        Activity saved = activityRepository.save(activity);

        List<ParsedTrackPoint> allPoints = parsed.points();
        int totalPoints = allPoints != null ? allPoints.size() : 0;
        int stride = totalPoints > MAX_POINTS_PER_ACTIVITY
                ? Math.max(1, (int) Math.ceil(totalPoints / (double) MAX_POINTS_PER_ACTIVITY))
                : 1;

        List<ActivityPoint> batch = new ArrayList<>(POINTS_BATCH_SIZE);
        int seq = 0;
        int kept = 0;

        if (allPoints != null) {
            for (int i = 0; i < totalPoints; i += stride) {
                ParsedTrackPoint pt = allPoints.get(i);
                ActivityPoint ap = new ActivityPoint();
                ap.setActivity(saved);
                ap.setSequenceIndex(seq++);
                ap.setLatitude(pt.latitude());
                ap.setLongitude(pt.longitude());
                batch.add(ap);
                kept++;

                if (batch.size() >= POINTS_BATCH_SIZE) {
                    activityPointRepository.saveAll(batch);
                    activityPointRepository.flush();
                    batch.clear();
                }
            }
        }

        if (!batch.isEmpty()) {
            activityPointRepository.saveAll(batch);
            activityPointRepository.flush();
        }

        tracker.addImported(1, kept);
    }

    private Map<String, Object> callPythonDownloader(String email, String password, String outputDir, int limit) throws IOException, InterruptedException {
        Path scriptPath = resolveScript();

        ProcessBuilder pb = new ProcessBuilder("python", scriptPath.toString());
        pb.redirectErrorStream(false);
        pb.environment().put("PYTHONIOENCODING", "utf-8");

        Process process = pb.start();

        String input = objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password,
                "output_dir", outputDir,
                "limit", limit
        ));

        try (OutputStream os = process.getOutputStream()) {
            os.write(input.getBytes(StandardCharsets.UTF_8));
            os.flush();
        }

        byte[] stdout = process.getInputStream().readAllBytes();
        byte[] stderr = process.getErrorStream().readAllBytes();
        int exitCode = process.waitFor();

        if (stderr.length > 0) {
            logger.warn("[Hermes] Garmin download stderr: {}", new String(stderr, StandardCharsets.UTF_8).trim());
        }

        if (exitCode != 0 || stdout.length == 0) {
            String errMsg = stderr.length > 0
                    ? new String(stderr, StandardCharsets.UTF_8).trim()
                    : "Python script exited with code " + exitCode;
            return Map.of("success", false, "error", errMsg);
        }

        try {
            return objectMapper.readValue(stdout, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of("success", false, "error", "Failed to parse download result.");
        }
    }

    private Path resolveScript() {
        // Look for the script relative to the working directory
        Path candidate = Path.of(".tools", "garmin_connect_download.py");
        if (Files.exists(candidate)) {
            return candidate.toAbsolutePath();
        }

        // Try relative to project root (one level up from backend/)
        candidate = Path.of("..", ".tools", "garmin_connect_download.py");
        if (Files.exists(candidate)) {
            return candidate.toAbsolutePath();
        }

        throw new IllegalStateException(
                "garmin_connect_download.py not found. Ensure .tools/garmin_connect_download.py exists and Python + garth are installed."
        );
    }

    private void deleteTempDir(Path dir) {
        try {
            if (!Files.exists(dir)) return;
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
                for (Path entry : stream) {
                    Files.deleteIfExists(entry);
                }
            }
            Files.deleteIfExists(dir);
        } catch (IOException ignored) {
        }
    }

    private String safeMessage(Exception e) {
        String msg = e.getMessage();
        if (msg == null) return e.getClass().getSimpleName();
        return msg.length() > 200 ? msg.substring(0, 200) : msg;
    }

    private String stringVal(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private Double dblVal(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        return null;
    }

    private Integer intVal(Object v) {
        if (v instanceof Number n) return n.intValue();
        return null;
    }

    private Double coalesceDbl(Double a, Double b) {
        return a != null ? a : b;
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 600_000)
    void cleanupStaleSyncTrackers() {
        long cutoff = System.currentTimeMillis() - 1_800_000;
        syncStates.entrySet().removeIf(e -> e.getValue().isStale(cutoff));
    }

    // ── Sync tracker ────────────────────────────────────────────────

    public record GarminSyncStatus(
            String status,
            int importedRuns,
            int importedPoints,
            int skippedNonRuns,
            int skippedDuplicates,
            String message,
            boolean active,
            long retryAfterSeconds
    ) {
        static GarminSyncStatus idle() {
            return new GarminSyncStatus("IDLE", 0, 0, 0, 0, null, false, 0);
        }
    }

    static final class GarminSyncTracker {
        private String status = "IDLE";
        private int importedRuns;
        private int importedPoints;
        private int skippedNonRuns;
        private int skippedDuplicates;
        private String message;
        private long cooldownUntilMs;
        private long lastUpdatedMs = System.currentTimeMillis();

        synchronized boolean tryBegin() {
            if ("RUNNING".equals(status)) return false;
            if (retryAfterSeconds() > 0) return false;
            status = "RUNNING";
            importedRuns = 0;
            importedPoints = 0;
            skippedNonRuns = 0;
            skippedDuplicates = 0;
            message = null;
            cooldownUntilMs = 0;
            return true;
        }

        synchronized void addImported(int runs, int points) {
            importedRuns += runs;
            importedPoints += points;
        }

        synchronized void addSkippedNonRuns(int n) {
            skippedNonRuns += n;
        }

        synchronized void addDuplicates(int n) {
            skippedDuplicates += n;
        }

        synchronized void markCompleted(String msg) {
            status = "COMPLETED";
            message = msg;
            cooldownUntilMs = 0;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized void markFailed(String msg) {
            status = "FAILED";
            message = msg;
            cooldownUntilMs = 0;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized void markRateLimited(String msg, long retryAfterSeconds) {
            status = "RATE_LIMITED";
            message = msg;
            cooldownUntilMs = System.currentTimeMillis() + (retryAfterSeconds * 1000);
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized boolean isStale(long cutoffMs) {
            return lastUpdatedMs < cutoffMs && !"RUNNING".equals(status);
        }

        synchronized GarminSyncStatus snapshot() {
            return new GarminSyncStatus(
                    status, importedRuns, importedPoints,
                    skippedNonRuns, skippedDuplicates, message,
                    "RUNNING".equals(status),
                    retryAfterSeconds()
            );
        }

        synchronized long retryAfterSeconds() {
            long remainingMs = cooldownUntilMs - System.currentTimeMillis();
            if (remainingMs <= 0) {
                return 0;
            }
            return (long) Math.ceil(remainingMs / 1000.0);
        }
    }
}
