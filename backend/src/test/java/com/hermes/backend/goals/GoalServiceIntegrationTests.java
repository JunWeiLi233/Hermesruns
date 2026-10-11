package com.hermes.backend.goals;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.coaching.ActivityTrainingMetrics;
import com.hermes.backend.coaching.ActivityTrainingMetricsRepository;
import com.hermes.backend.coaching.TrainingLogRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Goals against a real schema: what each metric adds up, which runs and which days count, what the period before looks
 * like, what a named run adds, and that only the runner's own goals and runs are ever read or changed.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:goals-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class GoalServiceIntegrationTests {

    /** Wednesday 7 October 2026, 16:00 UTC: the week of Monday the 5th, two full days gone. */
    private static final Instant NOW = Instant.parse("2026-10-07T16:00:00Z");

    @Autowired private GoalRepository goals;
    @Autowired private TrainingLogRepository rows;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private RunnerRepository runners;
    @Autowired private TrainingZonesService zones;

    private GoalService service() {
        return new GoalService(goals, rows, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private Runner runner(String timeZone) {
        Runner runner = new Runner("goals-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, LocalDateTime start, double km, int seconds, Double climb) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(start);
        run.setMovingTimeSeconds(seconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000.0);
        run.setTotalElevationGain(climb);
        return activities.saveAndFlush(run);
    }

    private Activity run(Runner owner, int month, int day, double km) {
        return run(owner, LocalDateTime.of(2026, month, day, 12, 0), km, (int) Math.round(km * 300), km * 10);
    }

    /** The shared dataset: see the arithmetic in each test. */
    private Runner runnerWithAYearOfRuns() {
        Runner owner = runner(null);
        run(owner, 3, 14, 40);                   // this year only
        run(owner, 9, 30, 30);                   // last month, last week
        run(owner, 10, 1, 12);                   // this month
        run(owner, 10, 4, 21);                   // Sunday: this month, last week
        run(owner, 10, 5, 10);                   // Monday
        run(owner, 10, 6, 5);                    // Tuesday
        run(owner, 10, 7, 8);                    // today
        run(owner, 10, 9, 99);                   // Friday: not here yet, never counted
        run(owner, LocalDateTime.of(2025, 12, 31, 12, 0), 7, 2100, 70.0);   // last year
        return owner;
    }

    private static GoalService.GoalView only(GoalService.GoalsResponse response) {
        assertThat(response.goals()).hasSize(1);
        return response.goals().get(0);
    }

    @Test
    void aRunnerWithNoGoalsGetsAnEmptyListAndTheChoicesTheyHave() {
        GoalService.GoalsResponse response = service().list(runner(null), null);

        assertThat(response.goals()).isEmpty();
        assertThat(response.today()).isEqualTo(LocalDate.of(2026, 10, 7));
        assertThat(response.periods()).containsExactly("WEEK", "MONTH", "YEAR");
        assertThat(response.metrics()).containsExactly("DISTANCE", "TIME", "COUNT", "ELEVATION");
        assertThat(response.maxTarget()).containsEntry("DISTANCE", 100_000.0).containsEntry("COUNT", 10_000.0);
    }

    @Test
    void aWeeklyDistanceGoalAddsUpTheWeeksRunsTodayIncludedAndNothingFromTheFuture() {
        Runner owner = runnerWithAYearOfRuns();
        GoalService service = service();

        GoalService.GoalView week = only(service.create(owner, "WEEK", "DISTANCE", 70));

        assertThat(week.period()).isEqualTo("WEEK");
        assertThat(week.metric()).isEqualTo("DISTANCE");
        assertThat(week.unit()).isEqualTo("km");
        assertThat(week.target()).isEqualTo(70.0);
        assertThat(week.periodStart()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(week.periodEnd()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(week.progress()).as("10 + 5 + 8").isEqualTo(23.0);
        assertThat(week.remaining()).isEqualTo(47.0);
        assertThat(week.percent()).isEqualTo(32);
        assertThat(week.daysTotal()).isEqualTo(7);
        assertThat(week.daysLeft()).isEqualTo(5);
        assertThat(week.doneByNow()).isEqualTo(15.0);
        assertThat(week.expectedByNow()).isEqualTo(20.0);
        assertThat(week.status()).as("15 against 20 expected").isEqualTo("behind");
        assertThat(week.neededPerDay()).isEqualTo(9.4);
        assertThat(week.reached()).isFalse();
        assertThat(week.previous().start()).isEqualTo(LocalDate.of(2026, 9, 28));
        assertThat(week.previous().end()).isEqualTo(LocalDate.of(2026, 10, 4));
        assertThat(week.previous().progress()).as("30 + 12 + 21: the 30th, the 1st and the 4th").isEqualTo(63.0);
        assertThat(week.previous().reached()).isFalse();
        assertThat(week.thisRun()).isNull();
    }

    @Test
    void aMonthlyAndAYearlyGoalAddUpTheirOwnPeriods() {
        Runner owner = runnerWithAYearOfRuns();
        GoalService service = service();
        service.create(owner, "MONTH", "DISTANCE", 100);

        GoalService.GoalsResponse both = service.create(owner, "YEAR", "DISTANCE", 1000);

        GoalService.GoalView month = both.goals().get(0);
        GoalService.GoalView year = both.goals().get(1);
        assertThat(month.progress()).as("12 + 21 + 10 + 5 + 8").isEqualTo(56.0);
        assertThat(month.previous().progress()).as("September: the 30 km of the 30th").isEqualTo(30.0);
        assertThat(month.daysTotal()).isEqualTo(31);
        assertThat(month.daysLeft()).isEqualTo(25);
        assertThat(year.progress()).as("40 + 30 + 12 + 21 + 10 + 5 + 8").isEqualTo(126.0);
        assertThat(year.previous().start()).isEqualTo(LocalDate.of(2025, 1, 1));
        assertThat(year.previous().progress()).as("last year's 7 km").isEqualTo(7.0);
        assertThat(year.daysTotal()).isEqualTo(365);
    }

    @Test
    void eachMetricAddsUpItsOwnThing() {
        Runner owner = runnerWithAYearOfRuns();
        GoalService service = service();
        service.create(owner, "WEEK", "TIME", 36000);
        service.create(owner, "WEEK", "COUNT", 5);

        GoalService.GoalsResponse all = service.create(owner, "WEEK", "ELEVATION", 500);

        assertThat(all.goals().get(0).progress()).as("300 s a km: 3000 + 1500 + 2400 moving seconds").isEqualTo(6900.0);
        assertThat(all.goals().get(0).unit()).isEqualTo("s");
        assertThat(all.goals().get(1).progress()).isEqualTo(3.0);
        assertThat(all.goals().get(1).unit()).isEqualTo("runs");
        assertThat(all.goals().get(2).progress()).as("100 + 50 + 80 m of climb").isEqualTo(230.0);
        assertThat(all.goals().get(2).unit()).isEqualTo("m");
        assertThat(all.goals().get(1).neededPerDay()).as("two runs in five days").isEqualTo(0.4);
    }

    @Test
    void aReachedGoalSaysSoAndHasNothingLeft() {
        Runner owner = runnerWithAYearOfRuns();

        GoalService.GoalView week = only(service().create(owner, "WEEK", "DISTANCE", 20));

        assertThat(week.reached()).isTrue();
        assertThat(week.status()).isEqualTo("reached");
        assertThat(week.percent()).isEqualTo(115);
        assertThat(week.remaining()).isZero();
        assertThat(week.neededPerDay()).isNull();
    }

    @Test
    void aRunnerWhoHasNotRunThisPeriodIsBehindNotAnError() {
        Runner owner = runner(null);

        GoalService.GoalView week = only(service().create(owner, "WEEK", "DISTANCE", 30));

        assertThat(week.progress()).isZero();
        assertThat(week.percent()).isZero();
        assertThat(week.status()).isEqualTo("behind");
        assertThat(week.previous().progress()).isZero();
        assertThat(week.previous().reached()).isFalse();
    }

    @Test
    void aRunOnTheRunnersOwnCalendarIsInTheWeekItIsOnThere() {
        // 12:00 UTC on Sunday the 4th is 01:00 on Monday the 5th in Auckland (UTC+13 in October), so it is this week there
        // and last week in London.
        LocalDateTime instant = LocalDateTime.of(2026, 10, 4, 12, 0);
        Runner inAuckland = runner("Pacific/Auckland");
        Runner inUtc = runner(null);
        run(inAuckland, instant, 9, 2700, null);
        run(inUtc, instant, 9, 2700, null);

        GoalService.GoalsResponse auckland = service().create(inAuckland, "WEEK", "DISTANCE", 50);
        GoalService.GoalsResponse utc = service().create(inUtc, "WEEK", "DISTANCE", 50);

        assertThat(auckland.timeZone()).isEqualTo("Pacific/Auckland");
        assertThat(auckland.today()).as("12:00 UTC on Wednesday is already 05:00 on Thursday there").isEqualTo(LocalDate.of(2026, 10, 8));
        assertThat(only(auckland).progress()).isEqualTo(9.0);
        assertThat(only(auckland).daysLeft()).isEqualTo(4);
        assertThat(only(utc).progress()).isZero();
        assertThat(only(utc).previous().progress()).isEqualTo(9.0);
    }

    @Test
    void theDayTheEffortRowNamesIsTheDayTheGoalUses() {
        Runner owner = runner(null);
        Activity late = run(owner, LocalDateTime.of(2026, 10, 4, 23, 30), 6, 1800, null);
        ActivityTrainingMetrics row = new ActivityTrainingMetrics(late, owner);
        row.setLocalDate(LocalDate.of(2026, 10, 5));
        row.setEffortScore(30.0);
        row.setEffortSource("HR_ZONES");
        row.setZonesUsed(zones.resolve(owner).zones());
        row.setModelVersion(1);
        row.setStale(false);
        row.setComputedAt(LocalDateTime.of(2026, 10, 6, 8, 0));
        metrics.saveAndFlush(row);

        GoalService.GoalView week = only(service().create(owner, "WEEK", "DISTANCE", 50));

        assertThat(week.progress()).isEqualTo(6.0);
    }

    @Test
    void aRunWithOnlyMetresAndADurationStillCounts() {
        Runner owner = runner(null);
        Activity bare = new Activity();
        bare.setRunner(owner);
        bare.setName("meters only");
        bare.setActivityType(ActivityType.RUN);
        bare.setProvider(ImportProvider.GARMIN);
        bare.setStartTime(LocalDateTime.of(2026, 10, 6, 7, 0));
        bare.setDistanceMeters(5000.0);
        bare.setDurationSeconds(1500L);
        activities.saveAndFlush(bare);
        GoalService service = service();
        service.create(owner, "WEEK", "DISTANCE", 50);

        GoalService.GoalsResponse both = service.create(owner, "WEEK", "TIME", 7200);

        assertThat(both.goals().get(0).progress()).isEqualTo(5.0);
        assertThat(both.goals().get(1).progress()).isEqualTo(1500.0);
    }

    @Test
    void onlyRunsCountAndOnlyTheRunnersOwn() {
        Runner owner = runner(null);
        Runner stranger = runner(null);
        run(owner, 10, 6, 5);
        Activity ride = run(owner, 10, 6, 40);
        ride.setActivityType(ActivityType.NON_RUN);
        activities.saveAndFlush(ride);
        run(stranger, 10, 6, 77);

        GoalService.GoalView week = only(service().create(owner, "WEEK", "DISTANCE", 50));

        assertThat(week.progress()).isEqualTo(5.0);
    }

    @Test
    void progressIsNeverStoredSoItFollowsTheRunsThatComeAndGo() {
        Runner owner = runner(null);
        GoalService service = service();
        service.create(owner, "WEEK", "DISTANCE", 50);
        assertThat(only(service.list(owner, null)).progress()).isZero();

        Activity added = run(owner, 10, 6, 11);
        assertThat(only(service.list(owner, null)).progress()).isEqualTo(11.0);

        activities.delete(added);
        activities.flush();
        assertThat(only(service.list(owner, null)).progress()).isZero();
    }

    @Test
    void aNamedRunSaysWhatItAddsToEachGoalItIsIn() {
        Runner owner = runnerWithAYearOfRuns();
        GoalService service = service();
        service.create(owner, "WEEK", "DISTANCE", 70);
        service.create(owner, "MONTH", "DISTANCE", 100);
        service.create(owner, "WEEK", "COUNT", 5);
        service.create(owner, "YEAR", "ELEVATION", 5000);
        Activity monday = activities.findAll().stream()
                .filter(a -> a.getRunner().getId().equals(owner.getId()) && LocalDateTime.of(2026, 10, 5, 12, 0).equals(a.getStartTime()))
                .findFirst().orElseThrow();
        Activity sunday = activities.findAll().stream()
                .filter(a -> a.getRunner().getId().equals(owner.getId()) && LocalDateTime.of(2026, 10, 4, 12, 0).equals(a.getStartTime()))
                .findFirst().orElseThrow();

        GoalService.GoalsResponse mondays = service.list(owner, monday.getId());
        GoalService.GoalsResponse sundays = service.list(owner, sunday.getId());

        assertThat(mondays.goals()).extracting(GoalService.GoalView::thisRun).containsExactly(10.0, 10.0, 1.0, 100.0);
        assertThat(sundays.goals()).extracting(GoalService.GoalView::thisRun)
                .as("Sunday the 4th is last week: in this month and this year, not this week")
                .containsExactly(null, 21.0, null, 210.0);
        assertThat(service.list(owner, null).goals()).extracting(GoalService.GoalView::thisRun).containsOnlyNulls();
    }

    @Test
    void aRunThatIsNotTheRunnersOrIsNotThereAddsNothing() {
        Runner owner = runner(null);
        Runner stranger = runner(null);
        run(owner, 10, 6, 5);
        Activity theirs = run(stranger, 10, 6, 9);
        GoalService service = service();
        service.create(owner, "WEEK", "DISTANCE", 50);

        assertThat(only(service.list(owner, theirs.getId())).thisRun()).isNull();
        assertThat(only(service.list(owner, 987654321L)).thisRun()).isNull();
        assertThat(only(service.list(owner, theirs.getId())).progress()).isEqualTo(5.0);
    }

    @Test
    void aRunWithNothingOfTheMetricAddsNothingToIt() {
        Runner owner = runner(null);
        Activity flat = run(owner, LocalDateTime.of(2026, 10, 6, 7, 0), 5, 1500, null);
        GoalService service = service();
        service.create(owner, "WEEK", "ELEVATION", 100);

        GoalService.GoalView week = only(service.list(owner, flat.getId()));

        assertThat(week.thisRun()).isNull();
        assertThat(week.progress()).isZero();
    }

    @Test
    void aRunnerHasOneGoalForEachPeriodAndMetricAndAnotherOfEitherIsFine() {
        Runner owner = runner(null);
        GoalService service = service();
        service.create(owner, "WEEK", "DISTANCE", 50);

        assertThatThrownBy(() -> service.create(owner, "WEEK", "DISTANCE", 60))
                .isInstanceOf(GoalService.GoalConflictException.class).hasMessageContaining("already");
        assertThat(service.create(owner, "MONTH", "DISTANCE", 200).goals()).hasSize(2);
        assertThat(service.create(owner, "WEEK", "COUNT", 4).goals()).hasSize(3);
        assertThat(goals.findByRunnerIdOrderByIdAsc(owner.getId())).extracting(Goal::getTarget).containsExactly(50.0, 200.0, 4.0);
    }

    @Test
    void twoRunnersMaySetTheSameGoal() {
        Runner first = runner(null);
        Runner second = runner(null);

        service().create(first, "WEEK", "DISTANCE", 50);

        assertThat(service().create(second, "WEEK", "DISTANCE", 80).goals()).hasSize(1);
        assertThat(only(service().list(first, null)).target()).isEqualTo(50.0);
    }

    @Test
    void whatIsNotAGoalIsRefusedAndNothingIsSaved() {
        Runner owner = runner(null);
        GoalService service = service();

        assertThatThrownBy(() -> service.create(owner, "DAY", "DISTANCE", 5)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("week, a month or a year");
        assertThatThrownBy(() -> service.create(owner, null, "DISTANCE", 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(owner, "WEEK", "PACE", 5)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("distance, time");
        assertThatThrownBy(() -> service.create(owner, "WEEK", null, 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(owner, "WEEK", "DISTANCE", 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(owner, "WEEK", "DISTANCE", -3)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(owner, "WEEK", "DISTANCE", "50")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(owner, "WEEK", "DISTANCE", 100_001)).isInstanceOf(IllegalArgumentException.class);
        assertThat(goals.findByRunnerIdOrderByIdAsc(owner.getId())).isEmpty();
    }

    @Test
    void changingATargetKeepsTheGoalAndRoundsTheNumber() {
        Runner owner = runner(null);
        GoalService service = service();
        Long id = only(service.create(owner, "WEEK", "DISTANCE", 50)).id();

        GoalService.GoalView changed = only(service.changeTarget(owner, id, 64.123));

        assertThat(changed.id()).isEqualTo(id);
        assertThat(changed.target()).isEqualTo(64.12);
        assertThat(changed.createdAt()).isBeforeOrEqualTo(changed.updatedAt());
    }

    @Test
    void aTargetThatIsRefusedLeavesTheOldOne() {
        Runner owner = runner(null);
        GoalService service = service();
        Long id = only(service.create(owner, "WEEK", "COUNT", 4)).id();

        assertThatThrownBy(() -> service.changeTarget(owner, id, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.changeTarget(owner, id, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.changeTarget(owner, id, 10_001)).isInstanceOf(IllegalArgumentException.class);

        assertThat(only(service.list(owner, null)).target()).isEqualTo(4.0);
    }

    @Test
    void aGoalThatIsNotTheRunnersCanNeitherBeChangedNorDeleted() {
        Runner owner = runner(null);
        Runner stranger = runner(null);
        GoalService service = service();
        Long id = only(service.create(owner, "WEEK", "DISTANCE", 50)).id();

        assertThatThrownBy(() -> service.changeTarget(stranger, id, 5)).isInstanceOf(GoalService.GoalNotFoundException.class);
        assertThatThrownBy(() -> service.delete(stranger, id)).isInstanceOf(GoalService.GoalNotFoundException.class);
        assertThatThrownBy(() -> service.changeTarget(owner, 987654321L, 5)).isInstanceOf(GoalService.GoalNotFoundException.class);
        assertThatThrownBy(() -> service.delete(owner, 987654321L)).isInstanceOf(GoalService.GoalNotFoundException.class);

        assertThat(only(service.list(owner, null)).target()).isEqualTo(50.0);
        assertThat(service.list(stranger, null).goals()).isEmpty();
    }

    @Test
    void deletingAGoalRemovesItAndLeavesTheOthers() {
        Runner owner = runner(null);
        GoalService service = service();
        Long weekly = only(service.create(owner, "WEEK", "DISTANCE", 50)).id();
        service.create(owner, "YEAR", "DISTANCE", 1000);

        GoalService.GoalsResponse after = service.delete(owner, weekly);

        assertThat(after.goals()).hasSize(1);
        assertThat(after.goals().get(0).period()).isEqualTo("YEAR");
        assertThat(goals.findById(weekly)).isEmpty();
    }

    @Test
    void aDeletedGoalCanBeSetAgainWithAnotherTarget() {
        Runner owner = runner(null);
        GoalService service = service();
        Long id = only(service.create(owner, "MONTH", "COUNT", 12)).id();
        service.delete(owner, id);

        assertThat(only(service.create(owner, "MONTH", "COUNT", 15)).target()).isEqualTo(15.0);
    }
}
