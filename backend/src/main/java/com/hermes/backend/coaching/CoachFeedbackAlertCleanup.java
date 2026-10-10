package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityDeletionHook;
import java.util.Collection;
import org.springframework.stereotype.Component;

/**
 * A coach feedback alert can point at the run it is about ({@code related_activity_id}, no cascade).
 * Deleting the run removes those alerts first; without this, the delete fails on the foreign key.
 */
@Component
class CoachFeedbackAlertCleanup implements ActivityDeletionHook {

    private final CoachFeedbackAlertRepository alerts;

    CoachFeedbackAlertCleanup(CoachFeedbackAlertRepository alerts) {
        this.alerts = alerts;
    }

    @Override
    public Class<?> entity() {
        return CoachFeedbackAlert.class;
    }

    @Override
    public void beforeActivitiesDeleted(Collection<Long> activityIds) {
        if (activityIds == null || activityIds.isEmpty()) {
            return;
        }
        alerts.deleteByRelatedActivityIds(activityIds);
    }
}
