package com.hermes.backend.coaching;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** The effort and zone numbers worked out for the runner's runs. They point at the runs, so they go first. */
@Component
class TrainingMetricsRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(ActivityTrainingMetrics.class);

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 15;
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
