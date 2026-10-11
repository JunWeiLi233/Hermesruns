package com.hermes.backend.activity;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ownership: every method that reads rows is keyed by the runner as well as the run, or by the runner alone. The
 * services that call it have checked whose run it is first.
 */
public interface ActivityBestEffortRepository extends JpaRepository<ActivityBestEffort, Long> {

    List<ActivityBestEffort> findByActivityIdAndRunnerIdOrderByDistanceMetersAsc(Long activityId, Long runnerId);

    Optional<ActivityBestEffort> findByActivityIdAndRunnerIdAndDistanceKey(Long activityId, Long runnerId, String distanceKey);

    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM ActivityBestEffort b WHERE b.activity.id IN :activityIds")
    int deleteByActivityIds(@Param("activityIds") Collection<Long> activityIds);

    /**
     * How many of the runner's visible efforts at this distance rank ahead of one with these values: a lower time, or
     * the same time on an earlier day, or on the same day in an earlier run.
     */
    @Query("""
            SELECT COUNT(b) FROM ActivityBestEffort b
            WHERE b.runner.id = :runnerId AND b.distanceKey = :key AND b.hidden = FALSE
              AND (b.effectiveSeconds < :seconds
                   OR (b.effectiveSeconds = :seconds
                       AND (b.localDate < :date OR (b.localDate = :date AND b.activity.id < :activityId))))
            """)
    long countAhead(@Param("runnerId") Long runnerId, @Param("key") String key, @Param("seconds") double seconds,
                    @Param("date") LocalDate date, @Param("activityId") Long activityId);

    /** The runner's visible efforts at one distance, best first. */
    @Query("""
            SELECT b FROM ActivityBestEffort b JOIN FETCH b.activity
            WHERE b.runner.id = :runnerId AND b.distanceKey = :key AND b.hidden = FALSE
            ORDER BY b.effectiveSeconds ASC, b.localDate ASC, b.activity.id ASC
            """)
    List<ActivityBestEffort> findRanked(@Param("runnerId") Long runnerId, @Param("key") String key, Pageable page);

    /**
     * The runner's visible efforts at one distance that fall on a day from {@code from} (included) to {@code to}
     * (excluded), best first: what the list for one year is cut from.
     */
    @Query("""
            SELECT b FROM ActivityBestEffort b JOIN FETCH b.activity
            WHERE b.runner.id = :runnerId AND b.distanceKey = :key AND b.hidden = FALSE
              AND b.localDate >= :from AND b.localDate < :to
            ORDER BY b.effectiveSeconds ASC, b.localDate ASC, b.activity.id ASC
            """)
    List<ActivityBestEffort> findRankedBetween(@Param("runnerId") Long runnerId, @Param("key") String key,
                                               @Param("from") LocalDate from, @Param("to") LocalDate to, Pageable page);

    /** Per calendar year at one distance, oldest first: how many visible efforts the runner has and the best time. {@code [year, count, best]}. */
    @Query("""
            SELECT YEAR(b.localDate), COUNT(b), MIN(b.effectiveSeconds) FROM ActivityBestEffort b
            WHERE b.runner.id = :runnerId AND b.distanceKey = :key AND b.hidden = FALSE
            GROUP BY YEAR(b.localDate)
            ORDER BY YEAR(b.localDate) ASC
            """)
    List<Object[]> summaryByYear(@Param("runnerId") Long runnerId, @Param("key") String key);

    /** Per distance: how many visible efforts the runner has and the best time. {@code [key, count, best]}. */
    @Query("""
            SELECT b.distanceKey, COUNT(b), MIN(b.effectiveSeconds) FROM ActivityBestEffort b
            WHERE b.runner.id = :runnerId AND b.hidden = FALSE
            GROUP BY b.distanceKey
            """)
    List<Object[]> summaryByDistance(@Param("runnerId") Long runnerId);

    /** Everything the runner has, hidden efforts and typed times included: what the account export writes. */
    @Query("""
            SELECT b FROM ActivityBestEffort b JOIN FETCH b.activity
            WHERE b.runner.id = :runnerId
            ORDER BY b.activity.id ASC, b.distanceMeters ASC
            """)
    List<ActivityBestEffort> findAllForRunner(@Param("runnerId") Long runnerId);
}
