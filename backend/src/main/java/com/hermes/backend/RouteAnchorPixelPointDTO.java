package com.hermes.backend;

public record RouteAnchorPixelPointDTO(
        String label,
        int x,
        int y
) {
    public RouteAnchorPixelPointDTO {
        label = label == null ? "" : label.trim();
        if (label.isBlank()) {
            throw new IllegalArgumentException("Anchor label must not be blank.");
        }
    }
}
