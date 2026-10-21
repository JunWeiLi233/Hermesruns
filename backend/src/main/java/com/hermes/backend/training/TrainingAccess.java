package com.hermes.backend.training;

import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;
import static com.hermes.backend.training.TrainingFailure.check;

/** Sole athlete-data policy. Team administration and global Hermes ADMIN never imply health access. */
public final class TrainingAccess {
    final TrainingStore db;
    public TrainingAccess(TrainingStore db) {this.db=db;}
    List<Map<String,Object>> paths(String actor,String subject) {
        if(actor.equals(subject))return List.of(map("level","coach","wellness",List.of("sleep","restingHr","feeling"),"source","owner"));
        var paths=new ArrayList<Map<String,Object>>();
        db.rows("select * from tw_access where subject_id=? and grantee_id=? and state='accepted'",subject,actor)
            .forEach(r->paths.add(map("level",r.get("access_level"),"wellness",db.strings(r.get("wellness")),"source","direct")));
        db.rows("""
            select t.id,c.access_level,c.wellness,recipient.role from tw_team t
            join tw_member athlete on athlete.team_id=t.id and athlete.user_id=? and athlete.state='active' and athlete.role='member'
            join tw_member recipient on recipient.team_id=t.id and recipient.user_id=? and recipient.state='active' and recipient.role in ('admin','coach','follower')
            join tw_consent c on c.team_id=t.id and c.user_id=athlete.user_id and c.state='granted' and c.scope_revision=t.scope_revision
            where t.coaching_enabled=true
            """,subject,actor).forEach(r->paths.add(map("level","follower".equals(r.get("role"))?"read":r.get("access_level"),"wellness",db.strings(r.get("wellness")),"source",r.get("id"))));
        return paths;
    }
    public boolean can(String actor,String subject,boolean write,String field) {
        return paths(actor,subject).stream().anyMatch(p->(!write||"coach".equals(p.get("level")))&&(field==null||((List<?>)p.get("wellness")).contains(field)));
    }
    public void require(String actor,String subject,boolean write,String field) {check(can(actor,subject,write,field),404,"NOT_FOUND");}
    public void owner(String actor,String subject) {check(actor.equals(subject),404,"NOT_FOUND");}
    public Map<String,Object> request(String actor,String subject,String level,List<String> wellness) {return db.atomic(()->{
        id(subject);check(!actor.equals(subject)&&Set.of("read","coach").contains(level),422,"INVALID_ACCESS_REQUEST");var mask=mask(wellness);
        db.lock(subject);db.profile(subject);
        // Requests never silently widen an existing accepted grant.
        var rows=db.rows("select * from tw_access where subject_id=? and grantee_id=? and access_level=?",subject,actor,level);
        if(!rows.isEmpty()){
            var existing=rows.get(0);String state=(String)existing.get("state");
            if(Set.of("pending","accepted").contains(state))return dto(existing);
            db.jdbc.update("update tw_access set state='pending',wellness=? where id=?",db.encode(mask),existing.get("id"));
            db.audit(actor,subject,"ACCESS_REQUEST");return dto(db.one("select * from tw_access where id=?",existing.get("id")));
        }
        String rid=uuid();db.jdbc.update("insert into tw_access(id,subject_id,grantee_id,access_level,state,wellness) values(?,?,?,?,'pending',?)",rid,subject,actor,level,db.encode(mask));
        db.audit(actor,subject,"ACCESS_REQUEST");return dto(db.one("select * from tw_access where id=?",rid));
    });}
    Map<String,Object> dto(Map<String,Object> r) {return map("id",r.get("id"),"subject",r.get("subject_id"),"grantee",r.get("grantee_id"),"level",r.get("access_level"),"state",r.get("state"),"wellness",db.strings(r.get("wellness")),"subjectName",db.profile((String)r.get("subject_id")).get("name"),"granteeName",db.profile((String)r.get("grantee_id")).get("name"));}
    public Map<String,Object> decide(String actor,String relationship,String decision) {return decide(actor,relationship,decision,null);}
    public Map<String,Object> decide(String actor,String relationship,String decision,List<String> wellness) {return db.atomic(()->{
        check(Set.of("accepted","declined","revoked").contains(decision),422,"INVALID_DECISION");
        db.lock(actor);var r=db.one("select * from tw_access where id=? and subject_id=?",id(relationship),actor);
        if(!decision.equals("revoked"))check("pending".equals(r.get("state")),409,"REQUEST_NOT_PENDING");
        if(wellness!=null&&decision.equals("accepted"))db.jdbc.update("update tw_access set wellness=? where id=?",db.encode(mask(wellness)),relationship);
        db.jdbc.update("update tw_access set state=? where id=?",decision,relationship);db.touch(actor);db.audit(actor,actor,"ACCESS_"+decision.toUpperCase(Locale.ROOT));return map("state",decision);
    });}
    public Map<String,Object> requests(String actor) {return map("items",db.rows("select * from tw_access where subject_id=? or grantee_id=? order by id",actor,actor).stream().map(this::dto).toList());}
    public Map<String,Object> grants(String actor) {return map("items",db.rows("select * from tw_access where subject_id=? order by id",actor).stream().map(this::dto).toList(),"groups",db.rows("select c.*,t.name from tw_consent c join tw_team t on t.id=c.team_id where c.user_id=?",actor).stream().map(r->map("teamId",r.get("team_id"),"teamName",r.get("name"),"state",r.get("state"),"scopeRevision",r.get("scope_revision"))).toList());}
    public Map<String,Object> revokeAll(String actor) {return db.atomic(()->{db.lock(actor);db.jdbc.update("update tw_access set state='revoked' where subject_id=?",actor);db.jdbc.update("update tw_consent set state='revoked' where user_id=?",actor);db.touch(actor);db.audit(actor,actor,"ACCESS_REVOKE_ALL");return map("revoked",true);});}
}
