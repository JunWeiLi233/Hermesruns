package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
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
}
