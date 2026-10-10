package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.runner.HeartRateZones;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * The fitness series and the weekly effort against a real schema: the grouping of runs into the runner's days, whose
 * rows count, what "today" is for a runner in another time zone, and what is reported as not yet counted.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-series-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class TrainingSeriesServiceIntegrationTests {

    /** Saturday 10 October 2026, 16:00 UTC: noon in New York, 09:00 in Los Angeles, 05:00 on the 11th in Auckland. */
    private static final Instant NOW = Instant.parse("2026-10-10T16:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 10);

    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;
    @Autowired private TrainingZonesService zones;

    private TrainingSeriesService service() {
        return new TrainingSeriesService(metrics, zones, 42, 7, 0.2, 400, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private Runner runner(String timeZone) {
        Runner runner = new Runner("series-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, LocalDate day) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, java.time.LocalTime.NOON));
        run.setMovingTimeSeconds(1800);
        run.setDurationSeconds(1800L);
        run.setDistanceKm(5.0);
        run.setDistanceMeters(5000.0);
        return activities.saveAndFlush(run);
    }

    /** A run on a day, with its effort row as the run page would have stored it. */
    private ActivityTrainingMetrics effort(Runner owner, LocalDate day, double score, String source) {
        Activity run = run(owner, day);
        ActivityTrainingMetrics row = new ActivityTrainingMetrics(run, owner);
        row.setLocalDate(day);
        row.setEffortScore(score);
        row.setEffortSource(source);
        row.setZonesUsed(zones.resolve(owner).zones());
        row.setModelVersion(TrainingMetricsService.MODEL_VERSION);
        row.setStale(false);
        row.setComputedAt(LocalDateTime.of(2026, 10, 10, 8, 0));
        return metrics.saveAndFlush(row);
    }

    private ActivityTrainingMetrics effort(Runner owner, LocalDate day, double score) {
        return effort(owner, day, score, "HR_ZONES");
    }

    @Test
    void aRunnerWhoHasNotRunHasNoSeriesAndNoWeeks() {
        Runner owner = runner(null);

        TrainingSeriesService.SeriesResponse series = service().series(owner, null, null);
        TrainingSeriesService.WeeklyResponse weekly = service().weekly(owner, null);

        assertThat(series.status()).isEqualTo("none");
        assertThat(series.points()).isEmpty();
        assertThat(series.projection()).isEmpty();
        assertThat(series.current()).isNull();
        assertThat(series.runs()).isZero();
        assertThat(series.pendingRuns()).isZero();
        assertThat(series.historyDays()).isZero();
        assertThat(series.today()).isEqualTo(TODAY);
        assertThat(series.to()).isEqualTo(TODAY);
        assertThat(series.from()).isEqualTo(TODAY.minusDays(179));
        assertThat(weekly.weeks()).isEmpty();
        assertThat(weekly.bandPercent()).isEqualTo(20);
    }

    @Test
    void fitnessFatigueAndFormFollowTheDailyEffortAndTwoRunsOnADayAreOneDay() {
        Runner owner = runner(null);
        LocalDate first = TODAY.minusDays(30);
        effort(owner, first, 100);
        effort(owner, first.plusDays(2), 60);
        effort(owner, first.plusDays(2), 40);     // the same day: 100 in all
        effort(owner, first.plusDays(10), 80);

        TrainingSeriesService.SeriesResponse series = service().series(owner, first, TODAY);

        // The same recursion written out longhand, over the 31 days.
        double slow = Math.exp(-1.0 / 42);
        double fast = Math.exp(-1.0 / 7);
        double fitness = 0;
        double fatigue = 0;
        assertThat(series.points()).hasSize(31);
        for (int i = 0; i <= 30; i++) {
            double load = i == 0 ? 100 : i == 2 ? 100 : i == 10 ? 80 : 0;
            fitness = fitness * slow + load * (1 - slow);
            fatigue = fatigue * fast + load * (1 - fast);
            TrainingSeriesService.Point point = series.points().get(i);
            assertThat(point.date()).isEqualTo(first.plusDays(i));
            assertThat(point.load()).isEqualTo(load);
            assertThat(point.fitness()).isCloseTo(fitness, within(0.05));
            assertThat(point.fatigue()).isCloseTo(fatigue, within(0.05));
            assertThat(point.form()).isCloseTo(fitness - fatigue, within(0.1));
        }
        assertThat(series.status()).isEqualTo("ready");
        assertThat(series.historyDays()).isEqualTo(31);
        assertThat(series.runs()).isEqualTo(4);
        assertThat(series.current().date()).isEqualTo(TODAY);
        assertThat(series.current().fitness()).isEqualTo(series.points().get(30).fitness());
        assertThat(series.current().fitnessChange7d())
                .isCloseTo(series.points().get(30).fitness() - series.points().get(23).fitness(), within(0.11));
    }

    @Test
    void theWindowStartsAtTheFirstRunAndAsksForNothingBeforeIt() {
        Runner owner = runner(null);
        effort(owner, TODAY.minusDays(20), 90);

        TrainingSeriesService.SeriesResponse series = service().series(owner, TODAY.minusDays(100), TODAY);

        assertThat(series.from()).isEqualTo(TODAY.minusDays(100));
        assertThat(series.points().get(0).date()).isEqualTo(TODAY.minusDays(20));
        assertThat(series.points()).hasSize(21);

        TrainingSeriesService.SeriesResponse beforeAnyRun = service().series(owner, TODAY.minusDays(60), TODAY.minusDays(30));
        assertThat(beforeAnyRun.points()).isEmpty();
        assertThat(beforeAnyRun.current()).isNull();
        assertThat(beforeAnyRun.status()).isEqualTo("ready");
    }

    @Test
    void theStatusIsBuildingUntilTheFirstRunIsTwoWeeksOld() {
        Runner owner = runner(null);
        assertThat(service().series(owner, null, null).status()).isEqualTo("none");

        effort(owner, TODAY.minusDays(12), 80);
        assertThat(service().series(owner, null, null).status()).isEqualTo("building");
        assertThat(service().series(owner, null, null).historyDays()).isEqualTo(13);

        Runner older = runner(null);
        effort(older, TODAY.minusDays(13), 80);
        assertThat(service().series(older, null, null).status()).isEqualTo("ready");
        assertThat(service().series(older, null, null).historyDays()).isEqualTo(14);
    }

    @Test
    void theWindowNeverEndsAfterTodayAndOnlyAWindowEndingTodayHasARestProjection() {
        Runner owner = runner(null);
        effort(owner, TODAY.minusDays(40), 100);
        effort(owner, TODAY.minusDays(2), 100);

        TrainingSeriesService.SeriesResponse toTheFuture = service().series(owner, TODAY.minusDays(5), TODAY.plusDays(30));
        assertThat(toTheFuture.to()).isEqualTo(TODAY);
        assertThat(toTheFuture.points()).hasSize(6);
        assertThat(toTheFuture.projection()).hasSize(14);
        assertThat(toTheFuture.projection().get(0).date()).isEqualTo(TODAY.plusDays(1));
        assertThat(toTheFuture.projection().get(13).date()).isEqualTo(TODAY.plusDays(14));
        TrainingSeriesService.Point lastPoint = toTheFuture.points().get(5);
        assertThat(toTheFuture.projection().get(0).fitness()).isCloseTo(lastPoint.fitness() * Math.exp(-1.0 / 42), within(0.1));
        assertThat(toTheFuture.projection().get(13).fatigue()).isLessThan(toTheFuture.projection().get(0).fatigue());

        TrainingSeriesService.SeriesResponse yesterday = service().series(owner, TODAY.minusDays(5), TODAY.minusDays(1));
        assertThat(yesterday.projection()).isEmpty();
        assertThat(yesterday.points()).hasSize(5);
    }

    @Test
    void aWindowThatRunsBackwardsOrIsTooLongIsRefused() {
        Runner owner = runner(null);

        assertThatThrownBy(() -> service().series(owner, TODAY, TODAY.minusDays(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service().series(owner, TODAY.plusDays(1), null))
                .as("a first day after today has nothing before it").isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service().series(owner, TODAY.minusDays(400), TODAY))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("400");
        assertThat(service().series(owner, TODAY.minusDays(399), TODAY).from()).isEqualTo(TODAY.minusDays(399));
    }

    @Test
    void todayIsTheRunnersOwnDayNotTheServers() {
        Runner auckland = runner("Pacific/Auckland");
        Runner losAngeles = runner("America/Los_Angeles");
        Runner nowhere = runner("Not/AZone");
        Runner unset = runner(null);

        assertThat(service().series(auckland, null, null).today()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(service().series(losAngeles, null, null).today()).isEqualTo(LocalDate.of(2026, 10, 10));
        assertThat(service().series(nowhere, null, null).today()).isEqualTo(LocalDate.of(2026, 10, 10));
        assertThat(service().series(unset, null, null).timeZone()).isEqualTo("Z");
        assertThat(service().series(auckland, null, null).timeZone()).isEqualTo("Pacific/Auckland");
        assertThat(service().weekly(auckland, null).today()).isEqualTo(LocalDate.of(2026, 10, 11));
    }

    @Test
    void anotherRunnersRunsNeverReachThisRunnersNumbers() {
        Runner mine = runner(null);
        Runner theirs = runner(null);
        effort(mine, TODAY.minusDays(30), 100);
        for (int i = 0; i < 30; i++) {
            effort(theirs, TODAY.minusDays(i), 500, "PERCEIVED");
        }

        TrainingSeriesService.SeriesResponse series = service().series(mine, TODAY.minusDays(30), TODAY);

        assertThat(series.runs()).isEqualTo(1);
        assertThat(series.sources()).containsOnlyKeys("HR_ZONES");
        assertThat(series.points()).extracting(TrainingSeriesService.Point::load)
                .filteredOn(load -> load > 0).containsExactly(100.0);
        assertThat(series.points().get(0).fitness()).isCloseTo(100 * (1 - Math.exp(-1.0 / 42)), within(0.1));
        assertThat(series.historyDays()).isEqualTo(31);
        assertThat(service().weekly(mine, 4).weeks()).allSatisfy(week -> assertThat(week.total()).isLessThan(500));
    }

    @Test
    void theSourcesCountTheRunsOfTheWindowByWhereTheirEffortCameFrom() {
        Runner owner = runner(null);
        effort(owner, TODAY.minusDays(30), 100, "HR_ZONES");
        effort(owner, TODAY.minusDays(20), 90, "HR_ZONES");
        effort(owner, TODAY.minusDays(10), 70, "PERCEIVED");
        effort(owner, TODAY.minusDays(100), 70, "PACE_MODEL");      // outside the window

        TrainingSeriesService.SeriesResponse series = service().series(owner, TODAY.minusDays(60), TODAY);

        assertThat(series.sources()).containsEntry("HR_ZONES", 2L).containsEntry("PERCEIVED", 1L).doesNotContainKey("PACE_MODEL");
        assertThat(series.runs()).isEqualTo(3);
        assertThat(series.sources().keySet()).as("most common first").first().isEqualTo("HR_ZONES");
    }

    @Test
    void aRunWithNoEffortYetAndARowOutOfDateAreReportedAsPending() {
        Runner owner = runner(null);
        effort(owner, TODAY.minusDays(30), 100);
        assertThat(service().series(owner, null, null).pendingRuns()).isZero();

        run(owner, TODAY.minusDays(3));    // never analysed
        assertThat(service().series(owner, null, null).pendingRuns()).isEqualTo(1);
        assertThat(service().weekly(owner, null).pendingRuns()).isEqualTo(1);

        ActivityTrainingMetrics flagged = effort(owner, TODAY.minusDays(2), 50);
        flagged.setStale(true);
        metrics.saveAndFlush(flagged);
        assertThat(service().series(owner, null, null).pendingRuns()).isEqualTo(2);

        ActivityTrainingMetrics oldZones = effort(owner, TODAY.minusDays(1), 50);
        HeartRateZones current = zones.resolve(owner).zones();
        oldZones.setZonesUsed(new HeartRateZones(current.maxHeartRate() + 5,
                new int[] {current.boundary(0), current.boundary(1), current.boundary(2), current.boundary(3)}));
        metrics.saveAndFlush(oldZones);
        assertThat(service().series(owner, null, null).pendingRuns()).isEqualTo(3);

        ActivityTrainingMetrics oldModel = effort(owner, TODAY, 50);
        oldModel.setModelVersion(TrainingMetricsService.MODEL_VERSION + 1);
        metrics.saveAndFlush(oldModel);
        assertThat(service().series(owner, null, null).pendingRuns()).isEqualTo(4);

        Runner other = runner(null);
        assertThat(service().series(other, null, null).pendingRuns()).as("another runner's backlog is theirs").isZero();
    }

    @Test
    void loadFromBeyondTheWarmUpIsNotReadAndLoadInsideItIs() {
        Runner far = runner(null);
        effort(far, TODAY.minusDays(750), 1e12);
        effort(far, TODAY.minusDays(20), 100);
        Runner near = runner(null);
        effort(near, TODAY.minusDays(700), 1e12);
        effort(near, TODAY.minusDays(20), 100);

        // The window starts 15 days ago, so the warm-up reaches back 730 days from there.
        double farFitness = service().series(far, TODAY.minusDays(15), TODAY).points().get(0).fitness();
        double nearFitness = service().series(near, TODAY.minusDays(15), TODAY).points().get(0).fitness();

        assertThat(farFitness).as("a run 765 days before the window start is not read").isLessThan(10);
        assertThat(nearFitness).as("one 715 days before it still is").isGreaterThan(1000);
    }

    @Test
    void weeklyEffortSumsTheRunnersWeeksAndSetsThemAgainstTheirOwnRange() {
        Runner owner = runner(null);
        LocalDate monday = LocalDate.of(2026, 10, 5);    // the week that is going on: today is Saturday 10 October
        for (int back = 1; back <= 3; back++) {          // the first run is in the week 3 weeks back
            effort(owner, monday.minusWeeks(back).plusDays(1), 300);
        }
        effort(owner, monday.plusDays(1), 150);
        effort(owner, monday.plusDays(3), 160);          // 310 so far this week

        TrainingSeriesService.WeeklyResponse weekly = service().weekly(owner, 5);

        TrainingSeriesService.WeekRow thisWeek = weekly.weeks().get(weekly.weeks().size() - 1);
        assertThat(thisWeek.start()).isEqualTo(monday);
        assertThat(thisWeek.end()).isEqualTo(monday.plusDays(6));
        assertThat(thisWeek.complete()).isFalse();
        assertThat(thisWeek.total()).isEqualTo(310);
        assertThat(thisWeek.runs()).isEqualTo(2);
        assertThat(thisWeek.range().average()).isEqualTo(300);
        assertThat(thisWeek.range().low()).isEqualTo(240);
        assertThat(thisWeek.range().high()).isEqualTo(360);
        assertThat(thisWeek.status()).isEqualTo("within");
        // The week that ended before the first run is left out; the week after the first run has no range yet.
        assertThat(weekly.weeks()).extracting(TrainingSeriesService.WeekRow::start)
                .containsExactly(monday.minusWeeks(3), monday.minusWeeks(2), monday.minusWeeks(1), monday);
        assertThat(weekly.weeks().subList(0, 3)).extracting(TrainingSeriesService.WeekRow::status).containsOnly("none");
        assertThat(weekly.weeks().get(0).total()).isEqualTo(300);
        assertThat(weekly.weeks().get(0).complete()).isTrue();
        assertThat(weekly.bandPercent()).isEqualTo(20);
    }

    /** A run of the given type on a day, analysed. */
    private ActivityTrainingMetrics typedEffort(Runner owner, LocalDate day, String runType) {
        ActivityTrainingMetrics row = effort(owner, day, 100);
        Activity run = row.getActivity();
        run.setRunType(runType);
        activities.saveAndFlush(run);
        return row;
    }

    @Test
    void theDaysOfRacesAreMarkedOncePerDayOldestFirstAndOnlyInsideTheWindow() {
        Runner owner = runner(null);
        Runner stranger = runner(null);
        typedEffort(owner, TODAY.minusDays(20), "RACE");
        typedEffort(owner, TODAY.minusDays(3), "RACE");
        typedEffort(owner, TODAY.minusDays(3), "RACE");           // two races on one day: one mark
        typedEffort(owner, TODAY.minusDays(10), "LONG_RUN");      // not a race
        effort(owner, TODAY.minusDays(5), 50);                    // no type at all
        typedEffort(owner, TODAY.minusDays(200), "RACE");         // before the 180 days shown
        typedEffort(stranger, TODAY.minusDays(1), "RACE");        // somebody else's

        assertThat(service().series(owner, null, null).raceDays()).containsExactly(TODAY.minusDays(20), TODAY.minusDays(3));
        assertThat(service().series(owner, TODAY.minusDays(25), TODAY.minusDays(10)).raceDays()).containsExactly(TODAY.minusDays(20));
        assertThat(service().series(owner, TODAY.minusDays(250), null).raceDays())
                .containsExactly(TODAY.minusDays(200), TODAY.minusDays(20), TODAY.minusDays(3));
        assertThat(service().series(stranger, null, null).raceDays()).containsExactly(TODAY.minusDays(1));
        assertThat(service().series(runner(null), null, null).raceDays()).isEmpty();
    }

    @Test
    void takingTheRaceTypeOffARunTakesItsMarkOffTheChart() {
        Runner owner = runner(null);
        ActivityTrainingMetrics race = typedEffort(owner, TODAY.minusDays(6), "RACE");
        assertThat(service().series(owner, null, null).raceDays()).containsExactly(TODAY.minusDays(6));

        Activity run = race.getActivity();
        run.setRunType(null);
        activities.saveAndFlush(run);

        assertThat(service().series(owner, null, null).raceDays()).isEmpty();
    }

    @Test
    void aRaceThatHasNotBeenAnalysedYetHasNoDayToMarkAndIsLeftOut() {
        Runner owner = runner(null);
        Activity pending = run(owner, TODAY.minusDays(4));
        pending.setRunType("RACE");
        activities.saveAndFlush(pending);

        assertThat(service().series(owner, null, null).raceDays()).isEmpty();
    }

    @Test
    void weeklyEffortRefusesACountOutsideOneToFiftyTwo() {
        Runner owner = runner(null);

        assertThatThrownBy(() -> service().weekly(owner, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service().weekly(owner, 53)).isInstanceOf(IllegalArgumentException.class);
        assertThat(service().weekly(owner, 52).weeks()).isEmpty();
        assertThat(service().weekly(owner, 1).weeks()).isEmpty();
    }

    @Test
    void settingsThatMakeNoSenseAreRefusedAtStartUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

        assertThatThrownBy(() -> new TrainingSeriesService(metrics, zones, 7, 7, 0.2, 400, clock)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TrainingSeriesService(metrics, zones, 7, 42, 0.2, 400, clock)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TrainingSeriesService(metrics, zones, 42, 7, 0, 400, clock)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new TrainingSeriesService(metrics, zones, 42, 7, 1.0, 400, clock)).isInstanceOf(IllegalArgumentException.class);
        assertThat(List.of(new TrainingSeriesService(metrics, zones, 42, 7, 0.25, 400, clock))).hasSize(1);
    }
}
