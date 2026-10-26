package com.hermes.backend.training;

import java.time.LocalDate;
import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

public final class TrainingBulk {
    @FunctionalInterface public interface PlanWriter {List<Map<String,Object>> apply(String actor,String subject,List<Map<String,Object>> items,String start,String key);}
    final TrainingStore db;final TrainingAccess acl;final TrainingLibrary library;final PlanWriter writer;
    public TrainingBulk(TrainingStore db,TrainingAccess acl,TrainingLibrary library,PlanWriter writer){this.db=db;this.acl=acl;this.library=library;this.writer=writer;}
    @SuppressWarnings("unchecked") public Map<String,Object> preview(String actor,String kind,Map<String,Object> body) {return db.atomic(()->{
        check(Set.of("plan","configuration").contains(kind),422,"INVALID_BULK_KIND");
        fields(body,"planId","athleteIds","date","units");check(body.get("athleteIds") instanceof List<?>,422,"TARGETS_REQUIRED");var raw=(List<?>)body.get("athleteIds");check(!raw.isEmpty()&&raw.size()<=50,422,"TARGET_LIMIT");
        var targets=raw.stream().map(v->id(String.valueOf(v))).distinct().sorted().toList();Object source;String date;int version=1;
        if(kind.equals("plan")){var p=library.plan(actor,text(body,"planId",36));source=p.get("items");version=((Number)p.get("version")).intValue();date=date(text(body,"date",10));}
        else{String units=text(body,"units",8);check(Set.of("metric","imperial").contains(units),422,"INVALID_UNITS");source=map("units",units);date=LocalDate.now(java.time.ZoneOffset.UTC).toString();}
        var payload=map("source",source,"date",date,"version",version,"planId",body.get("planId"));String hash=hash(db.encode(map("payload",payload,"targets",targets,"kind",kind)));String id=uuid();
        db.jdbc.update("insert into tw_bulk(id,actor_id,kind,request_hash,expires_at,payload) values(?,?,?,?,?,?)",id,actor,kind,hash,System.currentTimeMillis()+600000,db.encode(payload));
        var dto=new ArrayList<Map<String,Object>>();for(String target:targets){boolean eligible=acl.can(actor,target,true,null);long rev=eligible?db.revision(target):0;
            db.jdbc.update("insert into tw_bulk_target(operation_id,athlete_id,expected_revision,state) values(?,?,?,?)",id,target,rev,eligible?"ready":"denied");dto.add(eligible?map("athleteId",target,"name",db.profile(target).get("name"),"revision",rev,"eligible",true):map("athleteId",target,"eligible",false));}
        return map("id",id,"kind",kind,"hash",hash,"source",source,"date",date,"version",version,"targets",dto,"outcomes",List.of());
    });}
    public Map<String,Object> commit(String actor,String operation,String hash) {
        var op=db.one("select * from tw_bulk where id=? and actor_id=?",id(operation),actor);check(op.get("request_hash").equals(hash)&&((Number)op.get("expires_at")).longValue()>System.currentTimeMillis(),409,"PREVIEW_EXPIRED_OR_CHANGED");
        var result=new ArrayList<Map<String,Object>>();for(var target:db.rows("select athlete_id from tw_bulk_target where operation_id=? order by athlete_id",operation)) {
            String subject=(String)target.get("athlete_id");
            // Each target commits independently. No authority is cached in the preview or a receipt.
            result.add(db.atomic(()->{
                db.one("select id from tw_bulk where id=? and actor_id=? for update",operation,actor);
                var t=db.one("select * from tw_bulk_target where operation_id=? and athlete_id=?",operation,subject);
                if("denied".equals(t.get("state")))return outcome(subject,"denied");db.lock(subject);
                if(!acl.can(actor,subject,true,null))return outcome(subject,"denied");
                String state=(String)t.get("state");if(!state.equals("ready"))return outcome(subject,state.equals("applied")?"already applied":state);
                if(db.revision(subject)!=((Number)t.get("expected_revision")).longValue())state="conflict";
                else{var p=db.object(op.get("payload"));if(op.get("kind").equals("plan")){
                        var existing=db.rows("select id from tw_assignment where athlete_id=? and source_plan_id=? and source_version=? and start_date=?",subject,p.get("planId"),p.get("version"),java.sql.Date.valueOf((String)p.get("date")));
                        if(!existing.isEmpty()){db.jdbc.update("update tw_bulk_target set state='already applied' where operation_id=? and athlete_id=?",operation,subject);return outcome(subject,"already applied");}
                        writer.apply(actor,subject,db.objects(db.encode(p.get("source"))),(String)p.get("date"),operation+":"+subject);
                        db.jdbc.update("insert into tw_assignment(id,athlete_id,source_plan_id,source_version,start_date) values(?,?,?,?,?)",uuid(),subject,p.get("planId"),p.get("version"),java.sql.Date.valueOf((String)p.get("date")));
                    }
                    else{var settings=db.object(db.one("select settings from tw_profile where id=?",subject).get("settings"));settings.putAll((Map<String,Object>)p.get("source"));db.jdbc.update("update tw_profile set settings=?,revision=revision+1 where id=?",db.encode(settings),subject);}
                    db.touch(subject);state="applied";db.audit(actor,subject,"BULK_APPLIED");}
                db.jdbc.update("update tw_bulk_target set state=? where operation_id=? and athlete_id=?",state,operation,subject);return outcome(subject,state);
            }));
        }
        return map("id",operation,"outcomes",result);
    }
    Map<String,Object> outcome(String subject,String state){return state.equals("denied")?map("athleteId",subject,"state",state):map("athleteId",subject,"name",db.profile(subject).get("name"),"state",state);}
    public static String date(String value) {try{check(value.matches("\\d{4}-\\d{2}-\\d{2}"),422,"INVALID_DATE");return LocalDate.parse(value).toString();}catch(Exception e){throw new TrainingFailure(422,"INVALID_DATE");}}
}
