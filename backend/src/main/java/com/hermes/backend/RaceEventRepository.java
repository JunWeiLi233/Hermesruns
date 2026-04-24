package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RaceEventRepository extends JpaRepository<RaceEvent, Long> {
    List<RaceEvent> findByRunnerOrderByEventDateAsc(Runner runner);

    Optional<RaceEvent> findFirstByRunnerAndNameIgnoreCaseOrderByEventDateAsc(Runner runner, String name);

    Optional<RaceEvent> findByIdAndRunner(Long id, Runner runner);
}
