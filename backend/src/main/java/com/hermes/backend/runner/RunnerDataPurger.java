package com.hermes.backend.runner;

import java.util.Set;

/**
 * Deletes one domain's rows for a runner when they delete their account. Each domain package supplies
 * its own, so the account-deletion service does not have to know every table.
 *
 * <p>Every entity with a foreign key to {@link Runner} must be listed by exactly one purger. A test
 * enumerates the entities and fails when one is missing, so adding a runner-owned table without a way
 * to delete it breaks the build instead of silently surviving an account deletion.</p>
 */
public interface RunnerDataPurger {

    /** Lower runs first: rows that others point at (drops, activities) go before what they point at (shoes). */
    int order();

    /** The runner-owned entities this purger deletes or detaches. The coverage test keys on this. */
    Set<Class<?>> entities();

    /** Removes the runner's rows. Runs inside the account-deletion transaction. */
    void purge(Long runnerId);
}
