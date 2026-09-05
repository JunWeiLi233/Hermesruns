package com.hermes.backend.races.model;

import java.time.LocalDateTime;

public record LinkedActivitySummary(
        Long id,
        String name,
        LocalDateTime startTime,
        String startDate,
        double distanceKm,
        int movingTimeSeconds
) {}
