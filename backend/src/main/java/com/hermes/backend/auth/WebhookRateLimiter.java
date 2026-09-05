package com.hermes.backend.auth;

import com.hermes.backend.infrastructure.cache.FixedWindowRateLimitStore;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Simple per-IP rate limit for unauthenticated webhook endpoints (abuse / DoS mitigation).
 */
@Component
public class WebhookRateLimiter {

    private static final int MAX_REQUESTS = 120;
    private static final long WINDOW_MS = 60_000L;
    private static final String NAMESPACE = "webhook";

    private final FixedWindowRateLimitStore rateLimitStore;

    @Autowired
    public WebhookRateLimiter(FixedWindowRateLimitStore rateLimitStore) {
        this.rateLimitStore = rateLimitStore;
    }

    public WebhookRateLimiter() {
        this(FixedWindowRateLimitStore.inMemoryForTests(Clock.systemUTC()));
    }

    public boolean allow(String clientIp) {
        return rateLimitStore.allow(NAMESPACE, clientIp, MAX_REQUESTS, Duration.ofMillis(WINDOW_MS));
    }
}
