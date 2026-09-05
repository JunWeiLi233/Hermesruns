package com.hermes.backend.strength;

import java.util.List;

public record MuscleProfileDto(
        String experienceLevel,
        String equipmentLevel,
        int sessionMinutes,
        String noisePreference,
        List<String> preferredStrengthDays
) {}
