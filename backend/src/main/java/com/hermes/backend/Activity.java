package com.hermes.backend;

import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

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
public class Activity extends ActivityRelationshipFields {

    @PrePersist
    public void prePersist() {
        if (getCreatedAt() == null) {
            setCreatedAt(LocalDateTime.now());
        }
    }

    public void addPoint(ActivityPoint point) {
        point.setActivity(this);
        getPoints().add(point);
    }

    public Long getShoeId() {
        Shoe shoe = getShoe();
        return shoe != null ? shoe.getId() : null;
    }

    public String getShoeName() {
        Shoe shoe = getShoe();
        if (shoe == null) return null;
        String b = shoe.getBrand() != null ? shoe.getBrand() : "";
        String m = shoe.getModel() != null ? shoe.getModel() : "";
        String combined = (b + " " + m).trim();
        return combined.isEmpty() ? shoe.getNickname() : combined;
    }
}
