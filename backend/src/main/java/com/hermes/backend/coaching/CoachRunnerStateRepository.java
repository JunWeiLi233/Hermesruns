package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoachRunnerStateRepository extends JpaRepository<CoachRunnerState, Long> {
    Optional<CoachRunnerState> findByRunner(Runner runner);
}
