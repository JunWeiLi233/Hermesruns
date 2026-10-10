package com.hermes.backend.summary;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.coaching.ActivityTrainingMetrics;
import com.hermes.backend.coaching.ActivityTrainingMetricsRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The summary route through the real servlet stack: security, ownership and the shape of the JSON. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:summary-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class RunSummaryMvcTests {

    private static final LocalDate DAY = LocalDate.of(2026, 3, 15);

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private TrainingZonesService zones;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("summary-mvc-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private Activity run(Runner owner, LocalDate day, double km, int seconds, Double effort, ActivityType kind) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(kind);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, LocalTime.NOON));
        run.setMovingTimeSeconds(seconds);
        run.setDurationSeconds((long) seconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000.0);
        run = activities.saveAndFlush(run);
        if (effort != null) {
            ActivityTrainingMetrics row = new ActivityTrainingMetrics(run, owner);
            row.setLocalDate(day);
            row.setEffortScore(effort);
            row.setEffortSource("HR_ZONES");
            row.setZonesUsed(zones.resolve(owner).zones());
            row.setModelVersion(1);
            row.setStale(false);
            row.setComputedAt(LocalDateTime.of(2026, 3, 16, 8, 0));
            metrics.saveAndFlush(row);
        }
        return run;
    }

    @ParameterizedTest(name = "[{index}] {0}")
    @ValueSource(strings = {"nothing", "Bearer nonsense"})
    void theRouteNeedsASession(String header) throws Exception {
        var request = get("/api/activities/1/summary");
        if (!"nothing".equals(header)) {
            request = request.header("Authorization", header);
        }
        mockMvc.perform(request).andExpect(status().isUnauthorized());
    }

    @Test
    void aRunnersOwnRunComesBackAsFindingsWithTheirNumbersAndTheRulesThatDecidedThem() throws Exception {
        Runner owner = runner();
        for (int i = 1; i <= 6; i++) {
            run(owner, DAY.minusDays(i), 10, 3000, 80.0, ActivityType.RUN);
        }
        Activity today = run(owner, DAY, 10, 2700, 80.0, ActivityType.RUN);

        mockMvc.perform(get("/api/activities/{id}/summary", today.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runId").value(today.getId()))
                .andExpect(jsonPath("$.state").value("ready"))
                .andExpect(jsonPath("$.reason").doesNotExist())
                .andExpect(jsonPath("$.day").value("2026-03-15"))
                .andExpect(jsonPath("$.findings[0].id").value("character"))
                .andExpect(jsonPath("$.findings[0].variant").value("moderate"))
                .andExpect(jsonPath("$.findings[0].facts.basis").value("effort"))
                .andExpect(jsonPath("$.findings[0].facts.distanceKm").value(10.0))
                .andExpect(jsonPath("$.findings[?(@.id=='pace')].variant").value("faster"))
                .andExpect(jsonPath("$.findings[?(@.id=='pace')].facts.paceSecPerKm").value(270.0))
                .andExpect(jsonPath("$.findings[?(@.id=='pace')].facts.recentPaceSecPerKm").value(300.0))
                .andExpect(jsonPath("$.findings[?(@.id=='pace')].thresholds.bandPercent").value(3))
                .andExpect(jsonPath("$.findings[?(@.id=='pace')].tone").value("positive"))
                .andExpect(jsonPath("$.findings[?(@.id=='pace')].weight").value(2));
    }

    @Test
    void aRunTooShortIsAnsweredWithNothingToSayAndWhy() throws Exception {
        Runner owner = runner();
        Activity tiny = run(owner, DAY, 0.4, 200, 5.0, ActivityType.RUN);

        mockMvc.perform(get("/api/activities/{id}/summary", tiny.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("none"))
                .andExpect(jsonPath("$.reason").value("too_short"))
                .andExpect(jsonPath("$.findings", hasSize(0)));
    }

    @Test
    void aRunThatIsNotTheCallersIsAnsweredLikeOneThatIsNotThere() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        Activity theirs = run(owner, DAY, 10, 3000, 80.0, ActivityType.RUN);

        mockMvc.perform(get("/api/activities/{id}/summary", theirs.getId()).header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/activities/{id}/summary", 987654321L).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void anActivityThatIsNotARunHasNoSummary() throws Exception {
        Runner owner = runner();
        Activity ride = run(owner, DAY, 30, 3600, 50.0, ActivityType.NON_RUN);

        mockMvc.perform(get("/api/activities/{id}/summary", ride.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }
}
