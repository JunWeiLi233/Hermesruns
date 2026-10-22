package com.hermes.backend.training;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;
import static com.hermes.backend.training.TrainingStore.map;
import static com.hermes.backend.training.TrainingFailure.check;

/** Server compiler, independently validated; never accepts a client-computed step or duration. */
public final class TrainingWorkout {
    private static final Pattern STEP=Pattern.compile("^(\\d+(?:\\.\\d+)?)m\\s++@(\\d+(?:\\.\\d+)?)(%|bpm|W|rpm|m/s)\\s++(.+)$");
    public static Map<String,Object> compile(String source) {
        check(source!=null&&source.getBytes(StandardCharsets.UTF_8).length<=65536,422,"WORKOUT_SOURCE_LIMIT");
        var steps=new ArrayList<Map<String,Object>>();var block=new ArrayList<Map<String,Object>>();int repeat=1;
        for(String line:source.split("\n")) {
            if(line.isBlank())continue;String trimmed=line.trim();
            if(trimmed.matches("\\d{1,3}x")) {
                check(!Character.isWhitespace(line.charAt(0)),422,"NESTED_REPEAT_UNAVAILABLE");
                flush(steps,block,repeat);repeat=Integer.parseInt(trimmed.substring(0,trimmed.length()-1));check(repeat>=1&&repeat<=50,422,"REPEAT_LIMIT");continue;
            }
            var m=STEP.matcher(trimmed);check(m.matches(),422,"INVALID_WORKOUT_STEP");
            double minutes=Double.parseDouble(m.group(1)),target=Double.parseDouble(m.group(2));
            check(Double.isFinite(minutes)&&minutes>0&&minutes<=180&&Double.isFinite(target)&&target>0&&target<=10000&&m.group(4).length()<=160,422,"INVALID_WORKOUT_STEP");
            var step=map("minutes",minutes,"target",target,"unit",m.group(3),"name",m.group(4));
            if(Character.isWhitespace(line.charAt(0))&&repeat>1)block.add(step);else{flush(steps,block,repeat);repeat=1;steps.add(step);}
            check(steps.size()+block.size()*repeat<=2000,422,"STEP_LIMIT");
        }
        flush(steps,block,repeat);check(!steps.isEmpty()&&steps.size()<=2000,422,"STEP_LIMIT");
        double minutes=steps.stream().mapToDouble(s->((Number)s.get("minutes")).doubleValue()).sum();check(minutes<=10080,422,"WORKOUT_DURATION_LIMIT");
        return map("steps",steps,"minutes",minutes,"errors",List.of());
    }
    private static void flush(List<Map<String,Object>> steps,List<Map<String,Object>> block,int count) {check(steps.size()+block.size()*count<=2000,422,"STEP_LIMIT");for(int n=0;n<count;n++)steps.addAll(block);block.clear();}
}
