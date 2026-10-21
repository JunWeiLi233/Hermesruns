package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
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

import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The pace curve endpoint through the real servlet stack: security, argument handling, JSON in and out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pace-curve-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class PaceCurveMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityBestEffortRepository efforts;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("pace-curve-mvc-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    /** Runners here have no time zone, so their today is the UTC day. */
    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    /** An effort in a run the records have already looked at, so reading the curve leaves it be. */
    private void effort(Runner owner, LocalDate day, String key, double seconds) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, LocalTime.NOON));
        run.setMovingTimeSeconds(1800);
        run.setDistanceKm(5.0);
        run.setRecordsVersion(BestEffortService.MODEL_VERSION);
        run = activities.saveAndFlush(run);
        ActivityBestEffort row = new ActivityBestEffort(run, owner, key, BestEffortDistances.byKey(key).orElseThrow().meters());
        row.setMeasured(seconds, 0, (int) seconds, false, day, BestEffortService.MODEL_VERSION);
        efforts.saveAndFlush(row);
    }

    @Test
    void theEndpointNeedsASession() throws Exception {
        mockMvc.perform(get("/api/training/pace-curve")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/training/pace-curve").header("Authorization", "Bearer nonsense")).andExpect(status().isUnauthorized());
    }

    @Test
    void theCurveOfARunnerWithEffortsHasTheShapeTheScreenDraws() throws Exception {
        Runner owner = runner();
        for (String key : new String[] {"1km", "1mile", "3km", "5km"}) {
            double meters = BestEffortDistances.byKey(key).orElseThrow().meters();
            effort(owner, today().minusDays(10), key, (meters - 200.0) / 4.0);
        }

        mockMvc.perform(get("/api/training/pace-curve").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value(today().toString()))
                .andExpect(jsonPath("$.timeZone").value("Z"))
                .andExpect(jsonPath("$.days").value(180))
                .andExpect(jsonPath("$.from").value(today().minusDays(179).toString()))
                .andExpect(jsonPath("$.to").value(today().toString()))
                .andExpect(jsonPath("$.complete").value(true))
                .andExpect(jsonPath("$.points", hasSize(4)))
                .andExpect(jsonPath("$.points[*].key", contains("1km", "1mile", "3km", "5km")))
                .andExpect(jsonPath("$.points[0].seconds").value(200.0))
                .andExpect(jsonPath("$.points[0].paceSecondsPerKm").value(200.0))
                .andExpect(jsonPath("$.points[0].date").value(today().minusDays(10).toString()))
                .andExpect(jsonPath("$.points[0].activityId").isNumber())
                .andExpect(jsonPath("$.points[0].inModel").value(true))
                .andExpect(jsonPath("$.model.status").value("ok"))
                .andExpect(jsonPath("$.model.criticalSpeedMps").value(closeTo(4.0, 0.001)))
                .andExpect(jsonPath("$.model.criticalPaceSecondsPerKm").value(closeTo(250.0, 0.1)))
                .andExpect(jsonPath("$.model.dPrimeMeters").value(closeTo(200.0, 0.5)))
                .andExpect(jsonPath("$.model.pointsUsed").value(4))
                .andExpect(jsonPath("$.limits.minSeconds").value(180))
                .andExpect(jsonPath("$.limits.maxSeconds").value(2400))
                .andExpect(jsonPath("$.limits.minPoints").value(3));
    }

    @Test
    void allTimeAndAShorterWindowAreAskedForByDays() throws Exception {
        Runner owner = runner();
        effort(owner, today().minusDays(200), "5km", 1200);
        effort(owner, today().minusDays(5), "5km", 1300);

        mockMvc.perform(get("/api/training/pace-curve").param("days", "all").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").doesNotExist())
                .andExpect(jsonPath("$.from").doesNotExist())
                .andExpect(jsonPath("$.points[0].seconds").value(1200.0));
        mockMvc.perform(get("/api/training/pace-curve").param("days", "30").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days").value(30))
                .andExpect(jsonPath("$.from").value(today().minusDays(29).toString()))
                .andExpect(jsonPath("$.points[0].seconds").value(1300.0));
    }

    @Test
    void aRunnerWithNothingGetsAnEmptyButValidAnswer() throws Exception {
        mockMvc.perform(get("/api/training/pace-curve").header("Authorization", bearer(runner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.points", hasSize(0)))
                .andExpect(jsonPath("$.model.status").value("too_few_points"))
                .andExpect(jsonPath("$.model.criticalSpeedMps").doesNotExist());
    }

    @Test
    void anotherRunnersEffortsAreInvisible() throws Exception {
        Runner mine = runner();
        Runner theirs = runner();
        effort(theirs, today().minusDays(2), "5km", 1000);

        mockMvc.perform(get("/api/training/pace-curve").header("Authorization", bearer(mine)))
                .andExpect(jsonPath("$.points", hasSize(0)));
        mockMvc.perform(get("/api/training/pace-curve").header("Authorization", bearer(theirs)))
                .andExpect(jsonPath("$.points", hasSize(1)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"days=0", "days=3661", "days=-5", "days=many", "days=2.5", "days=all-time"})
    void aWindowThatMakesNoSenseIsRefusedInPlainWords(String query) throws Exception {
        mockMvc.perform(get("/api/training/pace-curve?" + query).header("Authorization", bearer(runner())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RANGE"))
                .andExpect(jsonPath("$.error").isString());
    }
}
