package com.hermes.backend;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(
        name = "planned_route",
        indexes = {
                @Index(name = "idx_planned_route_runner_created", columnList = "runner_id, created_at")
        }
)
public class PlannedRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(nullable = false)
    private Double startLat;

    @Column(nullable = false)
    private Double startLng;

    @Column(nullable = false)
    private Double targetDistanceKm;

    @Column(nullable = false, length = 20)
    private String elevationPreference;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String waypoints;

    @Column(nullable = false)
    private Double actualDistanceKm;

    @Column(nullable = false)
    private Double elevationGainMeters;

    @Column(nullable = false)
    private Integer estimatedTimeMinutes;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    // --- getters & setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }

    public Double getStartLat() { return startLat; }
    public void setStartLat(Double startLat) { this.startLat = startLat; }

    public Double getStartLng() { return startLng; }
    public void setStartLng(Double startLng) { this.startLng = startLng; }

    public Double getTargetDistanceKm() { return targetDistanceKm; }
    public void setTargetDistanceKm(Double targetDistanceKm) { this.targetDistanceKm = targetDistanceKm; }

    public String getElevationPreference() { return elevationPreference; }
    public void setElevationPreference(String elevationPreference) { this.elevationPreference = elevationPreference; }

    public String getWaypoints() { return waypoints; }
    public void setWaypoints(String waypoints) { this.waypoints = waypoints; }

    public Double getActualDistanceKm() { return actualDistanceKm; }
    public void setActualDistanceKm(Double actualDistanceKm) { this.actualDistanceKm = actualDistanceKm; }

    public Double getElevationGainMeters() { return elevationGainMeters; }
    public void setElevationGainMeters(Double elevationGainMeters) { this.elevationGainMeters = elevationGainMeters; }

    public Integer getEstimatedTimeMinutes() { return estimatedTimeMinutes; }
    public void setEstimatedTimeMinutes(Integer estimatedTimeMinutes) { this.estimatedTimeMinutes = estimatedTimeMinutes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
