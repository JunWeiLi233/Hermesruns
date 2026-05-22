package com.hermes.backend;

public record TodayCheckInUpdate(
        String runType,
        String entryState,
        Double distanceKm,
        Integer durationMinutes
) {}
