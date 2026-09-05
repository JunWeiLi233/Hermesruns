package com.hermes.backend.auth;

import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

@Component
public class OAuthProviderClient {
    private final RestTemplate restTemplate;

    public OAuthProviderClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Map<String, Object> exchangeGoogleCode(String code, String clientId, String clientSecret, String redirectUri) {
        MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
        parameters.add("client_id", clientId);
        parameters.add("client_secret", clientSecret);
        parameters.add("code", code);
        parameters.add("grant_type", "authorization_code");
        parameters.add("redirect_uri", redirectUri);
        return exchangeToken("https://oauth2.googleapis.com/token", parameters);
    }

    public Map<String, Object> googleUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        return restTemplate.exchange(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<Map<String, Object>>() {}
        ).getBody();
    }

    public Map<String, Object> exchangeStravaCode(String code, String clientId, String clientSecret, String redirectUri) {
        MultiValueMap<String, String> parameters = new LinkedMultiValueMap<>();
        parameters.add("client_id", clientId);
        parameters.add("client_secret", clientSecret);
        parameters.add("code", code);
        parameters.add("redirect_uri", redirectUri);
        parameters.add("grant_type", "authorization_code");
        return exchangeToken("https://www.strava.com/oauth/token", parameters);
    }

    private Map<String, Object> exchangeToken(String endpoint, MultiValueMap<String, String> parameters) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        return restTemplate.exchange(
                endpoint, HttpMethod.POST, new HttpEntity<>(parameters, headers),
                new ParameterizedTypeReference<Map<String, Object>>() {}
        ).getBody();
    }
}
