package com.hermes.backend.runner;

import jakarta.persistence.EntityManager;
import java.util.Collection;

/** Bulk operations on the rows a runner owns, by entity. Call inside a transaction. */
public final class RunnerRows {

    private RunnerRows() {
    }

    /** Deletes every row of the given entities whose {@code runner} is this runner. Returns rows deleted. */
    public static int deleteAll(EntityManager em, Long runnerId, Collection<Class<?>> entities) {
        int deleted = 0;
        for (Class<?> entity : entities) {
            String name = em.getMetamodel().entity(entity).getName();
            deleted += em.createQuery("DELETE FROM " + name + " e WHERE e.runner.id = :runnerId")
                    .setParameter("runnerId", runnerId)
                    .executeUpdate();
        }
        return deleted;
    }

    /**
     * Keeps the rows but clears their {@code runner}, for rows other runners may depend on (a shared
     * catalogue image a runner once uploaded). Returns rows changed.
     */
    public static int detachAll(EntityManager em, Long runnerId, Collection<Class<?>> entities) {
        int changed = 0;
        for (Class<?> entity : entities) {
            String name = em.getMetamodel().entity(entity).getName();
            changed += em.createQuery("UPDATE " + name + " e SET e.runner = null WHERE e.runner.id = :runnerId")
                    .setParameter("runnerId", runnerId)
                    .executeUpdate();
        }
        return changed;
    }
}
