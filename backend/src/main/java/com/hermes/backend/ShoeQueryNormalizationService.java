package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
public class ShoeQueryNormalizationService {
    private static final String NORMALIZATION_PROMPT = """
            You are a running shoe metadata expert. Parse the following user input into a canonical format.
            Translate any Chinese brand/model names into their official English equivalents (e.g., "飞电" to "Feidian").
            Output a JSON object containing:
            1. brand
            2. model (including version number, e.g., "3.0 Elite")
            3. colorway (if specified)
            4. searchString (a highly optimized search query combining the brand and exact model)

            User input:
            %s
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final SystemConfigService systemConfigService;

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    @Value("${app.ai.model:gemini-2.5-flash}")
    private String aiModel;

    public ShoeQueryNormalizationService(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            SystemConfigService systemConfigService
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.systemConfigService = systemConfigService;
    }

    public ShoeMetadataDto normalize(String rawInput) {
        if (rawInput == null || rawInput.trim().isBlank()) {
            throw new IllegalArgumentException("rawInput is required.");
        }
        if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
            throw new IllegalStateException("AI normalization is not configured.");
        }

        String prompt = NORMALIZATION_PROMPT.formatted(rawInput.trim());
        Map<String, Object> request = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text", prompt))
                )),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json"
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + aiModel + ":generateContent?key=" + aiApiKey;

        ResponseEntity<Map> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                new HttpEntity<>(request, headers),
                Map.class
        );

        String text = extractResponseText(response.getBody());
        if (text == null || text.isBlank()) {
            throw new IllegalStateException("Gemini returned an empty normalization response.");
        }

        String json = extractJsonObject(text);
        if (json == null) {
            throw new IllegalStateException("Gemini did not return a JSON object for shoe normalization.");
        }

        try {
            JsonNode node = objectMapper.readTree(json);
            ShoeMetadataDto metadata = new ShoeMetadataDto(
                    textValue(node.get("brand")),
                    textValue(node.get("model")),
                    textValue(node.get("colorway")),
                    textValue(node.get("searchString"))
            );
            if (metadata.brand() == null && metadata.model() == null && metadata.searchString() == null) {
                throw new IllegalStateException("Gemini returned an unusable normalization payload.");
            }
            return metadata;
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to parse Gemini normalization response.", ex);
        }
    }

    private static String extractResponseText(Map<?, ?> body) {
        if (body == null) return null;
        Object candidates = body.get("candidates");
        if (!(candidates instanceof List<?> list) || list.isEmpty() || !(list.get(0) instanceof Map<?, ?> first)) {
            return null;
        }
        Object content = first.get("content");
        if (!(content instanceof Map<?, ?> contentMap)) return null;
        Object parts = contentMap.get("parts");
        if (!(parts instanceof List<?> partList)) return null;
        for (Object rawPart : partList) {
            if (rawPart instanceof Map<?, ?> partMap) {
                Object text = partMap.get("text");
                if (text instanceof String value && !value.isBlank()) {
                    return value;
                }
            }
        }
        return null;
    }

    private static String extractJsonObject(String text) {
        if (text == null) return null;
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        return text.substring(start, end + 1);
    }

    private static String textValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        String value = node.asText();
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
