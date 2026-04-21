package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class GarminWellnessImportService {

    private final DailyWellnessSummaryRepository wellnessSummaryRepository;
    private final DailySleepDataRepository sleepDataRepository;
    private final DailyHRVDataRepository hrvDataRepository;
    private final DailyStressDataRepository stressDataRepository;
    private final BodyCompositionDataRepository bodyCompositionRepository;
    private final RunnerRepository runnerRepository;
    private final CoachRunnerStateRepository coachRunnerStateRepository;
    private final ObjectMapper objectMapper;
    private final ConcurrentMap<Long, WellnessSyncTracker> syncStates = new ConcurrentHashMap<>();

    private final ExecutorService executor = Executors.newFixedThreadPool(
            1,
            r -> {
                Thread t = new Thread(r, "garmin-wellness-import");
                t.setDaemon(true);
                return t;
            }
    );

    public GarminWellnessImportService(
            DailyWellnessSummaryRepository wellnessSummaryRepository,
            DailySleepDataRepository sleepDataRepository,
            DailyHRVDataRepository hrvDataRepository,
            DailyStressDataRepository stressDataRepository,
            BodyCompositionDataRepository bodyCompositionRepository,
            RunnerRepository runnerRepository,
            CoachRunnerStateRepository coachRunnerStateRepository,
            ObjectMapper objectMapper
    ) {
        this.wellnessSummaryRepository = wellnessSummaryRepository;
        this.sleepDataRepository = sleepDataRepository;
        this.hrvDataRepository = hrvDataRepository;
        this.stressDataRepository = stressDataRepository;
        this.bodyCompositionRepository = bodyCompositionRepository;
        this.runnerRepository = runnerRepository;
        this.coachRunnerStateRepository = coachRunnerStateRepository;
        this.objectMapper = objectMapper;
    }

    public boolean startWellnessImport(Runner runner, String email, String password, int daysBack) {
        WellnessSyncTracker tracker = syncStates.computeIfAbsent(runner.getId(), ignored -> new WellnessSyncTracker());
        if (!tracker.tryBegin()) {
            return false;
        }

        int clampedDays = Math.min(Math.max(1, daysBack), 365);

        executor.submit(() -> {
            try {
                runImport(runner, email, password, clampedDays, tracker);
            } catch (Exception e) {
                tracker.markFailed("Wellness import failed: " + safeMessage(e));
            }
        });

        return true;
    }

    public WellnessSyncStatus getStatus(Long runnerId) {
        WellnessSyncTracker tracker = syncStates.get(runnerId);
        if (tracker == null) {
            return WellnessSyncStatus.idle();
        }
        return tracker.snapshot();
    }

    @SuppressWarnings("unchecked")
    private void runImport(Runner runner, String email, String password, int daysBack, WellnessSyncTracker tracker) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("hermes-garmin-wellness-");
            LocalDate endDate = LocalDate.now();
            LocalDate startDate = endDate.minusDays(daysBack - 1);

            Map<String, Object> result = callPythonWellnessDownloader(email, password, startDate, endDate);

            Boolean success = (Boolean) result.get("success");
            if (!Boolean.TRUE.equals(success)) {
                String error = (String) result.get("error");
                tracker.markFailed(error != null ? error : "Garmin wellness download failed.");
                return;
            }

            List<Map<String, Object>> days = (List<Map<String, Object>>) result.get("days");
            if (days == null || days.isEmpty()) {
                tracker.markCompleted("No wellness data found on Garmin Connect.");
                return;
            }

            tracker.addDaysFetched(days.size());

            int wellnessSaved = 0;
            int sleepSaved = 0;
            int hrvSaved = 0;
            int stressSaved = 0;
            int bodySaved = 0;
            int daysPersisted = 0;

            for (Map<String, Object> dayEntry : days) {
                try {
                    String dateStr = (String) dayEntry.get("date");
                    if (dateStr == null) continue;
                    LocalDate date = LocalDate.parse(dateStr);
                    ImportProvider provider = ImportProvider.GARMIN;

                    Map<String, Object> wellness = (Map<String, Object>) dayEntry.get("wellness");
                    if (wellness != null) {
                        Optional<DailyWellnessSummary> existing = wellnessSummaryRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                        DailyWellnessSummary entity = existing.orElse(new DailyWellnessSummary());
                        entity.setRunner(runner);
                        entity.setDate(date);
                        entity.setProvider(provider);
                        entity.setRestingHeartRate(intVal(wellness.get("restingHeartRate")));
                        entity.setAvgStressLevel(intVal(wellness.get("avgStressLevel")));
                        entity.setMaxStressLevel(intVal(wellness.get("maxStressLevel")));
                        entity.setStressQualifier((String) wellness.get("stressQualifier"));
                        entity.setTotalSteps(longVal(wellness.get("totalSteps")));
                        entity.setTotalDistanceMeters(dblVal(wellness.get("totalDistanceMeters")));
                        entity.setActiveKilocalories(dblVal(wellness.get("activeKilocalories")));
                        entity.setSedentarySeconds(intVal(wellness.get("sedentarySeconds")));
                        entity.setBodyBatteryHighest(intVal(wellness.get("bodyBatteryHighest")));
                        entity.setBodyBatteryLowest(intVal(wellness.get("bodyBatteryLowest")));
                        entity.setBodyBatteryAtWake(intVal(wellness.get("bodyBatteryAtWake")));
                        entity.setModerateIntensityMinutes(intVal(wellness.get("moderateIntensityMinutes")));
                        entity.setVigorousIntensityMinutes(intVal(wellness.get("vigorousIntensityMinutes")));
                        entity.setAverageSpo2(dblVal(wellness.get("averageSpo2")));
                        entity.setLowestSpo2(dblVal(wellness.get("lowestSpo2")));
                        entity.setFloorsAscended(intVal(wellness.get("floorsAscended")));
                        entity.setFloorsDescended(intVal(wellness.get("floorsDescended")));
                        entity.setSourceChecksum("GARMIN_WELLNESS_" + runner.getId() + "_" + date.toString());
                        wellnessSummaryRepository.save(entity);
                        wellnessSaved++;
                    }

                    Map<String, Object> sleep = (Map<String, Object>) dayEntry.get("sleep");
                    if (sleep != null) {
                        Optional<DailySleepData> existing = sleepDataRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                        DailySleepData entity = existing.orElse(new DailySleepData());
                        entity.setRunner(runner);
                        entity.setDate(date);
                        entity.setProvider(provider);
                        entity.setSleepTimeSeconds(intVal(sleep.get("sleepTimeSeconds")));
                        entity.setDeepSleepSeconds(intVal(sleep.get("deepSleepSeconds")));
                        entity.setLightSleepSeconds(intVal(sleep.get("lightSleepSeconds")));
                        entity.setRemSleepSeconds(intVal(sleep.get("remSleepSeconds")));
                        entity.setAwakeSleepSeconds(intVal(sleep.get("awakeSleepSeconds")));
                        entity.setSleepScore(intVal(sleep.get("sleepScore")));
                        entity.setAwakeCount(intVal(sleep.get("awakeCount")));
                        entity.setAverageSpO2(dblVal(sleep.get("averageSpO2")));
                        entity.setLowestSpO2(dblVal(sleep.get("lowestSpO2")));
                        entity.setHighestSpO2(dblVal(sleep.get("highestSpO2")));
                        entity.setAverageRespiration(dblVal(sleep.get("averageRespiration")));
                        entity.setAvgSleepStress(dblVal(sleep.get("avgSleepStress")));
                        entity.setSourceChecksum("GARMIN_SLEEP_" + runner.getId() + "_" + date.toString());
                        sleepDataRepository.save(entity);
                        sleepSaved++;
                    }

                    Map<String, Object> hrv = (Map<String, Object>) dayEntry.get("hrv");
                    if (hrv != null) {
                        Optional<DailyHRVData> existing = hrvDataRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                        DailyHRVData entity = existing.orElse(new DailyHRVData());
                        entity.setRunner(runner);
                        entity.setDate(date);
                        entity.setProvider(provider);
                        entity.setLastNightAvg(dblVal(hrv.get("lastNightAvg")));
                        entity.setLastNight5MinHigh(dblVal(hrv.get("lastNight5MinHigh")));
                        entity.setWeeklyAvg(dblVal(hrv.get("weeklyAvg")));
                        entity.setBaselineLowUpper(dblVal(hrv.get("baselineLowUpper")));
                        entity.setBaselineBalancedLow(dblVal(hrv.get("baselineBalancedLow")));
                        entity.setBaselineBalancedUpper(dblVal(hrv.get("baselineBalancedUpper")));
                        entity.setStatus((String) hrv.get("status"));
                        entity.setFeedbackPhrase((String) hrv.get("feedbackPhrase"));
                        entity.setSourceChecksum("GARMIN_HRV_" + runner.getId() + "_" + date.toString());
                        hrvDataRepository.save(entity);
                        hrvSaved++;
                    }

                    Map<String, Object> stress = (Map<String, Object>) dayEntry.get("stress");
                    if (stress != null) {
                        Optional<DailyStressData> existing = stressDataRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                        DailyStressData entity = existing.orElse(new DailyStressData());
                        entity.setRunner(runner);
                        entity.setDate(date);
                        entity.setProvider(provider);
                        entity.setOverallStressLevel(intVal(stress.get("overallStressLevel")));
                        entity.setRestStressDuration(intVal(stress.get("restStressDuration")));
                        entity.setLowStressDuration(intVal(stress.get("lowStressDuration")));
                        entity.setMediumStressDuration(intVal(stress.get("mediumStressDuration")));
                        entity.setHighStressDuration(intVal(stress.get("highStressDuration")));
                        entity.setSourceChecksum("GARMIN_STRESS_" + runner.getId() + "_" + date.toString());
                        stressDataRepository.save(entity);
                        stressSaved++;
                    }

                    Map<String, Object> body = (Map<String, Object>) dayEntry.get("bodyComposition");
                    if (body != null) {
                        Optional<BodyCompositionData> existing = bodyCompositionRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                        BodyCompositionData entity = existing.orElse(new BodyCompositionData());
                        entity.setRunner(runner);
                        entity.setDate(date);
                        entity.setProvider(provider);
                        entity.setWeight(dblVal(body.get("weight")));
                        entity.setBmi(dblVal(body.get("bmi")));
                        entity.setBodyFat(dblVal(body.get("bodyFat")));
                        entity.setBodyWater(dblVal(body.get("bodyWater")));
                        entity.setBoneMass(dblVal(body.get("boneMass")));
                        entity.setMuscleMass(dblVal(body.get("muscleMass")));
                        entity.setVisceralFat(dblVal(body.get("visceralFat")));
                        entity.setMetabolicAge(intVal(body.get("metabolicAge")));
                        entity.setPhysiqueRating(intVal(body.get("physiqueRating")));
                        entity.setSourceChecksum("GARMIN_BODY_" + runner.getId() + "_" + date.toString());
                        bodyCompositionRepository.save(entity);
                        bodySaved++;
                    }

                    daysPersisted++;
                } catch (Exception e) {
                    System.err.println("[Hermes] Garmin wellness import skipped day: " + safeMessage(e));
                }
            }

            tracker.addWellnessSaved(wellnessSaved);
            tracker.addSleepSaved(sleepSaved);
            tracker.addHrvSaved(hrvSaved);
            tracker.addStressSaved(stressSaved);
            tracker.addBodySaved(bodySaved);
            tracker.addDaysPersisted(daysPersisted);

            updateCoachFromWellness(runner);

            tracker.markCompleted(null);
        } catch (Exception e) {
            tracker.markFailed("Wellness import failed: " + safeMessage(e));
        } finally {
            if (tempDir != null) {
                deleteTempDir(tempDir);
            }
        }
    }

    private void updateCoachFromWellness(Runner runner) {
        CoachRunnerState coachRunnerState = coachRunnerStateRepository.findByRunner(runner)
                .orElseGet(() -> {
                    CoachRunnerState newState = new CoachRunnerState();
                    newState.setRunner(runner);
                    return newState;
                });

        List<DailyWellnessSummary> wellnessList = wellnessSummaryRepository.findByRunnerOrderByDateDesc(runner);
        if (!wellnessList.isEmpty()) {
            DailyWellnessSummary latest = wellnessList.get(0);
            if (latest.getRestingHeartRate() != null) {
                coachRunnerState.setLastNightRestingHr(latest.getRestingHeartRate());
            }
        }

        List<DailyHRVData> hrvList = hrvDataRepository.findByRunnerOrderByDateDesc(runner);
        if (!hrvList.isEmpty()) {
            DailyHRVData latest = hrvList.get(0);
            if (latest.getLastNightAvg() != null) {
                coachRunnerState.setLastHrvMs(latest.getLastNightAvg().intValue());
            }
        }

        List<DailySleepData> sleepList = sleepDataRepository.findByRunnerOrderByDateDesc(runner);
        if (!sleepList.isEmpty()) {
            DailySleepData latest = sleepList.get(0);
            if (latest.getSleepScore() != null) {
                coachRunnerState.setLastSleepScore(latest.getSleepScore());
            }
        }

        coachRunnerState.setLastRecoveryLoggedAt(LocalDateTime.now());
        coachRunnerStateRepository.save(coachRunnerState);
    }

    private Map<String, Object> callPythonWellnessDownloader(String email, String password, LocalDate startDate, LocalDate endDate) throws IOException, InterruptedException {
        Path scriptPath = resolveWellnessScript();

        ProcessBuilder pb = new ProcessBuilder("python", scriptPath.toString());
        pb.redirectErrorStream(false);
        pb.environment().put("PYTHONIOENCODING", "utf-8");

        Process process = pb.start();

        String input = objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password,
                "start_date", startDate.toString(),
                "end_date", endDate.toString()
        ));

        try (OutputStream os = process.getOutputStream()) {
            os.write(input.getBytes(StandardCharsets.UTF_8));
            os.flush();
        }

        byte[] stdout = process.getInputStream().readAllBytes();
        byte[] stderr = process.getErrorStream().readAllBytes();
        int exitCode = process.waitFor();

        if (stderr.length > 0) {
            System.err.println("[Hermes] Garmin wellness download stderr: " + new String(stderr, StandardCharsets.UTF_8).trim());
        }

        if (exitCode != 0 || stdout.length == 0) {
            String errMsg = stderr.length > 0
                    ? new String(stderr, StandardCharsets.UTF_8).trim()
                    : "Python wellness script exited with code " + exitCode;
            return Map.of("success", false, "error", errMsg);
        }

        try {
            return objectMapper.readValue(stdout, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of("success", false, "error", "Failed to parse wellness download result.");
        }
    }

    private Path resolveWellnessScript() {
        Path candidate = Path.of(".tools", "garmin_wellness_download.py");
        if (Files.exists(candidate)) {
            return candidate.toAbsolutePath();
        }

        candidate = Path.of("..", ".tools", "garmin_wellness_download.py");
        if (Files.exists(candidate)) {
            return candidate.toAbsolutePath();
        }

        throw new IllegalStateException(
                "garmin_wellness_download.py not found. Ensure .tools/garmin_wellness_download.py exists and Python + garth are installed."
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

    private Double dblVal(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        return null;
    }

    private Integer intVal(Object v) {
        if (v instanceof Number n) return n.intValue();
        return null;
    }

    private Long longVal(Object v) {
        if (v instanceof Number n) return n.longValue();
        return null;
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 600_000)
    void cleanupStaleSyncTrackers() {
        long cutoff = System.currentTimeMillis() - 1_800_000;
        syncStates.entrySet().removeIf(e -> e.getValue().isStale(cutoff));
    }

    public record WellnessSyncStatus(
            String status,
            int daysFetched,
            int daysPersisted,
            int wellnessSaved,
            int sleepSaved,
            int hrvSaved,
            int stressSaved,
            int bodySaved,
            String message,
            boolean active
    ) {
        static WellnessSyncStatus idle() {
            return new WellnessSyncStatus("IDLE", 0, 0, 0, 0, 0, 0, 0, null, false);
        }
    }

    static final class WellnessSyncTracker {
        private String status = "IDLE";
        private int daysFetched;
        private int daysPersisted;
        private int wellnessSaved;
        private int sleepSaved;
        private int hrvSaved;
        private int stressSaved;
        private int bodySaved;
        private String message;
        private long lastUpdatedMs = System.currentTimeMillis();

        synchronized boolean tryBegin() {
            if ("RUNNING".equals(status)) return false;
            status = "RUNNING";
            daysFetched = 0;
            daysPersisted = 0;
            wellnessSaved = 0;
            sleepSaved = 0;
            hrvSaved = 0;
            stressSaved = 0;
            bodySaved = 0;
            message = null;
            return true;
        }

        synchronized void addDaysFetched(int n) { daysFetched += n; }
        synchronized void addDaysPersisted(int n) { daysPersisted += n; }
        synchronized void addWellnessSaved(int n) { wellnessSaved += n; }
        synchronized void addSleepSaved(int n) { sleepSaved += n; }
        synchronized void addHrvSaved(int n) { hrvSaved += n; }
        synchronized void addStressSaved(int n) { stressSaved += n; }
        synchronized void addBodySaved(int n) { bodySaved += n; }

        synchronized void markCompleted(String msg) {
            status = "COMPLETED";
            message = msg;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized void markFailed(String msg) {
            status = "FAILED";
            message = msg;
            lastUpdatedMs = System.currentTimeMillis();
        }

        synchronized boolean isStale(long cutoffMs) {
            return lastUpdatedMs < cutoffMs && !"RUNNING".equals(status);
        }

        synchronized WellnessSyncStatus snapshot() {
            return new WellnessSyncStatus(
                    status, daysFetched, daysPersisted,
                    wellnessSaved, sleepSaved, hrvSaved, stressSaved, bodySaved,
                    message, "RUNNING".equals(status)
            );
        }
    }
}