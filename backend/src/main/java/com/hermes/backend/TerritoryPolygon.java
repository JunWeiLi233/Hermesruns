package com.hermes.backend;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Represents one closed-loop polygon extracted from a runner's GPS activity.
 * Each row stores the loop boundary as a semicolon-separated list of "lat,lng" pairs,
 * the computed area, and back-references to the source activity and user.
 */
@Entity
@Table(
        name = "territory_polygons",
        indexes = {
                @Index(name = "idx_territory_polygon_user", columnList = "userId"),
                @Index(name = "idx_territory_polygon_activity", columnList = "activityId")
        }
)
public class TerritoryPolygon {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK to the runner (denormalized for fast per-user queries without joining activities). */
    @Column(nullable = false)
    private Long userId;

    /** FK to the source Activity that produced this polygon. */
    @Column(nullable = false)
    private Long activityId;

    /**
     * Encoded coordinate list: "lat1,lng1;lat2,lng2;..." H2- and Postgres-compatible TEXT column.
     * Parsed back to [[lat,lng],...] in the API layer.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String coordinates;

    /** Polygon area in square metres, computed via equirectangular shoelace formula. */
    @Column(nullable = false)
    private Double areaSquareMeters;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    // --- Getters and setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }

    public String getCoordinates() { return coordinates; }
    public void setCoordinates(String coordinates) { this.coordinates = coordinates; }

    public Double getAreaSquareMeters() { return areaSquareMeters; }
    public void setAreaSquareMeters(Double areaSquareMeters) { this.areaSquareMeters = areaSquareMeters; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
