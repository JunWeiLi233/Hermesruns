package com.hermes.backend.admin;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Notes administrators wrote about the runner are personal data and go with the account. So do the
 * filters the runner saved if they were an administrator (kept by a plain runner id, not a foreign key).
 */
@Component
class AdminRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> NOTES = Set.of(RunnerAdminNote.class);

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 50;
    }

    @Override
    public Set<Class<?>> entities() {
        return Set.of(RunnerAdminNote.class, AdminSavedFilter.class);
    }

    @Override
    public void purge(Long runnerId) {
        RunnerRows.deleteAll(em, runnerId, NOTES);
        em.createQuery("DELETE FROM AdminSavedFilter f WHERE f.ownerRunnerId = :runnerId")
                .setParameter("runnerId", runnerId)
                .executeUpdate();
    }
}
