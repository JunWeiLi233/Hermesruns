package com.hermes.backend.rewards;

import com.hermes.backend.runner.Runner;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface DigitalCosmeticDropRepository extends JpaRepository<DigitalCosmeticDrop, Long> {

    /** Removes the drops earned by the given runs, so deleting those runs never hits the foreign key. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query("DELETE FROM DigitalCosmeticDrop d WHERE d.activity.id IN :activityIds")
    int deleteByActivityIds(@Param("activityIds") Collection<Long> activityIds);

    List<DigitalCosmeticDrop> findByRunnerAndVoidedByAntiSpoofFalseOrderByCreatedAtDesc(Runner runner);

    long countByRunnerAndTierAndVoidedByAntiSpoofFalseAndCreatedAtAfter(
            Runner runner,
            DigitalCosmeticTier tier,
            LocalDateTime createdAt
    );

    long countByRunnerAndTierAndVoidedByAntiSpoofFalse(Runner runner, DigitalCosmeticTier tier);
}
