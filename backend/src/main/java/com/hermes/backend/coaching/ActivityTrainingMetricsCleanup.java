package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityDeletionHook;
import java.util.Collection;
import org.springframework.stereotype.Component;

/**
 * A run's metrics row points at the run with no cascade. Deleting the run therefore removes its row first;
 * without this, the delete fails on the foreign key.
 */
@Component
class ActivityTrainingMetricsCleanup implements ActivityDeletionHook {

    private final ActivityTrainingMetricsRepository metrics;

    ActivityTrainingMetricsCleanup(ActivityTrainingMetricsRepository metrics) {
        this.metrics = metrics;
    }

    @Override
    public Class<?> entity() {
        return ActivityTrainingMetrics.class;
    }

    @Override
    public void beforeActivitiesDeleted(Collection<Long> activityIds) {
        if (activityIds == null || activityIds.isEmpty()) {
            return;
        }
        metrics.deleteByActivityIds(activityIds);
    }
}
