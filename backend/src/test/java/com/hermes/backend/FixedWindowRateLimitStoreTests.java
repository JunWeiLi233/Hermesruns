package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class FixedWindowRateLimitStoreTests {

    @Test
    void inMemoryStoreBlocksRequestsAfterFixedWindowLimit() {
        MutableClock clock = new MutableClock();
        FixedWindowRateLimitStore store = FixedWindowRateLimitStore.inMemoryForTests(clock);

        assertThat(store.allow("api", "runner-1", 2, Duration.ofMinutes(1))).isTrue();
        assertThat(store.allow("api", "runner-1", 2, Duration.ofMinutes(1))).isTrue();
        assertThat(store.allow("api", "runner-1", 2, Duration.ofMinutes(1))).isFalse();
    }

    @Test
    void inMemoryStoreResetsAfterWindowExpires() {
        MutableClock clock = new MutableClock();
        FixedWindowRateLimitStore store = FixedWindowRateLimitStore.inMemoryForTests(clock);

        assertThat(store.allow("api", "runner-2", 1, Duration.ofSeconds(30))).isTrue();
        assertThat(store.allow("api", "runner-2", 1, Duration.ofSeconds(30))).isFalse();

        clock.advance(Duration.ofSeconds(31));

        assertThat(store.allow("api", "runner-2", 1, Duration.ofSeconds(30))).isTrue();
    }

    @Test
    void namespacesDoNotShareCounters() {
        MutableClock clock = new MutableClock();
        FixedWindowRateLimitStore store = FixedWindowRateLimitStore.inMemoryForTests(clock);

        assertThat(store.allow("webhook", "shared-key", 1, Duration.ofMinutes(1))).isTrue();
        assertThat(store.allow("api", "shared-key", 1, Duration.ofMinutes(1))).isTrue();
        assertThat(store.allow("api", "shared-key", 1, Duration.ofMinutes(1))).isFalse();
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
