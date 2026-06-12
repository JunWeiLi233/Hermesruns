package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Component
public class TtlCacheStore {
    private static final Logger log = LoggerFactory.getLogger(TtlCacheStore.class);

    private record LocalEntry(String json, Instant expiresAt) {}

    private final AppRedisProperties redisProperties;
    private final Supplier<StringRedisTemplate> redisTemplateSupplier;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final ConcurrentHashMap<String, LocalEntry> localEntries = new ConcurrentHashMap<>();
    private volatile boolean redisFailureLogged;

    @Autowired
    public TtlCacheStore(
            AppRedisProperties redisProperties,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            ObjectMapper objectMapper
    ) {
        this(redisProperties, redisTemplateProvider::getIfAvailable, objectMapper, Clock.systemUTC());
    }

    private TtlCacheStore(
            AppRedisProperties redisProperties,
            Supplier<StringRedisTemplate> redisTemplateSupplier,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this.redisProperties = redisProperties;
        this.redisTemplateSupplier = redisTemplateSupplier;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    static TtlCacheStore inMemoryForTests(ObjectMapper objectMapper, Clock clock) {
        objectMapper.findAndRegisterModules();
        return new TtlCacheStore(AppRedisProperties.disabledForTests(), () -> null, objectMapper, clock);
    }

    public <T> Optional<T> get(String namespace, String key, Class<T> type) {
        String json = getJson(namespace, key);
        if (json == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(objectMapper.readValue(json, type));
        } catch (Exception e) {
            evict(namespace, key);
            log.warn("Failed to deserialize cache entry namespace={} key={}: {}", namespace, key, e.getMessage());
            return Optional.empty();
        }
    }

    public <T> Optional<T> get(String namespace, String key, TypeReference<T> typeReference) {
        String json = getJson(namespace, key);
        if (json == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(objectMapper.readValue(json, typeReference));
        } catch (Exception e) {
            evict(namespace, key);
            log.warn("Failed to deserialize cache entry namespace={} key={}: {}", namespace, key, e.getMessage());
            return Optional.empty();
        }
    }

    public void put(String namespace, String key, Object value, Duration ttl) {
        if (value == null) {
            evict(namespace, key);
            return;
        }
        Duration normalizedTtl = normalizeTtl(ttl);
        try {
            String json = objectMapper.writeValueAsString(value);
            String localKey = localKey(namespace, key);
            localEntries.put(localKey, new LocalEntry(json, clock.instant().plus(normalizedTtl)));
            putRedis(namespace, key, json, normalizedTtl);
        } catch (Exception e) {
            log.warn("Failed to serialize cache entry namespace={} key={}: {}", namespace, key, e.getMessage());
        }
    }

    public void evict(String namespace, String key) {
        localEntries.remove(localKey(namespace, key));
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return;
        }
        try {
            redisTemplate.delete(redisKey(namespace, key));
        } catch (RuntimeException e) {
            logRedisFailure(e);
        }
    }

    void forceExpireLocalForTests(String namespace, String key) {
        localEntries.computeIfPresent(localKey(namespace, key), (ignored, entry) -> new LocalEntry(entry.json(), Instant.EPOCH));
    }

    private String getJson(String namespace, String key) {
        String redisJson = getRedis(namespace, key);
        if (redisJson != null) {
            return redisJson;
        }
        return getLocal(namespace, key);
    }

    private String getRedis(String namespace, String key) {
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return null;
        }
        try {
            return redisTemplate.opsForValue().get(redisKey(namespace, key));
        } catch (RuntimeException e) {
            logRedisFailure(e);
            return null;
        }
    }

    private void putRedis(String namespace, String key, String json, Duration ttl) {
        StringRedisTemplate redisTemplate = redisTemplate();
        if (redisTemplate == null) {
            return;
        }
        try {
            redisTemplate.opsForValue().set(redisKey(namespace, key), json, ttl);
        } catch (RuntimeException e) {
            logRedisFailure(e);
        }
    }

    private String getLocal(String namespace, String key) {
        String localKey = localKey(namespace, key);
        LocalEntry entry = localEntries.get(localKey);
        if (entry == null) {
            return null;
        }
        if (clock.instant().isAfter(entry.expiresAt())) {
            localEntries.remove(localKey);
            return null;
        }
        return entry.json();
    }

    private StringRedisTemplate redisTemplate() {
        if (!redisProperties.isEnabled()) {
            return null;
        }
        return redisTemplateSupplier.get();
    }

    private String redisKey(String namespace, String key) {
        return RedisKeySupport.key(redisProperties.keyPrefix(), "cache", namespace, key);
    }

    private void logRedisFailure(RuntimeException e) {
        if (!redisFailureLogged) {
            redisFailureLogged = true;
            log.warn("Redis TTL cache store unavailable; falling back to local memory: {}", e.getMessage());
        }
    }

    private static Duration normalizeTtl(Duration ttl) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            return Duration.ofSeconds(1);
        }
        return ttl;
    }

    private static String localKey(String namespace, String key) {
        String ns = namespace == null || namespace.isBlank() ? "default" : namespace.trim();
        String k = key == null || key.isBlank() ? "unknown" : key.trim();
        return ns + "\n" + k;
    }
}
