package com.hermes.backend;

import java.time.LocalDateTime;
import java.util.List;

public record ParsedActivityData(
        String name,
        ActivityType activityType,
        LocalDateTime startTime,
        Double distanceMeters,
        Long durationSeconds,
        List<ParsedTrackPoint> points,
        Double averageHeartRate,
        Double maxHeartRate
) {
}
