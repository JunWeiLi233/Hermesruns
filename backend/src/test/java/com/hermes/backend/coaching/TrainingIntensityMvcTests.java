package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
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

/** The intensity endpoint through the real servlet stack: security, argument handling, JSON in and out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-intensity-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class TrainingIntensityMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private TrainingZonesService zones;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("intensity-mvc-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** Runners here have no time zone, so their today is the UTC day. */
    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private static LocalDate thisMonday() {
        return today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    private void run(Runner owner, LocalDate day, int... zoneMinutes) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, LocalTime.NOON));
        run.setMovingTimeSeconds(1800);
        run.setDistanceKm(5.0);
        run = activities.saveAndFlush(run);
        ActivityTrainingMetrics row = new ActivityTrainingMetrics(run, owner);
        row.setLocalDate(day);
        row.setEffortScore(50.0);
        int[] seconds = new int[5];
        int covered = 0;
        for (int i = 0; i < zoneMinutes.length; i++) {
            seconds[i] = zoneMinutes[i] * 60;
            covered += seconds[i];
        }
        row.setZoneSeconds(seconds);
        row.setHrCoveredSeconds(covered);
        row.setEffortSource("HR_ZONES");
        row.setZonesUsed(zones.resolve(owner).zones());
        row.setModelVersion(TrainingMetricsService.MODEL_VERSION);
        row.setComputedAt(LocalDateTime.now());
        metrics.saveAndFlush(row);
    }

    @Test
    void theEndpointNeedsASession() throws Exception {
        mockMvc.perform(get("/api/training/intensity")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/training/intensity").header("Authorization", "Bearer nonsense"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theWeeksOfARunnerWithRunsHaveTheShapeTheScreenDraws() throws Exception {
        Runner owner = runner();
        for (int back = 0; back < 3; back++) {
            run(owner, thisMonday().minusWeeks(back), 60, 60, 40, 10, 30);
        }

        mockMvc.perform(get("/api/training/intensity").param("weeks", "3").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value(today().toString()))
                .andExpect(jsonPath("$.timeZone").value("Z"))
                .andExpect(jsonPath("$.lowZones").value(3))
                .andExpect(jsonPath("$.minRuns").value(3))
                .andExpect(jsonPath("$.minCoveredSeconds").value(3600))
                .andExpect(jsonPath("$.weeks", hasSize(3)))
                .andExpect(jsonPath("$.weeks[2].start").value(thisMonday().toString()))
                .andExpect(jsonPath("$.weeks[2].end").value(thisMonday().plusDays(6).toString()))
                .andExpect(jsonPath("$.weeks[2].complete").value(thisMonday().plusDays(6).isBefore(today())))
                .andExpect(jsonPath("$.weeks[2].runs").value(1))
                .andExpect(jsonPath("$.weeks[2].runsWithHeartRate").value(1))
                .andExpect(jsonPath("$.weeks[2].zoneSeconds", hasSize(5)))
                .andExpect(jsonPath("$.weeks[2].zoneSeconds[0]").value(3600))
                .andExpect(jsonPath("$.weeks[2].zoneSeconds[4]").value(1800))
                .andExpect(jsonPath("$.weeks[2].coveredSeconds").value(12000))
                .andExpect(jsonPath("$.summary.runs").value(3))
                .andExpect(jsonPath("$.summary.runsWithHeartRate").value(3))
                .andExpect(jsonPath("$.summary.coveredSeconds").value(36000))
                .andExpect(jsonPath("$.summary.shares.low").value(0.8))
                .andExpect(jsonPath("$.summary.shares.moderate").value(0.05))
                .andExpect(jsonPath("$.summary.shares.high").value(0.15))
                .andExpect(jsonPath("$.summary.polarizationIndex").value(2.38))
                .andExpect(jsonPath("$.summary.pattern").value("polarized"))
                .andExpect(jsonPath("$.pendingRuns").value(0));
    }

    @Test
    void aRunnerWithNothingGetsAnEmptyButValidAnswer() throws Exception {
        mockMvc.perform(get("/api/training/intensity").header("Authorization", bearer(runner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks", hasSize(0)))
                .andExpect(jsonPath("$.summary.pattern").value("insufficient"))
                .andExpect(jsonPath("$.summary.shares").doesNotExist())
                .andExpect(jsonPath("$.summary.polarizationIndex").doesNotExist());
    }

    @Test
    void anotherRunnersTimeInZonesIsInvisible() throws Exception {
        Runner mine = runner();
        Runner theirs = runner();
        run(theirs, thisMonday(), 0, 0, 0, 0, 100);

        mockMvc.perform(get("/api/training/intensity").header("Authorization", bearer(mine)))
                .andExpect(jsonPath("$.weeks", hasSize(0)))
                .andExpect(jsonPath("$.summary.runs").value(0));
        mockMvc.perform(get("/api/training/intensity").header("Authorization", bearer(theirs)))
                .andExpect(jsonPath("$.summary.runs").value(1));
    }

    @ParameterizedTest
    @ValueSource(strings = {"weeks=0", "weeks=53", "weeks=-1", "weeks=many", "weeks=2.5"})
    void aWeekCountThatMakesNoSenseIsRefused(String query) throws Exception {
        mockMvc.perform(get("/api/training/intensity?" + query).header("Authorization", bearer(runner())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RANGE"))
                .andExpect(jsonPath("$.error").isString());
    }
}
