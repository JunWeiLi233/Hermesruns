package com.hermes.backend;

import java.util.List;

public record RoutePathExtractionResultDTO(
        RouteParametersDTO routeParameters,
        List<RoutePixelPointDTO> points,
        int pointCount,
        int maskPixelCount,
        int skeletonPixelCount
) {
    public RoutePathExtractionResultDTO {
        points = points == null ? List.of() : List.copyOf(points);
    }
}
