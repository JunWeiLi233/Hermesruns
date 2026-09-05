package com.hermes.backend.races;

import java.time.LocalDateTime;

/**
 * SQL projection of {@link RaceCourseMapAsset} for the admin list endpoint.
 * Built by a JPQL constructor expression that selects only the columns the
 * admin list row consumes, so listing the catalog never materializes the
 * per-row entities (or the large text columns the list does not read:
 * pending/live elevation samples and the local route artifact reference).
 * Column order mirrors the entity field order and must stay in sync with the
 * query in {@code RaceCourseMapAssetRepository#findAllListRows}.
 */
public class RaceCourseMapAssetListRow implements RaceCourseMapAssetListFields {
    private final String raceId;
    private final String raceName;
    private final String city;
    private final String country;
    private final Double latitude;
    private final Double longitude;
    private final Double distanceKm;
    private final String pendingImageUrl;
    private final String pendingSource;
    private final Integer pendingConfidence;
    private final String pendingSummary;
    private final String pendingOverlayBoundsJson;
    private final String pendingRoutePointsJson;
    private final Boolean pendingAiAssisted;
    private final LocalDateTime pendingUpdatedAt;
    private final String liveImageUrl;
    private final String liveSource;
    private final Integer liveConfidence;
    private final String liveSummary;
    private final String liveOverlayBoundsJson;
    private final String liveRoutePointsJson;
    private final Boolean liveAiAssisted;
    private final LocalDateTime liveUpdatedAt;
    private final LocalDateTime updatedAt;

    public RaceCourseMapAssetListRow(
            String raceId,
            String raceName,
            String city,
            String country,
            Double latitude,
            Double longitude,
            Double distanceKm,
            String pendingImageUrl,
            String pendingSource,
            Integer pendingConfidence,
            String pendingSummary,
            String pendingOverlayBoundsJson,
            String pendingRoutePointsJson,
            Boolean pendingAiAssisted,
            LocalDateTime pendingUpdatedAt,
            String liveImageUrl,
            String liveSource,
            Integer liveConfidence,
            String liveSummary,
            String liveOverlayBoundsJson,
            String liveRoutePointsJson,
            Boolean liveAiAssisted,
            LocalDateTime liveUpdatedAt,
            LocalDateTime updatedAt
    ) {
        this.raceId = raceId;
        this.raceName = raceName;
        this.city = city;
        this.country = country;
        this.latitude = latitude;
        this.longitude = longitude;
        this.distanceKm = distanceKm;
        this.pendingImageUrl = pendingImageUrl;
        this.pendingSource = pendingSource;
        this.pendingConfidence = pendingConfidence;
        this.pendingSummary = pendingSummary;
        this.pendingOverlayBoundsJson = pendingOverlayBoundsJson;
        this.pendingRoutePointsJson = pendingRoutePointsJson;
        this.pendingAiAssisted = pendingAiAssisted;
        this.pendingUpdatedAt = pendingUpdatedAt;
        this.liveImageUrl = liveImageUrl;
        this.liveSource = liveSource;
        this.liveConfidence = liveConfidence;
        this.liveSummary = liveSummary;
        this.liveOverlayBoundsJson = liveOverlayBoundsJson;
        this.liveRoutePointsJson = liveRoutePointsJson;
        this.liveAiAssisted = liveAiAssisted;
        this.liveUpdatedAt = liveUpdatedAt;
        this.updatedAt = updatedAt;
    }

    @Override
    public String getRaceId() { return raceId; }
    @Override
    public String getRaceName() { return raceName; }
    @Override
    public String getCity() { return city; }
    @Override
    public String getCountry() { return country; }
    @Override
    public Double getLatitude() { return latitude; }
    @Override
    public Double getLongitude() { return longitude; }
    @Override
    public Double getDistanceKm() { return distanceKm; }
    @Override
    public String getPendingImageUrl() { return pendingImageUrl; }
    @Override
    public String getPendingSource() { return pendingSource; }
    @Override
    public Integer getPendingConfidence() { return pendingConfidence; }
    @Override
    public String getPendingSummary() { return pendingSummary; }
    @Override
    public String getPendingOverlayBoundsJson() { return pendingOverlayBoundsJson; }
    @Override
    public String getPendingRoutePointsJson() { return pendingRoutePointsJson; }
    @Override
    public Boolean getPendingAiAssisted() { return pendingAiAssisted; }
    @Override
    public LocalDateTime getPendingUpdatedAt() { return pendingUpdatedAt; }
    @Override
    public String getLiveImageUrl() { return liveImageUrl; }
    @Override
    public String getLiveSource() { return liveSource; }
    @Override
    public Integer getLiveConfidence() { return liveConfidence; }
    @Override
    public String getLiveSummary() { return liveSummary; }
    @Override
    public String getLiveOverlayBoundsJson() { return liveOverlayBoundsJson; }
    @Override
    public String getLiveRoutePointsJson() { return liveRoutePointsJson; }
    @Override
    public Boolean getLiveAiAssisted() { return liveAiAssisted; }
    @Override
    public LocalDateTime getLiveUpdatedAt() { return liveUpdatedAt; }
    @Override
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
