package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.activity.RunMetricsProjection;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Multi-source readiness scoring.
 *
 * Model (research-anchored):
 * - Five components, each 0-100: sleep, HRV, resting HR, stress, and a
 *   training-load readiness proxy computed from run history (available even
 *   when no wearable/wellness data exists).
 * - Components are aggregated with fixed weights (sleep .28, HRV .24, RHR .14,
 *   stress .14, load .20) over the components that actually have data, then
 *   shrunk toward the neutral score (75) in proportion to the missing
 *   evidence weight: score = weightedMean * conf + 75 * (1 - conf). Partial
 *   data therefore moves the score proportionally instead of freezing it at
 *   neutral, and thin evidence can neither prove GO nor force REST.
 * - HRV is interpreted against the runner's own rolling baseline when one
 *   exists (>=5 days in 28): a change smaller than the smallest worthwhile
 *   change (0.5 x baseline SD, per Plews/Buchheit) is neutral. Absolute ms
 *   bands are only the fallback.
 * - The load proxy maps the EWMA ACWR onto the 0.8-1.3 "sweet spot"
 *   (Gabbett 2016), penalises Foster weekly monotony above 2.0, and penalises
 *   quality sessions spaced closer than 24/48h.
 */
@Service
public class ReadinessService {
    private static final double WEIGHT_SLEEP = 0.28;
    private static final double WEIGHT_HRV = 0.24;
    private static final double WEIGHT_RHR = 0.14;
    private static final double WEIGHT_STRESS = 0.14;
    private static final double WEIGHT_LOAD = 0.20;

    private static final int NEUTRAL_SCORE = 75;
    private static final int HRV_BASELINE_MIN_DAYS = 5;
    private static final int HRV_BASELINE_WINDOW_DAYS = 28;
    private static final int LOAD_WINDOW_DAYS = 42;

    // Load proxy tiers: base for an active runner with manageable load, then
    // ACWR / monotony / hard-session-recency adjustments.
    private static final int LOAD_BASE = 78;
    private static final int LOAD_SWEET_SPOT_BONUS = 7;
    private static final int LOAD_HIGH_PENALTY = 8;
    private static final int LOAD_SPIKE_PENALTY = 25;
    private static final int LOAD_EXTREME_SPIKE_PENALTY = 33;
    private static final double MONOTONY_WARN = 2.0;
    private static final double MONOTONY_HIGH = 2.5;

    private final DailySleepDataRepository sleepRepository;
    private final DailyHRVDataRepository hrvRepository;
    private final DailyStressDataRepository stressRepository;
    private final DailyWellnessSummaryRepository wellnessRepository;
    private final ActivityRepository activityRepository;

    public ReadinessService(DailySleepDataRepository sleepRepository,
                            DailyHRVDataRepository hrvRepository,
                            DailyStressDataRepository stressRepository,
                            DailyWellnessSummaryRepository wellnessRepository,
                            ActivityRepository activityRepository) {
        this.sleepRepository = sleepRepository;
        this.hrvRepository = hrvRepository;
        this.stressRepository = stressRepository;
        this.wellnessRepository = wellnessRepository;
        this.activityRepository = activityRepository;
    }

