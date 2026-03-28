package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface DigitalCosmeticDropRepository extends JpaRepository<DigitalCosmeticDrop, Long> {
    List<DigitalCosmeticDrop> findByRunnerAndVoidedByAntiSpoofFalseOrderByCreatedAtDesc(Runner runner);

    long countByRunnerAndTierAndVoidedByAntiSpoofFalseAndCreatedAtAfter(
            Runner runner,
            DigitalCosmeticTier tier,
            LocalDateTime createdAt
    );

    long countByRunnerAndTierAndVoidedByAntiSpoofFalse(Runner runner, DigitalCosmeticTier tier);
}
