package com.hermes.backend;

import java.util.List;

public record RouteParametersDTO(
        String routeHexColor,
        List<String> anchorPoints
) {
    public RouteParametersDTO {
        anchorPoints = anchorPoints == null ? List.of() : List.copyOf(anchorPoints);
    }
}
