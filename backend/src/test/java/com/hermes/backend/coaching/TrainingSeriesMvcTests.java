package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
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

/** The two series endpoints through the real servlet stack: security, argument handling, JSON in and out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-series-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class TrainingSeriesMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private TrainingZonesService zones;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("series-mvc-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** Runners here have no time zone, so their today is the UTC day. */
    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private void effort(Runner owner, LocalDate day, double score, String source) {
        effort(owner, day, score, source, null);
    }

    private void effort(Runner owner, LocalDate day, double score, String source, String runType) {
        Activity run = new Activity();
        run.setRunType(runType);
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
        row.setEffortScore(score);
        row.setEffortSource(source);
        row.setZonesUsed(zones.resolve(owner).zones());
        row.setModelVersion(TrainingMetricsService.MODEL_VERSION);
        row.setComputedAt(LocalDateTime.now());
        metrics.saveAndFlush(row);
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/training/series", "/api/training/weekly-effort"})
    void bothEndpointsNeedASession(String path) throws Exception {
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(path).header("Authorization", "Bearer nonsense")).andExpect(status().isUnauthorized());
    }

    @Test
    void theSeriesOfARunnerWithRunsHasTheShapeTheScreenDraws() throws Exception {
        Runner owner = runner();
        effort(owner, today().minusDays(30), 120, "HR_ZONES");
        effort(owner, today().minusDays(10), 90, "PERCEIVED");

        mockMvc.perform(get("/api/training/series").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ready"))
                .andExpect(jsonPath("$.today").value(today().toString()))
                .andExpect(jsonPath("$.to").value(today().toString()))
                .andExpect(jsonPath("$.from").value(today().minusDays(179).toString()))
                .andExpect(jsonPath("$.timeZone").value("Z"))
                .andExpect(jsonPath("$.minHistoryDays").value(14))
                .andExpect(jsonPath("$.fitnessDays").value(42))
                .andExpect(jsonPath("$.fatigueDays").value(7))
                .andExpect(jsonPath("$.historyDays").value(31))
                .andExpect(jsonPath("$.points", hasSize(31)))
                .andExpect(jsonPath("$.points[0].date").value(today().minusDays(30).toString()))
                .andExpect(jsonPath("$.points[0].load").value(120.0))
                .andExpect(jsonPath("$.points[0].fitness").isNumber())
                .andExpect(jsonPath("$.points[0].fatigue").isNumber())
                .andExpect(jsonPath("$.points[0].form").isNumber())
                .andExpect(jsonPath("$.points[30].date").value(today().toString()))
                .andExpect(jsonPath("$.projection", hasSize(14)))
                .andExpect(jsonPath("$.projection[0].date").value(today().plusDays(1).toString()))
                .andExpect(jsonPath("$.current.date").value(today().toString()))
                .andExpect(jsonPath("$.current.fitnessChange7d").isNumber())
                .andExpect(jsonPath("$.sources.HR_ZONES").value(1))
                .andExpect(jsonPath("$.sources.PERCEIVED").value(1))
                .andExpect(jsonPath("$.runs").value(2))
                .andExpect(jsonPath("$.pendingRuns").value(0));
    }

    @Test
    void theDaysOfRacesComeWithTheSeriesForTheScreenToMark() throws Exception {
        Runner owner = runner();
        effort(owner, today().minusDays(12), 100, "HR_ZONES", "RACE");
        effort(owner, today().minusDays(8), 100, "HR_ZONES", "WORKOUT");
        effort(owner, today().minusDays(2), 80, "HR_ZONES");

        mockMvc.perform(get("/api/training/series").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.raceDays", hasSize(1)))
                .andExpect(jsonPath("$.raceDays[0]").value(today().minusDays(12).toString()));
        mockMvc.perform(get("/api/training/series").header("Authorization", bearer(runner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.raceDays", hasSize(0)));
    }

    @Test
    void aWindowAskedForByDateIsReturnedAsAsked() throws Exception {
        Runner owner = runner();
        effort(owner, today().minusDays(30), 120, "HR_ZONES");

        mockMvc.perform(get("/api/training/series")
                        .param("from", today().minusDays(9).toString()).param("to", today().minusDays(5).toString())
                        .header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points", hasSize(5)))
                .andExpect(jsonPath("$.points[0].date").value(today().minusDays(9).toString()))
                .andExpect(jsonPath("$.points[4].date").value(today().minusDays(5).toString()))
                .andExpect(jsonPath("$.projection", hasSize(0)));
    }

    @Test
    void aRunnerWithNothingGetsAnEmptyButValidAnswer() throws Exception {
        Runner owner = runner();

        mockMvc.perform(get("/api/training/series").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("none"))
                .andExpect(jsonPath("$.points", hasSize(0)))
                .andExpect(jsonPath("$.current").doesNotExist());
        mockMvc.perform(get("/api/training/weekly-effort").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks", hasSize(0)))
                .andExpect(jsonPath("$.bandPercent").value(20));
    }

    @Test
    void anotherRunnersDataIsInvisible() throws Exception {
        Runner mine = runner();
        Runner theirs = runner();
        for (int i = 0; i < 20; i++) {
            effort(theirs, today().minusDays(i), 300, "HR_ZONES");
        }

        mockMvc.perform(get("/api/training/series").header("Authorization", bearer(mine)))
                .andExpect(jsonPath("$.status").value("none"))
                .andExpect(jsonPath("$.runs").value(0))
                .andExpect(jsonPath("$.points", hasSize(0)));
        mockMvc.perform(get("/api/training/weekly-effort").header("Authorization", bearer(mine)))
                .andExpect(jsonPath("$.weeks", hasSize(0)));
        mockMvc.perform(get("/api/training/series").header("Authorization", bearer(theirs)))
                .andExpect(jsonPath("$.runs").value(20));
    }

    @Test
    void theWeeklyEffortHasTheShapeTheScreenDraws() throws Exception {
        Runner owner = runner();
        LocalDate thisMonday = today().with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        for (int back = 1; back <= 4; back++) {
            effort(owner, thisMonday.minusWeeks(back), 200, "HR_ZONES");
        }
        effort(owner, thisMonday, 50, "HR_ZONES");

        mockMvc.perform(get("/api/training/weekly-effort").param("weeks", "3").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks", hasSize(3)))
                .andExpect(jsonPath("$.weeks[2].start").value(thisMonday.toString()))
                .andExpect(jsonPath("$.weeks[2].end").value(thisMonday.plusDays(6).toString()))
                .andExpect(jsonPath("$.weeks[2].total").value(50.0))
                .andExpect(jsonPath("$.weeks[2].runs").value(1))
                .andExpect(jsonPath("$.weeks[2].complete").value(false))
                .andExpect(jsonPath("$.weeks[2].range.average").value(200.0))
                .andExpect(jsonPath("$.weeks[2].range.low").value(160.0))
                .andExpect(jsonPath("$.weeks[2].range.high").value(240.0))
                .andExpect(jsonPath("$.weeks[2].status").value("building"))
                .andExpect(jsonPath("$.weeks[1].complete").value(true))
                .andExpect(jsonPath("$.weeks[1].status").value("within"))
                .andExpect(jsonPath("$.bandPercent").value(20))
                .andExpect(jsonPath("$.today").value(today().toString()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"from=yesterday", "to=2026-13-40", "from=2026-10-10&to=2026-10-01", "from=2020-01-01&to=2026-10-10", "from=10/01/2026"})
    void aSeriesWindowThatMakesNoSenseIsRefusedInPlainWords(String query) throws Exception {
        Runner owner = runner();

        mockMvc.perform(get("/api/training/series?" + query).header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RANGE"))
                .andExpect(jsonPath("$.error").isString());
    }

    @ParameterizedTest
    @ValueSource(strings = {"weeks=0", "weeks=53", "weeks=-1", "weeks=many", "weeks=2.5"})
    void aWeekCountThatMakesNoSenseIsRefused(String query) throws Exception {
        Runner owner = runner();

        mockMvc.perform(get("/api/training/weekly-effort?" + query).header("Authorization", bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RANGE"));
    }
}
