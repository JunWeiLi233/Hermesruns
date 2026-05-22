package com.hermes.backend;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "muscle_training_check_in",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_muscle_check_in_runner_date",
                columnNames = {"runner_id", "training_date"}
        ),
        indexes = {
                @Index(name = "idx_muscle_check_in_runner_date", columnList = "runner_id, training_date")
        }
)
public class MuscleTrainingCheckIn {

    public enum RunType {
        REST,
        EASY,
        RECOVERY,
        QUALITY,
        LONG_RUN,
        CROSS_TRAIN
    }

    public enum EntryState {
        PLANNED,
        ACTUAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(name = "training_date", nullable = false)
    private LocalDate trainingDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private RunType runType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private EntryState entryState;

    private Double distanceKm;

    private Integer durationMinutes;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touchTimestamp() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public void setRunner(Runner runner) {
        this.runner = runner;
    }

    public LocalDate getTrainingDate() {
        return trainingDate;
    }

    public void setTrainingDate(LocalDate trainingDate) {
        this.trainingDate = trainingDate;
    }

    public RunType getRunType() {
        return runType;
    }

    public void setRunType(RunType runType) {
        this.runType = runType;
    }

    public EntryState getEntryState() {
        return entryState;
    }

    public void setEntryState(EntryState entryState) {
        this.entryState = entryState;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(Double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public Integer getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Integer durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
