package com.hermes.backend;

import java.time.LocalDateTime;

public record ActivityFeedItem(
        Long id,
        String name,
        String stravaId,
        double distanceKm,
        long movingTimeSeconds,
        String startDate,
        ImportProvider provider,
        ActivityType activityType,
        LocalDateTime startTime,
        Double distanceMeters,
        Long durationSeconds,
        String sourceFileName,
        LocalDateTime createdAt,
        Double averageHeartRate,
        Double maxHeartRate,
        Double totalElevationGain,
        Integer calories,
        Double averageCadence,
        Double averageWatts,
        Double maxSpeedMps,
        Integer sufferScore,
        Long shoeId,
        String shoeName
) {
}
