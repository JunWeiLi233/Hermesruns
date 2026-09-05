package com.hermes.backend.routing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.routing.MapTileService.TileResult;
import com.hermes.backend.routing.MapTileService.TileState;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MapTileControllerTests {

    @Test
    void tileReturnsPngBodyWhenUpstreamSucceeds() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 1, 2, 3 };
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");

        ResponseEntity<byte[]> response = controller.tile(10, 20, 30);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(response.getBody()).containsExactly(tile);
        assertThat(response.getHeaders().getCacheControl()).contains("max-age");
    }

    @Test
    void tileUsesInMemoryCacheForRepeatedRequests() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 4, 5, 6 };
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");

        ResponseEntity<byte[]> first = controller.tile(10, 20, 30);
        ResponseEntity<byte[]> second = controller.tile(10, 20, 30);

        assertThat(first.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getBody()).containsExactly(tile);
        verify(restTemplate, times(1)).exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        );
    }

    @Test
    void tileCoalescesConcurrentInFlightRequests() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 7, 8, 9 };
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger upstreamCalls = new AtomicInteger();

        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenAnswer(invocation -> {
            upstreamCalls.incrementAndGet();
            entered.countDown();
            if (!release.await(5, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timed out waiting to release mocked tile fetch.");
            }
            return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile);
        });

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<ResponseEntity<byte[]>> request = () -> controller.tile(10, 20, 30);
            Future<ResponseEntity<byte[]>> first = executor.submit(request);
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
            Future<ResponseEntity<byte[]>> second = executor.submit(request);

            release.countDown();

            assertThat(first.get(5, TimeUnit.SECONDS).getStatusCode().value()).isEqualTo(200);
            assertThat(second.get(5, TimeUnit.SECONDS).getStatusCode().value()).isEqualTo(200);
            assertThat(second.get(5, TimeUnit.SECONDS).getBody()).containsExactly(tile);
            assertThat(upstreamCalls.get()).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void tileReturnsNoContentWhenUpstreamFails() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenThrow(new RuntimeException("blocked"));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");

        ResponseEntity<byte[]> response = controller.tile(10, 20, 30);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(response.getBody()).isNull();
    }

    @Test
    void tileReturnsStaleCachedTileWhenRefreshFails() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 9, 9, 9 };
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        ))
                .thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile))
                .thenThrow(new RuntimeException("upstream temporarily unavailable"));

        Clock clock = mock(Clock.class);
        Instant now = Instant.parse("2026-09-04T00:00:00Z");
        when(clock.instant()).thenReturn(now);
        MapTileController controller = new MapTileController(new MapTileService(
                restTemplate, "http://localhost:8080", "",
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock),
                64L * 1024 * 1024, clock));

        ResponseEntity<byte[]> first = controller.tile(10, 20, 30);
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(6)).plusSeconds(1));
        ResponseEntity<byte[]> second = controller.tile(10, 20, 30);

        assertThat(first.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getBody()).containsExactly(tile);
        assertThat(first.getHeaders().getCacheControl()).isEqualTo("max-age=21600, public");
        assertThat(second.getHeaders().getCacheControl()).isEqualTo("max-age=300, public");
    }

    @Test
    void tileSendsRefererAndOriginHeadersToUpstream() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 1, 2, 3 };
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");

        controller.tile(10, 20, 30);

        verify(restTemplate).exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            argThat(entity -> "http://localhost:8080/".equals(entity.getHeaders().getFirst(HttpHeaders.REFERER))
                && "http://localhost:8080".equals(entity.getHeaders().getFirst(HttpHeaders.ORIGIN))),
                eq(byte[].class)
        );
    }

    @Test
    void cartoTileAppendsServerSideApiKeyToUpstreamUrlOnly() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 11, 22, 33 };
        when(restTemplate.exchange(
                eq("https://basemaps.cartocdn.com/rastertiles/dark_all/10/20/30.png?key=test-carto-key"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "test-carto-key");

        ResponseEntity<byte[]> response = controller.cartoTile("dark_all", 10, 20, 30, "");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsExactly(tile);
        // Repeat requests must be served from the proxy cache without a second
        // upstream hit — important for the 5M tiles/month free-tier quota.
        ResponseEntity<byte[]> cached = controller.cartoTile("dark_all", 10, 20, 30, "");
        assertThat(cached.getBody()).containsExactly(tile);
        verify(restTemplate, times(1)).exchange(
                eq("https://basemaps.cartocdn.com/rastertiles/dark_all/10/20/30.png?key=test-carto-key"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        );
    }

    @Test
    void cartoTileSupportsRetinaSuffix() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 44 };
        when(restTemplate.exchange(
                eq("https://basemaps.cartocdn.com/rastertiles/voyager/10/20/30@2x.png?key=test-carto-key"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "test-carto-key");

        ResponseEntity<byte[]> response = controller.cartoTile("voyager", 10, 20, 30, "@2x");

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsExactly(tile);
    }

    @Test
    void cartoTileReturnsNoContentWhenApiKeyIsBlank() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");

        ResponseEntity<byte[]> response = controller.cartoTile("dark_all", 10, 20, 30, "");

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(response.getBody()).isNull();
        verifyNoInteractions(restTemplate);
    }

    @Test
    void cartoTileReturnsNoContentForStyleOutsideWhitelist() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        MapTileController controller = controller(restTemplate, "http://localhost:8080", "test-carto-key");

        ResponseEntity<byte[]> response = controller.cartoTile("../../evil", 10, 20, 30, "");

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        assertThat(response.getBody()).isNull();
        verifyNoInteractions(restTemplate);
    }

    @Test
    void esriDarkTileProxiesEsriZyxPathAndCaches() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 5, 6, 7 };
        when(restTemplate.exchange(
                eq("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/12/1178/1607"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");

        ResponseEntity<byte[]> first = controller.esriDarkTile(12, 1178, 1607);
        ResponseEntity<byte[]> second = controller.esriDarkTile(12, 1178, 1607);

        assertThat(first.getStatusCode().value()).isEqualTo(200);
        assertThat(first.getBody()).containsExactly(tile);
        assertThat(second.getBody()).containsExactly(tile);
        verify(restTemplate, times(1)).exchange(
                eq("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/12/1178/1607"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        );
    }

    @Test
    void esriDarkLabelsTileProxiesReferenceLayer() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 8 };
        when(restTemplate.exchange(
                eq("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/12/1178/1607"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        MapTileController controller = controller(restTemplate, "http://localhost:8080", "");

        ResponseEntity<byte[]> response = controller.esriDarkLabelsTile(12, 1178, 1607);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsExactly(tile);
    }

    @Test
    void tileCacheEvictsLeastRecentlyUsedTilesWhenWeightCapExceeded() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tileA = new byte[1024];
        byte[] tileB = new byte[1024];
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tileA));
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/31.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tileB));

        // Cap fits roughly one tile body; the second fetch must evict the first.
        MapTileController controller = new MapTileController(new MapTileService(restTemplate, "http://localhost:8080", "", TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC()), 1100, Clock.systemUTC()));
        controller.tile(10, 20, 30);
        controller.tile(10, 20, 31);
        ResponseEntity<byte[]> refetched = controller.tile(10, 20, 30);

        assertThat(refetched.getStatusCode().value()).isEqualTo(200);
        assertThat(refetched.getBody()).containsExactly(tileA);
        verify(restTemplate, times(2)).exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        );
    }

    @Test
    void tileSkipsSerializedCacheCopyWhenRedisBackingIsUnavailable() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        byte[] tile = new byte[] { 12, 13, 14 };
        when(restTemplate.exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            ArgumentMatchers.<HttpEntity<?>>any(),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(tile));

        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new com.fasterxml.jackson.databind.ObjectMapper(), java.time.Clock.systemUTC());
        MapTileController controller = new MapTileController(new MapTileService(restTemplate, "http://localhost:8080", "", cacheStore, 1100, Clock.systemUTC()));

        ResponseEntity<byte[]> response = controller.tile(10, 20, 30);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(cacheStore.localEntrySizeForTests()).isZero();
    }

    @Test
    void mappingsPreserveProviderCoordinatesAndRetinaParameter() throws Exception {
        MapTileService service = mock(MapTileService.class);
        TileResult result = new TileResult(new byte[] { 1, 2, 3 }, "image/png", TileState.FRESH);
        when(service.tile(10, 20, 30)).thenReturn(result);
        when(service.cartoTile("voyager", 10, 20, 30, "@2x")).thenReturn(result);
        when(service.cartoTile("voyager", 10, 20, 30, "")).thenReturn(result);
        when(service.esriDarkTile(12, 1178, 1607)).thenReturn(result);
        when(service.esriDarkLabelsTile(12, 1178, 1607)).thenReturn(result);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new MapTileController(service)).build();

        for (String path : new String[] {
                "/api/maps/tiles/10/20/30.png",
                "/api/maps/tiles/carto/voyager/10/20/30.png",
                "/api/maps/tiles/esri-dark/12/1178/1607.png",
                "/api/maps/tiles/esri-dark-labels/12/1178/1607.png"
        }) {
            mvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.IMAGE_PNG))
                    .andExpect(content().bytes(result.body()))
                    .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=21600, public"));
        }
        mvc.perform(get("/api/maps/tiles/carto/voyager/10/20/30.png").param("r", "@2x"))
                .andExpect(status().isOk())
                .andExpect(content().bytes(result.body()));

        verify(service).tile(10, 20, 30);
        verify(service).cartoTile("voyager", 10, 20, 30, "");
        verify(service).cartoTile("voyager", 10, 20, 30, "@2x");
        verify(service).esriDarkTile(12, 1178, 1607);
        verify(service).esriDarkLabelsTile(12, 1178, 1607);
    }

    @Test
    void responseConversionPreservesFallbackMediaTypeAndNoContentHeaders() {
        MapTileService service = mock(MapTileService.class);
        when(service.tile(10, 20, 30))
                .thenReturn(new TileResult(new byte[] { 1 }, "not-a-media-type", TileState.STALE))
                .thenReturn(new TileResult(null, null, TileState.EMPTY));
        MapTileController controller = new MapTileController(service);

        ResponseEntity<byte[]> stale = controller.tile(10, 20, 30);
        ResponseEntity<byte[]> empty = controller.tile(10, 20, 30);

        assertThat(stale.getStatusCode().value()).isEqualTo(200);
        assertThat(stale.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
        assertThat(stale.getHeaders().getCacheControl()).isEqualTo("max-age=300, public");
        assertThat(stale.getBody()).containsExactly((byte) 1);
        assertThat(empty.getStatusCode().value()).isEqualTo(204);
        assertThat(empty.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertThat(empty.getHeaders().getContentType()).isNull();
        assertThat(empty.getBody()).isNull();
    }

    private MapTileController controller(RestTemplate restTemplate, String publicBaseUrl, String apiKey) {
        return new MapTileController(new MapTileService(restTemplate, publicBaseUrl, apiKey,
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), Clock.systemUTC())));
    }
}
