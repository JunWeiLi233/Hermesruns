package com.hermes.backend.activity.analysis;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.runner.Runner;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface SessionAnalysisActivityRepository extends Repository<Activity, Long> {
    /** Load and lock in one owner-filtered query, avoiding stale declarations in the persistence context. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Activity a where a.id = :id and a.runner = :owner")
    Optional<Activity> findOwnedForUpdate(@Param("id") Long id, @Param("owner") Runner owner);
}
