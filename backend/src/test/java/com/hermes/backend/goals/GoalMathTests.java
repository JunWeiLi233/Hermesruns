package com.hermes.backend.goals;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/** Where a goal stands, from the days the runner ran and the day it is: every number checked by hand. */
class GoalMathTests {

    /** Wednesday 7 October 2026: two full days (Monday, Tuesday) have gone in the week of the 5th. */
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 10, 7);

    private static Map<LocalDate, Double> days(Object... pairs) {
        Map<LocalDate, Double> byDay = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            byDay.put((LocalDate) pairs[i], ((Number) pairs[i + 1]).doubleValue());
        }
        return byDay;
    }

    private static LocalDate oct(int day) {
        return LocalDate.of(2026, 10, day);
    }

    @Test
    void aWeekInTheMiddleAddsUpWhatIsDoneAndWhatIsLeft() {
        GoalMath.Assessment week = GoalMath.assess(GoalPeriods.WEEK, 70, WEDNESDAY, days(oct(5), 10, oct(6), 5, oct(7), 8));

        assertThat(week.start()).isEqualTo(oct(5));
        assertThat(week.end()).isEqualTo(oct(11));
        assertThat(week.daysTotal()).isEqualTo(7);
        assertThat(week.daysLeft()).as("Wednesday to Sunday, today counted").isEqualTo(5);
        assertThat(week.progress()).isEqualTo(23.0);
        assertThat(week.doneByNow()).as("Monday and Tuesday, not today").isEqualTo(15.0);
        assertThat(week.remaining()).isEqualTo(47.0);
        assertThat(week.percent()).isEqualTo(32);
        assertThat(week.reached()).isFalse();
        assertThat(week.neededPerDay()).isCloseTo(9.4, within(1e-9));
        assertThat(week.expectedByNow()).as("70 x 2 / 7").isCloseTo(20.0, within(1e-9));
    }

    @Test
    void thePercentIsRoundedDownSoAnAlmostIsNotADone() {
        GoalMath.Assessment almost = GoalMath.assess(GoalPeriods.WEEK, 60, WEDNESDAY, days(oct(5), 59.99));
        GoalMath.Assessment exactly = GoalMath.assess(GoalPeriods.WEEK, 60, WEDNESDAY, days(oct(5), 60.0));
        GoalMath.Assessment past = GoalMath.assess(GoalPeriods.WEEK, 60, WEDNESDAY, days(oct(5), 90.0));

        assertThat(almost.percent()).isEqualTo(99);
        assertThat(almost.reached()).isFalse();
        assertThat(exactly.percent()).isEqualTo(100);
        assertThat(exactly.reached()).isTrue();
        assertThat(past.percent()).isEqualTo(150);
    }

    @Test
    void aReachedGoalHasNothingLeftAndNothingNeeded() {
        GoalMath.Assessment done = GoalMath.assess(GoalPeriods.WEEK, 30, WEDNESDAY, days(oct(5), 20, oct(7), 15));

        assertThat(done.reached()).isTrue();
        assertThat(done.status()).isEqualTo("reached");
        assertThat(done.remaining()).isZero();
        assertThat(done.neededPerDay()).isNull();
    }

    @Test
    void aGoalIsReachedByTodaysRunToo() {
        GoalMath.Assessment byToday = GoalMath.assess(GoalPeriods.WEEK, 30, WEDNESDAY, days(oct(5), 10, oct(7), 20));

        assertThat(byToday.reached()).isTrue();
        assertThat(byToday.doneByNow()).isEqualTo(10.0);
    }

    @ParameterizedTest(name = "done by the start of today: {0} -> {1}")
    @CsvSource({
            "22.0,   ahead",        // exactly a tenth over the 20 expected
            "21.99,  on_track",
            "20.0,   on_track",
            "18.0,   on_track",     // exactly a tenth under
            "17.99,  behind",
            "0.0,    behind"
    })
    void aRunnerIsAheadOnTrackOrBehindByAMarginOfATenthOfWhatIsExpectedByNow(double doneByNow, String expected) {
        // 70 for the week, two days gone: 20 expected. All of it was done on Monday; nothing today.
        GoalMath.Assessment week = GoalMath.assess(GoalPeriods.WEEK, 70, WEDNESDAY, days(oct(5), doneByNow));

        assertThat(week.expectedByNow()).isCloseTo(20.0, within(1e-9));
        assertThat(week.status()).isEqualTo(expected);
    }

    @Test
    void todaysRunIsNotCountedTowardsBeingAheadOrBehind() {
        GoalMath.Assessment withToday = GoalMath.assess(GoalPeriods.WEEK, 70, WEDNESDAY, days(oct(5), 15, oct(7), 6));
        GoalMath.Assessment without = GoalMath.assess(GoalPeriods.WEEK, 70, WEDNESDAY, days(oct(5), 15));

        assertThat(withToday.status()).isEqualTo(without.status()).isEqualTo("behind");
        assertThat(withToday.progress()).isEqualTo(21.0);
        assertThat(withToday.doneByNow()).isEqualTo(15.0);
    }

    @Test
    void onTheFirstDayOfAPeriodThereIsNothingToJudgeYet() {
        GoalMath.Assessment monday = GoalMath.assess(GoalPeriods.WEEK, 70, oct(5), days(oct(5), 12));
        GoalMath.Assessment nothing = GoalMath.assess(GoalPeriods.WEEK, 70, oct(5), Map.of());

        assertThat(monday.status()).isEqualTo("early");
        assertThat(monday.daysLeft()).isEqualTo(7);
        assertThat(monday.expectedByNow()).isZero();
        assertThat(monday.progress()).isEqualTo(12.0);
        assertThat(nothing.status()).isEqualTo("early");
        assertThat(nothing.percent()).isZero();
    }

    @Test
    void onTheLastDayOfAPeriodOneDayIsLeft() {
        GoalMath.Assessment sunday = GoalMath.assess(GoalPeriods.WEEK, 70, oct(11), days(oct(5), 50));

        assertThat(sunday.daysLeft()).isEqualTo(1);
        assertThat(sunday.neededPerDay()).isCloseTo(20.0, within(1e-9));
        assertThat(sunday.daysTotal()).isEqualTo(7);
    }

    @Test
    void aMonthIsJudgedOverItsOwnLength() {
        LocalDate day15 = LocalDate.of(2026, 2, 15);
        GoalMath.Assessment february = GoalMath.assess(GoalPeriods.MONTH, 280, day15, days(LocalDate.of(2026, 2, 3), 100));

        assertThat(february.start()).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(february.end()).isEqualTo(LocalDate.of(2026, 2, 28));
        assertThat(february.daysTotal()).isEqualTo(28);
        assertThat(february.daysLeft()).as("the 15th to the 28th").isEqualTo(14);
        assertThat(february.expectedByNow()).as("280 x 14 / 28").isCloseTo(140.0, within(1e-9));
        assertThat(february.status()).as("100 against 140 expected").isEqualTo("behind");
        assertThat(february.neededPerDay()).isCloseTo(180.0 / 14, within(1e-9));
    }

    @Test
    void aYearIsJudgedOverItsOwnLengthLeapYearsIncluded() {
        GoalMath.Assessment leap = GoalMath.assess(GoalPeriods.YEAR, 1000, LocalDate.of(2028, 7, 1), days(LocalDate.of(2028, 3, 1), 600));

        assertThat(leap.daysTotal()).isEqualTo(366);
        assertThat(leap.daysLeft()).as("1 July to 31 December").isEqualTo(184);
        assertThat(leap.expectedByNow()).as("182 days gone, January to June").isCloseTo(1000.0 * 182 / 366, within(1e-9));
        assertThat(leap.status()).as("600 against about 497 expected").isEqualTo("ahead");
        assertThat(GoalMath.assess(GoalPeriods.YEAR, 1000, LocalDate.of(2026, 1, 1), Map.of()).status()).isEqualTo("early");
    }

    @Test
    void whatIsDoneAfterTodayIsNotCounted() {
        GoalMath.Assessment week = GoalMath.assess(GoalPeriods.WEEK, 70, WEDNESDAY, days(oct(5), 10, oct(8), 99));

        assertThat(week.progress()).isEqualTo(10.0);
    }

    @Test
    void thePeriodBeforeIsAddedUpAndJudgedAgainstTodaysTarget() {
        GoalMath.Assessment week = GoalMath.assess(GoalPeriods.WEEK, 40, WEDNESDAY,
                days(LocalDate.of(2026, 9, 26), 99, LocalDate.of(2026, 9, 28), 12, LocalDate.of(2026, 10, 4), 30, oct(5), 7));

        GoalMath.Previous before = week.previous();
        assertThat(before.start()).isEqualTo(LocalDate.of(2026, 9, 28));
        assertThat(before.end()).isEqualTo(oct(4));
        assertThat(before.progress()).as("Monday the 28th to Sunday the 4th, not the Saturday before and not this week").isEqualTo(42.0);
        assertThat(before.reached()).isTrue();

        GoalMath.Previous missed = GoalMath.assess(GoalPeriods.WEEK, 50, WEDNESDAY, days(LocalDate.of(2026, 9, 29), 42)).previous();
        assertThat(missed.reached()).isFalse();
    }

    @Test
    void thePreviousMonthAndYearAreTheCalendarOnes() {
        Map<LocalDate, Double> history = days(LocalDate.of(2026, 9, 1), 10, LocalDate.of(2026, 9, 30), 5,
                LocalDate.of(2025, 12, 31), 7, LocalDate.of(2025, 1, 1), 100, LocalDate.of(2024, 12, 31), 1000);

        assertThat(GoalMath.assess(GoalPeriods.MONTH, 15, WEDNESDAY, history).previous().progress()).isEqualTo(15.0);
        assertThat(GoalMath.assess(GoalPeriods.MONTH, 15, WEDNESDAY, history).previous().reached()).isTrue();
        assertThat(GoalMath.assess(GoalPeriods.YEAR, 500, WEDNESDAY, history).previous().start()).isEqualTo(LocalDate.of(2025, 1, 1));
        assertThat(GoalMath.assess(GoalPeriods.YEAR, 500, WEDNESDAY, history).previous().progress()).isEqualTo(107.0);
        assertThat(GoalMath.assess(GoalPeriods.YEAR, 500, WEDNESDAY, history).previous().reached()).isFalse();
    }

    @Test
    void theMonthBeforeJanuaryIsDecember() {
        GoalMath.Previous december = GoalMath.assess(GoalPeriods.MONTH, 10, LocalDate.of(2026, 1, 20), days(LocalDate.of(2025, 12, 25), 12)).previous();

        assertThat(december.start()).isEqualTo(LocalDate.of(2025, 12, 1));
        assertThat(december.end()).isEqualTo(LocalDate.of(2025, 12, 31));
        assertThat(december.progress()).isEqualTo(12.0);
    }

    @Test
    void aTenthIsTheBandEitherWay() {
        assertThat(GoalMath.BAND).isEqualTo(0.1);
    }
}
