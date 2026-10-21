package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.RunnerRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
 * The pace curve against a real schema: which effort of a distance counts, what a window keeps, what is left out (hidden
 * efforts and estimates), and the line fitted through the rest.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:pace-curve-service;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "strava.sync.enabled=false",
        "garmin.wellness.sync.enabled=false",
        "app.coach.nightly.enabled=false",
        "app.local-shared-runner.enabled=false"
})
class PaceCurveServiceIntegrationTests {

    /** Saturday 10 October 2026, 16:00 UTC: noon in New York, 05:00 on the 11th in Auckland. */
    private static final Instant NOW = Instant.parse("2026-10-10T16:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 10);

    @Autowired private ActivityBestEffortRepository efforts;
    @Autowired private ActivityRepository activities;
    @Autowired private RunnerRepository runners;

    private PaceCurveService service() {
        return new PaceCurveService(efforts, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private Runner runner(String timeZone) {
        Runner runner = new Runner("pace-curve-" + UUID.randomUUID() + "@hermes.test", "active");
        runner.setTimeZone(timeZone);
        return runners.saveAndFlush(runner);
    }

    private Activity run(Runner owner, LocalDate day) {
        Activity run = new Activity();
        run.setRunner(owner);
        run.setName("run on " + day);
        run.setActivityType(ActivityType.RUN);
        run.setProvider(ImportProvider.GARMIN);
        run.setStartTime(LocalDateTime.of(day, LocalTime.NOON));
        run.setMovingTimeSeconds(1800);
        run.setDistanceKm(5.0);
        run.setDistanceMeters(5000.0);
        run.setRecordsVersion(BestEffortService.MODEL_VERSION);
        return activities.saveAndFlush(run);
    }

    /** The effort at a distance in a run on a day: measured, not hidden. */
    private ActivityBestEffort effort(Runner owner, LocalDate day, String key, double seconds) {
        Activity run = run(owner, day);
        BestEffortDistances.Distance distance = BestEffortDistances.byKey(key).orElseThrow();
        ActivityBestEffort row = new ActivityBestEffort(run, owner, key, distance.meters());
        row.setMeasured(seconds, 10, 10 + (int) seconds, false, day, BestEffortService.MODEL_VERSION);
        return efforts.saveAndFlush(row);
    }

    /** Efforts that lie exactly on the line d = 200 + 4 t for t between three and forty minutes, on a day. */
    private void effortsOnTheLine(Runner owner, LocalDate day) {
        for (String key : List.of("half_mile", "1km", "1mile", "3km", "5km", "10km")) {
            double meters = BestEffortDistances.byKey(key).orElseThrow().meters();
            effort(owner, day, key, (meters - 200.0) / 4.0);
        }
    }

    @Test
    void aRunnerWithNoEffortsHasNoPointsAndNoLine() {
        PaceCurveService.PaceCurveResponse answer = service().paceCurve(runner(null), null, true);

        assertThat(answer.points()).isEmpty();
        assertThat(answer.model().status()).isEqualTo("too_few_points");
        assertThat(answer.model().criticalSpeedMps()).isNull();
        assertThat(answer.model().pointsUsed()).isZero();
        assertThat(answer.from()).isNull();
        assertThat(answer.days()).isNull();
        assertThat(answer.today()).isEqualTo(TODAY);
        assertThat(answer.limits().minSeconds()).isEqualTo(180);
        assertThat(answer.limits().maxSeconds()).isEqualTo(2400);
        assertThat(answer.limits().minPoints()).isEqualTo(3);
    }

    @Test
    void theFastestEffortAtEachDistanceCountsAndSaysWhichRunItWasIn() {
        Runner owner = runner(null);
        effort(owner, TODAY.minusDays(40), "5km", 1300);
        ActivityBestEffort best = effort(owner, TODAY.minusDays(20), "5km", 1250);
        effort(owner, TODAY.minusDays(5), "5km", 1280);
        effort(owner, TODAY.minusDays(7), "1km", 230);

        PaceCurveService.PaceCurveResponse answer = service().paceCurve(owner, 180, true);

        assertThat(answer.points()).extracting(PaceCurveService.Point::key).containsExactly("1km", "5km");
        PaceCurveService.Point five = answer.points().get(1);
        assertThat(five.seconds()).isEqualTo(1250.0);
        assertThat(five.paceSecondsPerKm()).isEqualTo(250.0);
        assertThat(five.date()).isEqualTo(TODAY.minusDays(20));
        assertThat(five.activityId()).isEqualTo(best.getActivity().getId());
        assertThat(five.name()).isEqualTo("run on " + TODAY.minusDays(20));
        assertThat(five.edited()).isFalse();
        assertThat(five.meters()).isEqualTo(5000.0);
    }

    @Test
    void aWindowOfDaysKeepsTheLastDaysTodayIncludedAndNoOlderOne() {
        Runner owner = runner(null);
        effort(owner, TODAY.minusDays(89), "5km", 1300);     // the first day of a 90-day window
        effort(owner, TODAY.minusDays(90), "5km", 1200);     // one day before it: faster, but out
        effort(owner, TODAY, "1km", 240);

        PaceCurveService.PaceCurveResponse ninety = service().paceCurve(owner, 90, true);
        PaceCurveService.PaceCurveResponse everything = service().paceCurve(owner, null, true);

        assertThat(ninety.from()).isEqualTo(TODAY.minusDays(89));
        assertThat(ninety.to()).isEqualTo(TODAY);
        assertThat(ninety.days()).isEqualTo(90);
        assertThat(ninety.points().stream().filter(point -> point.key().equals("5km")).findFirst().orElseThrow().seconds()).isEqualTo(1300.0);
        assertThat(everything.from()).isNull();
        assertThat(everything.points().stream().filter(point -> point.key().equals("5km")).findFirst().orElseThrow().seconds()).isEqualTo(1200.0);
    }

    @Test
    void anEstimateAndAHiddenEffortAreNotOnTheCurve() {
        Runner owner = runner(null);
        ActivityBestEffort estimate = effort(owner, TODAY.minusDays(3), "5km", 1100);
        estimate.setMeasured(1100, null, null, true, TODAY.minusDays(3), BestEffortService.MODEL_VERSION);
        efforts.saveAndFlush(estimate);
        ActivityBestEffort hidden = effort(owner, TODAY.minusDays(4), "10km", 2300);
        hidden.setHidden(true);
        efforts.saveAndFlush(hidden);
        effort(owner, TODAY.minusDays(5), "5km", 1350);

        PaceCurveService.PaceCurveResponse answer = service().paceCurve(owner, 30, true);

        assertThat(answer.points()).extracting(PaceCurveService.Point::key).containsExactly("5km");
        assertThat(answer.points().get(0).seconds()).isEqualTo(1350.0);
    }

    @Test
    void aTimeTheRunnerTypedCountsAsTheyTypedIt() {
        Runner owner = runner(null);
        ActivityBestEffort chip = effort(owner, TODAY.minusDays(3), "5km", 1260);
        chip.setEditedElapsedSeconds(1230);
        efforts.saveAndFlush(chip);

        PaceCurveService.Point point = service().paceCurve(owner, 30, true).points().get(0);

        assertThat(point.seconds()).isEqualTo(1230.0);
        assertThat(point.edited()).isTrue();
    }

    @Test
    void effortsOnALineGiveItsCriticalSpeedAndLeaveTheOutOfRangeOnesOutOfTheFit() {
        Runner owner = runner(null);
        effortsOnTheLine(owner, TODAY.minusDays(10));

        PaceCurveService.PaceCurveResponse answer = service().paceCurve(owner, 90, true);

        PaceCurveService.Model model = answer.model();
        assertThat(model.status()).isEqualTo("ok");
        assertThat(model.criticalSpeedMps()).isCloseTo(4.0, within(1e-3));
        assertThat(model.criticalPaceSecondsPerKm()).isCloseTo(250.0, within(0.1));
        assertThat(model.dPrimeMeters()).isCloseTo(200.0, within(0.5));
        assertThat(model.pointsUsed()).isEqualTo(4);
        assertThat(model.maxErrorPercent()).isLessThan(0.2);
        assertThat(answer.points()).extracting(PaceCurveService.Point::key)
                .containsExactly("half_mile", "1km", "1mile", "3km", "5km", "10km");
        // The half mile (151 s) is too short for the fit and the 10 km (2450 s) is too long; both are still drawn.
        assertThat(answer.points()).filteredOn(PaceCurveService.Point::inModel).extracting(PaceCurveService.Point::key)
                .containsExactly("1km", "1mile", "3km", "5km");
    }

    @Test
    void twoEffortsAreNotEnoughForALine() {
        Runner owner = runner(null);
        effort(owner, TODAY.minusDays(3), "1km", 230);
        effort(owner, TODAY.minusDays(3), "5km", 1250);

        PaceCurveService.PaceCurveResponse answer = service().paceCurve(owner, 90, true);

        assertThat(answer.model().status()).isEqualTo("too_few_points");
        assertThat(answer.model().pointsUsed()).isEqualTo(2);
        assertThat(answer.model().criticalPaceSecondsPerKm()).isNull();
        assertThat(answer.points()).allMatch(point -> !point.inModel());
    }

    @Test
    void anotherRunnersEffortsAreNotOnMyCurve() {
        Runner mine = runner(null);
        Runner theirs = runner(null);
        effort(mine, TODAY.minusDays(3), "5km", 1500);
        effort(theirs, TODAY.minusDays(3), "5km", 1000);

        PaceCurveService.PaceCurveResponse answer = service().paceCurve(mine, 90, true);

        assertThat(answer.points()).hasSize(1);
        assertThat(answer.points().get(0).seconds()).isEqualTo(1500.0);
    }

    @Test
    void aRunnerInAnotherTimeZoneHasTheirOwnToday() {
        Runner owner = runner("Pacific/Auckland");
        effort(owner, LocalDate.of(2026, 10, 11), "5km", 1300);       // today in Auckland, tomorrow in UTC

        PaceCurveService.PaceCurveResponse answer = service().paceCurve(owner, 7, true);

        assertThat(answer.today()).isEqualTo(LocalDate.of(2026, 10, 11));
        assertThat(answer.timeZone()).isEqualTo("Pacific/Auckland");
        assertThat(answer.points()).hasSize(1);
    }

    @Test
    void theCompleteFlagIsPassedThrough() {
        Runner owner = runner(null);

        assertThat(service().paceCurve(owner, 30, false).complete()).isFalse();
        assertThat(service().paceCurve(owner, 30, true).complete()).isTrue();
    }

    @Test
    void aWindowOutsideOneToTheLimitIsRefused() {
        Runner owner = runner(null);

        assertThatThrownBy(() -> service().paceCurve(owner, 0, true)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service().paceCurve(owner, PaceCurveService.MAX_DAYS + 1, true)).isInstanceOf(IllegalArgumentException.class);
        assertThat(service().paceCurve(owner, PaceCurveService.MAX_DAYS, true).points()).isEmpty();
    }
}
