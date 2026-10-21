package com.hermes.backend.coaching;

import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CoachPlanAdjustmentTests {
    @Test void easierDayUsesExistingDistanceAndUpdatesTheSameWeeklyBudget() {
        var today=new PersonalizedRunningPlanner.PlannedSession(LocalDate.of(2026,10,16),CoachWorkoutType.TEMPO,10d,50,false,"build","quality","quality_window",288,300,null,false);
        var monday=new PersonalizedRunningPlanner.PlannedSession(today.date().minusDays(4),CoachWorkoutType.EASY,10d,60,false,"build","easy","build_consistency",320,350,null,false);
        var sunday=new PersonalizedRunningPlanner.PlannedSession(today.date().plusDays(2),CoachWorkoutType.LONG_RUN,10d,60,false,"build","long_run","aerobic_progression",320,350,null,false);
        var plan=new PersonalizedRunningPlanner.PersonalizedPlan("build",30,3,List.of(DayOfWeek.FRIDAY),80,List.of("build_consistency"),List.of(today),today,null,List.of(),List.of(monday,today,sunday));
        var actual=CoachPlanAdjustment.easeToday(plan);
        assertThat(actual.today().distanceKm()).isEqualTo(7.5);
        assertThat(actual.today().durationMinutes()).isEqualTo(37);
        assertThat(actual.today().targetPaceMinSecondsPerKm()).isNull();
        assertThat(actual.targetWeeklyKm()).isEqualTo(27.5);
        assertThat(actual.sessions().get(0)).isEqualTo(actual.today());
        assertThat(plan.today().distanceKm()).isEqualTo(10);
        assertThat(actual.weeklySessions()).hasSize(3);
        assertThat(actual.weeklySessions().stream().mapToDouble(s -> s.distanceKm()).sum()).isEqualTo(27.5);
        assertThat(actual.weeklySessions().get(1).distanceKm()).isEqualTo(7.5);
    }
    @Test void restAndUnknownDistanceCannotBeTurnedIntoARun() {
        var today=new PersonalizedRunningPlanner.PlannedSession(LocalDate.of(2026,10,16),CoachWorkoutType.REST,null,null,false,"protect","rest","scheduled_rest",null,null,null,false);
        var plan=new PersonalizedRunningPlanner.PersonalizedPlan("protect",9,2,List.of(),80,List.of(),List.of(today),today);
        assertThat(CoachPlanAdjustment.easeToday(plan)).isSameAs(plan);
    }
}
