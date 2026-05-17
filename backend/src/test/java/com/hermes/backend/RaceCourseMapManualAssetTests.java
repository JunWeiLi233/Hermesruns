package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

class RaceCourseMapManualAssetTests {

    @Test
    void resolveCourseMapReturnsEmptyWhenNoStoredMapExists() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.resolveCourseMap(
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.36,
                -71.05,
                42.195
        );

        assertThat(result.courseMapDetected()).isFalse();
        assertThat(result.imageUrl()).isBlank();
        assertThat(result.summary()).contains("Upload a course map");
        verify(restTemplate, never()).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));
        verify(restTemplate, never()).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(byte[].class));
    }

    @Test
    void scanPendingCourseMapReanalyzesExistingPendingUpload() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        RaceCourseMapAsset storedAsset = new RaceCourseMapAsset();
        storedAsset.setRaceId("boston-2026");
        storedAsset.setRaceName("Boston Marathon");
        storedAsset.setCity("Boston");
        storedAsset.setCountry("United States");
        storedAsset.setOfficialWebsite("https://www.baa.org");
        storedAsset.setLatitude(42.36);
        storedAsset.setLongitude(-71.05);
        storedAsset.setDistanceKm(42.195);
        storedAsset.setPendingImageUrl("https://cdn.example.com/manual-course-map.png");
        storedAsset.setPendingSource("admin-image-url");
        storedAsset.setPendingUpdatedAt(LocalDateTime.now());
        when(repository.findByRaceId("boston-2026")).thenReturn(Optional.of(storedAsset));

        when(restTemplate.exchange(
                eq("https://cdn.example.com/manual-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiAlignmentResponse()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.scanPendingCourseMap(
                "boston-2026",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.36,
                -71.05,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.imageUrl()).isEqualTo("https://cdn.example.com/manual-course-map.png");
        assertThat(result.summary()).doesNotContain("candidate");
        verify(restTemplate, never()).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));
    }

    @Test
    void reanalyzePendingCourseMapKeepsPreviousBostonAlignmentWhenFreshQwenScanFails() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);

        RaceCourseMapAsset storedAsset = new RaceCourseMapAsset();
        storedAsset.setRaceId("boston-2026");
        storedAsset.setRaceName("Boston Marathon");
        storedAsset.setCity("Boston");
        storedAsset.setCountry("United States");
        storedAsset.setOfficialWebsite("https://www.baa.org");
        storedAsset.setLatitude(42.3601);
        storedAsset.setLongitude(-71.0589);
        storedAsset.setDistanceKm(42.195);
        storedAsset.setPendingImageUrl("https://cdn.example.com/boston-course-map.png");
        storedAsset.setPendingSource("admin-image-url");
        storedAsset.setPendingConfidence(84);
        storedAsset.setPendingSummary("Previously aligned Boston Marathon course map.");
        storedAsset.setPendingOverlayBoundsJson("{\"north\":42.41,\"south\":42.22,\"east\":-71.04,\"west\":-71.55}");
        storedAsset.setPendingRoutePointsJson("""
                [
                  { "lat": 42.2280, "lng": -71.5220, "label": "Start" },
                  { "lat": 42.3000, "lng": -71.3540 },
                  { "lat": 42.3498, "lng": -71.0785, "label": "Finish" }
                ]
                """);
        storedAsset.setPendingAiAssisted(true);
        storedAsset.setPendingUpdatedAt(LocalDateTime.now());
        when(repository.findByRaceId("boston-2026")).thenReturn(Optional.of(storedAsset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq("https://cdn.example.com/boston-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiDetectedButEmptyAlignmentResponse()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "boston-2026",
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
        assertThat(result.routePoints()).hasSize(3);
        assertThat(result.summary()).isEqualTo("Previously aligned Boston Marathon course map.");
        assertThat(result.summary()).doesNotContain("could not align it confidently");
    }

    @Test
    void uploadPendingCourseMapAcceptsLoopStyleChicagoGeometryWhenPointToPointInferenceIsTooStrict() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.empty());

        when(restTemplate.exchange(
                eq("https://cdn.example.com/chicago-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiChicagoLoopAlignmentResponse()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-2026",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                "https://cdn.example.com/chicago-course-map.png",
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).hasSizeGreaterThanOrEqualTo(12);
        assertThat(result.overlayBounds()).isNotNull();
        assertThat(result.summary()).contains("Chicago");
    }

    @Test
    void uploadPendingCourseMapRunsQwenBeforeCityLevelFallbackForDecodedStylizedChicagoMaps() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.empty());

        when(restTemplate.exchange(
                eq("https://cdn.example.com/official-chicago-course-map.jpg"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(stylizedRoutePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiChicagoLoopAlignmentResponse()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-2026",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                "https://cdn.example.com/official-chicago-course-map.jpg",
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).hasSizeGreaterThanOrEqualTo(12);
        assertThat(result.summary()).contains("loop-style Chicago Marathon");
        assertThat(result.summary()).doesNotContain("city-level course-map match");
        verify(restTemplate, atLeastOnce()).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        );
    }

    @Test
    void uploadPendingCourseMapAcceptsStylizedChicagoMapAsCityLevelOnly() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.empty());

        when(restTemplate.exchange(
                eq("https://cdn.example.com/stylized-chicago-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(stylizedRoutePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiDetectedButEmptyAlignmentResponse()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-2026",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                "https://cdn.example.com/stylized-chicago-course-map.png",
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.overlayBounds()).isNotNull();
        assertThat(result.confidence()).isGreaterThanOrEqualTo(58);
        assertThat(result.summary()).contains("city-level course-map match");
        assertThat(result.summary()).contains("standard road marathon");
        verify(restTemplate, atLeastOnce()).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        );
    }

    @Test
    void uploadPendingCourseMapAcceptsUndecodableWebpCityMarathonAsCityLevelOnly() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.empty());
        String fakeWebpDataUrl = "data:image/webp;base64," + Base64.getEncoder().encodeToString(fakeLargeWebpBytes());

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-2026",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                fakeWebpDataUrl,
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.summary()).contains("city-level course-map match");
        verify(restTemplate, never()).exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        );
    }

    @Test
    void acceptPendingCourseMapPublishesCityLevelReferencesWithoutTreatingThemAsRouteOverlays() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapAsset storedAsset = new RaceCourseMapAsset();
        storedAsset.setRaceId("chicago-2026");
        storedAsset.setRaceName("Chicago Marathon");
        storedAsset.setCity("Chicago");
        storedAsset.setCountry("United States");
        storedAsset.setLatitude(41.8781);
        storedAsset.setLongitude(-87.6298);
        storedAsset.setDistanceKm(42.195);
        storedAsset.setPendingImageUrl("https://cdn.example.com/stylized-chicago-course-map.png");
        storedAsset.setPendingSource("admin-image-url");
        storedAsset.setPendingConfidence(58);
        storedAsset.setPendingSummary("Hermes accepted this stylized upload as a city-level course-map match for a standard road marathon in Chicago. The upload is treated as a city-level map reference, not a distance-accurate route overlay.");
        storedAsset.setPendingOverlayBoundsJson("{\"north\":42.01,\"south\":41.67,\"east\":-87.52,\"west\":-87.78}");
        storedAsset.setPendingRoutePointsJson("[]");
        storedAsset.setPendingAiAssisted(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.of(storedAsset));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        service.acceptPendingCourseMap("chicago-2026", "admin@hermes.test");

        assertThat(storedAsset.getLiveImageUrl()).isEqualTo("https://cdn.example.com/stylized-chicago-course-map.png");
        assertThat(storedAsset.getLiveSummary()).contains("city-level course-map match");
        assertThat(storedAsset.getLiveOverlayBoundsJson()).contains("\"north\":42.01");
        assertThat(storedAsset.getLiveRoutePointsJson()).isEqualTo("[]");
        assertThat(storedAsset.getPendingImageUrl()).isNull();
    }

    @Test
    void uploadPendingCourseMapAcceptsSparseButCredibleAdminMarathonTrace() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("boston-2026")).thenReturn(Optional.empty());

        when(restTemplate.exchange(
                eq("https://cdn.example.com/boston-course-map-sparse.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiSparseBostonAlignmentResponse()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "boston-2026",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org",
                42.1900,
                -71.0000,
                42.195,
                "https://cdn.example.com/boston-course-map-sparse.png",
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).hasSize(5);
        assertThat(result.summary()).contains("sparse Boston Marathon course map");
        assertThat(result.summary()).doesNotContain("alignment failed the plausibility checks");
    }

    @Test
    void uploadPendingCourseMapFallsBackToExtractionPipelineWhenDirectScanReturnsNoGeometry() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        MarathonRouteExtractionService extractionService = mock(MarathonRouteExtractionService.class);
        MarathonRouteGeoreferencingService georeferencingService = mock(MarathonRouteGeoreferencingService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.empty());

        when(restTemplate.exchange(
                eq("https://cdn.example.com/chicago-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiDetectedButEmptyAlignmentResponse()));

        RouteParametersDTO routeParameters = new RouteParametersDTO("#F04A3A", List.of("Start", "North", "West", "Finish"));
        RoutePathExtractionResultDTO extractionResult = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(new RoutePixelPointDTO(10, 10), new RoutePixelPointDTO(20, 20), new RoutePixelPointDTO(30, 30)),
                3,
                1200,
                240
        );
        when(extractionService.extractRoutePath(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(42.195)))
                .thenReturn(extractionResult);

        List<RawBreadcrumbPointDTO> rawBreadcrumbs = List.of(
                new RawBreadcrumbPointDTO(41.8789, -87.6359),
                new RawBreadcrumbPointDTO(41.9000, -87.6250),
                new RawBreadcrumbPointDTO(41.9300, -87.6300),
                new RawBreadcrumbPointDTO(41.9500, -87.6600),
                new RawBreadcrumbPointDTO(41.9300, -87.6900),
                new RawBreadcrumbPointDTO(41.8900, -87.7050),
                new RawBreadcrumbPointDTO(41.8500, -87.7000),
                new RawBreadcrumbPointDTO(41.8100, -87.6800),
                new RawBreadcrumbPointDTO(41.7900, -87.6500),
                new RawBreadcrumbPointDTO(41.8000, -87.6200),
                new RawBreadcrumbPointDTO(41.8300, -87.6100),
                new RawBreadcrumbPointDTO(41.8600, -87.6150),
                new RawBreadcrumbPointDTO(41.8750, -87.6250),
                new RawBreadcrumbPointDTO(41.8788, -87.6360)
        );
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult =
                new MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult(
                        routeParameters,
                        List.of(),
                        List.of(),
                        new AffineTransformCoefficientsDTO(1, 0, 0, 0, 1, 0),
                        rawBreadcrumbs
                );
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        when(georeferencingService.georeferenceRoute(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(extractionResult), eq(41.8781), eq(-87.6298), eq(42.195)))
                .thenReturn(georefResult);

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, extractionService, georeferencingService);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-2026",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                "https://cdn.example.com/chicago-course-map.png",
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).hasSize(rawBreadcrumbs.size());
        assertThat(result.overlayBounds()).isNotNull();
        assertThat(result.summary()).contains("extraction");
        verify(extractionService).extractRoutePath(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(42.195));
        verify(georeferencingService).georeferenceRoute(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(extractionResult), eq(41.8781), eq(-87.6298), eq(42.195));
    }

    @Test
    void uploadPendingCourseMapPublishesOfficialBostonUploadWhenVisibleRouteMatchesKnownCourse() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        MarathonRouteExtractionService extractionService = mock(MarathonRouteExtractionService.class);
        MarathonRouteGeoreferencingService georeferencingService = mock(MarathonRouteGeoreferencingService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("boston-2026")).thenReturn(Optional.of(pendingBostonUploadAsset()));

        when(restTemplate.exchange(
                eq("https://cdn.example.com/boston-official-course-map.gif"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(bostonOfficialGif()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiDetectedButEmptyAlignmentResponse()));

        RouteParametersDTO routeParameters = new RouteParametersDTO("#FDD835", List.of("Hopkinton", "Framingham", "Wellesley", "Finish"));
        RoutePathExtractionResultDTO extractionResult = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(new RoutePixelPointDTO(115, 396), new RoutePixelPointDTO(300, 282), new RoutePixelPointDTO(500, 232), new RoutePixelPointDTO(908, 90)),
                2_205,
                5_640,
                1_183,
                "target",
                List.of()
        );
        when(extractionService.extractRoutePath(anyString(), eq("Boston Marathon"), eq("Boston"), eq("United States"), eq(42.195)))
                .thenReturn(extractionResult);

        List<RawBreadcrumbPointDTO> rawBreadcrumbs = List.of(
                new RawBreadcrumbPointDTO(42.2295, -71.5218),
                new RawBreadcrumbPointDTO(42.2450, -71.4950),
                new RawBreadcrumbPointDTO(42.2612, -71.4634),
                new RawBreadcrumbPointDTO(42.2793, -71.4162),
                new RawBreadcrumbPointDTO(42.2834, -71.3495),
                new RawBreadcrumbPointDTO(42.2965, -71.2926),
                new RawBreadcrumbPointDTO(42.3100, -71.2450),
                new RawBreadcrumbPointDTO(42.3389, -71.2092),
                new RawBreadcrumbPointDTO(42.3318, -71.1212),
                new RawBreadcrumbPointDTO(42.3499, -71.0784)
        );
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult =
                new MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult(
                        routeParameters,
                        List.of(new RouteAnchorPixelPointDTO("Hopkinton", 115, 396), new RouteAnchorPixelPointDTO("Finish", 908, 90)),
                        List.of(new GeocodedAnchorPointDTO("Hopkinton", 42.2295, -71.5218, "Hopkinton"), new GeocodedAnchorPointDTO("Finish", 42.3499, -71.0784, "Finish")),
                        new AffineTransformCoefficientsDTO(1, 0, 0, 0, 1, 0),
                        rawBreadcrumbs
                );
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        when(georeferencingService.georeferenceRoute(anyString(), eq("Boston Marathon"), eq("Boston"), eq("United States"), eq(extractionResult), eq(42.3601), eq(-71.0589), eq(42.195)))
                .thenReturn(georefResult);

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, extractionService, georeferencingService);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "boston-2026",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org/",
                42.3601,
                -71.0589,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).hasSize(rawBreadcrumbs.size());
        assertThat(result.overlayBounds()).isNotNull();
        assertThat(result.overlayBounds().west()).isLessThan(-71.45);
        assertThat(result.overlayBounds().east()).isGreaterThan(-71.11);
        assertThat(result.routePoints().get(0).lat()).isCloseTo(42.2295, org.assertj.core.data.Offset.offset(0.01));
        assertThat(result.routePoints().get(result.routePoints().size() - 1).lng()).isCloseTo(-71.0784, org.assertj.core.data.Offset.offset(0.01));
        assertThat(result.summary()).contains("extraction pipeline fallback");
    }

    @Test
    void uploadPendingCourseMapRejectsBostonRectangleFallbackGeometry() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        MarathonRouteExtractionService extractionService = mock(MarathonRouteExtractionService.class);
        MarathonRouteGeoreferencingService georeferencingService = mock(MarathonRouteGeoreferencingService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("boston-2026")).thenReturn(Optional.of(pendingBostonUploadAsset()));

        when(restTemplate.exchange(
                eq("https://cdn.example.com/boston-official-course-map.gif"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(bostonOfficialGif()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiDetectedButEmptyAlignmentResponse()));

        RouteParametersDTO routeParameters = new RouteParametersDTO("#FDD835", List.of("Hopkinton", "Framingham", "Wellesley", "Finish"));
        RoutePathExtractionResultDTO extractionResult = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(new RoutePixelPointDTO(100, 100), new RoutePixelPointDTO(200, 100), new RoutePixelPointDTO(200, 200), new RoutePixelPointDTO(100, 200)),
                4,
                400,
                80,
                "target",
                List.of()
        );
        when(extractionService.extractRoutePath(anyString(), eq("Boston Marathon"), eq("Boston"), eq("United States"), eq(42.195)))
                .thenReturn(extractionResult);

        List<RawBreadcrumbPointDTO> rectangleBreadcrumbs = List.of(
                new RawBreadcrumbPointDTO(42.2700, -71.3300),
                new RawBreadcrumbPointDTO(42.2700, -71.2100),
                new RawBreadcrumbPointDTO(42.3400, -71.2100),
                new RawBreadcrumbPointDTO(42.3400, -71.3300),
                new RawBreadcrumbPointDTO(42.2700, -71.3300)
        );
        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult georefResult =
                new MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult(
                        routeParameters,
                        List.of(),
                        List.of(),
                        new AffineTransformCoefficientsDTO(1, 0, 0, 0, 1, 0),
                        rectangleBreadcrumbs
                );
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        when(georeferencingService.georeferenceRoute(anyString(), eq("Boston Marathon"), eq("Boston"), eq("United States"), eq(extractionResult), eq(42.3601), eq(-71.0589), eq(42.195)))
                .thenReturn(georefResult);

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, extractionService, georeferencingService);

        RaceCourseMapResult result = service.reanalyzePendingCourseMap(
                "boston-2026",
                "Boston Marathon",
                "Boston",
                "United States",
                "https://www.baa.org/",
                42.3601,
                -71.0589,
                42.195,
                "admin@hermes.test"
        );

        assertThat(result.routePoints()).isEmpty();
        assertThat(result.overlayBounds()).isNull();
        assertThat(result.summary()).doesNotContain("extraction pipeline fallback after");
    }

    @Test
    void uploadPendingCourseMapSkipsPipelineFallbackWhenGoogleGeocodingIsNotConfigured() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        MarathonRouteExtractionService extractionService = mock(MarathonRouteExtractionService.class);
        QwenAnchorPixelClient qwenAnchorPixelClient = mock(QwenAnchorPixelClient.class);
        AffineTransformEstimator affineTransformEstimator = mock(AffineTransformEstimator.class);
        GoogleGeocodingClient googleGeocodingClient = mock(GoogleGeocodingClient.class);
        MarathonRouteGeoreferencingService georeferencingService = new MarathonRouteGeoreferencingService(
                qwenAnchorPixelClient,
                affineTransformEstimator,
                googleGeocodingClient
        );
        when(googleGeocodingClient.isConfigured()).thenReturn(false);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.empty());

        when(restTemplate.exchange(
                eq("https://cdn.example.com/chicago-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiDetectedButEmptyAlignmentResponse()));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, extractionService, georeferencingService);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-2026",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                "https://cdn.example.com/chicago-course-map.png",
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isEmpty();
        assertThat(result.summary()).contains("alignment failed the plausibility checks");
        assertThat(result.summary()).contains("0 route points").contains("need at least 5");
        assertThat(result.summary()).doesNotContain("Google geocoding API key is not configured");
        assertThat(result.summary()).doesNotContain("Extraction pipeline fallback failed");
        verify(extractionService, never()).extractRoutePath(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(42.195));
    }

    @Test
    void uploadPendingCourseMapDoesNotExposeGoogleGeocodingRequestDeniedFallbackFailure() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        MarathonRouteExtractionService extractionService = mock(MarathonRouteExtractionService.class);
        MarathonRouteGeoreferencingService georeferencingService = mock(MarathonRouteGeoreferencingService.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-2026")).thenReturn(Optional.empty());

        when(restTemplate.exchange(
                eq("https://cdn.example.com/chicago-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));
        when(restTemplate.exchange(
                eq("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=test-key"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(geminiDetectedButEmptyAlignmentResponse()));

        RouteParametersDTO routeParameters = new RouteParametersDTO("#F04A3A", List.of("Start", "North", "West", "Finish"));
        RoutePathExtractionResultDTO extractionResult = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(new RoutePixelPointDTO(10, 10), new RoutePixelPointDTO(20, 20), new RoutePixelPointDTO(30, 30)),
                3,
                1200,
                240
        );
        when(extractionService.extractRoutePath(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(42.195)))
                .thenReturn(extractionResult);
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        doThrow(new IllegalStateException(
                "Google geocoding failed for anchor 'Start' with status REQUEST_DENIED. Query: Start, Chicago Marathon, Chicago, United States"
        )).when(georeferencingService).georeferenceRoute(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(extractionResult), eq(41.8781), eq(-87.6298), eq(42.195));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, extractionService, georeferencingService);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-2026",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                "https://cdn.example.com/chicago-course-map.png",
                "admin@hermes.test"
        );

        assertThat(result.summary()).contains("alignment failed the plausibility checks");
        assertThat(result.summary()).doesNotContain("Extraction pipeline fallback failed");
        assertThat(result.summary()).doesNotContain("Google geocoding failed");
        assertThat(result.summary()).doesNotContain("REQUEST_DENIED");
    }

    private RaceCourseMapService createService(RestTemplate restTemplate, SystemConfigService systemConfigService, RaceCourseMapAssetRepository repository) {
        return createService(restTemplate, systemConfigService, repository, null, null);
    }

    private RaceCourseMapService createService(
            RestTemplate restTemplate,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository repository,
            MarathonRouteExtractionService extractionService,
            MarathonRouteGeoreferencingService georeferencingService
    ) {
        ObjectMapper objectMapper = new ObjectMapper();
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        RaceCourseMapSearchService searchService = new RaceCourseMapSearchService(restTemplate);
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(restTemplate);
        RaceCourseMapAiService aiService = new RaceCourseMapAiService(
                restTemplate,
                objectMapper,
                geometryService,
                buildTestQwenAlignmentClient(restTemplate)
        );
        return new RaceCourseMapService(restTemplate, objectMapper, systemConfigService, repository, null, geometryService, searchService, imageService, aiService, extractionService, georeferencingService);
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
            return extractAlignmentText(response.getBody());
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

    private byte[] samplePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private byte[] bostonOfficialGif() throws Exception {
        try (InputStream inputStream = RaceCourseMapManualAssetTests.class.getResourceAsStream("/course-maps/boston-official-course-map.gif")) {
            assertThat(inputStream).isNotNull();
            return inputStream.readAllBytes();
        }
    }

    private RaceCourseMapAsset pendingBostonUploadAsset() {
        RaceCourseMapAsset storedAsset = new RaceCourseMapAsset();
        storedAsset.setRaceId("boston-2026");
        storedAsset.setRaceName("Boston Marathon");
        storedAsset.setCity("Boston");
        storedAsset.setCountry("United States");
        storedAsset.setOfficialWebsite("https://www.baa.org/");
        storedAsset.setLatitude(42.3601);
        storedAsset.setLongitude(-71.0589);
        storedAsset.setDistanceKm(42.195);
        storedAsset.setPendingImageUrl("https://cdn.example.com/boston-official-course-map.gif");
        storedAsset.setPendingSource("admin-image-url");
        storedAsset.setPendingSummary("Hermes saved this upload and queued it for automatic Qwen scanning.");
        storedAsset.setPendingUpdatedAt(LocalDateTime.now());
        return storedAsset;
    }

    private byte[] stylizedRoutePng() throws Exception {
        BufferedImage image = new BufferedImage(1200, 900, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(new Color(94, 184, 215));
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
            graphics.setColor(new Color(235, 247, 251));
            graphics.setStroke(new BasicStroke(3f));
            for (int x = 40; x < image.getWidth(); x += 45) {
                graphics.drawLine(x, 0, x, image.getHeight());
            }
            for (int y = 30; y < image.getHeight(); y += 38) {
                graphics.drawLine(0, y, image.getWidth(), y);
            }
            graphics.setColor(new Color(220, 34, 42));
            graphics.setStroke(new BasicStroke(22f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            int[] xs = {640, 640, 760, 760, 690, 690, 430, 430, 570, 570, 650, 650, 710, 710};
            int[] ys = {90, 245, 245, 360, 360, 500, 500, 620, 620, 735, 690, 790, 790, 610};
            graphics.drawPolyline(xs, ys, xs.length);
        } finally {
            graphics.dispose();
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }

    private byte[] fakeLargeWebpBytes() {
        byte[] bytes = new byte[60_000];
        bytes[0] = 'R';
        bytes[1] = 'I';
        bytes[2] = 'F';
        bytes[3] = 'F';
        bytes[8] = 'W';
        bytes[9] = 'E';
        bytes[10] = 'B';
        bytes[11] = 'P';
        return bytes;
    }

    private Map<String, Object> geminiAlignmentResponse() {
        return Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 84,
                                                  "summary": "Aligned the uploaded course map.",
                                                  "overlayBounds": {
                                                    "north": 42.41,
                                                    "south": 42.29,
                                                    "east": -70.97,
                                                    "west": -71.18
                                                  },
                                                  "routePoints": [
                                                    { "lat": 42.2280, "lng": -71.5220, "label": "Start" },
                                                    { "lat": 42.2460, "lng": -71.4800 },
                                                    { "lat": 42.2640, "lng": -71.4380 },
                                                    { "lat": 42.2820, "lng": -71.3960 },
                                                    { "lat": 42.3000, "lng": -71.3540 },
                                                    { "lat": 42.3180, "lng": -71.3120 },
                                                    { "lat": 42.3360, "lng": -71.2700 },
                                                    { "lat": 42.36, "lng": -71.058, "label": "Finish" }
                                                  ]
                                                }
                                                """
                                ))
                        )
                ))
        );
    }

    private Map<String, Object> geminiChicagoLoopAlignmentResponse() {
        return Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 82,
                                                  "summary": "Aligned a loop-style Chicago Marathon course map across downtown and the lakefront.",
                                                  "overlayBounds": {
                                                    "north": 41.965,
                                                    "south": 41.780,
                                                    "east": -87.600,
                                                    "west": -87.715
                                                  },
                                                  "routePoints": [
                                                    { "lat": 41.8789, "lng": -87.6359, "label": "Start" },
                                                    { "lat": 41.9000, "lng": -87.6250 },
                                                    { "lat": 41.9300, "lng": -87.6300 },
                                                    { "lat": 41.9500, "lng": -87.6600 },
                                                    { "lat": 41.9300, "lng": -87.6900 },
                                                    { "lat": 41.8900, "lng": -87.7050 },
                                                    { "lat": 41.8500, "lng": -87.7000 },
                                                    { "lat": 41.8100, "lng": -87.6800 },
                                                    { "lat": 41.7900, "lng": -87.6500 },
                                                    { "lat": 41.8000, "lng": -87.6200 },
                                                    { "lat": 41.8300, "lng": -87.6100 },
                                                    { "lat": 41.8600, "lng": -87.6150 },
                                                    { "lat": 41.8750, "lng": -87.6250 },
                                                    { "lat": 41.8788, "lng": -87.6360, "label": "Finish" }
                                                  ]
                                                }
                                                """
                                ))
                        )
                ))
        );
    }

    private Map<String, Object> geminiSparseBostonAlignmentResponse() {
        return Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 79,
                                                  "summary": "Aligned a sparse Boston Marathon course map from Hopkinton to Boston.",
                                                  "overlayBounds": {
                                                    "north": 42.40,
                                                    "south": 41.99,
                                                    "east": -70.97,
                                                    "west": -71.05
                                                  },
                                                  "routePoints": [
                                                    { "lat": 42.0000, "lng": -71.0000, "label": "Start" },
                                                    { "lat": 42.0600, "lng": -71.0000 },
                                                    { "lat": 42.1400, "lng": -71.0000 },
                                                    { "lat": 42.2600, "lng": -71.0000 },
                                                    { "lat": 42.3800, "lng": -71.0000, "label": "Finish" }
                                                  ]
                                                }
                                                """
                                ))
                        )
                ))
        );
    }

    private Map<String, Object> geminiDetectedButEmptyAlignmentResponse() {
        return Map.of(
                "candidates", List.of(Map.of(
                        "content", Map.of(
                                "parts", List.of(Map.of(
                                        "text", """
                                                {
                                                  "isCourseMap": true,
                                                  "confidence": 77,
                                                  "summary": "This looks like the Chicago Marathon course map, but I cannot georeference it confidently from the stylized poster alone.",
                                                  "overlayBounds": null,
                                                  "routePoints": []
                                                }
                                                """
                                ))
                        )
                ))
        );
    }
}
