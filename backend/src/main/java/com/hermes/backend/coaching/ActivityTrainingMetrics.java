package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.runner.HeartRateZones;
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
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * What Hermes worked out about one run: its effort score and the time it spent in each heart-rate zone.
 * One row per run, rewritten whenever its inputs change (the heart-rate stream arrives, the runner rates
 * the run, the zones or the model change).
 *
 * <p>The row remembers the zones it was computed with, so a run is always shown with the zone edges its
 * numbers belong to, and so a change of zones is noticed by comparing edges. It is derived data and never
 * serialised directly: responses are built from it.</p>
 *
 * <p>The effort source is a plain string rather than an enum: Hibernate's schema update never changes an
 * existing enum check constraint, so adding a source later would fail on insert.</p>
 */
@Entity
@Table(
        name = "activity_training_metrics",
        indexes = {
                @Index(name = "idx_atm_runner_date", columnList = "runner_id, localDate"),
                @Index(name = "idx_atm_runner_source", columnList = "runner_id, effortSource")
        }
)
public class ActivityTrainingMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "activity_id", nullable = false, unique = true)
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    /** The runner's calendar day for the run (see {@code ActivityLocalDates}). */
    @Column(nullable = false)
    private LocalDate localDate;

    private Double effortScore;

    @Column(length = 16)
    private String effortSource;

    /** The heart-rate score, kept even when another source won, so the pace model can be calibrated against it. */
    private Double hrEffort;

    /** The pace-model score, kept beside the heart-rate one for the same reason. */
    private Double paceEffort;

    private Integer hrZone1Seconds;
    private Integer hrZone2Seconds;
    private Integer hrZone3Seconds;
    private Integer hrZone4Seconds;
    private Integer hrZone5Seconds;

    /** Seconds the heart-rate samples stand for; zero when the run has no usable heart-rate stream. */
    @Column(nullable = false)
    private int hrCoveredSeconds;

    /** The zones this row was computed with. */
    @Column(nullable = false)
    private int maxHrUsed;
    @Column(nullable = false)
    private int hrBoundary1Bpm;
    @Column(nullable = false)
    private int hrBoundary2Bpm;
    @Column(nullable = false)
    private int hrBoundary3Bpm;
    @Column(nullable = false)
    private int hrBoundary4Bpm;

    /** The runner's rating at the time, so a changed rating is noticed. */
    private Integer perceivedExertionUsed;

    /** Which version of the effort model produced the row; a new version makes every row out of date. */
    @Column(nullable = false)
    private int modelVersion;

    /** Set to force a recompute without waiting for the row to be noticed as out of date. */
    @Column(nullable = false)
    private boolean stale;

    @Column(nullable = false)
    private LocalDateTime computedAt;

    protected ActivityTrainingMetrics() {
    }

    public ActivityTrainingMetrics(Activity activity, Runner runner) {
        this.activity = activity;
        this.runner = runner;
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

    public LocalDate getLocalDate() {
        return localDate;
    }

    public void setLocalDate(LocalDate localDate) {
        this.localDate = localDate;
    }

    public Double getEffortScore() {
        return effortScore;
    }

    public void setEffortScore(Double effortScore) {
        this.effortScore = effortScore;
    }

    public String getEffortSource() {
        return effortSource;
    }

    public void setEffortSource(String effortSource) {
        this.effortSource = effortSource;
    }

    public Double getHrEffort() {
        return hrEffort;
    }

    public void setHrEffort(Double hrEffort) {
        this.hrEffort = hrEffort;
    }

    public Double getPaceEffort() {
        return paceEffort;
    }

    public void setPaceEffort(Double paceEffort) {
        this.paceEffort = paceEffort;
    }

    /** Seconds in zones 1 to 5; zeros when there is no heart-rate stream. */
    public int[] zoneSeconds() {
        return new int[] {
                nz(hrZone1Seconds), nz(hrZone2Seconds), nz(hrZone3Seconds), nz(hrZone4Seconds), nz(hrZone5Seconds)
        };
    }

    public void setZoneSeconds(int[] seconds) {
        hrZone1Seconds = seconds[0];
        hrZone2Seconds = seconds[1];
        hrZone3Seconds = seconds[2];
        hrZone4Seconds = seconds[3];
        hrZone5Seconds = seconds[4];
    }

    private static int nz(Integer value) {
        return value == null ? 0 : value;
    }

    public int getHrCoveredSeconds() {
        return hrCoveredSeconds;
    }

    public void setHrCoveredSeconds(int hrCoveredSeconds) {
        this.hrCoveredSeconds = hrCoveredSeconds;
    }

    public int getMaxHrUsed() {
        return maxHrUsed;
    }

    /** The zones the row was computed with. */
    public HeartRateZones zonesUsed() {
        return new HeartRateZones(maxHrUsed, new int[] {hrBoundary1Bpm, hrBoundary2Bpm, hrBoundary3Bpm, hrBoundary4Bpm});
    }

    public void setZonesUsed(HeartRateZones zones) {
        maxHrUsed = zones.maxHeartRate();
        hrBoundary1Bpm = zones.boundary(0);
        hrBoundary2Bpm = zones.boundary(1);
        hrBoundary3Bpm = zones.boundary(2);
        hrBoundary4Bpm = zones.boundary(3);
    }

    public Integer getPerceivedExertionUsed() {
        return perceivedExertionUsed;
    }

    public void setPerceivedExertionUsed(Integer perceivedExertionUsed) {
        this.perceivedExertionUsed = perceivedExertionUsed;
    }

    public int getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(int modelVersion) {
        this.modelVersion = modelVersion;
    }

    public boolean isStale() {
        return stale;
    }

    public void setStale(boolean stale) {
        this.stale = stale;
    }

    public LocalDateTime getComputedAt() {
        return computedAt;
    }

    public void setComputedAt(LocalDateTime computedAt) {
        this.computedAt = computedAt;
    }
}
