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
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A recent race or time trial the runner entered to cut their pace zones from, in place of the fitness Hermes works out from
 * their runs. One at most: a new one replaces the old. The zones from it apply to runs on or after {@link #getRaceDate()};
 * earlier runs keep the zones they had. The fitness (VDOT) itself is worked out from the distance and the time in the browser,
 * with the same formula as everywhere else in the analysis, so there is one copy of that arithmetic.
 */
@Entity
@Table(
        name = "runner_pace_zone_race",
        uniqueConstraints = @UniqueConstraint(name = "uk_runner_pace_zone_race_runner", columnNames = "runner_id")
)
public class RunnerPaceZoneRace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(nullable = false)
    private double distanceMeters;

    @Column(nullable = false)
    private int timeSeconds;

    @Column(nullable = false)
    private LocalDate raceDate;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    protected RunnerPaceZoneRace() {
    }

    public RunnerPaceZoneRace(Runner runner) {
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

    public double getDistanceMeters() {
        return distanceMeters;
    }

    public int getTimeSeconds() {
        return timeSeconds;
    }

    public LocalDate getRaceDate() {
        return raceDate;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void set(double distanceMeters, int timeSeconds, LocalDate raceDate) {
        this.distanceMeters = distanceMeters;
        this.timeSeconds = timeSeconds;
        this.raceDate = raceDate;
    }
}
