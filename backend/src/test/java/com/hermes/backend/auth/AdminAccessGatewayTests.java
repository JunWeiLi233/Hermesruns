package com.hermes.backend.auth;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminAccessGatewayTests {

    @Test
    void ignoresUnsignedIdentityHeaders() {
        JwtDecoder decoder = mock(JwtDecoder.class);
        AdminAccessGateway gateway = new AdminAccessGateway(
                true,
                "https://hermes.cloudflareaccess.com",
                "admin-audience",
                "owner@hermes.test",
                decoder
        );
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Cf-Access-Authenticated-User-Email", "owner@hermes.test");

        assertThat(gateway.isAllowed(request)).isFalse();
    }

    @Test
    void acceptsOnlySignedAssertionForConfiguredAudienceAndEmail() {
        JwtDecoder decoder = mock(JwtDecoder.class);
        Jwt jwt = new Jwt(
                "signed-token",
                Instant.now().minusSeconds(10),
                Instant.now().plusSeconds(60),
                Map.of("alg", "RS256"),
                Map.of(
                        "iss", "https://hermes.cloudflareaccess.com",
                        "aud", List.of("admin-audience"),
                        "email", "owner@hermes.test"
                )
        );
        when(decoder.decode("signed-token")).thenReturn(jwt);
        AdminAccessGateway gateway = new AdminAccessGateway(
                true,
                "https://hermes.cloudflareaccess.com",
                "admin-audience",
                "owner@hermes.test",
                decoder
        );
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Cf-Access-Jwt-Assertion", "signed-token");

        assertThat(gateway.isAllowed(request)).isTrue();
    }
}
