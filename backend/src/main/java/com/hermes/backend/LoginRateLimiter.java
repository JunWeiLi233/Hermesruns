package com.hermes.backend;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

@Component
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS = 10;
    private static final long LOCKOUT_SECONDS = 900; // 15 minutes
    private static final String NAMESPACE = "login";

    private final LoginAttemptStore attemptStore;

    @Autowired
    public LoginRateLimiter(LoginAttemptStore attemptStore) {
        this.attemptStore = attemptStore;
    }

    public LoginRateLimiter() {
        this(LoginAttemptStore.inMemoryForTests(Clock.systemUTC()));
    }

    public boolean isBlocked(String key) {
        return attemptStore.isBlocked(NAMESPACE, key);
    }

    public void recordFailure(String key) {
        attemptStore.recordFailure(NAMESPACE, key, MAX_ATTEMPTS, Duration.ofSeconds(LOCKOUT_SECONDS));
    }

    public void recordSuccess(String key) {
        attemptStore.recordSuccess(NAMESPACE, key);
    }
}
