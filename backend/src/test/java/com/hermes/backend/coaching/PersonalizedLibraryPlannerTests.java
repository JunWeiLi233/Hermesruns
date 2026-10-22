package com.hermes.backend.coaching;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

class PersonalizedLibraryPlannerTests {
    private final PersonalizedRunningPlanner planner = new PersonalizedRunningPlanner();
    private final LocalDate today = LocalDate.of(2026, 10, 19);
    private PersonalizedRunningPlanner.PersonalizedPlan plan(double weeklyKm, double pace, List<DayOfWeek> days, PersonalizedRunningPlanner.Goal goal) {
        var history = new PersonalizedRunningPlanner.RunHistory(80, 20, weeklyKm, weeklyKm * 4, weeklyKm / 5, weeklyKm * .3, pace, .1, 96, 2,
                Map.of(DayOfWeek.MONDAY, 10, DayOfWeek.WEDNESDAY, 8, DayOfWeek.SUNDAY, 8));
        return planner.plan(new PersonalizedRunningPlanner.PlannerInput(today, 14, history, 90, "GO", true, "LOW", null, goal, Map.of(), days));
    }
    @Test void confirmedDaysOverrideHistoricalHabitsWithoutCrammingTheWeeklyLoad() {
        var regular = plan(50, 300, null, null);
        var limited = plan(50, 300, List.of(DayOfWeek.TUESDAY, DayOfWeek.FRIDAY), null);
        assertThat(limited.preferredRunDays()).containsExactly(DayOfWeek.TUESDAY, DayOfWeek.FRIDAY);
        assertThat(limited.sessions().stream().filter(s -> s.workoutType() != CoachWorkoutType.REST))
                .allSatisfy(s -> assertThat(s.date().getDayOfWeek()).isIn(DayOfWeek.TUESDAY, DayOfWeek.FRIDAY));
        assertThat(limited.targetWeeklyKm()).isLessThan(regular.targetWeeklyKm());
    }
    @Test void differentHistoryAndFitnessProduceDifferentDistanceAndPacePrescriptions() {
        var days = List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.SUNDAY);
        var beginner = plan(12, 430, days, null);
        var experienced = plan(50, 290, days, new PersonalizedRunningPlanner.Goal(10d, today.plusWeeks(8), 2400, "10K"));
        assertThat(beginner.targetWeeklyKm()).isLessThan(experienced.targetWeeklyKm());
        var a = beginner.sessions().stream().filter(s -> s.targetPaceMinSecondsPerKm() != null).findFirst().orElseThrow();
        var b = experienced.sessions().stream().filter(s -> s.targetPaceMinSecondsPerKm() != null).findFirst().orElseThrow();
        assertThat(a.targetPaceMinSecondsPerKm()).isGreaterThan(b.targetPaceMinSecondsPerKm());
    }
    @Test void anUnconfirmedRaceDayCannotOverrideExplicitAvailabilityInLibrarySuggestions() {
        var plan = plan(30, 350, List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY),
                new PersonalizedRunningPlanner.Goal(10d, today.plusDays(6), 3000, "10K"));
        assertThat(plan.sessions().stream().filter(s -> s.date().equals(today.plusDays(6))).findFirst().orElseThrow().workoutType()).isEqualTo(CoachWorkoutType.REST);
    }
    @Test void explicitlyEmptyAvailabilityDoesNotInventTrainingDays() {
        assertThat(plan(30, 350, List.of(), null).sessions()).allSatisfy(s -> assertThat(s.workoutType()).isEqualTo(CoachWorkoutType.REST));
    }
    @Test void changingTheGoalChangesThePrescriptionWithTheSameFitnessAndHistory() {
        var days = List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.SUNDAY);
        var general = plan(50, 300, days, null);
        var race = plan(50, 300, days, new PersonalizedRunningPlanner.Goal(10d, today.plusWeeks(8), 2400, "10K"));
        assertThat(general.sessions()).noneSatisfy(session -> assertThat(session.workoutType()).isEqualTo(CoachWorkoutType.THRESHOLD));
        assertThat(race.sessions()).anySatisfy(session -> assertThat(session.workoutType()).isEqualTo(CoachWorkoutType.THRESHOLD));
    }
}
