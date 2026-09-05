package com.hermes.backend.strength;

public record TodayCheckInUpdate(
        String runType,
        String entryState,
        Double distanceKm,
        Integer durationMinutes,
        String strengthFocus,
        String strengthDose
) {}
