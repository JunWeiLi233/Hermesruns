package com.hermes.backend;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS = 10;
    private static final long LOCKOUT_SECONDS = 900; // 15 minutes

    private record AttemptRecord(int count, Instant lockedUntil) {}

    private final ConcurrentHashMap<String, AttemptRecord> attempts = new ConcurrentHashMap<>();

    public boolean isBlocked(String key) {
        AttemptRecord record = attempts.get(key);
        if (record == null) return false;
        if (record.lockedUntil() != null && Instant.now().isBefore(record.lockedUntil())) {
            return true;
        }
        if (record.lockedUntil() != null && Instant.now().isAfter(record.lockedUntil())) {
            attempts.remove(key);
        }
        return false;
    }

    public void recordFailure(String key) {
        attempts.compute(key, (k, existing) -> {
            int count = existing == null ? 1 : existing.count() + 1;
            Instant lockout = count >= MAX_ATTEMPTS
                    ? Instant.now().plusSeconds(LOCKOUT_SECONDS)
                    : null;
            return new AttemptRecord(count, lockout);
        });
    }

    public void recordSuccess(String key) {
        attempts.remove(key);
    }
}
