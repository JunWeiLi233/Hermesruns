package com.hermes.backend.coaching.plan;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

/** Independently authored rules. No persistence, clock, randomness or external calls. */
public final class RunPlanEngine {
    public static final String RULES = "hermes-road-v4";
    public record Result(int distanceM, int seconds, LocalDate date) {}
    public record SessionCaps(Integer easyM,Integer longM,Integer steadyM,Integer intervalM,Integer runWalkS) {
        Integer distance(String kind) {return switch(kind){case "EASY"->easyM;case "LONG"->longM;case "STEADY"->steadyM;case "INTERVAL"->intervalM;default->null;};}
    }
    public record Inputs(int schemaVersion, String goalKind, int goalDistanceM, LocalDate startDate,
        LocalDate endDate, String timeZone, boolean adultConfirmed, String experience, String trainingMode,
        int baselineWeeklyM, int baselineRunsPerWeek, int longestRecentM, boolean canWalk20Minutes,
        List<Integer> availableWeekdays, int runsPerWeek, int longRunWeekday, String volume,
        String difficulty, Result recentResult, String title, String eventName, String units,SessionCaps sessionCaps,Integer paceScaleBps) {
        public Inputs(int schemaVersion,String goalKind,int goalDistanceM,LocalDate startDate,LocalDate endDate,String timeZone,
            boolean adultConfirmed,String experience,String trainingMode,int baselineWeeklyM,int baselineRunsPerWeek,int longestRecentM,
            boolean canWalk20Minutes,List<Integer> availableWeekdays,int runsPerWeek,int longRunWeekday,String volume,String difficulty,
            Result recentResult,String title,String eventName,String units) {
            this(schemaVersion,goalKind,goalDistanceM,startDate,endDate,timeZone,adultConfirmed,experience,trainingMode,baselineWeeklyM,
                baselineRunsPerWeek,longestRecentM,canWalk20Minutes,availableWeekdays,runsPerWeek,longRunWeekday,volume,difficulty,recentResult,title,eventName,units,null,null);
        }
        public Inputs withCaps(SessionCaps caps) {
            return new Inputs(schemaVersion,goalKind,goalDistanceM,startDate,endDate,timeZone,adultConfirmed,experience,trainingMode,
                baselineWeeklyM,baselineRunsPerWeek,longestRecentM,canWalk20Minutes,availableWeekdays,runsPerWeek,longRunWeekday,volume,difficulty,recentResult,title,eventName,units,caps,paceScaleBps);
        }
        public Inputs withPaceScale(int bps) {
            return new Inputs(schemaVersion,goalKind,goalDistanceM,startDate,endDate,timeZone,adultConfirmed,experience,trainingMode,
                baselineWeeklyM,baselineRunsPerWeek,longestRecentM,canWalk20Minutes,availableWeekdays,runsPerWeek,longRunWeekday,volume,difficulty,recentResult,title,eventName,units,sessionCaps,bps);
        }
    }
    public record Step(int sequence, String stepType, Integer distanceM, Integer durationS,
        int repetitions, Integer paceMinSPerKm, Integer paceMaxSPerKm, String effortKey) {}
    public record Day(String id, LocalDate localDate, String workoutType, String phase,
        Integer targetDistanceM, Integer targetDurationS, List<Step> steps, String state,
        String completionSource, String versionId, long revision) {
        public Day identified(String identity, String version) {
            return new Day(identity,localDate,workoutType,phase,targetDistanceM,targetDurationS,steps,state,completionSource,version,revision);
        }
    }
    public record Week(LocalDate startDate, String phase, Integer plannedDistanceM, Integer plannedDurationS,
        Integer trainingDistanceM, Integer trainingDurationS, int eventDistanceM, int runCount, List<Day> days) {}
    public record Candidate(List<Day> days, List<Week> weeks, List<String> warnings, List<Integer> weekdays) {}
    public static class Invalid extends RuntimeException {
        public final String code;
        public final List<String> fields;
        public Invalid(String code, String... fields) { super(code); this.code=code; this.fields=List.of(fields); }
    }
    private static void require(boolean valid, String code, String... fields) { if (!valid) throw new Invalid(code,fields); }
    private static int floor(int x, int step) { return x / step * step; }
    private static int pct(int x, int percent) { return (int)((long)x*percent/100); }
    private static int f50(int x) { return floor(x,50); }
    private static boolean run(Day d) { return !d.workoutType.equals("REST"); }
    private static int referencePace(Inputs in) {return (int)Math.round((double)in.recentResult.seconds*1000/in.recentResult.distanceM*Objects.requireNonNullElse(in.paceScaleBps,10000)/10000);}

