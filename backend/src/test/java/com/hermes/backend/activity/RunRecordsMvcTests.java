package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The records endpoints through the real servlet stack: security, ownership, validation, JSON out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:run-records-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class RunRecordsMvcTests {

    private static final double METERS_PER_DEGREE = 6_371_000.0 * Math.PI / 180.0;
    private static final double FIVE_MINUTES_PER_KM = 1000.0 / 300.0;

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;

    private Runner runner() {
        Runner runner = new Runner("records-mvc-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole("USER");
        return runners.saveAndFlush(runner);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private Activity run(Runner owner, LocalDateTime start, double km, int seconds) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(start);
        run.setMovingTimeSeconds(seconds);
        run.setDurationSeconds((long) seconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000);
        Activity saved = activities.saveAndFlush(run);
        List<ActivityPoint> points = new ArrayList<>();
        double speed = km * 1000.0 / seconds;
        for (int i = 0; i <= seconds; i++) {
            ActivityPoint point = new ActivityPoint();
            point.setActivity(saved);
            point.setSequenceIndex(i);
            point.setLatitude(40.0 + i * speed / METERS_PER_DEGREE);
            point.setLongitude(-73.0);
            point.setElapsedSeconds(i);
            point.setDistanceMeters(i * speed);
            points.add(point);
        }
        activityData.savePoints(points);
        return saved;
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder request, String token) {
        return request.header("Authorization", token);
    }

    // ----- who may call -----

    @Test
    void everyRecordsRouteNeedsASession() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 7, 0), 6.0, 1800);

        for (MockHttpServletRequestBuilder request : List.of(
                get("/api/activities/{id}/best-efforts", run.getId()),
                patch("/api/activities/{id}/best-efforts/5km", run.getId()).contentType(MediaType.APPLICATION_JSON).content("{\"hidden\":true}"),
                get("/api/activities/{id}/matches", run.getId()),
                get("/api/training/best-efforts"))) {
            mockMvc.perform(request).andExpect(status().isUnauthorized());
            mockMvc.perform(withToken(request, "Bearer nonsense")).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void aRunnerCannotSeeOrChangeSomeoneElsesRunAndGetsTheSameAnswerAsForARunThatDoesNotExist() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 7, 0), 6.0, 1800);
        long missing = run.getId() + 1000;

        for (long id : new long[] {run.getId(), missing}) {
            mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", id), bearer(stranger)))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
            mockMvc.perform(withToken(get("/api/activities/{id}/matches", id), bearer(stranger)))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
            mockMvc.perform(withToken(patch("/api/activities/{id}/best-efforts/5km", id), bearer(stranger))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"elapsedSeconds\":1400}"))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        }
        mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", run.getId()), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].edited").value(false));
    }

    // ----- the profile's records -----

    @Test
    void thePersonalRecordsAreCompleteForRunsNobodyHasAnalysedYet() throws Exception {
        Runner owner = runner();
        run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1860); // 5:10 /km, saved straight into the database
        run(owner, LocalDateTime.of(2026, 10, 1, 7, 0), 6.0, 1800); // 5:00 /km

        mockMvc.perform(withToken(get("/api/profile/personal-records"), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.records['5km'].elapsedSeconds").value(1500))
                .andExpect(jsonPath("$.records['5km'].derivedFromSegment").value(true))
                .andExpect(jsonPath("$.records['1km'].elapsedSeconds").value(300));
    }

    // ----- a run's best efforts -----

    @Test
    void theBestEffortsOfARunAreWorkedOutWhenTheyAreFirstReadAndRankedAgainstTheRest() throws Exception {
        Runner owner = runner();
        Activity first = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1860); // 5:10 /km
        Activity second = run(owner, LocalDateTime.of(2026, 10, 1, 7, 0), 6.0, 1800); // 5:00 /km

        mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", second.getId()), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.complete").value(true))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].elapsedSeconds", contains(closeTo(1500.0, 0.2))))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].rank").value(1))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].estimated").value(false))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].distanceMeters").value(5000.0))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].paceSecPerKm", contains(closeTo(300.0, 0.1))))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].startOffsetSeconds").isNotEmpty())
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='10km')]").isEmpty());
        mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", first.getId()), bearer(owner)))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].rank").value(2));
    }

    @Test
    void aRunWithNoStreamHasEstimatedEffortsAndSaysSo() throws Exception {
        Runner owner = runner();
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("no stream");
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 7, 0));
        run.setMovingTimeSeconds(1560);
        run.setDistanceKm(5.2);
        run.setDistanceMeters(5200.0);
        Activity saved = activities.saveAndFlush(run);

        mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", saved.getId()), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].estimated").value(true))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].startOffsetSeconds", contains(nullValue())));
    }

    // ----- what the runner may change -----

    @Test
    void aTypedChipTimeIsSavedTakenBackAndTheEffortCanBeHiddenAndShown() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 7, 0), 6.0, 1800);
        String token = bearer(owner);
        mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", run.getId()), token)).andExpect(status().isOk());

        mockMvc.perform(withToken(patch("/api/activities/{id}/best-efforts/5km", run.getId()), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"elapsedSeconds\":1490}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.edited").value(true))
                .andExpect(jsonPath("$.effectiveSeconds").value(1490.0))
                .andExpect(jsonPath("$.elapsedSeconds", closeTo(1500.0, 0.2)))
                .andExpect(jsonPath("$.rank").value(1));
        mockMvc.perform(withToken(patch("/api/activities/{id}/best-efforts/5km", run.getId()), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"hidden\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hidden").value(true))
                .andExpect(jsonPath("$.edited").value(true))
                .andExpect(jsonPath("$.rank").doesNotExist());
        mockMvc.perform(withToken(patch("/api/activities/{id}/best-efforts/5km", run.getId()), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"hidden\":false,\"elapsedSeconds\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hidden").value(false))
                .andExpect(jsonPath("$.edited").value(false))
                .andExpect(jsonPath("$.effectiveSeconds", closeTo(1500.0, 0.2)))
                .andExpect(jsonPath("$.rank").value(1));
    }

    @Test
    void aChangeThatMakesNoSenseIsRefusedWithWhy() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 7, 0), 6.0, 1800);
        String token = bearer(owner);
        mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", run.getId()), token)).andExpect(status().isOk());

        String[][] cases = {
                {"{}", "NOTHING_TO_CHANGE"},
                {"{\"pace\":300}", "UNSUPPORTED_FIELD"},
                {"{\"elapsedSeconds\":\"fast\"}", "INVALID_ELAPSED_SECONDS"},
                {"{\"elapsedSeconds\":1490.5}", "INVALID_ELAPSED_SECONDS"},
                {"{\"elapsedSeconds\":0}", "INVALID_ELAPSED_SECONDS"},
                {"{\"elapsedSeconds\":100}", "IMPLAUSIBLE_TIME"},
                {"{\"elapsedSeconds\":90000}", "IMPLAUSIBLE_TIME"},
                {"{\"hidden\":\"yes\"}", "INVALID_HIDDEN"},
        };
        for (String[] each : cases) {
            mockMvc.perform(withToken(patch("/api/activities/{id}/best-efforts/5km", run.getId()), token)
                            .contentType(MediaType.APPLICATION_JSON).content(each[0]))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value(each[1]));
        }
        mockMvc.perform(withToken(patch("/api/activities/{id}/best-efforts/10km", run.getId()), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"elapsedSeconds\":3000}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(withToken(get("/api/activities/{id}/best-efforts", run.getId()), token))
                .andExpect(jsonPath("$.efforts[?(@.distanceKey=='5km')].edited").value(false));
    }

    // ----- same-route runs -----

    @Test
    void theRunsOverTheSameRouteAreListedOldestFirstWithTheFastestAndTheCurrentOneMarked() throws Exception {
        Runner owner = runner();
        Activity one = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        Activity two = run(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 6.0, 1740);
        Activity three = run(owner, LocalDateTime.of(2026, 9, 15, 7, 0), 6.0, 1860);

        mockMvc.perform(withToken(get("/api/activities/{id}/matches", three.getId()), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.complete").value(true))
                .andExpect(jsonPath("$.count").value(3))
                .andExpect(jsonPath("$.loop").value(false))
                .andExpect(jsonPath("$.runs", hasSize(3)))
                .andExpect(jsonPath("$.runs[0].activityId").value(one.getId()))
                .andExpect(jsonPath("$.runs[1].activityId").value(two.getId()))
                .andExpect(jsonPath("$.runs[1].fastest").value(true))
                .andExpect(jsonPath("$.runs[1].paceSecPerKm", closeTo(290.0, 0.1)))
                .andExpect(jsonPath("$.runs[2].current").value(true))
                .andExpect(jsonPath("$.runs[2].year").value(2026));
    }

    @Test
    void aRunNobodyElseRanHasNoRunsToCompareWith() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);

        mockMvc.perform(withToken(get("/api/activities/{id}/matches", run.getId()), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.runs", hasSize(0)));
    }

    // ----- the analysis -----

    @Test
    void theAnalysisGivesTheBestEverAndTheBestOfTheYear() throws Exception {
        Runner owner = runner();
        run(owner, LocalDateTime.of(2025, 5, 1, 7, 0), 6.0, 1800);
        run(owner, LocalDateTime.of(2026, 5, 1, 7, 0), 6.0, 1740);
        run(owner, LocalDateTime.of(2026, 6, 1, 7, 0), 6.0, 1680);

        mockMvc.perform(withToken(get("/api/training/best-efforts").param("distance", "5km"), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.complete").value(true))
                .andExpect(jsonPath("$.key").value("5km"))
                .andExpect(jsonPath("$.meters").value(5000.0))
                .andExpect(jsonPath("$.years", contains(2025, 2026)))
                .andExpect(jsonPath("$.year").value(2026))
                .andExpect(jsonPath("$.lifetime", hasSize(3)))
                .andExpect(jsonPath("$.lifetime[0].effectiveSeconds", closeTo(1400.0, 0.5)))
                .andExpect(jsonPath("$.lifetime[0].rank").value(1))
                .andExpect(jsonPath("$.annual", hasSize(2)))
                .andExpect(jsonPath("$.trend", hasSize(2)))
                .andExpect(jsonPath("$.distances[?(@.key=='5km')].count").value(3));
        mockMvc.perform(withToken(get("/api/training/best-efforts").param("distance", "5km").param("year", "2025"), bearer(owner)))
                .andExpect(jsonPath("$.annual", hasSize(1)))
                .andExpect(jsonPath("$.annual[0].effectiveSeconds", closeTo(1500.0, 0.5)));
    }

    @Test
    void anUnknownDistanceIsRefusedAndARunnerWithNoEffortsGetsAnEmptyAnswer() throws Exception {
        Runner owner = runner();

        mockMvc.perform(withToken(get("/api/training/best-efforts").param("distance", "7km"), bearer(owner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARAM"));
        mockMvc.perform(withToken(get("/api/training/best-efforts"), bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distances", hasSize(0)))
                .andExpect(jsonPath("$.key").doesNotExist())
                .andExpect(jsonPath("$.lifetime", hasSize(0)));
    }

    @Test
    void theAnalysisOnlyEverShowsTheCallersOwnEfforts() throws Exception {
        Runner owner = runner();
        Runner stranger = runner();
        run(owner, LocalDateTime.of(2026, 5, 1, 7, 0), 6.0, 1800);
        run(stranger, LocalDateTime.of(2026, 5, 1, 7, 0), 6.0, 1500);

        mockMvc.perform(withToken(get("/api/training/best-efforts").param("distance", "5km"), bearer(owner)))
                .andExpect(jsonPath("$.lifetime", hasSize(1)))
                .andExpect(jsonPath("$.lifetime[0].effectiveSeconds", closeTo(1500.0, 0.5)));
    }
}
