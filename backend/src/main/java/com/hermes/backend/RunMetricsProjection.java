package com.hermes.backend;

import java.time.LocalDateTime;

/**
 * Lightweight run metrics projection for coach aggregation on small-RAM servers.
 */
public interface RunMetricsProjection {
    Double getAverageHeartRate();
    Double getMaxHeartRate();
    Integer getMovingTimeSeconds();
    Long getDurationSeconds();
    Double getDistanceKm();
    Double getDistanceMeters();
    LocalDateTime getEffectiveStartTime();
}
