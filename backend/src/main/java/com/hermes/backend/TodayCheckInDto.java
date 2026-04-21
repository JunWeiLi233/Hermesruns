package com.hermes.backend;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TodayCheckInDto(
        LocalDate trainingDate,
        String runType,
        String entryState,
        Double distanceKm,
        Integer durationMinutes,
        LocalDateTime updatedAt
) {}
