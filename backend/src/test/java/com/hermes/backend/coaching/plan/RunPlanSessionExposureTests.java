package com.hermes.backend.coaching.plan;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class RunPlanSessionExposureTests {
    private static final LocalDate START=RunPlanEngineTests.TODAY;
    private final RunPlanEngine engine=new RunPlanEngine();
    private RunPlanEngine.Inputs input(int before,int after,String volume,String difficulty) {
        return new RunPlanEngine.Inputs(1,"DISTANCE",5000,START,START.plusWeeks(12).minusDays(1),"America/New_York",true,
            "INTERMEDIATE","DISTANCE",before*6000,before,6000,true,List.of(1,2,3,4,5,6,7),after,7,volume,difficulty,null,"Fewer days",null,"KM");
    }
    private int largest(RunPlanEngine.Week w) {
        return w.days().stream().filter(d->!d.workoutType().equals("EVENT")).mapToInt(d->Objects.requireNonNullElse(d.targetDistanceM(),0)).max().orElse(0);
    }
    private int floor50(int n){return n/50*50;}
    @Test void fewerDaysReduceMileageInsteadOfConcentratingItAcrossEveryDistanceWorkoutKind() {
        for(String volume:List.of("LOWER","STANDARD","HIGHER"))for(String difficulty:List.of("EASY","STANDARD","HIGHER"))
        for(int[] frequency:List.of(new int[]{5,3},new int[]{5,4},new int[]{4,3},new int[]{6,3},new int[]{7,5})) {
            var plan=engine.generate(input(frequency[0],frequency[1],volume,difficulty),START,List.of());
            assertEquals(5400,largest(plan.weeks().get(0)));
            assertEquals(5400*frequency[1],plan.weeks().get(0).trainingDistanceM());
            assertTrue(plan.warnings().contains("SESSION_EXPOSURE_REDUCED"));
            int anchor=5400,peak=5400;boolean first=true;
            for(var week:plan.weeks()) {
                int limit;
                if(week.phase().equals("TAPER"))limit=floor50(peak*(week==plan.weeks().get(plan.weeks().size()-1)?60:80)/100);
                else if(week.phase().equals("RECOVERY"))limit=floor50(anchor*80/100);
                else {
                    if(!first)anchor=floor50(Math.min(Math.min(anchor*105/100,anchor+500),6000));
                    first=false;peak=Math.max(peak,anchor);limit=anchor;
                }
                assertTrue(largest(week)<=limit,week.startDate()+" exceeds "+limit);
                assertEquals(week.trainingDistanceM().intValue(),week.days().stream().filter(d->!d.workoutType().equals("EVENT"))
                    .mapToInt(d->Objects.requireNonNullElse(d.targetDistanceM(),0)).sum());
                week.days().forEach(d->assertEquals(Objects.requireNonNullElse(d.targetDistanceM(),0).intValue(),
                    d.steps().stream().mapToInt(s->Objects.requireNonNullElse(s.distanceM(),0)).sum()));
            }
            assertEquals(5000,plan.days().get(plan.days().size()-1).targetDistanceM());
        }
    }
    @Test void lateFrequencyReductionRestartsFromTheConfirmedBaselineAndPreservesEveryHistoricalByte() {
        var original=engine.generate(input(5,5,"STANDARD","EASY"),START,List.of());
        var history=original.days().subList(0,14).stream().map(d->d.identified("kept-"+d.localDate(),"old-version")).toList();
        var plan=engine.generate(input(5,3,"STANDARD","EASY"),START.plusWeeks(2),history);
        assertEquals(history,plan.days().subList(0,14));
        assertEquals(5400,largest(plan.weeks().get(2)));
        assertEquals(16200,plan.weeks().get(2).trainingDistanceM());
    }
    @Test void aPartialFirstWeekDoesNotAdvanceTheFirstCompleteWeekCeiling() {
        var base=input(5,3,"STANDARD","EASY");
        var partial=new RunPlanEngine.Inputs(1,base.goalKind(),5000,START.plusDays(2),base.endDate(),base.timeZone(),true,base.experience(),base.trainingMode(),
            base.baselineWeeklyM(),5,6000,true,base.availableWeekdays(),3,7,base.volume(),base.difficulty(),null,base.title(),null,"KM");
        var plan=engine.generate(partial,START.plusDays(2),List.of());
        assertTrue(largest(plan.weeks().get(0))<=5400);assertEquals(5400,largest(plan.weeks().get(1)));
    }
    @Test void protectedFutureSessionsAreNeverReducedToMakeTheNewPlanAppearFeasible() {
        var i=input(5,3,"STANDARD","EASY");var date=START.plusDays(1);
        var kept=new RunPlanEngine.Day("kept",date,"EASY","ADAPT",7000,null,
            List.of(new RunPlanEngine.Step(0,"RUN",7000,null,1,null,null,"EASY")),"COMPLETED","UNLOGGED","old-version",2);
        var plan=engine.generate(i,START,List.of(kept));
        assertEquals(kept,plan.days().get(1));
        plan.weeks().get(0).days().stream().filter(d->!Objects.equals(d.id(),"kept"))
            .forEach(d->assertTrue(Objects.requireNonNullElse(d.targetDistanceM(),0)<=5400));
    }
    @Test void aShortenedIntervalMustStillRespectTheChosenEasySessionCap() {
        var base=input(5,3,"STANDARD","HIGHER");
        var i=new RunPlanEngine.Inputs(1,base.goalKind(),5000,START,START.plusWeeks(8).minusDays(1),base.timeZone(),true,base.experience(),base.trainingMode(),
            15000,5,3000,true,base.availableWeekdays(),3,7,base.volume(),base.difficulty(),null,base.title(),null,"KM")
            .withCaps(new RunPlanEngine.SessionCaps(3000,5000,3500,3500,null));
        var plan=engine.generate(i,START,List.of());
        assertTrue(plan.warnings().contains("SESSION_EXPOSURE_REDUCED"));
        plan.days().stream().filter(d->d.workoutType().equals("EASY")).forEach(d->assertTrue(d.targetDistanceM()<=3000));
        assertTrue(plan.warnings().contains("SESSION_CAPS_APPLIED"));
    }
    @Test void timedRunWalkIsNotConvertedToDistanceByTheExposureConstraint() {
        var plan=engine.generate(RunPlanEngineTests.inputs("RUN_WALK",5000,12),START,List.of());
        assertFalse(plan.warnings().contains("SESSION_EXPOSURE_REDUCED"));
        assertEquals(1320,plan.days().stream().filter(d->d.workoutType().equals("RUN_WALK")).findFirst().orElseThrow().targetDurationS());
    }
    @Test void largeBaselinesStillRespectTheAbsoluteWeeklyIncrementAfterSessionReduction() {
        var base=input(5,4,"HIGHER","EASY");
        var i=new RunPlanEngine.Inputs(1,base.goalKind(),5000,START,base.endDate(),base.timeZone(),true,base.experience(),base.trainingMode(),
            100000,5,20000,true,base.availableWeekdays(),4,7,base.volume(),base.difficulty(),null,base.title(),null,"KM");
        var plan=engine.generate(i,START,List.of());RunPlanEngine.Week anchor=null;
        assertEquals(72000,plan.weeks().get(0).trainingDistanceM());
        for(var week:plan.weeks()) {
            if(week.phase().equals("TAPER"))continue;
            if(anchor!=null) {
                int old=anchor.trainingDistanceM();
                int cap=week.phase().equals("RECOVERY")?floor50(old*80/100):floor50(Math.min(old*106/100,old+1500));
                assertTrue(week.trainingDistanceM()<=cap);
            }
            if(!week.phase().equals("RECOVERY"))anchor=week;
        }
    }
}