    public Candidate generate(Inputs in, LocalDate today, List<Day> retained) {
        validate(in,today,retained);
        boolean timed=in.trainingMode.equals("RUN_WALK");
        List<Integer> pattern=pattern(in,timed);
        Set<String> warnings=new LinkedHashSet<>();
        if (!in.availableWeekdays.contains(in.endDate.getDayOfWeek().getValue())) warnings.add("GOAL_DAY_EXCEPTION");
        if (timed) warnings.add("TIMED_RUN_WALK_GOAL");
        Integer pace=null;
        if (in.recentResult!=null) {
            if (ChronoUnit.DAYS.between(in.recentResult.date,today)>180) warnings.add("RESULT_TOO_OLD");
            else {pace=referencePace(in);require(pace>0,"INVALID_RESULT","recentResult");}
        }
        int quality=pattern.stream().filter(d->d!=in.longRunWeekday && separation(d,in.longRunWeekday)>=2)
            .sorted(Comparator.<Integer>comparingInt(d->-separation(d,in.longRunWeekday)).thenComparingInt(d->d)).findFirst().orElse(0);
        if (quality==0 && !timed && !in.difficulty.equals("EASY")) warnings.add("QUALITY_OMITTED_FOR_SPACING");
        int v=List.of("LOWER","STANDARD","HIGHER").indexOf(in.volume);
        int weekly=f50(pct(in.baselineWeeklyM,new int[]{85,90,95}[v]));
        int longest=f50(Math.min(pct(in.longestRecentM,90),pct(weekly,35)));
        int ceiling=f50(pct(in.baselineWeeklyM,new int[]{115,125,135}[v]));
        int main=new int[]{600,720,840}[v], mainCap=new int[]{1200,1440,1680}[v], runSeconds=30;
        int peakWeekly=weekly, peakLong=longest, peakMain=main, maxLong=0;
        int complete=0, changes=0, qualityOrdinal=0;
        LocalDate first=in.startDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate last=in.endDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<Day> all=new ArrayList<>();
        for (LocalDate monday=first;!monday.isAfter(last);monday=monday.plusWeeks(1)) {
            boolean full=!monday.isBefore(in.startDate) && !monday.plusDays(6).isAfter(in.endDate);
            int remaining=(int)ChronoUnit.WEEKS.between(monday,last);
            String phase;
            int w=weekly,l=longest,m=main,mLong=main+120;
            if (remaining<2) {
                require(complete>0,"DATE_RANGE","endDate");
                phase="TAPER"; int factor=remaining==1?80:60;
                w=f50(pct(peakWeekly,factor)); l=f50(pct(peakLong,factor));
                m=floor(pct(peakMain,factor),30); mLong=floor(pct(peakMain+120,factor),30);
            } else {
                if(full) complete++;
                phase=complete<=2?"ADAPT":"BUILD";
                if(full && complete%4==0) {
                    phase="RECOVERY"; w=f50(pct(weekly,80)); l=f50(pct(longest,80));
                    m=floor(pct(main,80),30); mLong=floor(pct(main+120,80),30);
                } else if(full && complete>1) {
                    w=f50(Math.min(Math.min(pct(weekly,104+v),weekly+1500),ceiling));
                    l=f50(Math.min(Math.min(pct(longest,105),longest+500),Math.min(pct(w,40),Math.max(in.longestRecentM,in.goalDistanceM))));
                    if(complete>2) {
                        if(changes++%2==0) main=Math.min(main+60,mainCap); else runSeconds=Math.min(runSeconds+5,75);
                    }
                    m=main; mLong=main+120;
                    weekly=w;longest=l;
                }
                if (full && !phase.equals("RECOVERY")) {
                    peakWeekly=Math.max(peakWeekly,w);peakLong=Math.max(peakLong,l);peakMain=Math.max(peakMain,main);maxLong=Math.max(maxLong,l);
                }
            }
            boolean hasQuality=phase.equals("BUILD") && !timed && !in.difficulty.equals("EASY") && quality!=0;
            String qualityKind=hasQuality && (in.difficulty.equals("HIGHER") || qualityOrdinal++%2==1)?"INTERVAL":"STEADY";
            int each=f50((w-l)/(in.runsPerWeek-1)), extra=(w-l-each*(in.runsPerWeek-1))/50;
            if(!timed) require(each>=1000 && l>0,"BASELINE_REQUIRED","baselineWeeklyM","runsPerWeek");
            Map<Integer,Day> template=new TreeMap<>();
            for(int dow:pattern) {
                boolean isLong=dow==in.longRunWeekday;
                String kind=timed?"RUN_WALK":isLong?"LONG":hasQuality && dow==quality?qualityKind:"EASY";
                int distance=isLong?l:each+(extra-->0?50:0);
                List<Step> steps=timed?timedSteps(isLong?mLong:m,runSeconds):distanceSteps(kind,distance,pace,in.difficulty,w);
                if(kind.equals("INTERVAL") && steps.stream().noneMatch(s->s.stepType.equals("RECOVERY"))) kind="EASY";
                template.put(dow,new Day(null,monday.plusDays(dow-1),kind,phase,timed?null:distance,
                    timed?(isLong?mLong:m)+600:null,steps,"PLANNED","NONE",null,0));
            }
            if (monday.equals(last)) {
                template.remove(in.longRunWeekday);
                int goalDay=in.endDate.getDayOfWeek().getValue();
                template.entrySet().removeIf(e->e.getKey()==goalDay-1 || e.getKey()>goalDay ||
                    (goalDay-e.getKey()<=2 && Set.of("LONG","INTERVAL","STEADY").contains(e.getValue().workoutType)));
                template.put(goalDay,new Day(null,in.endDate,"EVENT","GOAL",in.goalDistanceM,null,
                    List.of(new Step(0,"RUN",in.goalDistanceM,null,1,null,null,timed?"FINISH_WITH_WALK_BREAKS":"FINISH_COMFORTABLY")),"PLANNED","NONE",null,0));
                while(template.size()>in.runsPerWeek) template.remove(template.keySet().stream().filter(d->d!=goalDay).max(Integer::compare).orElseThrow());
            }
            for(int i=0;i<7;i++) {
                LocalDate date=monday.plusDays(i);
                if(date.isBefore(in.startDate)||date.isAfter(in.endDate))continue;
                all.add(template.getOrDefault(i+1,new Day(null,date,"REST",phase,null,null,List.of(),"PLANNED","NONE",null,0)));
            }
        }
        // This also covers an event on Monday, whose preceding rest day is in the previous block.
        for(int k=0;k<all.size();k++) {
            var d=all.get(k);long gap=ChronoUnit.DAYS.between(d.localDate,in.endDate);
            if(gap==1 || (gap==2 && Set.of("LONG","STEADY","INTERVAL").contains(d.workoutType)))
                all.set(k,new Day(null,d.localDate,"REST",d.phase,null,null,List.of(),"PLANNED","NONE",null,0));
        }
        if(!timed && maxLong<(in.goalDistanceM==5000?5000:8000))warnings.add("DISTANCE_NOT_REHEARSED");
        mergeRetained(all,retained,in,today);
        applySessionExposure(all,retained,in,today,pace,warnings);
        applySessionCaps(all,retained,in,pace,warnings);
        if(!timed) {
            warnings.remove("DISTANCE_NOT_REHEARSED");
            if(all.stream().filter(d->d.workoutType.equals("LONG")&&!d.phase.equals("TAPER")).mapToInt(d->d.targetDistanceM).max().orElse(0)<(in.goalDistanceM==5000?5000:8000))warnings.add("DISTANCE_NOT_REHEARSED");
            validateAfterCaps(()->validateFutureCaps(all,in,today),warnings.contains("SESSION_CAPS_APPLIED"));
        }
        validateAfterCaps(()->validateSchedule(all,in,retained.isEmpty()),warnings.contains("SESSION_CAPS_APPLIED"));
        return new Candidate(List.copyOf(all),weeks(all),List.copyOf(warnings),pattern);
    }

