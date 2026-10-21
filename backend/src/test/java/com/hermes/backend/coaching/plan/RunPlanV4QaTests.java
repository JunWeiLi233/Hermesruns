package com.hermes.backend.coaching.plan;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class RunPlanV4QaTests {
    private static final LocalDate START=LocalDate.of(2026,10,19);
    private final RunPlanEngine engine=new RunPlanEngine();
    private RunPlanEngine.Inputs input(LocalDate start,LocalDate end,int goal,int frequency,String volume,String difficulty) {
        return new RunPlanEngine.Inputs(1,"DISTANCE",goal,start,end,"America/New_York",true,"INTERMEDIATE","DISTANCE",
            30000,5,6000,true,List.of(1,2,3,4,5,6,7),frequency,7,volume,difficulty,null,"QA – 渐进 Élan 🏃",null,"KM");
    }
    private List<RunPlanEngine.Day> history(RunPlanEngine.Candidate plan,LocalDate today) {
        return plan.days().stream().filter(d->d.localDate().isBefore(today)).map(d->d.identified("kept-"+d.localDate(),"original-version")).toList();
    }
    @Test void earlierGoalUsesTheNewTaperCeilingEvenWhenTheWeekStartsWithRetainedBuildDays() {
        var old=engine.generate(input(START,START.plusWeeks(12).minusDays(1),5000,5,"STANDARD","EASY"),START,List.of());
        var today=START.plusWeeks(8).plusDays(2);var kept=history(old,today);
        var changed=engine.generate(input(START,START.plusWeeks(10).minusDays(1),5000,3,"STANDARD","EASY"),today,kept);
        var current=changed.weeks().stream().filter(w->w.startDate().equals(START.plusWeeks(8))).findFirst().orElseThrow();
        var future=current.days().stream().filter(d->!d.localDate().isBefore(today)&&d.targetDistanceM()!=null).toList();
        assertFalse(future.isEmpty());assertTrue(future.stream().allMatch(d->d.phase().equals("TAPER")));
        assertTrue(future.stream().allMatch(d->d.targetDistanceM()<=4300),"New taper session exceeds 80% of the 5400 m reset ceiling: "+future);
        assertEquals("TAPER",current.phase());assertEquals(kept,changed.days().subList(0,kept.size()));
    }
    @Test void shiftedStartUsesNewRecoveryRulesWithoutRelabelingHistoricalBuildDays() {
        var end=START.plusWeeks(12).minusDays(1);
        var old=engine.generate(input(START,end,5000,5,"STANDARD","EASY"),START,List.of());
        var today=START.plusWeeks(2).plusDays(2);var kept=history(old,today);
        var changed=engine.generate(input(START.minusWeeks(1),end,5000,3,"STANDARD","EASY"),today,kept);
        var current=changed.weeks().stream().filter(w->w.startDate().equals(START.plusWeeks(2))).findFirst().orElseThrow();
        var future=current.days().stream().filter(d->!d.localDate().isBefore(today)&&d.targetDistanceM()!=null).toList();
        assertFalse(future.isEmpty());assertTrue(future.stream().allMatch(d->d.phase().equals("RECOVERY")));
        assertTrue(future.stream().allMatch(d->d.targetDistanceM()<=4300),"New recovery session exceeds reset ceiling: "+future);
        assertEquals("RECOVERY",current.phase());
        for(var d:kept)assertEquals(d,changed.days().stream().filter(next->next.localDate().equals(d.localDate())).findFirst().orElseThrow());
    }
    @Test void partialWeeksAndDstKeepTargetsDeterministicAndWithinTheInitialCeiling() {
        for(int goal:List.of(5000,10000))for(int offset:List.of(0,2,6))for(int tail:List.of(0,1,6))
        for(int frequency:List.of(3,4,5))for(String volume:List.of("LOWER","STANDARD","HIGHER"))for(String difficulty:List.of("EASY","HIGHER")) {
            var start=START.plusDays(offset);var i=input(start,start.plusWeeks(goal==5000?8:10).minusDays(1).plusDays(tail),goal,frequency,volume,difficulty);
            var p=engine.generate(i,start,List.of());assertEquals(p,engine.generate(i,start,List.of()));
            assertEquals(java.time.temporal.ChronoUnit.DAYS.between(i.startDate(),i.endDate())+1,p.days().size());
            assertEquals(p.days().size(),p.days().stream().map(RunPlanEngine.Day::localDate).distinct().count());
            assertTrue(p.weeks().get(0).days().stream().allMatch(d->Objects.requireNonNullElse(d.targetDistanceM(),0)<=5400));
            assertEquals(goal,p.days().get(p.days().size()-1).targetDistanceM());
            p.days().forEach(d->assertEquals(Objects.requireNonNullElse(d.targetDistanceM(),0).intValue(),d.steps().stream().mapToInt(s->Objects.requireNonNullElse(s.distanceM(),0)).sum()));
        }
    }
    @Test void frequencyDropsAtEveryFullRemainingWeekPreserveHistoryAndResetTheFirstFutureCeiling() {
        var end=START.plusWeeks(12).minusDays(1);var old=engine.generate(input(START,end,5000,5,"STANDARD","EASY"),START,List.of());
        for(int week=1;week<12;week++) {
            var today=START.plusWeeks(week);var kept=history(old,today);
            var next=engine.generate(input(START,end,5000,3,"STANDARD","EASY"),today,kept);
            assertEquals(kept,next.days().subList(0,kept.size()));
            next.weeks().get(week).days().stream().filter(d->!d.workoutType().equals("EVENT"))
                .forEach(d->assertTrue(Objects.requireNonNullElse(d.targetDistanceM(),0)<=5400));
        }
    }
    @Test void tighterUserCapsCannotAddDistanceAfterTheExposurePass() {
        for(String volume:List.of("LOWER","STANDARD","HIGHER")) {
            var i=input(START,START.plusWeeks(12).minusDays(1),5000,3,volume,"HIGHER");
            var normal=engine.generate(i,START,List.of());var capped=engine.generate(i.withCaps(new RunPlanEngine.SessionCaps(4000,5000,4000,4000,null)),START,List.of());
            for(int n=0;n<capped.days().size();n++) {
                var d=capped.days().get(n);assertTrue(Objects.requireNonNullElse(d.targetDistanceM(),0)<=Objects.requireNonNullElse(normal.days().get(n).targetDistanceM(),0));
            }
        }
    }
}
