package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GeminiRouteParameterClientTests {

    @Test
    void extractRouteParametersBuildsGeminiPromptAndParsesJsonContract() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        @SuppressWarnings("unchecked")
        HttpEntity<Map<String, Object>>[] requestHolder = new HttpEntity[1];
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenAnswer(invocation -> {
            requestHolder[0] = invocation.getArgument(2);
            return ResponseEntity.ok(Map.of(
                    "candidates", List.of(Map.of(
                            "content", Map.of(
                                    "parts", List.of(Map.of(
                                            "text", """
                                                    {
                                                      "routeHexColor": "#00FF88",
                                                      "anchorPoints": ["start arch", "river bend", "downtown turn", "finish gantry"]
                                                    }
                                                    """
                                    ))
                            )
                    ))
            ));
        });

        GeminiRouteParameterClient client = new GeminiRouteParameterClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("route-parameters", ".png");
        Files.write(imagePath, new byte[] {1, 2, 3, 4});

        RouteParametersDTO result = client.extractRouteParameters(imagePath.toString());

        assertThat(result.routeHexColor()).isEqualTo("#00FF88");
        assertThat(result.anchorPoints()).containsExactly("start arch", "river bend", "downtown turn", "finish gantry");

        Map<String, Object> requestBody = requestHolder[0].getBody();
        assertThat(requestBody).isNotNull();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contents = (List<Map<String, Object>>) requestBody.get("contents");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contents.get(0).get("parts");
        @SuppressWarnings("unchecked")
        Map<String, Object> generationConfig = (Map<String, Object>) requestBody.get("generationConfig");
        @SuppressWarnings("unchecked")
        Map<String, Object> inlineData = (Map<String, Object>) parts.get(0).get("inline_data");
        assertThat(inlineData.get("mime_type")).isEqualTo("image/png");
        assertThat(inlineData.get("data")).isEqualTo("AQIDBA==");
        assertThat(parts.get(1).get("text"))
                .asString()
                .contains("routeHexColor")
                .contains("anchorPoints")
                .contains("Start and Finish");
        assertThat(generationConfig).isNotNull();
        assertThat(generationConfig.get("responseMimeType")).isEqualTo("application/json");
        @SuppressWarnings("unchecked")
        Map<String, Object> responseSchema = (Map<String, Object>) generationConfig.get("responseJsonSchema");
        assertThat(responseSchema).isNotNull();
        assertThat(responseSchema.get("type")).isEqualTo("object");
        @SuppressWarnings("unchecked")
        Map<String, Object> properties = (Map<String, Object>) responseSchema.get("properties");
        assertThat(properties).containsKeys("routeHexColor", "anchorPoints");
        @SuppressWarnings("unchecked")
        Map<String, Object> anchorPointsSchema = (Map<String, Object>) properties.get("anchorPoints");
        assertThat(anchorPointsSchema.get("minItems")).isEqualTo(4);
        assertThat(anchorPointsSchema.get("maxItems")).isEqualTo(4);
    }

    @Test
    void extractRouteParametersRejectsResponsesWithoutExactlyFourAnchorPoints() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of(
                        "candidates", List.of(Map.of(
                                "content", Map.of(
                                        "parts", List.of(Map.of(
                                                "text", """
                                                        {
                                                          "routeHexColor": "#224466",
                                                          "anchorPoints": ["start", "turn", "finish"]
                                                        }
                                                        """
                                        ))
                                )
                        ))
                )));

        GeminiRouteParameterClient client = new GeminiRouteParameterClient(restTemplate, new ObjectMapper(), systemConfigService);
        ReflectionTestUtils.setField(client, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(client, "aiModel", "gemini-test");

        Path imagePath = Files.createTempFile("route-parameters-invalid", ".png");
        Files.write(imagePath, new byte[] {9, 8, 7});

        assertThatThrownBy(() -> client.extractRouteParameters(imagePath.toString()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("anchorPoints");
    }
}
