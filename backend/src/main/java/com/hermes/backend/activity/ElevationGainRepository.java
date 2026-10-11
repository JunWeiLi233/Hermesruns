package com.hermes.backend.activity;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/** The reads behind {@link ElevationGainService}: which runs have no climb figure, and the elevations of one run's points. */
interface ElevationGainRepository extends Repository<Activity, Long> {

    /**
     * Runs with no climb figure whose points carry elevation, newest first. A run with no elevation anywhere is left out,
     * so it is not looked at again after every start.
     */
    @Query("""
            SELECT a.id FROM Activity a
            WHERE a.activityType = :type AND a.metrics.totalElevationGain IS NULL
              AND EXISTS (
                  SELECT 1 FROM ActivityPoint p
                  WHERE p.activity = a
                    AND (p.elevationMeters IS NOT NULL OR p.elevationRawMeters IS NOT NULL OR p.elevationCorrectedMeters IS NOT NULL))
            ORDER BY a.id DESC
            """)
    List<Long> findNewestRunIdsWithoutClimb(@Param("type") ActivityType type, Pageable page);

    /** {@code [corrected, raw, elevation]} of every point of a run, in order. */
    @Query("""
            SELECT p.elevationCorrectedMeters, p.elevationRawMeters, p.elevationMeters
            FROM ActivityPoint p
            WHERE p.activity.id = :activityId
            ORDER BY p.sequenceIndex
            """)
    List<Object[]> findElevationColumns(@Param("activityId") Long activityId);
}
