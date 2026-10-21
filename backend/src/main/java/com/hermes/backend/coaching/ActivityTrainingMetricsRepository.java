package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.RunTypes;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
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

    /** Bounded calendar candidate range, including absent metrics; owner-scoped scalar projection only. */
    @Query("""
            SELECT a.id AS activityId, a.startTime AS startTime,
              COALESCE(a.startTime, a.createdAt) AS effectiveStartTime,
              a.stravaApiSourced AS stravaApiSourced,
              a.movingTimeSeconds AS movingTimeSeconds, a.durationSeconds AS durationSeconds,
              a.distanceKm AS distanceKm, a.distanceMeters AS distanceMeters,
              m.id AS metricsId, m.localDate AS metricsDate, m.hrCoveredSeconds AS coveredSeconds,
              m.hrZone1Seconds AS z1, m.hrZone2Seconds AS z2, m.hrZone3Seconds AS z3,
              m.hrZone4Seconds AS z4, m.hrZone5Seconds AS z5,
              m.maxHrUsed AS maxHrUsed, m.hrBoundary1Bpm AS b1, m.hrBoundary2Bpm AS b2,
              m.hrBoundary3Bpm AS b3, m.hrBoundary4Bpm AS b4,
              m.stale AS stale, m.modelVersion AS modelVersion,
              m.effortSource AS effortSource, m.computedAt AS computedAt
            FROM Activity a LEFT JOIN ActivityTrainingMetrics m ON m.activity = a AND m.runner.id = :runnerId
            WHERE a.runner.id = :runnerId AND a.activityType = :type
              AND COALESCE(a.startTime, a.createdAt) >= :from
              AND COALESCE(a.startTime, a.createdAt) < :to
            ORDER BY COALESCE(a.startTime, a.createdAt), a.id
            """)
    List<HrBlockProjection> findHrBlockCandidates(@Param("runnerId") Long runnerId,
            @Param("type") ActivityType type, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

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

    /**
     * What each day of a window holds: {@code [localDate, sum of effort, number of runs]}, oldest day first, only days
     * that had a run with an effort. Fitness, fatigue, form and the weekly effort are all made from these rows.
     */
    @Query("""
            SELECT m.localDate, SUM(m.effortScore), COUNT(m) FROM ActivityTrainingMetrics m
            WHERE m.runner.id = :runnerId AND m.localDate >= :from AND m.localDate <= :to AND m.effortScore IS NOT NULL
            GROUP BY m.localDate
            ORDER BY m.localDate ASC
            """)
    List<Object[]> dailyEffort(@Param("runnerId") Long runnerId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * What each day of a window holds of heart-rate time: {@code [localDate, runs, runs with a heart-rate stream, seconds in
     * zone 1, zone 2, zone 3, zone 4, zone 5]}, oldest day first, only days that had a run. The intensity distribution is made
     * from these rows, summed per week in the service.
     */
    @Query("""
            SELECT m.localDate, COUNT(m), SUM(CASE WHEN m.hrCoveredSeconds > 0 THEN 1 ELSE 0 END),
                   COALESCE(SUM(m.hrZone1Seconds), 0), COALESCE(SUM(m.hrZone2Seconds), 0), COALESCE(SUM(m.hrZone3Seconds), 0),
                   COALESCE(SUM(m.hrZone4Seconds), 0), COALESCE(SUM(m.hrZone5Seconds), 0)
            FROM ActivityTrainingMetrics m
            WHERE m.runner.id = :runnerId AND m.localDate >= :from AND m.localDate <= :to
            GROUP BY m.localDate
            ORDER BY m.localDate ASC
            """)
    List<Object[]> dailyZoneSeconds(@Param("runnerId") Long runnerId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** The days of a window on which the runner raced: the days their runs typed as a race were filed under. */
    @Query("SELECT DISTINCT m.localDate FROM ActivityTrainingMetrics m WHERE m.runner.id = :runnerId AND m.localDate >= :from "
            + "AND m.localDate <= :to AND m.activity.runType = '" + RunTypes.RACE + "' ORDER BY m.localDate ASC")
    List<LocalDate> raceDays(@Param("runnerId") Long runnerId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** The day of the runner's first run that has an effort, or null when none has. */
    @Query("SELECT MIN(m.localDate) FROM ActivityTrainingMetrics m WHERE m.runner.id = :runnerId AND m.effortScore IS NOT NULL")
    LocalDate firstEffortDay(@Param("runnerId") Long runnerId);

    /** How many runs of a window got their effort from each source: {@code [source, count]}. */
    @Query("""
            SELECT m.effortSource, COUNT(m) FROM ActivityTrainingMetrics m
            WHERE m.runner.id = :runnerId AND m.localDate >= :from AND m.localDate <= :to AND m.effortScore IS NOT NULL
            GROUP BY m.effortSource
            ORDER BY COUNT(m) DESC, m.effortSource ASC
            """)
    List<Object[]> effortSourceCounts(@Param("runnerId") Long runnerId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** A runner's runs that have no metrics row yet. */
    @Query("""
            SELECT COUNT(a) FROM Activity a
            WHERE a.runner.id = :runnerId AND a.activityType = :type
              AND NOT EXISTS (SELECT 1 FROM ActivityTrainingMetrics m WHERE m.activity = a)
            """)
    long countRunsWithoutMetrics(@Param("runnerId") Long runnerId, @Param("type") ActivityType type);

    /** How many of a runner's rows {@link #findStaleActivityIds} would list: the same test, counted. */
    @Query("""
            SELECT COUNT(m) FROM ActivityTrainingMetrics m
            WHERE m.runner.id = :runnerId
              AND (m.stale = TRUE OR m.modelVersion <> :modelVersion OR m.maxHrUsed <> :maxHr
                   OR m.hrBoundary1Bpm <> :b1 OR m.hrBoundary2Bpm <> :b2 OR m.hrBoundary3Bpm <> :b3 OR m.hrBoundary4Bpm <> :b4)
            """)
    long countOutOfDate(@Param("runnerId") Long runnerId,
                        @Param("modelVersion") int modelVersion,
                        @Param("maxHr") int maxHr,
                        @Param("b1") int b1, @Param("b2") int b2, @Param("b3") int b3, @Param("b4") int b4);
}
