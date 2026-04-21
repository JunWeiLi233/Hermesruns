package com.hermes.backend;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class MuscleTrainingMetricsService {

    public MuscleWeekContextDto buildWeekContext(PlanMetrics m) {
        return new MuscleWeekContextDto(
                m.volumeKm7d(),
                m.volumeKm28d(),
                m.acwr(),
                m.highIntensityRatioLast7d(),
                m.loadStatus(),
                m.recoveryGate(),
                m.recommendedSessionsPerWeek(),
                m.currentFocus(),
                m.conservativeMode(),
                m.raceWeek(),
                m.nextKeyRunDate(),
                m.nextKeyRunType(),
                m.nextLongRunDate(),
                m.nextLongRunKm(),
                m.recentHardRunCount7d()
        );
    }

    public PlanMetrics buildMetrics(
            List<Activity> runs,
            AutomatedCoachService.CoachStateDto coachState,
            MuscleTrainingPreference preference
    ) {
        double vol7 = runsWithinDays(runs, 7).stream().mapToDouble(this::distanceKm).sum();
        double vol28 = runsWithinDays(runs, 28).stream().mapToDouble(this::distanceKm).sum();

        Double acwr = computeAcwr(runs);
        int hardCount = countRecentHardRuns(runs, coachState);

        String recoveryGate = "OPEN";
        if (acwr != null && acwr > 1.45) recoveryGate = "PROTECT_ACWR_SPIKE";
        else if (hardCount >= 3) recoveryGate = "PROTECT_RECOVERY_PHASE";

        String loadStatus = "OPTIMAL";
        if (acwr != null) {
            if (acwr > 1.5) loadStatus = "DANGER";
            else if (acwr > 1.25) loadStatus = "HIGH";
            else if (acwr < 0.75) loadStatus = "LOW";
        }

        boolean raceWeek = false;
        LocalDate nextKeyRunDate = null;
        String nextKeyRunType = null;
        LocalDate nextLongRunDate = null;
        Double nextLongRunKm = null;

        if (coachState.activeBlock() != null) {
            LocalDate raceDate = coachState.activeBlock().targetRaceDate();
            if (raceDate != null) {
                long daysToRace = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), raceDate);
                if (daysToRace >= 0 && daysToRace <= 7) raceWeek = true;
            }
        }

        int recSessions = preference.getPreferredStrengthDays().size();
        if (recSessions == 0) recSessions = 2;

        return new PlanMetrics(
                round1(vol7),
                round1(vol28),
                acwr != null ? round2(acwr) : null,
                coachState.highIntensityRatioLast7d(),
                recoveryGate,
                loadStatus,
                acwr != null && acwr > 1.3,
                raceWeek,
                recSessions,
                preference.getExperienceLevel().name(),
                nextKeyRunDate,
                nextKeyRunType,
                nextLongRunDate,
                nextLongRunKm,
                hardCount
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
            lastAcwr = ewmaC > 0.5 ? ewmaA / ewmaC : null;
        }
        return lastAcwr;
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

    private int countRecentHardRuns(List<Activity> runs, AutomatedCoachService.CoachStateDto coachState) {
        double hrMax = coachState.profileMaxHeartRateBpm() != null && coachState.profileMaxHeartRateBpm() >= 130
                ? CoachHrZoneClassifier.clampHrMax(coachState.profileMaxHeartRateBpm())
                : 185;

        LocalDate cutoff = LocalDate.now().minusDays(6);
        int hard = 0;
        for (Activity run : runs) {
            LocalDate date = resolveLocalDate(run);
            if (date == null || date.isBefore(cutoff)) continue;
            if (distanceKm(run) >= 16) {
                hard++;
                continue;
            }
            CoachHrBand band = CoachHrZoneClassifier.classify(run.getAverageHeartRate(), hrMax);
            if (band == CoachHrBand.HIGH || band == CoachHrBand.GREY) hard++;
        }
        return hard;
    }

    private List<Activity> runsWithinDays(List<Activity> runs, int days) {
        LocalDate cutoff = LocalDate.now().minusDays(days - 1L);
        return runs.stream()
                .filter(run -> {
                    LocalDate date = resolveLocalDate(run);
                    return date != null && !date.isBefore(cutoff);
                })
                .toList();
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

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    public record PlanMetrics(
            double volumeKm7d,
            double volumeKm28d,
            Double acwr,
            Double highIntensityRatioLast7d,
            String recoveryGate,
            String loadStatus,
            boolean conservativeMode,
            boolean raceWeek,
            int recommendedSessionsPerWeek,
            String currentFocus,
            LocalDate nextKeyRunDate,
            String nextKeyRunType,
            LocalDate nextLongRunDate,
            Double nextLongRunKm,
            int recentHardRunCount7d
    ) {}
}
