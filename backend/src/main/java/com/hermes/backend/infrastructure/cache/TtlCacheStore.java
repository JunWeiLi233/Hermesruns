package com.hermes.backend.infrastructure.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Optional;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class TtlCacheStore {
    private static final Logger log = LoggerFactory.getLogger(TtlCacheStore.class);

    private record LocalEntry(String json, Instant expiresAt) {}

    private final AppRedisProperties redisProperties;
    private final Supplier<StringRedisTemplate> redisTemplateSupplier;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    // Bounded LRU fallback: without the entry cap this map grew monotonically
    // (expired entries were only removed when their exact key was read again),
    // which showed up as multi-hundred-MB heap growth on long-lived instances.
    private final BoundedLocalCache localEntries;
    // Local-fallback value-size cap: the entry cap bounds COUNT, not BYTES, and
    // raw Overpass responses cached 12h by RoutePlannerService are multi-MB JSON
    // strings each. Oversized values skip LOCAL retention only — Redis (when
    // enabled) still receives them and callers already hold the value they put.
    private final int localMaxValueBytes;
    private volatile boolean redisFailureLogged;
    private volatile boolean localValueSkipLogged;

    @Autowired
    public TtlCacheStore(
            AppRedisProperties redisProperties,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            ObjectMapper objectMapper,
            @Value("${app.cache.local-max-entries:1024}") int localMaxEntries,
            @Value("${app.cache.local-max-value-bytes:1048576}") int localMaxValueBytes
    ) {
        this(redisProperties, redisTemplateProvider::getIfAvailable, objectMapper, Clock.systemUTC(),
                localMaxEntries, localMaxValueBytes);
    }

    private TtlCacheStore(
            AppRedisProperties redisProperties,
            Supplier<StringRedisTemplate> redisTemplateSupplier,
            ObjectMapper objectMapper,
            Clock clock,
            int localMaxEntries,
            int localMaxValueBytes
    ) {
        this.redisProperties = redisProperties;
        this.redisTemplateSupplier = redisTemplateSupplier;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.localEntries = new BoundedLocalCache(Math.max(1, localMaxEntries));
        this.localMaxValueBytes = Math.max(1, localMaxValueBytes);
    }

    public static TtlCacheStore inMemoryForTests(ObjectMapper objectMapper, Clock clock) {
        return inMemoryForTests(objectMapper, clock, 1024);
    }

    public static TtlCacheStore inMemoryForTests(ObjectMapper objectMapper, Clock clock, int localMaxEntries) {
        return inMemoryForTests(objectMapper, clock, localMaxEntries, 1_048_576);
    }

    public static TtlCacheStore inMemoryForTests(ObjectMapper objectMapper, Clock clock, int localMaxEntries, int localMaxValueBytes) {
        objectMapper.findAndRegisterModules();
        return new TtlCacheStore(AppRedisProperties.disabledForTests(), () -> null, objectMapper, clock,
                localMaxEntries, localMaxValueBytes);
    }

    static TtlCacheStore redisBackedForTests(
            ObjectMapper objectMapper,
            Clock clock,
            Supplier<StringRedisTemplate> redisTemplateSupplier,
            int localMaxValueBytes
    ) {
        objectMapper.findAndRegisterModules();
        return new TtlCacheStore(new AppRedisProperties(true, "hermes-test"), redisTemplateSupplier, objectMapper, clock,
                1024, localMaxValueBytes);
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
            // Value-size guard, local fallback only. Size is approximated with
            // the serialized String's length() (chars ~ bytes, a lower bound
            // for non-ASCII content); an oversized value skips local retention
            // but still flows to Redis below.
            if (json.length() <= localMaxValueBytes) {
                localEntries.put(localKey, new LocalEntry(json, clock.instant().plus(normalizedTtl)));
            } else {
                // Last-write-wins locally: drop any stale entry so reads can't
                // keep serving the previous (smaller) value after an oversized
                // overwrite.
                localEntries.remove(localKey);
                logLocalValueSkip(namespace, key, json.length());
            }
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

    /**
     * True when entries can survive this process (Redis reachable). Callers that
     * already keep their own bounded in-memory copy of a payload can use this
     * to skip storing a second serialized copy here.
     */
    public boolean hasDurableBacking() {
        return redisTemplate() != null;
    }

    @Scheduled(fixedDelay = 300_000)
    void sweepExpiredLocalEntries() {
        Instant now = clock.instant();
        localEntries.removeExpired(now);
    }

    void forceExpireLocalForTests(String namespace, String key) {
        localEntries.forceExpire(localKey(namespace, key));
    }

    public int localEntrySizeForTests() {
        return localEntries.size();
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
        return localEntries.getIfFresh(localKey(namespace, key), clock.instant());
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

    private void logLocalValueSkip(String namespace, String key, int serializedLength) {
        if (!localValueSkipLogged) {
            localValueSkipLogged = true;
            log.debug("Local TTL cache value-size cap ({} chars) exceeded for namespace={} key={} size={}; "
                    + "skipping local retention only, Redis path unaffected",
                    localMaxValueBytes, namespace, key, serializedLength);
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

    /**
     * Access-ordered LRU with a hard entry cap. Synchronized is enough here:
     * operations are short map mutations, far below the HTTP fetch latencies
     * the callers already tolerate.
     */
    private static final class BoundedLocalCache {
        private final int maxEntries;
        private final LinkedHashMap<String, LocalEntry> entries;

        BoundedLocalCache(int maxEntries) {
            this.maxEntries = maxEntries;
            this.entries = new LinkedHashMap<>(16, 0.75f, true);
        }

        synchronized void put(String key, LocalEntry entry) {
            entries.put(key, entry);
            while (entries.size() > maxEntries) {
                var oldest = entries.keySet().iterator().next();
                entries.remove(oldest);
            }
        }

        synchronized String getIfFresh(String key, Instant now) {
            LocalEntry entry = entries.get(key);
            if (entry == null) {
                return null;
            }
            if (now.isAfter(entry.expiresAt())) {
                entries.remove(key);
                return null;
            }
            return entry.json();
        }

        synchronized void remove(String key) {
            entries.remove(key);
        }

        synchronized int size() {
            return entries.size();
        }

        synchronized void removeExpired(Instant now) {
            entries.values().removeIf(entry -> now.isAfter(entry.expiresAt()));
        }

        synchronized void forceExpire(String key) {
            LocalEntry entry = entries.get(key);
            if (entry != null) {
                entries.put(key, new LocalEntry(entry.json(), Instant.EPOCH));
            }
        }
    }
}
