package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limits resend-verification abuse per client IP.
 */
@Component
public class VerificationResendLimiter {

    private static final int MAX_PER_WINDOW = 12;
    private static final long WINDOW_SECONDS = 3600L;

    private static final class Counter {
        int count;
        long windowStartEpochSec;
    }

    private final ConcurrentHashMap<String, Counter> byIp = new ConcurrentHashMap<>();

    public boolean allow(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = "unknown";
        }
        String ip = clientIp;
        long now = Instant.now().getEpochSecond();
        Counter c = byIp.computeIfAbsent(ip, k -> new Counter());
        synchronized (c) {
            if (now - c.windowStartEpochSec > WINDOW_SECONDS) {
                c.count = 0;
                c.windowStartEpochSec = now;
            }
            if (c.count >= MAX_PER_WINDOW) {
                return false;
            }
            c.count++;
            return true;
        }
    }
}