    public Candidate move(Inputs in,List<Day> published,String workoutId,LocalDate target,LocalDate today) {
        var source=published.stream().filter(d->Objects.equals(d.id,workoutId)).findFirst().orElseThrow(()->new Invalid("MOVE_NOT_ALLOWED","workoutId"));
        require(target!=null&&source.localDate.isAfter(today)&&target.isAfter(today)&&!target.equals(source.localDate)&&
            source.state.equals("PLANNED")&&source.completionSource.equals("NONE")&&!Set.of("REST","EVENT").contains(source.workoutType),"MOVE_NOT_ALLOWED","targetDate");
        require(source.localDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).equals(target.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))),"MOVE_WEEK_BOUNDARY","targetDate");
        var destination=published.stream().filter(d->d.localDate.equals(target)).findFirst().orElseThrow(()->new Invalid("MOVE_NOT_ALLOWED","targetDate"));
        require(destination.workoutType.equals("REST")&&destination.state.equals("PLANNED")&&destination.completionSource.equals("NONE"),"MOVE_DATE_OCCUPIED","targetDate");
        List<Day> days=new ArrayList<>();
        for(var d:published) {
            if(d.localDate.equals(source.localDate))d=new Day(null,d.localDate,"REST",d.phase,null,null,List.of(),"PLANNED","NONE",null,0);
            else if(d.localDate.equals(target))d=new Day(null,target,source.workoutType,source.phase,source.targetDistanceM,source.targetDurationS,source.steps,"PLANNED","NONE",null,0);
            if(!d.localDate.isBefore(today)&&d.state.equals("PLANNED"))d=d.identified(null,null);
            days.add(d);
        }
        validateSchedule(days,in,false);
        var warnings=new ArrayList<String>();warnings.add("WORKOUT_MOVED");
        if(!in.availableWeekdays.contains(target.getDayOfWeek().getValue()))warnings.add("MOVE_OUTSIDE_AVAILABILITY");
        return new Candidate(List.copyOf(days),weeks(days),List.copyOf(warnings),List.copyOf(in.availableWeekdays));
    }

    private static void validateSchedule(List<Day> all,Inputs in,boolean fresh) {
        // Goal override may add a session beside an ordinary one: never squeeze/make up that load.
        List<Day> running=all.stream().filter(RunPlanEngine::run).toList();
        var qualityDays=running.stream().filter(d->Set.of("INTERVAL","STEADY").contains(d.workoutType)).toList();
        for(int k=1;k<qualityDays.size();k++)require(ChronoUnit.DAYS.between(qualityDays.get(k-1).localDate,qualityDays.get(k).localDate)>=7,"PRESERVED_HISTORY_CONFLICT","availableWeekdays");
        for(int i=1;i<running.size();i++) {
            var previous=running.get(i-1);var current=running.get(i);
            if((Set.of("INTERVAL","STEADY").contains(previous.workoutType)&&current.workoutType.equals("LONG")) ||
                (previous.workoutType.equals("LONG")&&Set.of("INTERVAL","STEADY").contains(current.workoutType)))
                require(ChronoUnit.DAYS.between(previous.localDate,current.localDate)>=2,"PRESERVED_HISTORY_CONFLICT","availableWeekdays");
            if(in.trainingMode.equals("RUN_WALK")) require(ChronoUnit.DAYS.between(running.get(i-1).localDate,running.get(i).localDate)>=2,
                fresh?"RECOVERY_SPACING":"PRESERVED_HISTORY_CONFLICT","endDate","availableWeekdays");
            if(i>=3) require(!running.get(i-3).localDate.plusDays(3).equals(running.get(i).localDate),"RECOVERY_SPACING","availableWeekdays");
        }
        for(var d:running) {
            long gap=ChronoUnit.DAYS.between(d.localDate,in.endDate);
            require(gap!=1&&(gap!=2||!Set.of("LONG","STEADY","INTERVAL").contains(d.workoutType)),"RECOVERY_SPACING","targetDate");
        }
        validateOutput(all,in);
    }

    private void validate(Inputs i, LocalDate today,List<Day> retained) {
        require(i!=null && i.schemaVersion==1,"INVALID_INPUT","schemaVersion");
        validateSessionCaps(i);
        require(Set.of("DISTANCE","RACE").contains(Objects.toString(i.goalKind,"")) && (i.goalDistanceM==5000||i.goalDistanceM==10000),"UNSUPPORTED_GOAL","goalDistanceM");
        try { require(i.timeZone!=null && ZoneId.getAvailableZoneIds().contains(i.timeZone),"INVALID_ZONE","timeZone"); } catch(DateTimeException e){throw new Invalid("INVALID_ZONE","timeZone");}
        require(i.adultConfirmed,"ADULT_CONFIRMATION_REQUIRED","adultConfirmed");
        require(Set.of("BEGINNER","INTERMEDIATE","ADVANCED").contains(Objects.toString(i.experience,"")) &&
            Set.of("DISTANCE","RUN_WALK").contains(Objects.toString(i.trainingMode,"")) &&
            Set.of("LOWER","STANDARD","HIGHER").contains(Objects.toString(i.volume,"")) &&
            Set.of("EASY","STANDARD","HIGHER").contains(Objects.toString(i.difficulty,"")),"INVALID_INPUT","experience","volume","difficulty");
        boolean timed=i.trainingMode.equals("RUN_WALK");
        require(i.startDate!=null && i.endDate!=null,"DATE_RANGE","startDate","endDate");
        long count=ChronoUnit.DAYS.between(i.startDate,i.endDate)+1;
        require(count>=(timed?84:i.goalDistanceM==5000?56:70) && count<=182 && !i.endDate.isBefore(today) &&
            (!i.startDate.isBefore(today)||!retained.isEmpty()),"DATE_RANGE","startDate","endDate");
        require(i.baselineWeeklyM>=0 && i.baselineWeeklyM<=200000 && i.longestRecentM>=0 && i.longestRecentM<=100000 && i.baselineRunsPerWeek>=0 && i.baselineRunsPerWeek<=7,"INPUT_BOUND","baselineWeeklyM","longestRecentM");
        require((i.baselineWeeklyM==0)==(i.longestRecentM==0) && i.longestRecentM<=i.baselineWeeklyM,"BASELINE_INCONSISTENT","longestRecentM");
        // Same four-week window: median(distance) <= longest * median(count).
        // Flooring an even count median loses at most half a run. This is arithmetic, not a load recommendation.
        require(2L*i.baselineWeeklyM<=(2L*i.baselineRunsPerWeek+1)*i.longestRecentM,
            "BASELINE_INCONSISTENT","baselineWeeklyM","baselineRunsPerWeek","longestRecentM");
        require(i.availableWeekdays!=null && new HashSet<>(i.availableWeekdays).size()==i.availableWeekdays.size() &&
            i.availableWeekdays.stream().allMatch(d->d!=null&&d>=1&&d<=7) && i.availableWeekdays.contains(i.longRunWeekday) &&
            i.runsPerWeek>=3 && i.runsPerWeek<=5 && i.availableWeekdays.size()>=i.runsPerWeek,"INSUFFICIENT_DAYS","availableWeekdays","runsPerWeek","longRunWeekday");
        if(timed)require(i.goalDistanceM==5000 && i.runsPerWeek==3 && i.difficulty.equals("EASY") && i.canWalk20Minutes,"RUN_WALK_PREFERENCES","trainingMode","difficulty","canWalk20Minutes");
        else {
            require(i.baselineWeeklyM>=(i.goalDistanceM==5000?6000:12000) && i.longestRecentM>=(i.goalDistanceM==5000?2000:4000) && i.runsPerWeek<=i.baselineRunsPerWeek+1,"BASELINE_REQUIRED","baselineWeeklyM","longestRecentM","baselineRunsPerWeek");
            require(!i.experience.equals("BEGINNER") || i.difficulty.equals("EASY"),"BEGINNER_EFFORT","difficulty");
        }
        require(i.title==null || (!i.title.isBlank()&&i.title.length()<=120),"INVALID_INPUT","title");
        require(i.eventName==null || i.eventName.length()<=120,"INPUT_BOUND","eventName");
        if(i.recentResult!=null)require((i.recentResult.distanceM==5000||i.recentResult.distanceM==10000) && i.recentResult.seconds>0 && i.recentResult.seconds<=86400 && i.recentResult.date!=null && !i.recentResult.date.isAfter(today),"INVALID_RESULT","recentResult");
        require(retained.stream().allMatch(d->!d.localDate.isBefore(i.startDate)&&!d.localDate.isAfter(i.endDate)),"PRESERVED_HISTORY_CONFLICT","startDate","endDate");
    }
    private static int separation(int a,int b){return Math.min(Math.abs(a-b),7-Math.abs(a-b));}
    private static void validateAfterCaps(Runnable validation,boolean applied) {
        try{validation.run();}catch(Invalid error){
            if(applied&&error.code.equals("PRESERVED_HISTORY_CONFLICT"))throw new Invalid("SESSION_CAPS_INFEASIBLE","sessionCaps");
            throw error;
        }
    }
    public static void validateSessionCaps(Inputs i) {
        require(i.paceScaleBps==null||(i.paceScaleBps>=5000&&i.paceScaleBps<=20000),"PACE_LIMIT","paceScaleBps");
        var c=i.sessionCaps;if(c==null)return;
        for(Integer n:Arrays.asList(c.easyM,c.longM,c.steadyM,c.intervalM))
            require(n==null||(n>=1000&&n<=100000&&n%50==0),"SESSION_CAPS_INVALID","sessionCaps");
        require(c.runWalkS==null||(c.runWalkS>=900&&c.runWalkS<=7200&&c.runWalkS%30==0),"SESSION_CAPS_INVALID","sessionCaps");
        if("RUN_WALK".equals(i.trainingMode))require(c.easyM==null&&c.longM==null&&c.steadyM==null&&c.intervalM==null,"SESSION_CAPS_INVALID","sessionCaps");
        else require(c.runWalkS==null,"SESSION_CAPS_INVALID","sessionCaps");
    }
    /** Independent prospective ceiling, reusing the long-run progression policy for every ordinary session.
     * Published injury associations motivate checking sessions; they do not validate these coefficients. */
    private static void applySessionExposure(List<Day> days,List<Day> retained,Inputs in,LocalDate today,Integer pace,Set<String> warnings) {
        if(!in.trainingMode.equals("DISTANCE"))return;
        var protectedDates=new HashSet<LocalDate>();retained.forEach(d->protectedDates.add(d.localDate));
        int anchor=f50(pct(in.longestRecentM,90)),peak=anchor;
        int weeklyAnchor=0,longAnchor=0,weeklyPeak=0,longPeak=0;
        int weeklyGrowth=104+List.of("LOWER","STANDARD","HIGHER").indexOf(in.volume);
        boolean completeBuild=false;
        var last=in.endDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for(var week:weeks(days)) {
            if(week.startDate.plusDays(6).isBefore(today))continue;
            int limit;
            if(week.phase.equals("TAPER"))limit=f50(pct(peak,week.startDate.equals(last)?60:80));
            else if(week.phase.equals("RECOVERY"))limit=f50(pct(anchor,80));
            else {
                if(week.days.size()==7&&!week.startDate.isBefore(today)) {
                    if(completeBuild)anchor=f50(Math.min(Math.min(pct(anchor,105),anchor+500),Math.max(in.longestRecentM,in.goalDistanceM)));
                    completeBuild=true;
                    peak=Math.max(peak,anchor);
                }
                limit=anchor;
            }
            var changed=new LinkedHashSet<Integer>();
            var mutable=new ArrayList<Integer>();
            boolean full=week.days.size()==7&&!week.startDate.isBefore(today);
            for(int k=0;k<days.size();k++) {
                var d=days.get(k);
                if(d.localDate.isBefore(today)||d.localDate.isBefore(week.startDate)||!d.localDate.isBefore(week.startDate.plusWeeks(1))||
                    protectedDates.contains(d.localDate)||d.targetDistanceM==null||d.workoutType.equals("EVENT"))continue;
                mutable.add(k);
                int ceiling=limit;
                if(full&&d.workoutType.equals("LONG")) {
                    if(week.phase.equals("TAPER")&&longPeak>0)ceiling=Math.min(ceiling,f50(pct(longPeak,week.startDate.equals(last)?60:80)));
                    else if(longAnchor>0)ceiling=Math.min(ceiling,week.phase.equals("RECOVERY")?f50(pct(longAnchor,80)):f50(Math.min(pct(longAnchor,105),longAnchor+500)));
                }
                if(d.targetDistanceM>ceiling)shortenDistance(days,k,ceiling,changed);
            }
            int budget=days.stream().filter(d->!d.localDate.isBefore(week.startDate)&&d.localDate.isBefore(week.startDate.plusWeeks(1))&&!d.workoutType.equals("EVENT"))
                .mapToInt(d->Objects.requireNonNullElse(d.targetDistanceM,0)).sum();
            int weeklyCap=budget;
            if(full) {
                if(week.phase.equals("TAPER")&&weeklyPeak>0)weeklyCap=Math.min(weeklyCap,f50(pct(weeklyPeak,week.startDate.equals(last)?60:80)));
                else if(weeklyAnchor>0)weeklyCap=Math.min(weeklyCap,week.phase.equals("RECOVERY")?f50(pct(weeklyAnchor,80)):f50(Math.min(pct(weeklyAnchor,weeklyGrowth),weeklyAnchor+1500)));
            }
            // Reconcile against actual reduced totals. Remove 50 m from the largest mutable session first;
            // stable date order breaks ties. Never rewrite protected history or fill removed load elsewhere.
            while(budget>weeklyCap) {
                int k=mutable.stream().filter(n->days.get(n).targetDistanceM>1000)
                    .max(Comparator.<Integer>comparingInt(n->days.get(n).targetDistanceM).thenComparingInt(n->-n))
                    .orElseThrow(()->new Invalid("PRESERVED_HISTORY_CONFLICT","baselineWeeklyM","longestRecentM"));
                shortenDistance(days,k,days.get(k).targetDistanceM-50,changed);budget-=50;
            }
            if(full&&Set.of("ADAPT","BUILD").contains(week.phase)) {
                weeklyAnchor=budget;
                longAnchor=days.stream().filter(d->d.workoutType.equals("LONG")&&!d.localDate.isBefore(week.startDate)&&d.localDate.isBefore(week.startDate.plusWeeks(1)))
                    .mapToInt(d->d.targetDistanceM).max().orElse(0);
                weeklyPeak=Math.max(weeklyPeak,weeklyAnchor);longPeak=Math.max(longPeak,longAnchor);
            }
            for(int k:changed) {
                var d=days.get(k);var steps=distanceSteps(d.workoutType,d.targetDistanceM,pace,in.difficulty,budget);
                String kind=d.workoutType.equals("INTERVAL")&&steps.stream().noneMatch(s->s.stepType.equals("RECOVERY"))?"EASY":d.workoutType;
                days.set(k,new Day(null,d.localDate,kind,d.phase,d.targetDistanceM,null,steps,d.state,d.completionSource,null,0));
            }
            if(!changed.isEmpty())warnings.add("SESSION_EXPOSURE_REDUCED");
        }
    }
    private static void shortenDistance(List<Day> days,int index,int amount,Set<Integer> changed) {
        require(amount>=1000,"PRESERVED_HISTORY_CONFLICT","baselineWeeklyM","longestRecentM");
        var d=days.get(index);
        days.set(index,new Day(null,d.localDate,d.workoutType,d.phase,amount,null,List.of(),d.state,d.completionSource,null,0));changed.add(index);
    }
    private static void applySessionCaps(List<Day> days,List<Day> retained,Inputs in,Integer pace,Set<String> warnings) {
        if(in.sessionCaps==null)return;
        var protectedDates=new HashSet<LocalDate>();retained.forEach(d->protectedDates.add(d.localDate));
        var last=in.endDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        for(int k=0;k<days.size();k++) {
            var d=days.get(k);if(protectedDates.contains(d.localDate)||Set.of("REST","EVENT").contains(d.workoutType))continue;
            int factor=d.phase.equals("RECOVERY")?80:d.phase.equals("TAPER")?(d.localDate.isBefore(last)?80:60):100;
            if(d.targetDistanceM!=null) {
                Integer limit=in.sessionCaps.distance(d.workoutType);if(limit==null)continue;
                int amount=Math.min(d.targetDistanceM,f50(pct(limit,factor)));if(amount==d.targetDistanceM)continue;
                require(amount>=1000,"SESSION_CAPS_INFEASIBLE","sessionCaps");
                var week=weeks(days).stream().filter(w->!d.localDate.isBefore(w.startDate)&&d.localDate.isBefore(w.startDate.plusWeeks(1))).findFirst().orElseThrow();
                var steps=distanceSteps(d.workoutType,amount,pace,in.difficulty,Objects.requireNonNullElse(week.trainingDistanceM,0));
                String kind=d.workoutType.equals("INTERVAL")&&steps.stream().noneMatch(s->s.stepType.equals("RECOVERY"))?"EASY":d.workoutType;
                // A structured session simplified to easy must satisfy both chosen ceilings.
                if(kind.equals("EASY")&&in.sessionCaps.easyM!=null&&amount>f50(pct(in.sessionCaps.easyM,factor))) {
                    amount=f50(pct(in.sessionCaps.easyM,factor));require(amount>=1000,"SESSION_CAPS_INFEASIBLE","sessionCaps");
                    steps=distanceSteps("EASY",amount,pace,in.difficulty,Objects.requireNonNullElse(week.trainingDistanceM,0));
                }
                days.set(k,new Day(null,d.localDate,kind,d.phase,amount,null,steps,"PLANNED","NONE",null,0));
            } else {
                if(in.sessionCaps.runWalkS==null)continue;
                int amount=Math.min(d.targetDurationS,600+floor(pct(in.sessionCaps.runWalkS-600,factor),30));if(amount==d.targetDurationS)continue;
                int runSeconds=d.steps.stream().filter(s->s.stepType.equals("RUN")).findFirst().orElseThrow().durationS;
                days.set(k,new Day(null,d.localDate,d.workoutType,d.phase,null,amount,timedSteps(amount-600,runSeconds),"PLANNED","NONE",null,0));
            }
            warnings.add("SESSION_CAPS_APPLIED");
        }
    }
    private List<Integer> pattern(Inputs in,boolean timed) {
        List<List<Integer>> choices=new ArrayList<>();
        for(int mask=0;mask<128;mask++) {
            List<Integer> days=new ArrayList<>(); for(int d=1;d<=7;d++)if((mask&(1<<(d-1)))!=0)days.add(d);
            if(days.size()!=in.runsPerWeek || !days.contains(in.longRunWeekday) || !in.availableWeekdays.containsAll(days))continue;
            List<Integer> gaps=gaps(days);
            if(timed && Collections.min(gaps)<2)continue;
            boolean consecutive=false;
            for(int d=1;d<=7;d++){int start=d; if(java.util.stream.IntStream.range(0,4).allMatch(k->days.contains((start+k-1)%7+1)))consecutive=true;}
            if(!consecutive)choices.add(days);
        }
        require(!choices.isEmpty(),"RECOVERY_SPACING","availableWeekdays","runsPerWeek");
        choices.sort(Comparator.<List<Integer>>comparingInt(d->-Collections.min(gaps(d)))
            .thenComparingInt(d->{List<Integer> g=gaps(d);int sum=0;for(int k=0;k<g.size();k++)sum+=Math.pow(g.get(k)-g.get((k+1)%g.size()),2);return sum;})
            .thenComparing(d->d.toString()));
        return List.copyOf(choices.get(0));
    }
    private static List<Integer> gaps(List<Integer> days){List<Integer> g=new ArrayList<>();for(int k=0;k<days.size();k++)g.add((days.get((k+1)%days.size())-days.get(k)+7)%7);return g;}
    private static void add(List<Step> out,String type,Integer distance,Integer duration,String effort,Integer p) {
        if((distance!=null && distance<=0)||(duration!=null && duration<=0))return;
        Integer min=null,max=null;
        if(p!=null && !type.equals("WALK")) {int lo=effort.equals("CONTROLLED")?100:effort.equals("STEADY")?110:125;int hi=lo==100?110:lo==110?120:150;min=(p*lo+99)/100;max=(p*hi+99)/100;}
        out.add(new Step(out.size(),type,distance,duration,1,min,max,effort));
    }
    private static List<Step> distanceSteps(String kind,int d,Integer p,String difficulty,int weekly) {
        List<Step> s=new ArrayList<>();
        int warm=f50(pct(d,kind.equals("STEADY")||kind.equals("INTERVAL")?20:15));
        int cool=f50(pct(d,kind.equals("STEADY")||kind.equals("INTERVAL")?15:10));
        if(kind.equals("INTERVAL")) {
            int n=difficulty.equals("HIGHER")?6:4;
            int h=f50(Math.min(Math.min(pct(d,n==6?15:12)/n,300),pct(weekly,20)/n));
            if(d<4000||h<100||d-warm-cool-2*n*h<0)return distanceSteps("EASY",d,p,difficulty,weekly);
            add(s,"WARMUP",warm,null,"EASY",p);add(s,"RUN",d-warm-cool-2*n*h,null,"EASY",p);
            for(int k=0;k<n;k++){add(s,"RUN",h,null,"CONTROLLED",p);add(s,"RECOVERY",h,null,"EASY",p);}
        } else {
            int steady=kind.equals("STEADY")?f50(Math.min(pct(d,15),pct(weekly,20))):0;
            add(s,"WARMUP",warm,null,"EASY",p);add(s,"RUN",d-warm-cool-steady,null,"EASY",p);add(s,"RUN",steady,null,"STEADY",p);
        }
        add(s,"COOLDOWN",cool,null,"EASY",p);return List.copyOf(s);
    }
    private static List<Step> timedSteps(int main,int run) {
        List<Step> s=new ArrayList<>();add(s,"WARMUP",null,300,"WALK",null);
        for(int left=main;left>0;){int r=Math.min(run,left);add(s,"RUN",null,r,"EASY",null);left-=r;int walk=Math.min(120-run,left);add(s,"WALK",null,walk,"WALK",null);left-=walk;}
        add(s,"COOLDOWN",null,300,"WALK",null);return List.copyOf(s);
    }
    private static void mergeRetained(List<Day> all,List<Day> retained,Inputs in,LocalDate today) {
        Map<LocalDate,Day> protectedDays=new HashMap<>();retained.forEach(d->protectedDays.put(d.localDate,d));
        Week prior=weeks(retained).stream().filter(w->w.days.size()==7&&w.startDate.plusDays(6).isBefore(today)&&w.trainingDistanceM!=null).reduce((a,b)->b).orElse(null);
        int priorLong=prior==null?0:prior.days.stream().filter(d->d.workoutType.equals("LONG")).mapToInt(d->d.targetDistanceM).max().orElse(0);
        boolean cappedFirst=false;
        Integer pace=in.recentResult!=null&&ChronoUnit.DAYS.between(in.recentResult.date,today)<=180?referencePace(in):null;
        Map<LocalDate,Day> replacements=new HashMap<>();
        for(Week week:weeks(all)) {
            if(week.startDate.plusDays(6).isBefore(today))continue;
            List<Day> kept=retained.stream().filter(d->!d.localDate.isBefore(week.startDate)&&d.localDate.isBefore(week.startDate.plusWeeks(1))).toList();
            boolean cap=prior!=null&&!cappedFirst&&!week.startDate.isBefore(today)&&week.days.size()==7&&Set.of("ADAPT","BUILD").contains(week.phase);
            if(cap)cappedFirst=true;
            if(kept.isEmpty()&&!cap)continue;
            int budgetM=Objects.requireNonNullElse(week.trainingDistanceM,0);
            if(cap)budgetM=Math.min(budgetM,f50(pct(prior.trainingDistanceM,105)));
            int budgetS=Objects.requireNonNullElse(week.trainingDurationS,0);
            int keptCount=(int)kept.stream().filter(RunPlanEngine::run).count();
            int keptM=kept.stream().filter(d->!d.workoutType.equals("EVENT")).mapToInt(d->Objects.requireNonNullElse(d.targetDistanceM,0)).sum();
            int keptS=kept.stream().mapToInt(d->Objects.requireNonNullElse(d.targetDurationS,0)).sum();
            int futureEvents=(int)week.days.stream().filter(d->!protectedDays.containsKey(d.localDate)&&d.workoutType.equals("EVENT")).count();
            require(keptCount+futureEvents<=in.runsPerWeek&&keptM<=budgetM&&keptS<=budgetS,"PRESERVED_HISTORY_CONFLICT","baselineWeeklyM","availableWeekdays");
            List<Day> future=new ArrayList<>(week.days.stream().filter(d->!protectedDays.containsKey(d.localDate)&&run(d)&&!d.workoutType.equals("EVENT")).toList());
            int slots=in.runsPerWeek-keptCount-futureEvents;
            while(future.size()>slots) {
                Day removed=future.remove(future.size()-1);
                replacements.put(removed.localDate,new Day(null,removed.localDate,"REST",removed.phase,null,null,List.of(),"PLANNED","NONE",null,0));
            }
            int remainingM=budgetM-keptM,remainingS=budgetS-keptS;
            // Give LONG its independent cap first, then divide remaining units among ordinary slots.
            future.sort(Comparator.<Day>comparingInt(d->d.workoutType.equals("LONG")?-1:0).thenComparing(Day::localDate));
            for(int k=0;k<future.size();k++) {
                Day d=future.get(k);int left=future.size()-k;
                if(d.targetDistanceM!=null) {
                    int share=(remainingM/50/left+((remainingM/50)%left>0?1:0))*50;
                    int amount=d.workoutType.equals("LONG")?Math.min(d.targetDistanceM,remainingM-1000*(left-1)):Math.min(d.targetDistanceM,share);
                    if(cap&&d.workoutType.equals("LONG")&&priorLong>0)amount=Math.min(amount,f50(pct(priorLong,105)));
                    amount=f50(amount);
                    require(amount>0&&(d.workoutType.equals("LONG")||amount>=1000),"PRESERVED_HISTORY_CONFLICT","baselineWeeklyM");
                    var steps=distanceSteps(d.workoutType,amount,pace,in.difficulty,budgetM);
                    String kind=d.workoutType.equals("INTERVAL")&&steps.stream().noneMatch(s->s.stepType.equals("RECOVERY"))?"EASY":d.workoutType;
                    replacements.put(d.localDate,new Day(null,d.localDate,kind,d.phase,amount,null,steps,"PLANNED","NONE",null,0));remainingM-=amount;
                } else {
                    int amount=Math.min(d.targetDurationS,600+floor((remainingS/left)-600,30));
                    require(amount>600,"PRESERVED_HISTORY_CONFLICT","baselineWeeklyM");
                    int runSeconds=d.steps.stream().filter(s->s.stepType.equals("RUN")).findFirst().orElseThrow().durationS;
                    replacements.put(d.localDate,new Day(null,d.localDate,d.workoutType,d.phase,null,amount,timedSteps(amount-600,runSeconds),"PLANNED","NONE",null,0));remainingS-=amount;
                }
            }
        }
        for(int k=0;k<all.size();k++) {
            LocalDate date=all.get(k).localDate;
            if(protectedDays.containsKey(date))all.set(k,protectedDays.get(date));
            else if(replacements.containsKey(date))all.set(k,replacements.get(date));
        }
    }
    private static void validateFutureCaps(List<Day> days,Inputs in,LocalDate today) {
        var calendar=weeks(days);Week anchor=null;
        int peak=calendar.stream().filter(w->w.days.size()==7&&Set.of("ADAPT","BUILD").contains(w.phase)).mapToInt(w->Objects.requireNonNullElse(w.trainingDistanceM,0)).max().orElse(0);
        int peakLong=calendar.stream().filter(w->w.days.size()==7&&Set.of("ADAPT","BUILD").contains(w.phase)).flatMap(w->w.days.stream()).filter(d->d.workoutType.equals("LONG")).mapToInt(d->d.targetDistanceM).max().orElse(0);
        int growth=104+List.of("LOWER","STANDARD","HIGHER").indexOf(in.volume);
        for(Week w:calendar) {
            if(w.startDate.isBefore(today)||w.days.size()!=7)continue;
            int weekly=Objects.requireNonNullElse(w.trainingDistanceM,0),longest=w.days.stream().filter(d->d.workoutType.equals("LONG")).mapToInt(d->d.targetDistanceM).max().orElse(0);
            if(w.phase.equals("TAPER")){int factor=w.startDate.equals(in.endDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)))?60:80;require(weekly<=f50(pct(peak,factor))&&longest<=f50(pct(peakLong,factor)),"PRESERVED_HISTORY_CONFLICT","baselineWeeklyM");continue;}
            if(anchor!=null){int old=Objects.requireNonNullElse(anchor.trainingDistanceM,0),oldLong=anchor.days.stream().filter(d->d.workoutType.equals("LONG")).mapToInt(d->d.targetDistanceM).max().orElse(0);
                int cap=w.phase.equals("RECOVERY")?f50(pct(old,80)):f50(Math.min(pct(old,growth),old+1500));
                int longCap=w.phase.equals("RECOVERY")?f50(pct(oldLong,80)):f50(Math.min(pct(oldLong,105),oldLong+500));
                require(weekly<=cap&&longest<=longCap,"PRESERVED_HISTORY_CONFLICT","baselineWeeklyM");}
            if(!w.phase.equals("RECOVERY"))anchor=w;
        }
    }
    private static void validateOutput(List<Day> days,Inputs in) {
        require(days.size()==ChronoUnit.DAYS.between(in.startDate,in.endDate)+1,"OUTPUT_BUDGET");
        Set<LocalDate> unique=new HashSet<>();
        for(Day d:days) {
            require(unique.add(d.localDate) && d.steps.size()<=32,"OUTPUT_BUDGET");
            if(!run(d)){require(d.steps.isEmpty()&&d.targetDistanceM==null&&d.targetDurationS==null,"OUTPUT_BUDGET");continue;}
            require((d.targetDistanceM==null)!=(d.targetDurationS==null),"OUTPUT_BUDGET");
            int m=0,s=0;for(int k=0;k<d.steps.size();k++){Step step=d.steps.get(k);require(step.sequence==k&&step.repetitions==1&&(step.distanceM==null)!=(step.durationS==null),"OUTPUT_BUDGET");m+=step.distanceM==null?0:step.distanceM;s+=step.durationS==null?0:step.durationS;}
            require(m==Objects.requireNonNullElse(d.targetDistanceM,0)&&s==Objects.requireNonNullElse(d.targetDurationS,0),"OUTPUT_BUDGET");
        }
        for(Week week:weeks(days)) {
            long quality=week.days.stream().filter(d->Set.of("STEADY","INTERVAL").contains(d.workoutType)).count();
            int controlled=week.days.stream().flatMap(d->d.steps.stream()).filter(s->Set.of("CONTROLLED","STEADY").contains(s.effortKey)).mapToInt(s->Objects.requireNonNullElse(s.distanceM,0)).sum();
            require(quality<=1 && controlled*5<=Objects.requireNonNullElse(week.trainingDistanceM,0),"PRESERVED_HISTORY_CONFLICT","availableWeekdays","baselineWeeklyM");
        }
    }
    public static List<Week> weeks(List<Day> days) {
        Map<LocalDate,List<Day>> groups=new TreeMap<>();for(Day d:days)groups.computeIfAbsent(d.localDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)),k->new ArrayList<>()).add(d);
        List<Week> result=new ArrayList<>();groups.forEach((date,ds)->{
            int m=0,s=0,tm=0,ts=0,event=0,count=0;boolean hasM=false,hasS=false,hasTrainingM=false;
            for(Day d:ds){if(run(d))count++;if(d.targetDistanceM!=null){hasM=true;m+=d.targetDistanceM;if(d.workoutType.equals("EVENT"))event+=d.targetDistanceM;else {hasTrainingM=true;tm+=d.targetDistanceM;}}if(d.targetDurationS!=null){hasS=true;s+=d.targetDurationS;ts+=d.targetDurationS;}}
            // Retained history keeps its original phase. Newly generated days define the revised week,
            // including a midweek transition to recovery or taper after a plan edit.
            String phase=ds.stream().filter(d->d.versionId==null&&!d.phase.equals("GOAL"))
                .max(Comparator.comparing(Day::localDate)).orElseGet(()->ds.stream().filter(d->!d.phase.equals("GOAL"))
                    .max(Comparator.comparing(Day::localDate)).orElse(ds.get(0))).phase;
            result.add(new Week(date,phase,hasM?m:null,hasS?s:null,hasTrainingM?tm:null,hasS?ts:null,event,count,List.copyOf(ds)));
        });return List.copyOf(result);
    }
}
