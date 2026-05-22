package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
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

        Map<String, Object> geminiResponse = geminiAlignmentResponse(
                84,
                denseNewYorkRouteJson(),
                "Recognized a multi-borough NYC course map and aligned the route."
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
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations(845))));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
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
        assertThat(result.routePoints()).hasSizeGreaterThanOrEqualTo(12);
        assertThat(result.overlayBounds()).isNotNull();
        assertThat(result.elevationSamples()).hasSize(845);
        assertThat(result.totalClimbMeters()).isNotNull();
        assertThat(result.aiAssisted()).isTrue();
    }

    @Test
    void resolveCourseMapRequestsElevationAtFiveHundredMeterIncrements() throws Exception {
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

        Map<String, Object> geminiResponse = geminiAlignmentResponse(
                84,
                denseNewYorkRouteJson(),
                "Recognized a multi-borough NYC course map and aligned the route."
        );
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiResponse));

        final List<String> requestedLatitudes = new ArrayList<>();
        doAnswer(invocation -> {
            RequestEntity<?> request = invocation.getArgument(0);
            URI uri = request.getUrl();
            String query = uri.getQuery();
            String latitudes = "";
            if (query != null) {
                for (String part : query.split("&")) {
                    if (part.startsWith("latitude=")) {
                        latitudes = part.substring("latitude=".length());
                        break;
                    }
                }
            }
            requestedLatitudes.add(latitudes);
            return ResponseEntity.ok(Map.of("elevation", sampleElevations(845)));
        }).when(restTemplate).exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        );

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        service.resolveCourseMap(
                "New York City Marathon",
                "New York City",
                "United States",
                "https://example.com/race",
                40.7128,
                -74.0060,
                42.195
        );

        assertThat(requestedLatitudes).hasSize(1);
        assertThat(requestedLatitudes.get(0).split(",")).hasSize(845);
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

        Map<String, Object> geminiResponse = geminiAlignmentResponse(
                82,
                denseTokyoRouteJson(),
                "Recognized the Tokyo Marathon course map and aligned the route across central Tokyo."
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
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

        Map<String, Object> geminiResponse = geminiAlignmentResponse(
                80,
                denseBostonRouteJson(),
                "Recognized a PDF-exported course map and aligned the route."
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
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
    void uploadPendingCourseMapStagesPreviewWithoutRunningQwen(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("race-upload-only")).thenReturn(Optional.empty());

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, qwenClient, courseMapUploadDirectory);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "race-upload-only",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                sampleLargeJpegDataUrl(),
                "admin@hermes.com"
        );

        assertThat(result.imageUrl()).startsWith("local-course-map:");
        String storedFileName = result.imageUrl().substring("local-course-map:".length());
        assertThat(Files.exists(courseMapUploadDirectory.resolve(storedFileName))).isTrue();
        assertThat(result.source()).isEqualTo("admin-upload");
        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.confidence()).isZero();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.aiAssisted()).isFalse();
        assertThat(result.summary()).contains("Hermes saved this upload");

        ArgumentCaptor<RaceCourseMapAsset> assetCaptor = ArgumentCaptor.forClass(RaceCourseMapAsset.class);
        verify(repository).save(assetCaptor.capture());
        RaceCourseMapAsset saved = assetCaptor.getValue();
        assertThat(saved.getPendingImageUrl()).isEqualTo(result.imageUrl());
        assertThat(saved.getPendingSource()).isEqualTo("admin-upload");
        assertThat(saved.getPendingConfidence()).isZero();
        assertThat(saved.getPendingSummary()).contains("automatic Qwen scanning");
        assertThat(saved.getPendingAiAssisted()).isFalse();
        assertThat(saved.getPendingRoutePointsJson()).isEqualTo("[]");
        verify(qwenClient, never()).analyzeCandidate(any(), any(), any());
    }

    @Test
    void uploadPendingCourseMapStagesPdfUrlsByRenderingToPngWithoutRunningQwen(@TempDir Path courseMapUploadDirectory) throws Exception {
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, buildTestQwenAlignmentClient(restTemplate), courseMapUploadDirectory);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "race-123", "Race Name", "City", "Country", "https://race.com", 0.0, 0.0, 10.0,
                "https://example.com/manual-upload.pdf", "admin@hermes.com"
        );

        assertThat(result.imageUrl()).startsWith("local-course-map:");
        assertThat(Files.exists(courseMapUploadDirectory.resolve(result.imageUrl().substring("local-course-map:".length())))).isTrue();
        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.confidence()).isZero();
        assertThat(result.routePoints()).isEmpty();
    }

    @Test
    void reanalyzePendingCourseMapSupportsLocalPdfDataUrlsWithAdminPreviewThreshold() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        String pdfDataUrl = samplePdfDataUrl();
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "race-124", "Tokyo Marathon", "Tokyo", "Japan", "https://www.marathon.tokyo/en/",
                35.6762, 139.6503, 42.195, pdfDataUrl, "admin-document-url"
        );
        when(repository.findByRaceId("race-124")).thenReturn(Optional.of(asset));

        Map<String, Object> geminiResponse = Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 62,
                                                  "summary": "Aligned the locally uploaded PDF course map.",
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "race-124", "Tokyo Marathon", "Tokyo", "Japan", "https://www.marathon.tokyo/en/", 35.6762, 139.6503, 42.195,
                "admin@hermes.com"
        );

        assertThat(result.imageUrl()).startsWith("data:image/png;base64,");
        assertThat(result.source()).isEqualTo("admin-document-url");
        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.confidence()).isEqualTo(62);
        assertThat(result.routePoints()).hasSize(8);
        assertThat(result.overlayBounds()).isNotNull();
        verify(restTemplate, never()).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
    }

    @Test
    void reanalyzePendingCourseMapReadsStoredCourseMapImageFromLocalFolder(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        byte[] storedImageBytes = samplePng();
        Files.write(courseMapUploadDirectory.resolve("chicago-marathon-local.png"), storedImageBytes);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "race-local-folder", "Chicago Marathon", "Chicago", "United States", "https://www.chicagomarathon.com/",
                41.8781, -87.6298, 42.195, "local-course-map:chicago-marathon-local.png", "admin-upload"
        );
        when(repository.findByRaceId("race-local-folder")).thenReturn(Optional.of(asset));
        when(qwenClient.analyzeCandidate(any(byte[].class), eq("image/png"), anyString())).thenReturn("""
                {
                  "isCourseMap": false,
                  "confidence": 0,
                  "summary": "No route geometry extracted from this test fixture.",
                  "routePoints": []
                }
                """);

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, qwenClient, courseMapUploadDirectory);

        String displayPreview = service.materializePreviewImageUrl("local-course-map:chicago-marathon-local.png");
        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "race-local-folder", "Chicago Marathon", "Chicago", "United States", "https://www.chicagomarathon.com/",
                41.8781, -87.6298, 42.195, "admin@hermes.com"
        );

        assertThat(displayPreview).startsWith("data:image/png;base64,");
        assertThat(result.imageUrl()).isEqualTo("local-course-map:chicago-marathon-local.png");
        assertThat(result.source()).isEqualTo("admin-upload");
        ArgumentCaptor<byte[]> imageCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(qwenClient, atLeastOnce()).analyzeCandidate(imageCaptor.capture(), eq("image/png"), anyString());
        assertThat(imageCaptor.getAllValues()).allSatisfy(bytes -> assertThat(bytes).isNotEmpty());
        verify(restTemplate, never()).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
    }

    @Test
    void uploadPendingCourseMapKeepsRenderedPdfPreviewWhenAlignmentFallsBelowThreshold(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(
                40,
                denseTokyoRouteJson(),
                "Hermes found route hints but could not align this PDF confidently."
        )));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, buildTestQwenAlignmentClient(restTemplate), courseMapUploadDirectory);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "race-125", "Tokyo Marathon", "Tokyo", "Japan", "https://www.marathon.tokyo/en/", 35.6762, 139.6503, 42.195,
                samplePdfDataUrl(), "admin@hermes.com"
        );

        assertThat(result.imageUrl()).startsWith("local-course-map:");
        assertThat(result.courseMapDetected()).isFalse();
        verify(restTemplate, never()).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
    }

    @Test
    void reanalyzePendingCourseMapKeepsAlignedPreviewForModerateConfidenceAdminScans() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "race-124", "Tokyo Marathon", "Tokyo", "Japan", "https://www.marathon.tokyo/en/",
                35.6762, 139.6503, 42.195, "https://example.com/manual-upload.png", "admin-image-url"
        );
        when(repository.findByRaceId("race-124")).thenReturn(Optional.of(asset));

        when(restTemplate.exchange(
                eq("https://example.com/manual-upload.png"),
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
                                                  "confidence": 62,
                                                  "summary": "Recognized a poster-style Tokyo Marathon course map with a plausible city route.",
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "race-124", "Tokyo Marathon", "Tokyo", "Japan", "https://www.marathon.tokyo/en/", 35.6762, 139.6503, 42.195,
                "admin@hermes.com"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.confidence()).isEqualTo(62);
        assertThat(result.routePoints()).isNotEmpty();
        assertThat(result.overlayBounds()).isNotNull();
    }

    @Test
    void reanalyzePendingCourseMapAcceptsChicagoMarathonLoopGeometry() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(systemConfigService.isCourseMapAiConfigured()).thenReturn(true);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "chicago-marathon-2025",
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com",
                41.8781,
                -87.6298,
                42.195,
                "https://example.com/25-bacm-course-map.jpg",
                "admin-image-url"
        );
        when(repository.findByRaceId("chicago-marathon-2025")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://example.com/25-bacm-course-map.jpg"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(sampleStylizedCourseMapPng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(
                82,
                chicagoLoopRouteJson(),
                "Aligned the official Chicago Marathon loop-style city course."
        )));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "chicago-marathon-2025",
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com",
                41.8781,
                -87.6298,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isNotEmpty();
        assertThat(result.summary()).doesNotContain("failed the plausibility checks");
    }

    @Test
    void reanalyzePendingCourseMapStoresSuccessfulRouteLocallyAndReplacesPreviousRoute(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(systemConfigService.isCourseMapAiConfigured()).thenReturn(true);
        Files.createDirectories(courseMapUploadDirectory.resolve("routes"));
        Files.write(courseMapUploadDirectory.resolve("boston-marathon-source.png"), samplePng());
        Path previousRoute = courseMapUploadDirectory.resolve("routes").resolve("boston-marathon-old-successful-route.json");
        Files.writeString(previousRoute, "{\"routePoints\":[{\"lat\":0.0,\"lng\":0.0}]}");
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "boston-marathon",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.3601,
                -71.0589,
                42.195,
                "local-course-map:boston-marathon-source.png",
                "admin-upload"
        );
        asset.setLocalRouteArtifactRef("local-course-map-route:boston-marathon-old-successful-route.json");
        asset.setLiveImageUrl("local-course-map:previous-boston.png");
        asset.setLiveSource("admin-upload");
        asset.setLiveConfidence(72);
        asset.setLiveSummary("Previous successful Boston route.");
        asset.setLiveRoutePointsJson("[{\"lat\":0.0,\"lng\":0.0}]");
        asset.setLiveAiAssisted(true);
        when(repository.findByRaceId("boston-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(
                82,
                denseBostonRouteJson(),
                "Aligned the replacement Boston Marathon course map."
        )));
        when(restTemplate.exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations())));

        RaceCourseMapService service = createService(
                restTemplate,
                systemConfigService,
                repository,
                null,
                buildTestQwenAlignmentClient(restTemplate),
                courseMapUploadDirectory
        );

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "boston-marathon",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.3601,
                -71.0589,
                42.195,
                "admin@hermes.test"
        );

        Path currentRoute = courseMapUploadDirectory.resolve("routes").resolve("boston-marathon-successful-route.json");
        String currentRouteJson = Files.readString(currentRoute);
        assertThat(result.courseMapDetected()).isTrue();
        assertThat(Files.exists(previousRoute)).isFalse();
        assertThat(asset.getLocalRouteArtifactRef()).isEqualTo("local-course-map-route:boston-marathon-successful-route.json");
        assertThat(currentRouteJson).contains("Aligned the replacement Boston Marathon course map.");
        assertThat(currentRouteJson).contains("42.228");
        assertThat(currentRouteJson).doesNotContain("\"lat\":0.0");
        assertThat(asset.getLiveImageUrl()).isEqualTo("local-course-map:boston-marathon-source.png");
        assertThat(asset.getLiveRoutePointsJson()).contains("42.228");
        assertThat(asset.getLiveConfidence()).isEqualTo(82);
    }

    @Test
    void uploadPendingCourseMapClearsPreviousSuccessfulLocalRouteBeforeReplacementScan(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(systemConfigService.isCourseMapAiConfigured()).thenReturn(true);
        Files.createDirectories(courseMapUploadDirectory.resolve("routes"));
        Path previousRoute = courseMapUploadDirectory.resolve("routes").resolve("tokyo-marathon-successful-route.json");
        Files.writeString(previousRoute, "{\"routePoints\":[{\"lat\":35.0,\"lng\":139.0}]}");
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("tokyo-marathon");
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.marathon.tokyo/en/");
        asset.setLatitude(35.6762);
        asset.setLongitude(139.6503);
        asset.setDistanceKm(42.195);
        asset.setLiveImageUrl("local-course-map:tokyo-marathon-old.png");
        asset.setLiveSource("admin-upload");
        asset.setLiveConfidence(84);
        asset.setLiveSummary("Previous successful Tokyo route.");
        asset.setLiveOverlayBoundsJson("{\"north\":35.73,\"south\":35.64,\"east\":139.82,\"west\":139.68}");
        asset.setLiveRoutePointsJson("[{\"lat\":35.0,\"lng\":139.0}]");
        asset.setLiveElevationSamplesJson("[10,12]");
        asset.setLiveTotalClimbMeters(120);
        asset.setLiveAiAssisted(true);
        asset.setLocalRouteArtifactRef("local-course-map-route:tokyo-marathon-successful-route.json");
        when(repository.findByRaceId("tokyo-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, qwenClient, courseMapUploadDirectory);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "tokyo-marathon",
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                35.6762,
                139.6503,
                42.195,
                sampleLargeJpegDataUrl(),
                "admin@hermes.test"
        );

        assertThat(result.imageUrl()).startsWith("local-course-map:");
        assertThat(Files.exists(previousRoute)).isFalse();
        assertThat(asset.getLocalRouteArtifactRef()).isNull();
        assertThat(asset.getLiveImageUrl()).isNull();
        assertThat(asset.getLiveRoutePointsJson()).isNull();
        assertThat(asset.getLiveOverlayBoundsJson()).isNull();
        assertThat(asset.getPendingImageUrl()).startsWith("local-course-map:");
        assertThat(asset.getPendingRoutePointsJson()).isEqualTo("[]");
        verify(qwenClient, never()).analyzeCandidate(any(), any(), any());
    }

    @Test
    void reanalyzePendingCourseMapKeepsStylizedRoadMarathonAsCityLevelMatch() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "chicago-marathon-2025",
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com",
                41.8781,
                -87.6298,
                42.195,
                "https://example.com/stylized-chicago-course-map.jpg",
                "admin-image-url"
        );
        when(repository.findByRaceId("chicago-marathon-2025")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://example.com/stylized-chicago-course-map.jpg"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(sampleStylizedCourseMapPng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(
                86,
                shortChicagoCityRouteJson(),
                "Recognized a stylized Chicago Marathon course map, but the poster route is not distance-accurate."
        )));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "chicago-marathon-2025",
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com",
                41.8781,
                -87.6298,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).hasSizeGreaterThanOrEqualTo(5);
        assertThat(result.overlayBounds()).isNotNull();
        assertThat(result.summary()).contains("city-level course-map match");
        assertThat(result.summary()).doesNotContain("failed the plausibility checks");
    }

    @Test
    void reanalyzePendingCourseMapDoesNotAcceptCityLevelWhenQwenTimesOut() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "chicago-marathon-2025",
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com",
                41.8781,
                -87.6298,
                42.195,
                "https://example.com/stylized-chicago-course-map.jpg",
                "admin-image-url"
        );
        when(repository.findByRaceId("chicago-marathon-2025")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(restTemplate.exchange(
                eq("https://example.com/stylized-chicago-course-map.jpg"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(sampleStylizedCourseMapPng()));
        when(qwenClient.analyzeCandidate(any(), any(), any()))
                .thenThrow(new IllegalStateException("Qwen course-map alignment timed out after 720 seconds."));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, qwenClient);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "chicago-marathon-2025",
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com",
                41.8781,
                -87.6298,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.summary()).contains("could not align");
        assertThat(result.summary()).doesNotContain("city-level course-map match");
    }

    @Test
    void acceptPendingCourseMapPublishesRealAdminUploadAsCityLevelReferenceWhenGeometryScanMisses() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "paris-marathon",
                "Schneider Electric Marathon de Paris",
                "Paris",
                "France",
                "https://www.schneiderelectricparismarathon.com",
                48.8566,
                2.3522,
                42.195,
                "local-course-map:paris-marathon-bff639082544a536.jpg",
                "admin-image-url"
        );
        asset.setPendingSummary("Hermes could not align this course-map confidently yet.");
        when(repository.findByRaceId("paris-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        service.acceptPendingCourseMap("paris-marathon", "admin@hermes.test");

        assertThat(asset.getLiveImageUrl()).isEqualTo("local-course-map:paris-marathon-bff639082544a536.jpg");
        assertThat(asset.getLiveConfidence()).isEqualTo(58);
        assertThat(asset.getLiveSummary()).contains("city-level course-map match");
        assertThat(asset.getLiveSummary()).contains("not a distance-accurate route overlay");
        assertThat(asset.getLiveOverlayBoundsJson()).contains("\"north\"");
        assertThat(asset.getLiveRoutePointsJson()).isEqualTo("[]");
        assertThat(asset.getLiveAiAssisted()).isTrue();
        assertThat(asset.getPendingImageUrl()).isNull();
        verify(repository).save(asset);
    }

    @Test
    void acceptPendingCourseMapDoesNotConvertImplausibleDetectedRouteToCityLevelReference() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "tokyo-marathon-qwen-smoke",
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo",
                35.6762,
                139.6503,
                42.195,
                "local-course-map:tokyo-marathon-qwen-smoke.webp",
                "admin-image-url"
        );
        asset.setPendingConfidence(90);
        asset.setPendingSummary("Hermes scanned this upload, but Qwen returned 4 route points covering 10.0 km. The route failed the plausibility checks for a 42.2 km road marathon.");
        when(repository.findByRaceId("tokyo-marathon-qwen-smoke")).thenReturn(Optional.of(asset));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        assertThatThrownBy(() -> service.acceptPendingCourseMap("tokyo-marathon-qwen-smoke", "admin@hermes.test"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Pending course-map must align");
        verify(repository, never()).save(any());
    }

    @Test
    void reanalyzePendingCourseMapRejectsCityLevelFallbackForTrailMarathon() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "trail-marathon", "Chicago Trail Marathon", "Chicago", "United States", "https://example.com/trail",
                41.8781, -87.6298, 42.195, "https://example.com/trail-course-map.jpg", "admin-image-url"
        );
        when(repository.findByRaceId("trail-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://example.com/trail-course-map.jpg"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(
                86,
                shortChicagoCityRouteJson(),
                "Recognized a route-like trail marathon graphic."
        )));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "trail-marathon",
                "Chicago Trail Marathon",
                "Chicago",
                "United States",
                "https://example.com/trail",
                41.8781,
                -87.6298,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.summary()).contains("failed the plausibility checks");
    }

    @Test
    void inferPromptRaceTypeTreatsChicagoMarathonAsLoop() throws Exception {
        RaceCourseMapService service = createService(mock(RestTemplate.class), mock(SystemConfigService.class), mock(RaceCourseMapAssetRepository.class));

        Object raceType = ReflectionTestUtils.invokeMethod(
                service,
                "inferPromptRaceType",
                "Bank of America Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com"
        );

        assertThat(raceType).isEqualTo(enumValue("LOOP"));
    }

    @Test
    void reanalyzePendingCourseMapExplainsQwenRouteDiagnosticsWhenPlausibilityFails() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        RaceCourseMapAsset asset = pendingCourseMapAsset(
                "boston-marathon", "Boston Marathon", "Boston", "United States", "https://www.baa.org",
                42.3601, -71.0589, 42.195, "https://example.com/boston-course-map.jpg", "admin-image-url"
        );
        when(repository.findByRaceId("boston-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://example.com/boston-course-map.jpg"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(
                88,
                farFromBostonRouteJson(),
                "Qwen found a route-like line far from Boston."
        )));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "boston-marathon",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.3601,
                -71.0589,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.summary()).contains("failed the plausibility checks");
        assertThat(result.summary()).contains("Qwen returned");
        assertThat(result.summary()).contains("route points");
        assertThat(result.summary()).contains("km");
    }

    @Test
    void uploadPendingCourseMapPreservesUploadedPreviewWhenAiAlignmentThrows(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        when(restTemplate.exchange(
                eq("https://example.com/manual-upload.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));

        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenThrow(new IllegalStateException("Gemini unavailable"));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, buildTestQwenAlignmentClient(restTemplate), courseMapUploadDirectory);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "race-126", "Race Name", "City", "Country", "https://race.com", 0.0, 0.0, 10.0,
                "https://example.com/manual-upload.png", "admin@hermes.com"
        );

        assertThat(result.imageUrl()).startsWith("local-course-map:");
        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.summary()).contains("saved this upload");
    }

    @Test
    void uploadPendingCourseMapDownscalesLargeInlineImagePreviewWhenAiIsUnavailable(@TempDir Path courseMapUploadDirectory) throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(false);

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, null, buildTestQwenAlignmentClient(restTemplate), courseMapUploadDirectory);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "race-127", "Race Name", "City", "Country", "https://race.com", 0.0, 0.0, 10.0,
                sampleLargeJpegDataUrl(), "admin@hermes.com"
        );

        assertThat(result.imageUrl()).startsWith("local-course-map:");
        BufferedImage preview = decodeDataUrlImage(service.materializePreviewImageUrl(result.imageUrl()));
        assertThat(preview).isNotNull();
        assertThat(Math.max(preview.getWidth(), preview.getHeight())).isLessThanOrEqualTo(1800);

        ArgumentCaptor<RaceCourseMapAsset> assetCaptor = ArgumentCaptor.forClass(RaceCourseMapAsset.class);
        verify(repository).save(assetCaptor.capture());
        BufferedImage persistedPreview = decodeDataUrlImage(service.materializePreviewImageUrl(assetCaptor.getValue().getPendingImageUrl()));
        assertThat(persistedPreview).isNotNull();
        assertThat(Math.max(persistedPreview.getWidth(), persistedPreview.getHeight())).isLessThanOrEqualTo(1800);
    }

    @Test
    void reanalyzePendingCourseMapSupportsWebpAdminUploads() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("tokyo-marathon");
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.marathon.tokyo/en/");
        asset.setLatitude(35.6762);
        asset.setLongitude(139.6503);
        asset.setDistanceKm(42.195);
        asset.setPendingImageUrl(sampleWebpDataUrl());
        asset.setPendingSource("admin-upload");
        asset.setPendingSummary("Hermes saved the upload but could not align it confidently yet.");
        asset.setPendingConfidence(0);
        asset.setPendingOverlayBoundsJson(null);
        asset.setPendingRoutePointsJson(null);
        asset.setPendingElevationSamplesJson(null);
        asset.setPendingAiAssisted(false);

        when(repository.findByRaceId("tokyo-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> geminiResponse = Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 62,
                                                  "summary": "Aligned the WEBP admin upload into a runner-visible Tokyo course map.",
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
                                                """.formatted(denseBostonRouteJson())
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
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations(44))));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "tokyo-marathon",
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                35.6762,
                139.6503,
                42.195,
                "admin@hermes.com"
        );

        assertThat(result.imageUrl()).startsWith("data:image/webp;base64,");
        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.confidence()).isEqualTo(62);
        assertThat(result.summary()).contains("WEBP admin upload");
        assertThat(result.summary()).doesNotContain("Qwen was skipped");
        assertThat(result.routePoints()).isNotEmpty();
        assertThat(result.overlayBounds()).isNotNull();
        verify(restTemplate, atLeastOnce()).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        );
    }

    @Test
    void getAdminDetailIncludesStoredAlignmentFieldsInPreviewSnapshots() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("race-123");
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setPendingImageUrl("data:image/png;base64,pending");
        asset.setPendingSource("admin-upload");
        asset.setPendingSummary("Pending alignment preview");
        asset.setPendingConfidence(88);
        asset.setPendingOverlayBoundsJson("{\"north\":35.73,\"south\":35.64,\"east\":139.82,\"west\":139.68}");
        asset.setPendingRoutePointsJson("[{\"lat\":35.6895,\"lng\":139.6917,\"label\":\"Start\"},{\"lat\":35.6812,\"lng\":139.7671,\"label\":\"Finish\"}]");
        asset.setPendingElevationSamplesJson("[8,12,16]");
        asset.setPendingTotalClimbMeters(42);
        asset.setPendingAiAssisted(true);
        asset.setLiveImageUrl("data:image/png;base64,live");
        asset.setLiveSource("official-page");
        asset.setLiveSummary("Live aligned preview");
        asset.setLiveConfidence(91);
        asset.setLiveOverlayBoundsJson("{\"north\":35.73,\"south\":35.64,\"east\":139.82,\"west\":139.68}");
        asset.setLiveRoutePointsJson("[{\"lat\":35.6895,\"lng\":139.6917,\"label\":\"Start\"},{\"lat\":35.6812,\"lng\":139.7671,\"label\":\"Finish\"}]");
        asset.setLiveElevationSamplesJson("[8,12,16]");
        asset.setLiveTotalClimbMeters(42);
        asset.setLiveAiAssisted(true);

        when(repository.findByRaceId("race-123")).thenReturn(Optional.of(asset));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapAdminDetail detail = service.getAdminDetail("race-123");

        assertThat(detail.pendingPreview()).isNotNull();
        assertThat(detail.pendingPreview().routePoints()).hasSize(2);
        assertThat(detail.pendingPreview().overlayBounds()).isNotNull();
        assertThat(detail.pendingPreview().elevationSamples()).containsExactly(8, 12, 16);
        assertThat(detail.pendingPreview().totalClimbMeters()).isEqualTo(42);
        assertThat(detail.pendingPreview().aiAssisted()).isTrue();
        assertThat(detail.pendingPreview().previewImageUrl()).isEqualTo("data:image/png;base64,pending");

        assertThat(detail.live()).isNotNull();
        assertThat(detail.live().routePoints()).hasSize(2);
        assertThat(detail.live().overlayBounds()).isNotNull();
        assertThat(detail.live().previewImageUrl()).isEqualTo("data:image/png;base64,live");
    }

    @Test
    void getAdminDetailSanitizesStoredCityLevelSummaryFromOldQwenTimeout() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("chicago-marathon");
        asset.setRaceName("Bank of America Chicago Marathon");
        asset.setCity("Chicago");
        asset.setCountry("United States");
        asset.setPendingImageUrl("local-course-map:chicago-marathon.png");
        asset.setPendingSource("admin-upload");
        asset.setPendingSummary("Hermes accepted this stylized upload as a city-level course-map match for a standard road marathon in Chicago. The upload is treated as a city-level map reference, not a distance-accurate route overlay. Direct Qwen alignment failed first: Qwen course-map alignment timed out after 120 seconds.");
        asset.setPendingConfidence(58);
        asset.setPendingOverlayBoundsJson("{\"north\":42.01,\"south\":41.67,\"east\":-87.52,\"west\":-87.78}");
        asset.setPendingRoutePointsJson("[]");
        asset.setPendingAiAssisted(true);
        when(repository.findByRaceId("chicago-marathon")).thenReturn(Optional.of(asset));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapAdminDetail detail = service.getAdminDetail("chicago-marathon");

        assertThat(detail.pendingPreview()).isNotNull();
        assertThat(detail.pendingPreview().summary()).contains("fresh Qwen re-scan");
        assertThat(detail.pendingPreview().summary()).doesNotContain("120 seconds");
        assertThat(detail.pendingPreview().summary()).doesNotContain("city-level course-map match");
        assertThat(detail.pendingPreview().courseMapDetected()).isFalse();
    }

    @Test
    void getAdminDetailMaterializesRemotePreviewImagesIntoDisplayableDataUrls() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(false);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("tokyo-marathon");
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.marathon.tokyo/en/");
        asset.setPendingImageUrl("https://legacyhalf.tokyo/en/about/img/about-course-map_02_e.png");
        asset.setPendingSource("official-page");
        asset.setPendingSummary("AI course-map alignment is not configured.");
        asset.setPendingConfidence(0);
        asset.setLiveImageUrl("https://legacyhalf.tokyo/en/about/img/about-course-map_02_e.png");
        asset.setLiveSource("official-page");
        asset.setLiveSummary("Stored live preview");
        asset.setLiveConfidence(0);

        when(repository.findByRaceId("tokyo-marathon")).thenReturn(Optional.of(asset));
        when(restTemplate.exchange(
                eq("https://legacyhalf.tokyo/en/about/img/about-course-map_02_e.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapAdminDetail detail = service.getAdminDetail("tokyo-marathon");

        assertThat(detail.pendingPreview()).isNotNull();
        assertThat(detail.pendingPreview().previewImageUrl()).startsWith("data:image/png;base64,");
        assertThat(detail.live()).isNotNull();
        assertThat(detail.live().previewImageUrl()).startsWith("data:image/png;base64,");
    }

    @Test
    void resolveCourseMapWithStorageDoesNotReprocessPublishedLiveImageWhenAlignedDataIsMissing() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("tokyo-marathon");
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.marathon.tokyo/en/");
        asset.setLatitude(35.6762);
        asset.setLongitude(139.6503);
        asset.setDistanceKm(42.195);
        asset.setLiveImageUrl("https://example.com/manual-upload.png");
        asset.setLiveSource("admin-upload");
        asset.setLiveSummary("Hermes saved the upload but could not align it confidently yet.");
        asset.setLiveConfidence(0);
        asset.setLiveOverlayBoundsJson(null);
        asset.setLiveRoutePointsJson(null);
        asset.setLiveElevationSamplesJson(null);
        asset.setLiveAiAssisted(false);

        when(repository.findByRaceId("tokyo-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://example.com/manual-upload.png"),
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
                                                  "confidence": 62,
                                                  "summary": "Aligned the admin-approved Tokyo course map for the public race detail route.",
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMapWithStorage(
                "tokyo-marathon",
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                35.6762,
                139.6503,
                42.195
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.confidence()).isZero();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.overlayBounds()).isNull();
        assertThat(asset.getLiveRoutePointsJson()).isNull();
        assertThat(asset.getLiveOverlayBoundsJson()).isNull();
        assertThat(asset.getLiveElevationSamplesJson()).isNull();
        assertThat(asset.getLiveAiAssisted()).isFalse();
        verify(restTemplate, never()).exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                eq(byte[].class)
        );
        verify(repository, never()).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void acceptPendingCourseMapRequiresPreAnalyzedPendingImageBeforePublishingLive() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("tokyo-marathon");
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.marathon.tokyo/en/");
        asset.setLatitude(35.6762);
        asset.setLongitude(139.6503);
        asset.setDistanceKm(42.195);
        asset.setPendingImageUrl("https://example.com/manual-upload.png");
        asset.setPendingSource("admin-upload");
        asset.setPendingSummary("Hermes saved the upload but could not align it confidently yet.");
        asset.setPendingConfidence(0);
        asset.setPendingOverlayBoundsJson(null);
        asset.setPendingRoutePointsJson(null);
        asset.setPendingElevationSamplesJson(null);
        asset.setPendingAiAssisted(false);

        when(repository.findByRaceId("tokyo-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://example.com/manual-upload.png"),
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
                                                  "confidence": 62,
                                                  "summary": "Aligned the admin-approved Tokyo course map before publishing it live.",
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        assertThatThrownBy(() -> service.acceptPendingCourseMap("tokyo-marathon", "admin@hermes.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Pending course-map must align before publishing live.");

        assertThat(asset.getLiveImageUrl()).isNull();
        assertThat(asset.getLiveConfidence()).isNull();
        assertThat(asset.getLiveRoutePointsJson()).isNull();
        assertThat(asset.getLiveOverlayBoundsJson()).isNull();
        assertThat(asset.getLiveElevationSamplesJson()).isNull();
        assertThat(asset.getLiveAiAssisted()).isNull();
        assertThat(asset.getPendingImageUrl()).isEqualTo("https://example.com/manual-upload.png");
        assertThat(asset.getPendingSource()).isEqualTo("admin-upload");
        assertThat(asset.getPendingConfidence()).isZero();
        assertThat(asset.getPendingSummary()).contains("could not align");
        verify(restTemplate, never()).exchange(
                anyString(),
                any(HttpMethod.class),
                any(HttpEntity.class),
                eq(byte[].class)
        );
        verify(repository, never()).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void getAdminDetailDoesNotRecomputeCurrentLivePreview() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("tokyo-marathon");
        asset.setRaceName("Tokyo Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.marathon.tokyo/en/");
        asset.setLatitude(35.6762);
        asset.setLongitude(139.6503);
        asset.setDistanceKm(42.195);
        asset.setLiveImageUrl("https://example.com/manual-upload.png");
        asset.setLiveSource("admin-upload");
        asset.setLiveSummary("Stored live asset is still a raw upload.");
        asset.setLiveConfidence(0);
        asset.setLiveOverlayBoundsJson(null);
        asset.setLiveRoutePointsJson(null);
        asset.setLiveElevationSamplesJson(null);
        asset.setLiveAiAssisted(false);

        when(repository.findByRaceId("tokyo-marathon")).thenReturn(Optional.of(asset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://example.com/manual-upload.png"),
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
                                                  "confidence": 62,
                                                  "summary": "Resolved the current live Tokyo course map exactly as the runner-facing page will show it.",
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapAdminDetail detail = service.getAdminDetail("tokyo-marathon");

        assertThat(detail.live()).isNotNull();
        assertThat(detail.live().routePoints()).isEmpty();
        assertThat(detail.currentLivePreview()).isNotNull();
        assertThat(detail.currentLivePreview().routePoints()).isEmpty();
        assertThat(detail.currentLivePreview().overlayBounds()).isNull();
        assertThat(detail.currentLivePreview().elevationSamples()).isEmpty();
        assertThat(detail.currentLivePreview().aiAssisted()).isFalse();
        assertThat(detail.currentLivePreview().previewImageUrl()).startsWith("data:image/png;base64,");
        assertThat(detail.currentLivePreview().routePoints()).containsExactlyElementsOf(detail.live().routePoints());
        verify(repository, never()).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void getAdminDetailFallsBackToStoredPreviewsWhenCurrentLiveRecomputeFails() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("osaka-marathon");
        asset.setRaceName("Osaka Marathon");
        asset.setCity("Osaka");
        asset.setCountry("Japan");
        asset.setOfficialWebsite("https://www.osaka-marathon.com/2026/en/");
        asset.setLatitude(34.6937);
        asset.setLongitude(135.5023);
        asset.setDistanceKm(42.195);
        asset.setPendingImageUrl("https://osaka-marathon.com/2026/en/info/course/img/img_map_en.jpg");
        asset.setPendingSource("Osaka Marathon course map");
        asset.setPendingSummary("AI course-map alignment is not configured.");
        asset.setPendingConfidence(0);
        asset.setPendingRoutePointsJson("[]");
        asset.setLiveImageUrl("https://osaka-marathon.com/2026/en/info/course/img/img_map_en.jpg");
        asset.setLiveSource("official-page");
        asset.setLiveSummary("Stored live preview");
        asset.setLiveConfidence(0);
        asset.setLiveRoutePointsJson(null);
        asset.setLiveOverlayBoundsJson(null);
        asset.setLiveElevationSamplesJson(null);
        asset.setLiveAiAssisted(false);

        when(repository.findByRaceId("osaka-marathon")).thenReturn(Optional.of(asset));
        when(restTemplate.exchange(
                eq("https://osaka-marathon.com/2026/en/info/course/img/img_map_en.jpg"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        doThrow(new RuntimeException("ai gateway failed"))
                .when(restTemplate)
                .exchange(
                        eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                        eq(HttpMethod.POST),
                        any(HttpEntity.class),
                        eq(Map.class)
                );

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapAdminDetail detail = service.getAdminDetail("osaka-marathon");

        assertThat(detail.pendingPreview()).isNotNull();
        assertThat(detail.pendingPreview().previewImageUrl()).startsWith("data:image/png;base64,");
        assertThat(detail.live()).isNotNull();
        assertThat(detail.live().previewImageUrl()).startsWith("data:image/png;base64,");
        assertThat(detail.currentLivePreview()).isNotNull();
        assertThat(detail.currentLivePreview().routePoints()).isEmpty();
        assertThat(detail.currentLivePreview().aiAssisted()).isFalse();
    }

    @Test
    void resolveCourseMapPrefersBestPlausibleAlignmentFromCandidateHypotheses() throws Exception {
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
                                                  "confidence": 93,
                                                  "summary": "A high-confidence but wrong-city interpretation.",
                                                  "overlayBounds": {
                                                    "north": 34.15,
                                                    "south": 33.95,
                                                    "east": -118.15,
                                                    "west": -118.45
                                                  },
                                                  "routePoints": [
                                                    { "lat": 34.0522, "lng": -118.2437, "label": "Start" },
                                                    { "lat": 34.0610, "lng": -118.2500 },
                                                    { "lat": 34.0720, "lng": -118.2700 },
                                                    { "lat": 34.0810, "lng": -118.3000 },
                                                    { "lat": 34.0950, "lng": -118.3300 },
                                                    { "lat": 34.1100, "lng": -118.3600 },
                                                    { "lat": 34.1200, "lng": -118.3900 },
                                                    { "lat": 34.1300, "lng": -118.4100, "label": "Finish" }
                                                  ],
                                                  "candidateAlignments": [
                                                    {
                                                      "confidence": 93,
                                                      "summary": "A high-confidence but wrong-city interpretation.",
                                                      "overlayBounds": {
                                                        "north": 34.15,
                                                        "south": 33.95,
                                                        "east": -118.15,
                                                        "west": -118.45
                                                      },
                                                      "routePoints": [
                                                        { "lat": 34.0522, "lng": -118.2437, "label": "Start" },
                                                        { "lat": 34.0610, "lng": -118.2500 },
                                                        { "lat": 34.0720, "lng": -118.2700 },
                                                        { "lat": 34.0810, "lng": -118.3000 },
                                                        { "lat": 34.0950, "lng": -118.3300 },
                                                        { "lat": 34.1100, "lng": -118.3600 },
                                                        { "lat": 34.1200, "lng": -118.3900 },
                                                        { "lat": 34.1300, "lng": -118.4100, "label": "Finish" }
                                                      ],
                                                      "startLabel": "Dodger Stadium",
                                                      "finishLabel": "Santa Monica"
                                                    },
                                                    {
                                                      "confidence": 81,
                                                      "summary": "Aligned the Boston Marathon point-to-point course from Hopkinton to Boylston Street.",
                                                      "overlayBounds": {
                                                        "north": 42.38,
                                                        "south": 42.22,
                                                        "east": -71.04,
                                                        "west": -71.55
                                                      },
                                                      "routePoints": %s,
                                                      "startLabel": "Hopkinton",
                                                      "finishLabel": "Boylston Street"
                                                    }
                                                  ]
                                                }
                                                """.formatted(denseBostonRouteJson())
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
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations(44))));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.confidence()).isEqualTo(81);
        assertThat(result.summary()).contains("Boston Marathon");
        assertThat(result.routePoints()).isNotEmpty();
        assertThat(result.routePoints().get(0).lat()).isCloseTo(42.228, org.assertj.core.data.Offset.offset(0.0001));
        assertThat(result.routePoints().get(0).lng()).isCloseTo(-71.522, org.assertj.core.data.Offset.offset(0.0001));
    }

    @Test
    void resolveCourseMapRejectsTooSparseMarathonAlignmentEvenAtHighConfidence() throws Exception {
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
                                                  "confidence": 97,
                                                  "summary": "Very confident, but the route trace is too sparse to trust.",
                                                  "overlayBounds": {
                                                    "north": 42.38,
                                                    "south": 42.22,
                                                    "east": -71.04,
                                                    "west": -71.55
                                                  },
                                                  "routePoints": [
                                                    { "lat": 42.228, "lng": -71.522, "label": "Start" },
                                                    { "lat": 42.279, "lng": -71.360 },
                                                    { "lat": 42.302, "lng": -71.278 },
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.imageUrl()).isEqualTo("https://cdn.example.com/course-map.png");
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.summary()).contains("could not align");
    }

    @Test
    void resolveCourseMapRejectsTooShortTokyoMarathonAlignmentEvenAtHighConfidence() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("""
                        <html>
                          <body>
                            <img src="https://cdn.example.com/tokyo-course-map.png" alt="Official course map" />
                          </body>
                        </html>
                        """));
        when(restTemplate.exchange(
                eq("https://cdn.example.com/tokyo-course-map.png"),
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
                                                  "confidence": 96,
                                                  "summary": "Detected a short central-Tokyo route trace.",
                                                  "overlayBounds": {
                                                    "north": 35.705,
                                                    "south": 35.662,
                                                    "east": 139.754,
                                                    "west": 139.687
                                                  },
                                                  "routePoints": [
                                                    { "lat": 35.6895, "lng": 139.6917, "label": "Start" },
                                                    { "lat": 35.6902, "lng": 139.7031 },
                                                    { "lat": 35.6938, "lng": 139.7124 },
                                                    { "lat": 35.6897, "lng": 139.7188 },
                                                    { "lat": 35.6961, "lng": 139.7227 },
                                                    { "lat": 35.6933, "lng": 139.7291, "label": "Finish" }
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "https://www.marathon.tokyo/en/",
                35.6762,
                139.6503,
                42.195
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.imageUrl()).isEqualTo("https://cdn.example.com/tokyo-course-map.png");
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.summary()).contains("could not align");
    }

    @Test
    void prepareRoutePointsForPlausibilityResamplesCoherentSparseRoute() {
        RaceCourseMapService service = createService(mock(RestTemplate.class), mock(SystemConfigService.class), mock(RaceCourseMapAssetRepository.class));
        List<RoutePoint> sparseRoute = List.of(
                new RoutePoint(42.2280, -71.5220, "Start"),
                new RoutePoint(42.2500, -71.4700, null),
                new RoutePoint(42.2750, -71.4100, null),
                new RoutePoint(42.3000, -71.3500, null),
                new RoutePoint(42.3250, -71.2900, null),
                new RoutePoint(42.3400, -71.2200, null),
                new RoutePoint(42.3460, -71.1500, null),
                new RoutePoint(42.3498, -71.0785, "Finish")
        );

        @SuppressWarnings("unchecked")
        List<RoutePoint> prepared = (List<RoutePoint>) ReflectionTestUtils.invokeMethod(
                service,
                "prepareRoutePointsForPlausibility",
                sparseRoute,
                42.195,
                12
        );

        assertThat(prepared).hasSizeGreaterThanOrEqualTo(12);
        assertThat(prepared.get(0).label()).isEqualTo("Start");
        assertThat(prepared.get(prepared.size() - 1).label()).isEqualTo("Finish");
    }

    @Test
    void prepareRoutePointsForPlausibilityLeavesTooShortSparseRouteUnchanged() {
        RaceCourseMapService service = createService(mock(RestTemplate.class), mock(SystemConfigService.class), mock(RaceCourseMapAssetRepository.class));
        List<RoutePoint> shortTokyoRoute = List.of(
                new RoutePoint(35.6895, 139.6917, "Start"),
                new RoutePoint(35.6902, 139.7031, null),
                new RoutePoint(35.6938, 139.7124, null),
                new RoutePoint(35.6897, 139.7188, null),
                new RoutePoint(35.6961, 139.7227, null),
                new RoutePoint(35.6933, 139.7291, "Finish")
        );

        @SuppressWarnings("unchecked")
        List<RoutePoint> prepared = (List<RoutePoint>) ReflectionTestUtils.invokeMethod(
                service,
                "prepareRoutePointsForPlausibility",
                shortTokyoRoute,
                42.195,
                12
        );

        assertThat(prepared).hasSize(shortTokyoRoute.size());
        assertThat(prepared).containsExactlyElementsOf(shortTokyoRoute);
    }

    @Test
    void resolveCourseMapRejectsAlignmentWhenRouteCentroidIsInWrongCity() throws Exception {
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
                                                  "confidence": 88,
                                                  "summary": "This route shape looks polished, but it sits in the wrong metro area.",
                                                  "overlayBounds": {
                                                    "north": 34.15,
                                                    "south": 33.95,
                                                    "east": -118.15,
                                                    "west": -118.45
                                                  },
                                                  "routePoints": [
                                                    { "lat": 34.0522, "lng": -118.2437, "label": "Start" },
                                                    { "lat": 34.0610, "lng": -118.2500 },
                                                    { "lat": 34.0720, "lng": -118.2700 },
                                                    { "lat": 34.0810, "lng": -118.3000 },
                                                    { "lat": 34.0950, "lng": -118.3300 },
                                                    { "lat": 34.1100, "lng": -118.3600 },
                                                    { "lat": 34.1200, "lng": -118.3900 },
                                                    { "lat": 34.1300, "lng": -118.4100, "label": "Finish" }
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

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.imageUrl()).isEqualTo("https://cdn.example.com/course-map.png");
        assertThat(result.routePoints()).isEmpty();
    }

    @Test
    void resolveCourseMapPreservesAbruptElevationChangesInReturnedSamples() throws Exception {
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

        Map<String, Object> geminiResponse = geminiAlignmentResponse(
                84,
                denseNewYorkRouteJson(),
                "Recognized a multi-borough NYC course map and aligned the route."
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
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", List.of(100, 101, 100, 101, 100, 101, 100, 115))));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "New York City Marathon",
                "New York City",
                "United States",
                "https://example.com/race",
                40.7128,
                -74.0060,
                42.195
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.elevationSamples()).containsExactly(101, 100, 101, 100, 101, 100, 100, 115);
        assertThat(result.totalClimbMeters()).isEqualTo(17);
    }

    @Test
    void buildAlignmentPromptIncludesRaceSpecificLocationContext() {
        RaceCourseMapPromptBuilder promptBuilder = new RaceCourseMapPromptBuilder();

        String prompt = ReflectionTestUtils.invokeMethod(
                promptBuilder,
                "buildAlignmentPrompt",
                "Boston Marathon",
                "Boston",
                "United States",
                42.3601,
                -71.0589,
                42.195,
                false,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                null
        );

        assertThat(prompt).contains("Race location:");
        assertThat(prompt).contains("Approximate race-area coordinates");
        assertThat(prompt).contains("Key landmarks near course");
        assertThat(prompt).contains("Race type: point-to-point.");
        assertThat(prompt).contains("Total distance: 42.195 km.");
        assertThat(prompt).contains("Do NOT zigzag between parallel");
        assertThat(prompt).contains("strict start-to-finish order");
    }

    @Test
    void resolveCourseMapRepromptsWhenPointToPointRouteBacktracksTowardStart() throws Exception {
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
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        ))
                .thenReturn(ResponseEntity.ok(geminiAlignmentResponse(86, backtrackingBostonRouteJson(), "Initial pass switched between nearby parallel course lines.")))
                .thenReturn(ResponseEntity.ok(geminiAlignmentResponse(83, denseBostonRouteJson(), "Corrected to a single point-to-point route from Hopkinton to Boylston Street.")));
        when(restTemplate.exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations(44))));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.summary()).contains("Corrected");
        assertThat(result.routePoints()).hasSizeGreaterThanOrEqualTo(20);
        Integer backtracks = ReflectionTestUtils.invokeMethod(ReflectionTestUtils.getField(service, "geometryService"), "countStartDistanceBacktracks", result.routePoints(), enumValue("POINT_TO_POINT"), 42.195);
        assertThat(backtracks).isZero();
        verify(restTemplate, times(2)).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        );
    }

    @Test
    void resolveCourseMapRebuildsOutAndBackRoutesFromOutboundTrace() throws Exception {
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
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(84, outboundCharlesRiverRouteJson(), "Aligned the outbound half of the Charles River out-and-back course.")));
        when(restTemplate.exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations(44))));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Charles River Out-and-Back 10K",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3200,
                -71.1100,
                10.0
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).hasSize(13);
        assertThat(result.routePoints().get(0).lat()).isCloseTo(result.routePoints().get(result.routePoints().size() - 1).lat(), org.assertj.core.data.Offset.offset(0.0001));
        assertThat(result.routePoints().get(0).lng()).isCloseTo(result.routePoints().get(result.routePoints().size() - 1).lng(), org.assertj.core.data.Offset.offset(0.0001));
        assertThat(result.routePoints().get(result.routePoints().size() - 1).label()).isEqualTo("Finish");
    }

    @Test
    void resolveCourseMapChecksExpandedOfficialCourseVariants() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(false);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenAnswer(invocation -> {
                    String url = invocation.getArgument(0, String.class);
                    if ("https://example.com/race/course-details".equals(url)) {
                        return ResponseEntity.ok("""
                                <html>
                                  <body>
                                    <img src="/assets/course-map.png" alt="Course map" />
                                  </body>
                                </html>
                                """);
                    }
                    return ResponseEntity.ok("<html><body>No course map here.</body></html>");
                });
        when(restTemplate.exchange(
                eq("https://example.com/assets/course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.36,
                -71.05,
                42.195
        );

        assertThat(result.imageUrl()).isEqualTo("https://example.com/assets/course-map.png");
        verify(restTemplate).exchange(
                eq("https://example.com/race/course-details"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(String.class)
        );
    }

    @Test
    void buildSearchQueriesPreferOfficialDomainAndFileTypes() {
        RaceCourseMapService service = createService(mock(RestTemplate.class), mock(SystemConfigService.class), mock(RaceCourseMapAssetRepository.class));

        @SuppressWarnings("unchecked")
        List<String> queries = (List<String>) ReflectionTestUtils.invokeMethod(
                ReflectionTestUtils.getField(service, "searchService"),
                "buildSearchQueries",
                "Tokyo Marathon",
                "Tokyo",
                "Japan",
                "www.marathon.tokyo",
                42.195
        );

        assertThat(queries).anySatisfy(query -> {
            assertThat(query).contains("\"Tokyo Marathon\"");
            assertThat(query).contains("site:www.marathon.tokyo");
            assertThat(query).contains("filetype:pdf");
        });
    }

    @Test
    void renderPdfCandidatePagesReturnsFirstTwoRenderedPages() throws Exception {
        RaceCourseMapService service = createService(mock(RestTemplate.class), mock(SystemConfigService.class), mock(RaceCourseMapAssetRepository.class));

        List<?> pages = (List<?>) ReflectionTestUtils.invokeMethod(
                ReflectionTestUtils.getField(service, "imageService"),
                "renderPdfCandidatePages",
                samplePdf(4)
        );

        assertThat(pages).hasSize(2);
    }

    @Test
    void resolveCourseMapCapsAiAnalysisBudgetAcrossPdfCandidates() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(ResponseEntity.ok("""
                        <html>
                          <body>
                            <a href="https://cdn.example.com/course-map-a.pdf">A</a>
                            <a href="https://cdn.example.com/course-map-b.pdf">B</a>
                            <a href="https://cdn.example.com/course-map-c.pdf">C</a>
                          </body>
                        </html>
                        """));
        when(restTemplate.exchange(
                startsWith("https://cdn.example.com/course-map-"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePdf(4)));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": false,
                                                  "confidence": 22,
                                                  "summary": "No reliable course map found.",
                                                  "overlayBounds": null,
                                                  "routePoints": []
                                                }
                                                """
                                ))
                        )
                ))
        )));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.36,
                -71.05,
                42.195
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.imageUrl()).startsWith("data:image/png;base64,");
        assertThat(result.summary()).contains("capped AI course-map analysis");
        verify(restTemplate, times(4)).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        );
    }

    @Test
    void resolveCourseMapAcceptsAdaptiveRetryForDenseRouteBelowPrimaryThreshold() throws Exception {
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
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        ))
                .thenReturn(ResponseEntity.ok(geminiAlignmentResponse(60, denseBostonRouteJson(), "Initial pass saw a stylized course map but stayed conservative.")))
                .thenReturn(ResponseEntity.ok(geminiAlignmentResponse(58, denseBostonRouteJson(), "Directive retry accepted the stylized map and traced the route.")));
        when(restTemplate.exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations())));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.confidence()).isEqualTo(58);
        assertThat(result.routePoints()).hasSizeGreaterThanOrEqualTo(20);
        verify(restTemplate, times(2)).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        );
    }

    @Test
    void resolveCourseMapRejectsAlignmentWhenKnownStartCoordinatesAreMoreThanTenKilometersAway() throws Exception {
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
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(88, farFromBostonRouteJson(), "The route is polished but starts too far from the known Boston start area.")));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.routePoints()).isEmpty();
    }

    @Test
    void resolveCourseMapUsesSnappedRoutePointsWhenOsrmSucceeds() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        OsrmMapMatchingClient osrmMapMatchingClient = mock(OsrmMapMatchingClient.class);
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
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(84, denseBostonRouteJson(), "Aligned the Boston Marathon route.")));
        when(restTemplate.exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations())));
        when(osrmMapMatchingClient.matchOrderedBreadcrumbs(any()))
                .thenReturn(snappedBostonRoute());

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);
        ReflectionTestUtils.setField(service, "osrmMapMatchingClient", osrmMapMatchingClient);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints().get(0).lat()).isCloseTo(42.2285, org.assertj.core.data.Offset.offset(0.0001));
        assertThat(result.routePoints().get(0).lng()).isCloseTo(-71.5215, org.assertj.core.data.Offset.offset(0.0001));
    }

    @Test
    void resolveCourseMapFallsBackToUnsappedRouteWhenOsrmFails() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        OsrmMapMatchingClient osrmMapMatchingClient = mock(OsrmMapMatchingClient.class);
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
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse(84, denseBostonRouteJson(), "Aligned the Boston Marathon route.")));
        when(restTemplate.exchange(
                any(RequestEntity.class),
                org.mockito.ArgumentMatchers.<ParameterizedTypeReference<Map<String, Object>>>any()
        )).thenReturn(ResponseEntity.ok(Map.of("elevation", sampleElevations())));
        doThrow(new IllegalStateException("OSRM unavailable")).when(osrmMapMatchingClient).matchOrderedBreadcrumbs(any());

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);
        ReflectionTestUtils.setField(service, "osrmMapMatchingClient", osrmMapMatchingClient);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://example.com/race",
                42.3601,
                -71.0589,
                42.195
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints().get(0).lat()).isCloseTo(42.2280, org.assertj.core.data.Offset.offset(0.0001));
        assertThat(result.routePoints().get(0).lng()).isCloseTo(-71.5220, org.assertj.core.data.Offset.offset(0.0001));
    }

    @Test
    void materializeTransparentOverlayClearsMapBackgroundButKeepsCourseInk() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);
        String imageUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(sampleStylizedCourseMapPng());

        BufferedImage overlay = decodeDataUrlImage(service.materializeTransparentOverlayImageUrl(imageUrl));
        int routeY = 450 + (int) Math.round(160 * Math.sin(300 / 70.0));

        assertThat((overlay.getRGB(10, 10) >>> 24) & 0xFF).isEqualTo(0);
        assertThat((overlay.getRGB(300, routeY) >>> 24) & 0xFF).isGreaterThan(160);
    }

    private byte[] samplePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private byte[] sampleStylizedCourseMapPng() throws Exception {
        BufferedImage image = new BufferedImage(900, 900, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                image.setRGB(x, y, 0xF2F2F2);
            }
        }
        for (int y = 80; y < 820; y += 30) {
            for (int x = 80; x < 820; x++) {
                image.setRGB(x, y, 0xFFFFFF);
            }
        }
        for (int x = 80; x < 820; x += 30) {
            for (int y = 80; y < 820; y++) {
                image.setRGB(x, y, 0xFFFFFF);
            }
        }
        for (int x = 160; x < 760; x++) {
            int y = 450 + (int) Math.round(160 * Math.sin(x / 70.0));
            for (int dy = -3; dy <= 3; dy++) {
                for (int dx = -3; dx <= 3; dx++) {
                    int px = x + dx;
                    int py = y + dy;
                    if (px >= 0 && px < image.getWidth() && py >= 0 && py < image.getHeight()) {
                        image.setRGB(px, py, 0xC81E3A);
                    }
                }
            }
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private byte[] samplePdf() throws Exception {
        return samplePdf(1);
    }

    private byte[] samplePdf(int pages) throws Exception {
        try (PDDocument document = new PDDocument()) {
            for (int index = 0; index < pages; index++) {
                document.addPage(new PDPage());
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        }
    }

    private String sampleWebpDataUrl() {
        byte[] bytes = new byte[2048];
        bytes[0] = 'R';
        bytes[1] = 'I';
        bytes[2] = 'F';
        bytes[3] = 'F';
        bytes[8] = 'W';
        bytes[9] = 'E';
        bytes[10] = 'B';
        bytes[11] = 'P';
        bytes[12] = 'V';
        bytes[13] = 'P';
        bytes[14] = '8';
        bytes[15] = ' ';
        return "data:image/webp;base64," + Base64.getEncoder().encodeToString(bytes);
    }
    private String samplePdfDataUrl() throws Exception {
        return "data:application/pdf;base64," + Base64.getEncoder().encodeToString(samplePdf());
    }

    private String sampleLargeJpegDataUrl() throws Exception {
        BufferedImage image = new BufferedImage(2600, 1800, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int r = (x * 255) / Math.max(1, image.getWidth() - 1);
                int g = (y * 255) / Math.max(1, image.getHeight() - 1);
                int b = (x + y) % 255;
                image.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", output);
        return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
    }

    private BufferedImage decodeDataUrlImage(String dataUrl) throws Exception {
        int commaIndex = dataUrl == null ? -1 : dataUrl.indexOf(',');
        if (commaIndex < 0) return null;
        byte[] bytes = Base64.getDecoder().decode(dataUrl.substring(commaIndex + 1));
        return ImageIO.read(new java.io.ByteArrayInputStream(bytes));
    }

    private List<Integer> sampleElevations() {
        return sampleElevations(25);
    }

    private List<Integer> sampleElevations(int count) {
        List<Integer> elevations = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            elevations.add(8 + (i % 6) * 3);
        }
        return elevations;
    }

    private Map<String, Object> geminiAlignmentResponse(int confidence, String routePointsJson, String summary) {
        return Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": %d,
                                                  "summary": "%s",
                                                  "overlayBounds": {
                                                    "north": 42.38,
                                                    "south": 42.22,
                                                    "east": -71.04,
                                                    "west": -71.55
                                                  },
                                                  "routePoints": %s
                                                }
                                                """.formatted(confidence, summary, routePointsJson)
                                ))
                        )
                ))
        );
    }

    private String denseBostonRouteJson() {
        return """
                [
                  { "lat": 42.2280, "lng": -71.5220, "label": "Start" },
                  { "lat": 42.2340, "lng": -71.5080 },
                  { "lat": 42.2400, "lng": -71.4940 },
                  { "lat": 42.2460, "lng": -71.4800 },
                  { "lat": 42.2520, "lng": -71.4660 },
                  { "lat": 42.2580, "lng": -71.4520 },
                  { "lat": 42.2640, "lng": -71.4380 },
                  { "lat": 42.2700, "lng": -71.4240 },
                  { "lat": 42.2760, "lng": -71.4100 },
                  { "lat": 42.2820, "lng": -71.3960 },
                  { "lat": 42.2880, "lng": -71.3820 },
                  { "lat": 42.2940, "lng": -71.3680 },
                  { "lat": 42.3000, "lng": -71.3540 },
                  { "lat": 42.3060, "lng": -71.3400 },
                  { "lat": 42.3120, "lng": -71.3260 },
                  { "lat": 42.3180, "lng": -71.3120 },
                  { "lat": 42.3240, "lng": -71.2980 },
                  { "lat": 42.3300, "lng": -71.2840 },
                  { "lat": 42.3360, "lng": -71.2700 },
                  { "lat": 42.3400, "lng": -71.2400 },
                  { "lat": 42.3430, "lng": -71.2050 },
                  { "lat": 42.3460, "lng": -71.1700 },
                  { "lat": 42.3485, "lng": -71.1200 },
                  { "lat": 42.3498, "lng": -71.0785, "label": "Finish" }
                ]
                """;
    }

    private String denseNewYorkRouteJson() {
        return interpolatedRouteJson(
                new double[][]{
                        {40.6010, -74.1530},
                        {40.6500, -74.0100},
                        {40.6760, -73.9800},
                        {40.7130, -73.9620},
                        {40.7580, -73.9540},
                        {40.7990, -73.9710},
                        {40.7680, -73.9810},
                        {40.7710, -73.9740}
                },
                "Start",
                "Finish"
        );
    }

    private String denseTokyoRouteJson() {
        return interpolatedRouteJson(
                new double[][]{
                        {35.6895, 139.6917},
                        {35.6990, 139.7350},
                        {35.7090, 139.7820},
                        {35.7100, 139.8420},
                        {35.6940, 139.8840},
                        {35.6640, 139.8580},
                        {35.6440, 139.8040},
                        {35.6520, 139.7480},
                        {35.6812, 139.7671}
                },
                "Start",
                "Finish"
        );
    }

    private String chicagoLoopRouteJson() {
        return """
                [
                  { "lat": 41.8819, "lng": -87.6233, "label": "Start" },
                  { "lat": 42.0200, "lng": -87.6400 },
                  { "lat": 42.0200, "lng": -87.7600 },
                  { "lat": 41.8900, "lng": -87.6400 },
                  { "lat": 41.7600, "lng": -87.6300 },
                  { "lat": 41.8756, "lng": -87.6244, "label": "Finish" }
                ]
                """;
    }

    private String shortChicagoCityRouteJson() {
        return """
                [
                  { "lat": 41.9020, "lng": -87.6460, "label": "North side" },
                  { "lat": 41.8950, "lng": -87.6400 },
                  { "lat": 41.8880, "lng": -87.6340 },
                  { "lat": 41.8810, "lng": -87.6380 },
                  { "lat": 41.8740, "lng": -87.6320 },
                  { "lat": 41.8670, "lng": -87.6260, "label": "South side" }
                ]
                """;
    }

    private String backtrackingBostonRouteJson() {
        return interpolatedRouteJson(
                new double[][]{
                        {42.2280, -71.5220},
                        {42.2820, -71.3960},
                        {42.2500, -71.4700},
                        {42.3180, -71.3120},
                        {42.3498, -71.0785}
                },
                "Start",
                "Finish"
        );
    }

    private String outboundCharlesRiverRouteJson() {
        return """
                [
                  { "lat": 42.3200, "lng": -71.1100, "label": "Start" },
                  { "lat": 42.3275, "lng": -71.1070 },
                  { "lat": 42.3350, "lng": -71.1040 },
                  { "lat": 42.3425, "lng": -71.1010 },
                  { "lat": 42.3500, "lng": -71.0980 },
                  { "lat": 42.3575, "lng": -71.0950 },
                  { "lat": 42.3650, "lng": -71.0920, "label": "Turnaround" }
                ]
                """;
    }

    private String farFromBostonRouteJson() {
        return """
                [
                  { "lat": 43.1800, "lng": -71.3000, "label": "Start" },
                  { "lat": 43.1860, "lng": -71.2860 },
                  { "lat": 43.1920, "lng": -71.2720 },
                  { "lat": 43.1980, "lng": -71.2580 },
                  { "lat": 43.2040, "lng": -71.2440 },
                  { "lat": 43.2100, "lng": -71.2300 },
                  { "lat": 43.2160, "lng": -71.2160 },
                  { "lat": 43.2220, "lng": -71.2020 },
                  { "lat": 43.2280, "lng": -71.1880 },
                  { "lat": 43.2340, "lng": -71.1740 },
                  { "lat": 43.2400, "lng": -71.1600 },
                  { "lat": 43.2460, "lng": -71.1460 },
                  { "lat": 43.2520, "lng": -71.1320 },
                  { "lat": 43.2580, "lng": -71.1180 },
                  { "lat": 43.2640, "lng": -71.1040 },
                  { "lat": 43.2700, "lng": -71.0900 },
                  { "lat": 43.2760, "lng": -71.0760 },
                  { "lat": 43.2820, "lng": -71.0620 },
                  { "lat": 43.2880, "lng": -71.0480 },
                  { "lat": 43.2940, "lng": -71.0340, "label": "Finish" }
                ]
                """;
    }

    private List<MatchedBreadcrumbPointDTO> snappedBostonRoute() {
        return List.of(
                new MatchedBreadcrumbPointDTO(42.2285, -71.5215),
                new MatchedBreadcrumbPointDTO(42.2360, -71.5050),
                new MatchedBreadcrumbPointDTO(42.2440, -71.4890),
                new MatchedBreadcrumbPointDTO(42.2520, -71.4730),
                new MatchedBreadcrumbPointDTO(42.2600, -71.4570),
                new MatchedBreadcrumbPointDTO(42.2680, -71.4410),
                new MatchedBreadcrumbPointDTO(42.2760, -71.4250),
                new MatchedBreadcrumbPointDTO(42.2840, -71.4090),
                new MatchedBreadcrumbPointDTO(42.2920, -71.3930),
                new MatchedBreadcrumbPointDTO(42.3000, -71.3770),
                new MatchedBreadcrumbPointDTO(42.3080, -71.3610),
                new MatchedBreadcrumbPointDTO(42.3160, -71.3450),
                new MatchedBreadcrumbPointDTO(42.3240, -71.3290),
                new MatchedBreadcrumbPointDTO(42.3320, -71.3130),
                new MatchedBreadcrumbPointDTO(42.3380, -71.2950),
                new MatchedBreadcrumbPointDTO(42.3410, -71.2660),
                new MatchedBreadcrumbPointDTO(42.3430, -71.2360),
                new MatchedBreadcrumbPointDTO(42.3445, -71.2050),
                new MatchedBreadcrumbPointDTO(42.3460, -71.1700),
                new MatchedBreadcrumbPointDTO(42.3472, -71.1350),
                new MatchedBreadcrumbPointDTO(42.3480, -71.1100),
                new MatchedBreadcrumbPointDTO(42.3490, -71.0900),
                new MatchedBreadcrumbPointDTO(42.3496, -71.0805),
                new MatchedBreadcrumbPointDTO(42.3498, -71.0782)
        );
    }

    private String interpolatedRouteJson(double[][] anchors, String startLabel, String finishLabel) {
        StringBuilder builder = new StringBuilder("[\n");
        boolean first = true;
        for (int index = 0; index < anchors.length - 1; index++) {
            double[] start = anchors[index];
            double[] end = anchors[index + 1];
            for (int step = 0; step < 3; step++) {
                double t = step / 3.0;
                double lat = start[0] + ((end[0] - start[0]) * t);
                double lng = start[1] + ((end[1] - start[1]) * t);
                if (!first) {
                    builder.append(",\n");
                }
                builder.append("  { \"lat\": ")
                        .append(String.format(java.util.Locale.ROOT, "%.4f", lat))
                        .append(", \"lng\": ")
                        .append(String.format(java.util.Locale.ROOT, "%.4f", lng));
                if (index == 0 && step == 0) {
                    builder.append(", \"label\": \"").append(startLabel).append("\"");
                }
                builder.append(" }");
                first = false;
            }
        }
        double[] finish = anchors[anchors.length - 1];
        if (!first) {
            builder.append(",\n");
        }
        builder.append("  { \"lat\": ")
                .append(String.format(java.util.Locale.ROOT, "%.4f", finish[0]))
                .append(", \"lng\": ")
                .append(String.format(java.util.Locale.ROOT, "%.4f", finish[1]))
                .append(", \"label\": \"")
                .append(finishLabel)
                .append("\" }\n]");
        return builder.toString();
    }

    private Object enumValue(String name) throws Exception {
        Class<?> enumClass = Class.forName("com.hermes.backend.RaceCourseMapService$PromptRaceType");
                for (Object constant : enumClass.getEnumConstants()) {
                        Enum<?> value = (Enum<?>) constant;
                        if (value.name().equals(name)) {
                                return value;
                        }
                }
                throw new IllegalArgumentException("Unknown enum constant: " + name);
    }

    private RaceCourseMapAsset pendingCourseMapAsset(
            String raceId,
            String raceName,
            String city,
            String country,
            String officialWebsite,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String pendingImageUrl,
            String pendingSource
    ) {
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId(raceId);
        asset.setRaceName(raceName);
        asset.setCity(city);
        asset.setCountry(country);
        asset.setOfficialWebsite(officialWebsite);
        asset.setLatitude(latitude);
        asset.setLongitude(longitude);
        asset.setDistanceKm(distanceKm);
        asset.setPendingImageUrl(pendingImageUrl);
        asset.setPendingSource(pendingSource);
        asset.setPendingConfidence(0);
        asset.setPendingSummary("Hermes saved this upload and queued it for automatic Qwen scanning.");
        asset.setPendingRoutePointsJson("[]");
        asset.setPendingElevationSamplesJson("[]");
        asset.setPendingAiAssisted(false);
        return asset;
    }

    private RaceCourseMapService createService(RestTemplate restTemplate, SystemConfigService systemConfigService, RaceCourseMapAssetRepository repository) {
        return createService(restTemplate, systemConfigService, repository, null);
    }

    private RaceCourseMapService createService(RestTemplate restTemplate, SystemConfigService systemConfigService, RaceCourseMapAssetRepository repository, OsrmMapMatchingClient osrmMapMatchingClient) {
        return createService(restTemplate, systemConfigService, repository, osrmMapMatchingClient, buildTestQwenAlignmentClient(restTemplate));
    }

    private RaceCourseMapService createService(
            RestTemplate restTemplate,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository repository,
            OsrmMapMatchingClient osrmMapMatchingClient,
            QwenCourseMapAlignmentClient qwenClient
    ) {
        return createService(restTemplate, systemConfigService, repository, osrmMapMatchingClient, qwenClient, null);
    }

    private RaceCourseMapService createService(
            RestTemplate restTemplate,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository repository,
            OsrmMapMatchingClient osrmMapMatchingClient,
            QwenCourseMapAlignmentClient qwenClient,
            Path courseMapUploadDirectory
    ) {
        com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        RaceCourseMapSearchService searchService = new RaceCourseMapSearchService(restTemplate);
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(restTemplate);
        if (courseMapUploadDirectory != null) {
            ReflectionTestUtils.setField(imageService, "courseMapUploadDirectory", courseMapUploadDirectory.toString());
        }
        RaceCourseMapAiService aiService = new RaceCourseMapAiService(
                restTemplate,
                objectMapper,
                geometryService,
                qwenClient
        );
        return new RaceCourseMapService(restTemplate, objectMapper, systemConfigService, repository, osrmMapMatchingClient, geometryService, searchService, imageService, aiService);
    }

    @SuppressWarnings("unchecked")
    private QwenCourseMapAlignmentClient buildTestQwenAlignmentClient(RestTemplate restTemplate) {
        QwenCourseMapAlignmentClient qwenClient = mock(QwenCourseMapAlignmentClient.class);
        when(qwenClient.analyzeCandidate(any(), any(), any())).thenAnswer(invocation -> {
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key",
                    HttpMethod.POST,
                    HttpEntity.EMPTY,
                    Map.class
            );
            return extractAlignmentText((Map<String, Object>) response.getBody());
        });
        return qwenClient;
    }

    @SuppressWarnings("unchecked")
    private String extractAlignmentText(Map<String, Object> body) {
        if (body == null) {
            throw new IllegalStateException("Missing mocked Qwen alignment response body.");
        }
        Object rawCandidates = body.get("candidates");
        if (!(rawCandidates instanceof List<?> candidates) || candidates.isEmpty()) {
            throw new IllegalStateException("Missing mocked Qwen alignment candidates.");
        }
        Object firstCandidate = candidates.get(0);
        if (!(firstCandidate instanceof Map<?, ?> candidate)) {
            throw new IllegalStateException("Invalid mocked Qwen alignment candidate.");
        }
        Object rawContent = candidate.get("content");
        if (!(rawContent instanceof Map<?, ?> content)) {
            throw new IllegalStateException("Invalid mocked Qwen alignment content.");
        }
        Object rawParts = content.get("parts");
        if (!(rawParts instanceof List<?> parts) || parts.isEmpty()) {
            throw new IllegalStateException("Invalid mocked Qwen alignment parts.");
        }
        Object firstPart = parts.get(0);
        if (!(firstPart instanceof Map<?, ?> part) || !(part.get("text") instanceof String text)) {
            throw new IllegalStateException("Invalid mocked Qwen alignment text.");
        }
        return text;
    }
}

