package com.hermes.backend.coaching;

import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyHRVDataRepository extends JpaRepository<DailyHRVData, Long> {
    Optional<DailyHRVData> findByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    boolean existsByRunnerAndProviderAndDate(Runner runner, ImportProvider provider, LocalDate date);

    List<DailyHRVData> findByRunnerAndDateBetweenOrderByDateDesc(Runner runner, LocalDate start, LocalDate end);

    List<DailyHRVData> findByRunnerOrderByDateDesc(Runner runner);
}