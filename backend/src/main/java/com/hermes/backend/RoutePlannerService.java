package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Clock;
import java.time.Duration;
import java.util.*;

@Service
public class RoutePlannerService {

    private static final Logger log = LoggerFactory.getLogger(RoutePlannerService.class);
    private static final double EARTH_RADIUS_M = 6_371_000.0;
    private static final double DISTANCE_TOLERANCE_FACTOR = 0.15;
    private static final int MAX_SEARCH_ITERATIONS = 15_000;
    private static final double OVERPASS_RADIUS_FACTOR = 800.0;
    private static final double MIN_OVERPASS_RADIUS_M = 1_500.0;
    private static final double MAX_OVERPASS_RADIUS_M = 25_000.0;
    /*
     * Graph + waypoint sizing. The previous 3_000-node cap was too small for
     * any dense urban area (a 4 km radius of a city typically yields tens of
     * thousands of OSM way-geometry points), which left the start node stranded
     * in a geographically lopsided fragment of the graph. Komoot / Strava /
     * Garmin route builders all retain every OSM way-geometry vertex so the
     * rendered polyline traces real street curvature; running with too few
     * nodes is what produces the "straight line across the block" rendering
     * the user reported. 12_000 strikes a balance between coverage and the
     * O(N) memory footprint of the A* open set.
     */
    private static final int MAX_GRAPH_NODES = 12_000;

    /*
     * Maximum allowed straight-line gap between two consecutive waypoints in
     * the returned polyline. OSM way geometry on urban residential streets is
     * sampled every 10-30 m, on suburban / highway segments every 80-200 m.
     * A typical city block diagonal is 200-300 m. We reject only segments
     * above 250 m so a polyline cannot visibly cut diagonally across a full
     * city block (the "straight line across the street" the user reported),
     * while still allowing long suburban streets and sparsely-mapped trail
     * segments. Routes with any segment above this threshold are rejected as
     * not drawably runnable so the caller can fall back to the no-route path
     * instead of showing a misleading shortcut polyline.
     */
    private static final double MAX_WAYPOINT_GAP_M = 250.0;

    private static final double RUNNING_SPEED_KPH = 10.0;
    private static final double GRAPH_COORDINATE_SCALE = 10_000_000.0;
    private static final double DISTANCE_BUCKET_M = 50.0;
    private static final int MIN_ROUTE_SHAPE_POINTS = 4;
    private static final int MIN_ROUTE_DIRECTION_CHANGES = 2;
    private static final double MIN_ROUTE_TURN_SEGMENT_M = 20.0;
    private static final double MIN_ROUTE_TURN_DEGREES = 25.0;
    private static final double MAX_ROUTE_TURN_DEGREES = 155.0;

    private static final double ELEVATION_WEIGHT_FLAT = 5.0;
    private static final double ELEVATION_WEIGHT_ROLLING = 2.0;
    private static final double ELEVATION_WEIGHT_HILLY = 0.2;
    private static final Duration OVERPASS_CACHE_TTL = Duration.ofHours(12);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final TtlCacheStore cacheStore;

    public RoutePlannerService() {
        this(new RestTemplate(), new ObjectMapper());
    }

