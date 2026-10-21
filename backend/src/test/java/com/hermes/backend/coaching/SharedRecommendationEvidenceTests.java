package com.hermes.backend.coaching;

import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class SharedRecommendationEvidenceTests {
    @Test void missingHistoryCannotCreateAWeeklyBudgetOrDailyKilometres() {
        var plan = new PersonalizedRunningPlanner().plan(new PersonalizedRunningPlanner.PlannerInput(
                LocalDate.of(2026,10,16),14,PersonalizedRunningPlanner.RunHistory.empty(),null,null,false,null,null,null));
        assertThat(plan.targetWeeklyKm()).isZero();
        assertThat(plan.sessionsPerWeek()).isZero();
        assertThat(plan.today().reasonCode()).isEqualTo("history_required");
        assertThat(plan.sessions()).allMatch(day -> day.distanceKm()==null);
        assertThat(plan.weeklySessions()).hasSize(7).allMatch(day -> day.distanceKm()==null && "history_required".equals(day.reasonCode()));
    }
    @Test void invalidImportedVolumesDoNotBecomeNumericPrescriptions() {
        var history = new PersonalizedRunningPlanner.RunHistory(4,4,Double.NaN,Double.POSITIVE_INFINITY,Double.NaN,0,0,0,null,null,Map.of());
        var plan = new PersonalizedRunningPlanner().plan(new PersonalizedRunningPlanner.PlannerInput(
                LocalDate.of(2026,10,16),14,history,null,null,false,null,null,null));
        assertThat(plan.targetWeeklyKm()).isZero();
        assertThat(plan.sessions()).allMatch(day -> day.distanceKm()==null);
    }
}
