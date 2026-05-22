package com.hermes.backend;

import java.time.LocalDate;

public record MuscleWeekContextDto(
        double volumeKm7d,
        double volumeKm28d,
        Double acwr,
        Double highIntensityRatioLast7d,
        String loadStatus,
        String recoveryGate,
        int recommendedSessionsPerWeek,
        String currentFocus,
        boolean conservativeMode,
        boolean raceWeek,
        LocalDate nextKeyRunDate,
        String nextKeyRunType,
        LocalDate nextLongRunDate,
        Double nextLongRunKm,
        int recentHardRunCount7d
) {}
