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
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class GeminiRouteParameterClient {
    private static final long[] GEMINI_RETRY_DELAYS_MS = {0L, 400L, 1200L};
    private static final String ROUTE_PARAMETER_PROMPT_TEMPLATE = """
            Analyze this road-race course map for the target event.
            Race context:
            - raceName: %s
            - city: %s
            - country: %s
            - targetDistanceKm: %s
            Ignore sponsor logos, elevation charts, and decorative text unless that text is needed to identify where the target race route passes.
            If the map shows multiple courses, choose the official route that best matches the target event and targetDistanceKm.
            Ignore shorter side events, companion races, relay/community variants, or alternate promotional routes that do not match the target race.
            Identify the main race route line and return only the JSON object described by the provided schema.
            Requirements:
            - routeHexColor must be the dominant hex color of the main race route line in #RRGGBB form.
            - anchorPoints must contain exactly 4 major, geographically distant intersections, street names, or landmarks that the route explicitly passes through.
            - Include the Start and Finish within anchorPoints.
            - Preserve route order from start to finish.
            """;
    private static final Map<String, Object> ROUTE_PARAMETER_RESPONSE_SCHEMA = Map.of(
            "type", "object",
            "properties", Map.of(
                    "routeHexColor", Map.of(
                            "type", "string",
                            "description", "Dominant hex color of the main race route line in #RRGGBB format."
                    ),
                    "anchorPoints", Map.of(
                            "type", "array",
                            "description", "Exactly four ordered anchors on the route, including Start and Finish.",
                            "minItems", 4,
                            "maxItems", 4,
                            "items", Map.of(
                                    "type", "string",
                                    "description", "A major intersection, street name, or landmark explicitly crossed by the route."
                            )
                    )
            ),
            "required", List.of("routeHexColor", "anchorPoints"),
            "additionalProperties", false
    );

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final SystemConfigService systemConfigService;

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    @Value("${app.ai.model:gemini-2.5-flash}")
    private String aiModel;

    public GeminiRouteParameterClient(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            SystemConfigService systemConfigService
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.systemConfigService = systemConfigService;
    }

    @SuppressWarnings("unchecked")
    public RouteParametersDTO extractRouteParameters(String imageFilePath) {
        return extractRouteParameters(imageFilePath, null, null, null, null);
    }

    @SuppressWarnings("unchecked")
    public RouteParametersDTO extractRouteParameters(
            String imageFilePath,
            String raceName,
            String city,
            String country,
            Double distanceKm
    ) {
        if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
            throw new IllegalStateException("AI route extraction is not configured.");
        }

        Path imagePath = Path.of(imageFilePath);
        if (!Files.isRegularFile(imagePath)) {
            throw new IllegalArgumentException("Route image file does not exist: " + imageFilePath);
        }

        byte[] imageBytes;
        try {
            imageBytes = Files.readAllBytes(imagePath);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read route image file.", e);
        }
        if (imageBytes.length == 0) {
            throw new IllegalArgumentException("Route image file is empty.");
        }

        Map<String, Object> request = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("inline_data", Map.of(
                                        "mime_type", detectMimeType(imagePath),
                                        "data", Base64.getEncoder().encodeToString(imageBytes)
                                )),
                                Map.of("text", buildRouteParameterPrompt(raceName, city, country, distanceKm))
                        )
                )),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseJsonSchema", ROUTE_PARAMETER_RESPONSE_SCHEMA
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + aiModel + ":generateContent?key=" + aiApiKey;
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
        ResponseEntity<Map> response = exchangeWithTransientGeminiRetry(url, entity);

        String text = extractResponseText(response.getBody());
        if (text == null || text.isBlank()) {
            throw new IllegalStateException("Gemini route parameter candidate had no text.");
        }

        return parseRouteParameters(text);
    }

    private String buildRouteParameterPrompt(String raceName, String city, String country, Double distanceKm) {
        return ROUTE_PARAMETER_PROMPT_TEMPLATE.formatted(
                safePromptValue(raceName),
                safePromptValue(city),
                safePromptValue(country),
                formatDistanceKm(distanceKm)
        );
    }

    @SuppressWarnings("unchecked")
    private String extractResponseText(Map<String, Object> body) {
        if (body == null) {
            throw new IllegalStateException("Gemini route parameter response was empty.");
        }

        List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new IllegalStateException("Gemini route parameter response had no candidates.");
        }

        Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
        if (content == null) {
            throw new IllegalStateException("Gemini route parameter candidate had no content.");
        }

        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        if (parts == null || parts.isEmpty()) {
            throw new IllegalStateException("Gemini route parameter candidate had no parts.");
        }

        Object rawText = parts.get(0).get("text");
        return rawText instanceof String text ? text : null;
    }

    RouteParametersDTO parseRouteParameters(String rawText) {
        String json = extractJsonObject(rawText);
        try {
            JsonNode root = objectMapper.readTree(json);
            String routeHexColor = normalizeRouteHexColor(root.path("routeHexColor").asText(null));
            if (routeHexColor == null) {
                throw new IllegalStateException("Gemini route parameter response is missing routeHexColor.");
            }

            JsonNode anchorPointsNode = root.path("anchorPoints");
            if (!anchorPointsNode.isArray() || anchorPointsNode.size() != 4) {
                throw new IllegalStateException("Gemini route parameter response must include anchorPoints as exactly 4 strings.");
            }

            List<String> anchorPoints = new ArrayList<>(4);
            for (JsonNode anchorPointNode : anchorPointsNode) {
                if (!anchorPointNode.isTextual()) {
                    throw new IllegalStateException("Gemini route parameter response must include anchorPoints as exactly 4 strings.");
                }
                String anchorPoint = anchorPointNode.asText().trim();
                if (anchorPoint.isBlank()) {
                    throw new IllegalStateException("Gemini route parameter response contained a blank anchorPoints entry.");
                }
                anchorPoints.add(anchorPoint);
            }
            return new RouteParametersDTO(routeHexColor, anchorPoints);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to parse Gemini route parameter JSON.", e);
        }
    }

    private String extractJsonObject(String rawText) {
        int start = rawText.indexOf('{');
        int end = rawText.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("Gemini route parameter response did not include a JSON object.");
        }
        return rawText.substring(start, end + 1);
    }

    private String normalizeRouteHexColor(String rawValue) {
        if (rawValue == null) {
            return null;
        }
        String trimmed = rawValue.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.startsWith("#")) {
            trimmed = trimmed.substring(1);
        }
        if (!trimmed.matches("[0-9a-fA-F]{6}")) {
            return null;
        }
        return "#" + trimmed.toUpperCase(Locale.ROOT);
    }

    private String safePromptValue(String value) {
        return value == null || value.isBlank() ? "unknown" : value.trim();
    }

    private String formatDistanceKm(Double distanceKm) {
        return distanceKm == null ? "unknown" : String.format(Locale.ROOT, "%.3f", distanceKm);
    }

    private String detectMimeType(Path imagePath) {
        String filename = imagePath.getFileName() == null ? "" : imagePath.getFileName().toString().toLowerCase(Locale.ROOT);
        if (filename.endsWith(".png")) {
            return "image/png";
        }
        if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (filename.endsWith(".webp")) {
            return "image/webp";
        }
        if (filename.endsWith(".gif")) {
            return "image/gif";
        }
        if (filename.endsWith(".bmp")) {
            return "image/bmp";
        }
        try {
            String probed = Files.probeContentType(imagePath);
            if (probed != null && !probed.isBlank()) {
                return probed;
            }
        } catch (IOException ignored) {
        }
        return "application/octet-stream";
    }

    private ResponseEntity<Map> exchangeWithTransientGeminiRetry(String url, HttpEntity<Map<String, Object>> entity) {
        HttpStatusCodeException lastFailure = null;
        for (long delayMs : GEMINI_RETRY_DELAYS_MS) {
            if (delayMs > 0) {
                sleepBeforeRetry(delayMs);
            }
            try {
                return restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
            } catch (HttpStatusCodeException ex) {
                lastFailure = ex;
                if (!isTransientGeminiFailure(ex)) {
                    throw ex;
                }
            }
        }
        throw lastFailure == null ? new IllegalStateException("Gemini route parameter request failed.") : lastFailure;
    }

    private boolean isTransientGeminiFailure(HttpStatusCodeException ex) {
        int status = ex.getStatusCode().value();
        return status == 429 || ex.getStatusCode().is5xxServerError();
    }

    private void sleepBeforeRetry(long delayMs) {
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gemini route parameter retry was interrupted.", interruptedException);
        }
    }
}
