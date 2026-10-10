package com.hermes.backend.activity;

import jakarta.persistence.Embedded;
import jakarta.persistence.MappedSuperclass;

@MappedSuperclass
public abstract class ActivityMetricFields extends ActivityCoreFields {

    @Embedded
    private ActivityMetrics metrics = new ActivityMetrics();

    /**
     * Hibernate loads an embedded object as null when every one of its columns is NULL, replacing the
     * initializer above, so a run with no heart rate, elevation, weather adjustment or other metric comes
     * back with {@code metrics == null}. Reads treat that as "no value"; a write creates the object.
     */
    private ActivityMetrics metrics() {
        if (metrics == null) {
            metrics = new ActivityMetrics();
        }
        return metrics;
    }

    public Double getAverageHeartRate() { return metrics == null ? null : metrics.getAverageHeartRate(); }
    public void setAverageHeartRate(Double value) { metrics().setAverageHeartRate(value); }

    public Double getMaxHeartRate() { return metrics == null ? null : metrics.getMaxHeartRate(); }
    public void setMaxHeartRate(Double value) { metrics().setMaxHeartRate(value); }

    public Double getTotalElevationGain() { return metrics == null ? null : metrics.getTotalElevationGain(); }
    public void setTotalElevationGain(Double value) { metrics().setTotalElevationGain(value); }

    public Integer getCalories() { return metrics == null ? null : metrics.getCalories(); }
    public void setCalories(Integer value) { metrics().setCalories(value); }

    public Double getAverageCadence() { return metrics == null ? null : metrics.getAverageCadence(); }
    public void setAverageCadence(Double value) { metrics().setAverageCadence(value); }

    public Double getAverageWatts() { return metrics == null ? null : metrics.getAverageWatts(); }
    public void setAverageWatts(Double value) { metrics().setAverageWatts(value); }

    public Double getMaxSpeedMps() { return metrics == null ? null : metrics.getMaxSpeedMps(); }
    public void setMaxSpeedMps(Double value) { metrics().setMaxSpeedMps(value); }

    public Integer getSufferScore() { return metrics == null ? null : metrics.getSufferScore(); }
    public void setSufferScore(Integer value) { metrics().setSufferScore(value); }

    public String getRoutePreviewPath() { return metrics == null ? null : metrics.getRoutePreviewPath(); }
    public void setRoutePreviewPath(String value) { metrics().setRoutePreviewPath(value); }

    public Double getRoutePreviewStartX() { return metrics == null ? null : metrics.getRoutePreviewStartX(); }
    public void setRoutePreviewStartX(Double value) { metrics().setRoutePreviewStartX(value); }

    public Double getRoutePreviewStartY() { return metrics == null ? null : metrics.getRoutePreviewStartY(); }
    public void setRoutePreviewStartY(Double value) { metrics().setRoutePreviewStartY(value); }

    public Double getRoutePreviewFinishX() { return metrics == null ? null : metrics.getRoutePreviewFinishX(); }
    public void setRoutePreviewFinishX(Double value) { metrics().setRoutePreviewFinishX(value); }

    public Double getRoutePreviewFinishY() { return metrics == null ? null : metrics.getRoutePreviewFinishY(); }
    public void setRoutePreviewFinishY(Double value) { metrics().setRoutePreviewFinishY(value); }

    public Integer getPacePenaltySecPerKm() { return metrics == null ? null : metrics.getPacePenaltySecPerKm(); }
    public void setPacePenaltySecPerKm(Integer value) { metrics().setPacePenaltySecPerKm(value); }

    public Boolean getWeatherAdjusted() { return metrics == null ? null : metrics.getWeatherAdjusted(); }
    public void setWeatherAdjusted(Boolean value) { metrics().setWeatherAdjusted(value); }
}
