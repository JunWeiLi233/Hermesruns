package com.hermes.backend.races;

import com.hermes.backend.runner.Runner;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RaceEventRepository extends JpaRepository<RaceEvent, Long> {
    List<RaceEvent> findByRunnerOrderByEventDateAsc(Runner runner);

    Optional<RaceEvent> findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(Runner runner, String name);

    Optional<RaceEvent> findByIdAndRunner(Long id, Runner runner);
}
