package com.hermes.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Limits password-reset abuse per client IP.
 * <p>
 * Uses the shared rate-limit store, which can be backed by Redis when enabled.
 * </p>
 */
@Component
public class PasswordResetLimiter {
    private static final int MAX_PER_WINDOW = 8;
    private static final long WINDOW_SECONDS = 3600L;
    private static final String NAMESPACE = "password-reset";

    private final FixedWindowRateLimitStore rateLimitStore;

    @Autowired
    public PasswordResetLimiter(FixedWindowRateLimitStore rateLimitStore) {
        this.rateLimitStore = rateLimitStore;
    }

    public PasswordResetLimiter() {
        this(FixedWindowRateLimitStore.inMemoryForTests(Clock.systemUTC()));
    }

    public boolean allow(String clientIp) {
        return rateLimitStore.allow(NAMESPACE, clientIp, MAX_PER_WINDOW, Duration.ofSeconds(WINDOW_SECONDS));
    }
}
