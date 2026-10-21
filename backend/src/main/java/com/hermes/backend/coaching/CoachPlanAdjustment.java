package com.hermes.backend.coaching;

import java.util.ArrayList;
import java.util.List;

/** Explicit easier-day requests adjust the shared prescription, never a page-local estimate. */
final class CoachPlanAdjustment {
    static final String MARKER = "[HERMES_MANUAL_EASE]";
    private CoachPlanAdjustment() {}
    static PersonalizedRunningPlanner.PersonalizedPlan easeToday(PersonalizedRunningPlanner.PersonalizedPlan plan) {
        var today = plan.today();
        if (today.workoutType()==CoachWorkoutType.REST || today.workoutType()==CoachWorkoutType.CROSS_TRAIN
                || today.distanceKm()==null || !Double.isFinite(today.distanceKm()) || today.distanceKm()<=0) return plan;
        double distance=Math.floor(today.distanceKm()*0.75*10)/10d;
        if(distance<=0)return plan;
        var easy=plan.sessions().stream().filter(s->s.workoutType()==CoachWorkoutType.EASY||s.workoutType()==CoachWorkoutType.RECOVERY)
                .filter(s->s.targetPaceMinSecondsPerKm()!=null).findFirst().orElse(null);
        var adjusted=new PersonalizedRunningPlanner.PlannedSession(today.date(),CoachWorkoutType.RECOVERY,distance,
                today.durationMinutes()==null?null:Math.max(1,(int)Math.floor(today.durationMinutes()*0.75)),false,
                today.phase(),"recovery","manual_ease",easy==null?null:easy.targetPaceMinSecondsPerKm(),
                easy==null?null:easy.targetPaceMaxSecondsPerKm(),today.workoutType(),true);
        var sessions=plan.sessions().stream().map(s->s.date().equals(today.date())?adjusted:s).toList();
        var reasons=new ArrayList<>(plan.reasonCodes());reasons.add(0,"manual_ease");
        double weekly=Math.round(Math.max(0,plan.targetWeeklyKm()-today.distanceKm()+distance)*10)/10d;
        var weeks = plan.weeklyBudgets().stream().map(w -> {
            if (today.date().isBefore(w.start()) || today.date().isAfter(w.end())) return w;
            double scheduled = Math.max(0, Math.round((w.scheduledRemainingKm() - today.distanceKm() + distance) * 10) / 10d);
            double allowance = Math.floor((Math.max(0, weekly - w.completedKm()) + 1e-9) * 10) / 10d;
            return new WeeklyMileageBudget.Week(w.start(), w.end(), weekly, w.completedKm(), allowance, scheduled, w.completedKm() + scheduled);
        }).toList();
        var weeklySessions = plan.weeklySessions().stream().map(s -> {
            if (!s.date().equals(today.date()) || s.distanceKm() == null) return s;
            double km = Math.max(0, Math.round((s.distanceKm() - today.distanceKm() + distance) * 10) / 10d);
            return new PersonalizedRunningPlanner.PlannedSession(s.date(), km > 0 ? CoachWorkoutType.RECOVERY : CoachWorkoutType.REST,
                    km > 0 ? km : null,
                    s.durationMinutes() == null || km <= 0 ? null : Math.max(1, (int) Math.floor(s.durationMinutes() * km / s.distanceKm())),
                    false, s.phase(), km > 0 ? "recovery" : "rest", "manual_ease", adjusted.targetPaceMinSecondsPerKm(),
                    adjusted.targetPaceMaxSecondsPerKm(), s.workoutType(), true, s.distanceKm());
        }).toList();
        return new PersonalizedRunningPlanner.PersonalizedPlan(plan.phase(),weekly,plan.sessionsPerWeek(),plan.preferredRunDays(),
                plan.confidence(),List.copyOf(reasons),sessions,adjusted,plan.historyEvidence(),weeks,
                WeeklyMileageBudget.planWeek(weekly, weeklySessions));
    }
}
