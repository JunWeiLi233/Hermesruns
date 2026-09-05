package com.hermes.backend.races.model;

import java.time.LocalDate;

public record RaceEventRequest(
        String name,
        String organization,
        String location,
        LocalDate eventDate,
        Double distanceKm,
        String registrationStatus,
        Integer goalTimeSeconds,
        String notes,
        Boolean nyrrNinePlusOneEligible,
        Long completedActivityId
) {}
