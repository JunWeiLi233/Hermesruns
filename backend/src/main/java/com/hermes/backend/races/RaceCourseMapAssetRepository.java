package com.hermes.backend.races;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RaceCourseMapAssetRepository extends JpaRepository<RaceCourseMapAsset, Long> {
    Optional<RaceCourseMapAsset> findByRaceId(String raceId);

    /**
     * Column-projected catalog read for the admin list endpoint. Selects only the
     * fields the list row consumes — never the per-row elevation-sample JSON or the
     * local route artifact reference — so listing the catalog does not materialize
     * full entities with their multi-hundred-KB text columns. Rows come back in id
     * order, matching the findAll order this path used before.
     */
    @Query("""
            select new com.hermes.backend.races.RaceCourseMapAssetListRow(
                a.raceId, a.raceName, a.city, a.country, a.latitude, a.longitude, a.distanceKm,
                a.pendingImageUrl, a.pendingSource, a.pendingConfidence, a.pendingSummary,
                a.pendingOverlayBoundsJson, a.pendingRoutePointsJson, a.pendingAiAssisted, a.pendingUpdatedAt,
                a.liveImageUrl, a.liveSource, a.liveConfidence, a.liveSummary,
                a.liveOverlayBoundsJson, a.liveRoutePointsJson, a.liveAiAssisted, a.liveUpdatedAt, a.updatedAt)
            from RaceCourseMapAsset a
            order by a.id
            """)
    List<RaceCourseMapAssetListRow> findAllListRows();
}
