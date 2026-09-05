package com.hermes.backend.routing;

import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class MapTileService {
    private static final Logger log = LoggerFactory.getLogger(MapTileService.class);
    private static final Duration TILE_CACHE_TTL = Duration.ofHours(6);
    private static final long IN_FLIGHT_WAIT_SECONDS = 35;
    // Raw tile bytes retained per process. Unbounded before, this map held every
    // tile ever served for the process lifetime and was the single largest
    // steady-state heap retainer on Railway. Default 24MB (RFC-005); override via
    // APP_MAP_TILE_LOCAL_MAX_BYTES / app.map-tile.local-max-bytes.
    private static final long DEFAULT_MAX_CACHED_TILE_BYTES = 24L * 1024 * 1024;
    private static final String CARTO_BASEMAPS_HOST = "https://basemaps.cartocdn.com/rastertiles/";
    // Esri's tile path is /tile/{z}/{y}/{x} with no file extension.
    private static final String ESDI_DARK_GRAY_HOST = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/";
    // Strict allow-list: the style segment becomes part of cache keys, so it
    // must never carry caller-controlled extras (query strings, paths).
    private static final Set<String> CARTO_BASEMAP_STYLES = Set.of(
            "dark_all", "dark_nolabels", "dark_only_labels",
            "light_all", "light_nolabels", "light_only_labels",
            "voyager", "voyager_nolabels", "voyager_only_labels"
    );

    private final RestTemplate restTemplate;
    private final String publicBaseUrl;
    private final String cartoBasemapsApiKey;
    private final TtlCacheStore cacheStore;
    private final BoundedTileCache tileCache;
    private final Clock clock;
    private final Map<String, CompletableFuture<CachedTile>> inFlightTiles = new ConcurrentHashMap<>();

    @Autowired
    public MapTileService(
        RestTemplate restTemplate,
        @Value("${app.billing.public-base-url:http://localhost:8080}") String publicBaseUrl,
        @Value("${app.carto-basemaps-api-key:}") String cartoBasemapsApiKey,
        TtlCacheStore cacheStore,
        @Value("${app.map-tile.local-max-bytes:25165824}") long maxTileCacheBytes
    ) {
        this(restTemplate, publicBaseUrl, cartoBasemapsApiKey, cacheStore,
                maxTileCacheBytes > 0 ? maxTileCacheBytes : DEFAULT_MAX_CACHED_TILE_BYTES,
                Clock.systemUTC());
    }

    /** Test / manual wiring helper — uses the RFC-005 24 MiB default. */
    public MapTileService(
        RestTemplate restTemplate,
        String publicBaseUrl,
        String cartoBasemapsApiKey,
        TtlCacheStore cacheStore
    ) {
        this(restTemplate, publicBaseUrl, cartoBasemapsApiKey, cacheStore,
                DEFAULT_MAX_CACHED_TILE_BYTES, Clock.systemUTC());
    }

    public MapTileService(
        RestTemplate restTemplate,
        String publicBaseUrl,
        String cartoBasemapsApiKey,
        TtlCacheStore cacheStore,
        long maxTileCacheBytes,
        Clock clock
    ) {
        this.restTemplate = restTemplate;
        this.publicBaseUrl = publicBaseUrl;
        this.cartoBasemapsApiKey = cartoBasemapsApiKey;
        this.cacheStore = cacheStore;
        this.tileCache = new BoundedTileCache(maxTileCacheBytes);
        this.clock = clock;
    }

    public TileResult tile(
        int z,
        int x,
        int y
    ) {
        log.debug("Tile request: z={}, x={}, y={}", z, x, y);
        return proxyTile(
                "osm/" + z + "/" + x + "/" + y,
                "https://tile.openstreetmap.org/" + z + "/" + x + "/" + y + ".png"
        );
    }

    /**
     * CARTO raster basemaps proxy. The registered API key lives in the
     * APP_CARTO_BASEMAPS_API_KEY env var and is appended here, server-side,
     * so it never reaches the browser or the frontend bundle.
     */
    public TileResult cartoTile(
        String style,
        int z,
        int x,
        int y,
        String retina
    ) {
        if (!CARTO_BASEMAP_STYLES.contains(style)) {
            return emptyResult();
        }
        if (cartoBasemapsApiKey == null || cartoBasemapsApiKey.isBlank()) {
            return emptyResult();
        }
        String retinaSuffix = "@2x".equals(retina) ? "@2x" : "";
        // Cache and log under a keyless label; only the upstream request URL
        // carries the secret, and that URL is never logged.
        return proxyTile(
                "carto/" + style + "/" + z + "/" + x + "/" + y + retinaSuffix,
                CARTO_BASEMAPS_HOST + style + "/" + z + "/" + x + "/" + y + retinaSuffix + ".png?key=" + cartoBasemapsApiKey
        );
    }

    /**
     * Esri Dark Gray basemap proxy (base + labels). Third-party tile hosts
     * (arcgisonline.com among them) are unreachable from some visitor
     * networks, which rendered the heatmap as a black canvas with GPS dots.
     * Serving the tiles same-origin through this proxy removes that client
     * reachability dependency and adds the shared TTL cache.
     */
    public TileResult esriDarkTile(
        int z,
        int y,
        int x
    ) {
        return proxyTile(
                "esri-dark/" + z + "/" + y + "/" + x,
                ESDI_DARK_GRAY_HOST + "World_Dark_Gray_Base/MapServer/tile/" + z + "/" + y + "/" + x
        );
    }

    public TileResult esriDarkLabelsTile(
        int z,
        int y,
        int x
    ) {
        return proxyTile(
                "esri-dark-labels/" + z + "/" + y + "/" + x,
                ESDI_DARK_GRAY_HOST + "World_Dark_Gray_Reference/MapServer/tile/" + z + "/" + y + "/" + x
        );
    }

    private TileResult proxyTile(String cacheKey, String upstreamUrl) {
        // Most zooms revisit tiles already fetched in this process. Check the
        // raw in-memory bytes first; the generic TTL store serializes PNGs as
        // Base64 JSON and is intentionally only the cross-instance/Redis path.
        CachedTile localCached = tileCache.get(cacheKey);
        CachedTile cached = localCached != null && !localCached.isExpired(clock.instant())
                ? localCached
                : cacheStore.get("map-tile", cacheKey, CachedTileCacheValue.class)
                        .map(value -> new CachedTile(value.body(), value.contentType(), clock.instant().plus(TILE_CACHE_TTL)))
                        .orElse(localCached);
        if (cached != null && cached != localCached) {
            tileCache.put(cacheKey, cached);
        }
        if (cached != null && !cached.isExpired(clock.instant())) {
            return freshResult(cached);
        }

        CompletableFuture<CachedTile> inFlight = new CompletableFuture<>();
        CompletableFuture<CachedTile> existing = inFlightTiles.putIfAbsent(cacheKey, inFlight);
        if (existing != null) {
            try {
                CachedTile resolved = existing.get(IN_FLIGHT_WAIT_SECONDS, TimeUnit.SECONDS);
                if (resolved != null) {
                    return freshResult(resolved);
                }
                return cached != null ? staleResult(cached) : emptyResult();
            } catch (Exception e) {
                log.error("Error waiting for in-flight tile {}: {}", cacheKey, e.getMessage());
                return cached != null ? staleResult(cached) : emptyResult();
            }
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.IMAGE_PNG, MediaType.ALL));
        headers.set(HttpHeaders.USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        String referer = normalizedReferer();
        headers.set(HttpHeaders.REFERER, referer);
        headers.set(HttpHeaders.ORIGIN, normalizedOrigin(referer));

        try {
            ResponseEntity<byte[]> upstream = restTemplate.exchange(
                    upstreamUrl,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );
            byte[] body = upstream.getBody();
            if (body == null || body.length == 0) {
                log.warn("Empty tile body from upstream for {}", cacheKey);
                inFlight.complete(null);
                return emptyResult();
            }

            MediaType contentType = upstream.getHeaders().getContentType();
            String resolvedContentType = (contentType == null ? MediaType.IMAGE_PNG : contentType).toString();
            CachedTile resolvedTile = new CachedTile(body, resolvedContentType, clock.instant().plus(TILE_CACHE_TTL));
            tileCache.put(cacheKey, resolvedTile);
            // The serialized copy only pays off when Redis can share it across
            // instances; with Redis disabled it was a permanent ~1.4x duplicate
            // of every tile on top of the bounded raw-byte cache.
            if (cacheStore.hasDurableBacking()) {
                cacheStore.put("map-tile", cacheKey, new CachedTileCacheValue(body, resolvedContentType), TILE_CACHE_TTL);
            }
            inFlight.complete(resolvedTile);
            log.debug("Tile fetched and cached: {}", cacheKey);
            return freshResult(resolvedTile);
        } catch (Exception e) {
            log.error("Failed to fetch tile {}: {}", cacheKey, e.getMessage());
            inFlight.complete(null);
            return cached != null ? staleResult(cached) : emptyResult();
        } finally {
            inFlightTiles.remove(cacheKey, inFlight);
        }
    }

    private TileResult freshResult(CachedTile tile) {
        return new TileResult(tile.body(), tile.contentType(), TileState.FRESH);
    }

    private TileResult emptyResult() {
        return new TileResult(null, null, TileState.EMPTY);
    }

    private TileResult staleResult(CachedTile tile) {
        return new TileResult(tile.body(), tile.contentType(), TileState.STALE);
    }

    private String normalizedReferer() {
        if (publicBaseUrl == null || publicBaseUrl.isBlank()) {
            return "http://localhost:8080/";
        }
        return publicBaseUrl.endsWith("/") ? publicBaseUrl : publicBaseUrl + "/";
    }

    private String normalizedOrigin(String referer) {
        try {
            URI uri = URI.create(referer);
            String scheme = uri.getScheme() == null ? "http" : uri.getScheme();
            int port = uri.getPort();
            if (port > 0) {
                return scheme + "://" + uri.getHost() + ":" + port;
            }
            return scheme + "://" + uri.getHost();
        } catch (Exception ignored) {
            return "http://localhost:8080";
        }
    }

    public enum TileState {
        FRESH, STALE, EMPTY
    }

    public record TileResult(byte[] body, String contentType, TileState state) {}

    private record CachedTile(byte[] body, String contentType, Instant expiresAt) {
        private boolean isExpired(Instant now) {
            return now.isAfter(expiresAt);
        }
    }

    private record CachedTileCacheValue(byte[] body, String contentType) {
    }

    /**
     * Access-ordered LRU bounded by total retained tile bytes. Synchronized is
     * enough: map mutations are nanosecond-scale next to the upstream tile
     * fetches that populate this cache.
     */
    private static final class BoundedTileCache {
        private final long maxBytes;
        private final LinkedHashMap<String, CachedTile> entries = new LinkedHashMap<>(16, 0.75f, true);
        private long retainedBytes;

        BoundedTileCache(long maxBytes) {
            this.maxBytes = maxBytes;
        }

        synchronized CachedTile get(String key) {
            // Expired entries stay: they are the stale-fallback served when an
            // upstream refresh fails, and the weight LRU bounds their cost.
            return entries.get(key);
        }

        synchronized void put(String key, CachedTile tile) {
            CachedTile previous = entries.put(key, tile);
            if (previous != null) {
                retainedBytes -= weight(previous);
            }
            retainedBytes += weight(tile);
            trimToWeight();
        }

        synchronized void remove(String key) {
            CachedTile previous = entries.remove(key);
            if (previous != null) {
                retainedBytes -= weight(previous);
            }
        }

        private void trimToWeight() {
            while (retainedBytes > maxBytes && !entries.isEmpty()) {
                var oldest = entries.keySet().iterator().next();
                remove(oldest);
            }
        }

        private static long weight(CachedTile tile) {
            byte[] body = tile.body();
            return (body == null ? 0 : body.length) + 64;
        }
    }
}
