package com.hermes.backend.coaching.plan;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class RunPlanEngineTests {
    @Test void rejectsABaselineThatCannotFitItsFourWeekMedianRunCountAndLongestRun() {
        var i=inputs("DISTANCE",5000,8);
        var impossible=new RunPlanEngine.Inputs(i.schemaVersion(),i.goalKind(),i.goalDistanceM(),i.startDate(),i.endDate(),i.timeZone(),true,
            i.experience(),i.trainingMode(),18000,3,2000,true,i.availableWeekdays(),3,i.longRunWeekday(),i.volume(),"EASY",null,i.title(),null,i.units());
        assertEquals("BASELINE_INCONSISTENT",assertThrows(RunPlanEngine.Invalid.class,()->new RunPlanEngine().generate(impossible,TODAY,List.of())).code);
    }
    @Test void baselineConsistencyAllowsTheHalfRunLostByFlooringAnEvenMedian() {
        var i=inputs("DISTANCE",5000,8);
        // Four weeks: counts 3,3,4,4; every run 2 km. Weekly median 7 km, floored count 3.
        var boundary=new RunPlanEngine.Inputs(i.schemaVersion(),i.goalKind(),i.goalDistanceM(),i.startDate(),i.endDate(),i.timeZone(),true,
            i.experience(),i.trainingMode(),7000,3,2000,true,i.availableWeekdays(),3,i.longRunWeekday(),i.volume(),"EASY",null,i.title(),null,i.units());
        assertDoesNotThrow(()->new RunPlanEngine().generate(boundary,TODAY,List.of()));
    }
    @Test void singleMovePreservesTargetsAndRejectsOccupiedHistoryAndRecoveryViolations() {
        var engine=new RunPlanEngine();var i=inputs("DISTANCE",5000,8);
        var original=engine.generate(i,TODAY,List.of()).days().stream().map(d->d.identified(UUID.randomUUID().toString(),"old")).toList();
        var source=original.get(1);var target=TODAY.plusDays(2);
        var changed=engine.move(i,original,source.id(),target,TODAY);
        assertEquals("REST",changed.days().get(1).workoutType());
        assertEquals(source.steps(),changed.days().get(2).steps());assertEquals(source.targetDistanceM(),changed.days().get(2).targetDistanceM());
        assertEquals(RunPlanEngine.weeks(original).get(0).trainingDistanceM(),changed.weeks().get(0).trainingDistanceM());
        assertTrue(changed.warnings().contains("MOVE_OUTSIDE_AVAILABILITY"));
        assertEquals("MOVE_DATE_OCCUPIED",assertThrows(RunPlanEngine.Invalid.class,()->engine.move(i,original,source.id(),TODAY.plusDays(3),TODAY)).code);
        assertEquals("MOVE_WEEK_BOUNDARY",assertThrows(RunPlanEngine.Invalid.class,()->engine.move(i,original,source.id(),TODAY.plusDays(9),TODAY)).code);
        assertEquals("MOVE_NOT_ALLOWED",assertThrows(RunPlanEngine.Invalid.class,()->engine.move(i,original,source.id(),TODAY,TODAY)).code);
        var timed=engine.generate(inputs("RUN_WALK",5000,12),TODAY,List.of()).days().stream().map(d->d.identified(UUID.randomUUID().toString(),"old")).toList();
        assertEquals("PRESERVED_HISTORY_CONFLICT",assertThrows(RunPlanEngine.Invalid.class,()->engine.move(inputs("RUN_WALK",5000,12),timed,timed.get(1).id(),target,TODAY)).code);
    }
    @Test void sessionCapsReduceOnlyEligibleTargetsWithoutChangingTheGoalOrHistory() {
        var engine=new RunPlanEngine();var i=inputs("DISTANCE",5000,8);
        var original=engine.generate(i,TODAY,List.of());
        var capped=engine.generate(i.withCaps(new RunPlanEngine.SessionCaps(4000,5000,4000,4000,null)),TODAY,List.of());
        assertTrue(capped.warnings().contains("SESSION_CAPS_APPLIED"));
        for(int n=0;n<capped.days().size();n++) {
            var d=capped.days().get(n);var old=original.days().get(n);
            if(d.workoutType().equals("EVENT")){assertEquals(old,d);continue;}
            if(d.targetDistanceM()!=null) {
                assertTrue(d.targetDistanceM()<=old.targetDistanceM());
                assertTrue(d.targetDistanceM()<=(d.workoutType().equals("LONG")?5000:4000));
                assertEquals(d.targetDistanceM().intValue(),d.steps().stream().mapToInt(s->s.distanceM()).sum());
            }
        }
        var kept=original.days().subList(0,7).stream().map(d->d.identified(UUID.randomUUID().toString(),"old")).toList();
        var next=engine.generate(i.withCaps(new RunPlanEngine.SessionCaps(4000,5000,4000,4000,null)),TODAY.plusWeeks(1),kept);
        assertEquals(kept,next.days().subList(0,7));
    }
    @Test void timedCapsIncludeWarmupAndCooldownAndRejectWrongTargetUnits() {
        var engine=new RunPlanEngine();var i=inputs("RUN_WALK",5000,12);
        var capped=engine.generate(i.withCaps(new RunPlanEngine.SessionCaps(null,null,null,null,1200)),TODAY,List.of());
        capped.days().stream().filter(d->d.workoutType().equals("RUN_WALK")).forEach(d->{
            assertTrue(d.targetDurationS()<=1200);assertNull(d.targetDistanceM());
            assertEquals(d.targetDurationS().intValue(),d.steps().stream().mapToInt(s->s.durationS()).sum());
        });
        assertEquals("SESSION_CAPS_INVALID",assertThrows(RunPlanEngine.Invalid.class,()->engine.generate(i.withCaps(new RunPlanEngine.SessionCaps(2000,null,null,null,null)),TODAY,List.of())).code);
        assertEquals("SESSION_CAPS_INVALID",assertThrows(RunPlanEngine.Invalid.class,()->engine.generate(i.withCaps(new RunPlanEngine.SessionCaps(null,null,null,null,600)),TODAY,List.of())).code);
        var distance=inputs("DISTANCE",5000,8).withCaps(new RunPlanEngine.SessionCaps(1000,1000,1000,1000,null));
        assertEquals("SESSION_CAPS_INFEASIBLE",assertThrows(RunPlanEngine.Invalid.class,()->engine.generate(distance,TODAY,List.of())).code);
    }
    static final LocalDate TODAY=LocalDate.of(2026,10,19);
    static RunPlanEngine.Inputs inputs(String mode,int goal,int weeks) {
        return new RunPlanEngine.Inputs(1,"DISTANCE",goal,TODAY,TODAY.plusWeeks(weeks).minusDays(1),"America/New_York",true,
            "INTERMEDIATE",mode,goal==5000?18000:24000,3,goal==5000?6000:8000,true,List.of(2,4,7),3,7,"STANDARD",
            mode.equals("RUN_WALK")?"EASY":"STANDARD",null,"A plan",null,"KM");
    }
    @Test void fullCalendarsAreDeterministicAndTargetsSumExactly() {
        var engine=new RunPlanEngine();
        for(var i:List.of(inputs("DISTANCE",5000,8),inputs("DISTANCE",10000,10),inputs("RUN_WALK",5000,12))) {
            var out=engine.generate(i,TODAY,List.of());
            assertEquals(out,engine.generate(i,TODAY,List.of()));
            assertEquals(java.time.temporal.ChronoUnit.DAYS.between(i.startDate(),i.endDate())+1,out.days().size());
            assertEquals("EVENT",out.days().get(out.days().size()-1).workoutType());
            for(var day:out.days()) {
                assertTrue(day.steps().size()<=32);
                assertEquals(Objects.requireNonNullElse(day.targetDistanceM(),0).intValue(),day.steps().stream().mapToInt(s->Objects.requireNonNullElse(s.distanceM(),0)).sum());
                assertEquals(Objects.requireNonNullElse(day.targetDurationS(),0).intValue(),day.steps().stream().mapToInt(s->Objects.requireNonNullElse(s.durationS(),0)).sum());
            }
        }
    }
    @Test void progressionRecoveryAndTaperNeverUseRecoveryAsBuildAnchor() {
        var weeks=new RunPlanEngine().generate(inputs("DISTANCE",10000,10),TODAY,List.of()).weeks();
        assertEquals("ADAPT",weeks.get(0).phase());assertEquals("RECOVERY",weeks.get(3).phase());
        assertTrue(weeks.get(4).trainingDistanceM()>weeks.get(2).trainingDistanceM());
        assertTrue(weeks.get(4).trainingDistanceM()<=weeks.get(2).trainingDistanceM()*1.05);
        assertEquals("TAPER",weeks.get(8).phase());assertEquals(10000,weeks.get(9).eventDistanceM());
    }
    @Test void rejectsImpossibleSpacingRatherThanSqueezing() {
        var i=inputs("RUN_WALK",5000,12);
        var bad=new RunPlanEngine.Inputs(i.schemaVersion(),i.goalKind(),i.goalDistanceM(),i.startDate(),i.endDate(),i.timeZone(),true,i.experience(),i.trainingMode(),0,0,0,true,List.of(1,2,3),3,3,i.volume(),i.difficulty(),null,i.title(),null,"KM");
        assertEquals("RECOVERY_SPACING",assertThrows(RunPlanEngine.Invalid.class,()->new RunPlanEngine().generate(bad,TODAY,List.of())).code);
    }
    @Test void partialFirstWeekDropsMissingDaysAndKeepsPublishedHistory() {
        var i=inputs("DISTANCE",5000,8);var engine=new RunPlanEngine();var original=engine.generate(i,TODAY,List.of());
        var history=original.days().subList(0,7).stream().map(d->d.identified(UUID.randomUUID().toString(),"source")).toList();
        var updated=engine.generate(i,TODAY.plusWeeks(1),history);
        assertEquals(history,updated.days().subList(0,7));
    }
    @Test void timedTrainingNeverInventsDistanceOrPace() {
        var out=new RunPlanEngine().generate(inputs("RUN_WALK",5000,12),TODAY,List.of());
        out.days().stream().filter(d->d.workoutType().equals("RUN_WALK")).forEach(d->{assertNull(d.targetDistanceM());assertTrue(d.steps().stream().allMatch(s->s.paceMinSPerKm()==null));});
    }
    @Test void aDistanceGoalDoesNotTurnTimedTrainingIntoZeroKilometers() {
        var weeks=new RunPlanEngine().generate(inputs("RUN_WALK",5000,12),TODAY,List.of()).weeks();
        var goalWeek=weeks.get(weeks.size()-1);
        assertEquals(5000,goalWeek.eventDistanceM());assertEquals(5000,goalWeek.plannedDistanceM());
        assertTrue(goalWeek.trainingDurationS()>0);assertNull(goalWeek.trainingDistanceM());
    }
    @Test void mondayGoalRestsThePreviousSundayAcrossTheBlockBoundary() {
        var old=inputs("RUN_WALK",5000,12);var i=new RunPlanEngine.Inputs(old.schemaVersion(),old.goalKind(),old.goalDistanceM(),old.startDate(),old.endDate().plusDays(1),old.timeZone(),true,old.experience(),old.trainingMode(),0,0,0,true,old.availableWeekdays(),3,7,old.volume(),old.difficulty(),null,old.title(),null,"KM");
        var days=new RunPlanEngine().generate(i,TODAY,List.of()).days();assertEquals("REST",days.get(days.size()-2).workoutType());assertEquals("EVENT",days.get(days.size()-1).workoutType());
    }
    @Test void maximumCalendarBudgetHoldsForEveryDistancePreferenceAndLongDay() {
        var engine=new RunPlanEngine();
        for(int goal:List.of(5000,10000))for(String volume:List.of("LOWER","STANDARD","HIGHER"))
        for(String difficulty:List.of("EASY","STANDARD","HIGHER"))for(int frequency=3;frequency<=5;frequency++)for(int longDay=1;longDay<=7;longDay++) {
            var i=new RunPlanEngine.Inputs(1,"RACE",goal,TODAY,TODAY.plusDays(181),"America/New_York",true,"ADVANCED","DISTANCE",
                30000,4,9000,true,List.of(1,2,3,4,5,6,7),frequency,longDay,volume,difficulty,null,"Élan 🏃",null,"MI");
            var out=engine.generate(i,TODAY,List.of());assertEquals(182,out.days().size());
            for(var d:out.days()) {
                assertEquals(Objects.requireNonNullElse(d.targetDistanceM(),0).intValue(),d.steps().stream().mapToInt(s->Objects.requireNonNullElse(s.distanceM(),0)).sum());
                assertTrue(d.steps().size()<=32);
            }
        }
    }
    @Test void timedBudgetsHoldAcrossPartialWeeksAndDaylightSaving() {
        var engine=new RunPlanEngine();
        for(int offset=0;offset<7;offset++)for(String volume:List.of("LOWER","STANDARD","HIGHER")) {
            var start=TODAY.plusDays(offset);
            var i=new RunPlanEngine.Inputs(1,"DISTANCE",5000,start,start.plusDays(181),"America/New_York",true,"BEGINNER","RUN_WALK",
                0,0,0,true,List.of(2,4,7),3,7,volume,"EASY",null,"DST",null,"KM");
            var out=engine.generate(i,TODAY,List.of());assertEquals(182,out.days().size());
            for(int n=0;n<out.days().size();n++) {
                var d=out.days().get(n);assertEquals(start.plusDays(n),d.localDate());assertTrue(d.steps().size()<=32);
                assertEquals(Objects.requireNonNullElse(d.targetDurationS(),0).intValue(),d.steps().stream().mapToInt(s->Objects.requireNonNullElse(s.durationS(),0)).sum());
            }
        }
    }
    @Test void oldResultsNeverSupplyPaceAndIncompatibleRetainedTargetsReject() {
        var engine=new RunPlanEngine();var old=inputs("DISTANCE",5000,12);
        var i=new RunPlanEngine.Inputs(1,old.goalKind(),5000,old.startDate(),old.endDate(),old.timeZone(),true,old.experience(),old.trainingMode(),
            old.baselineWeeklyM(),3,old.longestRecentM(),true,old.availableWeekdays(),3,7,old.volume(),old.difficulty(),new RunPlanEngine.Result(5000,1800,TODAY.minusDays(181)),old.title(),null,"KM");
        var out=engine.generate(i,TODAY,List.of());assertTrue(out.warnings().contains("RESULT_TOO_OLD"));
        assertTrue(out.days().stream().flatMap(d->d.steps().stream()).allMatch(s->s.paceMinSPerKm()==null));
        var d=out.days().stream().filter(day->day.workoutType().equals("LONG")).findFirst().orElseThrow();
        var impossible=new RunPlanEngine.Day("kept",d.localDate(),"LONG",d.phase(),100000,null,
            List.of(new RunPlanEngine.Step(0,"RUN",100000,null,1,null,null,"EASY")),"COMPLETED","UNLOGGED","original",1);
        assertEquals("PRESERVED_HISTORY_CONFLICT",assertThrows(RunPlanEngine.Invalid.class,()->engine.generate(i,TODAY,List.of(impossible))).code);
    }
}
