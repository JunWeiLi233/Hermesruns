package com.hermes.backend.strength;

import java.time.LocalDate;
import java.util.List;

public record PersonalizedStrengthPlan(
        String algorithmVersion,
        RunnerStrengthSignals.PlanPhase phase,
        int weekNumber,
        RunnerStrengthSignals.Confidence confidence,
        List<String> missingSignals,
        SafetyAdjustment safetyAdjustment,
        List<PlannedDay> days
) {
    public record SafetyAdjustment(
            RunnerStrengthSignals.StrengthFocus requestedFocus,
            RunnerStrengthSignals.StrengthDose requestedDose,
            RunnerStrengthSignals.StrengthFocus appliedFocus,
            RunnerStrengthSignals.StrengthDose appliedDose,
            RunnerStrengthSignals.SafetyAction action,
            List<String> reasonCodes
    ) {
    }

    public record PlannedDay(
            LocalDate date,
            PlannedSession strength,
            String noStrengthReasonCode
    ) {
    }

    public record PlannedSession(
            String sessionType,
            RunnerStrengthSignals.StrengthFocus requestedFocus,
            RunnerStrengthSignals.StrengthDose requestedDose,
            RunnerStrengthSignals.StrengthFocus appliedFocus,
            RunnerStrengthSignals.StrengthDose appliedDose,
            RunnerStrengthSignals.SafetyAction safetyAction,
            List<String> reasonCodes
    ) {
    }
}
