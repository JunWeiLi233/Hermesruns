package com.hermes.backend;

public record ParsedTrackPoint(
        double latitude,
        double longitude,
        Integer elapsedSeconds,
        Double distanceMeters,
        Double elevationMeters,
        Integer heartRate,
        Integer cadence
) {
    public ParsedTrackPoint(double latitude, double longitude) {
        this(latitude, longitude, null, null, null, null, null);
    }
}
