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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/maps")
public class MapTileController {
    private static final Logger log = LoggerFactory.getLogger(MapTileController.class);
    private static final Duration TILE_CACHE_TTL = Duration.ofHours(6);
    private static final long IN_FLIGHT_WAIT_SECONDS = 35;

    private final RestTemplate restTemplate;
    private final String publicBaseUrl;
    private final TtlCacheStore cacheStore;
    private final Map<String, CachedTile> tileCache = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<CachedTile>> inFlightTiles = new ConcurrentHashMap<>();

    @Autowired
    public MapTileController(
            RestTemplate restTemplate,
            @Value("${app.billing.public-base-url:http://localhost:8080}") String publicBaseUrl,
            TtlCacheStore cacheStore
    ) {
        this.restTemplate = restTemplate;
        this.publicBaseUrl = publicBaseUrl;
        this.cacheStore = cacheStore;
    }

    public MapTileController(RestTemplate restTemplate, String publicBaseUrl) {
        this(restTemplate, publicBaseUrl, TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()));
    }

    @GetMapping("/tiles/{z}/{x}/{y}.png")
    public ResponseEntity<byte[]> tile(
            @PathVariable int z,
            @PathVariable int x,
            @PathVariable int y
    ) {
        String url = "https://tile.openstreetmap.org/" + z + "/" + x + "/" + y + ".png";
        log.info("Tile request: z={}, x={}, y={}", z, x, y);
        
        CachedTile cached = cacheStore.get("map-tile", url, CachedTileCacheValue.class)
                .map(value -> new CachedTile(value.body(), value.contentType(), Instant.now().plus(TILE_CACHE_TTL)))
                .orElseGet(() -> tileCache.get(url));
        if (cached != null && !cached.isExpired()) {
            return okResponse(cached);
        }

        CompletableFuture<CachedTile> inFlight = new CompletableFuture<>();
        CompletableFuture<CachedTile> existing = inFlightTiles.putIfAbsent(url, inFlight);
        if (existing != null) {
            try {
                CachedTile resolved = existing.get(IN_FLIGHT_WAIT_SECONDS, TimeUnit.SECONDS);
                if (resolved != null) {
                    return okResponse(resolved);
                }
                return cached != null ? staleResponse(cached) : emptyResponse();
            } catch (Exception e) {
                log.error("Error waiting for in-flight tile: {} - {}", url, e.getMessage());
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
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    byte[].class
            );
            byte[] body = upstream.getBody();
            if (body == null || body.length == 0) {
                log.warn("Empty tile body from OSM for url: {}", url);
                inFlight.complete(null);
                return ResponseEntity.noContent().build();
            }

            MediaType contentType = upstream.getHeaders().getContentType();
            String resolvedContentType = (contentType == null ? MediaType.IMAGE_PNG : contentType).toString();
            CachedTile resolvedTile = new CachedTile(body, resolvedContentType, Instant.now().plus(TILE_CACHE_TTL));
            tileCache.put(url, resolvedTile);
            cacheStore.put("map-tile", url, new CachedTileCacheValue(body, resolvedContentType), TILE_CACHE_TTL);
            inFlight.complete(resolvedTile);
            log.info("Tile fetched and cached: {}", url);
            return okResponse(resolvedTile);
        } catch (Exception e) {
            log.error("Failed to fetch tile from OSM: {} - Error: {}", url, e.getMessage());
            inFlight.complete(null);
            return cached != null ? staleResponse(cached) : emptyResponse();
        } finally {
            inFlightTiles.remove(url, inFlight);
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
