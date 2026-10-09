package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityLocalDatesTests {

    private static Runner runnerIn(String timeZone) {
        Runner runner = new Runner();
        runner.setTimeZone(timeZone);
        return runner;
    }

    private static Activity run(LocalDateTime start, boolean stravaApi) {
        Activity activity = new Activity();
        activity.setStartTime(start);
        activity.setStravaApiSourced(stravaApi);
        return activity;
    }

    @Test
    void aFileRunIsReadAsUtcAndMovedToTheRunnersDay() {
        // 02:30 UTC on 1 October is the evening of 30 September in New York (UTC-4 in summer time).
        Activity evening = run(LocalDateTime.of(2026, 10, 1, 2, 30), false);

        assertThat(ActivityLocalDates.of(evening, runnerIn("America/New_York"))).isEqualTo(LocalDate.of(2026, 9, 30));
    }

    @Test
    void aFileRunCanLandOnTheNextDayEastOfGreenwich() {
        // 22:30 UTC on 30 September is already the morning of 1 October in Sydney (UTC+10, UTC+11 from October).
        Activity morning = run(LocalDateTime.of(2026, 9, 30, 22, 30), false);

        assertThat(ActivityLocalDates.of(morning, runnerIn("Australia/Sydney"))).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void aStravaApiRunAlreadyHoldsTheRunnersOwnClockSoItIsNotConverted() {
        Activity stravaRun = run(LocalDateTime.of(2026, 10, 1, 2, 30), true);

        assertThat(ActivityLocalDates.of(stravaRun, runnerIn("America/New_York"))).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(ActivityLocalDates.of(stravaRun, runnerIn("Australia/Sydney"))).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void withoutATimeZoneARunnerLivesInUtc() {
        Activity run = run(LocalDateTime.of(2026, 10, 1, 2, 30), false);

        assertThat(ActivityLocalDates.of(run, runnerIn(null))).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(ActivityLocalDates.of(run, runnerIn("  "))).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void anUnknownTimeZoneFallsBackToUtcInsteadOfFailing() {
        Activity run = run(LocalDateTime.of(2026, 10, 1, 2, 30), false);

        assertThat(ActivityLocalDates.of(run, runnerIn("Mars/Olympus_Mons"))).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void daylightSavingTimeIsAppliedByTheDateOfTheRun() {
        // The same 04:30 UTC: in winter New York is UTC-5, so it is 23:30 the day before; in summer it is UTC-4,
        // so it is 00:30 of the same day.
        Activity winter = run(LocalDateTime.of(2026, 11, 2, 4, 30), false);
        Activity summer = run(LocalDateTime.of(2026, 10, 2, 4, 30), false);

        assertThat(ActivityLocalDates.of(winter, runnerIn("America/New_York"))).isEqualTo(LocalDate.of(2026, 11, 1));
        assertThat(ActivityLocalDates.of(summer, runnerIn("America/New_York"))).isEqualTo(LocalDate.of(2026, 10, 2));
    }

    @Test
    void aRunWithNoStartTimeUsesTheDayItWasAdded() {
        Activity run = new Activity();
        run.setCreatedAt(LocalDateTime.of(2026, 10, 5, 23, 59));

        assertThat(ActivityLocalDates.of(run, runnerIn("Australia/Sydney"))).isEqualTo(LocalDate.of(2026, 10, 5));
    }
}
