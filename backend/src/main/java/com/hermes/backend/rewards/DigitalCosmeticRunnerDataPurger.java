package com.hermes.backend.rewards;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Cosmetic drops point at runs and shoes, so they go before both. */
@Component
class DigitalCosmeticRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(DigitalCosmeticDrop.class);

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 10;
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
