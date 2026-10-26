package com.hermes.backend.coaching;

import com.hermes.backend.activity.Activity;
import com.hermes.backend.activity.ActivityRepository;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.activity.ImportProvider;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * The weekly intensity distribution against a real schema: how runs are grouped into the runner's weeks, whose rows
 * count, what a run with no heart-rate stream adds, and the name the spread is given.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:training-intensity-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class TrainingIntensityServiceIntegrationTests {

    /** Saturday 10 October 2026, 16:00 UTC; the week of that day starts on Monday 5 October. */
    private static final Instant NOW = Instant.parse("2026-10-10T16:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 10);
    private static final LocalDate THIS_MONDAY = LocalDate.of(2026, 10, 5);

    @Autowired private ActivityTrainingMetricsRepository metrics;
    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;
    @Autowired private TrainingZonesService zones;

    private TrainingIntensityService service() {
        TrainingSeriesService series = new TrainingSeriesService(metrics, zones, 42, 7, 0.2, 400, Clock.fixed(NOW, ZoneOffset.UTC));
        return new TrainingIntensityService(metrics, series);
    }

    private Runner runner(String timeZone) {
        Runner runner = new Runner("intensity-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    /** A run on a day with the minutes it spent in zones 1 to 5; no minutes at all is a run with no heart-rate stream. */
    private void run(Runner owner, LocalDate day, int... zoneMinutes) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run " + UUID.randomUUID());
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, LocalTime.NOON));
        run.setMovingTimeSeconds(1800);
        run.setDistanceKm(5.0);
        run = activities.saveAndFlush(run);
        ActivityTrainingMetrics row = new ActivityTrainingMetrics(run, owner);
        row.setLocalDate(day);
        row.setEffortScore(50.0);
        int[] seconds = new int[5];
        int covered = 0;
        for (int i = 0; i < zoneMinutes.length; i++) {
            seconds[i] = zoneMinutes[i] * 60;
            covered += seconds[i];
        }
        row.setZoneSeconds(seconds);
        row.setHrCoveredSeconds(covered);
        row.setEffortSource(covered > 0 ? "HR_ZONES" : "PACE_MODEL");
        row.setZonesUsed(zones.resolve(owner).zones());
        row.setModelVersion(TrainingMetricsService.MODEL_VERSION);
        row.setStale(false);
        row.setComputedAt(LocalDateTime.of(2026, 10, 10, 8, 0));
        metrics.saveAndFlush(row);
    }

    @Test
    void aRunnerWhoHasNotRunHasNoWeeksAndNothingToSay() {
        TrainingIntensityService.IntensityResponse answer = service().intensity(runner(null), null);

        assertThat(answer.today()).isEqualTo(TODAY);
        assertThat(answer.weeks()).isEmpty();
        assertThat(answer.summary().runs()).isZero();
        assertThat(answer.summary().shares()).isNull();
        assertThat(answer.summary().polarizationIndex()).isNull();
        assertThat(answer.summary().pattern()).isEqualTo("insufficient");
        assertThat(answer.pendingRuns()).isZero();
        assertThat(answer.lowZones()).isEqualTo(3);
        assertThat(answer.minRuns()).isEqualTo(3);
        assertThat(answer.minCoveredSeconds()).isEqualTo(3600);
    }

    @Test
    void theTimeInZonesIsAddedUpPerWeekFromMondayToSunday() {
        Runner owner = runner(null);
        // The week before this one (Mon 28 Sep to Sun 4 Oct): two runs on a Sunday and one on the Monday.
        run(owner, THIS_MONDAY.minusDays(1), 10, 20, 5, 3, 2);
        run(owner, THIS_MONDAY.minusDays(1), 30, 0, 0, 0, 0);
        run(owner, THIS_MONDAY.minusWeeks(1), 0, 15, 15, 0, 0);
        // This week: one run on Monday.
        run(owner, THIS_MONDAY, 20, 20, 10, 5, 5);

        TrainingIntensityService.IntensityResponse answer = service().intensity(owner, 2);

        assertThat(answer.weeks()).hasSize(2);
        TrainingIntensityService.WeekRow before = answer.weeks().get(0);
        assertThat(before.start()).isEqualTo(THIS_MONDAY.minusWeeks(1));
        assertThat(before.end()).isEqualTo(THIS_MONDAY.minusDays(1));
        assertThat(before.complete()).isTrue();
        assertThat(before.runs()).isEqualTo(3);
        assertThat(before.runsWithHeartRate()).isEqualTo(3);
        assertThat(before.zoneSeconds()).containsExactly((10 + 30 + 0) * 60L, (20 + 0 + 15) * 60L, (5 + 0 + 15) * 60L, 3 * 60L, 2 * 60L);
        assertThat(before.coveredSeconds()).isEqualTo((40 + 35 + 20 + 3 + 2) * 60L);

        TrainingIntensityService.WeekRow current = answer.weeks().get(1);
        assertThat(current.start()).isEqualTo(THIS_MONDAY);
        assertThat(current.end()).isEqualTo(THIS_MONDAY.plusDays(6));
        assertThat(current.complete()).isFalse();
        assertThat(current.runs()).isEqualTo(1);
        assertThat(current.zoneSeconds()).containsExactly(1200L, 1200L, 600L, 300L, 300L);
    }

    @Test
    void aRunWithNoHeartRateStreamIsARunAndAddsNoTime() {
        Runner owner = runner(null);
        run(owner, THIS_MONDAY, 20, 20, 10, 0, 0);
        run(owner, THIS_MONDAY.plusDays(1));          // a run from a phone: no zones
        run(owner, THIS_MONDAY.plusDays(2));

        TrainingIntensityService.IntensityResponse answer = service().intensity(owner, 1);

        assertThat(answer.weeks()).hasSize(1);
        assertThat(answer.weeks().get(0).runs()).isEqualTo(3);
        assertThat(answer.weeks().get(0).runsWithHeartRate()).isEqualTo(1);
        assertThat(answer.weeks().get(0).coveredSeconds()).isEqualTo(50 * 60L);
        assertThat(answer.summary().runs()).isEqualTo(3);
        assertThat(answer.summary().runsWithHeartRate()).isEqualTo(1);
    }

    @Test
    void aWeekWithNoRunStaysInTheListAsAnEmptyWeek() {
        Runner owner = runner(null);
        run(owner, THIS_MONDAY.minusWeeks(3), 30, 0, 0, 0, 0);
        run(owner, THIS_MONDAY, 30, 0, 0, 0, 0);

        TrainingIntensityService.IntensityResponse answer = service().intensity(owner, 4);

        assertThat(answer.weeks()).hasSize(4);
        assertThat(answer.weeks().get(1).runs()).isZero();
        assertThat(answer.weeks().get(1).coveredSeconds()).isZero();
        assertThat(answer.weeks().get(1).zoneSeconds()).containsOnly(0L);
    }

    @Test
    void weeksBeforeTheRunnersFirstRunAreNotListed() {
        Runner owner = runner(null);
        run(owner, THIS_MONDAY.minusWeeks(1), 30, 0, 0, 0, 0);

        TrainingIntensityService.IntensityResponse answer = service().intensity(owner, 12);

        assertThat(answer.weeks()).hasSize(2);
        assertThat(answer.weeks().get(0).start()).isEqualTo(THIS_MONDAY.minusWeeks(1));
    }

    @Test
    void aPolarizedMonthIsNamedPolarizedWithItsSharesAndIndex() {
        Runner owner = runner(null);
        // 200 minutes in a week, four weeks running: 80% in zones 1 to 3, 5% in zone 4, 15% in zone 5.
        for (int back = 0; back < 4; back++) {
            run(owner, THIS_MONDAY.minusWeeks(back), 60, 60, 40, 10, 30);
        }

        TrainingIntensityService.Summary summary = service().intensity(owner, 4).summary();

        assertThat(summary.runs()).isEqualTo(4);
        assertThat(summary.runsWithHeartRate()).isEqualTo(4);
        assertThat(summary.coveredSeconds()).isEqualTo(4 * 200 * 60L);
        assertThat(summary.zoneSeconds()).containsExactly(4 * 3600L, 4 * 3600L, 4 * 2400L, 4 * 600L, 4 * 1800L);
        assertThat(summary.shares().low()).isCloseTo(0.8, within(1e-9));
        assertThat(summary.shares().moderate()).isCloseTo(0.05, within(1e-9));
        assertThat(summary.shares().high()).isCloseTo(0.15, within(1e-9));
        assertThat(summary.polarizationIndex()).isCloseTo(2.38, within(0.005));
        assertThat(summary.pattern()).isEqualTo("polarized");
    }

    @Test
    void tooFewRunsWithAHeartRateNameNothingButStillGiveTheShares() {
        Runner owner = runner(null);
        run(owner, THIS_MONDAY, 120, 0, 0, 0, 0);
        run(owner, THIS_MONDAY.plusDays(1), 120, 0, 0, 0, 0);

        TrainingIntensityService.Summary summary = service().intensity(owner, 1).summary();

        assertThat(summary.pattern()).isEqualTo("insufficient");
        assertThat(summary.shares().low()).isEqualTo(1.0);
    }

    @Test
    void anotherRunnersTimeInZonesIsNotCounted() {
        Runner mine = runner(null);
        Runner theirs = runner(null);
        run(mine, THIS_MONDAY, 30, 0, 0, 0, 0);
        run(theirs, THIS_MONDAY, 0, 0, 0, 0, 90);

        TrainingIntensityService.Summary summary = service().intensity(mine, 1).summary();

        assertThat(summary.zoneSeconds()).containsExactly(1800L, 0L, 0L, 0L, 0L);
        assertThat(summary.runs()).isEqualTo(1);
    }

    @Test
    void aRunnerInAnotherTimeZoneHasTheirOwnToday() {
        // 16:00 UTC on Saturday the 10th is 05:00 on Sunday the 11th in Auckland, so the week of today is the same
        // week (Monday 5 October) but the day is one later.
        Runner owner = runner("Pacific/Auckland");
        run(owner, LocalDate.of(2026, 10, 11), 30, 0, 0, 0, 0);

        TrainingIntensityService.IntensityResponse answer = service().intensity(owner, 1);

        assertThat(answer.timeZone()).isEqualTo("Pacific/Auckland");
        assertThat(answer.today()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(answer.weeks()).hasSize(1);
        assertThat(answer.weeks().get(0).start()).isEqualTo(THIS_MONDAY);
        assertThat(answer.weeks().get(0).coveredSeconds()).isEqualTo(1800L);
    }

    @Test
    void aWeekCountOutsideOneToFiftyTwoIsRefused() {
        Runner owner = runner(null);

        assertThatThrownBy(() -> service().intensity(owner, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service().intensity(owner, 53)).isInstanceOf(IllegalArgumentException.class);
        assertThat(service().intensity(owner, 52).weeks()).isEmpty();
        assertThat(service().intensity(owner, null).weeks()).isEmpty();
    }
}
