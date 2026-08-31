package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Component
public class LoginAttemptStore {
    private static final Logger log = LoggerFactory.getLogger(LoginAttemptStore.class);

    private record AttemptRecord(int count, Instant lockedUntil, Instant expiresAt) {}

    private final AppRedisProperties redisProperties;
    private final Supplier<StringRedisTemplate> redisTemplateSupplier;
    private final Clock clock;
    private final ConcurrentHashMap<String, AttemptRecord> localAttempts = new ConcurrentHashMap<>();
    private volatile boolean redisFailureLogged;

    @Autowired
    public LoginAttemptStore(
            AppRedisProperties redisProperties,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider
    ) {
        this(redisProperties, redisTemplateProvider::getIfAvailable, Clock.systemUTC());
    }

    private LoginAttemptStore(
            AppRedisProperties redisProperties,
            Supplier<StringRedisTemplate> redisTemplateSupplier,
            Clock clock
    ) {
        this.redisProperties = redisProperties;
        this.redisTemplateSupplier = redisTemplateSupplier;
        this.clock = clock;
    }

    static LoginAttemptStore inMemoryForTests(Clock clock) {
        return new LoginAttemptStore(AppRedisProperties.disabledForTests(), () -> null, clock);
    }

    public boolean isBlocked(String namespace, String key) {
        Boolean redisBlocked = isBlockedRedis(namespace, key);
        if (redisBlocked != null) {
            return redisBlocked;
        }
        return isBlockedLocal(namespace, key);
    }

    public void recordFailure(String namespace, String key, int maxAttempts, Duration lockout) {
        if (maxAttempts <= 0) {
            return;
        }
        if (recordFailureRedis(namespace, key, maxAttempts, normalizeLockout(lockout))) {
            return;
        }
        recordFailureLocal(namespace, key, maxAttempts, normalizeLockout(lockout));
    }

    public void recordSuccess(String namespace, String key) {
        if (!recordSuccessRedis(namespace, key)) {
            localAttempts.remove(localKey(namespace, key));
        }
    }

    private Boolean isBlockedRedis(String namespace, String key) {
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return null;
        }
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(redisKey(namespace, key, "locked")));
        } catch (RuntimeException e) {
            logRedisFailure(e);
            return null;
        }
    }

    private boolean recordFailureRedis(String namespace, String key, int maxAttempts, Duration lockout) {
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return false;
        }
        try {
            String countKey = redisKey(namespace, key, "count");
            String lockedKey = redisKey(namespace, key, "locked");
            Long count = redisTemplate.opsForValue().increment(countKey);
            redisTemplate.expire(countKey, lockout);
            if (count != null && count >= maxAttempts) {
                redisTemplate.opsForValue().set(lockedKey, "1", lockout);
            }
            return true;
        } catch (RuntimeException e) {
            logRedisFailure(e);
            return false;
        }
    }

    private boolean recordSuccessRedis(String namespace, String key) {
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return false;
        }
        try {
            redisTemplate.delete(List.of(redisKey(namespace, key, "count"), redisKey(namespace, key, "locked")));
            return true;
        } catch (RuntimeException e) {
            logRedisFailure(e);
            return false;
        }
    }

    private boolean isBlockedLocal(String namespace, String key) {
        String localKey = localKey(namespace, key);
        AttemptRecord record = localAttempts.get(localKey);
        if (record == null) return false;
        if (record.lockedUntil() != null && clock.instant().isBefore(record.lockedUntil())) {
            return true;
        }
        if (record.lockedUntil() != null && !clock.instant().isBefore(record.lockedUntil())) {
            localAttempts.remove(localKey);
        }
        return false;
    }

    private void recordFailureLocal(String namespace, String key, int maxAttempts, Duration lockout) {
        Instant now = clock.instant();
        localAttempts.compute(localKey(namespace, key), (ignored, existing) -> {
            int count = existing == null ? 1 : existing.count() + 1;
            Instant lockedUntil = count >= maxAttempts ? now.plus(lockout) : null;
            // Mirrors the Redis fallback, which re-arms the count-key TTL on every
            // failure: an entry untouched for a full lockout is stale and may be
            // swept so the local map cannot grow without bound.
            return new AttemptRecord(count, lockedUntil, now.plus(lockout));
        });
    }

    @Scheduled(fixedDelay = 300_000)
    void sweepExpiredLocalAttempts() {
        Instant now = clock.instant();
        for (Map.Entry<String, AttemptRecord> entry : localAttempts.entrySet()) {
            if (now.isAfter(entry.getValue().expiresAt())) {
                // Two-arg remove: if a concurrent failure re-armed the record between the
                // read above and this removal, the mapped value no longer matches and the
                // fresh record is kept instead of being silently dropped.
                localAttempts.remove(entry.getKey(), entry.getValue());
            }
        }
    }

    int localAttemptSizeForTests() {
        return localAttempts.size();
    }

    private StringRedisTemplate redisTemplate() {
        if (!redisProperties.isEnabled()) {
            return null;
        }
        return redisTemplateSupplier.get();
    }

    private String redisKey(String namespace, String key, String suffix) {
        return RedisKeySupport.key(redisProperties.keyPrefix(), "login", namespace, key, suffix);
    }

    private void logRedisFailure(RuntimeException e) {
        if (!redisFailureLogged) {
            redisFailureLogged = true;
            log.warn("Redis login-attempt store unavailable; falling back to local memory: {}", e.getMessage());
        }
    }

    private static Duration normalizeLockout(Duration lockout) {
        if (lockout == null || lockout.isZero() || lockout.isNegative()) {
            return Duration.ofMinutes(15);
        }
        return lockout;
    }

    private static String localKey(String namespace, String key) {
        String ns = namespace == null || namespace.isBlank() ? "default" : namespace.trim();
        String k = key == null || key.isBlank() ? "unknown" : key.trim();
        return ns + "\n" + k;
    }
}
