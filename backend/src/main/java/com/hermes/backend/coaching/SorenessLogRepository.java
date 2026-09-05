package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SorenessLogRepository extends JpaRepository<SorenessLog, Long> {

    Optional<SorenessLog> findByRunnerAndDate(Runner runner, LocalDate date);

    List<SorenessLog> findByRunnerAndDateBetween(Runner runner, LocalDate startDate, LocalDate endDate);

    List<SorenessLog> findByRunnerOrderByDateDesc(Runner runner);
}
