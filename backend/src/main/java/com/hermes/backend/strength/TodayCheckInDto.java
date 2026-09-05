package com.hermes.backend.strength;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TodayCheckInDto(
        LocalDate trainingDate,
        String runType,
        String entryState,
        Double distanceKm,
        Integer durationMinutes,
        String strengthFocus,
        String strengthDose,
        LocalDateTime updatedAt
) {}
