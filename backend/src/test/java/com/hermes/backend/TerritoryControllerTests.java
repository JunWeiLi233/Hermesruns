package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * The Spring boot application context seeds a "Hermes Temporal Rival" runner with demo activities
     * whose computed land masks are visible to every viewer. Tests that assert specific polygon counts
     * or empty states would otherwise see those rival polygons leak in. Clearing the table before each
     * test (the @Transactional rollback restores it) gives every test a deterministic clean slate.
     * Tests that need rival polygons (e.g. polygonsEndpointIncludesRivalLandMasksWithoutRivalRouteTraces)
     * construct their own rival runner explicitly, so this clear is safe for them too.
     */
    @BeforeEach
    void clearPreSeededTerritoryPolygons() {
        territoryPolygonRepository.deleteAll();
        // Bootstrap runners ("Hermes Shared Runner", "Hermes Temporal Rival") have ActivityPoints
        // near the test coordinates (37.822, -122.250) and contaminate territory calculations.
        // Clearing all points here is safe: @Transactional rolls back the deletion after each test.
        activityPointRepository.deleteAll();
    }

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

    @Test
    void territoryEndpointReturnsLocalSharedRunnerFallbackWhenSeedPointsAreMissing() throws Exception {
        Runner runner = runnerRepository.findByEmailIgnoreCase(LocalSharedRunnerBootstrapService.DEFAULT_EMAIL)
                .orElseGet(() -> createRunner(LocalSharedRunnerBootstrapService.DEFAULT_EMAIL));

        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.mode").value("local-shared-runner-fallback"))
                .andExpect(jsonPath("$.center.latitude").value(40.746))
                .andExpect(jsonPath("$.center.longitude").value(-73.813))
                .andExpect(jsonPath("$.territories.length()").value(5))
                .andExpect(jsonPath("$.territories[0].ownerName").value("You"))
                .andExpect(jsonPath("$.territories[0].polygon.length()").value(4))
                .andExpect(jsonPath("$.leaderboard[0].active").value(true));
    }

    @Test
    void existingTerritoryEndpointReturnsScoreBasedControlFields() throws Exception {
        Runner active = createRunner("territory-score-active@test.local");
        Runner rival = createRunner("territory-score-rival@test.local");
        Activity activeActivity = createActivity(active);
        Activity rivalActivity = createActivity(rival);

        seedTerritorySamples(rivalActivity, 37.822, -122.250, 8);
        seedTerritorySamples(activeActivity, 37.8221, -122.2501, 5);

        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.territories[0].contested").value(true))
                .andExpect(jsonPath("$.territories[0].challengerName").value("You"))
                .andExpect(jsonPath("$.territories[0].ownerScore").isNumber())
                .andExpect(jsonPath("$.territories[0].challengerScore").isNumber())
                .andExpect(jsonPath("$.territories[0].activeScore").isNumber())
                .andExpect(jsonPath("$.territories[0].controlPct").isNumber())
                .andExpect(jsonPath("$.territories[0].samplesToContest").isNumber())
                .andExpect(jsonPath("$.zones[0].controlPct").isNumber())
                .andExpect(jsonPath("$.zones[0].samplesToContest").isNumber())
                .andExpect(jsonPath("$.nextTarget.samplesToContest").isNumber());
    }

    @Test
    void territoryEndpointLetsNewestRunnerOwnOverlapEvenWhenOlderCoverageIsDenser() throws Exception {
        Runner active = createRunner("territory-latest-fill-active@test.local");
        Runner rival = createRunner("territory-latest-fill-rival@test.local");
        rival.setDisplayName("Late Fill Rival");
        runnerRepository.save(rival);

        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(LocalDateTime.now().minusHours(3));
        activityRepository.save(activeActivity);
        seedTerritorySamples(activeActivity, 37.822, -122.250, 18);

        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(LocalDateTime.now().minusMinutes(5));
        activityRepository.save(rivalActivity);
        seedTerritorySamples(rivalActivity, 37.82202, -122.24998, 3);

        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.territories[0].ownerName").value("Late Fill Rival"))
                .andExpect(jsonPath("$.territories[0].challengerName").value("You"))
                .andExpect(jsonPath("$.territories[0].sampleCount").value(21))
                .andExpect(jsonPath("$.leaderboard[0].name").value("Late Fill Rival"));
    }

    @Test
    void territoryEndpointReusesCachedMapForRepeatedPageLoads() throws Exception {
        Runner runner = createRunner("territory-map-cache@test.local");
        Activity activity = createActivity(runner);
        seedTerritorySamples(activity, 37.822, -122.250, 6);

        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.territories[0].sampleCount").value(6));

        activityPointRepository.deleteByActivity(activity);
        activityPointRepository.flush();

        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.territories[0].sampleCount").value(6));
    }

    @Test
    void territoryEndpointRefreshesCachedMapWhenRivalRunnerAddsSamples() throws Exception {
        Runner active = createRunner("territory-map-cache-active@test.local");
        Activity activeActivity = createActivity(active);
        seedTerritorySamples(activeActivity, 37.822, -122.250, 18);

        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.leaderboard.length()").value(1))
                .andExpect(jsonPath("$.territories[0].ownerName").value("You"));

        Runner rival = createRunner("territory-map-cache-rival@test.local");
        rival.setDisplayName("Cache Rival");
        runnerRepository.save(rival);
        Activity rivalActivity = createActivity(rival);
        seedTerritorySamples(rivalActivity, 37.82202, -122.24998, 24);

        mockMvc.perform(get("/api/territory")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.leaderboard.length()").value(2))
                .andExpect(jsonPath("$.territories[0].ownerName").value("Cache Rival"))
                .andExpect(jsonPath("$.territories[0].contested").value(true))
                .andExpect(jsonPath("$.territories[0].challengerName").value("You"));
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
    void polygonsEndpointIgnoresLegacyCoordinateRowsWithoutRoutePoints() throws Exception {
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
                .andExpect(jsonPath("$.polygons").isEmpty())
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.totalAreaSquareMeters").value(0.0));
    }

    @Test
    void polygonsEndpointRecomputesLegacyRowsWhenRoutePointsExist() throws Exception {
        Runner runner = createRunner("territory-legacy-recompute@test.local");
        Activity activity = createActivity(runner);
        seedOutAndBackRoute(activity, 37.822, -122.25);

        TerritoryPolygon legacyPolygon = new TerritoryPolygon();
        legacyPolygon.setUserId(runner.getId());
        legacyPolygon.setActivityId(activity.getId());
        legacyPolygon.setCoordinates("37.822,-122.250;37.823,-122.250;37.823,-122.249;37.822,-122.250");
        legacyPolygon.setAreaSquareMeters(12345.0);
        territoryPolygonRepository.save(legacyPolygon);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons[0].activityId").value(activity.getId()))
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cells").isNotEmpty())
                .andExpect(jsonPath("$.backfillInProgress").value(false))
                .andExpect(jsonPath("$.pendingActivityCount").value(0));

        List<TerritoryPolygon> rows = territoryPolygonRepository.findAll().stream()
                .filter(p -> p.getActivityId().equals(activity.getId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rows).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(TerritoryPolygonComputer.decodeMaskCells(rows.get(0).getCoordinates()).cells())
                .isNotEmpty();
    }

    @Test
    void polygonsEndpointMarksSparseGeneratedOutlineProcessedWithoutTerritory() throws Exception {
        Runner runner = createRunner("territory-sparse-outline@test.local");
        Activity activity = createActivity(runner);
        seedSparseGeneratedClosedOutline(activity, 40.742, -73.823);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons").isArray())
                .andExpect(jsonPath("$.polygons").isEmpty())
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.backfillInProgress").value(false))
                .andExpect(jsonPath("$.pendingActivityCount").value(0));

        List<TerritoryPolygon> rows = territoryPolygonRepository.findAll().stream()
                .filter(p -> p.getActivityId().equals(activity.getId()))
                .toList();
        assertThat(rows).hasSize(1);
        TerritoryPolygonComputer.DecodedTerritoryMask marker =
                TerritoryPolygonComputer.decodeMaskCells(rows.get(0).getCoordinates());
        assertThat(marker.processed()).isTrue();
        assertThat(marker.cells()).isEmpty();
        assertThat(rows.get(0).getAreaSquareMeters()).isZero();

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.backfillInProgress").value(false))
                .andExpect(jsonPath("$.pendingActivityCount").value(0));
    }

    @Test
    void polygonsEndpointBackfillsRouteFootprintsForExistingRuns() throws Exception {
        Runner runner = createRunner("territory-backfill@test.local");
        Activity activity = createActivity(runner);
        LocalDateTime expectedRouteTime = LocalDateTime.of(2026, 4, 12, 8, 46, 36);
        activity.setStartTime(expectedRouteTime);
        activity.setCreatedAt(expectedRouteTime.plusHours(6));
        activityRepository.save(activity);
        seedOutAndBackRoute(activity, 37.822, -122.25);
        territoryService.computePolygonsForActivity(activity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons[0].activityId").value(activity.getId()))
                .andExpect(jsonPath("$.polygons[0].areaSquareMeters").isNumber())
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cells").isArray())
                .andExpect(jsonPath("$.polygons[0].cells[0].latitude").isNumber())
                .andExpect(jsonPath("$.polygons[0].cells[0].longitude").isNumber())
                .andExpect(jsonPath("$.polygons[0].createdAt").value(expectedRouteTime.toString()))
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].activityId").value(activity.getId()))
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].routeRadiusMeters").value(18.0))
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].createdAt").value(expectedRouteTime.toString()))
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].points").isArray())
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].points[0].latitude").isNumber())
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].points[0].longitude").isNumber());
    }

    @Test
    void polygonsEndpointReturnsPerActivitySourceMasksForConcreteRenderRepair() throws Exception {
        Runner runner = createRunner("territory-source-mask@test.local");
        Activity firstActivity = createActivity(runner);
        Activity secondActivity = createActivity(runner);

        seedCompactOutAndBackRoute(firstActivity, 37.822, -122.250);
        seedCompactOutAndBackRoute(secondActivity, 37.826, -122.250);
        territoryService.computePolygonsForActivity(firstActivity.getId());
        territoryService.computePolygonsForActivity(secondActivity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(2))
                .andExpect(jsonPath("$.polygons.length()").value(2))
                .andExpect(jsonPath("$.polygons[*].activityId").value(containsInAnyOrder(
                        firstActivity.getId().intValue(),
                        secondActivity.getId().intValue()
                )))
                .andExpect(jsonPath("$.polygons[*].shapeType").value(everyItem(equalTo("land-mask"))))
                .andExpect(jsonPath("$.polygons[*].cells").isArray())
                .andExpect(jsonPath("$.polygons[*].routeTraces.length()").value(everyItem(equalTo(1))))
                .andExpect(jsonPath("$.polygons[*].routeTraces[*].points").isArray());
    }

    @Test
    void polygonsEndpointCapsMergedRouteTracePayloadForLargeTerritories() throws Exception {
        Runner runner = createRunner("territory-route-trace-cap@test.local");
        for (int index = 0; index < 30; index += 1) {
            Activity activity = createActivity(runner);
            seedCompactOutAndBackRoute(activity, 37.822 + (index * 0.002), -122.250);
            territoryService.computePolygonsForActivity(activity.getId());
        }

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(30))
                .andExpect(jsonPath("$.polygons[*].shapeType").value(everyItem(equalTo("land-mask"))))
                .andExpect(jsonPath("$.polygons[*].routeTraces.length()").value(everyItem(equalTo(1))))
                .andReturn();

        JsonNode polygons = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("polygons");
        int routeTraceCount = 0;

        int routePointCount = 0;
        for (JsonNode polygon : polygons) {
            for (JsonNode trace : polygon.path("routeTraces")) {
                routeTraceCount += 1;
                routePointCount += trace.path("points").size();
            }
        }
        assertThat(routeTraceCount).isLessThanOrEqualTo(256);
        assertThat(routePointCount).isLessThanOrEqualTo(12_800);
    }

    @Test
    void polygonsEndpointAddsAllSameOwnerRunCoverageWithoutCreatingHullBetweenRuns() throws Exception {
        Runner runner = createRunner("territory-additive-diagram@test.local");
        Activity loopActivity = createActivity(runner);
        Activity ribbonActivity = createActivity(runner);

        double baseLat = 37.822;
        double baseLng = -122.250;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double sideMeters = 240.0;
        double sideLat = sideMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double sideLng = sideMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        List<double[]> closedLoop = new ArrayList<>();
        addRouteSegment(closedLoop, baseLat, baseLng, baseLat, baseLng + sideLng, 24);
        addRouteSegment(closedLoop, baseLat, baseLng + sideLng, baseLat + sideLat, baseLng + sideLng, 24);
        addRouteSegment(closedLoop, baseLat + sideLat, baseLng + sideLng, baseLat + sideLat, baseLng, 24);
        addRouteSegment(closedLoop, baseLat + sideLat, baseLng, baseLat, baseLng, 24);
        seedRoute(loopActivity, closedLoop);

        double secondLoopBaseLat = baseLat + 0.009;
        double secondLoopWidthMeters = 260.0;
        double secondLoopHeightMeters = 180.0;
        double secondLoopWidthLng = secondLoopWidthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double secondLoopHeightLat = secondLoopHeightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> secondClosedLoop = new ArrayList<>();
        addRouteSegment(secondClosedLoop, secondLoopBaseLat, baseLng, secondLoopBaseLat, baseLng + secondLoopWidthLng, 28);
        addRouteSegment(secondClosedLoop, secondLoopBaseLat, baseLng + secondLoopWidthLng,
                secondLoopBaseLat + secondLoopHeightLat, baseLng + secondLoopWidthLng, 20);
        addRouteSegment(secondClosedLoop, secondLoopBaseLat + secondLoopHeightLat, baseLng + secondLoopWidthLng,
                secondLoopBaseLat + secondLoopHeightLat, baseLng, 28);
        addRouteSegment(secondClosedLoop, secondLoopBaseLat + secondLoopHeightLat, baseLng,
                secondLoopBaseLat, baseLng, 20);
        seedRoute(ribbonActivity, secondClosedLoop);

        territoryService.computePolygonsForActivity(loopActivity.getId());
        territoryService.computePolygonsForActivity(ribbonActivity.getId());

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(2))
                .andExpect(jsonPath("$.polygons[*].active").value(everyItem(equalTo(true))))
                .andExpect(jsonPath("$.polygons[*].shapeType").value(everyItem(equalTo("land-mask"))))
                .andExpect(jsonPath("$.polygons[*].routeTraces.length()").value(everyItem(equalTo(1))))
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        com.fasterxml.jackson.databind.node.ArrayNode cells = objectMapper.createArrayNode();
        int routeTraceCount = 0;
        for (JsonNode polygon : root.path("polygons")) {
            polygon.path("cells").forEach(cells::add);
            routeTraceCount += polygon.path("routeTraces").size();
        }
        assertThat(routeTraceCount).isEqualTo(2);

        assertThat(containsNearbyMaskCell(cells, baseLat + sideLat / 2.0, baseLng + sideLng / 2.0, 18.0)).isTrue();
        assertThat(containsNearbyMaskCell(cells, secondLoopBaseLat + secondLoopHeightLat / 2.0, baseLng + secondLoopWidthLng / 2.0, 18.0)).isTrue();
        assertThat(containsNearbyMaskCell(cells,
                secondLoopBaseLat + secondLoopHeightLat * 1.6,
                baseLng + secondLoopWidthLng / 2.0,
                18.0)).isFalse();
        assertThat(containsNearbyMaskCell(cells, baseLat + 0.005, baseLng + sideLng / 2.0, 18.0)).isFalse();
    }

    @Test
    void polygonsEndpointDoesNotKeepWarmingForRunsWithoutGpsPoints() throws Exception {
        Runner runner = createRunner("territory-no-gps-run@test.local");
        createActivity(runner);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons").isEmpty())
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.backfillInProgress").value(false))
                .andExpect(jsonPath("$.pendingActivityCount").value(0));
    }

    @Test
    void polygonsEndpointKeepsInteriorVoidsOpenInUnionMask() throws Exception {
        Runner runner = createRunner("territory-union-hole-fill@test.local");
        Activity activity = createActivity(runner);
        double baseLat = 37.822;
        double baseLng = -122.250;
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        double latStep = cellMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngStep = latStep / Math.cos(Math.toRadians(baseLat));
        List<TerritoryPolygonComputer.MaskCell> ring = new ArrayList<>();
        for (int y = -2; y <= 2; y += 1) {
            for (int x = -2; x <= 2; x += 1) {
                if (Math.abs(x) != 2 && Math.abs(y) != 2) {
                    continue;
                }
                ring.add(new TerritoryPolygonComputer.MaskCell(baseLat + y * latStep, baseLng + x * lngStep));
            }
        }

        TerritoryPolygon polygon = new TerritoryPolygon();
        polygon.setUserId(runner.getId());
        polygon.setActivityId(activity.getId());
        polygon.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(ring, cellMeters));
        polygon.setAreaSquareMeters(ring.size() * cellMeters * cellMeters);
        territoryPolygonRepository.save(polygon);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cells.length()").value(16));
    }

    @Test
    void polygonsEndpointDoesNotLetOneCoarseMaskDownsampleTheWholeUnion() throws Exception {
        Runner runner = createRunner("territory-coarse-union@test.local");
        Activity fineActivity = createActivity(runner);
        Activity coarseActivity = createActivity(runner);

        double baseLat = 37.822;
        double baseLng = -122.250;

        TerritoryPolygon fineMask = new TerritoryPolygon();
        fineMask.setUserId(runner.getId());
        fineMask.setActivityId(fineActivity.getId());
        fineMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(baseLat, baseLng)),
                TerritoryPolygonComputer.LAND_MASK_CELL_METERS
        ));
        fineMask.setAreaSquareMeters(TerritoryPolygonComputer.LAND_MASK_CELL_METERS * TerritoryPolygonComputer.LAND_MASK_CELL_METERS);
        territoryPolygonRepository.save(fineMask);

        double coarseCellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS * 4;
        double coarseLatStep = coarseCellMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double coarseLngStep = coarseLatStep / Math.cos(Math.toRadians(baseLat));
        TerritoryPolygon coarseMask = new TerritoryPolygon();
        coarseMask.setUserId(runner.getId());
        coarseMask.setActivityId(coarseActivity.getId());
        coarseMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(baseLat + coarseLatStep, baseLng + coarseLngStep)),
                coarseCellMeters
        ));
        coarseMask.setAreaSquareMeters(coarseCellMeters * coarseCellMeters);
        territoryPolygonRepository.save(coarseMask);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cellMeters").value(TerritoryPolygonComputer.LAND_MASK_CELL_METERS));
    }

    @Test
    void polygonsEndpointBackfillsAndReturnsEveryRunNotOnlyRecentBatch() throws Exception {
        Runner runner = createRunner("territory-all-runs@test.local");
        int totalRuns = 205;

        for (int i = 0; i < totalRuns; i++) {
            Activity activity = createActivity(runner);
            activity.setStartTime(LocalDateTime.now().minusDays(i));
            activityRepository.save(activity);
            seedCompactOutAndBackRoute(activity, 37.700 + i * 0.00003, -122.250);
            territoryService.computePolygonsForActivity(activity.getId());
        }

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons").isArray())
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cells[0].latitude").isNumber())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(root.path("polygonCount").asInt()).isGreaterThan(0);

        List<TerritoryPolygon> rows = territoryPolygonRepository.findAll().stream()
                .filter(p -> runner.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rows).hasSize(totalRuns);
        org.assertj.core.api.Assertions.assertThat(rows)
                .allSatisfy(row -> org.assertj.core.api.Assertions
                        .assertThat(TerritoryPolygonComputer.decodeMaskCells(row.getCoordinates()).cells())
                .isNotEmpty());
    }

    @Test
    void polygonsEndpointKeepsRecentRunCorridorsWithoutFillingUnrunGaps() throws Exception {
        Runner runner = createRunner("territory-recent-corridor-fidelity@test.local");
        double baseLat = 37.822;
        double baseLng = -122.250;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double eastTwoHundredSixtyMeters = 260.0 / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double eastTwoHundredTwentyMeters = 220.0 / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);

        Activity westRun = createActivity(runner);
        westRun.setStartTime(LocalDateTime.now().minusMinutes(30));
        activityRepository.save(westRun);
        seedCompactOutAndBackRoute(westRun, baseLat, baseLng);
        territoryService.computePolygonsForActivity(westRun.getId());

        Activity eastRun = createActivity(runner);
        eastRun.setStartTime(LocalDateTime.now().minusMinutes(20));
        activityRepository.save(eastRun);
        seedCompactOutAndBackRoute(eastRun, baseLat, baseLng + eastTwoHundredSixtyMeters);
        territoryService.computePolygonsForActivity(eastRun.getId());

        Activity separateRun = createActivity(runner);
        separateRun.setStartTime(LocalDateTime.now().minusMinutes(10));
        activityRepository.save(separateRun);
        seedCompactOutAndBackRoute(separateRun, baseLat + 0.010, baseLng);
        territoryService.computePolygonsForActivity(separateRun.getId());

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(3))
                .andExpect(jsonPath("$.polygons[*].active").value(everyItem(equalTo(true))))
                .andExpect(jsonPath("$.polygons[*].shapeType").value(everyItem(equalTo("land-mask"))))
                .andExpect(jsonPath("$.polygons[*].activityId").value(containsInAnyOrder(
                        westRun.getId().intValue(),
                        eastRun.getId().intValue(),
                        separateRun.getId().intValue()
                )))
                .andExpect(jsonPath("$.polygons[*].routeTraces.length()").value(everyItem(equalTo(1))))
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode polygons = root.path("polygons");
        double midRouteLat = baseLat + 8 * 0.00008;

        assertThat(containsNearbyMaskCellInPolygons(polygons, midRouteLat, baseLng, 12.0)).isTrue();
        assertThat(containsNearbyMaskCellInPolygons(polygons, midRouteLat, baseLng + eastTwoHundredSixtyMeters, 12.0)).isTrue();
        assertThat(containsNearbyMaskCellInPolygons(polygons, baseLat + 0.010 + 8 * 0.00008, baseLng, 12.0)).isTrue();
        assertThat(containsNearbyMaskCellInPolygons(polygons, midRouteLat, baseLng + eastTwoHundredTwentyMeters, 10.0)).isFalse();
    }

    @Test
    void polygonsEndpointIncludesRivalLandMasksWithoutRivalRouteTraces() throws Exception {
        Runner active = createRunner("territory-active-only@test.local");
        Runner rival = createRunner("territory-rival-excluded@test.local");
        rival.setDisplayName("Concrete Rival");
        runnerRepository.save(rival);
        Activity activeActivity = createActivity(active);
        Activity rivalActivity = createActivity(rival);
        activeActivity.setStartTime(LocalDateTime.now().minusHours(2));
        rivalActivity.setStartTime(LocalDateTime.now().minusHours(1));
        activityRepository.save(activeActivity);
        activityRepository.save(rivalActivity);

        seedCompactOutAndBackRoute(activeActivity, 37.822, -122.250);
        seedCompactOutAndBackRoute(rivalActivity, 37.824, -122.250);
        territoryService.computePolygonsForActivity(activeActivity.getId());
        territoryService.computePolygonsForActivity(rivalActivity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Concrete Rival')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Concrete Rival')].active").value(hasItem(false)))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Concrete Rival')].shapeType").value(hasItem("land-mask")))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Concrete Rival')].routeTraces").value(hasItem(empty())))
                .andExpect(jsonPath("$.polygons[?(@.activityId == " + activeActivity.getId() + ")].ownerName").value(hasItem("You")))
                .andExpect(jsonPath("$.polygons[?(@.activityId == " + activeActivity.getId() + ")].active").value(hasItem(true)))
                .andExpect(jsonPath("$.polygons[?(@.activityId == " + activeActivity.getId() + ")].routeTraces[0].points").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.activityId == " + activeActivity.getId() + ")].cells").isNotEmpty());

        List<TerritoryPolygon> activeRows = territoryPolygonRepository.findAll().stream()
                .filter(p -> active.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(activeRows).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(activeRows.get(0).getActivityId())
                .isEqualTo(activeActivity.getId());
        org.assertj.core.api.Assertions.assertThat(activeRows.get(0).getActivityId())
                .isNotEqualTo(rivalActivity.getId());
    }

    @Test
    void polygonsEndpointIncludesEveryRegisteredRunnerLandMaskOnWorldMap() throws Exception {
        Runner active = createRunner("territory-world-active@test.local");
        Runner nearbyRival = createRunner("territory-world-nearby@test.local");
        nearbyRival.setDisplayName("Nearby Concrete Rival");
        runnerRepository.save(nearbyRival);
        Runner distantRival = createRunner("territory-world-distant@test.local");
        distantRival.setDisplayName("Distant Concrete Rival");
        runnerRepository.save(distantRival);

        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(LocalDateTime.now().minusHours(3));
        Activity nearbyActivity = createActivity(nearbyRival);
        nearbyActivity.setStartTime(LocalDateTime.now().minusHours(2));
        Activity distantActivity = createActivity(distantRival);
        distantActivity.setStartTime(LocalDateTime.now().minusHours(1));
        activityRepository.save(activeActivity);
        activityRepository.save(nearbyActivity);
        activityRepository.save(distantActivity);

        seedCompactOutAndBackRoute(activeActivity, 37.822, -122.250);
        seedCompactOutAndBackRoute(nearbyActivity, 37.824, -122.250);
        seedCompactOutAndBackRoute(distantActivity, 40.7128, -74.0060);
        territoryService.computePolygonsForActivity(activeActivity.getId());
        territoryService.computePolygonsForActivity(nearbyActivity.getId());
        territoryService.computePolygonsForActivity(distantActivity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Distant Concrete Rival')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Distant Concrete Rival')].active").value(hasItem(false)))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Nearby Concrete Rival')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Nearby Concrete Rival')].active").value(hasItem(false)))
                .andExpect(jsonPath("$.polygons[?(@.active == true)].ownerName").value(hasItem("You")));
    }

    @Test
    void polygonsEndpointBackfillsRealRivalGpsRunsForGlobalTerritory() throws Exception {
        Runner active = createRunner("territory-global-warm-active@test.local");
        Runner rival = createRunner("territory-global-warm-rival@test.local");
        rival.setDisplayName("Cold Real Rival");
        runnerRepository.save(rival);

        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(LocalDateTime.now().minusHours(2));
        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(LocalDateTime.now().minusHours(1));
        activityRepository.save(activeActivity);
        activityRepository.save(rivalActivity);

        seedCompactOutAndBackRoute(activeActivity, 37.822, -122.250);
        seedCompactOutAndBackRoute(rivalActivity, 37.824, -122.250);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Cold Real Rival')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Cold Real Rival')].active").value(hasItem(false)))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Cold Real Rival')].cells").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.activityId == " + activeActivity.getId() + ")].ownerName").value(hasItem("You")))
                .andExpect(jsonPath("$.backfillInProgress").value(false))
                .andExpect(jsonPath("$.pendingActivityCount").value(0));

        List<TerritoryPolygon> rivalRows = territoryPolygonRepository.findAll().stream()
                .filter(p -> rival.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rivalRows).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(rivalRows.get(0).getActivityId())
                .isEqualTo(rivalActivity.getId());
    }

    @Test
    void initialPolygonsEndpointKeepsRivalOwnersWhenActiveOwnerHasManyMasks() throws Exception {
        Runner active = createRunner("territory-initial-heavy-active@test.local");
        Runner nearbyRival = createRunner("territory-initial-nearby-rival@test.local");
        nearbyRival.setDisplayName("Initial Nearby Rival");
        runnerRepository.save(nearbyRival);
        Runner distantRival = createRunner("territory-initial-distant-rival@test.local");
        distantRival.setDisplayName("Initial Distant Rival");
        runnerRepository.save(distantRival);

        LocalDateTime baseTime = LocalDateTime.of(2026, 6, 10, 8, 0);
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        for (int index = 0; index < 110; index += 1) {
            Activity activity = createActivity(active);
            activity.setStartTime(baseTime.plusMinutes(index));
            activityRepository.save(activity);

            TerritoryPolygon activeMask = new TerritoryPolygon();
            activeMask.setUserId(active.getId());
            activeMask.setActivityId(activity.getId());
            activeMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                    List.of(new TerritoryPolygonComputer.MaskCell(37.822 + index * 0.0003, -122.250)),
                    cellMeters
            ));
            activeMask.setAreaSquareMeters(cellMeters * cellMeters);
            activeMask.setCreatedAt(activity.getStartTime().plusSeconds(30));
            territoryPolygonRepository.save(activeMask);
        }

        Activity nearbyActivity = createActivity(nearbyRival);
        nearbyActivity.setStartTime(baseTime.plusHours(3));
        activityRepository.save(nearbyActivity);
        TerritoryPolygon nearbyMask = new TerritoryPolygon();
        nearbyMask.setUserId(nearbyRival.getId());
        nearbyMask.setActivityId(nearbyActivity.getId());
        nearbyMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(37.824, -122.250)),
                cellMeters
        ));
        nearbyMask.setAreaSquareMeters(cellMeters * cellMeters);
        nearbyMask.setCreatedAt(nearbyActivity.getStartTime().plusSeconds(30));
        territoryPolygonRepository.save(nearbyMask);

        Activity distantActivity = createActivity(distantRival);
        distantActivity.setStartTime(baseTime.plusHours(4));
        activityRepository.save(distantActivity);
        TerritoryPolygon distantMask = new TerritoryPolygon();
        distantMask.setUserId(distantRival.getId());
        distantMask.setActivityId(distantActivity.getId());
        distantMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(40.7128, -74.0060)),
                cellMeters
        ));
        distantMask.setAreaSquareMeters(cellMeters * cellMeters);
        distantMask.setCreatedAt(distantActivity.getStartTime().plusSeconds(30));
        territoryPolygonRepository.save(distantMask);

        mockMvc.perform(get("/api/territory/polygons?initial=true")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.active == true)].ownerName").value(hasItem("You")))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Initial Nearby Rival')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Initial Distant Rival')]").isNotEmpty());
    }

    @Test
    void polygonsEndpointExcludesGeneratedWorldFixtureOwnersFromNormalGlobalMapButKeepsDirectFixtureOwnTerritory() throws Exception {
        Runner viewer = createRunner("real-world-viewer@test.local");
        List<LocalSharedRunnerBootstrapService.BootstrapConfig> configs =
                LocalSharedRunnerBootstrapService.BootstrapConfig.worldTerritoryDefaults("local-world-territory-password")
                        .stream()
                        .filter(config -> "US".equals(config.worldCountry().isoCode()))
                        .limit(2)
                        .toList();
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        LocalDateTime baseTime = LocalDateTime.of(2026, 6, 6, 0, 0);
        List<Runner> fixtureRunners = new ArrayList<>();

        for (LocalSharedRunnerBootstrapService.BootstrapConfig config : configs) {
            Runner runner = createTerritoryProfileRunner(config);
            fixtureRunners.add(runner);
            Activity activity = createActivity(runner);
            activity.setStartTime(baseTime.plusMinutes(config.worldGlobalIndex() * 7L));
            activityRepository.save(activity);

            List<TerritoryPolygonComputer.MaskCell> cells = worldSeedMaskCells(config);
            TerritoryPolygon polygon = new TerritoryPolygon();
            polygon.setUserId(runner.getId());
            polygon.setActivityId(activity.getId());
            polygon.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(cells, cellMeters));
            polygon.setAreaSquareMeters(cells.size() * cellMeters * cellMeters);
            polygon.setCreatedAt(activity.getStartTime().plusSeconds(30));
            territoryPolygonRepository.save(polygon);
        }

        mockMvc.perform(get("/api/territory/polygons")
                .header("Authorization", bearer(viewer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Alice United States Territory 001')]").isEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Bob United States Territory 002')]").isEmpty());

        MvcResult fixtureResult = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(fixtureRunners.get(0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.active == true)].ownerName").value(hasItem("You")))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Bob United States Territory 002')]").isEmpty())
                .andReturn();

        JsonNode fixtureRoot = objectMapper.readTree(fixtureResult.getResponse().getContentAsString());
        JsonNode fixtureActivePolygon = firstPolygonByActive(fixtureRoot, true);
        TerritoryPolygonComputer.MaskCell ownCell = worldUniqueCell(worldCountry("US"), 1);
        assertThat(fixtureActivePolygon).isNotNull();
        assertThat(containsNearbyMaskCell(fixtureActivePolygon.path("cells"), ownCell.latitude(), ownCell.longitude(), cellMeters)).isTrue();
    }

    @Test
    void polygonsEndpointRecolorsOverlappedConcreteLandToNewestRunner() throws Exception {
        Runner active = createRunner("territory-concrete-fill-active@test.local");
        Runner rival = createRunner("territory-concrete-fill-rival@test.local");
        rival.setDisplayName("Latest Concrete Rival");
        runnerRepository.save(rival);

        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(LocalDateTime.now().minusHours(2));
        activityRepository.save(activeActivity);
        seedCompactOutAndBackRoute(activeActivity, 37.822, -122.250);
        territoryService.computePolygonsForActivity(activeActivity.getId());

        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(LocalDateTime.now().minusMinutes(5));
        activityRepository.save(rivalActivity);
        seedCompactOutAndBackRoute(rivalActivity, 37.822, -122.250);
        territoryService.computePolygonsForActivity(rivalActivity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Latest Concrete Rival')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Latest Concrete Rival')].active").value(hasItem(false)))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Latest Concrete Rival')].color").value(hasItem("#5b9cf5")))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Latest Concrete Rival')].cells").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.activityId == " + activeActivity.getId() + ")]").isEmpty());
    }

    @Test
    void polygonsEndpointUsesActivityTimeNotPolygonCreationTimeForConquest() throws Exception {
        Runner active = createRunner("territory-activity-time-active@test.local");
        Runner rival = createRunner("territory-activity-time-rival@test.local");
        rival.setDisplayName("Late Computed Older Rival");
        runnerRepository.save(rival);

        LocalDateTime newerRunTime = LocalDateTime.of(2026, 6, 8, 15, 2, 19);
        LocalDateTime olderRunTime = newerRunTime.minusHours(4);
        double baseLat = 40.746000;
        double baseLng = -73.817000;
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        List<TerritoryPolygonComputer.MaskCell> overlapCells = List.of(
                new TerritoryPolygonComputer.MaskCell(baseLat, baseLng)
        );

        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(newerRunTime);
        activeActivity.setCreatedAt(newerRunTime.plusMinutes(3));
        activityRepository.save(activeActivity);

        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(olderRunTime);
        rivalActivity.setCreatedAt(olderRunTime.plusMinutes(3));
        activityRepository.save(rivalActivity);

        TerritoryPolygon activeMask = new TerritoryPolygon();
        activeMask.setUserId(active.getId());
        activeMask.setActivityId(activeActivity.getId());
        activeMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(overlapCells, cellMeters));
        activeMask.setAreaSquareMeters(cellMeters * cellMeters);
        activeMask.setCreatedAt(newerRunTime.plusMinutes(10));
        territoryPolygonRepository.save(activeMask);

        TerritoryPolygon rivalMask = new TerritoryPolygon();
        rivalMask.setUserId(rival.getId());
        rivalMask.setActivityId(rivalActivity.getId());
        rivalMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(overlapCells, cellMeters));
        rivalMask.setAreaSquareMeters(cellMeters * cellMeters);
        rivalMask.setCreatedAt(newerRunTime.plusHours(2));
        territoryPolygonRepository.save(rivalMask);

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode activePolygon = firstPolygonByActive(root, true);
        JsonNode rivalPolygon = firstPolygonByOwner(root, "Late Computed Older Rival");

        assertThat(activePolygon).isNotNull();
        assertThat(containsNearbyMaskCell(activePolygon.path("cells"), baseLat, baseLng, cellMeters)).isTrue();
        assertThat(rivalPolygon == null || !containsNearbyMaskCell(rivalPolygon.path("cells"), baseLat, baseLng, cellMeters)).isTrue();
    }

    @Test
    void polygonsEndpointLetsNewestMaskClaimOverlapEvenWhenOlderMaskIsDenser() throws Exception {
        Runner active = createRunner("territory-dense-mask-active@test.local");
        Runner rival = createRunner("territory-dense-mask-rival@test.local");
        rival.setDisplayName("Sparse Latest Rival");
        runnerRepository.save(rival);

        double baseLat = 37.822;
        double baseLng = -122.250;
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        for (int index = 0; index < 3; index += 1) {
            Activity activeActivity = createActivity(active);
            activeActivity.setStartTime(LocalDateTime.now().minusHours(6 - index));
            activityRepository.save(activeActivity);

            TerritoryPolygon activeMask = new TerritoryPolygon();
            activeMask.setUserId(active.getId());
            activeMask.setActivityId(activeActivity.getId());
            activeMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                    List.of(new TerritoryPolygonComputer.MaskCell(baseLat, baseLng)),
                    cellMeters
            ));
            activeMask.setAreaSquareMeters(cellMeters * cellMeters);
            activeMask.setCreatedAt(LocalDateTime.now().minusHours(6 - index));
            territoryPolygonRepository.save(activeMask);
        }

        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(LocalDateTime.now().minusMinutes(5));
        activityRepository.save(rivalActivity);

        TerritoryPolygon rivalMask = new TerritoryPolygon();
        rivalMask.setUserId(rival.getId());
        rivalMask.setActivityId(rivalActivity.getId());
        rivalMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(baseLat, baseLng)),
                cellMeters
        ));
        rivalMask.setAreaSquareMeters(cellMeters * cellMeters);
        rivalMask.setCreatedAt(LocalDateTime.now().minusMinutes(5));
        territoryPolygonRepository.save(rivalMask);

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Sparse Latest Rival')]").isNotEmpty())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode activePolygon = firstPolygonByActive(root, true);
        JsonNode rivalPolygon = firstPolygonByOwner(root, "Sparse Latest Rival");

        assertThat(activePolygon).isNull();
        assertThat(rivalPolygon).isNotNull();
        assertThat(containsNearbyMaskCell(rivalPolygon.path("cells"), baseLat, baseLng, cellMeters)).isTrue();
    }

    @Test
    void polygonsEndpointRefreshesCachedOwnershipWhenNewerRivalMaskAppears() throws Exception {
        Runner active = createRunner("territory-cache-fill-active@test.local");
        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(LocalDateTime.now().minusHours(2));
        activityRepository.save(activeActivity);
        seedCompactOutAndBackRoute(activeActivity, 37.822, -122.250);
        territoryService.computePolygonsForActivity(activeActivity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.active == true)].ownerName").value(hasItem("You")));

        Runner rival = createRunner("territory-cache-fill-rival@test.local");
        rival.setDisplayName("Cache Fill Rival");
        runnerRepository.save(rival);
        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(LocalDateTime.now().minusMinutes(5));
        activityRepository.save(rivalActivity);
        seedCompactOutAndBackRoute(rivalActivity, 37.822, -122.250);

        territoryService.computePolygonsForActivity(rivalActivity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.active == true)]").isEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Cache Fill Rival')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Cache Fill Rival')].active").value(hasItem(false)))
                .andExpect(jsonPath("$.polygons[?(@.activityId == " + activeActivity.getId() + ")]").isEmpty());
    }

    @Test
    void polygonsEndpointDoesNotLetOlderLoopRefillNewerConsumedInteriorCell() throws Exception {
        Runner active = createRunner("territory-loop-consume-active@test.local");
        Runner rival = createRunner("territory-loop-consume-rival@test.local");
        rival.setDisplayName("Loop Consumer");
        runnerRepository.save(rival);

        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(LocalDateTime.now().minusHours(2));
        activityRepository.save(activeActivity);

        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(LocalDateTime.now().minusMinutes(5));
        activityRepository.save(rivalActivity);

        double baseLat = 37.822;
        double baseLng = -122.250;
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        double latStep = cellMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double lngStep = latStep / Math.cos(Math.toRadians(baseLat));

        List<TerritoryPolygonComputer.MaskCell> olderLoopRing = new ArrayList<>();
        for (int y = -2; y <= 2; y += 1) {
            for (int x = -2; x <= 2; x += 1) {
                if (Math.abs(x) != 2 && Math.abs(y) != 2) {
                    continue;
                }
                olderLoopRing.add(new TerritoryPolygonComputer.MaskCell(baseLat + y * latStep, baseLng + x * lngStep));
            }
        }

        TerritoryPolygon activeLoop = new TerritoryPolygon();
        activeLoop.setUserId(active.getId());
        activeLoop.setActivityId(activeActivity.getId());
        activeLoop.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(olderLoopRing, cellMeters));
        activeLoop.setAreaSquareMeters(olderLoopRing.size() * cellMeters * cellMeters);
        territoryPolygonRepository.save(activeLoop);

        TerritoryPolygon rivalCenterCapture = new TerritoryPolygon();
        rivalCenterCapture.setUserId(rival.getId());
        rivalCenterCapture.setActivityId(rivalActivity.getId());
        rivalCenterCapture.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(baseLat, baseLng)),
                cellMeters
        ));
        rivalCenterCapture.setAreaSquareMeters(cellMeters * cellMeters);
        territoryPolygonRepository.save(rivalCenterCapture);

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Loop Consumer')]").isNotEmpty())
                .andExpect(jsonPath("$.polygons[?(@.active == true)]").isNotEmpty())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode activePolygon = firstPolygonByActive(root, true);
        JsonNode rivalPolygon = firstPolygonByOwner(root, "Loop Consumer");

        assertThat(activePolygon).isNotNull();
        assertThat(rivalPolygon).isNotNull();
        assertThat(activePolygon.path("cells")).hasSize(16);
        assertThat(rivalPolygon.path("cells")).hasSize(1);
        assertThat(containsNearbyMaskCell(activePolygon.path("cells"), baseLat, baseLng, cellMeters)).isFalse();
        assertThat(containsNearbyMaskCell(rivalPolygon.path("cells"), baseLat, baseLng, cellMeters)).isTrue();
    }

    @Test
    void polygonsEndpointUsesSourceCellFootprintWhenResolvingDifferentMaskResolutions() throws Exception {
        Runner active = createRunner("territory-coarse-mask-active@test.local");
        Runner rival = createRunner("territory-fine-mask-rival@test.local");
        rival.setDisplayName("Fine Older Rival");
        runnerRepository.save(rival);

        double baseLat = 40.746000;
        double baseLng = -73.817000;
        double coarseCellMeters = 40.0;
        double fineCellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        double fineLatStep = (fineCellMeters * 2.0) / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        double farLatStep = (fineCellMeters * 12.0) / TerritoryPolygonComputer.METERS_PER_DEG_LAT;

        Activity activeActivity = createActivity(active);
        activeActivity.setStartTime(LocalDateTime.now().minusMinutes(5));
        activityRepository.save(activeActivity);

        Activity rivalActivity = createActivity(rival);
        rivalActivity.setStartTime(LocalDateTime.now().minusDays(2));
        activityRepository.save(rivalActivity);

        TerritoryPolygon activeMask = new TerritoryPolygon();
        activeMask.setUserId(active.getId());
        activeMask.setActivityId(activeActivity.getId());
        activeMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(baseLat, baseLng)),
                coarseCellMeters
        ));
        activeMask.setAreaSquareMeters(coarseCellMeters * coarseCellMeters);
        territoryPolygonRepository.save(activeMask);

        TerritoryPolygon rivalMask = new TerritoryPolygon();
        rivalMask.setUserId(rival.getId());
        rivalMask.setActivityId(rivalActivity.getId());
        rivalMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(
                        new TerritoryPolygonComputer.MaskCell(baseLat + fineLatStep, baseLng),
                        new TerritoryPolygonComputer.MaskCell(baseLat + farLatStep, baseLng)
                ),
                fineCellMeters
        ));
        rivalMask.setAreaSquareMeters(2 * fineCellMeters * fineCellMeters);
        territoryPolygonRepository.save(rivalMask);

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode activePolygon = firstPolygonByActive(root, true);
        JsonNode rivalPolygon = firstPolygonByOwner(root, "Fine Older Rival");

        assertThat(activePolygon).isNotNull();
        assertThat(rivalPolygon).isNotNull();
        assertThat(containsNearbyMaskCell(activePolygon.path("cells"), baseLat + fineLatStep, baseLng, fineCellMeters)).isTrue();
        assertThat(containsNearbyMaskCell(rivalPolygon.path("cells"), baseLat + fineLatStep, baseLng, fineCellMeters)).isFalse();
        assertThat(containsNearbyMaskCell(rivalPolygon.path("cells"), baseLat + farLatStep, baseLng, fineCellMeters)).isTrue();
    }

    @Test
    void polygonsEndpointHidesLocalFixtureRivalsFromNormalSharedRunnerGlobal() throws Exception {
        Runner shared = runnerRepository.findByEmailIgnoreCase(LocalSharedRunnerBootstrapService.DEFAULT_EMAIL)
                .orElseGet(() -> createRunner(LocalSharedRunnerBootstrapService.DEFAULT_EMAIL));
        Runner conqueror = runnerRepository.findByEmailIgnoreCase(LocalSharedRunnerBootstrapService.FLUSHING_CONQUEROR_EMAIL)
                .orElseGet(() -> createRunner(LocalSharedRunnerBootstrapService.FLUSHING_CONQUEROR_EMAIL));
        conqueror.setDisplayName("Hermes Flushing Conqueror");
        runnerRepository.save(conqueror);

        Activity sharedActivity = createActivity(shared);
        sharedActivity.setStartTime(LocalDateTime.now().minusMinutes(5));
        activityRepository.save(sharedActivity);

        Activity conquerorActivity = createActivity(conqueror);
        conquerorActivity.setStartTime(LocalDateTime.now().minusDays(2));
        activityRepository.save(conquerorActivity);

        double baseLat = 40.746000;
        double baseLng = -73.817000;
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        double latStep = cellMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;

        TerritoryPolygon sharedMask = new TerritoryPolygon();
        sharedMask.setUserId(shared.getId());
        sharedMask.setActivityId(sharedActivity.getId());
        sharedMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(
                        new TerritoryPolygonComputer.MaskCell(baseLat, baseLng),
                        new TerritoryPolygonComputer.MaskCell(baseLat + (latStep * 3), baseLng)
                ),
                cellMeters
        ));
        sharedMask.setAreaSquareMeters(2 * cellMeters * cellMeters);
        territoryPolygonRepository.save(sharedMask);

        TerritoryPolygon conquerorMask = new TerritoryPolygon();
        conquerorMask.setUserId(conqueror.getId());
        conquerorMask.setActivityId(conquerorActivity.getId());
        conquerorMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(
                        new TerritoryPolygonComputer.MaskCell(baseLat, baseLng),
                        new TerritoryPolygonComputer.MaskCell(baseLat + (latStep * 8), baseLng)
                ),
                cellMeters
        ));
        conquerorMask.setAreaSquareMeters(2 * cellMeters * cellMeters);
        territoryPolygonRepository.save(conquerorMask);

        MvcResult result = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(shared)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Hermes Flushing Conqueror')]").isEmpty())
                .andExpect(jsonPath("$.polygons[?(@.active == true)].ownerName").value(hasItem("You")))
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode activePolygon = firstPolygonByActive(root, true);
        JsonNode conquerorPolygon = firstPolygonByOwner(root, "Hermes Flushing Conqueror");

        assertThat(activePolygon).isNotNull();
        assertThat(conquerorPolygon).isNull();
        assertThat(containsNearbyMaskCell(activePolygon.path("cells"), baseLat, baseLng, cellMeters / 2.0)).isTrue();
        assertThat(containsNearbyMaskCell(activePolygon.path("cells"), baseLat + (latStep * 3), baseLng, cellMeters / 2.0)).isTrue();

        MvcResult fixtureResult = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(conqueror)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.active == true)].ownerName").value(hasItem("You")))
                .andReturn();
        JsonNode fixtureRoot = objectMapper.readTree(fixtureResult.getResponse().getContentAsString());
        JsonNode fixtureActivePolygon = firstPolygonByActive(fixtureRoot, true);
        assertThat(fixtureActivePolygon).isNotNull();
        assertThat(containsNearbyMaskCell(fixtureActivePolygon.path("cells"), baseLat + (latStep * 8), baseLng, cellMeters / 2.0)).isTrue();
    }

    @Test
    void polygonsEndpointInvalidatesCachedResponseWhenLandMaskRowsChange() throws Exception {
        Runner runner = createRunner("territory-cache-repeat@test.local");
        Activity activity = createActivity(runner);
        seedCompactOutAndBackRoute(activity, 37.822, -122.250);
        territoryService.computePolygonsForActivity(activity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons[0].activityId").value(activity.getId()))
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"));

        List<TerritoryPolygon> rows = territoryPolygonRepository.findAll().stream()
                .filter(p -> runner.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rows).hasSize(1);

        territoryPolygonRepository.deleteAll(rows);
        territoryPolygonRepository.flush();

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons[0].activityId").value(activity.getId()))
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cells").isNotEmpty())
                .andExpect(jsonPath("$.backfillInProgress").value(false))
                .andExpect(jsonPath("$.pendingActivityCount").value(0));

        List<TerritoryPolygon> rowsAfterSecondLoad = territoryPolygonRepository.findAll().stream()
                .filter(p -> runner.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rowsAfterSecondLoad).hasSize(1);
    }

    @Test
    void polygonsEndpointReturnsNotModifiedWhenClientCacheSignatureMatches() throws Exception {
        Runner runner = createRunner("territory-cache-conditional@test.local");
        Activity activity = createActivity(runner);
        seedCompactOutAndBackRoute(activity, 37.822, -122.250);
        territoryService.computePolygonsForActivity(activity.getId());

        MvcResult firstLoad = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andReturn();
        String etag = firstLoad.getResponse().getHeader("ETag");
        assertThat(etag).isNotBlank();

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner))
                        .header("If-None-Match", etag))
                .andExpect(status().isNotModified())
                .andExpect(header().string("ETag", etag))
                .andExpect(content().string(""));

        Activity newActivity = createActivity(runner);
        seedCompactOutAndBackRoute(newActivity, 37.828, -122.256);
        territoryService.computePolygonsForActivity(newActivity.getId());

        MvcResult changedLoad = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner))
                        .header("If-None-Match", etag))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(changedLoad.getResponse().getHeader("ETag")).isNotEqualTo(etag);
    }

    @Test
    void polygonsEndpointDoesNotCacheCellsFalseAsCanonicalPayload() throws Exception {
        Runner runner = createRunner("territory-cache-cells-false@test.local");
        Activity activity = createActivity(runner);
        seedCompactOutAndBackRoute(activity, 37.822, -122.250);
        territoryService.computePolygonsForActivity(activity.getId());

        mockMvc.perform(get("/api/territory/polygons?cells=false")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons[0].cells").isEmpty())
                .andExpect(jsonPath("$.polygons[0].routeTraces").isEmpty());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons[0].cells").isNotEmpty())
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].points").isNotEmpty());
    }

    @Test
    void polygonsEndpointInvalidatesClientCacheWhenSameLandMaskRowPayloadChanges() throws Exception {
        Runner runner = createRunner("territory-cache-payload-change@test.local");
        Activity activity = createActivity(runner);
        double baseLat = 37.822;
        double baseLng = -122.250;
        double cellMeters = TerritoryPolygonComputer.LAND_MASK_CELL_METERS;
        double latStep = cellMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;

        TerritoryPolygon mask = new TerritoryPolygon();
        mask.setUserId(runner.getId());
        mask.setActivityId(activity.getId());
        mask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(new TerritoryPolygonComputer.MaskCell(baseLat, baseLng)),
                cellMeters
        ));
        mask.setAreaSquareMeters(cellMeters * cellMeters);
        TerritoryPolygon savedMask = territoryPolygonRepository.saveAndFlush(mask);

        MvcResult firstLoad = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[0].cells.length()").value(1))
                .andReturn();
        String staleEtag = firstLoad.getResponse().getHeader("ETag");
        assertThat(staleEtag).isNotBlank();

        savedMask.setCoordinates(TerritoryPolygonComputer.encodeMaskCells(
                List.of(
                        new TerritoryPolygonComputer.MaskCell(baseLat, baseLng),
                        new TerritoryPolygonComputer.MaskCell(baseLat + latStep, baseLng)
                ),
                cellMeters
        ));
        savedMask.setAreaSquareMeters(2 * cellMeters * cellMeters);
        territoryPolygonRepository.saveAndFlush(savedMask);

        MvcResult changedLoad = mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner))
                        .header("If-None-Match", staleEtag))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[0].cells.length()").value(2))
                .andReturn();
        assertThat(changedLoad.getResponse().getHeader("ETag")).isNotEqualTo(staleEtag);
    }

    @Test
    void polygonsEndpointSynchronouslyBackfillsBoundedColdHistoricalRuns() throws Exception {
        Runner runner = createRunner("territory-cold-load@test.local");
        int totalRuns = 9;
        int synchronousWarmupLimit = 4;

        for (int i = 0; i < totalRuns; i++) {
            Activity activity = createActivity(runner);
            activity.setStartTime(LocalDateTime.now().minusDays(i));
            activityRepository.save(activity);
            seedCompactOutAndBackRoute(activity, 37.900 + i * 0.00003, -122.250);
        }

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons").isNotEmpty())
                .andExpect(jsonPath("$.backfillInProgress").value(true))
                .andExpect(jsonPath("$.pendingActivityCount").value(totalRuns - synchronousWarmupLimit));

        List<TerritoryPolygon> rows = territoryPolygonRepository.findAll().stream()
                .filter(p -> runner.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rows).hasSize(synchronousWarmupLimit);
    }

    @Test
    void polygonsEndpointSynchronouslyBackfillsLocalSharedRunnerOwnTerritory() throws Exception {
        Runner runner = runnerRepository.findByEmailIgnoreCase(LocalSharedRunnerBootstrapService.DEFAULT_EMAIL)
                .orElseGet(() -> createRunner(LocalSharedRunnerBootstrapService.DEFAULT_EMAIL));
        Activity activity = createActivity(runner);
        seedCompactOutAndBackRoute(activity, 40.73875, -73.82375);

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons[0].ownerName").value("You"))
                .andExpect(jsonPath("$.polygons[0].active").value(true))
                .andExpect(jsonPath("$.polygons[0].cells").isArray())
                .andExpect(jsonPath("$.polygons[0].cells").isNotEmpty())
                .andExpect(jsonPath("$.backfillInProgress").value(false))
                .andExpect(jsonPath("$.pendingActivityCount").value(0));

        List<TerritoryPolygon> rows = territoryPolygonRepository.findAll().stream()
                .filter(p -> runner.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rows).hasSize(1);
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
    // computePolygonsForActivity produces a route-footprint territory for an out-and-back
    // -----------------------------------------------------------------------
    @Test
    void computePolygonsForActivityCreatesRouteFootprintForOutAndBack() {
        Runner runner = createRunner("territory-oab@test.local");
        Activity activity = createActivity(runner);

        seedOutAndBackRoute(activity, 37.822, -122.25);

        territoryService.computePolygonsForActivity(activity.getId());

        List<TerritoryPolygon> polygons = territoryPolygonRepository.findAll().stream()
                .filter(p -> p.getActivityId().equals(activity.getId()))
                .toList();

        org.assertj.core.api.Assertions.assertThat(polygons).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(polygons.get(0).getAreaSquareMeters())
                .isGreaterThan(TerritoryPolygonComputer.MIN_AREA_SQ_METERS);
        org.assertj.core.api.Assertions.assertThat(TerritoryPolygonComputer.decodeMaskCells(polygons.get(0).getCoordinates()).cells())
                .hasSizeGreaterThan(8);
        org.assertj.core.api.Assertions.assertThat(TerritoryPolygonComputer.decodeCoordinates(polygons.get(0).getCoordinates()))
                .isEmpty();
    }

    @Test
    void computePolygonsForActivityReplacesExistingLandMaskForSameActivity() {
        Runner runner = createRunner("territory-idempotent@test.local");
        Activity activity = createActivity(runner);

        seedOutAndBackRoute(activity, 37.822, -122.25);

        territoryService.computePolygonsForActivity(activity.getId());
        territoryService.computePolygonsForActivity(activity.getId());

        List<TerritoryPolygon> polygons = territoryPolygonRepository.findAll().stream()
                .filter(p -> p.getActivityId().equals(activity.getId()))
                .toList();

        org.assertj.core.api.Assertions.assertThat(polygons).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(TerritoryPolygonComputer.decodeMaskCells(polygons.get(0).getCoordinates()).cells())
                .isNotEmpty();
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

    private Runner createTerritoryProfileRunner(LocalSharedRunnerBootstrapService.BootstrapConfig config) {
        Runner runner = new Runner();
        runner.setEmail(config.email());
        runner.setDisplayName(config.displayName());
        runner.setStravaAthleteId(config.stravaAthleteId());
        runner.setStravaUsername(config.email().split("@")[0]);
        runner.setStatus("ACTIVE_STRAVA");
        runner.setRole("USER");
        runner.setEmailVerified(true);
        runner.setDeleted(false);
        runner.setCreatedAt(LocalDateTime.now());
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
        double widthMeters = 320.0;
        double heightMeters = 220.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addRouteSegment(route, baseLat, baseLng, baseLat, baseLng + widthLng, 28);
        addRouteSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 20);
        addRouteSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 28);
        addRouteSegment(route, baseLat + heightLat, baseLng, baseLat, baseLng, 20);
        seedRoute(activity, route);
    }

    private void seedSparseGeneratedClosedOutline(Activity activity, double baseLat, double baseLng) {
        double widthMeters = 360.0;
        double heightMeters = 260.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addRouteSegment(route, baseLat, baseLng, baseLat, baseLng + widthLng, 8);
        addRouteSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 8);
        addRouteSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 8);
        addRouteSegment(route, baseLat + heightLat, baseLng, baseLat, baseLng, 8);
        assertThat(route).hasSizeLessThan(48);
        seedRoute(activity, route);
    }

    private void seedCompactOutAndBackRoute(Activity activity, double baseLat, double baseLng) {
        double widthMeters = 180.0;
        double heightMeters = 140.0;
        double cosLat = Math.cos(Math.toRadians(baseLat));
        double widthLng = widthMeters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
        double heightLat = heightMeters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
        List<double[]> route = new ArrayList<>();
        addRouteSegment(route, baseLat, baseLng, baseLat, baseLng + widthLng, 16);
        addRouteSegment(route, baseLat, baseLng + widthLng, baseLat + heightLat, baseLng + widthLng, 12);
        addRouteSegment(route, baseLat + heightLat, baseLng + widthLng, baseLat + heightLat, baseLng, 16);
        addRouteSegment(route, baseLat + heightLat, baseLng, baseLat, baseLng, 12);
        seedRoute(activity, route);
    }

    private void seedRoute(Activity activity, List<double[]> route) {
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i < route.size(); i += 1) {
            double[] coordinate = route.get(i);
            ActivityPoint point = new ActivityPoint();
            point.setActivity(activity);
            point.setSequenceIndex(i);
            point.setLatitude(coordinate[0]);
            point.setLongitude(coordinate[1]);
            point.setElapsedSeconds(i * 5);
            points.add(point);
        }
        activityPointRepository.saveAll(points);
    }

    private static void addRouteSegment(List<double[]> points,
                                        double startLat,
                                        double startLng,
                                        double endLat,
                                        double endLng,
                                        int steps) {
        for (int i = 0; i <= steps; i += 1) {
            if (!points.isEmpty() && i == 0) {
                continue;
            }
            double pct = i / (double) steps;
            points.add(new double[]{
                    startLat + (endLat - startLat) * pct,
                    startLng + (endLng - startLng) * pct
            });
        }
    }

    private void seedTerritorySamples(Activity activity, double baseLat, double baseLng, int count) {
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            ActivityPoint pt = new ActivityPoint();
            pt.setActivity(activity);
            pt.setSequenceIndex(i);
            pt.setLatitude(baseLat + i * 0.00001);
            pt.setLongitude(baseLng + i * 0.00001);
            pt.setElapsedSeconds(i * 5);
            points.add(pt);
        }
        activityPointRepository.saveAll(points);
    }

    private static List<TerritoryPolygonComputer.MaskCell> worldSeedMaskCells(
            LocalSharedRunnerBootstrapService.BootstrapConfig config
    ) {
        List<TerritoryPolygonComputer.MaskCell> cells = new ArrayList<>();
        LocalSharedRunnerBootstrapService.WorldTerritoryCountry country = config.worldCountry();
        int accountIndex = config.worldAccountIndex();
        cells.add(worldUniqueCell(country, accountIndex));
        if (accountIndex > 1) {
            cells.add(worldContestedCell(country, accountIndex - 1));
        }
        if (accountIndex < LocalSharedRunnerBootstrapService.WORLD_TERRITORY_ACCOUNTS_PER_COUNTRY) {
            cells.add(worldContestedCell(country, accountIndex));
        }
        return cells;
    }

    private static TerritoryPolygonComputer.MaskCell worldUniqueCell(
            LocalSharedRunnerBootstrapService.WorldTerritoryCountry country,
            int accountIndex
    ) {
        double[] center = worldGridCenter(country, accountIndex);
        return new TerritoryPolygonComputer.MaskCell(center[0], center[1]);
    }

    private static TerritoryPolygonComputer.MaskCell worldContestedCell(
            LocalSharedRunnerBootstrapService.WorldTerritoryCountry country,
            int lowerAccountIndex
    ) {
        double[] first = worldGridCenter(country, lowerAccountIndex);
        double[] second = worldGridCenter(country, lowerAccountIndex + 1);
        return new TerritoryPolygonComputer.MaskCell(
                round6((first[0] + second[0]) / 2.0),
                round6((first[1] + second[1]) / 2.0)
        );
    }

    private static double[] worldGridCenter(
            LocalSharedRunnerBootstrapService.WorldTerritoryCountry country,
            int accountIndex
    ) {
        int zeroIndex = Math.max(0, accountIndex - 1);
        int row = zeroIndex / 10;
        int col = zeroIndex % 10;
        double latitude = country.anchorLatitude() + metersToLatitudeDegrees((row - 4.5) * 760.0);
        double longitude = country.anchorLongitude() + metersToLongitudeDegrees((col - 4.5) * 760.0, latitude);
        return new double[]{round6(latitude), round6(longitude)};
    }

    private static LocalSharedRunnerBootstrapService.WorldTerritoryCountry worldCountry(String isoCode) {
        return LocalSharedRunnerBootstrapService.WORLD_TERRITORY_COUNTRIES.stream()
                .filter(country -> country.isoCode().equalsIgnoreCase(isoCode))
                .findFirst()
                .orElseThrow();
    }

    private static String worldOwnerName(String countryName, int accountIndex) {
        List<String> fakeNames = List.of(
                "Alice",
                "Bob",
                "Chloe",
                "Daniel",
                "Emma",
                "Felix",
                "Grace",
                "Hugo",
                "Ivy",
                "Jack",
                "Kira",
                "Leo",
                "Maya",
                "Noah",
                "Olivia",
                "Pavel",
                "Quinn",
                "Rina",
                "Sofia",
                "Theo"
        );
        int normalizedIndex = Math.max(1, accountIndex);
        return fakeNames.get((normalizedIndex - 1) % fakeNames.size())
                + " "
                + countryName
                + " Territory "
                + String.format("%03d", normalizedIndex);
    }

    private static double metersToLatitudeDegrees(double meters) {
        return meters / TerritoryPolygonComputer.METERS_PER_DEG_LAT;
    }

    private static double metersToLongitudeDegrees(double meters, double latitude) {
        double cosLat = Math.cos(Math.toRadians(latitude));
        if (Math.abs(cosLat) < 1e-6) {
            return 0.0;
        }
        return meters / (TerritoryPolygonComputer.METERS_PER_DEG_LAT * cosLat);
    }

    private static double round6(double value) {
        return Math.round(value * 1_000_000.0) / 1_000_000.0;
    }

    private String bearer(Runner runner) {
        return "Bearer " + authService.issueSessionToken(runner);
    }

    private static JsonNode firstPolygonByActive(JsonNode root, boolean active) {
        for (JsonNode polygon : root.path("polygons")) {
            if (polygon.path("active").asBoolean(false) == active) {
                return polygon;
            }
        }
        return null;
    }

    private static JsonNode firstPolygonByOwner(JsonNode root, String ownerName) {
        for (JsonNode polygon : root.path("polygons")) {
            if (ownerName.equals(polygon.path("ownerName").asText())) {
                return polygon;
            }
        }
        return null;
    }

    private static boolean containsExactMaskCell(JsonNode cells, double latitude, double longitude) {
        for (JsonNode cell : cells) {
            double cellLat = cell.path("latitude").asDouble(Double.NaN);
            double cellLng = cell.path("longitude").asDouble(Double.NaN);
            if (Double.isFinite(cellLat)
                    && Double.isFinite(cellLng)
                    && Math.abs(cellLat - latitude) <= 0.000001
                    && Math.abs(cellLng - longitude) <= 0.000001) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsNearbyMaskCellInPolygons(JsonNode polygons, double latitude, double longitude, double maxDistanceMeters) {
        for (JsonNode polygon : polygons) {
            if (containsNearbyMaskCell(polygon.path("cells"), latitude, longitude, maxDistanceMeters)) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsNearbyMaskCell(JsonNode cells, double latitude, double longitude, double maxDistanceMeters) {
        for (JsonNode cell : cells) {
            double cellLat = cell.path("latitude").asDouble(Double.NaN);
            double cellLng = cell.path("longitude").asDouble(Double.NaN);
            if (Double.isFinite(cellLat)
                    && Double.isFinite(cellLng)
                    && TerritoryPolygonComputer.distanceMeters(cellLat, cellLng, latitude, longitude) <= maxDistanceMeters) {
                return true;
            }
        }
        return false;
    }
}
