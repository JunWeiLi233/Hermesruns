package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.cache.FixedWindowRateLimitStore;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Simple fixed-window rate limiter.
 * <p>
 * Uses the shared rate-limit store, which can be backed by Redis when enabled
 * and otherwise falls back to local memory for development and single-instance runs.
 * </p>
 */
@Component
public class ApiRateLimiter {
    private final FixedWindowRateLimitStore rateLimitStore;

    @Autowired
    public ApiRateLimiter(FixedWindowRateLimitStore rateLimitStore) {
        this.rateLimitStore = rateLimitStore;
    }

    public ApiRateLimiter() {
        this(FixedWindowRateLimitStore.inMemoryForTests(Clock.systemUTC()));
    }

    public boolean allow(String key, int maxPerWindow, long windowSeconds) {
        return rateLimitStore.allow("api", key, maxPerWindow, Duration.ofSeconds(Math.max(1L, windowSeconds)));
    }

    private void evictStaleWindows(long windowSeconds) {
        rateLimitStore.evictStaleWindows(Duration.ofSeconds(Math.max(1L, windowSeconds)));
    }

    public int windowCount() {
        return rateLimitStore.localWindowCountForTests();
    }
}

