package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/territory")
public class TerritoryController {
    private final AuthService authService;
    private final TerritoryService territoryService;

    public TerritoryController(AuthService authService, TerritoryService territoryService) {
        this.authService = authService;
        this.territoryService = territoryService;
    }

    /** Existing zone/grid endpoint — MUST NOT change shape. */
    @GetMapping
    public ResponseEntity<?> getTerritory(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeRunner = authService.findByAuthorizationHeader(authHeader);
        if (activeRunner.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired session token."));
        }

        return ResponseEntity.ok(territoryService.buildTerritoryMap(activeRunner.get()));
    }

    /**
     * GET /api/territory/polygons
     * Returns the authenticated runner's closed-loop territory polygons.
     * Response shape:
     * {
     *   "polygons": [{"id", "activityId", "areaSquareMeters", "coordinates": [[lat,lng],...], "createdAt"}],
     *   "totalAreaSquareMeters": double,
     *   "polygonCount": int
     * }
     */
    @GetMapping("/polygons")
    public ResponseEntity<?> getPolygons(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<Runner> activeRunner = authService.findByAuthorizationHeader(authHeader);
        if (activeRunner.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired session token."));
        }

        return ResponseEntity.ok(territoryService.buildPolygonResponse(activeRunner.get().getId()));
    }
}
