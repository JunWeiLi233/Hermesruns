package com.hermes.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class AiShoeScanService {

    private static final String SHOE_PROMPT =
            "Extract all running shoe names and their accumulated mileage from this screenshot. " +
            "Return ONLY a JSON array, no other text. Each element should have: " +
            "\"brand\" (string), \"model\" (string), \"distanceKm\" (number in kilometers). " +
            "If the distance is in miles, convert to km (multiply by 1.60934). " +
            "Return at most 10 elements in the JSON array. " +
            "Example: [{\"brand\":\"Nike\",\"model\":\"Pegasus 41\",\"distanceKm\":342.5}]";

    private final RestTemplate restTemplate;

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    @Value("${app.ai.model:gemini-2.0-flash}")
    private String aiModel;

    @Value("${app.ai.provider:gemini}")
    private String aiProvider;

    public AiShoeScanService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String callAi(String base64, String mediaType) {
        if ("claude".equalsIgnoreCase(aiProvider)) {
            return callClaude(base64, mediaType);
        }
        return callGemini(base64, mediaType);
    }

    @SuppressWarnings("unchecked")
    private String callGemini(String base64, String mediaType) {
        Map<String, Object> request = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("inline_data", Map.of(
                                        "mime_type", mediaType,
                                        "data", base64
                                )),
                                Map.of("text", SHOE_PROMPT)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + aiModel + ":generateContent?key=" + aiApiKey;

        ResponseEntity<Map> response = restTemplate.exchange(
                url, HttpMethod.POST, new HttpEntity<>(request, headers), Map.class);

        Map body = response.getBody();
        if (body == null) return null;

        List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
        if (candidates == null || candidates.isEmpty()) return null;

        Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
        if (content == null) return null;

        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        if (parts == null || parts.isEmpty()) return null;

        return (String) parts.get(0).get("text");
    }

    @SuppressWarnings("unchecked")
    private String callClaude(String base64, String mediaType) {
        Map<String, Object> request = Map.of(
                "model", aiModel,
                "max_tokens", 1024,
                "messages", List.of(Map.of(
                        "role", "user",
                        "content", List.of(
                                Map.of("type", "image",
                                        "source", Map.of(
                                                "type", "base64",
                                                "media_type", mediaType,
                                                "data", base64
                                        )),
                                Map.of("type", "text", "text", SHOE_PROMPT)
                        )
                ))
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", aiApiKey);
        headers.set("anthropic-version", "2023-06-01");

        ResponseEntity<Map> response = restTemplate.exchange(
                "https://api.anthropic.com/v1/messages",
                HttpMethod.POST, new HttpEntity<>(request, headers), Map.class);

        Map body = response.getBody();
        if (body == null) return null;

        List<Map<String, Object>> content = (List<Map<String, Object>>) body.get("content");
        if (content == null || content.isEmpty()) return null;

        return (String) content.get(0).get("text");
    }
}
