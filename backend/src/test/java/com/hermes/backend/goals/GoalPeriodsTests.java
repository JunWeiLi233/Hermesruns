package com.hermes.backend.goals;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The three periods a goal can cover, on a calendar. */
class GoalPeriodsTests {

    @ParameterizedTest
    @ValueSource(strings = {"2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"})
    void everyDayOfAWeekIsInTheWeekFromMondayToSunday(String day) {
        LocalDate date = LocalDate.parse(day);

        assertThat(GoalPeriods.start(GoalPeriods.WEEK, date)).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(GoalPeriods.end(GoalPeriods.WEEK, date)).isEqualTo(LocalDate.of(2026, 10, 11));
    }

    @Test
    void aSundayEndsItsWeekAndTheNextMondayStartsAnother() {
        assertThat(GoalPeriods.start(GoalPeriods.WEEK, LocalDate.of(2026, 10, 11))).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(GoalPeriods.start(GoalPeriods.WEEK, LocalDate.of(2026, 10, 12))).isEqualTo(LocalDate.of(2026, 10, 12));
    }

    @Test
    void aWeekCanCrossAMonthAndAYear() {
        assertThat(GoalPeriods.start(GoalPeriods.WEEK, LocalDate.of(2027, 1, 1))).isEqualTo(LocalDate.of(2026, 12, 28));
        assertThat(GoalPeriods.end(GoalPeriods.WEEK, LocalDate.of(2026, 12, 30))).isEqualTo(LocalDate.of(2027, 1, 3));
    }

    @Test
    void aMonthIsTheCalendarMonthWhateverItsLength() {
        assertThat(GoalPeriods.start(GoalPeriods.MONTH, LocalDate.of(2026, 10, 17))).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(GoalPeriods.end(GoalPeriods.MONTH, LocalDate.of(2026, 10, 17))).isEqualTo(LocalDate.of(2026, 10, 31));
        assertThat(GoalPeriods.end(GoalPeriods.MONTH, LocalDate.of(2026, 9, 1))).isEqualTo(LocalDate.of(2026, 9, 30));
        assertThat(GoalPeriods.end(GoalPeriods.MONTH, LocalDate.of(2026, 2, 10))).isEqualTo(LocalDate.of(2026, 2, 28));
        assertThat(GoalPeriods.end(GoalPeriods.MONTH, LocalDate.of(2028, 2, 10))).isEqualTo(LocalDate.of(2028, 2, 29));
    }

    @Test
    void aYearIsTheCalendarYearLeapOrNot() {
        assertThat(GoalPeriods.start(GoalPeriods.YEAR, LocalDate.of(2026, 10, 17))).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(GoalPeriods.end(GoalPeriods.YEAR, LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(GoalPeriods.days(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31))).isEqualTo(365);
        assertThat(GoalPeriods.days(LocalDate.of(2028, 1, 1), LocalDate.of(2028, 12, 31))).isEqualTo(366);
    }

    @Test
    void thePeriodBeforeStartsWhereTheLastOneStarted() {
        assertThat(GoalPeriods.previousStart(GoalPeriods.WEEK, LocalDate.of(2026, 10, 7))).isEqualTo(LocalDate.of(2026, 9, 28));
        assertThat(GoalPeriods.previousStart(GoalPeriods.WEEK, LocalDate.of(2026, 10, 5))).isEqualTo(LocalDate.of(2026, 9, 28));
        assertThat(GoalPeriods.previousStart(GoalPeriods.MONTH, LocalDate.of(2026, 10, 7))).isEqualTo(LocalDate.of(2026, 9, 1));
        assertThat(GoalPeriods.previousStart(GoalPeriods.MONTH, LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2025, 12, 1));
        assertThat(GoalPeriods.previousStart(GoalPeriods.MONTH, LocalDate.of(2026, 3, 31))).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(GoalPeriods.previousStart(GoalPeriods.YEAR, LocalDate.of(2026, 10, 7))).isEqualTo(LocalDate.of(2025, 1, 1));
    }

    @Test
    void daysAreCountedFromTheFirstToTheLastBothIncluded() {
        assertThat(GoalPeriods.days(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 5))).isEqualTo(1);
        assertThat(GoalPeriods.days(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 11))).isEqualTo(7);
    }

    @Test
    void onlyThreeNamesAreValid() {
        assertThat(GoalPeriods.ALL).containsExactly("WEEK", "MONTH", "YEAR");
        for (String period : GoalPeriods.ALL) {
            assertThat(GoalPeriods.isValid(period)).isTrue();
        }
        for (String not : new String[] {null, "", "week", "DAY", "WEEK ", "QUARTER"}) {
            assertThat(GoalPeriods.isValid(not)).as("'%s'", not).isFalse();
        }
        assertThatThrownBy(() -> GoalPeriods.start("DAY", LocalDate.of(2026, 10, 5))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> GoalPeriods.end("DAY", LocalDate.of(2026, 10, 5))).isInstanceOf(IllegalArgumentException.class);
    }
}
