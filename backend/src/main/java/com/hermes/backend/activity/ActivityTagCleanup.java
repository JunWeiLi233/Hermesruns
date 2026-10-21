package com.hermes.backend.activity;

import java.util.Collection;
import org.springframework.stereotype.Component;

/** A run's tags point at the run with no cascade, so deleting the run removes them first; without this the delete fails on the foreign key. */
@Component
class ActivityTagCleanup implements ActivityDeletionHook {

    private final ActivityTagRepository tags;

    ActivityTagCleanup(ActivityTagRepository tags) {
        this.tags = tags;
    }

    @Override
    public Class<?> entity() {
        return ActivityTag.class;
    }

    @Override
    public void beforeActivitiesDeleted(Collection<Long> activityIds) {
        if (activityIds == null || activityIds.isEmpty()) {
            return;
        }
        tags.deleteByActivityIds(activityIds);
    }
}
