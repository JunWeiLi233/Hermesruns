package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GeminiAnchorPixelClientTests {

    @Test
    void extractAnchorPixelsBuildsGeminiPromptAndParsesOrderedAnchorPixels() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        @SuppressWarnings("unchecked")
        HttpEntity<Map<String, Object>>[] requestHolder = new HttpEntity[1];
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenAnswer(invocation -> {
            requestHolder[0] = invocation.getArgument(2);
            return ResponseEntity.ok(Map.of(
                    "candidates", List.of(Map.of(
                            "content", Map.of(
                                    "parts", List.of(Map.of(
                                            "text", """
                                                    {
                                                      "anchors": [
                                                        {"label": "Start", "x": 123, "y": 456},
                                                        {"label": "River Crossing", "x": 234, "y": 567},
                                                        {"label": "Downtown Turn", "x": 345, "y": 678},
                                                        {"label": "Finish", "x": 456, "y": 789}
                                                      ]
                                                    }
                                                    """
                                    ))
                            )
                    ))
            ));
        });

        GeminiAnchorPixelClient client = new GeminiAnchorPixelClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("anchor-pixels", ".png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        RouteParametersDTO routeParameters = new RouteParametersDTO(
                "#22AA66",
                List.of("Start", "River Crossing", "Downtown Turn", "Finish")
        );

        List<RouteAnchorPixelPointDTO> result = client.extractAnchorPixels(imagePath.toString(), routeParameters);

        assertThat(result)
                .extracting(RouteAnchorPixelPointDTO::label, RouteAnchorPixelPointDTO::x, RouteAnchorPixelPointDTO::y)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Start", 123, 456),
                        org.assertj.core.groups.Tuple.tuple("River Crossing", 234, 567),
                        org.assertj.core.groups.Tuple.tuple("Downtown Turn", 345, 678),
                        org.assertj.core.groups.Tuple.tuple("Finish", 456, 789)
                );

        Map<String, Object> requestBody = requestHolder[0].getBody();
        assertThat(requestBody).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contents = (List<Map<String, Object>>) requestBody.get("contents");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contents.get(0).get("parts");
        @SuppressWarnings("unchecked")
        Map<String, Object> inlineData = (Map<String, Object>) parts.get(0).get("inline_data");
        assertThat(inlineData.get("mime_type")).isEqualTo("image/png");
        assertThat(inlineData.get("data")).isEqualTo("AQIDBA==");

        String prompt = (String) parts.get(1).get("text");
        assertThat(prompt)
                .contains("\"anchors\"")
                .contains("\"label\"")
                .contains("\"x\"")
                .contains("\"y\"")
                .contains("Start")
                .contains("River Crossing")
                .contains("Downtown Turn")
                .contains("Finish");
        assertThat(prompt.indexOf("Start")).isLessThan(prompt.indexOf("River Crossing"));
        assertThat(prompt.indexOf("River Crossing")).isLessThan(prompt.indexOf("Downtown Turn"));
        assertThat(prompt.indexOf("Downtown Turn")).isLessThan(prompt.indexOf("Finish"));
    }

    @Test
    void extractAnchorPixelsSupportsUploadedImageDataUrls() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        @SuppressWarnings("unchecked")
        HttpEntity<Map<String, Object>>[] requestHolder = new HttpEntity[1];
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        )).thenAnswer(invocation -> {
            requestHolder[0] = invocation.getArgument(2);
            return ResponseEntity.ok(Map.of(
                    "candidates", List.of(Map.of(
                            "content", Map.of(
                                    "parts", List.of(Map.of(
                                            "text", """
                                                    {
                                                      "anchors": [
                                                        {"label": "Start", "x": 11, "y": 22},
                                                        {"label": "River Crossing", "x": 33, "y": 44},
                                                        {"label": "Downtown Turn", "x": 55, "y": 66},
                                                        {"label": "Finish", "x": 77, "y": 88}
                                                      ]
                                                    }
                                                    """
                                    ))
                            )
                    ))
            ));
        });

        GeminiAnchorPixelClient client = new GeminiAnchorPixelClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        List<RouteAnchorPixelPointDTO> result = client.extractAnchorPixels(
                "data:image/png;base64,AQIDBA==",
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        );

        assertThat(result)
                .extracting(RouteAnchorPixelPointDTO::label, RouteAnchorPixelPointDTO::x, RouteAnchorPixelPointDTO::y)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Start", 11, 22),
                        org.assertj.core.groups.Tuple.tuple("River Crossing", 33, 44),
                        org.assertj.core.groups.Tuple.tuple("Downtown Turn", 55, 66),
                        org.assertj.core.groups.Tuple.tuple("Finish", 77, 88)
                );

        Map<String, Object> requestBody = requestHolder[0].getBody();
        assertThat(requestBody).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contents = (List<Map<String, Object>>) requestBody.get("contents");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contents.get(0).get("parts");
        @SuppressWarnings("unchecked")
        Map<String, Object> inlineData = (Map<String, Object>) parts.get(0).get("inline_data");
        assertThat(inlineData.get("mime_type")).isEqualTo("image/png");
        assertThat(inlineData.get("data")).isEqualTo("AQIDBA==");
    }

    @Test
    void extractAnchorPixelsRejectsResponsesWithoutExactlyFourAnchors() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        {
                                                          "anchors": [
                                                            {"label": "Start", "x": 1, "y": 2},
                                                            {"label": "River Crossing", "x": 3, "y": 4},
                                                            {"label": "Downtown Turn", "x": 5, "y": 6}
                                                          ]
                                                        }
                                                        """
                                        ))
                                )
                        ))
                )));

        GeminiAnchorPixelClient client = new GeminiAnchorPixelClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("anchor-pixels-invalid-count", ".png");
        Files.write(imagePath, new byte[] {9, 8, 7});

        assertThatThrownBy(() -> client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exactly 4");
    }

    @Test
    void extractAnchorPixelsRejectsBlankAnchorLabels() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        {
                                                          "anchors": [
                                                            {"label": "Start", "x": 1, "y": 2},
                                                            {"label": " ", "x": 3, "y": 4},
                                                            {"label": "Downtown Turn", "x": 5, "y": 6},
                                                            {"label": "Finish", "x": 7, "y": 8}
                                                          ]
                                                        }
                                                        """
                                        ))
                                )
                        ))
                )));

        GeminiAnchorPixelClient client = new GeminiAnchorPixelClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("anchor-pixels-blank-label", ".png");
        Files.write(imagePath, new byte[] {7, 7, 7});

        assertThatThrownBy(() -> client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("blank");
    }

    @Test
    void extractAnchorPixelsRejectsResponsesThatDoNotPreserveAnchorLabelOrder() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        {
                                                          "anchors": [
                                                            {"label": "Start", "x": 1, "y": 2},
                                                            {"label": "Downtown Turn", "x": 3, "y": 4},
                                                            {"label": "River Crossing", "x": 5, "y": 6},
                                                            {"label": "Finish", "x": 7, "y": 8}
                                                          ]
                                                        }
                                                        """
                                        ))
                                )
                        ))
                )));

        GeminiAnchorPixelClient client = new GeminiAnchorPixelClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("anchor-pixels-label-order", ".png");
        Files.write(imagePath, new byte[] {4, 4, 4});

        assertThatThrownBy(() -> client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("order");
    }

    @Test
    void extractAnchorPixelsRejectsNonIntegerCoordinates() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        {
                                                          "anchors": [
                                                            {"label": "Start", "x": 1, "y": 2},
                                                            {"label": "River Crossing", "x": 3.5, "y": 4},
                                                            {"label": "Downtown Turn", "x": 5, "y": 6},
                                                            {"label": "Finish", "x": 7, "y": 8}
                                                          ]
                                                        }
                                                        """
                                        ))
                                )
                        ))
                )));

        GeminiAnchorPixelClient client = new GeminiAnchorPixelClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("anchor-pixels-non-integer", ".png");
        Files.write(imagePath, new byte[] {5, 4, 3});

        assertThatThrownBy(() -> client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        ))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("integer");
    }

    @Test
    void extractAnchorPixelsRetriesTransientGeminiServiceUnavailableErrors() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        ))
                .thenThrow(HttpServerErrorException.create(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "busy",
                        HttpHeaders.EMPTY,
                        "{\"error\":{\"message\":\"busy\"}}".getBytes(StandardCharsets.UTF_8),
                        StandardCharsets.UTF_8
                ))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        {
                                                          "anchors": [
                                                            {"label": "Start", "x": 123, "y": 456},
                                                            {"label": "River Crossing", "x": 234, "y": 567},
                                                            {"label": "Downtown Turn", "x": 345, "y": 678},
                                                            {"label": "Finish", "x": 456, "y": 789}
                                                          ]
                                                        }
                                                        """
                                        ))
                                )
                        ))
                )));

        GeminiAnchorPixelClient client = new GeminiAnchorPixelClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("anchor-pixels-retry", ".png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        List<RouteAnchorPixelPointDTO> result = client.extractAnchorPixels(
                imagePath.toString(),
                new RouteParametersDTO("#22AA66", List.of("Start", "River Crossing", "Downtown Turn", "Finish"))
        );

        assertThat(result)
                .extracting(RouteAnchorPixelPointDTO::label, RouteAnchorPixelPointDTO::x, RouteAnchorPixelPointDTO::y)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Start", 123, 456),
                        org.assertj.core.groups.Tuple.tuple("River Crossing", 234, 567),
                        org.assertj.core.groups.Tuple.tuple("Downtown Turn", 345, 678),
                        org.assertj.core.groups.Tuple.tuple("Finish", 456, 789)
                );
        verify(restTemplate, times(2)).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                any(ParameterizedTypeReference.class)
        );
    }
}
