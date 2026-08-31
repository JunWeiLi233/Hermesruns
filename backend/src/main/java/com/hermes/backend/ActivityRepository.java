package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends JpaRepository<Activity, Long> {

    boolean existsByRunnerAndProviderAndSourceChecksum(Runner runner, ImportProvider provider, String sourceChecksum);

    /**
     * Structural-fingerprint duplicate check: catches re-imports of the same activity with different
     * file bytes (e.g. re-exported with a different header, re-compressed, renamed). The distance
     * bucket rounds to the nearest 10 m so minor GPS rounding differences across export formats are
     * tolerated. startTime must match exactly (to the second, as parsed from the file).
     *
     * @param runner          the owning runner
     * @param startTime       parsed activity start time (UTC, second-precision)
     * @param distanceBucket  distanceMeters rounded to the nearest 10 m (long)
     */
    @Query("""
            SELECT CASE WHEN COUNT(a) > 0 THEN true ELSE false END
            FROM Activity a
            WHERE a.runner = :runner
              AND a.startTime = :startTime
              AND a.distanceMeters IS NOT NULL
              AND (ROUND(a.distanceMeters / 10.0) * 10) = :distanceBucket
            """)
    boolean existsByRunnerAndStartTimeAndDistanceBucket(
            @Param("runner") Runner runner,
            @Param("startTime") java.time.LocalDateTime startTime,
            @Param("distanceBucket") long distanceBucket
    );

    Optional<Activity> findByRunnerAndProviderAndSourceChecksum(Runner runner, ImportProvider provider, String sourceChecksum);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Activity a WHERE a.id = :activityId")
    Optional<Activity> findByIdForUpdate(@Param("activityId") Long activityId);

    Optional<Activity> findByIdAndRunner(Long id, Runner runner);

    List<Activity> findByIdInAndRunner(Collection<Long> ids, Runner runner);

    long countByRunner(Runner runner);

    long countByRunnerAndActivityType(Runner runner, ActivityType activityType);

    boolean existsByRunnerAndActivityTypeIsNull(Runner runner);

    List<Activity> findByRunnerOrderByIdDesc(Runner runner);

    List<Activity> findByRunnerAndActivityTypeOrderByIdDesc(Runner runner, ActivityType activityType);

    /**
     * Limit-parameterized twin of {@link #findByRunnerAndActivityTypeOrderByIdDesc(Runner, ActivityType)}.
     * Pushes the row cap into the query so a limited feed load materializes only the
     * requested most-recent N run entities instead of the runner's entire history.
     * Callers pass an already clamped positive limit (1..500) — the cap is not re-applied here.
     */
    List<Activity> findByRunnerAndActivityTypeOrderByIdDesc(Runner runner, ActivityType activityType, Limit limit);

    @Query(value = """
            select a.id
            from activities a
            where a.runner_id = :runnerId
              and a.activity_type = :activityType
            order by coalesce(a.start_time, a.created_at) desc, a.id desc
            limit :limitValue
            """, nativeQuery = true)
    List<Long> findRecentIdsByRunnerAndActivityType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType,
            @Param("limitValue") int limitValue
    );

    @Query(value = """
            select a.id
            from activities a
            where a.runner_id = :runnerId
              and a.activity_type = :activityType
            order by coalesce(a.start_time, a.created_at) desc, a.id desc
            """, nativeQuery = true)
    List<Long> findIdsByRunnerAndActivityType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType
    );

    @Query("""
            SELECT COUNT(a), MAX(a.id), MAX(COALESCE(a.startTime, a.createdAt))
            FROM Activity a
            WHERE a.runner.id = :runnerId
              AND a.activityType = :activityType
            """)
    Object[] findActivitySetSignatureByRunnerAndActivityType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") ActivityType activityType
    );

    @Query("""
            SELECT COUNT(a), MAX(a.id), MAX(COALESCE(a.startTime, a.createdAt))
            FROM Activity a
            JOIN a.runner runner
            WHERE a.activityType = :activityType
              AND runner.deleted = false
            """)
    Object[] findGlobalActivitySetSignatureByActivityType(
            @Param("activityType") ActivityType activityType
    );

    @Query("""
            SELECT COUNT(a), MAX(a.id), MAX(COALESCE(a.startTime, a.createdAt))
            FROM Activity a
            JOIN a.runner runner
            WHERE a.activityType = :activityType
              AND runner.deleted = false
            """)
    Object[] findRegisteredGlobalActivitySetSignatureByActivityType(
            @Param("activityType") ActivityType activityType
    );

    @Query("""
            SELECT a.id, COALESCE(a.startTime, a.createdAt)
            FROM Activity a
            WHERE a.id IN :activityIds
            """)
    List<Object[]> findEffectiveTimesByActivityIds(@Param("activityIds") Collection<Long> activityIds);

    @Query("""
            SELECT
              a.id AS id,
              a.name AS name,
              a.distanceKm AS distanceKm,
              a.distanceMeters AS distanceMeters,
              a.movingTimeSeconds AS movingTimeSeconds,
              a.durationSeconds AS durationSeconds,
              a.startDate AS startDate,
              a.startTime AS startTime,
              a.metrics.averageHeartRate AS averageHeartRate,
              a.metrics.maxHeartRate AS maxHeartRate,
              a.metrics.averageCadence AS averageCadence,
              a.metrics.maxSpeedMps AS maxSpeedMps,
              a.metrics.totalElevationGain AS totalElevationGain,
              a.metrics.pacePenaltySecPerKm AS pacePenaltySecPerKm,
              a.metrics.weatherAdjusted AS weatherAdjusted,
              shoe.id AS shoeId,
              shoe.brand AS shoeBrand,
              shoe.model AS shoeModel,
              shoe.nickname AS shoeNickname
            FROM Activity a
            LEFT JOIN a.shoe shoe
            WHERE a.runner = :runner
              AND a.activityType = :type
            ORDER BY COALESCE(a.startTime, a.createdAt) DESC, a.id DESC
            """)
    List<AnalysisActivitySummaryProjection> findAnalysisSummariesByRunnerAndActivityType(
            @Param("runner") Runner runner,
            @Param("type") ActivityType type
    );

    @Query("""
            SELECT
              a.id AS id,
              a.name AS name,
              a.distanceKm AS distanceKm,
              a.distanceMeters AS distanceMeters,
              a.movingTimeSeconds AS movingTimeSeconds,
              a.durationSeconds AS durationSeconds,
              a.startDate AS startDate,
              a.startTime AS startTime,
              a.metrics.averageHeartRate AS averageHeartRate,
              a.metrics.maxHeartRate AS maxHeartRate,
              a.metrics.averageCadence AS averageCadence,
              a.metrics.maxSpeedMps AS maxSpeedMps,
              a.metrics.totalElevationGain AS totalElevationGain,
              a.metrics.pacePenaltySecPerKm AS pacePenaltySecPerKm,
              a.metrics.weatherAdjusted AS weatherAdjusted,
              shoe.id AS shoeId,
              shoe.brand AS shoeBrand,
              shoe.model AS shoeModel,
              shoe.nickname AS shoeNickname
            FROM Activity a
            LEFT JOIN a.shoe shoe
            WHERE a.runner = :runner
              AND a.activityType = :type
            ORDER BY COALESCE(a.startTime, a.createdAt) DESC, a.id DESC
            """)
    List<AnalysisActivitySummaryProjection> findAnalysisSummariesByRunnerAndActivityType(
            @Param("runner") Runner runner,
            @Param("type") ActivityType type,
            Pageable pageable
    );

    @Query("SELECT COALESCE(SUM(CASE WHEN a.distanceKm > 0 THEN a.distanceKm " +
           "WHEN a.distanceMeters IS NOT NULL THEN a.distanceMeters / 1000.0 " +
           "ELSE 0 END), 0) FROM Activity a WHERE a.shoe.id = :shoeId")
    double sumDistanceKmByShoeId(@Param("shoeId") Long shoeId);

    @Query("SELECT a.shoe.id, COALESCE(SUM(CASE WHEN a.distanceKm > 0 THEN a.distanceKm " +
           "WHEN a.distanceMeters IS NOT NULL THEN a.distanceMeters / 1000.0 " +
           "ELSE 0 END), 0) FROM Activity a WHERE a.runner = :runner AND a.shoe IS NOT NULL GROUP BY a.shoe.id")
    List<Object[]> sumDistanceKmByRunner(@Param("runner") Runner runner);

    @Modifying
    @Query("UPDATE Activity a SET a.shoe = null WHERE a.shoe.id = :shoeId")
    void unlinkShoeFromActivities(@Param("shoeId") Long shoeId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Activity a SET a.shoe = :keep WHERE a.runner = :runner AND a.shoe.id = :mergeShoeId")
    int reassignActivitiesToShoe(@Param("runner") Runner runner, @Param("keep") Shoe keep, @Param("mergeShoeId") Long mergeShoeId);

    @Query("SELECT a.shoe.id, MAX(COALESCE(a.startTime, CAST(a.startDate AS timestamp))) " +
           "FROM Activity a WHERE a.runner = :runner AND a.shoe IS NOT NULL GROUP BY a.shoe.id")
    List<Object[]> findLastUsedDateByRunner(@Param("runner") Runner runner);

    @Query("SELECT a FROM Activity a WHERE a.runner = :runner AND a.activityType = :type " +
           "AND COALESCE(a.startTime, a.createdAt) >= :from AND COALESCE(a.startTime, a.createdAt) < :to")
    List<Activity> findRunsBetween(
            @Param("runner") Runner runner,
            @Param("type") ActivityType type,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("""
            SELECT
              a.metrics.averageHeartRate AS averageHeartRate,
              a.metrics.maxHeartRate AS maxHeartRate,
              a.movingTimeSeconds AS movingTimeSeconds,
              a.durationSeconds AS durationSeconds,
              a.distanceKm AS distanceKm,
              a.distanceMeters AS distanceMeters,
              COALESCE(a.startTime, a.createdAt) AS effectiveStartTime
            FROM Activity a
            WHERE a.runner = :runner
              AND a.activityType = :type
              AND COALESCE(a.startTime, a.createdAt) >= :from
              AND COALESCE(a.startTime, a.createdAt) < :to
            """)
    List<RunMetricsProjection> findRunMetricsBetween(
            @Param("runner") Runner runner,
            @Param("type") ActivityType type,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to
    );

    @Query("SELECT DISTINCT a.runner.id FROM Activity a WHERE a.activityType = :type")
    List<Long> findDistinctRunnerIdsWithActivityType(@Param("type") ActivityType type);

    @Query("SELECT AVG(CASE WHEN a.distanceKm > 0 THEN (a.movingTimeSeconds * 1.0 / a.distanceKm) ELSE null END) " +
            "FROM Activity a WHERE a.shoe = :shoe AND a.activityType = :type AND a.distanceKm > 0 AND a.movingTimeSeconds > 0")
    Double findAveragePaceSecondsPerKmByShoe(@Param("shoe") Shoe shoe, @Param("type") ActivityType type);

    /**
     * Returns the most recent runs (up to :limit) by runner and activity type whose effective
     * start time is BEFORE :beforeTime and whose distanceKm falls within [:minKm, :maxKm].
     * Used for the improvement-metric comparison baseline.
     */
    @Query("""
            SELECT a FROM Activity a
            WHERE a.runner = :runner
              AND a.activityType = :type
              AND COALESCE(a.startTime, a.createdAt) < :beforeTime
              AND (
                (a.distanceKm > 0 AND a.distanceKm >= :minKm AND a.distanceKm <= :maxKm)
                OR (a.distanceKm = 0 AND a.distanceMeters IS NOT NULL
                    AND a.distanceMeters / 1000.0 >= :minKm AND a.distanceMeters / 1000.0 <= :maxKm)
              )
              AND (a.movingTimeSeconds > 0 OR a.durationSeconds > 0)
            ORDER BY COALESCE(a.startTime, a.createdAt) DESC
            """)
    org.springframework.data.domain.Page<Activity> findRecentRunsInDistanceBucket(
            @Param("runner") Runner runner,
            @Param("type") ActivityType type,
            @Param("beforeTime") LocalDateTime beforeTime,
            @Param("minKm") double minKm,
            @Param("maxKm") double maxKm,
            org.springframework.data.domain.Pageable pageable
    );

    interface AnalysisActivitySummaryProjection {
        Long getId();
        String getName();
        Double getDistanceKm();
        Double getDistanceMeters();
        Integer getMovingTimeSeconds();
        Long getDurationSeconds();
        String getStartDate();
        LocalDateTime getStartTime();
        Double getAverageHeartRate();
        Double getMaxHeartRate();
        Double getAverageCadence();
        Double getMaxSpeedMps();
        Double getTotalElevationGain();
        Integer getPacePenaltySecPerKm();
        Boolean getWeatherAdjusted();
        Long getShoeId();
        String getShoeBrand();
        String getShoeModel();
        String getShoeNickname();
    }
}
