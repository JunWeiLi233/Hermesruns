package com.hermes.backend.coaching.plan;

import static org.junit.jupiter.api.Assertions.*;
import static com.hermes.backend.coaching.plan.RunPlanService.map;
import com.hermes.backend.activity.*;
import com.hermes.backend.runner.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties={"spring.datasource.url=${hermes.plan.test-db:jdbc:h2:mem:versioned-plans;MODE=PostgreSQL;DB_CLOSE_DELAY=-1}",
    "spring.datasource.driver-class-name=${hermes.plan.test-driver:org.h2.Driver}","spring.jpa.hibernate.ddl-auto=${hermes.plan.test-ddl:create-drop}",
    "app.run-plans.approved-ruleset=hermes-road-v4","app.official-course.startup-seed.enabled=false","app.course-map.bulk-seed.enabled=false"})
class RunPlanIntegrationTests {
    @SuppressWarnings("unchecked")
    @Test void libraryAvailabilityAndGoalComeOnlyFromThisRunnersCompletedDaySetup() {
        var a=runner();var b=runner();
        var aPlan=plans.create(a,command(map("inputs",inputs("DISTANCE",5000,8),"setupStep",3)));
        Map<String,Object> first=new LinkedHashMap<>((Map<String,Object>)plans.plan(a,aPlan.get("id").toString()).get("inputs"));
        first.put("title","Runner A goal");first.put("availableWeekdays",List.of(2,4,7));
        plans.edit(a,aPlan.get("id").toString(),map("inputs",first,"setupStep",3),"\"0\"");
        Map<String,Object> second=new LinkedHashMap<>(first);second.put("title","Runner B goal");second.put("availableWeekdays",List.of(1,3,5));
        plans.create(b,command(map("inputs",second,"setupStep",3)));
        plans.create(a,command(map("inputs",second,"setupStep",1)));
        var preferences=selection.libraryPreferences(a,LocalDate.now());
        assertEquals(List.of(DayOfWeek.TUESDAY,DayOfWeek.THURSDAY,DayOfWeek.SUNDAY),preferences.availableRunDays());
        assertEquals("Runner A goal",preferences.goal().name());assertEquals(aPlan.get("id"),preferences.planId());
        assertEquals(List.of(DayOfWeek.MONDAY,DayOfWeek.WEDNESDAY,DayOfWeek.FRIDAY),selection.libraryPreferences(b,LocalDate.now()).availableRunDays());
        assertNull(selection.libraryPreferences(runner(),LocalDate.now()));
    }
    @Autowired RunPlanService plans;
    @Autowired RunPlanSelection selection;
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired ActivityDataAccess data;
    @Autowired ManualRunService manual;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;
    @Autowired AccountExportService exports;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    private Runner runner(){return runners.saveAndFlush(new Runner("plan-"+UUID.randomUUID()+"@hermes.test","active"));}
    private Map<String,Object> key(){return map("clientKey",UUID.randomUUID().toString());}
    @SuppressWarnings("unchecked")
    @Test void paceReviewExplainsExcludedLinkedRunsWithoutChangingEligibilityOrPlans() {
        var r=runner();String id=RunPlanPaceFixture.seed(plans,transactions,r);var initial=plans.paceReview(r,id);
        var sample=((List<Map<String,Object>>)initial.get("sources")).get(0);
        new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status->{
            var link=plans.em.createQuery("select l from PlanActivityLink l where l.runner.id=:owner and l.activity.id=:activity",PlanActivityLink.class)
                .setParameter("owner",r.getId()).setParameter("activity",Long.parseLong(sample.get("activityId").toString())).getSingleResult();
            link.decision="PARTIAL";plans.em.find(PlanWorkout.class,link.workoutId).state="PARTIAL";return null;
        });
        var before=plans.plan(r,id);var review=plans.paceReview(r,id);
        var excluded=(List<Map<String,Object>>)review.get("excludedSources");assertNotNull(excluded);
        assertTrue(excluded.stream().anyMatch(a->a.get("activityId").equals(sample.get("activityId"))&&a.get("reason").equals("INCOMPLETE")));
        assertTrue(((List<Map<String,Object>>)review.get("sources")).stream().noneMatch(a->a.get("activityId").equals(sample.get("activityId"))));
        assertTrue(((Number)review.get("sampleCount")).intValue()<=5);assertEquals(before,plans.plan(r,id));
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.paceReview(runner(),id)).status);
    }
    @Test void paceDecisionMetadataRemainsReadableByLegacyCoachAndExtraRunLogging() {
        var r=runner();String id=RunPlanPaceFixture.seed(plans,transactions,r);var review=plans.paceReview(r,id);
        plans.paceDecision(r,id,command(map("baseRevision",review.get("planRevision"),"evidenceHash",review.get("evidenceHash"))),false);
        assertNotNull(selection.legacy(r,7));
        var before=plans.plan(r,id);
        var saved=manual.save(r.getId(),new ManualRunService.Request(UUID.randomUUID().toString(),Instant.now().minusSeconds(3600).toString(),"America/New_York",2300,900,"Extra after pace decision"));
        assertNotNull(saved.id());assertNull(plans.backlink(r,Long.parseLong(saved.id())).get("link"));
        assertEquals(before.get("revision"),plans.plan(r,id).get("revision"));
    }
    @SuppressWarnings("unchecked")
    @Test void decliningPaceEvidenceSurvivesAnUnrelatedWorkoutMove() {
        var r=runner();String id=RunPlanPaceFixture.seed(plans,transactions,r);
        var review=plans.paceReview(r,id);
        plans.paceDecision(r,id,command(map("baseRevision",review.get("planRevision"),"evidenceHash",review.get("evidenceHash"))),false);
        var current=plans.plan(r,id);var today=LocalDate.now(ZoneId.of("America/New_York"));
        var calendar=plans.calendar(r,id,today.plusDays(7),today.plusDays(20));
        var source=((List<RunPlanEngine.Week>)calendar.get("weeks")).stream().flatMap(w->w.days().stream())
            .filter(d->d.workoutType().equals("EASY")&&d.localDate().getDayOfWeek()==DayOfWeek.TUESDAY).findFirst().orElseThrow();
        var moved=plans.movePreview(r,id,source.id(),command(map("baseRevision",current.get("revision"),"revision",source.revision(),"targetDate",source.localDate().plusDays(1).toString())));
        plans.activate(r,id,activation(plans.version(r,id,moved.get("id").toString())));
        var after=plans.paceReview(r,id);
        assertEquals(review.get("sources"),after.get("sources"));
        assertEquals(review.get("evidenceHash"),after.get("evidenceHash"));
        assertEquals("DECLINED",after.get("state"));
        current=plans.plan(r,id);
        var regenerated=plans.generate(r,id,command(map("inputs",current.get("inputs"),"baseRevision",current.get("revision"))));
        plans.activate(r,id,activation(plans.version(r,id,regenerated.get("id").toString())));
        assertEquals("DECLINED",plans.paceReview(r,id).get("state"));
    }
    @SuppressWarnings("unchecked")
    @Test void changedActualEvidenceInvalidatesAPaceDecisionWithoutChangingGuidance() {
        var r=runner();String id=RunPlanPaceFixture.seed(plans,transactions,r);var review=plans.paceReview(r,id);
        var source=((List<Map<String,Object>>)review.get("sources")).get(0);
        var actual=activities.findById(Long.parseLong(source.get("activityId").toString())).orElseThrow();
        actual.setDurationSeconds(actual.getDurationSeconds()+60);data.save(actual);
        var current=plans.plan(r,id);
        assertEquals("PACE_EVIDENCE_CHANGED",assertThrows(RunPlanService.Failure.class,()->plans.paceDecision(r,id,
            command(map("baseRevision",current.get("revision"),"evidenceHash",review.get("evidenceHash"))),true)).code);
        assertNull(((Map<?,?>)current.get("inputs")).get("paceScaleBps"));
    }
    @Test void paceEvidenceHasExplicitDeclineAndOnlyPublishesAnExactReviewedPaceVersion() {
        var r=runner();String id=RunPlanPaceFixture.seed(plans,transactions,r);
        var review=plans.paceReview(r,id);assertEquals("RECOMMENDED",review.get("state"));assertEquals(98,review.get("percent"));
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.paceReview(runner(),id)).status);
        var b=command(map("baseRevision",review.get("planRevision"),"evidenceHash",review.get("evidenceHash")));
        var result=plans.paceDecision(r,id,b,true);assertEquals(result,plans.paceDecision(r,id,b,true));
        assertNull(((Map<?,?>)plans.plan(r,id).get("inputs")).get("paceScaleBps"));
        var preview=plans.version(r,id,result.get("id").toString());
        var gate=new RunPlanService(mapper,runners,activities,transactions,"");gate.em=plans.em;
        assertEquals("RULES_REVIEW_REQUIRED",assertThrows(RunPlanService.Failure.class,()->gate.activate(r,id,activation(preview))).code);
        assertEquals(409,assertThrows(RunPlanService.Failure.class,()->plans.paceDecision(r,id,command(map("baseRevision",review.get("planRevision"),"evidenceHash","changed")),false)).status);
        plans.activate(r,id,activation(preview));
        assertEquals(9800,((Number)((Map<?,?>)plans.plan(r,id).get("inputs")).get("paceScaleBps")).intValue());
        assertEquals("NEED_MORE",plans.paceReview(r,id).get("state"));
        assertNotNull(selection.legacy(r,7));
        var other=runner();String declined=RunPlanPaceFixture.seed(plans,transactions,other);var evidence=plans.paceReview(other,declined);
        plans.paceDecision(other,declined,command(map("baseRevision",evidence.get("planRevision"),"evidenceHash",evidence.get("evidenceHash"))),false);
        assertEquals("DECLINED",plans.paceReview(other,declined).get("state"));assertNull(((Map<?,?>)plans.plan(other,declined).get("inputs")).get("paceScaleBps"));
    }
    @Test void movedPreviewIsOwnedIdempotentAndChangesNothingBeforeExactActivation() {
        var r=runner();var i=inputs("DISTANCE",5000,8);var p=plans.create(r,command(map("inputs",i)));String pid=p.get("id").toString();
        var v=plans.generate(r,pid,command(map("inputs",i,"baseRevision",0)));var preview=plans.version(r,pid,v.get("id").toString());
        plans.activate(r,pid,activation(preview));
        @SuppressWarnings("unchecked") var weeks=(List<RunPlanEngine.Week>)preview.get("weeks");
        var source=weeks.get(1).days().stream().filter(d->d.workoutType().equals("EASY")).findFirst().orElseThrow();
        var target=source.localDate().plusDays(1);var b=command(map("revision",0,"baseRevision",plans.plan(r,pid).get("revision"),"targetDate",target.toString()));
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.movePreview(runner(),pid,source.id(),b)).status);
        var moved=plans.movePreview(r,pid,source.id(),b);assertEquals(moved,plans.movePreview(r,pid,source.id(),b));
        assertEquals(source,plans.detail(r,pid,source.id()).get("workout"));
        var next=plans.version(r,pid,moved.get("id").toString());
        var gate=new RunPlanService(mapper,runners,activities,transactions,"hermes-road-v1");gate.em=plans.em;
        assertEquals("RULES_REVIEW_REQUIRED",assertThrows(RunPlanService.Failure.class,()->gate.activate(r,pid,activation(next))).code);
        var previousGate=new RunPlanService(mapper,runners,activities,transactions,"hermes-road-v2");previousGate.em=plans.em;
        assertEquals("RULES_REVIEW_REQUIRED",assertThrows(RunPlanService.Failure.class,()->previousGate.activate(r,pid,activation(next))).code);
        var v3Gate=new RunPlanService(mapper,runners,activities,transactions,"hermes-road-v3");v3Gate.em=plans.em;
        assertEquals("RULES_REVIEW_REQUIRED",assertThrows(RunPlanService.Failure.class,()->v3Gate.activate(r,pid,activation(next))).code);
        plans.activate(r,pid,activation(next));
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.detail(r,pid,source.id())).status);
        var current=plans.calendar(r,pid,target,target);assertNotNull(current);
    }
    private Map<String,Object> activation(Map<String,Object> v){return command(map("versionId",v.get("id"),"baseRevision",v.get("baseRevision"),"contentHash",v.get("contentHash"),"activePlanId",v.get("activePlanId"),"activePlanRevision",v.get("activePlanRevision"),"acknowledgedWarnings",v.get("warnings")));}
    @Test void profileCreationIsConditionalAndStoresTheConfirmedBaseline() {
        var r=runner();var start=LocalDate.now(ZoneId.of("America/New_York")).with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));var body=map("schemaVersion",1,"goalKind","DISTANCE","goalDistanceM",5000,"startDate",start.toString(),"endDate",start.plusDays(55).toString(),"timeZone","America/New_York","adultConfirmed",true,"experience","INTERMEDIATE","trainingMode","DISTANCE","baselineWeeklyM",18000,"baselineRunsPerWeek",3,"longestRecentM",6000,"canWalk20Minutes",true,"availableWeekdays",List.of(2,4,7),"runsPerWeek",3,"longRunWeekday",7,"volume","STANDARD","difficulty","STANDARD","recentResult",null,"title","A plan","eventName",null,"units","KM");
        plans.saveProfile(r,body,null,"*");assertNotNull(plans.profile(r).get("profile"));
        assertEquals("STALE_REVISION",assertThrows(RunPlanService.Failure.class,()->plans.saveProfile(r,body,"\"99\"",null)).code);
    }
    @SuppressWarnings("unchecked")
    @Test void fullLoopPersistsExactPreviewAndReconcilesDeletedEvidence() {
        Runner r=runner(),other=runner();var i=inputs("DISTANCE",5000,8);
        var create=key();create.put("inputs",i);var p=plans.create(r,create);String pid=p.get("id").toString();
        assertEquals(p.get("id"),plans.create(r,create).get("id"));
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.plan(other,pid)).status);
        var generate=key();generate.put("inputs",i);generate.put("baseRevision",0);var generated=plans.generate(r,pid,generate);
        var preview=plans.version(r,pid,generated.get("id").toString());
        var weeks=(List<RunPlanEngine.Week>)preview.get("weeks");assertEquals(56,weeks.stream().mapToInt(w->w.days().size()).sum());
        var first=weeks.stream().flatMap(w->w.days().stream()).filter(d->d.workoutType().equals("EASY")).findFirst().orElseThrow();
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.detail(r,pid,first.id())).status);
        var activate=key();activate.putAll(map("versionId",preview.get("id"),"baseRevision",0,"contentHash",preview.get("contentHash"),
            "activePlanId",null,"activePlanRevision",null,"acknowledgedWarnings",preview.get("warnings")));
        var activation=plans.activate(r,pid,activate);assertEquals(activation.get("id"),plans.activate(r,pid,activate).get("id"));
        assertEquals(generated,plans.generate(r,pid,generate));
        var detail=plans.detail(r,pid,first.id());assertEquals(first,detail.get("workout"));
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.detail(other,pid,first.id())).status);
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.detail(r,pid,UUID.randomUUID().toString())).status);
        var output=new java.io.ByteArrayOutputStream();assertDoesNotThrow(()->exports.write(r,false,output));assertTrue(output.size()>100);
        String saveKey=UUID.randomUUID().toString();var request=new ManualRunService.Request(saveKey,Instant.now().minusSeconds(7200).toString(),i.timeZone(),2300,900,"Actual run");
        var saved=manual.save(r.getId(),request);assertEquals(saved.id(),manual.save(r.getId(),request).id());
        var rest=weeks.stream().flatMap(w->w.days().stream()).filter(d->d.workoutType().equals("REST")).findFirst().orElseThrow();
        assertEquals("REST_WORKOUT",assertThrows(RunPlanService.Failure.class,()->plans.link(r,pid,rest.id(),command(map("revision",0)))).code);
        var candidates=(List<Map<String,Object>>)plans.candidates(r,pid,first.id(),LocalDate.now().minusDays(2),LocalDate.now().plusDays(10),null).get("activities");
        var candidate=candidates.stream().filter(c->saved.id().equals(c.get("id"))).findFirst().orElseThrow();
        var link=key();link.putAll(map("revision",0,"activityId",saved.id(),"metricHash",candidate.get("metricHash"),"decision","PARTIAL","acknowledgedWarnings",candidate.get("warnings")));
        plans.link(r,pid,first.id(),link);assertEquals("PARTIAL",((RunPlanEngine.Day)plans.detail(r,pid,first.id()).get("workout")).state());
        assertNotNull(plans.backlink(r,Long.parseLong(saved.id())).get("link"));
        var before=(RunPlanEngine.Day)plans.detail(r,pid,first.id()).get("workout");
        var regen=key();regen.putAll(map("inputs",i,"baseRevision",plans.plan(r,pid).get("revision")));
        var next=plans.generate(r,pid,regen);var nextPreview=plans.version(r,pid,next.get("id").toString());
        var replacement=key();replacement.putAll(map("versionId",nextPreview.get("id"),"baseRevision",nextPreview.get("baseRevision"),"contentHash",nextPreview.get("contentHash"),"activePlanId",nextPreview.get("activePlanId"),"activePlanRevision",nextPreview.get("activePlanRevision"),"acknowledgedWarnings",nextPreview.get("warnings")));
        var restricted=new RunPlanService(mapper,runners,activities,transactions,"");restricted.em=plans.em;
        assertEquals("RULES_REVIEW_REQUIRED",assertThrows(RunPlanService.Failure.class,()->restricted.activate(r,pid,replacement)).code);
        plans.activate(r,pid,replacement);assertEquals(before,plans.detail(r,pid,first.id()).get("workout"));
        var replaced=weeks.stream().flatMap(w->w.days().stream()).filter(d->!d.id().equals(first.id())).findFirst().orElseThrow();
        assertEquals(404,assertThrows(RunPlanService.Failure.class,()->plans.detail(r,pid,replaced.id())).status);
        assertTrue(data.deleteActivityForRunner(Long.parseLong(saved.id()),r));
        var after=(RunPlanEngine.Day)plans.detail(r,pid,first.id()).get("workout");assertEquals("PLANNED",after.state());assertEquals("NONE",after.completionSource());
        assertEquals(410,assertThrows(ManualRunService.Conflict.class,()->manual.save(r.getId(),request)).status);
        assertEquals(410,assertThrows(RunPlanService.Failure.class,()->plans.link(r,pid,first.id(),link)).status);
    }
    @Test void changingBasisOrHashCannotActivateAndKeyReuseCannotMutate() {
        var r=runner();var i=inputs("DISTANCE",5000,8);var create=key();create.put("inputs",i);var p=plans.create(r,create);String id=p.get("id").toString();
        var g=key();g.putAll(map("inputs",i,"baseRevision",0));var v=plans.generate(r,id,g);
        var b=key();b.putAll(map("versionId",v.get("id"),"baseRevision",0,"contentHash","wrong","activePlanId",null,"activePlanRevision",null,"acknowledgedWarnings",List.of()));
        assertEquals("STALE_PREVIEW",assertThrows(RunPlanService.Failure.class,()->plans.activate(r,id,b)).code);
        create.put("inputs",inputs("DISTANCE",10000,10));assertEquals("SAVE_KEY_REUSED",assertThrows(RunPlanService.Failure.class,()->plans.create(r,create)).code);
        assertEquals("DRAFT",plans.plan(r,id).get("state"));
    }
    @SuppressWarnings("unchecked")
    @Test void uncertainDatesStayOutOfTotalsAndChangedEvidenceRequiresReview() {
        var r=runner();var i=inputs("RUN_WALK",5000,12);
        var p=plans.create(r,command(map("inputs",i)));String pid=p.get("id").toString();
        var generated=plans.generate(r,pid,command(map("inputs",i,"baseRevision",0)));var v=plans.version(r,pid,generated.get("id").toString());
        plans.activate(r,pid,command(map("versionId",v.get("id"),"baseRevision",v.get("baseRevision"),"contentHash",v.get("contentHash"),"activePlanId",null,"activePlanRevision",null,"acknowledgedWarnings",v.get("warnings"))));
        var w=((List<RunPlanEngine.Week>)v.get("weeks")).stream().flatMap(week->week.days().stream()).filter(d->d.workoutType().equals("RUN_WALK")).findFirst().orElseThrow();
        var unknown=actual(r,"Unknown date",null);var source=actual(r,"Source-local",LocalDateTime.now(ZoneOffset.UTC));source.setStravaApiSourced(true);activities.saveAndFlush(source);
        var candidates=(List<Map<String,Object>>)plans.candidates(r,pid,w.id(),LocalDate.now().minusDays(14),LocalDate.now().plusDays(14),null).get("activities");
        var pick=candidates.stream().filter(a->a.get("id").equals(unknown.getId().toString())).findFirst().orElseThrow();
        assertEquals("UNKNOWN",pick.get("dateConfidence"));assertTrue(((List<String>)pick.get("warnings")).contains("UNKNOWN_ACTIVITY_DATE"));
        assertTrue(candidates.stream().anyMatch(a->a.get("dateConfidence").equals("SOURCE_LOCAL")));
        var calendar=plans.calendar(r,pid,LocalDate.now().minusDays(7),LocalDate.now().plusDays(7));assertEquals(0L,calendar.get("actualDistanceM"));assertEquals(2,calendar.get("unknownDateCount"));
        plans.link(r,pid,w.id(),command(map("revision",0,"activityId",unknown.getId().toString(),"metricHash",pick.get("metricHash"),"decision","COMPLETE","acknowledgedWarnings",pick.get("warnings"))));
        unknown.setDistanceMeters(3100d);data.save(unknown);
        assertNull(plans.backlink(r,unknown.getId()).get("link"));assertEquals("PLANNED",((RunPlanEngine.Day)plans.detail(r,pid,w.id()).get("workout")).state());
        assertEquals(3100d,activities.findById(unknown.getId()).orElseThrow().getDistanceMeters());
    }
    @SuppressWarnings("unchecked")
    @Test void candidatePaginationIsOwnedAndDoesNotLoseRows() {
        var r=runner();var other=runner();var i=inputs("DISTANCE",5000,8);
        var p=plans.create(r,command(map("inputs",i)));String pid=p.get("id").toString();var generated=plans.generate(r,pid,command(map("inputs",i,"baseRevision",0)));var v=plans.version(r,pid,generated.get("id").toString());
        plans.activate(r,pid,command(map("versionId",v.get("id"),"baseRevision",v.get("baseRevision"),"contentHash",v.get("contentHash"),"activePlanId",null,"activePlanRevision",null,"acknowledgedWarnings",v.get("warnings"))));
        var w=((List<RunPlanEngine.Week>)v.get("weeks")).stream().flatMap(week->week.days().stream()).filter(d->d.workoutType().equals("EASY")).findFirst().orElseThrow();
        for(int n=0;n<105;n++)actual(r,"Run "+n,LocalDateTime.now(ZoneOffset.UTC).minusDays(1));var foreign=actual(other,"Private",LocalDateTime.now(ZoneOffset.UTC).minusDays(1));
        var page=plans.candidates(r,pid,w.id(),LocalDate.now().minusDays(2),LocalDate.now().plusDays(1),null);var first=(List<Map<String,Object>>)page.get("activities");assertEquals(100,first.size());assertNotNull(page.get("nextCursor"));
        var second=plans.candidates(r,pid,w.id(),LocalDate.now().minusDays(2),LocalDate.now().plusDays(1),page.get("nextCursor").toString());var rest=(List<Map<String,Object>>)second.get("activities");assertEquals(5,rest.size());assertNull(second.get("nextCursor"));
        Set<Object> ids=new HashSet<>();first.forEach(a->ids.add(a.get("id")));rest.forEach(a->ids.add(a.get("id")));assertEquals(105,ids.size());assertFalse(ids.contains(foreign.getId().toString()));
    }
    private Map<String,Object> command(Map<String,Object> body){var b=key();b.putAll(body);return b;}
    private RunPlanEngine.Inputs inputs(String mode,int goal,int weeks) {
        var i=RunPlanEngineTests.inputs(mode,goal,weeks);
        var start=LocalDate.now(ZoneId.of(i.timeZone())).with(java.time.temporal.TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        return new RunPlanEngine.Inputs(i.schemaVersion(),i.goalKind(),goal,start,start.plusWeeks(weeks).minusDays(1),i.timeZone(),true,
            i.experience(),mode,i.baselineWeeklyM(),i.baselineRunsPerWeek(),i.longestRecentM(),true,i.availableWeekdays(),i.runsPerWeek(),i.longRunWeekday(),i.volume(),i.difficulty(),null,i.title(),null,i.units());
    }
    private Activity actual(Runner owner,String name,LocalDateTime start) {
        var a=new Activity();a.setRunner(owner);a.setActivityType(ActivityType.RUN);a.setProvider(ImportProvider.MANUAL);a.setName(name);a.setStartTime(start);a.setDistanceMeters(2300d);a.setDistanceKm(2.3);a.setDurationSeconds(900L);return activities.saveAndFlush(a);
    }
}
