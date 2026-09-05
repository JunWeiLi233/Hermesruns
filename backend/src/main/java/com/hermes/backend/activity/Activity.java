package com.hermes.backend.activity;

import com.hermes.backend.shoes.Shoe;
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

    /** GPS stream marker for runs whose Strava stream has no usable latlng data (e.g. treadmill runs). */
    public static final String GPS_STREAM_STATE_NO_GPS = "NO_GPS";

    /** GPS stream state: null = unknown / has GPS, {@link #GPS_STREAM_STATE_NO_GPS} = stream confirmed unusable. */
    private String gpsStreamState;

    /** When the GPS stream state was last verified; drives the no-GPS retry window. */
    private LocalDateTime gpsStreamCheckedAt;

    @PrePersist
    public void prePersist() {
        if (getCreatedAt() == null) {
            setCreatedAt(LocalDateTime.now());
        }
    }

    public String getGpsStreamState() {
        return gpsStreamState;
    }

    public void setGpsStreamState(String gpsStreamState) {
        this.gpsStreamState = gpsStreamState;
    }

    public LocalDateTime getGpsStreamCheckedAt() {
        return gpsStreamCheckedAt;
    }

    public void setGpsStreamCheckedAt(LocalDateTime gpsStreamCheckedAt) {
        this.gpsStreamCheckedAt = gpsStreamCheckedAt;
    }

    /**
     * True while this activity was previously confirmed to have no usable GPS
     * stream and is still inside the retry window of {@code retryDays} days,
     * so callers can skip the stream fetch entirely.
     */
    public boolean isNoGpsRetryWindowActive(int retryDays) {
        return GPS_STREAM_STATE_NO_GPS.equals(gpsStreamState)
                && gpsStreamCheckedAt != null
                && LocalDateTime.now().isBefore(gpsStreamCheckedAt.plusDays(retryDays));
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
