package com.hermes.backend.coaching.plan;

import com.hermes.backend.activity.*;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.coaching.ReadinessService;
import com.hermes.backend.imports.ActivityStravaStreamService;
import com.hermes.backend.runner.*;
import com.hermes.backend.training.*;
import com.hermes.backend.weather.AcclimatizationService;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.PlatformTransactionManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:plan-metadata;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.driver-class-name=org.h2.Driver","spring.jpa.hibernate.ddl-auto=create-drop",
    "app.run-plans.approved-ruleset=hermes-road-v4","app.training-workspace.enabled=true",
    "app.training-workspace.migrate=true","app.official-course.startup-seed.enabled=false",
    "app.local-shared-runner.enabled=false","strava.sync.enabled=false","garmin.wellness.sync.enabled=false"
})
class RunPlanMetadataLinkTests {
    @Autowired RunPlanService plans;
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired ActivityPointRepository points;
    @Autowired ActivityDataAccess data;
    @Autowired PlatformTransactionManager transactions;
    @Autowired ApplicationEventPublisher events;
    @Autowired TrainingStore training;
    @Autowired TrainingAthletes athletes;

    record Fixture(Runner runner,String planId,String workoutId,Activity activity,
                   Map<String,Object> plan,Object workout,Object backlink) {}
    @SuppressWarnings("unchecked")
    Fixture linked() {
        var runner=runners.saveAndFlush(new Runner("metadata-"+UUID.randomUUID()+"@hermes.test","active"));
        String planId=RunPlanPaceFixture.seed(plans,transactions,runner);
        var sample=((List<Map<String,Object>>)plans.paceReview(runner,planId).get("sources")).get(0);
        var activity=activities.findById(Long.parseLong(sample.get("activityId").toString())).orElseThrow();
        var backlink=(Map<String,Object>)plans.backlink(runner,activity.getId()).get("link");
        String workoutId=backlink.get("workoutId").toString();
        return new Fixture(runner,planId,workoutId,activity,plans.plan(runner,planId),
                plans.detail(runner,planId,workoutId).get("workout"),backlink);
    }
    AuthService auth(Fixture fixture) {
        var auth=mock(AuthService.class);
        when(auth.findByAuthorizationHeader("Bearer metadata-test")).thenReturn(Optional.of(fixture.runner));
        return auth;
    }
    void unchanged(Fixture fixture) {
        assertEquals(fixture.backlink,plans.backlink(fixture.runner,fixture.activity.getId()).get("link"));
        assertEquals(fixture.plan,plans.plan(fixture.runner,fixture.planId));
        assertEquals(fixture.workout,plans.detail(fixture.runner,fixture.planId,fixture.workoutId).get("workout"));
    }
    @Test void readingPointsCanCachePreviewWithoutUnlinkingCompletion() {
        var fixture=linked();
        for(int index=0;index<2;index++) {
            var point=new ActivityPoint();point.setActivity(fixture.activity);point.setSequenceIndex(index);
            point.setLatitude(40+index*.001);point.setLongitude(-73+index*.001);points.saveAndFlush(point);
        }
        var controller=new ActivityController(auth(fixture),data,mock(ActivityStravaStreamService.class),
                mock(ElevationCorrectionService.class),mock(AcclimatizationService.class),mock(ReadinessService.class));
        assertEquals(200,controller.getActivityPoints(fixture.activity.getId(),"Bearer metadata-test").getStatusCode().value());
        assertNotNull(activities.findById(fixture.activity.getId()).orElseThrow().getRoutePreviewPath());
        unchanged(fixture);
    }
    @Test void nativeEffortEditPreservesCompletionAndPlanRevisions() {
        var fixture=linked();var controller=new ActivityEditController(auth(fixture),data,events);
        assertEquals(200,controller.editActivity(fixture.activity.getId(),"Bearer metadata-test",Map.of("perceivedExertion",6)).getStatusCode().value());
        assertEquals(6,activities.findById(fixture.activity.getId()).orElseThrow().getPerceivedExertion());
        unchanged(fixture);
    }
    @Test void trainingEffortEditPreservesCompletionAndPlanRevisions() {
        var fixture=linked();String actor=training.ensure(fixture.runner.getId(),"Metadata test","America/New_York");
        var activity=athletes.fromCanonical(actor,fixture.activity.getId());
        athletes.effort(actor,activity.get("id").toString(),Map.of("rpe",7),((Number)activity.get("revision")).longValue());
        assertEquals(7,activities.findById(fixture.activity.getId()).orElseThrow().getPerceivedExertion());
        unchanged(fixture);
    }
    @ParameterizedTest @ValueSource(strings={"distance","duration","date"})
    void changedPlanEvidenceStillUnlinksTheCompletion(String field) {
        var fixture=linked();var activity=fixture.activity;
        switch(field) {
            case "distance" -> activity.setDistanceMeters(activity.getDistanceMeters()+100);
            case "duration" -> activity.setDurationSeconds(activity.getDurationSeconds()+60);
            case "date" -> activity.setStartTime(activity.getStartTime().plusDays(1));
        }
        data.save(activity);
        assertNull(plans.backlink(fixture.runner,activity.getId()).get("link"));
        var workout=(RunPlanEngine.Day)plans.detail(fixture.runner,fixture.planId,fixture.workoutId).get("workout");
        assertEquals("PLANNED",workout.state());assertEquals("NONE",workout.completionSource());
        assertEquals(((RunPlanEngine.Day)fixture.workout).revision()+1,workout.revision());
    }
}
