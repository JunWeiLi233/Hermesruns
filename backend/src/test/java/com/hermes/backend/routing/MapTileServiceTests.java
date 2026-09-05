package com.hermes.backend.routing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import com.hermes.backend.routing.MapTileService.TileResult;
import com.hermes.backend.routing.MapTileService.TileState;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MapTileServiceTests {
    private static final String OSM_TILE = "https://tile.openstreetmap.org/10/20/30.png";

    @Test
    void sharedCacheReadsExistingPayloadWithoutFetchingUpstream() {
        Clock clock = Clock.systemUTC();
        TtlCacheStore cacheStore = TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock);
        byte[] body = { 4, 5, 6 };
        cacheStore.put("map-tile", "osm/10/20/30", Map.of(
                "body", Base64.getEncoder().encodeToString(body),
                "contentType", "image/jpeg"
        ), Duration.ofHours(6));
        RestTemplate restTemplate = mock(RestTemplate.class);
        MapTileService service = new MapTileService(restTemplate, "http://localhost:8080", "", cacheStore);

        TileResult result = service.tile(10, 20, 30);

        assertThat(result.state()).isEqualTo(TileState.FRESH);
        assertThat(result.body()).containsExactly(body);
        assertThat(result.contentType()).isEqualTo("image/jpeg");
        verifyNoInteractions(restTemplate);
    }

    @Test
    void durableCacheRetainsNamespacePayloadFieldsTtlAndKeylessRetinaKey() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        TtlCacheStore cacheStore = mock(TtlCacheStore.class);
        when(cacheStore.hasDurableBacking()).thenReturn(true);
        byte[] body = { 1, 2, 3 };
        when(restTemplate.exchange(
                eq("https://basemaps.cartocdn.com/rastertiles/voyager/10/20/30@2x.png?key=test-key"),
                eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)
        )).thenReturn(ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(body));
        MapTileService service = new MapTileService(restTemplate, "http://localhost:8080", "test-key", cacheStore);

        TileResult result = service.cartoTile("voyager", 10, 20, 30, "@2x");

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(cacheStore).put(eq("map-tile"), eq("carto/voyager/10/20/30@2x"),
                payload.capture(), eq(Duration.ofHours(6)));
        JsonNode json = new ObjectMapper().valueToTree(payload.getValue());
        Set<String> fields = new HashSet<>();
        json.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("body", "contentType");
        assertThat(json.get("body").binaryValue()).containsExactly(body);
        assertThat(json.get("contentType").asText()).isEqualTo("image/png");
        assertThat(json.toString()).doesNotContain("test-key");
        assertThat(result.state()).isEqualTo(TileState.FRESH);
    }

    @Test
    void localTileExpiresOnlyAfterSixHourBoundary() {
        Clock clock = mock(Clock.class);
        Instant now = Instant.parse("2026-09-04T00:00:00Z");
        when(clock.instant()).thenReturn(now);
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(eq(OSM_TILE), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().body(new byte[] { 1 }))
                .thenReturn(ResponseEntity.ok().body(new byte[] { 2 }));
        MapTileService service = service(restTemplate, clock, 1024);

        TileResult first = service.tile(10, 20, 30);
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(6)));
        TileResult boundary = service.tile(10, 20, 30);
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(6)).plusNanos(1));
        TileResult refreshed = service.tile(10, 20, 30);

        assertThat(first.contentType()).isEqualTo("image/png");
        assertThat(boundary.body()).containsExactly((byte) 1);
        assertThat(refreshed.body()).containsExactly((byte) 2);
        assertThat(refreshed.state()).isEqualTo(TileState.FRESH);
        verify(restTemplate, times(2)).exchange(eq(OSM_TILE), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
    }

    @Test
    void emptyRefreshRemainsEmptyEvenWhenStaleTileExists() {
        Clock clock = mock(Clock.class);
        Instant now = Instant.parse("2026-09-04T00:00:00Z");
        when(clock.instant()).thenReturn(now);
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(eq(OSM_TILE), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().body(new byte[] { 1 }))
                .thenReturn(ResponseEntity.ok().body(new byte[0]));
        MapTileService service = service(restTemplate, clock, 1024);
        service.tile(10, 20, 30);
        when(clock.instant()).thenReturn(now.plus(Duration.ofHours(6)).plusSeconds(1));

        TileResult result = service.tile(10, 20, 30);

        assertThat(result.state()).isEqualTo(TileState.EMPTY);
        assertThat(result.body()).isNull();
    }

    @Test
    void byteWeightLimitIncludesEntryOverheadAndEvictsLeastRecentlyUsedTile() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class)))
                .thenReturn(ResponseEntity.ok().body(new byte[10]));
        // Two entries fit exactly: each retains 10 body bytes and 64 overhead bytes.
        MapTileService service = service(restTemplate, Clock.systemUTC(), 148);

        service.tile(10, 20, 30);
        service.tile(10, 20, 31);
        service.tile(10, 20, 30);
        service.tile(10, 20, 32);
        service.tile(10, 20, 31);

        verify(restTemplate, times(1)).exchange(eq(OSM_TILE), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
        verify(restTemplate, times(2)).exchange(eq("https://tile.openstreetmap.org/10/20/31.png"),
                eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
    }

    private MapTileService service(RestTemplate restTemplate, Clock clock, long maxBytes) {
        return new MapTileService(restTemplate, "http://localhost:8080", "",
                TtlCacheStore.inMemoryForTests(new ObjectMapper(), clock), maxBytes, clock);
    }
}
