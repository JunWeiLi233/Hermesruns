package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends JpaRepository<Activity, Long> {

    boolean existsByRunnerAndProviderAndSourceChecksum(Runner runner, ImportProvider provider, String sourceChecksum);

    Optional<Activity> findByRunnerAndProviderAndSourceChecksum(Runner runner, ImportProvider provider, String sourceChecksum);

    Optional<Activity> findByIdAndRunner(Long id, Runner runner);

    long countByRunner(Runner runner);

    long countByRunnerAndActivityType(Runner runner, ActivityType activityType);

    List<Activity> findByRunnerOrderByIdDesc(Runner runner);

    List<Activity> findByRunnerAndActivityTypeOrderByIdDesc(Runner runner, ActivityType activityType);

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
              a.averageHeartRate AS averageHeartRate,
              a.maxHeartRate AS maxHeartRate,
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
}
