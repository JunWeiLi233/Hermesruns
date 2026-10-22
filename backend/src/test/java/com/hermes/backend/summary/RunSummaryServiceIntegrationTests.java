package com.hermes.backend.summary;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.activity.PaceProfileResponse;
import com.hermes.backend.coaching.ActivityTrainingMetrics;
import com.hermes.backend.coaching.ActivityTrainingMetricsRepository;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The run summary against a real schema: whose runs are read, which of them count as "before", what a run too short is
 * told, and that the form going in is the form of the day before.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:summary-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class RunSummaryServiceIntegrationTests {

    /** A day well in the past, so the real clock behind the fitness series never clips it. */
    private static final LocalDate DAY = LocalDate.of(2026, 3, 15);

    @Autowired private RunSummaryService service;
    @Autowired private ActivityRepository activities;
    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private RunnerRepository runners;
    @Autowired private TrainingZonesService zones;

    private Runner runner(String timeZone) {
        Runner runner = new Runner("summary-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    /** A run on a day with its effort row as the run page would have stored it. */
    private Activity run(Runner owner, LocalDate day, double km, int seconds, String type, Double effort, int[] zoneSeconds) {
        return run(owner, LocalDateTime.of(day, LocalTime.NOON), day, km, seconds, type, effort, zoneSeconds, ActivityType.RUN);
    }

    private Activity run(Runner owner, LocalDateTime start, LocalDate localDay, double km, int seconds, String type, Double effort,
                         int[] zoneSeconds, ActivityType kind) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(kind);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(start);
        run.setMovingTimeSeconds(seconds);
        run.setDurationSeconds((long) seconds);
        run.setDistanceKm(km);
        run.setDistanceMeters(km * 1000.0);
        run.setRunType(type);
        run = activities.saveAndFlush(run);
        if (effort != null || zoneSeconds != null) {
            ActivityTrainingMetrics row = new ActivityTrainingMetrics(run, owner);
            row.setLocalDate(localDay);
            row.setEffortScore(effort);
            row.setEffortSource("HR_ZONES");
            row.setZonesUsed(zones.resolve(owner).zones());
            row.setModelVersion(1);
            row.setStale(false);
            row.setComputedAt(LocalDateTime.of(2026, 3, 16, 8, 0));
            if (zoneSeconds != null) {
                row.setZoneSeconds(zoneSeconds);
                row.setHrCoveredSeconds(zoneSeconds[0] + zoneSeconds[1] + zoneSeconds[2] + zoneSeconds[3] + zoneSeconds[4]);
            }
            metrics.saveAndFlush(row);
        }
        return run;
    }

    /** n earlier runs of 10 km in 50 minutes, one a day back from yesterday, each with this effort. */
    private void usual(Runner owner, int count, double effort) {
        for (int i = 1; i <= count; i++) {
            run(owner, DAY.minusDays(i), 10, 3000, null, effort, null);
        }
    }

    private static List<String> ids(RunSummary summary) {
        return summary.findings().stream().map(RunSummary.Finding::id).toList();
    }

    private static RunSummary.Finding finding(RunSummary summary, String id) {
        return summary.findings().stream().filter(one -> one.id().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void aRunWithAHistoryGetsAHeadlineAndTheLinesTheirNumbersCanSupport() {
        Runner owner = runner(null);
        usual(owner, 10, 80);
        Activity today = run(owner, DAY, 10, 2800, null, 120.0, null);

        RunSummary summary = service.summarise(owner, today.getId()).orElseThrow();

        assertThat(summary.state()).isEqualTo("ready");
        assertThat(summary.reason()).isNull();
        assertThat(summary.runId()).isEqualTo(today.getId());
        assertThat(summary.day()).isEqualTo(DAY);
        assertThat(ids(summary)).containsExactly("character", "effort", "pace");
        assertThat(summary.findings().get(0).variant()).isEqualTo("hard");
        assertThat(summary.findings().get(0).facts()).containsEntry("basis", "effort").containsEntry("usualEffort", 80.0);
        RunSummary.Finding effort = finding(summary, "effort");
        assertThat(effort.variant()).isEqualTo("hardest");
        assertThat(effort.facts()).containsEntry("effort", 120.0).containsEntry("usualEffort", 80.0).containsEntry("count", 10);
        RunSummary.Finding pace = finding(summary, "pace");
        assertThat(pace.variant()).isEqualTo("faster");
        assertThat(pace.facts()).containsEntry("paceSecPerKm", 280.0).containsEntry("recentPaceSecPerKm", 300.0).containsEntry("count", 10);
    }

    @Test
    void theHeartRateZonesOfTheRunGiveTheHeadline() {
        Runner owner = runner(null);
        Activity easy = run(owner, DAY, 8, 2700, null, 50.0, new int[] {600, 1500, 400, 100, 0});

        RunSummary summary = service.summarise(owner, easy.getId()).orElseThrow();

        assertThat(summary.findings().get(0).variant()).isEqualTo("easy");
        assertThat(summary.findings().get(0).facts()).containsEntry("basis", "zones").containsEntry("easyPercent", 81);
    }

    @Test
    void aRunTooShortToReadAnythingFromIsToldSoRatherThanGivenAHeadline() {
        Runner owner = runner(null);
        Activity short1 = run(owner, DAY, 0.9, 600, null, 10.0, null);
        Activity short2 = run(owner, DAY, 3, 299, null, 10.0, null);

        RunSummary tooFar = service.summarise(owner, short1.getId()).orElseThrow();
        RunSummary tooBrief = service.summarise(owner, short2.getId()).orElseThrow();

        assertThat(tooFar.state()).isEqualTo("none");
        assertThat(tooFar.reason()).isEqualTo("too_short");
        assertThat(tooFar.findings()).isEmpty();
        assertThat(tooBrief.state()).isEqualTo("none");
        assertThat(tooBrief.reason()).isEqualTo("too_short");
    }

    @Test
    void aKilometreInFiveMinutesIsEnoughToBeginWith() {
        Runner owner = runner(null);
        Activity justEnough = run(owner, DAY, 1.0, 300, null, 10.0, null);

        assertThat(service.summarise(owner, justEnough.getId()).orElseThrow().state()).isEqualTo("ready");
    }

    @Test
    void aRunThatIsNotTheRunnersOrNotARunOrNotThereIsNoSummary() {
        Runner owner = runner(null);
        Runner stranger = runner(null);
        Activity theirs = run(stranger, DAY, 10, 3000, null, 80.0, null);
        Activity ride = run(owner, LocalDateTime.of(DAY, LocalTime.NOON), DAY, 30, 3600, null, 50.0, null, ActivityType.NON_RUN);

        assertThat(service.summarise(owner, theirs.getId())).isEmpty();
        assertThat(service.summarise(owner, ride.getId())).isEmpty();
        assertThat(service.summarise(owner, 987654321L)).isEmpty();
        assertThat(service.summarise(stranger, theirs.getId())).isPresent();
    }

    @Test
    void onlyTheRunnersOwnRunsAreComparedWith() {
        Runner owner = runner(null);
        Runner stranger = runner(null);
        usual(owner, 5, 80);
        // Ten much faster and much easier runs of someone else's must change nothing about this runner's summary.
        for (int i = 1; i <= 10; i++) {
            run(stranger, DAY.minusDays(i), 10, 2000, null, 30.0, null);
        }
        Activity today = run(owner, DAY, 10, 3000, null, 80.0, null);

        RunSummary summary = service.summarise(owner, today.getId()).orElseThrow();

        assertThat(finding(summary, "pace").variant()).isEqualTo("similar");
        assertThat(finding(summary, "pace").facts()).containsEntry("count", 5).containsEntry("recentPaceSecPerKm", 300.0);
        assertThat(finding(summary, "effort").variant()).isEqualTo("typical");
    }

    @Test
    void onlyRunsOnEarlierDaysAreBeforeTheRunNeitherLaterOnesNorTheSameDay() {
        Runner owner = runner(null);
        usual(owner, 2, 80);
        run(owner, DAY, 10, 2000, null, 80.0, null);                    // earlier on the same day: not "before"
        run(owner, DAY.plusDays(1), 10, 2000, null, 80.0, null);        // later
        run(owner, DAY.plusDays(2), 10, 2000, null, 80.0, null);
        Activity today = run(owner, DAY, 10, 3000, null, 80.0, null);

        RunSummary summary = service.summarise(owner, today.getId()).orElseThrow();

        // Two earlier days is not enough to compare a pace with (three are needed).
        assertThat(ids(summary)).doesNotContain("pace");
    }

    @Test
    void theEffortIsComparedWithNinetyDaysOfRunsAndThePaceWithOnlyThirty() {
        Runner owner = runner(null);
        // Five runs, all between 40 and 44 days before: inside the ninety days of the effort comparison, outside the thirty of the pace's.
        for (int i = 40; i <= 44; i++) {
            run(owner, DAY.minusDays(i), 10, 3000, null, 80.0, null);
        }
        Activity today = run(owner, DAY, 10, 3000, null, 80.0, null);

        RunSummary summary = service.summarise(owner, today.getId()).orElseThrow();

        assertThat(ids(summary)).contains("effort");
        assertThat(ids(summary)).doesNotContain("pace");
        assertThat(finding(summary, "effort").facts()).containsEntry("count", 5);
    }

    @Test
    void aRunsDayIsTheOneItsEffortRowIsFiledUnderOnTheRunnersOwnCalendar() {
        Runner owner = runner("Pacific/Auckland");
        // 23:30 UTC on the 14th is the 15th in Auckland in March (UTC+13).
        Activity night = run(owner, LocalDateTime.of(2026, 3, 14, 23, 30), LocalDate.of(2026, 3, 15), 10, 3000, null, 80.0, null, ActivityType.RUN);

        RunSummary summary = service.summarise(owner, night.getId()).orElseThrow();

        assertThat(summary.day()).isEqualTo(LocalDate.of(2026, 3, 15));
    }

    @Test
    void goingInTiredIsSaidWhenTheDaysBeforeWereHeavyAndTheHistoryIsLongEnough() {
        Runner owner = runner(null);
        // Forty days of steady, hard effort: fatigue has caught up with fitness and form is well below zero.
        for (int i = 1; i <= 40; i++) {
            run(owner, DAY.minusDays(i), 10, 3000, null, 100.0, null);
        }
        Activity today = run(owner, DAY, 10, 3000, null, 100.0, null);

        RunSummary summary = service.summarise(owner, today.getId()).orElseThrow();

        RunSummary.Finding form = finding(summary, "form");
        assertThat(form.variant()).isEqualTo("tired");
        assertThat(form.facts()).containsEntry("day", "2026-03-14");
        assertThat((Double) form.facts().get("form")).isNegative();
    }

    @Test
    void goingInFreshIsSaidAfterARestFollowingAStretchOfRunning() {
        Runner owner = runner(null);
        for (int i = 8; i <= 38; i++) {
            run(owner, DAY.minusDays(i), 10, 3000, null, 100.0, null);
        }
        Activity today = run(owner, DAY, 10, 3000, null, 100.0, null);

        RunSummary summary = service.summarise(owner, today.getId()).orElseThrow();

        assertThat(finding(summary, "form").variant()).isEqualTo("fresh");
    }

    @Test
    void lessThanTwoWeeksOfEffortBehindTheRunIsNotEnoughToSayHowFreshTheRunnerWas() {
        Runner owner = runner(null);
        for (int i = 1; i <= 13; i++) {
            run(owner, DAY.minusDays(i), 10, 3000, null, 100.0, null);
        }
        Activity today = run(owner, DAY, 10, 3000, null, 100.0, null);

        assertThat(ids(service.summarise(owner, today.getId()).orElseThrow())).doesNotContain("form");

        run(owner, DAY.minusDays(14), 10, 3000, null, 100.0, null);
        assertThat(ids(service.summarise(owner, today.getId()).orElseThrow())).contains("form");
    }

    @Test
    void aRunWithNoStreamAndNoHeartRateStillGetsTheLinesThatNeedNeither() {
        Runner owner = runner(null);
        usual(owner, 5, 80);
        Activity today = run(owner, DAY, 10, 3000, null, 80.0, null);

        RunSummary summary = service.summarise(owner, today.getId()).orElseThrow();

        assertThat(ids(summary)).doesNotContain("shape", "drift", "climb");
        assertThat(summary.findings()).isNotEmpty();
    }

    // ----- what the pace profile is turned into -----

    private static PaceProfileResponse.Split split(int index, Double pace, Double gap, boolean partial) {
        return new PaceProfileResponse.Split(index, partial ? 400 : 1000, 300, pace, gap, null, partial);
    }

    private static PaceProfileResponse profile(boolean hasStream, boolean hasElevation, List<PaceProfileResponse.Split> splits) {
        PaceProfileResponse.Summary summary = hasStream ? new PaceProfileResponse.Summary(5000, 1500, 1480, 20, 296.0, 290.0) : null;
        return new PaceProfileResponse(hasStream, hasElevation, summary, splits, null, null, hasStream ? null : "no_points");
    }

    @Test
    void noStreamMeansNoSplits() {
        assertThat(RunSummaryService.splits(null)).isNull();
        assertThat(RunSummaryService.splits(profile(false, false, List.of()))).isNull();
    }

    @Test
    void theFullKilometresAreUsedInTheOrderTheyCameLeavingOutTheLeftOverAndAnyWithNoPace() {
        List<PaceProfileResponse.Split> splits = List.of(split(1, 300.0, null, false), split(2, null, null, false), split(3, 310.0, null, false), split(4, 280.0, null, true));

        SummaryInputs.Splits mapped = RunSummaryService.splits(profile(true, false, splits));

        assertThat(mapped.paces()).containsExactly(300.0, 310.0);
        assertThat(mapped.gradeAdjusted()).isFalse();
        assertThat(mapped.paceSecPerKm()).isEqualTo(296.0);
        assertThat(mapped.gapSecPerKm()).isEqualTo(290.0);
    }

    @Test
    void theGradeAdjustedPacesAreUsedWhenEveryFullKilometreHasOneAndTheRunHadElevation() {
        List<PaceProfileResponse.Split> splits = List.of(split(1, 300.0, 280.0, false), split(2, 310.0, 295.0, false));

        SummaryInputs.Splits adjusted = RunSummaryService.splits(profile(true, true, splits));
        SummaryInputs.Splits noElevation = RunSummaryService.splits(profile(true, false, splits));
        SummaryInputs.Splits oneMissing = RunSummaryService.splits(profile(true, true, List.of(split(1, 300.0, 280.0, false), split(2, 310.0, null, false))));

        assertThat(adjusted.paces()).containsExactly(280.0, 295.0);
        assertThat(adjusted.gradeAdjusted()).isTrue();
        assertThat(noElevation.paces()).containsExactly(300.0, 310.0);
        assertThat(oneMissing.paces()).containsExactly(300.0, 310.0);
        assertThat(oneMissing.gradeAdjusted()).isFalse();
    }

    @Test
    void aRunWithNoFullKilometreHasNoPacesToJudgeButTheStreamIsStillThere() {
        SummaryInputs.Splits mapped = RunSummaryService.splits(profile(true, false, List.of(split(1, 280.0, null, true))));

        assertThat(mapped.paces()).isEmpty();
        assertThat(Optional.ofNullable(mapped.paceSecPerKm())).contains(296.0);
    }

    @Test
    void zonesAreOnlyPassedOnWhenThereWasHeartRateToHaveSpentThem() {
        Runner owner = runner(null);
        Activity withHeartRate = run(owner, DAY, 5, 1500, null, 50.0, new int[] {100, 200, 300, 400, 500});
        Activity without = run(owner, DAY.minusDays(1), 5, 1500, null, 50.0, null);

        ActivityTrainingMetrics rowWith = metrics.findByActivityIdAndRunnerId(withHeartRate.getId(), owner.getId()).orElseThrow();
        ActivityTrainingMetrics rowWithout = metrics.findByActivityIdAndRunnerId(without.getId(), owner.getId()).orElseThrow();

        assertThat(RunSummaryService.zones(rowWith)).containsExactly(100, 200, 300, 400, 500);
        assertThat(RunSummaryService.zones(rowWithout)).isNull();
    }
}
