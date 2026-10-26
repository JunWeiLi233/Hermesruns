package com.hermes.backend.coaching.plan;

import com.hermes.backend.activity.*;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.training.*;
import jakarta.persistence.*;
import java.time.*;
import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

/** Materializes authored prescriptions in Hermes' existing dated-plan/version/workout/link authority. */
public final class TrainingCalendarBridge {
    final EntityManager em;
    public TrainingCalendarBridge(EntityManager em){this.em=em;}
    private PlanWorkout row(Runner owner,String id) {return em.createQuery("select w from PlanWorkout w where w.id=:id and w.runner.id=:owner and w.workoutType='AUTHORED'",PlanWorkout.class).setParameter("id",UUID.fromString(id)).setParameter("owner",owner.getId()).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultStream().findFirst().orElseThrow(()->new TrainingFailure(404,"NOT_FOUND"));}
    public Long owner(String id) {return em.createQuery("select w.runner.id from PlanWorkout w where w.id=:id and w.workoutType='AUTHORED'",Long.class).setParameter("id",UUID.fromString(id)).getResultStream().findFirst().orElseThrow(()->new TrainingFailure(404,"NOT_FOUND"));}
    public List<Map<String,Object>> list(Runner owner) {return em.createQuery("select w from PlanWorkout w where w.runner.id=:owner and w.workoutType='AUTHORED' and w.state<>'RETIRED' order by w.localDate,w.id",PlanWorkout.class).setParameter("owner",owner.getId()).setMaxResults(1000).getResultList().stream().map(this::dto).toList();}
    public Map<String,Object> create(Runner owner,String athlete,Map<String,Object> body) {
        var parent=em.createQuery("select p from RunPlan p where p.runner.id=:owner and p.state='EXTERNAL' order by p.id",RunPlan.class).setParameter("owner",owner.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
        if(parent==null){parent=new RunPlan();parent.runner=owner;parent.title="Authored training calendar";parent.goalKind="BASE";parent.targetDistanceM=0;parent.state="EXTERNAL";
            parent.inputSnapshot=map("schemaVersion",1,"goalKind","BASE","goalDistanceM",0,"startDate",body.get("date"),"endDate",body.get("date"),"timeZone",owner.getTimeZone()==null?"UTC":owner.getTimeZone(),"adultConfirmed",false,"experience","BEGINNER","trainingMode","RUN","baselineWeeklyM",0,"baselineRunsPerWeek",0,"longestRecentM",0,"canWalk20Minutes",false,"availableWeekdays",List.of(1,2,3,4,5,6,7),"runsPerWeek",1,"longRunWeekday",7,"volume","STANDARD","difficulty","EASY","title","Authored training calendar","units","metric");em.persist(parent);em.flush();}
        var version=new PlanVersion();version.runner=owner;version.planId=parent.id;
        version.ordinal=em.createQuery("select coalesce(max(v.ordinal),0) from PlanVersion v where v.planId=:plan",Integer.class).setParameter("plan",parent.id).getSingleResult()+1;
        version.baseRevision=parent.revision;version.state="HISTORICAL";version.generatorVersion="hermes-authored-v1";version.inputSnapshot=map("inputs",new LinkedHashMap<>(parent.inputSnapshot));
        version.inputHash=hash(body.toString());version.contentHash=version.inputHash;version.retainedHash=hash("");version.warnings=List.of("USER_AUTHORED_NOT_GENERATED");
        version.generationLocalDate=LocalDate.now(ZoneOffset.UTC);version.startDate=LocalDate.parse((String)body.get("date"));version.endDate=version.startDate;version.timeZone=owner.getTimeZone()==null?"UTC":owner.getTimeZone();
        var w=new PlanWorkout();w.runner=owner;w.planId=parent.id;w.versionId=version.id;w.localDate=version.startDate;w.workoutType="AUTHORED";w.phase="CUSTOM";w.targetDurationS=(int)Math.round(((Number)body.get("minutes")).doubleValue()*60);w.revision=1;
        version.workoutSnapshot=List.of(map("id",w.id.toString(),"localDate",w.localDate.toString(),"workoutType",w.workoutType,"phase",w.phase,"targetDistanceM",null,"targetDurationS",w.targetDurationS,"steps",List.of(),"state","PLANNED","completionSource",null,"versionId",version.id.toString(),"revision",1));
        em.persist(version);
        w.explanation=new LinkedHashMap<>(body);w.explanation.put("athleteId",athlete);em.persist(w);parent.revision++;em.flush();return dto(w);
    }
    public Map<String,Object> change(Runner owner,String athlete,String id,Map<String,Object> body,long revision) {
        var w=row(owner,id);check(w.revision==revision,412,"STALE_REVISION");check(w.state.equals("PLANNED"),409,"HISTORY_IMMUTABLE");
        if(body.containsKey("date")){var next=new LinkedHashMap<>(w.explanation);next.put("date",TrainingBulk.date(String.valueOf(body.get("date"))));w.state="RETIRED";w.revision++;return create(owner,athlete,next);}
        check("cancelled".equals(body.get("state")),422,"INVALID_EVENT_STATE");w.state="SKIPPED";w.revision++;em.flush();return dto(w);
    }
    public Map<String,Object> link(Runner owner,String event,Activity activity,long revision) {
        var w=row(owner,event);check(w.revision==revision,412,"STALE_REVISION");check(w.state.equals("PLANNED")&&activity.getRunner().getId().equals(owner.getId()),409,"COMPLETION_UNAVAILABLE");
        check(em.createQuery("select count(l) from PlanActivityLink l where l.workoutId=:workout or l.activity.id=:activity",Long.class).setParameter("workout",w.id).setParameter("activity",activity.getId()).getSingleResult()==0,409,"COMPLETION_ALREADY_LINKED");
        var link=new PlanActivityLink();link.runner=owner;link.workoutId=w.id;link.activity=activity;link.decision="COMPLETE";em.persist(link);w.state="COMPLETED";w.completionSource="ACTIVITY";w.revision++;em.flush();return dto(w);
    }
    Map<String,Object> dto(PlanWorkout w) {var r=new LinkedHashMap<>(w.explanation);r.putAll(map("id",w.id.toString(),"date",w.localDate.toString(),"minutes",w.targetDurationS/60d,"revision",w.revision,"state",w.state.equals("COMPLETED")?"completed":w.state.equals("SKIPPED")?"cancelled":"planned"));return r;}
}
