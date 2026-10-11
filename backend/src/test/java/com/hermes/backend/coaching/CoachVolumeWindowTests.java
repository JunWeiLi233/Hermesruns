package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "The last 7 days" is today and the six days before it, each run on the day it was run in the runner's time zone, whatever the
 * hour; a run with no date is not in it; and the figure is brought up to date when a day has passed (BUG-026). Home and Load
 * balance count a week the same way.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:coach-volume-window;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.official-course.startup-seed.enabled=false",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class CoachVolumeWindowTests {

    private static final ZoneId NEW_YORK = ZoneId.of("America/New_York");

    @Autowired private AutomatedCoachService coach;
    @Autowired private RunnerRepository runners;
    @Autowired private ActivityRepository activities;
    @Autowired private CoachRunnerStateRepository states;

    private Runner runner() {
        Runner runner = new Runner("window-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole("USER");
        runner.setTimeZone("America/New_York");
        return runners.saveAndFlush(runner);
    }

    /** A run of {@code km} that started at the given reading of the clock: UTC for a file run, the runner's own for a Strava run. */
    private void run(Runner owner, LocalDateTime start, boolean stravaApi, double km) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run");
        run.setActivityType(ActivityType.RUN);
        run.setProvider(stravaApi ? ImportProvider.STRAVA : ImportProvider.GARMIN);
        run.setStravaApiSourced(stravaApi);
        run.setStartTime(start);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000);
        run.setMovingTimeSeconds((int) (km * 330));
        run.setDurationSeconds((long) (km * 330));
        activities.saveAndFlush(run);
    }

    private static LocalDateTime utcOf(LocalDate day, int hour, int minute) {
        return day.atTime(hour, minute);
    }

    /** The reading of the UTC clock at which it is {@code hour}:{@code minute} on {@code day} in New York. */
    private static LocalDateTime utcWhenItIsInNewYork(LocalDate day, int hour, int minute) {
        return day.atTime(hour, minute).atZone(NEW_YORK).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    @Test
    void theLastSevenDaysAreCalendarDaysInTheRunnersZoneWhateverTheHour() {
        Runner owner = runner();
        LocalDate today = LocalDate.now(NEW_YORK);
        // Inside: the first day of the window at one minute past midnight and the last at 23:59, a Strava run and a file run.
        run(owner, today.minusDays(6).atTime(0, 1), true, 5.0);
        run(owner, utcWhenItIsInNewYork(today.minusDays(6), 0, 30), false, 3.0);
        run(owner, utcWhenItIsInNewYork(today, 12, 0), false, 2.0);
        // Outside: the day before the window, at 09:25 and at 23:59 (the first is "inside now minus seven days" by the clock).
        run(owner, today.minusDays(7).atTime(9, 25), true, 16.0);
        run(owner, today.minusDays(7).atTime(23, 59), true, 6.0);
        // A file run whose UTC date is inside the window but whose evening in New York is the day before it.
        run(owner, utcWhenItIsInNewYork(today.minusDays(7), 21, 30), false, 7.0);
        // A run with no start time has no day.
        run(owner, null, false, 4.0);

        coach.reaggregateRunner(owner.getId());

        CoachRunnerState state = states.findByRunner(owner).orElseThrow();
        assertThat(state.getVolumeKm7d()).isEqualTo(10.0);
    }

    @Test
    void theTwentyEightDayWindowIsByCalendarDaysToo() {
        Runner owner = runner();
        LocalDate today = LocalDate.now(NEW_YORK);
        run(owner, today.minusDays(27).atTime(6, 0), true, 10.0);
        run(owner, today.minusDays(28).atTime(23, 30), true, 12.0);
        run(owner, null, true, 9.0);

        coach.reaggregateRunner(owner.getId());

        assertThat(states.findByRunner(owner).orElseThrow().getVolumeKm28d()).isEqualTo(10.0);
    }

    @Test
    void aRunnerWithoutATimeZoneCountsUtcDays() {
        Runner owner = runner();
        owner.setTimeZone(null);
        runners.saveAndFlush(owner);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        run(owner, utcOf(today.minusDays(6), 0, 30), false, 8.0);
        run(owner, utcOf(today.minusDays(7), 23, 30), false, 9.0);

        coach.reaggregateRunner(owner.getId());

        assertThat(states.findByRunner(owner).orElseThrow().getVolumeKm7d()).isEqualTo(8.0);
    }

    @Test
    void theFigureIsWorkedOutAgainWhenADayHasPassedSinceItWas() {
        Runner owner = runner();
        run(owner, LocalDate.now(NEW_YORK).atTime(7, 0), true, 6.0);
        coach.reaggregateRunner(owner.getId());
        CoachRunnerState state = states.findByRunner(owner).orElseThrow();
        // Yesterday's figure, as it would stand after midnight: stale, and wrong.
        state.setVolumeKm7d(99.0);
        state.setLastAggregatedAt(LocalDateTime.now().minusDays(1));
        states.saveAndFlush(state);

        coach.getCoachStatePreservingSchedule(owner);

        assertThat(states.findByRunner(owner).orElseThrow().getVolumeKm7d()).isEqualTo(6.0);
    }

    @Test
    void aFigureWorkedOutTodayIsLeftAlone() {
        Runner owner = runner();
        run(owner, LocalDate.now(NEW_YORK).atTime(7, 0), true, 6.0);
        coach.reaggregateRunner(owner.getId());
        CoachRunnerState state = states.findByRunner(owner).orElseThrow();
        state.setVolumeKm7d(99.0);
        state.setLastAggregatedAt(LocalDateTime.now());
        states.saveAndFlush(state);

        coach.getCoachStatePreservingSchedule(owner);

        assertThat(states.findByRunner(owner).orElseThrow().getVolumeKm7d()).as("not worked out again within the day").isEqualTo(99.0);
    }
}
