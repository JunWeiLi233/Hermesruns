package com.hermes.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Service
public class LettaAgentClient {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.ai.agent.letta.base-url:}")
    private String baseUrl;

    @Value("${app.ai.agent.letta.api-key:}")
    private String apiKey;

    @Value("${app.ai.agent.letta.agent-id:}")
    private String agentId;

    public LettaAgentClient(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public boolean isConfigured() {
        return hasText(baseUrl) && hasText(agentId);
    }

    /**
     * Letta agents process messages sequentially. Keep one in-process lock per configured
     * client so Hermes does not interleave messages to the same agent from concurrent calls.
     */
    public synchronized String sendUserMessage(String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("Letta message is required.");
        }
        if (!isConfigured()) {
            throw new AiProviderException("letta", "messages.create", "Letta AI agent is not configured.", false);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (hasText(apiKey)) {
            headers.setBearerAuth(apiKey.trim());
        }

        Map<String, Object> request = Map.of(
                "messages", List.of(Map.of(
                        "role", "user",
                        "content", List.of(Map.of(
                                "type", "text",
                                "text", message.trim()
                        ))
                )),
                "streaming", false
        );

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    messagesUrl(),
                    HttpMethod.POST,
                    new HttpEntity<>(request, headers),
                    new ParameterizedTypeReference<>() {}
            );
            String text = extractAssistantText(response.getBody());
            if (text == null || text.isBlank()) {
                throw new AiProviderException("letta", "messages.create", "Letta returned an empty agent response.", true);
            }
            return text;
        } catch (RestClientResponseException ex) {
            throw new AiProviderException(
                    "letta",
                    "messages.create",
                    "Letta agent request failed with HTTP " + ex.getStatusCode().value() + ".",
                    ex.getStatusCode().is5xxServerError(),
                    ex
            );
        }
    }

    private String messagesUrl() {
        String trimmedBase = baseUrl.trim().replaceAll("/+$", "");
        String encodedAgentId = UriUtils.encodePathSegment(agentId.trim(), StandardCharsets.UTF_8);
        return trimmedBase + "/v1/agents/" + encodedAgentId + "/messages";
    }

    private String extractAssistantText(Map<String, Object> body) {
        if (body == null || body.isEmpty()) return null;
        Object direct = firstText(body.get("text"), body.get("output"), body.get("response"));
        if (direct instanceof String directText && !directText.isBlank()) {
            return directText;
        }

        Object messages = body.get("messages");
        if (messages instanceof List<?> list) {
            for (int i = list.size() - 1; i >= 0; i--) {
                String text = textFromUnknown(list.get(i));
                if (text != null && !text.isBlank()) {
                    return text;
                }
            }
        }
        return null;
    }

    private String textFromUnknown(Object value) {
        if (value instanceof String stringValue) {
            return stringValue;
        }
        if (value instanceof List<?> list) {
            for (int i = list.size() - 1; i >= 0; i--) {
                String text = textFromUnknown(list.get(i));
                if (text != null && !text.isBlank()) {
                    return text;
                }
            }
            return null;
        }
        if (value instanceof Map<?, ?> rawMap) {
            Map<String, Object> map = objectMapper.convertValue(rawMap, new TypeReference<>() {});
            Object direct = firstText(map.get("text"), map.get("content"), map.get("message"));
            if (direct instanceof String directText && !directText.isBlank()) {
                return directText;
            }
            return textFromUnknown(firstPresent(map.get("assistant_message"), map.get("content"), map.get("messages")));
        }
        return null;
    }

    private Object firstText(Object... candidates) {
        for (Object candidate : candidates) {
            if (candidate instanceof String text && !text.isBlank()) {
                return text;
            }
        }
        return null;
    }

    private Object firstPresent(Object... candidates) {
        for (Object candidate : candidates) {
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isBlank();
    }
}
