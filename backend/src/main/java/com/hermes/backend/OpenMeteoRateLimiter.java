package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks open-meteo rate-limit state across all calling services.
 * <p>
 * When open-meteo returns 429, this limiter records the event and applies
 * exponential backoff: 30s, 5m, 30m. While throttled, all callers receive
 * {@code false} from {@link #shouldThrottle(String)} so no outbound HTTP
 * call is attempted.
 * </p>
 * <p>
 * A successful API response resets the throttle so normal operation resumes
 * as soon as open-meteo recovers.
 * </p>
 */
@Component
public class OpenMeteoRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(OpenMeteoRateLimiter.class);

    /**
     * Maximum age for a throttle state after its retry-after window expires.
     * Prevents stale entries from accumulating indefinitely when the scheduler
     * is idle or the API call path is not exercised.
     */
    static final long STALE_STATE_MAX_AGE_SECONDS = 3600; // 1 hour

    private final ConcurrentHashMap<String, ThrottleState> states = new ConcurrentHashMap<>();
    private final Clock clock;

    public OpenMeteoRateLimiter() {
        this(Clock.systemUTC());
    }

    OpenMeteoRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Returns {@code true} when the named endpoint is currently throttled
     * and callers should skip the outbound HTTP call.
     * <p>
     * When the backoff window expires the state is kept so that a subsequent
     * 429 escalates the backoff rather than restarting from the base delay.
     * A successful API response via {@link #recordSuccess(String)} clears the state.
     * Stale states (expired for more than 1 hour) are automatically removed.
     * </p>
     */
    public boolean shouldThrottle(String endpoint) {
        ThrottleState state = states.get(key(endpoint));
        if (state == null) {
            return false;
        }
        if (!clock.instant().isBefore(state.retryAfter)) {
            // Backoff window expired (or at boundary). If the state is stale (no activity for 1h+), clean it up.
            if (clock.instant().isAfter(state.retryAfter.plusSeconds(STALE_STATE_MAX_AGE_SECONDS))) {
                states.remove(key(endpoint));
            }
            return false;
        }
        return true;
    }

    /**
     * Record a 429 response and escalate the backoff level.
     */
    public void recordRateLimited(String endpoint) {
        states.compute(key(endpoint), (k, existing) -> {
            int count = (existing != null) ? existing.consecutiveCount + 1 : 1;
            long delaySec = backoffSeconds(count);
            Instant retryAfter = clock.instant().plusSeconds(delaySec);
            log.warn("Open-Meteo {} API returned 429 — backing off {}s (consecutive 429 count: {})",
                    endpoint, delaySec, count);
            return new ThrottleState(count, retryAfter);
        });
    }

    /**
     * Clear throttle after a successful API response so normal traffic resumes.
     */
    public void recordSuccess(String endpoint) {
        ThrottleState removed = states.remove(key(endpoint));
        if (removed != null) {
            log.info("Open-Meteo {} API recovered after {} consecutive 429s", endpoint, removed.consecutiveCount);
        }
    }

    /**
     * Package-visible for test assertions.
     */
    boolean isThrottled(String endpoint) {
        return shouldThrottle(endpoint);
    }

    /**
     * Exponential backoff schedule.
     */
    static long backoffSeconds(int consecutive429Count) {
        if (consecutive429Count <= 1) return 30;
        if (consecutive429Count == 2) return 300;   // 5 minutes
        return 1800; // 30 minutes (capped)
    }

    private static String key(String endpoint) {
        return endpoint == null || endpoint.isBlank() ? "default" : endpoint.trim();
    }

    private record ThrottleState(int consecutiveCount, Instant retryAfter) {}
}
