package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SorenessLogRepository extends JpaRepository<SorenessLog, Long> {

    Optional<SorenessLog> findByRunnerAndDate(Runner runner, LocalDate date);

    List<SorenessLog> findByRunnerAndDateBetween(Runner runner, LocalDate startDate, LocalDate endDate);

    List<SorenessLog> findByRunnerOrderByDateDesc(Runner runner);
}
