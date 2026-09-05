package com.hermes.backend.infrastructure.cache;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Constructor;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Test
    void skipsLocalFallbackForValuesOverTheValueSizeCap() {
        MutableClock clock = new MutableClock();
        // Jackson writes a String payload with surrounding quotes, so "abcdefg"
        // serializes to 9 chars: one over the 8-char cap.
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock, 1024, 8);

        store.put("race", "huge", "abcdefg", Duration.ofMinutes(5));

        assertThat(store.localEntrySizeForTests()).isZero();
        // Redis is disabled in this fixture, so the skipped local retention
        // surfaces as a plain miss on the next read of the same key.
        assertThat(store.get("race", "huge", String.class)).isEmpty();
    }

    @Test
    void retainsValuesAtExactlyTheValueSizeCap() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock, 1024, 8);

        // "abcdef" serializes to exactly 8 chars (quotes included): at the cap.
        store.put("race", "exact", "abcdef", Duration.ofMinutes(5));
        store.put("race", "small", "a", Duration.ofMinutes(5));

        assertThat(store.localEntrySizeForTests()).isEqualTo(2);
        assertThat(store.get("race", "exact", String.class)).contains("abcdef");
        assertThat(store.get("race", "small", String.class)).contains("a");
    }

    @Test
    void oversizedValueDoesNotDisturbOtherLocalEntries() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock, 1024, 8);

        store.put("race", "small", "a", Duration.ofMinutes(5));
        store.put("race", "huge", "abcdefg", Duration.ofMinutes(5));

        assertThat(store.localEntrySizeForTests()).isEqualTo(1);
        assertThat(store.get("race", "small", String.class)).contains("a");
    }

    @Test
    void oversizedPutEvictsStaleLocalEntryAtSameKey() {
        MutableClock clock = new MutableClock();
        TtlCacheStore store = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock, 1024, 8);

        store.put("race", "dual", "a", Duration.ofMinutes(5));
        assertThat(store.get("race", "dual", String.class)).contains("a");

        // Last-write-wins locally: the oversized overwrite must drop the old
        // entry instead of leaving the stale smaller value being served.
        store.put("race", "dual", "abcdefg", Duration.ofMinutes(5));

        assertThat(store.localEntrySizeForTests()).isZero();
        assertThat(store.get("race", "dual", String.class)).isEmpty();
    }

    @Test
    void oversizedValueIsStillWrittenToRedis() {
        MutableClock clock = new MutableClock();
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOperations = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(startsWith("hermes-test:cache:race:"))).thenReturn("\"abcdefg\"");

        TtlCacheStore store = TtlCacheStore.redisBackedForTests(new ObjectMapper(), clock, () -> redisTemplate, 8);

        store.put("race", "huge", "abcdefg", Duration.ofMinutes(5));

        assertThat(store.localEntrySizeForTests()).isZero();
        // The raw key is hashed by RedisKeySupport, so only assert the stable
        // prefix plus the exact serialized payload and TTL.
        verify(valueOperations).set(startsWith("hermes-test:cache:race:"), eq("\"abcdefg\""),
                eq(Duration.ofMinutes(5)));
        // The Redis-first read path covers entries skipped locally.
        assertThat(store.get("race", "huge", String.class)).contains("abcdefg");
    }

    @Test
    void valueSizeCapFollowsTheLocalMaxEntriesConfigPattern() {
        Constructor<TtlCacheStore> autowired = Arrays.stream(TtlCacheStore.class.getDeclaredConstructors())
                .filter(ctor -> ctor.isAnnotationPresent(Autowired.class))
                .map(ctor -> (Constructor<TtlCacheStore>) ctor)
                .findFirst()
                .orElseThrow(() -> new AssertionError("No @Autowired TtlCacheStore constructor"));

        String entriesPlaceholder = valuePlaceholder(autowired, "app.cache.local-max-entries");
        String bytesPlaceholder = valuePlaceholder(autowired, "app.cache.local-max-value-bytes");

        assertThat(entriesPlaceholder).isEqualTo("${app.cache.local-max-entries:1024}");
        assertThat(bytesPlaceholder).isEqualTo("${app.cache.local-max-value-bytes:1048576}");
    }

    private static String valuePlaceholder(Constructor<TtlCacheStore> constructor, String propertyPrefix) {
        return Arrays.stream(constructor.getParameters())
                .map(parameter -> parameter.getAnnotation(Value.class))
                .filter(Objects::nonNull)
                .map(Value::value)
                .filter(placeholder -> placeholder.startsWith("${" + propertyPrefix + ":"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing @Value for " + propertyPrefix));
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
