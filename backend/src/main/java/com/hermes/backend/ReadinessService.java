package com.hermes.backend;

import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReadinessService {
    private final DailySleepDataRepository sleepRepository;
    private final DailyHRVDataRepository hrvRepository;
    private final DailyStressDataRepository stressRepository;
    private final DailyWellnessSummaryRepository wellnessRepository;

    public ReadinessService(DailySleepDataRepository sleepRepository,
                            DailyHRVDataRepository hrvRepository,
                            DailyStressDataRepository stressRepository,
                            DailyWellnessSummaryRepository wellnessRepository) {
        this.sleepRepository = sleepRepository;
        this.hrvRepository = hrvRepository;
        this.stressRepository = stressRepository;
        this.wellnessRepository = wellnessRepository;
    }

    public List<ReadinessDay> getReadinessTrend(Runner runner, int days) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days - 1);

        Map<LocalDate, List<DailySleepData>> sleepMap = sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.groupingBy(DailySleepData::getDate));
        Map<LocalDate, List<DailyHRVData>> hrvMap = hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.groupingBy(DailyHRVData::getDate));
        Map<LocalDate, List<DailyStressData>> stressMap = stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.groupingBy(DailyStressData::getDate));
        Map<LocalDate, List<DailyWellnessSummary>> wellnessMap = wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.groupingBy(DailyWellnessSummary::getDate));

        List<ReadinessDay> trend = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate date = start.plusDays(i);
            SourceSelection<DailySleepData> sleep = selectSleep(
                    sleepMap.get(date),
                    runner == null ? null : runner.getWellnessSleepSource()
            );
            SourceSelection<DailyHRVData> hrv = selectHrv(
                    hrvMap.get(date),
                    runner == null ? null : runner.getWellnessHrvSource()
            );
            SourceSelection<DailyStressData> stress = selectStress(
                    stressMap.get(date),
                    runner == null ? null : runner.getWellnessStressSource()
            );
            SourceSelection<DailyWellnessSummary> wellness = selectWellness(
                    wellnessMap.get(date),
                    runner == null ? null : runner.getWellnessRestingHrSource(),
                    runner == null ? null : runner.getRestingHeartRateBpm()
            );
            ReadinessDay readiness = calculateDayReadiness(
                    date,
                    sleep.value(),
                    hrv.value(),
                    stress.value(),
                    wellness.value()
            );
            trend.add(new ReadinessDay(date, readiness.score(), hasSelectedDailyData(sleep, hrv, stress, wellness)));
        }
        return trend;
    }

    public ReadinessDay getDailyReadiness(Runner runner, LocalDate date) {
        CoachRunnerState state = new CoachRunnerState();
        if (runner != null) {
            state.setBaselineRestingHr(runner.getRestingHeartRateBpm());
        }
        MultiSourceReadinessSnapshot snapshot = resolveReadinessSnapshot(runner, state, date);
        return new ReadinessDay(date, snapshot.readiness().score(), snapshot.hasSourceData());
    }

    public ReadinessResult compute(CoachRunnerState state) {
        int sleep = normalizeSleepComponent(state.getLastSleepScore());
        int hrv = normalizeHrvComponent(state.getLastHrvStatus(), state.getLastHrvMs());
        int rhr = normalizeRhrComponent(state.getBaselineRestingHr(), state.getLastNightRestingHr());
        int stress = normalizeStressComponent(state.getLastStressScore());

        int score = (sleep + hrv + rhr + stress) / 4;
        String verdict;
        if (score >= 85) verdict = "GO";
        else if (score >= 70) verdict = "EASY";
        else if (score >= 50) verdict = "RECOVERY";
        else verdict = "REST";

        return new ReadinessResult(score, verdict, sleep, hrv, rhr, stress);
    }

    public MultiSourceReadinessSnapshot resolveReadinessSnapshot(Runner runner, CoachRunnerState state, LocalDate date) {
        LocalDate targetDate = date == null ? LocalDate.now() : date;
        CoachRunnerState fallback = state == null ? new CoachRunnerState() : state;

        SourceSelection<DailySleepData> sleep = selectSleep(
                sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, targetDate, targetDate),
                runner == null ? null : runner.getWellnessSleepSource()
        );
        SourceSelection<DailyHRVData> hrv = selectHrv(
                hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, targetDate, targetDate),
                runner == null ? null : runner.getWellnessHrvSource()
        );
        SourceSelection<DailyStressData> stress = selectStress(
                stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, targetDate, targetDate),
                runner == null ? null : runner.getWellnessStressSource()
        );
        SourceSelection<DailyWellnessSummary> wellness = selectWellness(
                wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, targetDate, targetDate),
                runner == null ? null : runner.getWellnessRestingHrSource(),
                fallback.getBaselineRestingHr()
        );

        Integer sleepScore = sleep.value() == null || sleep.value().getSleepScore() == null
                ? fallback.getLastSleepScore()
                : sleep.value().getSleepScore();
        Integer hrvMs = hrv.value() == null || hrv.value().getLastNightAvg() == null
                ? fallback.getLastHrvMs()
                : Integer.valueOf((int) Math.round(hrv.value().getLastNightAvg()));
        String hrvStatus = hrv.value() == null || hrv.value().getStatus() == null
                ? fallback.getLastHrvStatus()
                : hrv.value().getStatus();
        Integer restingHr = wellness.value() == null || wellness.value().getRestingHeartRate() == null
                ? fallback.getLastNightRestingHr()
                : wellness.value().getRestingHeartRate();
        Integer stressScore = stress.value() == null || stress.value().getOverallStressLevel() == null
                ? fallback.getLastStressScore()
                : stress.value().getOverallStressLevel();

        ReadinessResult readiness = computeReadiness(
                sleepScore,
                hrvStatus,
                hrvMs,
                fallback.getBaselineRestingHr(),
                restingHr,
                stressScore
        );
        return new MultiSourceReadinessSnapshot(
                readiness,
                new MetricSources(sourceName(sleep), sourceName(hrv), sourceName(wellness), sourceName(stress)),
                hasSelectedDailyData(sleep, hrv, stress, wellness) || hasFallbackDailyReadinessData(fallback)
        );
    }

    private boolean hasSelectedDailyData(SourceSelection<?>... selections) {
        if (selections == null) return false;
        return Arrays.stream(selections)
                .filter(Objects::nonNull)
                .anyMatch(selection -> selection.value() != null);
    }

    private boolean hasFallbackDailyReadinessData(CoachRunnerState state) {
        if (state == null) return false;
        return state.getLastSleepScore() != null
                || state.getLastHrvMs() != null
                || (state.getLastHrvStatus() != null && !state.getLastHrvStatus().isBlank())
                || state.getLastNightRestingHr() != null
                || state.getLastStressScore() != null;
    }

    private ReadinessResult computeReadiness(
            Integer sleepScore,
            String hrvStatus,
            Integer hrvMs,
            Integer baselineRestingHr,
            Integer restingHr,
            Integer stressScore
    ) {
        int sleep = normalizeSleepComponent(sleepScore);
        int hrv = normalizeHrvComponent(hrvStatus, hrvMs);
        int rhr = normalizeRhrComponent(baselineRestingHr, restingHr);
        int stress = normalizeStressComponent(stressScore);

        int score = (sleep + hrv + rhr + stress) / 4;
        String verdict;
        if (score >= 85) verdict = "GO";
        else if (score >= 70) verdict = "EASY";
        else if (score >= 50) verdict = "RECOVERY";
        else verdict = "REST";

        return new ReadinessResult(score, verdict, sleep, hrv, rhr, stress);
    }

    private int normalizeSleepComponent(Integer sleepScore) {
        if (sleepScore == null) return 75;
        return clamp(sleepScore);
    }

    private int normalizeHrvComponent(String hrvStatus, Integer hrvMs) {
        if (hrvStatus != null && !hrvStatus.isBlank()) {
            String normalized = hrvStatus.trim().toUpperCase();
            if ("BALANCED".equals(normalized)) return 85;
            if ("LOW".equals(normalized) || "POOR".equals(normalized) || "UNBALANCED".equals(normalized)) return 45;
        }
        if (hrvMs == null) return 75;
        if (hrvMs >= 80) return 85;
        if (hrvMs >= 55) return 75;
        if (hrvMs >= 35) return 60;
        return 45;
    }

    private int normalizeRhrComponent(Integer baselineRestingHr, Integer lastNightRestingHr) {
        if (lastNightRestingHr == null) return 75;
        if (baselineRestingHr == null) {
            if (lastNightRestingHr <= 50) return 82;
            if (lastNightRestingHr <= 60) return 75;
            return 60;
        }

        int delta = lastNightRestingHr - baselineRestingHr;
        if (delta <= -3) return 85;
        if (delta <= 2) return 78;
        if (delta <= 6) return 62;
        return 45;
    }

    private int normalizeStressComponent(Integer stressScore) {
        if (stressScore == null) return 75;
        return clamp(100 - stressScore);
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }

    private ReadinessDay calculateDayReadiness(LocalDate date, DailySleepData sleep, DailyHRVData hrv, DailyStressData stress, DailyWellnessSummary wellness) {
        int score = 75; // Baseline
        
        // 1. Sleep (25 pts)
        if (sleep != null && sleep.getSleepScore() != null) {
            int ss = sleep.getSleepScore();
            if (ss > 85) score += 10;
            else if (ss < 50) score -= 20;
            else if (ss < 70) score -= 5;
        }

        // 2. HRV (25 pts)
        if (hrv != null && hrv.getStatus() != null) {
            String status = hrv.getStatus().toUpperCase();
            if (status.equals("BALANCED")) score += 10;
            else if (status.equals("LOW") || status.equals("POOR")) score -= 15;
        }

        // 3. Stress (25 pts)
        if (stress != null && stress.getOverallStressLevel() != null) {
            int sl = stress.getOverallStressLevel();
            if (sl < 25) score += 5;
            else if (sl > 75) score -= 15;
        }

        // 4. RHR (25 pts) - Compare to baseline if possible
        if (wellness != null && wellness.getRestingHeartRate() != null) {
            // Simplified: higher RHR than usual (assume 55 as baseline if unknown)
            if (wellness.getRestingHeartRate() > 65) score -= 10;
            else if (wellness.getRestingHeartRate() < 50) score += 5;
        }

        score = Math.max(0, Math.min(100, score));
        return new ReadinessDay(date, score);
    }

    private SourceSelection<DailySleepData> selectSleep(List<DailySleepData> entries, String preferredSource) {
        return selectBest(entries, preferredSource, DailySleepData::getProvider, entry -> entry.getSleepScore() != null, entry -> entry.getSleepScore() == null ? 0 : entry.getSleepScore());
    }

    private SourceSelection<DailyHRVData> selectHrv(List<DailyHRVData> entries, String preferredSource) {
        return selectBest(entries, preferredSource, DailyHRVData::getProvider, entry -> entry.getLastNightAvg() != null || entry.getStatus() != null, entry -> {
            if (entry.getStatus() != null && "BALANCED".equalsIgnoreCase(entry.getStatus())) return 100;
            return entry.getLastNightAvg() == null ? 0 : Math.min(100, (int) Math.round(entry.getLastNightAvg()));
        });
    }

    private SourceSelection<DailyStressData> selectStress(List<DailyStressData> entries, String preferredSource) {
        return selectBest(entries, preferredSource, DailyStressData::getProvider, entry -> entry.getOverallStressLevel() != null, entry -> entry.getOverallStressLevel() == null ? 0 : 100 - clamp(entry.getOverallStressLevel()));
    }

    private SourceSelection<DailyWellnessSummary> selectWellness(List<DailyWellnessSummary> entries, String preferredSource, Integer baselineRestingHr) {
        return selectBest(entries, preferredSource, DailyWellnessSummary::getProvider, entry -> entry.getRestingHeartRate() != null, entry -> restingHrConfidence(entry.getRestingHeartRate(), baselineRestingHr));
    }

    private <T> SourceSelection<T> selectBest(
            List<T> entries,
            String preferredSource,
            java.util.function.Function<T, ImportProvider> providerResolver,
            java.util.function.Predicate<T> usable,
            java.util.function.ToIntFunction<T> confidence
    ) {
        List<T> safeEntries = entries == null ? List.of() : entries;
        if (isManualSource(preferredSource)) {
            return new SourceSelection<>(null, null, "MANUAL");
        }
        Optional<ImportProvider> preferredProvider = parseWellnessSource(preferredSource);
        if (preferredProvider.isPresent()) {
            Optional<T> preferred = safeEntries.stream()
                    .filter(Objects::nonNull)
                    .filter(usable)
                    .filter(entry -> preferredProvider.get().equals(providerResolver.apply(entry)))
                    .findFirst();
            if (preferred.isPresent()) {
                return new SourceSelection<>(preferred.get(), providerResolver.apply(preferred.get()), null);
            }
        }

        return safeEntries.stream()
                .filter(Objects::nonNull)
                .filter(usable)
                .max(Comparator
                        .comparingInt(confidence)
                        .thenComparingInt(entry -> providerPriority(providerResolver.apply(entry))))
                .map(entry -> new SourceSelection<>(entry, providerResolver.apply(entry), null))
                .orElse(new SourceSelection<>(null, null, null));
    }

    private boolean isManualSource(String source) {
        if (source == null || source.isBlank()) return false;
        return "MANUAL".equals(source.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
    }

    private Optional<ImportProvider> parseWellnessSource(String source) {
        if (source == null || source.isBlank()) return Optional.empty();
        String normalized = source.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        if ("AUTO".equals(normalized) || "MANUAL".equals(normalized)) return Optional.empty();
        if ("APPLE".equals(normalized)) normalized = "APPLE_HEALTH";
        if ("GOOGLE".equals(normalized)) normalized = "GOOGLE_HEALTH";
        try {
            return Optional.of(ImportProvider.valueOf(normalized));
        } catch (IllegalArgumentException ignored) {
            return Optional.empty();
        }
    }

    private int providerPriority(ImportProvider provider) {
        if (provider == ImportProvider.GARMIN) return 5;
        if (provider == ImportProvider.OURA) return 5;
        if (provider == ImportProvider.APPLE_HEALTH) return 4;
        if (provider == ImportProvider.GOOGLE_HEALTH) return 3;
        if (provider == ImportProvider.COROS) return 2;
        if (provider == ImportProvider.HUAWEI) return 1;
        return 0;
    }

    private int restingHrConfidence(Integer restingHr, Integer baselineRestingHr) {
        if (restingHr == null) return 0;
        if (baselineRestingHr != null) return Math.max(0, 100 - Math.abs(restingHr - baselineRestingHr));
        return Math.max(0, 100 - restingHr);
    }

    private String sourceName(SourceSelection<?> selection) {
        if (selection.sourceOverride() != null) return selection.sourceOverride();
        return selection.provider() == null ? "AUTO" : selection.provider().name();
    }

    public record ReadinessDay(LocalDate date, int score, boolean hasData) {
        public ReadinessDay(LocalDate date, int score) {
            this(date, score, true);
        }
    }

    public record ReadinessResult(
            int score,
            String verdict,
            int sleepScore,
            int hrvScore,
            int rhrScore,
            int stressScore
    ) {}

    public record MetricSources(String sleep, String hrv, String restingHeartRate, String stress) {}

    public record MultiSourceReadinessSnapshot(ReadinessResult readiness, MetricSources sources, boolean hasSourceData) {
        public MultiSourceReadinessSnapshot(ReadinessResult readiness, MetricSources sources) {
            this(readiness, sources, true);
        }
    }

    private record SourceSelection<T>(T value, ImportProvider provider, String sourceOverride) {}
}
