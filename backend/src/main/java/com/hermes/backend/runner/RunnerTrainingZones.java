package com.hermes.backend.runner;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

/**
 * The heart-rate zone boundaries a runner has set by hand. A runner without a row (or whose row says
 * {@link HeartRateZones#SOURCE_AUTO}) gets the default boundaries for their max heart rate. The max heart
 * rate itself stays on {@link Runner#getMaxHeartRateBpm()}, which the coach already reads and writes.
 *
 * <p>The source is a plain string rather than an enum: Hibernate's schema update never changes an existing
 * enum check constraint, so adding a value later would fail on insert.</p>
 */
@Entity
@Table(
        name = "runner_training_zones",
        uniqueConstraints = @UniqueConstraint(name = "uk_runner_training_zones_runner", columnNames = "runner_id")
)
public class RunnerTrainingZones {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    /** The first bpm of zones 2 to 5. All four are set when the source is MANUAL, and ignored otherwise. */
    private Integer hrBoundary1Bpm;
    private Integer hrBoundary2Bpm;
    private Integer hrBoundary3Bpm;
    private Integer hrBoundary4Bpm;

    @Column(nullable = false, length = 8)
    private String hrSource = HeartRateZones.SOURCE_AUTO;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected RunnerTrainingZones() {
    }

    public RunnerTrainingZones(Runner runner) {
        this.runner = runner;
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public boolean isManual() {
        return HeartRateZones.SOURCE_MANUAL.equals(hrSource)
                && hrBoundary1Bpm != null && hrBoundary2Bpm != null && hrBoundary3Bpm != null && hrBoundary4Bpm != null;
    }

    /** The four manual boundaries, or null when the zones are automatic. */
    public int[] manualBoundaries() {
        return isManual() ? new int[] {hrBoundary1Bpm, hrBoundary2Bpm, hrBoundary3Bpm, hrBoundary4Bpm} : null;
    }

    public void setManualBoundaries(int[] boundaries) {
        hrBoundary1Bpm = boundaries[0];
        hrBoundary2Bpm = boundaries[1];
        hrBoundary3Bpm = boundaries[2];
        hrBoundary4Bpm = boundaries[3];
        hrSource = HeartRateZones.SOURCE_MANUAL;
    }

    public void useAutomaticBoundaries() {
        hrBoundary1Bpm = null;
        hrBoundary2Bpm = null;
        hrBoundary3Bpm = null;
        hrBoundary4Bpm = null;
        hrSource = HeartRateZones.SOURCE_AUTO;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
