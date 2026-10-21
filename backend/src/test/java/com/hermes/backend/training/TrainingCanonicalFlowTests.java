package com.hermes.backend.training;

import com.hermes.backend.runner.*;
import com.hermes.backend.activity.*;
import com.hermes.backend.coaching.plan.TrainingCalendarBridge;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static com.hermes.backend.training.TrainingStore.map;

@SpringBootTest(properties={
 "spring.datasource.url=jdbc:h2:mem:workspace-canonical;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
 "spring.datasource.driver-class-name=org.h2.Driver","spring.jpa.hibernate.ddl-auto=create-drop",
 "app.training-workspace.enabled=true","app.training-workspace.migrate=true",
 "app.official-course.startup-seed.enabled=false","strava.sync.enabled=false","garmin.wellness.sync.enabled=false",
 "app.coach.nightly.enabled=false","app.local-shared-runner.enabled=false"
})
class TrainingCanonicalFlowTests {
 @Autowired TrainingStore db; @Autowired TrainingAccess acl; @Autowired TrainingAthletes athletes;
 @Autowired TrainingLibrary library; @Autowired TrainingCalendarBridge calendar;
 @Autowired RunnerRepository runners; @Autowired ActivityRepository activities;
 @Autowired AccountDeletionService deletion;
 @Autowired TrainingTeams teams;
 @Autowired TrainingJobs jobs;
 @Autowired com.hermes.backend.coaching.plan.RunPlanService plans;
 String owner,other,coach;
 @BeforeEach void setup(){owner=user("Owner");other=user("Other");coach=user("Coach");}
 String user(String name){var r=runners.saveAndFlush(new Runner("workspace-"+UUID.randomUUID()+"@example.test","active"));return db.ensure(r.getId(),name,"America/New_York");}
 @Test void queuedGpxUsesTheRealCanonicalImporterAndDeduplicatesReplay()throws Exception{
  byte[] file=java.nio.file.Files.readAllBytes(java.nio.file.Path.of("../replica/intervals-icu/app/fixtures/original-example.gpx"));
  var job=jobs.enqueue(owner,"original-example.gpx",file,UUID.randomUUID().toString());assertThat(jobs.workOnce()).isTrue();
  var status=jobs.status(owner,(String)job.get("id"));assertThat(status.get("state")).isEqualTo("succeeded");assertThat(athletes.list(owner,owner).get("items")).asList().hasSize(1);
  jobs.enqueue(owner,"original-example.gpx",file,UUID.randomUUID().toString());jobs.workOnce();assertThat(athletes.list(owner,owner).get("items")).asList().hasSize(1);
  assertThatThrownBy(()->jobs.status(other,(String)job.get("id"))).isInstanceOf(TrainingFailure.class);
 }
 @Test void manualSessionUsesCanonicalActivityAndUntimedCivilDate(){
  var a=athletes.manual(owner,owner,map("title","Untimed original","date","2026-10-14","minutes",40,"sport","Running","rpe",4));
  var canonical=activities.findById(((Number)db.one("select activity_id from tw_activity where id=?",a.get("id")).get("activity_id")).longValue()).orElseThrow();
  assertThat(canonical.getStartTime()).isNull();assertThat(a.get("date")).isEqualTo("2026-10-14");assertThat(((Number)a.get("load")).doubleValue()).isEqualTo(80);
  assertThatThrownBy(()->athletes.detail(other,(String)a.get("id"))).isInstanceOf(TrainingFailure.class);
 }
 @Test void workspaceReflectsCanonicalHermesProfileChanges(){
  var runner=runners.findById(db.runner(owner)).orElseThrow();runner.setDisplayName("Updated Hermes athlete");runner.setTimeZone("Pacific/Auckland");runner.setMaxHeartRateBpm(181);runners.saveAndFlush(runner);
  var profile=athletes.me(owner);assertThat(profile.get("name")).isEqualTo("Updated Hermes athlete");assertThat(profile.get("zone")).isEqualTo("Pacific/Auckland");assertThat(((Number)profile.get("maxHr")).intValue()).isEqualTo(181);
 }
 @Test void comparisonListIncludesRecordedSummaryWithoutExposingSamples(){
  var a=athletes.manual(owner,owner,map("title","Comparison summary","date","2026-10-14","minutes",52,"sport","Running","rpe",4));
  var canonical=activities.findById(((Number)a.get("canonicalId")).longValue()).orElseThrow();
  canonical.setDistanceKm(10.4);canonical.setAverageHeartRate(163d);activities.saveAndFlush(canonical);
  var listed=(List<?>)athletes.list(owner,owner).get("items");var summary=(Map<?,?>)listed.get(0);
  assertThat(summary.get("distanceKm")).isEqualTo(10.4);assertThat(summary.get("averageHeartRate")).isEqualTo(163d);
  assertThat((List<?>)summary.get("samples")).isEmpty();
  assertThatThrownBy(()->athletes.list(other,owner)).isInstanceOf(TrainingFailure.class);
 }
 @Test void authoredVersionRemainsReadableButCannotEnterTheGeneratedPlanLifecycle(){
  var event=athletes.event(owner,owner,map("title","Authored bridge","date","2026-10-14","minutes",20,"sport","Running"));
  var row=db.one("select plan_id,version_id from training_workout where id=?",java.util.UUID.fromString((String)event.get("id")));
   var runner=runners.findById(db.runner(owner)).orElseThrow();String planId=row.get("plan_id").toString();
   var version=plans.version(runner,planId,row.get("version_id").toString());
  assertThat(version.get("title")).isEqualTo("Authored training calendar");assertThat(version.get("weeks")).asList().hasSize(1);
   assertThat(plans.list(runner).get("plans")).asList().isEmpty();
   var internal=plans.plan(runner,planId);var inputs=internal.get("inputs");long revision=((Number)internal.get("revision")).longValue();
   assertThatThrownBy(()->plans.edit(runner,planId,map("inputs",inputs),"\""+revision+"\""))
       .isInstanceOf(com.hermes.backend.coaching.plan.RunPlanService.Failure.class).hasMessage("EXTERNAL_PLAN");
   assertThatThrownBy(()->plans.generate(runner,planId,map("clientKey",UUID.randomUUID().toString(),"inputs",inputs,"baseRevision",revision)))
       .isInstanceOf(com.hermes.backend.coaching.plan.RunPlanService.Failure.class).hasMessage("EXTERNAL_PLAN");
   assertThatThrownBy(()->plans.activate(runner,planId,map("clientKey",UUID.randomUUID().toString(),"versionId",row.get("version_id").toString())))
       .isInstanceOf(com.hermes.backend.coaching.plan.RunPlanService.Failure.class).hasMessage("EXTERNAL_PLAN");
   assertThatThrownBy(()->plans.archive(runner,planId,map("clientKey",UUID.randomUUID().toString(),"revision",revision)))
       .isInstanceOf(com.hermes.backend.coaching.plan.RunPlanService.Failure.class).hasMessage("EXTERNAL_PLAN");
   var actual=athletes.manual(owner,owner,map("title","Authored completion","date","2026-10-14","minutes",20,"sport","Running","rpe",3));
   athletes.link(owner,(String)event.get("id"),(String)actual.get("id"),1);
   assertThatThrownBy(()->plans.unlink(runner,planId,(String)event.get("id"),map("clientKey",UUID.randomUUID().toString(),"revision",2)))
       .isInstanceOf(com.hermes.backend.coaching.plan.RunPlanService.Failure.class).hasMessage("EXTERNAL_PLAN");
   assertThat(plans.plan(runner,planId).get("state")).isEqualTo("EXTERNAL");
   assertThat((List<?>)athletes.calendar(owner,owner,null,null).get("events")).filteredOn(item->((Map<?,?>)item).get("id").equals(event.get("id")))
       .extracting(item->String.valueOf(((Map<?,?>)item).get("state"))).containsExactly("completed");
 }
 @Test void coachedCalendarSnapshotsSurviveRevocationAndLinkOnlyOnce(){
  var g=acl.request(coach,owner,"coach",List.of());acl.decide(owner,(String)g.get("id"),"accepted");
  var event=athletes.event(coach,owner,map("title","Authored effort","date","2026-10-14","minutes",20,"sport","Running"));
  var a=athletes.manual(owner,owner,map("title","Done","date","2026-10-14","minutes",20,"sport","Running","rpe",3));
  athletes.link(owner,(String)event.get("id"),(String)a.get("id"),1);
  var second=athletes.event(owner,owner,map("title","Second","date","2026-10-14","minutes",20,"sport","Running"));
  assertThatThrownBy(()->athletes.link(owner,(String)second.get("id"),(String)a.get("id"),1)).isInstanceOf(TrainingFailure.class);
  acl.revokeAll(owner);assertThatThrownBy(()->athletes.calendar(coach,owner,null,null)).isInstanceOf(TrainingFailure.class);
  assertThat((List<?>)athletes.calendar(owner,owner,null,null).get("events")).hasSize(2);
 }
 @Test void wellnessUsesExistingAuthoritiesAndMasksFields(){
  athletes.saveWellness(owner,owner,"2026-10-14",map("sleep",7.5,"restingHr",49,"feeling",4),null);
  var g=acl.request(coach,owner,"read",List.of("sleep"));acl.decide(owner,(String)g.get("id"),"accepted");
  var result=athletes.wellness(coach,owner);var item=(Map<?,?>)((List<?>)result.get("items")).get(0);
  assertThat(item.containsKey("sleep")).isTrue();assertThat(item.containsKey("restingHr")).isFalse();assertThat(item.containsKey("feeling")).isFalse();
  assertThatThrownBy(()->athletes.saveWellness(coach,owner,"2026-10-14",map("sleep",8),1L)).isInstanceOf(TrainingFailure.class);
 }
 @Test void accountDeletionPurgesNewRecordsAlongWithCanonicalData(){
  var g=acl.request(coach,owner,"coach",List.of());acl.decide(owner,(String)g.get("id"),"accepted");
  var w=library.saveWorkout(owner,null,map("title","Original personal effort","source","10m @65% Warm up","sport","Running"),null);
  athletes.manual(owner,owner,map("title","Owned run","date","2026-10-14","minutes",20,"sport","Running","rpe",3));
  long id=db.runner(owner);deletion.deleteAccount(id);
  assertThat(runners.findById(id)).isEmpty();assertThat(db.rows("select id from tw_profile where id=?",owner)).isEmpty();
  assertThat(db.rows("select id from tw_workout where id=?",w.get("id"))).isEmpty();assertThat(db.rows("select id from tw_access where subject_id=?",owner)).isEmpty();
 }
 @Test void ordinaryTrainingReadDoesNotExposeWellnessEntryDates(){
  athletes.saveWellness(owner,owner,"2026-10-14",map("sleep",7),null);
  var g=acl.request(coach,owner,"read",List.of());acl.decide(owner,(String)g.get("id"),"accepted");
  assertThatThrownBy(()->athletes.wellness(coach,owner)).isInstanceOf(TrainingFailure.class);
 }
 @Test void staffOnlyRosterDoesNotExposePrivateCoMemberProfiles(){
  String team=(String)teams.create(owner,"Private membership").get("id");
  teams.join(other,team);teams.member(owner,team,other,"member");teams.join(coach,team);teams.member(owner,team,coach,"member");
  teams.update(owner,team,map("visibility","staff"),3);
  assertThat((List<?>)athletes.roster(other,null,false).get("items")).hasSize(1);
 }
 @Test void canonicalResolverPreservesIdentityAndDeniesUnrelatedUsers(){
  var row=new Activity();row.setRunner(runners.findById(db.runner(owner)).orElseThrow());row.setName("Resolver fixture");row.setProvider(ImportProvider.MANUAL);row.setActivityType(ActivityType.RUN);row.setMovingTimeSeconds(600);row=activities.saveAndFlush(row);long numeric=row.getId();
  var resolved=athletes.fromCanonical(owner,numeric);
  assertThat(resolved.get("canonicalId")).isEqualTo(numeric);assertThat(resolved.get("athleteId")).isEqualTo(owner);
  assertThat(athletes.detail(owner,(String)resolved.get("id")).get("canonicalId")).isEqualTo(numeric);
  assertThatThrownBy(()->athletes.fromCanonical(other,numeric)).isInstanceOf(TrainingFailure.class);
  var grant=acl.request(coach,owner,"read",List.of());acl.decide(owner,(String)grant.get("id"),"accepted");
  assertThat(athletes.fromCanonical(coach,numeric).get("id")).isEqualTo(resolved.get("id"));
  acl.revokeAll(owner);assertThatThrownBy(()->athletes.fromCanonical(coach,numeric)).isInstanceOf(TrainingFailure.class);
 }
 @Test void canonicalResolverRetainsProviderSourceRestrictions(){
  var row=new Activity();row.setRunner(runners.findById(db.runner(owner)).orElseThrow());row.setName("Restricted source fixture");row.setProvider(ImportProvider.STRAVA);row.setStravaApiSourced(true);row.setActivityType(ActivityType.RUN);row.setMovingTimeSeconds(600);row=activities.saveAndFlush(row);long numeric=row.getId();
  var grant=acl.request(coach,owner,"coach",List.of());acl.decide(owner,(String)grant.get("id"),"accepted");
  assertThat(athletes.fromCanonical(owner,numeric).get("canonicalId")).isEqualTo(numeric);
  assertThatThrownBy(()->athletes.fromCanonical(coach,numeric)).isInstanceOf(TrainingFailure.class);
 }
}