    public List<ReadinessDay> getReadinessTrend(Runner runner, int days) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days - 1);

        Map<LocalDate, List<DailySleepData>> sleepMap = sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.groupingBy(DailySleepData::getDate));
        Map<LocalDate, List<DailyHRVData>> hrvMap = hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start.minusDays(HRV_BASELINE_WINDOW_DAYS * 2L), end)
                .stream().collect(Collectors.groupingBy(DailyHRVData::getDate));
        Map<LocalDate, List<DailyStressData>> stressMap = stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.groupingBy(DailyStressData::getDate));
        Map<LocalDate, List<DailyWellnessSummary>> wellnessMap = wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.groupingBy(DailyWellnessSummary::getDate));

        Map<LocalDate, List<RunMetricsProjection>> runsByDay = runsByDay(runner, start.minusDays(LOAD_WINDOW_DAYS), end);

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
            Integer hrvMsToday = hrv.value() == null || hrv.value().getLastNightAvg() == null
                    ? null
                    : Integer.valueOf((int) Math.round(hrv.value().getLastNightAvg()));
            double[] hrvBaseline = hrvBaselineFor(hrvMap, date);
            Integer loadScore = computeLoadScore(trailingRuns(runsByDay, date), runner, date);

            ReadinessResult readiness = computeReadiness(
                    sleep.value() == null ? null : sleep.value().getSleepScore(),
                    hrv.value() == null ? null : hrv.value().getStatus(),
                    hrvMsToday,
                    hrvBaseline,
                    runner == null ? null : runner.getRestingHeartRateBpm(),
                    wellness.value() == null ? null : wellness.value().getRestingHeartRate(),
                    stress.value() == null ? null : stress.value().getOverallStressLevel(),
                    loadScore
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
        if (state == null) {
            return neutralResult();
        }
        LocalDate today = LocalDate.now();
        Integer loadScore = computeLoadScore(runsForRunner(state.getRunner(), today), state.getRunner(), today);
        double[] hrvBaseline = state.getRunner() == null
                ? null
                : hrvBaselineFor(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(
                        state.getRunner(),
                        today.minusDays(HRV_BASELINE_WINDOW_DAYS),
                        today.minusDays(1)
                ).stream().collect(Collectors.groupingBy(DailyHRVData::getDate)), today);
        return computeReadiness(
                state.getLastSleepScore(),
                state.getLastHrvStatus(),
                state.getLastHrvMs(),
                hrvBaseline,
                state.getBaselineRestingHr(),
                state.getLastNightRestingHr(),
                state.getLastStressScore(),
                loadScore
        );
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

        double[] hrvBaseline = hrvMs == null && (hrvStatus == null || hrvStatus.isBlank())
                ? null
                : hrvBaselineFor(hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(
                        runner,
                        targetDate.minusDays(HRV_BASELINE_WINDOW_DAYS),
                        targetDate.minusDays(1)
                ).stream().collect(Collectors.groupingBy(DailyHRVData::getDate)), targetDate);

        Integer loadScore = computeLoadScore(runsForRunner(runner, targetDate), runner, targetDate);

        ReadinessResult readiness = computeReadiness(
                sleepScore,
                hrvStatus,
                hrvMs,
                hrvBaseline,
                fallback.getBaselineRestingHr(),
                restingHr,
                stressScore,
                loadScore
        );
        return new MultiSourceReadinessSnapshot(
                readiness,
                new MetricSources(sourceName(sleep), sourceName(hrv), sourceName(wellness), sourceName(stress)),
                hasSelectedDailyData(sleep, hrv, stress, wellness) || hasFallbackDailyReadinessData(fallback),
                new MetricAvailability(
                        sleep.value() != null,
                        hrv.value() != null,
                        wellness.value() != null,
                        stress.value() != null,
                        loadScore != null
                )
        );
    }

    /**
     * Weighted aggregation with shrinkage toward neutral for missing evidence.
     */
    private ReadinessResult aggregate(
            int sleep, boolean sleepAvailable,
            int hrv, boolean hrvAvailable,
            int rhr, boolean rhrAvailable,
            int stress, boolean stressAvailable,
            Integer loadScore
    ) {
        double weightedSum = 0;
        double availableWeight = 0;
        if (sleepAvailable) {
            weightedSum += WEIGHT_SLEEP * sleep;
            availableWeight += WEIGHT_SLEEP;
        }
        if (hrvAvailable) {
            weightedSum += WEIGHT_HRV * hrv;
            availableWeight += WEIGHT_HRV;
        }
        if (rhrAvailable) {
            weightedSum += WEIGHT_RHR * rhr;
            availableWeight += WEIGHT_RHR;
        }
        if (stressAvailable) {
            weightedSum += WEIGHT_STRESS * stress;
            availableWeight += WEIGHT_STRESS;
        }
        if (loadScore != null) {
            weightedSum += WEIGHT_LOAD * loadScore;
            availableWeight += WEIGHT_LOAD;
        }

        int score;
        int confidence;
        if (availableWeight <= 0) {
            score = NEUTRAL_SCORE;
            confidence = 0;
        } else {
            double weightedMean = weightedSum / availableWeight;
            confidence = (int) Math.round(availableWeight * 100);
            score = (int) Math.round(weightedMean * availableWeight + NEUTRAL_SCORE * (1 - availableWeight));
        }

        return new ReadinessResult(
                score,
                verdictFor(score),
                sleep,
                hrv,
                rhr,
                stress,
                loadScore == null ? NEUTRAL_SCORE : loadScore,
                confidence
        );
    }

    private String verdictFor(int score) {
        if (score >= 85) return "GO";
        if (score >= 70) return "EASY";
        if (score >= 50) return "RECOVERY";
        return "REST";
    }

    private ReadinessResult neutralResult() {
        return new ReadinessResult(NEUTRAL_SCORE, "EASY", NEUTRAL_SCORE, NEUTRAL_SCORE, NEUTRAL_SCORE, NEUTRAL_SCORE, NEUTRAL_SCORE, 0);
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
            double[] hrvBaseline,
            Integer baselineRestingHr,
            Integer restingHr,
            Integer stressScore,
            Integer loadScore
    ) {
        int sleep = normalizeSleepComponent(sleepScore);
        int hrv = normalizeHrvComponent(hrvStatus, hrvMs, hrvBaseline);
        int rhr = normalizeRhrComponent(baselineRestingHr, restingHr);
        int stress = normalizeStressComponent(stressScore);

        return aggregate(
                sleep, sleepScore != null,
                hrv, hrvMs != null || (hrvStatus != null && !hrvStatus.isBlank()),
                rhr, restingHr != null,
                stress, stressScore != null,
                loadScore
        );
    }

    private int normalizeSleepComponent(Integer sleepScore) {
        if (sleepScore == null) return NEUTRAL_SCORE;
        return clamp(sleepScore);
    }

    private int normalizeHrvComponent(String hrvStatus, Integer hrvMs, double[] hrvBaseline) {
        if (hrvStatus != null && !hrvStatus.isBlank()) {
            String normalized = hrvStatus.trim().toUpperCase();
            if ("BALANCED".equals(normalized)) return 85;
            if ("LOW".equals(normalized) || "POOR".equals(normalized) || "UNBALANCED".equals(normalized)) return 45;
        }
        if (hrvMs == null) return NEUTRAL_SCORE;
        // Baseline-relative interpretation (Plews/Buchheit): today's value
        // against the runner's own 28-day mean, with the smallest worthwhile
        // change at half the baseline SD.
        if (hrvBaseline != null) {
            double mean = hrvBaseline[0];
            double halfSwc = hrvBaseline[1] / 2.0;
            if (halfSwc > 0.5) {
                double delta = hrvMs - mean;
                if (delta <= -2 * halfSwc) return 45;
                if (delta <= -halfSwc) return 60;
                if (delta < halfSwc) return NEUTRAL_SCORE;
                return 85;
            }
        }
        if (hrvMs >= 80) return 85;
        if (hrvMs >= 55) return NEUTRAL_SCORE;
        if (hrvMs >= 35) return 60;
        return 45;
    }

    private int normalizeRhrComponent(Integer baselineRestingHr, Integer lastNightRestingHr) {
        if (lastNightRestingHr == null) return NEUTRAL_SCORE;
        if (baselineRestingHr == null) {
            if (lastNightRestingHr <= 50) return 82;
            if (lastNightRestingHr <= 60) return NEUTRAL_SCORE;
            return 60;
        }

        int delta = lastNightRestingHr - baselineRestingHr;
        if (delta <= -3) return 85;
        if (delta <= 2) return 78;
        if (delta <= 6) return 62;
        return 45;
    }

    private int normalizeStressComponent(Integer stressScore) {
        if (stressScore == null) return NEUTRAL_SCORE;
        return clamp(100 - stressScore);
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }

    /**
     * Training-load readiness proxy from run history. Returns null when the
     * runner has no recent runs (component unavailable). Otherwise maps the
     * EWMA ACWR sweet spot, Foster monotony, and hard-session spacing onto a
     * 30-90 component score.
     */
    private Integer computeLoadScore(List<RunMetricsProjection> runs, Runner runner, LocalDate date) {
        if (runs == null || runs.isEmpty()) return null;
        Integer runnerMaxHr = runner == null ? null : runner.getMaxHeartRateBpm();

        Double acwr = TrainingLoadAnalyzer.ewmaAcwr(runs, date);
        Double monotony = TrainingLoadAnalyzer.weeklyMonotony(runs, date);
        Integer hoursSinceHard = TrainingLoadAnalyzer.hoursSinceLastHardSession(runs, runnerMaxHr, date);
        if (acwr == null && monotony == null && hoursSinceHard == null) return null;

        int score = LOAD_BASE;
        if (acwr != null) {
            if (acwr >= 0.8 && acwr <= 1.3) {
                score += LOAD_SWEET_SPOT_BONUS;
            } else if (acwr > 1.5) {
                score -= acwr > 1.65 ? LOAD_EXTREME_SPIKE_PENALTY : LOAD_SPIKE_PENALTY;
            } else if (acwr > 1.3) {
                score -= LOAD_HIGH_PENALTY;
            }
            // acwr < 0.8: fresh or undertrained - not a readiness problem.
        }
        if (monotony != null) {
            if (monotony > MONOTONY_HIGH) score -= 15;
            else if (monotony > MONOTONY_WARN) score -= 8;
        }
        if (hoursSinceHard != null) {
            if (hoursSinceHard < 24) score -= 10;
            else if (hoursSinceHard < 48) score -= 5;
        }
        return Math.max(30, Math.min(90, score));
    }

    private List<RunMetricsProjection> runsForRunner(Runner runner, LocalDate date) {
        if (runner == null) return List.of();
        List<RunMetricsProjection> runs = activityRepository.findRunMetricsBetween(
                runner,
                ActivityType.RUN,
                date.minusDays(LOAD_WINDOW_DAYS).atStartOfDay(),
                date.plusDays(1).atStartOfDay()
        );
        return runs == null ? List.of() : runs;
    }

    private Map<LocalDate, List<RunMetricsProjection>> runsByDay(Runner runner, LocalDate start, LocalDate end) {
        if (runner == null) return Map.of();
        List<RunMetricsProjection> runs = activityRepository.findRunMetricsBetween(
                runner,
                ActivityType.RUN,
                start.atStartOfDay(),
                end.plusDays(1).atStartOfDay()
        );
        if (runs == null || runs.isEmpty()) return Map.of();
        return runs.stream()
                .filter(run -> run.getEffectiveStartTime() != null)
                .collect(Collectors.groupingBy(run -> run.getEffectiveStartTime().toLocalDate()));
    }

    private List<RunMetricsProjection> trailingRuns(Map<LocalDate, List<RunMetricsProjection>> runsByDay, LocalDate date) {
        if (runsByDay == null || runsByDay.isEmpty()) return List.of();
        List<RunMetricsProjection> trailing = new ArrayList<>();
        for (LocalDate day = date.minusDays(LOAD_WINDOW_DAYS); !day.isAfter(date); day = day.plusDays(1)) {
            trailing.addAll(runsByDay.getOrDefault(day, List.of()));
        }
        return trailing;
    }

    /**
     * Runner-specific HRV baseline (mean, SD) from the 28 days before
     * {@code date}, or null when fewer than 5 distinct days have values.
     */
    private double[] hrvBaselineFor(Map<LocalDate, List<DailyHRVData>> hrvByDate, LocalDate date) {
        if (hrvByDate == null || hrvByDate.isEmpty()) return null;
        List<Double> values = new ArrayList<>();
        LocalDate from = date.minusDays(HRV_BASELINE_WINDOW_DAYS);
        LocalDate to = date.minusDays(1);
        for (Map.Entry<LocalDate, List<DailyHRVData>> entry : hrvByDate.entrySet()) {
            LocalDate entryDate = entry.getKey();
            if (entryDate.isBefore(from) || entryDate.isAfter(to)) continue;
            List<Double> dayValues = entry.getValue() == null ? null : entry.getValue().stream()
                    .map(DailyHRVData::getLastNightAvg)
                    .filter(Objects::nonNull)
                    .toList();
            if (dayValues == null || dayValues.isEmpty()) continue;
            values.add(dayValues.stream().mapToDouble(Double::doubleValue).average().orElse(Double.NaN));
        }
        if (values.size() < HRV_BASELINE_MIN_DAYS) return null;
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double variance = values.stream().mapToDouble(v -> (v - mean) * (v - mean)).sum() / values.size();
        return new double[]{mean, Math.sqrt(variance)};
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
        return selection.sourceOverride() != null ? selection.sourceOverride()
                : selection.provider() == null ? "AUTO" : selection.provider().name();
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
            int stressScore,
            int loadScore,
            int confidence
    ) {}

    public record MetricSources(String sleep, String hrv, String restingHeartRate, String stress) {}

    public record MetricAvailability(boolean sleep, boolean hrv, boolean restingHeartRate, boolean stress, boolean trainingLoad) {
        public boolean any() {
            return sleep || hrv || restingHeartRate || stress || trainingLoad;
        }

        public static MetricAvailability all() {
            return new MetricAvailability(true, true, true, true, true);
        }

        public static MetricAvailability none() {
            return new MetricAvailability(false, false, false, false, false);
        }
    }

    public record MultiSourceReadinessSnapshot(
            ReadinessResult readiness,
            MetricSources sources,
            boolean hasSourceData,
            MetricAvailability availability
    ) {
        public MultiSourceReadinessSnapshot(ReadinessResult readiness, MetricSources sources) {
            this(readiness, sources, true, MetricAvailability.all());
        }

        public MultiSourceReadinessSnapshot(ReadinessResult readiness, MetricSources sources, boolean hasSourceData) {
            this(readiness, sources, hasSourceData, hasSourceData ? MetricAvailability.all() : MetricAvailability.none());
        }
    }

    private record SourceSelection<T>(T value, ImportProvider provider, String sourceOverride) {}
}
