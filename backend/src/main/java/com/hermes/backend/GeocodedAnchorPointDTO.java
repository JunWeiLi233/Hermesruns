package com.hermes.backend;

public record GeocodedAnchorPointDTO(
        String label,
        double latitude,
        double longitude,
        String formattedAddress
) {
    public GeocodedAnchorPointDTO {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Anchor label is required.");
        }
        if (formattedAddress == null || formattedAddress.isBlank()) {
            throw new IllegalArgumentException("Formatted address is required.");
        }
    }
}
