package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Periodic background sync for Strava-connected runners.
 *
 * <p>Acts as a fallback to the webhook-based push system:
 * if a webhook event is missed (network issue, downtime, etc.),
 * this scheduler will pick up the gap within the next cycle.</p>
 *
 * <p>Runs on a fixed delay (default 10 minutes). Configure via
 * {@code strava.sync.interval-ms} or env {@code STRAVA_SYNC_INTERVAL_MS}.</p>
 */
@Component
public class StravaAutoSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(StravaAutoSyncScheduler.class);

    private final RunnerRepository runnerRepository;
    private final StravaTokenService stravaTokenService;
    private final StravaSyncService stravaSyncService;
    private final AdminBackgroundJobService adminBackgroundJobService;

    public StravaAutoSyncScheduler(
            RunnerRepository runnerRepository,
            StravaTokenService stravaTokenService,
            StravaSyncService stravaSyncService,
            AdminBackgroundJobService adminBackgroundJobService
    ) {
        this.runnerRepository = runnerRepository;
        this.stravaTokenService = stravaTokenService;
        this.stravaSyncService = stravaSyncService;
        this.adminBackgroundJobService = adminBackgroundJobService;
    }

    /**
     * Sync Strava activities for all connected runners.
     * Default interval 10 minutes. Initial delay of 2 minutes
     * to let the application finish startup before hammering Strava API.
     */
    @Scheduled(fixedDelayString = "${strava.sync.interval-ms:600000}", initialDelay = 120_000)
    public void syncAllStravaRunners() {
        runSyncJob(null, "scheduler");
    }

    public AdminBackgroundJob triggerAdminSync(Runner actor, String triggerSource) {
        return runSyncJob(actor, triggerSource == null || triggerSource.isBlank() ? "admin_manual" : triggerSource);
    }

    private AdminBackgroundJob runSyncJob(Runner actor, String triggerSource) {
        if (!stravaTokenService.isStravaConfigured()) {
            AdminBackgroundJob job = adminBackgroundJobService.createJob(
                    "STRAVA_GLOBAL_SYNC",
                    triggerSource,
                    actor,
                    "Strava is not configured.",
                    Map.of("configured", false)
            );
            adminBackgroundJobService.markCompleted(job, 0, 0, "Strava is not configured.", Map.of("configured", false));
            return job;
        }

        List<Runner> stravaRunners = runnerRepository
                .findByStravaAthleteIdIsNotNullAndStravaRefreshTokenIsNotNullAndDeletedFalse();

        AdminBackgroundJob job = adminBackgroundJobService.createJob(
                "STRAVA_GLOBAL_SYNC",
                triggerSource,
                actor,
                "Queued global Strava sync.",
                Map.of("runnerCount", stravaRunners.size())
        );

        if (stravaRunners.isEmpty()) {
            adminBackgroundJobService.markCompleted(job, 0, 0, "No Strava-linked runners to sync.", Map.of("runnerCount", 0));
            return job;
        }

        adminBackgroundJobService.runAsync(job, stravaRunners.size(), () -> executeSync(job, stravaRunners));
        return job;
    }

    private void executeSync(AdminBackgroundJob job, List<Runner> stravaRunners) {
        log.info("Strava auto-sync: starting for {} connected runner(s)", stravaRunners.size());

        int synced = 0;
        int failed = 0;
        List<Map<String, Object>> failures = new java.util.ArrayList<>();

        for (Runner runner : stravaRunners) {
            try {
                String accessToken = stravaTokenService.resolveRunnerStravaAccessToken(runner);
                if (accessToken == null || accessToken.isBlank()) {
                    log.debug("Strava auto-sync: skipping runner {} (no valid token)", runner.getId());
                    failed++;
                    failures.add(failureRecord(runner, "Missing access token"));
                    continue;
                }
                stravaSyncService.fetchAndSaveStravaActivities(accessToken, runner.getId(), true, "scheduled_recent_sync");
                synced++;
            } catch (Exception e) {
                log.warn("Strava auto-sync: failed for runner {}: {}", runner.getId(), e.getMessage());
                failed++;
                failures.add(failureRecord(runner, e.getMessage()));
            }
        }

        log.info("Strava auto-sync: completed — {} synced, {} failed", synced, failed);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runnerCount", stravaRunners.size());
        details.put("failures", failures);
        adminBackgroundJobService.markCompleted(
                job,
                synced,
                failed,
                "Global Strava sync finished.",
                details
        );
    }

    private Map<String, Object> failureRecord(Runner runner, String message) {
        Map<String, Object> failure = new LinkedHashMap<>();
        failure.put("runnerId", runner.getId());
        failure.put("email", runner.getEmail());
        failure.put("message", message == null ? "Unknown error" : message);
        return failure;
    }
}
