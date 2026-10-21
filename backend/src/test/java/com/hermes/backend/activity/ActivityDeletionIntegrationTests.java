package com.hermes.backend.activity;

import com.hermes.backend.rewards.DigitalCosmeticDrop;
import com.hermes.backend.rewards.DigitalCosmeticDropRepository;
import com.hermes.backend.rewards.DigitalCosmeticTier;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deleting runs against a real schema. The cosmetic-drop foreign key to activities used to make a
 * delete fail for any run that had minted a drop, so these tests run on H2 with create-drop to let
 * the database enforce the constraint.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:activity-deletion-integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class ActivityDeletionIntegrationTests {

    @Autowired private ActivityDataAccess activityDataAccess;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityPointRepository points;
    @Autowired private RunnerRepository runners;
    @Autowired private DigitalCosmeticDropRepository drops;
    @Autowired private DeletedActivityTombstoneRepository tombstones;

    private Runner runner() {
        return runners.saveAndFlush(new Runner("deletion-" + UUID.randomUUID() + "@hermes.test", "active"));
    }

    private Activity run(Runner owner, String name) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName(name);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setDistanceKm(5);
        return activities.saveAndFlush(run);
    }

    private DigitalCosmeticDrop dropFor(Runner owner, Activity run) {
        DigitalCosmeticDrop drop = new DigitalCosmeticDrop();
        drop.setRunner(owner);
        drop.setActivity(run);
        drop.setTier(DigitalCosmeticTier.MIL_SPEC);
        return drops.saveAndFlush(drop);
    }

    private void addPoint(Activity run, int sequence) {
        ActivityPoint point = new ActivityPoint();
        point.setActivity(run);
        point.setSequenceIndex(sequence);
        point.setLatitude(40.0 + sequence * 0.0001);
        point.setLongitude(-73.0);
        points.saveAndFlush(point);
    }

    @Test
    void deletingARunThatEarnedACosmeticDropSucceedsAndRemovesTheDrop() {
        Runner owner = runner();
        Activity run = run(owner, "earned a drop");
        addPoint(run, 0);
        DigitalCosmeticDrop drop = dropFor(owner, run);

        boolean deleted = activityDataAccess.deleteActivityForRunner(run.getId(), owner);

        assertThat(deleted).isTrue();
        assertThat(activities.findById(run.getId())).isEmpty();
        assertThat(drops.findById(drop.getId())).isEmpty();
        assertThat(points.existsByActivity(run)).isFalse();
    }

    @Test
    void deletingSomeoneElsesRunChangesNothing() {
        Runner owner = runner();
        Runner stranger = runner();
        Activity run = run(owner, "not yours");
        DigitalCosmeticDrop drop = dropFor(owner, run);

        boolean deleted = activityDataAccess.deleteActivityForRunner(run.getId(), stranger);

        assertThat(deleted).isFalse();
        assertThat(activities.findById(run.getId())).isPresent();
        assertThat(drops.findById(drop.getId())).isPresent();
    }

    @Test
    void purgeRemovesTheGivenRunsTheirPointsAndTheirDropsAndLeavesOtherRuns() {
        Runner owner = runner();
        Activity doomed = run(owner, "doomed");
        Activity kept = run(owner, "kept");
        addPoint(doomed, 0);
        addPoint(kept, 0);
        dropFor(owner, doomed);
        DigitalCosmeticDrop keptDrop = dropFor(owner, kept);

        int removed = activityDataAccess.purgeActivities(owner, List.of(doomed.getId()));

        assertThat(removed).isEqualTo(1);
        assertThat(activities.findById(doomed.getId())).isEmpty();
        assertThat(activities.findById(kept.getId())).isPresent();
        assertThat(points.existsByActivity(kept)).isTrue();
        assertThat(drops.findById(keptDrop.getId())).isPresent();
    }

    @Test
    void purgeIgnoresRunsTheRunnerDoesNotOwn() {
        Runner owner = runner();
        Runner stranger = runner();
        Activity run = run(owner, "owned by someone else");

        int removed = activityDataAccess.purgeActivities(stranger, List.of(run.getId()));

        assertThat(removed).isZero();
        assertThat(activities.findById(run.getId())).isPresent();
    }

    @Test
    void purgeHandlesMoreRunsThanOneDeleteChunk() {
        Runner owner = runner();
        List<Long> ids = new java.util.ArrayList<>();
        for (int i = 0; i < 520; i++) {
            ids.add(run(owner, "bulk " + i).getId());
        }

        int removed = activityDataAccess.purgeActivities(owner, ids);

        assertThat(removed).isEqualTo(520);
        assertThat(activities.countByRunner(owner)).isZero();
    }

    @Test
    void deletingAStravaApiRunLeavesATombstoneButDeletingAFileRunDoesNot() {
        Runner owner = runner();
        Activity apiRun = stravaSyncedRun(owner, "9001");
        Activity fileRun = run(owner, "from a file");

        activityDataAccess.deleteActivityForRunner(apiRun.getId(), owner);
        activityDataAccess.deleteActivityForRunner(fileRun.getId(), owner);

        assertThat(tombstones.existsByRunnerAndProviderAndExternalId(owner, "STRAVA", "9001")).isTrue();
        assertThat(tombstones.countByRunner(owner)).isEqualTo(1);
    }

    @Test
    void purgeLeavesNoTombstoneBecauseTheDataItselfIsMeantToGo() {
        Runner owner = runner();
        Activity apiRun = stravaSyncedRun(owner, "9002");

        activityDataAccess.purgeActivities(owner, List.of(apiRun.getId()));

        assertThat(tombstones.countByRunner(owner)).isZero();
    }

    @Test
    void backfillFlagsOnlyRunsWrittenByTheStravaSync() {
        Runner owner = runner();
        Activity synced = legacyStravaRun(owner, "42", "STRAVA_42");
        // A Strava export file imported by the runner: same provider, but the checksum is a file digest.
        Activity exportedFile = legacyStravaRun(owner, "43", "a".repeat(64));
        Activity exportedWithoutId = legacyStravaRun(owner, null, "b".repeat(64));
        Activity garmin = run(owner, "garmin");

        int flagged = activities.backfillStravaApiSourced(ImportProvider.STRAVA);

        assertThat(flagged).isEqualTo(1);
        assertThat(activities.findById(synced.getId()).orElseThrow().isStravaApiSourced()).isTrue();
        assertThat(activities.findById(exportedFile.getId()).orElseThrow().isStravaApiSourced()).isFalse();
        assertThat(activities.findById(exportedWithoutId.getId()).orElseThrow().isStravaApiSourced()).isFalse();
        assertThat(activities.findById(garmin.getId()).orElseThrow().isStravaApiSourced()).isFalse();
        assertThat(activities.backfillStravaApiSourced(ImportProvider.STRAVA)).as("idempotent").isZero();
    }

    private Activity stravaSyncedRun(Runner owner, String stravaId) {
        Activity run = legacyStravaRun(owner, stravaId, "STRAVA_" + stravaId);
        run.setStravaApiSourced(true);
        return activities.saveAndFlush(run);
    }

    private Activity legacyStravaRun(Runner owner, String stravaId, String checksum) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("strava " + stravaId);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.STRAVA);
        run.setStravaId(stravaId);
        run.setSourceChecksum(checksum);
        run.setDistanceKm(5);
        return activities.saveAndFlush(run);
    }
}
