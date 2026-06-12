package com.hermes.backend;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/route")
public class RoutePlannerController {

    private static final Logger log = LoggerFactory.getLogger(RoutePlannerController.class);

    private final AuthService authService;
    private final RoutePlannerService routePlannerService;
    private final PlannedRouteRepository plannedRouteRepository;
    private final ObjectMapper objectMapper;

    public RoutePlannerController(AuthService authService,
                                  RoutePlannerService routePlannerService,
                                  PlannedRouteRepository plannedRouteRepository,
                                  ObjectMapper objectMapper) {
        this.authService = authService;
        this.routePlannerService = routePlannerService;
        this.plannedRouteRepository = plannedRouteRepository;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/plan")
    public ResponseEntity<?> planRoute(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody RoutePlanRequest request
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(auth);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }

        if (request == null) {
            return error(HttpStatus.BAD_REQUEST, "Request body is required.");
        }

        if (request.startLat() == null || request.startLng() == null) {
            return error(HttpStatus.BAD_REQUEST, "startLat and startLng are required.");
        }

        if (request.targetDistanceKm() == null || request.targetDistanceKm() <= 0) {
            return error(HttpStatus.BAD_REQUEST, "targetDistanceKm must be positive.");
        }

        if (request.targetDistanceKm() > 50) {
            return error(HttpStatus.BAD_REQUEST, "targetDistanceKm must not exceed 50 km.");
        }

        try {
            Runner runner = runnerOpt.get();
            String elevationPreference = request.elevationPreference() != null
                    ? request.elevationPreference() : "rolling";

            RoutePlannerService.RoutePlanResult result = routePlannerService.planRoute(
                    request.startLat(),
                    request.startLng(),
                    request.targetDistanceKm(),
                    elevationPreference
            );

            PlannedRoute saved = null;
            if (result.streetGraphBacked && result.waypoints != null && result.waypoints.size() >= 2) {
                saved = new PlannedRoute();
                saved.setRunner(runner);
                saved.setStartLat(request.startLat());
                saved.setStartLng(request.startLng());
                saved.setTargetDistanceKm(request.targetDistanceKm());
                saved.setElevationPreference(elevationPreference);
                saved.setWaypoints(toWaypointsJson(result.waypoints));
                saved.setActualDistanceKm(result.actualDistanceKm);
                saved.setElevationGainMeters(result.elevationGainMeters);
                saved.setEstimatedTimeMinutes(result.estimatedTimeMinutes);
                saved.setCreatedAt(LocalDateTime.now());
                plannedRouteRepository.save(saved);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("id", saved != null ? saved.getId() : null);
            response.put("waypoints", result.waypoints);
            response.put("actualDistanceKm", round2(result.actualDistanceKm));
            response.put("elevationGainMeters", round2(result.elevationGainMeters));
            response.put("estimatedTimeMinutes", result.estimatedTimeMinutes);
            response.put("distanceAccuracy", round2(result.distanceAccuracy));
            response.put("streetGraphBacked", result.streetGraphBacked);
            if (!result.streetGraphBacked) {
                response.put("message", "No street-graph route was available near that start point.");
            }

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {
            return error(HttpStatus.BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            log.error("Route planning failed", e);
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "Route planning failed. Try a different location or distance.");
        }
    }

    @GetMapping("/plan/recent")
    public ResponseEntity<?> recentRoutes(
            @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        Optional<Runner> runnerOpt = authService.findByAuthorizationHeader(auth);
        if (runnerOpt.isEmpty()) {
            return unauthorized();
        }

        try {
            Runner runner = runnerOpt.get();
            List<PlannedRoute> routes = plannedRouteRepository.findTop5ByRunnerOrderByCreatedAtDesc(runner);

            List<Map<String, Object>> result = routes.stream().map(r -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", r.getId());
                map.put("startLat", r.getStartLat());
                map.put("startLng", r.getStartLng());
                map.put("targetDistanceKm", r.getTargetDistanceKm());
                map.put("elevationPreference", r.getElevationPreference());
                map.put("actualDistanceKm", round2(r.getActualDistanceKm()));
                map.put("elevationGainMeters", round2(r.getElevationGainMeters()));
                map.put("estimatedTimeMinutes", r.getEstimatedTimeMinutes());
                map.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
                map.put("streetGraphBacked", true);
                try {
                    map.put("waypoints", objectMapper.readValue(r.getWaypoints(), List.class));
                } catch (JsonProcessingException e) {
                    map.put("waypoints", List.of());
                }
                return map;
            }).collect(Collectors.toList());

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("Failed to fetch recent routes", e);
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to fetch recent routes.");
        }
    }

    // --- Helpers ---

    private String toWaypointsJson(List<double[]> waypoints) {
        try {
            return objectMapper.writeValueAsString(waypoints);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize waypoints", e);
            return "[]";
        }
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private ResponseEntity<Map<String, String>> unauthorized() {
        return error(HttpStatus.UNAUTHORIZED, "Invalid or expired session token.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", message);
        return ResponseEntity.status(status).body(response);
    }

    // --- Request/Response records ---

    public record RoutePlanRequest(
            Double startLat,
            Double startLng,
            Double targetDistanceKm,
            String elevationPreference
    ) {}
}
