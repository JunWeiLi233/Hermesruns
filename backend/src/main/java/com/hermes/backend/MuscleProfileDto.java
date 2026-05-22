package com.hermes.backend;

import java.util.List;

public record MuscleProfileDto(
        String experienceLevel,
        String equipmentLevel,
        int sessionMinutes,
        String noisePreference,
        List<String> preferredStrengthDays
) {}
