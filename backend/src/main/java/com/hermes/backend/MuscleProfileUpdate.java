package com.hermes.backend;

import java.util.List;

public record MuscleProfileUpdate(
        String experienceLevel,
        String equipmentLevel,
        Integer sessionMinutes,
        String noisePreference,
        List<String> preferredStrengthDays
) {}
