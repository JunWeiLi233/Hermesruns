package com.hermes.backend.races;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hermes.backend.infrastructure.config.SystemConfigService;
import com.hermes.backend.routing.RoutePoint;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RaceCourseMapManualAssetTests {

    @TempDir
    Path testUploadDirectory;

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
    void listRaceCourseMapsShipsCoarseRoutesWithoutMaterializedPreviewImages() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        java.util.ArrayList<RoutePoint> denseRoute = new java.util.ArrayList<>();
        for (int i = 0; i < 500; i++) {
            denseRoute.add(new RoutePoint(-6.2 + (i * 0.0001), 106.8 + (i * 0.0001), i == 0 ? "Start" : null));
        }
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("dense-marathon");
        asset.setRaceName("Dense Marathon");
        asset.setCity("Jakarta");
        asset.setCountry("Indonesia");
        asset.setPendingImageUrl("local-course-map:dense-marathon.png");
        asset.setPendingSource("admin-upload");
        asset.setPendingSummary("Hermes aligned this upload.");
        asset.setPendingUpdatedAt(LocalDateTime.now());
        asset.setPendingRoutePointsJson(new ObjectMapper().writeValueAsString(denseRoute));
        when(repository.findAllListRows()).thenReturn(List.of(toListRow(asset)));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        List<RaceCourseMapAdminRow> rows = service.listRaceCourseMaps();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).hasPendingPreview()).isTrue();
        PreviewSnapshot pending = rows.get(0).pendingPreview();
        assertThat(pending).isNotNull();
        assertThat(pending.imageUrl()).isEqualTo("local-course-map:dense-marathon.png");
        assertThat(pending.previewImageUrl()).isNull();
        assertThat(pending.routePoints()).hasSize(32);
        assertThat(pending.routePoints().get(0).label()).isEqualTo("Start");
        assertThat(pending.routePoints().get(31).lat()).isEqualTo(denseRoute.get(499).lat());
        // The list path reads the column projection, never full entities.
        verify(repository).findAllListRows();
        verify(repository, never()).findAll();
    }

    @Test
    void listRaceCourseMapsPopulatesEveryDtoFieldFromListRow() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        ObjectMapper mapper = new ObjectMapper();
        LocalDateTime pendingUpdatedAt = LocalDateTime.of(2026, 8, 1, 9, 30);
        LocalDateTime liveUpdatedAt = LocalDateTime.of(2026, 8, 2, 10, 15);
        LocalDateTime entityUpdatedAt = LocalDateTime.of(2026, 8, 3, 11, 0);

        java.util.ArrayList<RoutePoint> pendingRoute = new java.util.ArrayList<>();
        for (int i = 0; i < 40; i++) {
            pendingRoute.add(new RoutePoint(35.68 + i * 0.001, 139.76 + i * 0.001, i == 0 ? "Start" : null));
        }
        List<RoutePoint> liveRoute = List.of(
                new RoutePoint(-6.2, 106.8, "Start"),
                new RoutePoint(-6.25, 106.85, null)
        );

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("full-field-marathon");
        asset.setRaceName("Full Field Marathon");
        asset.setCity("Tokyo");
        asset.setCountry("Japan");
        asset.setLatitude(35.68);
        asset.setLongitude(139.76);
        asset.setDistanceKm(42.195);
        asset.setPendingImageUrl("local-course-map:full-field-marathon.png");
        asset.setPendingSource("admin-upload");
        asset.setPendingConfidence(64);
        asset.setPendingSummary("Hermes aligned this upload.");
        asset.setPendingOverlayBoundsJson("{\"north\":35.8,\"south\":35.6,\"east\":139.9,\"west\":139.7}");
        asset.setPendingRoutePointsJson(mapper.writeValueAsString(pendingRoute));
        asset.setPendingAiAssisted(true);
        asset.setPendingUpdatedAt(pendingUpdatedAt);
        // The list never consumes these; populating them proves they cannot leak into rows.
        asset.setPendingElevationSamplesJson("[100, 105, 110]");
        asset.setPendingTotalClimbMeters(320);
        asset.setLiveImageUrl("https://cdn.example.com/full-field-live.png");
        asset.setLiveSource("known-official-course:unit-test");
        asset.setLiveConfidence(88);
        asset.setLiveSummary("Official course map.");
        asset.setLiveOverlayBoundsJson("{\"north\":35.9,\"south\":35.5,\"east\":140.0,\"west\":139.6}");
        asset.setLiveRoutePointsJson(mapper.writeValueAsString(liveRoute));
        asset.setLiveAiAssisted(true);
        asset.setLiveUpdatedAt(liveUpdatedAt);
        asset.setLiveElevationSamplesJson("[120, 125]");
        asset.setLiveTotalClimbMeters(280);

        // A sparse second row exercises null/empty text columns end to end.
        RaceCourseMapAsset sparse = new RaceCourseMapAsset();
        sparse.setRaceId("sparse-race");
        sparse.setRaceName("Sparse Race");
        sparse.setCity(null);
        sparse.setCountry(null);
        sparse.setPendingImageUrl("");

        org.springframework.test.util.ReflectionTestUtils.setField(asset, "updatedAt", entityUpdatedAt);
        when(repository.findAllListRows()).thenReturn(List.of(toListRow(asset), toListRow(sparse)));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        List<RaceCourseMapAdminRow> rows = service.listRaceCourseMaps();

        assertThat(rows).hasSize(2);

        RaceCourseMapAdminRow row = rows.get(0);
        assertThat(row.raceId()).isEqualTo("full-field-marathon");
        assertThat(row.raceName()).isEqualTo("Full Field Marathon");
        assertThat(row.city()).isEqualTo("Tokyo");
        assertThat(row.country()).isEqualTo("Japan");
        assertThat(row.updatedAt()).isEqualTo(entityUpdatedAt.toString());
        assertThat(row.hasPendingPreview()).isTrue();

        PreviewSnapshot live = row.live();
        assertThat(live).isNotNull();
        assertThat(live.imageUrl()).isEqualTo("https://cdn.example.com/full-field-live.png");
        assertThat(live.previewImageUrl()).isNull();
        assertThat(live.source()).isEqualTo("known-official-course:unit-test");
        assertThat(live.summary()).isEqualTo("Official course map.");
        assertThat(live.confidence()).isEqualTo(88);
        assertThat(live.updatedAt()).isEqualTo(liveUpdatedAt.toString());
        assertThat(live.overlayBounds()).isNotNull();
        assertThat(live.overlayBounds().north()).isEqualTo(35.9);
        assertThat(live.overlayBounds().west()).isEqualTo(139.6);
        assertThat(live.routePoints()).hasSize(2);
        assertThat(live.routePoints().get(0).lat()).isEqualTo(-6.2);
        assertThat(live.routePoints().get(1).lng()).isEqualTo(106.85);
        assertThat(live.elevationSamples()).isEmpty();
        assertThat(live.totalClimbMeters()).isNull();
        assertThat(live.aiAssisted()).isTrue();
        assertThat(live.courseMapDetected()).isTrue();

        PreviewSnapshot pending = row.pendingPreview();
        assertThat(pending).isNotNull();
        assertThat(pending.imageUrl()).isEqualTo("local-course-map:full-field-marathon.png");
        assertThat(pending.source()).isEqualTo("admin-upload");
        assertThat(pending.summary()).isEqualTo("Hermes aligned this upload.");
        assertThat(pending.confidence()).isEqualTo(64);
        assertThat(pending.updatedAt()).isEqualTo(pendingUpdatedAt.toString());
        assertThat(pending.overlayBounds()).isNotNull();
        assertThat(pending.overlayBounds().east()).isEqualTo(139.9);
        assertThat(pending.routePoints()).hasSize(32);
        assertThat(pending.routePoints().get(0).label()).isEqualTo("Start");
        assertThat(pending.routePoints().get(31).lat()).isEqualTo(pendingRoute.get(39).lat());
        assertThat(pending.elevationSamples()).isEmpty();
        assertThat(pending.totalClimbMeters()).isNull();
        assertThat(pending.aiAssisted()).isTrue();
        assertThat(pending.courseMapDetected()).isTrue();

        RaceCourseMapAdminRow sparseRow = rows.get(1);
        assertThat(sparseRow.raceId()).isEqualTo("sparse-race");
        assertThat(sparseRow.raceName()).isEqualTo("Sparse Race");
        assertThat(sparseRow.city()).isNull();
        assertThat(sparseRow.country()).isNull();
        assertThat(sparseRow.updatedAt()).isNull();
        assertThat(sparseRow.hasPendingPreview()).isFalse();
        assertThat(sparseRow.live()).isNull();
        assertThat(sparseRow.pendingPreview()).isNull();

        verify(repository).findAllListRows();
        verify(repository, never()).findAll();
    }

    /**
     * The list path maps rows through dedicated twins (toListResult /
     * buildListPreviewSnapshot) instead of the entity pipeline (toResult /
     * buildPreviewSnapshot with the parse-elevation/materialize flags off).
     * This pins both implementations to identical output on the SAME fixture
     * entity, so future edits to the detected-heuristic or stored-live
     * sanitization pipeline cannot silently diverge list rows from detail rows.
     */
    @Test
    void listMappingTwinsMatchEntityMappingPipelineExactly() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        ObjectMapper mapper = new ObjectMapper();
        RaceCourseMapAsset rich = new RaceCourseMapAsset();
        rich.setRaceId("twin-equivalence-marathon");
        rich.setRaceName("Twin Equivalence Marathon");
        rich.setCity("Berlin");
        rich.setCountry("Germany");
        rich.setLatitude(52.52);
        rich.setLongitude(13.40);
        rich.setDistanceKm(42.195);
        rich.setPendingImageUrl("local-course-map:twin-equivalence.png");
        rich.setPendingSource("admin-upload");
        rich.setPendingConfidence(63);
        rich.setPendingSummary("Pending twin summary.");
        rich.setPendingOverlayBoundsJson("{\"north\":52.6,\"south\":52.4,\"east\":13.6,\"west\":13.2}");
        rich.setPendingRoutePointsJson(mapper.writeValueAsString(java.util.List.of(
                new RoutePoint(52.52, 13.40, "Start"),
                new RoutePoint(52.53, 13.41, null),
                new RoutePoint(52.54, 13.42, "Finish"))));
        rich.setPendingAiAssisted(true);
        rich.setPendingUpdatedAt(LocalDateTime.of(2026, 8, 1, 9, 0));
        rich.setLiveImageUrl("https://cdn.example.com/twin-live.png");
        rich.setLiveSource("known-official-course:twin-equivalence");
        rich.setLiveConfidence(91);
        rich.setLiveSummary("Live twin summary.");
        rich.setLiveOverlayBoundsJson("{\"north\":52.7,\"south\":52.3,\"east\":13.7,\"west\":13.1}");
        rich.setLiveRoutePointsJson(mapper.writeValueAsString(java.util.List.of(
                new RoutePoint(52.52, 13.40, "Start"),
                new RoutePoint(52.55, 13.45, null))));
        rich.setLiveAiAssisted(false);
        rich.setLiveUpdatedAt(LocalDateTime.of(2026, 8, 2, 11, 30));

        // Null-everything fixture pins the empty/null text-column handling too.
        RaceCourseMapAsset sparse = new RaceCourseMapAsset();
        sparse.setRaceId("twin-equivalence-sparse");

        for (RaceCourseMapAsset asset : List.of(rich, sparse)) {
            for (boolean live : new boolean[]{true, false}) {
                RaceCourseMapResult twin = ReflectionTestUtils.invokeMethod(service, "toListResult", asset, live);
                RaceCourseMapResult original = ReflectionTestUtils.invokeMethod(service, "toResult", asset, live, false);
                assertThat(twin).isEqualTo(original);
            }
            for (boolean pending : new boolean[]{true, false}) {
                PreviewSnapshot twin = ReflectionTestUtils.invokeMethod(service, "buildListPreviewSnapshot", asset, pending);
                PreviewSnapshot original = ReflectionTestUtils.invokeMethod(service, "buildPreviewSnapshot", asset, pending, false);
                assertThat(twin).isEqualTo(original);
            }
        }

        // The rich fixture must produce non-null results on both paths, so the
        // equality above is a meaningful comparison and not a null == null pass.
        RaceCourseMapResult richLiveResult = ReflectionTestUtils.invokeMethod(service, "toListResult", rich, true);
        assertThat(richLiveResult).isNotNull();
        RaceCourseMapResult richPendingResult = ReflectionTestUtils.invokeMethod(service, "toListResult", rich, false);
        assertThat(richPendingResult).isNotNull();
        PreviewSnapshot richLiveSnapshot = ReflectionTestUtils.invokeMethod(service, "buildListPreviewSnapshot", rich, true);
        assertThat(richLiveSnapshot).isNotNull();
        PreviewSnapshot richPendingSnapshot = ReflectionTestUtils.invokeMethod(service, "buildListPreviewSnapshot", rich, false);
        assertThat(richPendingSnapshot).isNotNull();
        // The sparse fixture must stay null on both paths (blank image + summary).
        PreviewSnapshot sparseTwinSnapshot = ReflectionTestUtils.invokeMethod(service, "buildListPreviewSnapshot", sparse, true);
        assertThat(sparseTwinSnapshot).isNull();
        PreviewSnapshot sparseOriginalSnapshot = ReflectionTestUtils.invokeMethod(service, "buildPreviewSnapshot", sparse, true, false);
        assertThat(sparseOriginalSnapshot).isNull();
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
        assertThat(result.routePoints()).hasSize(ChicagoMarathonKnownCourse.routePoints().size());
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

    @Test
    void uploadPendingCourseMapUsesKnownBoundsFallbackWhenAnchorPixelsTimeOut() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        MarathonRouteExtractionService extractionService = mock(MarathonRouteExtractionService.class);
        MarathonRouteGeoreferencingService georeferencingService = mock(MarathonRouteGeoreferencingService.class);
        OsrmMapMatchingClient osrmMapMatchingClient = mock(OsrmMapMatchingClient.class);
        when(systemConfigService.isAiConfigured()).thenReturn(true);
        when(repository.findByRaceId("chicago-official-pdf-test")).thenReturn(Optional.empty());
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        when(restTemplate.exchange(
                eq(java.net.URI.create("https://example.com/chicago-official-course-map.png")),
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
        when(restTemplate.exchange(
                eq("https://example.com/chicago-official-course-map.png"),
                eq(HttpMethod.GET),
                any(HttpEntity.class),
                eq(byte[].class)
        )).thenReturn(ResponseEntity.ok(samplePng()));

        RouteParametersDTO routeParameters = new RouteParametersDTO("#1565C0", List.of("Grant Park", "Lincoln Park", "West Loop", "Chinatown"));
        RoutePathExtractionResultDTO extractionResult = new RoutePathExtractionResultDTO(
                routeParameters,
                List.of(
                        new RoutePixelPointDTO(10, 10),
                        new RoutePixelPointDTO(50, 20),
                        new RoutePixelPointDTO(90, 60),
                        new RoutePixelPointDTO(120, 90),
                        new RoutePixelPointDTO(150, 120),
                        new RoutePixelPointDTO(170, 150)
                ),
                6,
                2000,
                300,
                "palette:#1565C0",
                List.of()
        );
        when(extractionService.extractRoutePath(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(42.195)))
                .thenReturn(extractionResult);
        when(georeferencingService.isConfiguredForPipelineFallback()).thenReturn(true);
        doThrow(new IllegalStateException("Qwen anchor-pixel extraction timed out after 120 seconds."))
                .when(georeferencingService)
                .georeferenceRoute(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(extractionResult), eq(41.8781), eq(-87.6298), eq(42.195));

        MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult boundsFallback =
                new MarathonRouteGeoreferencingService.MarathonRouteGeoreferencingResult(
                        routeParameters,
                        List.of(
                                new RouteAnchorPixelPointDTO("route bounds northwest", 10, 10),
                                new RouteAnchorPixelPointDTO("route bounds northeast", 170, 10),
                                new RouteAnchorPixelPointDTO("route bounds southeast", 170, 150),
                                new RouteAnchorPixelPointDTO("route bounds southwest", 10, 150)
                        ),
                        List.of(
                                new GeocodedAnchorPointDTO("northwest", 41.9900, -87.7200, "Chicago bounds"),
                                new GeocodedAnchorPointDTO("northeast", 41.9900, -87.5900, "Chicago bounds"),
                                new GeocodedAnchorPointDTO("southeast", 41.7650, -87.5900, "Chicago bounds"),
                                new GeocodedAnchorPointDTO("southwest", 41.7650, -87.7200, "Chicago bounds")
                        ),
                        new AffineTransformCoefficientsDTO(0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
                        List.of(
                                new RawBreadcrumbPointDTO(41.8789, -87.6190),
                                new RawBreadcrumbPointDTO(41.8925, -87.6341),
                                new RawBreadcrumbPointDTO(41.9214, -87.6513),
                                new RawBreadcrumbPointDTO(41.8807, -87.6668),
                                new RawBreadcrumbPointDTO(41.8526, -87.6334),
                                new RawBreadcrumbPointDTO(41.8789, -87.6190)
                        )
                );
        when(georeferencingService.georeferenceRouteWithLocalBoundsFallback(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(extractionResult), eq(41.8781), eq(-87.6298), eq(42.195)))
                .thenReturn(boundsFallback);
        when(osrmMapMatchingClient.matchOrderedBreadcrumbs(any()))
                .thenReturn(List.of(
                        new MatchedBreadcrumbPointDTO(40.0000, -89.0000),
                        new MatchedBreadcrumbPointDTO(40.0100, -89.0100),
                        new MatchedBreadcrumbPointDTO(40.0200, -89.0200),
                        new MatchedBreadcrumbPointDTO(40.0300, -89.0300),
                        new MatchedBreadcrumbPointDTO(40.0400, -89.0400),
                        new MatchedBreadcrumbPointDTO(40.0500, -89.0500)
                ));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository, extractionService, georeferencingService, osrmMapMatchingClient);

        RaceCourseMapResult result = service.uploadPendingCourseMap(
                "chicago-official-pdf-test",
                "Chicago Marathon",
                "Chicago",
                "United States",
                "https://www.chicagomarathon.com/",
                41.8781,
                -87.6298,
                42.195,
                "https://example.com/chicago-official-course-map.png",
                "admin@hermes.test"
        );

        assertThat(result.courseMapDetected()).isTrue();
        assertThat(result.routePoints()).isNotEmpty();
        assertThat(result.summary()).contains("pipeline fallback");
        verify(georeferencingService).georeferenceRoute(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(extractionResult), eq(41.8781), eq(-87.6298), eq(42.195));
        verify(georeferencingService).georeferenceRouteWithLocalBoundsFallback(anyString(), eq("Chicago Marathon"), eq("Chicago"), eq("United States"), eq(extractionResult), eq(41.8781), eq(-87.6298), eq(42.195));
        verify(osrmMapMatchingClient, never()).matchOrderedBreadcrumbs(any());
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
        return createService(restTemplate, systemConfigService, repository, extractionService, georeferencingService, null);
    }

    private RaceCourseMapService createService(
            RestTemplate restTemplate,
            SystemConfigService systemConfigService,
            RaceCourseMapAssetRepository repository,
            MarathonRouteExtractionService extractionService,
            MarathonRouteGeoreferencingService georeferencingService,
            OsrmMapMatchingClient osrmMapMatchingClient
    ) {
        ObjectMapper objectMapper = new ObjectMapper();
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        RaceCourseMapSearchService searchService = new RaceCourseMapSearchService(restTemplate);
        RaceCourseMapImageService imageService = new RaceCourseMapImageService(restTemplate);
        ReflectionTestUtils.setField(imageService, "courseMapUploadDirectory", testUploadDirectory.toString());
        RaceCourseMapAiService aiService = new RaceCourseMapAiService(
                restTemplate,
                objectMapper,
                geometryService,
                buildTestQwenAlignmentClient(restTemplate)
        );
        return new RaceCourseMapService(restTemplate, objectMapper, systemConfigService, repository, osrmMapMatchingClient, geometryService, searchService, imageService, aiService, extractionService, georeferencingService);
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

    @Test
    void listRaceCourseMapsSkipsElevationAndCachesRowsWithinTtl() throws Exception {
        RestTemplate restTemplate = mock(RestTemplate.class);
        SystemConfigService systemConfigService = mock(SystemConfigService.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        asset.setRaceId("perf-cache-marathon");
        asset.setRaceName("Perf Cache Marathon");
        asset.setCity("Perf City");
        asset.setCountry("JP");
        String routeJson = "[{\"lat\":35.68,\"lng\":139.76,\"label\":\"Start\"},{\"lat\":35.69,\"lng\":139.77}]" +
                ",".repeat(0) + "";
        StringBuilder points = new StringBuilder("[");
        for (int i = 0; i < 40; i++) {
            if (i > 0) points.append(',');
            points.append("{\"lat\":").append(35.68 + i * 0.001).append(",\"lng\":").append(139.76 + i * 0.001).append('}');
        }
        points.append(']');
        asset.setPendingRoutePointsJson(points.toString());
        asset.setPendingElevationSamplesJson("[100, 105, 110, 115, 120]");
        asset.setPendingImageUrl("data:image/png;base64,perfcache");
        when(repository.findAllListRows()).thenReturn(java.util.List.of(toListRow(asset)));

        RaceCourseMapService service = createService(restTemplate, systemConfigService, repository);

        java.util.List<RaceCourseMapAdminRow> first = service.listRaceCourseMaps();
        java.util.List<RaceCourseMapAdminRow> second = service.listRaceCourseMaps();

        org.junit.jupiter.api.Assertions.assertSame(first, second, "Second list call within the TTL must reuse the cached rows.");
        org.junit.jupiter.api.Assertions.assertTrue(first.get(0).pendingPreview().elevationSamples().isEmpty(),
                "List-mode rows must skip the per-row elevation payload.");
        verify(repository, org.mockito.Mockito.times(1)).findAllListRows();
        verify(repository, org.mockito.Mockito.never()).findAll();
    }

    /**
     * Mirrors what the SQL projection selects: exactly the columns the admin list
     * row consumes, read from a fixture entity in the JPQL constructor order.
     */
    private static RaceCourseMapAssetListRow toListRow(RaceCourseMapAsset asset) {
        return new RaceCourseMapAssetListRow(
                asset.getRaceId(),
                asset.getRaceName(),
                asset.getCity(),
                asset.getCountry(),
                asset.getLatitude(),
                asset.getLongitude(),
                asset.getDistanceKm(),
                asset.getPendingImageUrl(),
                asset.getPendingSource(),
                asset.getPendingConfidence(),
                asset.getPendingSummary(),
                asset.getPendingOverlayBoundsJson(),
                asset.getPendingRoutePointsJson(),
                asset.getPendingAiAssisted(),
                asset.getPendingUpdatedAt(),
                asset.getLiveImageUrl(),
                asset.getLiveSource(),
                asset.getLiveConfidence(),
                asset.getLiveSummary(),
                asset.getLiveOverlayBoundsJson(),
                asset.getLiveRoutePointsJson(),
                asset.getLiveAiAssisted(),
                asset.getLiveUpdatedAt(),
                asset.getUpdatedAt()
        );
    }

}
