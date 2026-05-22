package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlannedRouteRepository extends JpaRepository<PlannedRoute, Long> {

    List<PlannedRoute> findByRunnerOrderByCreatedAtDesc(Runner runner);

    List<PlannedRoute> findTop5ByRunnerOrderByCreatedAtDesc(Runner runner);
}
