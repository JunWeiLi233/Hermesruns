package com.hermes.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration tests for the GET /api/territory/polygons endpoint.
 * Also verifies the existing GET /api/territory endpoint remains unbroken.
 *
 * Uses @Transactional for automatic rollback after each test — no manual deleteAll needed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TerritoryControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RunnerRepository runnerRepository;

    @Autowired
    private ActivityRepository activityRepository;

    @Autowired
    private ActivityPointRepository activityPointRepository;

    @Autowired
    private TerritoryPolygonRepository territoryPolygonRepository;

    @Autowired
    private TerritoryService territoryService;

    @Autowired
    private AuthService authService;

    // -----------------------------------------------------------------------
    // Existing /api/territory endpoint must remain intact
    // -----------------------------------------------------------------------
    @Test
    void existingTerritoryEndpointReturnsUnauthorizedWithNoToken() throws Exception {
        mockMvc.perform(get("/api/territory"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void existingTerritoryEndpointReturnsOkForAuthenticatedRunner() throws Exception {
        Runner runner = createRunner("territory-existing@test.local");
        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").exists());
    }

    // -----------------------------------------------------------------------
    // GET /api/territory/polygons — auth guard
    // -----------------------------------------------------------------------
    @Test
    void polygonsEndpointReturnsUnauthorizedWithNoToken() throws Exception {
        mockMvc.perform(get("/api/territory/polygons"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // GET /api/territory/polygons — empty state
    // -----------------------------------------------------------------------
    @Test
    void polygonsEndpointReturnsEmptyForRunnerWithNoLoops() throws Exception {
        Runner runner = createRunner("territory-empty@test.local");

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons").isArray())
                .andExpect(jsonPath("$.polygons").isEmpty())
                .andExpect(jsonPath("$.totalAreaSquareMeters").value(0.0))
                .andExpect(jsonPath("$.polygonCount").value(0));
    }

    // -----------------------------------------------------------------------
    // GET /api/territory/polygons — runner with pre-persisted polygons
    // -----------------------------------------------------------------------
    @Test
    void polygonsEndpointReturnsPersistentPolygonsForRunner() throws Exception {
        Runner runner = createRunner("territory-has-polygons@test.local");
        Activity activity = createActivity(runner);

        // Pre-persist a polygon directly
        TerritoryPolygon polygon = new TerritoryPolygon();
        polygon.setUserId(runner.getId());
        polygon.setActivityId(activity.getId());
        polygon.setCoordinates("37.822,−122.250;37.823,−122.250;37.823,−122.249;37.822,−122.250");
        polygon.setAreaSquareMeters(12345.0);
        territoryPolygonRepository.save(polygon);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons").isArray())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.totalAreaSquareMeters").value(12345.0))
                .andExpect(jsonPath("$.polygons[0].activityId").value(activity.getId()))
                .andExpect(jsonPath("$.polygons[0].areaSquareMeters").value(12345.0));
    }

    // -----------------------------------------------------------------------
    // computePolygonsForActivity produces polygons for a circular route
    // -----------------------------------------------------------------------
    @Test
    void computePolygonsForActivityCreatesPolygonForCircularRoute() {
        Runner runner = createRunner("territory-compute@test.local");
        Activity activity = createActivity(runner);

        // Seed a circular GPS route (~200 m radius, 60 points)
        seedCircularRoute(activity, 37.822, -122.25, 200.0, 60);

        territoryService.computePolygonsForActivity(activity.getId());

        List<TerritoryPolygon> polygons = territoryPolygonRepository.findAll().stream()
                .filter(p -> p.getActivityId().equals(activity.getId()))
                .toList();

        // Should detect exactly one closed loop
        org.assertj.core.api.Assertions.assertThat(polygons).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(polygons.get(0).getAreaSquareMeters())
                .isGreaterThan(TerritoryPolygonComputer.MIN_AREA_SQ_METERS);
        org.assertj.core.api.Assertions.assertThat(polygons.get(0).getCoordinates()).isNotBlank();
    }

    // -----------------------------------------------------------------------
    // computePolygonsForActivity produces nothing for an out-and-back
    // -----------------------------------------------------------------------
    @Test
    void computePolygonsForActivityCreatesNothingForOutAndBack() {
        Runner runner = createRunner("territory-oab@test.local");
        Activity activity = createActivity(runner);

        seedOutAndBackRoute(activity, 37.822, -122.25);

        territoryService.computePolygonsForActivity(activity.getId());

        List<TerritoryPolygon> polygons = territoryPolygonRepository.findAll().stream()
                .filter(p -> p.getActivityId().equals(activity.getId()))
                .toList();

        org.assertj.core.api.Assertions.assertThat(polygons).isEmpty();
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private Runner createRunner(String email) {
        Runner runner = new Runner();
        runner.setEmail(email);
        runner.setStatus("ACTIVE");
        runner.setRole("USER");
        runner.setEmailVerified(true);
        runner.setCreatedAt(LocalDateTime.now());
        authService.storePassword(runner, "Password1!");
        return runnerRepository.save(runner);
    }

    private Activity createActivity(Runner runner) {
        Activity activity = new Activity();
        activity.setRunner(runner);
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(5.0);
        activity.setMovingTimeSeconds(1800);
        activity.setStartTime(LocalDateTime.now());
        return activityRepository.save(activity);
    }

    private void seedCircularRoute(Activity activity, double centerLat, double centerLng,
                                    double radiusMeters, int n) {
        double degRadius = radiusMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i <= n; i++) {
            double angle = 2 * Math.PI * i / n;
            double lat = centerLat + degRadius * Math.cos(angle);
            double lng = centerLng + degRadius * Math.sin(angle)
                    / Math.cos(Math.toRadians(centerLat));
            ActivityPoint pt = new ActivityPoint();
            pt.setActivity(activity);
            pt.setSequenceIndex(i);
            pt.setLatitude(lat);
            pt.setLongitude(lng);
            pt.setElapsedSeconds(i * 10);
            points.add(pt);
        }
        // Return to near start to trigger closure
        ActivityPoint closePoint = new ActivityPoint();
        closePoint.setActivity(activity);
        closePoint.setSequenceIndex(n + 1);
        closePoint.setLatitude(points.get(0).getLatitude() + 0.00001);
        closePoint.setLongitude(points.get(0).getLongitude() + 0.00001);
        closePoint.setElapsedSeconds((n + 1) * 10);
        points.add(closePoint);
        activityPointRepository.saveAll(points);
    }

    private void seedOutAndBackRoute(Activity activity, double baseLat, double baseLng) {
        List<ActivityPoint> points = new ArrayList<>();
        int idx = 0;
        // Out: 100 steps north
        for (int i = 0; i <= 100; i++) {
            ActivityPoint pt = new ActivityPoint();
            pt.setActivity(activity);
            pt.setSequenceIndex(idx++);
            pt.setLatitude(baseLat + i * 0.0001);
            pt.setLongitude(baseLng);
            pt.setElapsedSeconds(idx * 5);
            points.add(pt);
        }
        // Back: 100 steps south (same track, zero enclosed area)
        for (int i = 99; i >= 0; i--) {
            ActivityPoint pt = new ActivityPoint();
            pt.setActivity(activity);
            pt.setSequenceIndex(idx++);
            pt.setLatitude(baseLat + i * 0.0001);
            pt.setLongitude(baseLng);
            pt.setElapsedSeconds(idx * 5);
            points.add(pt);
        }
        activityPointRepository.saveAll(points);
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }
}
