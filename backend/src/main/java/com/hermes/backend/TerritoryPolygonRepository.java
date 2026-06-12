package com.hermes.backend;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TerritoryPolygonRepository extends JpaRepository<TerritoryPolygon, Long> {

    /** Returns all polygons for a user ordered newest-first (createdAt desc, id desc). */
    @Query("""
            select p from TerritoryPolygon p
            where p.userId = :userId
            order by p.createdAt desc, p.id desc
            """)
    List<TerritoryPolygon> findByUserIdOrderByCreatedAtDesc(
            @Param("userId") Long userId,
            Pageable pageable
    );

    /** Returns every land-mask row candidate for a user; Territory itself handles legacy filtering. */
    @Query("""
            select p from TerritoryPolygon p
            where p.userId = :userId
            order by p.createdAt desc, p.id desc
            """)
    List<TerritoryPolygon> findAllByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    /** Returns every live runner land-mask candidate ordered by the activity time that should win color-fill ownership. */
    @Query("""
            select polygon
            from TerritoryPolygon polygon, Activity activity, Runner runner
            where activity.id = polygon.activityId
              and runner.id = polygon.userId
              and runner.deleted = false
            order by coalesce(activity.startTime, activity.createdAt) desc, activity.id desc, polygon.id desc
            """)
    List<TerritoryPolygon> findAllLiveLandMasksOrderByActivityTimeDesc();

    /** Cache signature for live land-mask rows; ownership can change when masks are computed after activities exist. */
    @Query("""
            select count(p), max(p.id), max(p.createdAt)
            from TerritoryPolygon p, Runner runner
            where runner.id = p.userId
              and runner.deleted = false
            """)
    Object[] findGlobalLiveLandMaskSignature();

    /** Checks whether polygons already exist for a given activity. Used by backfill to skip duplicates. */
    boolean existsByActivityId(Long activityId);

    /** Returns persisted territory rows for an activity so legacy coordinate rows can be upgraded. */
    List<TerritoryPolygon> findByActivityId(Long activityId);

    /** Deletes all polygons for a given activity (used if activity is re-ingested). */
    void deleteByActivityId(Long activityId);
}
