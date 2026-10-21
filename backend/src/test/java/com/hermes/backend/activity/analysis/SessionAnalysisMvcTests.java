package com.hermes.backend.activity.analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.activity.*;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.*;
import com.hermes.backend.weather.AcclimatizationService;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:session-analysis;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "app.official-course.startup-seed.enabled=false",
    "strava.sync.enabled=false", "garmin.wellness.sync.enabled=false", "app.coach.nightly.enabled=false",
    "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class SessionAnalysisMvcTests {
    @Autowired MockMvc mvc;
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired ActivityPointRepository points;
    @Autowired AuthService auth;
    @Autowired AccountExportService exports;
    @Autowired AccountDeletionService deletion;
    // Weather is the external import collaborator; all import/API/persistence code remains real.
    @MockitoBean AcclimatizationService weather;
    final ObjectMapper json = new ObjectMapper();
    Runner owner() { return runners.saveAndFlush(new Runner("interval-" + UUID.randomUUID() + "@hermes.test", "ACTIVE")); }
    String token(Runner r) { return "Bearer " + auth.issueSessionToken(r); }
    String path(Activity a) { return "/api/activities/" + a.getId() + "/session-analysis"; }
    JsonNode read(Activity a, Runner r) throws Exception {
        return json.readTree(mvc.perform(get(path(a)).header("Authorization", token(r)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    JsonNode save(Activity a, Runner r, String body) throws Exception {
        return json.readTree(mvc.perform(put(path(a)).header("Authorization", token(r))
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
    }
    Activity activity(Runner r, int duration, double distance) {
        Activity a = new Activity(); a.setRunner(r); a.setActivityType(ActivityType.RUN); a.setProvider(ImportProvider.GARMIN);
        a.setStartTime(LocalDateTime.of(2026, 10, 11, 10, 0)); a.setStartDate("2026-10-11T10:00:00");
        a.setName("Synthetic session"); a.setDurationSeconds((long)duration); a.setMovingTimeSeconds(duration);
        a.setDistanceMeters(distance); a.setDistanceKm(distance / 1000); return activities.saveAndFlush(a);
    }
    void sample(Activity a, int seq, int time, Double distance, Integer hr, Integer cadence) {
        ActivityPoint p = new ActivityPoint(); p.setActivity(a); p.setSequenceIndex(seq); p.setElapsedSeconds(time);
        p.setDistanceMeters(distance); p.setHeartRate(hr); p.setCadence(cadence); p.setLatitude(40); p.setLongitude(-74);
        points.saveAndFlush(p);
    }
    static String body(String segments) { return "{\"segments\":" + segments + ",\"comparison\":{\"workout\":\"6 x 400m\",\"surface\":\"track\",\"weather\":\"cool\"}}"; }
    static String segment(String id, String kind, int start, int end) {
        return "{\"id\":\"" + id + "\",\"kind\":\"" + kind + "\",\"startSeconds\":" + start + ",\"endSeconds\":" + end + "}";
    }

    @Test void unsupportedLapsStayUnknownAndSummaryRpeAndConditionsStayHonest() throws Exception {
        Runner r = owner(); Activity a = activity(r, 100, 400);
        sample(a, 0, 0, 0d, null, null); sample(a, 1, 100, 400d, null, null);
        JsonNode n = read(a, r);
        assertThat(n.at("/segments/0/kind").asText()).isEqualTo("unknown");
        assertThat(n.at("/source/importedLapsSupported").asBoolean()).isFalse();
        assertThat(n.at("/sourceSegments").size()).isZero();
        assertThat(n.at("/measurements/distanceMeters").asDouble()).isEqualTo(400);
        assertThat(n.at("/measurements/paceSecondsPerKm").asDouble()).isEqualTo(250);
        assertThat(n.at("/measurements/averageHeartRate").isNull()).isTrue();
        assertThat(n.at("/recorded/rpe/value").isNull()).isTrue();
        assertThat(n.at("/recorded/conditions/weather/provenance").asText()).isEqualTo("unavailable");
    }
    @Test void timerOnlySummaryNeverInventsElapsedSegmentsButExplicitRunnerBoundariesRemainSupported() throws Exception {
        Runner r = owner(); Activity a = activity(r, 100, 400);
        JsonNode n = read(a, r);
        assertThat(n.at("/source/durationSeconds").asDouble()).isEqualTo(100);
        assertThat(n.at("/source/elapsedDurationSeconds").isNull()).isTrue();
        assertThat(n.at("/measurements/durationSeconds").asDouble()).isEqualTo(100);
        assertThat(n.at("/measurements/elapsedDurationSeconds").isNull()).isTrue();
        assertThat(n.at("/measurements/distanceMeters").asDouble()).isEqualTo(400);
        assertThat(n.at("/measurements/paceSecondsPerKm").asDouble()).isEqualTo(250);
        assertThat(n.at("/segments").size()).isZero();
        assertThat(n.at("/measurements/averageHeartRate").isNull()).isTrue();
        n = save(a, r, "{\"segments\":[" + segment("confirmed", "unknown", 0, 100) + "]}");
        assertThat(n.at("/segments/0/provenance").asText()).isEqualTo("runner-declared");
        assertThat(n.at("/segments/0/measurements/elapsedDurationSeconds").asDouble()).isEqualTo(100);
        assertThat(n.at("/segments/0/measurements/distanceMeters").isNull()).isTrue();
        assertThat(n.at("/source/elapsedDurationSeconds").isNull()).isTrue();
        assertThat(save(a, r, "{\"segments\":null}").at("/segments").size()).isZero();
    }
    @Test void timerOnlyImportedTcxLapRetainsTotalsWithoutInventingElapsedBoundaries() throws Exception {
        Runner r = owner();
        // Same supported shape as parent's no-telemetry.tcx: coordinates, but no timestamp stream.
        String xml = """
            <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
            <Activities><Activity Sport="Running"><Id>2026-10-03T12:00:00Z</Id>
            <Lap StartTime="2026-10-03T12:00:00Z"><TotalTimeSeconds>60</TotalTimeSeconds>
            <DistanceMeters>100</DistanceMeters><Calories>0</Calories><TriggerMethod>Manual</TriggerMethod><Track>
            <Trackpoint><Position><LatitudeDegrees>0.04</LatitudeDegrees><LongitudeDegrees>0</LongitudeDegrees></Position></Trackpoint>
            <Trackpoint><Position><LatitudeDegrees>0.04</LatitudeDegrees><LongitudeDegrees>0.0009</LongitudeDegrees></Position></Trackpoint>
            </Track></Lap></Activity></Activities></TrainingCenterDatabase>
            """;
        mvc.perform(multipart("/api/import/files").file(new MockMultipartFile("file", "no-telemetry.tcx", "application/xml", xml.getBytes(StandardCharsets.UTF_8)))
            .param("provider", "GARMIN").header("Authorization", token(r))).andExpect(status().isOk())
            .andExpect(jsonPath("$.importedActivities").value(1));
        Activity a = activities.findByRunnerAndActivityTypeOrderByIdDesc(r, ActivityType.RUN).get(0);
        String original = a.getSourceImportedLapsJson();
        JsonNode n = read(a, r), sourceSegments = n.get("sourceSegments");
        assertThat(n.at("/source/importedLapsSupported").asBoolean()).isTrue();
        assertThat(n.at("/source/elapsedDurationSeconds").isNull()).isTrue();
        assertThat(n.at("/measurements/elapsedDurationSeconds").isNull()).isTrue();
        assertThat(n.at("/measurements/paceSecondsPerKm").asDouble()).isEqualTo(600);
        assertThat(n.get("segments")).isEqualTo(sourceSegments);
        assertThat(sourceSegments.size()).isEqualTo(1);
        JsonNode lap = sourceSegments.get(0), m = lap.get("measurements");
        assertThat(lap.get("kind").asText()).isEqualTo("unknown");
        assertThat(lap.get("provenance").asText()).isEqualTo("imported");
        assertThat(lap.get("startSeconds").asInt()).isZero();
        assertThat(lap.get("endSeconds").isNull()).isTrue();
        assertThat(m.get("elapsedDurationSeconds").isNull()).isTrue();
        assertThat(m.get("durationSeconds").asDouble()).isEqualTo(60);
        assertThat(m.get("distanceMeters").asDouble()).isEqualTo(100);
        assertThat(m.get("paceSecondsPerKm").asDouble()).isEqualTo(600);
        assertThat(m.get("averageHeartRate").isNull()).isTrue();
        assertThat(m.get("hrCoverageSeconds").asDouble()).isZero();
        assertThat(m.get("hrCoverageFraction").asDouble()).isZero();
        assertThat(points.findByActivityOrderBySequenceIndexAsc(a)).hasSize(2)
            .allSatisfy(point -> assertThat(point.getElapsedSeconds()).isNull());
        n = save(a, r, "{\"segments\":[" + segment("confirmed", "unknown", 0, 60) + "]}");
        assertThat(n.get("sourceSegments")).isEqualTo(sourceSegments);
        assertThat(n.at("/source/elapsedDurationSeconds").isNull()).isTrue();
        assertThat(n.at("/segments/0/provenance").asText()).isEqualTo("runner-declared");
        assertThat(n.at("/segments/0/measurements/distanceMeters").isNull()).isTrue();
        assertThat(save(a, r, "{\"segments\":null}").get("segments")).isEqualTo(sourceSegments);
        assertThat(read(a, r).get("sourceSegments")).isEqualTo(sourceSegments);
        assertThat(activities.findById(a.getId()).orElseThrow().getSourceImportedLapsJson()).isEqualTo(original);
    }
    @Test void unequalSamplesUseTimeWeightedHrAndNeverFillLongGapsOrMissingHr() throws Exception {
        Runner r = owner(); Activity a = activity(r, 20, 100);
        sample(a, 0, 0, 0d, 100, 160); sample(a, 1, 2, 10d, 120, 180);
        sample(a, 2, 10, 50d, 160, null); sample(a, 3, 20, 100d, null, null);
        JsonNode n = save(a, r, body("[" + segment("w", "work", 0, 20) + "]"));
        JsonNode m = n.at("/segments/0/measurements");
        assertThat(m.get("distanceMeters").asDouble()).isEqualTo(100);
        assertThat(m.get("paceSecondsPerKm").asDouble()).isEqualTo(200);
        assertThat(m.get("averageHeartRate").asDouble()).isEqualTo(134); // (110*2 + 140*8)/10
        assertThat(m.get("hrCoverageSeconds").asDouble()).isEqualTo(10);
        assertThat(m.get("hrCoverageFraction").asDouble()).isEqualTo(.5);
        assertThat(m.get("averageCadence").asDouble()).isEqualTo(170);
        Activity hole = activity(r, 100, 400);
        sample(hole, 0, 0, 0d, 100, null); sample(hole, 1, 100, 400d, 160, null);
        assertThat(read(hole, r).at("/measurements/averageHeartRate").isNull()).isTrue();
        assertThat(read(hole, r).at("/measurements/hrCoverageSeconds").asDouble()).isZero();
    }
    @Test void repeatedSaveReloadKeepsDeclarationsAndNeverMutatesTelemetry() throws Exception {
        Runner r = owner(); Activity a = activity(r, 20, 100);
        sample(a, 0, 0, 0d, null, null); sample(a, 1, 20, 100d, null, null);
        String b = body("[" + segment("w", "work", 0, 10) + "," + segment("r", "recovery", 10, 20) + "]");
        JsonNode first = save(a, r, b), repeated = save(a, r, b), reload = read(a, r);
        assertThat(repeated).isEqualTo(first); assertThat(reload).isEqualTo(first);
        assertThat(first.at("/segments/0/provenance").asText()).isEqualTo("runner-declared");
        assertThat(first.at("/declarations/comparison/weather").asText()).isEqualTo("cool");
        assertThat(first.at("/segments/0/measurements/distanceMeters").isNull()).isTrue(); // no exact 10s boundary
        assertThat(points.findByActivityOrderBySequenceIndexAsc(a)).hasSize(2);
        assertThat(activities.findById(a.getId()).orElseThrow().getDistanceMeters()).isEqualTo(100);
        assertThat(save(a, r, body("null")).at("/segments/0/kind").asText()).isEqualTo("unknown");
        assertThat(save(a, r, body("[]")).at("/segments").size()).isZero();
    }
    @Test void rejectsOverlapsUnorderedOutOfBoundsDuplicateIdsUnknownKindsAndInvalidTargets() throws Exception {
        Runner r = owner(); Activity a = activity(r, 20, 100);
        List<String> bad = List.of(
            "[" + segment("a", "work", 0, 12) + "," + segment("b", "recovery", 10, 20) + "]",
            "[" + segment("a", "work", 10, 20) + "," + segment("b", "recovery", 0, 10) + "]",
            "[" + segment("a", "work", -1, 10) + "]", "[" + segment("a", "work", 0, 21) + "]",
            "[" + segment("a", "work", 0, 0) + "]", "[" + segment("a", "guess", 0, 10) + "]",
            "[" + segment("a", "work", 0, 10) + "," + segment("a", "recovery", 10, 20) + "]",
            "[{\"id\":\"a\",\"kind\":\"work\",\"startSeconds\":0,\"endSeconds\":10,\"targetPaceSecondsPerKm\":-2}]",
            "[{\"id\":\"a\",\"kind\":\"work\",\"endSeconds\":10}]",
            "[{\"id\":\"a\",\"kind\":\"work\",\"startSeconds\":0.5,\"endSeconds\":10}]"
        );
        for (String s : bad) mvc.perform(put(path(a)).header("Authorization", token(r)).contentType(MediaType.APPLICATION_JSON)
            .content(body(s))).andExpect(status().isBadRequest());
        assertThat(read(a, r).at("/declarations/segments").isNull()).isTrue();
    }
    @Test void independentEditorsPreserveEachOthersDeclarationsAndExplicitEmptyClears() throws Exception {
        Runner r = owner(); Activity a = activity(r, 20, 100);
        save(a, r, "{\"comparison\":{\"weather\":\"rain\"}}");
        JsonNode n = save(a, r, "{\"segments\":[" + segment("w", "work", 0, 20) + "]}");
        assertThat(n.at("/declarations/comparison/weather").asText()).isEqualTo("rain");
        n = save(a, r, "{\"comparison\":{\"surface\":\"track\"}}");
        assertThat(n.at("/declarations/segments/0/id").asText()).isEqualTo("w");
        assertThat(n.at("/declarations/comparison/weather").isNull()).isTrue();
        n = save(a, r, "{\"comparison\":{}}");
        assertThat(n.at("/declarations/comparison/surface").isNull()).isTrue();
        assertThat(n.at("/segments/0/kind").asText()).isEqualTo("work");
        n = save(a, r, "{\"segments\":[]}"); assertThat(n.at("/segments").size()).isZero();
    }
    @Test void explicitRecoveryDeclarationIsSupportedAndNeverDerivedFromLaps() throws Exception {
        Runner r = owner(); Activity a = activity(r, 20, 100);
        JsonNode n = save(a, r, "{\"comparison\":{\"recovery\":\"90 second jog between 400m reps\"}}");
        assertThat(n.at("/declarations/comparison/recovery").asText()).isEqualTo("90 second jog between 400m reps");
        assertThat(read(a, r).at("/recorded/conditions/recovery/provenance").asText()).isEqualTo("unavailable");
        assertThat(save(a, r, "{\"comparison\":null}").at("/declarations/comparison/recovery").isNull()).isTrue();
    }
    @Test void currentAccountTimeZoneIsUsedForFileActivitiesAndLegacyStravaInstantRemainsUnknown() throws Exception {
        Runner r = owner(); r.setTimeZone("America/New_York"); runners.saveAndFlush(r);
        Activity a = activity(r, 20, 100); a.setStartTime(LocalDateTime.of(2026,10,11,1,0)); activities.saveAndFlush(a);
        JsonNode n = read(a, r);
        assertThat(n.get("accountLocalDate").asText()).isEqualTo("2026-10-10");
        assertThat(n.get("startLocalDate").asText()).isEqualTo("2026-10-10");
        assertThat(n.get("accountTimeZone").asText()).isEqualTo("America/New_York");
        assertThat(n.get("startTimeUtc").asText()).isEqualTo("2026-10-11T01:00:00Z");
        r.setTimeZone("Asia/Shanghai"); runners.saveAndFlush(r);
        assertThat(read(a, r).get("accountTimeZone").asText()).isEqualTo("Asia/Shanghai");
        a.setStravaApiSourced(true); activities.saveAndFlush(a); n = read(a, r);
        assertThat(n.get("startTimeUtc").isNull()).isTrue();
        assertThat(n.get("timeProvenance").asText()).isEqualTo("STRAVA_LOCAL_WALL_TIME");
    }
    @Test void simultaneousIndependentEditorSavesPreserveBothFields() throws Exception {
        Runner r = owner(); Activity a = activity(r, 20, 100);
        var pool = java.util.concurrent.Executors.newFixedThreadPool(4);
        try {
            for (int attempt = 0; attempt < 10; attempt++) {
                save(a, r, "{\"segments\":null,\"comparison\":null}");
                String authToken = token(r);
                var gate = new java.util.concurrent.CyclicBarrier(2);
                List<java.util.concurrent.Callable<Integer>> calls = List.of(
                    () -> { gate.await(); return mvc.perform(put(path(a)).header("Authorization", authToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"segments\":[" + segment("w", "work", 0, 20) + "]}")).andReturn().getResponse().getStatus(); },
                    () -> { gate.await(); return mvc.perform(put(path(a)).header("Authorization", authToken).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comparison\":{\"surface\":\"track\"}}")).andReturn().getResponse().getStatus(); });
                for (var f : pool.invokeAll(calls)) assertThat(f.get()).isEqualTo(200);
                JsonNode n = read(a, r);
                assertThat(n.at("/declarations/segments/0/id").asText()).isEqualTo("w");
                assertThat(n.at("/declarations/comparison/surface").asText()).isEqualTo("track");
            }
        } finally { pool.shutdownNow(); }
    }
    @Test void unauthenticatedForeignAndMissingOwnersCannotReadOrSave() throws Exception {
        Runner r = owner(), other = owner(); Activity a = activity(r, 20, 100);
        mvc.perform(get(path(a))).andExpect(status().isUnauthorized());
        mvc.perform(put(path(a)).contentType(MediaType.APPLICATION_JSON).content(body("[]"))).andExpect(status().isUnauthorized());
        mvc.perform(get(path(a)).header("Authorization", token(other))).andExpect(status().isNotFound());
        mvc.perform(put(path(a)).header("Authorization", token(other)).contentType(MediaType.APPLICATION_JSON).content(body("[]")))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/activities/99999999/session-analysis").header("Authorization", token(r))).andExpect(status().isNotFound());
    }
    @Test void emptyDataAndRecordedRpeKeepNullAndActualValuesDistinct() throws Exception {
        Runner r = owner(); Activity a = activity(r, 0, 0);
        assertThat(read(a, r).at("/segments").size()).isZero();
        a.setPerceivedExertion(7); activities.saveAndFlush(a);
        JsonNode n = read(a, r); assertThat(n.at("/recorded/rpe/value").asInt()).isEqualTo(7);
        assertThat(n.at("/recorded/rpe/provenance").asText()).isEqualTo("recorded");
        assertThat(n.at("/measurements/paceSecondsPerKm").isNull()).isTrue();
    }
    @Test void actualTcxImportKeepsSixWorkFiveRecoveryThreeMissingHrAndOriginalLapsAfterEdits() throws Exception {
        Runner r = owner(); Activity a = importTcx(r, true, false);
        JsonNode before = read(a, r);
        assertThat(before.at("/source/importedLapsSupported").asBoolean()).isTrue();
        assertThat(before.at("/sourceSegments").size()).isEqualTo(11);
        int work = 0, recovery = 0, missing = 0;
        for (JsonNode s : before.get("segments")) {
            if (s.get("kind").asText().equals("work")) { work++; if(s.at("/measurements/averageHeartRate").isNull()) missing++; }
            if (s.get("kind").asText().equals("recovery")) recovery++;
        }
        assertThat(work).isEqualTo(6); assertThat(recovery).isEqualTo(5); assertThat(missing).isEqualTo(3);
        assertThat(before.at("/source/distanceMeters").asDouble()).isEqualTo(650);
        assertThat(before.at("/source/durationSeconds").asInt()).isEqualTo(90);
        JsonNode after = save(a, r, body("[" + segment("confirmed", "unknown", 0, 90) + "]"));
        assertThat(after.get("sourceSegments")).isEqualTo(before.get("sourceSegments"));
        assertThat(after.get("source")).isEqualTo(before.get("source"));
        assertThat(save(a, r, body("null")).get("segments")).isEqualTo(before.get("segments"));
    }
    @Test void unlabeledTcxIsUnknownAndElapsedPausesDoNotBecomeTimerDurationOrHrCoverage() throws Exception {
        Runner r = owner(); Activity a = importTcx(r, false, true);
        JsonNode n = read(a, r);
        for (JsonNode s : n.get("segments")) assertThat(s.get("kind").asText()).isEqualTo("unknown");
        assertThat(n.at("/source/elapsedDurationSeconds").asInt()).isEqualTo(120);
        assertThat(n.at("/source/durationSeconds").asInt()).isEqualTo(90);
        assertThat(n.at("/measurements/paceSecondsPerKm").asDouble()).isEqualTo(90000d/650);
        assertThat(n.at("/sourceSegments/0/measurements/durationSeconds").asInt()).isEqualTo(10);
        assertThat(n.at("/sourceSegments/0/measurements/elapsedDurationSeconds").asInt()).isEqualTo(40);
        assertThat(n.at("/sourceSegments/0/measurements/hrCoverageSeconds").asDouble()).isEqualTo(10);
        assertThat(n.at("/sourceSegments/0/measurements/hrCoverageFraction").asDouble()).isEqualTo(.25);
    }
    @Test void exportIncludesOnlyOwnerDeclarationsAndDeletionRemovesActivityAttachedMetadata() throws Exception {
        Runner r = owner(), other = owner(); Activity a = activity(r, 20, 100), b = activity(other, 20, 100);
        save(a, r, body("[]")); save(b, other, body("[]"));
        ByteArrayOutputStream out = new ByteArrayOutputStream(); exports.write(r, false, out);
        String entry = null;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(out.toByteArray()), StandardCharsets.UTF_8)) {
            java.util.zip.ZipEntry e; while ((e = zip.getNextEntry()) != null)
                if (e.getName().equals("session-analysis.json")) entry = new String(zip.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertThat(entry).isNotNull(); JsonNode records = json.readTree(entry);
        assertThat(records.size()).isEqualTo(1); assertThat(records.get(0).get("activityId").asLong()).isEqualTo(a.getId());
        assertThat(entry).contains("cool").doesNotContain(r.getEmail(), "Bearer");
        deletion.deleteAccount(r.getId()); assertThat(activities.findById(a.getId())).isEmpty();
        assertThat(read(b, other).at("/declarations/comparison/weather").asText()).isEqualTo("cool");
    }

    Activity importTcx(Runner r, boolean labeled, boolean pause) throws Exception {
        StringBuilder xml = new StringBuilder("<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\"><Activities><Activity Sport=\"Running\"><Id>2026-10-11T10:00:00Z</Id>");
        int t = 0, d = 0;
        for (int lap = 0; lap < 11; lap++) {
            boolean work = lap % 2 == 0, missingHr = work && lap >= 6;
            int duration = work ? 10 : 6, distance = work ? 100 : 10;
            LocalDateTime start = LocalDateTime.of(2026,10,11,10,0).plusSeconds(t);
            xml.append("<Lap StartTime=\"").append(start).append("Z\"><TotalTimeSeconds>").append(duration)
                .append("</TotalTimeSeconds><DistanceMeters>").append(distance).append("</DistanceMeters>");
            if (labeled) xml.append("<Intensity>").append(work ? "Active" : "Resting").append("</Intensity>");
            xml.append("<Track>");
            for (int s = 0; s <= duration; s++) {
                int elapsed = t + s;
                xml.append("<Trackpoint><Time>").append(LocalDateTime.of(2026,10,11,10,0).plusSeconds(elapsed))
                    .append("Z</Time><Position><LatitudeDegrees>40.70</LatitudeDegrees><LongitudeDegrees>-74.0</LongitudeDegrees></Position><DistanceMeters>")
                    .append(d + distance * s / (double)duration).append("</DistanceMeters>");
                if (!missingHr) xml.append("<HeartRateBpm><Value>150</Value></HeartRateBpm>");
                xml.append("</Trackpoint>");
            }
            if (pause && lap == 0) xml.append("<Trackpoint><Time>2026-10-11T10:00:40Z</Time><Position><LatitudeDegrees>40.70</LatitudeDegrees><LongitudeDegrees>-74.0</LongitudeDegrees></Position><DistanceMeters>100</DistanceMeters><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>");
            xml.append("</Track></Lap>"); t += duration + (pause && lap == 0 ? 30 : 0); d += distance;
        }
        xml.append("</Activity></Activities></TrainingCenterDatabase>");
        mvc.perform(multipart("/api/import/files").file(new MockMultipartFile("file", "interval.tcx", "application/xml", xml.toString().getBytes(StandardCharsets.UTF_8)))
            .param("provider", "GARMIN").header("Authorization", token(r))).andExpect(status().isOk())
            .andExpect(jsonPath("$.importedActivities").value(1));
        return activities.findByRunnerAndActivityTypeOrderByIdDesc(r, ActivityType.RUN).get(0);
    }
}
