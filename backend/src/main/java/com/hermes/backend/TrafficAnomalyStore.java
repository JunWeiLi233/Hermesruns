package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Component
public class TrafficAnomalyStore {
    private static final Logger log = LoggerFactory.getLogger(TrafficAnomalyStore.class);

    private static final class LocalCounter {
        long windowStartEpochSec;
        long any;
        long s4xx;
        long s429;
        long s5xx;
        boolean warned;
    }

    public record Snapshot(long any, long s4xx, long s429, long s5xx, boolean warning) {}

    private final AppRedisProperties redisProperties;
    private final Supplier<StringRedisTemplate> redisTemplateSupplier;
    private final Clock clock;
    private final ConcurrentHashMap<String, LocalCounter> localCounters = new ConcurrentHashMap<>();
    private volatile boolean redisFailureLogged;

    @Autowired
    public TrafficAnomalyStore(
            AppRedisProperties redisProperties,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider
    ) {
        this(redisProperties, redisTemplateProvider::getIfAvailable, Clock.systemUTC());
    }

    private TrafficAnomalyStore(
            AppRedisProperties redisProperties,
            Supplier<StringRedisTemplate> redisTemplateSupplier,
            Clock clock
    ) {
        this.redisProperties = redisProperties;
        this.redisTemplateSupplier = redisTemplateSupplier;
        this.clock = clock;
    }

    static TrafficAnomalyStore inMemoryForTests(Clock clock) {
        return new TrafficAnomalyStore(AppRedisProperties.disabledForTests(), () -> null, clock);
    }

    public Snapshot record(
            String ip,
            int status,
            Duration window,
            int warn4xxPerWindow,
            int warn429PerWindow,
            int warn5xxPerWindow
    ) {
        Duration normalizedWindow = normalizeWindow(window);
        Snapshot redisSnapshot = recordRedis(ip, status, normalizedWindow, warn4xxPerWindow, warn429PerWindow, warn5xxPerWindow);
        if (redisSnapshot != null) {
            return redisSnapshot;
        }
        return recordLocal(ip, status, normalizedWindow, warn4xxPerWindow, warn429PerWindow, warn5xxPerWindow);
    }

    private Snapshot recordRedis(
            String ip,
            int status,
            Duration window,
            int warn4xxPerWindow,
            int warn429PerWindow,
            int warn5xxPerWindow
    ) {
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return null;
        }
        long windowSeconds = window.toSeconds();
        long now = clock.instant().getEpochSecond();
        long bucketStart = now - (now % windowSeconds);
        String bucket = String.valueOf(bucketStart);
        try {
            long any = increment(redisTemplate, ip, bucket, "any", window);
            long s4xx = count(redisTemplate, ip, bucket, "4xx");
            long s429 = count(redisTemplate, ip, bucket, "429");
            long s5xx = count(redisTemplate, ip, bucket, "5xx");

            if (status >= 500) {
                s5xx = increment(redisTemplate, ip, bucket, "5xx", window);
            } else if (status == 429) {
                s429 = increment(redisTemplate, ip, bucket, "429", window);
            } else if (status >= 400) {
                s4xx = increment(redisTemplate, ip, bucket, "4xx", window);
            }

            boolean thresholdCrossed = s4xx >= warn4xxPerWindow || s429 >= warn429PerWindow || s5xx >= warn5xxPerWindow;
            boolean firstWarning = false;
            if (thresholdCrossed) {
                String warnedKey = redisKey(ip, bucket, "warned");
                firstWarning = Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(warnedKey, "1", window.plusSeconds(5)));
            }
            return new Snapshot(any, s4xx, s429, s5xx, firstWarning);
        } catch (RuntimeException e) {
            logRedisFailure(e);
            return null;
        }
    }

    private long increment(StringRedisTemplate redisTemplate, String ip, String bucket, String suffix, Duration window) {
        String key = redisKey(ip, bucket, suffix);
        Long value = redisTemplate.opsForValue().increment(key);
        if (value != null && value == 1L) {
            redisTemplate.expire(key, window.plusSeconds(5));
        }
        return value == null ? 0L : value;
    }

    private long count(StringRedisTemplate redisTemplate, String ip, String bucket, String suffix) {
        String value = redisTemplate.opsForValue().get(redisKey(ip, bucket, suffix));
        if (value == null || value.isBlank()) {
            return 0L;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private Snapshot recordLocal(
            String ip,
            int status,
            Duration window,
            int warn4xxPerWindow,
            int warn429PerWindow,
            int warn5xxPerWindow
    ) {
        String key = ip == null || ip.isBlank() ? "unknown" : ip.trim();
        LocalCounter counter = localCounters.computeIfAbsent(key, ignored -> new LocalCounter());
        long now = clock.instant().getEpochSecond();
        synchronized (counter) {
            if (now - counter.windowStartEpochSec >= window.toSeconds()) {
                counter.windowStartEpochSec = now;
                counter.any = 0;
                counter.s4xx = 0;
                counter.s429 = 0;
                counter.s5xx = 0;
                counter.warned = false;
            }

            counter.any++;
            if (status >= 500) counter.s5xx++;
            else if (status == 429) counter.s429++;
            else if (status >= 400) counter.s4xx++;

            boolean thresholdCrossed = counter.s4xx >= warn4xxPerWindow
                    || counter.s429 >= warn429PerWindow
                    || counter.s5xx >= warn5xxPerWindow;
            boolean firstWarning = thresholdCrossed && !counter.warned;
            if (firstWarning) {
                counter.warned = true;
            }
            return new Snapshot(counter.any, counter.s4xx, counter.s429, counter.s5xx, firstWarning);
        }
    }

    private StringRedisTemplate redisTemplate() {
        if (!redisProperties.isEnabled()) {
            return null;
        }
        return redisTemplateSupplier.get();
    }

    private String redisKey(String ip, String bucket, String suffix) {
        return RedisKeySupport.key(redisProperties.keyPrefix(), "traffic", bucket, ip, suffix);
    }

    private void logRedisFailure(RuntimeException e) {
        if (!redisFailureLogged) {
            redisFailureLogged = true;
            log.warn("Redis traffic-anomaly store unavailable; falling back to local memory: {}", e.getMessage());
        }
    }

    private static Duration normalizeWindow(Duration window) {
        if (window == null || window.isZero() || window.isNegative()) {
            return Duration.ofSeconds(1);
        }
        return window.toSeconds() <= 0 ? Duration.ofSeconds(1) : window;
    }
}
