package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class InjuryRiskService {

    private static final Logger log = LoggerFactory.getLogger(InjuryRiskService.class);
    // Loads are gathered 42 days back so the EWMA ACWR can also be evaluated
    // 7 days ago for the trend comparison.
    private static final int ACWR_TREND_LOOKBACK_DAYS = 42;
    private static final double ACWR_TREND_DELTA = 0.10;

    private final SorenessLogRepository sorenessLogRepository;
    private final ActivityRepository activityRepository;

    public InjuryRiskService(SorenessLogRepository sorenessLogRepository,
                             ActivityRepository activityRepository) {
        this.sorenessLogRepository = sorenessLogRepository;
        this.activityRepository = activityRepository;
    }

    public SorenessLog logSoreness(Runner runner, String level, String notes) {
        LocalDate today = LocalDate.now();

        Optional<SorenessLog> existing = sorenessLogRepository.findByRunnerAndDate(runner, today);
        SorenessLog logEntry;
        if (existing.isPresent()) {
            logEntry = existing.get();
            logEntry.setLevel(level);
            logEntry.setNotes(notes);
        } else {
            logEntry = new SorenessLog(runner, today, level, notes);
        }
        return sorenessLogRepository.save(logEntry);
    }

    public InjuryRiskAssessment getRiskAssessment(Runner runner) {
        LocalDate today = LocalDate.now();

        Optional<SorenessLog> sorenessLog = sorenessLogRepository.findByRunnerAndDate(runner, today);

        List<Activity> runs = activityRepository.findByRunnerAndActivityTypeOrderByIdDesc(runner, ActivityType.RUN);

        Map<LocalDate, Double> dailyLoads = buildDailyLoads(runs, today);
        Double acwr = TrainingLoadAnalyzer.ewmaAcwrFromDailyLoads(dailyLoads, today);
        String acwrTrend = resolveAcwrTrend(dailyLoads, today, acwr);

        String sorenessLevel = sorenessLog.map(SorenessLog::getLevel).orElse(null);
        int riskPoints = computeRiskPoints(acwr, sorenessLevel);
        String combinedRisk = riskForPoints(riskPoints);
        String coachVoice = generateCoachVoice(combinedRisk, acwr, sorenessLevel);
        List<SorenessLogSummary> recentLogs = sorenessLogRepository.findByRunnerOrderByDateDesc(runner).stream()
                .limit(7)
                .map(log -> new SorenessLogSummary(log.getLevel(), log.getDate()))
                .toList();

        return new InjuryRiskAssessment(
                acwr != null ? Math.round(acwr * 100.0) / 100.0 : null,
                sorenessLevel,
                combinedRisk,
                coachVoice,
                Math.round((riskPoints / 6.0f) * 100),
                recommendationForRisk(combinedRisk),
                acwrTrend,
                recentLogs,
                coachVoice
        );
    }

    private Map<LocalDate, Double> buildDailyLoads(List<Activity> runs, LocalDate today) {
        Map<LocalDate, Double> dailyLoads = new HashMap<>();
        if (runs == null || runs.isEmpty()) return dailyLoads;
        LocalDate start = today.minusDays(ACWR_TREND_LOOKBACK_DAYS);
        for (Activity run : runs) {
            LocalDate d = resolveLocalDate(run);
            if (d != null && !d.isBefore(start) && !d.isAfter(today)) {
                dailyLoads.put(d, dailyLoads.getOrDefault(d, 0.0) + estimateLoad(run));
            }
        }
        return dailyLoads;
    }

    private String resolveAcwrTrend(Map<LocalDate, Double> dailyLoads, LocalDate today, Double acwrToday) {
        if (acwrToday == null || dailyLoads.isEmpty()) return "flat";
        Double acwrWeekAgo = TrainingLoadAnalyzer.ewmaAcwrFromDailyLoads(dailyLoads, today.minusDays(7));
        if (acwrWeekAgo == null) return "flat";
        double delta = acwrToday - acwrWeekAgo;
        if (delta > ACWR_TREND_DELTA) return "rising";
        if (delta < -ACWR_TREND_DELTA) return "falling";
        return "flat";
    }

    private LocalDate resolveLocalDate(Activity activity) {
        if (activity.getStartTime() != null) return activity.getStartTime().toLocalDate();
        if (activity.getCreatedAt() != null) return activity.getCreatedAt().toLocalDate();
        return null;
    }

    private double distanceKm(Activity activity) {
        if (activity.getDistanceKm() > 0) return activity.getDistanceKm();
        if (activity.getDistanceMeters() != null && activity.getDistanceMeters() > 0) return activity.getDistanceMeters() / 1000.0;
        return 0;
    }

    private double estimateLoad(Activity activity) {
        double km = distanceKm(activity);
        long seconds = 0;
        if (activity.getMovingTimeSeconds() > 0) {
            seconds = activity.getMovingTimeSeconds();
        } else if (activity.getDurationSeconds() != null) {
            seconds = activity.getDurationSeconds().intValue();
        }
        return TrainingLoadAnalyzer.loadUnits(km, seconds);
    }

    private int computeRiskPoints(Double acwr, String sorenessLevel) {
        int score = 0;

        if (acwr != null) {
            if (acwr >= 1.5) score += 3;
            else if (acwr >= 1.3) score += 2;
            else if (acwr >= 1.18) score += 1;
        }

        if ("HIGH".equalsIgnoreCase(sorenessLevel)) score += 3;
        else if ("MEDIUM".equalsIgnoreCase(sorenessLevel)) score += 2;
        else if ("LOW".equalsIgnoreCase(sorenessLevel)) score += 1;

        return score;
    }

    private String riskForPoints(int score) {
        if (score >= 5) return "HIGH";
        if (score >= 3) return "MODERATE";
        return "LOW";
    }

    private String recommendationForRisk(String risk) {
        if ("HIGH".equals(risk)) return "rest";
        if ("MODERATE".equals(risk)) return "caution";
        return "ready";
    }

    private String generateCoachVoice(String risk, Double acwr, String sorenessLevel) {
        if ("HIGH".equals(risk)) {
            if (acwr != null && acwr >= 1.5) {
                return "Your training load has spiked significantly and you're reporting high soreness. Take today completely off from running — rest, bike, swim, or lift instead. Protect your training continuity.";
            }
            return "You're reporting high soreness. Reduce volume and intensity today. Choose recovery, low-impact work, or a short easy run.";
        }
        if ("MODERATE".equals(risk)) {
            return "Your body is signaling some strain. Shift today toward recovery, lower impact aerobic work, or a shorter easy run. Listen to how you feel during warmup.";
        }
        return "Your risk signals look manageable. Keep training but stay mindful of recovery and movement quality.";
    }

    public record SorenessLogSummary(String level, LocalDate date) {}

    public record InjuryRiskAssessment(
            Double acwr,
            String sorenessLevel,
            String risk,
            String coachVoice,
            int combinedRiskScore,
            String recommendation,
            String acwrTrend,
            List<SorenessLogSummary> recentLogs,
            String coachAdvice
    ) {}
}
