package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class TtlCacheStoreTests {

    @Test
    void storesAndReadsSerializablePayloadsFromLocalFallback() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock);

        CachePayload payload = new CachePayload("course-map", 42);
        store.put("race", "boston", payload, Duration.ofMinutes(5));

        assertThat(store.get("race", "boston", CachePayload.class)).contains(payload);
    }

    @Test
    void expiresLocalFallbackEntriesAfterTtl() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock);

        store.put("race", "chicago", new CachePayload("profile", 7), Duration.ofSeconds(10));

        clock.advance(Duration.ofSeconds(11));

        assertThat(store.get("race", "chicago", CachePayload.class)).isEmpty();
    }

    @Test
    void evictsLocalFallbackEntriesByNamespaceAndKey() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock);

        store.put("race", "paris", new CachePayload("image", 3), Duration.ofMinutes(5));
        store.evict("race", "paris");

        assertThat(store.get("race", "paris", CachePayload.class)).isEmpty();
    }

    @Test
    void boundsLocalFallbackEntriesByLruCap() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock, 2);

        store.put("race", "berlin", new CachePayload("a", 1), Duration.ofMinutes(5));
        store.put("race", "tokyo", new CachePayload("b", 2), Duration.ofMinutes(5));
        // Touch "berlin" so "tokyo" becomes the least recently used entry.
        store.get("race", "berlin", CachePayload.class);
        store.put("race", "nyc", new CachePayload("c", 3), Duration.ofMinutes(5));

        assertThat(store.localEntrySizeForTests()).isEqualTo(2);
        assertThat(store.get("race", "tokyo", CachePayload.class)).isEmpty();
        assertThat(store.get("race", "berlin", CachePayload.class)).isPresent();
        assertThat(store.get("race", "nyc", CachePayload.class)).isPresent();
    }

    @Test
    void sweepRemovesExpiredEntriesThatAreNeverReadAgain() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock);

        store.put("race", "london", new CachePayload("map", 9), Duration.ofSeconds(10));
        clock.advance(Duration.ofSeconds(11));

        store.sweepExpiredLocalEntries();

        // Rewinding proves the sweep physically removed the entry instead of
        // leaving it to lazy expiry on the next read of that exact key.
        clock.advance(Duration.ofSeconds(-60));
        assertThat(store.localEntrySizeForTests()).isZero();
        assertThat(store.get("race", "london", CachePayload.class)).isEmpty();
    }

    @Test
    void reportsNoDurableBackingWhenRedisIsDisabled() {
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), new MutableClock());

        assertThat(store.hasDurableBacking()).isFalse();
    }

    private record CachePayload(String label, int count) {}

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
