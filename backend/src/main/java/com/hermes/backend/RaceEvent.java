package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "race_events",
        indexes = {
                @Index(name = "idx_race_runner_event_date", columnList = "runner_id, eventDate"),
                @Index(name = "idx_race_runner_status", columnList = "runner_id, registrationStatus"),
                @Index(name = "idx_race_runner_nyrr", columnList = "runner_id, nyrrNinePlusOneEligible")
        }
)
public class RaceEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    @JsonIgnore
    private Runner runner;

    @Column(nullable = false)
    private String name;

    private String organization;

    private String location;

    @Column(nullable = false)
    private LocalDate eventDate;

    private Double distanceKm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RaceRegistrationStatus registrationStatus = RaceRegistrationStatus.INTERESTED;

    private Integer goalTimeSeconds;

    @Column(length = 1000)
    private String notes;

    private boolean nyrrNinePlusOneEligible;

    private Long completedActivityId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Runner getRunner() {
        return runner;
    }

    public void setRunner(Runner runner) {
        this.runner = runner;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getOrganization() {
        return organization;
    }

    public void setOrganization(String organization) {
        this.organization = organization;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public LocalDate getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDate eventDate) {
        this.eventDate = eventDate;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(Double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public RaceRegistrationStatus getRegistrationStatus() {
        return registrationStatus;
    }

    public void setRegistrationStatus(RaceRegistrationStatus registrationStatus) {
        this.registrationStatus = registrationStatus;
    }

    public Integer getGoalTimeSeconds() {
        return goalTimeSeconds;
    }

    public void setGoalTimeSeconds(Integer goalTimeSeconds) {
        this.goalTimeSeconds = goalTimeSeconds;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public boolean isNyrrNinePlusOneEligible() {
        return nyrrNinePlusOneEligible;
    }

    public void setNyrrNinePlusOneEligible(boolean nyrrNinePlusOneEligible) {
        this.nyrrNinePlusOneEligible = nyrrNinePlusOneEligible;
    }

    public Long getCompletedActivityId() {
        return completedActivityId;
    }

    public void setCompletedActivityId(Long completedActivityId) {
        this.completedActivityId = completedActivityId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
