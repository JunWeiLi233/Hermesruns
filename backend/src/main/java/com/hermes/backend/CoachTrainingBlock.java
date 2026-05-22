package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Active race preparation block with progressive long-run progression.
 */
@Entity
@Table(
        name = "coach_training_block",
        indexes = {
                @Index(name = "idx_coach_block_runner_active", columnList = "runner_id, active")
        }
)
public class CoachTrainingBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(nullable = false)
    private boolean active = true;

    /** Target race distance (km), e.g. 21.1 for half marathon. */
    @Column(nullable = false)
    private double raceDistanceKm;

    private LocalDate targetRaceDate;

    @Column(length = 120)
    private String name;

    /** Week index (0-based) since block start — used for weekly long-run bump. */
    @Column(nullable = false)
    private int weekIndex;

    /** Current long-run distance target (km). Increased by at most ~12% per week in the planner. */
    @Column(nullable = false)
    private double currentLongRunKm;

    @Column(nullable = false)
    private LocalDate blockStartedOn;

    /** Monday of the week we last applied progressive long-run bump (ISO week). */
    private LocalDate lastProgressionWeekStart;

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public void setRunner(Runner runner) {
        this.runner = runner;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public double getRaceDistanceKm() {
        return raceDistanceKm;
    }

    public void setRaceDistanceKm(double raceDistanceKm) {
        this.raceDistanceKm = raceDistanceKm;
    }

    public LocalDate getTargetRaceDate() {
        return targetRaceDate;
    }

    public void setTargetRaceDate(LocalDate targetRaceDate) {
        this.targetRaceDate = targetRaceDate;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getWeekIndex() {
        return weekIndex;
    }

    public void setWeekIndex(int weekIndex) {
        this.weekIndex = weekIndex;
    }

    public double getCurrentLongRunKm() {
        return currentLongRunKm;
    }

    public void setCurrentLongRunKm(double currentLongRunKm) {
        this.currentLongRunKm = currentLongRunKm;
    }

    public LocalDate getBlockStartedOn() {
        return blockStartedOn;
    }

    public void setBlockStartedOn(LocalDate blockStartedOn) {
        this.blockStartedOn = blockStartedOn;
    }

    public LocalDate getLastProgressionWeekStart() {
        return lastProgressionWeekStart;
    }

    public void setLastProgressionWeekStart(LocalDate lastProgressionWeekStart) {
        this.lastProgressionWeekStart = lastProgressionWeekStart;
    }
}
