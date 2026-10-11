package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDate;

/**
 * The fastest stretch of one standard distance inside one run (see {@link BestEffortCalculator}). One row per run and
 * distance, rewritten whenever the run is analysed again, except for what the runner decided: a chip time they typed in
 * and whether they hid the effort. Those survive a recompute.
 *
 * <p>The rank (PR, 2nd, 3rd) is never stored. It is read from the other rows of the runner at that distance, so it cannot
 * drift when another run is added, edited or deleted.</p>
 *
 * <p>The effort's distance key is a plain string rather than an enum, like the other derived tables: Hibernate's schema
 * update never changes an existing enum check constraint, so a new distance would fail on insert.</p>
 */
@Entity
@Table(
        name = "activity_best_effort",
        uniqueConstraints = @UniqueConstraint(name = "uk_activity_best_effort", columnNames = {"activity_id", "distance_key"}),
        indexes = {
                @Index(name = "idx_abe_runner_distance_time", columnList = "runner_id, distance_key, effective_seconds"),
                @Index(name = "idx_abe_runner_distance_date", columnList = "runner_id, distance_key, local_date")
        }
)
public class ActivityBestEffort {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "activity_id", nullable = false)
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(name = "distance_key", nullable = false, length = 12)
    private String distanceKey;

    @Column(name = "distance_meters", nullable = false)
    private double distanceMeters;

    /** What the stream says (or the run's average pace says, when {@link #estimated}). */
    @Column(name = "elapsed_seconds", nullable = false)
    private double elapsedSeconds;

    /** Seconds from the run's first reading to where the effort starts and ends; null for an estimate. */
    @Column(name = "start_offset_seconds")
    private Integer startOffsetSeconds;

    @Column(name = "end_offset_seconds")
    private Integer endOffsetSeconds;

    /** True when there is no stretch to measure and the time is the run's average pace carried over to the distance. */
    @Column(nullable = false)
    private boolean estimated;

    /** A time the runner typed in (a chip time); null when they did not. */
    @Column(name = "edited_elapsed_seconds")
    private Integer editedElapsedSeconds;

    /** What counts: the typed time when there is one, else the measured one. Ranks and records order by it. */
    @Column(name = "effective_seconds", nullable = false)
    private double effectiveSeconds;

    /** The runner removed this effort from their records. The row stays so a recompute does not bring it back. */
    @Column(nullable = false)
    private boolean hidden;

    /** The runner's calendar day for the run (see {@link ActivityLocalDates}). */
    @Column(name = "local_date", nullable = false)
    private LocalDate localDate;

    @Column(name = "model_version", nullable = false)
    private int modelVersion;

    protected ActivityBestEffort() {
    }

    public ActivityBestEffort(Activity activity, Runner runner, String distanceKey, double distanceMeters) {
        this.activity = activity;
        this.runner = runner;
        this.distanceKey = distanceKey;
        this.distanceMeters = distanceMeters;
    }

    /** Replaces what was measured, leaving the runner's own decisions alone. */
    void setMeasured(double elapsedSeconds, Integer startOffsetSeconds, Integer endOffsetSeconds, boolean estimated,
                     LocalDate localDate, int modelVersion) {
        this.elapsedSeconds = elapsedSeconds;
        this.startOffsetSeconds = startOffsetSeconds;
        this.endOffsetSeconds = endOffsetSeconds;
        this.estimated = estimated;
        this.localDate = localDate;
        this.modelVersion = modelVersion;
        this.effectiveSeconds = editedElapsedSeconds != null ? editedElapsedSeconds : elapsedSeconds;
    }

    void setEditedElapsedSeconds(Integer editedElapsedSeconds) {
        this.editedElapsedSeconds = editedElapsedSeconds;
        this.effectiveSeconds = editedElapsedSeconds != null ? editedElapsedSeconds : elapsedSeconds;
    }

    void setHidden(boolean hidden) {
        this.hidden = hidden;
    }

    public Long getId() {
        return id;
    }

    public Activity getActivity() {
        return activity;
    }

    public Runner getRunner() {
        return runner;
    }

    public String getDistanceKey() {
        return distanceKey;
    }

    public double getDistanceMeters() {
        return distanceMeters;
    }

    public double getElapsedSeconds() {
        return elapsedSeconds;
    }

    public Integer getStartOffsetSeconds() {
        return startOffsetSeconds;
    }

    public Integer getEndOffsetSeconds() {
        return endOffsetSeconds;
    }

    public boolean isEstimated() {
        return estimated;
    }

    public Integer getEditedElapsedSeconds() {
        return editedElapsedSeconds;
    }

    public double getEffectiveSeconds() {
        return effectiveSeconds;
    }

    public boolean isHidden() {
        return hidden;
    }

    public LocalDate getLocalDate() {
        return localDate;
    }

    public int getModelVersion() {
        return modelVersion;
    }
}
