package com.hermes.backend.training;

import com.hermes.backend.runner.*;
import com.hermes.backend.activity.*;
import com.hermes.backend.coaching.*;
import com.hermes.backend.coaching.plan.TrainingCalendarBridge;
import jakarta.persistence.EntityManager;
import org.springframework.context.ApplicationEventPublisher;
import java.time.*;
import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

public final class TrainingAthletes {
    final TrainingStore db;final TrainingAccess acl;final RunnerRepository runners;final ActivityRepository activities;final ActivityDataAccess data;final ActivityEditService edits;
    final DailySleepDataRepository sleep;final DailyWellnessSummaryRepository wellness;final TrainingCalendarBridge calendar;final EntityManager em;final ApplicationEventPublisher events;
    public TrainingAthletes(TrainingStore db,TrainingAccess acl,RunnerRepository runners,ActivityRepository activities,ActivityDataAccess data,DailySleepDataRepository sleep,DailyWellnessSummaryRepository wellness,TrainingCalendarBridge calendar,EntityManager em,ApplicationEventPublisher events,ActivityEditService edits){this.db=db;this.acl=acl;this.runners=runners;this.activities=activities;this.data=data;this.sleep=sleep;this.wellness=wellness;this.calendar=calendar;this.em=em;this.events=events;this.edits=edits;}
    Runner runner(String subject){return runners.findById(db.runner(subject)).filter(r->!r.isDeleted()).orElseThrow(()->new TrainingFailure(404,"NOT_FOUND"));}
    public Map<String,Object> me(String actor){return db.atomic(()->{
        db.lock(actor);var identity=runner(actor);var row=db.one("select settings from tw_profile where id=?",actor);var settings=db.object(row.get("settings"));var current=new LinkedHashMap<>(settings);
        if(identity.getDisplayName()!=null&&!identity.getDisplayName().isBlank())settings.put("name",identity.getDisplayName());
        if(identity.getTimeZone()!=null&&!identity.getTimeZone().isBlank())settings.put("zone",identity.getTimeZone());
        if(identity.getMaxHeartRateBpm()!=null&&identity.getMaxHeartRateBpm()>=80&&identity.getMaxHeartRateBpm()<=240)settings.put("maxHr",identity.getMaxHeartRateBpm());
        if(!settings.equals(current)){db.jdbc.update("update tw_profile set settings=?,revision=revision+1,data_revision=data_revision+1 where id=?",db.encode(settings),actor);db.audit(actor,actor,"CANONICAL_PROFILE_REFRESHED");}
        return db.profile(actor);
    });}
    public Map<String,Object> profile(String actor,Map<String,Object> body,long revision){return db.atomic(()->{
        fields(body,"name","zone","units","maxHr","ftp","fitnessTau","fatigueTau","discoverable","routePrivate","notifications");db.lock(actor);var current=db.one("select * from tw_profile where id=?",actor);match(revision,current,"revision");var settings=db.object(current.get("settings"));
        if(body.containsKey("name"))settings.put("name",text(body,"name",160));
        if(body.containsKey("zone")){String zone=text(body,"zone",64);try{ZoneId.of(zone);}catch(Exception e){throw new TrainingFailure(422,"INVALID_TIME_ZONE");}settings.put("zone",zone);}
        if(body.containsKey("units")){check(Set.of("metric","imperial").contains(body.get("units")),422,"INVALID_UNITS");settings.put("units",body.get("units"));}
        for(String key:List.of("maxHr","ftp","fitnessTau","fatigueTau"))if(body.containsKey(key))settings.put(key,number(body,key,key.equals("maxHr")?80:1,key.equals("maxHr")?240:key.equals("fitnessTau")?180:key.equals("fatigueTau")?60:2000));
        for(String key:List.of("discoverable","routePrivate","notifications"))if(body.containsKey(key)){check(body.get(key) instanceof Boolean,422,"INVALID_"+key);settings.put(key,body.get(key));}
        var owner=runner(actor);owner.setTimeZone((String)settings.get("zone"));owner.setDisplayName((String)settings.get("name"));owner.setMaxHeartRateBpm(((Number)settings.get("maxHr")).intValue());runners.save(owner);
        db.jdbc.update("update tw_profile set settings=?,revision=revision+1,data_revision=data_revision+1 where id=?",db.encode(settings),actor);db.audit(actor,actor,"PROFILE_UPDATED");return db.profile(actor);
    });}
    public Map<String,Object> roster(String actor,String query,boolean discovery){return db.atomic(()->{
        var ids=new TreeSet<String>();ids.add(actor);
        db.rows("select subject_id from tw_access where grantee_id=? and state='accepted'",actor).forEach(r->ids.add((String)r.get("subject_id")));
        db.rows("select distinct m.user_id from tw_member m join tw_member mine on m.team_id=mine.team_id join tw_team t on t.id=m.team_id where mine.user_id=? and mine.state='active' and m.state='active' and (t.visibility='members' or mine.role in ('admin','coach'))",actor).forEach(r->ids.add((String)r.get("user_id")));
        // Effective coaching paths remain usable independently of directory visibility.
        db.rows("select distinct c.user_id from tw_consent c join tw_member mine on mine.team_id=c.team_id where mine.user_id=? and mine.state='active' and mine.role in ('admin','coach','follower') and c.state='granted'",actor).stream().map(r->(String)r.get("user_id")).filter(id->acl.can(actor,id,false,null)).forEach(ids::add);
        if(discovery)db.rows("select id from tw_profile order by id fetch first 1000 rows only").stream().map(r->(String)r.get("id")).filter(id->Boolean.TRUE.equals(db.profile(id).get("discoverable"))).forEach(ids::add);
        String needle=query==null?"":query.toLowerCase(Locale.ROOT);var items=new ArrayList<Map<String,Object>>();
        for(String id:ids){var p=db.profile(id);String name=(String)p.get("name");if(!name.toLowerCase(Locale.ROOT).contains(needle))continue;
            String access=actor.equals(id)?"owner":acl.can(actor,id,true,null)?"coach":acl.can(actor,id,false,null)?"read":"none";items.add(map("id",id,"name",name,"access",access,"zone",access.equals("none")?null:p.get("zone"),"load",null));if(items.size()==200)break;}
        return map("items",items,"nextCursor",null);
    });}
    public String bind(Activity activity,String subject){var old=db.rows("select id from tw_activity where activity_id=?",activity.getId());if(!old.isEmpty())return (String)old.get(0).get("id");String id=uuid();db.jdbc.update("insert into tw_activity(id,activity_id,athlete_id) values(?,?,?)",id,activity.getId(),subject);return id;}
    public Map<String,Object> fromCanonical(String actor,long canonicalId){return db.atomic(()->{
        var activity=activities.findById(canonicalId).orElseThrow(()->new TrainingFailure(404,"NOT_FOUND"));
        var identities=db.rows("select id from tw_profile where runner_id=?",activity.getRunner().getId());
        check(!identities.isEmpty(),404,"NOT_FOUND");String subject=(String)identities.get(0).get("id");
        db.lock(subject);acl.require(actor,subject,false,null);source(actor,subject,activity);
        return dto(actor,subject,activity,bind(activity,subject),true);
    });}
    Map<String,Object> binding(String id){return db.one("select * from tw_activity where id=?",id(id));}
    Activity canonical(Map<String,Object> binding,String subject){return activities.findByIdAndRunner(((Number)binding.get("activity_id")).longValue(),runner(subject)).orElseThrow(()->new TrainingFailure(404,"NOT_FOUND"));}
    void source(String actor,String subject,Activity a){if(!actor.equals(subject))check(!a.isStravaApiSourced(),404,"NOT_FOUND");}
    public Map<String,Object> list(String actor,String subject){return db.atomic(()->{
        db.lock(subject);acl.require(actor,subject,false,null);var r=runner(subject);
        // Source policy is applied in the query before bounding the list.
        var list=em.createQuery("select a from Activity a where a.runner.id=:owner and (:self=true or a.stravaApiSourced=false) order by a.id desc",Activity.class).setParameter("owner",r.getId()).setParameter("self",actor.equals(subject)).setMaxResults(201).getResultList();
        var items=list.stream().limit(200).map(a->dto(actor,subject,a,bind(a,subject),false)).toList();return map("items",items,"nextCursor",null,"truncated",list.size()>200);
    });}
    public Map<String,Object> detail(String actor,String activity){return db.atomic(()->{
        var binding=binding(activity);String subject=(String)binding.get("athlete_id");db.lock(subject);acl.require(actor,subject,false,null);var a=canonical(binding,subject);source(actor,subject,a);return dto(actor,subject,a,activity,true);
    });}
    Map<String,Object> dto(String actor,String subject,Activity a,String id,boolean full){var binding=binding(id);var settings=db.profile(subject);String date=binding.get("civil_date")==null?null:binding.get("civil_date").toString();
        if(date==null&&a.getStartTime()!=null)date=ActivityLocalDates.of(a,runner(subject)).toString();double minutes=a.getMovingTimeSeconds()>0?a.getMovingTimeSeconds()/60d:a.getDurationSeconds()==null?0:a.getDurationSeconds()/60d;
        // Ownership/source already verified above. This internal HR query never serializes route coordinates.
        var hr=data.findHeartRateStream(a.getId());var samples=new ArrayList<Map<String,Object>>();for(int i=0;i<hr.size();i++)samples.add(map("offset",hr.elapsedSeconds()[i],"hr",hr.heartRates()[i]<=0?null:hr.heartRates()[i],"power",null));
        var result=map("id",id,"canonicalId",a.getId(),"athleteId",subject,"title",a.getName(),"date",date,"minutes",minutes,"sport",binding.get("sport")!=null?binding.get("sport"):a.getActivityType()==ActivityType.RUN?"Running":"Other","revision",binding.get("revision"),"source",String.valueOf(a.getProvider()),"shareable",!a.isStravaApiSourced(),"rpe",a.getPerceivedExertion());
        result.put("distanceKm",a.getDistanceKm()>0?a.getDistanceKm():null);
        result.put("averageHeartRate",a.getAverageHeartRate());
        result.putAll(TrainingMath.derive(minutes,samples,a.getPerceivedExertion(),((Number)settings.get("maxHr")).intValue()));
        if(full){var reduced=new ArrayList<Map<String,Object>>();int stride=Math.max(1,(int)Math.ceil(samples.size()/5000d));for(int i=0;i<samples.size();i+=stride)reduced.add(samples.get(i));if(!samples.isEmpty()&&!reduced.get(reduced.size()-1).equals(samples.get(samples.size()-1)))reduced.add(samples.get(samples.size()-1));result.put("samples",reduced);result.put("decimated",stride>1);result.put("intervals",db.objects(binding.get("intervals")).isEmpty()?TrainingMath.intervals(samples):db.objects(binding.get("intervals")));}
        else result.put("samples",List.of());return result;
    }
    public Map<String,Object> manual(String actor,String subject,Map<String,Object> body){return db.atomic(()->{
        fields(body,"title","date","minutes","sport","rpe");db.lock(subject);acl.require(actor,subject,true,null);String title=text(body,"title",120),date=TrainingBulk.date(text(body,"date",10));double minutes=number(body,"minutes",1,10080);String sport=text(body,"sport",40);check(Set.of("Running","Cycling","Swimming","Other").contains(sport),422,"INVALID_SPORT");int rpe=(int)number(body,"rpe",1,10);
        var a=new Activity();a.setRunner(runner(subject));a.setName(title);a.setActivityType(sport.equals("Running")?ActivityType.RUN:ActivityType.NON_RUN);a.setProvider(ImportProvider.MANUAL);a.setMovingTimeSeconds((int)Math.round(minutes*60));a.setDurationSeconds((long)Math.round(minutes*60));a.setPerceivedExertion(rpe);a.setStartTime(null);a.setStartDate(null);a.setStravaApiSourced(false);a=activities.saveAndFlush(a);String id=bind(a,subject);db.jdbc.update("update tw_activity set civil_date=?,sport=? where id=?",java.sql.Date.valueOf(date),sport,id);db.touch(subject);db.audit(actor,subject,"MANUAL_ACTIVITY_CREATED");events.publishEvent(new ActivityIngestedEvent(a.getRunner().getId(),a.getId()));return dto(actor,subject,a,id,true);
    });}
    public Map<String,Object> effort(String actor,String activity,Map<String,Object> body,long revision){return db.atomic(()->{
        fields(body,"rpe");var b=binding(activity);String subject=(String)b.get("athlete_id");db.lock(subject);acl.require(actor,subject,true,null);b=binding(activity);match(revision,b,"revision");var a=canonical(b,subject);source(actor,subject,a);
        int rating=(int)number(body,"rpe",1,10);
        // The workspace owns its profile/revision lock first; native edits never take that lock.
        // The shared service locks and refreshes the canonical row, and publishes metrics changes after commit.
        var applied=edits.apply(a.getRunner(),a.getId(),new ActivityEditService.Request(
                true,rating,false,false,false,null,false,null,false,null,false,List.of()))
                .orElseThrow(()->new TrainingFailure(404,"NOT_FOUND"));
        db.jdbc.update("update tw_activity set revision=revision+1 where id=?",activity);db.touch(subject);db.audit(actor,subject,"ACTIVITY_EFFORT_UPDATED");return dto(actor,subject,applied.activity(),activity,true);
    });}
    public Map<String,Object> intervals(String actor,String activity,List<Map<String,Object>> intervals,long revision){return db.atomic(()->{
        check(intervals!=null&&intervals.size()<=2000,422,"INTERVAL_LIMIT");var b=binding(activity);String subject=(String)b.get("athlete_id");db.lock(subject);acl.require(actor,subject,true,null);b=binding(activity);match(revision,b,"revision");var a=canonical(b,subject);source(actor,subject,a);double duration=a.getMovingTimeSeconds()>0?a.getMovingTimeSeconds():Objects.requireNonNullElse(a.getDurationSeconds(),0L);
        var clean=new ArrayList<Map<String,Object>>();for(var interval:intervals){fields(interval,"id","start","end","minutes","name");double start=number(interval,"start",0,duration),end=number(interval,"end",0,duration);check(end>start,422,"INVALID_INTERVAL_BOUNDS");clean.add(map("id",uuid(),"start",start,"end",end,"minutes",(end-start)/60));}
        db.jdbc.update("update tw_activity set intervals=?,revision=revision+1 where id=?",db.encode(clean),activity);db.touch(subject);db.audit(actor,subject,"ACTIVITY_INTERVALS_UPDATED");return dto(actor,subject,a,activity,true);
    });}
    public Map<String,Object> calendar(String actor,String subject,String start,String end){return db.atomic(()->{db.lock(subject);acl.require(actor,subject,false,null);var actual=list(actor,subject);var planned=calendar.list(runner(subject));var inRange=(java.util.function.Predicate<Map<String,Object>>)x->x.get("date")!=null&&(start==null||x.get("date").toString().compareTo(TrainingBulk.date(start))>=0)&&(end==null||x.get("date").toString().compareTo(TrainingBulk.date(end))<=0);
        @SuppressWarnings("unchecked") var rows=(List<Map<String,Object>>)actual.get("items");return map("activities",rows.stream().filter(inRange).toList(),"events",planned.stream().filter(inRange).toList(),"truncated",actual.get("truncated"));});}
    public Map<String,Object> event(String actor,String subject,Map<String,Object> body){return db.atomic(()->{
        fields(body,"title","date","minutes","sport","source","sourceVersion","workoutId","projectedLoad");db.lock(subject);acl.require(actor,subject,true,null);var clean=map("title",text(body,"title",160),"date",TrainingBulk.date(text(body,"date",10)),"minutes",number(body,"minutes",.1,10080),"sport",text(body,"sport",40));
        clean.put("projectedLoad",body.containsKey("projectedLoad")?number(body,"projectedLoad",0,5000):Math.round(((Number)clean.get("minutes")).doubleValue()));
        for(String key:List.of("source","sourceVersion","workoutId"))if(body.containsKey(key))clean.put(key,body.get(key));var event=calendar.create(runner(subject),subject,clean);db.touch(subject);db.audit(actor,subject,"PRESCRIPTION_CREATED");return event;
    });}
    String eventSubject(String event){long runner=db.atomic(()->calendar.owner(id(event)));return (String)db.one("select id from tw_profile where runner_id=?",runner).get("id");}
    public Map<String,Object> change(String actor,String event,Map<String,Object> body,long revision){return db.atomic(()->{fields(body,"date","state");String subject=eventSubject(event);db.lock(subject);acl.require(actor,subject,true,null);var changed=calendar.change(runner(subject),subject,event,body,revision);db.touch(subject);db.audit(actor,subject,"PRESCRIPTION_CHANGED");return changed;});}
    public Map<String,Object> link(String actor,String event,String activity,long revision){return db.atomic(()->{String subject=eventSubject(event);db.lock(subject);acl.require(actor,subject,true,null);var b=binding(activity);check(subject.equals(b.get("athlete_id")),422,"ACTIVITY_OWNER_MISMATCH");var a=canonical(b,subject);source(actor,subject,a);var result=calendar.link(runner(subject),event,a,revision);db.touch(subject);db.audit(actor,subject,"COMPLETION_LINKED");return result;});}
    public List<Map<String,Object>> applyPlan(String actor,String subject,List<Map<String,Object>> items,String date,String key){var output=new ArrayList<Map<String,Object>>();for(var item:items){var b=new LinkedHashMap<>(item);b.remove("day");b.remove("steps");b.put("date",LocalDate.parse(date).plusDays(((Number)item.get("day")).longValue()).toString());output.add(event(actor,subject,b));}return output;}
    public Map<String,Object> fitness(String actor,String subject,String start,String end){var c=calendar(actor,subject,null,null);@SuppressWarnings("unchecked") var actual=(List<Map<String,Object>>)c.get("activities");@SuppressWarnings("unchecked") var planned=(List<Map<String,Object>>)c.get("events");var today=LocalDate.now(ZoneId.of((String)db.profile(subject).get("zone")));return map("items",TrainingMath.fitness(actual,planned,start==null?today.minusDays(35).toString():start,end==null?today.plusDays(14).toString():end,db.profile(subject)),"assumption","Zero baseline at window start; independently implemented HR/RPE v1 model. Unknown loads make days provisional. History is bounded to 200 recent eligible activities; full paginated recomputation is pending.");}
    public Map<String,Object> wellness(String actor,String subject){return db.atomic(()->{db.lock(subject);acl.require(actor,subject,false,null);var r=runner(subject);var out=new TreeMap<String,Map<String,Object>>();
        check(List.of("sleep","restingHr","feeling").stream().anyMatch(field->acl.can(actor,subject,false,field)),404,"NOT_FOUND");
        for(var x:db.rows("select civil_date,feeling,revision from tw_wellness_annotation where athlete_id=? order by civil_date desc fetch first 366 rows only",subject)){String d=x.get("civil_date").toString();var row=map("date",d,"revision",x.get("revision"),"source","manual","athleteId",subject);if(acl.can(actor,subject,false,"feeling")&&x.get("feeling")!=null)row.put("feeling",x.get("feeling"));out.put(d,row);}
        if(acl.can(actor,subject,false,"sleep"))for(var s:sleep.findByRunnerAndDateBetweenOrderByDateDesc(r,LocalDate.now().minusYears(10),LocalDate.now().plusDays(1))){if(s.getProvider()!=ImportProvider.MANUAL)continue;var row=out.get(s.getDate().toString());if(row!=null&&s.getSleepTimeSeconds()!=null)row.put("sleep",s.getSleepTimeSeconds()/3600d);}
        if(acl.can(actor,subject,false,"restingHr"))for(var w:wellness.findByRunnerAndDateBetweenOrderByDateDesc(r,LocalDate.now().minusYears(10),LocalDate.now().plusDays(1))){if(w.getProvider()!=ImportProvider.MANUAL)continue;var row=out.get(w.getDate().toString());if(row!=null&&w.getRestingHeartRate()!=null)row.put("restingHr",w.getRestingHeartRate());}
        return map("items",new ArrayList<>(out.values()));});}
    public Map<String,Object> saveWellness(String actor,String subject,String date,Map<String,Object> body,Long revision){return db.atomic(()->{
        fields(body,"sleep","restingHr","feeling");check(!body.isEmpty(),422,"MEASUREMENT_REQUIRED");db.lock(subject);for(String field:body.keySet())acl.require(actor,subject,true,field);LocalDate day=LocalDate.parse(TrainingBulk.date(date));var r=runner(subject);var old=db.rows("select * from tw_wellness_annotation where athlete_id=? and civil_date=?",subject,java.sql.Date.valueOf(day));
        if(!old.isEmpty()){check(revision!=null,428,"REVISION_REQUIRED");match(revision,old.get(0),"revision");db.jdbc.update("update tw_wellness_annotation set revision=revision+1 where athlete_id=? and civil_date=?",subject,java.sql.Date.valueOf(day));}
        else db.jdbc.update("insert into tw_wellness_annotation(athlete_id,civil_date) values(?,?)",subject,java.sql.Date.valueOf(day));
        if(body.containsKey("feeling"))db.jdbc.update("update tw_wellness_annotation set feeling=? where athlete_id=? and civil_date=?",(int)number(body,"feeling",1,5),subject,java.sql.Date.valueOf(day));
        if(body.containsKey("sleep")){var s=sleep.findByRunnerAndProviderAndDate(r,ImportProvider.MANUAL,day).orElseGet(DailySleepData::new);s.setRunner(r);s.setProvider(ImportProvider.MANUAL);s.setDate(day);s.setSourceChecksum(hash(subject+":"+date));s.setSleepTimeSeconds((int)Math.round(number(body,"sleep",0,24)*3600));sleep.saveAndFlush(s);}
        if(body.containsKey("restingHr")){var w=wellness.findByRunnerAndProviderAndDate(r,ImportProvider.MANUAL,day).orElseGet(DailyWellnessSummary::new);w.setRunner(r);w.setProvider(ImportProvider.MANUAL);w.setDate(day);w.setSourceChecksum(hash(subject+":"+date));w.setRestingHeartRate((int)number(body,"restingHr",25,150));wellness.saveAndFlush(w);}
        db.touch(subject);db.audit(actor,subject,"WELLNESS_UPDATED");return map("saved",true);
    });}
}
