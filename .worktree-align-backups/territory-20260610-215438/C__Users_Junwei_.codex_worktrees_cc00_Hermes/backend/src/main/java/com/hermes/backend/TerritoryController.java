package com.hermes.backend;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public ResponseEntity<?> getTerritory(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch
    ) {
        Optional<Runner> activeRunner = authService.findByAuthorizationHeader(authHeader);
        if (activeRunner.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired session token."));
        }

        Long runnerId = activeRunner.get().getId();
        String signature = territoryService.territoryMapSignature(runnerId);
        if (ifNoneMatchContains(ifNoneMatch, signature)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .header("ETag", quoteEntityTag(signature))
                    .build();
        }

        Object response = territoryService.buildTerritoryMap(activeRunner.get());
        String responseSignature = territoryService.territoryMapSignature(runnerId);
        return ResponseEntity.ok()
                .header("ETag", quoteEntityTag(responseSignature))
                .body(response);
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
    public ResponseEntity<?> getPolygons(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch,
            @RequestParam(value = "cells", required = false, defaultValue = "true") String cellsParam,
            @RequestParam(value = "initial", required = false, defaultValue = "false") String initialParam
    ) {
        Optional<Runner> activeRunner = authService.findByAuthorizationHeader(authHeader);
        if (activeRunner.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or expired session token."));
        }

        boolean includeCells = !"false".equalsIgnoreCase(cellsParam);
        boolean initialOnly = "true".equalsIgnoreCase(initialParam);

        Long userId = activeRunner.get().getId();
        String signature = territoryService.polygonResponseSignature(userId);
        if (ifNoneMatchContains(ifNoneMatch, signature)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .header("ETag", quoteEntityTag(signature))
                    .header("X-Hermes-Territory-Polygon-Signature", signature)
                    .build();
        }

        TerritoryService.PolygonResponse response = territoryService.buildPolygonResponse(userId, includeCells);
        Object responseBody = initialOnly
                ? territoryService.toInitialGlobalPolygonResponse(response)
                : response;
        String responseSignature = territoryService.polygonResponseSignature(userId);
        return ResponseEntity.ok()
                .header("ETag", quoteEntityTag(responseSignature))
                .header("X-Hermes-Territory-Polygon-Signature", responseSignature)
                .body(responseBody);
    }

    private static boolean ifNoneMatchContains(String ifNoneMatch, String signature) {
        if (ifNoneMatch == null || ifNoneMatch.isBlank() || signature == null || signature.isBlank()) {
            return false;
        }
        for (String candidate : ifNoneMatch.split(",")) {
            String normalized = normalizeEntityTag(candidate);
            if ("*".equals(normalized) || signature.equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeEntityTag(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.startsWith("W/")) {
            normalized = normalized.substring(2).trim();
        }
        if (normalized.length() >= 2 && normalized.startsWith("\"") && normalized.endsWith("\"")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        return normalized;
    }

    private static String quoteEntityTag(String value) {
        return "\"" + String.valueOf(value).replace("\"", "") + "\"";
    }
}
