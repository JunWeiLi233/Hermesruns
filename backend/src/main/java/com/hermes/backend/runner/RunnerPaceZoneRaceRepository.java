package com.hermes.backend.runner;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RunnerPaceZoneRaceRepository extends JpaRepository<RunnerPaceZoneRace, Long> {

    Optional<RunnerPaceZoneRace> findByRunner(Runner runner);
}
