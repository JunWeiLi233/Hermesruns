package com.hermes.backend.heatmap;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.explorer.*;
import com.hermes.backend.activity.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

/** SQL contract tests, exclusively in a newly initialized disposable PostgreSQL cluster. */
@EnabledIfEnvironmentVariable(named="HEAT_LAYER_TEST_URL",matches="jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/heat_layer_test")
class RecordedHeatmapIntegrationTests {
    JdbcTemplate jdbc;RecordedHeatmapService service;Runner owner,other;
    @BeforeEach void seed() {
        var url=System.getenv("HEAT_LAYER_TEST_URL");assertThat(url).matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/heat_layer_test");
        jdbc=new JdbcTemplate(new DriverManagerDataSource(url,"heat_layer_test",""));
        jdbc.execute("DROP SCHEMA IF EXISTS statshunters CASCADE");
        jdbc.execute("DROP TABLE IF EXISTS public.activity_points,public.activities,public.shoes,public.runner CASCADE");
        jdbc.execute("CREATE TABLE public.runner(id bigint PRIMARY KEY,deleted boolean DEFAULT false,time_zone text DEFAULT 'America/New_York')");
        jdbc.execute("CREATE TABLE public.shoes(id bigint PRIMARY KEY,nickname text,brand text,model text)");
        jdbc.execute("CREATE TABLE public.activities(id bigint PRIMARY KEY,runner_id bigint REFERENCES runner(id),name text,activity_type text DEFAULT 'RUN',provider text DEFAULT 'FILE',start_time timestamp,created_at timestamp DEFAULT now(),strava_api_sourced boolean DEFAULT false,distance_km double precision,distance_meters double precision,moving_time_seconds integer,total_elevation_gain double precision,average_heart_rate double precision,shoe_id bigint)");
        jdbc.execute("CREATE TABLE public.activity_points(activity_id bigint REFERENCES activities(id),sequence_index integer,latitude double precision,longitude double precision)");
        jdbc.execute("CREATE INDEX heat_test_points ON public.activity_points(activity_id,sequence_index)");
        jdbc.execute("CREATE SCHEMA statshunters");
        jdbc.execute("CREATE TABLE statshunters.account_profiles(id uuid PRIMARY KEY,runner_id bigint UNIQUE REFERENCES runner(id),dataset_revision bigint DEFAULT 1,state text DEFAULT 'active',preferences jsonb DEFAULT '{}'::jsonb)");
        jdbc.execute("CREATE TABLE statshunters.activity_facts(id uuid PRIMARY KEY,user_id uuid,runner_id bigint,legacy_activity_id bigint,sport text,subtype text,commute boolean,trainer boolean,gear text,metadata jsonb DEFAULT '{}'::jsonb)");
        jdbc.execute("CREATE TABLE statshunters.track_segments(activity_id uuid,user_id uuid,segments jsonb)");
        jdbc.update("INSERT INTO runner(id) VALUES(1),(2)");
        owner=org.mockito.Mockito.mock(Runner.class);other=org.mockito.Mockito.mock(Runner.class);
        org.mockito.Mockito.when(owner.getId()).thenReturn(1L);org.mockito.Mockito.when(other.getId()).thenReturn(2L);
        service=new RecordedHeatmapService(jdbc);service.ensureOwner(owner);service.ensureOwner(other);
    }
    void workout(long id,long runner,String name){jdbc.update("INSERT INTO activities(id,runner_id,name,start_time,distance_km,moving_time_seconds) VALUES(?,?,?,'2026-10-19 12:00',5,1800)",id,runner,name);}
    void route(long id){jdbc.update("INSERT INTO activity_points VALUES(?,0,40.70,-73.9),(?,1,40.701,-73.9),(?,2,40.701,-73.899)",id,id,id);}
    @SuppressWarnings("unchecked") List<Map<String,Object>> segments(Map<String,Object> value){return (List<Map<String,Object>>)value.get("segments");}
    @Test void displaySaveReturnsAnAuthorizedSnapshotWithoutChangingRoutes() {
        workout(1,1,"Same route");route(1);
        var before=service.query(owner,Map.of("zoom",20));
        assertThat(service.preferences(owner).get("snapshot")).isEqualTo(before.get("snapshot"));
        var saved=service.preferences(owner,Map.of("mode","heat"),1);
        assertThat(saved.get("snapshot")).isNotNull().isNotEqualTo(before.get("snapshot"));
        assertThat(service.workouts(owner,Map.of("snapshot",saved.get("snapshot"))).get("snapshot")).isEqualTo(saved.get("snapshot"));
        assertThat(RecordedHeatmapService.json(segments(service.query(owner,Map.of("zoom",20,"snapshot",saved.get("snapshot")))))).isEqualTo(RecordedHeatmapService.json(segments(before)));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM activity_points",Integer.class)).isEqualTo(3);
        assertThatThrownBy(()->service.query(owner,Map.of("snapshot",before.get("snapshot")))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    }
    @Test void detailedRouteBatchUsesTheExistingResponseBudgetEfficiently() {
        workout(1,1,"Detailed route");
        jdbc.execute("INSERT INTO activity_points SELECT 1,n,40.7+n*0.000001,CASE WHEN n%2=0 THEN -73.90001 ELSE -73.90002 END FROM generate_series(0,10999) n");
        var page=service.query(owner,Map.of("zoom",20));
        assertThat(page.get("complete")).isEqualTo(true);
        assertThat(segments(page).stream().mapToInt(part->((List<?>)part.get("coordinates")).size()).sum()).isGreaterThan(10000);
        assertThat(RecordedHeatmapService.json(page).getBytes(java.nio.charset.StandardCharsets.UTF_8).length).isLessThanOrEqualTo(512*1024);
    }
    @Test void completeSelectionExceedsOneThousandAndPagesStayBounded() {
        jdbc.execute("INSERT INTO activities(id,runner_id,name,start_time,distance_km,moving_time_seconds) SELECT n,1,'Workout '||n,timestamp '2026-10-19 12:00' - n*interval '1 day',5,1800 FROM generate_series(1,1001) n");
        jdbc.execute("INSERT INTO activity_points SELECT id,0,40.7,-73.9 FROM activities UNION ALL SELECT id,1,40.701,-73.9 FROM activities");
        var query=new LinkedHashMap<String,Object>(Map.of("zoom",14));var first=service.query(owner,query);
        assertThat(((Map<?,?>)first.get("summary")).containsKey("activityCount")).isTrue();
        assertThat(((Map<?,?>)first.get("summary")).get("activityCount")).isEqualTo(1001);
        var ids=new HashSet<Long>();var page=first;int pages=0;
        do {for(var part:segments(page))ids.add(((Number)part.get("activityId")).longValue());assertThat(RecordedHeatmapService.json(page).getBytes(java.nio.charset.StandardCharsets.UTF_8).length).isLessThanOrEqualTo(512*1024);pages++;if(page.get("nextCursor")==null)break;query.put("cursor",page.get("nextCursor"));query.put("snapshot",first.get("snapshot"));page=service.query(owner,query);}while(pages<10);
        assertThat(ids).hasSize(1001).contains(1001L);assertThat(pages).isGreaterThan(1);
        var listQuery=new LinkedHashMap<String,Object>(Map.of("limit",100));var listed=new HashSet<Long>();
        do {var list=service.workouts(owner,listQuery);for(var run:(List<?>)list.get("items"))listed.add(((Number)((Map<?,?>)run).get("id")).longValue());if(list.get("nextCursor")==null)break;listQuery.put("cursor",list.get("nextCursor"));listQuery.put("snapshot",list.get("snapshot"));}while(listed.size()<1100);
        assertThat(listed).isEqualTo(ids);
        assertThat(segments(service.query(owner,Map.of("filter",Map.of("q","Workout 1001"),"bbox",List.of(40.6,-74,40.8,-73.8))))).hasSize(1);
    }
    @Test void twoOwnersAndChangedHistoryRejectForeignTracksAndCursors() {
        for(long i=1;i<=501;i++){workout(i,1,"Run");route(i);}workout(9999,2,"Private");route(9999);
        var page=service.query(owner,Map.of());assertThat(page.get("nextCursor")).isNotNull();
        assertThatThrownBy(()->service.track(owner,9999,null,null,20)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
        assertThatThrownBy(()->service.query(other,Map.of("cursor",page.get("nextCursor")))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThatThrownBy(()->service.query(owner,Map.of("cursor",page.get("nextCursor"),"filter",Map.of("q","different")))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        var invalidation=new ExplorerInvalidation(new ExplorerStore(jdbc,null));
        invalidation.pointsStored(new ActivityPointsStoredEvent(1L,1L));
        assertThatThrownBy(()->service.query(owner,Map.of("snapshot",page.get("snapshot")))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        long revision=jdbc.queryForObject("SELECT dataset_revision FROM statshunters.account_profiles WHERE runner_id=1",Long.class);
        invalidation.beforeActivitiesDeleted(List.of(1L));
        assertThat(jdbc.queryForObject("SELECT dataset_revision FROM statshunters.account_profiles WHERE runner_id=1",Long.class)).isEqualTo(revision+1);
    }
    @Test void calendarUnitsMissingGpsAndExplicitSegmentsRemainHonest() {
        workout(1,1,"DST morning");route(1);workout(2,1,"No GPS");
        jdbc.update("UPDATE activities SET start_time='2026-11-01 03:30',moving_time_seconds=NULL WHERE id=1");
        assertThat(((Map<?,?>)service.query(owner,Map.of("filter",Map.of("from","2026-10-31","to","2026-10-31"))).get("summary")).get("activityCount")).isEqualTo(1);
        assertThat(((Map<?,?>)service.query(owner,Map.of("filter",Map.of("minMinutes",0))).get("summary")).get("activityCount")).isEqualTo(1);
        assertThat(((Map<?,?>)service.query(owner,Map.of("filter",Map.of("q","No GPS"))).get("summary")).get("gpsActivityCount")).isEqualTo(0);
        var user=jdbc.queryForObject("SELECT id FROM statshunters.account_profiles WHERE runner_id=1",UUID.class);var id=UUID.randomUUID();
        jdbc.update("INSERT INTO statshunters.activity_facts(id,user_id,runner_id,legacy_activity_id) VALUES(?,?,1,1)",id,user);
        jdbc.update("INSERT INTO statshunters.track_segments VALUES(?,?,?::jsonb)",id,user,"[[{\"lat\":40.7,\"lon\":-73.9},{\"lat\":40.701,\"lon\":-73.9}],[{\"lat\":40.702,\"lon\":-73.9},{\"lat\":40.703,\"lon\":-73.9}]]");
        var track=segments(service.track(owner,1,null,null,20));assertThat(track).hasSize(2);assertThat(track).allSatisfy(part->assertThat(part.get("sourceSegmentsKnown")).isEqualTo(true));
    }
    @Test void preferenceMergePreservesPrivacyAndRollbackOnConflict() {
        jdbc.update("UPDATE statshunters.account_profiles SET preferences='{\"units\":\"mi\",\"hideFromClubs\":true,\"theme\":\"dark\"}' WHERE runner_id=1");
        service.preferences(owner,Map.of("color","#124578","weight",2.5),1);
        service.preferences(owner,Map.of("mode","heat"),2);
        var json=jdbc.queryForObject("SELECT preferences::text FROM statshunters.account_profiles WHERE runner_id=1",String.class);
        assertThat(json).contains("mi","hideFromClubs","#124578","2.5","heat");
        assertThatThrownBy(()->service.preferences(owner,Map.of("weight",5),1)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThat(jdbc.queryForObject("SELECT preferences::text FROM statshunters.account_profiles WHERE runner_id=1",String.class)).isEqualTo(json);
        assertThatThrownBy(()->service.query(owner,Map.of("owner",2))).isInstanceOf(IllegalArgumentException.class);
    }
    @SuppressWarnings("unchecked") List<Map<String,Object>> items(Map<String,Object> query){return (List<Map<String,Object>>)service.workouts(owner,query).get("items");}
    @Test void retainedSourceMetadataAndUnknownsShareTheCanonicalSelection() {
        workout(1,1,"Trail session");route(1);workout(2,1,"Unclassified source");route(2);workout(3,2,"Other owner");
        var user=jdbc.queryForObject("SELECT id FROM statshunters.account_profiles WHERE runner_id=1",UUID.class);
        jdbc.update("INSERT INTO statshunters.activity_facts(id,user_id,runner_id,legacy_activity_id,sport,subtype,commute,trainer,gear,metadata) VALUES(?,?,1,1,'run','race',false,true,?,?::jsonb)",UUID.randomUUID(),user,"Shoes & poles","{\"originalSport\":\"TrailRun\",\"deviceName\":\"Stored watch\"}");
        var selected=items(Map.of("filter",Map.of("sourceSport","TrailRun","subtype","race","trainer","yes","commute","no","gear","source:Shoes & poles")));
        assertThat(selected).hasSize(1);assertThat(selected.get(0)).containsEntry("id",1L).containsEntry("device","Stored watch").containsEntry("sourceGear","Shoes & poles");
        assertThat(items(Map.of("filter",Map.of("gear","UNKNOWN","commute","unknown","sourceSport","UNKNOWN")))).extracting(r->r.get("id")).containsExactly(2L);
        assertThat(items(Map.of("filter",Map.of("commute","no")))).hasSize(1); // missing is not false
        assertThat(items(Map.of("ids",List.of("1","3")))).extracting(r->r.get("id")).containsExactly(1L);
        var map=service.query(owner,Map.of("filter",Map.of("gear","source:Shoes & poles")));
        assertThat(((Map<?,?>)map.get("summary")).get("activityCount")).isEqualTo(1);
        assertThat(segments(map)).extracting(r->r.get("activityId")).containsExactly(1L);
    }
    @Test void advancedMetricsRejectNullsAndShareBoundsWithListAndGeometry() {
        workout(1,1,"Measured");route(1);workout(2,1,"Missing");route(2);
        jdbc.update("UPDATE activities SET total_elevation_gain=0,average_heart_rate=150 WHERE id=1");
        jdbc.update("UPDATE activities SET moving_time_seconds=NULL WHERE id=2");
        var filter=Map.of("minAscentM",0,"maxAscentM",0,"minSpeedKmh",10,"maxSpeedKmh",10,"minHeartRate",150,"maxHeartRate",150);
        assertThat(items(Map.of("filter",filter))).extracting(r->r.get("id")).containsExactly(1L);
        assertThat(((Map<?,?>)service.query(owner,Map.of("filter",filter)).get("summary")).get("activityCount")).isEqualTo(1);
        assertThat(items(Map.of("filter",Map.of("minAscentM",0)))).hasSize(1);
        assertThatThrownBy(()->service.query(owner,Map.of("filter",Map.of("minHeartRate",180,"maxHeartRate",100)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->service.query(owner,Map.of("filter",Map.of("trainer","false")))).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void summaryLookupIsBoundedFilteredAndRevisionChecked() {
        workout(1,1,"Newest");workout(2,1,"Older");
        jdbc.update("UPDATE activities SET start_time='2020-01-01 12:00' WHERE id=2");
        assertThat(items(Map.of("ids",List.of("2","1")))).extracting(r->r.get("id")).containsExactly(1L,2L);
        assertThat(items(Map.of("ids",List.of("1","2"),"filter",Map.of("q","Older")))).extracting(r->r.get("id")).containsExactly(2L);
        assertThatThrownBy(()->service.workouts(owner,Map.of("ids",Collections.nCopies(9,"1")))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->service.workouts(owner,Map.of("ids",List.of("1 OR 1=1")))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->service.workouts(owner,Map.of("ids",List.of("1"),"snapshot","stale"))).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    }
    @Test void retainedMetresAndStructuredDeviceAreReadWithoutRewritingHistory() {
        workout(1,1,"Precise");jdbc.update("UPDATE activities SET distance_km=5,distance_meters=5008.1,moving_time_seconds=1992 WHERE id=1");
        var user=jdbc.queryForObject("SELECT id FROM statshunters.account_profiles WHERE runner_id=1",UUID.class);
        jdbc.update("INSERT INTO statshunters.activity_facts(id,user_id,runner_id,legacy_activity_id,metadata) VALUES(?,?,1,1,?::jsonb)",UUID.randomUUID(),user,"{\"device\":{\"name\":\"Retained GPS watch\"}}");
        var run=items(Map.of()).get(0);assertThat(run).containsEntry("device","Retained GPS watch");assertThat((Double)run.get("distanceKm")).isCloseTo(5.0081,within(1e-9));
        assertThat(jdbc.queryForObject("SELECT distance_km FROM activities WHERE id=1",Double.class)).isEqualTo(5);
    }
    @Test void workoutCoverageIsOwnerRevisionScopedAndIndependentOfDisplayZoom() {
        workout(1,1,"First");route(1);workout(2,1,"Repeat");route(2);workout(3,1,"No route");workout(9,2,"Private");route(9);
        var snapshot=service.query(owner,Map.of()).get("snapshot").toString();
        var first=service.tiles(owner,1,snapshot,null);var repeated=service.tiles(owner,2,snapshot,null);
        assertThat(first.get("tileCount")).isEqualTo(first.get("newTileCount"));assertThat((Integer)first.get("tileCount")).isPositive();assertThat(repeated.get("newTileCount")).isEqualTo(0);
        assertThat(service.tiles(owner,3,snapshot,null).get("tileCount")).isNull();
        assertThatThrownBy(()->service.tiles(owner,9,snapshot,null)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
        assertThatThrownBy(()->service.tiles(owner,1,"old",null)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM activity_points",Integer.class)).isEqualTo(9);
    }
    @Test void coveragePagesAreBoundedAndProjectionCannotCrossOwners() {
        workout(1,1,"Long retained track");workout(2,2,"Other");
        for(int x=8000;x<=8600;x++){var p=RecordedWorkoutTilesTests.point(x+.2,6000.2);jdbc.update("INSERT INTO activity_points VALUES(?,?,?,?)",1,x-8000,p[0],p[1]);}
        var foreign=jdbc.queryForObject("SELECT id FROM statshunters.account_profiles WHERE runner_id=2",UUID.class);var fact=UUID.randomUUID();
        jdbc.update("INSERT INTO statshunters.activity_facts(id,user_id,runner_id,legacy_activity_id) VALUES(?,?,2,1)",fact,foreign);jdbc.update("INSERT INTO statshunters.track_segments VALUES(?,?,?::jsonb)",fact,foreign,"[[{\"lat\":40,\"lon\":-74},{\"lat\":40.001,\"lon\":-74}]]");
        var first=service.tiles(owner,1,null,null);assertThat(first.get("tileCount")).isEqualTo(601);assertThat((List<?>)first.get("cells")).hasSize(500);assertThat(first.get("complete")).isEqualTo(false);
        var second=service.tiles(owner,1,first.get("snapshot").toString(),first.get("nextCursor").toString());assertThat((List<?>)second.get("cells")).hasSize(101);assertThat(second.get("complete")).isEqualTo(true);
        assertThatThrownBy(()->service.tiles(other,2,null,first.get("nextCursor").toString())).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        jdbc.update("UPDATE statshunters.account_profiles SET dataset_revision=dataset_revision+1 WHERE runner_id=1");
        assertThatThrownBy(()->service.tiles(owner,1,first.get("snapshot").toString(),null)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
    }
    @Test void coverageStreamsMoreThanOneMillionPointsAcrossWorkouts() {
        workout(1,1,"First large source");workout(2,1,"Second large source");
        jdbc.execute("INSERT INTO activity_points SELECT id,n,40.7,-73.9 FROM activities CROSS JOIN generate_series(0,500000) n");
        var first=service.tiles(owner,1,null,null);assertThat(first.get("tileCount")).isEqualTo(1);assertThat(first.get("newTileCount")).isEqualTo(1);
        assertThat(service.tiles(owner,2,null,null).get("newTileCount")).isEqualTo(0);assertThat(jdbc.queryForObject("SELECT count(*) FROM activity_points",Integer.class)).isEqualTo(1_000_002);
    }
}
