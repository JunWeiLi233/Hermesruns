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

    @Embedded
    private ActivityMetrics metrics = new ActivityMetrics();

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

    // --- PERFORMANCE METRICS DELEGATES ---
    public Double getAverageHeartRate() { return metrics.getAverageHeartRate(); }
    public void setAverageHeartRate(Double v) { metrics.setAverageHeartRate(v); }

    public Double getMaxHeartRate() { return metrics.getMaxHeartRate(); }
    public void setMaxHeartRate(Double v) { metrics.setMaxHeartRate(v); }

    public Double getTotalElevationGain() { return metrics.getTotalElevationGain(); }
    public void setTotalElevationGain(Double v) { metrics.setTotalElevationGain(v); }

    public Integer getCalories() { return metrics.getCalories(); }
    public void setCalories(Integer v) { metrics.setCalories(v); }

    public Double getAverageCadence() { return metrics.getAverageCadence(); }
    public void setAverageCadence(Double v) { metrics.setAverageCadence(v); }

    public Double getAverageWatts() { return metrics.getAverageWatts(); }
    public void setAverageWatts(Double v) { metrics.setAverageWatts(v); }

    public Double getMaxSpeedMps() { return metrics.getMaxSpeedMps(); }
    public void setMaxSpeedMps(Double v) { metrics.setMaxSpeedMps(v); }

    public Integer getSufferScore() { return metrics.getSufferScore(); }
    public void setSufferScore(Integer v) { metrics.setSufferScore(v); }

    public String getRoutePreviewPath() { return metrics.getRoutePreviewPath(); }
    public void setRoutePreviewPath(String v) { metrics.setRoutePreviewPath(v); }

    public Double getRoutePreviewStartX() { return metrics.getRoutePreviewStartX(); }
    public void setRoutePreviewStartX(Double v) { metrics.setRoutePreviewStartX(v); }

    public Double getRoutePreviewStartY() { return metrics.getRoutePreviewStartY(); }
    public void setRoutePreviewStartY(Double v) { metrics.setRoutePreviewStartY(v); }

    public Double getRoutePreviewFinishX() { return metrics.getRoutePreviewFinishX(); }
    public void setRoutePreviewFinishX(Double v) { metrics.setRoutePreviewFinishX(v); }

    public Double getRoutePreviewFinishY() { return metrics.getRoutePreviewFinishY(); }
    public void setRoutePreviewFinishY(Double v) { metrics.setRoutePreviewFinishY(v); }

    public Integer getPacePenaltySecPerKm() { return metrics.getPacePenaltySecPerKm(); }
    public void setPacePenaltySecPerKm(Integer v) { metrics.setPacePenaltySecPerKm(v); }

    public Boolean getWeatherAdjusted() { return metrics.getWeatherAdjusted(); }
    public void setWeatherAdjusted(Boolean v) { metrics.setWeatherAdjusted(v); }

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
