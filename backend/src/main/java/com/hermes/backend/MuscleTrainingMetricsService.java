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
        return buildMetrics(runs, coachState, preference, List.of());
    }

    public PlanMetrics buildMetrics(
            List<Activity> runs,
            AutomatedCoachService.CoachStateDto coachState,
            MuscleTrainingPreference preference,
            List<AutomatedCoachService.CoachScheduledWorkoutDto> schedule
    ) {
        double vol7 = coachState != null ? coachState.volumeKm7d() : 0;
        double vol28 = coachState != null ? coachState.volumeKm28d() : 0;
        if (vol7 <= 0) {
            vol7 = runsWithinDays(runs, 7).stream().mapToDouble(this::distanceKm).sum();
        }
        if (vol28 <= 0) {
            vol28 = runsWithinDays(runs, 28).stream().mapToDouble(this::distanceKm).sum();
        }

        Double acwr = computeAcwr(runs);
        int hardCount = countRecentHardRuns(runs, coachState);

        String recoveryGate = deriveRecoveryGate(coachState);
        if ("OPEN".equals(recoveryGate)) {
            if (acwr != null && acwr > 1.45) recoveryGate = "PROTECT";
            else if (hardCount >= 3) recoveryGate = "PROTECT";
        }

        boolean conservativeMode = runsWithinDays(runs, 28).size() < 3 || vol7 < 8;

        boolean raceWeek = false;
        if (coachState != null && coachState.activeBlock() != null) {
            LocalDate raceDate = coachState.activeBlock().targetRaceDate();
            if (raceDate != null) {
                long daysToRace = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), raceDate);
                if (daysToRace >= 0 && daysToRace <= 7) raceWeek = true;
            }
        }

        String loadStatus = deriveLoadStatus(vol28, acwr, raceWeek, conservativeMode);
        int recSessions = deriveRecommendedSessions(vol7, vol28, acwr, recoveryGate, raceWeek, conservativeMode, preference);

        AutomatedCoachService.CoachScheduledWorkoutDto nextKeyRun = schedule.stream()
                .filter(day -> isKeyRun(day.workoutType()))
                .findFirst()
                .orElse(null);
        AutomatedCoachService.CoachScheduledWorkoutDto nextLongRun = schedule.stream()
                .filter(day -> isLongRun(day.workoutType()))
                .findFirst()
                .orElse(null);

        return new PlanMetrics(
                round1(vol7),
                round1(vol28),
                acwr != null ? round2(acwr) : null,
                coachState != null ? coachState.highIntensityRatioLast7d() : null,
                recoveryGate,
                loadStatus,
                conservativeMode,
                raceWeek,
                recSessions,
                deriveCurrentFocus(preference, loadStatus, recoveryGate),
                nextKeyRun != null ? nextKeyRun.scheduledDate() : null,
                nextKeyRun != null ? nextKeyRun.workoutType() : null,
                nextLongRun != null ? nextLongRun.scheduledDate() : null,
                nextLongRun != null ? nextLongRun.plannedDistanceKm() : null,
                hardCount
        );
    }

    private int deriveRecommendedSessions(
            double volume7d,
            double volume28d,
            Double acwr,
            String recoveryGate,
            boolean raceWeek,
            boolean conservativeMode,
            MuscleTrainingPreference preference
    ) {
        if ("PROTECT".equals(recoveryGate) && raceWeek) {
            return 0;
        }
        if (raceWeek || "PROTECT".equals(recoveryGate) || (acwr != null && acwr > 1.35)) {
            return 1;
        }
        if (conservativeMode || volume28d < 60 || volume7d < 15) {
            return 1;
        }

        int sessions = volume28d < 180 ? 2 : 3;
        if ("CAUTION".equals(recoveryGate) || (acwr != null && acwr > 1.18)) {
            sessions = Math.min(sessions, 2);
        }
        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            sessions = Math.min(sessions, 2);
        }
        if (preference.getSessionMinutes() < 25) {
            sessions = Math.min(sessions, 2);
        }
        return sessions;
    }

    private String deriveLoadStatus(double volume28d, Double acwr, boolean raceWeek, boolean conservativeMode) {
        if (raceWeek) {
            return "RACE_WEEK";
        }
        if (conservativeMode) {
            return "CONSERVATIVE";
        }
        if (acwr != null && acwr > 1.3) {
            return "SPIKING";
        }
        if (volume28d >= 200) {
            return "HIGH_VOLUME";
        }
        return "STEADY";
    }

    private String deriveRecoveryGate(AutomatedCoachService.CoachStateDto coachState) {
        if (coachState == null) {
            return "OPEN";
        }
        Integer baseline = coachState.baselineRestingHr();
        Integer lastNight = coachState.lastNightRestingHr();
        Integer sleepScore = coachState.lastSleepScore();

        if (baseline != null && lastNight != null && baseline > 0) {
            if (lastNight > baseline * 1.08) {
                return "PROTECT";
            }
            if (lastNight > baseline * 1.04) {
                return "CAUTION";
            }
        }
        if (sleepScore != null) {
            if (sleepScore < 45) {
                return "PROTECT";
            }
            if (sleepScore < 65) {
                return "CAUTION";
            }
        }
        return "OPEN";
    }

    private String deriveCurrentFocus(MuscleTrainingPreference preference, String loadStatus, String recoveryGate) {
        if ("PROTECT".equals(recoveryGate) || "RACE_WEEK".equals(loadStatus)) {
            return "RECOVERY_CAPACITY";
        }
        if (preference.getNoisePreference() == MuscleTrainingPreference.NoisePreference.QUIET_ONLY) {
            return "QUIET_POSTERIOR_CHAIN";
        }
        if ("HIGH_VOLUME".equals(loadStatus)) {
            return "ELASTIC_STIFFNESS";
        }
        return "POSTERIOR_CHAIN_STABILITY";
    }

    private boolean isKeyRun(String workoutType) {
        return Objects.equals(workoutType, MuscleTrainingCheckIn.RunType.QUALITY.name())
                || Objects.equals(workoutType, CoachWorkoutType.THRESHOLD.name())
                || Objects.equals(workoutType, CoachWorkoutType.TEMPO.name())
                || Objects.equals(workoutType, CoachWorkoutType.INTERVALS.name());
    }

    private boolean isLongRun(String workoutType) {
        return Objects.equals(workoutType, CoachWorkoutType.LONG_RUN.name());
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
        double hrMax = coachState != null && coachState.profileMaxHeartRateBpm() != null && coachState.profileMaxHeartRateBpm() >= 130
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
