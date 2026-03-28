package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoachTrainingBlockRepository extends JpaRepository<CoachTrainingBlock, Long> {
    Optional<CoachTrainingBlock> findByRunnerAndActiveTrue(Runner runner);
}
