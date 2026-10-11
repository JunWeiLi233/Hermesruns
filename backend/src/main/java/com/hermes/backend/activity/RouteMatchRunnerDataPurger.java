package com.hermes.backend.activity;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * The runner's route groups. Runs point at them by a plain id, which is cleared first, so it does not matter whether the
 * runs or the groups go first.
 */
@Component
class RouteMatchRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(RouteMatchGroup.class);

    private final ActivityRecordsRepository records;

    @PersistenceContext
    private EntityManager em;

    RouteMatchRunnerDataPurger(ActivityRecordsRepository records) {
        this.records = records;
    }

    @Override
    public int order() {
        return 25;
    }

    @Override
    public Set<Class<?>> entities() {
        return OWNED;
    }

    @Override
    public void purge(Long runnerId) {
        records.detachFromGroups(runnerId);
        RunnerRows.deleteAll(em, runnerId, OWNED);
    }
}
