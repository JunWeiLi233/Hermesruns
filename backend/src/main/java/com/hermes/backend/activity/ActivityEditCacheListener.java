package com.hermes.backend.activity;

import com.hermes.backend.infrastructure.cache.TtlCacheStore;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Drops what is cached from a run's name once an edit that changes it has committed: the records list shows the names of the runs
 * that hold the records. After the commit, so a read that comes in between cannot cache the old name again.
 */
@Component
class ActivityEditCacheListener {

    private final TtlCacheStore cacheStore;

    ActivityEditCacheListener(TtlCacheStore cacheStore) {
        this.cacheStore = cacheStore;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onActivityEdited(ActivityEditedEvent event) {
        if (event.fields().contains(ActivityEditedEvent.NAME)) {
            ActivityCaches.evictPersonalRecords(cacheStore, event.runnerId());
        }
    }
}
