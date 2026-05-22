package com.hermes.backend;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MuscleTrainingPreferenceRepository extends JpaRepository<MuscleTrainingPreference, Long> {
    Optional<MuscleTrainingPreference> findByRunner(Runner runner);
}
