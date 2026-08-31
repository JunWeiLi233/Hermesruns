package com.hermes.backend;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Executes the RaceCourseMapAssetRepository.findAllListRows() JPQL constructor
 * projection against a real database. The unit tests around the admin list mock
 * the repository, so a transposition of same-type columns (city/country,
 * pendingImageUrl/pendingSource, the overlay-bounds/route-points JSON pairs,
 * liveImageUrl/liveSource) would compile, boot, and silently swap data. This
 * test persists one fixture with distinct values in every projected column and
 * requires each projection getter to match the stored entity's getter.
 */
@SpringBootTest
@Transactional
class RaceCourseMapAssetRepositoryProjectionTests {

    @Autowired
    private RaceCourseMapAssetRepository raceCourseMapAssetRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void findAllListRowsMapsEveryProjectedColumnWithoutTransposition() {
        RaceCourseMapAsset asset = new RaceCourseMapAsset();
        // Every same-type column gets a distinct value so a swapped select list
        // cannot pass by accident.
        asset.setRaceId("projection-race-id");
        asset.setRaceName("Projection Race Name");
        asset.setCity("Projection City");
        asset.setCountry("Projection Country");
        asset.setLatitude(12.34);
        asset.setLongitude(56.78);
        asset.setDistanceKm(42.195);
        asset.setPendingImageUrl("pending-image-url-value");
        asset.setPendingSource("pending-source-value");
        asset.setPendingConfidence(61);
        asset.setPendingSummary("pending summary value");
        asset.setPendingOverlayBoundsJson("{\"north\":11.1,\"south\":1.1,\"east\":2.2,\"west\":3.3}");
        asset.setPendingRoutePointsJson("[{\"lat\":4.4,\"lng\":5.5},{\"lat\":6.6,\"lng\":7.7}]");
        asset.setPendingAiAssisted(true);
        asset.setPendingUpdatedAt(LocalDateTime.of(2026, 8, 1, 9, 0));
        asset.setLiveImageUrl("live-image-url-value");
        asset.setLiveSource("live-source-value");
        asset.setLiveConfidence(87);
        asset.setLiveSummary("live summary value");
        asset.setLiveOverlayBoundsJson("{\"north\":21.2,\"south\":12.1,\"east\":22.2,\"west\":23.3}");
        asset.setLiveRoutePointsJson("[{\"lat\":14.4,\"lng\":15.5},{\"lat\":16.6,\"lng\":17.7}]");
        asset.setLiveAiAssisted(false);
        asset.setLiveUpdatedAt(LocalDateTime.of(2026, 8, 2, 10, 30));
        // Columns the projection deliberately does not select (must not leak anywhere).
        asset.setPendingElevationSamplesJson("[101, 102]");
        asset.setPendingTotalClimbMeters(111);
        asset.setLiveElevationSamplesJson("[201, 202]");
        asset.setLiveTotalClimbMeters(222);
        asset.setLocalRouteArtifactRef("local-artifact-ref-value");

        raceCourseMapAssetRepository.save(asset);
        entityManager.flush();
        entityManager.clear();

        RaceCourseMapAsset stored = raceCourseMapAssetRepository.findByRaceId("projection-race-id")
                .orElseThrow(() -> new AssertionError("fixture row missing after flush"));
        List<RaceCourseMapAssetListRow> rows = raceCourseMapAssetRepository.findAllListRows();
        RaceCourseMapAssetListRow row = rows.stream()
                .filter(candidate -> "projection-race-id".equals(candidate.getRaceId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("projection row missing: " + rows.size()));

        // Identity fields: same-type pairs must keep their own values.
        assertEquals(stored.getRaceId(), row.getRaceId());
        assertEquals(stored.getRaceName(), row.getRaceName());
        assertEquals(stored.getCity(), row.getCity());
        assertEquals(stored.getCountry(), row.getCountry());

        // Numeric columns.
        assertEquals(stored.getLatitude(), row.getLatitude());
        assertEquals(stored.getLongitude(), row.getLongitude());
        assertEquals(stored.getDistanceKm(), row.getDistanceKm());

        // Pending block (image URL vs source vs summary vs the two JSON columns).
        assertEquals(stored.getPendingImageUrl(), row.getPendingImageUrl());
        assertEquals(stored.getPendingSource(), row.getPendingSource());
        assertEquals(stored.getPendingConfidence(), row.getPendingConfidence());
        assertEquals(stored.getPendingSummary(), row.getPendingSummary());
        assertEquals(stored.getPendingOverlayBoundsJson(), row.getPendingOverlayBoundsJson());
        assertEquals(stored.getPendingRoutePointsJson(), row.getPendingRoutePointsJson());
        assertEquals(stored.getPendingAiAssisted(), row.getPendingAiAssisted());
        assertEquals(stored.getPendingUpdatedAt(), row.getPendingUpdatedAt());

        // Live block, distinct from every pending value.
        assertEquals(stored.getLiveImageUrl(), row.getLiveImageUrl());
        assertEquals(stored.getLiveSource(), row.getLiveSource());
        assertEquals(stored.getLiveConfidence(), row.getLiveConfidence());
        assertEquals(stored.getLiveSummary(), row.getLiveSummary());
        assertEquals(stored.getLiveOverlayBoundsJson(), row.getLiveOverlayBoundsJson());
        assertEquals(stored.getLiveRoutePointsJson(), row.getLiveRoutePointsJson());
        assertEquals(stored.getLiveAiAssisted(), row.getLiveAiAssisted());
        assertEquals(stored.getLiveUpdatedAt(), row.getLiveUpdatedAt());

        // The row updatedAt is DB-generated (@PreUpdate) but must still round-trip.
        assertNotNull(stored.getUpdatedAt());
        assertEquals(stored.getUpdatedAt(), row.getUpdatedAt());

        // Elevation/climb/artifact columns are intentionally not selected, and the
        // chosen values above must never appear in any projected column.
        String leakCheck = java.util.Arrays.toString(new Object[]{
                row.getRaceId(), row.getRaceName(), row.getCity(), row.getCountry(),
                row.getPendingImageUrl(), row.getPendingSource(), row.getPendingSummary(),
                row.getPendingOverlayBoundsJson(), row.getPendingRoutePointsJson(),
                row.getLiveImageUrl(), row.getLiveSource(), row.getLiveSummary(),
                row.getLiveOverlayBoundsJson(), row.getLiveRoutePointsJson()});
        assertTrue(!leakCheck.contains("101") && !leakCheck.contains("201")
                        && !leakCheck.contains("local-artifact-ref-value"),
                "unselected column values leaked into the projection: " + leakCheck);
    }
}
