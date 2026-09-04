package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
 * {@code strava.sync.interval-ms} or env {@code STRAVA_SYNC_INTERVAL_MS}.
 * Adaptive backoff: quiet cycles (no failures and no newly imported
 * activities) double the effective interval up to
 * {@code strava.sync.backoff-max-minutes} (default 60); any failure,
 * imported activity, or manual admin trigger resets it to the base
 * interval.</p>
 */
@Component
public class StravaAutoSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(StravaAutoSyncScheduler.class);

    private final RunnerRepository runnerRepository;
    private final StravaTokenService stravaTokenService;
    private final StravaSyncService stravaSyncService;
    private final AdminBackgroundJobService adminBackgroundJobService;

    @Value("${strava.sync.enabled:true}")
    private boolean syncEnabled;

    @Value("${app.background.polling.enabled:true}")
    private boolean scheduledPollingEnabled = true;

    @Value("${strava.sync.interval-ms:600000}")
    private long baseIntervalMs;

    @Value("${strava.sync.backoff-max-minutes:60}")
    private long backoffMaxMinutes;

    /** Effective interval after adaptive backoff; 0 = not initialized (use baseIntervalMs). */
    private volatile long currentIntervalMs = 0;

    /**
     * Adaptive-gate clock (wall-clock ms), not strictly a "last tick" record: elapsed
     * time since this value decides whether a scheduled tick runs or is skipped.
     * Reset to 0 by the manual admin bypass so the next scheduled tick runs immediately.
     */
    private volatile long lastSyncRanAtMs = 0;

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
        if (!scheduledPollingEnabled) {
            return;
        }
        if (!syncEnabled) {
            log.debug("Strava auto-sync: scheduled sync disabled");
            return;
        }

        long effectiveIntervalMs = currentIntervalMs > 0 ? currentIntervalMs : baseIntervalMs;
        long now = System.currentTimeMillis();
        if (now - lastSyncRanAtMs < effectiveIntervalMs) {
            log.debug(
                    "Strava auto-sync: skipping tick (adaptive backoff, next in {}s)",
                    (effectiveIntervalMs - (now - lastSyncRanAtMs)) / 1000
            );
            return;
        }
        lastSyncRanAtMs = now;

        runSyncJob(null, "scheduler");
    }

    public AdminBackgroundJob triggerAdminSync(Runner actor, String triggerSource) {
        // Manual admin triggers always run immediately and reset the backoff.
        currentIntervalMs = baseIntervalMs;
        lastSyncRanAtMs = 0;
        return runSyncJob(actor, triggerSource == null || triggerSource.isBlank() ? "admin_manual" : triggerSource);
    }

    private AdminBackgroundJob runSyncJob(Runner actor, String triggerSource) {
        if (!syncEnabled) {
            AdminBackgroundJob job = adminBackgroundJobService.createJob(
                    "STRAVA_GLOBAL_SYNC",
                    triggerSource,
                    actor,
                    "Strava sync is disabled.",
                    Map.of("enabled", false)
            );
            adminBackgroundJobService.markCompleted(job, 0, 0, "Strava sync is disabled.", Map.of("enabled", false));
            return job;
        }

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

        final long tickStartMs = System.currentTimeMillis();
        adminBackgroundJobService.runAsync(job, stravaRunners.size(), () -> executeSync(job, stravaRunners, tickStartMs));
        return job;
    }

    private void executeSync(AdminBackgroundJob job, List<Runner> stravaRunners, long tickStartMs) {
        int synced = 0;
        int failed = 0;
        List<Map<String, Object>> failures = new java.util.ArrayList<>();
        try {
            log.info("Strava auto-sync: starting for {} connected runner(s)", stravaRunners.size());

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
                    StravaSyncService.StravaSyncStatusResponse status = stravaSyncService.snapshotSyncStatus(runner.getId());
                    if (status != null && "FAILED".equals(status.status())) {
                        failed++;
                        failures.add(failureRecord(runner, status.error()));
                        continue;
                    }
                    if (status != null && status.active()) {
                        failed++;
                        failures.add(failureRecord(runner, "Strava sync did not finish before the scheduler returned."));
                        continue;
                    }
                    synced++;
                } catch (Exception e) {
                    log.warn("Strava auto-sync: failed for runner {}: {}", runner.getId(), e.getMessage());
                    failed++;
                    failures.add(failureRecord(runner, e.getMessage()));
                }
            }

            log.info("Strava auto-sync: completed: {} synced, {} failed", synced, failed);
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("runnerCount", stravaRunners.size());
            details.put("failures", failures);
            adminBackgroundJobService.markCompleted(
                    job,
                    synced,
                    failed,
                    failed > 0
                            ? "Global Strava sync finished with " + failed + (failed == 1 ? " failure." : " failures.")
                            : "Global Strava sync finished.",
                    details
            );
        } finally {
            // Always adjust the backoff state, even if job bookkeeping threw.
            applyAdaptiveBackoff(synced, failed, tickStartMs);
        }
    }

    /**
     * Adjust the effective scheduler interval after a completed runner loop.
     * A fully quiet cycle (syncs ran, nothing failed, nothing imported) doubles
     * the effective interval up to the configured cap; new activity or any
     * failure snaps back to the base interval.
     */
    private void applyAdaptiveBackoff(int synced, int failed, long tickStartMs) {
        long effectiveIntervalMs = currentIntervalMs > 0 ? currentIntervalMs : baseIntervalMs;
        if (synced > 0 && failed == 0 && !stravaSyncService.hasImportedActivitySince(tickStartMs)) {
            currentIntervalMs = Math.min(effectiveIntervalMs * 2, backoffMaxMinutes * 60_000L);
            log.info("Strava auto-sync: no new activities — backing off, next cycle in ~{} min", currentIntervalMs / 60_000);
        } else {
            currentIntervalMs = baseIntervalMs;
        }
    }

    private Map<String, Object> failureRecord(Runner runner, String message) {
        Map<String, Object> failure = new LinkedHashMap<>();
        failure.put("runnerId", runner.getId());
        failure.put("email", runner.getEmail());
        failure.put("message", message == null ? "Unknown error" : message);
        return failure;
    }
}
