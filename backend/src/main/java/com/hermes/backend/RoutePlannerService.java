package com.hermes.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

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
    private static final int MAX_GRAPH_NODES = 3_000;
    private static final double RUNNING_SPEED_KPH = 10.0;

    private static final double ELEVATION_WEIGHT_FLAT = 5.0;
    private static final double ELEVATION_WEIGHT_ROLLING = 2.0;
    private static final double ELEVATION_WEIGHT_HILLY = 0.2;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public RoutePlannerService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /** Constructor for testing. */
    public RoutePlannerService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
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

        // Step 4: Run modified A* search for a loop route
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

        return new RoutePlanResult(
                waypoints,
                actualDistanceKm,
                totalClimbM,
                estimatedTimeMin,
                aStarResult.totalDistanceM / targetDistanceM
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

        public RoutePlanResult(List<double[]> waypoints, double actualDistanceKm,
                               double elevationGainMeters, int estimatedTimeMinutes,
                               double distanceAccuracy) {
            this.waypoints = waypoints;
            this.actualDistanceKm = actualDistanceKm;
            this.elevationGainMeters = elevationGainMeters;
            this.estimatedTimeMinutes = estimatedTimeMinutes;
            this.distanceAccuracy = distanceAccuracy;
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
            String response = restTemplate.getForObject(url, String.class);
            if (response == null || response.isBlank()) {
                return List.of();
            }
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
        // First pass: collect all nodes from way geometries
        Map<Long, GraphNode> graph = new HashMap<>();
        long syntheticId = -1;

        for (OsmElement el : elements) {
            if (!"way".equals(el.type) || el.geometry == null || el.geometry.size() < 2) {
                continue;
            }

            List<GraphNode> wayNodes = new ArrayList<>();
            for (double[] pt : el.geometry) {
                double lat = pt[0];
                double lng = pt[1];
                long nid = syntheticId--;
                GraphNode node = new GraphNode(nid, lat, lng, Double.NaN);
                graph.put(nid, node);
                wayNodes.add(node);

                if (graph.size() > MAX_GRAPH_NODES) {
                    return graph;
                }
            }

            // Connect consecutive nodes
            for (int i = 0; i < wayNodes.size() - 1; i++) {
                GraphNode a = wayNodes.get(i);
                GraphNode b = wayNodes.get(i + 1);
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

        // Priority queue: states ordered by f = g + h
        // State: [nodeId, g(distSoFar), f_score, parentNodeId, depth]
        PriorityQueue<SearchState> openSet = new PriorityQueue<>(
                Comparator.comparingDouble(s -> s.fScore));

        // Track best (nodeId, distSoFar) states for each node+rounded distance bucket
        // to allow revisiting nodes at different distances
        Map<String, Double> bestG = new HashMap<>();
        Map<String, Long> cameFrom = new HashMap<>();
        Map<String, Double> distSoFar = new HashMap<>();

        long searchId = System.nanoTime();
        SearchState initial = new SearchState(startNodeId, 0.0, heuristic(0.0, 0.0, targetDistanceM), null, 0);
        openSet.add(initial);
        bestG.put(stateKey(startNodeId, 0), 0.0);
        distSoFar.put(stateKey(startNodeId, 0), 0.0);

        SearchState bestGoalState = null;
        double bestGoalScore = Double.POSITIVE_INFINITY;
        int iterations = 0;

        while (!openSet.isEmpty() && iterations < MAX_SEARCH_ITERATIONS) {
            iterations++;
            SearchState current = openSet.poll();
            if (current == null) continue;

            long nodeId = current.nodeId;
            double g = current.g;
            GraphNode node = graph.get(nodeId);
            if (node == null) continue;

            // Goal test: can we return to start and be within tolerance?
            double distToStart = haversineM(node.lat, node.lng, startNode.lat, startNode.lng);
            double totalDist = g + distToStart;
            double distError = Math.abs(totalDist - targetDistanceM);

            if (distError <= toleranceM && g > 0) {
                double score = distError + distToStart * 0.1;
                if (score < bestGoalScore) {
                    bestGoalScore = score;
                    bestGoalState = current;
                }
                // Continue searching for potentially better routes
            }

            // Also check if we should stop: if we found a goal and all remaining states have f > best goal f
            if (bestGoalState != null && current.fScore > bestGoalScore + toleranceM) {
                break;
            }

            // Expand neighbors
            for (GraphNode.Edge edge : node.neighbors) {
                GraphNode neighbor = graph.get(edge.targetId);
                if (neighbor == null) continue;

                double edgeCost = edge.distanceM + elevationWeight * Math.max(0, edge.elevationGainM);
                double newG = g + edgeCost;

                // Cap search depth by distance
                if (newG > targetDistanceM * 2.5) continue;

                // Prevent revisiting start too early
                if (edge.targetId == startNodeId && newG < targetDistanceM * 0.5) continue;

                // Discretize distance for state revisiting
                double distBucket = Math.round(newG / 50.0) * 50.0;
                String key = stateKey(edge.targetId, distBucket);

                Double prevBestG = bestG.get(key);
                if (prevBestG != null && prevBestG <= newG) continue;

                double h = heuristic(newG, distToStart, targetDistanceM);
                // For the heuristic, we need distance from neighbor to start
                double neighborDistToStart = haversineM(neighbor.lat, neighbor.lng, startNode.lat, startNode.lng);
                h = heuristic(newG, neighborDistToStart, targetDistanceM);

                double fScore = newG + h;
                bestG.put(key, newG);
                distSoFar.put(key, newG);

                SearchState next = new SearchState(edge.targetId, newG, fScore, nodeId, current.depth + 1);
                openSet.add(next);
                cameFrom.put(stateKey(edge.targetId, distBucket), nodeId);
            }
        }

        log.info("A* search completed: {} iterations, {} goal candidates", iterations, bestGoalState != null ? 1 : 0);

        if (bestGoalState == null) {
            return null;
        }

        // Reconstruct path from bestGoalState back to start
        List<Long> path = new ArrayList<>();
        // We need to reconstruct from the best goal state
        // Since we didn't store parent chain per state, we need a different approach

        // Simplified reconstruction: trace back through cameFrom using the node chain
        // Actually, let me store the parent chain directly in SearchState
        return reconstructPath(graph, startNodeId, bestGoalState, cameFrom, distSoFar);
    }

    private AStarResult reconstructPath(Map<Long, GraphNode> graph, Long startNodeId,
                                         SearchState goalState,
                                         Map<String, Long> cameFrom,
                                         Map<String, Double> distSoFar) {
        // Reconstruct by tracing back from goal to start using the cameFrom map
        // and the distance buckets
        List<Long> path = new ArrayList<>();
        long currentId = goalState.nodeId;
        double currentDist = goalState.g;

        path.add(currentId);

        // Walk back to start
        Set<Long> visited = new HashSet<>();
        visited.add(currentId);

        while (currentId != startNodeId) {
            double distBucket = Math.round(currentDist / 50.0) * 50.0;
            String key = stateKey(currentId, distBucket);
            Long parentId = cameFrom.get(key);

            if (parentId == null) {
                // Try nearby distance buckets
                boolean found = false;
                for (double offset = -50; offset <= 50; offset += 50) {
                    String altKey = stateKey(currentId, distBucket + offset);
                    parentId = cameFrom.get(altKey);
                    if (parentId != null) {
                        found = true;
                        break;
                    }
                }
                if (!found) break;
            }

            if (visited.contains(parentId)) break; // cycle detected
            visited.add(parentId);

            GraphNode parent = graph.get(parentId);
            GraphNode current = graph.get(currentId);
            if (parent != null && current != null) {
                currentDist -= haversineM(parent.lat, parent.lng, current.lat, current.lng);
            }

            path.add(parentId);
            currentId = parentId;
        }

        // Ensure path ends at start
        if (!path.isEmpty() && path.get(path.size() - 1) != startNodeId) {
            path.add(startNodeId);
        }

        // Reverse to get start -> goal
        Collections.reverse(path);

        // Compute actual total distance
        double totalDist = 0.0;
        for (int i = 0; i < path.size() - 1; i++) {
            GraphNode a = graph.get(path.get(i));
            GraphNode b = graph.get(path.get(i + 1));
            if (a != null && b != null) {
                totalDist += haversineM(a.lat, a.lng, b.lat, b.lng);
            }
        }
        // Add return to start
        if (path.size() >= 2) {
            GraphNode last = graph.get(path.get(path.size() - 1));
            GraphNode start = graph.get(startNodeId);
            if (last != null && start != null) {
                totalDist += haversineM(last.lat, last.lng, start.lat, start.lng);
                path.add(startNodeId);
            }
        }

        return new AStarResult(path, totalDist);
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

    private String stateKey(long nodeId, double distBucket) {
        return nodeId + "_" + ((long) distBucket);
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

    // --- Fallback: out-and-back route when OSM data is sparse ---

    RoutePlanResult generateFallbackRoute(double startLat, double startLng, double targetDistanceKm) {
        double targetDistanceM = targetDistanceKm * 1000.0;
        double halfDist = targetDistanceM / 2.0;

        // Generate a simple out-and-back route in the direction of east/northeast
        double bearing = Math.toRadians(45);
        int numPoints = Math.max(4, (int) Math.round(targetDistanceKm * 4));
        List<double[]> waypoints = new ArrayList<>();

        double lat = startLat;
        double lng = startLng;
        double stepDist = halfDist / numPoints;

        // Out leg
        for (int i = 0; i <= numPoints; i++) {
            waypoints.add(new double[]{lat, lng});
            if (i < numPoints) {
                double[] next = destinationPoint(lat, lng, stepDist, bearing);
                lat = next[0];
                lng = next[1];
            }
        }

        // Back leg
        bearing = (bearing + Math.PI) % (2 * Math.PI);
        for (int i = 0; i < numPoints; i++) {
            double[] next = destinationPoint(lat, lng, stepDist, bearing);
            lat = next[0];
            lng = next[1];
            waypoints.add(new double[]{lat, lng});
        }

        double actualDistKm = targetDistanceKm;
        int estimatedTimeMin = (int) Math.round(targetDistanceKm / RUNNING_SPEED_KPH * 60.0);

        log.info("Generated fallback out-and-back route with {} waypoints.", waypoints.size());
        return new RoutePlanResult(waypoints, actualDistKm, 0.0, estimatedTimeMin, 1.0);
    }

    private double[] destinationPoint(double lat, double lng, double distanceM, double bearingRad) {
        double angularDist = distanceM / EARTH_RADIUS_M;
        double lat1 = Math.toRadians(lat);
        double lng1 = Math.toRadians(lng);

        double lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDist)
                + Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearingRad));
        double lng2 = lng1 + Math.atan2(
                Math.sin(bearingRad) * Math.sin(angularDist) * Math.cos(lat1),
                Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2));

        return new double[]{Math.toDegrees(lat2), Math.toDegrees(lng2)};
    }

    // --- Inner class for A* search state ---

    static class SearchState {
        final long nodeId;
        final double g;
        final double fScore;
        final Long parentNodeId;
        final int depth;

        SearchState(long nodeId, double g, double fScore, Long parentNodeId, int depth) {
            this.nodeId = nodeId;
            this.g = g;
            this.fScore = fScore;
            this.parentNodeId = parentNodeId;
            this.depth = depth;
        }
    }
}
