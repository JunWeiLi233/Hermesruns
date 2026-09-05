package com.hermes.backend.coaching;

import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoachScheduledWorkoutRepository extends JpaRepository<CoachScheduledWorkout, Long> {
    Optional<CoachScheduledWorkout> findByRunnerAndScheduledDate(Runner runner, LocalDate scheduledDate);

    List<CoachScheduledWorkout> findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(
            Runner runner, LocalDate from, LocalDate to
    );

    List<CoachScheduledWorkout> findByRunnerAndScheduledDateBetween(
            Runner runner, LocalDate from, LocalDate to
    );
}
