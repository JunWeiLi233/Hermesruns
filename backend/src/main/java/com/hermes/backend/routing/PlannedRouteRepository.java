package com.hermes.backend.routing;

import com.hermes.backend.runner.Runner;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlannedRouteRepository extends JpaRepository<PlannedRoute, Long> {

    List<PlannedRoute> findByRunnerOrderByCreatedAtDesc(Runner runner);

    List<PlannedRoute> findTop5ByRunnerOrderByCreatedAtDesc(Runner runner);
}
