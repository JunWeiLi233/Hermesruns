package com.hermes.backend.activity;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ownership: a tag is read through the activities already established as the runner's, or through the runner id kept on
 * the row; no method answers for a tag by its own id alone.
 */
public interface ActivityTagRepository extends JpaRepository<ActivityTag, Long> {

    /**
     * The tags of some runs as {@code [activity id, label]}, in the order they were added. The caller has already checked
     * the runs are the runner's. Pairs, not entities: an entity's run is a lazy proxy that cannot be read outside a session.
     */
    @Query("SELECT t.activity.id, t.label FROM ActivityTag t WHERE t.activity.id IN :activityIds ORDER BY t.id ASC")
    List<Object[]> findLabels(@Param("activityIds") Collection<Long> activityIds);

    /** Every tag of a runner as {@code [activity id, label]}, for the account export. */
    @Query("SELECT t.activity.id, t.label FROM ActivityTag t WHERE t.runner.id = :runnerId ORDER BY t.activity.id ASC, t.id ASC")
    List<Object[]> findAllLabels(@Param("runnerId") Long runnerId);

    /**
     * How often a runner wrote each spelling of each tag: {@code [label key, label, number of runs, first row id]}. Counting
     * per spelling, not per key, lets the caller show the spelling the runner uses most (the earliest one on a tie) the same
     * way on every database, which a MIN over text would not: that follows the database's collation.
     */
    @Query("""
            SELECT t.labelKey, t.label, COUNT(t), MIN(t.id) FROM ActivityTag t
            WHERE t.runner.id = :runnerId
            GROUP BY t.labelKey, t.label
            """)
    List<Object[]> usageBySpelling(@Param("runnerId") Long runnerId);

    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM ActivityTag t WHERE t.activity.id IN :activityIds")
    int deleteByActivityIds(@Param("activityIds") Collection<Long> activityIds);
}
