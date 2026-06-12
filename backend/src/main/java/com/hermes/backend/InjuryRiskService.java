package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class InjuryRiskService {

    private static final Logger log = LoggerFactory.getLogger(InjuryRiskService.class);

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

        Double acwr = computeAcwr(runs);

        String sorenessLevel = sorenessLog.map(SorenessLog::getLevel).orElse(null);
        String combinedRisk = computeCombinedRisk(acwr, sorenessLevel);
        String coachVoice = generateCoachVoice(combinedRisk, acwr, sorenessLevel);

        return new InjuryRiskAssessment(
                acwr != null ? Math.round(acwr * 100.0) / 100.0 : null,
                sorenessLevel,
                combinedRisk,
                coachVoice
        );
    }

    private Double computeAcwr(List<Activity> runs) {
        if (runs.isEmpty()) return null;
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(35);

        Map<LocalDate, Double> dailyLoads = new HashMap<>();
        for (Activity run : runs) {
            LocalDate d = resolveLocalDate(run);
            if (d != null && !d.isBefore(start) && !d.isAfter(today)) {
                dailyLoads.put(d, dailyLoads.getOrDefault(d, 0.0) + estimateLoad(run));
            }
        }

        Double lastAcwr = null;
        double ewmaA = 0, ewmaC = 0;
        double lambdaA = 2.0 / 8.0;
        double lambdaC = 2.0 / 29.0;

        for (LocalDate day = start; !day.isAfter(today); day = day.plusDays(1)) {
            double load = dailyLoads.getOrDefault(day, 0.0);
            if (day.equals(start)) {
                ewmaA = load;
                ewmaC = load;
            } else {
                ewmaA = load * lambdaA + (1 - lambdaA) * ewmaA;
                ewmaC = load * lambdaC + (1 - lambdaC) * ewmaC;
            }
            if (ewmaC > 0.5) {
                lastAcwr = ewmaA / ewmaC;
            }
        }
        return lastAcwr;
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
        int movingSec = activity.getMovingTimeSeconds();
        if (movingSec <= 0 && activity.getDurationSeconds() != null) {
            movingSec = activity.getDurationSeconds().intValue();
        }
        if (km <= 0 || movingSec <= 0) return 0;
        double paceSecPerKm = movingSec / km;
        double velocity = (1000.0 / paceSecPerKm) * 60.0;
        double vo2 = -4.60 + (0.182258 * velocity) + (0.000104 * velocity * velocity);
        double vo2Fraction = Math.max(0.42, Math.min(1.2, vo2 / 50.0));
        double intensityRatio = vo2Fraction / 0.85;
        return (movingSec / 3600.0) * intensityRatio * intensityRatio * 100.0;
    }

    private String computeCombinedRisk(Double acwr, String sorenessLevel) {
        int score = 0;

        if (acwr != null) {
            if (acwr >= 1.5) score += 3;
            else if (acwr >= 1.3) score += 2;
            else if (acwr >= 1.18) score += 1;
        }

        if ("HIGH".equalsIgnoreCase(sorenessLevel)) score += 3;
        else if ("MEDIUM".equalsIgnoreCase(sorenessLevel)) score += 2;
        else if ("LOW".equalsIgnoreCase(sorenessLevel)) score += 1;

        if (score >= 5) return "HIGH";
        if (score >= 3) return "MODERATE";
        return "LOW";
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

    public record InjuryRiskAssessment(Double acwr, String sorenessLevel, String risk, String coachVoice) {}
}
