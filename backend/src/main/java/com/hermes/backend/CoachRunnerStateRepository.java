package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoachRunnerStateRepository extends JpaRepository<CoachRunnerState, Long> {
    Optional<CoachRunnerState> findByRunner(Runner runner);
}
