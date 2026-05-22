package com.hermes.backend;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "race_course_map_asset", indexes = {
        @Index(name = "idx_race_course_map_race_id", columnList = "raceId", unique = true),
        @Index(name = "idx_race_course_map_updated", columnList = "updatedAt")
})
public class RaceCourseMapAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String raceId;

    private String raceName;
    private String city;
    private String country;
    private String officialWebsite;
    private Double latitude;
    private Double longitude;
    private Double distanceKm;

    @Column(columnDefinition = "text")
    private String pendingImageUrl;
    private String pendingSource;
    private Integer pendingConfidence;
    @Column(columnDefinition = "text")
    private String pendingSummary;
    @Column(columnDefinition = "text")
    private String pendingOverlayBoundsJson;
    @Column(columnDefinition = "text")
    private String pendingRoutePointsJson;
    @Column(columnDefinition = "text")
    private String pendingElevationSamplesJson;
    private Integer pendingTotalClimbMeters;
    private Boolean pendingAiAssisted;
    private LocalDateTime pendingUpdatedAt;
    private String pendingUpdatedByEmail;

    @Column(columnDefinition = "text")
    private String liveImageUrl;
    private String liveSource;
    private Integer liveConfidence;
    @Column(columnDefinition = "text")
    private String liveSummary;
    @Column(columnDefinition = "text")
    private String liveOverlayBoundsJson;
    @Column(columnDefinition = "text")
    private String liveRoutePointsJson;
    @Column(columnDefinition = "text")
    private String liveElevationSamplesJson;
    private Integer liveTotalClimbMeters;
    private Boolean liveAiAssisted;
    private LocalDateTime liveUpdatedAt;
    private String liveUpdatedByEmail;

    @Column(columnDefinition = "text")
    private String localRouteArtifactRef;
    private LocalDateTime localRouteUpdatedAt;
    private String localRouteUpdatedByEmail;

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
    public String getRaceId() { return raceId; }
    public void setRaceId(String raceId) { this.raceId = raceId; }
    public String getRaceName() { return raceName; }
    public void setRaceName(String raceName) { this.raceName = raceName; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getOfficialWebsite() { return officialWebsite; }
    public void setOfficialWebsite(String officialWebsite) { this.officialWebsite = officialWebsite; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }
    public String getPendingImageUrl() { return pendingImageUrl; }
    public void setPendingImageUrl(String pendingImageUrl) { this.pendingImageUrl = pendingImageUrl; }
    public String getPendingSource() { return pendingSource; }
    public void setPendingSource(String pendingSource) { this.pendingSource = pendingSource; }
    public Integer getPendingConfidence() { return pendingConfidence; }
    public void setPendingConfidence(Integer pendingConfidence) { this.pendingConfidence = pendingConfidence; }
    public String getPendingSummary() { return pendingSummary; }
    public void setPendingSummary(String pendingSummary) { this.pendingSummary = pendingSummary; }
    public String getPendingOverlayBoundsJson() { return pendingOverlayBoundsJson; }
    public void setPendingOverlayBoundsJson(String pendingOverlayBoundsJson) { this.pendingOverlayBoundsJson = pendingOverlayBoundsJson; }
    public String getPendingRoutePointsJson() { return pendingRoutePointsJson; }
    public void setPendingRoutePointsJson(String pendingRoutePointsJson) { this.pendingRoutePointsJson = pendingRoutePointsJson; }
    public String getPendingElevationSamplesJson() { return pendingElevationSamplesJson; }
    public void setPendingElevationSamplesJson(String pendingElevationSamplesJson) { this.pendingElevationSamplesJson = pendingElevationSamplesJson; }
    public Integer getPendingTotalClimbMeters() { return pendingTotalClimbMeters; }
    public void setPendingTotalClimbMeters(Integer pendingTotalClimbMeters) { this.pendingTotalClimbMeters = pendingTotalClimbMeters; }
    public Boolean getPendingAiAssisted() { return pendingAiAssisted; }
    public void setPendingAiAssisted(Boolean pendingAiAssisted) { this.pendingAiAssisted = pendingAiAssisted; }
    public LocalDateTime getPendingUpdatedAt() { return pendingUpdatedAt; }
    public void setPendingUpdatedAt(LocalDateTime pendingUpdatedAt) { this.pendingUpdatedAt = pendingUpdatedAt; }
    public String getPendingUpdatedByEmail() { return pendingUpdatedByEmail; }
    public void setPendingUpdatedByEmail(String pendingUpdatedByEmail) { this.pendingUpdatedByEmail = pendingUpdatedByEmail; }
    public String getLiveImageUrl() { return liveImageUrl; }
    public void setLiveImageUrl(String liveImageUrl) { this.liveImageUrl = liveImageUrl; }
    public String getLiveSource() { return liveSource; }
    public void setLiveSource(String liveSource) { this.liveSource = liveSource; }
    public Integer getLiveConfidence() { return liveConfidence; }
    public void setLiveConfidence(Integer liveConfidence) { this.liveConfidence = liveConfidence; }
    public String getLiveSummary() { return liveSummary; }
    public void setLiveSummary(String liveSummary) { this.liveSummary = liveSummary; }
    public String getLiveOverlayBoundsJson() { return liveOverlayBoundsJson; }
    public void setLiveOverlayBoundsJson(String liveOverlayBoundsJson) { this.liveOverlayBoundsJson = liveOverlayBoundsJson; }
    public String getLiveRoutePointsJson() { return liveRoutePointsJson; }
    public void setLiveRoutePointsJson(String liveRoutePointsJson) { this.liveRoutePointsJson = liveRoutePointsJson; }
    public String getLiveElevationSamplesJson() { return liveElevationSamplesJson; }
    public void setLiveElevationSamplesJson(String liveElevationSamplesJson) { this.liveElevationSamplesJson = liveElevationSamplesJson; }
    public Integer getLiveTotalClimbMeters() { return liveTotalClimbMeters; }
    public void setLiveTotalClimbMeters(Integer liveTotalClimbMeters) { this.liveTotalClimbMeters = liveTotalClimbMeters; }
    public Boolean getLiveAiAssisted() { return liveAiAssisted; }
    public void setLiveAiAssisted(Boolean liveAiAssisted) { this.liveAiAssisted = liveAiAssisted; }
    public LocalDateTime getLiveUpdatedAt() { return liveUpdatedAt; }
    public void setLiveUpdatedAt(LocalDateTime liveUpdatedAt) { this.liveUpdatedAt = liveUpdatedAt; }
    public String getLiveUpdatedByEmail() { return liveUpdatedByEmail; }
    public void setLiveUpdatedByEmail(String liveUpdatedByEmail) { this.liveUpdatedByEmail = liveUpdatedByEmail; }
    public String getLocalRouteArtifactRef() { return localRouteArtifactRef; }
    public void setLocalRouteArtifactRef(String localRouteArtifactRef) { this.localRouteArtifactRef = localRouteArtifactRef; }
    public LocalDateTime getLocalRouteUpdatedAt() { return localRouteUpdatedAt; }
    public void setLocalRouteUpdatedAt(LocalDateTime localRouteUpdatedAt) { this.localRouteUpdatedAt = localRouteUpdatedAt; }
    public String getLocalRouteUpdatedByEmail() { return localRouteUpdatedByEmail; }
    public void setLocalRouteUpdatedByEmail(String localRouteUpdatedByEmail) { this.localRouteUpdatedByEmail = localRouteUpdatedByEmail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
