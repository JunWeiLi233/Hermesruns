package com.hermes.backend.activity;

import com.hermes.backend.runner.AccountDeletionService;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.DoubleFunction;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * Best efforts and route groups against a real schema: what gets worked out from stored runs and points, what the runner's
 * edits do, how ranks are read, and who is allowed to see what.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:run-records-integration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class RunRecordsIntegrationTests {

    private static final double METERS_PER_DEGREE = 6_371_000.0 * Math.PI / 180.0;
    private static final double FIVE_MINUTES_PER_KM = 1000.0 / 300.0;

    @Autowired private RunRecordsCoordinator coordinator;
    @Autowired private BestEffortService efforts;
    @Autowired private RouteMatchService routes;
    @Autowired private ActivityBestEffortRepository effortRows;
    @Autowired private ActivityRecordsRepository recordRows;
    @Autowired private RouteMatchGroupRepository groups;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityDataAccess activityData;
    @Autowired private RunnerRepository runners;
    @Autowired private AccountDeletionService accountDeletion;

    private Runner runner() {
        Runner runner = new Runner("records-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setRole("USER");
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, LocalDateTime start, double km, int movingSeconds) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(start);
        run.setMovingTimeSeconds(movingSeconds);
        run.setDurationSeconds((long) movingSeconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000);
        return activities.saveAndFlush(run);
    }

    /** A straight run north at a constant speed, one reading a second. */
    private void steady(Activity run, int seconds, double metersPerSecond) {
        stream(run, seconds, metersPerSecond, distance -> new double[] {40.0 + distance / METERS_PER_DEGREE, -73.0});
    }

    private void stream(Activity run, int seconds, double metersPerSecond, DoubleFunction<double[]> path) {
        List<ActivityPoint> points = new ArrayList<>();
        for (int i = 0; i <= seconds; i++) {
            double distance = i * metersPerSecond;
            double[] where = path.apply(distance);
            ActivityPoint point = new ActivityPoint();
            point.setActivity(run);
            point.setSequenceIndex(i);
            point.setLatitude(where[0]);
            point.setLongitude(where[1]);
            point.setElapsedSeconds(i);
            point.setDistanceMeters(distance);
            points.add(point);
        }
        activityData.savePoints(points);
    }

    /** A circular loop of the given length from a start, going round counter-clockwise or clockwise. */
    private static DoubleFunction<double[]> loop(double startLatitude, double startLongitude, double length, boolean counterClockwise) {
        double radius = length / (2 * Math.PI);
        return distance -> {
            double theta = 2 * Math.PI * (distance % length) / length;
            double north = radius * Math.sin(theta) / METERS_PER_DEGREE;
            double east = radius * (1 - Math.cos(theta)) / (METERS_PER_DEGREE * Math.cos(Math.toRadians(startLatitude)));
            // Heading north first and curving east is clockwise; curving west is counter-clockwise.
            return new double[] {startLatitude + north, startLongitude + (counterClockwise ? -east : east)};
        };
    }

    private List<BestEffortService.EffortView> effortsOf(Runner owner, Activity run) {
        return efforts.effortsOf(owner, run.getId()).orElseThrow();
    }

    private static void assertSeconds(List<BestEffortService.RankedEffort> ranked, double... expected) {
        assertThat(ranked).hasSize(expected.length);
        for (int i = 0; i < expected.length; i++) {
            assertThat(ranked.get(i).effectiveSeconds()).as("rank %d", i + 1).isCloseTo(expected[i], within(0.5));
        }
    }

    private BestEffortService.EffortView effort(Runner owner, Activity run, String key) {
        return effortsOf(owner, run).stream().filter(view -> view.distanceKey().equals(key)).findFirst().orElseThrow();
    }

    // ----- what is worked out -----

    @Test
    void aSteadyRunGetsAnEffortForEveryDistanceItIsLongEnoughFor() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 12.0, 3600);
        steady(run, 3600, FIVE_MINUTES_PER_KM);

        assertThat(coordinator.process(owner.getId(), run.getId())).isTrue();

        List<BestEffortService.EffortView> found = effortsOf(owner, run);
        assertThat(found).extracting(BestEffortService.EffortView::distanceKey)
                .containsExactly("400m", "half_mile", "1km", "1mile", "3km", "2mile", "5km", "10km");
        assertThat(effort(owner, run, "5km").elapsedSeconds()).isCloseTo(1500.0, within(0.2));
        assertThat(effort(owner, run, "5km").paceSecPerKm()).isCloseTo(300.0, within(0.1));
        assertThat(effort(owner, run, "5km").estimated()).isFalse();
        assertThat(effort(owner, run, "5km").rank()).isEqualTo(1);
        assertThat(activities.findById(run.getId()).orElseThrow().getRecordsVersion()).isEqualTo(BestEffortService.MODEL_VERSION);
    }

    @Test
    void analysingARunTwiceChangesNothing() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);

        coordinator.process(owner.getId(), run.getId());
        long first = effortRows.count();
        List<BestEffortService.EffortView> before = effortsOf(owner, run);
        coordinator.process(owner.getId(), run.getId());

        assertThat(effortRows.count()).isEqualTo(first);
        assertThat(effortsOf(owner, run)).isEqualTo(before);
    }

    @Test
    void aRunWithNoStreamGetsEstimatesFromItsAveragePaceFromOneKilometreUp() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 5.2, 1560); // 5:00 /km, no points

        coordinator.process(owner.getId(), run.getId());

        List<BestEffortService.EffortView> found = effortsOf(owner, run);
        assertThat(found).extracting(BestEffortService.EffortView::distanceKey).containsExactly("1km", "1mile", "3km", "2mile", "5km");
        assertThat(found).allSatisfy(view -> {
            assertThat(view.estimated()).isTrue();
            assertThat(view.paceSecPerKm()).isCloseTo(300.0, within(0.1));
            assertThat(view.startOffsetSeconds()).isNull();
        });
    }

    @Test
    void aRunJustShortOfADistanceGetsAnEstimateForIt() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 4.6, 1380); // 92% of 5 km
        steady(run, 1380, FIVE_MINUTES_PER_KM);

        coordinator.process(owner.getId(), run.getId());

        assertThat(effort(owner, run, "3km").estimated()).isFalse();
        assertThat(effort(owner, run, "5km").estimated()).isTrue();
        assertThat(effort(owner, run, "5km").elapsedSeconds()).isCloseTo(1500.0, within(0.2));
    }

    @Test
    void aRunMoreThanTenPercentShortOfADistanceHasNoEstimateForIt() {
        Runner owner = runner();
        Activity nearly = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 4.4, 1320); // 88% of 5 km
        Activity farShort = run(owner, LocalDateTime.of(2026, 10, 2, 12, 0), 3.2, 960);

        coordinator.process(owner.getId(), nearly.getId());
        coordinator.process(owner.getId(), farShort.getId());

        assertThat(effortsOf(owner, nearly)).extracting(BestEffortService.EffortView::distanceKey).doesNotContain("5km");
        assertThat(effortsOf(owner, nearly)).extracting(BestEffortService.EffortView::distanceKey).contains("3km");
        assertThat(effortsOf(owner, farShort)).extracting(BestEffortService.EffortView::distanceKey).doesNotContain("5km", "10km");
    }

    @Test
    void anEffortTheRunNoLongerHasIsRemovedUnlessTheRunnerDecidedSomethingAboutIt() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 12.0, 3600);
        steady(run, 3600, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());
        efforts.change(owner, run.getId(), "10km", new BestEffortService.Change(null, false, true));
        efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(1490, false, null));
        assertThat(effortsOf(owner, run)).extracting(BestEffortService.EffortView::distanceKey).contains("3km", "5km", "10km");

        // The run is corrected to 2.5 km: nothing is left at 3 km or more.
        activityData.deletePointsForActivity(run.getId());
        run.setDistanceKm(2.5);
        run.setDistanceMeters(2500.0);
        run.setMovingTimeSeconds(750);
        activities.saveAndFlush(run);
        steady(run, 750, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        List<String> keys = effortsOf(owner, run).stream().map(BestEffortService.EffortView::distanceKey).toList();
        assertThat(keys).doesNotContain("3km", "2mile");
        assertThat(keys).contains("1km", "5km", "10km"); // the runner typed a time for one and hid the other: those stay
        assertThat(effort(owner, run, "5km").edited()).isTrue();
        assertThat(effort(owner, run, "10km").hidden()).isTrue();
    }

    @Test
    void theTimeANoRunnerCouldRunIsRefusedAtTheEdgesOfPlausible() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        // 5 km in 500 s is 10 m/s: allowed. In 499 s it is faster than 1:40 per km.
        assertThat(efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(500, false, null))).isPresent();
        assertThatThrownBy(() -> efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(499, false, null)))
                .isInstanceOf(BestEffortService.InvalidChange.class);
        // 5 km in 9000 s is 30:00 per km: allowed. One second more is slower.
        assertThat(efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(9000, false, null))).isPresent();
        assertThatThrownBy(() -> efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(9001, false, null)))
                .isInstanceOf(BestEffortService.InvalidChange.class);
    }

    @Test
    void whenTheStreamArrivesTheEstimateIsReplacedByAMeasurement() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        coordinator.process(owner.getId(), run.getId());
        assertThat(effort(owner, run, "5km").estimated()).isTrue();

        // The stream shows a faster stretch than the average: 5 km in 1400 s inside a run that averages 1500 s per 5 km.
        stream(run, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {40.0 + distance / METERS_PER_DEGREE, -73.0});
        coordinator.process(owner.getId(), run.getId());

        assertThat(effort(owner, run, "5km").estimated()).isFalse();
        assertThat(effort(owner, run, "5km").elapsedSeconds()).isCloseTo(1500.0, within(0.2));
        assertThat(effort(owner, run, "5km").startOffsetSeconds()).isNotNull();
    }

    @Test
    void aRunThatIsNotARunHasNoEfforts() {
        Runner owner = runner();
        Activity ride = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 12.0, 3600);
        steady(ride, 3600, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), ride.getId());
        assertThat(effortsOf(owner, ride)).isNotEmpty();

        ride.setActivityType(ActivityType.NON_RUN);
        activities.saveAndFlush(ride);
        coordinator.process(owner.getId(), ride.getId());

        assertThat(effortsOf(owner, ride)).isEmpty();
        assertThat(ride.getId()).isNotNull();
    }

    // ----- what the runner decides -----

    @Test
    void aTypedChipTimeBecomesTheTimeThatCountsAndSurvivesAnotherAnalysis() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        BestEffortService.EffortView changed = efforts.change(owner, run.getId(), "5km",
                new BestEffortService.Change(1490, false, null)).orElseThrow();

        assertThat(changed.edited()).isTrue();
        assertThat(changed.effectiveSeconds()).isEqualTo(1490.0);
        assertThat(changed.elapsedSeconds()).isCloseTo(1500.0, within(0.2));
        assertThat(changed.paceSecPerKm()).isCloseTo(298.0, within(0.1));

        coordinator.process(owner.getId(), run.getId());

        assertThat(effort(owner, run, "5km").effectiveSeconds()).isEqualTo(1490.0);
        assertThat(effort(owner, run, "5km").edited()).isTrue();

        BestEffortService.EffortView cleared = efforts.change(owner, run.getId(), "5km",
                new BestEffortService.Change(null, true, null)).orElseThrow();

        assertThat(cleared.edited()).isFalse();
        assertThat(cleared.effectiveSeconds()).isCloseTo(1500.0, within(0.2));
    }

    @Test
    void aTimeNoRunnerCouldRunIsRefused() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        for (int seconds : new int[] {0, -5, 100, 499, 9001}) {
            assertThatThrownBy(() -> efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(seconds, false, null)))
                    .as("%d seconds for 5 km", seconds)
                    .isInstanceOf(BestEffortService.InvalidChange.class);
        }
        assertThat(effort(owner, run, "5km").edited()).isFalse();
        assertThat(efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(500, false, null))).isPresent();
        assertThat(efforts.change(owner, run.getId(), "5km", new BestEffortService.Change(9000, false, null))).isPresent();
    }

    @Test
    void aHiddenEffortLeavesTheRankingsAndStaysHiddenThroughAnotherAnalysis() {
        Runner owner = runner();
        Activity best = run(owner, LocalDateTime.of(2026, 9, 1, 12, 0), 6.0, 1740);
        steady(best, 1740, 1000.0 / 290);
        Activity other = run(owner, LocalDateTime.of(2026, 9, 8, 12, 0), 6.0, 1800);
        steady(other, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), best.getId());
        coordinator.process(owner.getId(), other.getId());
        assertThat(effort(owner, best, "5km").rank()).isEqualTo(1);
        assertThat(effort(owner, other, "5km").rank()).isEqualTo(2);

        BestEffortService.EffortView hidden = efforts.change(owner, best.getId(), "5km", new BestEffortService.Change(null, false, true)).orElseThrow();
        coordinator.process(owner.getId(), best.getId());

        assertThat(hidden.hidden()).isTrue();
        assertThat(hidden.rank()).isNull();
        assertThat(effort(owner, best, "5km").hidden()).isTrue();
        assertThat(effort(owner, other, "5km").rank()).isEqualTo(1);

        efforts.change(owner, best.getId(), "5km", new BestEffortService.Change(null, false, false));
        assertThat(effort(owner, best, "5km").rank()).isEqualTo(1);
        assertThat(effort(owner, other, "5km").rank()).isEqualTo(2);
    }

    @Test
    void anEffortThatIsNotThereCannotBeChanged() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 3.2, 960);
        steady(run, 960, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        assertThat(efforts.change(owner, run.getId(), "10km", new BestEffortService.Change(3000, false, null))).isEmpty();
        assertThat(efforts.change(owner, run.getId(), "not-a-distance", new BestEffortService.Change(3000, false, null))).isEmpty();
    }

    // ----- ranks and the analysis -----

    @Test
    void ranksOrderByTimeThenDayAndNeverMixRunners() {
        Runner owner = runner();
        Runner stranger = runner();
        Activity slow = run(owner, LocalDateTime.of(2026, 9, 1, 12, 0), 6.0, 1860);
        steady(slow, 1860, 1000.0 / 310);
        Activity earlyTie = run(owner, LocalDateTime.of(2026, 9, 2, 12, 0), 6.0, 1800);
        steady(earlyTie, 1800, FIVE_MINUTES_PER_KM);
        Activity lateTie = run(owner, LocalDateTime.of(2026, 9, 3, 12, 0), 6.0, 1800);
        steady(lateTie, 1800, FIVE_MINUTES_PER_KM);
        Activity fastest = run(owner, LocalDateTime.of(2026, 9, 4, 12, 0), 6.0, 1740);
        steady(fastest, 1740, 1000.0 / 290);
        Activity faster = run(stranger, LocalDateTime.of(2026, 9, 5, 12, 0), 6.0, 1500);
        steady(faster, 1500, 1000.0 / 250);
        for (Activity activity : List.of(slow, earlyTie, lateTie, fastest)) {
            coordinator.process(owner.getId(), activity.getId());
        }
        coordinator.process(stranger.getId(), faster.getId());

        assertThat(effort(owner, fastest, "5km").rank()).isEqualTo(1);
        assertThat(effort(owner, earlyTie, "5km").rank()).isEqualTo(2);
        assertThat(effort(owner, lateTie, "5km").rank()).isEqualTo(3);
        assertThat(effort(owner, slow, "5km").rank()).isEqualTo(4);
        assertThat(effort(stranger, faster, "5km").rank()).isEqualTo(1);
    }

    @Test
    void theAnalysisGivesTheBestEverTheBestOfTheYearAndATrend() {
        Runner owner = runner();
        int[][] fiveKilometreSeconds = {{2024, 1500}, {2024, 1440}, {2025, 1400}, {2025, 1460}, {2025, 1480}, {2026, 1380}};
        int day = 1;
        for (int[] entry : fiveKilometreSeconds) {
            Activity run = run(owner, LocalDateTime.of(entry[0], 3, day++, 12, 0), 6.0, (int) (entry[1] * 6.0 / 5.0));
            steady(run, (int) (entry[1] * 6.0 / 5.0), 5000.0 / entry[1]);
            coordinator.process(owner.getId(), run.getId());
        }

        BestEffortService.Analysis analysis = efforts.analysis(owner, "5km", null, true);

        assertThat(analysis.key()).isEqualTo("5km");
        assertThat(analysis.years()).containsExactly(2024, 2025, 2026);
        assertThat(analysis.year()).isEqualTo(2026);
        assertThat(analysis.lifetime()).hasSize(3);
        assertSeconds(analysis.lifetime(), 1380.0, 1400.0, 1440.0);
        assertThat(analysis.annual()).hasSize(1);
        assertThat(analysis.trend()).extracting(BestEffortService.YearBest::year).containsExactly(2024, 2025, 2026);
        assertThat(analysis.trend().get(1).bestSeconds()).isCloseTo(1400.0, within(0.5));
        assertThat(analysis.trend().get(1).count()).isEqualTo(3);

        BestEffortService.Analysis in2025 = efforts.analysis(owner, "5km", 2025, true);

        assertSeconds(in2025.annual(), 1400.0, 1460.0, 1480.0);
        assertThat(in2025.annual()).extracting(BestEffortService.RankedEffort::rank).containsExactly(1, 2, 3);
    }

    @Test
    void theAnnualListStopsAtTenAndTheLifetimeListAtThree() {
        Runner owner = runner();
        for (int i = 0; i < 12; i++) {
            int seconds = 1800 - i * 20; // twelve different times in one year
            Activity run = run(owner, LocalDateTime.of(2026, 3, 1 + i, 7, 0), 6.0, seconds);
            steady(run, seconds, 6000.0 / seconds);
            coordinator.process(owner.getId(), run.getId());
        }

        BestEffortService.Analysis analysis = efforts.analysis(owner, "5km", 2026, true);

        assertThat(analysis.lifetime()).extracting(BestEffortService.RankedEffort::rank).containsExactly(1, 2, 3);
        assertThat(analysis.annual()).extracting(BestEffortService.RankedEffort::rank).containsExactly(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        assertThat(analysis.annual().get(0).effectiveSeconds()).isLessThan(analysis.annual().get(9).effectiveSeconds());
        assertThat(analysis.trend()).hasSize(1);
        assertThat(analysis.trend().get(0).count()).isEqualTo(12);
    }

    @Test
    void withoutAChosenDistanceTheAnalysisIsOfTheFiveKilometresWhenTheRunnerHasThem() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        BestEffortService.Analysis analysis = efforts.analysis(owner, null, null, true);

        assertThat(analysis.key()).isEqualTo("5km");
        assertThat(analysis.distances().get(0).key()).isEqualTo("400m");
        assertThat(analysis.distances()).extracting(BestEffortService.DistanceSummary::key).contains("1km", "5km");
        assertThat(analysis.distances().stream().filter(summary -> summary.key().equals("5km")).findFirst().orElseThrow().bestSeconds())
                .isCloseTo(1500.0, within(0.2));
    }

    @Test
    void theAnalysisOfARunnerWithNoEffortsIsEmptyAndAnUnknownDistanceFallsBack() {
        Runner owner = runner();
        assertThat(efforts.analysis(owner, "5km", null, true).key()).isNull();

        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 3.3, 990);
        steady(run, 990, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        assertThat(efforts.analysis(owner, "marathon", null, true).key()).isEqualTo("400m");
        assertThat(efforts.analysis(owner, "3km", null, true).key()).isEqualTo("3km");
        assertThat(efforts.analysis(owner, null, null, false).complete()).isFalse();
    }

    // ----- who may see what -----

    @Test
    void aRunnerCannotReadOrChangeSomeoneElsesEfforts() {
        Runner owner = runner();
        Runner stranger = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        assertThat(efforts.effortsOf(stranger, run.getId())).isEmpty();
        assertThat(efforts.change(stranger, run.getId(), "5km", new BestEffortService.Change(1400, false, null))).isEmpty();
        assertThat(routes.matchesOf(stranger, run.getId())).isEmpty();
        assertThat(coordinator.process(stranger.getId(), run.getId())).isFalse();
        assertThat(effort(owner, run, "5km").edited()).isFalse();
    }

    // ----- what still has to be analysed -----

    @Test
    void runsNotYetAnalysedAreAnalysedWithinABudgetAndCounted() {
        Runner owner = runner();
        List<Activity> runs = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            Activity run = run(owner, LocalDateTime.of(2026, 10, 1 + i, 12, 0), 3.2, 960);
            steady(run, 960, FIVE_MINUTES_PER_KM);
            runs.add(run);
        }

        assertThat(coordinator.ensurePending(owner, Duration.ofSeconds(30), 3)).isEqualTo(1);
        assertThat(coordinator.ensurePending(owner, Duration.ofSeconds(30), 10)).isZero();
        assertThat(coordinator.ensurePending(owner, Duration.ofSeconds(30), 10)).isZero();
        for (Activity run : runs) {
            assertThat(effortsOf(owner, run)).isNotEmpty();
        }
    }

    @Test
    void ensureAnalysedDoesTheRunOnlyWhenItIsOutOfDate() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 3.2, 960);
        steady(run, 960, FIVE_MINUTES_PER_KM);

        coordinator.ensureAnalysed(owner, run.getId());
        assertThat(effortsOf(owner, run)).isNotEmpty();
        efforts.change(owner, run.getId(), "3km", new BestEffortService.Change(null, false, true));
        coordinator.ensureAnalysed(owner, run.getId());

        assertThat(effort(owner, run, "3km").hidden()).isTrue();
    }

    // ----- when a run goes -----

    @Test
    void deletingARunDeletesItsEffortsAndTheRunnerKeepsTheirOthers() {
        Runner owner = runner();
        Activity gone = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(gone, 1800, FIVE_MINUTES_PER_KM);
        Activity kept = run(owner, LocalDateTime.of(2026, 10, 2, 12, 0), 6.0, 1800);
        steady(kept, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), gone.getId());
        coordinator.process(owner.getId(), kept.getId());
        assertThat(effort(owner, kept, "5km").rank()).isEqualTo(2);

        assertThat(activityData.deleteActivityForRunner(gone.getId(), owner)).isTrue();

        assertThat(effortRows.findByActivityIdAndRunnerIdOrderByDistanceMetersAsc(gone.getId(), owner.getId())).isEmpty();
        assertThat(effort(owner, kept, "5km").rank()).isEqualTo(1);
    }

    @Test
    void deletingTheAccountDeletesEffortsAndRouteGroups() {
        Runner doomed = runner();
        Runner survivor = runner();
        Activity doomedRun = run(doomed, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(doomedRun, 1800, FIVE_MINUTES_PER_KM);
        Activity survivorRun = run(survivor, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(survivorRun, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(doomed.getId(), doomedRun.getId());
        coordinator.process(survivor.getId(), survivorRun.getId());
        assertThat(groups.findByRunnerId(doomed.getId())).hasSize(1);

        accountDeletion.deleteAccount(doomed.getId());

        assertThat(effortRows.findAllForRunner(doomed.getId())).isEmpty();
        assertThat(groups.findByRunnerId(doomed.getId())).isEmpty();
        assertThat(effortRows.findAllForRunner(survivor.getId())).isNotEmpty();
        assertThat(groups.findByRunnerId(survivor.getId())).hasSize(1);
    }

    // ----- routes -----

    @Test
    void runsOverTheSameRouteShareAGroupAndTheNewestIsComparedWithTheOthers() {
        Runner owner = runner();
        double[] seconds = {1800, 1740, 1860};
        List<Activity> runs = new ArrayList<>();
        for (int i = 0; i < seconds.length; i++) {
            Activity run = run(owner, LocalDateTime.of(2026, 9, 1 + i * 7, 7, 0), 6.0, (int) seconds[i]);
            steady(run, (int) seconds[i], 6000.0 / seconds[i]);
            coordinator.process(owner.getId(), run.getId());
            runs.add(run);
        }

        RouteMatchService.Matches matches = routes.matchesOf(owner, runs.get(2).getId()).orElseThrow();

        assertThat(groups.findByRunnerId(owner.getId())).hasSize(1);
        assertThat(matches.count()).isEqualTo(3);
        assertThat(matches.loop()).isFalse();
        assertThat(matches.runs()).extracting(RouteMatchService.MatchRun::activityId)
                .containsExactly(runs.get(0).getId(), runs.get(1).getId(), runs.get(2).getId());
        assertThat(matches.runs()).filteredOn(RouteMatchService.MatchRun::current).extracting(RouteMatchService.MatchRun::activityId)
                .containsExactly(runs.get(2).getId());
        assertThat(matches.runs()).filteredOn(RouteMatchService.MatchRun::fastest).extracting(RouteMatchService.MatchRun::activityId)
                .containsExactly(runs.get(1).getId());
        assertThat(matches.runs().get(1).paceSecPerKm()).isCloseTo(290.0, within(0.1));
    }

    @Test
    void whenTwoRunsShareTheBestPaceTheEarlierOneIsTheFastest() {
        Runner owner = runner();
        Activity later = run(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 6.0, 1740);
        Activity earlier = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1740);
        Activity slow = run(owner, LocalDateTime.of(2026, 9, 15, 7, 0), 6.0, 1860);
        for (Activity activity : List.of(later, earlier, slow)) {
            steady(activity, activity.getMovingTimeSeconds(), 6000.0 / activity.getMovingTimeSeconds());
            coordinator.process(owner.getId(), activity.getId());
        }

        RouteMatchService.Matches matches = routes.matchesOf(owner, slow.getId()).orElseThrow();

        assertThat(matches.runs()).filteredOn(RouteMatchService.MatchRun::fastest).extracting(RouteMatchService.MatchRun::activityId)
                .containsExactly(earlier.getId());
    }

    @Test
    void aRunJoinsTheNearestGroupItFitsAndNotTheFirstOrTheLast() {
        Runner owner = runner();
        Activity a = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        stream(a, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {40.0 + distance / METERS_PER_DEGREE, -73.0});
        Activity b = run(owner, LocalDateTime.of(2026, 9, 2, 7, 0), 6.0, 1800);
        // 200 m further along the same line: more than 150 m from A's start and finish, so a group of its own.
        stream(b, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {40.0 + (200.0 + distance) / METERS_PER_DEGREE, -73.0});
        Activity between = run(owner, LocalDateTime.of(2026, 9, 3, 7, 0), 6.0, 1800);
        // 90 m along: 90 m from A and 110 m from B at both ends, so it fits both and is nearer A.
        stream(between, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {40.0 + (90.0 + distance) / METERS_PER_DEGREE, -73.0});
        for (Activity run : List.of(a, b, between)) {
            coordinator.process(owner.getId(), run.getId());
        }

        assertThat(groups.findByRunnerId(owner.getId())).hasSize(2);
        assertThat(activities.findById(between.getId()).orElseThrow().getRouteMatchGroupId())
                .isEqualTo(activities.findById(a.getId()).orElseThrow().getRouteMatchGroupId())
                .isNotEqualTo(activities.findById(b.getId()).orElseThrow().getRouteMatchGroupId());
    }

    @Test
    void aRunJoinsTheSecondGroupWhenThatIsTheNearer() {
        Runner owner = runner();
        Activity a = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        stream(a, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {40.0 + distance / METERS_PER_DEGREE, -73.0});
        Activity b = run(owner, LocalDateTime.of(2026, 9, 2, 7, 0), 6.0, 1800);
        // 200 m further along the same line: more than 150 m from A's start and finish, so a group of its own.
        stream(b, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {40.0 + (200.0 + distance) / METERS_PER_DEGREE, -73.0});
        Activity between = run(owner, LocalDateTime.of(2026, 9, 3, 7, 0), 6.0, 1800);
        // 110 m along: 110 m from A and 90 m from B at both ends, so it fits both and is nearer B, the later group.
        stream(between, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {40.0 + (110.0 + distance) / METERS_PER_DEGREE, -73.0});
        for (Activity run : List.of(a, b, between)) {
            coordinator.process(owner.getId(), run.getId());
        }

        assertThat(groups.findByRunnerId(owner.getId())).hasSize(2);
        assertThat(activities.findById(between.getId()).orElseThrow().getRouteMatchGroupId())
                .isEqualTo(activities.findById(b.getId()).orElseThrow().getRouteMatchGroupId())
                .isNotEqualTo(activities.findById(a.getId()).orElseThrow().getRouteMatchGroupId());
    }

    @Test
    void theNewestRunsOfARouteAreCutByStartAndARunWithNoStartCountsFromTheDayItWasAdded() {
        Runner owner = runner();
        Activity oldest = run(owner, LocalDateTime.of(2026, 1, 5, 7, 0), 6.0, 1800);
        Activity newest = run(owner, LocalDateTime.of(2026, 3, 5, 7, 0), 6.0, 1800);
        Activity noStart = run(owner, LocalDateTime.of(2026, 2, 5, 7, 0), 6.0, 1800);
        for (Activity activity : List.of(oldest, newest, noStart)) {
            steady(activity, 1800, FIVE_MINUTES_PER_KM);
            coordinator.process(owner.getId(), activity.getId());
        }
        // A route file with no timestamps, added after the other two: databases disagree on where a null sorts, so the
        // order must not depend on it.
        Activity stored = activities.findById(noStart.getId()).orElseThrow();
        stored.setStartTime(null);
        stored.setCreatedAt(LocalDateTime.of(2026, 6, 1, 12, 0));
        activities.saveAndFlush(stored);
        Long groupId = activities.findById(newest.getId()).orElseThrow().getRouteMatchGroupId();

        List<Activity> twoNewest = recordRows.findGroupRuns(owner.getId(), groupId, ActivityType.RUN, org.springframework.data.domain.PageRequest.of(0, 2));

        assertThat(twoNewest).extracting(Activity::getId).containsExactly(noStart.getId(), newest.getId());
    }

    @Test
    void aRunWhosePointsAreGoneLeavesItsRouteGroup() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());
        assertThat(activities.findById(run.getId()).orElseThrow().getRouteMatchGroupId()).isNotNull();

        activityData.deletePointsForActivity(run.getId());
        coordinator.process(owner.getId(), run.getId());

        assertThat(activities.findById(run.getId()).orElseThrow().getRouteMatchGroupId()).isNull();
        assertThat(routes.matchesOf(owner, run.getId()).orElseThrow().groupId()).isNull();
    }

    @Test
    void aRunNobodyElseRanHasNoMatchesToShow() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 10, 1, 12, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());

        RouteMatchService.Matches matches = routes.matchesOf(owner, run.getId()).orElseThrow();

        assertThat(matches.groupId()).isNotNull();
        assertThat(matches.count()).isEqualTo(1);
        assertThat(matches.runs()).isEmpty();
    }

    @Test
    void loopsRunTheOtherWayRoundAreAnotherRoute() {
        Runner owner = runner();
        Activity first = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 5.0, 1500);
        stream(first, 1500, 5000.0 / 1500, loop(40.78, -73.96, 5000.0, false));
        Activity again = run(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 5.0, 1480);
        stream(again, 1480, 5000.0 / 1480, loop(40.78, -73.96, 5000.0, false));
        Activity reversed = run(owner, LocalDateTime.of(2026, 9, 15, 7, 0), 5.0, 1520);
        stream(reversed, 1520, 5000.0 / 1520, loop(40.78, -73.96, 5000.0, true));
        for (Activity run : List.of(first, again, reversed)) {
            coordinator.process(owner.getId(), run.getId());
        }

        assertThat(groups.findByRunnerId(owner.getId())).hasSize(2);
        assertThat(routes.matchesOf(owner, first.getId()).orElseThrow().count()).isEqualTo(2);
        assertThat(routes.matchesOf(owner, first.getId()).orElseThrow().loop()).isTrue();
        assertThat(routes.matchesOf(owner, reversed.getId()).orElseThrow().count()).isEqualTo(1);
    }

    @Test
    void aRunFromAnotherPlaceOrOfAnotherLengthIsAnotherRoute() {
        Runner owner = runner();
        Activity base = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        steady(base, 1800, FIVE_MINUTES_PER_KM);
        Activity longer = run(owner, LocalDateTime.of(2026, 9, 2, 7, 0), 7.0, 2100);
        steady(longer, 2100, FIVE_MINUTES_PER_KM);
        Activity elsewhere = run(owner, LocalDateTime.of(2026, 9, 3, 7, 0), 6.0, 1800);
        stream(elsewhere, 1800, FIVE_MINUTES_PER_KM, distance -> new double[] {41.5 + distance / METERS_PER_DEGREE, -73.0});
        for (Activity run : List.of(base, longer, elsewhere)) {
            coordinator.process(owner.getId(), run.getId());
        }

        assertThat(groups.findByRunnerId(owner.getId())).hasSize(3);
    }

    @Test
    void routesAreNeverSharedBetweenRunners() {
        Runner one = runner();
        Runner two = runner();
        Activity mine = run(one, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        steady(mine, 1800, FIVE_MINUTES_PER_KM);
        Activity theirs = run(two, LocalDateTime.of(2026, 9, 2, 7, 0), 6.0, 1800);
        steady(theirs, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(one.getId(), mine.getId());
        coordinator.process(two.getId(), theirs.getId());

        assertThat(routes.matchesOf(one, mine.getId()).orElseThrow().count()).isEqualTo(1);
        assertThat(activities.findById(mine.getId()).orElseThrow().getRouteMatchGroupId())
                .isNotEqualTo(activities.findById(theirs.getId()).orElseThrow().getRouteMatchGroupId());
    }

    @Test
    void aRunWithoutPositionsOrTooShortHasNoRoute() {
        Runner owner = runner();
        Activity noPoints = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        Activity tooShort = run(owner, LocalDateTime.of(2026, 9, 2, 7, 0), 0.6, 180);
        steady(tooShort, 180, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), noPoints.getId());
        coordinator.process(owner.getId(), tooShort.getId());

        assertThat(routes.matchesOf(owner, noPoints.getId()).orElseThrow().groupId()).isNull();
        assertThat(routes.matchesOf(owner, tooShort.getId()).orElseThrow().groupId()).isNull();
        assertThat(groups.findByRunnerId(owner.getId())).isEmpty();
    }

    @Test
    void aRouteWithNoTimesStillMatchesButHasNoEfforts() {
        Runner owner = runner();
        Activity one = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        Activity two = run(owner, LocalDateTime.of(2026, 9, 8, 7, 0), 6.0, 1800);
        for (Activity run : List.of(one, two)) {
            List<ActivityPoint> points = new ArrayList<>();
            for (int i = 0; i <= 600; i++) {
                ActivityPoint point = new ActivityPoint();
                point.setActivity(run);
                point.setSequenceIndex(i);
                point.setLatitude(40.0 + i * 10.0 / METERS_PER_DEGREE);
                point.setLongitude(-73.0);
                points.add(point);
            }
            activityData.savePoints(points);
            coordinator.process(owner.getId(), run.getId());
        }

        assertThat(routes.matchesOf(owner, two.getId()).orElseThrow().count()).isEqualTo(2);
        assertThat(effortsOf(owner, one)).extracting(BestEffortService.EffortView::estimated).allMatch(estimated -> estimated);
    }

    @Test
    void groupsNobodyBelongsToAnyMoreAreRemoved() {
        Runner owner = runner();
        Activity run = run(owner, LocalDateTime.of(2026, 9, 1, 7, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);
        coordinator.process(owner.getId(), run.getId());
        assertThat(groups.findByRunnerId(owner.getId())).hasSize(1);

        activityData.deleteActivityForRunner(run.getId(), owner);
        int removed = routes.removeEmptyGroups();

        assertThat(removed).isGreaterThanOrEqualTo(1);
        assertThat(groups.findByRunnerId(owner.getId())).isEmpty();
    }

    @Test
    void theLocalDayOfARunIsTheRunnersOwnDay() {
        Runner owner = runner();
        owner.setTimeZone("Pacific/Auckland");
        runners.saveAndFlush(owner);
        // 20:00 UTC on 30 September is already 1 October in Auckland (a file run holds UTC).
        Activity run = run(owner, LocalDateTime.of(2026, 9, 30, 20, 0), 6.0, 1800);
        steady(run, 1800, FIVE_MINUTES_PER_KM);

        coordinator.process(owner.getId(), run.getId());

        Optional<ActivityBestEffort> row = effortRows.findByActivityIdAndRunnerIdAndDistanceKey(run.getId(), owner.getId(), "5km");
        assertThat(row).isPresent();
        assertThat(row.get().getLocalDate()).isEqualTo(LocalDate.of(2026, 10, 1));
    }
}
