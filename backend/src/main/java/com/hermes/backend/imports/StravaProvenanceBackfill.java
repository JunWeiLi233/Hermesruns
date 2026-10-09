package com.hermes.backend.imports;

import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ImportProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Flags runs the Strava sync stored before the {@code strava_api_sourced} column existed, so disconnect
 * and retention can find them. Idempotent: after the first boot it matches nothing. Production runs
 * Hibernate in validate mode, so the column must already exist (see the schema upgrade note).
 */
@Component
class StravaProvenanceBackfill {

    private static final Logger log = LoggerFactory.getLogger(StravaProvenanceBackfill.class);

    private final ActivityRepository activities;

    StravaProvenanceBackfill(ActivityRepository activities) {
        this.activities = activities;
    }

    @EventListener(ApplicationReadyEvent.class)
    void backfill() {
        try {
            int flagged = activities.backfillStravaApiSourced(ImportProvider.STRAVA);
            if (flagged > 0) {
                log.info("Marked {} existing Strava runs as API-sourced", flagged);
            }
        } catch (RuntimeException exception) {
            // A failed backfill must not stop the app; the next boot retries it.
            log.warn("Strava provenance backfill skipped ({})", exception.getClass().getSimpleName());
        }
    }
}
