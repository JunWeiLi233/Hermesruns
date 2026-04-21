package com.hermes.backend;

import java.util.List;

public record MusclePlanDto(
        MuscleWeekContextDto weekContext,
        List<MuscleDayPlanDto> days,
        List<SessionDefinitionDto> sessions,
        List<String> rationale,
        TodayCheckInDto todayCheckIn,
        String planSource
) {}
