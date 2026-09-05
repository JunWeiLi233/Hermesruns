package com.hermes.backend.races;

import java.time.LocalDateTime;

/**
 * Read-only view of the RaceCourseMapAsset columns the admin list row consumes.
 * Implemented by the entity itself and by the SQL projection
 * {@link RaceCourseMapAssetListRow}, so the list path can share the stored-live
 * sanitization/plausibility logic with the detail path without materializing
 * full entities (or their multi-hundred-KB elevation/route JSON) for every row.
 */
public interface RaceCourseMapAssetListFields {
    String getRaceId();
    String getRaceName();
    String getCity();
    String getCountry();
    Double getLatitude();
    Double getLongitude();
    Double getDistanceKm();
    String getPendingImageUrl();
    String getPendingSource();
    Integer getPendingConfidence();
    String getPendingSummary();
    String getPendingOverlayBoundsJson();
    String getPendingRoutePointsJson();
    Boolean getPendingAiAssisted();
    LocalDateTime getPendingUpdatedAt();
    String getLiveImageUrl();
    String getLiveSource();
    Integer getLiveConfidence();
    String getLiveSummary();
    String getLiveOverlayBoundsJson();
    String getLiveRoutePointsJson();
    Boolean getLiveAiAssisted();
    LocalDateTime getLiveUpdatedAt();
    LocalDateTime getUpdatedAt();
}
