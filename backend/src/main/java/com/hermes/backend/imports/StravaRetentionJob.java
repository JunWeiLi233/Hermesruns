package com.hermes.backend.imports;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Deletes Strava-API runs once they are older than {@code app.strava.retention-days}.
 *
 * <p>Strava's API Policy lets an app keep API data for at most 7 days. The default here is 0, which
 * keeps the data indefinitely, as Hermes always has: turning this on deletes runs (and the shoe
 * mileage, personal records and rewards built from them), so it is a deliberate switch. Runs the runner
 * imported from their own files are never touched.</p>
 */
@Component
class StravaRetentionJob {

    private static final Logger log = LoggerFactory.getLogger(StravaRetentionJob.class);

    private final StravaAccountService accounts;

    @Value("${app.strava.retention-days:0}")
    private int retentionDays;

    StravaRetentionJob(StravaAccountService accounts) {
        this.accounts = accounts;
    }

    @Scheduled(cron = "${app.strava.retention-cron:0 30 3 * * *}")
    void purgeExpiredApiData() {
        if (retentionDays <= 0) {
            return;
        }
        int removed = accounts.purgeApiDataOlderThan(Duration.ofDays(retentionDays));
        if (removed > 0) {
            log.info("Strava retention removed {} runs older than {} days", removed, retentionDays);
        }
    }
}
