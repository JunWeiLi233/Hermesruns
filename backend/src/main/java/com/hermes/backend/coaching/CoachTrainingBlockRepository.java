package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoachTrainingBlockRepository extends JpaRepository<CoachTrainingBlock, Long> {
    Optional<CoachTrainingBlock> findByRunnerAndActiveTrue(Runner runner);
}
