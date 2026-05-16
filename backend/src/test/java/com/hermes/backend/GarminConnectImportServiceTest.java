package com.hermes.backend;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GarminConnectImportServiceTest {

    @Test
    void syncTrackerRateLimitCooldownBlocksImmediateRetry() {
        GarminConnectImportService.GarminSyncTracker tracker = new GarminConnectImportService.GarminSyncTracker();
        tracker.tryBegin();
        tracker.markRateLimited("Garmin is temporarily rate limiting login attempts.", 900);

        GarminConnectImportService.GarminSyncStatus snapshot = tracker.snapshot();

        assertThat(snapshot.active()).isFalse();
        assertThat(snapshot.status()).isEqualTo("RATE_LIMITED");
        assertThat(snapshot.message()).contains("temporarily rate limiting");
        assertThat(snapshot.retryAfterSeconds()).isBetween(1L, 900L);
        assertThat(tracker.tryBegin()).isFalse();
    }
}
