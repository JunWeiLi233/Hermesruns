package com.hermes.backend.runner;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RunnerTrainingZonesRepository extends JpaRepository<RunnerTrainingZones, Long> {

    Optional<RunnerTrainingZones> findByRunner(Runner runner);
}
