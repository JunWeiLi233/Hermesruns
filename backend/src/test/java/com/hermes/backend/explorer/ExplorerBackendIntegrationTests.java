package com.hermes.backend.explorer;

import com.hermes.backend.auth.*;
import com.hermes.backend.imports.*;
import com.hermes.backend.infrastructure.mail.*;
import com.hermes.backend.runner.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static com.hermes.backend.explorer.ExplorerJson.*;

/** Never targets a developer database. The harness creates a disposable loopback PostgreSQL cluster. */
@EnabledIfEnvironmentVariable(named="EXPLORER_TEST_JDBC_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/explorer_backend_test")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "app.explorer.enabled=true","app.explorer.cookie-secure=false","app.explorer.worker-delay-ms=86400000",
    "spring.jpa.hibernate.ddl-auto=create-drop","spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.data.redis.repositories.enabled=false","strava.sync.enabled=false","garmin.wellness.sync.enabled=false",
    "app.coach.nightly.enabled=false","app.local-shared-runner.enabled=false","app.training-workspace.enabled=false",
    "app.email-validation.dns-enabled=false","hermes.environment=development","APP_DATA_ENCRYPTION_KEY=synthetic-explorer-integration-test-key-only",
    "spring.servlet.multipart.max-file-size=50MB","spring.servlet.multipart.max-request-size=101MB"
})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ExplorerBackendIntegrationTests {
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url",()->System.getenv("EXPLORER_TEST_JDBC_URL"));
        properties.add("spring.datasource.username",()->"explorer_test");properties.add("spring.datasource.password",()->"");
    }
    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;
    @Autowired RunnerRepository runners;
    @Autowired AuthService auth;
    @Autowired ExplorerImports imports;
    @Autowired ExplorerQueries queries;
    @Autowired ExplorerJobs jobs;
    @Autowired ExplorerStore store;
    @Autowired ExplorerWorker worker;
    @Autowired ExplorerDeletion deletion;
    @Autowired ExplorerMail mail;
    @Autowired ExplorerRegistrationGuard registrationGuard;
    @MockitoBean TransactionalMailSender sender;
    Runner owner,other;
    static final String PASSWORD="Invented!Runner2026";
    record Session(String cookie,String csrf) {}
    @BeforeAll void migrate() {
        assertThat(System.getenv("EXPLORER_TEST_JDBC_URL")).matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/explorer_backend_test");
        jdbc.execute("DROP SCHEMA IF EXISTS statshunters CASCADE");
        new ResourceDatabasePopulator(new ClassPathResource("explorer-migrations/V001__explorer_r0_r1.sql")).execute(dataSource);
    }
    @BeforeEach void setup() {
        jdbc.execute("TRUNCATE public.runner RESTART IDENTITY CASCADE");jdbc.execute("TRUNCATE statshunters.deletion_requests");
        reset(sender);when(sender.isConfigured()).thenReturn(true);
        owner=runner("owner-"+UUID.randomUUID()+"@example.test");other=runner("other-"+UUID.randomUUID()+"@example.test");
    }
    Runner runner(String email){Runner runner=new Runner(email,"ACTIVE");runner.setEmailVerified(true);runner.setTimeZone("America/New_York");auth.storePassword(runner,PASSWORD);return runners.saveAndFlush(runner);}
    MockMultipartFile gpx(String name,String sport,String start,int count,double offset) {
        StringBuilder source=new StringBuilder("<gpx xmlns=\"http://www.topografix.com/GPX/1/1\"><trk><name>Invented trail</name><type>"+sport+"</type><trkseg>");
        Instant time=Instant.parse(start);
        for(int i=0;i<count;i++) source.append("<trkpt lat=\"40.75\" lon=\"").append(-73.98+offset+i*0.0000001).append("\"><time>").append(time.plusSeconds(i)).append("</time><ele>").append(i%10).append("</ele></trkpt>");
        source.append("</trkseg></trk></gpx>");return new MockMultipartFile("files",name,"application/gpx+xml",source.toString().getBytes(StandardCharsets.UTF_8));
    }
    UUID enqueue(Runner runner,MockMultipartFile file,String key)throws Exception{return UUID.fromString(imports.enqueue(runner,List.of(file),true,key).get("id").toString());}
    long importOne(Runner runner,MockMultipartFile file)throws Exception{UUID id=enqueue(runner,file,"test-"+UUID.randomUUID());worker.tick();assertThat(jobs.get(runner,id).get("state")).isEqualTo("complete");return jdbc.queryForObject("SELECT activity_id FROM statshunters.file_assets WHERE job_id=?",Long.class,id);}
    HttpResponse<String> request(String method,String path,Object body,Session session,boolean proof,String origin)throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+path)).header("X-Explorer-Request","1");
        if(origin!=null)builder.header("Origin",origin);
        if(session!=null){builder.header("Cookie",session.cookie);if(proof)builder.header("X-Explorer-CSRF",session.csrf);}
        builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(write(body)));
        if(body!=null)builder.header("Content-Type","application/json");
        return HttpClient.newHttpClient().send(builder.build(),HttpResponse.BodyHandlers.ofString());
    }
    Session login(Runner runner)throws Exception {
        var result=request("POST","/api/explorer/session/login",map("email",runner.getEmail(),"password",PASSWORD,"persistent",true),null,false,null);
        assertThat(result.statusCode()).isEqualTo(200);String cookie=result.headers().firstValue("set-cookie").orElseThrow();
        assertThat(cookie).contains("HttpOnly","SameSite=Strict","Path=/api/explorer","Max-Age=2592000");
        assertThat(object(result.body())).doesNotContainKeys("token","password","email");
        return new Session(cookie.split(";",2)[0],(String)object(result.body()).get("csrf"));
    }
    @Test void nativeHermesBearerUsesTheSameOwnerWithoutCreatingAnotherSession()throws Exception {
        var session=login(owner);String token=session.cookie.substring(session.cookie.indexOf('=')+1);
        var client=HttpClient.newHttpClient();
        var nativeSession=client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/explorer/session"))
                .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(nativeSession.statusCode()).isEqualTo(200);
        assertThat(object(nativeSession.body())).containsEntry("opened",true);
        assertThat(nativeSession.headers().firstValue("set-cookie")).isEmpty();
        var preference=client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/explorer/preferences"))
                .header("Authorization","Bearer "+token).header("X-Explorer-Request","1").header("Content-Type","application/json")
                .method("PATCH",HttpRequest.BodyPublishers.ofString(write(map("units","mi")))).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(preference.statusCode()).isEqualTo(200);
        assertThat(store.owner(owner).preferences()).containsEntry("units","mi");
        var capability=client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/profile/heatmap/explorer"))
                .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(capability.statusCode()).isEqualTo(200);
        assertThat(object(capability.body())).containsEntry("available",true);
    }
    @Test void invalidNativeBearerCannotFallBackToAnotherOwnersCookie()throws Exception {
        var session=login(owner);
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/explorer/session"))
                .header("Authorization","Bearer invalid-native-session").header("Cookie",session.cookie).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(401);
    }
    @Test void sessionsRequireCsrfAndOriginAndLogoutRevokesEverywhere()throws Exception {
        var session=login(owner);
        assertThat(request("GET","/api/explorer/preferences",null,null,false,null).statusCode()).isEqualTo(401);
        assertThat(request("PATCH","/api/explorer/preferences",map("units","mi"),session,false,null).statusCode()).isEqualTo(403);
        assertThat(request("PATCH","/api/explorer/preferences",map("units","mi"),session,true,"https://attacker.test").statusCode()).isEqualTo(403);
        assertThat(request("PATCH","/api/explorer/preferences",map("units","mi"),session,true,null).statusCode()).isEqualTo(200);
        assertThat(request("POST","/api/explorer/session/logout",Map.of(),session,true,null).statusCode()).isEqualTo(200);
        assertThat(request("GET","/api/explorer/preferences",null,session,false,null).statusCode()).isEqualTo(401);
        assertThat(new ExplorerSecurity(auth,true,"").issue("synthetic",true)).contains("Secure","HttpOnly");
    }
    @Test void sourceImportsUseCanonicalNumericIdsAndDenySecondOwnerEveryRead()throws Exception {
        long id=importOne(owner,gpx("invented.gpx","cycling","2026-10-01T08:00:00Z",3,0));
        assertThat(jdbc.queryForObject("SELECT activity_type FROM activities WHERE id=?",String.class,id)).isEqualTo("NON_RUN");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM activity_points WHERE activity_id=?",Long.class,id)).isEqualTo(3L);
        assertThat(queries.activity(owner,id,null).get("activity")).isInstanceOf(Map.class);
        assertThat(queries.activities(other,null,"startTime",true,0,50,null).get("total")).isEqualTo(0L);
        assertThat(queries.summary(other,null,null).get("count")).isEqualTo(0L);
        assertThatThrownBy(()->queries.activity(other,id,null)).hasMessageContaining("404");
        assertThatThrownBy(()->queries.track(other,id,1000,null)).hasMessageContaining("404");
        UUID job=jdbc.queryForObject("SELECT id FROM statshunters.background_jobs LIMIT 1",UUID.class);
        assertThatThrownBy(()->jobs.get(other,job)).hasMessageContaining("404");
        var foreign=login(other);
        assertThat(request("GET","/api/explorer/activities/"+id,null,foreign,false,null).statusCode()).isEqualTo(404);
        assertThat(request("POST","/api/explorer/jobs/"+job+"/cancel",Map.of(),foreign,true,null).statusCode()).isEqualTo(404);
    }
    @Test void importsAreIdempotentAndConflictOnChangedRequestAndRecoverExpiredLease()throws Exception {
        var file=gpx("same.gpx","cycling","2026-10-02T08:00:00Z",4,0);
        UUID first=enqueue(owner,file,"reusable-key");assertThat(enqueue(owner,file,"reusable-key")).isEqualTo(first);
        assertThatThrownBy(()->enqueue(owner,gpx("changed.gpx","cycling","2026-10-02T08:00:00Z",5,0),"reusable-key")).hasMessageContaining("409");
        worker.tick();
        jdbc.update("UPDATE statshunters.background_jobs SET state='running',lease_owner=?,lease_expires_at=now()-interval '1 minute' WHERE id=?",UUID.randomUUID(),first);
        worker.tick();assertThat(jobs.get(owner,first).get("state")).isEqualTo("complete");
        UUID second=enqueue(owner,file,"second-request");worker.tick();
        assertThat(jobs.get(owner,second).get("state")).isEqualTo("complete");
        assertThat(jdbc.queryForObject("SELECT state FROM statshunters.file_assets WHERE job_id=?",String.class,second)).isEqualTo("duplicate");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM activities",Long.class)).isEqualTo(1L);
    }
    @Test void fullSourceAboveOneHundredThousandPointsIsNeverSampled()throws Exception {
        long id=importOne(owner,gpx("long-ride.gpx","cycling","2026-10-03T08:00:00Z",100001,0));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM activity_points WHERE activity_id=?",Long.class,id)).isEqualTo(100001L);
        var track=queries.track(owner,id,1000,null);
        assertThat(((Map<?,?>)track.get("quality")).get("displaySampled")).isEqualTo(true);
        assertThat(((Map<?,?>)track.get("quality")).get("retainedPointCount")).isEqualTo(100001);
        assertThat(jdbc.queryForObject("SELECT point_count FROM statshunters.activity_facts WHERE legacy_activity_id=?",Integer.class,id)).isEqualTo(100001);
        assertThat(((List<?>)track.get("segments")).toString().length()).isLessThan(300000);
    }
    @Test void filterUsesAccountDstCalendarNullableFlagsAndRevisionBarrier()throws Exception {
        importOne(owner,gpx("before.gpx","cycling","2026-11-01T03:30:00Z",2,0));
        importOne(owner,gpx("during.gpx","cycling","2026-11-01T05:30:00Z",2,.01));
        importOne(owner,gpx("later.gpx","cycling","2026-11-02T04:30:00Z",2,.02));
        store.filter(owner,map("start","2026-11-01","end","2026-11-01"),null);
        var page=queries.activities(owner,null,"startTime",true,0,100,null);assertThat(page.get("total")).isEqualTo(2L);
        long revision=((Number)page.get("revision")).longValue();
        assertThat(queries.summary(owner,null,revision).get("count")).isEqualTo(2L);
        var stats=queries.statistics(owner,"all",null,revision);assertThat(((Map<?,?>)stats.get("data")).get("weekly")).isNotNull();
        store.filter(owner,map("trainer","no"),revision);
        assertThat(queries.activities(owner,null,"startTime",true,0,100,null).get("total")).isEqualTo(0L);
        assertThatThrownBy(()->queries.summary(owner,null,revision)).hasMessageContaining("409");
        assertThatThrownBy(()->store.filter(owner,map("sql","drop"),null)).hasMessageContaining("400");
        assertThatThrownBy(()->store.preferences(owner,map("zone","Invalid/Zone"),null)).hasMessageContaining("400");
    }
    @Test void noGpsSwimIsRetainedAndInvalidXmlFailsWithoutAnyActivity()throws Exception {
        String swim="<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\"><Activities><Activity Sport=\"Swimming\"><Id>2026-10-04T08:00:00+02:00</Id><Lap StartTime=\"2026-10-04T08:00:00+02:00\"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>400</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>";
        long id=importOne(owner,new MockMultipartFile("files","swim.tcx","application/xml",swim.getBytes(StandardCharsets.UTF_8)));
        var dto=(Map<?,?>)queries.activity(owner,id,null).get("activity");assertThat(dto.get("pointCount")).isEqualTo(0);assertThat(dto.get("sport")).isEqualTo("swim");assertThat(dto.get("startTime")).isEqualTo("2026-10-04T06:00:00Z");
        UUID invalid=enqueue(owner,new MockMultipartFile("files","bad.gpx","application/xml","<!DOCTYPE gpx [<!ENTITY x SYSTEM 'file:///should-never-read'>]><gpx/>".getBytes(StandardCharsets.UTF_8)),"invalid-source-key");worker.tick();
        assertThat(jobs.get(owner,invalid).get("state")).isEqualTo("failed");assertThat(jdbc.queryForObject("SELECT count(*) FROM activities",Long.class)).isEqualTo(1L);
    }
    @Test void cancellationPreventsUnstartedFilesAndCrossOwnerForeignKeysAreEnforced()throws Exception {
        UUID job=enqueue(owner,gpx("cancel.gpx","cycling","2026-10-05T08:00:00Z",2,0),"cancel-request");jobs.cancel(owner,job);worker.tick();
        assertThat(jobs.get(owner,job).get("state")).isEqualTo("cancelled");assertThat(jdbc.queryForObject("SELECT count(*) FROM activities",Long.class)).isZero();
        var a=store.owner(owner);var b=store.owner(other);
        assertThatThrownBy(()->jdbc.update("INSERT INTO statshunters.file_assets(id,user_id,job_id,ordinal,filename,format,source_hash,classification,attested_at,bytes) VALUES(?,?,?,0,'foreign.gpx','GPX',?,'authorized_file',now(),?)",UUID.randomUUID(),b.id(),job,hash("fake"),new byte[]{1})).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThat(a.id()).isNotEqualTo(b.id());
    }
    @Test void reportAddressRequiresSingleUseVerificationAndUnsubscribeIsIdempotent()throws Exception {
        mail.requestVerification(owner,map("email","invented-report@example.test"));
        assertThatThrownBy(()->mail.preference(owner,map("enabled",true))).hasMessageContaining("409");
        worker.tick();var sent=org.mockito.ArgumentCaptor.forClass(TransactionalMailMessage.class);verify(sender).send(sent.capture());
        String text=sent.getValue().text(),token=text.split("verify-report-email\\?token=",2)[1].split("\\n",2)[0],optout=text.split("unsubscribe\\?token=",2)[1].trim();
        assertThat(mail.confirm(token)).containsEntry("verified",true);assertThatThrownBy(()->mail.confirm(token)).hasMessageContaining("400");
        mail.preference(owner,map("enabled",true));assertThat(store.owner(owner).preferences()).containsEntry("reportsEnabled",true);
        mail.unsubscribe(optout);mail.unsubscribe(optout);assertThat(store.owner(owner).preferences()).containsEntry("reportsEnabled",false);
        assertThat(jdbc.queryForObject("SELECT input::text FROM statshunters.background_jobs WHERE kind='report_verification'",String.class)).isEqualTo("{}");
    }
    @Test void reauthenticatedDeletionRevokesImmediatelyPurgesActuallyAndKeepsOnlyMinimalReceipt()throws Exception {
        long kept=importOne(other,gpx("kept.gpx","cycling","2026-10-06T08:00:00Z",2,0));
        importOne(owner,gpx("deleted.gpx","cycling","2026-10-07T08:00:00Z",2,.01));
        var session=login(owner);
        assertThat(request("POST","/api/explorer/account/deletion",map("confirmation","DELETE","password","wrong"),session,true,null).statusCode()).isEqualTo(403);
        var result=request("POST","/api/explorer/account/deletion",map("confirmation","DELETE","password",PASSWORD),session,true,null);
        assertThat(result.statusCode()).isEqualTo(202);String token=object(result.body()).get("token").toString();
        assertThat(request("GET","/api/explorer/activities",null,session,false,null).statusCode()).isEqualTo(401);
        assertThat(deletion.receipt(token)).containsEntry("state","queued");worker.tick();
        assertThat(deletion.receipt(token)).containsEntry("state","complete").doesNotContainKeys("runner_id","email","name");
        assertThat(runners.findById(owner.getId())).isEmpty();assertThat(queries.activity(other,kept,null)).containsKey("activity");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM statshunters.account_profiles WHERE runner_id=?",Long.class,owner.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT runner_id FROM statshunters.deletion_requests WHERE receipt_hash=?",Long.class,hash(token))).isNull();
    }
    @Test void independentCoverageTraversesIntermediateCellsAndDatelineWithoutGapBridging() {
        var cells=ExplorerGeometry.segmentCells(map("lat",0,"lon",0),map("lat",0,"lon",.08));assertThat(cells.size()).isGreaterThan(3);
        var dateline=ExplorerGeometry.segmentCells(map("lat",0,"lon",179.999),map("lat",0,"lon",-179.999));assertThat(dateline).hasSize(2);
        var parser=new GpxActivityFileParser();
        String invalid="<gpx xmlns=\"http://www.topografix.com/GPX/1/1\"><trk><trkseg><trkpt lat=\"40\" lon=\"-73\"><time>2026-10-01T10:00:00</time></trkpt></trkseg></trk></gpx>";
        assertThatThrownBy(()->parser.parseForExplorer("invalid.gpx",invalid.getBytes(StandardCharsets.UTF_8))).hasMessageContaining("explicit offset");
    }
    @Test void pendingDeletionCannotBeRecycledOrResurrectedByADetachedLogin()throws Exception {
        Runner stale=owner;
        var receipt=deletion.request(owner,map("confirmation","DELETE","password",PASSWORD));
        assertThatThrownBy(()->registrationGuard.beforeRecycling(owner.getId())).hasMessageContaining("409");
        assertThatThrownBy(()->auth.issueSessionToken(stale)).hasMessageContaining("unavailable");
        auth.invalidateSession(stale);
        assertThat(runners.findById(owner.getId()).orElseThrow().isDeleted()).isTrue();
        worker.tick();assertThat(deletion.receipt(receipt.get("token").toString())).containsEntry("state","complete");
    }
    @Test void multipartEndpointAndBoundedOverlayMatchTheFrontendContract()throws Exception {
        long id=importOne(owner,gpx("overlay.gpx","cycling","2026-10-08T08:00:00Z",5,0));
        var session=login(owner);
        var response=request("POST","/api/explorer/map/query",map("west",-74,"east",-73,"south",40,"north",41),session,true,null);
        assertThat(response.statusCode()).isEqualTo(200);var overlay=object(response.body());
        assertThat((List<?>)overlay.get("cells")).isNotEmpty();assertThat((List<?>)overlay.get("tracks")).hasSize(1);
        var summary=object(request("GET","/api/explorer/map/summary",null,session,false,null).body());assertThat(summary.get("bounds")).isNotNull();
        var page=object(request("GET","/api/explorer/activities?limit=1&sort=name",null,session,false,null).body());assertThat((List<?>)page.get("items")).hasSize(1);
        assertThat(id).isPositive();
    }
    @Test void externalHermesCalendarChangeInvalidatesExplorerEvenWithAStalePrincipal() {
        var before=store.owner(owner);
        Runner current=runners.findById(owner.getId()).orElseThrow();current.setTimeZone("Europe/Paris");runners.saveAndFlush(current);
        var after=store.owner(owner);
        assertThat(after.preferences()).containsEntry("zone","Europe/Paris");
        assertThat(after.revision()).isGreaterThan(before.revision());
    }
    @Test void jobTimesAreUtcInstantsRatherThanServerLocalWallTime()throws Exception {
        UUID id=enqueue(owner,gpx("clock.gpx","cycling","2026-10-09T08:00:00Z",2,0),"clock-contract-key");
        String created=jobs.get(owner,id).get("createdAt").toString();
        assertThatCode(()->Instant.parse(created)).doesNotThrowAnyException();
    }
}
