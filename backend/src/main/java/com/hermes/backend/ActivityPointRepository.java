package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface ActivityPointRepository extends JpaRepository<ActivityPoint, Long> {

    @Transactional
    void deleteByActivity(Activity activity);

    boolean existsByActivity(Activity activity);

    @Query("""
            select point
            from ActivityPoint point
            join point.activity activity
            where activity.runner = :runner
              and activity.activityType = :activityType
            order by activity.id asc, point.sequenceIndex asc
            """)
    List<ActivityPoint> findHeatmapPointsByRunnerAndActivityType(
            @Param("runner") Runner runner,
            @Param("activityType") ActivityType activityType
    );

    @Query("""
            select point
            from ActivityPoint point
            join point.activity activity
            where activity.runner = :runner
              and activity.activityType = :activityType
              and (
                (activity.startTime is not null and function('year', activity.startTime) = :year)
                or (activity.startTime is null and activity.startDate like :yearPrefix)
              )
            order by activity.id asc, point.sequenceIndex asc
            """)
    List<ActivityPoint> findHeatmapPointsByRunnerAndActivityTypeAndYear(
            @Param("runner") Runner runner,
            @Param("activityType") ActivityType activityType,
            @Param("year") int year,
            @Param("yearPrefix") String yearPrefix
    );

    /** Lightweight projection: returns only [lat, lng] pairs, no ORDER BY (heatmap doesn't need order). */
    @Query("""
            select p.latitude, p.longitude
            from ActivityPoint p
            join p.activity a
            where a.runner = :runner
              and a.activityType = :activityType
            """)
    List<Object[]> findHeatmapCoordsByRunnerAndType(
            @Param("runner") Runner runner,
            @Param("activityType") ActivityType activityType
    );

    /** Lightweight projection with date-range year filter (index-friendly, no function()). */
    @Query("""
            select p.latitude, p.longitude
            from ActivityPoint p
            join p.activity a
            where a.runner = :runner
              and a.activityType = :activityType
              and (
                (a.startTime is not null and a.startTime >= :yearStart and a.startTime < :yearEnd)
                or (a.startTime is null and a.startDate like :yearPrefix)
              )
            """)
    List<Object[]> findHeatmapCoordsByRunnerAndTypeAndYear(
            @Param("runner") Runner runner,
            @Param("activityType") ActivityType activityType,
            @Param("yearStart") LocalDateTime yearStart,
            @Param("yearEnd") LocalDateTime yearEnd,
            @Param("yearPrefix") String yearPrefix
    );

    /** Ordered projection used by `GET /api/activities/{id}/points` to reduce heap usage vs loading entities. */
    @Query("""
            select p.latitude, p.longitude
            from ActivityPoint p
            where p.activity.id = :activityId
            order by p.sequenceIndex asc
            """)
    List<Object[]> findLatLngByActivityIdOrdered(@Param("activityId") Long activityId);

    @Query("""
            select p.latitude, p.longitude, p.elapsedSeconds, p.distanceMeters, p.elevationMeters, p.heartRate, p.cadence,
                   p.elevationRawMeters, p.elevationCorrectedMeters
            from ActivityPoint p
            where p.activity.id = :activityId
            order by p.sequenceIndex asc
            """)
    List<Object[]> findAnalyticsSamplesByActivityIdOrdered(@Param("activityId") Long activityId);

    @Query("""
            select p
            from ActivityPoint p
            where p.activity = :activity
            order by p.sequenceIndex asc
            """)
    List<ActivityPoint> findByActivityOrderBySequenceIndexAsc(@Param("activity") Activity activity);

    @Query(value = """
            select ap.latitude, ap.longitude
            from activity_points ap
            join activities a on a.id = ap.activity_id
            where a.runner_id = :runnerId
              and a.activity_type = :activityType
            order by coalesce(a.start_time, a.created_at) desc, ap.sequence_index desc
            limit 1
            """, nativeQuery = true)
    List<Object[]> findLatestLatLngByRunnerAndType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType
    );
}
