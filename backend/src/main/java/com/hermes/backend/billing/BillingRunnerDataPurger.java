package com.hermes.backend.billing;

import com.hermes.backend.runner.RunnerDataPurger;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Purchase attempts contain an account email and hosted checkout URL, so they go with the account. */
@Component
class BillingRunnerDataPurger implements RunnerDataPurger {
    @PersistenceContext
    private EntityManager entityManager;

    @Override public int order() { return 60; }
    @Override public Set<Class<?>> entities() { return Set.of(CheckoutAttempt.class); }
    @Override public void purge(Long runnerId) {
        entityManager.createQuery("delete from CheckoutAttempt a where a.runnerId = :runnerId")
                .setParameter("runnerId", runnerId).executeUpdate();
    }
}
