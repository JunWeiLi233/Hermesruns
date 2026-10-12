package com.hermes.backend.runner;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** The race the runner cut their pace zones from. */
@Component
class PaceZoneRaceRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(RunnerPaceZoneRace.class);

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 71;
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
