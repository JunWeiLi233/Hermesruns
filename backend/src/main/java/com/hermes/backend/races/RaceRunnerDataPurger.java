package com.hermes.backend.races;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** The runner's saved races and the GPX files generated for them. */
@Component
class RaceRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(RaceEvent.class, GeneratedRaceGpxAsset.class);

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
