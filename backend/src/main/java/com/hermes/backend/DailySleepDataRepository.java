package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailySleepDataRepository extends JpaRepository<DailySleepData, Long> {
    Optional<DailySleepData> findByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    boolean existsByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    List<DailySleepData> findByRunnerAndDateBetweenOrderByDateDesc(Runner runner, LocalDate start, LocalDate end);

    List<DailySleepData> findByRunnerOrderByDateDesc(Runner runner);
}