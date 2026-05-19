package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class RecaptchaVerifier {

    @Value("${recaptcha.secret-key:}")
    private String secretKey;

    @Value("${recaptcha.threshold:0.5}")
    private double threshold;

    private final RestTemplate restTemplate = new RestTemplate();

    public boolean verify(String token, String expectedAction) {
        if (secretKey == null || secretKey.isBlank()) {
            return true;
        }
        if (token == null || token.isBlank()) {
            return false;
        }
        String url = "https://www.google.com/recaptcha/api/siteverify"
            + "?secret=" + secretKey
            + "&response=" + token;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restTemplate.postForObject(url, null, Map.class);
            if (result == null || Boolean.TRUE != result.get("success")) {
                return false;
            }
            double score = ((Number) result.getOrDefault("score", 0.0)).doubleValue();
            String action = (String) result.getOrDefault("action", "");
            return score >= threshold && expectedAction.equals(action);
        } catch (Exception e) {
            return false;
        }
    }
}
