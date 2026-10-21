package com.hermes.backend.coaching.plan;

import com.hermes.backend.coaching.*;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only adapter for legacy coach clients. It never copies published prescriptions into coach rows. */
@Service
public class RunPlanSelection {
    @PersistenceContext EntityManager em;
    public record LibraryPreferences(List<DayOfWeek> availableRunDays, PersonalizedRunningPlanner.Goal goal, String planId) {}
    public record LibrarySession(String workoutType, String state) {}
    @Transactional(readOnly=true)
    public Map<LocalDate, LibrarySession> librarySessions(Runner runner) {
        var plans = em.createQuery("select p.id from RunPlan p where p.runner.id=:owner and p.state='ACTIVE'", UUID.class)
                .setParameter("owner",runner.getId()).setMaxResults(1).getResultList();
        if (plans.isEmpty()) return Map.of();
        var result = new HashMap<LocalDate, LibrarySession>();
        em.createQuery("select w from PlanWorkout w where w.runner.id=:owner and w.planId=:plan and w.state<>'RETIRED'",PlanWorkout.class)
                .setParameter("owner",runner.getId()).setParameter("plan",plans.get(0)).getResultList()
                .forEach(workout -> result.put(workout.localDate,new LibrarySession(workout.workoutType,workout.state)));
        return Map.copyOf(result);
    }
    /** Only this runner's saved setup can supply explicit availability and an unpublished goal. */
    @Transactional(readOnly=true)
    public LibraryPreferences libraryPreferences(Runner runner, LocalDate today) {
        var drafts = em.createQuery("select p from RunPlan p where p.runner.id=:owner and p.state in ('ACTIVE','DRAFT') order by case when p.state='ACTIVE' then 0 else 1 end, p.createdAt desc, p.id", RunPlan.class)
                .setParameter("owner", runner.getId()).setMaxResults(20).getResultList();
        for (var draft : drafts) {
            if (!"ACTIVE".equals(draft.state) && (!(draft.inputSnapshot.get("setupStep") instanceof Number step) || step.intValue() < 3)) continue;
            Map<?,?> inputs = draft.inputSnapshot.get("inputs") instanceof Map<?,?> captured ? captured : draft.inputSnapshot;
            if (inputs.get("endDate") == null || LocalDate.parse(inputs.get("endDate").toString()).isBefore(today)) continue;
            if (!(inputs.get("availableWeekdays") instanceof List<?> values)) continue;
            var days = values.stream().filter(Number.class::isInstance).map(Number.class::cast).mapToInt(Number::intValue)
                    .filter(day -> day >= 1 && day <= 7).mapToObj(DayOfWeek::of).distinct().toList();
            Number distance = inputs.get("goalDistanceM") instanceof Number n ? n : null;
            var goal = distance == null ? null : new PersonalizedRunningPlanner.Goal(distance.doubleValue() / 1000d,
                    "RACE".equals(inputs.get("goalKind")) ? LocalDate.parse(inputs.get("endDate").toString()) : null,
                    null, Objects.toString(inputs.get("eventName"), draft.title));
            return new LibraryPreferences(days, goal, draft.id.toString());
        }
        return null;
    }
    @Transactional(readOnly=true)
    public boolean selected(Runner r){return !em.createQuery("select p.id from RunPlan p where p.runner.id=:owner and p.state='ACTIVE'",UUID.class).setParameter("owner",r.getId()).setMaxResults(1).getResultList().isEmpty();}
    @Transactional(readOnly=true)
    public String calendarZone(Runner r) {
        var found=em.createQuery("select p from RunPlan p where p.runner.id=:owner and p.state='ACTIVE'",RunPlan.class).setParameter("owner",r.getId()).setMaxResults(1).getResultList();
        if(found.isEmpty())return com.hermes.backend.activity.ActivityLocalDates.zoneOf(r).getId();
        Map<?,?> inputs=found.get(0).inputSnapshot.get("inputs") instanceof Map<?,?> captured?captured:found.get(0).inputSnapshot;
        return ZoneId.of(inputs.get("timeZone").toString()).getId();
    }
    @Transactional(readOnly=true)
    public PersonalizedRunningPlanner.PersonalizedPlan legacy(Runner r,int horizon){
        return legacy(r, horizon, false);
    }
    /** Published targets for the complete account week, including completed and skipped workouts. */
    @Transactional(readOnly=true)
    public List<PersonalizedRunningPlanner.PlannedSession> weekSessions(Runner runner) {
        var plan = legacy(runner, 1, true);
        return plan == null ? List.of() : plan.sessions();
    }
    private PersonalizedRunningPlanner.PersonalizedPlan legacy(Runner r,int horizon,boolean completeWeek){
        var found=em.createQuery("select p from RunPlan p where p.runner.id=:owner and p.state='ACTIVE'",RunPlan.class).setParameter("owner",r.getId()).setMaxResults(1).getResultList();if(found.isEmpty())return null;
        var p=found.get(0);Map<?,?> inputs=p.inputSnapshot.get("inputs") instanceof Map<?,?> captured?captured:p.inputSnapshot;
        var date=LocalDate.now(ZoneId.of(inputs.get("timeZone").toString()));
        var weekStart=date.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        var horizonEnd=date.plusDays(Math.max(1,horizon)-1);
        var queryEnd=horizonEnd.isAfter(weekStart.plusDays(6))?horizonEnd:weekStart.plusDays(6);
        var days=em.createQuery("select w from PlanWorkout w where w.runner.id=:owner and w.planId=:plan and w.state<>'RETIRED' and w.localDate between :start and :end order by w.localDate",PlanWorkout.class).setParameter("owner",r.getId()).setParameter("plan",p.id).setParameter("start",weekStart).setParameter("end",queryEnd).getResultList();
        var paces=new HashMap<UUID,PlanStep>();
        if(!days.isEmpty())for(var step:em.createQuery("select s from PlanStep s where s.runner.id=:owner and s.workoutId in :ids and s.paceMinSPerKm is not null and s.paceMaxSPerKm is not null order by s.sequence",PlanStep.class)
                .setParameter("owner",r.getId()).setParameter("ids",days.stream().map(w->w.id).toList()).getResultList()) {
            var previous=paces.get(step.workoutId);
            boolean main="RUN".equals(step.stepType)||"MAIN".equals(step.stepType);
            boolean previousMain=previous!=null&&("RUN".equals(previous.stepType)||"MAIN".equals(previous.stepType));
            if(previous==null||(main&&!previousMain))paces.put(step.workoutId,step);
        }
        double weeklyKm=0;int weeklySessions=0;Set<DayOfWeek> runDays=new LinkedHashSet<>();
        var sessions=new ArrayList<PersonalizedRunningPlanner.PlannedSession>();
        for(var w:days){CoachWorkoutType kind=switch(w.workoutType){case "LONG"->CoachWorkoutType.LONG_RUN;case "INTERVAL"->CoachWorkoutType.INTERVALS;case "STEADY"->CoachWorkoutType.TEMPO;case "REST"->CoachWorkoutType.REST;default->CoachWorkoutType.EASY;};
            if(!w.localDate.isBefore(weekStart)&&!w.localDate.isAfter(weekStart.plusDays(6))&&kind!=CoachWorkoutType.REST){
                weeklyKm+=w.targetDistanceM==null?0:Math.max(0,w.targetDistanceM)/1000d;weeklySessions++;runDays.add(w.localDate.getDayOfWeek());
            }
            if(w.localDate.isBefore(completeWeek ? weekStart : date)||w.localDate.isAfter(completeWeek ? weekStart.plusDays(6) : horizonEnd))continue;
            var pace=paces.get(w.id);
            sessions.add(new PersonalizedRunningPlanner.PlannedSession(w.localDate,kind,w.targetDistanceM==null?null:w.targetDistanceM/1000d,w.targetDurationS==null?null:(w.targetDurationS+59)/60,false,w.phase,w.workoutType,"VERSIONED_PLAN",pace==null?null:pace.paceMinSPerKm,pace==null?null:pace.paceMaxSPerKm,null,false));}
        var today=sessions.stream().filter(s->s.date().equals(date)).findFirst().orElse(new PersonalizedRunningPlanner.PlannedSession(date,CoachWorkoutType.REST,null,null,false,"ADAPT","REST","VERSIONED_PLAN",null,null,null,false));
        return new PersonalizedRunningPlanner.PersonalizedPlan(today.phase(),weeklyKm,weeklySessions,List.copyOf(runDays),100,List.of("VERSIONED_PLAN"),List.copyOf(sessions),today);
    }
}
