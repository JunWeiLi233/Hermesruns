package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ActivityRepository extends JpaRepository<Activity, Long> {

    boolean existsByRunnerAndProviderAndSourceChecksum(Runner runner, ImportProvider provider, String sourceChecksum);

    Optional<Activity> findByRunnerAndProviderAndSourceChecksum(Runner runner, ImportProvider provider, String sourceChecksum);

    long countByRunner(Runner runner);

    long countByRunnerAndActivityType(Runner runner, ActivityType activityType);

    List<Activity> findByRunnerOrderByIdDesc(Runner runner);

    List<Activity> findByRunnerAndActivityTypeOrderByIdDesc(Runner runner, ActivityType activityType);

    @Query("SELECT COALESCE(SUM(CASE WHEN a.distanceKm > 0 THEN a.distanceKm " +
           "WHEN a.distanceMeters IS NOT NULL THEN a.distanceMeters / 1000.0 " +
           "ELSE 0 END), 0) FROM Activity a WHERE a.shoe.id = :shoeId")
    double sumDistanceKmByShoeId(@Param("shoeId") Long shoeId);

    @Modifying
    @Query("UPDATE Activity a SET a.shoe = null WHERE a.shoe.id = :shoeId")
    void unlinkShoeFromActivities(@Param("shoeId") Long shoeId);

    @Query("SELECT a.shoe.id, MAX(COALESCE(a.startTime, CAST(a.startDate AS timestamp))) " +
           "FROM Activity a WHERE a.runner = :runner AND a.shoe IS NOT NULL GROUP BY a.shoe.id")
    List<Object[]> findLastUsedDateByRunner(@Param("runner") Runner runner);
}
