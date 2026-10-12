package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs imported from a file before the importer worked the climb out have none (BUG-036). After a start, those whose points
 * carry elevation get one; nothing else is touched.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:elevation-gain-catchup;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class ElevationGainCatchUpTests {

    @Autowired private ElevationGainRepository elevations;
    @Autowired private ElevationGainService service;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("climb-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private Activity run(Runner owner, Double climb) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.MANUAL);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 12, 0));
        run.setMovingTimeSeconds(1800);
        run.setDurationSeconds(1800L);
        run.setTotalElevationGain(climb);
        return activities.saveAndFlush(run);
    }

    /** Points a hundred metres apart; {@code raw} and {@code corrected} are the elevations, either of which may be null. */
    private void points(Activity run, double[] raw, double[] corrected) {
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i < Math.max(raw == null ? 0 : raw.length, corrected == null ? 0 : corrected.length); i++) {
            ActivityPoint point = new ActivityPoint();
            point.setActivity(run);
            point.setSequenceIndex(i);
            point.setLatitude(40.0 + i * 0.0009);
            point.setLongitude(-73.0);
            point.setElapsedSeconds(i * 30);
            point.setDistanceMeters(i * 100.0);
            if (raw != null) {
                point.setElevationMeters(raw[i]);
                point.setElevationRawMeters(raw[i]);
            }
            if (corrected != null) {
                point.setElevationCorrectedMeters(corrected[i]);
            }
            points.add(point);
        }
        activityData.savePoints(points);
    }

    private ElevationGainCatchUp catchUp(int maxRuns) {
        return new ElevationGainCatchUp(elevations, service, false, maxRuns);
    }

    private Double climbOf(Activity run) {
        return activities.findById(run.getId()).orElseThrow().getTotalElevationGain();
    }

    @Test
    void aRunWithElevationButNoClimbGetsOne() {
        Runner owner = runner();
        Activity run = run(owner, null);
        points(run, new double[] {10, 30, 50, 40, 20, 40, 70}, null);

        int done = catchUp(500).runOnce();

        assertThat(done).isGreaterThanOrEqualTo(1);
        // Up 40, down 30, up 50.
        assertThat(climbOf(run)).isEqualTo(90.0);
    }

    @Test
    void aClimbTheRunAlreadyHasIsNeverReplaced() {
        Activity run = run(runner(), 123.0);
        points(run, new double[] {10, 30, 50, 70}, null);

        catchUp(500).runOnce();

        assertThat(climbOf(run)).isEqualTo(123.0);
    }

    @Test
    void aRunWithNoElevationAnywhereStaysWithoutAFigureAndIsNotLookedAtAgain() {
        Activity run = run(runner(), null);
        points(run, null, null);
        ActivityPoint point = new ActivityPoint();
        point.setActivity(run);
        point.setSequenceIndex(0);
        point.setLatitude(40.0);
        point.setLongitude(-73.0);
        activityData.savePoints(List.of(point));

        catchUp(500).runOnce();

        assertThat(climbOf(run)).isNull();
        assertThat(elevations.findNewestRunIdsWithoutClimb(ActivityType.RUN, org.springframework.data.domain.PageRequest.of(0, 1000)))
                .doesNotContain(run.getId());
    }

    @Test
    void theCorrectedProfileIsUsedWhenTheRunHasOne() {
        Activity run = run(runner(), null);
        // The barometer drifted up 60 m over the run; the corrected profile is flat but for one 12 m hill.
        points(run, new double[] {100, 120, 140, 160}, new double[] {50, 62, 50, 50});

        catchUp(500).runOnce();

        assertThat(climbOf(run)).isEqualTo(12.0);
    }

    @Test
    void aPassIsBoundedAndTakesTheNewestRunsFirst() {
        Runner owner = runner();
        Activity older = run(owner, null);
        points(older, new double[] {0, 20, 40}, null);
        Activity newer = run(owner, null);
        points(newer, new double[] {0, 20, 40}, null);
        Activity newest = run(owner, null);
        points(newest, new double[] {0, 20, 40}, null);

        int done = catchUp(1).runOnce();

        assertThat(done).isEqualTo(1);
        assertThat(climbOf(newest)).isEqualTo(40.0);
        assertThat(climbOf(newer)).isNull();
        assertThat(climbOf(older)).isNull();
    }

    @Test
    void aWorkoutThatIsNotARunIsLeftAlone() {
        Activity workout = run(runner(), null);
        workout.setActivityType(ActivityType.NON_RUN);
        activities.saveAndFlush(workout);
        points(workout, new double[] {0, 20, 40}, null);

        catchUp(500).runOnce();

        assertThat(climbOf(workout)).isNull();
    }
}
