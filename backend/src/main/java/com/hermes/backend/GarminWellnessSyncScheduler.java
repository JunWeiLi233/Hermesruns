package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class GarminWellnessSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(GarminWellnessSyncScheduler.class);

    private final RunnerRepository runnerRepository;
    private final GarminWellnessImportService wellnessImportService;
    private final SecretEncryptionService secretEncryptionService;
    private final AdminBackgroundJobService adminBackgroundJobService;

    @Value("${garmin.wellness.sync.enabled:true}")
    private boolean syncEnabled;

    public GarminWellnessSyncScheduler(
            RunnerRepository runnerRepository,
            GarminWellnessImportService wellnessImportService,
            SecretEncryptionService secretEncryptionService,
            AdminBackgroundJobService adminBackgroundJobService
    ) {
        this.runnerRepository = runnerRepository;
        this.wellnessImportService = wellnessImportService;
        this.secretEncryptionService = secretEncryptionService;
        this.adminBackgroundJobService = adminBackgroundJobService;
    }

    @Scheduled(fixedDelayString = "${garmin.wellness.sync.interval-ms:1800000}", initialDelay = 180_000)
    public void syncAllGarminWellnessRunners() {
        runSyncJob(null, "scheduler");
    }

    public AdminBackgroundJob triggerAdminSync(Runner actor, String triggerSource) {
        return runSyncJob(actor, triggerSource == null || triggerSource.isBlank() ? "admin_manual" : triggerSource);
    }

    private AdminBackgroundJob runSyncJob(Runner actor, String triggerSource) {
        if (!syncEnabled) {
            AdminBackgroundJob job = adminBackgroundJobService.createJob(
                    "GARMIN_WELLNESS_SYNC",
                    triggerSource,
                    actor,
                    "Garmin wellness sync is not enabled.",
                    Map.of("enabled", false)
            );
            adminBackgroundJobService.markCompleted(job, 0, 0, "Garmin wellness sync is not enabled.", Map.of("enabled", false));
            return job;
        }

        List<Runner> runners = runnerRepository
                .findByGarminWellnessSyncEnabledTrueAndGarminConnectEmailIsNotNullAndDeletedFalse();

        AdminBackgroundJob job = adminBackgroundJobService.createJob(
                "GARMIN_WELLNESS_SYNC",
                triggerSource,
                actor,
                "Queued Garmin wellness sync.",
                Map.of("runnerCount", runners.size())
        );

        if (runners.isEmpty()) {
            adminBackgroundJobService.markCompleted(job, 0, 0, "No Garmin wellness-sync runners to sync.", Map.of("runnerCount", 0));
            return job;
        }

        adminBackgroundJobService.runAsync(job, runners.size(), () -> executeSync(job, runners));
        return job;
    }

    private void executeSync(AdminBackgroundJob job, List<Runner> runners) {
        log.info("Garmin wellness auto-sync: starting for {} connected runner(s)", runners.size());

        int synced = 0;
        int failed = 0;
        List<Map<String, Object>> failures = new java.util.ArrayList<>();

        for (Runner runner : runners) {
            try {
                String email = runner.getGarminConnectEmail();
                String encryptedPassword = runner.getGarminConnectPasswordEncrypted();
                String decryptedPassword = secretEncryptionService.decrypt(encryptedPassword);

                if (email == null || email.isBlank() || decryptedPassword == null || decryptedPassword.isBlank()) {
                    log.warn("Garmin wellness auto-sync: skipping runner {} (missing credentials)", runner.getId());
                    failed++;
                    failures.add(failureRecord(runner, "Missing credentials"));
                    continue;
                }

                long retryAfterSeconds = wellnessImportService.getRateLimitRetryAfterSeconds(runner.getId());
                if (retryAfterSeconds > 0) {
                    log.warn("Garmin wellness auto-sync: skipping runner {} during Garmin rate-limit cooldown", runner.getId());
                    failed++;
                    failures.add(failureRecord(runner, GarminRateLimitSupport.message(retryAfterSeconds)));
                    continue;
                }

                int daysBack = runner.getGarminWellnessLastSyncedAt() == null ? 90 : 7;

                boolean started = wellnessImportService.startWellnessImport(runner, email, decryptedPassword, daysBack);
                if (started) {
                    runner.setGarminWellnessLastSyncedAt(LocalDateTime.now());
                    runnerRepository.save(runner);
                    synced++;
                } else {
                    failed++;
                    failures.add(failureRecord(runner, "Import already running or failed to start"));
                }
            } catch (Exception e) {
                log.warn("Garmin wellness auto-sync: failed for runner {}: {}", runner.getId(), e.getMessage());
                failed++;
                failures.add(failureRecord(runner, e.getMessage()));
            }
        }

        log.info("Garmin wellness auto-sync: completed — {} synced, {} failed", synced, failed);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("runnerCount", runners.size());
        details.put("failures", failures);
        adminBackgroundJobService.markCompleted(
                job,
                synced,
                failed,
                "Garmin wellness sync finished.",
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
