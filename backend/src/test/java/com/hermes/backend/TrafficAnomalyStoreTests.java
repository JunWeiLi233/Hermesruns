package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class TrafficAnomalyStoreTests {

    @Test
    void warnsOnlyOnceWhenThresholdIsCrossedInWindow() {
        MutableClock clock = new MutableClock();
        TrafficAnomalyStore store = TrafficAnomalyStore.inMemoryForTests(clock);

        assertThat(store.record("127.0.0.1", 400, Duration.ofMinutes(1), 2, 10, 10).warning()).isFalse();

        TrafficAnomalyStore.Snapshot threshold = store.record("127.0.0.1", 404, Duration.ofMinutes(1), 2, 10, 10);
        TrafficAnomalyStore.Snapshot repeated = store.record("127.0.0.1", 404, Duration.ofMinutes(1), 2, 10, 10);

        assertThat(threshold.warning()).isTrue();
        assertThat(threshold.s4xx()).isEqualTo(2);
        assertThat(repeated.warning()).isFalse();
        assertThat(repeated.s4xx()).isEqualTo(3);
    }

    @Test
    void resetsWarningAfterWindowExpires() {
        MutableClock clock = new MutableClock();
        TrafficAnomalyStore store = TrafficAnomalyStore.inMemoryForTests(clock);

        store.record("127.0.0.1", 500, Duration.ofSeconds(30), 10, 10, 1);
        clock.advance(Duration.ofSeconds(31));

        TrafficAnomalyStore.Snapshot nextWindow = store.record("127.0.0.1", 500, Duration.ofSeconds(30), 10, 10, 1);

        assertThat(nextWindow.warning()).isTrue();
        assertThat(nextWindow.s5xx()).isEqualTo(1);
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
