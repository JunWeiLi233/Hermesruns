package com.hermes.backend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ActivityIngestedEventListenerComponent {

    private static final Logger log = LoggerFactory.getLogger(ActivityIngestedEventListenerComponent.class);

    private final AutomatedCoachService automatedCoachService;
    private final DigitalCosmeticsService digitalCosmeticsService;
    private final TerritoryService territoryService;

    public ActivityIngestedEventListenerComponent(AutomatedCoachService automatedCoachService,
                                                  DigitalCosmeticsService digitalCosmeticsService,
                                                  TerritoryService territoryService) {
        this.automatedCoachService = automatedCoachService;
        this.digitalCosmeticsService = digitalCosmeticsService;
        this.territoryService = territoryService;
    }

    /**
     * After commit when a transaction exists (imports). With {@code fallbackExecution}, also runs when
     * Strava sync saves outside a surrounding transaction.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onActivityIngested(ActivityIngestedEvent event) {
        automatedCoachService.handleActivityIngested(event.runnerId(), event.activityId());
        digitalCosmeticsService.handleActivityIngested(event.runnerId(), event.activityId());
        try {
            territoryService.computePolygonsForActivity(event.activityId());
        } catch (Exception e) {
            // Never fail ingestion for polygon detection errors
            log.warn("Territory polygon detection failed for activity {}: {}", event.activityId(), e.getMessage());
        }
    }
}
