package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BodyCompositionDataRepository extends JpaRepository<BodyCompositionData, Long> {
    Optional<BodyCompositionData> findByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    boolean existsByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    List<BodyCompositionData> findByRunnerAndDateBetweenOrderByDateDesc(Runner runner, LocalDate start, LocalDate end);

    List<BodyCompositionData> findByRunnerOrderByDateDesc(Runner runner);
}