package com.hermes.backend.goals;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Ownership: every method is keyed by the runner; none answers for a goal by its own id alone. */
public interface GoalRepository extends JpaRepository<Goal, Long> {

    List<Goal> findByRunnerIdOrderByIdAsc(Long runnerId);

    Optional<Goal> findByIdAndRunnerId(Long id, Long runnerId);

    boolean existsByRunnerIdAndPeriodAndMetric(Long runnerId, String period, String metric);
}
