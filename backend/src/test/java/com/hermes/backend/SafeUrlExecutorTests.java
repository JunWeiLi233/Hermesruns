package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.net.InetAddress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SafeUrlExecutorTests {

    @Test
    void permissiveForTestsAlwaysAllowsSoTestsCanMockTransport() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://example.com/race"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)))
                .thenReturn(ResponseEntity.ok("body"));

        SafeUrlExecutor executor = SafeUrlExecutor.permissiveForTests(restTemplate);
        ResponseEntity<String> response = executor.exchange(
                "https://example.com/race", HttpMethod.GET, new HttpEntity<Void>((Void) null), String.class);

        assertThat(response).isNotNull();
        assertThat(response.getBody()).isEqualTo("body");
        verify(restTemplate, times(1)).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void rejectsNonHttpSchemesBeforeAnyRequest() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SafeUrlExecutor executor = new SafeUrlExecutor(restTemplate);

        ResponseEntity<String> response = executor.exchange(
                "file:///etc/passwd", HttpMethod.GET, new HttpEntity<Void>((Void) null), String.class);

        assertThat(response).isNull();
        verify(restTemplate, never()).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void rejectsMalformedUrlBeforeAnyRequest() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SafeUrlExecutor executor = new SafeUrlExecutor(restTemplate);

        ResponseEntity<String> response = executor.exchange(
                "https://[", HttpMethod.GET, new HttpEntity<Void>((Void) null), String.class);

        assertThat(response).isNull();
        verify(restTemplate, never()).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void isPublicAddressBlocksInternalRangesThatStringChecksMiss() throws Exception {
        // Decimal / hex / octal IP literals and explicit private IPs must all be
        // rejected once resolved — this is the SSRF bypass the executor fixes.
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("127.0.0.1"))).isFalse();
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("127.255.255.254"))).isFalse();
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("10.0.0.1"))).isFalse();
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("192.168.1.1"))).isFalse();
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("172.16.0.1"))).isFalse();
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("169.254.169.254"))).isFalse();
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("0.0.0.0"))).isFalse();
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("::1"))).isFalse();
        // IPv4-mapped IPv6 loopback representation must also be rejected.
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("::ffff:127.0.0.1"))).isFalse();

        // A genuinely public address is allowed.
        assertThat(SafeUrlExecutor.isPublicAddress(InetAddress.getByName("8.8.8.8"))).isTrue();
    }

    @Test
    void isResolvedAddressAllowedBlocksLoopbackLiteralHost() {
        // InetAddress resolves the literal loopback host without network I/O,
        // so this exercises the resolved-address guard deterministically.
        RestTemplate restTemplate = mock(RestTemplate.class);
        SafeUrlExecutor executor = new SafeUrlExecutor(restTemplate);

        assertThat(executor.isResolvedAddressAllowed("http://localhost/")).isFalse();
        assertThat(executor.isResolvedAddressAllowed("http://127.0.0.1/")).isFalse();
        assertThat(executor.isResolvedAddressAllowed("http://[::1]/")).isFalse();

        verify(restTemplate, never()).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void redirectHopToInternalTargetIsRejectedWithoutFetchingIt() {
        // SSRF redirect bypass regression: a public relay that 302s to an
        // internal address must not be followed, and the internal target
        // must never be fetched.
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://example.com/relay"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)))
                .thenReturn(ResponseEntity.status(HttpStatus.FOUND)
                        .header(HttpHeaders.LOCATION, "http://169.254.169.254/latest/meta-data/")
                        .body(new byte[0]));

        SafeUrlExecutor executor = SafeUrlExecutor.permissiveForTests(restTemplate);
        ResponseEntity<byte[]> response = executor.exchange(
                "https://example.com/relay", HttpMethod.GET, new HttpEntity<Void>((Void) null), byte[].class);

        assertThat(response).isNull();
        // Only the validated public first hop was fetched — never the internal target.
        verify(restTemplate, times(1)).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void redirectHopToPrivateHostIsRejectedWithoutFetchingIt() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://example.com/relay"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)))
                .thenReturn(ResponseEntity.status(HttpStatus.MOVED_PERMANENTLY)
                        .header(HttpHeaders.LOCATION, "http://192.168.1.10/admin")
                        .body(new byte[0]));

        SafeUrlExecutor executor = SafeUrlExecutor.permissiveForTests(restTemplate);
        ResponseEntity<byte[]> response = executor.exchange(
                "https://example.com/relay", HttpMethod.GET, new HttpEntity<Void>((Void) null), byte[].class);

        assertThat(response).isNull();
        verify(restTemplate, times(1)).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void redirectHopToPublicTargetIsFollowedAfterValidation() {
        // Legitimate same-policy redirects to public targets still work.
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://example.com/relay"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)))
                .thenReturn(ResponseEntity.status(HttpStatus.MOVED_PERMANENTLY)
                        .header(HttpHeaders.LOCATION, "https://example.org/final.png")
                        .body(new byte[0]));
        when(restTemplate.exchange(
                eq("https://example.org/final.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)))
                .thenReturn(ResponseEntity.ok(new byte[]{1, 2, 3}));

        SafeUrlExecutor executor = SafeUrlExecutor.permissiveForTests(restTemplate);
        ResponseEntity<byte[]> response = executor.exchange(
                "https://example.com/relay", HttpMethod.GET, new HttpEntity<Void>((Void) null), byte[].class);

        assertThat(response).isNotNull();
        assertThat(response.getBody()).containsExactly(1, 2, 3);
        verify(restTemplate, times(2)).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void redirectLoopBeyondHopBudgetIsRejected() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                any(String.class),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)))
                .thenReturn(ResponseEntity.status(HttpStatus.FOUND)
                        .header(HttpHeaders.LOCATION, "https://example.org/loop")
                        .body(new byte[0]));

        SafeUrlExecutor executor = SafeUrlExecutor.permissiveForTests(restTemplate);
        ResponseEntity<byte[]> response = executor.exchange(
                "https://example.com/relay", HttpMethod.GET, new HttpEntity<Void>((Void) null), byte[].class);

        assertThat(response).isNull();
        // 1 first hop + MAX_REDIRECT_HOPS followed hops, then the budget cuts the chain.
        verify(restTemplate, times(6)).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }

    @Test
    void redirectHopToNonHttpSchemeIsRejectedWithoutFetchingIt() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(
                eq("https://example.com/relay"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)))
                .thenReturn(ResponseEntity.status(HttpStatus.FOUND)
                        .header(HttpHeaders.LOCATION, "file:///etc/passwd")
                        .body(new byte[0]));

        SafeUrlExecutor executor = SafeUrlExecutor.permissiveForTests(restTemplate);
        ResponseEntity<byte[]> response = executor.exchange(
                "https://example.com/relay", HttpMethod.GET, new HttpEntity<Void>((Void) null), byte[].class);

        assertThat(response).isNull();
        verify(restTemplate, times(1)).exchange(
                any(String.class), any(HttpMethod.class), any(HttpEntity.class), any(Class.class));
    }
}
