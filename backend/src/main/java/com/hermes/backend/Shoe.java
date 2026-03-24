package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "shoes", indexes = {
    @Index(name = "idx_shoe_runner", columnList = "runner_id")
})
public class Shoe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "runner_id", nullable = false)
    @JsonIgnore
    private Runner runner;

    private String brand;
    private String model;
    private String nickname;
    private Double maxDistanceKm;
    private Double initialDistanceKm;
    @Column(length = 1024)
    private String photoUrl;
    private boolean retired;
    private boolean isPrimary;
    private LocalDateTime createdAt;

    @Transient
    private Double currentDistanceKm;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (maxDistanceKm == null) maxDistanceKm = 650.0;
    }

    // Getters and Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public Double getMaxDistanceKm() { return maxDistanceKm; }
    public void setMaxDistanceKm(Double maxDistanceKm) { this.maxDistanceKm = maxDistanceKm; }

    public Double getInitialDistanceKm() { return initialDistanceKm; }
    public void setInitialDistanceKm(Double initialDistanceKm) { this.initialDistanceKm = initialDistanceKm; }

    public boolean isRetired() { return retired; }
    public void setRetired(boolean retired) { this.retired = retired; }

    public boolean getIsPrimary() { return isPrimary; }
    public void setIsPrimary(boolean isPrimary) { this.isPrimary = isPrimary; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public Double getCurrentDistanceKm() { return currentDistanceKm; }
    public void setCurrentDistanceKm(Double currentDistanceKm) { this.currentDistanceKm = currentDistanceKm; }
}
