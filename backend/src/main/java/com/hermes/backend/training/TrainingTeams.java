package com.hermes.backend.training;

import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

public final class TrainingTeams {
    final TrainingStore db;final TrainingAccess acl;
    public TrainingTeams(TrainingStore db,TrainingAccess acl){this.db=db;this.acl=acl;}
    Map<String,Object> membership(String actor,String team) {return db.one("select * from tw_member where team_id=? and user_id=? and state='active'",id(team),actor);}
    void admin(String actor,String team) {check("admin".equals(membership(actor,team).get("role")),404,"NOT_FOUND");}
    Map<String,Object> lockTeam(String team,String... extra) {var t=db.one("select * from tw_team where id=? for update",id(team));var targets=new ArrayList<>(db.rows("select user_id from tw_member where team_id=?",team).stream().map(r->(String)r.get("user_id")).toList());targets.addAll(List.of(extra));db.lockAll(targets);return t;}
    public Map<String,Object> create(String actor,String name) {return db.atomic(()->{
        check(name!=null&&!name.isBlank()&&name.length()<=160,422,"INVALID_TEAM_NAME");db.lock(actor);String id=uuid();
        db.jdbc.update("insert into tw_team(id,name,slug,creator_id) values(?,?,?,?)",id,name,id,actor);
        db.jdbc.update("insert into tw_member(team_id,user_id,role,state) values(?,?,'admin','active')",id,actor);
        db.audit(actor,actor,"TEAM_CREATED");return map("id",id,"slug",id,"name",name);
    });}
    public Map<String,Object> join(String actor,String team) {return db.atomic(()->{
        lockTeam(team,actor);var old=db.rows("select * from tw_member where team_id=? and user_id=?",team,actor);
        if(old.isEmpty())db.jdbc.update("insert into tw_member(team_id,user_id,role,state) values(?,?,'member','pending')",team,actor);
        else if("removed".equals(old.get(0).get("state")))db.jdbc.update("update tw_member set role='member',state='pending' where team_id=? and user_id=?",team,actor);
        db.audit(actor,actor,"TEAM_JOIN_REQUEST");return map("requested",true);
    });}
    public Map<String,Object> member(String actor,String team,String target,String role) {return db.atomic(()->{
        check(Set.of("member","follower","coach","admin","removed").contains(role),422,"INVALID_ROLE");lockTeam(team);
        if(!actor.equals(target)||!role.equals("removed"))admin(actor,team);else membership(actor,team);
        var current=db.one("select * from tw_member where team_id=? and user_id=? and state<>'removed'",team,id(target));
        if("admin".equals(current.get("role"))&&!role.equals("admin"))check(((Number)db.one("select count(*) as total from tw_member where team_id=? and role='admin' and state='active'",team).get("total")).intValue()>1,409,"LAST_ADMINISTRATOR");
        db.jdbc.update("update tw_member set role=?,state=? where team_id=? and user_id=?",role.equals("removed")?current.get("role"):role,role.equals("removed")?"removed":"active",team,target);
        if(role.equals("removed"))db.jdbc.update("update tw_consent set state='revoked' where team_id=? and user_id=?",team,target);
        db.jdbc.update("update tw_team set revision=revision+1 where id=?",team);db.touch(target);db.audit(actor,target,"TEAM_MEMBERSHIP_CHANGED");return map("updated",true);
    });}
    public Map<String,Object> consent(String actor,String team,String decision,long scope,String level,List<String> wellness) {return db.atomic(()->{
        check(Set.of("granted","declined","revoked").contains(decision)&&Set.of("read","coach").contains(level),422,"INVALID_CONSENT");var mask=mask(wellness);
        var t=lockTeam(team);check("member".equals(membership(actor,team).get("role")),404,"NOT_FOUND");
        check(scope==((Number)t.get("scope_revision")).longValue(),409,"SCOPE_CHANGED");
        db.jdbc.update("delete from tw_consent where team_id=? and user_id=?",team,actor);
        db.jdbc.update("insert into tw_consent(team_id,user_id,scope_revision,state,access_level,wellness) values(?,?,?,?,?,?)",team,actor,scope,decision,level,db.encode(mask));
        db.touch(actor);db.audit(actor,actor,"TEAM_CONSENT_"+decision.toUpperCase(Locale.ROOT));return map("state",decision);
    });}
    public Map<String,Object> update(String actor,String team,Map<String,Object> body,long revision) {return db.atomic(()->{
        fields(body,"name","coachingEnabled","posting","visibility");var t=lockTeam(team);admin(actor,team);match(revision,t,"revision");
        String name=body.containsKey("name")?text(body,"name",160):(String)t.get("name");
        String posting=String.valueOf(body.getOrDefault("posting",t.get("posting"))),visibility=String.valueOf(body.getOrDefault("visibility",t.get("visibility")));
        check(Set.of("members","staff").contains(posting)&&Set.of("members","staff").contains(visibility),422,"INVALID_TEAM_POLICY");
        Object flag=body.getOrDefault("coachingEnabled",t.get("coaching_enabled"));check(flag instanceof Boolean,422,"INVALID_TEAM_POLICY");boolean enabled=(Boolean)flag;
        long scope=((Number)t.get("scope_revision")).longValue()+(enabled!=(Boolean)t.get("coaching_enabled")?1:0);
        db.jdbc.update("update tw_team set name=?,posting=?,visibility=?,coaching_enabled=?,scope_revision=?,revision=revision+1 where id=?",name,posting,visibility,enabled,scope,team);
        for(var m:db.rows("select user_id from tw_member where team_id=?",team))db.touch((String)m.get("user_id"));db.audit(actor,actor,"TEAM_POLICY_CHANGED");return map("updated",true);
    });}
    public Map<String,Object> list(String actor) {return db.atomic(()->map("items",db.rows("select t.*,m.role as own_role from tw_team t join tw_member m on m.team_id=t.id where m.user_id=? and m.state='active' order by t.id",actor).stream().map(t->{
        String id=(String)t.get("id");boolean staff=Set.of("coach","admin").contains(t.get("own_role"));
        var members=db.rows("select * from tw_member where team_id=? order by user_id",id).stream().filter(m->staff||"members".equals(t.get("visibility"))||actor.equals(m.get("user_id"))).map(m->map("userId",m.get("user_id"),"name",db.profile((String)m.get("user_id")).get("name"),"role",m.get("role"),"state",m.get("state"))).toList();
        var consents=db.rows("select * from tw_consent where team_id=? and user_id=?",id,actor);
        Map<String,Object> consent=map("state","pending");if(!consents.isEmpty()){var c=consents.get(0);consent=map("state","granted".equals(c.get("state"))&&!c.get("scope_revision").equals(t.get("scope_revision"))?"scope changed — review required":c.get("state"));}
        return map("id",id,"name",t.get("name"),"slug",t.get("slug"),"revision",t.get("revision"),"scopeRevision",t.get("scope_revision"),"coachingEnabled",t.get("coaching_enabled"),"posting",t.get("posting"),"visibility",t.get("visibility"),"ownRole",t.get("own_role"),"members",members,"consent",consent);
    }).toList()));}
    public Map<String,Object> joinCard(String slug) {var t=db.one("select id,name,slug from tw_team where slug=?",slug);return map("id",t.get("id"),"name",t.get("name"),"slug",t.get("slug"));}
}
