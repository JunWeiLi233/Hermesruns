package com.hermes.backend.strength;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Muscle-training preferences and check-ins. */
@Component
class StrengthRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(MuscleTrainingCheckIn.class, MuscleTrainingPreference.class);

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 50;
    }

    @Override
    public Set<Class<?>> entities() {
        return OWNED;
    }

    @Override
    public void purge(Long runnerId) {
        RunnerRows.deleteAll(em, runnerId, OWNED);
    }
}
