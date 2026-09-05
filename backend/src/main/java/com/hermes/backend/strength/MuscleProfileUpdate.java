package com.hermes.backend.strength;

import java.util.List;

public record MuscleProfileUpdate(
        String experienceLevel,
        String equipmentLevel,
        Integer sessionMinutes,
        String noisePreference,
        List<String> preferredStrengthDays
) {}
