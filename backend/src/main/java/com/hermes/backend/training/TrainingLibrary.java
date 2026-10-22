package com.hermes.backend.training;

import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

public final class TrainingLibrary {
    final TrainingStore db;final TrainingAccess acl;
    java.util.function.BiPredicate<String,String> conversationAccess=(actor,conversation)->false;
    public TrainingLibrary(TrainingStore db,TrainingAccess acl){this.db=db;this.acl=acl;}
    boolean readable(String actor,String type,String resource,String owner) {
        return actor.equals(owner)||!db.rows("select id from tw_share where resource_type=? and resource_id=? and grantee_id=?",type,resource,actor).isEmpty()
            ||type.equals("workout")&&db.rows("select distinct conversation_id from tw_message where workout_id=?",resource).stream().anyMatch(m->conversationAccess.test(actor,(String)m.get("conversation_id")));
    }
    public Map<String,Object> workout(String actor,String id,int version) {
        var w=db.one("select * from tw_workout where id=?",id(id));check(readable(actor,"workout",id,(String)w.get("owner_id")),404,"NOT_FOUND");
        var v=db.one("select payload from tw_workout_version where workout_id=? and ordinal=?",id,version);
        var result=db.object(v.get("payload"));result.putAll(map("id",id,"ownerId",w.get("owner_id"),"folderId",w.get("folder_id"),"version",version,"revision",w.get("current_version")));return result;
    }
    public Map<String,Object> saveWorkout(String actor,String id,Map<String,Object> body,Long revision) {return db.atomic(()->{
        fields(body,"title","source","sport","folderId");db.lock(actor);String source=text(body,"source",65536),title=text(body,"title",160);
        String sport=text(body,"sport",40);check(Set.of("Running","Cycling","Swimming","Other").contains(sport),422,"INVALID_SPORT");var compiled=TrainingWorkout.compile(source);
        String folder=body.get("folderId")==null||"".equals(body.get("folderId"))?null:id(String.valueOf(body.get("folderId")));
        if(folder!=null)db.one("select id from tw_folder where id=? and owner_id=?",folder,actor);
        int version=1;String resource=id==null?uuid():id(id);
        if(id==null)db.jdbc.update("insert into tw_workout(id,owner_id,folder_id) values(?,?,?)",resource,actor,folder);
        else{var w=db.one("select * from tw_workout where id=? and owner_id=? for update",resource,actor);check(revision!=null,428,"REVISION_REQUIRED");match(revision,w,"current_version");version=((Number)w.get("current_version")).intValue()+1;db.jdbc.update("update tw_workout set current_version=?,folder_id=? where id=?",version,folder,resource);}
        var payload=new LinkedHashMap<>(compiled);payload.putAll(map("title",title,"source",source,"sport",sport));
        db.jdbc.update("insert into tw_workout_version(workout_id,ordinal,payload) values(?,?,?)",resource,version,db.encode(payload));db.audit(actor,actor,"WORKOUT_PUBLISHED");return workout(actor,resource,version);
    });}
    public Map<String,Object> folder(String actor,String name) {return db.atomic(()->{check(name!=null&&!name.isBlank()&&name.length()<=160,422,"INVALID_FOLDER");String id=uuid();db.jdbc.update("insert into tw_folder(id,owner_id,name) values(?,?,?)",id,actor,name);return map("id",id,"ownerId",actor,"name",name);});}
    @SuppressWarnings("unchecked") public Map<String,Object> savePlan(String actor,Map<String,Object> body) {return db.atomic(()->{
        fields(body,"title","items");String title=text(body,"title",160);check(body.get("items") instanceof List<?>,422,"PLAN_ITEMS_REQUIRED");var input=(List<?>)body.get("items");check(!input.isEmpty()&&input.size()<=366,422,"PLAN_ITEM_LIMIT");
        var pinned=new ArrayList<Map<String,Object>>();
        for(Object value:input){check(value instanceof Map<?,?>,422,"INVALID_PLAN_ITEM");var item=(Map<String,Object>)value;
            fields(item,"workoutId","sourceVersion","day","title","minutes","sport","source");int day=(int)number(item,"day",0,365);check(number(item,"day",0,365)==day,422,"INVALID_DAY_OFFSET");
            int version=(int)number(item,"sourceVersion",1,100000);var w=workout(actor,text(item,"workoutId",36),version);
            pinned.add(map("day",day,"title",w.get("title"),"minutes",w.get("minutes"),"sport",w.get("sport"),"source",w.get("source"),"steps",w.get("steps"),"workoutId",w.get("id"),"sourceVersion",version));
        }
        String id=uuid();db.jdbc.update("insert into tw_plan(id,owner_id,title,payload) values(?,?,?,?)",id,actor,title,db.encode(pinned));db.audit(actor,actor,"PLAN_PUBLISHED");return plan(actor,id);
    });}
    public Map<String,Object> plan(String actor,String id) {var p=db.one("select * from tw_plan where id=?",id(id));check(readable(actor,"plan",id,(String)p.get("owner_id")),404,"NOT_FOUND");return map("id",id,"ownerId",p.get("owner_id"),"title",p.get("title"),"version",p.get("ordinal"),"revision",p.get("ordinal"),"items",db.objects(p.get("payload")));}
    public Map<String,Object> list(String actor) {return db.atomic(()->{
        var workouts=db.rows("select * from tw_workout where owner_id=? or id in (select resource_id from tw_share where resource_type='workout' and grantee_id=?) or id in (select workout_id from tw_message where workout_id is not null) order by id fetch first 1000 rows only",actor,actor).stream().filter(w->readable(actor,"workout",(String)w.get("id"),(String)w.get("owner_id"))).limit(200).map(w->workout(actor,(String)w.get("id"),((Number)w.get("current_version")).intValue())).toList();
        var plans=db.rows("select id from tw_plan where owner_id=? or id in (select resource_id from tw_share where resource_type='plan' and grantee_id=?) order by id fetch first 200 rows only",actor,actor).stream().map(p->plan(actor,(String)p.get("id"))).toList();
        var folders=db.rows("select * from tw_folder where owner_id=? order by id fetch first 200 rows only",actor).stream().map(f->map("id",f.get("id"),"ownerId",actor,"name",f.get("name"))).toList();return map("workouts",workouts,"plans",plans,"folders",folders);
    });}
    public Map<String,Object> share(String actor,String type,String resource,String recipient) {return db.atomic(()->{
        check(Set.of("workout","plan").contains(type),422,"INVALID_RESOURCE_TYPE");db.profile(id(recipient));
        // Identifiers and table names never come from arbitrary client SQL fields.
        db.one("select id from "+(type.equals("workout")?"tw_workout":"tw_plan")+" where id=? and owner_id=?",id(resource),actor);
        var old=db.rows("select id from tw_share where resource_type=? and resource_id=? and grantee_id=?",type,resource,recipient);
        if(old.isEmpty())db.jdbc.update("insert into tw_share(id,resource_type,resource_id,owner_id,grantee_id) values(?,?,?,?,?)",uuid(),type,resource,actor,recipient);db.audit(actor,recipient,"LIBRARY_SHARED");return map("shared",true);
    });}
}
