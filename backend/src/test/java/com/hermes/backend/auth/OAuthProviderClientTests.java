package com.hermes.backend.auth;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OAuthProviderClientTests {
    @Test
    void googleCodeExchangePreservesTheProviderFormContract() {
        assertTokenExchange("https://oauth2.googleapis.com/token", true);
    }

    @Test
    void stravaCodeExchangePreservesTheProviderFormContract() {
        assertTokenExchange("https://www.strava.com/oauth/token", false);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private void assertTokenExchange(String endpoint, boolean google) {
        RestTemplate transport = mock(RestTemplate.class);
        Map<String, Object> payload = Map.of("access_token", "test-only-provider-token");
        when(transport.exchange(eq(endpoint), eq(HttpMethod.POST), any(HttpEntity.class),
                any(ParameterizedTypeReference.class))).thenReturn(ResponseEntity.ok(payload));
        OAuthProviderClient client = new OAuthProviderClient(transport);

        Map<String, Object> result = google
                ? client.exchangeGoogleCode("authorization-code", "client-id", "test-only-client-secret", "https://example.test/callback")
                : client.exchangeStravaCode("authorization-code", "client-id", "test-only-client-secret", "https://example.test/callback");

        ArgumentCaptor<HttpEntity> entity = ArgumentCaptor.forClass(HttpEntity.class);
        verify(transport).exchange(eq(endpoint), eq(HttpMethod.POST), entity.capture(), any(ParameterizedTypeReference.class));
        assertThat(result).isSameAs(payload);
        assertThat(entity.getValue().getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> form = (MultiValueMap<String, String>) entity.getValue().getBody();
        assertThat(form).containsOnlyKeys("client_id", "client_secret", "code", "grant_type", "redirect_uri");
        assertThat(form).containsEntry("client_id", List.of("client-id"));
        assertThat(form).containsEntry("client_secret", List.of("test-only-client-secret"));
        assertThat(form).containsEntry("code", List.of("authorization-code"));
        assertThat(form).containsEntry("grant_type", List.of("authorization_code"));
        assertThat(form).containsEntry("redirect_uri", List.of("https://example.test/callback"));
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void googleUserInfoUsesTheBearerHeaderAndReturnsTheProviderPayload() {
        RestTemplate transport = mock(RestTemplate.class);
        Map<String, Object> payload = Map.of("email", "runner@example.test");
        String endpoint = "https://www.googleapis.com/oauth2/v2/userinfo";
        when(transport.exchange(eq(endpoint), eq(HttpMethod.GET), any(HttpEntity.class),
                any(ParameterizedTypeReference.class))).thenReturn(ResponseEntity.ok(payload));

        Map<String, Object> result = new OAuthProviderClient(transport).googleUserInfo("test-only-provider-token");

        ArgumentCaptor<HttpEntity> entity = ArgumentCaptor.forClass(HttpEntity.class);
        verify(transport).exchange(eq(endpoint), eq(HttpMethod.GET), entity.capture(), any(ParameterizedTypeReference.class));
        assertThat(result).isSameAs(payload);
        assertThat(entity.getValue().getHeaders().getFirst("Authorization")).isEqualTo("Bearer test-only-provider-token");
        assertThat(entity.getValue().getBody()).isNull();
    }
}
