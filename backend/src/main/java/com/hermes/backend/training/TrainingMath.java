package com.hermes.backend.training;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

public final class TrainingMath {
    public static Map<String,Object> derive(double minutes,List<Map<String,Object>> samples,Integer rpe,int maxHr) {
        double known=0,weighted=0;double[] zones=new double[5];
        for(int i=0;i<samples.size()-1;i++) {var s=samples.get(i);if(!(s.get("hr") instanceof Number hr)||hr.doubleValue()<30||hr.doubleValue()>240)continue;
            double seconds=Math.min(60,Math.max(0,((Number)samples.get(i+1).get("offset")).doubleValue()-((Number)s.get("offset")).doubleValue()));known+=seconds;
            int band=hr.doubleValue()/maxHr<.6?-1:Math.min(4,(int)Math.floor((hr.doubleValue()/maxHr-.6)/.1));if(band>=0){zones[band]+=seconds/60;weighted+=seconds/60*(band+1);}}
        double coverage=minutes<=0?0:Math.min(1,known/(minutes*60));Object load=null;
        if(coverage>=.9)load=Math.round(weighted);else if(rpe!=null)load=Math.round(minutes*rpe/2);
        return map("load",load,"coverage",coverage,"zones",Arrays.stream(zones).boxed().toList(),"model",coverage>=.9?"HR bands v1":load==null?"Unknown":"RPE v1");
    }
    public static List<Map<String,Object>> intervals(List<Map<String,Object>> samples) {var out=new ArrayList<Map<String,Object>>();Double start=null;
        for(int i=0;i<samples.size();i++){var s=samples.get(i);double offset=((Number)s.get("offset")).doubleValue();boolean hard=s.get("hr") instanceof Number n&&n.doubleValue()>=150;
            if(hard&&start==null)start=offset;if(start!=null&&(!hard||i==samples.size()-1)){if(offset-start>=30)out.add(map("id","auto-"+out.size(),"start",start,"end",offset,"minutes",(offset-start)/60));start=null;}}
        return out;
    }
    public static List<Map<String,Object>> fitness(List<Map<String,Object>> actual,List<Map<String,Object>> events,String start,String end,Map<String,Object> settings) {
        LocalDate from=LocalDate.parse(TrainingBulk.date(start)),to=LocalDate.parse(TrainingBulk.date(end)),today=LocalDate.now(ZoneId.of((String)settings.getOrDefault("zone","UTC")));check(!to.isBefore(from)&&ChronoUnit.DAYS.between(from,to)<=366,422,"DATE_WINDOW_LIMIT");
        double fit=0,fat=0,ft=((Number)settings.getOrDefault("fitnessTau",42)).doubleValue(),at=((Number)settings.getOrDefault("fatigueTau",7)).doubleValue();var out=new ArrayList<Map<String,Object>>();
        for(LocalDate d=from;!d.isAfter(to);d=d.plusDays(1)){String date=d.toString();var daily=actual.stream().filter(a->date.equals(a.get("date"))).toList();boolean future=d.isAfter(today);double load=daily.stream().mapToDouble(a->a.get("load") instanceof Number n?n.doubleValue():0).sum();
            if(future)load+=events.stream().filter(e->date.equals(e.get("date"))&&"planned".equals(e.get("state"))).mapToDouble(e->((Number)e.getOrDefault("projectedLoad",0)).doubleValue()).sum();
            fit+=(1-Math.exp(-1/ft))*(load-fit);fat+=(1-Math.exp(-1/at))*(load-fat);out.add(map("date",date,"load",load,"fitness",fit,"fatigue",fat,"form",fit-fat,"projected",future,"provisional",daily.stream().anyMatch(a->a.get("load")==null)));}
        return out;
    }
}
