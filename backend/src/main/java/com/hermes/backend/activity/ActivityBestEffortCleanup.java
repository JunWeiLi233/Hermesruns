package com.hermes.backend.activity;

import java.util.Collection;
import org.springframework.stereotype.Component;

/**
 * A run's best efforts point at the run with no cascade. Deleting the run therefore removes them first; without this,
 * the delete fails on the foreign key.
 */
@Component
class ActivityBestEffortCleanup implements ActivityDeletionHook {

    private final ActivityBestEffortRepository efforts;

    ActivityBestEffortCleanup(ActivityBestEffortRepository efforts) {
        this.efforts = efforts;
    }

    @Override
    public Class<?> entity() {
        return ActivityBestEffort.class;
    }

    @Override
    public void beforeActivitiesDeleted(Collection<Long> activityIds) {
        if (activityIds == null || activityIds.isEmpty()) {
            return;
        }
        efforts.deleteByActivityIds(activityIds);
    }
}
