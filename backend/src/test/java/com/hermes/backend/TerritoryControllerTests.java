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
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
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
    void territoryEndpointUsesNewestCoverageAsCellOwnerEvenWithFewerSamples() throws Exception {
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
                .andExpect(jsonPath("$.polygons").isEmpty())
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.backfillInProgress").value(true))
                .andExpect(jsonPath("$.pendingActivityCount").value(1));

        List<TerritoryPolygon> rows = territoryPolygonRepository.findAll().stream()
                .filter(p -> p.getActivityId().equals(activity.getId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rows).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(TerritoryPolygonComputer.decodeMaskCells(rows.get(0).getCoordinates()).cells())
                .isEmpty();
    }

    @Test
    void polygonsEndpointBackfillsRouteFootprintsForExistingRuns() throws Exception {
        Runner runner = createRunner("territory-backfill@test.local");
        Activity activity = createActivity(runner);
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
                .andExpect(jsonPath("$.polygons[0].routeTraces").isArray())
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].activityId").value(activity.getId()))
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].routeRadiusMeters").isNumber())
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].points[0].latitude").isNumber())
                .andExpect(jsonPath("$.polygons[0].routeTraces[0].points[0].longitude").isNumber());
    }

    @Test
    void polygonsEndpointReturnsOneConcreteUnionMaskInsteadOfPerRunBlocks() throws Exception {
        Runner runner = createRunner("territory-union-mask@test.local");
        Activity firstActivity = createActivity(runner);
        Activity secondActivity = createActivity(runner);

        seedCompactOutAndBackRoute(firstActivity, 37.822, -122.250);
        seedCompactOutAndBackRoute(secondActivity, 37.82204, -122.25002);
        territoryService.computePolygonsForActivity(firstActivity.getId());
        territoryService.computePolygonsForActivity(secondActivity.getId());

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons.length()").value(1))
                .andExpect(jsonPath("$.polygons[0].activityId").doesNotExist())
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cells").isArray());
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
    void polygonsEndpointFillsInteriorVoidsInUnionMask() throws Exception {
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
                .andExpect(jsonPath("$.polygons[0].cells.length()").value(25));
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

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygonCount").value(1))
                .andExpect(jsonPath("$.polygons").isArray())
                .andExpect(jsonPath("$.polygons[0].shapeType").value("land-mask"))
                .andExpect(jsonPath("$.polygons[0].cells[0].latitude").isNumber());

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
    void polygonsEndpointRefreshesCachedOwnershipWhenNewerRivalMaskAppears() throws Exception {
        Runner active = createRunner("territory-cache-fill-active@test.local");
        Runner rival = createRunner("territory-cache-fill-rival@test.local");
        rival.setDisplayName("Cache Fill Rival");
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

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(active)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons[?(@.active == true)].ownerName").value(hasItem("You")))
                .andExpect(jsonPath("$.polygons[?(@.ownerName == 'Cache Fill Rival')]").isEmpty());

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
        assertThat(activePolygon.path("cells")).hasSize(24);
        assertThat(rivalPolygon.path("cells")).hasSize(1);
        assertThat(containsExactMaskCell(activePolygon.path("cells"), baseLat, baseLng)).isFalse();
        assertThat(containsExactMaskCell(rivalPolygon.path("cells"), baseLat, baseLng)).isTrue();
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
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.polygons").isEmpty())
                .andExpect(jsonPath("$.backfillInProgress").value(true))
                .andExpect(jsonPath("$.pendingActivityCount").value(1));

        List<TerritoryPolygon> rowsAfterSecondLoad = territoryPolygonRepository.findAll().stream()
                .filter(p -> runner.getId().equals(p.getUserId()))
                .toList();
        org.assertj.core.api.Assertions.assertThat(rowsAfterSecondLoad).isEmpty();
    }

    @Test
    void polygonsEndpointDoesNotSynchronouslyBackfillColdHistoricalRuns() throws Exception {
        Runner runner = createRunner("territory-cold-load@test.local");
        int totalRuns = 9;

        for (int i = 0; i < totalRuns; i++) {
            Activity activity = createActivity(runner);
            activity.setStartTime(LocalDateTime.now().minusDays(i));
            activityRepository.save(activity);
            seedCompactOutAndBackRoute(activity, 37.900 + i * 0.00003, -122.250);
        }

        mockMvc.perform(get("/api/territory/polygons")
                        .header("Authorization", bearer(runner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.polygons").isEmpty())
                .andExpect(jsonPath("$.polygonCount").value(0))
                .andExpect(jsonPath("$.backfillInProgress").value(true))
                .andExpect(jsonPath("$.pendingActivityCount").value(totalRuns));
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

    private void seedCompactOutAndBackRoute(Activity activity, double baseLat, double baseLng) {
        List<ActivityPoint> points = new ArrayList<>();
        int idx = 0;
        for (int i = 0; i <= 16; i++) {
            ActivityPoint pt = new ActivityPoint();
            pt.setActivity(activity);
            pt.setSequenceIndex(idx++);
            pt.setLatitude(baseLat + i * 0.00008);
            pt.setLongitude(baseLng);
            pt.setElapsedSeconds(idx * 5);
            points.add(pt);
        }
        for (int i = 15; i >= 0; i--) {
            ActivityPoint pt = new ActivityPoint();
            pt.setActivity(activity);
            pt.setSequenceIndex(idx++);
            pt.setLatitude(baseLat + i * 0.00008);
            pt.setLongitude(baseLng);
            pt.setElapsedSeconds(idx * 5);
            points.add(pt);
        }
        activityPointRepository.saveAll(points);
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
}
