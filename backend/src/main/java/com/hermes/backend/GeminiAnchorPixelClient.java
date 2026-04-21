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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class GeminiAnchorPixelClient {
    private static final String ANCHOR_PIXEL_PROMPT = """
            Inspect this marathon course-map image and return ONLY JSON with exactly this structure:
            {
              "anchors": [
                {"label": "%s", "x": 123, "y": 456},
                {"label": "%s", "x": 234, "y": 567},
                {"label": "%s", "x": 345, "y": 678},
                {"label": "%s", "x": 456, "y": 789}
              ]
            }
            Requirements:
            - Use these 4 anchor labels exactly and preserve their order:
              1. %s
              2. %s
              3. %s
              4. %s
            - anchors must contain exactly 4 objects.
            - Each object must include a non-blank label plus integer x and integer y pixel coordinates.
            - Keep labels identical to the provided anchor labels.
            - Return only valid JSON with no markdown or commentary.
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final SystemConfigService systemConfigService;

    @Value("${app.ai.api-key:}")
    private String aiApiKey;

    @Value("${app.ai.model:gemini-2.0-flash}")
    private String aiModel;

    public GeminiAnchorPixelClient(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            SystemConfigService systemConfigService
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.systemConfigService = systemConfigService;
    }

    @SuppressWarnings("unchecked")
    public List<RouteAnchorPixelPointDTO> extractAnchorPixels(String imageFilePath, RouteParametersDTO routeParameters) {
        if (!systemConfigService.isAiConfigured() || aiApiKey == null || aiApiKey.isBlank()) {
            throw new IllegalStateException("AI anchor pixel extraction is not configured.");
        }

        List<String> anchorLabels = extractAnchorLabels(routeParameters);

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

        String prompt = ANCHOR_PIXEL_PROMPT.formatted(
                anchorLabels.get(0),
                anchorLabels.get(1),
                anchorLabels.get(2),
                anchorLabels.get(3),
                anchorLabels.get(0),
                anchorLabels.get(1),
                anchorLabels.get(2),
                anchorLabels.get(3)
        );

        Map<String, Object> request = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(
                                Map.of("inline_data", Map.of(
                                        "mime_type", detectMimeType(imagePath),
                                        "data", Base64.getEncoder().encodeToString(imageBytes)
                                )),
                                Map.of("text", prompt)
                        )
                ))
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

        Map<String, Object> body = response.getBody();
        if (body == null) {
            throw new IllegalStateException("Gemini anchor pixel response was empty.");
        }

        List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new IllegalStateException("Gemini anchor pixel response had no candidates.");
        }

        Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
        if (content == null) {
            throw new IllegalStateException("Gemini anchor pixel candidate had no content.");
        }

        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        if (parts == null || parts.isEmpty()) {
            throw new IllegalStateException("Gemini anchor pixel candidate had no parts.");
        }

        Object rawText = parts.get(0).get("text");
        if (!(rawText instanceof String text) || text.isBlank()) {
            throw new IllegalStateException("Gemini anchor pixel candidate had no text.");
        }

        return parseAnchorPixels(text, anchorLabels);
    }

    List<RouteAnchorPixelPointDTO> parseAnchorPixels(String rawText, List<String> expectedLabels) {
        String json = extractJsonObject(rawText);
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode anchorsNode = root.path("anchors");
            if (!anchorsNode.isArray() || anchorsNode.size() != 4) {
                throw new IllegalStateException("Gemini anchor pixel response must include anchors as exactly 4 objects.");
            }

            List<RouteAnchorPixelPointDTO> anchors = new ArrayList<>(4);
            for (int index = 0; index < anchorsNode.size(); index++) {
                JsonNode anchorNode = anchorsNode.get(index);
                String expectedLabel = expectedLabels.get(index);
                String label = anchorNode.path("label").asText("").trim();
                if (label.isBlank()) {
                    throw new IllegalStateException("Gemini anchor pixel response contained a blank anchor label.");
                }
                if (!expectedLabel.equals(label)) {
                    throw new IllegalStateException("Gemini anchor pixel response must preserve anchor label order.");
                }

                JsonNode xNode = anchorNode.path("x");
                JsonNode yNode = anchorNode.path("y");
                if (!xNode.isIntegralNumber() || !yNode.isIntegralNumber()) {
                    throw new IllegalStateException("Gemini anchor pixel response must include integer x/y coordinates.");
                }

                anchors.add(new RouteAnchorPixelPointDTO(label, xNode.intValue(), yNode.intValue()));
            }
            return List.copyOf(anchors);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to parse Gemini anchor pixel JSON.", e);
        }
    }

    private List<String> extractAnchorLabels(RouteParametersDTO routeParameters) {
        if (routeParameters == null) {
            throw new IllegalArgumentException("Route parameters are required.");
        }
        List<String> anchorPoints = routeParameters.anchorPoints();
        if (anchorPoints == null || anchorPoints.size() != 4) {
            throw new IllegalArgumentException("Route parameters must include exactly 4 anchor labels.");
        }

        List<String> normalized = new ArrayList<>(4);
        for (String anchorPoint : anchorPoints) {
            String label = anchorPoint == null ? "" : anchorPoint.trim();
            if (label.isBlank()) {
                throw new IllegalArgumentException("Route parameters contained a blank anchor label.");
            }
            normalized.add(label);
        }
        return List.copyOf(normalized);
    }

    private String extractJsonObject(String rawText) {
        int start = rawText.indexOf('{');
        int end = rawText.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("Gemini anchor pixel response did not include a JSON object.");
        }
        return rawText.substring(start, end + 1);
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
}
