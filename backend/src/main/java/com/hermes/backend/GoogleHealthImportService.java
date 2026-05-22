package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class GoogleHealthImportService {

    private static final Logger log = LoggerFactory.getLogger(GoogleHealthImportService.class);

    private final DailyWellnessSummaryRepository wellnessSummaryRepository;
    private final DailySleepDataRepository sleepDataRepository;
    private final DailyHRVDataRepository hrvDataRepository;
    private final DailyStressDataRepository stressDataRepository;
    private final RunnerRepository runnerRepository;
    private final CoachRunnerStateRepository coachRunnerStateRepository;
    private final ObjectMapper objectMapper;

    private final ConcurrentMap<Long, HealthSyncTracker> syncStates = new ConcurrentHashMap<>();

    private final ExecutorService executor = Executors.newFixedThreadPool(
            2,
            r -> {
                Thread t = new Thread(r, "google-health-import");
                t.setDaemon(true);
                return t;
            }
    );

    public GoogleHealthImportService(
            DailyWellnessSummaryRepository wellnessSummaryRepository,
            DailySleepDataRepository sleepDataRepository,
            DailyHRVDataRepository hrvDataRepository,
            DailyStressDataRepository stressDataRepository,
            RunnerRepository runnerRepository,
            CoachRunnerStateRepository coachRunnerStateRepository,
            ObjectMapper objectMapper
    ) {
        this.wellnessSummaryRepository = wellnessSummaryRepository;
        this.sleepDataRepository = sleepDataRepository;
        this.hrvDataRepository = hrvDataRepository;
        this.stressDataRepository = stressDataRepository;
        this.runnerRepository = runnerRepository;
        this.coachRunnerStateRepository = coachRunnerStateRepository;
        this.objectMapper = objectMapper;
    }

    public boolean importWellnessData(Runner runner, List<Map<String, Object>> dataPoints) {
        HealthSyncTracker tracker = syncStates.computeIfAbsent(runner.getId(), ignored -> new HealthSyncTracker());
        if (!tracker.tryBegin()) {
            return false;
        }

        executor.submit(() -> {
            try {
                processDataPoints(runner, dataPoints, tracker);
                tracker.markCompleted("Google Health Connect data processed.");
            } catch (Exception e) {
                log.error("Google Health import failed for runner {}: {}", runner.getId(), e.getMessage());
                tracker.markFailed("Import failed: " + e.getMessage());
            }
        });

        return true;
    }

    public HealthSyncStatus getStatus(Long runnerId) {
        HealthSyncTracker tracker = syncStates.get(runnerId);
        if (tracker == null) {
            return HealthSyncStatus.idle();
        }
        return tracker.snapshot();
    }

    @SuppressWarnings("unchecked")
    private void processDataPoints(Runner runner, List<Map<String, Object>> dataPoints, HealthSyncTracker tracker) {
        ImportProvider provider = ImportProvider.GOOGLE_HEALTH;
        int savedCount = 0;
        Integer latestRestingHeartRate = null;
        Integer latestSleepScore = null;
        Integer latestHrvMs = null;

        for (Map<String, Object> entry : dataPoints) {
            try {
                String type = (String) entry.get("type");
                String dateStr = (String) entry.get("date");
                if (dateStr == null) continue;
                LocalDate date = LocalDate.parse(dateStr);

                if ("wellness".equals(type)) {
                    Optional<DailyWellnessSummary> existing = wellnessSummaryRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                    DailyWellnessSummary entity = existing.orElse(new DailyWellnessSummary());
                    entity.setRunner(runner);
                    entity.setDate(date);
                    entity.setProvider(provider);

                    if (entry.containsKey("restingHeartRate")) {
                        latestRestingHeartRate = intVal(entry.get("restingHeartRate"));
                        entity.setRestingHeartRate(latestRestingHeartRate);
                    }
                    if (entry.containsKey("steps")) entity.setTotalSteps(longVal(entry.get("steps")));
                    if (entry.containsKey("activeCalories")) entity.setActiveKilocalories(dblVal(entry.get("activeCalories")));

                    entity.setSourceChecksum("manual-import");
                    wellnessSummaryRepository.save(entity);
                    savedCount++;
                } else if ("sleep".equals(type)) {
                    Optional<DailySleepData> existing = sleepDataRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                    DailySleepData entity = existing.orElse(new DailySleepData());
                    entity.setRunner(runner);
                    entity.setDate(date);
                    entity.setProvider(provider);

                    if (entry.containsKey("score")) {
                        latestSleepScore = intVal(entry.get("score"));
                        entity.setSleepScore(latestSleepScore);
                    }
                    if (entry.containsKey("durationMinutes")) entity.setSleepTimeSeconds(intVal(entry.get("durationMinutes")) * 60);

                    entity.setSourceChecksum("manual-import");
                    sleepDataRepository.save(entity);
                    savedCount++;
                } else if ("hrv".equals(type)) {
                    Optional<DailyHRVData> existing = hrvDataRepository.findByRunnerAndProviderAndDate(runner, provider, date);
                    DailyHRVData entity = existing.orElse(new DailyHRVData());
                    entity.setRunner(runner);
                    entity.setDate(date);
                    entity.setProvider(provider);

                    if (entry.containsKey("hrv")) {
                        Double hrv = dblVal(entry.get("hrv"));
                        entity.setLastNightAvg(hrv);
                        latestHrvMs = hrv == null ? null : (int) Math.round(hrv);
                    }

                    entity.setSourceChecksum("manual-import");
                    hrvDataRepository.save(entity);
                    savedCount++;
                }
            } catch (Exception e) {
                log.warn("Skipping Google Health entry for runner {}: {}", runner.getId(), e.getMessage());
            }
        }

        tracker.addProcessed(savedCount);
        updateCoachRunnerState(runner, latestRestingHeartRate, latestSleepScore, latestHrvMs);
    }

    private void updateCoachRunnerState(Runner runner, Integer restingHeartRate, Integer sleepScore, Integer hrvMs) {
        Optional<CoachRunnerState> stateOpt = coachRunnerStateRepository.findByRunner(runner);
        if (stateOpt.isPresent()) {
            CoachRunnerState state = stateOpt.get();
            boolean changed = false;
            if (restingHeartRate != null) {
                state.setLastNightRestingHr(restingHeartRate);
                if (state.getBaselineRestingHr() == null) {
                    state.setBaselineRestingHr(restingHeartRate);
                }
                changed = true;
            }
            if (sleepScore != null) {
                state.setLastSleepScore(sleepScore);
                changed = true;
            }
            if (hrvMs != null) {
                state.setLastHrvMs(hrvMs);
                changed = true;
            }
            if (changed) {
                coachRunnerStateRepository.save(state);
            }
        }
    }

    private Integer intVal(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString()); } catch (Exception e) { return null; }
    }

    private Long longVal(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        try { return Long.parseLong(o.toString()); } catch (Exception e) { return null; }
    }

    private Double dblVal(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).doubleValue();
        try { return Double.parseDouble(o.toString()); } catch (Exception e) { return null; }
    }

    public static class HealthSyncTracker {
        private boolean running = false;
        private int processed = 0;
        private String lastMessage = "";
        private boolean failed = false;

        public synchronized boolean tryBegin() {
            if (running) return false;
            running = true;
            failed = false;
            processed = 0;
            return true;
        }

        public synchronized void markCompleted(String message) {
            running = false;
            lastMessage = message;
        }

        public synchronized void markFailed(String message) {
            running = false;
            failed = true;
            lastMessage = message;
        }

        public synchronized void addProcessed(int count) {
            processed += count;
        }

        public HealthSyncStatus snapshot() {
            return new HealthSyncStatus(running, processed, lastMessage, failed);
        }
    }

    public static record HealthSyncStatus(boolean running, int processed, String message, boolean failed) {
        public static HealthSyncStatus idle() {
            return new HealthSyncStatus(false, 0, "Idle", false);
        }
    }
}
