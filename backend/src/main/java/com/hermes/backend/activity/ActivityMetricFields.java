package com.hermes.backend.activity;

import jakarta.persistence.Embedded;
import jakarta.persistence.MappedSuperclass;

@MappedSuperclass
public abstract class ActivityMetricFields extends ActivityCoreFields {

    @Embedded
    private ActivityMetrics metrics = new ActivityMetrics();

    public Double getAverageHeartRate() { return metrics.getAverageHeartRate(); }
    public void setAverageHeartRate(Double value) { metrics.setAverageHeartRate(value); }

    public Double getMaxHeartRate() { return metrics.getMaxHeartRate(); }
    public void setMaxHeartRate(Double value) { metrics.setMaxHeartRate(value); }

    public Double getTotalElevationGain() { return metrics.getTotalElevationGain(); }
    public void setTotalElevationGain(Double value) { metrics.setTotalElevationGain(value); }

    public Integer getCalories() { return metrics.getCalories(); }
    public void setCalories(Integer value) { metrics.setCalories(value); }

    public Double getAverageCadence() { return metrics.getAverageCadence(); }
    public void setAverageCadence(Double value) { metrics.setAverageCadence(value); }

    public Double getAverageWatts() { return metrics.getAverageWatts(); }
    public void setAverageWatts(Double value) { metrics.setAverageWatts(value); }

    public Double getMaxSpeedMps() { return metrics.getMaxSpeedMps(); }
    public void setMaxSpeedMps(Double value) { metrics.setMaxSpeedMps(value); }

    public Integer getSufferScore() { return metrics.getSufferScore(); }
    public void setSufferScore(Integer value) { metrics.setSufferScore(value); }

    public String getRoutePreviewPath() { return metrics.getRoutePreviewPath(); }
    public void setRoutePreviewPath(String value) { metrics.setRoutePreviewPath(value); }

    public Double getRoutePreviewStartX() { return metrics.getRoutePreviewStartX(); }
    public void setRoutePreviewStartX(Double value) { metrics.setRoutePreviewStartX(value); }

    public Double getRoutePreviewStartY() { return metrics.getRoutePreviewStartY(); }
    public void setRoutePreviewStartY(Double value) { metrics.setRoutePreviewStartY(value); }

    public Double getRoutePreviewFinishX() { return metrics.getRoutePreviewFinishX(); }
    public void setRoutePreviewFinishX(Double value) { metrics.setRoutePreviewFinishX(value); }

    public Double getRoutePreviewFinishY() { return metrics.getRoutePreviewFinishY(); }
    public void setRoutePreviewFinishY(Double value) { metrics.setRoutePreviewFinishY(value); }

    public Integer getPacePenaltySecPerKm() { return metrics.getPacePenaltySecPerKm(); }
    public void setPacePenaltySecPerKm(Integer value) { metrics.setPacePenaltySecPerKm(value); }

    public Boolean getWeatherAdjusted() { return metrics.getWeatherAdjusted(); }
    public void setWeatherAdjusted(Boolean value) { metrics.setWeatherAdjusted(value); }
}
