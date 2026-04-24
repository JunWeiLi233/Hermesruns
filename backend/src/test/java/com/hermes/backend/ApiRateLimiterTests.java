package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

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
        boolean overLimit = limiter.allow("user-2", 2, 60);

        assertThat(overLimit).isFalse();
    }

    @Test
    void allowResetsCounterAfterWindowExpires() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        limiter.allow("user-3", 2, 1);
        limiter.allow("user-3", 2, 1);
        assertThat(limiter.allow("user-3", 2, 1)).isFalse(); // over limit

        // backdate the window start to simulate expiry
        backdateWindowStart("user-3", limiter, 2);

        assertThat(limiter.allow("user-3", 2, 1)).isTrue(); // new window
    }

    @Test
    void evictStaleWindowsRemovesOnlyExpiredEntries() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        // create two entries
        limiter.allow("stale-key", 10, 60);
        limiter.allow("fresh-key", 10, 60);

        // backdate only the stale key
        backdateWindowStart("stale-key", limiter, 61);

        int beforeEviction = limiter.windowCount();
        // trigger eviction by invoking allow with size check bypassed via reflection
        invokeEvictStaleWindows(limiter, 60);

        int afterEviction = limiter.windowCount();
        assertThat(afterEviction).isLessThan(beforeEviction);
        assertThat(afterEviction).isEqualTo(1); // only fresh-key survives
    }

    @Test
    void evictStaleWindowsKeepsFreshEntries() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        limiter.allow("keep-key", 5, 120);

        int before = limiter.windowCount();
        invokeEvictStaleWindows(limiter, 120);
        int after = limiter.windowCount();

        assertThat(after).isEqualTo(before); // nothing removed
    }

    @Test
    void allowStillEnforcesLimitAfterEviction() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        limiter.allow("evict-then-check", 2, 60);
        limiter.allow("evict-then-check", 2, 60);
        assertThat(limiter.allow("evict-then-check", 2, 60)).isFalse();

        backdateWindowStart("evict-then-check", limiter, 61);
        invokeEvictStaleWindows(limiter, 60);

        // after eviction the key is gone; allow recreates a fresh window
        assertThat(limiter.allow("evict-then-check", 2, 60)).isTrue();
    }

    @Test
    void allowHandlesNullAndBlankKeyGracefully() {
        ApiRateLimiter limiter = new ApiRateLimiter();

        assertThat(limiter.allow(null, 5, 60)).isTrue();
        assertThat(limiter.allow("  ", 5, 60)).isTrue();
    }

    @Test
    void windowCountDoesNotGrowUnboundedAfterManyDistinctKeys() throws Exception {
        ApiRateLimiter limiter = new ApiRateLimiter();

        // add many keys and backdate them all so eviction can remove them
        for (int i = 0; i < 20; i++) {
            limiter.allow("key-" + i, 10, 60);
            backdateWindowStart("key-" + i, limiter, 61);
        }

        invokeEvictStaleWindows(limiter, 60);

        assertThat(limiter.windowCount()).isEqualTo(0);
    }

    // --- reflection helpers ---

    @SuppressWarnings("unchecked")
    private ConcurrentHashMap<String, Object> getWindows(ApiRateLimiter limiter) throws Exception {
        Field f = ApiRateLimiter.class.getDeclaredField("windows");
        f.setAccessible(true);
        return (ConcurrentHashMap<String, Object>) f.get(limiter);
    }

    private void backdateWindowStart(String key, ApiRateLimiter limiter, long secondsBack) throws Exception {
        ConcurrentHashMap<String, Object> windows = getWindows(limiter);
        Object window = windows.get(key);
        if (window == null) return;
        Field windowStart = window.getClass().getDeclaredField("windowStartEpochSec");
        windowStart.setAccessible(true);
        long staleTime = Instant.now().getEpochSecond() - secondsBack;
        windowStart.set(window, staleTime);
    }

    private void invokeEvictStaleWindows(ApiRateLimiter limiter, long windowSeconds) throws Exception {
        java.lang.reflect.Method m = ApiRateLimiter.class.getDeclaredMethod("evictStaleWindows", long.class);
        m.setAccessible(true);
        m.invoke(limiter, windowSeconds);
    }
}
