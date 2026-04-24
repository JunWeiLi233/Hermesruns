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

        Map<LocalDate, DailySleepData> sleepMap = sleepRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.toMap(DailySleepData::getDate, s -> s, (s1, s2) -> s1));
        Map<LocalDate, DailyHRVData> hrvMap = hrvRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.toMap(DailyHRVData::getDate, h -> h, (h1, h2) -> h1));
        Map<LocalDate, DailyStressData> stressMap = stressRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.toMap(DailyStressData::getDate, s -> s, (s1, s2) -> s1));
        Map<LocalDate, DailyWellnessSummary> wellnessMap = wellnessRepository.findByRunnerAndDateBetweenOrderByDateDesc(runner, start, end)
                .stream().collect(Collectors.toMap(DailyWellnessSummary::getDate, w -> w, (w1, w2) -> w1));

        List<ReadinessDay> trend = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate date = start.plusDays(i);
            trend.add(calculateDayReadiness(date, sleepMap.get(date), hrvMap.get(date), stressMap.get(date), wellnessMap.get(date)));
        }
        return trend;
    }

    public ReadinessDay getDailyReadiness(Runner runner, LocalDate date) {
        DailySleepData sleep = sleepRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.GARMIN, date).orElse(null);
        DailyHRVData hrv = hrvRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.GARMIN, date).orElse(null);
        DailyStressData stress = stressRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.GARMIN, date).orElse(null);
        DailyWellnessSummary wellness = wellnessRepository.findByRunnerAndProviderAndDate(runner, ImportProvider.GARMIN, date).orElse(null);
        
        return calculateDayReadiness(date, sleep, hrv, stress, wellness);
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

    public record ReadinessDay(LocalDate date, int score) {}

    public record ReadinessResult(
            int score,
            String verdict,
            int sleepScore,
            int hrvScore,
            int rhrScore,
            int stressScore
    ) {}
}
