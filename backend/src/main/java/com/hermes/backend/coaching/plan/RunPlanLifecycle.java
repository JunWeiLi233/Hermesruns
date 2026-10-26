package com.hermes.backend.coaching.plan;

import com.hermes.backend.activity.*;
import com.hermes.backend.runner.*;
import jakarta.persistence.*;
import java.util.*;
import org.springframework.stereotype.Component;

/** Activity owns the hook. Reconciliation executes synchronously in its deleting/editing transaction. */
@Component
class RunPlanLifecycle implements ActivityDeletionHook,ActivityMutationHook,RunnerDataPurger,RunnerDataExportContributor {
    @PersistenceContext EntityManager em;
    private final RunPlanService plans;
    RunPlanLifecycle(RunPlanService plans){this.plans=plans;}
    public Class<?> entity(){return PlanActivityLink.class;}
    public void beforeActivitiesDeleted(Collection<Long> ids){reconcile(ids);}
    public void beforeActivityChanged(Long id){if(id!=null)reconcile(List.of(id));}
    private void reconcile(Collection<Long> ids){
        if(ids==null||ids.isEmpty())return;
        var links=em.createQuery("select l from PlanActivityLink l where l.activity.id in :ids order by l.workoutId",PlanActivityLink.class).setParameter("ids",ids).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        for(var l:links){var w=em.find(PlanWorkout.class,l.workoutId,LockModeType.PESSIMISTIC_WRITE);if(w!=null){w.state="PLANNED";w.completionSource="NONE";w.revision++;var p=em.find(RunPlan.class,w.planId,LockModeType.PESSIMISTIC_WRITE);p.revision++;}em.remove(l);}
        em.flush();
    }
    public int order(){return 4;}
    public Set<Class<?>> entities(){return Set.of(PlanProfile.class,RunPlan.class,PlanVersion.class,PlanWorkout.class,PlanStep.class,PlanActivityLink.class,PlanCommand.class);}
    public void purge(Long runnerId){
        for(String entity:List.of("PlanActivityLink","PlanStep","PlanWorkout","PlanVersion","PlanCommand","RunPlan","PlanProfile"))
            em.createQuery("delete from "+entity+" x where x.runner.id=:owner").setParameter("owner",runnerId).executeUpdate();
    }
    public String filename(){return "training-plans.json";}
    public Object export(Runner runner){
        var result=new ArrayList<Map<String,Object>>();
        for(var p:plans.owned(RunPlan.class,runner,"order by x.createdAt",Map.of(),1000)){
            var versions=plans.owned(PlanVersion.class,runner,"and x.planId=:id order by x.ordinal",Map.of("id",p.id),1000).stream()
                .map(v->RunPlanService.map("id",v.id,"state",v.state,"inputs",v.inputSnapshot,"days",v.workoutSnapshot,"rules",v.generatorVersion,"contentHash",v.contentHash)).toList();
            result.add(RunPlanService.map("id",p.id.toString(),"title",p.title,"state",p.state,"versions",versions,"workouts",em.createQuery("select w.id,w.localDate,w.state,w.completionSource from PlanWorkout w where w.runner.id=:owner and w.planId=:id",Object[].class).setParameter("owner",runner.getId()).setParameter("id",p.id).getResultList().stream().map(row->RunPlanService.map("id",row[0].toString(),"localDate",row[1].toString(),"state",row[2],"completionSource",row[3])).toList()));
        }
        return plans.exportValue(RunPlanService.map("profile",plans.profile(runner),"plans",result,"links",em.createQuery("select l.workoutId,l.activity.id,l.decision from PlanActivityLink l where l.runner.id=:owner",Object[].class).setParameter("owner",runner.getId()).getResultList().stream().map(row->RunPlanService.map("workoutId",row[0].toString(),"activityId",row[1].toString(),"decision",row[2])).toList()));
    }
}
