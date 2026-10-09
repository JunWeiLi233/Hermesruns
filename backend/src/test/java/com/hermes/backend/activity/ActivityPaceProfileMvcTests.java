package com.hermes.backend.activity;

import com.hermes.backend.auth.AuthService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.IntPredicate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThan;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The pace-profile endpoint through the real servlet stack: security, ownership, JSON out. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pace-profile-mvc;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
@AutoConfigureMockMvc
class ActivityPaceProfileMvcTests {

    /** A degree of latitude along a meridian, in metres, as the haversine formula in the analytics helper sees it. */
    private static final double METERS_PER_DEGREE = 6_371_000.0 * Math.PI / 180.0;

    @Autowired private MockMvc mockMvc;
    @Autowired private AuthService authService;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;

    private Runner runner() {
        Runner runner = new Runner("pace-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole("USER");
        return runners.saveAndFlush(runner);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private Activity run(Runner owner, int seconds) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 12, 0));
        run.setMovingTimeSeconds(seconds);
        run.setDurationSeconds((long) seconds);
        return activities.saveAndFlush(run);
    }

    /**
     * A stream with one reading a second. {@code withDistance} stores the distance of each point; without it the
     * distance has to be worked out from the positions, as it does for a GPX file. A pause stands still for 60 s
     * after 400 s.
     */
    private void stream(Activity run, int seconds, double speed, double slope, boolean withDistance, boolean withElevation,
                        boolean pause) {
        stream(run, seconds, speed, slope, withDistance, withElevation, pause, i -> true);
    }

    /** {@code hasTime} says which points (by index) store the time they were recorded. */
    private void stream(Activity run, int seconds, double speed, double slope, boolean withDistance, boolean withElevation,
                        boolean pause, IntPredicate hasTime) {
        List<ActivityPoint> points = new ArrayList<>();
        double distance = 0;
        double elevation = 100;
        for (int i = 0; i <= seconds; i++) {
            boolean standing = pause && i > 400 && i <= 460;
            if (i > 0 && !standing) {
                distance += speed;
                elevation += speed * slope;
            }
            ActivityPoint point = new ActivityPoint();
            point.setActivity(run);
            point.setSequenceIndex(i);
            point.setLatitude(40.0 + distance / METERS_PER_DEGREE);
            point.setLongitude(-73.0);
            if (hasTime.test(i)) {
                point.setElapsedSeconds(i);
            }
            if (withDistance) {
                point.setDistanceMeters(distance);
            }
            if (withElevation) {
                point.setElevationMeters(elevation);
                point.setElevationRawMeters(elevation);
            }
            points.add(point);
        }
        activityData.savePoints(points);
    }

    @Test
    void theProfileNeedsASession() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 600);
        stream(run, 600, 1000.0 / 300, 0, true, true, false);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", "Bearer nonsense"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aRunnerCannotSeeSomeoneElsesRunAndGetsTheSameAnswerAsForARunThatDoesNotExist() throws Exception {
        Runner owner = runner();
        Runner other = runner();
        Activity run = run(owner, 600);
        stream(run, 600, 1000.0 / 300, 0, true, true, false);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId() + 1000).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void aRunWithoutAStreamHasNothingToShowButIsNotAnError() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 1800);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasStream").value(false))
                .andExpect(jsonPath("$.hasElevation").value(false))
                .andExpect(jsonPath("$.splits", hasSize(0)))
                .andExpect(jsonPath("$.summary").doesNotExist())
                .andExpect(jsonPath("$.markers").doesNotExist())
                .andExpect(jsonPath("$.smoothed").doesNotExist());
    }

    @Test
    void theSplitsSummaryAndSmoothedPaceOfAFlatRun() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 1020);
        stream(run, 1020, 1000.0 / 300, 0, true, true, false);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasStream").value(true))
                .andExpect(jsonPath("$.hasElevation").value(true))
                .andExpect(jsonPath("$.summary.distanceMeters", closeTo(3400.0, 1.0)))
                .andExpect(jsonPath("$.summary.elapsedSeconds").value(1020.0))
                .andExpect(jsonPath("$.summary.stoppedSeconds").value(0.0))
                .andExpect(jsonPath("$.summary.paceSecPerKm", closeTo(300.0, 0.5)))
                .andExpect(jsonPath("$.summary.gapSecPerKm", closeTo(300.0, 1.0)))
                .andExpect(jsonPath("$.splits", hasSize(4)))
                .andExpect(jsonPath("$.splits[0].index").value(1))
                .andExpect(jsonPath("$.splits[0].partial").value(false))
                .andExpect(jsonPath("$.splits[0].distanceMeters").value(1000.0))
                .andExpect(jsonPath("$.splits[0].paceSecPerKm", closeTo(300.0, 0.5)))
                .andExpect(jsonPath("$.splits[3].partial").value(true))
                .andExpect(jsonPath("$.splits[3].distanceMeters", closeTo(400.0, 1.0)))
                // Every split is the same pace, so there is no fastest or slowest.
                .andExpect(jsonPath("$.markers").doesNotExist())
                .andExpect(jsonPath("$.smoothed.stepSeconds").value(5))
                .andExpect(jsonPath("$.smoothed.windowSeconds").value(30))
                .andExpect(jsonPath("$.smoothed.t", hasSize(205)))
                .andExpect(jsonPath("$.smoothed.distanceKm", hasSize(205)))
                .andExpect(jsonPath("$.smoothed.paceSecPerKm", hasSize(205)))
                .andExpect(jsonPath("$.smoothed.gapSecPerKm", hasSize(205)))
                .andExpect(jsonPath("$.smoothed.elevationMeters", hasSize(205)))
                .andExpect(jsonPath("$.smoothed.t[0]").value(0))
                .andExpect(jsonPath("$.smoothed.t[204]").value(1020))
                .andExpect(jsonPath("$.smoothed.paceSecPerKm[100]", closeTo(300.0, 0.5)));
    }

    @Test
    void aClimbShowsUpInTheGradeAdjustedPace() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 600);
        stream(run, 600, 1000.0 / 300, 0.05, true, true, false);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasElevation").value(true))
                .andExpect(jsonPath("$.splits[0].paceSecPerKm", closeTo(300.0, 0.5)))
                .andExpect(jsonPath("$.splits[0].gapSecPerKm", closeTo(230.5, 2.0)))
                .andExpect(jsonPath("$.splits[0].elevationChangeMeters", closeTo(50.0, 1.5)))
                .andExpect(jsonPath("$.summary.gapSecPerKm", lessThan(250.0)));
    }

    @Test
    void aGpsOnlyRunGetsItsDistanceFromItsPositions() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 900);
        stream(run, 900, 1000.0 / 300, 0, false, false, false);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasStream").value(true))
                .andExpect(jsonPath("$.hasElevation").value(false))
                .andExpect(jsonPath("$.summary.gapSecPerKm").doesNotExist())
                .andExpect(jsonPath("$.splits", hasSize(3)))
                .andExpect(jsonPath("$.splits[1].paceSecPerKm", closeTo(300.0, 3.0)))
                .andExpect(jsonPath("$.splits[1].gapSecPerKm").doesNotExist())
                .andExpect(jsonPath("$.smoothed.gapSecPerKm[10]").value(nullValue()));
    }

    @Test
    void aTrackWithNoTimesHasNoPaceProfileInsteadOfAnInventedEvenPace() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 900);
        stream(run, 900, 1000.0 / 300, 0, true, true, false, i -> false);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasStream").value(false))
                .andExpect(jsonPath("$.splits", hasSize(0)));
    }

    @Test
    void aStreamWhereMostPointsHaveNoTimeHasNoPaceProfile() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 1020);
        // Only one point in three says when it was recorded: the rest would need times made up for them.
        stream(run, 1020, 1000.0 / 300, 0, true, true, false, i -> i % 3 == 0);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasStream").value(false))
                .andExpect(jsonPath("$.splits", hasSize(0)));
    }

    @Test
    void aStreamWithMostPointsTimedIsBuiltFromTheTimedPointsOnly() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 1020);
        // A stray point in seven has no time. The profile is the same as if it had never been recorded.
        stream(run, 1020, 1000.0 / 300, 0, true, true, false, i -> i % 7 != 3);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasStream").value(true))
                .andExpect(jsonPath("$.summary.elapsedSeconds", closeTo(1020.0, 3.0)))
                .andExpect(jsonPath("$.splits", hasSize(4)))
                .andExpect(jsonPath("$.splits[0].paceSecPerKm", closeTo(300.0, 1.0)))
                .andExpect(jsonPath("$.splits[2].paceSecPerKm", closeTo(300.0, 1.0)));
    }

    @Test
    void aPauseIsCountedAsStoppedTime() throws Exception {
        Runner owner = runner();
        Activity run = run(owner, 760);
        stream(run, 760, 1000.0 / 300, 0, true, true, true);

        mockMvc.perform(get("/api/activities/{id}/pace-profile", run.getId()).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.elapsedSeconds").value(760.0))
                .andExpect(jsonPath("$.summary.stoppedSeconds", closeTo(60.0, 2.0)))
                .andExpect(jsonPath("$.summary.movingSeconds", closeTo(700.0, 2.0)))
                .andExpect(jsonPath("$.summary.paceSecPerKm", closeTo(300.0, 1.0)))
                .andExpect(jsonPath("$.smoothed.paceSecPerKm[87]").value(nullValue()))
                .andExpect(jsonPath("$.smoothed.paceSecPerKm[10]", greaterThan(250.0)));
    }
}
