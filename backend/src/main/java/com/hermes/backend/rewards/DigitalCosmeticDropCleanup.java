package com.hermes.backend.rewards;

import com.hermes.backend.activity.ActivityDeletionHook;
import java.util.Collection;
import org.springframework.stereotype.Component;

/**
 * A cosmetic drop points at the run that earned it, with no cascade. Deleting the run therefore
 * removes its drops first; without this, the delete fails on the foreign key.
 */
@Component
class DigitalCosmeticDropCleanup implements ActivityDeletionHook {

    private final DigitalCosmeticDropRepository drops;

    DigitalCosmeticDropCleanup(DigitalCosmeticDropRepository drops) {
        this.drops = drops;
    }

    @Override
    public Class<?> entity() {
        return DigitalCosmeticDrop.class;
    }

    @Override
    public void beforeActivitiesDeleted(Collection<Long> activityIds) {
        if (activityIds == null || activityIds.isEmpty()) {
            return;
        }
        drops.deleteByActivityIds(activityIds);
    }
}
