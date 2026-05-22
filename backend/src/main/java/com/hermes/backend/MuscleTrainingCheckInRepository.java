package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface MuscleTrainingCheckInRepository extends JpaRepository<MuscleTrainingCheckIn, Long> {
    Optional<MuscleTrainingCheckIn> findByRunnerAndTrainingDate(Runner runner, LocalDate trainingDate);
    void deleteByRunnerAndTrainingDate(Runner runner, LocalDate trainingDate);
}
