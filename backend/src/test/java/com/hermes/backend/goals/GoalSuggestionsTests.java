package com.hermes.backend.goals;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class GoalSuggestionsTests {

    /** A Wednesday: the current week is Monday 5 October to Sunday 11 October. */
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 7);

    private static LocalDate monday(int weeksBack) {
        return GoalPeriods.start(GoalPeriods.WEEK, TODAY).minusWeeks(weeksBack);
    }

    /** {@code runs} runs of {@code km} each in one complete week, {@code weeksBack} weeks ago (1 is last week), 30 minutes a run at 8 m of climb per km. */
    private static void week(List<GoalSuggestions.Day> days, int weeksBack, int runs, double km, double climbPerRun) {
        for (int i = 0; i < runs; i++) {
            days.add(new GoalSuggestions.Day(monday(weeksBack).plusDays((long) i * 7 / runs), km, 1800, 1, climbPerRun));
        }
    }

    /** Eight complete weeks of {@code runs} runs of {@code km}. */
    private static List<GoalSuggestions.Day> steady(int runs, double km, double climbPerRun) {
        List<GoalSuggestions.Day> days = new ArrayList<>();
        for (int back = 1; back <= 8; back++) {
            week(days, back, runs, km, climbPerRun);
        }
        return days;
    }

    private static Optional<GoalSuggestions.Suggestion> find(List<GoalSuggestions.Suggestion> all, String period, String metric) {
        return all.stream().filter(s -> s.period().equals(period) && s.metric().equals(metric)).findFirst();
    }

    @Test
    void aRunnerWhoRunsThirtyKilometresAWeekIsOfferedAWeekAboveThatToTheNearestFive() {
        List<GoalSuggestions.Suggestion> suggestions = GoalSuggestions.suggest(steady(3, 10, 0), TODAY, Set.of());

        GoalSuggestions.Suggestion week = find(suggestions, GoalPeriods.WEEK, GoalMetrics.DISTANCE).orElseThrow();
        assertThat(week.target()).isEqualTo(35.0);
        assertThat(week.unit()).isEqualTo("km");
        assertThat(week.basis()).isEqualTo(new GoalSuggestions.Basis("weekly-average", 8, 30.0, 10));
    }

    @Test
    void theNumberOfRunsIsTheUsualNumberNotMoreOfThem() {
        assertThat(find(GoalSuggestions.suggest(steady(3, 10, 0), TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.COUNT).orElseThrow().target())
                .isEqualTo(3.0);
        assertThat(find(GoalSuggestions.suggest(steady(5, 6, 0), TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.COUNT).orElseThrow().target())
                .isEqualTo(5.0);
    }

    @Test
    void aRunnerWhoRunsOnceAWeekIsOfferedTwoNotOne() {
        List<GoalSuggestions.Day> days = new ArrayList<>();
        for (int back = 1; back <= 8; back++) {
            week(days, back, 1, 8, 0);
        }

        assertThat(find(GoalSuggestions.suggest(days, TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.COUNT).orElseThrow().target()).isEqualTo(2.0);
    }

    @Test
    void weeksWithNoRunAreLeftOutOfTheUsualWeekSoAHolidayDoesNotLowerTheBar() {
        List<GoalSuggestions.Day> days = new ArrayList<>();
        for (int back : new int[] {1, 2, 3, 4}) {
            week(days, back, 3, 10, 0);
        }

        GoalSuggestions.Suggestion week = find(GoalSuggestions.suggest(days, TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.DISTANCE).orElseThrow();

        assertThat(week.basis().usual()).isEqualTo(30.0);
        assertThat(week.basis().span()).isEqualTo(4);
        assertThat(week.target()).isEqualTo(35.0);
    }

    @Test
    void theWeekThatIsStillGoingIsNotPartOfTheUsualWeek() {
        List<GoalSuggestions.Day> days = steady(3, 10, 0);
        days.add(new GoalSuggestions.Day(TODAY, 60, 18000, 1, 0));

        GoalSuggestions.Suggestion week = find(GoalSuggestions.suggest(days, TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.DISTANCE).orElseThrow();

        assertThat(week.basis().usual()).isEqualTo(30.0);
    }

    @Test
    void nothingIsSuggestedWithoutFourActiveWeeksAndSixRuns() {
        List<GoalSuggestions.Day> threeWeeks = new ArrayList<>();
        for (int back = 1; back <= 3; back++) {
            week(threeWeeks, back, 4, 10, 0);
        }
        List<GoalSuggestions.Day> fourWeeksOfOneRun = new ArrayList<>();
        for (int back = 1; back <= 4; back++) {
            week(fourWeeksOfOneRun, back, 1, 10, 0);
        }

        assertThat(GoalSuggestions.suggest(threeWeeks, TODAY, Set.of())).isEmpty();
        assertThat(GoalSuggestions.enoughRunning(threeWeeks, TODAY)).isFalse();
        assertThat(GoalSuggestions.suggest(fourWeeksOfOneRun, TODAY, Set.of())).isEmpty();
        assertThat(GoalSuggestions.enoughRunning(List.of(), TODAY)).isFalse();
        assertThat(GoalSuggestions.enoughRunning(steady(2, 8, 0), TODAY)).isTrue();
    }

    @Test
    void runningOlderThanEightWeeksDoesNotCountTowardsTheUsualWeek() {
        List<GoalSuggestions.Day> days = new ArrayList<>();
        for (int back = 9; back <= 20; back++) {
            week(days, back, 4, 12, 0);
        }

        assertThat(GoalSuggestions.suggest(days, TODAY, Set.of())).isEmpty();
    }

    @Test
    void aGoalTheRunnerHasIsNotOfferedAgain() {
        Set<String> has = Set.of("WEEK/DISTANCE", "WEEK/COUNT");

        List<GoalSuggestions.Suggestion> suggestions = GoalSuggestions.suggest(steady(3, 10, 0), TODAY, has);

        assertThat(find(suggestions, GoalPeriods.WEEK, GoalMetrics.DISTANCE)).isEmpty();
        assertThat(find(suggestions, GoalPeriods.WEEK, GoalMetrics.COUNT)).isEmpty();
        assertThat(find(suggestions, GoalPeriods.WEEK, GoalMetrics.TIME)).isPresent();
    }

    @Test
    void aDistanceTimeOrClimbTargetIsAlwaysAboveTheUsualFigureItComesFrom() {
        for (double km : new double[] {3.2, 5, 8, 10, 12.5, 20, 25, 42, 60, 80, 120}) {
            List<GoalSuggestions.Suggestion> suggestions = GoalSuggestions.suggest(steady(3, km, 40), TODAY, Set.of());
            for (GoalSuggestions.Suggestion suggestion : suggestions) {
                if (suggestion.metric().equals(GoalMetrics.COUNT)) {
                    continue;
                }
                assertThat(suggestion.target()).as("%s %s from %s", suggestion.period(), suggestion.metric(), suggestion.basis().usual())
                        .isGreaterThan(suggestion.basis().usual());
            }
        }
    }

    @Test
    void theRoundingStepGrowsWithTheSize() {
        assertThat(GoalSuggestions.step(3)).isEqualTo(1);
        assertThat(GoalSuggestions.step(30)).isEqualTo(5);
        assertThat(GoalSuggestions.step(120)).isEqualTo(10);
        assertThat(GoalSuggestions.step(400)).isEqualTo(25);
        assertThat(GoalSuggestions.step(1500)).isEqualTo(50);
        assertThat(GoalSuggestions.step(4000)).isEqualTo(100);
        // 20 km a week plus a tenth is 22, which rounds back down to 20: one more step.
        assertThat(GoalSuggestions.above(20, 0.10, GoalSuggestions.step(20))).isEqualTo(25.0);
    }

    @Test
    void weeklyTimeIsToTheQuarterHourAndAtLeastHalfAnHour() {
        GoalSuggestions.Suggestion time = find(GoalSuggestions.suggest(steady(3, 10, 0), TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.TIME).orElseThrow();

        // Three runs of 30 minutes is 90 minutes a week; a tenth more is 99, which rounds to 105.
        assertThat(time.target()).isEqualTo(6300.0);
        assertThat(time.unit()).isEqualTo("s");
        assertThat(time.target() % 900).isZero();
    }

    @Test
    void aWeeklyClimbIsOfferedOnlyToARunnerWhoseWeekClimbs() {
        // 3 runs of 10 km at 10 m of climb a run is 30 m a week: not a climbing runner.
        assertThat(find(GoalSuggestions.suggest(steady(3, 10, 10), TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.ELEVATION)).isEmpty();

        // 3 runs at 100 m a run is 300 m a week; a tenth more is 330, to the nearest 50 is 350.
        GoalSuggestions.Suggestion climb = find(GoalSuggestions.suggest(steady(3, 10, 100), TODAY, Set.of()), GoalPeriods.WEEK, GoalMetrics.ELEVATION).orElseThrow();
        assertThat(climb.target()).isEqualTo(350.0);
        assertThat(climb.unit()).isEqualTo("m");
    }

    @Test
    void aMonthNeedsTwoMonthsWithRunsAndTakesTheirAverage() {
        // Last month and the month before: 10 runs of 10 km each. This month does not count, it is not over.
        List<GoalSuggestions.Day> days = new ArrayList<>(steady(3, 10, 0));
        LocalDate firstOfThisMonth = TODAY.withDayOfMonth(1);
        for (int i = 0; i < 10; i++) {
            days.add(new GoalSuggestions.Day(firstOfThisMonth.minusMonths(1).plusDays(i), 10, 1800, 1, 0));
            days.add(new GoalSuggestions.Day(firstOfThisMonth.minusMonths(2).plusDays(i), 10, 1800, 1, 0));
        }
        days.add(new GoalSuggestions.Day(TODAY, 100, 3600, 1, 0));

        GoalSuggestions.Suggestion month = find(GoalSuggestions.suggest(days, TODAY, Set.of()), GoalPeriods.MONTH, GoalMetrics.DISTANCE).orElseThrow();

        assertThat(month.basis().kind()).isEqualTo("monthly-average");
        assertThat(month.basis().span()).isEqualTo(3);
        assertThat(month.basis().usual()).isGreaterThan(100.0);
        assertThat(month.target()).isGreaterThan(month.basis().usual());
    }

    @Test
    void aYearIsOfferedOnlyToARunnerWhoRanInSixMonthsOfTheLastTwelve() {
        List<GoalSuggestions.Day> recent = steady(3, 10, 0);
        assertThat(find(GoalSuggestions.suggest(recent, TODAY, Set.of()), GoalPeriods.YEAR, GoalMetrics.DISTANCE)).isEmpty();

        List<GoalSuggestions.Day> days = new ArrayList<>(recent);
        for (int month = 3; month <= 11; month++) {
            days.add(new GoalSuggestions.Day(TODAY.minusMonths(month).withDayOfMonth(10), 20, 3600, 1, 0));
        }
        GoalSuggestions.Suggestion year = find(GoalSuggestions.suggest(days, TODAY, Set.of()), GoalPeriods.YEAR, GoalMetrics.DISTANCE).orElseThrow();

        assertThat(year.basis().kind()).isEqualTo("yearly-total");
        assertThat(year.basis().span()).isEqualTo(365);
        assertThat(year.basis().stretchPercent()).isEqualTo(5);
        assertThat(year.target()).isGreaterThan(year.basis().usual());
    }

    @Test
    void theOrderIsTheWeekFirstThenTheLongerPeriods() {
        List<GoalSuggestions.Suggestion> suggestions = GoalSuggestions.suggest(steady(3, 10, 100), TODAY, Set.of());

        assertThat(suggestions.get(0).period() + "/" + suggestions.get(0).metric()).isEqualTo("WEEK/DISTANCE");
        assertThat(suggestions.get(1).period() + "/" + suggestions.get(1).metric()).isEqualTo("WEEK/COUNT");
    }
}
