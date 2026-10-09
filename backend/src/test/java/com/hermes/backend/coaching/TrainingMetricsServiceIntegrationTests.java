package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityIngestedEvent;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.runner.AccountDeletionService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.RunnerTrainingZonesRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The effort score and zone times against a real schema: what gets computed from stored runs and points,
 * when it is computed again, and who is allowed to see it.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-metrics-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class TrainingMetricsServiceIntegrationTests {

    @Autowired private TrainingMetricsService service;
    @Autowired private TrainingMetricsRecomputeService recompute;
    @Autowired private TrainingMetricsCatchUp catchUp;
    @Autowired private TrainingZonesService zones;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;
    @Autowired private RunnerRepository runners;
    @Autowired private TrainingMetricsListener listener;
    @Autowired private RunnerTrainingZonesRepository zoneRows;
    @Autowired private AccountDeletionService accountDeletion;

    private Runner runner(Integer maxHeartRate, String timeZone) {
        Runner runner = new Runner("metrics-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setMaxHeartRateBpm(maxHeartRate);
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, int movingSeconds, double km, Double averageHeartRate) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(2026, 10, 1, 12, 0));
        run.setMovingTimeSeconds(movingSeconds);
        run.setDurationSeconds((long) movingSeconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000);
        run.setAverageHeartRate(averageHeartRate);
        return activities.saveAndFlush(run);
    }

    /** One sample a second at a steady heart rate. Saved without telling anyone (no event). */
    private void stream(Activity run, int seconds, int bpm) {
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i < seconds; i++) {
            ActivityPoint point = new ActivityPoint();
            point.setActivity(run);
            point.setSequenceIndex(i);
            point.setLatitude(40.0 + i * 0.00001);
            point.setLongitude(-73.0);
            point.setElapsedSeconds(i);
            point.setHeartRate(bpm);
            points.add(point);
        }
        activityData.savePoints(points);
    }

    private ActivityTrainingMetrics stored(Runner owner, Activity run) {
        return metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId()).orElseThrow();
    }

    // --- what is computed --------------------------------------------------------------------------------------

    @Test
    void aRunWithAHeartRateStreamGetsItsZoneTimesAndAHeartRateScore() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140); // zone 3 of 114/133/152/171

        ActivityTrainingMetrics row = service.freshMetrics(owner, run.getId()).orElseThrow().metrics();

        assertThat(row.getEffortSource()).isEqualTo(EffortModel.HR_ZONES);
        assertThat(row.getEffortScore()).isEqualTo(30.0);
        assertThat(row.getHrEffort()).isEqualTo(30.0);
        assertThat(row.getPaceEffort()).isNotNull();
        assertThat(row.zoneSeconds()).containsExactly(0, 0, 600, 0, 0);
        assertThat(row.getHrCoveredSeconds()).isEqualTo(600);
        assertThat(row.getMaxHrUsed()).isEqualTo(190);
        assertThat(row.zonesUsed().boundaries()).containsExactly(114, 133, 152, 171);
        assertThat(row.getModelVersion()).isEqualTo(TrainingMetricsService.MODEL_VERSION);
    }

    @Test
    void theZonesAreThoseOfTheRunnersMaxHeartRate() {
        Runner owner = runner(170, null); // 102 / 119 / 136 / 153
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140); // zone 4 for this runner

        ActivityTrainingMetrics row = service.freshMetrics(owner, run.getId()).orElseThrow().metrics();

        assertThat(row.zoneSeconds()).containsExactly(0, 0, 0, 600, 0);
        assertThat(row.getEffortScore()).isEqualTo(40.0);
    }

    @Test
    void withoutAStreamTheNextBestEvidenceIsUsedInOrder() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 3600, 10.0, 140.0);

        assertThat(service.freshMetrics(owner, run.getId()).orElseThrow().metrics().getEffortSource())
                .as("the device's average heart rate").isEqualTo(EffortModel.HR_AVERAGE);

        run.setPerceivedExertion(8);
        activities.saveAndFlush(run);
        ActivityTrainingMetrics rated = service.freshMetrics(owner, run.getId()).orElseThrow().metrics();
        assertThat(rated.getEffortSource()).as("a rating beats an average heart rate").isEqualTo(EffortModel.PERCEIVED);
        assertThat(rated.getPerceivedExertionUsed()).isEqualTo(8);

        run.setPerceivedExertion(null);
        run.setAverageHeartRate(null);
        activities.saveAndFlush(run);
        ActivityTrainingMetrics paced = service.freshMetrics(owner, run.getId()).orElseThrow().metrics();
        assertThat(paced.getEffortSource()).as("only distance and time are left").isEqualTo(EffortModel.PACE_MODEL);
        assertThat(paced.getEffortScore()).isEqualTo(paced.getPaceEffort());
    }

    @Test
    void aRunWithNothingToGoOnHasNoScoreButStillHasARow() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 0, 0.0, null);

        ActivityTrainingMetrics row = service.freshMetrics(owner, run.getId()).orElseThrow().metrics();

        assertThat(row.getEffortScore()).isNull();
        assertThat(row.getEffortSource()).isNull();
    }

    @Test
    void theRunnersDayFollowsTheirTimeZoneAndIsUpdatedWhenTheZoneMoves() {
        Runner owner = runner(190, "America/New_York");
        Activity run = run(owner, 600, 2.0, 140.0); // 12:00 UTC is 08:00 in New York: still 1 October
        assertThat(service.freshMetrics(owner, run.getId()).orElseThrow().metrics().getLocalDate()).isEqualTo(LocalDate.of(2026, 10, 1));

        run.setStartTime(LocalDateTime.of(2026, 10, 1, 2, 30)); // 22:30 on 30 September in New York
        activities.saveAndFlush(run);
        assertThat(service.freshMetrics(owner, run.getId()).orElseThrow().metrics().getLocalDate())
                .as("the day is recomputed when the run's own start time disagrees with the row")
                .isEqualTo(LocalDate.of(2026, 9, 30));

        owner.setTimeZone("Asia/Tokyo"); // 11:30 on 1 October in Tokyo
        runners.saveAndFlush(owner);
        assertThat(service.freshMetrics(owner, run.getId()).orElseThrow().metrics().getLocalDate())
                .as("and again when the runner's time zone changes")
                .isEqualTo(LocalDate.of(2026, 10, 1));
    }

    // --- ownership -----------------------------------------------------------------------------------------------

    @Test
    void anotherRunnersRunHasNoMetricsForYou() {
        Runner owner = runner(190, null);
        Runner stranger = runner(190, null);
        Activity run = run(owner, 600, 2.0, 140.0);

        assertThat(service.freshMetrics(stranger, run.getId())).isEmpty();
        assertThat(service.computeAndStore(stranger.getId(), run.getId())).isEmpty();
        assertThat(metrics.findAll()).noneMatch(row -> row.getActivity().getId().equals(run.getId()));
        assertThat(service.freshMetrics(owner, run.getId())).isPresent();
    }

    @Test
    void aRunThatDoesNotExistHasNoMetrics() {
        Runner owner = runner(190, null);

        assertThat(service.freshMetrics(owner, -1L)).isEmpty();
        assertThat(service.computeAndStore(owner.getId(), -1L)).isEmpty();
    }

    // --- when it is computed again -------------------------------------------------------------------------------

    @Test
    void computingTheSameRunTwiceIsHarmless() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140);

        ActivityTrainingMetrics first = service.computeAndStore(owner.getId(), run.getId()).orElseThrow();
        ActivityTrainingMetrics second = service.computeAndStore(owner.getId(), run.getId()).orElseThrow();

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(metrics.findAll().stream().filter(row -> row.getActivity().getId().equals(run.getId()))).hasSize(1);
        assertThat(second.getEffortScore()).isEqualTo(first.getEffortScore());
    }

    @Test
    void aStreamThatArrivesLaterIsPickedUpByTheEventForIt() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, 140.0);
        assertThat(service.freshMetrics(owner, run.getId()).orElseThrow().metrics().getEffortSource()).isEqualTo(EffortModel.HR_AVERAGE);

        // What the Strava sync does after it has fetched the stream.
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i < 600; i++) {
            ActivityPoint point = new ActivityPoint();
            point.setSequenceIndex(i);
            point.setLatitude(40.0);
            point.setLongitude(-73.0);
            point.setElapsedSeconds(i);
            point.setHeartRate(140);
            points.add(point);
        }
        activityData.savePointsIfAbsentAtomically(run.getId(), points);

        ActivityTrainingMetrics row = stored(owner, run);
        assertThat(row.getEffortSource()).as("recomputed by the points-stored event, before anyone opened the run").isEqualTo(EffortModel.HR_ZONES);
        assertThat(row.zoneSeconds()).containsExactly(0, 0, 600, 0, 0);
    }

    @Test
    void aStreamWhoseEventWasLostIsStillNoticedWhenTheRunIsOpened() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, 140.0);
        assertThat(service.freshMetrics(owner, run.getId()).orElseThrow().metrics().getHrCoveredSeconds()).isZero();

        stream(run, 600, 140); // saved without any event

        ActivityTrainingMetrics row = service.freshMetrics(owner, run.getId()).orElseThrow().metrics();
        assertThat(row.getEffortSource()).isEqualTo(EffortModel.HR_ZONES);
        assertThat(row.getHrCoveredSeconds()).isEqualTo(600);
    }

    @Test
    void ingestingARunComputesItsMetrics() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140);
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).isEmpty();

        listener.onActivityIngested(new ActivityIngestedEvent(owner.getId(), run.getId()));

        assertThat(stored(owner, run).getEffortSource()).isEqualTo(EffortModel.HR_ZONES);
    }

    @Test
    void anEventNamingSomeoneElsesRunComputesNothing() {
        Runner owner = runner(190, null);
        Runner stranger = runner(190, null);
        Activity run = run(owner, 600, 2.0, 140.0);

        listener.onActivityIngested(new ActivityIngestedEvent(stranger.getId(), run.getId()));

        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).isEmpty();
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), stranger.getId())).isEmpty();
    }

    @Test
    void changingTheZonesRecomputesTheRunnersHistory() {
        Runner owner = runner(190, null);
        Activity first = run(owner, 600, 2.0, null);
        Activity second = run(owner, 600, 2.0, null);
        stream(first, 600, 140);
        stream(second, 600, 160);
        service.computeAndStore(owner.getId(), first.getId());
        service.computeAndStore(owner.getId(), second.getId());
        assertThat(stored(owner, first).zoneSeconds()).containsExactly(0, 0, 600, 0, 0);

        TrainingZonesService.UpdateResult result = zones.update(owner,
                new TrainingZonesService.Update(170, false, null, false));

        assertThat(result.changed()).isTrue();
        // 170 puts the boundaries at 102 / 119 / 136 / 153: 140 is now zone 4 and 160 is zone 5.
        assertThat(stored(owner, first).zoneSeconds()).containsExactly(0, 0, 0, 600, 0);
        assertThat(stored(owner, second).zoneSeconds()).containsExactly(0, 0, 0, 0, 600);
        assertThat(stored(owner, first).getMaxHrUsed()).isEqualTo(170);
    }

    @Test
    void aRowComputedWithOldZonesIsRecomputedWhenItIsRead() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, null);
        stream(run, 600, 140);
        service.computeAndStore(owner.getId(), run.getId());
        owner.setMaxHeartRateBpm(170); // changed behind the zones service's back
        runners.saveAndFlush(owner);

        ActivityTrainingMetrics row = service.freshMetrics(owner, run.getId()).orElseThrow().metrics();

        assertThat(row.getMaxHrUsed()).isEqualTo(170);
        assertThat(row.zoneSeconds()).containsExactly(0, 0, 0, 600, 0);
    }

    @Test
    void theRecomputeWalkFindsMissingStaleAndFlaggedRowsAndLeavesFreshOnesAlone() {
        Runner owner = runner(190, null);
        Activity missing = run(owner, 600, 2.0, 140.0);
        Activity flagged = run(owner, 600, 2.0, 140.0);
        Activity fresh = run(owner, 600, 2.0, 140.0);
        service.computeAndStore(owner.getId(), flagged.getId());
        service.computeAndStore(owner.getId(), fresh.getId());
        LocalDateTime freshComputedAt = stored(owner, fresh).getComputedAt(); // as the database keeps it

        TrainingMetricsRecomputeService.Outcome none = recompute.recomputeRunner(owner.getId(), false);
        assertThat(none.recomputed()).as("only the run with no row").isEqualTo(1);
        assertThat(metrics.findByActivityIdAndRunnerId(missing.getId(), owner.getId())).isPresent();
        assertThat(stored(owner, fresh).getComputedAt()).isEqualTo(freshComputedAt);

        TrainingMetricsRecomputeService.Outcome forced = recompute.recomputeRunner(owner.getId(), true);
        assertThat(forced.recomputed()).as("force redoes all three").isEqualTo(3);
        assertThat(forced.failed()).isZero();
        assertThat(stored(owner, fresh).getComputedAt()).isAfter(freshComputedAt);
    }

    @Test
    void theStartupCatchUpComputesRunsThatHaveNoMetricsAndNothingElse() {
        Runner owner = runner(190, null);
        Activity withoutRow = run(owner, 600, 2.0, 140.0);
        Activity withRow = run(owner, 600, 2.0, 140.0);
        service.computeAndStore(owner.getId(), withRow.getId());

        int done = catchUp.runOnce();

        assertThat(done).isGreaterThanOrEqualTo(1);
        assertThat(metrics.findByActivityIdAndRunnerId(withoutRow.getId(), owner.getId())).isPresent();
    }

    // --- calibration -------------------------------------------------------------------------------------------

    @Test
    void oncePlentyOfRunsHaveBothScoresThePaceModelIsPutOnTheHeartRateScale() {
        Runner owner = runner(190, null);
        for (int i = 0; i < EffortModel.MIN_CALIBRATION_RUNS; i++) {
            Activity withHeartRate = run(owner, 3000 + i * 60, 8.0 + i * 0.4, null);
            stream(withHeartRate, 3000 + i * 60, 150); // zone 4
            service.computeAndStore(owner.getId(), withHeartRate.getId());
        }
        Activity noHeartRate = run(owner, 3600, 10.0, null);

        ActivityTrainingMetrics row = service.freshMetrics(owner, noHeartRate.getId()).orElseThrow().metrics();

        assertThat(row.getEffortSource()).isEqualTo(EffortModel.PACE_CALIBRATED);
        assertThat(row.getEffortScore()).isNotEqualTo(row.getPaceEffort());
        assertThat(service.calibrationScale(owner.getId())).isNotNull().isBetween(EffortModel.MIN_CALIBRATION_SCALE, EffortModel.MAX_CALIBRATION_SCALE);
    }

    @Test
    void aPaceModelRowIsRedoneOnceCalibrationBecomesPossible() {
        Runner owner = runner(190, null);
        Activity noHeartRate = run(owner, 3600, 10.0, null);
        assertThat(service.freshMetrics(owner, noHeartRate.getId()).orElseThrow().metrics().getEffortSource()).isEqualTo(EffortModel.PACE_MODEL);

        for (int i = 0; i < EffortModel.MIN_CALIBRATION_RUNS; i++) {
            Activity withHeartRate = run(owner, 3000 + i * 60, 8.0 + i * 0.4, null);
            stream(withHeartRate, 3000 + i * 60, 150);
            service.computeAndStore(owner.getId(), withHeartRate.getId());
        }

        assertThat(service.freshMetrics(owner, noHeartRate.getId()).orElseThrow().metrics().getEffortSource()).isEqualTo(EffortModel.PACE_CALIBRATED);
    }

    // --- deleting --------------------------------------------------------------------------------------------------

    @Test
    void deletingARunDeletesItsMetrics() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, 140.0);
        service.computeAndStore(owner.getId(), run.getId());
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).isPresent();

        boolean deleted = activityData.deleteActivityForRunner(run.getId(), owner);

        assertThat(deleted).isTrue();
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).isEmpty();
        assertThat(activities.findById(run.getId())).isEmpty();
    }

    @Test
    void aRunThatStopsBeingARunLosesItsMetrics() {
        Runner owner = runner(190, null);
        Activity run = run(owner, 600, 2.0, 140.0);
        service.computeAndStore(owner.getId(), run.getId());

        run.setActivityType(ActivityType.UNKNOWN);
        activities.saveAndFlush(run);
        Optional<ActivityTrainingMetrics> again = service.computeAndStore(owner.getId(), run.getId());

        assertThat(again).isEmpty();
        assertThat(metrics.findByActivityIdAndRunnerId(run.getId(), owner.getId())).isEmpty();
    }

    @Test
    void deletingTheAccountDeletesTheZonesAndTheMetrics() {
        Runner owner = runner(190, null);
        Runner bystander = runner(190, null);
        Activity run = run(owner, 600, 2.0, 140.0);
        Activity bystandersRun = run(bystander, 600, 2.0, 140.0);
        service.computeAndStore(owner.getId(), run.getId());
        service.computeAndStore(bystander.getId(), bystandersRun.getId());
        zones.update(owner, new TrainingZonesService.Update(null, false, new int[] {100, 120, 140, 160}, false));
        zones.update(bystander, new TrainingZonesService.Update(null, false, new int[] {105, 125, 145, 165}, false));

        accountDeletion.deleteAccount(owner.getId());

        assertThat(runners.findById(owner.getId())).isEmpty();
        assertThat(zoneRows.findAll()).noneMatch(row -> row.getRunner().getId().equals(owner.getId()));
        assertThat(metrics.findAll()).noneMatch(row -> row.getRunner().getId().equals(owner.getId()));
        assertThat(zoneRows.findByRunner(bystander)).as("someone else's zones are untouched").isPresent();
        assertThat(metrics.findByActivityIdAndRunnerId(bystandersRun.getId(), bystander.getId())).isPresent();
    }
}
