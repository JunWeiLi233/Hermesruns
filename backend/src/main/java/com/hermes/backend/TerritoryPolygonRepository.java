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

    /** Checks whether polygons already exist for a given activity. Used by backfill to skip duplicates. */
    boolean existsByActivityId(Long activityId);

    /** Deletes all polygons for a given activity (used if activity is re-ingested). */
    void deleteByActivityId(Long activityId);
}
