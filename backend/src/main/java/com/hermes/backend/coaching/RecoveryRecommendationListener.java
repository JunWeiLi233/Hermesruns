package com.hermes.backend.coaching;

import com.hermes.backend.runner.RunnerRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class RecoveryRecommendationListener {
    private final RunnerRepository runners;
    private final AutomatedCoachService coach;

    public RecoveryRecommendationListener(RunnerRepository runners, AutomatedCoachService coach) {
        this.runners = runners;
        this.coach = coach;
    }

    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, fallbackExecution = true)
    public void recoveryUpdated(RecoveryUpdatedEvent event) {
        runners.findById(event.runnerId()).ifPresent(coach::replanFutureSchedule);
    }
}
