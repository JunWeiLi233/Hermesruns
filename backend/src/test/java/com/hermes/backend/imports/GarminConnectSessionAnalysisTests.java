package com.hermes.backend.imports;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.garmin.fit.*;
import com.hermes.backend.activity.*;
import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.*;
import com.hermes.backend.weather.AcclimatizationService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Offline downloaded-FIT seam: real parser, database and API, no downloader/login execution. */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:session-analysis;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "app.official-course.startup-seed.enabled=false",
    "strava.sync.enabled=false", "garmin.wellness.sync.enabled=false", "app.coach.nightly.enabled=false",
    "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class GarminConnectSessionAnalysisTests {
    @Autowired GarminConnectImportService imports;
    @Autowired RunnerRepository runners;
    @Autowired ActivityRepository activities;
    @Autowired ActivityPointRepository points;
    @Autowired AuthService auth;
    @Autowired MockMvc mvc;
    @MockitoBean AcclimatizationService weather;
    @TempDir Path scratch;
    final ObjectMapper json = new ObjectMapper();

    @Test void downloadedFitPersistsOriginalLapsThroughApiAndRunnerEdits() throws Exception {
        Path fixture = scratch.resolve("downloaded-laps.fit");
        Instant start = Instant.parse("2026-10-11T10:00:00Z");
        FileEncoder encoder = new FileEncoder(fixture.toFile(), Fit.ProtocolVersion.V2_0);
        try {
            for (int i = 0; i <= 60; i++) {
                RecordMesg record = new RecordMesg(); record.setTimestamp(new DateTime(java.util.Date.from(start.plusSeconds(i))));
                record.setPositionLat(485808100); record.setPositionLong(-882854400); record.setDistance((float)i * 5);
                encoder.write(record);
            }
            for (int i = 0; i < 2; i++) {
                LapMesg lap = new LapMesg(); lap.setStartTime(new DateTime(java.util.Date.from(start.plusSeconds(i * 30))));
                lap.setTimestamp(new DateTime(java.util.Date.from(start.plusSeconds((i + 1) * 30))));
                lap.setTotalElapsedTime(30f); lap.setTotalTimerTime(20f); lap.setTotalDistance(150f); lap.setSport(Sport.RUNNING);
                encoder.write(lap);
            }
            SessionMesg session = new SessionMesg(); session.setStartTime(new DateTime(java.util.Date.from(start))); session.setSport(Sport.RUNNING);
            session.setTotalDistance(300f); session.setTotalTimerTime(40f); encoder.write(session);
        } finally { encoder.close(); }
        var parsed = new FitActivityFileParser().parse("downloaded-laps.fit", Files.readAllBytes(fixture));
        assertThat(parsed.sourceLaps()).hasSize(2);
        Runner owner = runners.saveAndFlush(new Runner("connect-laps-" + UUID.randomUUID() + "@hermes.test", "ACTIVE"));
        var tracker = new GarminConnectImportService.GarminSyncTracker(); tracker.tryBegin();
        ReflectionTestUtils.invokeMethod(imports, "importSingleActivity", owner,
                Map.of("filePath", fixture.toString(), "activityId", UUID.randomUUID().toString()), tracker);
        assertThat(tracker.snapshot().importedRuns()).isEqualTo(1);
        Activity a = activities.findByRunnerAndActivityTypeOrderByIdDesc(owner, ActivityType.RUN).get(0);
        assertThat(com.hermes.backend.activity.analysis.SessionAnalysisSources.decode(a.getSourceImportedLapsJson())).isEqualTo(parsed.sourceLaps());
        assertThat(points.findByActivityOrderBySequenceIndexAsc(a)).hasSize(61);
        String token = "Bearer " + auth.issueSessionToken(owner), path = "/api/activities/" + a.getId() + "/session-analysis";
        JsonNode before = json.readTree(mvc.perform(get(path).header("Authorization", token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(before.at("/source/importedLapsSupported").asBoolean()).isTrue();
        assertThat(before.at("/source/durationSeconds").asDouble()).isEqualTo(40);
        assertThat(before.at("/source/distanceMeters").asDouble()).isEqualTo(300);
        assertThat(before.at("/source/elapsedDurationSeconds").asDouble()).isEqualTo(60);
        assertThat(before.at("/sourceSegments").size()).isEqualTo(2);
        assertThat(before.at("/sourceSegments/0/kind").asText()).isEqualTo("unknown");
        assertThat(before.at("/sourceSegments/0/startSeconds").asInt()).isZero();
        assertThat(before.at("/sourceSegments/0/endSeconds").asInt()).isEqualTo(30);
        assertThat(before.at("/sourceSegments/0/measurements/durationSeconds").asDouble()).isEqualTo(20);
        assertThat(before.at("/sourceSegments/0/measurements/averageHeartRate").isNull()).isTrue();
        JsonNode after = json.readTree(mvc.perform(put(path).header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"segments\":[{\"id\":\"confirmed\",\"kind\":\"work\",\"startSeconds\":0,\"endSeconds\":30}]}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(after.get("sourceSegments")).isEqualTo(before.get("sourceSegments"));
        assertThat(after.get("source")).isEqualTo(before.get("source"));
        JsonNode reload = json.readTree(mvc.perform(get(path).header("Authorization", token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(reload).isEqualTo(after);
        assertThat(reload.at("/segments/0/provenance").asText()).isEqualTo("runner-declared");
    }
}
