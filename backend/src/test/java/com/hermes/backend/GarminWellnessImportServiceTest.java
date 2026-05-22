package com.hermes.backend;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GarminWellnessImportServiceTest {

    @Test
    void wellnessSyncTrackerTryBeginTransitionsToRunning() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        assertThat(tracker.tryBegin()).isTrue();
        GarminWellnessImportService.WellnessSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.active()).isTrue();
        assertThat(snapshot.status()).isEqualTo("RUNNING");
    }

    @Test
    void wellnessSyncTrackerTryBeginReturnsFalseWhenAlreadyRunning() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        assertThat(tracker.tryBegin()).isTrue();
        assertThat(tracker.tryBegin()).isFalse();
    }

    @Test
    void wellnessSyncTrackerMarkCompletedStopsRunning() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.addDaysFetched(7);
        tracker.addDaysPersisted(5);
        tracker.addWellnessSaved(5);
        tracker.addSleepSaved(5);
        tracker.addHrvSaved(5);
        tracker.addStressSaved(5);
        tracker.addBodySaved(3);
        tracker.markCompleted("All synced");

        GarminWellnessImportService.WellnessSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.active()).isFalse();
        assertThat(snapshot.status()).isEqualTo("COMPLETED");
        assertThat(snapshot.daysFetched()).isEqualTo(7);
        assertThat(snapshot.daysPersisted()).isEqualTo(5);
        assertThat(snapshot.wellnessSaved()).isEqualTo(5);
        assertThat(snapshot.sleepSaved()).isEqualTo(5);
        assertThat(snapshot.hrvSaved()).isEqualTo(5);
        assertThat(snapshot.stressSaved()).isEqualTo(5);
        assertThat(snapshot.bodySaved()).isEqualTo(3);
    }

    @Test
    void wellnessSyncTrackerMarkFailedStopsRunningAndMarksFailed() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.markFailed("Python script error");
        GarminWellnessImportService.WellnessSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.active()).isFalse();
        assertThat(snapshot.status()).isEqualTo("FAILED");
        assertThat(snapshot.message()).isEqualTo("Python script error");
    }

    @Test
    void wellnessSyncTrackerRateLimitCooldownBlocksImmediateRetry() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.markRateLimited("Garmin is temporarily rate limiting login attempts.", 900);

        GarminWellnessImportService.WellnessSyncStatus snapshot = tracker.snapshot();

        assertThat(snapshot.active()).isFalse();
        assertThat(snapshot.status()).isEqualTo("RATE_LIMITED");
        assertThat(snapshot.message()).contains("temporarily rate limiting");
        assertThat(snapshot.retryAfterSeconds()).isBetween(1L, 900L);
        assertThat(tracker.tryBegin()).isFalse();
    }

    @Test
    void wellnessSyncTrackerCanBeReusedAfterCompletion() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.markCompleted("First sync done");
        assertThat(tracker.tryBegin()).isTrue();
    }

    @Test
    void wellnessSyncStatusIdleReturnsDefaultState() {
        GarminWellnessImportService.WellnessSyncStatus idle = GarminWellnessImportService.WellnessSyncStatus.idle();
        assertThat(idle.status()).isEqualTo("IDLE");
        assertThat(idle.active()).isFalse();
        assertThat(idle.daysFetched()).isZero();
        assertThat(idle.daysPersisted()).isZero();
        assertThat(idle.wellnessSaved()).isZero();
        assertThat(idle.sleepSaved()).isZero();
        assertThat(idle.hrvSaved()).isZero();
        assertThat(idle.stressSaved()).isZero();
        assertThat(idle.bodySaved()).isZero();
        assertThat(idle.message()).isNull();
    }

    @Test
    void wellnessSyncTrackerIsStaleDetectsOldEntries() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.markCompleted("Done");
        long cutoff = System.currentTimeMillis() + 1;
        assertThat(tracker.isStale(cutoff)).isTrue();
    }

    @Test
    void wellnessSyncTrackerIsNotStaleWhenRunning() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        long cutoff = System.currentTimeMillis() + 1;
        assertThat(tracker.isStale(cutoff)).isFalse();
    }

    @Test
    void wellnessSyncTrackerIsNotStaleWhenRecentlyCompleted() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.markCompleted("Done");
        long cutoff = System.currentTimeMillis() - 10000;
        assertThat(tracker.isStale(cutoff)).isFalse();
    }

    @Test
    void wellnessSyncTrackerAddMethodsAccumulate() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.addDaysFetched(3);
        tracker.addDaysFetched(2);
        tracker.addWellnessSaved(5);
        tracker.addSleepSaved(4);

        GarminWellnessImportService.WellnessSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.daysFetched()).isEqualTo(5);
        assertThat(snapshot.wellnessSaved()).isEqualTo(5);
        assertThat(snapshot.sleepSaved()).isEqualTo(4);
    }

    @Test
    void tryBeginResetsAllCountersOnNewRun() {
        GarminWellnessImportService.WellnessSyncTracker tracker = new GarminWellnessImportService.WellnessSyncTracker();
        tracker.tryBegin();
        tracker.addDaysFetched(10);
        tracker.addWellnessSaved(10);
        tracker.markCompleted("First run");
        assertThat(tracker.tryBegin()).isTrue();

        GarminWellnessImportService.WellnessSyncStatus snapshot = tracker.snapshot();
        assertThat(snapshot.daysFetched()).isZero();
        assertThat(snapshot.wellnessSaved()).isZero();
        assertThat(snapshot.active()).isTrue();
        assertThat(snapshot.status()).isEqualTo("RUNNING");
    }
}
