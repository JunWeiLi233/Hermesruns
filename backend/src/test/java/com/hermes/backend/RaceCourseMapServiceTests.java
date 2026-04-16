package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
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
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    void resolveCourseMapSkipsBingSearchWhenOfficialSiteAlreadyYieldsCandidates() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(false);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenAnswer(invocation -> {
                    String url = invocation.getArgument(0, String.class);
                    if ("https://example.com/race".equals(url)) {
                        return ResponseEntity.ok("""
                                <html>
                                  <body>
                                    <img src="/assets/course-map.png" alt="Course map" />
                                  </body>
                                </html>
                                """);
                    }
                    return ResponseEntity.ok("<html><body>No extra candidate.</body></html>");
                });
        when(restTemplate.exchange(
                eq("https://example.com/assets/course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));

        RaceCourseMapService service = new RaceCourseMapService(restTemplate, new com.fasterxml.jackson.databind.ObjectMapper(), systemConfigService, repository);

        RaceCourseMapService.RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.36,
                -71.05,
                42.195
        );

        assertThat(result.imageUrl()).isEqualTo("https://example.com/assets/course-map.png");
        verify(restTemplate, never()).exchange(
                startsWith("https://www.bing.com/images/search"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
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

    @Test
    void resolveCourseMapFindsLocalizedAboutCoursePageForTokyoStyleSites() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenAnswer(invocation -> {
                    String url = invocation.getArgument(0, String.class);
                    if ("https://www.marathon.tokyo/en/about/course/".equals(url)) {
                        return ResponseEntity.ok("""
                                <html>
                                  <body>
                                    <img src="images/cource_illust_map_en.png" alt="Course map" />
                                  </body>
                                </html>
                                """);
                    }
                    return ResponseEntity.ok("<html><body>No course map here.</body></html>");
                });
        when(restTemplate.exchange(
                eq("https://www.marathon.tokyo/en/about/course/images/cource_illust_map_en.png"),
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
                                                  "confidence": 82,
                                                  "summary": "Recognized the Tokyo Marathon course map and aligned the route across central Tokyo.",
                                                  "overlayBounds": {
                                                    "north": 35.7300,
                                                    "south": 35.6400,
                                                    "east": 139.8200,
                                                    "west": 139.6800
                                                  },
                                                  "routePoints": [
                                                    { "lat": 35.6895, "lng": 139.6917, "label": "Start" },
                                                    { "lat": 35.6990, "lng": 139.7070 },
                                                    { "lat": 35.7050, "lng": 139.7740 },
                                                    { "lat": 35.7100, "lng": 139.8100 },
                                                    { "lat": 35.6800, "lng": 139.7900 },
                                                    { "lat": 35.6700, "lng": 139.7600 },
                                                    { "lat": 35.6550, "lng": 139.7400 },
                                                    { "lat": 35.6812, "lng": 139.7671, "label": "Finish" }
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
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                35.6762,
                139.6503,
                42.195
        );

        assertThat(result.imageUrl()).isEqualTo("https://www.marathon.tokyo/en/about/course/images/cource_illust_map_en.png");
        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isNotEmpty();
        assertThat(result.overlayBounds()).isNotNull();
    }

    @Test
    void resolveCourseMapCanUsePdfDownloadLinksFromOfficialCoursePages() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenAnswer(invocation -> {
                    String url = invocation.getArgument(0, String.class);
                    if ("https://example.com/race/about/course".equals(url)) {
                        return ResponseEntity.ok("""
                                <html>
                                  <body>
                                    <a href="/downloads/course-map.pdf">Download the course map</a>
                                  </body>
                                </html>
                                """);
                    }
                    return ResponseEntity.ok("<html><body>No inline image.</body></html>");
                });
        when(restTemplate.exchange(
                eq("https://example.com/downloads/course-map.pdf"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePdf()));

        Map<String, Object> geminiResponse = Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 80,
                                                  "summary": "Recognized a PDF-exported course map and aligned the route.",
                                                  "overlayBounds": {
                                                    "north": 42.38,
                                                    "south": 42.22,
                                                    "east": -71.04,
                                                    "west": -71.55
                                                  },
                                                  "routePoints": [
                                                    { "lat": 42.228, "lng": -71.522, "label": "Start" },
                                                    { "lat": 42.247, "lng": -71.470 },
                                                    { "lat": 42.262, "lng": -71.418 },
                                                    { "lat": 42.279, "lng": -71.360 },
                                                    { "lat": 42.302, "lng": -71.278 },
                                                    { "lat": 42.331, "lng": -71.192 },
                                                    { "lat": 42.344, "lng": -71.122 },
                                                    { "lat": 42.349, "lng": -71.078, "label": "Finish" }
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
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.imageUrl()).startsWith("data:image/png;base64,");
        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isNotEmpty();
        assertThat(result.overlayBounds()).isNotNull();
    }

    @Test
    void uploadPendingCourseMapSupportsPdfUrlsByRenderingToPng() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        when(restTemplate.exchange(
                eq("https://example.com/manual-upload.pdf"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePdf()));

        Map<String, Object> geminiResponse = Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 90,
                                                  "summary": "Aligned the manually uploaded PDF course map.",
                                                  "overlayBounds": { "north": 1, "south": -1, "east": 1, "west": -1 },
                                                  "routePoints": [
                                                    { "lat": 0.01, "lng": 0.01, "label": "Start" },
                                                    { "lat": 0.02, "lng": 0.02 },
                                                    { "lat": 0.03, "lng": 0.03 },
                                                    { "lat": 0.04, "lng": 0.04 },
                                                    { "lat": 0.05, "lng": 0.05, "label": "Finish" }
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
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", List.of(10, 20))));

        RaceCourseMapService service = new RaceCourseMapService(restTemplate, new com.fasterxml.jackson.databind.ObjectMapper(), systemConfigService, repository);
        ReflectionTestUtils.setField(service, "aiApiKey", "test-key");
        ReflectionTestUtils.setField(service, "aiModel", "gemini-test");
        ReflectionTestUtils.setField(service, "aiProvider", "gemini");

        RaceCourseMapService.RaceCourseMapResult result = service.uploadPendingCourseMap(
                "race-123", "Race Name", "City", "Country", "https://race.com", 0.0, 0.0, 10.0,
                "https://example.com/manual-upload.pdf", "admin@hermes.com"
        );

        assertThat(result.imageUrl()).isEqualTo("https://example.com/manual-upload.pdf");
        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.confidence()).isEqualTo(90);
    }

    private byte[] samplePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private byte[] samplePdf() throws Exception {
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage());
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        }
    }

    private List<Integer> sampleElevations() {
        List<Integer> elevations = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            elevations.add(8 + (i % 6) * 3);
        }
        return elevations;
    }
}
