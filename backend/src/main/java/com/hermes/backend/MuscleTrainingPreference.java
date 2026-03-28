package com.hermes.backend;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(
        name = "muscle_training_preference",
        indexes = {
                @Index(name = "idx_muscle_pref_runner", columnList = "runner_id", unique = true)
        }
)
public class MuscleTrainingPreference {

    public enum ExperienceLevel {
        BEGINNER,
        INTERMEDIATE,
        CONSISTENT
    }

    public enum EquipmentLevel {
        BODYWEIGHT,
        BAND,
        DUMBBELL,
        GYM
    }

    public enum NoisePreference {
        QUIET_ONLY,
        NORMAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "runner_id", nullable = false, unique = true)
    private Runner runner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ExperienceLevel experienceLevel = ExperienceLevel.BEGINNER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private EquipmentLevel equipmentLevel = EquipmentLevel.BODYWEIGHT;

    @Column(nullable = false)
    private int sessionMinutes = 30;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private NoisePreference noisePreference = NoisePreference.NORMAL;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "muscle_training_preference_day",
            joinColumns = @JoinColumn(name = "preference_id")
    )
    @Column(name = "preferred_day", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private Set<DayOfWeek> preferredStrengthDays = new LinkedHashSet<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    public void touch() {
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

    public ExperienceLevel getExperienceLevel() {
        return experienceLevel;
    }

    public void setExperienceLevel(ExperienceLevel experienceLevel) {
        this.experienceLevel = experienceLevel;
    }

    public EquipmentLevel getEquipmentLevel() {
        return equipmentLevel;
    }

    public void setEquipmentLevel(EquipmentLevel equipmentLevel) {
        this.equipmentLevel = equipmentLevel;
    }

    public int getSessionMinutes() {
        return sessionMinutes;
    }

    public void setSessionMinutes(int sessionMinutes) {
        this.sessionMinutes = sessionMinutes;
    }

    public NoisePreference getNoisePreference() {
        return noisePreference;
    }

    public void setNoisePreference(NoisePreference noisePreference) {
        this.noisePreference = noisePreference;
    }

    public Set<DayOfWeek> getPreferredStrengthDays() {
        return preferredStrengthDays;
    }

    public void setPreferredStrengthDays(Set<DayOfWeek> preferredStrengthDays) {
        this.preferredStrengthDays = preferredStrengthDays;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
