package com.hermes.backend;

public record RunPlanDto(
        String workoutType,
        Double plannedDistanceKm,
        Integer plannedDurationMinutes,
        boolean keyRun,
        boolean longRun,
        boolean readinessAdjusted,
        String notes,
        String planSource
) {}
