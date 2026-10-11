package com.hermes.backend.activity;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface RouteMatchGroupRepository extends JpaRepository<RouteMatchGroup, Long> {

    List<RouteMatchGroup> findByRunnerId(Long runnerId);

    /** Removes the groups no run of the runner points at any more. Returns how many. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("""
            DELETE FROM RouteMatchGroup g
            WHERE g.runner.id = :runnerId
              AND NOT EXISTS (SELECT 1 FROM Activity a WHERE a.routeMatchGroupId = g.id)
            """)
    int deleteEmptyOf(@Param("runnerId") Long runnerId);

    /** Removes the groups of every runner that no run points at any more. Returns how many. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("""
            DELETE FROM RouteMatchGroup g
            WHERE NOT EXISTS (SELECT 1 FROM Activity a WHERE a.routeMatchGroupId = g.id)
            """)
    int deleteAllEmpty();
}
