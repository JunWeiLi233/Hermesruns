package com.hermes.backend.routing;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** The routes the runner planned. */
@Component
class RoutingRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(PlannedRoute.class);

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
