package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "activities",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_activity_runner_provider_checksum",
                        columnNames = {"runner_id", "provider", "source_checksum"}
                )
        },
        indexes = {
                @Index(name = "idx_activity_runner", columnList = "runner_id"),
                @Index(name = "idx_activity_runner_type", columnList = "runner_id, activityType"),
                @Index(name = "idx_activity_runner_start_time", columnList = "runner_id, startTime"),
                @Index(name = "idx_activity_provider_checksum", columnList = "provider, source_checksum"),
                @Index(name = "idx_activity_strava_id", columnList = "stravaId"),
                @Index(name = "idx_activity_shoe", columnList = "shoe_id")
        }
)
public class Activity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "runner_id")
    private Runner runner;

    private String name;

    // --- YOUR ORIGINAL FIELDS (Crucial for Strava Sync & Frontend) ---
    private String stravaId;
    private double distanceKm;
    private int movingTimeSeconds;
    private String startDate;

    // --- GPS / import fields (FIT, GPX, TCX from file imports) ---
    @Enumerated(EnumType.STRING)
    private ImportProvider provider;

    @Enumerated(EnumType.STRING)
    private ActivityType activityType;

    private LocalDateTime startTime;
    private Double distanceMeters;
    private Long durationSeconds;
    private String sourceFileName;

    @Column(name = "source_checksum", length = 64)
    private String sourceChecksum;

    private LocalDateTime createdAt;

    // --- PERFORMANCE METRICS ---
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

    // --- WEATHER ADJUSTMENT ---
    private Integer pacePenaltySecPerKm;
    private Boolean weatherAdjusted;

    @ManyToOne
    @JoinColumn(name = "shoe_id")
    private Shoe shoe;

    @OneToMany(mappedBy = "activity", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequenceIndex ASC")
    private List<ActivityPoint> points = new ArrayList<>();

    // --- AUTOMATIC TIMESTAMP ---
    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // --- HELPER METHOD FOR GPS POINTS ---
    public void addPoint(ActivityPoint point) {
        point.setActivity(this);
        points.add(point);
    }

    // ==========================================
    // STANDARD GETTERS AND SETTERS
    // ==========================================

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @JsonIgnore
    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    // Your Strava Getters/Setters
    public String getStravaId() { return stravaId; }
    public void setStravaId(String stravaId) { this.stravaId = stravaId; }

    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }

    public int getMovingTimeSeconds() { return movingTimeSeconds; }
    public void setMovingTimeSeconds(int movingTimeSeconds) { this.movingTimeSeconds = movingTimeSeconds; }

    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }

    // Contributor's Getters/Setters
    public ImportProvider getProvider() { return provider; }
    public void setProvider(ImportProvider provider) { this.provider = provider; }

    public ActivityType getActivityType() { return activityType; }
    public void setActivityType(ActivityType activityType) { this.activityType = activityType; }

    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

    public Double getDistanceMeters() { return distanceMeters; }
    public void setDistanceMeters(Double distanceMeters) { this.distanceMeters = distanceMeters; }

    public Long getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Long durationSeconds) { this.durationSeconds = durationSeconds; }

    public String getSourceFileName() { return sourceFileName; }
    public void setSourceFileName(String sourceFileName) { this.sourceFileName = sourceFileName; }

    public String getSourceChecksum() { return sourceChecksum; }
    public void setSourceChecksum(String sourceChecksum) { this.sourceChecksum = sourceChecksum; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @JsonIgnore
    public List<ActivityPoint> getPoints() { return points; }
    public void setPoints(List<ActivityPoint> points) { this.points = points; }

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

    @JsonIgnore
    public Shoe getShoe() { return shoe; }
    public void setShoe(Shoe shoe) { this.shoe = shoe; }

    public Long getShoeId() { return shoe != null ? shoe.getId() : null; }
    public String getShoeName() {
        if (shoe == null) return null;
        String b = shoe.getBrand() != null ? shoe.getBrand() : "";
        String m = shoe.getModel() != null ? shoe.getModel() : "";
        String combined = (b + " " + m).trim();
        return combined.isEmpty() ? shoe.getNickname() : combined;
    }
}
