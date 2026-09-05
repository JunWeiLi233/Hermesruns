package com.hermes.backend.strength;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

public record RunnerStrengthSignals(
        LocalDate today,
        LocalDate cycleStartDate,
        MuscleTrainingPreference.ExperienceLevel experienceLevel,
        MuscleTrainingPreference.EquipmentLevel equipmentLevel,
        MuscleTrainingPreference.NoisePreference noisePreference,
        int sessionMinutes,
        Set<DayOfWeek> preferredStrengthDays,
        List<RunDaySignal> schedule,
        double volumeKm7d,
        double volumeKm28d,
        int recentHardRuns7d,
        String recoveryGate,
        String sorenessLevel,
        String injuryRisk,
        boolean raceWeek,
        boolean conservativeData,
        boolean strengthSuppressed,
        boolean manualStrengthRequest,
        StrengthFocus requestedFocus,
        StrengthDose requestedDose,
        List<String> missingSignals
) {
    public enum StrengthFocus {
        COACH_PICK,
        LEG_DAY,
        POSTERIOR_CHAIN,
        CALVES_ANKLES,
        CORE_STABILITY,
        MOBILITY_RESET
    }

    public enum StrengthDose {
        MICRO,
        STANDARD,
        STRONG
    }

    public enum SafetyAction {
        NONE,
        RELOCATED,
        DOWNGRADED,
        RELOCATED_AND_DOWNGRADED,
        SUPPRESSED
    }

    public enum PlanPhase {
        FOUNDATION,
        BUILD,
        QUALITY,
        DELOAD
    }

    public enum Confidence {
        HIGH,
        MEDIUM,
        LOW
    }

    public record RunDaySignal(
            LocalDate date,
            String workoutType,
            boolean keyRun,
            boolean longRun,
            boolean raceDay
    ) {
    }
}
