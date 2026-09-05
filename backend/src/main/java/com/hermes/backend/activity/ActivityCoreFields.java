package com.hermes.backend.activity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import java.time.LocalDateTime;

@MappedSuperclass
public abstract class ActivityCoreFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "runner_id")
    private Runner runner;

    private String name;

    private String stravaId;
    private double distanceKm;
    private int movingTimeSeconds;
    private String startDate;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    @JsonIgnore
    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getStravaId() { return stravaId; }
    public void setStravaId(String stravaId) { this.stravaId = stravaId; }

    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }

    public int getMovingTimeSeconds() { return movingTimeSeconds; }
    public void setMovingTimeSeconds(int movingTimeSeconds) { this.movingTimeSeconds = movingTimeSeconds; }

    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }

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
}
