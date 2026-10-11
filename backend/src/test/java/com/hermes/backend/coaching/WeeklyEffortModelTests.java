package com.hermes.backend.coaching;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Weekly totals and each week's usual range, on a calendar where the weeks are known: 5 Oct 2026 is a Monday. */
class WeeklyEffortModelTests {

    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 5);
    private static final LocalDate TODAY_THURSDAY = LocalDate.of(2026, 10, 8);

    /** A history that is long enough: the first run is well before every week asked about. */
    private static final LocalDate LONG_AGO = LocalDate.of(2026, 1, 5);

    private final Map<LocalDate, Double> effort = new HashMap<>();
    private final Map<LocalDate, Integer> runs = new HashMap<>();

    /** Puts one run of this effort on the Tuesday of the week that starts {@code weeksBack} weeks before 5 Oct. */
    private void weekOf(int weeksBack, double total) {
        LocalDate tuesday = MONDAY.minusWeeks(weeksBack).plusDays(1);
        effort.put(tuesday, total);
        runs.put(tuesday, 1);
    }

    private List<WeeklyEffortModel.Week> weeks(LocalDate today, LocalDate first, int count) {
        return WeeklyEffortModel.weeks(effort, runs, today, first, count, 0.2);
    }

    @Test
    void aWeekRunsFromMondayToSundayAndAnotherDayJoinsTheNeighbour() {
        effort.put(LocalDate.of(2026, 10, 4), 100.0);   // Sunday
        runs.put(LocalDate.of(2026, 10, 4), 1);
        effort.put(LocalDate.of(2026, 10, 5), 60.0);    // Monday
        runs.put(LocalDate.of(2026, 10, 5), 2);
        effort.put(LocalDate.of(2026, 10, 11), 40.0);   // Sunday of the same week
        runs.put(LocalDate.of(2026, 10, 11), 1);

        List<WeeklyEffortModel.Week> weeks = weeks(LocalDate.of(2026, 10, 11), LONG_AGO, 2);

        assertThat(weeks).hasSize(2);
        assertThat(weeks.get(0).start()).isEqualTo(LocalDate.of(2026, 9, 28));
        assertThat(weeks.get(0).end()).isEqualTo(LocalDate.of(2026, 10, 4));
        assertThat(weeks.get(0).total()).isEqualTo(100);
        assertThat(weeks.get(0).runs()).isEqualTo(1);
        assertThat(weeks.get(1).start()).isEqualTo(MONDAY);
        assertThat(weeks.get(1).start().getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(weeks.get(1).end()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(weeks.get(1).total()).isEqualTo(100);
        assertThat(weeks.get(1).runs()).isEqualTo(3);
    }

    @Test
    void theUsualRangeIsTheBandAroundTheMeanOfTheThreeWeeksBefore() {
        weekOf(3, 300);
        weekOf(2, 350);
        weekOf(1, 400);
        weekOf(0, 330);

        List<WeeklyEffortModel.Week> weeks = weeks(LocalDate.of(2026, 10, 11), LONG_AGO, 1);

        WeeklyEffortModel.Range range = weeks.get(0).range();
        assertThat(range.average()).isCloseTo(350, within(1e-9));
        assertThat(range.low()).isCloseTo(280, within(1e-9));
        assertThat(range.high()).isCloseTo(420, within(1e-9));
        assertThat(weeks.get(0).status()).isEqualTo(WeeklyEffortModel.Status.WITHIN);
    }

    @Test
    void aWeekThatEndedIsBelowWithinOrAboveAndTheEdgesAreWithin() {
        weekOf(3, 300);
        weekOf(2, 300);
        weekOf(1, 300);   // the range is 240 to 360

        for (Object[] row : new Object[][] {{239.9, WeeklyEffortModel.Status.BELOW}, {240.0, WeeklyEffortModel.Status.WITHIN},
                {300.0, WeeklyEffortModel.Status.WITHIN}, {360.0, WeeklyEffortModel.Status.WITHIN},
                {360.1, WeeklyEffortModel.Status.ABOVE}}) {
            effort.put(MONDAY.plusDays(1), (Double) row[0]);
            runs.put(MONDAY.plusDays(1), 1);
            // On Monday 12 Oct the week of 5 Oct has ended and is the older of the two weeks returned.
            WeeklyEffortModel.Week week = weeks(LocalDate.of(2026, 10, 12), LONG_AGO, 2).get(0);
            assertThat(week.start()).isEqualTo(MONDAY);
            assertThat(week.complete()).isTrue();
            assertThat(week.status()).as("total %s", row[0]).isEqualTo(row[1]);
        }
    }

    @Test
    void aWeekStillGoingCannotBeBelowSoItIsBuildingUntilItReachesTheRange() {
        weekOf(3, 300);
        weekOf(2, 300);
        weekOf(1, 300);   // the range is 240 to 360

        effort.put(MONDAY.plusDays(1), 100.0);
        assertThat(weeks(TODAY_THURSDAY, LONG_AGO, 1).get(0).status()).isEqualTo(WeeklyEffortModel.Status.BUILDING);
        assertThat(weeks(TODAY_THURSDAY, LONG_AGO, 1).get(0).complete()).isFalse();

        effort.put(MONDAY.plusDays(1), 250.0);
        assertThat(weeks(TODAY_THURSDAY, LONG_AGO, 1).get(0).status()).isEqualTo(WeeklyEffortModel.Status.WITHIN);

        effort.put(MONDAY.plusDays(1), 400.0);
        assertThat(weeks(TODAY_THURSDAY, LONG_AGO, 1).get(0).status()).isEqualTo(WeeklyEffortModel.Status.ABOVE);
    }

    @Test
    void sundayIsStillTheLastDayOfTheWeekAndMondayStartsANewOne() {
        weekOf(3, 300);
        weekOf(2, 300);
        weekOf(1, 300);
        weekOf(0, 100);

        assertThat(weeks(LocalDate.of(2026, 10, 11), LONG_AGO, 1).get(0).complete()).isFalse();
        List<WeeklyEffortModel.Week> mondayWeeks = weeks(LocalDate.of(2026, 10, 12), LONG_AGO, 2);
        assertThat(mondayWeeks.get(0).complete()).isTrue();
        assertThat(mondayWeeks.get(1).start()).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(mondayWeeks.get(1).complete()).isFalse();
        assertThat(mondayWeeks.get(1).total()).isZero();
    }

    @Test
    void aWeekOffAfterTheFirstRunIsAWeekOfZeroInTheMean() {
        weekOf(3, 300);
        // the week 2 weeks back was a week off
        weekOf(1, 300);

        WeeklyEffortModel.Week week = weeks(LocalDate.of(2026, 10, 11), LONG_AGO, 1).get(0);

        assertThat(week.range().average()).isCloseTo(200, within(1e-9));
    }

    @Test
    void thereIsNoRangeUntilTheRunnerHasRunForThreeWeeksBeforeTheWeek() {
        weekOf(3, 300);
        weekOf(2, 300);
        weekOf(1, 300);
        weekOf(0, 300);

        // The first run is in the week 2 weeks back: the week 3 weeks back did not happen for this runner.
        LocalDate firstInWeekTwoBack = MONDAY.minusWeeks(2).plusDays(1);
        assertThat(weeks(LocalDate.of(2026, 10, 11), firstInWeekTwoBack, 1).get(0).range()).isNull();
        assertThat(weeks(LocalDate.of(2026, 10, 11), firstInWeekTwoBack, 1).get(0).status()).isEqualTo(WeeklyEffortModel.Status.NONE);

        // The first run is in the week 3 weeks back: that is enough, even if it was the last day of it.
        LocalDate lastDayOfWeekThreeBack = MONDAY.minusWeeks(3).plusDays(6);
        assertThat(weeks(LocalDate.of(2026, 10, 11), lastDayOfWeekThreeBack, 1).get(0).range()).isNotNull();
        assertThat(weeks(LocalDate.of(2026, 10, 11), lastDayOfWeekThreeBack.plusDays(1), 1).get(0).range()).isNull();
    }

    @Test
    void thereIsNoRangeWhenTheUsualWeekIsTooSmallToMeanAnything() {
        weekOf(3, 3);
        weekOf(2, 3);
        weekOf(1, 3);
        weekOf(0, 200);

        WeeklyEffortModel.Week week = weeks(LocalDate.of(2026, 10, 11), LONG_AGO, 1).get(0);

        assertThat(week.range()).isNull();
        assertThat(week.status()).isEqualTo(WeeklyEffortModel.Status.NONE);
    }

    @Test
    void weeksBeforeTheFirstRunAreLeftOutAndAnEmptyHistoryHasNoWeeks() {
        weekOf(1, 100);
        weekOf(0, 150);

        List<WeeklyEffortModel.Week> weeks = weeks(LocalDate.of(2026, 10, 11), MONDAY.minusWeeks(1).plusDays(1), 12);

        assertThat(weeks).extracting(WeeklyEffortModel.Week::start).containsExactly(MONDAY.minusWeeks(1), MONDAY);
        assertThat(weeks(TODAY_THURSDAY, null, 12)).isEmpty();
        assertThat(weeks(TODAY_THURSDAY, LONG_AGO, 0)).isEmpty();
    }

    @Test
    void theNewestWeekIsLastAndTheCountBoundsTheList() {
        for (int back = 0; back < 10; back++) {
            weekOf(back, 100);
        }

        List<WeeklyEffortModel.Week> weeks = weeks(LocalDate.of(2026, 10, 11), LONG_AGO, 6);

        assertThat(weeks).hasSize(6);
        assertThat(weeks.get(5).start()).isEqualTo(MONDAY);
        assertThat(weeks.get(0).start()).isEqualTo(MONDAY.minusWeeks(5));
        assertThat(weeks).extracting(WeeklyEffortModel.Week::start).isSorted();
    }

    @Test
    void theBandIsAParameter() {
        weekOf(3, 100);
        weekOf(2, 100);
        weekOf(1, 100);
        weekOf(0, 100);

        WeeklyEffortModel.Range wide = WeeklyEffortModel.weeks(effort, runs, LocalDate.of(2026, 10, 11), LONG_AGO, 1, 0.5).get(0).range();

        assertThat(wide.low()).isCloseTo(50, within(1e-9));
        assertThat(wide.high()).isCloseTo(150, within(1e-9));
    }

    @Test
    void unusableDaysAreIgnored() {
        weekOf(3, 100);
        weekOf(2, 100);
        weekOf(1, 100);
        effort.put(MONDAY.plusDays(2), Double.NaN);
        effort.put(MONDAY.plusDays(3), -40.0);
        runs.put(MONDAY.plusDays(3), -1);

        WeeklyEffortModel.Week week = weeks(LocalDate.of(2026, 10, 11), LONG_AGO, 1).get(0);

        assertThat(week.total()).isZero();
        assertThat(week.runs()).isZero();
    }
}
