package com.hermes.backend.coaching.plan;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.LocalDate;
import java.util.*;

/** Independent whole-session comparison. Not rep compliance, a race prediction or an automatic change. */
public final class RunPlanPaceReview {
    public record Sample(String workoutId,String activityId,String metricHash,double actualPace,double plannedPace) {}
    public record Analysis(String state,String direction,int percent,List<Sample> samples) {}
    public static Analysis assess(List<Sample> latest) {
        var samples=List.copyOf(latest.subList(0,Math.min(5,latest.size())));
        if(samples.size()<3)return new Analysis("NEED_MORE",null,100,samples);
        if(samples.stream().anyMatch(s->!Double.isFinite(s.actualPace)||s.actualPace<=0||
            !Double.isFinite(s.plannedPace)||s.plannedPace<=0))
            return new Analysis("VARIABLE",null,100,samples);
        var ratios=samples.stream().map(s->BigDecimal.valueOf(s.actualPace)
            .divide(BigDecimal.valueOf(s.plannedPace),MathContext.DECIMAL128)).sorted().toList();
        if(ratios.get(ratios.size()-1).subtract(ratios.get(0)).compareTo(new BigDecimal("0.03"))>0)
            return new Analysis("VARIABLE",null,100,samples);
        int middle=ratios.size()/2;
        var median=ratios.size()%2==0?ratios.get(middle-1).add(ratios.get(middle)).divide(BigDecimal.valueOf(2)):ratios.get(middle);
        return median.compareTo(new BigDecimal("0.95"))<0?new Analysis("RECOMMENDED","FASTER",98,samples):median.compareTo(new BigDecimal("1.05"))>0?
            new Analysis("RECOMMENDED","SLOWER",102,samples):new Analysis("ON_TRACK",null,100,samples);
    }
    public static RunPlanEngine.Candidate preview(List<RunPlanEngine.Day> published,LocalDate today,int percent) {
        if(percent!=98&&percent!=102)throw new RunPlanEngine.Invalid("PACE_NO_UPDATE");
        int count=0;List<RunPlanEngine.Day> days=new ArrayList<>();
        for(var d:published) {
            if(!d.localDate().isBefore(today)&&d.state().equals("PLANNED")) {
                var steps=new ArrayList<RunPlanEngine.Step>();
                for(var s:d.steps()) {
                    Integer min=s.paceMinSPerKm(),max=s.paceMaxSPerKm();
                    if(min!=null&&max!=null){min=Math.max(1,(int)Math.round(min*percent/100d));max=Math.max(min,(int)Math.round(max*percent/100d));count++;}
                    steps.add(new RunPlanEngine.Step(s.sequence(),s.stepType(),s.distanceM(),s.durationS(),s.repetitions(),min,max,s.effortKey()));
                }
                d=new RunPlanEngine.Day(null,d.localDate(),d.workoutType(),d.phase(),d.targetDistanceM(),d.targetDurationS(),List.copyOf(steps),d.state(),d.completionSource(),null,0);
            }
            days.add(d);
        }
        if(count==0)throw new RunPlanEngine.Invalid("PACE_NO_UPDATE");
        return new RunPlanEngine.Candidate(List.copyOf(days),RunPlanEngine.weeks(days),List.of("PACE_REFERENCE_CHANGED"),List.of());
    }
}
