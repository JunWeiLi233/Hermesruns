package com.hermes.backend.coaching.plan;

import com.hermes.backend.activity.*;
import com.hermes.backend.runner.Runner;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;

/** Historical evidence for isolated tests only. Never available on a production classpath. */
final class RunPlanPaceFixture {
    @SuppressWarnings("unchecked")
    static String seed(RunPlanService plans,PlatformTransactionManager transactions,Runner owner) {
        return seed(plans,transactions,owner,false);
    }
    @SuppressWarnings("unchecked")
    static String seed(RunPlanService plans,PlatformTransactionManager transactions,Runner owner,boolean includePartial) {
        return new TransactionTemplate(transactions).execute(status->{
            var em=plans.em;var today=LocalDate.now(ZoneId.of("America/New_York"));
            var start=today.with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(7);
            var inputs=new RunPlanEngine.Inputs(1,"DISTANCE",10000,start,start.plusWeeks(16).minusDays(1),"America/New_York",true,
                "INTERMEDIATE","DISTANCE",24000,3,8000,true,List.of(2,4,7),3,7,"STANDARD","STANDARD",
                new RunPlanEngine.Result(5000,1800,start.minusDays(1)),"Historical pace review fixture",null,"KM");
            var p=new RunPlan();p.runner=em.getReference(Runner.class,owner.getId());p.title=inputs.title();p.goalKind=inputs.goalKind();p.targetDistanceM=10000;p.state="ACTIVE";
            p.inputSnapshot=(Map<String,Object>)plans.exportValue(inputs);em.persist(p);
            var v=new PlanVersion();v.runner=p.runner;v.planId=p.id;v.ordinal=1;v.state="ACTIVE";v.inputSnapshot=Map.of("inputs",p.inputSnapshot);
            v.inputHash=v.contentHash=v.retainedHash="0".repeat(64);v.generationLocalDate=start;v.startDate=start;v.endDate=inputs.endDate();v.timeZone=inputs.timeZone();v.warnings=List.of();
            var days=new RunPlanEngine().generate(inputs,start,List.of()).days().stream().map(d->d.identified(UUID.randomUUID().toString(),v.id.toString())).toList();
            v.workoutSnapshot=days.stream().map(d->(Map<String,Object>)plans.exportValue(d)).toList();em.persist(v);
            int n=0;
            for(var d:days) {
                var w=new PlanWorkout();w.id=UUID.fromString(d.id());w.runner=p.runner;w.planId=p.id;w.versionId=v.id;w.localDate=d.localDate();w.workoutType=d.workoutType();w.phase=d.phase();w.targetDistanceM=d.targetDistanceM();w.targetDurationS=d.targetDurationS();
                boolean sample=Set.of("STEADY","INTERVAL").contains(d.workoutType())&&d.localDate().isBefore(today);
                boolean partial=includePartial&&sample&&n==0;
                if(sample){w.state=partial?"PARTIAL":"COMPLETED";w.completionSource="ACTIVITY";}em.persist(w);
                for(var step:d.steps()) {
                    var s=new PlanStep();s.runner=w.runner;s.workoutId=w.id;s.sequence=step.sequence();s.stepType=step.stepType();s.distanceM=step.distanceM();s.durationS=step.durationS();s.paceMinSPerKm=step.paceMinSPerKm();s.paceMaxSPerKm=step.paceMaxSPerKm();s.effortKey=step.effortKey();em.persist(s);
                }
                if(sample) {
                    double expected=d.steps().stream().mapToDouble(s->s.distanceM()*(s.paceMinSPerKm()+s.paceMaxSPerKm())/2d).sum()/1000;
                    var a=new Activity();a.setRunner(p.runner);a.setActivityType(ActivityType.RUN);a.setProvider(ImportProvider.MANUAL);a.setName("Synthetic matched workout "+(++n));
                    a.setStartTime(d.localDate().atTime(8,0).atZone(ZoneId.of(inputs.timeZone())).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime());
                    a.setDistanceMeters(d.targetDistanceM().doubleValue());a.setDistanceKm(d.targetDistanceM()/1000d);a.setDurationSeconds(Math.round(expected*0.9));em.persist(a);
                    var link=new PlanActivityLink();link.runner=p.runner;link.workoutId=w.id;link.activity=a;link.decision=partial?"PARTIAL":"COMPLETE";em.persist(link);
                }
            }
            em.flush();return p.id.toString();
        });
    }
}
