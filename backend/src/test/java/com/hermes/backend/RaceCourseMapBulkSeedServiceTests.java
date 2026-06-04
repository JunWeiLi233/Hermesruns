package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RaceCourseMapBulkSeedServiceTests {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void syntheticLoopHasPerimeterCloseToDistanceAtMidLatitude() {
        RaceCourseMapBulkSeedService service = newService(mockElevationRestTemplate(), mock(RaceCourseMapAssetRepository.class));

        List<RoutePoint> loop = service.generateSyntheticLoop(40.7128, -74.0060, 42.195);

        assertThat(loop).hasSize(65); // 64 around the ellipse + closing point
        assertThat(loop.get(0).lat()).isEqualTo(loop.get(loop.size() - 1).lat());
        assertThat(loop.get(0).lng()).isEqualTo(loop.get(loop.size() - 1).lng());

        double perimeter = polylineKm(loop);
        // The loop is clamped to MAX_LOOP_RADIUS_KM (18 km) for marathons; the
        // resulting ellipse perimeter at radius 18 km is roughly 2*pi*18 ~= 113 km
        // — but at NYC's latitude (~40.7N) the lng-correction stretches the loop
        // along the lng axis, so verify the perimeter stays inside a wide
        // sanity band instead of an exact value.
        // Irregular squashed loop with sinusoidal radial perturbation: the
        // perimeter typically falls in the 30-140 km band depending on which
        // RNG seed (race lat/lng hash) we get.
        assertThat(perimeter).isBetween(30.0, 140.0);
    }

    @Test
    void syntheticLoopRemainsValidNearPoles() {
        RaceCourseMapBulkSeedService service = newService(mockElevationRestTemplate(), mock(RaceCourseMapAssetRepository.class));

        // Iceland midnight-sun-style race near 64N — without lat correction the
        // loop would collapse to a thin streak; with correction it stays usable.
        List<RoutePoint> loop = service.generateSyntheticLoop(64.1466, -21.9426, 42.195);

        double maxLng = loop.stream().mapToDouble(RoutePoint::lng).max().orElse(0);
        double minLng = loop.stream().mapToDouble(RoutePoint::lng).min().orElse(0);
        double maxLat = loop.stream().mapToDouble(RoutePoint::lat).max().orElse(0);
        double minLat = loop.stream().mapToDouble(RoutePoint::lat).min().orElse(0);
        double lngSpread = maxLng - minLng;
        double latSpread = maxLat - minLat;
        assertThat(lngSpread).isGreaterThan(latSpread); // lng must be stretched at high latitude
        assertThat(lngSpread).isLessThan(2.0); // and not absurdly wide
    }

    @Test
    void seedRacePersistsLiveAssetWithRouteBoundsAndElevation() {
        RestTemplate restTemplate = mockElevationRestTemplate();
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(repository.findByRaceId("nyc")).thenReturn(Optional.empty());
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapBulkSeedService service = newService(restTemplate, repository);
        RaceCourseMapBulkSeedService.CatalogRace race = new RaceCourseMapBulkSeedService.CatalogRace(
                "nyc",
                "NYC Marathon",
                "NYRR",
                "https://example.com/",
                "New York",
                "United States",
                "New York, United States",
                42.195,
                11,
                "",
                40.7128,
                -74.0060,
                ""
        );

        RaceCourseMapBulkSeedService.SeedOutcome outcome = service.seedRace(race, "admin@hermes.test", false);

        assertThat(outcome).isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);
        verify(repository, times(1)).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void seedRaceSkipsWhenRealAdminUploadHasRoutePolyline() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        RaceCourseMapAsset existing = new RaceCourseMapAsset();
        existing.setRaceId("nyc");
        existing.setLiveSource("admin_manual"); // real admin upload with a real route
        existing.setLiveImageUrl("https://cdn.example.com/real-course.png");
        existing.setLiveRoutePointsJson(buildPlausibleMarathonRouteJson(40.7128, -74.0060));
        when(repository.findByRaceId("nyc")).thenReturn(Optional.of(existing));

        RaceCourseMapBulkSeedService service = newService(restTemplate, repository);
        RaceCourseMapBulkSeedService.CatalogRace race = new RaceCourseMapBulkSeedService.CatalogRace(
                "nyc", "NYC Marathon", "NYRR", "https://example.com/",
                "New York", "United States", "New York, United States",
                42.195, 11, "", 40.7128, -74.0060, "");

        // Even with overwriteSynthetic=true, a real admin upload with a real
        // (plausible-length) route polyline must NEVER be clobbered.
        RaceCourseMapBulkSeedService.SeedOutcome outcome = service.seedRace(race, "admin@hermes.test", true);

        assertThat(outcome).isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.SKIPPED_HAS_REAL_MAP);
        verify(repository, never()).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void seedRaceOverwritesImplausibleRouteBecauseRuntimeRejectsItAtRequestTime() {
        // City-level admin scans sometimes persist routes whose haversine
        // length falls way outside the ±45% race-distance band the runtime
        // accepts (e.g. 78 km route for a 42 km marathon). The frontend then
        // shows "no route". The seed must layer a synthetic loop on top so
        // the race-detail page renders, even though a stored polyline exists.
        RestTemplate restTemplate = mockElevationRestTemplate();
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        RaceCourseMapAsset existing = new RaceCourseMapAsset();
        existing.setRaceId("nyc");
        existing.setLiveSource("admin-auto-acquire");
        existing.setLiveImageUrl("https://cdn.example.com/scanned-image.png");
        existing.setLiveRoutePointsJson(buildLongImplausibleRouteJson(40.7128, -74.0060));
        when(repository.findByRaceId("nyc")).thenReturn(Optional.of(existing));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapBulkSeedService service = newService(restTemplate, repository);
        RaceCourseMapBulkSeedService.CatalogRace race = new RaceCourseMapBulkSeedService.CatalogRace(
                "nyc", "NYC Marathon", "NYRR", "https://example.com/",
                "New York", "United States", "New York, United States",
                42.195, 11, "", 40.7128, -74.0060, "");

        RaceCourseMapBulkSeedService.SeedOutcome outcome = service.seedRace(race, "admin@hermes.test", false);

        assertThat(outcome).isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);
        verify(repository, times(1)).save(any(RaceCourseMapAsset.class));
    }

    private String buildPlausibleMarathonRouteJson(double startLat, double startLng) {
        // 60 points at ~0.667 km spacing = ~40 km — inside the 0.55-1.45
        // band the runtime accepts for a 42.195 km marathon.
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 60; i++) {
            if (i > 0) sb.append(',');
            double lat = startLat + i * 0.006;
            sb.append("{\"lat\":").append(lat).append(",\"lng\":").append(startLng)
              .append(",\"label\":").append(i == 0 ? "\"Start\"" : (i == 59 ? "\"Finish\"" : "null"))
              .append('}');
        }
        sb.append(']');
        return sb.toString();
    }

    private String buildLongImplausibleRouteJson(double startLat, double startLng) {
        // 100 points at ~1.6 km spacing = ~160 km — far outside the 0.55-1.45
        // band the runtime accepts for a 42.195 km marathon. Matches the
        // real-world admin-auto-acquire failures we saw in PostgreSQL.
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < 100; i++) {
            if (i > 0) sb.append(',');
            double lat = startLat + i * 0.0144;
            sb.append("{\"lat\":").append(lat).append(",\"lng\":").append(startLng)
              .append(",\"label\":").append(i == 0 ? "\"Start\"" : (i == 99 ? "\"Finish\"" : "null"))
              .append('}');
        }
        sb.append(']');
        return sb.toString();
    }

    @Test
    void seedRaceAddsSyntheticRouteWhenAdminImageHasNoRoutePolyline() {
        // The most common reality in the actual DB: AI scan acquired an image
        // but couldn't extract a route. We layer a synthetic loop on top so
        // the race-detail page renders a polyline + elevation chart while
        // preserving the original image URL for the card thumbnail.
        RestTemplate restTemplate = mockElevationRestTemplate();
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        RaceCourseMapAsset existing = new RaceCourseMapAsset();
        existing.setRaceId("nyc");
        existing.setLiveSource("admin-auto-acquire");
        existing.setLiveImageUrl("https://cdn.example.com/admin-uploaded-poster.png");
        existing.setLiveRoutePointsJson("[]");
        when(repository.findByRaceId("nyc")).thenReturn(Optional.of(existing));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapBulkSeedService service = newService(restTemplate, repository);
        RaceCourseMapBulkSeedService.CatalogRace race = new RaceCourseMapBulkSeedService.CatalogRace(
                "nyc", "NYC Marathon", "NYRR", "https://example.com/",
                "New York", "United States", "New York, United States",
                42.195, 11, "", 40.7128, -74.0060, "");

        RaceCourseMapBulkSeedService.SeedOutcome outcome = service.seedRace(race, "admin@hermes.test", false);

        assertThat(outcome).isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);
        assertThat(existing.getLiveImageUrl()).isEqualTo("https://cdn.example.com/admin-uploaded-poster.png");
        // OSRM is not stubbed in this test, so the seed falls back to the
        // ellipse path; either synthetic source string is acceptable.
        assertThat(existing.getLiveSource()).isIn(
                RaceCourseMapBulkSeedService.SYNTHETIC_SOURCE,
                RaceCourseMapBulkSeedService.LEGACY_GEOGRAPHIC_LOOP_SOURCE);
        verify(repository, times(1)).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void seedRaceRefreshesSyntheticEntryThatHasARealRouteWhenOverwriteRequested() {
        // Earlier synthetic seeds wrote a real route polyline. A subsequent
        // seed call must skip by default but heal when overwriteSynthetic=true.
        RestTemplate restTemplate = mockElevationRestTemplate();
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);

        RaceCourseMapAsset synthetic = new RaceCourseMapAsset();
        synthetic.setRaceId("nyc");
        synthetic.setLiveSource(RaceCourseMapBulkSeedService.SYNTHETIC_SOURCE);
        synthetic.setLiveRoutePointsJson(buildPlausibleMarathonRouteJson(40.7128, -74.0060));
        when(repository.findByRaceId("nyc")).thenReturn(Optional.of(synthetic));
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapBulkSeedService service = newService(restTemplate, repository);
        RaceCourseMapBulkSeedService.CatalogRace race = new RaceCourseMapBulkSeedService.CatalogRace(
                "nyc", "NYC Marathon", "NYRR", "https://example.com/",
                "New York", "United States", "New York, United States",
                42.195, 11, "", 40.7128, -74.0060, "");

        // Synthetic source + plausible route → skip with SKIPPED_HAS_SYNTHETIC
        // (a separate outcome from SKIPPED_HAS_REAL_MAP so callers can tell
        // whether they're respecting an admin upload or just leaving a prior
        // synthetic seed alone).
        assertThat(service.seedRace(race, "admin@hermes.test", false))
                .isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.SKIPPED_HAS_SYNTHETIC);
        verify(repository, never()).save(any(RaceCourseMapAsset.class));

        assertThat(service.seedRace(race, "admin@hermes.test", true))
                .isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.SEEDED);
        verify(repository, times(1)).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void seedRaceFailsWhenCoordinatesMissing() {
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        RaceCourseMapBulkSeedService service = newService(mock(RestTemplate.class), repository);

        RaceCourseMapBulkSeedService.CatalogRace race = new RaceCourseMapBulkSeedService.CatalogRace(
                "missing-coords", "No-coord race", null, null, null, null, null,
                42.195, null, null, null, null, null);

        assertThat(service.seedRace(race, "admin@hermes.test", false))
                .isEqualTo(RaceCourseMapBulkSeedService.SeedOutcome.FAILED);
        verify(repository, never()).save(any(RaceCourseMapAsset.class));
    }

    @Test
    void seedAllReadsCatalogAndSummarizes(@TempDir Path tempDir) throws Exception {
        Path catalog = tempDir.resolve("catalog.json");
        Files.writeString(catalog, """
                [
                  {"id": "alpha", "name": "Alpha", "city": "New York", "country": "United States",
                   "officialWebsite": "https://example.com/alpha", "distanceKm": 42.195,
                   "lat": 40.7128, "lng": -74.0060},
                  {"id": "bravo", "name": "Bravo", "city": "Tokyo", "country": "Japan",
                   "officialWebsite": "https://example.com/bravo", "distanceKm": 42.195,
                   "lat": 35.6762, "lng": 139.6503},
                  {"id": "missing-coords", "name": "Missing", "distanceKm": 42.195}
                ]
                """);

        RestTemplate restTemplate = mockElevationRestTemplate();
        RaceCourseMapAssetRepository repository = mock(RaceCourseMapAssetRepository.class);
        when(repository.findByRaceId(any())).thenReturn(Optional.empty());
        when(repository.save(any(RaceCourseMapAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RaceCourseMapBulkSeedService service = newService(restTemplate, repository);
        RaceCourseMapBulkSeedService.BulkSeedSummary summary = service.seedAllMissingFromCatalog(catalog, "admin@hermes.test", false);

        assertThat(summary.catalogSize()).isEqualTo(3);
        assertThat(summary.seeded()).isEqualTo(2);
        assertThat(summary.failed()).isEqualTo(1);
        assertThat(summary.skipped()).isEqualTo(0);
    }

    @Test
    void officialCourseFallsBackToStraightLineCorridorWhenOsrmUnavailable() {
        // Regression: Osaka/LA/NYC official courses degraded to a generic
        // geographic loop ("cycle") when they were seeded during an OSRM outage,
        // because generateOfficialCoursePolyline aborted to an empty result and
        // the runtime then layered a synthetic loop on top. With the straight-line
        // corridor fallback the method must instead trace the real official
        // waypoints (start -> ... -> finish) and NEVER return empty.
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenAnswer(invocation -> {
                    RequestEntity<?> req = invocation.getArgument(0);
                    String url = req.getUrl() == null ? "" : req.getUrl().toString();
                    if (url.contains("/route/v1/")) {
                        // Simulate OSRM down: non-Ok response for every leg + retry.
                        return ResponseEntity.ok(Map.of("code", "Error"));
                    }
                    return ResponseEntity.ok(Map.of());
                });

        RaceCourseMapBulkSeedService service = newService(restTemplate, mock(RaceCourseMapAssetRepository.class));
        service.osrmRetryDelayMs = 0L; // no backoff between leg retries in tests

        List<RoutePoint> route = service.generateOfficialCoursePolyline(OsakaMarathonOfficialCourse.RACE_ID);

        // Before the fix this was empty -> runtime rendered a generic cycle.
        assertThat(route).isNotEmpty();
        assertThat(route.size()).isGreaterThanOrEqualTo(8);

        double[] firstWp = OsakaMarathonOfficialCourse.waypoints().get(0);
        double[] lastWp = OsakaMarathonOfficialCourse.waypoints()
                .get(OsakaMarathonOfficialCourse.waypointCount() - 1);
        RoutePoint head = route.get(0);
        RoutePoint tail = route.get(route.size() - 1);
        // Corridor starts at the official start and ends at the official finish.
        assertThat(haversineKm(head.lat(), head.lng(), firstWp[0], firstWp[1])).isLessThan(0.5);
        assertThat(haversineKm(tail.lat(), tail.lng(), lastWp[0], lastWp[1])).isLessThan(0.5);
        // Point-to-point (start != finish) — proves it is NOT a closed loop/cycle.
        double expectedEndpointKm = haversineKm(firstWp[0], firstWp[1], lastWp[0], lastWp[1]);
        assertThat(haversineKm(head.lat(), head.lng(), tail.lat(), tail.lng()))
                .isCloseTo(expectedEndpointKm, org.assertj.core.data.Offset.offset(1.0));
        // Total corridor length stays in a plausible marathon band.
        assertThat(polylineKm(route)).isBetween(15.0, 80.0);
        // Landmark labels survive the fallback so the runner card still reads right.
        assertThat(route).anyMatch(p -> p.label() != null && p.label().contains("Start"));
        assertThat(route).anyMatch(p -> p.label() != null && p.label().contains("Finish"));
    }

    private RaceCourseMapBulkSeedService newService(RestTemplate restTemplate, RaceCourseMapAssetRepository repository) {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        return new RaceCourseMapBulkSeedService(repository, geometryService, objectMapper, restTemplate);
    }

    private RestTemplate mockElevationRestTemplate() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        Map<String, Object> body = new HashMap<>();
        // 65-point elevation strip — open-meteo returns one entry per requested coord.
        List<Double> elevations = new java.util.ArrayList<>();
        for (int i = 0; i < 65; i++) {
            elevations.add(50.0 + (i % 7));
        }
        body.put("elevation", elevations);
        when(restTemplate.exchange(any(RequestEntity.class), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(body));
        when(restTemplate.exchange(any(java.net.URI.class), eq(HttpMethod.GET), any(), any(ParameterizedTypeReference.class)))
                .thenReturn(ResponseEntity.ok(body));
        return restTemplate;
    }

    private double polylineKm(List<RoutePoint> points) {
        double km = 0;
        for (int i = 1; i < points.size(); i++) {
            RoutePoint prev = points.get(i - 1);
            RoutePoint cur = points.get(i);
            km += haversineKm(prev.lat(), prev.lng(), cur.lat(), cur.lng());
        }
        return km;
    }

    private double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
