package com.hermes.backend.activity;

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

    /** True for a run fetched from the Strava API, whose start is the runner's own clock; a run from a file holds UTC. */
    Boolean getStravaApiSourced();

    /** True for a run with no start time of its own, which {@link #getEffectiveStartTime()} files under the day it was added. */
    Boolean getUndated();
}