    /** Constructor for testing. */
    public RoutePlannerService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this(restTemplate, objectMapper, TtlCacheStore.inMemoryForTests(objectMapper.copy(), Clock.systemUTC()));
    }

    @Autowired
    public RoutePlannerService(RestTemplate restTemplate, ObjectMapper objectMapper, TtlCacheStore cacheStore) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.cacheStore = cacheStore;
    }

    /**
     * Plans an optimal running route from the given start point.
     *
     * @param startLat           latitude of start point
     * @param startLng           longitude of start point
     * @param targetDistanceKm   desired route distance in kilometers
     * @param elevationPreference "flat", "rolling", or "hilly"
     * @return planned route result
     */
    public RoutePlanResult planRoute(double startLat, double startLng, double targetDistanceKm, String elevationPreference) {
        log.info("Planning route: start=({},{}), targetDist={}km, pref={}", startLat, startLng, targetDistanceKm, elevationPreference);

        if (targetDistanceKm <= 0) {
            throw new IllegalArgumentException("Target distance must be positive.");
        }
        String pref = elevationPreference != null ? elevationPreference.toLowerCase(Locale.ROOT) : "rolling";
        if (!pref.equals("flat") && !pref.equals("rolling") && !pref.equals("hilly")) {
            pref = "rolling";
        }

        double targetDistanceM = targetDistanceKm * 1000.0;

        // Step 1: Query OSM road network
        List<OsmElement> osmElements = queryOverpass(startLat, startLng, targetDistanceKm);
        if (osmElements.isEmpty()) {
            log.warn("Overpass returned no elements for ({}, {}); using fallback.", startLat, startLng);
            return generateFallbackRoute(startLat, startLng, targetDistanceKm);
        }

        // Step 2: Build graph
        Map<Long, GraphNode> graph = buildGraph(osmElements);
        if (graph == null || graph.isEmpty() || graph.size() < 3) {
            log.warn("Graph too small ({} nodes); using fallback.", graph == null ? 0 : graph.size());
            return generateFallbackRoute(startLat, startLng, targetDistanceKm);
        }

        // Step 3: Find start node (closest node to user's position)
        Long startNodeId = findClosestNode(graph, startLat, startLng);
        if (startNodeId == null) {
            log.warn("Could not find start node near ({}, {}); using fallback.", startLat, startLng);
            return generateFallbackRoute(startLat, startLng, targetDistanceKm);
        }

        // Step 4: Run A* search for a loop route
        AStarResult aStarResult = aStarSearch(graph, startNodeId, targetDistanceM, pref);
        if (aStarResult == null || aStarResult.path == null || aStarResult.path.size() < 2) {
            log.warn("A* search found no valid route; using fallback.");
            return generateFallbackRoute(startLat, startLng, targetDistanceKm);
        }

        // Step 5: Build the result
        List<double[]> waypoints = new ArrayList<>();
        double[] elevations = new double[aStarResult.path.size()];
        for (int i = 0; i < aStarResult.path.size(); i++) {
            GraphNode node = graph.get(aStarResult.path.get(i));
            if (node != null) {
                waypoints.add(new double[]{node.lat, node.lng});
                elevations[i] = node.elevation;
            }
        }

        double totalClimbM = computeElevationGain(elevations);
        double actualDistanceKm = aStarResult.totalDistanceM / 1000.0;
        int estimatedTimeMin = (int) Math.round(actualDistanceKm / RUNNING_SPEED_KPH * 60.0);
        if (!hasRunnableRouteShape(waypoints)) {
            log.warn("A* route collapsed into a straight/out-and-back shape; returning no drawable route.");
            return generateFallbackRoute(startLat, startLng, targetDistanceKm);
        }

        return new RoutePlanResult(
                waypoints,
                actualDistanceKm,
                totalClimbM,
                estimatedTimeMin,
                aStarResult.totalDistanceM / targetDistanceM,
                true
        );
    }

    // --- Internal data structures ---

    static class OsmElement {
        String type;
        long id;
        double lat;
        double lon;
        double ele;
        List<Long> nodeRefs;
        List<double[]> geometry;
        Map<String, String> tags;
    }

    static class GraphNode {
        final long id;
        final double lat;
        final double lng;
        final double elevation;
        final List<Edge> neighbors = new ArrayList<>();

        GraphNode(long id, double lat, double lng, double elevation) {
            this.id = id;
            this.lat = lat;
            this.lng = lng;
            this.elevation = elevation;
        }

        static class Edge {
            final long targetId;
            final double distanceM;
            final double elevationGainM;

            Edge(long targetId, double distanceM, double elevationGainM) {
                this.targetId = targetId;
                this.distanceM = distanceM;
                this.elevationGainM = elevationGainM;
            }
        }
    }

    static class AStarResult {
        final List<Long> path;
        final double totalDistanceM;

        AStarResult(List<Long> path, double totalDistanceM) {
            this.path = path;
            this.totalDistanceM = totalDistanceM;
        }
    }

    /**
     * Result returned by {@link #planRoute}.
     */
    public static class RoutePlanResult {
        public final List<double[]> waypoints;
        public final double actualDistanceKm;
        public final double elevationGainMeters;
        public final int estimatedTimeMinutes;
        public final double distanceAccuracy;
        public final boolean streetGraphBacked;

        public RoutePlanResult(List<double[]> waypoints, double actualDistanceKm,
                               double elevationGainMeters, int estimatedTimeMinutes,
                               double distanceAccuracy, boolean streetGraphBacked) {
            this.waypoints = waypoints;
            this.actualDistanceKm = actualDistanceKm;
            this.elevationGainMeters = elevationGainMeters;
            this.estimatedTimeMinutes = estimatedTimeMinutes;
            this.distanceAccuracy = distanceAccuracy;
            this.streetGraphBacked = streetGraphBacked;
        }
    }

    // --- Overpass API ---

    List<OsmElement> queryOverpass(double lat, double lng, double targetDistanceKm) {
        double radiusM = Math.max(MIN_OVERPASS_RADIUS_M,
                Math.min(MAX_OVERPASS_RADIUS_M, targetDistanceKm * OVERPASS_RADIUS_FACTOR));
        long radius = Math.round(radiusM);

        String highwayFilter = "%5E(footway%7Cpath%7Ctrack%7Cresidential%7Cservice%7Cliving_street%7Cpedestrian%7Ccycleway%7Cbridleway%7Cunclassified%7Ctertiary%7Csecondary%7Cprimary%7Csteps)%24";
        String query = "[out:json];way[highway~\""
                + highwayFilter
                + "\"](around:" + radius + "," + lat + "," + lng + ");out geom;";

        String url = "https://overpass-api.de/api/interpreter?data=" + query;

        try {
            Optional<String> cachedResponse = cacheStore.get("overpass", url, String.class);
            if (cachedResponse.isPresent()) {
                return parseOverpassResponse(cachedResponse.get());
            }
            String response = restTemplate.getForObject(url, String.class);
            if (response == null || response.isBlank()) {
                return List.of();
            }
            cacheStore.put("overpass", url, response, OVERPASS_CACHE_TTL);
            return parseOverpassResponse(response);
        } catch (RestClientException e) {
            log.warn("Overpass API call failed: {}", e.getMessage());
            return List.of();
        }
    }

    List<OsmElement> parseOverpassResponse(String json) {
        List<OsmElement> elements = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode elementsNode = root.get("elements");
            if (elementsNode == null || !elementsNode.isArray()) {
                return elements;
            }
            for (JsonNode el : elementsNode) {
                String type = el.has("type") ? el.get("type").asText() : "";
                if ("node".equals(type)) {
                    OsmElement e = new OsmElement();
                    e.type = "node";
                    e.id = el.get("id").asLong();
                    e.lat = el.get("lat").asDouble();
                    e.lon = el.get("lon").asDouble();
                    e.ele = el.has("tags") && el.get("tags").has("ele")
                            ? el.get("tags").get("ele").asDouble(Double.NaN) : Double.NaN;
                    elements.add(e);
                    continue;
                }
                if ("way".equals(type)) {
                    OsmElement e = new OsmElement();
                    e.type = "way";
                    e.id = el.get("id").asLong();
                    // Parse geometry (list of {lat, lon} objects)
                    JsonNode geom = el.get("geometry");
                    if (geom != null && geom.isArray()) {
                        e.geometry = new ArrayList<>();
                        for (JsonNode pt : geom) {
                            double ptLat = pt.get("lat").asDouble();
                            double ptLon = pt.get("lon").asDouble();
                            e.geometry.add(new double[]{ptLat, ptLon});
                        }
                    }
                    // Parse tags
                    JsonNode tagsNode = el.get("tags");
                    if (tagsNode != null && tagsNode.isObject()) {
                        e.tags = new HashMap<>();
                        var fieldNames = tagsNode.fieldNames();
                        while (fieldNames.hasNext()) {
                            String key = fieldNames.next();
                            e.tags.put(key, tagsNode.get(key).asText());
                        }
                    }
                    elements.add(e);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse Overpass response: {}", e.getMessage());
        }
        return elements;
    }

    // --- Graph building ---

    Map<Long, GraphNode> buildGraph(List<OsmElement> elements) {
        Map<Long, GraphNode> graph = new HashMap<>();
        Map<String, Long> coordinateIndex = new HashMap<>();
        long syntheticId = -1;

        for (OsmElement el : elements) {
            if (!"way".equals(el.type) || el.geometry == null || el.geometry.size() < 2) {
                continue;
            }

            // Stop accepting NEW ways once the cap is reached, but always finish
            // the current way atomically (nodes + edges) so a way is never left
            // half-connected. The previous implementation returned mid-way and
            // left orphan nodes that the A* search could not traverse — which
            // produced visible shortcut polylines whenever the renderer drew a
            // straight line between two disconnected fragments of the network.
            if (graph.size() >= MAX_GRAPH_NODES) {
                break;
            }

            List<GraphNode> wayNodes = new ArrayList<>(el.geometry.size());
            for (double[] pt : el.geometry) {
                double lat = pt[0];
                double lng = pt[1];
                String coordinateKey = coordinateKey(lat, lng);
                Long existingId = coordinateIndex.get(coordinateKey);
                GraphNode node;
                if (existingId != null) {
                    node = graph.get(existingId);
                } else {
                    long nid = syntheticId--;
                    node = new GraphNode(nid, lat, lng, Double.NaN);
                    graph.put(nid, node);
                    coordinateIndex.put(coordinateKey, nid);
                }
                wayNodes.add(node);
            }

            // Connect every consecutive way-geometry pair so the resulting A*
            // path contains every intermediate point along each street rather
            // than only the way's endpoints. Komoot / Strava / Garmin route
            // builders all preserve this density so the rendered polyline
            // traces real street curvature.
            for (int i = 0; i < wayNodes.size() - 1; i++) {
                GraphNode a = wayNodes.get(i);
                GraphNode b = wayNodes.get(i + 1);
                if (a.id == b.id) continue;
                double dist = haversineM(a.lat, a.lng, b.lat, b.lng);
                double elevGain = computeEdgeElevationGain(a.elevation, b.elevation);
                a.neighbors.add(new GraphNode.Edge(b.id, dist, elevGain));
                b.neighbors.add(new GraphNode.Edge(a.id, dist, Math.max(0, -elevGain)));
            }
        }

        return graph;
    }

    Long findClosestNode(Map<Long, GraphNode> graph, double lat, double lng) {
        Long closest = null;
        double minDist = Double.POSITIVE_INFINITY;
        for (GraphNode node : graph.values()) {
            double d = haversineM(lat, lng, node.lat, node.lng);
            if (d < minDist) {
                minDist = d;
                closest = node.id;
            }
        }
        return closest;
    }

    // --- A* Search ---

    AStarResult aStarSearch(Map<Long, GraphNode> graph, Long startNodeId, double targetDistanceM, String elevationPref) {
        GraphNode startNode = graph.get(startNodeId);
        if (startNode == null) return null;

        double toleranceM = targetDistanceM * DISTANCE_TOLERANCE_FACTOR;
        double elevationWeight = getElevationWeight(elevationPref);

        PriorityQueue<SearchState> openSet = new PriorityQueue<>(
                Comparator.comparingDouble(s -> s.fScore));

        // Track the best preference-adjusted cost for each node and distance bucket so the search can
        // revisit intersections at meaningfully different route lengths without exploding state count.
        Map<String, Double> bestG = new HashMap<>();

        SearchState initial = new SearchState(
                startNodeId,
                0.0,
                0.0,
                0.0,
                heuristic(0.0, 0.0, targetDistanceM),
                null,
                0,
                null,
                0
        );
        openSet.add(initial);
        bestG.put(stateKey(startNodeId, 0, 0, null), 0.0);

        SearchState bestGoalState = null;
        double bestGoalScore = Double.POSITIVE_INFINITY;
        int iterations = 0;

        while (!openSet.isEmpty() && iterations < MAX_SEARCH_ITERATIONS) {
            iterations++;
            SearchState current = openSet.poll();
            if (current == null) continue;

            long nodeId = current.nodeId;
            GraphNode node = graph.get(nodeId);
            if (node == null) continue;

            if (nodeId == startNodeId && current.depth > 1) {
                double distError = Math.abs(current.distanceM - targetDistanceM);
                if (distError <= toleranceM && current.directionChanges >= MIN_ROUTE_DIRECTION_CHANGES) {
                    double score = scoreGoal(current, targetDistanceM, elevationPref);
                    if (score < bestGoalScore) {
                        bestGoalScore = score;
                        bestGoalState = current;
                    }
                }
            }

            if (bestGoalState != null && current.fScore > bestGoalScore + toleranceM) {
                break;
            }

            for (GraphNode.Edge edge : node.neighbors) {
                GraphNode neighbor = graph.get(edge.targetId);
                if (neighbor == null) continue;

                double edgeCost = edge.distanceM + elevationWeight * Math.max(0, edge.elevationGainM);
                double newDistanceM = current.distanceM + edge.distanceM;
                double newRouteCost = current.routeCost + edgeCost;
                double newElevationGainM = current.elevationGainM + Math.max(0, edge.elevationGainM);
                double edgeBearing = segmentBearingDegrees(node, neighbor);
                int newDirectionChanges = current.directionChanges
                        + directionChangeIncrement(current.previousBearing, edgeBearing, edge.distanceM);

                if (newDistanceM > targetDistanceM * 2.5) continue;

                if (edge.targetId == startNodeId && newDistanceM < targetDistanceM * 0.5) continue;

                double distBucket = Math.round(newDistanceM / DISTANCE_BUCKET_M) * DISTANCE_BUCKET_M;
                String key = stateKey(edge.targetId, distBucket, newDirectionChanges, edgeBearing);

                Double prevBestG = bestG.get(key);
                if (prevBestG != null && prevBestG <= newRouteCost) continue;

                double neighborDistToStart = edge.targetId == startNodeId
                        ? 0.0
                        : haversineM(neighbor.lat, neighbor.lng, startNode.lat, startNode.lng);
                double h = heuristic(newDistanceM, neighborDistToStart, targetDistanceM);
                double fScore = newRouteCost + h;
                bestG.put(key, newRouteCost);

                SearchState next = new SearchState(
                        edge.targetId,
                        newDistanceM,
                        newRouteCost,
                        newElevationGainM,
                        fScore,
                        current,
                        current.depth + 1,
                        edgeBearing,
                        newDirectionChanges
                );
                openSet.add(next);
            }
        }

        log.info("A* search completed: {} iterations, {} goal candidates", iterations, bestGoalState != null ? 1 : 0);

        if (bestGoalState == null) {
            return null;
        }

        return reconstructPath(bestGoalState);
    }

    private AStarResult reconstructPath(SearchState goalState) {
        List<Long> path = new ArrayList<>();
        SearchState current = goalState;
        while (current != null) {
            path.add(current.nodeId);
            current = current.parent;
        }
        Collections.reverse(path);
        return new AStarResult(path, goalState.distanceM);
    }

    // --- Helpers ---

    private double heuristic(double distSoFar, double distToStart, double targetDistanceM) {
        double remaining = targetDistanceM - distSoFar - distToStart;
        return Math.abs(remaining) + distToStart * 0.5;
    }

    private double getElevationWeight(String pref) {
        return switch (pref) {
            case "flat" -> ELEVATION_WEIGHT_FLAT;
            case "hilly" -> ELEVATION_WEIGHT_HILLY;
            default -> ELEVATION_WEIGHT_ROLLING;
        };
    }

    private String stateKey(long nodeId, double distBucket, int directionChanges, Double previousBearing) {
        int shapeBucket = Math.min(directionChanges, MIN_ROUTE_DIRECTION_CHANGES);
        int bearingBucket = previousBearing == null ? -1 : (int) Math.round(previousBearing / 45.0) % 8;
        return nodeId + "_" + ((long) distBucket) + "_" + shapeBucket + "_" + bearingBucket;
    }

    private String coordinateKey(double lat, double lng) {
        long roundedLat = Math.round(lat * GRAPH_COORDINATE_SCALE);
        long roundedLng = Math.round(lng * GRAPH_COORDINATE_SCALE);
        return roundedLat + ":" + roundedLng;
    }

    private double scoreGoal(SearchState state, double targetDistanceM, String elevationPref) {
        double distanceError = Math.abs(state.distanceM - targetDistanceM);
        if ("hilly".equals(elevationPref)) {
            return distanceError - (state.elevationGainM * 0.25);
        }
        return distanceError + getElevationWeight(elevationPref) * state.elevationGainM;
    }

    // --- Distance & elevation utilities ---

    double haversineM(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_M * c;
    }

    static double computeEdgeElevationGain(double fromElev, double toElev) {
        if (Double.isNaN(fromElev) || Double.isNaN(toElev)) return 0.0;
        double diff = toElev - fromElev;
        return Math.max(0, diff);
    }

    static double computeElevationGain(double[] elevations) {
        double gain = 0.0;
        for (int i = 1; i < elevations.length; i++) {
            if (Double.isNaN(elevations[i - 1]) || Double.isNaN(elevations[i])) continue;
            double diff = elevations[i] - elevations[i - 1];
            if (diff > 0) gain += diff;
        }
        return gain;
    }

    static boolean hasRunnableRouteShape(List<double[]> waypoints) {
        if (waypoints == null || waypoints.size() < MIN_ROUTE_SHAPE_POINTS) {
            return false;
        }
        if (hasCrossBlockJump(waypoints)) {
            return false;
        }
        return countMeaningfulDirectionChanges(waypoints) >= MIN_ROUTE_DIRECTION_CHANGES;
    }

    /**
     * Returns true when any two consecutive waypoints are farther apart than
     * the maximum allowed street-geometry gap. A jump above this threshold
     * means the polyline is cutting across un-mapped terrain rather than
     * following a real street segment — which is exactly what makes a route
     * render as a straight line across a city block. Such routes are rejected
     * so the caller can fall back to the no-drawable-route response instead of
     * showing a misleading polyline.
     */
    static boolean hasCrossBlockJump(List<double[]> waypoints) {
        if (waypoints == null || waypoints.size() < 2) {
            return false;
        }
        for (int i = 1; i < waypoints.size(); i++) {
            double[] previous = waypoints.get(i - 1);
            double[] current = waypoints.get(i);
            if (previous == null || current == null || previous.length < 2 || current.length < 2) {
                continue;
            }
            double segmentMeters = haversineMStatic(previous[0], previous[1], current[0], current[1]);
            if (segmentMeters > MAX_WAYPOINT_GAP_M) {
                return true;
            }
        }
        return false;
    }

    private static int countMeaningfulDirectionChanges(List<double[]> waypoints) {
        Double previousBearing = null;
        int turnCount = 0;

        for (int i = 1; i < waypoints.size(); i++) {
            double[] previous = waypoints.get(i - 1);
            double[] current = waypoints.get(i);
            if (previous == null || current == null || previous.length < 2 || current.length < 2) {
                continue;
            }

            double segmentMeters = haversineMStatic(previous[0], previous[1], current[0], current[1]);
            if (segmentMeters < MIN_ROUTE_TURN_SEGMENT_M) {
                continue;
            }

            double bearing = segmentBearingDegrees(previous, current);
            if (previousBearing != null) {
                double delta = turnDeltaDegrees(previousBearing, bearing);
                if (delta >= MIN_ROUTE_TURN_DEGREES && delta <= MAX_ROUTE_TURN_DEGREES) {
                    turnCount++;
                }
            }
            previousBearing = bearing;
        }

        return turnCount;
    }

    private static double segmentBearingDegrees(double[] previous, double[] current) {
        double averageLat = Math.toRadians((previous[0] + current[0]) / 2.0);
        double deltaLat = current[0] - previous[0];
        double deltaLng = (current[1] - previous[1]) * Math.cos(averageLat);
        return (Math.toDegrees(Math.atan2(deltaLng, deltaLat)) + 360.0) % 360.0;
    }

    private static double segmentBearingDegrees(GraphNode previous, GraphNode current) {
        double averageLat = Math.toRadians((previous.lat + current.lat) / 2.0);
        double deltaLat = current.lat - previous.lat;
        double deltaLng = (current.lng - previous.lng) * Math.cos(averageLat);
        return (Math.toDegrees(Math.atan2(deltaLng, deltaLat)) + 360.0) % 360.0;
    }

    private static int directionChangeIncrement(Double previousBearing, double currentBearing, double segmentMeters) {
        if (previousBearing == null || segmentMeters < MIN_ROUTE_TURN_SEGMENT_M) {
            return 0;
        }
        double delta = turnDeltaDegrees(previousBearing, currentBearing);
        return delta >= MIN_ROUTE_TURN_DEGREES && delta <= MAX_ROUTE_TURN_DEGREES ? 1 : 0;
    }

    private static double turnDeltaDegrees(double previousBearing, double currentBearing) {
        return Math.abs(((currentBearing - previousBearing + 540.0) % 360.0) - 180.0);
    }

    private static double haversineMStatic(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_M * c;
    }

    // --- Fallback: no geometry when OSM data cannot prove a street route ---

    RoutePlanResult generateFallbackRoute(double startLat, double startLng, double targetDistanceKm) {
        int estimatedTimeMin = (int) Math.round(targetDistanceKm / RUNNING_SPEED_KPH * 60.0);
        log.info("No street-graph route available near ({}, {}); returning no drawable route.", startLat, startLng);
        return new RoutePlanResult(List.of(), 0.0, 0.0, estimatedTimeMin, 0.0, false);
    }

    // --- Inner class for A* search state ---

    static class SearchState {
        final long nodeId;
        final double distanceM;
        final double routeCost;
        final double elevationGainM;
        final double fScore;
        final SearchState parent;
        final int depth;
        final Double previousBearing;
        final int directionChanges;

        SearchState(long nodeId, double distanceM, double routeCost, double elevationGainM,
                    double fScore, SearchState parent, int depth,
                    Double previousBearing, int directionChanges) {
            this.nodeId = nodeId;
            this.distanceM = distanceM;
            this.routeCost = routeCost;
            this.elevationGainM = elevationGainM;
            this.fScore = fScore;
            this.parent = parent;
            this.depth = depth;
            this.previousBearing = previousBearing;
            this.directionChanges = directionChanges;
        }
    }
}
