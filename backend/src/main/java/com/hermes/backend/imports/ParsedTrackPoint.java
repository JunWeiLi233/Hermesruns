package com.hermes.backend.imports;

public record ParsedTrackPoint(
        double latitude,
        double longitude,
        Integer elapsedSeconds,
        Double distanceMeters,
        Double elevationMeters,
        Integer heartRate,
        Integer cadence,
        Double groundContactTimeMs,
        Double verticalOscillationMm
) {
    public ParsedTrackPoint(double latitude, double longitude) {
        this(latitude, longitude, null, null, null, null, null, null, null);
    }
}
