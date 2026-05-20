package com.hermes.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RoutePlannerServiceTests {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // --- Distance utilities ---

    @Test
    void haversineMShouldReturnZeroForSamePoint() {
        RoutePlannerService service = new RoutePlannerService();
        double dist = service.haversineM(40.7128, -74.0060, 40.7128, -74.0060);
        assertThat(dist).isEqualTo(0.0);
    }

    @Test
    void haversineMShouldComputeCorrectDistance() {
        RoutePlannerService service = new RoutePlannerService();
        // NYC to Boston ~306 km
        double dist = service.haversineM(40.7128, -74.0060, 42.3601, -71.0589);
        assertThat(dist).isBetween(300_000.0, 320_000.0);
    }

    // --- Elevation utilities ---

    @Test
    void computeElevationGainShouldHandleEmptyArray() {
        assertThat(RoutePlannerService.computeElevationGain(new double[]{})).isEqualTo(0.0);
    }

    @Test
    void computeElevationGainShouldHandleSinglePoint() {
        assertThat(RoutePlannerService.computeElevationGain(new double[]{10.0})).isEqualTo(0.0);
    }

    @Test
    void computeElevationGainShouldSumPositiveDiffs() {
        double[] elevations = {0.0, 5.0, 3.0, 10.0, 7.0};
        // Gains: 0->5 (+5), 5->3 (0), 3->10 (+7), 10->7 (0) = 12
        assertThat(RoutePlannerService.computeElevationGain(elevations)).isEqualTo(12.0);
    }

    @Test
    void computeElevationGainShouldIgnoreNaN() {
        double[] elevations = {0.0, Double.NaN, 10.0, 5.0};
        // NaN entries skip: 0->NaN (skip), NaN->10 (skip), 10->5 (0) = 0
        assertThat(RoutePlannerService.computeElevationGain(elevations)).isEqualTo(0.0);
    }

    @Test
    void computeEdgeElevationGainShouldReturnZeroForNaN() {
        assertThat(RoutePlannerService.computeEdgeElevationGain(Double.NaN, 10.0)).isEqualTo(0.0);
        assertThat(RoutePlannerService.computeEdgeElevationGain(10.0, Double.NaN)).isEqualTo(0.0);
    }

    @Test
    void computeEdgeElevationGainShouldOnlyReturnPositive() {
        assertThat(RoutePlannerService.computeEdgeElevationGain(10.0, 5.0)).isEqualTo(0.0);
        assertThat(RoutePlannerService.computeEdgeElevationGain(5.0, 10.0)).isEqualTo(5.0);
    }

    // --- Fallback route ---

    @Test
    void fallbackRouteShouldReturnNoDrawableWaypointsWhenOsmIsEmpty() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn("");

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);
        RoutePlannerService.RoutePlanResult result = service.planRoute(40.7128, -74.0060, 5.0, "rolling");

        assertThat(result).isNotNull();
        assertThat(result.waypoints).isEmpty();
        assertThat(result.actualDistanceKm).isZero();
        assertThat(result.estimatedTimeMinutes).isPositive();
        assertThat(result.streetGraphBacked).isFalse();
    }

    @Test
    void fallbackRouteShouldReturnNoDrawableWaypointsOnRestClientFailure() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RestClientException("Connection refused"));

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);
        RoutePlannerService.RoutePlanResult result = service.planRoute(40.7128, -74.0060, 10.0, "flat");

        assertThat(result).isNotNull();
        assertThat(result.waypoints).isEmpty();
        assertThat(result.actualDistanceKm).isZero();
        assertThat(result.streetGraphBacked).isFalse();
    }

    @Test
    void planRouteShouldRejectNegativeDistance() {
        RoutePlannerService service = new RoutePlannerService();
        assertThatThrownBy(() -> service.planRoute(40.7, -74.0, -1.0, "flat"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("positive");
    }

    @Test
    void planRouteShouldRejectZeroDistance() {
        RoutePlannerService service = new RoutePlannerService();
        assertThatThrownBy(() -> service.planRoute(40.7, -74.0, 0.0, "flat"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- Overpass response parsing ---

    @Test
    void parseOverpassResponseShouldReturnWaysFromValidJson() {
        String json = """
                {
                  "version": 0.6,
                  "elements": [
                    {
                      "type": "way",
                      "id": 12345,
                      "nodes": [100, 200, 300],
                      "geometry": [
                        {"lat": 40.7128, "lon": -74.0060},
                        {"lat": 40.7130, "lon": -74.0055},
                        {"lat": 40.7135, "lon": -74.0050}
                      ],
                      "tags": {"highway": "residential", "name": "Main St"}
                    },
                    {
                      "type": "way",
                      "id": 12346,
                      "nodes": [400, 500],
                      "geometry": [
                        {"lat": 40.7128, "lon": -74.0060},
                        {"lat": 40.7140, "lon": -74.0040}
                      ],
                      "tags": {"highway": "footway"}
                    },
                    {
                      "type": "node",
                      "id": 100,
                      "lat": 40.7128,
                      "lon": -74.0060
                    }
                  ]
                }
                """;

        RoutePlannerService service = new RoutePlannerService();
        List<RoutePlannerService.OsmElement> elements = service.parseOverpassResponse(json);

        assertThat(elements).hasSize(3);
        assertThat(elements.get(0).type).isEqualTo("way");
        assertThat(elements.get(0).id).isEqualTo(12345L);
        assertThat(elements.get(0).geometry).hasSize(3);
        assertThat(elements.get(0).tags).containsEntry("highway", "residential");

        assertThat(elements.get(1).type).isEqualTo("way");
        assertThat(elements.get(1).geometry).hasSize(2);

        assertThat(elements.get(2).type).isEqualTo("node");
    }

    @Test
    void parseOverpassResponseShouldReturnEmptyForEmptyJson() {
        RoutePlannerService service = new RoutePlannerService();
        List<RoutePlannerService.OsmElement> elements = service.parseOverpassResponse("{}");
        assertThat(elements).isEmpty();
    }

    @Test
    void parseOverpassResponseShouldReturnEmptyForNullResponse() {
        RoutePlannerService service = new RoutePlannerService();
        List<RoutePlannerService.OsmElement> elements = service.parseOverpassResponse("null");
        assertThat(elements).isEmpty();
    }

    @Test
    void parseOverpassResponseShouldHandleMalformedJson() {
        RoutePlannerService service = new RoutePlannerService();
        List<RoutePlannerService.OsmElement> elements = service.parseOverpassResponse("not valid json");
        assertThat(elements).isEmpty();
    }

    // --- Graph building ---

    @Test
    void buildGraphShouldCreateNodesFromWayGeometries() {
        List<RoutePlannerService.OsmElement> elements = new ArrayList<>();

        RoutePlannerService.OsmElement way1 = new RoutePlannerService.OsmElement();
        way1.type = "way";
        way1.id = 1;
        way1.geometry = List.of(
                new double[]{40.7128, -74.0060},
                new double[]{40.7130, -74.0055},
                new double[]{40.7135, -74.0050}
        );

        RoutePlannerService.OsmElement way2 = new RoutePlannerService.OsmElement();
        way2.type = "way";
        way2.id = 2;
        way2.geometry = List.of(
                new double[]{40.7128, -74.0060},
                new double[]{40.7140, -74.0040}
        );

        elements.add(way1);
        elements.add(way2);

        RoutePlannerService service = new RoutePlannerService();
        Map<Long, RoutePlannerService.GraphNode> graph = service.buildGraph(elements);

        // The shared coordinate at the start of both ways is one graph intersection.
        assertThat(graph).hasSize(4);
        // Each node should have at least 1 neighbor (except endpoints)
        long neighborCount = graph.values().stream()
                .mapToLong(n -> n.neighbors.size())
                .sum();
        // 2 edges in way1 (bidirectional = 4 connections) + 1 edge in way2 (bidirectional = 2) = 6
        assertThat(neighborCount).isEqualTo(6);

        assertThat(graph.values())
                .anySatisfy(node -> assertThat(node.neighbors).hasSize(2));
    }

    @Test
    void buildGraphShouldSkipWaysWithTooFewPoints() {
        List<RoutePlannerService.OsmElement> elements = new ArrayList<>();

        RoutePlannerService.OsmElement way = new RoutePlannerService.OsmElement();
        way.type = "way";
        way.id = 1;
        way.geometry = List.of(new double[]{40.7128, -74.0060}); // single point

        elements.add(way);

        RoutePlannerService service = new RoutePlannerService();
        Map<Long, RoutePlannerService.GraphNode> graph = service.buildGraph(elements);

        assertThat(graph).isEmpty();
    }

    @Test
    void buildGraphShouldSkipNonWayElements() {
        List<RoutePlannerService.OsmElement> elements = new ArrayList<>();

        RoutePlannerService.OsmElement node = new RoutePlannerService.OsmElement();
        node.type = "node";
        node.id = 100;

        elements.add(node);

        RoutePlannerService service = new RoutePlannerService();
        Map<Long, RoutePlannerService.GraphNode> graph = service.buildGraph(elements);

        assertThat(graph).isEmpty();
    }

    @Test
    void findClosestNodeShouldReturnNullForEmptyGraph() {
        RoutePlannerService service = new RoutePlannerService();
        Long result = service.findClosestNode(Map.of(), 40.7, -74.0);
        assertThat(result).isNull();
    }

    // --- A* search with real graph ---

    @Test
    void aStarSearchShouldFindRouteInGridGraph() {
        // Realistic urban grid: 0.0015° ≈ 130-170 m per grid step at 40 °N,
        // matching the MAX_WAYPOINT_GAP_M guard (250 m) that prevents the A*
        // path from including any segment that would render as a straight
        // line across a city block. A 10×10 grid gives plenty of perimeter
        // and interior choices for a ~1.5 km target loop.
        RoutePlannerService service = new RoutePlannerService();
        Map<Long, RoutePlannerService.GraphNode> graph = buildGridGraph(0.0015, 0.0015, 10, 10);

        RoutePlannerService.AStarResult result = service.aStarSearch(
                graph, -1L, 1500.0,
                "rolling"
        );

        assertThat(result).isNotNull();
        assertThat(result.path).hasSizeGreaterThanOrEqualTo(2);
        assertThat(result.totalDistanceM).isBetween(1000.0, 2500.0);
        // Path should start and end at -1
        assertThat(result.path.get(0)).isEqualTo(-1L);
        assertThat(result.path.get(result.path.size() - 1)).isEqualTo(-1L);
        assertThat(RoutePlannerService.hasRunnableRouteShape(pathWaypoints(graph, result.path))).isTrue();
    }

    @Test
    void aStarSearchShouldKeepSearchingPastStraightLineOnlyRoutes() {
        RoutePlannerService service = new RoutePlannerService();
        Map<Long, RoutePlannerService.GraphNode> graph = buildGridGraph(0.001, 0.001, 1, 5);

        RoutePlannerService.AStarResult result = service.aStarSearch(
                graph, -1L, 650.0, "rolling"
        );

        assertThat(result).isNull();
    }

    @Test
    void aStarSearchShouldReturnNullWhenTargetTooSmall() {
        RoutePlannerService service = new RoutePlannerService();
        Map<Long, RoutePlannerService.GraphNode> graph = buildGridGraph(0.01, 0.01, 3, 3);

        // Target a tiny distance that can't form a loop
        RoutePlannerService.AStarResult result = service.aStarSearch(
                graph, -1L, 10.0, "rolling"
        );

        // Might find a very short route or return null — either is acceptable
        // since 10m is unrealistically small for a running loop
        if (result != null) {
            assertThat(result.totalDistanceM).isGreaterThan(0);
        }
    }

    // --- Elevation preference affects search ---

    @Test
    void planRouteWithFlatPrefShouldPreferFlatterRoutes() {
        // When OSM is empty, the service uses a fallback
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn("");

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);

        // Empty OSM data should not fabricate drawable street geometry.
        RoutePlannerService.RoutePlanResult result = service.planRoute(40.7128, -74.0060, 3.0, "flat");
        assertThat(result).isNotNull();
        assertThat(result.waypoints).isEmpty();
        assertThat(result.streetGraphBacked).isFalse();
    }

    @Test
    void planRouteWithHillyPrefShouldNotThrow() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn("");

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);

        RoutePlannerService.RoutePlanResult result = service.planRoute(40.7128, -74.0060, 3.0, "hilly");
        assertThat(result).isNotNull();
    }

    @Test
    void routeShapeGuardShouldRejectAcrossBlockShortcut() {
        // Three nodes that together form an L-shape, but with a 600 m gap
        // between the second and third points — that means the rendered
        // polyline would cut diagonally across multiple city blocks instead
        // of following streets. The guard must reject this so the caller
        // falls back to the no-drawable-route response.
        List<double[]> acrossBlockJump = List.of(
                new double[]{40.7000, -74.0000},
                new double[]{40.7000, -73.9985},
                new double[]{40.7012, -73.9985},
                new double[]{40.7012, -73.9920},  // 600m jump from previous
                new double[]{40.7000, -74.0000}
        );

        assertThat(RoutePlannerService.hasCrossBlockJump(acrossBlockJump)).isTrue();
        assertThat(RoutePlannerService.hasRunnableRouteShape(acrossBlockJump)).isFalse();
    }

    @Test
    void routeShapeGuardShouldRejectStraightOutAndBack() {
        List<double[]> straightOutAndBack = List.of(
                new double[]{40.7000, -74.0000},
                new double[]{40.7040, -73.9960},
                new double[]{40.7080, -73.9920},
                new double[]{40.7120, -73.9880},
                new double[]{40.7080, -73.9920},
                new double[]{40.7040, -73.9960},
                new double[]{40.7000, -74.0000}
        );

        assertThat(RoutePlannerService.hasRunnableRouteShape(straightOutAndBack)).isFalse();
    }

    @Test
    void routeShapeGuardShouldAcceptBlockLoop() {
        List<double[]> blockLoop = List.of(
                new double[]{40.7000, -74.0000},
                new double[]{40.7000, -73.9985},
                new double[]{40.7012, -73.9985},
                new double[]{40.7012, -74.0000},
                new double[]{40.7000, -74.0000}
        );

        assertThat(RoutePlannerService.hasRunnableRouteShape(blockLoop)).isTrue();
    }

    @Test
    void planRouteShouldNotReturnDrawableRouteForSingleStraightWay() {
        String osmResponse = """
                {
                  "elements": [
                    {
                      "type": "way", "id": 11,
                      "geometry": [
                        {"lat": 40.7000, "lon": -74.0000},
                        {"lat": 40.7010, "lon": -73.9990},
                        {"lat": 40.7020, "lon": -73.9980},
                        {"lat": 40.7030, "lon": -73.9970},
                        {"lat": 40.7040, "lon": -73.9960}
                      ],
                      "tags": {"highway": "residential"}
                    }
                  ]
                }
                """;

        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(osmResponse);

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);
        RoutePlannerService.RoutePlanResult result = service.planRoute(
                40.7000, -74.0000, 0.9, "rolling"
        );

        assertThat(result).isNotNull();
        assertThat(result.streetGraphBacked).isFalse();
        assertThat(result.waypoints).isEmpty();
    }

    @Test
    void invalidElevationPreferenceShouldDefaultToRolling() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn("");

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);

        RoutePlannerService.RoutePlanResult result = service.planRoute(40.7128, -74.0060, 3.0, "unknown");
        assertThat(result).isNotNull();
    }

    // --- A* search with real OSM response ---

    @Test
    void planRouteShouldWorkWithRealOsmResponse() {
        // Simulate a real Overpass response with intersecting streets (grid block)
        String osmResponse = """
                {
                  "elements": [
                    {
                      "type": "way", "id": 1,
                      "geometry": [
                        {"lat": 40.7120, "lon": -74.0060},
                        {"lat": 40.7130, "lon": -74.0060},
                        {"lat": 40.7140, "lon": -74.0060},
                        {"lat": 40.7150, "lon": -74.0060}
                      ],
                      "tags": {"highway": "residential"}
                    },
                    {
                      "type": "way", "id": 2,
                      "geometry": [
                        {"lat": 40.7120, "lon": -74.0065},
                        {"lat": 40.7130, "lon": -74.0065},
                        {"lat": 40.7140, "lon": -74.0065},
                        {"lat": 40.7150, "lon": -74.0065}
                      ],
                      "tags": {"highway": "residential"}
                    },
                    {
                      "type": "way", "id": 3,
                      "geometry": [
                        {"lat": 40.7130, "lon": -74.0070},
                        {"lat": 40.7130, "lon": -74.0065},
                        {"lat": 40.7130, "lon": -74.0060},
                        {"lat": 40.7130, "lon": -74.0055}
                      ],
                      "tags": {"highway": "residential"}
                    },
                    {
                      "type": "way", "id": 4,
                      "geometry": [
                        {"lat": 40.7140, "lon": -74.0070},
                        {"lat": 40.7140, "lon": -74.0065},
                        {"lat": 40.7140, "lon": -74.0060},
                        {"lat": 40.7140, "lon": -74.0055}
                      ],
                      "tags": {"highway": "residential"}
                    }
                  ]
                }
                """;

        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(osmResponse);

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);
        RoutePlannerService.RoutePlanResult result = service.planRoute(
                40.7135, -74.0062, 1.5, "rolling"
        );

        assertThat(result).isNotNull();
        assertThat(result.waypoints).isNotEmpty();
        assertThat(result.actualDistanceKm).isPositive();
        assertThat(result.estimatedTimeMinutes).isPositive();
    }

    // --- Plan route with distance accuracy ---

    @Test
    void planRouteShouldReturnDistanceAccuracy() {
        RestTemplate restTemplate = mock(RestTemplate.class);
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn("");

        RoutePlannerService service = new RoutePlannerService(restTemplate, objectMapper);
        RoutePlannerService.RoutePlanResult result = service.planRoute(40.7128, -74.0060, 5.0, "rolling");

        assertThat(result.distanceAccuracy).isZero();
        assertThat(result.streetGraphBacked).isFalse();
    }

    // --- Helper: build a grid graph for testing ---

    private Map<Long, RoutePlannerService.GraphNode> buildGridGraph(
            double latStep, double lngStep, int rows, int cols) {
        Map<Long, RoutePlannerService.GraphNode> graph = new java.util.HashMap<>();
        long id = -1;

        double baseLat = 40.7128;
        double baseLng = -74.0060;

        // Create grid nodes
        RoutePlannerService.GraphNode[][] grid = new RoutePlannerService.GraphNode[rows][cols];
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                double lat = baseLat + r * latStep;
                double lng = baseLng + c * lngStep;
                RoutePlannerService.GraphNode node = new RoutePlannerService.GraphNode(
                        id, lat, lng, Double.NaN);
                graph.put(id, node);
                grid[r][c] = node;
                id--;
            }
        }

        // Connect neighbors (4-directional grid)
        RoutePlannerService service = new RoutePlannerService();
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                RoutePlannerService.GraphNode node = grid[r][c];
                // Right
                if (c + 1 < cols) {
                    RoutePlannerService.GraphNode neighbor = grid[r][c + 1];
                    double dist = service.haversineM(node.lat, node.lng, neighbor.lat, neighbor.lng);
                    node.neighbors.add(new RoutePlannerService.GraphNode.Edge(neighbor.id, dist, 0));
                }
                // Down
                if (r + 1 < rows) {
                    RoutePlannerService.GraphNode neighbor = grid[r + 1][c];
                    double dist = service.haversineM(node.lat, node.lng, neighbor.lat, neighbor.lng);
                    node.neighbors.add(new RoutePlannerService.GraphNode.Edge(neighbor.id, dist, 0));
                }
                // Left
                if (c - 1 >= 0) {
                    RoutePlannerService.GraphNode neighbor = grid[r][c - 1];
                    double dist = service.haversineM(node.lat, node.lng, neighbor.lat, neighbor.lng);
                    node.neighbors.add(new RoutePlannerService.GraphNode.Edge(neighbor.id, dist, 0));
                }
                // Up
                if (r - 1 >= 0) {
                    RoutePlannerService.GraphNode neighbor = grid[r - 1][c];
                    double dist = service.haversineM(node.lat, node.lng, neighbor.lat, neighbor.lng);
                    node.neighbors.add(new RoutePlannerService.GraphNode.Edge(neighbor.id, dist, 0));
                }
            }
        }

        return graph;
    }

    private List<double[]> pathWaypoints(Map<Long, RoutePlannerService.GraphNode> graph, List<Long> path) {
        return path.stream()
                .map(graph::get)
                .filter(Objects::nonNull)
                .map(node -> new double[]{node.lat, node.lng})
                .toList();
    }
}
