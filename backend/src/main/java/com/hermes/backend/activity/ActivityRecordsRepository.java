package com.hermes.backend.activity;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * What the run analysis (best efforts and route matching) needs to know about runs: which still have to be analysed and
 * which belong to a route group. The runs themselves are read through {@link ActivityRepository}.
 */
public interface ActivityRecordsRepository extends Repository<Activity, Long> {

    /** The runner's runs not yet analysed at this version, newest first. */
    @Query("""
            SELECT a.id FROM Activity a
            WHERE a.runner.id = :runnerId AND a.activityType = :type
              AND (a.recordsVersion IS NULL OR a.recordsVersion < :version)
            ORDER BY a.id DESC
            """)
    List<Long> findPendingRunIds(@Param("runnerId") Long runnerId, @Param("type") ActivityType type,
                                 @Param("version") int version, Pageable page);

    @Query("""
            SELECT COUNT(a) FROM Activity a
            WHERE a.runner.id = :runnerId AND a.activityType = :type
              AND (a.recordsVersion IS NULL OR a.recordsVersion < :version)
            """)
    long countPendingRuns(@Param("runnerId") Long runnerId, @Param("type") ActivityType type, @Param("version") int version);

    /** Runs of every runner not yet analysed at this version, newest first, as {@code [activityId, runnerId]}. */
    @Query("""
            SELECT a.id, a.runner.id FROM Activity a
            WHERE a.activityType = :type AND (a.recordsVersion IS NULL OR a.recordsVersion < :version)
            ORDER BY a.id DESC
            """)
    List<Object[]> findNewestPendingRuns(@Param("type") ActivityType type, @Param("version") int version, Pageable page);

    /**
     * The runs of one group, newest first. A run with no start time (a route file with no timestamps) counts from the day
     * it was added, as in the other newest-first queries: databases disagree on where a null sorts.
     */
    @Query("""
            SELECT a FROM Activity a
            WHERE a.runner.id = :runnerId AND a.routeMatchGroupId = :groupId AND a.activityType = :type
            ORDER BY COALESCE(a.startTime, a.createdAt) DESC, a.id DESC
            """)
    List<Activity> findGroupRuns(@Param("runnerId") Long runnerId, @Param("groupId") Long groupId,
                                 @Param("type") ActivityType type, Pageable page);

    @Query("SELECT COUNT(a) FROM Activity a WHERE a.runner.id = :runnerId AND a.routeMatchGroupId = :groupId AND a.activityType = :type")
    long countGroupRuns(@Param("runnerId") Long runnerId, @Param("groupId") Long groupId, @Param("type") ActivityType type);

    /** Detaches every run of the runner from its group, so the groups can be deleted. */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Activity a SET a.routeMatchGroupId = NULL WHERE a.runner.id = :runnerId AND a.routeMatchGroupId IS NOT NULL")
    int detachFromGroups(@Param("runnerId") Long runnerId);

    /** Marks every run of the runner as needing the analysis again. */
    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Activity a SET a.recordsVersion = NULL WHERE a.runner.id = :runnerId")
    int markAllPending(@Param("runnerId") Long runnerId);
}
