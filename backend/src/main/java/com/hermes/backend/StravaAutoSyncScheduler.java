package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Periodic background sync for Strava-connected runners.
 *
 * <p>Acts as a fallback to the webhook-based push system:
 * if a webhook event is missed (network issue, downtime, etc.),
 * this scheduler will pick up the gap within the next cycle.</p>
 *
 * <p>Runs every 30 minutes by default. Configurable via
 * {@code strava.sync.interval-ms} property.</p>
 */
@Component
public class StravaAutoSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(StravaAutoSyncScheduler.class);

    private final RunnerRepository runnerRepository;
    private final OAuthController oAuthController;

    public StravaAutoSyncScheduler(RunnerRepository runnerRepository, OAuthController oAuthController) {
        this.runnerRepository = runnerRepository;
        this.oAuthController = oAuthController;
    }

    /**
     * Sync Strava activities for all connected runners.
     * Runs every 30 minutes (1_800_000 ms). Initial delay of 2 minutes
     * to let the application finish startup before hammering Strava API.
     */
    @Scheduled(fixedDelayString = "${strava.sync.interval-ms:1800000}", initialDelay = 120_000)
    public void syncAllStravaRunners() {
        if (!oAuthController.isStravaConfigured()) {
            return;
        }

        List<Runner> stravaRunners = runnerRepository
                .findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse();

        if (stravaRunners.isEmpty()) {
            return;
        }

        log.info("Strava auto-sync: starting for {} connected runner(s)", stravaRunners.size());

        int synced = 0;
        int failed = 0;

        for (Runner runner : stravaRunners) {
            try {
                String accessToken = oAuthController.resolveRunnerStravaAccessToken(runner);
                if (accessToken == null || accessToken.isBlank()) {
                    log.debug("Strava auto-sync: skipping runner {} (no valid token)", runner.getId());
                    failed++;
                    continue;
                }
                oAuthController.fetchAndSaveStravaActivities(accessToken, runner.getId());
                synced++;
            } catch (Exception e) {
                log.warn("Strava auto-sync: failed for runner {}: {}", runner.getId(), e.getMessage());
                failed++;
            }
        }

        log.info("Strava auto-sync: completed — {} synced, {} failed", synced, failed);
    }
}
