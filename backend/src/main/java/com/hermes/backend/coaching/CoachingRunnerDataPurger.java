package com.hermes.backend.coaching;

import com.hermes.backend.runner.RunnerDataPurger;
import com.hermes.backend.runner.RunnerRows;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Set;
import org.springframework.stereotype.Component;

/** Coach state, plans, alerts, soreness and the wellness series. */
@Component
class CoachingRunnerDataPurger implements RunnerDataPurger {

    private static final Set<Class<?>> OWNED = Set.of(
            BodyCompositionData.class,
            CoachFeedbackAlert.class,
            CoachRunnerState.class,
            CoachScheduledWorkout.class,
            CoachTrainingBlock.class,
            DailyHRVData.class,
            DailySleepData.class,
            DailyStressData.class,
            DailyWellnessSummary.class,
            SorenessLog.class
    );

    @PersistenceContext
    private EntityManager em;

    @Override
    public int order() {
        return 40;
    }

    @Override
    public Set<Class<?>> entities() {
        return OWNED;
    }

    @Override
    public void purge(Long runnerId) {
        RunnerRows.deleteAll(em, runnerId, OWNED);
    }
}
