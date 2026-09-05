package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityIngestedEvent;
import com.hermes.backend.rewards.DigitalCosmeticsService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ActivityIngestedEventListenerComponent {

    private final AutomatedCoachService automatedCoachService;
    private final DigitalCosmeticsService digitalCosmeticsService;

    public ActivityIngestedEventListenerComponent(AutomatedCoachService automatedCoachService,
                                                  DigitalCosmeticsService digitalCosmeticsService) {
        this.automatedCoachService = automatedCoachService;
        this.digitalCosmeticsService = digitalCosmeticsService;
    }

    /**
     * After commit when a transaction exists (imports). With {@code fallbackExecution}, also runs when
     * Strava sync saves outside a surrounding transaction.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onActivityIngested(ActivityIngestedEvent event) {
        automatedCoachService.handleActivityIngested(event.runnerId(), event.activityId());
        digitalCosmeticsService.handleActivityIngested(event.runnerId(), event.activityId());
    }
}
