package com.hermes.backend.entertainment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:entertainment-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "app.official-course.startup-seed.enabled=false",
    "strava.sync.enabled=false", "garmin.wellness.sync.enabled=false", "app.coach.nightly.enabled=false",
    "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
@Import(EntertainmentMvcTests.TimeConfiguration.class)
class EntertainmentMvcTests {
    static final Instant FIRST = Instant.parse("2026-10-11T15:16:17.123456Z");
    final ObjectMapper json = new ObjectMapper();
    @Autowired MockMvc mvc;
    @Autowired RunnerRepository runners;
    @Autowired AuthService auth;
    @Autowired JdbcTemplate jdbc;
    @Autowired AccountDeletionService deletion;
    @Autowired AccountExportService exports;
    @Autowired TestClock clock;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired EntertainmentService entertainment;
    @TestConfiguration static class TimeConfiguration {
        @Bean @Primary TestClock entertainmentClock() { return new TestClock(); }
    }
    static class TestClock extends Clock {
        volatile Instant now = FIRST;
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
    @BeforeEach void time() { clock.now = FIRST; }
    record Actor(Runner runner, String token) { String id() { return runner.getId().toString(); } }
    Actor actor() {
        Runner r = runners.saveAndFlush(new Runner("ent-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        return new Actor(r, "Bearer " + auth.issueSessionToken(r));
    }
    Map<String,Object> command(Object... fields) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("requestId", UUID.randomUUID().toString());
        for (int i=0; i<fields.length; i+=2) result.put(fields[i].toString(), fields[i+1]);
        return result;
    }
    JsonNode call(Actor a, String method, String path, Object body, int expected) throws Exception {
        var request = MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method), "/api/entertainment" + path);
        if (a != null) request.header("Authorization", a.token());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var response = mvc.perform(request).andReturn().getResponse();
        assertThat(response.getStatus()).as(method + " " + path + " " + response.getContentAsString()).isEqualTo(expected);
        return json.readTree(response.getContentAsString());
    }
    JsonNode group(Actor a) throws Exception { return call(a,"POST","/groups",command(),200); }
    JsonNode invite(Actor a, JsonNode group, Actor recipient) throws Exception {
        return call(a,"POST","/groups/"+group.get("id").asText()+"/invites",
            command("expectedVersion",group.get("version").asLong(),"recipientAccountId",recipient.id()),200);
    }
    JsonNode accept(Actor a, JsonNode invite) throws Exception {
        return call(a,"POST","/invites/accept",command("token",invite.get("token").asText()),200);
    }
    JsonNode slot(Actor a, JsonNode g, int index, String symbol) throws Exception {
        return call(a,"PUT","/groups/"+g.get("id").asText()+"/slots/"+index,
            command("expectedVersion",g.get("version").asLong(),"symbol",symbol),200);
    }
    @Test void zeroHistoryMetadataDefaultsAndThirtyDayAbsence() throws Exception {
        Actor a=actor();
        JsonNode meta=call(a,"GET","/metadata",null,200);
        assertThat(meta.get("accountId").asText()).isEqualTo(a.id());
        assertThat(meta.get("accessories").size()).isEqualTo(3);
        assertThat(meta.get("backgrounds").size()).isEqualTo(2);
        JsonNode initial=call(a,"GET","/me",null,200);
        assertThat(initial.get("companion").get("version").asLong()).isZero();
        assertThat(initial.get("missions").size()).isEqualTo(4);
        assertThat(initial.get("memories").size()).isZero();
        clock.now=FIRST.plusSeconds(30*86400L);
        assertThat(call(a,"GET","/me",null,200)).isEqualTo(initial);
        assertThat(jdbc.queryForObject("select count(*) from activities where runner_id=?",Long.class,a.runner().getId())).isZero();
    }
    @Test void fullySavedFourModulesSurviveThirtyDayFixtureClockAbsenceAndCompanionRestore() throws Exception {
        Actor owner=actor();
        assertThat(jdbc.queryForObject("select count(*) from activities where runner_id=?",Long.class,owner.runner().getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from digital_cosmetic_drop where runner_id=?",Long.class,owner.runner().getId())).isZero();
        JsonNode companion=call(owner,"PUT","/companion",
            command("expectedVersion",0,"accessory","satchel","background","night","hidden",true),200);
        JsonNode memory=call(owner,"POST","/memories",
            command("title","A quiet fictional day","body","My private saved text stays here.","date","2026-09-17"),200);
        JsonNode chosen=call(owner,"POST","/missions/reflection",command("expectedVersion",0,"action","choose"),200);
        JsonNode paused=call(owner,"POST","/missions/reflection",
            command("expectedVersion",chosen.get("version").asLong(),"action","pause"),200);
        assertThat(paused.get("status").asText()).isEqualTo("paused");
        assertThat(paused.get("completionSource").asText()).isEqualTo("self-marked");
        JsonNode solo=group(owner);
        List<String> symbols=List.of("sun","leaf","star","wave");
        for(int index=0;index<symbols.size();index++) solo=slot(owner,solo,index,symbols.get(index));
        assertThat(solo.get("complete").asBoolean()).isTrue();
        assertThat(solo.get("members").size()).isEqualTo(1);
        assertThat(solo.get("members").get(0).get("accountId").asText()).isEqualTo(owner.id());
        assertThat(solo.get("slots").size()).isEqualTo(4);
        assertThat(solo.get("invites").size()).isZero();
        for(int index=0;index<symbols.size();index++) {
            assertThat(solo.get("slots").get(index).get("symbol").asText()).isEqualTo(symbols.get(index));
            assertThat(solo.get("slots").get(index).get("contributorAccountId").asText()).isEqualTo(owner.id());
        }
        JsonNode saved=call(owner,"GET","/me",null,200);
        assertThat(saved.get("companion")).isEqualTo(companion);
        assertThat(saved.get("memories").size()).isEqualTo(1);
        assertThat(saved.get("memories").get(0)).isEqualTo(memory);
        assertThat(saved.get("memories").get(0).get("date").asText()).isEqualTo("2026-09-17");
        assertThat(saved.get("missions").get(1)).isEqualTo(paused);
        assertThat(saved.get("groups").size()).isEqualTo(1);
        assertThat(saved.get("groups").get(0)).isEqualTo(solo);
        Instant savedAt=clock.instant();
        clock.now=savedAt.plus(Duration.ofDays(30));
        assertThat(Duration.between(savedAt,clock.instant())).isEqualTo(Duration.ofDays(30));
        JsonNode afterAbsence=call(owner,"GET","/me",null,200);
        assertThat(afterAbsence).isEqualTo(saved);
        assertThat(jdbc.queryForObject("select count(*) from activities where runner_id=?",Long.class,owner.runner().getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from digital_cosmetic_drop where runner_id=?",Long.class,owner.runner().getId())).isZero();
        JsonNode restored=call(owner,"PUT","/companion",command("expectedVersion",afterAbsence.get("companion").get("version").asLong(),
            "accessory",afterAbsence.get("companion").get("accessory").asText(),
            "background",afterAbsence.get("companion").get("background").asText(),"hidden",false),200);
        assertThat(restored.get("hidden").asBoolean()).isFalse();
        assertThat(restored.get("accessory").asText()).isEqualTo("satchel");
        assertThat(restored.get("background").asText()).isEqualTo("night");
        assertThat(restored.get("version").asLong()).isEqualTo(companion.get("version").asLong()+1);
        JsonNode afterRestore=call(owner,"GET","/me",null,200);
        assertThat(afterRestore.get("companion")).isEqualTo(restored);
        JsonNode expectedRestored=saved.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode)expectedRestored).set("companion",restored);
        assertThat(afterRestore).isEqualTo(expectedRestored);
        assertThat(jdbc.queryForObject("select count(*) from activities where runner_id=?",Long.class,owner.runner().getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from digital_cosmetic_drop where runner_id=?",Long.class,owner.runner().getId())).isZero();
    }
    @Test void companionPersistsHideRestoreAndRejectsStaleWrites() throws Exception {
        Actor a=actor();
        Map<String,Object> save=command("expectedVersion",0,"accessory","cap","background","night","hidden",true);
        JsonNode saved=call(a,"PUT","/companion",save,200);
        assertThat(saved.get("hidden").asBoolean()).isTrue();
        clock.now=FIRST.plusSeconds(30*86400L);
        assertThat(call(a,"PUT","/companion",save,200)).isEqualTo(saved);
        assertThat(call(a,"GET","/companion",null,200)).isEqualTo(saved);
        call(a,"PUT","/companion",command("expectedVersion",0,"accessory","satchel","background","meadow","hidden",false),409);
        call(a,"PUT","/companion",command("expectedVersion",1,"accessory","cap","background","night","hidden",false),200);
        call(a,"PUT","/companion",command("expectedVersion",2,"accessory","paid","background","night","hidden",false),400);
    }
    @Test void memoriesPreserveLiteralDateAndPrivateTextAndOptimisticEdit() throws Exception {
        Actor a=actor(), b=actor();
        JsonNode m=call(a,"POST","/memories",command("title","  My quiet day  ","body","private\ntext","date","2026-01-01"),200);
        String path="/memories/"+m.get("id").asText();
        assertThat(m.get("title").asText()).isEqualTo("  My quiet day  ");
        assertThat(m.get("date").asText()).isEqualTo("2026-01-01");
        assertThat(m.get("createdAt").asText()).isEqualTo(FIRST.toString());
        assertThat(call(a,"GET",path,null,200)).isEqualTo(m);
        assertThat(call(b,"GET","/memories",null,200).size()).isZero();
        call(b,"GET",path,null,404);
        call(b,"PUT",path,command("expectedVersion",0,"title","stolen","body","","date",null),404);
        call(a,"PUT",path,command("expectedVersion",0,"title","edited","body","new","date",null),200);
        call(a,"PUT",path,command("expectedVersion",0,"title","stale","body","lost","date",null),409);
        assertThat(call(a,"GET",path,null,200).get("title").asText()).isEqualTo("edited");
        call(b,"DELETE",path,command("expectedVersion",1),404);
        call(a,"DELETE",path,command("expectedVersion",1),200);
        call(a,"GET",path,null,404);
    }
    @Test void memoryBoundsRejectInvalidCalendarDatesAndMissingJsonFields() throws Exception {
        Actor a=actor();
        for (String title:List.of("", " ", "x".repeat(81))) call(a,"POST","/memories",command("title",title,"body","","date",null),400);
        call(a,"POST","/memories",command("title","x","body","x".repeat(1001),"date",null),400);
        for (String date:List.of("2026-02-30","2026-2-01","2026-01-01T00:00:00Z"))
            call(a,"POST","/memories",command("title","x","body","","date",date),400);
        call(a,"POST","/memories",command("title","x"),400);
        call(a,"POST","/memories",command("title","🌿".repeat(80),"body","🌿".repeat(1000),"date","2024-02-29"),200);
    }
    @Test void committedMemoryReceiptSurvivesResponseLossWithoutDuplicateOrStaleMatch() throws Exception {
        Actor a=actor(), b=actor();
        Map<String,Object> create=command("title","first","body","private","date",null);
        JsonNode saved=call(a,"POST","/memories",create,200);
        assertThat(call(a,"POST","/memories",create,200)).isEqualTo(saved);
        String receipt="/requests/"+create.get("requestId");
        assertThat(call(a,"GET",receipt,null,200).get("result")).isEqualTo(saved);
        call(b,"GET",receipt,null,404);
        create.put("body","different");
        call(a,"POST","/memories",create,409);
        assertThat(call(a,"GET","/memories",null,200).size()).isEqualTo(1);
        call(a,"GET","/requests/"+UUID.randomUUID(),null,404);
    }
    @Test void concurrentDuplicateMemoryRequestsCreateOneCard() throws Exception {
        Actor a=actor(); Map<String,Object> payload=command("title","once","body","","date",null);
        var pool=Executors.newFixedThreadPool(4);
        try {
            List<Callable<JsonNode>> tasks=new ArrayList<>();
            for(int i=0;i<8;i++) tasks.add(()->call(a,"POST","/memories",payload,200));
            List<JsonNode> results=new ArrayList<>();
            for(var future:pool.invokeAll(tasks)) results.add(future.get());
            assertThat(results).allMatch(r->r.equals(results.get(0)));
        } finally { pool.shutdownNow(); }
        assertThat(call(a,"GET","/memories",null,200).size()).isEqualTo(1);
    }
    @Test void missionsPauseCompleteSkipUndoRemainSelfMarkedWithNoActivityEffects() throws Exception {
        Actor a=actor();
        for(String id:List.of("rest","reflection","story","walk-jog")) {
            JsonNode chosen=call(a,"POST","/missions/"+id,command("expectedVersion",0,"action","choose"),200);
            assertThat(chosen.get("completionSource").asText()).isEqualTo("self-marked");
            call(a,"POST","/missions/"+id,command("expectedVersion",1,"action","pause"),200);
            clock.now=FIRST.plusSeconds(30*86400L);
            Map<String,Object> complete=command("expectedVersion",2,"action","complete");
            JsonNode done=call(a,"POST","/missions/"+id,complete,200);
            assertThat(call(a,"POST","/missions/"+id,complete,200)).isEqualTo(done);
            assertThat(done.get("status").asText()).isEqualTo("completed");
            assertThat(call(a,"POST","/missions/"+id,command("expectedVersion",3,"action","undo"),200).get("status").asText()).isEqualTo("paused");
            call(a,"POST","/missions/"+id,command("expectedVersion",4,"action","skip"),200);
            assertThat(call(a,"POST","/missions/"+id,command("expectedVersion",5,"action","undo"),200).get("status").asText()).isEqualTo("paused");
            call(a,"POST","/missions/"+id,command("expectedVersion",0,"action","complete"),409);
        }
        assertThat(jdbc.queryForObject("select count(*) from activities where runner_id=?",Long.class,a.runner().getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from digital_cosmetic_drop where runner_id=?",Long.class,a.runner().getId())).isZero();
    }
    @Test void invalidMissionTransitionsAndMissingVersionCannotMutate() throws Exception {
        Actor a=actor();
        call(a,"POST","/missions/rest",command("expectedVersion",0,"action","complete"),400);
        call(a,"POST","/missions/rest",command("expectedVersion",0,"action","pause"),400);
        call(a,"POST","/missions/unknown",command("expectedVersion",0,"action","choose"),400);
        call(a,"POST","/missions/rest",command("action","choose"),400);
    }
    @Test void fixedFourSlotsCompleteSoloAndNeverContainMemories() throws Exception {
        Actor a=actor(), outsider=actor();
        call(a,"POST","/memories",command("title","NEVER SHARE","body","secret memory","date",null),200);
        JsonNode g=group(a);
        assertThat(g.get("slots").size()).isEqualTo(4);
        for(int i=0;i<4;i++) g=slot(a,g,i,List.of("sun","leaf","star","wave").get(i));
        assertThat(g.get("complete").asBoolean()).isTrue();
        assertThat(g.toString()).doesNotContain("NEVER SHARE","secret memory");
        call(outsider,"GET","/groups/"+g.get("id").asText(),null,404);
        call(outsider,"PUT","/groups/"+g.get("id").asText()+"/slots/0",command("expectedVersion",4,"symbol","star"),404);
        call(a,"PUT","/groups/"+g.get("id").asText()+"/slots/4",command("expectedVersion",4,"symbol","star"),400);
        call(a,"PUT","/groups/"+g.get("id").asText()+"/slots/0",command("expectedVersion",4,"symbol","secret memory"),400);
    }
    @Test void authenticatedRecipientInviteAcceptanceDeclineRevokeExpiryAndReplay() throws Exception {
        Actor owner=actor(), recipient=actor(), outsider=actor();
        JsonNode g=group(owner), inv=invite(owner,g,recipient);
        call(outsider,"POST","/invites/accept",command("token",inv.get("token").asText()),404);
        call(owner,"POST","/invites/accept",command("token",inv.get("token").asText()),404);
        Map<String,Object> accept=command("token",inv.get("token").asText());
        JsonNode joined=call(recipient,"POST","/invites/accept",accept,200);
        assertThat(joined.get("members").size()).isEqualTo(2);
        assertThat(call(recipient,"POST","/invites/accept",accept,200)).isEqualTo(joined);
        call(recipient,"POST","/invites/accept",command("token",inv.get("token").asText()),410);
        JsonNode declined=invite(owner,joined,outsider);
        call(outsider,"POST","/invites/decline",command("token",declined.get("token").asText()),200);
        call(outsider,"POST","/invites/accept",command("token",declined.get("token").asText()),410);
        g=call(owner,"GET","/groups/"+g.get("id").asText(),null,200);
        JsonNode revoked=invite(owner,g,outsider);
        g=revoked.get("group");
        call(recipient,"POST","/groups/"+g.get("id").asText()+"/invites/"+revoked.get("inviteId").asText()+"/revoke",command("expectedVersion",g.get("version").asLong()),404);
        g=call(owner,"POST","/groups/"+g.get("id").asText()+"/invites/"+revoked.get("inviteId").asText()+"/revoke",command("expectedVersion",g.get("version").asLong()),200);
        call(outsider,"POST","/invites/accept",command("token",revoked.get("token").asText()),410);
        JsonNode expired=invite(owner,g,outsider);
        clock.now=FIRST.plusSeconds(86400);
        call(outsider,"POST","/invites/accept",command("token",expired.get("token").asText()),410);
    }
    @Test void rawInviteTokenNeverStoredOrExportedAndLostResponseRetryReturnsNullToken() throws Exception {
        Actor a=actor(), b=actor(); JsonNode g=group(a);
        Map<String,Object> request=command("expectedVersion",0,"recipientAccountId",b.id());
        String path="/groups/"+g.get("id").asText()+"/invites";
        JsonNode invite=call(a,"POST",path,request,200);
        String token=invite.get("token").asText();
        assertThat(token.length()).isGreaterThanOrEqualTo(43);
        assertThat(jdbc.queryForObject("select token_hash from entertainment_invites where id=?",String.class,invite.get("inviteId").asText())).hasSize(64).isNotEqualTo(token);
        assertThat(call(a,"POST",path,request,200).get("token").isNull()).isTrue();
        assertThat(call(a,"GET","/requests/"+request.get("requestId"),null,200).toString()).doesNotContain(token);
        assertThat(export(a)).doesNotContain(token,"tokenHash","token_hash");
    }
    @Test void simultaneousTokenConsumptionIsSingleUse() throws Exception {
        Actor a=actor(), b=actor(); JsonNode inv=invite(a,group(a),b);
        var pool=Executors.newFixedThreadPool(2);
        try {
            List<Callable<Integer>> calls=new ArrayList<>();
            for(int i=0;i<2;i++) calls.add(()->mvc.perform(MockMvcRequestBuilders.post("/api/entertainment/invites/accept")
                .header("Authorization",b.token()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(command("token",inv.get("token").asText())))).andReturn().getResponse().getStatus());
            List<Integer> statuses=new ArrayList<>(); for(var f:pool.invokeAll(calls)) statuses.add(f.get());
            assertThat(statuses).containsExactlyInAnyOrder(200,410);
        } finally { pool.shutdownNow(); }
    }
    @Test void competingSlotWritesUseGroupVersionAndMembershipCannotExceedFour() throws Exception {
        Actor owner=actor(), b=actor(), c=actor(), d=actor(), fifth=actor();
        JsonNode g=group(owner);
        for(Actor member:List.of(b,c,d)) g=accept(member,invite(owner,g,member));
        JsonNode over=invite(owner,g,fifth);
        call(fifth,"POST","/invites/accept",command("token",over.get("token").asText()),409);
        g=over.get("group"); String path="/groups/"+g.get("id").asText()+"/slots/0"; long version=g.get("version").asLong();
        var pool=Executors.newFixedThreadPool(2);
        try {
            List<Callable<Integer>> tasks=new ArrayList<>();
            for(Actor member:List.of(b,c)) tasks.add(()->mvc.perform(MockMvcRequestBuilders.put("/api/entertainment"+path)
                .header("Authorization",member.token()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(command("expectedVersion",version,"symbol","star")))).andReturn().getResponse().getStatus());
            List<Integer> statuses=new ArrayList<>(); for(var f:pool.invokeAll(tasks)) statuses.add(f.get());
            assertThat(statuses).containsExactlyInAnyOrder(200,409);
        } finally { pool.shutdownNow(); }
        assertThat(call(owner,"GET","/groups/"+g.get("id").asText(),null,200).get("members").size()).isEqualTo(4);
    }
    @Test void memberLeaveClearsContributionsOwnerDeleteRemovesAllGroupRows() throws Exception {
        Actor a=actor(), b=actor(); JsonNode g=accept(b,invite(a,group(a),b)); g=slot(b,g,0,"wave");
        String path="/groups/"+g.get("id").asText();
        call(b,"DELETE",path,command("expectedVersion",g.get("version").asLong()),404);
        call(a,"POST",path+"/leave",command("expectedVersion",g.get("version").asLong()),400);
        call(b,"POST",path+"/leave",command("expectedVersion",g.get("version").asLong()),200);
        g=call(a,"GET",path,null,200);
        assertThat(g.get("slots").get(0).get("symbol").isNull()).isTrue();
        assertThat(g.get("members").size()).isEqualTo(1);
        call(b,"GET",path,null,404);
        call(a,"DELETE",path,command("expectedVersion",g.get("version").asLong()),200);
        call(a,"GET",path,null,404);
        for(String table:List.of("entertainment_members","entertainment_slots","entertainment_invites"))
            assertThat(jdbc.queryForObject("select count(*) from "+table+" where group_id=?",Long.class,g.get("id").asText())).isZero();
    }
    String export(Actor a) throws Exception {
        var out=new ByteArrayOutputStream(); exports.write(a.runner(),false,out);
        try(var zip=new ZipInputStream(new ByteArrayInputStream(out.toByteArray()),StandardCharsets.UTF_8)) {
            java.util.zip.ZipEntry entry; while((entry=zip.getNextEntry())!=null)
                if(entry.getName().equals("entertainment.json")) return new String(zip.readAllBytes(),StandardCharsets.UTF_8);
        }
        throw new AssertionError("entertainment.json missing");
    }
    @Test void normalAccountExportAndDeletionPurgePersonalOwnedGroupsAndSharedContributions() throws Exception {
        Actor a=actor(), control=actor();
        JsonNode shared=accept(a,invite(control,group(control),a)); shared=slot(a,shared,0,"leaf"); shared=slot(control,shared,1,"sun");
        JsonNode owned=accept(control,invite(a,group(a),control));
        call(a,"POST","/memories",command("title","my private title","body","my private body","date","2026-10-01"),200);
        call(control,"POST","/memories",command("title","control secret","body","keep me","date",null),200);
        call(a,"PUT","/companion",command("expectedVersion",0,"accessory","satchel","background","night","hidden",true),200);
        call(a,"POST","/missions/rest",command("expectedVersion",0,"action","choose"),200);
        assertThat(export(a)).contains("my private body","2026-10-01","satchel","self-marked").doesNotContain("control secret","keep me","tokenHash");
        deletion.deleteAccount(a.runner().getId());
        for(String table:List.of("entertainment_preferences","entertainment_memories","entertainment_missions","entertainment_receipts","entertainment_members"))
            assertThat(jdbc.queryForObject("select count(*) from "+table+" where runner_id=?",Long.class,a.runner().getId())).isZero();
        call(a,"GET","/me",null,401);
        JsonNode after=call(control,"GET","/groups/"+shared.get("id").asText(),null,200);
        assertThat(after.get("members").size()).isEqualTo(1);
        assertThat(after.get("slots").get(0).get("symbol").isNull()).isTrue();
        assertThat(after.get("slots").get(1).get("symbol").asText()).isEqualTo("sun");
        call(control,"GET","/groups/"+owned.get("id").asText(),null,404);
        assertThat(call(control,"GET","/memories",null,200).get(0).get("body").asText()).isEqualTo("keep me");
    }
    @Test void allReadsRequireAuthenticationAndOwnerIsNeverRequestControlled() throws Exception {
        for(String path:List.of("/me","/metadata","/memories","/missions","/groups","/companion")) call(null,"GET",path,null,401);
        Actor a=actor(), b=actor();
        Map<String,Object> command=command("title","private","body","mine","date",null,"runnerId",b.id());
        call(a,"POST","/memories",command,200);
        assertThat(call(b,"GET","/memories",null,200).size()).isZero();
    }
    @Test void memoryDeletionErasesPrivateTextFromPriorCommittedReceipts() throws Exception {
        Actor a=actor(); Map<String,Object> request=command("title","deleted title","body","deleted secret","date",null);
        JsonNode m=call(a,"POST","/memories",request,200);
        call(a,"DELETE","/memories/"+m.get("id").asText(),command("expectedVersion",0),200);
        JsonNode reconciled=call(a,"GET","/requests/"+request.get("requestId"),null,200);
        assertThat(reconciled.get("result").get("deleted").asBoolean()).isTrue();
        assertThat(reconciled.toString()).doesNotContain("deleted secret","deleted title");
        assertThat(call(a,"POST","/memories",request,200).get("deleted").asBoolean()).isTrue();
        assertThat(call(a,"GET","/memories",null,200).size()).isZero();
    }
    @Test void savedTimestampsMatchReloadAndReceiptsAtDatabaseMicrosecondPrecision() throws Exception {
        Actor a=actor(), b=actor(); clock.now=FIRST.plusNanos(789);
        Map<String,Object> request=command("title","precision","body","","date",null);
        JsonNode m=call(a,"POST","/memories",request,200);
        assertThat(call(a,"GET","/memories/"+m.get("id").asText(),null,200)).isEqualTo(m);
        assertThat(m.get("createdAt").asText()).isEqualTo(FIRST.toString());
        JsonNode inv=invite(a,group(a),b);
        assertThat(call(a,"GET","/groups/"+inv.get("group").get("id").asText(),null,200).get("invites").get(0).get("expiresAt"))
            .isEqualTo(inv.get("expiresAt"));
    }
    @Test void simultaneousDifferentRecipientsCompeteForLastMemberSlotAtomically() throws Exception {
        Actor a=actor(), b=actor(), c=actor(), d=actor(), e=actor();
        JsonNode g=accept(b,invite(a,group(a),b)); g=accept(c,invite(a,g,c));
        JsonNode dInvite=invite(a,g,d), eInvite=invite(a,dInvite.get("group"),e);
        var pool=Executors.newFixedThreadPool(2); var ready=new CountDownLatch(2); var start=new CountDownLatch(1);
        try {
            List<Callable<Integer>> tasks=new ArrayList<>();
            for(var entry:List.of(Map.entry(d,dInvite),Map.entry(e,eInvite))) tasks.add(()->{
                ready.countDown(); assertThat(start.await(5,TimeUnit.SECONDS)).isTrue();
                return mvc.perform(MockMvcRequestBuilders.post("/api/entertainment/invites/accept")
                    .header("Authorization",entry.getKey().token()).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(command("token",entry.getValue().get("token").asText())))).andReturn().getResponse().getStatus();
            });
            var f1=pool.submit(tasks.get(0)); var f2=pool.submit(tasks.get(1));
            assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue(); start.countDown();
            assertThat(List.of(f1.get(10,TimeUnit.SECONDS),f2.get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        } finally { start.countDown(); pool.shutdownNow(); }
        assertThat(call(a,"GET","/groups/"+g.get("id").asText(),null,200).get("members").size()).isEqualTo(4);
    }
    @Test void invitationRedemptionAndRevocationSerializeOnSameGroup() throws Exception {
        Actor a=actor(), b=actor(); JsonNode inv=invite(a,group(a),b); JsonNode g=inv.get("group");
        var pool=Executors.newFixedThreadPool(2); var start=new CountDownLatch(1);
        try {
            var accept=pool.submit(()->{
                start.await(); return mvc.perform(MockMvcRequestBuilders.post("/api/entertainment/invites/accept")
                    .header("Authorization",b.token()).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(command("token",inv.get("token").asText())))).andReturn().getResponse().getStatus();
            });
            var revoke=pool.submit(()->{
                start.await(); return mvc.perform(MockMvcRequestBuilders.post("/api/entertainment/groups/"+g.get("id").asText()+"/invites/"+inv.get("inviteId").asText()+"/revoke")
                    .header("Authorization",a.token()).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(command("expectedVersion",g.get("version").asLong())))).andReturn().getResponse().getStatus();
            });
            start.countDown(); int accepted=accept.get(10,TimeUnit.SECONDS), revoked=revoke.get(10,TimeUnit.SECONDS);
            assertThat((accepted==200&&revoked==409)||(accepted==410&&revoked==200)).isTrue();
            assertThat(call(a,"GET","/groups/"+g.get("id").asText(),null,200).get("members").size()).isEqualTo(accepted==200?2:1);
        } finally { start.countDown(); pool.shutdownNow(); }
    }
    @Test void rolledBackMutationCannotLeaveReceiptOrMembership() throws Exception {
        Actor a=actor(), b=actor(); JsonNode inv=invite(a,group(a),b);
        Map<String,Object> request=command("token",inv.get("token").asText());
        new TransactionTemplate(transactionManager).executeWithoutResult(status->{
            entertainment.mutate(b.runner().getId(),"invite.accept",null,null,request);
            status.setRollbackOnly();
        });
        call(b,"GET","/requests/"+request.get("requestId"),null,404);
        JsonNode g=call(a,"GET","/groups/"+inv.get("group").get("id").asText(),null,200);
        assertThat(g.get("members").size()).isEqualTo(1);
        assertThat(call(b,"POST","/invites/accept",request,200).get("members").size()).isEqualTo(2);
    }
    @Test void accountDeletionRemovesUnacceptedAddressedInvitesAndOwnedGroupChildren() throws Exception {
        Actor a=actor(), b=actor(), control=actor();
        JsonNode addressed=invite(control,group(control),a), owned=invite(a,group(a),b);
        deletion.deleteAccount(a.runner().getId());
        assertThat(jdbc.queryForObject("select count(*) from entertainment_invites where recipient_account_id=?",Long.class,a.id())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from entertainment_groups where runner_id=?",Long.class,a.runner().getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from entertainment_slots where runner_id=?",Long.class,a.runner().getId())).isZero();
        for(String table:List.of("entertainment_members","entertainment_slots","entertainment_invites"))
            assertThat(jdbc.queryForObject("select count(*) from "+table+" where group_id=?",Long.class,owned.get("group").get("id").asText())).isZero();
        assertThat(call(control,"GET","/groups/"+addressed.get("group").get("id").asText(),null,200).get("invites").size()).isZero();
    }
    @Test void deletingMemberAccountWhileOwnerDeletesGroupDoesNotRollbackEither() throws Exception {
        Actor a=actor(), b=actor(); JsonNode g=accept(b,invite(a,group(a),b));
        String groupId=g.get("id").asText(); Map<String,Object> request=command("expectedVersion",g.get("version").asLong());
        var pool=Executors.newFixedThreadPool(2); var groupDeleted=new CountDownLatch(1); var finishOwner=new CountDownLatch(1);
        try {
            var owner=pool.submit(()->new TransactionTemplate(transactionManager).execute(status->{
                entertainment.mutate(a.runner().getId(),"group.delete",groupId,null,request);
                groupDeleted.countDown();
                try { if(!finishOwner.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("commit gate timed out"); }
                catch(InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new IllegalStateException(interrupted); }
                return true;
            }));
            assertThat(groupDeleted.await(5,TimeUnit.SECONDS)).isTrue();
            var member=pool.submit(()->{ deletion.deleteAccount(b.runner().getId()); return true; });
            // Wait for the real DB session to block on the deleted group's lock, not a timing guess.
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5); boolean blocked=false;
            while(System.nanoTime()<deadline) {
                Long waiting=jdbc.queryForObject("select count(*) from information_schema.sessions where blocker_id is not null",Long.class);
                if(waiting!=null&&waiting>0) { blocked=true; break; }
                Thread.yield();
            }
            assertThat(blocked).as("member purge reached the group lock while owner deletion is uncommitted").isTrue();
            finishOwner.countDown(); assertThat(owner.get(10,TimeUnit.SECONDS)).isTrue();
            assertThat(member.get(10,TimeUnit.SECONDS)).isTrue();
            assertThat(runners.findById(b.runner().getId())).isEmpty();
            call(a,"GET","/groups/"+groupId,null,404);
        } finally { finishOwner.countDown(); pool.shutdownNow(); }
    }
    @Test void accountDeletionAndLeaveAlsoEraseDepartingContributionsFromOtherOwnersReceipts() throws Exception {
        Actor member=actor(), control=actor();
        JsonNode g=accept(member,invite(control,group(control),member)); g=slot(member,g,0,"leaf"); g=slot(control,g,1,"sun");
        String controlReceipt=g.get("lastRequestId").asText();
        deletion.deleteAccount(member.runner().getId());
        JsonNode history=call(control,"GET","/requests/"+controlReceipt,null,200).get("result");
        assertThat(history.get("members").size()).isEqualTo(1);
        assertThat(history.get("slots").get(0).get("symbol").isNull()).isTrue();
        assertThat(history.get("slots").get(0).get("contributorAccountId").isNull()).isTrue();
        assertThat(history.get("slots").get(1).get("symbol").asText()).isEqualTo("sun");
        Actor leaving=actor(); g=call(control,"GET","/groups/"+g.get("id").asText(),null,200);
        g=accept(leaving,invite(control,g,leaving)); g=slot(leaving,g,2,"wave"); g=slot(control,g,1,"star");
        String beforeLeave=g.get("lastRequestId").asText();
        call(leaving,"POST","/groups/"+g.get("id").asText()+"/leave",command("expectedVersion",g.get("version").asLong()),200);
        JsonNode leftHistory=call(control,"GET","/requests/"+beforeLeave,null,200).get("result");
        assertThat(leftHistory.get("members").size()).isEqualTo(1);
        assertThat(leftHistory.get("slots").get(2).get("symbol").isNull()).isTrue();
        g=call(control,"GET","/groups/"+g.get("id").asText(),null,200);
        call(control,"DELETE","/groups/"+g.get("id").asText(),command("expectedVersion",g.get("version").asLong()),200);
        assertThat(call(control,"GET","/requests/"+beforeLeave,null,200).get("result").get("deleted").asBoolean()).isTrue();
    }
}
