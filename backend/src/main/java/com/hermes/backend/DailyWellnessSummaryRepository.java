package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyWellnessSummaryRepository extends JpaRepository<DailyWellnessSummary, Long> {
    Optional<DailyWellnessSummary> findByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    boolean existsByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    List<DailyWellnessSummary> findByRunnerAndDateBetweenOrderByDateDesc(Runner runner, LocalDate start, LocalDate end);

    List<DailyWellnessSummary> findByRunnerOrderByDateDesc(Runner runner);
}