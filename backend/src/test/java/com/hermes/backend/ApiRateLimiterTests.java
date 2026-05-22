package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class ApiRateLimiterTests {

    @Test
    void allowPermitsRequestsWithinWindowLimit() {
        ApiRateLimiter limiter = new ApiRateLimiter();

        assertThat(limiter.allow("user-1", 3, 60)).isTrue();
        assertThat(limiter.allow("user-1", 3, 60)).isTrue();
        assertThat(limiter.allow("user-1", 3, 60)).isTrue();
    }

    @Test
    void allowBlocksRequestsExceedingWindowLimit() {
        ApiRateLimiter limiter = new ApiRateLimiter();

        limiter.allow("user-2", 2, 60);
        limiter.allow("user-2", 2, 60);

        assertThat(limiter.allow("user-2", 2, 60)).isFalse();
    }

    @Test
    void allowResetsCounterAfterWindowExpires() {
        MutableClock clock = new MutableClock();
        ApiRateLimiter limiter = new ApiRateLimiter(FixedWindowRateLimitStore.inMemoryForTests(clock));

        limiter.allow("user-3", 2, 1);
        limiter.allow("user-3", 2, 1);
        assertThat(limiter.allow("user-3", 2, 1)).isFalse();

        clock.advance(Duration.ofSeconds(2));

        assertThat(limiter.allow("user-3", 2, 1)).isTrue();
    }

    @Test
    void evictStaleWindowsRemovesExpiredEntries() {
        MutableClock clock = new MutableClock();
        ApiRateLimiter limiter = new ApiRateLimiter(FixedWindowRateLimitStore.inMemoryForTests(clock));

        limiter.allow("stale-key", 10, 60);
        limiter.allow("fresh-key", 10, 60);
        clock.advance(Duration.ofSeconds(61));
        limiter.allow("fresh-key", 10, 60);

        invokeEvictStaleWindows(limiter, 60);

        assertThat(limiter.windowCount()).isEqualTo(1);
    }

    @Test
    void allowHandlesNullAndBlankKeyGracefully() {
        ApiRateLimiter limiter = new ApiRateLimiter();

        assertThat(limiter.allow(null, 5, 60)).isTrue();
        assertThat(limiter.allow("  ", 5, 60)).isTrue();
    }

    private void invokeEvictStaleWindows(ApiRateLimiter limiter, long windowSeconds) {
        try {
            java.lang.reflect.Method method = ApiRateLimiter.class.getDeclaredMethod("evictStaleWindows", long.class);
            method.setAccessible(true);
            method.invoke(limiter, windowSeconds);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
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
