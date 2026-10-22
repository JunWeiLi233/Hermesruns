package com.hermes.backend.coaching;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class WeeklyMileageReconciliationTests {
    private final PersonalizedRunningPlanner planner = new PersonalizedRunningPlanner();

    @Test void uncompletedFullWeekRecommendationsMatchTheChartPlanAndBudget() {
        var monday = LocalDate.of(2026, 10, 12);
        var result = plan(monday, 7, Map.of());
        assertThat(result.sessions()).isEqualTo(result.weeklySessions());
        assertThat(result.sessions().stream().filter(s -> s.distanceKm() != null)
                .mapToLong(s -> Math.round(s.distanceKm() * 10)).sum())
                .isEqualTo(Math.round(result.targetWeeklyKm() * 10));
    }

    @Test void completeWeeklyPlanReconcilesToBudgetBeforeCompletedMileageIsDebited() {
        var today = LocalDate.of(2026, 10, 17);
        var completed = Map.of(today.minusDays(5), 10d, today.minusDays(4), 10.2,
                today.minusDays(3), 5.1, today.minusDays(2), 10d);
        var planned = plan(today, 14, completed);
        var withoutCompleted = plan(today, 14, Map.of());
        assertThat(planned.weeklySessions()).hasSize(7);
        assertThat(planned.weeklySessions().get(0).date()).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(planned.weeklySessions().get(6).date()).isEqualTo(LocalDate.of(2026, 10, 18));
        assertThat(planned.weeklySessions()).isEqualTo(withoutCompleted.weeklySessions());
        assertThat(planned.weeklySessions().stream().filter(s -> s.distanceKm() != null)
                .mapToLong(s -> Math.round(s.distanceKm() * 10)).sum())
                .isEqualTo(Math.round(planned.targetWeeklyKm() * 10));
        assertThat(planned.weeklySessions()).anyMatch(s -> s.date().isBefore(today) && s.distanceKm() != null);
        assertThat(planned.sessions().stream().filter(s -> !s.date().isAfter(LocalDate.of(2026, 10, 18))))
                .allMatch(s -> s.workoutType() == CoachWorkoutType.REST);
        assertThat(plan(today, 1, completed).weeklySessions()).isEqualTo(planned.weeklySessions());
    }

    @Test void weeklyPlanRetainsRestDaysAndDistributesRoundingWithoutLosingMileage() {
        var today = LocalDate.of(2026, 10, 17);
        var planned = plan(today, 14, Map.of());
        assertThat(planned.weeklySessions()).allSatisfy(s -> {
            if (!planned.preferredRunDays().contains(s.date().getDayOfWeek())) {
                assertThat(s.workoutType()).isEqualTo(CoachWorkoutType.REST);
                assertThat(s.distanceKm()).isNull();
            }
        });
        assertThat(planned.weeklySessions().stream().filter(s -> s.distanceKm() != null))
                .allMatch(s -> s.distanceKm() > 0);
        assertThat(planned.weeklySessions().stream().filter(s -> s.distanceKm() != null)
                .mapToLong(s -> Math.round(s.distanceKm() * 10)).sum()).isEqualTo(249);
    }

    @Test void fullCalendarWeekPrescriptionsCannotExceedTheHistoryDerivedBudget() {
        var history = new PersonalizedRunningPlanner.RunHistory(24, 15, 30, 64, 8, 11,
                340, 0.1, 72, 1, Map.of(DayOfWeek.MONDAY, 4, DayOfWeek.TUESDAY, 4,
                DayOfWeek.THURSDAY, 4, DayOfWeek.SATURDAY, 3));
        var plan = planner.plan(new PersonalizedRunningPlanner.PlannerInput(LocalDate.of(2026, 10, 19),
                7, history, 76, "EASY", false, "LOW", null, null));
        double planned = plan.sessions().stream().filter(s -> s.distanceKm() != null)
                .mapToDouble(PlannedSession::distanceKm).sum();
        assertThat(planned).isLessThanOrEqualTo(plan.targetWeeklyKm());
    }

    @Test void realCompletedMileageExhaustsThisWeekButDoesNotSpendNextWeeksAllowance() {
        var today = LocalDate.of(2026, 10, 16);
        var actual = Map.of(today.minusDays(4), 10.0096, today.minusDays(3), 10.1666,
                today.minusDays(2), 5.1616, today.minusDays(1), 10.0072);
        var plan = plan(today, 14, actual);
        assertThat(plan.targetWeeklyKm()).isEqualTo(24.9);
        assertThat(plan.weeklyBudgets().get(0).completedKm()).isCloseTo(35.345, org.assertj.core.data.Offset.offset(0.0001));
        assertThat(plan.weeklyBudgets().get(0).remainingAllowanceKm()).isZero();
        assertThat(plan.sessions().stream().filter(s -> !s.date().isAfter(LocalDate.of(2026, 10, 18)))).allMatch(s -> s.workoutType() == CoachWorkoutType.REST);
        assertThat(plan.weeklyBudgets().get(1).completedKm()).isZero();
        assertThat(plan.weeklyBudgets().get(1).scheduledRemainingKm()).isPositive().isLessThanOrEqualTo(24.9);
        assertThat(plan.historyEvidence().volume28Km()).isEqualTo(124.7);
        assertThat(plan.historyEvidence().weeklyMultiplier()).isEqualTo(0.8);
        assertThat(plan.historyEvidence().dailyDistances()).hasSize(4);
    }

    @Test void partialAllowanceIsSharedWithoutInflatingRunsAndRoundsDown() {
        var plan = plan(LocalDate.of(2026, 10, 13), 14, Map.of(LocalDate.of(2026, 10, 12), 23.965));
        var week = plan.weeklyBudgets().get(0);
        assertThat(week.remainingAllowanceKm()).isEqualTo(0.9);
        assertThat(week.scheduledRemainingKm()).isLessThanOrEqualTo(0.9);
        assertThat(week.projectedTotalKm()).isLessThanOrEqualTo(24.9);
        assertThat(plan.sessions().stream().filter(s -> !s.date().isAfter(week.end()) && s.distanceKm() != null))
                .allMatch(s -> s.distanceKm() > 0 && s.distanceKm() < 1);
    }

    @Test void completedTodayIsNotPrescribedAgainAndInputHistoryIsNotMutated() {
        var today = LocalDate.of(2026, 10, 13);
        var actual = Map.of(today, 10d);
        var plan = plan(today, 14, actual);
        assertThat(plan.today().reasonCode()).isEqualTo("run_completed");
        assertThat(plan.today().distanceKm()).isNull();
        assertThat(actual).containsEntry(today, 10d);
    }

    @Test void requestingOneDayOrTwentyEightDaysReturnsTheSamePrescription() {
        var today = LocalDate.of(2026, 10, 13);
        var actual = Map.of(today.minusDays(1), 23d);
        assertThat(plan(today, 1, actual).today()).isEqualTo(plan(today, 28, actual).today());
        assertThat(plan(today, 1, actual).weeklyBudgets().get(0)).isEqualTo(plan(today, 28, actual).weeklyBudgets().get(0));
    }

    @Test void futureAndInvalidActivityDatesCannotSpendTheCurrentBudget() {
        var today = LocalDate.of(2026, 10, 16);
        var actual = new java.util.HashMap<LocalDate, Double>();
        actual.put(today.plusDays(1), 100d); actual.put(today.minusDays(1), Double.NaN);
        actual.put(today.minusDays(2), -10d);
        assertThat(plan(today, 14, actual).weeklyBudgets().get(0).completedKm()).isZero();
    }

    private PersonalizedRunningPlanner.PersonalizedPlan plan(LocalDate today, int days, Map<LocalDate, Double> actual) {
        var history = new PersonalizedRunningPlanner.RunHistory(24, 15, 46.4, 124.7, 5.2, 11,
                340, 0.1, 72, 1, Map.of(DayOfWeek.MONDAY, 4, DayOfWeek.TUESDAY, 4,
                DayOfWeek.THURSDAY, 4, DayOfWeek.SATURDAY, 3));
        return planner.plan(new PersonalizedRunningPlanner.PlannerInput(today, days, history,
                76, "EASY", false, "LOW", null, null, actual));
    }
}
