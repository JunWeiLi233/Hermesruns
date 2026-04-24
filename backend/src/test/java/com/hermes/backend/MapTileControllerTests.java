package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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

        MapTileController controller = new MapTileController(restTemplate, "http://localhost:8080");

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

        MapTileController controller = new MapTileController(restTemplate, "http://localhost:8080");

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

        MapTileController controller = new MapTileController(restTemplate, "http://localhost:8080");
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

        MapTileController controller = new MapTileController(restTemplate, "http://localhost:8080");

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

        MapTileController controller = new MapTileController(restTemplate, "http://localhost:8080");

        ResponseEntity<byte[]> first = controller.tile(10, 20, 30);
        controller.forceExpireAllForTests();
        ResponseEntity<byte[]> second = controller.tile(10, 20, 30);

        assertThat(first.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getStatusCode().value()).isEqualTo(200);
        assertThat(second.getBody()).containsExactly(tile);
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

        MapTileController controller = new MapTileController(restTemplate, "http://localhost:8080");

        controller.tile(10, 20, 30);

        verify(restTemplate).exchange(
                eq("https://tile.openstreetmap.org/10/20/30.png"),
                eq(HttpMethod.GET),
            argThat(entity -> "http://localhost:8080/".equals(entity.getHeaders().getFirst(HttpHeaders.REFERER))
                && "http://localhost:8080".equals(entity.getHeaders().getFirst(HttpHeaders.ORIGIN))),
                eq(byte[].class)
        );
    }
}
