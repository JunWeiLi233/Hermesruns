package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityIngestedEvent;
import com.hermes.backend.rewards.DigitalCosmeticsService;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
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
     * Persist coaching in the import transaction, before it commits. Starting a nested transaction
     * after commit needs another connection while the import still holds its own, which can exhaust
     * the small pool. Fallback handles provider saves without a surrounding transaction.
     */
    @Order(0)
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void onActivityIngested(ActivityIngestedEvent event) {
        automatedCoachService.handleActivityIngested(event.runnerId(), event.activityId());
    }

    /** Keep reward processing after commit and after coaching for non-transactional provider events. */
    @Order(1)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onActivityIngestedCommitted(ActivityIngestedEvent event) {
        digitalCosmeticsService.handleActivityIngested(event.runnerId(), event.activityId());
    }
}
