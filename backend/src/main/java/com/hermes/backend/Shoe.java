package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "shoes", indexes = {
    @Index(name = "idx_shoe_runner", columnList = "runner_id"),
    @Index(name = "idx_shoe_runner_identity", columnList = "runner_id,identity_key")
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
    /** Fingerprint for duplicate detection (Chinese vs romanized names, spacing, case). */
    @Column(name = "identity_key", length = 256)
    private String identityKey;
    private String nickname;
    private Double maxDistanceKm;
    private Double initialDistanceKm;
    @Column(length = 1024)
    private String photoUrl;
    /** Admin confirmed this product image matches brand+model (set from dashboard). */
    @Column(name = "photo_verified")
    private Boolean photoVerified = false;
    private boolean retired;
    private LocalDateTime retiredDate;
    private boolean isPrimary;
    private LocalDateTime createdAt;

    @Transient
    private Double currentDistanceKm;

    @Transient
    private String type;

    @Transient
    private String surfaceType;

    @Transient
    private LocalDateTime lastWornAt;

    @Transient
    private Integer daysSinceLastWear;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (maxDistanceKm == null) maxDistanceKm = 650.0;
        if (photoVerified == null) photoVerified = false;
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

    public String getIdentityKey() { return identityKey; }
    public void setIdentityKey(String identityKey) { this.identityKey = identityKey; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public Double getMaxDistanceKm() { return maxDistanceKm; }
    public void setMaxDistanceKm(Double maxDistanceKm) { this.maxDistanceKm = maxDistanceKm; }

    public Double getInitialDistanceKm() { return initialDistanceKm; }
    public void setInitialDistanceKm(Double initialDistanceKm) { this.initialDistanceKm = initialDistanceKm; }

    public boolean isRetired() { return retired; }
    public void setRetired(boolean retired) { this.retired = retired; }

    public LocalDateTime getRetiredDate() { return retiredDate; }
    public void setRetiredDate(LocalDateTime retiredDate) { this.retiredDate = retiredDate; }

    public boolean getIsPrimary() { return isPrimary; }
    public void setIsPrimary(boolean isPrimary) { this.isPrimary = isPrimary; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public boolean isPhotoVerified() { return Boolean.TRUE.equals(photoVerified); }
    public void setPhotoVerified(boolean photoVerified) { this.photoVerified = photoVerified; }

    public Double getCurrentDistanceKm() { return currentDistanceKm; }
    public void setCurrentDistanceKm(Double currentDistanceKm) { this.currentDistanceKm = currentDistanceKm; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSurfaceType() { return surfaceType; }
    public void setSurfaceType(String surfaceType) { this.surfaceType = surfaceType; }

    public LocalDateTime getLastWornAt() { return lastWornAt; }
    public void setLastWornAt(LocalDateTime lastWornAt) { this.lastWornAt = lastWornAt; }

    public Integer getDaysSinceLastWear() { return daysSinceLastWear; }
    public void setDaysSinceLastWear(Integer daysSinceLastWear) { this.daysSinceLastWear = daysSinceLastWear; }
}
