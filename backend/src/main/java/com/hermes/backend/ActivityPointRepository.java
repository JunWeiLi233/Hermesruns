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
}
