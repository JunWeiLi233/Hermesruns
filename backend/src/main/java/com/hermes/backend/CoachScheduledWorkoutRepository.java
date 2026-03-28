package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CoachScheduledWorkoutRepository extends JpaRepository<CoachScheduledWorkout, Long> {
    Optional<CoachScheduledWorkout> findByRunnerAndScheduledDate(Runner runner, LocalDate scheduledDate);

    List<CoachScheduledWorkout> findByRunnerAndScheduledDateBetweenOrderByScheduledDateAsc(
            Runner runner, LocalDate from, LocalDate to
    );

    List<CoachScheduledWorkout> findByRunnerAndScheduledDateBetween(
            Runner runner, LocalDate from, LocalDate to
    );
}
