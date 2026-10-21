package com.hermes.backend.activity;

import java.util.Collection;

/**
 * Lets another domain remove the rows that point at activities before those activities are deleted,
 * so a foreign key never blocks a delete. {@link ActivityDataAccess} calls every hook inside the
 * deleting transaction, before the activity rows go away. A hook must only touch rows that reference
 * the given activity ids.
 *
 * <p>Every entity with a foreign key to {@link Activity} needs a hook (or {@code @OnDelete} on the
 * mapping). A test lists the entities and fails when one has neither, so a new table cannot quietly
 * make "delete this run" fail.</p>
 */
public interface ActivityDeletionHook {

    /** The entity whose rows this hook removes. The coverage test keys on it. */
    Class<?> entity();

    void beforeActivitiesDeleted(Collection<Long> activityIds);
}
