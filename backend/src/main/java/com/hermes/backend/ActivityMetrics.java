package com.hermes.backend;

import jakarta.persistence.Embeddable;

@Embeddable
public class ActivityMetrics {

    private Double averageHeartRate;
    private Double maxHeartRate;
    private Double totalElevationGain;
    private Integer calories;
    private Double averageCadence;
    private Double averageWatts;
    private Double maxSpeedMps;
    private Integer sufferScore;
    private String routePreviewPath;
    private Double routePreviewStartX;
    private Double routePreviewStartY;
    private Double routePreviewFinishX;
    private Double routePreviewFinishY;
    private Integer pacePenaltySecPerKm;
    private Boolean weatherAdjusted;

    public Double getAverageHeartRate() { return averageHeartRate; }
    public void setAverageHeartRate(Double averageHeartRate) { this.averageHeartRate = averageHeartRate; }

    public Double getMaxHeartRate() { return maxHeartRate; }
    public void setMaxHeartRate(Double maxHeartRate) { this.maxHeartRate = maxHeartRate; }

    public Double getTotalElevationGain() { return totalElevationGain; }
    public void setTotalElevationGain(Double totalElevationGain) { this.totalElevationGain = totalElevationGain; }

    public Integer getCalories() { return calories; }
    public void setCalories(Integer calories) { this.calories = calories; }

    public Double getAverageCadence() { return averageCadence; }
    public void setAverageCadence(Double averageCadence) { this.averageCadence = averageCadence; }

    public Double getAverageWatts() { return averageWatts; }
    public void setAverageWatts(Double averageWatts) { this.averageWatts = averageWatts; }

    public Double getMaxSpeedMps() { return maxSpeedMps; }
    public void setMaxSpeedMps(Double maxSpeedMps) { this.maxSpeedMps = maxSpeedMps; }

    public Integer getSufferScore() { return sufferScore; }
    public void setSufferScore(Integer sufferScore) { this.sufferScore = sufferScore; }

    public String getRoutePreviewPath() { return routePreviewPath; }
    public void setRoutePreviewPath(String routePreviewPath) { this.routePreviewPath = routePreviewPath; }

    public Double getRoutePreviewStartX() { return routePreviewStartX; }
    public void setRoutePreviewStartX(Double routePreviewStartX) { this.routePreviewStartX = routePreviewStartX; }

    public Double getRoutePreviewStartY() { return routePreviewStartY; }
    public void setRoutePreviewStartY(Double routePreviewStartY) { this.routePreviewStartY = routePreviewStartY; }

    public Double getRoutePreviewFinishX() { return routePreviewFinishX; }
    public void setRoutePreviewFinishX(Double routePreviewFinishX) { this.routePreviewFinishX = routePreviewFinishX; }

    public Double getRoutePreviewFinishY() { return routePreviewFinishY; }
    public void setRoutePreviewFinishY(Double routePreviewFinishY) { this.routePreviewFinishY = routePreviewFinishY; }

    public Integer getPacePenaltySecPerKm() { return pacePenaltySecPerKm; }
    public void setPacePenaltySecPerKm(Integer pacePenaltySecPerKm) { this.pacePenaltySecPerKm = pacePenaltySecPerKm; }

    public Boolean getWeatherAdjusted() { return weatherAdjusted; }
    public void setWeatherAdjusted(Boolean weatherAdjusted) { this.weatherAdjusted = weatherAdjusted; }
}
