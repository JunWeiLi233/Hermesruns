package com.hermes.backend.strength;

import java.util.List;

public record MusclePlanDto(
        MuscleWeekContextDto weekContext,
        List<MuscleDayPlanDto> days,
        List<SessionDefinitionDto> sessions,
        List<String> rationale,
        TodayCheckInDto todayCheckIn,
        String planSource,
        String recommendedMuscleArea,
        String recommendedMuscleReasonCode,
        StrengthCoachDecisionDto strengthCoachDecision
) {
    public MusclePlanDto(
            MuscleWeekContextDto weekContext,
            List<MuscleDayPlanDto> days,
            List<SessionDefinitionDto> sessions,
            List<String> rationale,
            TodayCheckInDto todayCheckIn,
            String planSource,
            String recommendedMuscleArea,
            String recommendedMuscleReasonCode
    ) {
        this(weekContext, days, sessions, rationale, todayCheckIn, planSource,
                recommendedMuscleArea, recommendedMuscleReasonCode, null);
    }
}
