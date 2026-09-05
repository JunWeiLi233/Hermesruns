package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

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
                   p.elevationRawMeters, p.elevationCorrectedMeters, p.groundContactTimeMs, p.verticalOscillationMm
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
              and ap.latitude is not null
              and ap.longitude is not null
              and ap.latitude between -90 and 90
              and ap.longitude between -180 and 180
            order by coalesce(a.start_time, a.created_at) desc, ap.sequence_index desc
            limit 1
            """, nativeQuery = true)
    List<Object[]> findLatestLatLngByRunnerAndType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType
    );

    @Query(value = """
            select count(*)
            from activity_points ap
            join activities a on a.id = ap.activity_id
            where a.runner_id = :runnerId
              and a.activity_type = :activityType
              and ap.latitude is not null
              and ap.longitude is not null
              and ap.latitude between -90 and 90
              and ap.longitude between -180 and 180
            """, nativeQuery = true)
    long countHeatmapPointsByRunnerAndType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType
    );


    @Query(value = """
            select ap.activity_id, ap.latitude, ap.longitude, ap.distance_meters, ap.elapsed_seconds
            from activity_points ap
            where ap.activity_id in (:activityIds)
            order by ap.activity_id desc, ap.sequence_index asc
            """, nativeQuery = true)
    List<Object[]> findHeatmapPointsByActivityIds(
            @Param("activityIds") List<Long> activityIds
    );

    @Query(value = """
            select ap.activity_id, ap.latitude, ap.longitude, ap.distance_meters, ap.elapsed_seconds
            from activity_points ap
            join activities a on a.id = ap.activity_id
            where a.runner_id = :runnerId
              and a.activity_type = :activityType
              and ap.latitude is not null
              and ap.longitude is not null
              and ap.latitude between -90 and 90
              and ap.longitude between -180 and 180
            order by coalesce(a.start_time, a.created_at) desc, ap.activity_id desc, ap.sequence_index asc
            """, nativeQuery = true)
    List<Object[]> findAllHeatmapPointsByRunnerAndType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType
    );
    @Query(value = """
            select ap.activity_id, ap.latitude, ap.longitude, ap.distance_meters, ap.elapsed_seconds
            from activity_points ap
            join activities a on a.id = ap.activity_id
            where a.runner_id = :runnerId
              and a.activity_type = :activityType
              and ap.latitude is not null
              and ap.longitude is not null
              and ap.latitude between -90 and 90
              and ap.longitude between -180 and 180
            order by coalesce(a.start_time, a.created_at) desc, ap.activity_id desc, ap.sequence_index asc
            limit :limitValue offset :offsetValue
            """, nativeQuery = true)
    List<Object[]> findHeatmapPointsPageByRunnerAndType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType,
            @Param("limitValue") int limitValue,
            @Param("offsetValue") long offsetValue
    );

    @Query(value = """
            with ordered_points as (
                select ap.activity_id,
                       ap.latitude,
                       ap.longitude,
                       ap.distance_meters,
                       ap.elapsed_seconds,
                       row_number() over (order by ap.longitude asc, ap.latitude asc, ap.activity_id desc, ap.sequence_index asc) as point_ordinal
                from activity_points ap
                join activities a on a.id = ap.activity_id
                where a.runner_id = :runnerId
                  and a.activity_type = :activityType
                  and ap.latitude is not null
                  and ap.longitude is not null
                  and ap.latitude between -90 and 90
                  and ap.longitude between -180 and 180
            )
            select activity_id, latitude, longitude, distance_meters, elapsed_seconds
            from ordered_points
            where mod(point_ordinal - 1, :strideValue) = 0
            order by longitude asc, latitude asc, activity_id desc
            limit :limitValue
            """, nativeQuery = true)
    List<Object[]> findHeatmapCoveragePointsByRunnerAndType(
            @Param("runnerId") Long runnerId,
            @Param("activityType") String activityType,
            @Param("strideValue") int strideValue,
            @Param("limitValue") int limitValue
    );

    @Query(value = """
            with ranked_points as (
                select
                    ap.activity_id,
                    ap.latitude,
                    ap.longitude,
                    ap.sequence_index,
                    row_number() over (partition by ap.activity_id order by ap.sequence_index asc) as point_ordinal,
                    count(*) over (partition by ap.activity_id) as activity_point_count
                from activity_points ap
                where ap.activity_id in (:activityIds)
                  and ap.latitude between -90 and 90
                  and ap.longitude between -180 and 180
            )
            select activity_id, latitude, longitude, sequence_index
            from ranked_points
            where point_ordinal = 1
               or point_ordinal = activity_point_count
               or mod(
                    point_ordinal - 1,
                    case
                        when :targetPointsPerActivity <= 2 then 1
                        when activity_point_count <= :targetPointsPerActivity then 1
                        else cast(ceiling(activity_point_count * 1.0 / :targetPointsPerActivity) as integer)
                    end
                  ) = 0
            order by activity_id asc, sequence_index asc
            """, nativeQuery = true)
    List<Object[]> findRoutePreviewSamplesByActivityIds(
            @Param("activityIds") List<Long> activityIds,
            @Param("targetPointsPerActivity") int targetPointsPerActivity
    );

    @Query(value = """
            select
                ap.activity_id,
                min(ap.latitude) as min_latitude,
                max(ap.latitude) as max_latitude,
                min(ap.longitude) as min_longitude,
                max(ap.longitude) as max_longitude,
                count(*) as point_count
            from activity_points ap
            where ap.activity_id in (:activityIds)
              and ap.latitude between -90 and 90
              and ap.longitude between -180 and 180
            group by ap.activity_id
            """, nativeQuery = true)
    List<Object[]> findRoutePreviewBboxesByActivityIds(@Param("activityIds") List<Long> activityIds);

    /**
     * Returns [elapsedSeconds, heartRate] pairs for all stored points that have both values.
     * Returns only up to 10 000 samples (dense per-second data from FIT/GPX/Strava streams).
     * If the activity has no HR data the result is an empty list.
     */
    @Query(value = """
            select p.elapsed_seconds, p.heart_rate
            from activity_points p
            where p.activity_id = :activityId
              and p.heart_rate is not null
              and p.elapsed_seconds is not null
            order by p.sequence_index asc
            limit 10000
            """, nativeQuery = true)
    List<Object[]> findHrSamplesByActivityIdOrdered(@Param("activityId") Long activityId);


}
