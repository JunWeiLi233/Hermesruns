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
}
