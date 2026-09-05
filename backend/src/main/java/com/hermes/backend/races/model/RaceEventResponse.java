package com.hermes.backend.races.model;

import java.time.LocalDate;

public record RaceEventResponse(
        Long id,
        String name,
        String organization,
        String location,
        LocalDate eventDate,
        Double distanceKm,
        String registrationStatus,
        Integer goalTimeSeconds,
        String notes,
        boolean nyrrNinePlusOneEligible,
        Long completedActivityId,
        boolean completed,
        long countdownDays,
        LinkedActivitySummary matchedActivity
) {}
