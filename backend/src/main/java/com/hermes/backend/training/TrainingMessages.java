package com.hermes.backend.training;

import java.time.Instant;
import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

public final class TrainingMessages {
    final TrainingStore db;final TrainingAccess acl;final TrainingTeams teams;final TrainingLibrary library;
    public TrainingMessages(TrainingStore db,TrainingAccess acl,TrainingTeams teams,TrainingLibrary library){this.db=db;this.acl=acl;this.teams=teams;this.library=library;}
    public boolean canRead(String actor,String conversation){try{require(actor,conversation,false);return true;}catch(TrainingFailure denied){if(denied.status==404)return false;throw denied;}}
    Map<String,Object> require(String actor,String conversation,boolean write) {
        var c=db.one("select * from tw_conversation where id=?",id(conversation));
        if(c.get("kind").equals("group")){String tid=(String)c.get("team_id");if(write)teams.lockTeam(tid);var m=teams.membership(actor,tid);
            if(write){var t=db.one("select posting from tw_team where id=?",tid);check(!t.get("posting").equals("staff")||Set.of("coach","admin").contains(m.get("role")),404,"NOT_FOUND");}}
        else{db.one("select user_id from tw_participant where conversation_id=? and user_id=?",conversation,actor);
            if(c.get("kind").equals("direct")){var peers=db.rows("select user_id from tw_participant where conversation_id=? and user_id<>?",conversation,actor).stream().map(p->(String)p.get("user_id")).toList();check(peers.size()==1,404,"NOT_FOUND");String peer=peers.get(0);if(write)db.lockAll(List.of(actor,peer));check(acl.can(actor,peer,false,null)||acl.can(peer,actor,false,null),404,"NOT_FOUND");}
            if(c.get("activity_id")!=null){var b=db.one("select athlete_id,activity_id from tw_activity where id=?",c.get("activity_id"));String subject=(String)b.get("athlete_id");if(write)db.lock(subject);acl.require(actor,subject,false,null);
                if(!subject.equals(actor))check(!Boolean.TRUE.equals(db.one("select strava_api_sourced from activities where id=?",b.get("activity_id")).get("strava_api_sourced")),404,"NOT_FOUND");}}
        return c;
    }
    public Map<String,Object> open(String actor,Map<String,Object> body){return db.atomic(()->{
        fields(body,"kind","teamId","activityId","peerId");String kind=text(body,"kind",8);check(Set.of("direct","group","activity").contains(kind),422,"INVALID_CONVERSATION");
        String team=null,activity=null,peer=null;var participants=new TreeSet<String>();participants.add(actor);
        if(kind.equals("group")){team=id(text(body,"teamId",36));teams.lockTeam(team);teams.membership(actor,team);var old=db.rows("select id from tw_conversation where kind='group' and team_id=?",team);if(!old.isEmpty())return map("id",old.get(0).get("id"));}
        else if(kind.equals("activity")){activity=id(text(body,"activityId",36));var b=db.one("select athlete_id,activity_id from tw_activity where id=?",activity);peer=(String)b.get("athlete_id");db.lock(peer);acl.require(actor,peer,false,null);
            if(!actor.equals(peer))check(!Boolean.TRUE.equals(db.one("select strava_api_sourced from activities where id=?",b.get("activity_id")).get("strava_api_sourced")),404,"NOT_FOUND");participants.add(peer);}
        else{peer=id(text(body,"peerId",36));db.lockAll(List.of(actor,peer));check(acl.can(actor,peer,false,null)||acl.can(peer,actor,false,null),404,"NOT_FOUND");participants.add(peer);}
        if(!kind.equals("group")){
            String candidateSql="select c.id from tw_conversation c join tw_participant p on p.conversation_id=c.id where c.kind=? and p.user_id=? and ";
            // PostgreSQL cannot infer the type of an independent null parameter in '? is null'.
            var candidates=activity==null?db.rows(candidateSql+"c.activity_id is null",kind,actor):db.rows(candidateSql+"c.activity_id=?",kind,actor,activity);
            for(var old:candidates){String cid=(String)old.get("id");var ids=db.rows("select user_id from tw_participant where conversation_id=?",cid).stream().map(x->(String)x.get("user_id")).collect(java.util.stream.Collectors.toSet());if(ids.equals(participants))return map("id",cid);}}
        String id=uuid();db.jdbc.update("insert into tw_conversation(id,kind,team_id,activity_id) values(?,?,?,?)",id,kind,team,activity);for(String p:participants)db.jdbc.update("insert into tw_participant(conversation_id,user_id) values(?,?)",id,p);return map("id",id);
    });}
    public Map<String,Object> list(String actor){return db.atomic(()->{
        var candidates=db.rows("select distinct c.* from tw_conversation c left join tw_participant p on p.conversation_id=c.id left join tw_member m on m.team_id=c.team_id where p.user_id=? or (m.user_id=? and m.state='active') order by c.id fetch first 200 rows only",actor,actor);
        var result=new ArrayList<Map<String,Object>>();for(var c:candidates){String id=(String)c.get("id");if(!canRead(actor,id))continue;String name=c.get("kind").equals("group")?(String)db.one("select name from tw_team where id=?",c.get("team_id")).get("name"):c.get("kind").equals("activity")?"Session conversation":"Private conversation";result.add(map("id",id,"name",name,"kind",c.get("kind")));}
        return map("items",result,"nextCursor",null);
    });}
    public Map<String,Object> messages(String actor,String conversation){return db.atomic(()->{
        require(actor,conversation,false);var rows=new ArrayList<>(db.rows("select * from tw_message where conversation_id=? order by created_at desc,id desc fetch first 200 rows only",conversation));Collections.reverse(rows);
        return map("items",rows.stream().map(m->{Object shared=null;if(m.get("workout_id")!=null){var w=db.one("select current_version from tw_workout where id=?",m.get("workout_id"));shared=library.workout(actor,(String)m.get("workout_id"),((Number)w.get("current_version")).intValue());}return map("id",m.get("id"),"senderName",db.profile((String)m.get("sender_id")).get("name"),"body",m.get("body"),"at",Instant.ofEpochMilli(((Number)m.get("created_at")).longValue()).toString(),"workoutId",m.get("workout_id"),"sharedWorkout",shared);}).toList());
    });}
    public Map<String,Object> send(String actor,String conversation,Map<String,Object> body){return db.atomic(()->{
        fields(body,"body","workoutId");require(actor,conversation,true);String text=text(body,"body",2000),workout=body.get("workoutId")==null?null:id(String.valueOf(body.get("workoutId")));
        if(workout!=null)db.one("select id from tw_workout where id=? and owner_id=?",workout,actor);
        String id=uuid();db.jdbc.update("insert into tw_message(id,conversation_id,sender_id,body,workout_id,created_at) values(?,?,?,?,?,?)",id,conversation,actor,text,workout,System.currentTimeMillis());db.audit(actor,actor,"MESSAGE_SENT");return map("id",id);
    });}
}
