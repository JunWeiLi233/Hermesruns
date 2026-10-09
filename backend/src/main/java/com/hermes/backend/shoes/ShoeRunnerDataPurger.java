package com.hermes.backend.shoes;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * The runner's shoes are deleted. Catalogue images are shared (one per shoe identity, whoever uploaded
 * it first), so they stay for other runners and only lose the link to this one.
 */
@Component
class ShoeRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> DELETED = Set.of(Shoe.class);
    private static final Set<Class<?>> DETACHED = Set.of(ShoeImageAsset.class);

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 30;
    }

    @Override
    public Set<Class<?>> entities() {
        return Set.of(Shoe.class, ShoeImageAsset.class);
    }

    @Override
    public void purge(Long runnerId) {
        RunnerRows.detachAll(em, runnerId, DETACHED);
        RunnerRows.deleteAll(em, runnerId, DELETED);
    }
}
