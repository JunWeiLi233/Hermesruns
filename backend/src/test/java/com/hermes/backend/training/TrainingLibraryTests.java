package com.hermes.backend.training;

import org.junit.jupiter.api.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static com.hermes.backend.training.TrainingStore.map;

class TrainingLibraryTests extends TrainingFixture {
    TrainingLibrary library;
    @BeforeEach void library() { library=new TrainingLibrary(db,acl); }
    @Test void serverCompilesAndPinsImmutableWorkoutVersions() {
        var first=library.saveWorkout(coach,null,map("title","Original effort","source","10m @65% Warm up","sport","Running"),null);
        var second=library.saveWorkout(coach,(String)first.get("id"),map("title","Changed effort","source","20m @70% Steady","sport","Running"),1L);
        assertThat(second.get("version")).isEqualTo(2);
        assertThat(library.workout(coach,(String)first.get("id"),1).get("minutes")).isEqualTo(10.0);
        assertThatThrownBy(()->library.workout(stranger,(String)first.get("id"),1)).isInstanceOf(TrainingFailure.class);
        assertThatThrownBy(()->library.saveWorkout(coach,(String)first.get("id"),map("title","Stale","source","5m @50% Easy","sport","Running"),1L)).isInstanceOf(TrainingFailure.class);
    }
    @Test void plansRehydrateSourceInsteadOfTrustingClientDurationOrTitle() {
        var w=library.saveWorkout(coach,null,map("title","Original effort","source","10m @65% Warm up","sport","Running"),null);
        var p=library.savePlan(coach,map("title","Foundation","items",List.of(map("workoutId",w.get("id"),"sourceVersion",1,"day",2,"minutes",9000,"title","Forged"))));
        var item=(Map<?,?>)((List<?>)p.get("items")).get(0);
        assertThat(item.get("minutes")).isEqualTo(10.0);assertThat(item.get("title")).isEqualTo("Original effort");
    }
    @Test void sourceIsBoundedAndNestedRepeatsAreRejected() {
        assertThatThrownBy(()->library.saveWorkout(coach,null,map("title","Bad","source","2x\n  2x\n    3m @90% Hard","sport","Running"),null)).isInstanceOf(TrainingFailure.class);
        assertThatThrownBy(()->library.saveWorkout(coach,null,map("title","Bad","source","x".repeat(65537),"sport","Running"),null)).isInstanceOf(TrainingFailure.class);
        assertThat(TrainingWorkout.compile("2x\n  2m @150bpm Repeat\n  1m @60% Recovery").get("minutes")).isEqualTo(6.0);
    }
    @Test void immutablePlanPreviewRechecksPermissionAndRevisionAtCommit() {
        var w=library.saveWorkout(coach,null,map("title","Original effort","source","10m @65% Warm up","sport","Running"),null);
        var plan=library.savePlan(coach,map("title","Foundation","items",List.of(map("workoutId",w.get("id"),"sourceVersion",1,"day",0))));
        var grant=acl.request(coach,athlete,"coach",List.of());acl.decide(athlete,(String)grant.get("id"),"accepted");
        var applied=new ArrayList<String>();
        var bulk=new TrainingBulk(db,acl,library,(actor,subject,items,date,key)->{applied.add(subject);return List.of();});
        var preview=bulk.preview(coach,"plan",map("planId",plan.get("id"),"athleteIds",List.of(athlete,stranger),"date","2026-10-19"));
        acl.decide(athlete,(String)grant.get("id"),"revoked");
        var result=bulk.commit(coach,(String)preview.get("id"),(String)preview.get("hash"));
        assertThat(applied).isEmpty();assertThat(result.toString()).contains("denied");
        assertThatThrownBy(()->bulk.commit(coach,(String)preview.get("id"),"tampered")).isInstanceOf(TrainingFailure.class);
    }
    @Test void bulkReplayDoesNotApplyTwiceAndNeverLeaksARevokedReceipt() {
        var w=library.saveWorkout(coach,null,map("title","Original effort","source","10m @65% Warm up","sport","Running"),null);
        var p=library.savePlan(coach,map("title","Foundation","items",List.of(map("workoutId",w.get("id"),"sourceVersion",1,"day",0))));
        var g=acl.request(coach,athlete,"coach",List.of());acl.decide(athlete,(String)g.get("id"),"accepted");
        var applied=new ArrayList<String>();var b=new TrainingBulk(db,acl,library,(actor,subject,items,date,key)->{applied.add(subject);return List.of();});
        var v=b.preview(coach,"plan",map("planId",p.get("id"),"athleteIds",List.of(athlete),"date","2026-10-19"));
        b.commit(coach,(String)v.get("id"),(String)v.get("hash"));b.commit(coach,(String)v.get("id"),(String)v.get("hash"));assertThat(applied).hasSize(1);
        acl.revokeAll(athlete);assertThat(b.commit(coach,(String)v.get("id"),(String)v.get("hash")).toString()).contains("denied");
    }
    @Test void deniedBulkTargetsExposeNeitherProfileNameNorRevision(){
        var bulk=new TrainingBulk(db,acl,library,(actor,subject,items,date,key)->List.of());
        var preview=bulk.preview(coach,"configuration",map("athleteIds",List.of(stranger,UUID.randomUUID().toString()),"units","metric"));
        var target=(Map<?,?>)((List<?>)preview.get("targets")).get(0);
        assertThat(target.containsKey("name")).isFalse();assertThat(target.containsKey("revision")).isFalse();
        var outcome=(Map<?,?>)((List<?>)bulk.commit(coach,(String)preview.get("id"),(String)preview.get("hash")).get("outcomes")).get(0);
        assertThat(outcome.containsKey("name")).isFalse();
    }
}
