package com.hermes.backend;

import java.util.List;

public record RoutePathExtractionResultDTO(
        RouteParametersDTO routeParameters,
        List<RoutePixelPointDTO> points,
        int pointCount,
        int maskPixelCount,
        int skeletonPixelCount,
        String routeSource,
        List<String> candidateErrors
) {
    public RoutePathExtractionResultDTO(
            RouteParametersDTO routeParameters,
            List<RoutePixelPointDTO> points,
            int pointCount,
            int maskPixelCount,
            int skeletonPixelCount
    ) {
        this(routeParameters, points, pointCount, maskPixelCount, skeletonPixelCount, "", List.of());
    }

    public RoutePathExtractionResultDTO {
        points = points == null ? List.of() : List.copyOf(points);
        routeSource = routeSource == null ? "" : routeSource;
        candidateErrors = candidateErrors == null ? List.of() : List.copyOf(candidateErrors);
    }
}
