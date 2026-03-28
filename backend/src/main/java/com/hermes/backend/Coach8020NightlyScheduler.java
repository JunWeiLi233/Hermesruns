package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly polarized audit: 80/20 enforcement on tomorrow's plan, week progression, schedule fill.
 */
@Component
@ConditionalOnProperty(name = "app.coach.nightly.enabled", havingValue = "true", matchIfMissing = true)
public class Coach8020NightlyScheduler {

    private static final Logger log = LoggerFactory.getLogger(Coach8020NightlyScheduler.class);

    private final AutomatedCoachService automatedCoachService;

    public Coach8020NightlyScheduler(AutomatedCoachService automatedCoachService) {
        this.automatedCoachService = automatedCoachService;
    }

    /** Default 03:00 server local time. */
    @Scheduled(cron = "${app.coach.nightly.cron:0 0 3 * * *}")
    public void nightlyCoachAudit() {
        try {
            automatedCoachService.nightlyAuditAllRunners();
        } catch (Exception e) {
            log.warn("Coach nightly audit failed: {}", e.getMessage());
        }
    }
}
