package com.hermes.backend.training;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.runner.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;
import java.nio.file.*;
import java.util.*;
import static com.hermes.backend.training.TrainingStore.*;

/** Cleanup remains installed even when the optional training HTTP module is disabled. */
@Component
public class TrainingLifecycle implements RunnerDataPurger,RunnerDataExportContributor {
    final TrainingStore db;final Path privateDirectory;
    public TrainingLifecycle(JdbcTemplate jdbc,ObjectMapper json,PlatformTransactionManager manager,@Value("${app.training-workspace.private-directory:./.training-private}")String directory){db=new TrainingStore(jdbc,json,manager);privateDirectory=Path.of(directory).toAbsolutePath().normalize();}
    boolean available(){return ((Number)db.one("select count(*) as total from information_schema.tables where lower(table_name)='tw_profile'").get("total")).intValue()>0;}
    public int order(){return 2;}
    public Set<Class<?>> entities(){return Set.of();} // These explicitly migrated JDBC tables have no JPA entities.
    public void purge(Long runnerId){
        if(!available())return;var profiles=db.rows("select id from tw_profile where runner_id=?",runnerId);if(profiles.isEmpty())return;String owner=(String)profiles.get(0).get("id");
        // Use the same team -> sorted profile order as membership mutations before scanning dependents.
        var related=db.rows("select distinct t.id from tw_team t left join tw_member m on m.team_id=t.id where t.creator_id=? or m.user_id=? order by t.id",owner,owner);
        var affected=new TreeSet<String>();affected.add(owner);
        for(var team:related){String tid=(String)team.get("id");db.one("select id from tw_team where id=? for update",tid);db.rows("select user_id from tw_member where team_id=?",tid).forEach(m->affected.add((String)m.get("user_id")));}
        db.rows("select subject_id from tw_access where grantee_id=?",owner).forEach(g->affected.add((String)g.get("subject_id")));db.lockAll(affected);
        for(var team:db.rows("select id from tw_team where creator_id=?",owner)){
            String id=(String)team.get("id");var successors=db.rows("select user_id from tw_member where team_id=? and user_id<>? and role='admin' and state='active' order by user_id",id,owner);
            if(successors.isEmpty())db.jdbc.update("delete from tw_team where id=?",id);else db.jdbc.update("update tw_team set creator_id=? where id=?",successors.get(0).get("user_id"),id);
        }
        for(var activity:db.rows("select id from tw_activity where athlete_id=?",owner))db.jdbc.update("delete from tw_comparison where payload like ?","%"+activity.get("id")+"%");
        var files=db.rows("select id from tw_job where actor_id=?",owner).stream().map(r->(String)r.get("id")).toList();
        files.forEach(id->TrainingFiles.enqueue(db,id));
        db.jdbc.update("update tw_message set workout_id=null where workout_id in (select id from tw_workout where owner_id=?)",owner);
        db.jdbc.update("delete from tw_message where sender_id=?",owner);
        db.jdbc.update("delete from tw_participant where user_id=?",owner);
        db.jdbc.update("delete from tw_share where owner_id=? or grantee_id=?",owner,owner);
        db.jdbc.update("delete from tw_access where subject_id=? or grantee_id=?",owner,owner);
        db.jdbc.update("delete from tw_consent where user_id=?",owner);
        db.jdbc.update("delete from tw_member where user_id=?",owner);
        db.jdbc.update("delete from tw_bulk_target where athlete_id=?",owner);
        db.jdbc.update("delete from tw_bulk where actor_id=?",owner);
        db.jdbc.update("delete from tw_receipt where actor_id=? or result like ?",owner,"%"+owner+"%");
        db.jdbc.update("delete from tw_job where actor_id=?",owner);
        db.jdbc.update("delete from tw_audit where actor_id=? or subject_id=?",owner,owner);
        db.jdbc.update("delete from tw_comparison where owner_id=?",owner);
        db.jdbc.update("delete from tw_season where athlete_id=?",owner);
        db.jdbc.update("delete from tw_wellness_annotation where athlete_id=?",owner);
        db.jdbc.update("delete from tw_assignment where athlete_id=?",owner);
        db.jdbc.update("delete from tw_plan where owner_id=?",owner);
        db.jdbc.update("delete from tw_workout where owner_id=?",owner);
        db.jdbc.update("delete from tw_folder where owner_id=?",owner);
        db.jdbc.update("delete from tw_activity where athlete_id=?",owner);
        db.jdbc.update("delete from tw_profile where id=?",owner);
        Runnable cleanup=()->TrainingFiles.sweep(db,privateDirectory);
        if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){public void afterCommit(){cleanup.run();}});else cleanup.run();
    }
    @org.springframework.scheduling.annotation.Scheduled(fixedDelayString="${app.training-workspace.cleanup-delay-ms:60000}")
    public void retryPrivateFileErasure(){if(available())TrainingFiles.sweep(db,privateDirectory);}
    public String filename(){return "training-workspace.json";}
    public Object export(Runner runner){if(!available())return map("enabled",false);var rows=db.rows("select id from tw_profile where runner_id=?",runner.getId());if(rows.isEmpty())return map("enabled",false);String actor=(String)rows.get(0).get("id");var acl=new TrainingAccess(db);return map("profile",db.profile(actor),"relationships",acl.grants(actor),"library",new TrainingLibrary(db,acl).list(actor),"authoredMessages",db.rows("select id,body,created_at from tw_message where sender_id=? order by created_at",actor));}
}
