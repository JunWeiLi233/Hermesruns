package com.hermes.backend.runner;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** The heart-rate zone boundaries the runner set by hand. */
@Component
class TrainingZonesRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(RunnerTrainingZones.class);

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 70;
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
