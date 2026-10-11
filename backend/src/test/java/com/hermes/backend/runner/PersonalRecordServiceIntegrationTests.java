package com.hermes.backend.runner;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityDataAccess;
import com.hermes.backend.activity.ActivityCaches;
import com.hermes.backend.activity.ActivityPoint;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.BestEffortService;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.activity.RunRecordsCoordinator;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The personal records against a real schema: they come from the stored best efforts, they follow what the runner decides
 * about an effort at once (the cached answer is dropped), and one runner's records never include another's.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:personal-records-integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class PersonalRecordServiceIntegrationTests {

    private static final double METERS_PER_DEGREE = 6_371_000.0 * Math.PI / 180.0;

    @Autowired private PersonalRecordService records;
    @Autowired private RunRecordsCoordinator coordinator;
    @Autowired private BestEffortService bestEfforts;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;
    @Autowired private RunnerRepository runners;
    @Autowired private TtlCacheStore cacheStore;

    private Runner runner() {
        Runner runner = new Runner("records-pr-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole("USER");
        return runners.saveAndFlush(runner);
    }

    /** A straight run with a stream at a constant pace, analysed. */
    private Activity analysedRun(Runner owner, LocalDateTime start, double km, int seconds) {
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
        double speed = km * 1000.0 / seconds;
        List<ActivityPoint> points = new ArrayList<>();
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
        coordinator.process(owner.getId(), saved.getId());
        return saved;
    }

    @Test
    void theBestEffortOfTheBestRunIsTheRecordAtEachDistanceItReaches() {
        Runner owner = runner();
        analysedRun(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        Activity faster = analysedRun(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 6.0, 1740);

        PersonalRecordService.PersonalRecordsResponse response = records.buildForRunner(owner);

        PersonalRecordService.DistanceRecord fiveKm = response.records().get("5km");
        assertThat(fiveKm.elapsedSeconds()).isEqualTo(1450);
        assertThat(fiveKm.activityId()).isEqualTo(faster.getId());
        assertThat(fiveKm.paceSecondsPerKm()).isEqualTo(290.0);
        assertThat(fiveKm.derivedFromSegment()).isTrue();
        assertThat(fiveKm.recordedAt()).isEqualTo("2026-09-08T07:00");
        assertThat(response.records()).containsKeys("1km", "3km").doesNotContainKeys("10km", "half", "marathon");
        assertThat(response.longestRun().activityId()).isNotNull();
    }

    @Test
    void aRunThatIsAnalysedAfterTheRecordsWereReadChangesThemAtOnce() {
        Runner owner = runner();
        analysedRun(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        assertThat(records.buildForRunner(owner).records().get("5km").elapsedSeconds()).isEqualTo(1500);

        Activity faster = analysedRun(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 6.0, 1740);

        PersonalRecordService.DistanceRecord record = records.buildForRunner(owner).records().get("5km");
        assertThat(record.elapsedSeconds()).isEqualTo(1450);
        assertThat(record.activityId()).isEqualTo(faster.getId());
    }

    @Test
    void aTypedChipTimeBecomesTheRecordAtOnceAndHidingAnEffortTakesItBack() {
        Runner owner = runner();
        Activity race = analysedRun(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        Activity easy = analysedRun(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 6.0, 1860);
        assertThat(records.buildForRunner(owner).records().get("5km").activityId()).isEqualTo(race.getId());

        bestEfforts.change(owner, easy.getId(), "5km", new BestEffortService.Change(1400, false, null));

        PersonalRecordService.DistanceRecord typed = records.buildForRunner(owner).records().get("5km");
        assertThat(typed.activityId()).isEqualTo(easy.getId());
        assertThat(typed.elapsedSeconds()).isEqualTo(1400);

        bestEfforts.change(owner, easy.getId(), "5km", new BestEffortService.Change(null, false, true));

        assertThat(records.buildForRunner(owner).records().get("5km").activityId()).isEqualTo(race.getId());
    }

    @Test
    void anEstimatedEffortIsARecordButIsNotMarkedAsDerivedFromASegment() {
        Runner owner = runner();
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("no stream");
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(2026, 9, 1, 7, 0));
        run.setMovingTimeSeconds(1560);
        run.setDistanceKm(5.2);
        run.setDistanceMeters(5200.0);
        Activity saved = activities.saveAndFlush(run);
        coordinator.process(owner.getId(), saved.getId());

        PersonalRecordService.DistanceRecord fiveKm = records.buildForRunner(owner).records().get("5km");

        assertThat(fiveKm.activityId()).isEqualTo(saved.getId());
        assertThat(fiveKm.derivedFromSegment()).isFalse();
    }

    @Test
    void oneRunnersRecordsNeverIncludeAnotherRunnersRuns() {
        Runner owner = runner();
        Runner stranger = runner();
        analysedRun(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        analysedRun(stranger, LocalDateTime.of(2026, 9, 2, 7, 0), 6.0, 1500);

        assertThat(records.buildForRunner(owner).records().get("5km").elapsedSeconds()).isEqualTo(1500);
        assertThat(records.buildForRunner(stranger).records().get("5km").elapsedSeconds()).isEqualTo(1250);
    }

    @Test
    void deletingTheRecordRunGivesTheRecordToTheNextBest() {
        Runner owner = runner();
        Activity slower = analysedRun(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        Activity faster = analysedRun(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 6.0, 1740);
        assertThat(records.buildForRunner(owner).records().get("5km").activityId()).isEqualTo(faster.getId());

        activityData.deleteActivityForRunner(faster.getId(), owner);
        ActivityCaches.evictForRunner(cacheStore, owner.getId()); // what the delete endpoint does after the delete

        PersonalRecordService.DistanceRecord next = records.buildForRunner(owner).records().get("5km");
        assertThat(next.activityId()).isEqualTo(slower.getId());
        assertThat(next.elapsedSeconds()).isEqualTo(1500);
    }
}
