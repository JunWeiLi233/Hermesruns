package com.hermes.backend.strength;

import com.hermes.backend.runner.Runner;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MuscleTrainingPreferenceRepository extends JpaRepository<MuscleTrainingPreference, Long> {
    Optional<MuscleTrainingPreference> findByRunner(Runner runner);
}
