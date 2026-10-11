package com.hermes.backend.auth.mfa;

import com.hermes.backend.runner.RunnerDataPurger;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * An administrator's second-factor material: MFA profile, passkeys, recovery codes and pending challenges.
 * Administrator accounts cannot delete themselves through the account endpoint, but if one is ever removed
 * by another route its credentials must not outlive it.
 */
@Component
class AdminMfaRunnerDataPurger implements RunnerDataPurger {

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 60;
    }

    @Override
    public Set<Class<?>> entities() {
        return Set.of(AdminMfaProfile.class, AdminMfaChallenge.class, AdminPasskeyCredential.class, AdminRecoveryCode.class);
    }

    @Override
    public void purge(Long runnerId) {
        for (Class<?> entity : entities()) {
            String name = em.getMetamodel().entity(entity).getName();
            em.createQuery("DELETE FROM " + name + " e WHERE e.runnerId = :runnerId")
                    .setParameter("runnerId", runnerId)
                    .executeUpdate();
        }
    }
}
