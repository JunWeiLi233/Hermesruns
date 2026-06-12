package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Rolling aggregates and recovery inputs for the automated coach (one row per runner).
 */
@Entity
@Table(
        name = "coach_runner_state",
        indexes = {
                @Index(name = "idx_coach_runner_state_runner", columnList = "runner_id", unique = true)
        }
)
public class CoachRunnerState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false, unique = true)
    private Runner runner;

    private double volumeKm7d;
    private double volumeKm28d;

    private int minutesLowZ1Z2Last7d;
    private int minutesGreyZ3Last7d;
    private int minutesHighZ4Z5Last7d;
    private int minutesUnknownHrLast7d;

    /** High-intensity minutes / total run minutes with HR (null if insufficient data). */
    private Double highIntensityRatioLast7d;

    /** True when monthly-style volume suggests large aerobic load (fatigue risk). */
    private boolean highMileageGrinder;

    /** Estimated HRmax used for zone classification (from profile or recent runs). */
    private Double estimatedHrMaxBpm;

    private LocalDateTime lastAggregatedAt;

    /** Rolling baseline from user input (first logged RHR becomes baseline if unset). */
    private Integer baselineRestingHr;

    private Integer lastNightRestingHr;
    /** 1–100 scale from wearables or manual entry. */
    private Integer lastSleepScore;
    /** HRV (ms) or vendor-normalized value — optional. */
    private Integer lastHrvMs;
    /** 1–100 stress score from wearables. */
    private Integer lastStressScore;

    /** Garmin HRV status label (e.g., "balanced", "unbalanced", "poor"). */
    @Column(length = 30)
    private String lastHrvStatus;

    /** Garmin Body Battery value at wake (0–100). */
    private Integer lastBodyBatteryAtWake;

    /** Composite readiness score 0–100 computed from sleep, HRV, stress, ACWR. */
    private Integer readinessScore;

    /** Readiness verdict: GO, EASY, RECOVERY, or REST. */
    @Column(length = 15)
    private String readinessVerdict;

    private LocalDateTime lastRecoveryLoggedAt;

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public void setRunner(Runner runner) {
        this.runner = runner;
    }

    public double getVolumeKm7d() {
        return volumeKm7d;
    }

    public void setVolumeKm7d(double volumeKm7d) {
        this.volumeKm7d = volumeKm7d;
    }

    public double getVolumeKm28d() {
        return volumeKm28d;
    }

    public void setVolumeKm28d(double volumeKm28d) {
        this.volumeKm28d = volumeKm28d;
    }

    public int getMinutesLowZ1Z2Last7d() {
        return minutesLowZ1Z2Last7d;
    }

    public void setMinutesLowZ1Z2Last7d(int minutesLowZ1Z2Last7d) {
        this.minutesLowZ1Z2Last7d = minutesLowZ1Z2Last7d;
    }

    public int getMinutesGreyZ3Last7d() {
        return minutesGreyZ3Last7d;
    }

    public void setMinutesGreyZ3Last7d(int minutesGreyZ3Last7d) {
        this.minutesGreyZ3Last7d = minutesGreyZ3Last7d;
    }

    public int getMinutesHighZ4Z5Last7d() {
        return minutesHighZ4Z5Last7d;
    }

    public void setMinutesHighZ4Z5Last7d(int minutesHighZ4Z5Last7d) {
        this.minutesHighZ4Z5Last7d = minutesHighZ4Z5Last7d;
    }

    public int getMinutesUnknownHrLast7d() {
        return minutesUnknownHrLast7d;
    }

    public void setMinutesUnknownHrLast7d(int minutesUnknownHrLast7d) {
        this.minutesUnknownHrLast7d = minutesUnknownHrLast7d;
    }

    public Double getHighIntensityRatioLast7d() {
        return highIntensityRatioLast7d;
    }

    public void setHighIntensityRatioLast7d(Double highIntensityRatioLast7d) {
        this.highIntensityRatioLast7d = highIntensityRatioLast7d;
    }

    public boolean isHighMileageGrinder() {
        return highMileageGrinder;
    }

    public void setHighMileageGrinder(boolean highMileageGrinder) {
        this.highMileageGrinder = highMileageGrinder;
    }

    public Double getEstimatedHrMaxBpm() {
        return estimatedHrMaxBpm;
    }

    public void setEstimatedHrMaxBpm(Double estimatedHrMaxBpm) {
        this.estimatedHrMaxBpm = estimatedHrMaxBpm;
    }

    public LocalDateTime getLastAggregatedAt() {
        return lastAggregatedAt;
    }

    public void setLastAggregatedAt(LocalDateTime lastAggregatedAt) {
        this.lastAggregatedAt = lastAggregatedAt;
    }

    public Integer getBaselineRestingHr() {
        return baselineRestingHr;
    }

    public void setBaselineRestingHr(Integer baselineRestingHr) {
        this.baselineRestingHr = baselineRestingHr;
    }

    public Integer getLastNightRestingHr() {
        return lastNightRestingHr;
    }

    public void setLastNightRestingHr(Integer lastNightRestingHr) {
        this.lastNightRestingHr = lastNightRestingHr;
    }

    public Integer getLastSleepScore() {
        return lastSleepScore;
    }

    public void setLastSleepScore(Integer lastSleepScore) {
        this.lastSleepScore = lastSleepScore;
    }

    public Integer getLastHrvMs() {
        return lastHrvMs;
    }

    public void setLastHrvMs(Integer lastHrvMs) {
        this.lastHrvMs = lastHrvMs;
    }

    public Integer getLastStressScore() {
        return lastStressScore;
    }

    public void setLastStressScore(Integer lastStressScore) {
        this.lastStressScore = lastStressScore;
    }

    public String getLastHrvStatus() {
        return lastHrvStatus;
    }

    public void setLastHrvStatus(String lastHrvStatus) {
        this.lastHrvStatus = lastHrvStatus;
    }

    public Integer getLastBodyBatteryAtWake() {
        return lastBodyBatteryAtWake;
    }

    public void setLastBodyBatteryAtWake(Integer lastBodyBatteryAtWake) {
        this.lastBodyBatteryAtWake = lastBodyBatteryAtWake;
    }

    public Integer getReadinessScore() {
        return readinessScore;
    }

    public void setReadinessScore(Integer readinessScore) {
        this.readinessScore = readinessScore;
    }

    public String getReadinessVerdict() {
        return readinessVerdict;
    }

    public void setReadinessVerdict(String readinessVerdict) {
        this.readinessVerdict = readinessVerdict;
    }

    public LocalDateTime getLastRecoveryLoggedAt() {
        return lastRecoveryLoggedAt;
    }

    public void setLastRecoveryLoggedAt(LocalDateTime lastRecoveryLoggedAt) {
        this.lastRecoveryLoggedAt = lastRecoveryLoggedAt;
    }
}
