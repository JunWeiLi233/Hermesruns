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
