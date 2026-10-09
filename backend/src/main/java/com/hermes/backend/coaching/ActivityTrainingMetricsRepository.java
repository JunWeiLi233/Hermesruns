package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ownership: every method that reads a row is keyed by the runner as well as the activity, or is used only by
 * code that has already established whose run it is (the compute service checks it against the event).
 */
public interface ActivityTrainingMetricsRepository extends JpaRepository<ActivityTrainingMetrics, Long> {

    Optional<ActivityTrainingMetrics> findByActivityIdAndRunnerId(Long activityId, Long runnerId);

    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM ActivityTrainingMetrics m WHERE m.activity.id IN :activityIds")
    int deleteByActivityIds(@Param("activityIds") Collection<Long> activityIds);

    /**
     * What the pace model needs to be put on the heart-rate scale: how many runs have both scores, and the two
     * sums the least-squares fit is built from. One row: {@code [count, sum(hr x pace), sum(pace x pace)]}.
     */
    @Query("""
            SELECT COUNT(m), COALESCE(SUM(m.hrEffort * m.paceEffort), 0.0), COALESCE(SUM(m.paceEffort * m.paceEffort), 0.0)
            FROM ActivityTrainingMetrics m
            WHERE m.runner.id = :runnerId AND m.effortSource = 'HR_ZONES' AND m.hrEffort > 0 AND m.paceEffort > 0
            """)
    List<Object[]> calibrationSums(@Param("runnerId") Long runnerId);

    /** A runner's runs that have no metrics row yet, oldest first after {@code afterId}. */
    @Query("""
            SELECT a.id FROM Activity a
            WHERE a.runner.id = :runnerId AND a.activityType = :type AND a.id > :afterId
              AND NOT EXISTS (SELECT 1 FROM ActivityTrainingMetrics m WHERE m.activity = a)
            ORDER BY a.id ASC
            """)
    List<Long> findRunIdsWithoutMetrics(@Param("runnerId") Long runnerId,
                                        @Param("type") ActivityType type,
                                        @Param("afterId") Long afterId,
                                        Pageable page);

    /** Runs of every runner with no metrics row, newest first, as {@code [activityId, runnerId]}: what a restart catches up on. */
    @Query("""
            SELECT a.id, a.runner.id FROM Activity a
            WHERE a.activityType = :type
              AND NOT EXISTS (SELECT 1 FROM ActivityTrainingMetrics m WHERE m.activity = a)
            ORDER BY a.id DESC
            """)
    List<Object[]> findNewestRunIdsWithoutMetrics(@Param("type") ActivityType type, Pageable page);

    /**
     * A runner's runs whose row is out of date: computed with other zones or another model, or flagged.
     * Out-of-date means anything a fresh computation would change; a run rated since is caught by
     * {@link TrainingMetricsService} when the run is read, because the rating lives on the activity.
     */
    @Query("""
            SELECT m.activity.id FROM ActivityTrainingMetrics m
            WHERE m.runner.id = :runnerId AND m.activity.id > :afterId
              AND (m.stale = TRUE OR m.modelVersion <> :modelVersion OR m.maxHrUsed <> :maxHr
                   OR m.hrBoundary1Bpm <> :b1 OR m.hrBoundary2Bpm <> :b2 OR m.hrBoundary3Bpm <> :b3 OR m.hrBoundary4Bpm <> :b4)
            ORDER BY m.activity.id ASC
            """)
    List<Long> findStaleActivityIds(@Param("runnerId") Long runnerId,
                                    @Param("afterId") Long afterId,
                                    @Param("modelVersion") int modelVersion,
                                    @Param("maxHr") int maxHr,
                                    @Param("b1") int b1, @Param("b2") int b2, @Param("b3") int b3, @Param("b4") int b4,
                                    Pageable page);

    /** Flags every row of a runner for recomputing. */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ActivityTrainingMetrics m SET m.stale = TRUE WHERE m.runner.id = :runnerId")
    int markAllStale(@Param("runnerId") Long runnerId);
}
