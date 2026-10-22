package com.hermes.backend.coaching;

import java.time.LocalDate;

/** A prescribed session shared by the planner, weekly budget, and plan adjustments. */
public record PlannedSession(
        LocalDate date,
        CoachWorkoutType workoutType,
        Double distanceKm,
        Integer durationMinutes,
        boolean stridesSuggested,
        String phase,
        String intent,
        String reasonCode,
        Integer targetPaceMinSecondsPerKm,
        Integer targetPaceMaxSecondsPerKm,
        CoachWorkoutType mutatedFrom,
        boolean readinessAdjusted,
        Double originalDistanceKm
) {
    public PlannedSession(LocalDate date, CoachWorkoutType workoutType, Double distanceKm, Integer durationMinutes,
            boolean stridesSuggested, String phase, String intent, String reasonCode,
            Integer targetPaceMinSecondsPerKm, Integer targetPaceMaxSecondsPerKm,
            CoachWorkoutType mutatedFrom, boolean readinessAdjusted) {
        this(date, workoutType, distanceKm, durationMinutes, stridesSuggested, phase, intent, reasonCode,
                targetPaceMinSecondsPerKm, targetPaceMaxSecondsPerKm, mutatedFrom, readinessAdjusted, null);
    }
}
