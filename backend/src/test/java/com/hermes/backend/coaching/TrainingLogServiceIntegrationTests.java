package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityTagRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.activity.RunLabelService;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The training log against a real schema: how runs fall into the runner's weeks and days (including their time zone), what the
 * week totals add up, the filters by run type and tags, whether older runs exist, and that only the runner's own runs show.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-log-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class TrainingLogServiceIntegrationTests {

    /** Saturday 10 October 2026, 16:00 UTC: the week of Monday the 5th. */
    private static final Instant NOW = Instant.parse("2026-10-10T16:00:00Z");
    private static final LocalDate THIS_MONDAY = LocalDate.of(2026, 10, 5);

    @Autowired private TrainingLogRepository rows;
    @Autowired private ActivityTagRepository tagRows;
    @Autowired private RunLabelService labelService;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private RunnerRepository runners;
    @Autowired private TrainingZonesService zones;

    private TrainingLogService service() {
        return service(NOW);
    }

    private TrainingLogService service(Instant now) {
        return new TrainingLogService(rows, tagRows, labelService, Clock.fixed(now, ZoneOffset.UTC));
    }

    private Runner runner(String timeZone) {
        Runner runner = new Runner("log-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, LocalDateTime start, double km, int seconds) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(start);
        run.setMovingTimeSeconds(seconds);
        run.setDurationSeconds((long) seconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000.0);
        return activities.saveAndFlush(run);
    }

    private Activity typed(Runner owner, LocalDateTime start, String runType) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(start);
        run.setMovingTimeSeconds(1800);
        run.setDistanceKm(5.0);
        run.setRunType(runType);
        return activities.saveAndFlush(run);
    }

    private void tag(Runner owner, Activity run, String... words) {
        List<String> given = List.of(words);
        labelService.apply(owner, run, new RunLabelService.Change(false, null, true, given), RunLabelService.cleanTags(given));
    }

    /** Files the run's effort under a day, as the run page's analysis would have. */
    private void analysed(Runner owner, Activity run, LocalDate day, double score) {
        ActivityTrainingMetrics row = new ActivityTrainingMetrics(run, owner);
        row.setLocalDate(day);
        row.setEffortScore(score);
        row.setEffortSource("HR_ZONES");
        row.setZonesUsed(zones.resolve(owner).zones());
        row.setModelVersion(TrainingMetricsService.MODEL_VERSION);
        row.setStale(false);
        row.setComputedAt(LocalDateTime.of(2026, 10, 10, 8, 0));
        metrics.saveAndFlush(row);
    }

    private static TrainingLogService.LogWeek weekOf(TrainingLogService.LogResponse log, LocalDate monday) {
        return log.weeks().stream().filter(week -> week.start().equals(monday)).findFirst().orElseThrow();
    }

    private static List<Long> idsIn(TrainingLogService.LogWeek week) {
        return week.days().stream().flatMap(day -> day.runs().stream()).map(TrainingLogService.LogRun::id).toList();
    }

    @Test
    void aRunnerWhoHasNotRunGetsTwelveEmptyWeeksNewestFirst() {
        TrainingLogService.LogResponse log = service().log(runner(null), null, null, null, null);

        assertThat(log.weeks()).hasSize(12);
        assertThat(log.weeks().get(0).start()).isEqualTo(THIS_MONDAY);
        assertThat(log.weeks().get(0).end()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(log.weeks().get(11).start()).isEqualTo(THIS_MONDAY.minusWeeks(11));
        assertThat(log.from()).isEqualTo(THIS_MONDAY.minusWeeks(11));
        assertThat(log.to()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(log.today()).isEqualTo(LocalDate.of(2026, 10, 10));
        assertThat(log.weeks()).allSatisfy(week -> {
            assertThat(week.runs()).isZero();
            assertThat(week.days()).isEmpty();
            assertThat(week.distanceKm()).isZero();
            assertThat(week.movingSeconds()).isZero();
            assertThat(week.effort()).isZero();
            assertThat(week.end()).isEqualTo(week.start().plusDays(6));
        });
        assertThat(log.olderRuns()).isFalse();
        assertThat(log.runTypes()).isEmpty();
        assertThat(log.tags()).isEmpty();
    }

    @Test
    void runsFallIntoTheirWeekAndDayWithTheTotalsOfEach() {
        Runner owner = runner(null);
        Activity sunday = run(owner, LocalDateTime.of(2026, 10, 4, 8, 0), 10.0, 3000);
        analysed(owner, sunday, LocalDate.of(2026, 10, 4), 50);
        Activity morning = run(owner, LocalDateTime.of(2026, 10, 5, 7, 0), 5.0, 1500);
        analysed(owner, morning, LocalDate.of(2026, 10, 5), 30);
        Activity evening = run(owner, LocalDateTime.of(2026, 10, 5, 18, 0), 3.0, 1000);
        Activity saturday = run(owner, LocalDateTime.of(2026, 10, 10, 9, 0), 8.0, 2400);
        analysed(owner, saturday, LocalDate.of(2026, 10, 10), 45);

        TrainingLogService.LogResponse log = service().log(owner, null, null, null, null);

        TrainingLogService.LogWeek thisWeek = log.weeks().get(0);
        assertThat(thisWeek.runs()).isEqualTo(3);
        assertThat(thisWeek.distanceKm()).isEqualTo(16.0);
        assertThat(thisWeek.movingSeconds()).isEqualTo(4900);
        assertThat(thisWeek.effort()).isEqualTo(75.0);
        assertThat(thisWeek.days()).extracting(TrainingLogService.LogDay::date)
                .containsExactly(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 10));
        assertThat(thisWeek.days().get(0).runs()).extracting(TrainingLogService.LogRun::id)
                .as("two runs on one day, earlier first").containsExactly(morning.getId(), evening.getId());

        TrainingLogService.LogWeek lastWeek = log.weeks().get(1);
        assertThat(lastWeek.start()).isEqualTo(LocalDate.of(2026, 9, 28));
        assertThat(lastWeek.runs()).isEqualTo(1);
        assertThat(lastWeek.distanceKm()).isEqualTo(10.0);
        assertThat(lastWeek.effort()).isEqualTo(50.0);
        assertThat(lastWeek.days()).extracting(TrainingLogService.LogDay::date).containsExactly(LocalDate.of(2026, 10, 4));
        assertThat(log.weeks().subList(2, 12)).allSatisfy(week -> assertThat(week.runs()).isZero());
    }

    @Test
    void aRunAsTheLogShowsIt() {
        Runner owner = runner(null);
        Activity hilly = run(owner, LocalDateTime.of(2026, 10, 6, 7, 0), 5.0, 1500);
        hilly.setTotalElevationGain(123.456);
        hilly.setRunType("WORKOUT");
        activities.saveAndFlush(hilly);
        analysed(owner, hilly, LocalDate.of(2026, 10, 6), 42.46);
        tag(owner, hilly, "Hill repeats", "dog");
        Activity plain = run(owner, LocalDateTime.of(2026, 10, 7, 7, 0), 4.0, 1200);

        TrainingLogService.LogWeek week = service().log(owner, null, null, null, null).weeks().get(0);

        TrainingLogService.LogRun shown = week.days().get(0).runs().get(0);
        assertThat(shown.id()).isEqualTo(hilly.getId());
        assertThat(shown.name()).isEqualTo(hilly.getName());
        assertThat(shown.startTime()).isEqualTo(LocalDateTime.of(2026, 10, 6, 7, 0));
        assertThat(shown.distanceKm()).isEqualTo(5.0);
        assertThat(shown.movingSeconds()).isEqualTo(1500);
        assertThat(shown.paceSecPerKm()).isEqualTo(300.0);
        assertThat(shown.effort()).isEqualTo(42.5);
        assertThat(shown.effortSource()).isEqualTo("HR_ZONES");
        assertThat(shown.elevationGainM()).isEqualTo(123.5);
        assertThat(shown.runType()).isEqualTo("WORKOUT");
        assertThat(shown.tags()).containsExactly("Hill repeats", "dog");
        assertThat(week.elevationGainM()).isEqualTo(123.5);

        TrainingLogService.LogRun notAnalysed = week.days().get(1).runs().get(0);
        assertThat(notAnalysed.id()).isEqualTo(plain.getId());
        assertThat(notAnalysed.effort()).as("not analysed yet").isNull();
        assertThat(notAnalysed.effortSource()).isNull();
        assertThat(notAnalysed.elevationGainM()).isNull();
        assertThat(notAnalysed.runType()).isNull();
        assertThat(notAnalysed.tags()).isEmpty();
        assertThat(week.effort()).as("a run without effort adds none").isEqualTo(42.5);
    }

    @Test
    void sundayNightAndMondayMorningAreDifferentWeeks() {
        Runner owner = runner(null);
        Activity lateSunday = run(owner, LocalDateTime.of(2026, 10, 4, 23, 59, 59), 5.0, 1500);
        Activity earlyMonday = run(owner, LocalDateTime.of(2026, 10, 5, 0, 0, 0), 5.0, 1500);

        TrainingLogService.LogResponse log = service().log(owner, null, null, null, null);

        assertThat(idsIn(log.weeks().get(0))).containsExactly(earlyMonday.getId());
        assertThat(idsIn(log.weeks().get(1))).containsExactly(lateSunday.getId());
    }

    @Test
    void aFileRunIsPlacedOnTheRunnersOwnCalendarNotUtc() {
        // 12:00 UTC on Sunday the 4th is 01:00 on Monday the 5th in Auckland (UTC+13 in October).
        LocalDateTime instant = LocalDateTime.of(2026, 10, 4, 12, 0);
        Runner inAuckland = runner("Pacific/Auckland");
        Runner inUtc = runner(null);
        Activity theirs = run(inAuckland, instant, 5.0, 1500);
        Activity ours = run(inUtc, instant, 5.0, 1500);

        TrainingLogService.LogResponse auckland = service().log(inAuckland, null, null, null, null);
        TrainingLogService.LogResponse utc = service().log(inUtc, null, null, null, null);

        assertThat(auckland.timeZone()).isEqualTo("Pacific/Auckland");
        assertThat(idsIn(auckland.weeks().get(0))).containsExactly(theirs.getId());
        assertThat(auckland.weeks().get(0).days().get(0).date()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(idsIn(utc.weeks().get(0))).isEmpty();
        assertThat(idsIn(utc.weeks().get(1))).containsExactly(ours.getId());
    }

    @Test
    void aStravaRunKeepsTheClockItWasRecordedOn() {
        Runner inAuckland = runner("Pacific/Auckland");
        Activity strava = run(inAuckland, LocalDateTime.of(2026, 10, 4, 12, 0), 5.0, 1500);
        strava.setStravaApiSourced(true);
        activities.saveAndFlush(strava);

        TrainingLogService.LogResponse log = service().log(inAuckland, null, null, null, null);

        assertThat(idsIn(log.weeks().get(0))).as("its start time is already the runner's local time").isEmpty();
        assertThat(log.weeks().get(1).days().get(0).date()).isEqualTo(LocalDate.of(2026, 10, 4));
    }

    @Test
    void theDayTheEffortRowNamesIsTheDayTheLogUses() {
        Runner owner = runner(null);
        Activity run = run(owner, LocalDateTime.of(2026, 10, 4, 23, 30), 5.0, 1500);
        analysed(owner, run, LocalDate.of(2026, 10, 5), 20);

        TrainingLogService.LogResponse log = service().log(owner, null, null, null, null);

        assertThat(idsIn(log.weeks().get(0))).containsExactly(run.getId());
        assertThat(idsIn(log.weeks().get(1))).isEmpty();
    }

    @Test
    void theWeekIsTheRunnersTodayWhenTheyAreAheadOfUtc() {
        // Sunday 12:00 UTC is already Monday the 12th in Auckland.
        Instant sundayNoon = Instant.parse("2026-10-11T12:00:00Z");
        Runner inAuckland = runner("Pacific/Auckland");
        Runner inUtc = runner(null);

        assertThat(service(sundayNoon).log(inAuckland, null, 1, null, null).weeks().get(0).start())
                .isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(service(sundayNoon).log(inUtc, null, 1, null, null).weeks().get(0).start()).isEqualTo(THIS_MONDAY);
    }

    @Test
    void aRunJustInsideTheOldestWeekOnTheRunnersCalendarIsKept() {
        // 12:00 UTC on 19 July 2026 is 00:00 on Monday 20 July in Auckland (UTC+12 in winter): the first day of the window.
        Runner inAuckland = runner("Pacific/Auckland");
        Activity edge = run(inAuckland, LocalDateTime.of(2026, 7, 19, 12, 0), 5.0, 1500);

        TrainingLogService.LogResponse log = service().log(inAuckland, null, null, null, null);

        assertThat(log.from()).isEqualTo(LocalDate.of(2026, 7, 20));
        assertThat(idsIn(log.weeks().get(11))).containsExactly(edge.getId());
        assertThat(log.olderRuns()).isFalse();
    }

    @Test
    void theNewestWeekIsTheWeekOfTheDayAskedForAndNeverAFutureOne() {
        Runner owner = runner(null);
        Activity september = run(owner, LocalDateTime.of(2026, 9, 16, 7, 0), 6.0, 1800);

        TrainingLogService.LogResponse past = service().log(owner, LocalDate.of(2026, 9, 20), 2, null, null);
        TrainingLogService.LogResponse future = service().log(owner, LocalDate.of(2026, 12, 25), 1, null, null);

        assertThat(past.weeks()).extracting(TrainingLogService.LogWeek::start)
                .containsExactly(LocalDate.of(2026, 9, 14), LocalDate.of(2026, 9, 7));
        assertThat(past.to()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(past.today()).as("today does not move").isEqualTo(LocalDate.of(2026, 10, 10));
        assertThat(idsIn(past.weeks().get(0))).containsExactly(september.getId());
        assertThat(future.weeks()).extracting(TrainingLogService.LogWeek::start).containsExactly(THIS_MONDAY);
    }

    @Test
    void oneWeekAndTwentySixWeeksAreAllowed() {
        Runner owner = runner(null);

        assertThat(service().log(owner, null, 1, null, null).weeks()).hasSize(1);
        assertThat(service().log(owner, null, 26, null, null).weeks()).hasSize(26);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, 27, 1000})
    void aNumberOfWeeksOutsideOneToTwentySixIsRefused(int weeks) {
        Runner owner = runner(null);

        assertThatThrownBy(() -> service().log(owner, null, weeks, null, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("1 to 26");
    }

    @Test
    void olderRunsAreReportedOnlyWhenThereAreSomeBeforeTheFirstWeek() {
        Runner none = runner(null);
        run(none, LocalDateTime.of(2026, 7, 21, 7, 0), 5.0, 1500);     // inside the first week
        Runner some = runner(null);
        run(some, LocalDateTime.of(2026, 7, 19, 7, 0), 5.0, 1500);     // the day before it

        assertThat(service().log(none, null, null, null, null).olderRuns()).isFalse();
        assertThat(service().log(some, null, null, null, null).olderRuns()).isTrue();
        assertThat(service().log(some, null, 26, null, null).olderRuns()).as("a longer window takes it in").isFalse();
    }

    @Test
    void aRunTypeFilterKeepsOnlyThatTypeAndTheTotalsFollow() {
        Runner owner = runner(null);
        Activity race = typed(owner, LocalDateTime.of(2026, 10, 10, 9, 0), "RACE");
        typed(owner, LocalDateTime.of(2026, 10, 6, 9, 0), "LONG_RUN");
        run(owner, LocalDateTime.of(2026, 10, 7, 9, 0), 5.0, 1500);

        TrainingLogService.LogResponse races = service().log(owner, null, null, "RACE", null);
        TrainingLogService.LogResponse all = service().log(owner, null, null, null, null);

        assertThat(idsIn(races.weeks().get(0))).containsExactly(race.getId());
        assertThat(races.weeks().get(0).runs()).isEqualTo(1);
        assertThat(races.weeks().get(0).distanceKm()).isEqualTo(5.0);
        assertThat(all.weeks().get(0).runs()).isEqualTo(3);
        assertThat(races.runTypes()).as("the filter lists what the runner uses, not what is left").containsExactly("RACE", "LONG_RUN");
        assertThat(service().log(owner, null, null, "WORKOUT", null).weeks().get(0).runs()).isZero();
    }

    @Test
    void aRunTypeThatIsNotOneOfTheThreeIsRefused() {
        Runner owner = runner(null);

        assertThatThrownBy(() -> service().log(owner, null, null, "ULTRA", null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("RACE");
        assertThatThrownBy(() -> service().log(owner, null, null, "race", null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aTagFilterNeedsTheRunToCarryEveryTagAskedForInAnyCase() {
        Runner owner = runner(null);
        Activity both = run(owner, LocalDateTime.of(2026, 10, 6, 7, 0), 5.0, 1500);
        tag(owner, both, "Hills", "Track");
        Activity hillsOnly = run(owner, LocalDateTime.of(2026, 10, 7, 7, 0), 5.0, 1500);
        tag(owner, hillsOnly, "hills");
        Activity trackOnly = run(owner, LocalDateTime.of(2026, 10, 8, 7, 0), 5.0, 1500);
        tag(owner, trackOnly, "Track");
        Activity untagged = run(owner, LocalDateTime.of(2026, 10, 9, 7, 0), 5.0, 1500);

        assertThat(idsIn(service().log(owner, null, null, null, List.of("HILLS")).weeks().get(0)))
                .containsExactly(both.getId(), hillsOnly.getId());
        assertThat(idsIn(service().log(owner, null, null, null, List.of("hills", "track")).weeks().get(0)))
                .containsExactly(both.getId());
        assertThat(idsIn(service().log(owner, null, null, null, List.of("  Hills  ")).weeks().get(0)))
                .containsExactly(both.getId(), hillsOnly.getId());
        assertThat(idsIn(service().log(owner, null, null, null, List.of("nothing")).weeks().get(0))).isEmpty();
        assertThat(idsIn(service().log(owner, null, null, null, List.of("", "  ")).weeks().get(0)))
                .as("blank words ask for nothing").containsExactly(both.getId(), hillsOnly.getId(), trackOnly.getId(), untagged.getId());
        assertThat(idsIn(service().log(owner, null, null, null, null).weeks().get(0))).hasSize(4);
    }

    @Test
    void theRunTypeAndTheTagsFiltersCombine() {
        Runner owner = runner(null);
        Activity raceWithTag = typed(owner, LocalDateTime.of(2026, 10, 10, 9, 0), "RACE");
        tag(owner, raceWithTag, "5k");
        Activity raceWithout = typed(owner, LocalDateTime.of(2026, 10, 9, 9, 0), "RACE");
        Activity taggedEasy = run(owner, LocalDateTime.of(2026, 10, 8, 9, 0), 5.0, 1500);
        tag(owner, taggedEasy, "5k");

        assertThat(idsIn(service().log(owner, null, null, "RACE", List.of("5k")).weeks().get(0))).containsExactly(raceWithTag.getId());
        assertThat(raceWithout.getId()).isNotNull();
    }

    @Test
    void theTagFilterListsTheRunnersTagsMostUsedFirstWithTheSpellingTheyUseMost() {
        Runner owner = runner(null);
        Activity first = run(owner, LocalDateTime.of(2026, 10, 6, 7, 0), 5.0, 1500);
        tag(owner, first, "Track", "easy");
        Activity second = run(owner, LocalDateTime.of(2026, 10, 7, 7, 0), 5.0, 1500);
        tag(owner, second, "track");
        Activity third = run(owner, LocalDateTime.of(2026, 10, 8, 7, 0), 5.0, 1500);
        tag(owner, third, "track");

        List<RunLabelService.TagUse> tags = service().log(owner, null, null, null, null).tags();

        assertThat(tags).extracting(RunLabelService.TagUse::tag).containsExactly("track", "easy");
        assertThat(tags).extracting(RunLabelService.TagUse::runs).containsExactly(3L, 1L);
    }

    @Test
    void theTagListIncludesTagsOnRunsOutsideTheWindowToo() {
        Runner owner = runner(null);
        Activity old = run(owner, LocalDateTime.of(2026, 1, 6, 7, 0), 5.0, 1500);
        tag(owner, old, "marathon block");

        TrainingLogService.LogResponse log = service().log(owner, null, null, null, null);

        assertThat(log.tags()).extracting(RunLabelService.TagUse::tag).containsExactly("marathon block");
        assertThat(log.weeks()).allSatisfy(week -> assertThat(week.runs()).isZero());
        assertThat(log.olderRuns()).isTrue();
    }

    @Test
    void olderRunsAreCountedAfterTheFiltersToo() {
        Runner owner = runner(null);
        Activity oldRace = typed(owner, LocalDateTime.of(2026, 3, 1, 9, 0), "RACE");
        tag(owner, oldRace, "Track");
        Activity oldPlain = run(owner, LocalDateTime.of(2026, 3, 2, 9, 0), 5.0, 1500);
        tag(owner, oldPlain, "hills");

        assertThat(service().log(owner, null, null, null, null).olderRuns()).isTrue();
        assertThat(service().log(owner, null, null, "RACE", null).olderRuns()).isTrue();
        assertThat(service().log(owner, null, null, "WORKOUT", null).olderRuns()).isFalse();
        assertThat(service().log(owner, null, null, null, List.of("track")).olderRuns()).isTrue();
        assertThat(service().log(owner, null, null, "RACE", List.of("hills")).olderRuns()).isFalse();
        assertThat(service().log(owner, null, null, null, List.of("nothing")).olderRuns()).isFalse();
    }

    @Test
    void onlyTheRunnersOwnRunsAndTagsAreEverRead() {
        Runner owner = runner(null);
        Runner stranger = runner(null);
        Activity mine = run(owner, LocalDateTime.of(2026, 10, 6, 7, 0), 5.0, 1500);
        tag(owner, mine, "mine");
        Activity theirs = typed(stranger, LocalDateTime.of(2026, 10, 6, 8, 0), "RACE");
        tag(stranger, theirs, "secret plan");
        run(stranger, LocalDateTime.of(2026, 3, 6, 8, 0), 5.0, 1500);

        TrainingLogService.LogResponse log = service().log(owner, null, null, null, null);

        assertThat(idsIn(log.weeks().get(0))).containsExactly(mine.getId());
        assertThat(log.tags()).extracting(RunLabelService.TagUse::tag).containsExactly("mine");
        assertThat(log.runTypes()).isEmpty();
        assertThat(log.olderRuns()).as("their older run is not mine").isFalse();
        assertThat(service().log(owner, null, null, "RACE", null).weeks().get(0).runs()).isZero();
        assertThat(service().log(owner, null, null, null, List.of("secret plan")).weeks().get(0).runs()).isZero();
    }

    @Test
    void onlyRunsAreLogged() {
        Runner owner = runner(null);
        Activity ride = run(owner, LocalDateTime.of(2026, 10, 6, 7, 0), 30.0, 3600);
        ride.setActivityType(ActivityType.NON_RUN);
        activities.saveAndFlush(ride);
        Activity unknown = run(owner, LocalDateTime.of(2026, 10, 7, 7, 0), 5.0, 1500);
        unknown.setActivityType(ActivityType.UNKNOWN);
        activities.saveAndFlush(unknown);

        TrainingLogService.LogResponse log = service().log(owner, null, null, null, null);

        assertThat(log.weeks().get(0).runs()).isZero();
    }

    @Test
    void aRunWithPartialDataStillAppears() {
        Runner owner = runner(null);
        Activity meters = new Activity();
        meters.setRunner(owner);
        meters.setName("meters only");
        meters.setActivityType(ActivityType.RUN);
        meters.setProvider(ImportProvider.GARMIN);
        meters.setStartTime(LocalDateTime.of(2026, 10, 6, 7, 0));
        meters.setDistanceMeters(5000.0);
        meters.setDurationSeconds(1500L);
        activities.saveAndFlush(meters);
        Activity bare = new Activity();
        bare.setRunner(owner);
        bare.setName("nothing recorded");
        bare.setActivityType(ActivityType.RUN);
        bare.setProvider(ImportProvider.GARMIN);
        bare.setStartTime(LocalDateTime.of(2026, 10, 7, 7, 0));
        activities.saveAndFlush(bare);

        TrainingLogService.LogWeek week = service().log(owner, null, null, null, null).weeks().get(0);

        TrainingLogService.LogRun fromMeters = week.days().get(0).runs().get(0);
        assertThat(fromMeters.distanceKm()).isEqualTo(5.0);
        assertThat(fromMeters.movingSeconds()).isEqualTo(1500);
        assertThat(fromMeters.paceSecPerKm()).isEqualTo(300.0);
        TrainingLogService.LogRun nothing = week.days().get(1).runs().get(0);
        assertThat(nothing.distanceKm()).isZero();
        assertThat(nothing.movingSeconds()).isZero();
        assertThat(nothing.paceSecPerKm()).as("no pace without a distance and a time").isNull();
        assertThat(week.runs()).isEqualTo(2);
    }

    @Test
    void aRunWithNoStartTimeIsPlacedOnTheDayItWasAdded() {
        Runner owner = runner(null);
        Activity undated = new Activity();
        undated.setRunner(owner);
        undated.setName("no start");
        undated.setActivityType(ActivityType.RUN);
        undated.setProvider(ImportProvider.GARMIN);
        undated.setCreatedAt(LocalDateTime.of(2026, 10, 8, 20, 0));
        undated.setDistanceKm(5.0);
        undated.setMovingTimeSeconds(1500);
        activities.saveAndFlush(undated);

        TrainingLogService.LogResponse log = service().log(owner, null, null, null, null);

        assertThat(idsIn(log.weeks().get(0))).containsExactly(undated.getId());
        assertThat(log.weeks().get(0).days().get(0).date()).isEqualTo(LocalDate.of(2026, 10, 8));
    }
}
