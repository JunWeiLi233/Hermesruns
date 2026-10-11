package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.admin.AdminBackgroundJob;
import com.hermes.backend.admin.AdminBackgroundJobRepository;
import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The effort and zone endpoints through the real servlet stack: security, argument binding, JSON in and out.
 * The services behind them are tested directly; this is the part direct calls cannot see.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-endpoints-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class TrainingEndpointsMvcTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private AdminBackgroundJobRepository jobs;

    private Runner runner(String role) {
        Runner runner = new Runner("endpoints-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole(role);
        return runners.saveAndFlush(runner);
    }

    private String bearer(Runner runner) {
        String token = authService.isAdmin(runner)
                ? authService.issueMfaVerifiedAdminSessionToken(runner, "PASSKEY")
                : authService.issueSessionToken(runner);
        return "Bearer " + token;
    }

    private Activity run(Runner owner, int movingSeconds, double km, Double averageHeartRate, Double maxHeartRate, LocalDateTime start) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(start);
        run.setMovingTimeSeconds(movingSeconds);
        run.setDurationSeconds((long) movingSeconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000);
        run.setAverageHeartRate(averageHeartRate);
        run.setMaxHeartRate(maxHeartRate);
        return activities.saveAndFlush(run);
    }

    private Activity run(Runner owner, int movingSeconds, double km, Double averageHeartRate) {
        return run(owner, movingSeconds, km, averageHeartRate, null, LocalDateTime.of(2026, 10, 1, 12, 0));
    }

    private void stream(Activity run, int seconds, int bpm) {
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i < seconds; i++) {
            ActivityPoint point = new ActivityPoint();
            point.setActivity(run);
            point.setSequenceIndex(i);
            point.setLatitude(40.0);
            point.setLongitude(-73.0);
            point.setElapsedSeconds(i);
            point.setHeartRate(bpm);
            points.add(point);
        }
        activityData.savePoints(points);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    // --- GET /api/activities/{id}/training-metrics -------------------------------------------------------------

    @Test
    void metricsNeedASession() throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 600, 2.0, 140.0);

        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", "Bearer nonsense"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void metricsOfARunWithAHeartRateStream() throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140);

        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activityId").value(run.getId()))
                .andExpect(jsonPath("$.effort.score").value(30.0))
                .andExpect(jsonPath("$.effort.source").value("HR_ZONES"))
                .andExpect(jsonPath("$.effort.perceivedExertion").doesNotExist())
                .andExpect(jsonPath("$.heartRate.hasStream").value(true))
                .andExpect(jsonPath("$.heartRate.coveredSeconds").value(600))
                .andExpect(jsonPath("$.heartRate.coveragePercent").value(100))
                .andExpect(jsonPath("$.heartRate.maxHeartRateBpm").value(190))
                .andExpect(jsonPath("$.heartRate.maxHeartRateSource").value("DEFAULT"))
                .andExpect(jsonPath("$.heartRate.boundarySource").value("AUTO"))
                .andExpect(jsonPath("$.heartRate.zones.length()").value(5))
                .andExpect(jsonPath("$.heartRate.zones[0].fromBpm").doesNotExist())
                .andExpect(jsonPath("$.heartRate.zones[0].toBpm").value(113))
                .andExpect(jsonPath("$.heartRate.zones[1].fromBpm").value(114))
                .andExpect(jsonPath("$.heartRate.zones[1].toBpm").value(132))
                .andExpect(jsonPath("$.heartRate.zones[2].seconds").value(600))
                .andExpect(jsonPath("$.heartRate.zones[2].percent").value(100.0))
                .andExpect(jsonPath("$.heartRate.zones[4].fromBpm").value(171))
                .andExpect(jsonPath("$.heartRate.zones[4].toBpm").doesNotExist())
                .andExpect(jsonPath("$.localDate").value("2026-10-01"));
    }

    @Test
    void metricsOfARunWithoutAStreamSayThereIsNoBreakdown() throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 3600, 10.0, 140.0);

        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effort.source").value("HR_AVERAGE"))
                .andExpect(jsonPath("$.effort.score").value(180.0))
                .andExpect(jsonPath("$.heartRate.hasStream").value(false))
                .andExpect(jsonPath("$.heartRate.averageHeartRate").value(140.0))
                .andExpect(jsonPath("$.heartRate.coveredSeconds").value(0))
                .andExpect(jsonPath("$.heartRate.coveragePercent").doesNotExist())
                .andExpect(jsonPath("$.heartRate.zones[2].seconds").value(0));
    }

    @Test
    void anotherRunnersRunAndAMissingRunAreBothNotFound() throws Exception {
        Runner owner = runner("USER");
        Runner stranger = runner("USER");
        Activity run = run(owner, 600, 2.0, 140.0);

        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/activities/{id}/training-metrics", -5).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).as("nothing was computed for the refused request").isEmpty();
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), stranger.getId())).isEmpty();
    }

    // --- GET and PUT /api/training/zones ------------------------------------------------------------------------

    @Test
    void zonesNeedASession() throws Exception {
        mockMvc.perform(get("/api/training/zones")).andExpect(status().isUnauthorized());
        mockMvc.perform(json(put("/api/training/zones"), "{\"maxHeartRateBpm\":180}")).andExpect(status().isUnauthorized());
    }

    @Test
    void aRunnerWhoSetNothingGetsTheDefaults() throws Exception {
        Runner owner = runner("USER");

        mockMvc.perform(get("/api/training/zones").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxHeartRate.bpm").value(190))
                .andExpect(jsonPath("$.maxHeartRate.source").value("DEFAULT"))
                .andExpect(jsonPath("$.heartRate.source").value("AUTO"))
                .andExpect(jsonPath("$.heartRate.boundaries[0]").value(114))
                .andExpect(jsonPath("$.heartRate.boundaries[3]").value(171))
                .andExpect(jsonPath("$.heartRate.defaultBoundaries[1]").value(133))
                .andExpect(jsonPath("$.heartRate.zones.length()").value(5))
                .andExpect(jsonPath("$.heartRate.zones[0].fromBpm").doesNotExist())
                .andExpect(jsonPath("$.heartRate.zones[4].toBpm").doesNotExist())
                .andExpect(jsonPath("$.suggestedMaxHeartRate").doesNotExist())
                .andExpect(jsonPath("$.recomputeQueued").doesNotExist())
                .andExpect(jsonPath("$.limits.minMaxHeartRate").value(120))
                .andExpect(jsonPath("$.limits.maxMaxHeartRate").value(230))
                .andExpect(jsonPath("$.limits.defaultMaxHeartRate").value(190));
    }

    @Test
    void settingTheMaxHeartRateMovesTheZonesAndQueuesARecompute() throws Exception {
        Runner owner = runner("USER");
        String auth = bearer(owner); // once: issuing a token saves the test's copy of the runner, which has no max heart rate yet

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), "{\"maxHeartRateBpm\":180}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxHeartRate.bpm").value(180))
                .andExpect(jsonPath("$.maxHeartRate.source").value("PROFILE"))
                .andExpect(jsonPath("$.heartRate.boundaries[0]").value(108))
                .andExpect(jsonPath("$.heartRate.boundaries[3]").value(162))
                .andExpect(jsonPath("$.recomputeQueued").value(true));
        assertThat(runners.findById(owner.getId()).orElseThrow().getMaxHeartRateBpm())
                .as("the same field the coach reads").isEqualTo(180);

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), "{\"maxHeartRateBpm\":180}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recomputeQueued").value(false));
    }

    @Test
    void ownBoundariesReplaceTheAutomaticOnesUntilReset() throws Exception {
        Runner owner = runner("USER");
        String auth = bearer(owner);

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), "{\"heartRateBoundaries\":[110,130,150,170]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.heartRate.source").value("MANUAL"))
                .andExpect(jsonPath("$.heartRate.boundaries[0]").value(110))
                .andExpect(jsonPath("$.heartRate.defaultBoundaries[0]").value(114))
                .andExpect(jsonPath("$.recomputeQueued").value(true));
        mockMvc.perform(get("/api/training/zones").header("Authorization", auth))
                .andExpect(jsonPath("$.heartRate.source").value("MANUAL"))
                .andExpect(jsonPath("$.heartRate.zones[1].fromBpm").value(110));

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), "{\"resetHeartRateBoundaries\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.heartRate.source").value("AUTO"))
                .andExpect(jsonPath("$.heartRate.boundaries[0]").value(114))
                .andExpect(jsonPath("$.recomputeQueued").value(true));
    }

    @Test
    void goingBackToTheDefaultMaxHeartRate() throws Exception {
        Runner owner = runner("USER");
        String auth = bearer(owner);
        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), "{\"maxHeartRateBpm\":170}")).andExpect(status().isOk());

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), "{\"clearMaxHeartRate\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxHeartRate.bpm").value(190))
                .andExpect(jsonPath("$.maxHeartRate.source").value("DEFAULT"));
        assertThat(runners.findById(owner.getId()).orElseThrow().getMaxHeartRateBpm()).isNull();
    }

    @Test
    void anEmptyChangeChangesNothing() throws Exception {
        Runner owner = runner("USER");

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", bearer(owner)), "{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxHeartRate.source").value("DEFAULT"))
                .andExpect(jsonPath("$.recomputeQueued").value(false));
        mockMvc.perform(put("/api/training/zones").header("Authorization", bearer(owner)))
                .andExpect(status().isOk());
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "max too low|{\"maxHeartRateBpm\":119}|between 120 and 230",
            "max too high|{\"maxHeartRateBpm\":231}|between 120 and 230",
            "too few boundaries|{\"heartRateBoundaries\":[110,130,150]}|exactly 4",
            "too many boundaries|{\"heartRateBoundaries\":[110,130,150,170,190]}|exactly 4",
            "boundaries that do not increase|{\"heartRateBoundaries\":[110,130,130,170]}|must increase",
            "boundaries in the wrong order|{\"heartRateBoundaries\":[170,150,130,110]}|must increase",
            "a boundary above 230|{\"heartRateBoundaries\":[110,130,150,231]}|between 40 and 230",
            "a boundary below 40|{\"heartRateBoundaries\":[39,130,150,170]}|between 40 and 230",
            "a missing boundary|{\"heartRateBoundaries\":[110,null,150,170]}|whole number",
            "a fractional max|{\"maxHeartRateBpm\":180.9}|whole number",
            "a fractional boundary|{\"heartRateBoundaries\":[110.5,130,150,170]}|whole number",
            "a max too big for any number of beats|{\"maxHeartRateBpm\":1e30}|between 120 and 230",
            "a max and a clear together|{\"maxHeartRateBpm\":180,\"clearMaxHeartRate\":true}|not both",
            "boundaries and a reset together|{\"heartRateBoundaries\":[110,130,150,170],\"resetHeartRateBoundaries\":true}|not both"
    })
    void refusedChangesExplainThemselvesAndChangeNothing(String name, String body, String expectedMessage) throws Exception {
        Runner owner = runner("USER");
        owner.setMaxHeartRateBpm(175);
        runners.saveAndFlush(owner);
        String auth = bearer(owner);

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ZONES"))
                .andExpect(jsonPath("$.error").value(containsString(expectedMessage)));

        mockMvc.perform(get("/api/training/zones").header("Authorization", auth))
                .andExpect(jsonPath("$.maxHeartRate.bpm").value(175))
                .andExpect(jsonPath("$.heartRate.source").value("AUTO"));
    }

    @Test
    void zonesBelongToTheRunnerWhoSetThem() throws Exception {
        Runner first = runner("USER");
        Runner second = runner("USER");

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", bearer(first)), "{\"maxHeartRateBpm\":170}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/training/zones").header("Authorization", bearer(second)))
                .andExpect(jsonPath("$.maxHeartRate.bpm").value(190))
                .andExpect(jsonPath("$.maxHeartRate.source").value("DEFAULT"));
    }

    @Test
    void theRunnersOwnRunsSuggestAMaxHeartRateOnceThereAreEnoughOfThem() throws Exception {
        Runner few = runner("USER");
        Runner many = runner("USER");
        LocalDateTime recently = LocalDateTime.now().minusDays(3);
        for (int i = 0; i < 19; i++) {
            run(few, 600, 2.0, 150.0, 185.0, recently.minusDays(i));
        }
        for (int i = 0; i < 20; i++) {
            run(many, 600, 2.0, 150.0, 185.0, recently.minusDays(i));
        }

        mockMvc.perform(get("/api/training/zones").header("Authorization", bearer(few)))
                .andExpect(jsonPath("$.suggestedMaxHeartRate").doesNotExist());
        mockMvc.perform(get("/api/training/zones").header("Authorization", bearer(many)))
                .andExpect(jsonPath("$.suggestedMaxHeartRate.bpm").value(185))
                .andExpect(jsonPath("$.suggestedMaxHeartRate.basedOnRuns").value(20))
                .andExpect(jsonPath("$.maxHeartRate.source").value("DEFAULT"));
    }

    @Test
    void changingTheZonesIsSeenOnTheRunsNextRead() throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140);
        String auth = bearer(owner);
        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", auth))
                .andExpect(jsonPath("$.heartRate.zones[2].seconds").value(600));

        mockMvc.perform(json(put("/api/training/zones").header("Authorization", auth), "{\"maxHeartRateBpm\":170}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", auth))
                .andExpect(jsonPath("$.heartRate.maxHeartRateBpm").value(170))
                .andExpect(jsonPath("$.heartRate.maxHeartRateSource").value("PROFILE"))
                .andExpect(jsonPath("$.heartRate.zones[3].seconds").value(600))
                .andExpect(jsonPath("$.heartRate.zones[2].seconds").value(0))
                .andExpect(jsonPath("$.effort.score").value(40.0));
    }

    @Test
    void theCoachsProfileEndpointMovesTheZonesToo() throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140);
        String auth = bearer(owner);
        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", auth))
                .andExpect(jsonPath("$.heartRate.zones[2].seconds").value(600));

        mockMvc.perform(json(patch("/api/coach/profile").header("Authorization", auth), "{\"maxHeartRateBpm\":170}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", auth))
                .andExpect(jsonPath("$.heartRate.zones[3].seconds").value(600));
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId()).orElseThrow().getMaxHrUsed())
                .as("recomputed by the zones-changed event, not only on read").isEqualTo(170);
    }

    // --- PATCH /api/activities/{id} --------------------------------------------------------------------------------

    @Test
    void ratingARunChangesItsEffortAndClearingTheRatingTakesItBack() throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 3600, 10.0, null);
        String auth = bearer(owner);
        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", auth))
                .andExpect(jsonPath("$.effort.source").value("PACE_MODEL"));

        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()).header("Authorization", auth), "{\"perceivedExertion\":10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(run.getId()))
                .andExpect(jsonPath("$.perceivedExertion").value(10));
        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", auth))
                .andExpect(jsonPath("$.effort.source").value("PERCEIVED"))
                .andExpect(jsonPath("$.effort.score").value(300.0))
                .andExpect(jsonPath("$.effort.perceivedExertion").value(10));

        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()).header("Authorization", auth), "{\"perceivedExertion\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perceivedExertion").doesNotExist());
        mockMvc.perform(get("/api/activities/{id}/training-metrics", run.getId()).header("Authorization", auth))
                .andExpect(jsonPath("$.effort.source").value("PACE_MODEL"))
                .andExpect(jsonPath("$.effort.perceivedExertion").doesNotExist());
        assertThat(activities.findById(run.getId()).orElseThrow().getPerceivedExertion()).isNull();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "zero|{\"perceivedExertion\":0}",
            "eleven|{\"perceivedExertion\":11}",
            "negative|{\"perceivedExertion\":-3}",
            "a fraction|{\"perceivedExertion\":5.5}",
            "a word|{\"perceivedExertion\":\"high\"}",
            "a boolean|{\"perceivedExertion\":true}",
            "a list|{\"perceivedExertion\":[7]}"
    })
    void aRatingThatIsNotAWholeNumberFromOneToTenIsRefused(String name, String body) throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 3600, 10.0, null);
        run.setPerceivedExertion(4);
        activities.saveAndFlush(run);

        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()).header("Authorization", bearer(owner)), body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PERCEIVED_EXERTION"));
        assertThat(activities.findById(run.getId()).orElseThrow().getPerceivedExertion()).as("unchanged").isEqualTo(4);
    }

    @Test
    void fieldsThatCannotBeEditedAreRefusedNotIgnored() throws Exception {
        Runner owner = runner("USER");
        Activity run = run(owner, 600, 2.0, 140.0);
        String auth = bearer(owner);

        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()).header("Authorization", auth), "{\"name\":\"renamed\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FIELD"));
        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()).header("Authorization", auth), "{\"perceivedExertion\":5,\"distanceKm\":99}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FIELD"));
        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()).header("Authorization", auth), "{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NOTHING_TO_CHANGE"));
        mockMvc.perform(patch("/api/activities/{id}", run.getId()).header("Authorization", auth))
                .andExpect(status().isBadRequest());
        Activity unchanged = activities.findById(run.getId()).orElseThrow();
        assertThat(unchanged.getPerceivedExertion()).isNull();
        assertThat(unchanged.getDistanceKm()).isEqualTo(2.0);
    }

    @Test
    void ratingNeedsASessionAndYourOwnRun() throws Exception {
        Runner owner = runner("USER");
        Runner stranger = runner("USER");
        Activity run = run(owner, 600, 2.0, 140.0);

        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()), "{\"perceivedExertion\":5}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(json(patch("/api/activities/{id}", run.getId()).header("Authorization", bearer(stranger)), "{\"perceivedExertion\":5}"))
                .andExpect(status().isNotFound());
        assertThat(activities.findById(run.getId()).orElseThrow().getPerceivedExertion()).isNull();
    }

    // --- POST /api/admin/jobs/training-metrics-recompute ---------------------------------------------------------------

    @Test
    void theRecomputeJobIsForAdministratorsOnly() throws Exception {
        Runner user = runner("USER");

        mockMvc.perform(json(post("/api/admin/jobs/training-metrics-recompute").header("Authorization", bearer(user)), "{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(json(post("/api/admin/jobs/training-metrics-recompute"), "{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void anAdministratorCanRecomputeOneRunnersHistoryAsAJob() throws Exception {
        Runner admin = runner("ADMIN");
        Runner owner = runner("USER");
        Activity run = run(owner, 600, 2.0, 140.0);
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).isEmpty();

        String response = mockMvc.perform(json(post("/api/admin/jobs/training-metrics-recompute").header("Authorization", bearer(admin)),
                        "{\"runnerId\":" + owner.getId() + "}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").exists())
                .andExpect(jsonPath("$.runners").value(1))
                .andReturn().getResponse().getContentAsString();
        long jobId = Long.parseLong(response.replaceAll(".*\"jobId\":(\\d+).*", "$1"));

        AdminBackgroundJob job = null;
        for (int i = 0; i < 100; i++) {
            job = jobs.findById(jobId).orElseThrow();
            if (AdminBackgroundJob.STATUS_COMPLETED.equals(job.getStatus()) || AdminBackgroundJob.STATUS_FAILED.equals(job.getStatus())) {
                break;
            }
            Thread.sleep(100);
        }
        assertThat(job.getStatus()).isEqualTo(AdminBackgroundJob.STATUS_COMPLETED);
        assertThat(job.getJobType()).isEqualTo("TRAINING_METRICS_RECOMPUTE");
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).isPresent();
    }

    @Test
    void theRecomputeJobRefusesARunnerThatDoesNotExist() throws Exception {
        Runner admin = runner("ADMIN");

        mockMvc.perform(json(post("/api/admin/jobs/training-metrics-recompute").header("Authorization", bearer(admin)), "{\"runnerId\":-7}"))
                .andExpect(status().isNotFound());
    }
}
