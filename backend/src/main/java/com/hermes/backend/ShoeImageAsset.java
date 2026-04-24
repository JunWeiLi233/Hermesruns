package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "shoe_image_asset", indexes = {
        @Index(name = "idx_shoe_image_asset_identity", columnList = "identityKey", unique = true),
        @Index(name = "idx_shoe_image_asset_updated", columnList = "updatedAt")
})
public class ShoeImageAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 256)
    private String identityKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "runner_id")
    private Runner runner;

    private String brand;
    private String model;

    @Column(columnDefinition = "text")
    private String pendingImageUrl;
    private String pendingSource;
    private LocalDateTime pendingUpdatedAt;
    private String pendingUpdatedByEmail;

    @Column(columnDefinition = "text")
    private String liveImageUrl;
    private String liveSource;
    private LocalDateTime liveUpdatedAt;
    private String liveUpdatedByEmail;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getIdentityKey() { return identityKey; }
    public void setIdentityKey(String identityKey) { this.identityKey = identityKey; }
    public Runner getRunner() { return runner; }
    public void setRunner(Runner runner) { this.runner = runner; }
    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getPendingImageUrl() { return pendingImageUrl; }
    public void setPendingImageUrl(String pendingImageUrl) { this.pendingImageUrl = pendingImageUrl; }
    public String getPendingSource() { return pendingSource; }
    public void setPendingSource(String pendingSource) { this.pendingSource = pendingSource; }
    public LocalDateTime getPendingUpdatedAt() { return pendingUpdatedAt; }
    public void setPendingUpdatedAt(LocalDateTime pendingUpdatedAt) { this.pendingUpdatedAt = pendingUpdatedAt; }
    public String getPendingUpdatedByEmail() { return pendingUpdatedByEmail; }
    public void setPendingUpdatedByEmail(String pendingUpdatedByEmail) { this.pendingUpdatedByEmail = pendingUpdatedByEmail; }
    public String getLiveImageUrl() { return liveImageUrl; }
    public void setLiveImageUrl(String liveImageUrl) { this.liveImageUrl = liveImageUrl; }
    public String getLiveSource() { return liveSource; }
    public void setLiveSource(String liveSource) { this.liveSource = liveSource; }
    public LocalDateTime getLiveUpdatedAt() { return liveUpdatedAt; }
    public void setLiveUpdatedAt(LocalDateTime liveUpdatedAt) { this.liveUpdatedAt = liveUpdatedAt; }
    public String getLiveUpdatedByEmail() { return liveUpdatedByEmail; }
    public void setLiveUpdatedByEmail(String liveUpdatedByEmail) { this.liveUpdatedByEmail = liveUpdatedByEmail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
