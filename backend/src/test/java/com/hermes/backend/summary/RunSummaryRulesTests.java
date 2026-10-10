package com.hermes.backend.summary;

import com.hermes.backend.summary.RunSummary.Finding;
import com.hermes.backend.summary.SummaryInputs.Drift;
import com.hermes.backend.summary.SummaryInputs.Form;
import com.hermes.backend.summary.SummaryInputs.RecentRun;
import com.hermes.backend.summary.SummaryInputs.Run;
import com.hermes.backend.summary.SummaryInputs.Splits;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/** The rules of the run summary: what each says, where it turns, and, as much, when it says nothing at all. */
class RunSummaryRulesTests {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 10);

    // ----- builders: a 10 km run of 50 minutes, nothing else known, unless a test says more -----

    private static Run run(String type, double km, int seconds, Double effort, Double climb, int[] zones) {
        return new Run(1L, type, DAY, km, seconds, effort, climb, zones);
    }

    private static Run plain() {
        return run(null, 10, 3000, null, null, null);
    }

    private static Run withEffort(double effort) {
        return run(null, 10, 3000, effort, null, null);
    }

    private static RecentRun earlier(int daysAgo, String type, double km, int seconds, Double effort) {
        return new RecentRun((long) (100 + daysAgo), DAY.minusDays(daysAgo), type, km, seconds, effort);
    }

    /** n earlier runs of about the same length, one a day going back from yesterday, all with this effort and pace. */
    private static List<RecentRun> usual(int count, double effort, int secondsPer10Km) {
        List<RecentRun> runs = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            runs.add(earlier(i, null, 10, secondsPer10Km, effort));
        }
        return runs;
    }

    private static SummaryInputs inputs(Run run, List<RecentRun> before) {
        return new SummaryInputs(run, before, null, null, null);
    }

    private static Splits splits(double... paces) {
        return new Splits(IntStream.range(0, paces.length).mapToObj(i -> paces[i]).toList(), false, null, null);
    }

    private static Object fact(Finding finding, String key) {
        return finding.facts().get(key);
    }

    private static int[] zones(int z1, int z2, int z3, int z4, int z5) {
        return new int[] {z1, z2, z3, z4, z5};
    }

    // =============================================================================================== the headline

    @Test
    void aRaceIsARaceWhateverTheNumbersSayTheRunnerLabelledIt() {
        Run race = run("RACE", 10, 2700, 120.0, null, zones(0, 0, 0, 600, 2100));
        SummaryInputs in = new SummaryInputs(race, usual(8, 60, 3000), splits(200, 400, 200, 400, 200), null, null);

        Finding headline = RunSummaryRules.character(in);

        assertThat(headline.id()).isEqualTo("character");
        assertThat(headline.variant()).isEqualTo("race");
        assertThat(fact(headline, "basis")).isEqualTo("run_type");
        assertThat(headline.thresholds()).isEmpty();
    }

    @Test
    void aWorkoutIsAWorkoutAndIsNeverCalledSteadyOrEasy() {
        Run workout = run("WORKOUT", 8, 2700, 90.0, null, zones(2400, 0, 0, 0, 0));

        Finding headline = RunSummaryRules.character(inputs(workout, usual(8, 60, 3000)));

        assertThat(headline.variant()).isEqualTo("workout");
        assertThat(fact(headline, "basis")).isEqualTo("run_type");
    }

    @Test
    void kilometresThatVaryALotMakeItARunWithChangesOfPaceEvenWhenTheHeartRateWasEasy() {
        SummaryInputs in = new SummaryInputs(run(null, 6, 2000, null, null, zones(1800, 0, 0, 0, 0)), List.of(),
                splits(210, 330, 210, 330, 210, 330), null, null);

        Finding headline = RunSummaryRules.character(in);

        assertThat(headline.variant()).isEqualTo("changes");
        assertThat(fact(headline, "fastestPaceSecPerKm")).isEqualTo(210.0);
        assertThat(fact(headline, "slowestPaceSecPerKm")).isEqualTo(330.0);
        assertThat(fact(headline, "variationPercent")).isEqualTo(22.2);
        assertThat(fact(headline, "splits")).isEqualTo(6);
        assertThat(headline.thresholds()).containsEntry("variationPercent", 10).containsEntry("minSplits", 4);
    }

    @Test
    void fewerThanFourKilometresAreNotEnoughToCallAnythingChangesOfPace() {
        SummaryInputs in = new SummaryInputs(run(null, 3, 1000, null, null, zones(1000, 0, 0, 0, 0)), List.of(),
                splits(200, 400, 200), null, null);

        assertThat(RunSummaryRules.character(in).variant()).isEqualTo("easy");
    }

    @Test
    void aVariationJustUnderTenPercentIsOneSteadyEffort() {
        // 300 s/km with a standard deviation of 29 s/km is 9.7 per cent; 31 s/km is 10.3 per cent.
        assertThat(RunSummaryRules.isVariable(splits(271, 329, 271, 329))).isFalse();
        assertThat(RunSummaryRules.isVariable(splits(269, 331, 269, 331))).isTrue();
    }

    @ParameterizedTest(name = "zones 1+2 {0} s, zone 3 {1} s, zones 4+5 {2} s -> {3}")
    @CsvSource({
            "700, 0, 300, hard",        // 30.0 per cent hard: the line is on the hard side
            "701, 0, 299, easy",        // 29.9 per cent hard, 70.1 per cent easy
            "700, 300, 0, easy",        // exactly 70 per cent easy
            "699, 301, 0, moderate",    // 69.9 per cent easy
            "300, 400, 300, hard",
            "200, 600, 200, moderate",
            "1000, 0, 0, easy",
            "0, 0, 1000, hard"
    })
    void theZonesDecideWhetherItWasEasyModerateOrHardAndHardIsCheckedFirst(int easy, int middle, int hard, String variant) {
        // The seconds are split over zones 1 and 2, and over 4 and 5, evenly: only the sums count.
        int[] z = zones(easy / 2, easy - easy / 2, middle, hard / 2, hard - hard / 2);

        Finding headline = RunSummaryRules.character(inputs(run(null, 10, 3000, null, null, z), List.of()));

        assertThat(headline.variant()).isEqualTo(variant);
        assertThat(fact(headline, "basis")).isEqualTo("zones");
    }

    @Test
    void theHeadlineShowsHowTheTimeWasSpentInEachZoneAndHowMuchHeartRateThereWas() {
        Finding headline = RunSummaryRules.character(inputs(run(null, 10, 3000, null, null, zones(600, 1200, 140, 40, 20)), List.of()));

        assertThat(fact(headline, "zonePercents")).isEqualTo(List.of(30, 60, 7, 2, 1));
        assertThat(fact(headline, "easyPercent")).isEqualTo(90);
        assertThat(fact(headline, "hardPercent")).isEqualTo(3);
        assertThat(fact(headline, "heartRateMinutes")).isEqualTo(33);
        assertThat(headline.thresholds()).containsEntry("easyPercent", 70).containsEntry("hardPercent", 30).containsEntry("minHeartRateMinutes", 10);
    }

    @Test
    void lessThanTenMinutesOfHeartRateIsNotEnoughToGoOn() {
        Run shortOfHeartRate = run(null, 10, 3000, 100.0, null, zones(599, 0, 0, 0, 0));

        Finding headline = RunSummaryRules.character(inputs(shortOfHeartRate, usual(6, 60, 3000)));

        assertThat(fact(headline, "basis")).isEqualTo("effort");
        assertThat(headline.variant()).isEqualTo("hard");
    }

    @ParameterizedTest(name = "effort {0} against a usual 80 -> {1}")
    @CsvSource({"100, hard", "99.9, moderate", "60, easy", "60.1, moderate", "80, moderate"})
    void withNoHeartRateTheEffortAgainstTheUsualDecidesAndThenTheHeadlineSaysWhatItWentOn(double effort, String variant) {
        Finding headline = RunSummaryRules.character(inputs(withEffort(effort), usual(5, 80, 3000)));

        assertThat(headline.variant()).isEqualTo(variant);
        assertThat(fact(headline, "basis")).isEqualTo("effort");
        assertThat(fact(headline, "usualEffort")).isEqualTo(80.0);
        assertThat(fact(headline, "count")).isEqualTo(5);
    }

    @Test
    void withNothingToGoOnTheHeadlineSaysSoInsteadOfGuessing() {
        Finding headline = RunSummaryRules.character(inputs(plain(), List.of()));

        assertThat(headline.variant()).isEqualTo("unclear");
        assertThat(fact(headline, "distanceKm")).isEqualTo(10.0);
        assertThat(fact(headline, "movingSeconds")).isEqualTo(3000);
        assertThat(fact(headline, "basis")).isNull();
    }

    @Test
    void whatTheRunnerLabelledBeatsChangesOfPaceWhichBeatTheZonesWhichBeatTheEffort() {
        Run labelled = run("RACE", 6, 2000, 90.0, null, zones(1800, 0, 0, 0, 0));
        Run zoned = run(null, 6, 2000, 90.0, null, zones(1800, 0, 0, 0, 0));
        Splits uneven = splits(210, 330, 210, 330, 210, 330);

        assertThat(RunSummaryRules.character(new SummaryInputs(labelled, usual(6, 60, 3000), uneven, null, null)).variant()).isEqualTo("race");
        assertThat(RunSummaryRules.character(new SummaryInputs(zoned, usual(6, 60, 3000), uneven, null, null)).variant()).isEqualTo("changes");
        assertThat(RunSummaryRules.character(new SummaryInputs(zoned, usual(6, 60, 3000), null, null, null)).variant()).isEqualTo("easy");
    }

    // =============================================================================================== effort against the usual

    @Test
    void aRaceHasNoEffortLineAndNeitherDoesARunWithNoEffort() {
        assertThat(RunSummaryRules.effort(inputs(run("RACE", 10, 2700, 120.0, null, null), usual(8, 60, 3000)))).isEmpty();
        assertThat(RunSummaryRules.effort(inputs(plain(), usual(8, 60, 3000)))).isEmpty();
    }

    @Test
    void fourRunsToCompareWithAreNotEnoughAndFiveAre() {
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), usual(4, 80, 3000)))).isEmpty();
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), usual(5, 80, 3000)))).isPresent();
    }

    @ParameterizedTest(name = "effort {0} against a usual 80 -> {1} (weight {2})")
    @CsvSource({"100, higher, 2", "99, typical, 1", "60, lower, 2", "61, typical, 1", "80, typical, 1"})
    void theVariantTurnsAtAQuarterMoreOrLessThanTheUsualEffort(double effort, String variant, int weight) {
        Finding finding = RunSummaryRules.effort(inputs(withEffort(effort), usual(6, 80, 3000))).orElseThrow();

        assertThat(finding.id()).isEqualTo("effort");
        assertThat(finding.variant()).isEqualTo(variant);
        assertThat(finding.weight()).isEqualTo(weight);
        assertThat(fact(finding, "effort")).isEqualTo(effort);
        assertThat(fact(finding, "usualEffort")).isEqualTo(80.0);
        assertThat(fact(finding, "count")).isEqualTo(6);
        assertThat(fact(finding, "scope")).isEqualTo("similar_length");
    }

    @Test
    void theUsualEffortIsTheMedianSoOneVeryHardRunDoesNotMoveIt() {
        List<RecentRun> before = new ArrayList<>(usual(4, 80, 3000));
        before.add(earlier(5, null, 10, 3000, 400.0));

        Finding finding = RunSummaryRules.effort(inputs(withEffort(100), before)).orElseThrow();

        assertThat(fact(finding, "usualEffort")).isEqualTo(80.0);
    }

    @Test
    void withAnEvenNumberOfRunsTheMedianIsTheMiddleOfTheTwoInTheMiddle() {
        List<RecentRun> before = List.of(
                earlier(1, null, 10, 3000, 60.0), earlier(2, null, 10, 3000, 70.0), earlier(3, null, 10, 3000, 80.0),
                earlier(4, null, 10, 3000, 90.0), earlier(5, null, 10, 3000, 100.0), earlier(6, null, 10, 3000, 110.0));

        assertThat(fact(RunSummaryRules.effort(inputs(withEffort(85), before)).orElseThrow(), "usualEffort")).isEqualTo(85.0);
    }

    @Test
    void theMostInTheWindowIsOnlyARecordWithEightRunsToBeTheMostAmong() {
        Finding seven = RunSummaryRules.effort(inputs(withEffort(100), usual(7, 80, 3000))).orElseThrow();
        Finding eight = RunSummaryRules.effort(inputs(withEffort(100), usual(8, 80, 3000))).orElseThrow();
        Finding equalToTheMost = RunSummaryRules.effort(inputs(withEffort(80), usual(8, 80, 3000))).orElseThrow();

        assertThat(seven.variant()).isEqualTo("higher");
        assertThat(eight.variant()).isEqualTo("hardest");
        assertThat(eight.weight()).isEqualTo(3);
        assertThat(fact(eight, "highestBefore")).isEqualTo(80.0);
        assertThat(equalToTheMost.variant()).isEqualTo("typical");
    }

    @Test
    void onlyRunsFromTheNinetyDaysBeforeAreComparedWithNotTheDayItselfNorOlderOnes() {
        List<RecentRun> before = new ArrayList<>(usual(4, 80, 3000));
        before.add(earlier(90, null, 10, 3000, 80.0));     // the last day in the window
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), before))).isPresent();

        List<RecentRun> tooOld = new ArrayList<>(usual(4, 80, 3000));
        tooOld.add(earlier(91, null, 10, 3000, 80.0));
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), tooOld))).isEmpty();

        List<RecentRun> today = new ArrayList<>(usual(4, 80, 3000));
        today.add(earlier(0, null, 10, 3000, 80.0));        // the same day is not "before"
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), today))).isEmpty();
    }

    @Test
    void onlyRunsOfSimilarLengthAreComparedWith() {
        List<RecentRun> before = new ArrayList<>(usual(4, 80, 3000));
        before.add(earlier(5, null, 7.1, 2130, 80.0));      // just over 70 per cent of 10 km
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), before))).isPresent();

        List<RecentRun> long14 = new ArrayList<>(usual(4, 80, 3000));
        long14.add(earlier(5, null, 13.9, 4170, 80.0));     // just under 140 per cent
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), long14))).isPresent();

        List<RecentRun> tooShort = new ArrayList<>(usual(4, 80, 3000));
        tooShort.add(earlier(5, null, 6.9, 2100, 80.0));
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), tooShort))).isEmpty();

        List<RecentRun> tooLong = new ArrayList<>(usual(4, 80, 3000));
        tooLong.add(earlier(5, null, 14.1, 4200, 80.0));
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), tooLong))).isEmpty();
    }

    @Test
    void workoutsAndRacesAreNeverComparedWithAnOrdinaryRunButALongRunIs() {
        List<RecentRun> others = new ArrayList<>(usual(4, 80, 3000));
        others.add(earlier(5, "WORKOUT", 10, 3000, 80.0));
        others.add(earlier(6, "RACE", 10, 3000, 80.0));
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), others))).isEmpty();

        List<RecentRun> withLongRun = new ArrayList<>(usual(4, 80, 3000));
        withLongRun.add(earlier(5, "LONG_RUN", 10, 3000, 80.0));
        assertThat(RunSummaryRules.effort(inputs(withEffort(80), withLongRun))).isPresent();
    }

    @Test
    void runsWithNoEffortYetAreLeftOutOfTheComparison() {
        List<RecentRun> before = new ArrayList<>(usual(4, 80, 3000));
        before.add(earlier(5, null, 10, 3000, null));
        before.add(earlier(6, null, 10, 3000, 0.0));

        assertThat(RunSummaryRules.effort(inputs(withEffort(80), before))).isEmpty();
    }

    @Test
    void aWorkoutIsComparedWithOtherWorkoutsOfAnyLengthAndThreeAreEnough() {
        List<RecentRun> workouts = List.of(
                earlier(3, "WORKOUT", 4, 1500, 70.0), earlier(10, "WORKOUT", 12, 4500, 90.0), earlier(20, "WORKOUT", 8, 3000, 80.0),
                earlier(5, null, 10, 3000, 300.0));
        Run workout = run("WORKOUT", 6, 2400, 120.0, null, null);

        Finding finding = RunSummaryRules.effort(inputs(workout, workouts)).orElseThrow();

        assertThat(finding.variant()).isEqualTo("higher");
        assertThat(fact(finding, "usualEffort")).isEqualTo(80.0);
        assertThat(fact(finding, "count")).isEqualTo(3);
        assertThat(fact(finding, "scope")).isEqualTo("workouts");
        assertThat(finding.thresholds()).containsEntry("minRuns", 3).doesNotContainKey("lengthFromPercent");
        assertThat(RunSummaryRules.effort(inputs(workout, workouts.subList(0, 2)))).isEmpty();
    }

    @Test
    void theEffortLineSaysWhatItWasComparedWith() {
        Finding finding = RunSummaryRules.effort(inputs(withEffort(100), usual(6, 80, 3000))).orElseThrow();

        assertThat(fact(finding, "ratio")).isEqualTo(1.25);
        assertThat(fact(finding, "windowDays")).isEqualTo(90);
        assertThat(finding.thresholds())
                .containsEntry("higherRatio", 1.25).containsEntry("lowerRatio", 0.75).containsEntry("minRuns", 5)
                .containsEntry("recordMinRuns", 8).containsEntry("windowDays", 90)
                .containsEntry("lengthFromPercent", 70).containsEntry("lengthToPercent", 140);
    }

    // =============================================================================================== pace against recent runs

    @ParameterizedTest(name = "{0} s per 10 km against a recent 3000 -> {1}")
    @CsvSource({"2900, faster", "2909, faster", "2911, similar", "3000, similar", "3089, similar", "3091, slower", "3300, slower"})
    void thePaceTurnsAtThreePercentFasterOrSlowerThanTheRecentRuns(int seconds, String variant) {
        Run thisRun = run(null, 10, seconds, null, null, null);

        Finding finding = RunSummaryRules.pace(inputs(thisRun, usual(3, 70, 3000))).orElseThrow();

        assertThat(finding.variant()).isEqualTo(variant);
        assertThat(finding.weight()).isEqualTo("similar".equals(variant) ? 1 : 2);
    }

    @Test
    void thePaceLineGivesBothPacesTheDifferenceAndWhatWasComparedWith() {
        Finding finding = RunSummaryRules.pace(inputs(run(null, 10, 2850, null, null, null), usual(4, 70, 3000))).orElseThrow();

        assertThat(finding.variant()).isEqualTo("faster");
        assertThat(finding.tone()).isEqualTo("positive");
        assertThat(fact(finding, "paceSecPerKm")).isEqualTo(285.0);
        assertThat(fact(finding, "recentPaceSecPerKm")).isEqualTo(300.0);
        assertThat(fact(finding, "deltaSeconds")).isEqualTo(-15.0);
        assertThat(fact(finding, "deltaPercent")).isEqualTo(-5.0);
        assertThat(fact(finding, "count")).isEqualTo(4);
        assertThat(fact(finding, "windowDays")).isEqualTo(30);
        assertThat(fact(finding, "fromKm")).isEqualTo(7.0);
        assertThat(fact(finding, "toKm")).isEqualTo(14.0);
        assertThat(finding.thresholds()).containsEntry("bandPercent", 3).containsEntry("minRuns", 3).containsEntry("windowDays", 30);
    }

    @Test
    void aSlowerRunIsNotColouredAsAWarning() {
        Finding finding = RunSummaryRules.pace(inputs(run(null, 10, 3300, null, null, null), usual(4, 70, 3000))).orElseThrow();

        assertThat(finding.variant()).isEqualTo("slower");
        assertThat(finding.tone()).isEqualTo("neutral");
    }

    @Test
    void theRecentPaceIsTotalTimeOverTotalDistanceNotTheMeanOfThePaces() {
        // Two 10 km runs at 5:00 and one 7.5 km run at 6:00: the mean of the three paces is 5:20, the pace of all 27.5 km 5:16.
        List<RecentRun> before = List.of(earlier(3, null, 10, 3000, null), earlier(4, null, 10, 3000, null), earlier(5, null, 7.5, 2700, null));
        Finding finding = RunSummaryRules.pace(inputs(run(null, 10, 3000, null, null, null), before)).orElseThrow();

        assertThat(fact(finding, "recentPaceSecPerKm")).isEqualTo(Math.round(8700 / 27.5 * 10.0) / 10.0);
    }

    @Test
    void twoRunsToCompareWithAreNotEnoughAndThreeAre() {
        assertThat(RunSummaryRules.pace(inputs(plain(), usual(2, 70, 3000)))).isEmpty();
        assertThat(RunSummaryRules.pace(inputs(plain(), usual(3, 70, 3000)))).isPresent();
    }

    @Test
    void onlyTheThirtyDaysBeforeAreComparedWith() {
        List<RecentRun> before = new ArrayList<>(usual(2, 70, 3000));
        before.add(earlier(30, null, 10, 3000, null));
        assertThat(RunSummaryRules.pace(inputs(plain(), before))).isPresent();

        List<RecentRun> tooOld = new ArrayList<>(usual(2, 70, 3000));
        tooOld.add(earlier(31, null, 10, 3000, null));
        assertThat(RunSummaryRules.pace(inputs(plain(), tooOld))).isEmpty();
    }

    @Test
    void onlyRunsOfSimilarLengthAndKindAreComparedWithAndAWorkoutOrARaceIsNotComparedAtAll() {
        List<RecentRun> mixed = new ArrayList<>(usual(2, 70, 3000));
        mixed.add(earlier(3, null, 3, 900, null));              // far shorter
        mixed.add(earlier(4, "WORKOUT", 10, 2400, null));        // a different kind
        mixed.add(earlier(5, "RACE", 10, 2400, null));
        assertThat(RunSummaryRules.pace(inputs(plain(), mixed))).isEmpty();

        assertThat(RunSummaryRules.pace(inputs(run("WORKOUT", 10, 3000, null, null, null), usual(5, 70, 3000)))).isEmpty();
        assertThat(RunSummaryRules.pace(inputs(run("RACE", 10, 3000, null, null, null), usual(5, 70, 3000)))).isEmpty();
        assertThat(RunSummaryRules.pace(inputs(run("LONG_RUN", 10, 3000, null, null, null), usual(5, 70, 3000)))).isPresent();
    }

    @Test
    void aRunWithNoMovingTimeOrDistanceIsNotComparedAndOneOfTheEarlierOnesIsSkipped() {
        assertThat(RunSummaryRules.pace(inputs(run(null, 0, 3000, null, null, null), usual(5, 70, 3000)))).isEmpty();
        List<RecentRun> before = new ArrayList<>(usual(2, 70, 3000));
        before.add(earlier(3, null, 10, 0, null));
        assertThat(RunSummaryRules.pace(inputs(plain(), before))).isEmpty();
    }

    // =============================================================================================== pacing

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource(delimiter = '|', value = {
            "300,300,300,300|even",
            "300,300,293,293|negative",     // the second half 2.3 per cent faster
            "300,300,294.5,294.5|even",     // 1.8 per cent
            "300,300,307,307|faded",        // 2.3 per cent slower
            "300,300,305.5,305.5|even",
            "300,302,298,296|even",
            "310,308,300,296|negative",
            "290,295,310,315|faded"
    })
    void theSecondHalfIsComparedWithTheFirstAndTwoPercentIsTheLine(String paces, String variant) {
        Splits splits = splits(Arrays.stream(paces.split(",")).mapToDouble(Double::parseDouble).toArray());

        Finding finding = RunSummaryRules.shape(new SummaryInputs(plain(), List.of(), splits, null, null)).orElseThrow();

        assertThat(finding.id()).isEqualTo("shape");
        assertThat(finding.variant()).isEqualTo(variant);
        assertThat(finding.weight()).isEqualTo("even".equals(variant) ? 1 : 2);
    }

    @Test
    void anOddNumberOfKilometresLeavesOutTheOneInTheMiddle() {
        // 5 km: halves are km 1-2 and km 4-5; the slow middle kilometre must not count either way.
        Finding finding = RunSummaryRules.shape(new SummaryInputs(plain(), List.of(), splits(300, 300, 340, 293, 293), null, null)).orElseThrow();

        assertThat(finding.variant()).isEqualTo("negative");
        assertThat(fact(finding, "firstHalfPaceSecPerKm")).isEqualTo(300.0);
        assertThat(fact(finding, "secondHalfPaceSecPerKm")).isEqualTo(293.0);
        assertThat(fact(finding, "splitsPerHalf")).isEqualTo(2);
        assertThat(fact(finding, "splits")).isEqualTo(5);
        assertThat(fact(finding, "deltaSeconds")).isEqualTo(-7.0);
        assertThat(fact(finding, "deltaPercent")).isEqualTo(-2.3);
        assertThat(fact(finding, "basis")).isEqualTo("pace");
        assertThat(finding.tone()).isEqualTo("positive");
        assertThat(finding.thresholds()).containsEntry("bandPercent", 2).containsEntry("minSplits", 4).containsEntry("variationPercent", 10);
    }

    @Test
    void aFadeIsCautionNotBlameAndTheBasisSaysWhenThePacesWereAdjustedForGrade() {
        Splits adjusted = new Splits(List.of(300.0, 300.0, 312.0, 312.0), true, null, null);

        Finding finding = RunSummaryRules.shape(new SummaryInputs(plain(), List.of(), adjusted, null, null)).orElseThrow();

        assertThat(finding.variant()).isEqualTo("faded");
        assertThat(finding.tone()).isEqualTo("caution");
        assertThat(fact(finding, "basis")).isEqualTo("grade_adjusted");
    }

    @Test
    void noPacingLineForAWorkoutForARunWithChangesOfPaceForThreeKilometresOrWithNoStream() {
        Splits even = splits(300, 300, 300, 300);
        assertThat(RunSummaryRules.shape(new SummaryInputs(run("WORKOUT", 4, 1200, null, null, null), List.of(), even, null, null))).isEmpty();
        assertThat(RunSummaryRules.shape(new SummaryInputs(plain(), List.of(), splits(210, 330, 210, 330), null, null))).isEmpty();
        assertThat(RunSummaryRules.shape(new SummaryInputs(plain(), List.of(), splits(300, 300, 300), null, null))).isEmpty();
        assertThat(RunSummaryRules.shape(inputs(plain(), List.of()))).isEmpty();
    }

    @Test
    void aRaceGetsAPacingLineBecausePacingIsWhatARaceIsAbout() {
        assertThat(RunSummaryRules.shape(new SummaryInputs(run("RACE", 5, 1500, null, null, null), List.of(), splits(300, 300, 294, 294, 290), null, null)))
                .isPresent();
    }

    // =============================================================================================== heart rate drift

    @ParameterizedTest(name = "drift {0} per cent -> {1}")
    @CsvSource({"-3, low, 1", "0, low, 1", "5, low, 1", "5.1, moderate, 2", "10, moderate, 2", "10.1, high, 3", "18, high, 3"})
    void driftIsSlightAboveFivePercentAndHighAboveTen(double percent, String variant, int weight) {
        Finding finding = RunSummaryRules.drift(new SummaryInputs(plain(), List.of(), null, new Drift(percent, 140, 150), null)).orElseThrow();

        assertThat(finding.id()).isEqualTo("drift");
        assertThat(finding.variant()).isEqualTo(variant);
        assertThat(finding.weight()).isEqualTo(weight);
        assertThat(fact(finding, "driftPercent")).isEqualTo(percent);
        assertThat(fact(finding, "firstHalfHeartRate")).isEqualTo(140L);
        assertThat(fact(finding, "secondHalfHeartRate")).isEqualTo(150L);
        assertThat(fact(finding, "minutes")).isEqualTo(50);
        assertThat(finding.thresholds()).containsEntry("moderatePercent", 5.0).containsEntry("highPercent", 10.0).containsEntry("minMinutes", 20);
    }

    @Test
    void aHighDriftIsCautionAndALowOneIsPositive() {
        assertThat(RunSummaryRules.drift(new SummaryInputs(plain(), List.of(), null, new Drift(12, 140, 150), null)).orElseThrow().tone()).isEqualTo("caution");
        assertThat(RunSummaryRules.drift(new SummaryInputs(plain(), List.of(), null, new Drift(2, 140, 142), null)).orElseThrow().tone()).isEqualTo("positive");
        assertThat(RunSummaryRules.drift(new SummaryInputs(plain(), List.of(), null, new Drift(7, 140, 146), null)).orElseThrow().tone()).isEqualTo("neutral");
    }

    @Test
    void noDriftLineForAWorkoutForARunUnderTwentyMinutesOrWithoutAStream() {
        Drift drift = new Drift(12, 140, 150);
        assertThat(RunSummaryRules.drift(new SummaryInputs(run("WORKOUT", 10, 3000, null, null, null), List.of(), null, drift, null))).isEmpty();
        assertThat(RunSummaryRules.drift(new SummaryInputs(run(null, 3, 1199, null, null, null), List.of(), null, drift, null))).isEmpty();
        assertThat(RunSummaryRules.drift(new SummaryInputs(run(null, 3, 1200, null, null, null), List.of(), null, drift, null))).isPresent();
        assertThat(RunSummaryRules.drift(inputs(plain(), List.of()))).isEmpty();
    }

    // =============================================================================================== form

    @ParameterizedTest(name = "form {0} on a fitness of {1} -> {2}")
    @CsvSource({"20, 100, fresh", "10.1, 100, fresh", "10, 100, none", "-10, 100, none", "-10.1, 100, tired", "-30, 100, tired", "4, 20, fresh", "2.9, 20, none", "-2.9, 20, none", "-4, 20, tired"})
    void formIsFreshAboveATenthOfFitnessAndTiredBelowMinusATenthAndASwingUnderThreeIsNeitherOne(double form, double fitness, String variant) {
        SummaryInputs in = new SummaryInputs(plain(), List.of(), null, null, new Form(DAY.minusDays(1), fitness, fitness - form, form));

        Optional<Finding> finding = RunSummaryRules.form(in);

        if ("none".equals(variant)) {
            assertThat(finding).isEmpty();
        } else {
            assertThat(finding.orElseThrow().variant()).isEqualTo(variant);
            assertThat(finding.orElseThrow().weight()).isEqualTo(2);
        }
    }

    @Test
    void theFormLineSaysWhichDayTheNumbersAreFromAndTheTiredOnesAreCaution() {
        Finding finding = RunSummaryRules.form(new SummaryInputs(plain(), List.of(), null, null, new Form(DAY.minusDays(1), 100, 125.5, -25.5))).orElseThrow();

        assertThat(finding.variant()).isEqualTo("tired");
        assertThat(finding.tone()).isEqualTo("caution");
        assertThat(fact(finding, "form")).isEqualTo(-25.5);
        assertThat(fact(finding, "fitness")).isEqualTo(100.0);
        assertThat(fact(finding, "fatigue")).isEqualTo(125.5);
        assertThat(fact(finding, "day")).isEqualTo("2026-10-09");
        assertThat(finding.thresholds()).containsEntry("bandPercent", 10).containsEntry("minSwing", 3.0);
        assertThat(RunSummaryRules.form(new SummaryInputs(plain(), List.of(), null, null, new Form(DAY.minusDays(1), 100, 80, 20))).orElseThrow().tone())
                .isEqualTo("positive");
    }

    @Test
    void noFormLineWithoutAnyFormToSay() {
        assertThat(RunSummaryRules.form(inputs(plain(), List.of()))).isEmpty();
    }

    // =============================================================================================== climb

    @Test
    void aRunIsHillyFromTwelveMetresAKilometre() {
        assertThat(RunSummaryRules.climb(inputs(run(null, 10, 3000, null, 119.0, null), List.of()))).isEmpty();
        Finding finding = RunSummaryRules.climb(inputs(run(null, 10, 3000, null, 120.0, null), List.of())).orElseThrow();

        assertThat(finding.variant()).isEqualTo("hilly");
        assertThat(finding.weight()).isEqualTo(2);
        assertThat(fact(finding, "climbMetres")).isEqualTo(120L);
        assertThat(fact(finding, "metresPerKm")).isEqualTo(12.0);
        assertThat(finding.thresholds()).containsEntry("hillyMetresPerKm", 12.0).containsEntry("paceDifferenceSeconds", 5.0);
    }

    @Test
    void theGradeAdjustedPaceIsOnlyMentionedWhenItDiffersFromTheClockByFiveSecondsOrMore() {
        Run hilly = run(null, 10, 3000, null, 200.0, null);

        Finding noticeable = RunSummaryRules.climb(new SummaryInputs(hilly, List.of(), new Splits(List.of(), false, 331.0, 302.0), null, null)).orElseThrow();
        assertThat(fact(noticeable, "paceSecPerKm")).isEqualTo(331.0);
        assertThat(fact(noticeable, "gradeAdjustedPaceSecPerKm")).isEqualTo(302.0);

        Finding notWorthSaying = RunSummaryRules.climb(new SummaryInputs(hilly, List.of(), new Splits(List.of(), false, 305.0, 301.0), null, null)).orElseThrow();
        assertThat(notWorthSaying.facts()).doesNotContainKeys("paceSecPerKm", "gradeAdjustedPaceSecPerKm");

        Finding noElevationModel = RunSummaryRules.climb(new SummaryInputs(hilly, List.of(), new Splits(List.of(), false, 331.0, null), null, null)).orElseThrow();
        assertThat(noElevationModel.facts()).doesNotContainKey("gradeAdjustedPaceSecPerKm");
    }

    @Test
    void noClimbLineWhenThereIsNoElevation() {
        assertThat(RunSummaryRules.climb(inputs(plain(), List.of()))).isEmpty();
        assertThat(RunSummaryRules.climb(inputs(run(null, 0, 3000, null, 500.0, null), List.of()))).isEmpty();
    }

    // =============================================================================================== longest run

    @Test
    void theLongestRunOfTheLastFourWeeksIsSaidWhenThereWereEnoughRunsToBeTheLongestAmong() {
        List<RecentRun> before = List.of(earlier(3, null, 8, 2400, null), earlier(8, null, 9.5, 2850, null), earlier(14, null, 5, 1500, null), earlier(20, null, 10, 3000, null));

        Finding finding = RunSummaryRules.longest(inputs(run(null, 12, 3600, null, null, null), before)).orElseThrow();

        assertThat(finding.variant()).isEqualTo("longest");
        assertThat(finding.weight()).isEqualTo(3);
        assertThat(finding.tone()).isEqualTo("positive");
        assertThat(fact(finding, "distanceKm")).isEqualTo(12.0);
        assertThat(fact(finding, "previousLongestKm")).isEqualTo(10.0);
        assertThat(fact(finding, "count")).isEqualTo(4);
        assertThat(fact(finding, "windowDays")).isEqualTo(28);
        assertThat(finding.thresholds()).containsEntry("windowDays", 28).containsEntry("minRuns", 4).containsEntry("minKm", 5.0);
    }

    @Test
    void aRunThatMerelyEqualsTheLongestIsNotTheLongest() {
        List<RecentRun> before = List.of(earlier(3, null, 12, 3600, null), earlier(8, null, 9.5, 2850, null), earlier(14, null, 5, 1500, null), earlier(20, null, 10, 3000, null));
        assertThat(RunSummaryRules.longest(inputs(run(null, 12, 3600, null, null, null), before))).isEmpty();
    }

    @Test
    void theWindowIsTwentyEightDaysAndNeedsFourRunsAndWorkoutsDoNotCount() {
        List<RecentRun> three = List.of(earlier(3, null, 8, 2400, null), earlier(8, null, 9, 2700, null), earlier(14, null, 5, 1500, null));
        assertThat(RunSummaryRules.longest(inputs(run(null, 12, 3600, null, null, null), three))).isEmpty();

        List<RecentRun> fourthJustInside = new ArrayList<>(three);
        fourthJustInside.add(earlier(28, null, 6, 1800, null));
        assertThat(RunSummaryRules.longest(inputs(run(null, 12, 3600, null, null, null), fourthJustInside))).isPresent();

        List<RecentRun> fourthJustOutside = new ArrayList<>(three);
        fourthJustOutside.add(earlier(29, null, 6, 1800, null));
        assertThat(RunSummaryRules.longest(inputs(run(null, 12, 3600, null, null, null), fourthJustOutside))).isEmpty();

        List<RecentRun> workoutDoesNotCount = new ArrayList<>(three);
        workoutDoesNotCount.add(earlier(10, "WORKOUT", 20, 6000, null));
        assertThat(RunSummaryRules.longest(inputs(run(null, 12, 3600, null, null, null), workoutDoesNotCount))).isEmpty();
    }

    @Test
    void aShortRunOrAWorkoutIsNeverTheLongestOfAnything() {
        List<RecentRun> before = List.of(earlier(3, null, 1, 300, null), earlier(8, null, 2, 600, null), earlier(14, null, 1.5, 450, null), earlier(20, null, 2, 600, null));
        assertThat(RunSummaryRules.longest(inputs(run(null, 4.9, 1500, null, null, null), before))).isEmpty();
        assertThat(RunSummaryRules.longest(inputs(run(null, 5, 1500, null, null, null), before))).isPresent();
        assertThat(RunSummaryRules.longest(inputs(run("WORKOUT", 12, 3600, null, null, null), before))).isEmpty();
    }

    // =============================================================================================== what is shown

    @Test
    void theHeadlineIsAlwaysFirstAndALoneRunWithNothingToCompareWithGetsOnlyTheHeadline() {
        List<Finding> findings = RunSummaryRules.evaluate(inputs(plain(), List.of()));

        assertThat(findings).hasSize(1);
        assertThat(findings.get(0).id()).isEqualTo("character");
    }

    @Test
    void theMostWorthSayingComeFirstAndTiesKeepTheFixedOrder() {
        SummaryInputs in = new SummaryInputs(
                run(null, 12, 3300, 100.0, 200.0, zones(2400, 0, 0, 0, 0)),
                union(usual(8, 80, 3000), List.of(earlier(9, null, 8, 2400, 70.0))),
                splits(290, 290, 290, 290, 290, 290, 290, 290, 290, 290, 285, 285),
                new Drift(12, 140, 152),
                new Form(DAY.minusDays(1), 100, 130, -30));

        List<Finding> findings = RunSummaryRules.evaluate(in);

        // Three lines are worth three (the longest run, the hardest effort, a high drift), in the fixed order; of the ones
        // worth two (pace, form, climb) only the first fits under the cap of four.
        assertThat(findings.stream().map(Finding::id).toList()).containsExactly("character", "longest", "effort", "drift", "pace");
        assertThat(findings.stream().skip(1).map(Finding::weight).toList()).containsExactly(3, 3, 3, 2);
    }

    @Test
    void atMostFourLinesAreShownBesidesTheHeadline() {
        SummaryInputs in = new SummaryInputs(
                run(null, 12, 3300, 100.0, 200.0, zones(2400, 0, 0, 0, 0)),
                union(usual(8, 80, 3000), List.of(earlier(9, null, 8, 2400, 70.0))),
                splits(290, 290, 290, 290, 290, 290, 290, 290, 290, 290, 270, 270),
                new Drift(12, 140, 152),
                new Form(DAY.minusDays(1), 100, 130, -30));

        assertThat(RunSummaryRules.evaluate(in)).hasSize(5);
    }

    @Test
    void linesThatSayAsUsualAreOnlyShownToMakeUpTwoLines() {
        // pace similar (1), effort typical (1), shape even (1), and nothing else to say: two of them, in the fixed order.
        SummaryInputs in = new SummaryInputs(
                run(null, 10, 3000, 80.0, null, null), usual(6, 80, 3000), splits(300, 300, 300, 300), null, null);

        List<String> ids = RunSummaryRules.evaluate(in).stream().map(Finding::id).toList();

        assertThat(ids).containsExactly("character", "effort", "shape");
    }

    @Test
    void oneNotableLineBringsOneAsUsualLineAlong() {
        // pace faster (2); effort typical (1); shape even (1): the notable one and the first filler.
        SummaryInputs in = new SummaryInputs(
                run(null, 10, 2800, 80.0, null, null), usual(6, 80, 3000), splits(280, 280, 280, 280), null, null);

        List<Finding> findings = RunSummaryRules.evaluate(in);

        assertThat(findings.stream().map(Finding::id).toList()).containsExactly("character", "pace", "effort");
    }

    @Test
    void twoNotableLinesPushTheAsUsualOnesOut() {
        SummaryInputs in = new SummaryInputs(
                run(null, 10, 2800, 80.0, null, null), usual(6, 80, 3000), splits(280, 280, 274, 274), null,
                new Form(DAY.minusDays(1), 100, 130, -30));

        List<String> ids = RunSummaryRules.evaluate(in).stream().map(Finding::id).toList();

        assertThat(ids).containsExactly("character", "shape", "pace", "form");
    }

    @Test
    void aRaceIsNeverComparedWithTrainingAndAWorkoutGetsNoPacingOrHeartRateVerdict() {
        Splits even = splits(300, 300, 300, 300, 300, 300, 300, 300, 300, 300);
        Drift drift = new Drift(12, 140, 152);

        List<String> race = RunSummaryRules.evaluate(new SummaryInputs(run("RACE", 10, 3000, 90.0, null, zones(2400, 0, 0, 0, 0)), usual(8, 80, 3000), even, drift, null))
                .stream().map(Finding::id).toList();
        List<String> workout = RunSummaryRules.evaluate(new SummaryInputs(run("WORKOUT", 10, 3000, 90.0, null, zones(2400, 0, 0, 0, 0)), usual(8, 80, 3000), even, drift, null))
                .stream().map(Finding::id).toList();

        assertThat(race).doesNotContain("pace", "effort");
        assertThat(race).contains("shape", "drift");
        assertThat(workout).doesNotContain("pace", "shape", "drift");
    }

    private static List<RecentRun> union(List<RecentRun> a, List<RecentRun> b) {
        List<RecentRun> all = new ArrayList<>(a);
        all.addAll(b);
        return all;
    }
}
