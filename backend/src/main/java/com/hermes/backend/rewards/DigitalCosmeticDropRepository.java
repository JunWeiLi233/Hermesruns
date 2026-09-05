package com.hermes.backend.rewards;

import com.hermes.backend.runner.Runner;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DigitalCosmeticDropRepository extends JpaRepository<DigitalCosmeticDrop, Long> {
    List<DigitalCosmeticDrop> findByRunnerAndVoidedByAntiSpoofFalseOrderByCreatedAtDesc(Runner runner);

    long countByRunnerAndTierAndVoidedByAntiSpoofFalseAndCreatedAtAfter(
            Runner runner,
            DigitalCosmeticTier tier,
            LocalDateTime createdAt
    );

    long countByRunnerAndTierAndVoidedByAntiSpoofFalse(Runner runner, DigitalCosmeticTier tier);
}
