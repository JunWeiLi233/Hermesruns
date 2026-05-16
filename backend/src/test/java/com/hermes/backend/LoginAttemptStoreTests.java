package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptStoreTests {

    @Test
    void blocksAfterConfiguredFailureThresholdAndExpiresLockout() {
        MutableClock clock = new MutableClock();
        LoginAttemptStore store = LoginAttemptStore.inMemoryForTests(clock);

        for (int i = 0; i < 9; i++) {
            store.recordFailure("login", "runner@example.com", 10, Duration.ofMinutes(15));
            assertThat(store.isBlocked("login", "runner@example.com")).isFalse();
        }

        store.recordFailure("login", "runner@example.com", 10, Duration.ofMinutes(15));

        assertThat(store.isBlocked("login", "runner@example.com")).isTrue();

        clock.advance(Duration.ofMinutes(16));

        assertThat(store.isBlocked("login", "runner@example.com")).isFalse();
    }

    @Test
    void successClearsExistingAttempts() {
        MutableClock clock = new MutableClock();
        LoginAttemptStore store = LoginAttemptStore.inMemoryForTests(clock);

        store.recordFailure("login", "runner@example.com", 1, Duration.ofMinutes(15));
        assertThat(store.isBlocked("login", "runner@example.com")).isTrue();

        store.recordSuccess("login", "runner@example.com");

        assertThat(store.isBlocked("login", "runner@example.com")).isFalse();
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-04-29T12:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
