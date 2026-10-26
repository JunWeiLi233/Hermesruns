package com.hermes.backend.coaching.plan;

import static org.junit.jupiter.api.Assertions.*;
import static com.hermes.backend.coaching.plan.RunPlanService.map;
import com.hermes.backend.runner.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties={"spring.datasource.url=${hermes.plan.test-db:jdbc:h2:mem:experimental-plans;MODE=PostgreSQL;DB_CLOSE_DELAY=-1}",
    "spring.datasource.driver-class-name=${hermes.plan.test-driver:org.h2.Driver}",
    "spring.jpa.hibernate.ddl-auto=${hermes.plan.test-ddl:create-drop}", "app.run-plans.approved-ruleset=",
    "app.run-plans.experimental-ruleset=hermes-road-v4", "app.official-course.startup-seed.enabled=false",
    "app.course-map.bulk-seed.enabled=false"})
class RunPlanExperimentalActivationTests {
    @Autowired RunPlanService plans;
    @Autowired RunnerRepository runners;
    @Autowired RunPlanReceiptCleanup cleanup;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;

    private Map<String,Object> preview(Runner runner) {
        var i=RunPlanEngineTests.inputs("DISTANCE",5000,8);
        var start=LocalDate.now(ZoneId.of(i.timeZone())).with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        var inputs=new RunPlanEngine.Inputs(i.schemaVersion(),i.goalKind(),i.goalDistanceM(),start,start.plusWeeks(8).minusDays(1),i.timeZone(),true,
            i.experience(),i.trainingMode(),i.baselineWeeklyM(),i.baselineRunsPerWeek(),i.longestRecentM(),true,i.availableWeekdays(),i.runsPerWeek(),i.longRunWeekday(),i.volume(),i.difficulty(),null,i.title(),null,i.units());
        String id=plans.create(runner,command(map("inputs",inputs))).get("id").toString();
        var version=plans.generate(runner,id,command(map("inputs",inputs,"baseRevision",0)));
        return plans.version(runner,id,version.get("id").toString());
    }
    private Map<String,Object> command(Map<String,Object> body) {var result=map("clientKey",UUID.randomUUID().toString());result.putAll(body);return result;}
    private Map<String,Object> activation(Map<String,Object> v) {return command(map("versionId",v.get("id"),"baseRevision",v.get("baseRevision"),"contentHash",v.get("contentHash"),"activePlanId",v.get("activePlanId"),"activePlanRevision",v.get("activePlanRevision"),"acknowledgedWarnings",v.get("warnings")));}
    @Test void experimentalPermissionNeverClaimsQualifiedApprovalAndRequiresBooleanConsent() {
        var runner=runners.saveAndFlush(new Runner("experimental-"+UUID.randomUUID()+"@hermes.test","active"));
        var v=preview(runner);String id=v.get("planId").toString();
        assertEquals(false,v.get("rulesApproved"));assertEquals(true,v.get("activationAllowed"));assertEquals(true,v.get("experimentalActivation"));
        for(Object value:Arrays.asList(null,false,"true",1)) {
            var b=activation(v);if(value!=null)b.put("acknowledgedExperimental",value);
            var error=assertThrows(RunPlanService.Failure.class,()->plans.activate(runner,id,b));
            assertEquals(422,error.status);assertEquals("EXPERIMENTAL_ACKNOWLEDGEMENT_REQUIRED",error.code);
            assertEquals("DRAFT",plans.plan(runner,id).get("state"));
        }
        var b=activation(v);b.put("acknowledgedExperimental",true);
        var result=plans.activate(runner,id,b);var replay=plans.activate(runner,id,b);
        assertEquals(result.keySet(),replay.keySet());
        result.forEach((key,value)->{if(value instanceof Number n)assertEquals(n.longValue(),((Number)replay.get(key)).longValue());else assertEquals(value,replay.get(key));});
        assertEquals("ACTIVE",plans.plan(runner,id).get("state"));assertEquals(false,plans.list(runner).get("rulesApproved"));
        var tx=new org.springframework.transaction.support.TransactionTemplate(transactions);
        tx.execute(status->plans.em.createQuery("update PlanCommand r set r.expiresAt=:past where r.runner.id=:owner")
            .setParameter("past",Instant.now().minusSeconds(60)).setParameter("owner",runner.getId()).executeUpdate());
        cleanup.expire();
        tx.execute(status->{
            var receipts=plans.em.createQuery("select r from PlanCommand r where r.runner.id=:owner",PlanCommand.class).setParameter("owner",runner.getId()).getResultList();
            assertEquals(1,receipts.size());assertEquals("ACTIVATE",receipts.get(0).operation);
            assertEquals("EXPERIMENTAL",receipts.get(0).result.get("activationMode"));assertEquals(true,receipts.get(0).result.get("acknowledgedExperimental"));
            return null;
        });
    }
}
