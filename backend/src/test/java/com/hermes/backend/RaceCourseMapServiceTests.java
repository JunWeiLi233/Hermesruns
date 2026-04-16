package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RaceCourseMapServiceTests {

    @Test
    void resolveCourseMapReturnsCandidateOnlyWhenAiIsUnavailable() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(false);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("""
                        <html>
                          <body>
                            <img src="https://cdn.example.com/course-map.png" alt="Course map" />
                          </body>
                        </html>
                        """));
        when(restTemplate.exchange(
                eq("https://cdn.example.com/course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));

        RaceCourseMapService service = new RaceCourseMapService(restTemplate, new com.fasterxml.jackson.databind.ObjectMapper(), systemConfigService, repository);

        RaceCourseMapService.RaceCourseMapResult result = service.resolveCourseMap(
                "New York City Marathon",
                "New York City",
                "United States",
                "https://example.com/race",
                40.7128,
                -74.0060,
                42.195
        );

        assertThat(result.imageUrl()).isEqualTo("https://cdn.example.com/course-map.png");
        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.elevationSamples()).isEmpty();
    }

    @Test
    void resolveCourseMapReturnsAlignedRouteAndElevationWhenAiResponseIsPlausible() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("""
                        <html>
                          <body>
                            <img src="https://cdn.example.com/course-map.png" alt="Official course map" />
                          </body>
                        </html>
                        """));
        when(restTemplate.exchange(
                eq("https://cdn.example.com/course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));

        Map<String, Object> geminiResponse = Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 84,
                                                  "summary": "Recognized a multi-borough NYC course map and aligned the route.",
                                                  "overlayBounds": {
                                                    "north": 40.92,
                                                    "south": 40.55,
                                                    "east": -73.70,
                                                    "west": -74.12
                                                  },
                                                  "routePoints": [
                                                    { "lat": 40.601, "lng": -74.153, "label": "Start" },
                                                    { "lat": 40.650, "lng": -74.010 },
                                                    { "lat": 40.676, "lng": -73.980 },
                                                    { "lat": 40.713, "lng": -73.962 },
                                                    { "lat": 40.758, "lng": -73.954 },
                                                    { "lat": 40.799, "lng": -73.971 },
                                                    { "lat": 40.768, "lng": -73.981 },
                                                    { "lat": 40.771, "lng": -73.974, "label": "Finish" }
                                                  ]
                                                }
                                                """
                                ))
                        )
                ))
        );
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiResponse));

        when(restTemplate.exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations())));

        RaceCourseMapService service = new RaceCourseMapService(restTemplate, new com.fasterxml.jackson.databind.ObjectMapper(), systemConfigService, repository);
        ReflectionTestUtils.setField(service, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(service, "aiModel", "gemini-test");
        ReflectionTestUtils.setField(service, "aiProvider", "gemini");

        RaceCourseMapService.RaceCourseMapResult result = service.resolveCourseMap(
                "New York City Marathon",
                "New York City",
                "United States",
                "https://example.com/race",
                40.7128,
                -74.0060,
                42.195
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.confidence()).isEqualTo(84);
        assertThat(result.routePoints()).hasSize(8);
        assertThat(result.overlayBounds()).isNotNull();
        assertThat(result.elevationSamples()).hasSize(25);
        assertThat(result.totalClimbMeters()).isNotNull();
        assertThat(result.aiAssisted()).isTrue();
    }

    private byte[] samplePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private List<Integer> sampleElevations() {
        List<Integer> elevations = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            elevations.add(8 + (i % 6) * 3);
        }
        return elevations;
    }
}
