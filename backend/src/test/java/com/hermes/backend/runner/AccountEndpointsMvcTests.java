package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityPointRepository;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The account endpoints through the real servlet stack: security filters, argument binding and the
 * ZIP written to the servlet response. The controller's unit tests call its methods directly, which is
 * how an export handler that Spring could not serve (a 500 "no converter" on every request, then an
 * error logged after every download) went unnoticed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:account-endpoints-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class AccountEndpointsMvcTests {

    private static final String SESSION_REQUIRED = "Invalid or expired session token.";

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityPointRepository points;
    @Autowired private AccountExportService exports;

    private Runner runner(String role) {
        Runner runner = new Runner("account-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setDisplayName("Account Tester");
        runner.setRole(role);
        return runners.saveAndFlush(runner);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private Activity run(Runner owner, String name) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName(name);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 7, 30, 0));
        run.setDistanceMeters(5000.0);
        run.setDistanceKm(5.0);
        run.setMovingTimeSeconds(1500);
        return activities.saveAndFlush(run);
    }

    private void track(Activity run) {
        for (int i = 0; i < 3; i++) {
            ActivityPoint point = new ActivityPoint();
            point.setActivity(run);
            point.setSequenceIndex(i);
            point.setLatitude(40.0 + i * 0.001);
            point.setLongitude(-73.0);
            point.setElapsedSeconds(i * 10);
            points.saveAndFlush(point);
        }
    }

    private static Map<String, String> unzip(byte[] zipped) throws IOException {
        Map<String, String> entries = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zipped), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                entries.put(entry.getName(), new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        return entries;
    }

    private MvcResult export(String authorization, boolean tracks) throws Exception {
        // Not async: a streamed (async) response is timed out by Spring MVC and re-runs the security
        // filters after the response is committed, so the whole export must finish in the first dispatch.
        return mockMvc.perform(get("/api/account/export")
                        .param("tracks", String.valueOf(tracks))
                        .header("Authorization", authorization))
                .andExpect(request().asyncNotStarted())
                .andExpect(status().isOk())
                .andReturn();
    }

    // --- export ----------------------------------------------------------------------------------------------

    @Test
    void exportDownloadsTheSignedInRunnersDataAsAZip() throws Exception {
        Runner owner = runner("USER");
        run(owner, "Sunday long run");
        run(runner("USER"), "someone else's run");

        MvcResult result = export(bearer(owner), false);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentType()).isEqualTo("application/zip");
        assertThat(result.getResponse().getHeader("Content-Disposition"))
                .startsWith("attachment; filename=\"hermes-export-").endsWith(".zip\"");
        assertThat(result.getResponse().getHeader("Cache-Control")).isEqualTo("no-store");
        Map<String, String> files = unzip(result.getResponse().getContentAsByteArray());
        assertThat(files.keySet()).contains("README.txt", "profile.json", "runs.csv");
        assertThat(files.get("runs.csv")).contains("Sunday long run").doesNotContain("someone else's run");
        assertThat(files.keySet()).noneMatch(name -> name.startsWith("tracks/"));
    }

    @Test
    void exportIncludesGpsTracksOnlyWhenAskedFor() throws Exception {
        Runner owner = runner("USER");
        Activity withTrack = run(owner, "with a track");
        track(withTrack);
        String authorization = bearer(owner);

        Map<String, String> without = unzip(export(authorization, false).getResponse().getContentAsByteArray());
        Map<String, String> with = unzip(export(authorization, true).getResponse().getContentAsByteArray());

        assertThat(without.keySet()).noneMatch(name -> name.startsWith("tracks/"));
        assertThat(without.get("README.txt")).contains("tracks/      Not included");
        assertThat(with.keySet()).contains("tracks/" + withTrack.getId() + ".gpx");
        assertThat(with.get("README.txt")).contains("One GPX file per run").doesNotContain("tracks/      Not included");
    }

    @Test
    void exportWithoutASessionIsRefused() throws Exception {
        mockMvc.perform(get("/api/account/export"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(SESSION_REQUIRED));
    }

    @Test
    void exportIsRefusedWithAJsonErrorWhileAnotherExportIsRunning() throws Exception {
        String authorization = bearer(runner("USER"));
        assertThat(exports.tryBegin()).isTrue();
        try {
            mockMvc.perform(get("/api/account/export").header("Authorization", authorization))
                    .andExpect(status().isTooManyRequests())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.code").value("EXPORT_BUSY"));
        } finally {
            exports.end();
        }
        // The slot is free again, so the same request now succeeds.
        mockMvc.perform(get("/api/account/export").header("Authorization", authorization))
                .andExpect(status().isOk());
    }

    // --- delete ----------------------------------------------------------------------------------------------

    @Test
    void deleteWithTheConfirmationWordRemovesTheAccountAndEndsItsSession() throws Exception {
        Runner owner = runner("USER");
        run(owner, "gone with the account");
        String authorization = bearer(owner);

        mockMvc.perform(delete("/api/account")
                        .header("Authorization", authorization)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirm\":\"DELETE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));

        assertThat(runners.findById(owner.getId())).isEmpty();
        assertThat(activities.findAll()).noneMatch(a -> "gone with the account".equals(a.getName()));
        mockMvc.perform(get("/api/account/export").header("Authorization", authorization))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteWithoutTheExactConfirmationWordChangesNothing() throws Exception {
        Runner owner = runner("USER");
        String authorization = bearer(owner);

        for (String body : new String[] {"{\"confirm\":\"delete\"}", "{\"confirm\":\"\"}", "{}"}) {
            mockMvc.perform(delete("/api/account")
                            .header("Authorization", authorization)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("CONFIRMATION_REQUIRED"));
        }
        mockMvc.perform(delete("/api/account").header("Authorization", authorization))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CONFIRMATION_REQUIRED"));
        assertThat(runners.findById(owner.getId())).isPresent();
    }

    @Test
    void deleteRefusesAnAdministratorAccount() throws Exception {
        Runner admin = runner("ADMIN");

        mockMvc.perform(delete("/api/account")
                        .header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirm\":\"DELETE\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_ACCOUNT"));

        assertThat(runners.findById(admin.getId())).isPresent();
    }

    @Test
    void deleteWithoutASessionIsRefused() throws Exception {
        mockMvc.perform(delete("/api/account")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirm\":\"DELETE\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Content-Type", startsWith("application/json")));
    }
}
