package com.hermes.backend.coaching;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.*;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.test.annotation.DirtiesContext;
import static org.assertj.core.api.Assertions.assertThat;

/** Actual authenticated HTTP/JPA in a disposable schema; no provider or response mocks. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT, properties = {
    "server.address=127.0.0.1", "server.port=8268",
    "spring.datasource.url=jdbc:h2:mem:hr_block;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.devtools.restart.enabled=false",
    "app.mail.provider=disabled", "app.local-shared-runner.enabled=false", "app.local-shared-runner.seed-mock-data=false",
    "app.official-course.startup-seed.enabled=false", "app.course-map.bulk-scan.enabled=false", "app.course-map.bulk-seed.enabled=false",
    "app.training.async=false", "app.training.catchup-on-startup=false", "strava.sync.enabled=false",
    "garmin.wellness.sync.enabled=false", "app.coach.nightly.enabled=false",
    "logging.level.org.springframework.boot.security.autoconfigure=OFF"
})
@Import(TrainingMetricsBlockTests.ClockConfig.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TrainingMetricsBlockTests {
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired ActivityTrainingMetricsRepository metrics;
    @Autowired TrainingMetricsService computation;
    @Autowired TrainingZonesService zones;
    @Autowired ActivityDataAccess data;
    @Autowired AuthService auth;
    @Autowired BlockClock clock;
    final ObjectMapper json = new ObjectMapper();
    final HttpClient http = HttpClient.newHttpClient();
    @BeforeEach void resetClock() { clock.instant = Instant.parse("2026-10-11T03:00:00Z"); }

    Runner runner(String zone) {
        Runner r = new Runner("hr-block-" + UUID.randomUUID() + "@hermes.test", "active");
        r.setTimeZone(zone); r.setMaxHeartRateBpm(190); return runners.saveAndFlush(r);
    }
    Activity run(Runner r, String start, int seconds, double km, boolean legacy) {
        Activity a = new Activity(); a.setRunner(r); a.setName("synthetic block " + UUID.randomUUID());
        a.setActivityType(ActivityType.RUN); a.setProvider(ImportProvider.GARMIN);
        a.setStartTime(LocalDateTime.parse(start)); a.setStravaApiSourced(legacy);
        a.setMovingTimeSeconds(seconds); a.setDurationSeconds((long)seconds); a.setDistanceKm(km); a.setDistanceMeters(km*1000);
        return activities.saveAndFlush(a);
    }
    ActivityTrainingMetrics row(Runner r, Activity a, int... seconds) {
        ActivityTrainingMetrics m = new ActivityTrainingMetrics(a,r);
        m.setLocalDate(ActivityLocalDates.of(a,r)); m.setZoneSeconds(seconds);
        m.setHrCoveredSeconds(Arrays.stream(seconds).sum()); m.setZonesUsed(zones.resolve(r).zones());
        m.setModelVersion(TrainingMetricsService.MODEL_VERSION); m.setComputedAt(LocalDateTime.of(2026,10,10,18,0));
        m.setEffortSource(Arrays.stream(seconds).sum()>0 ? "HR_ZONES" : "PACE_MODEL");
        return metrics.saveAndFlush(m);
    }
    HttpResponse<String> request(Runner r, String suffix) throws Exception {
        HttpRequest.Builder req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8268/api/activities/training-metrics/block"+suffix));
        if(r!=null) req.header("Authorization", "Bearer "+auth.issueSessionToken(r));
        return http.send(req.GET().build(),HttpResponse.BodyHandlers.ofString());
    }
    JsonNode block(Runner r,int days) throws Exception {
        HttpResponse<String> res=request(r,"?days="+days);
        assertThat(res.statusCode()).as(res.body()).isEqualTo(200); return json.readTree(res.body());
    }
    List<Long> ids(JsonNode b) { List<Long> ids=new ArrayList<>(); b.path("activities").forEach(a->ids.add(a.path("activityId").asLong())); return ids; }

    ActivityTrainingMetrics measured(Runner r, Activity a, int count, int sampleGap) {
        List<ActivityPoint> points=new ArrayList<>();
        for(int i=0;i<count;i++) {
            ActivityPoint p=new ActivityPoint();p.setActivity(a);p.setSequenceIndex(i);p.setElapsedSeconds(i*sampleGap);
            p.setLatitude(0.0);p.setLongitude(0.0);p.setHeartRate(130);points.add(p);
        }
        data.savePoints(points);
        return computation.freshMetrics(r,a.getId()).orElseThrow().metrics();
    }
    JsonNode day(JsonNode b, String date) {
        for(JsonNode d:b.path("daily"))if(d.path("date").asText().equals(date))return d;
        throw new AssertionError("Missing day "+date);
    }
    void coverage(JsonNode node, long total, long raw, long durationCovered, long excess, long unknown) {
        assertThat(node.path("totalSeconds").asLong()).isEqualTo(total);
        assertThat(node.path("coveredSeconds").asLong()).isEqualTo(raw);
        assertThat(node.has("durationCoveredSeconds")).isTrue();
        assertThat(node.path("durationCoveredSeconds").asLong()).isEqualTo(durationCovered);
        assertThat(node.has("sampleExcessSeconds")).isTrue();
        assertThat(node.path("sampleExcessSeconds").asLong()).isEqualTo(excess);
        assertThat(node.path("unknownSeconds").asLong()).isEqualTo(unknown);
    }

    @Test void inclusiveProducerSamplesKeepRawZonesAndCapOnlyDurationCoverage() throws Exception {
        Runner r=runner("America/New_York");Activity a=run(r,"2026-10-10T16:00:00",2400,8,false);
        // The normal TCX reproduction has inclusive timestamps 0..2400. The producer repeats the last gap.
        ActivityTrainingMetrics m=measured(r,a,2401,1);
        assertThat(m.zoneSeconds()).containsExactly(0,2401,0,0,0);
        assertThat(m.getHrCoveredSeconds()).isEqualTo(2401);
        assertThat(m.getModelVersion()).isEqualTo(TrainingMetricsService.MODEL_VERSION);
        LocalDateTime computed=metrics.findById(m.getId()).orElseThrow().getComputedAt();
        long metricCount=metrics.count();
        HttpRequest req=HttpRequest.newBuilder(URI.create("http://127.0.0.1:8268/api/activities/"+a.getId()+"/training-metrics"))
                .header("Authorization","Bearer "+auth.issueSessionToken(r)).GET().build();
        HttpResponse<String> response=http.send(req,HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200);
        JsonNode single=json.readTree(response.body());
        assertThat(single.path("heartRate").path("coveredSeconds").asLong()).isEqualTo(2401);
        assertThat(single.path("heartRate").path("zones").get(1).path("seconds").asLong()).isEqualTo(2401);
        assertThat(single.path("heartRate").path("coveragePercent").asInt()).isEqualTo(100);
        assertThat(single.path("effort").path("score").asDouble()).isEqualTo(80);
        for(int days:new int[]{7,28}) {
            JsonNode b=block(r,days),activity=b.path("activities").get(0);
            assertThat(activity.path("metricsStatus").asText()).isEqualTo("CURRENT");
            coverage(b,2400,2401,2400,1,0);coverage(activity,2400,2401,2400,1,0);
            coverage(day(b,"2026-10-10"),2400,2401,2400,1,0);
            assertThat(b.path("zoneSeconds").toString()).isEqualTo("[0,2401,0,0,0]");
            assertThat(activity.path("zoneSeconds")).isEqualTo(b.path("zoneSeconds"));
            assertThat(day(b,"2026-10-10").path("zoneSeconds")).isEqualTo(b.path("zoneSeconds"));
            assertThat(b.path("coveragePercent").asDouble()).isEqualTo(100);
            assertThat(b.path("coverageDenominator").asText()).isEqualTo("ACTIVITY_DURATION_SECONDS_WITH_PER_ACTIVITY_CAP");
            assertThat(b.path("percentageDenominator").asText()).isEqualTo("COVERED_HR_SECONDS");
        }
        ActivityTrainingMetrics stored=metrics.findById(m.getId()).orElseThrow();
        assertThat(stored.zoneSeconds()).containsExactly(0,2401,0,0,0);
        assertThat(stored.getHrCoveredSeconds()).isEqualTo(2401);
        assertThat(stored.getComputedAt()).isEqualTo(computed);assertThat(metrics.count()).isEqualTo(metricCount);
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void overcoveredProducerCannotFillAnotherRunsUnknownTime(boolean separateDays) throws Exception {
        Runner r=runner("UTC");Activity a=run(r,"2026-10-09T12:00:00",30,1,false);
        ActivityTrainingMetrics m=measured(r,a,2,30); // 0,30 yields 60 accepted raw seconds for 30 duration seconds.
        assertThat(m.getHrCoveredSeconds()).isEqualTo(60);
        String noDate=separateDays?"2026-10-10":"2026-10-09";
        Activity no=run(r,noDate+"T18:00:00",30,1,false);row(r,no,0,0,0,0,0);
        for(int days:new int[]{7,28}) {
            JsonNode b=block(r,days);
            assertThat(b.path("coveragePercent").asDouble()).isEqualTo(50);
            coverage(b,60,60,30,30,30);
            coverage(b.path("activities").get(0),30,60,30,30,0);
            coverage(b.path("activities").get(1),30,0,0,0,30);
            assertThat(b.path("activities").get(0).path("metricsStatus").asText()).isEqualTo("CURRENT");
            assertThat(b.path("activities").get(1).path("metricsStatus").asText()).isEqualTo("NO_HR");
            assertThat(b.path("zoneSeconds").toString()).isEqualTo("[0,60,0,0,0]");
            if(separateDays) {
                coverage(day(b,"2026-10-09"),30,60,30,30,0);coverage(day(b,noDate),30,0,0,0,30);
            } else coverage(day(b,noDate),60,60,30,30,30);
        }
    }
    @Test void durationCoverageUsesPositiveMovingSecondsThenRecordedDuration() throws Exception {
        Runner r=runner("UTC");Activity fallback=run(r,"2026-10-10T12:00:00",0,1,false);
        fallback.setDurationSeconds(30L);activities.saveAndFlush(fallback);measured(r,fallback,2,30);
        Activity moving=run(r,"2026-10-10T18:00:00",30,1,false);
        moving.setDurationSeconds(90L);activities.saveAndFlush(moving);measured(r,moving,2,30);
        JsonNode b=block(r,7);coverage(b,60,120,60,60,0);coverage(day(b,"2026-10-10"),60,120,60,60,0);
        for(JsonNode activity:b.path("activities"))coverage(activity,30,60,30,30,0);
        assertThat(b.path("coveragePercent").asDouble()).isEqualTo(100);
    }
    @Test void zeroDurationRetainsAcceptedSamplesWithoutInventingCoverage() throws Exception {
        Runner r=runner("UTC");Activity a=run(r,"2026-10-10T12:00:00",0,0,false);measured(r,a,1,1);
        JsonNode b=block(r,7);coverage(b,0,1,0,1,0);coverage(day(b,"2026-10-10"),0,1,0,1,0);
        coverage(b.path("activities").get(0),0,1,0,1,0);
        assertThat(b.path("activities").get(0).path("metricsStatus").asText()).isEqualTo("CURRENT");
        assertThat(b.path("coveragePercent").isNull()).isTrue();
    }
    @Test void negativeInconsistentAndStaleOvercoveredRowsStayUnknown() throws Exception {
        Runner r=runner("UTC");Activity a=run(r,"2026-10-10T12:00:00",30,1,false);
        ActivityTrainingMetrics m=row(r,a,-1,61,0,0,0);
        for(int scenario=0;scenario<6;scenario++) {
            String status=scenario<2?"INVALID":"STALE";
            if(scenario==1){m.setZoneSeconds(new int[]{0,60,0,0,0});m.setHrCoveredSeconds(59);}
            if(scenario==2){m.setHrCoveredSeconds(60);m.setStale(true);}
            if(scenario==3){m.setStale(false);m.setModelVersion(TrainingMetricsService.MODEL_VERSION+1);}
            if(scenario==4){m.setModelVersion(TrainingMetricsService.MODEL_VERSION);m.setLocalDate(LocalDate.of(2026,10,9));}
            if(scenario==5){m.setLocalDate(LocalDate.of(2026,10,10));m.setZonesUsed(HeartRateZones.defaults(190,new int[]{50,60,70,80}));}
            metrics.saveAndFlush(m);
            JsonNode b=block(r,7);assertThat(b.path("activities").get(0).path("metricsStatus").asText()).isEqualTo(status);
            coverage(b,30,0,0,0,30);coverage(b.path("activities").get(0),30,0,0,0,30);
            coverage(day(b,"2026-10-10"),30,0,0,0,30);
            assertThat(b.path("zoneSeconds").toString()).isEqualTo("[0,0,0,0,0]");
            assertThat(metrics.findById(m.getId()).orElseThrow().getHrCoveredSeconds()).isEqualTo(m.getHrCoveredSeconds());
        }
    }

    @Test void realStoredStreamPreservesThirtyMinutesZ2AndTenMinutesZ5() throws Exception {
        Runner r=runner("America/New_York"); Activity a=run(r,"2026-10-10T16:00:00",2400,8,false);
        List<ActivityPoint> points=new ArrayList<>();
        for(int i=0;i<2400;i++){ActivityPoint p=new ActivityPoint(); p.setActivity(a);p.setSequenceIndex(i);p.setElapsedSeconds(i);
            p.setLatitude(0.0);p.setLongitude(0.0);p.setHeartRate(i<1800?130:180);points.add(p);}
        data.savePoints(points);
        ActivityTrainingMetrics m=computation.freshMetrics(r,a.getId()).orElseThrow().metrics();
        assertThat(m.zoneSeconds()).containsExactly(0,1800,0,0,600);
        LocalDateTime computed=metrics.findById(m.getId()).orElseThrow().getComputedAt(); long metricCount=metrics.count();
        JsonNode b=block(r,7);
        assertThat(b.path("zoneSeconds").toString()).isEqualTo("[0,1800,0,0,600]");
        assertThat(b.path("coveredSeconds").asLong()).isEqualTo(2400);
        assertThat(b.path("unknownSeconds").asLong()).isZero();
        assertThat(b.path("coveragePercent").asDouble()).isEqualTo(100);
        assertThat(b.path("activities").get(0).path("boundariesBpm").toString()).isEqualTo("[114,133,152,171]");
        block(r,28);
        assertThat(metrics.count()).isEqualTo(metricCount);
        assertThat(metrics.findByActivityIdAndRunnerId(a.getId(),r.getId()).orElseThrow().getComputedAt()).isEqualTo(computed);
    }
    @Test void partialAndMissingHrKeepVolumeAndExplicitUnknownTime() throws Exception {
        Runner r=runner("UTC"); Activity a=run(r,"2026-10-10T12:00:00",1200,4,false);row(r,a,0,600,0,0,0);
        Activity no=run(r,"2026-10-10T18:00:00",1800,6,false);row(r,no,0,0,0,0,0);
        Activity absent=run(r,"2026-10-09T12:00:00",600,2,false);
        JsonNode b=block(r,7);
        assertThat(b.path("activityCount").asInt()).isEqualTo(3); assertThat(b.path("distanceKm").asDouble()).isEqualTo(12);
        assertThat(b.path("totalSeconds").asLong()).isEqualTo(3600);assertThat(b.path("coveredSeconds").asLong()).isEqualTo(600);
        assertThat(b.path("unknownSeconds").asLong()).isEqualTo(3000);
        assertThat(b.path("coveragePercent").asDouble()).isCloseTo(16.6666667,org.assertj.core.data.Offset.offset(.001));
        assertThat(ids(b)).containsExactlyInAnyOrder(a.getId(),no.getId(),absent.getId());
    }
    @Test void doublesBothContributeOnceAndOtherOwnersAndNonRunsAreExcluded() throws Exception {
        Runner r=runner("America/New_York"), other=runner("America/New_York");
        Activity a=run(r,"2026-10-10T12:00:00",600,2,false),d=run(r,"2026-10-10T23:00:00",900,3,false);
        row(r,a,600,0,0,0,0);row(r,d,0,0,900,0,0);
        Activity foreign=run(other,"2026-10-10T12:00:00",9999,99,false);row(other,foreign,9999,0,0,0,0);
        Activity cycle=run(r,"2026-10-10T13:00:00",5000,50,false);cycle.setActivityType(ActivityType.NON_RUN);activities.saveAndFlush(cycle);
        JsonNode b=block(r,7);assertThat(ids(b)).containsExactlyInAnyOrder(a.getId(),d.getId());
        assertThat(b.path("activityCount").asInt()).isEqualTo(2);assertThat(b.path("totalSeconds").asLong()).isEqualTo(1500);
        JsonNode day=b.path("daily").findValues("activityCount").stream().filter(n->n.asInt()==2).findFirst().orElseThrow();
        assertThat(day.asInt()).isEqualTo(2);
    }
    @Test void sevenAndTwentyEightCalendarWindowsUseAccountMidnightAndLegacyWallDates() throws Exception {
        Runner r=runner("America/New_York");
        Activity outside=run(r,"2026-09-13T03:59:59",600,1,false);
        Activity first28=run(r,"2026-09-13T04:00:00",600,2,false);
        Activity before7=run(r,"2026-10-04T03:59:59",600,3,false);
        Activity first7=run(r,"2026-10-04T04:00:00",600,4,false);
        Activity today=run(r,"2026-10-11T03:59:59",600,5,false);
        Activity tomorrow=run(r,"2026-10-11T04:00:00",600,6,false);
        Activity wall=run(r,"2026-10-04T00:15:00",600,7,true);
        assertThat(ids(block(r,7))).containsExactlyInAnyOrder(first7.getId(),today.getId(),wall.getId());
        JsonNode b=block(r,28);assertThat(ids(b)).containsExactlyInAnyOrder(first28.getId(),before7.getId(),first7.getId(),today.getId(),wall.getId());
        assertThat(b.path("startDate").asText()).isEqualTo("2026-09-13");assertThat(b.path("endDate").asText()).isEqualTo("2026-10-10");
        assertThat(ids(b)).doesNotContain(outside.getId(),tomorrow.getId());
    }
    @Test void staleZoneChangesAndInvalidStoredTotalsAreUnknownWithoutGetRecompute() throws Exception {
        Runner r=runner("UTC");Activity a=run(r,"2026-10-10T12:00:00",600,2,false);ActivityTrainingMetrics m=row(r,a,600,0,0,0,0);
        m.setStale(true);metrics.saveAndFlush(m);JsonNode stale=block(r,7);assertThat(stale.path("coveredSeconds").asLong()).isZero();
        assertThat(stale.path("activities").get(0).path("metricsStatus").asText()).isEqualTo("STALE");
        assertThat(metrics.findById(m.getId()).orElseThrow().isStale()).isTrue();
        m.setStale(false);m.setHrCoveredSeconds(599);metrics.saveAndFlush(m);
        assertThat(block(r,7).path("activities").get(0).path("metricsStatus").asText()).isEqualTo("INVALID");
        m.setHrCoveredSeconds(600);metrics.saveAndFlush(m);r.setMaxHeartRateBpm(180);runners.saveAndFlush(r);
        assertThat(block(r,7).path("activities").get(0).path("metricsStatus").asText()).isEqualTo("STALE");
    }
    @Test void changedAccountZoneRecalculatesCalendarWithoutTrustingStaleMetricDate() throws Exception {
        clock.instant=Instant.parse("2026-10-10T23:00:00Z"); // Same today in both calendars isolates the activity-date change.
        Runner r=runner("UTC");Activity a=run(r,"2026-10-04T03:30:00",600,2,false);row(r,a,600,0,0,0,0);
        assertThat(ids(block(r,7))).contains(a.getId());r.setTimeZone("America/New_York");runners.saveAndFlush(r);
        assertThat(ids(block(r,7))).doesNotContain(a.getId());assertThat(ids(block(r,28))).contains(a.getId());
    }
    @Test void springDstWindowCountsCalendarDaysNotSevenTimesTwentyFourHours() throws Exception {
        clock.instant=Instant.parse("2026-03-09T04:30:00Z");Runner r=runner("America/New_York");
        Activity first=run(r,"2026-03-03T05:00:00",600,2,false);
        Activity prior=run(r,"2026-03-03T04:59:59",600,1,false);
        JsonNode b=block(r,7);assertThat(b.path("startDate").asText()).isEqualTo("2026-03-03");
        assertThat(ids(b)).contains(first.getId()).doesNotContain(prior.getId());
    }
    @Test void emptyBlockHasUnknownCoverageRatherThanInventedPercent() throws Exception {
        JsonNode b=block(runner("UTC"),28);assertThat(b.path("activityCount").asInt()).isZero();
        assertThat(b.path("coveragePercent").isNull()).isTrue();assertThat(b.path("daily").size()).isEqualTo(28);
    }
    @Test void fallDstDoublesHaveOneCalendarDayButRemainSeparateActivities() throws Exception {
        clock.instant=Instant.parse("2026-11-02T04:30:00Z");Runner r=runner("America/New_York");
        Activity a=run(r,"2026-11-01T05:30:00",600,2,false),b=run(r,"2026-11-01T06:30:00",900,3,false);
        row(r,a,600,0,0,0,0);row(r,b,0,900,0,0,0);
        JsonNode block=block(r,7);assertThat(ids(block)).containsExactlyInAnyOrder(a.getId(),b.getId());
        assertThat(block.path("activities").get(0).path("localDate").asText()).isEqualTo("2026-11-01");
        assertThat(block.path("activities").get(1).path("localDate").asText()).isEqualTo("2026-11-01");
        assertThat(block.path("totalSeconds").asLong()).isEqualTo(1500);
    }
    @Test void durationAndDistanceFallbackDoNotRequireHeartRate() throws Exception {
        Runner r=runner("UTC");Activity a=run(r,"2026-10-10T12:00:00",0,0,false);
        a.setDurationSeconds(1200L);a.setDistanceMeters(3000.0);activities.saveAndFlush(a);
        ActivityTrainingMetrics m=row(r,a,0,0,0,0,0);m.setEffortSource("PERCEIVED");metrics.saveAndFlush(m);
        JsonNode b=block(r,7);assertThat(b.path("distanceKm").asDouble()).isEqualTo(3);
        assertThat(b.path("totalSeconds").asLong()).isEqualTo(1200);assertThat(b.path("unknownSeconds").asLong()).isEqualTo(1200);
        assertThat(b.path("activities").get(0).path("effortSource").asText()).isEqualTo("PERCEIVED");
    }
    @Test void legacyCalendarBasisDoesNotInventAnAbsoluteInstant() throws Exception {
        Runner r=runner("Asia/Tokyo");Activity a=run(r,"2026-10-11T00:15:00",600,2,true);row(r,a,0,600,0,0,0);
        JsonNode b=block(r,7);assertThat(b.path("activities").get(0).path("calendarBasis").asText()).isEqualTo("STRAVA_LOCAL_WALL_TIME");
        assertThat(b.path("activities").get(0).has("activityInstant")).isFalse();
        assertThat(b.path("activities").get(0).path("localDate").asText()).isEqualTo("2026-10-11");
    }
    @Test void rejectsUnauthorizedAndUnsupportedWindows() throws Exception {
        assertThat(request(null,"?days=7").statusCode()).isEqualTo(401);
        assertThat(request(runner("UTC"),"?days=365").statusCode()).isEqualTo(400);
    }
    static class BlockClock extends Clock {
        Instant instant=Instant.parse("2026-10-11T03:00:00Z");public ZoneId getZone(){return ZoneOffset.UTC;}
        public Clock withZone(ZoneId z){return Clock.fixed(instant,z);}public Instant instant(){return instant;}
    }
    @TestConfiguration static class ClockConfig {@Bean @Primary BlockClock blockClock(){return new BlockClock();}}
}
