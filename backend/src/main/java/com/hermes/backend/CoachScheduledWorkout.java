package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(
        name = "coach_scheduled_workout",
        uniqueConstraints = @UniqueConstraint(name = "uk_coach_schedule_runner_date", columnNames = {"runner_id", "scheduled_date"}),
        indexes = {
                @Index(name = "idx_coach_schedule_runner_date", columnList = "runner_id, scheduled_date")
        }
)
public class CoachScheduledWorkout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private CoachWorkoutType workoutType;

    private Double plannedDistanceKm;
    private Integer plannedDurationMinutes;

    @Column(nullable = false)
    private boolean stridesSuggested;

    @Column(length = 600)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private CoachWorkoutType mutatedFrom;

    @Column(nullable = false)
    private boolean readinessAdjusted;

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public void setRunner(Runner runner) {
        this.runner = runner;
    }

    public LocalDate getScheduledDate() {
        return scheduledDate;
    }

    public void setScheduledDate(LocalDate scheduledDate) {
        this.scheduledDate = scheduledDate;
    }

    public CoachWorkoutType getWorkoutType() {
        return workoutType;
    }

    public void setWorkoutType(CoachWorkoutType workoutType) {
        this.workoutType = workoutType;
    }

    public Double getPlannedDistanceKm() {
        return plannedDistanceKm;
    }

    public void setPlannedDistanceKm(Double plannedDistanceKm) {
        this.plannedDistanceKm = plannedDistanceKm;
    }

    public Integer getPlannedDurationMinutes() {
        return plannedDurationMinutes;
    }

    public void setPlannedDurationMinutes(Integer plannedDurationMinutes) {
        this.plannedDurationMinutes = plannedDurationMinutes;
    }

    public boolean isStridesSuggested() {
        return stridesSuggested;
    }

    public void setStridesSuggested(boolean stridesSuggested) {
        this.stridesSuggested = stridesSuggested;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public CoachWorkoutType getMutatedFrom() {
        return mutatedFrom;
    }

    public void setMutatedFrom(CoachWorkoutType mutatedFrom) {
        this.mutatedFrom = mutatedFrom;
    }

    public boolean isReadinessAdjusted() {
        return readinessAdjusted;
    }

    public void setReadinessAdjusted(boolean readinessAdjusted) {
        this.readinessAdjusted = readinessAdjusted;
    }
}
