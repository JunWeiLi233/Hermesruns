package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/maps")
public class MapTileController {
    private static final Logger log = LoggerFactory.getLogger(MapTileController.class);
    private static final Duration TILE_CACHE_TTL = Duration.ofHours(6);
    private static final long IN_FLIGHT_WAIT_SECONDS = 35;
    private static final String CARTO_BASEMAPS_HOST = "https://basemaps.cartocdn.com/rastertiles/";
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
    private final Map<String, CachedTile> tileCache = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<CachedTile>> inFlightTiles = new ConcurrentHashMap<>();

    @Autowired
    public MapTileController(
        RestTemplate restTemplate,
        @Value("${app.billing.public-base-url:http://localhost:8080}") String publicBaseUrl,
        @Value("${app.carto-basemaps-api-key:}") String cartoBasemapsApiKey,
        TtlCacheStore cacheStore
    ) {
        this.restTemplate = restTemplate;
        this.publicBaseUrl = publicBaseUrl;
        this.cartoBasemapsApiKey = cartoBasemapsApiKey;
        this.cacheStore = cacheStore;
    }

    public MapTileController(RestTemplate restTemplate, String publicBaseUrl) {
        this(restTemplate, publicBaseUrl, "", TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    MapTileController(RestTemplate restTemplate, String publicBaseUrl, String cartoBasemapsApiKey) {
        this(restTemplate, publicBaseUrl, cartoBasemapsApiKey, TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    @GetMapping("/tiles/{z}/{x}/{y}.png")
    public ResponseEntity<byte[]> tile(
        @PathVariable int z,
        @PathVariable int x,
        @PathVariable int y
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
    @GetMapping("/tiles/carto/{style}/{z}/{x}/{y}.png")
    public ResponseEntity<byte[]> cartoTile(
        @PathVariable String style,
        @PathVariable int z,
        @PathVariable int x,
        @PathVariable int y,
        @RequestParam(name = "r", required = false, defaultValue = "") String retina
    ) {
        if (!CARTO_BASEMAP_STYLES.contains(style)) {
            return emptyResponse();
        }
        if (cartoBasemapsApiKey == null || cartoBasemapsApiKey.isBlank()) {
            return emptyResponse();
        }
        String retinaSuffix = "@2x".equals(retina) ? "@2x" : "";
        // Cache and log under a keyless label; only the upstream request URL
        // carries the secret, and that URL is never logged.
        return proxyTile(
                "carto/" + style + "/" + z + "/" + x + "/" + y + retinaSuffix,
                CARTO_BASEMAPS_HOST + style + "/" + z + "/" + x + "/" + y + retinaSuffix + ".png?key=" + cartoBasemapsApiKey
        );
    }

    private ResponseEntity<byte[]> proxyTile(String cacheKey, String upstreamUrl) {
        // Most zooms revisit tiles already fetched in this process. Check the
        // raw in-memory bytes first; the generic TTL store serializes PNGs as
        // Base64 JSON and is intentionally only the cold/cross-instance path.
        CachedTile localCached = tileCache.get(cacheKey);
        CachedTile cached = localCached != null && !localCached.isExpired()
                ? localCached
                : cacheStore.get("map-tile", cacheKey, CachedTileCacheValue.class)
                        .map(value -> new CachedTile(value.body(), value.contentType(), Instant.now().plus(TILE_CACHE_TTL)))
                        .orElse(null);
        if (cached != null && cached != localCached) {
            tileCache.put(cacheKey, cached);
        }
        if (cached != null && !cached.isExpired()) {
            return okResponse(cached);
        }

        CompletableFuture<CachedTile> inFlight = new CompletableFuture<>();
        CompletableFuture<CachedTile> existing = inFlightTiles.putIfAbsent(cacheKey, inFlight);
        if (existing != null) {
            try {
                CachedTile resolved = existing.get(IN_FLIGHT_WAIT_SECONDS, TimeUnit.SECONDS);
                if (resolved != null) {
                    return okResponse(resolved);
                }
                return cached != null ? staleResponse(cached) : emptyResponse();
            } catch (Exception e) {
                log.error("Error waiting for in-flight tile {}: {}", cacheKey, e.getMessage());
                return cached != null ? staleResponse(cached) : emptyResponse();
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
                return emptyResponse();
            }

            MediaType contentType = upstream.getHeaders().getContentType();
            String resolvedContentType = (contentType == null ? MediaType.IMAGE_PNG : contentType).toString();
            CachedTile resolvedTile = new CachedTile(body, resolvedContentType, Instant.now().plus(TILE_CACHE_TTL));
            tileCache.put(cacheKey, resolvedTile);
            cacheStore.put("map-tile", cacheKey, new CachedTileCacheValue(body, resolvedContentType), TILE_CACHE_TTL);
            inFlight.complete(resolvedTile);
            log.debug("Tile fetched and cached: {}", cacheKey);
            return okResponse(resolvedTile);
        } catch (Exception e) {
            log.error("Failed to fetch tile {}: {}", cacheKey, e.getMessage());
            inFlight.complete(null);
            return cached != null ? staleResponse(cached) : emptyResponse();
        } finally {
            inFlightTiles.remove(cacheKey, inFlight);
        }
    }

    private ResponseEntity<byte[]> okResponse(CachedTile tile) {
        return ResponseEntity.status(HttpStatus.OK)
                .contentType(tile.mediaType())
                .cacheControl(CacheControl.maxAge(6, TimeUnit.HOURS).cachePublic())
                .body(tile.body());
    }

    private ResponseEntity<byte[]> emptyResponse() {
        return ResponseEntity.noContent()
                .cacheControl(CacheControl.noStore())
                .build();
    }

    private ResponseEntity<byte[]> staleResponse(CachedTile tile) {
        return ResponseEntity.status(HttpStatus.OK)
                .contentType(tile.mediaType())
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(tile.body());
    }

    void forceExpireAllForTests() {
        tileCache.replaceAll((key, tile) -> new CachedTile(tile.body(), tile.contentType(), Instant.EPOCH));
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

    private record CachedTile(byte[] body, String contentType, Instant expiresAt) {
        private MediaType mediaType() {
            try {
                return MediaType.parseMediaType(contentType);
            } catch (Exception ignored) {
                return MediaType.IMAGE_PNG;
            }
        }

        private boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }
    }

    private record CachedTileCacheValue(byte[] body, String contentType) {
    }
}
