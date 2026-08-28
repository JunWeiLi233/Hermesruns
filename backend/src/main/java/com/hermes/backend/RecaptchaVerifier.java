package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class RecaptchaVerifier {

    private static final Logger logger = LoggerFactory.getLogger(RecaptchaVerifier.class);

    @Value("${recaptcha.secret-key:}")
    private String secretKey;

    @Value("${recaptcha.threshold:0.5}")
    private double threshold;

    private final RestTemplate restTemplate;

    public RecaptchaVerifier() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public boolean verify(String token, String expectedAction) {
        String configuredSecretKey = RecaptchaConfiguration.normalize(secretKey);
        if (configuredSecretKey.isBlank()) {
            return true;
        }
        String normalizedToken = token == null ? "" : token.trim();
        String normalizedAction = expectedAction == null ? "" : expectedAction.trim();
        if (normalizedToken.isBlank() || normalizedAction.isBlank()) {
            return false;
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> formBody = new LinkedMultiValueMap<>();
        formBody.add("secret", configuredSecretKey);
        formBody.add("response", normalizedToken);
        HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(formBody, headers);
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restTemplate.postForObject(
                    "https://www.google.com/recaptcha/api/siteverify", entity, Map.class);
            if (result == null || Boolean.TRUE != result.get("success")) {
                logger.warn("reCAPTCHA rejected token; errorCodes={}", errorCodes(result));
                return false;
            }
            Object rawScore = result.get("score");
            double score = rawScore instanceof Number ? ((Number) rawScore).doubleValue() : -1.0;
            String action = (String) result.getOrDefault("action", "");
            boolean accepted = Double.isFinite(score)
                    && score >= threshold
                    && normalizedAction.equals(action);
            if (!accepted) {
                logger.warn("reCAPTCHA token failed policy; score={} threshold={} action={} expectedAction={}",
                        score, threshold, action, normalizedAction);
            }
            return accepted;
        } catch (Exception e) {
            logger.warn("reCAPTCHA verification request failed: {}", e.getClass().getSimpleName());
            return false;
        }
    }

    private List<?> errorCodes(Map<String, Object> result) {
        if (result == null) {
            return List.of("empty-response");
        }
        Object value = result.get("error-codes");
        return value instanceof List<?> list ? list : List.of();
    }
}
