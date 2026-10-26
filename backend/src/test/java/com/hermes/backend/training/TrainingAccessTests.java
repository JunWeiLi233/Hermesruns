package com.hermes.backend.training;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

abstract class TrainingFixture {
    TrainingStore db; TrainingAccess acl; TrainingTeams teams; com.zaxxer.hikari.HikariDataSource ds;
    String athlete, stranger, coach, admin;
    @BeforeEach void setup() {
        ds = new com.zaxxer.hikari.HikariDataSource();
        ds.setJdbcUrl("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1");ds.setUsername("sa");ds.setPassword("");ds.setMaximumPoolSize(4);
        var jdbc = new JdbcTemplate(ds);
        jdbc.execute("create table runner(id bigint primary key)");
        jdbc.execute("create table activities(id bigint primary key, runner_id bigint references runner(id))");
        for (long id=1;id<=4;id++) jdbc.update("insert into runner(id) values(?)",id);
        db = new TrainingStore(jdbc,new ObjectMapper(),new DataSourceTransactionManager(ds));
        db.migrate(); acl=new TrainingAccess(db); teams=new TrainingTeams(db,acl);
        athlete=db.ensure(1,"Athlete Sample","UTC"); stranger=db.ensure(2,"Private Sample","UTC");
        coach=db.ensure(3,"Coach Sample","UTC"); admin=db.ensure(4,"Admin Sample","UTC");
    }
    @AfterEach void close() { ds.close(); }
}
class TrainingAccessTests extends TrainingFixture {
    @Test void startupValidationRejectsUnappliedOrChangedMigrationResources(){
        db.validateMigrations();db.jdbc.update("update tw_migration set checksum='changed' where version=1");
        assertThatThrownBy(db::validateMigrations).isInstanceOf(TrainingFailure.class);
    }
    @Test void identityIsStableAndPrivateByDefault() {
        assertThat(db.ensure(1,"Changed","UTC")).isEqualTo(athlete);
        assertThat(acl.can(stranger,athlete,false,null)).isFalse();
        assertThat(acl.can(athlete,athlete,true,"sleep")).isTrue();
    }
    @Test void requestRequiresSubjectAcceptanceAndFollowerCannotWrite() {
        var grant=acl.request(coach,athlete,"read",List.of("sleep"));
        assertThat(acl.can(coach,athlete,false,null)).isFalse();
        assertThatThrownBy(()->acl.decide(stranger,(String)grant.get("id"),"accepted")).isInstanceOf(TrainingFailure.class);
        acl.decide(athlete,(String)grant.get("id"),"accepted");
        assertThat(acl.can(coach,athlete,false,null)).isTrue();
        assertThat(acl.can(coach,athlete,true,null)).isFalse();
        assertThat(acl.can(coach,athlete,false,"sleep")).isTrue();
        assertThat(acl.can(coach,athlete,false,"restingHr")).isFalse();
    }
    @Test void pendingAndAcceptedRequestsAreIdempotentAndNeverExpandWellness() {
        var grant=acl.request(coach,athlete,"read",List.of("sleep"));
        var pending=acl.request(coach,athlete,"read",List.of("sleep","restingHr"));
        assertThat(pending).containsEntry("id",grant.get("id")).containsEntry("state","pending");
        assertThat(pending.get("wellness")).isEqualTo(List.of("sleep"));
        acl.decide(athlete,(String)grant.get("id"),"accepted");
        var accepted=acl.request(coach,athlete,"read",List.of("sleep","restingHr","feeling"));
        assertThat(accepted).containsEntry("id",grant.get("id")).containsEntry("state","accepted");
        assertThat(accepted.get("wellness")).isEqualTo(List.of("sleep"));
        assertThat(acl.can(coach,athlete,false,"sleep")).isTrue();
        assertThat(acl.can(coach,athlete,false,"restingHr")).isFalse();
        assertThat(db.rows("select id from tw_audit where actor_id=? and subject_id=? and action='ACCESS_REQUEST'",coach,athlete)).hasSize(1);
    }
    @Test void declinedAndRevokedRelationshipsCanBeRequestedAgainWithoutRestoringAuthority() {
        var original=acl.request(coach,athlete,"read",List.of("sleep"));String relationship=(String)original.get("id");
        acl.decide(athlete,relationship,"declined");
        var afterDecline=acl.request(coach,athlete,"read",List.of("restingHr"));
        assertThat(afterDecline).containsEntry("id",relationship).containsEntry("state","pending");
        assertThat(afterDecline.get("wellness")).isEqualTo(List.of("restingHr"));
        assertThat(acl.can(coach,athlete,false,null)).isFalse();
        acl.decide(athlete,relationship,"accepted");
        assertThat(acl.can(coach,athlete,false,"restingHr")).isTrue();
        assertThat(acl.can(coach,athlete,false,"sleep")).isFalse();

        acl.decide(athlete,relationship,"revoked");
        var afterRevoke=acl.request(coach,athlete,"read",List.of("feeling"));
        assertThat(afterRevoke).containsEntry("id",relationship).containsEntry("state","pending");
        assertThat(afterRevoke.get("wellness")).isEqualTo(List.of("feeling"));
        assertThat(acl.can(coach,athlete,false,null)).isFalse();
        assertThat(db.rows("select id from tw_audit where actor_id=? and subject_id=? and action='ACCESS_REQUEST'",coach,athlete)).hasSize(3);
        acl.decide(athlete,relationship,"accepted");
        assertThat(acl.can(coach,athlete,false,"feeling")).isTrue();
    }
    String group() {
        var t=teams.create(admin,"Original sample team");String id=(String)t.get("id");
        teams.join(coach,id);teams.member(admin,id,coach,"coach");
        teams.join(athlete,id);teams.member(admin,id,athlete,"member");return id;
    }
    @Test void membershipAndAdministratorRoleGiveNoAthleteData() {
        group(); assertThat(acl.can(admin,athlete,false,null)).isFalse();
        assertThat(acl.can(coach,athlete,true,null)).isFalse();
    }
    @Test void consentIsScopedAndScopeChangeInvalidatesIt() {
        String id=group();teams.consent(athlete,id,"granted",1,"coach",List.of("sleep"));
        assertThat(acl.can(coach,athlete,true,null)).isTrue();
        assertThat(acl.can(coach,athlete,true,"sleep")).isTrue();
        assertThat(acl.can(coach,athlete,false,"feeling")).isFalse();
        teams.update(admin,id,Map.of("coachingEnabled",false),3);
        assertThat(acl.can(coach,athlete,false,null)).isFalse();
        assertThatThrownBy(()->teams.consent(athlete,id,"granted",1,"coach",List.of())).isInstanceOf(TrainingFailure.class);
    }
    @Test void revokingGroupKeepsAnIndependentDirectGrant() {
        String id=group();teams.consent(athlete,id,"granted",1,"coach",List.of());
        var direct=acl.request(coach,athlete,"read",List.of());acl.decide(athlete,(String)direct.get("id"),"accepted");
        teams.consent(athlete,id,"revoked",1,"coach",List.of());
        assertThat(acl.can(coach,athlete,false,null)).isTrue();assertThat(acl.can(coach,athlete,true,null)).isFalse();
        acl.revokeAll(athlete);assertThat(acl.can(coach,athlete,false,null)).isFalse();
    }
    @Test void lastAdminAndStaffCannotConsentForSomeoneElse() {
        String id=group();
        assertThatThrownBy(()->teams.member(admin,id,admin,"removed")).isInstanceOf(TrainingFailure.class);
        assertThatThrownBy(()->teams.consent(admin,id,"granted",1,"coach",List.of())).isInstanceOf(TrainingFailure.class);
    }
    @Test void removingStaffImmediatelyEndsTheirGroupPath() {
        String id=group();teams.consent(athlete,id,"granted",1,"coach",List.of());
        teams.member(admin,id,coach,"removed");assertThat(acl.can(coach,athlete,true,null)).isFalse();
    }
    @Test void invalidRolesMasksAndSelfRequestsAreRejected() {
        assertThatThrownBy(()->acl.request(coach,athlete,"admin",List.of())).isInstanceOf(TrainingFailure.class);
        assertThatThrownBy(()->acl.request(coach,athlete,"coach",List.of("password"))).isInstanceOf(TrainingFailure.class);
        assertThatThrownBy(()->acl.request(athlete,athlete,"read",List.of())).isInstanceOf(TrainingFailure.class);
    }
    @Test void migrationCanRunTwiceAndRecordsItsChecksum() { db.migrate(); assertThat(db.rows("select * from tw_migration")).hasSize(1); }
}
