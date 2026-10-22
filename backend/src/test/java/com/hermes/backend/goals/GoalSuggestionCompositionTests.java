package com.hermes.backend.goals;

import com.hermes.backend.coaching.AutomatedCoachService.CoachPlanDto;
import com.hermes.backend.coaching.WeeklyMileageBudget;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GoalSuggestionCompositionTests {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 19);

    private static List<GoalSuggestions.Day> history() {
        var days = new ArrayList<GoalSuggestions.Day>();
        for (int week = 1; week <= 60; week++) {
            for (int offset : new int[] {1, 3, 5}) {
                days.add(new GoalSuggestions.Day(TODAY.minusWeeks(week).plusDays(offset), 6, 1800, 1, 80));
            }
        }
        return days;
    }

    private static CoachPlanDto protectPlan() {
        return new CoachPlanDto("protect", 9, 2, List.of("TUESDAY", "SATURDAY"), 80, List.of("injury_protect"));
    }

    @Test
    void prescribedWeeklyGoalsLeadAndAllHistoricalNonweeklyGoalsRemainUnchanged() {
        var days = history();
        var historical = GoalSuggestions.suggest(days, TODAY, Set.of());
        var composed = GoalSuggestions.suggest(days, TODAY, Set.of(), protectPlan());

        assertThat(composed.subList(0, 2)).extracting(s -> s.period() + "/" + s.metric())
                .containsExactly("WEEK/DISTANCE", "WEEK/COUNT");
        assertThat(composed.get(0).target()).isEqualTo(9);
        assertThat(composed.get(1).target()).isEqualTo(2);
        assertThat(composed.subList(0, 2)).allSatisfy(s -> assertThat(s.basis().kind()).isEqualTo("coach-plan"));
        assertThat(composed).filteredOn(s -> !s.period().equals("WEEK"))
                .containsExactlyElementsOf(historical.stream().filter(s -> !s.period().equals("WEEK")).toList());
        assertThat(composed).anyMatch(s -> s.period().equals("MONTH") && s.basis().kind().equals("monthly-average"));
        assertThat(composed).anyMatch(s -> s.period().equals("YEAR") && s.basis().kind().equals("yearly-total"));
        assertThat(composed).extracting(s -> s.period() + "/" + s.metric()).doesNotHaveDuplicates();
        assertThat(composed).filteredOn(s -> s.period().equals("WEEK") && s.metric().equals("DISTANCE")).hasSize(1);
    }

    @Test
    void existingGoalsAreDeduplicatedByPeriodAndMetricAcrossBothSources() {
        Set<String> existing = Set.of("WEEK/DISTANCE", "MONTH/DISTANCE", "YEAR/COUNT");
        var composed = GoalSuggestions.suggest(history(), TODAY, existing, protectPlan());

        assertThat(composed).noneMatch(s -> existing.contains(s.period() + "/" + s.metric()));
        assertThat(composed).filteredOn(s -> s.period().equals("WEEK") && s.metric().equals("COUNT"))
                .singleElement().satisfies(s -> assertThat(s.target()).isEqualTo(2));
        assertThat(composed).anyMatch(s -> s.period().equals("YEAR") && s.metric().equals("DISTANCE"));
        assertThat(composed).extracting(s -> s.period() + "/" + s.metric()).doesNotHaveDuplicates();
    }

    @Test
    void missingOrUnusablePlansUseTheUnchangedHistoricalSuggestions() {
        var days = history();
        Set<String> existing = Set.of("MONTH/COUNT");
        var historical = GoalSuggestions.suggest(days, TODAY, existing);

        assertThat(GoalSuggestions.suggest(days, TODAY, existing, null)).containsExactlyElementsOf(historical);
        var unusable = new CoachPlanDto("unavailable", Double.POSITIVE_INFINITY, 0, List.of(), 0, List.of());
        assertThat(GoalSuggestions.suggest(days, TODAY, existing, unusable)).containsExactlyElementsOf(historical);
    }

    @Test
    void anExhaustedPlanCannotReintroduceAHistoricalWeeklyDistancePrescription() {
        var days = history();
        days.add(new GoalSuggestions.Day(TODAY, 35, 7200, 3, 0));
        var budget = new WeeklyMileageBudget.Week(TODAY, TODAY.plusDays(6), 24.9, 35, 0, 0, 35);
        var plan = new CoachPlanDto("absorb", 24.9, 2, List.of("TUESDAY", "SATURDAY"), 80,
                List.of("high_load"), "UTC", null, List.of(budget), null);

        var composed = GoalSuggestions.suggest(days, TODAY, Set.of(), plan);

        assertThat(composed).noneMatch(s -> s.period().equals("WEEK"));
        assertThat(composed).filteredOn(s -> !s.period().equals("WEEK"))
                .containsExactlyElementsOf(GoalSuggestions.suggest(days, TODAY, Set.of()).stream()
                        .filter(s -> !s.period().equals("WEEK")).toList());
        assertThat(composed).isNotEmpty();
    }

    @Test
    void recentHistoryStillSupportsAPlanBeforeHistoricalEligibility() {
        var days = List.of(new GoalSuggestions.Day(TODAY.minusDays(1), 5, 1800, 1, 0));
        assertThat(GoalSuggestions.suggest(days, TODAY, Set.of())).isEmpty();
        assertThat(GoalSuggestions.suggest(days, TODAY, Set.of(), protectPlan()))
                .hasSize(2).allSatisfy(s -> assertThat(s.basis().kind()).isEqualTo("coach-plan"));
    }
}
