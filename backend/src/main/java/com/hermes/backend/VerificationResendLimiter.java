package com.hermes.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * Limits resend-verification abuse per client IP.
 */
@Component
public class VerificationResendLimiter {

    private static final int MAX_PER_WINDOW = 12;
    private static final long WINDOW_SECONDS = 3600L;
    private static final String NAMESPACE = "verification-resend";

    private final FixedWindowRateLimitStore rateLimitStore;

    @Autowired
    public VerificationResendLimiter(FixedWindowRateLimitStore rateLimitStore) {
        this.rateLimitStore = rateLimitStore;
    }

    public VerificationResendLimiter() {
        this(FixedWindowRateLimitStore.inMemoryForTests(Clock.systemUTC()));
    }

    public boolean allow(String clientIp) {
        return rateLimitStore.allow(NAMESPACE, clientIp, MAX_PER_WINDOW, Duration.ofSeconds(WINDOW_SECONDS));
    }
}
