package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Component
public class FixedWindowRateLimitStore {
    private static final Logger log = LoggerFactory.getLogger(FixedWindowRateLimitStore.class);
    private static final int MAX_LOCAL_WINDOWS = 50_000;

    private static final class Window {
        int count;
        long windowStartEpochSec;
    }

    private final AppRedisProperties redisProperties;
    private final Supplier<StringRedisTemplate> redisTemplateSupplier;
    private final Clock clock;
    private final ConcurrentHashMap<String, Window> localWindows = new ConcurrentHashMap<>();
    private volatile boolean redisFailureLogged;

    @Autowired
    public FixedWindowRateLimitStore(
            AppRedisProperties redisProperties,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider
    ) {
        this(redisProperties, redisTemplateProvider::getIfAvailable, Clock.systemUTC());
    }

    private FixedWindowRateLimitStore(
            AppRedisProperties redisProperties,
            Supplier<StringRedisTemplate> redisTemplateSupplier,
            Clock clock
    ) {
        this.redisProperties = redisProperties;
        this.redisTemplateSupplier = redisTemplateSupplier;
        this.clock = clock;
    }

    static FixedWindowRateLimitStore inMemoryForTests(Clock clock) {
        return new FixedWindowRateLimitStore(AppRedisProperties.disabledForTests(), () -> null, clock);
    }

    public boolean allow(String namespace, String key, int maxPerWindow, Duration window) {
        if (maxPerWindow <= 0) {
            return false;
        }
        Duration normalizedWindow = normalizeWindow(window);
        Long redisCount = incrementRedis(namespace, key, normalizedWindow);
        if (redisCount != null) {
            return redisCount <= maxPerWindow;
        }
        return allowLocal(namespace, key, maxPerWindow, normalizedWindow);
    }

    private Long incrementRedis(String namespace, String key, Duration window) {
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return null;
        }
        long windowSeconds = window.toSeconds();
        long now = clock.instant().getEpochSecond();
        long bucketStart = now - (now % windowSeconds);
        String redisKey = RedisKeySupport.key(
                redisProperties.keyPrefix(),
                "rate",
                namespace,
                key,
                String.valueOf(bucketStart)
        );
        try {
            Long count = redisTemplate.opsForValue().increment(redisKey);
            if (count != null && count == 1L) {
                redisTemplate.expire(redisKey, window.plusSeconds(5));
            }
            return count;
        } catch (RuntimeException e) {
            logRedisFailure(e);
            return null;
        }
    }

    private boolean allowLocal(String namespace, String key, int maxPerWindow, Duration window) {
        if (localWindows.size() > MAX_LOCAL_WINDOWS) {
            evictStaleWindows(window);
        }

        Window current = localWindows.computeIfAbsent(localKey(namespace, key), ignored -> new Window());
        long now = clock.instant().getEpochSecond();
        synchronized (current) {
            if (now - current.windowStartEpochSec >= window.toSeconds()) {
                current.count = 0;
                current.windowStartEpochSec = now;
            }
            if (current.count >= maxPerWindow) {
                return false;
            }
            current.count++;
            return true;
        }
    }

    void evictStaleWindows(Duration window) {
        long now = clock.instant().getEpochSecond();
        long windowSeconds = normalizeWindow(window).toSeconds();
        localWindows.entrySet().removeIf(entry -> {
            Window stored = entry.getValue();
            synchronized (stored) {
                return now - stored.windowStartEpochSec >= windowSeconds;
            }
        });
    }

    int localWindowCountForTests() {
        return localWindows.size();
    }

    private StringRedisTemplate redisTemplate() {
        if (!redisProperties.isEnabled()) {
            return null;
        }
        return redisTemplateSupplier.get();
    }

    private void logRedisFailure(RuntimeException e) {
        if (!redisFailureLogged) {
            redisFailureLogged = true;
            log.warn("Redis rate-limit store unavailable; falling back to local memory: {}", e.getMessage());
        }
    }

    private static Duration normalizeWindow(Duration window) {
        if (window == null || window.isZero() || window.isNegative()) {
            return Duration.ofSeconds(1);
        }
        return window.toSeconds() <= 0 ? Duration.ofSeconds(1) : window;
    }

    private static String localKey(String namespace, String key) {
        String ns = namespace == null || namespace.isBlank() ? "default" : namespace.trim();
        String k = key == null || key.isBlank() ? "unknown" : key.trim();
        return ns + "\n" + k;
    }
}
