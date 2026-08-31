package com.hermes.backend;

import java.time.LocalDate;
import java.util.List;

public record StrengthCoachDecisionDto(
        String algorithmVersion,
        String phase,
        int weekNumber,
        String confidence,
        List<String> missingSignals,
        LocalDate appliedDate,
        String requestedFocus,
        String requestedDose,
        String appliedFocus,
        String appliedDose,
        String safetyAction,
        List<String> reasonCodes
) {}
