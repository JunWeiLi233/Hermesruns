package com.hermes.backend.activity;

import com.hermes.backend.activity.ActivityAnalyticsHelper.SamplePoint;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class PaceProfileCalculatorTests {

    /** One stretch of a synthetic run: how long, how fast (metres per second), and the slope under the runner's feet. */
    private record Leg(int seconds, double speed, double slope) {
    }

    private static final double FIVE_MINUTES_PER_KM = 1000.0 / 300.0;

    private static SamplePoint point(int seconds, double distance, Double elevation) {
        return new SamplePoint(40.78, -73.96, seconds, distance, elevation, null, null, null, null);
    }

    /** A 1 Hz stream. A null start elevation gives a stream without any elevation. */
    private static List<SamplePoint> stream(Double startElevation, Leg... legs) {
        List<SamplePoint> points = new ArrayList<>();
        int t = 0;
        double d = 0;
        Double z = startElevation;
        points.add(point(t, d, z));
        for (Leg leg : legs) {
            for (int i = 0; i < leg.seconds(); i++) {
                t++;
                d += leg.speed();
                if (z != null) {
                    z = z + leg.speed() * leg.slope();
                }
                points.add(point(t, d, z));
            }
        }
        return points;
    }

    private static Leg steady(int seconds, double secondsPerKm) {
        return new Leg(seconds, 1000.0 / secondsPerKm, 0.0);
    }

    // ----- no stream -----

    @Test
    void tooLittleOfAStreamIsNoStream() {
        assertThat(PaceProfileCalculator.compute(List.of()).hasStream()).isFalse();
        assertThat(PaceProfileCalculator.compute(List.of(point(0, 0, 10.0))).hasStream()).isFalse();
        // Two points that are the same place, one that is 5 m and 2 s, and 99 m in a minute: not a run.
        assertThat(PaceProfileCalculator.compute(List.of(point(0, 0, 10.0), point(60, 0, 10.0))).hasStream()).isFalse();
        assertThat(PaceProfileCalculator.compute(List.of(point(0, 0, 10.0), point(2, 5, 10.0))).hasStream()).isFalse();
        assertThat(PaceProfileCalculator.compute(List.of(point(0, 0, 10.0), point(60, 99.0, 10.0))).hasStream()).isFalse();
        // Points with no time or no distance cannot give a pace.
        List<SamplePoint> noTimes = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            noTimes.add(new SamplePoint(40.78, -73.96, null, i * 10.0, 10.0, null, null, null, null));
        }
        assertThat(PaceProfileCalculator.compute(noTimes).hasStream()).isFalse();
    }

    @Test
    void anEmptyAnswerHasEmptyPartsNotNulls() {
        PaceProfileResponse none = PaceProfileCalculator.compute(List.of());

        assertThat(none.hasStream()).isFalse();
        assertThat(none.hasElevation()).isFalse();
        assertThat(none.summary()).isNull();
        assertThat(none.splits()).isEmpty();
        assertThat(none.markers()).isNull();
        assertThat(none.smoothed()).isNull();
    }

    // ----- splits -----

    @Test
    void aSteadyFlatRunHasEvenSplitsAndAGradeAdjustedPaceEqualToThePace() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, steady(1050, 300)));

        assertThat(profile.hasStream()).isTrue();
        assertThat(profile.hasElevation()).isTrue();
        assertThat(profile.splits()).hasSize(4);
        for (int i = 0; i < 3; i++) {
            PaceProfileResponse.Split split = profile.splits().get(i);
            assertThat(split.index()).isEqualTo(i + 1);
            assertThat(split.partial()).isFalse();
            assertThat(split.distanceMeters()).isEqualTo(1000.0);
            assertThat(split.seconds()).isCloseTo(300.0, within(0.2));
            assertThat(split.paceSecPerKm()).isCloseTo(300.0, within(0.2));
            assertThat(split.gapSecPerKm()).isCloseTo(300.0, within(0.5));
            assertThat(split.elevationChangeMeters()).isCloseTo(0.0, within(0.1));
        }
        PaceProfileResponse.Split last = profile.splits().get(3);
        assertThat(last.partial()).isTrue();
        assertThat(last.distanceMeters()).isCloseTo(500.0, within(0.5));
        assertThat(last.paceSecPerKm()).isCloseTo(300.0, within(0.2));

        PaceProfileResponse.Summary summary = profile.summary();
        assertThat(summary.distanceMeters()).isCloseTo(3500.0, within(0.5));
        assertThat(summary.elapsedSeconds()).isEqualTo(1050.0);
        assertThat(summary.movingSeconds()).isEqualTo(1050.0);
        assertThat(summary.stoppedSeconds()).isEqualTo(0.0);
        assertThat(summary.paceSecPerKm()).isCloseTo(300.0, within(0.2));
        assertThat(summary.gapSecPerKm()).isCloseTo(300.0, within(0.5));
    }

    @Test
    void aFinalStretchUnderOneHundredMetresIsNotASplit() {
        assertThat(PaceProfileCalculator.compute(stream(100.0, steady(615, 300))).splits()).hasSize(2);
        List<PaceProfileResponse.Split> withTail = PaceProfileCalculator.compute(stream(100.0, steady(705, 300))).splits();
        assertThat(withTail).hasSize(3);
        assertThat(withTail.get(2).partial()).isTrue();
        assertThat(withTail.get(2).distanceMeters()).isCloseTo(350.0, within(0.5));
    }

    @Test
    void anyStreamThatHasAProfileHasAtLeastOneSplit() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(List.of(point(0, 0, 10.0), point(30, 100.0, 10.0)));

        assertThat(profile.hasStream()).isTrue();
        assertThat(profile.splits()).hasSize(1);
        assertThat(profile.splits().get(0).partial()).isTrue();
        assertThat(profile.splits().get(0).paceSecPerKm()).isCloseTo(300.0, within(0.5));
    }

    @Test
    void aRunUnderAKilometreIsOnePartialSplit() {
        List<PaceProfileResponse.Split> splits = PaceProfileCalculator.compute(stream(100.0, steady(180, 300))).splits();

        assertThat(splits).hasSize(1);
        assertThat(splits.get(0).partial()).isTrue();
        assertThat(splits.get(0).distanceMeters()).isCloseTo(600.0, within(0.5));
        assertThat(splits.get(0).paceSecPerKm()).isCloseTo(300.0, within(0.2));
    }

    @Test
    void theStreamDoesNotHaveToStartAtZero() {
        List<SamplePoint> shifted = new ArrayList<>();
        for (SamplePoint p : stream(100.0, steady(700, 300))) {
            shifted.add(point(p.elapsedSeconds() + 40, p.distanceMeters() + 25.0, p.elevationMeters()));
        }

        PaceProfileResponse profile = PaceProfileCalculator.compute(shifted);

        assertThat(profile.summary().elapsedSeconds()).isEqualTo(700.0);
        assertThat(profile.summary().distanceMeters()).isCloseTo(2333.3, within(0.5));
        assertThat(profile.splits().get(0).paceSecPerKm()).isCloseTo(300.0, within(0.2));
    }

    // ----- grade-adjusted pace -----

    @Test
    void aClimbMakesTheGradeAdjustedPaceFasterThanThePaceRun() {
        // 5:00 /km up a steady 5% slope for 2 km.
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, new Leg(600, FIVE_MINUTES_PER_KM, 0.05)));

        for (PaceProfileResponse.Split split : profile.splits()) {
            assertThat(split.paceSecPerKm()).isCloseTo(300.0, within(0.2));
            assertThat(split.gapSecPerKm()).isCloseTo(300.0 / GradeAdjustedPace.costRatio(0.05), within(1.5));
            assertThat(split.elevationChangeMeters()).isCloseTo(50.0, within(1.0));
        }
        assertThat(profile.summary().gapSecPerKm()).isLessThan(profile.summary().paceSecPerKm() - 50.0);
    }

    @Test
    void aDescentMakesTheGradeAdjustedPaceSlowerThanThePaceRun() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(300.0, new Leg(600, FIVE_MINUTES_PER_KM, -0.05)));

        for (PaceProfileResponse.Split split : profile.splits()) {
            assertThat(split.gapSecPerKm()).isCloseTo(300.0 / GradeAdjustedPace.costRatio(-0.05), within(1.5));
            assertThat(split.elevationChangeMeters()).isCloseTo(-50.0, within(1.0));
        }
        assertThat(profile.summary().gapSecPerKm()).isGreaterThan(profile.summary().paceSecPerKm() + 30.0);
    }

    @Test
    void anUphillThenDownhillRunAveragesToTheFlatPaceOnlyApproximately() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                new Leg(300, FIVE_MINUTES_PER_KM, 0.04), new Leg(300, FIVE_MINUTES_PER_KM, -0.04)));

        // Down is worth half of what up costs, so the whole run is a little faster than flat in grade-adjusted terms.
        assertThat(profile.splits().get(0).gapSecPerKm()).isLessThan(300.0);
        assertThat(profile.splits().get(1).gapSecPerKm()).isGreaterThan(300.0);
        assertThat(profile.summary().gapSecPerKm()).isLessThan(300.0).isGreaterThan(270.0);
    }

    @Test
    void withoutElevationThereIsNoGradeAdjustedPaceAndNothingIsInvented() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(null, steady(310, 310), steady(300, 300), steady(290, 290)));

        assertThat(profile.hasStream()).isTrue();
        assertThat(profile.hasElevation()).isFalse();
        assertThat(profile.summary().gapSecPerKm()).isNull();
        assertThat(profile.summary().paceSecPerKm()).isCloseTo(300.0, within(0.2));
        assertThat(profile.splits()).allSatisfy(split -> {
            assertThat(split.gapSecPerKm()).isNull();
            assertThat(split.elevationChangeMeters()).isNull();
            assertThat(split.paceSecPerKm()).isNotNull();
        });
        assertThat(profile.smoothed().gapSecPerKm()).allMatch(value -> value == null);
        assertThat(profile.smoothed().elevationMeters()).allMatch(value -> value == null);
        assertThat(profile.markers().gap()).isNull();
        assertThat(profile.markers().pace()).isNotNull();
    }

    @Test
    void aHandfulOfElevationPointsIsNotEnoughToAdjustAnything() {
        List<SamplePoint> sparse = new ArrayList<>();
        for (SamplePoint p : stream(100.0, new Leg(600, FIVE_MINUTES_PER_KM, 0.05))) {
            boolean keep = p.elapsedSeconds() % 150 == 0;
            sparse.add(point(p.elapsedSeconds(), p.distanceMeters(), keep ? p.elevationMeters() : null));
        }

        PaceProfileResponse profile = PaceProfileCalculator.compute(sparse);

        assertThat(profile.hasElevation()).isFalse();
        assertThat(profile.summary().gapSecPerKm()).isNull();
    }

    @Test
    void aSingleBadElevationReadingDoesNotTurnIntoAHugeAdjustment() {
        List<SamplePoint> spiky = new ArrayList<>();
        for (SamplePoint p : stream(100.0, steady(900, 300))) {
            double bad = p.elapsedSeconds() == 450 ? 160.0 : p.elevationMeters();
            spiky.add(point(p.elapsedSeconds(), p.distanceMeters(), bad));
        }

        PaceProfileResponse profile = PaceProfileCalculator.compute(spiky);

        assertThat(profile.splits()).allSatisfy(split -> assertThat(split.gapSecPerKm()).isCloseTo(300.0, within(3.0)));
    }

    @Test
    void threeMetresOfElevationNoiseStillLeavesTheGradeAdjustedPaceWithinTwoAndAHalfPercent() {
        // The README says about 2% at 3 m (standard deviation) on every reading, always on the faster side.
        for (long seed : new long[] {1, 7, 42}) {
            Random random = new Random(seed);
            List<SamplePoint> noisy = new ArrayList<>();
            for (SamplePoint p : stream(100.0, steady(1800, 300))) {
                noisy.add(point(p.elapsedSeconds(), p.distanceMeters(), 100.0 + random.nextGaussian() * 3.0));
            }

            double gap = PaceProfileCalculator.compute(noisy).summary().gapSecPerKm();

            assertThat(gap).as("seed %d", seed).isBetween(300.0 * 0.975, 300.0);
        }
    }

    @Test
    void noisyElevationOnAFlatRunBarelyMovesTheGradeAdjustedPace() {
        // GPS-only altitude is often off by a couple of metres from one reading to the next. On a flat run that must not
        // read as hills.
        Random random = new Random(7);
        List<SamplePoint> noisy = new ArrayList<>();
        for (SamplePoint p : stream(100.0, steady(1800, 300))) {
            noisy.add(point(p.elapsedSeconds(), p.distanceMeters(), 100.0 + random.nextGaussian() * 1.7));
        }

        PaceProfileResponse profile = PaceProfileCalculator.compute(noisy);

        assertThat(profile.summary().gapSecPerKm()).isCloseTo(300.0, within(300.0 * 0.015));
        for (PaceProfileResponse.Split split : profile.splits()) {
            assertThat(split.gapSecPerKm()).isCloseTo(300.0, within(300.0 * 0.03));
        }
    }

    // ----- stops, glitches, order -----

    @Test
    void timeStandingStillIsNotRunningTime() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(400, 300), new Leg(60, 0.0, 0.0), steady(300, 300)));

        PaceProfileResponse.Summary summary = profile.summary();
        assertThat(summary.elapsedSeconds()).isEqualTo(760.0);
        assertThat(summary.stoppedSeconds()).isCloseTo(60.0, within(1.5));
        assertThat(summary.movingSeconds()).isCloseTo(700.0, within(1.5));
        assertThat(summary.paceSecPerKm()).isCloseTo(300.0, within(0.5));
        // The kilometre that holds the stop is as fast as the others.
        assertThat(profile.splits().get(1).paceSecPerKm()).isCloseTo(300.0, within(1.0));
    }

    @Test
    void driftWhileStandingStillIsNotDistanceRun() {
        // A watch left standing at a crossing for a minute creeps 0.3 m/s: 18 m that were not run. Those metres sit in the
        // second kilometre and must not make it look faster than the 5:00 /km that was run.
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(300, 300), new Leg(60, 0.3, 0.0), steady(300, 300)));

        assertThat(profile.summary().stoppedSeconds()).isCloseTo(60.0, within(1.5));
        assertThat(profile.summary().paceSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(profile.summary().gapSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(profile.splits().get(0).paceSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(profile.splits().get(1).paceSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(profile.splits().get(1).gapSecPerKm()).isCloseTo(300.0, within(0.8));
    }

    @Test
    void aJumpOnResumeAfterAPauseIsNotDistanceRunEither() {
        // After a minute's pause the position jumps 25 m (0.42 m/s over the pause).
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(300, 300), new Leg(60, 25.0 / 60, 0.0), steady(300, 300)));

        assertThat(profile.splits().get(1).paceSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(profile.splits().get(1).gapSecPerKm()).isCloseTo(300.0, within(0.8));
    }

    @Test
    void aKilometreCoveredBelowTheStoppedSpeedHasNoPaceAndItsTimeIsStoppedTime() {
        // One kilometre at 5:00, then one at 0.4 m/s (41 minutes of shuffling about): none of the second counts as running.
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(300, 300), new Leg(2500, 0.4, 0.0)));

        assertThat(profile.splits()).hasSize(2);
        PaceProfileResponse.Split shuffled = profile.splits().get(1);
        assertThat(shuffled.distanceMeters()).isEqualTo(1000.0);
        assertThat(shuffled.seconds()).isCloseTo(0.0, within(1.0));
        assertThat(shuffled.paceSecPerKm()).isNull();
        assertThat(shuffled.gapSecPerKm()).isNull();
        assertThat(profile.summary().stoppedSeconds()).isCloseTo(2500.0, within(2.0));
        assertThat(profile.summary().paceSecPerKm()).isCloseTo(300.0, within(0.5));
    }

    @Test
    void aStopLeavesAGapInTheSmoothedPaceAndTheLineResumesAfterIt() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(400, 300), new Leg(120, 0.0, 0.0), steady(300, 300)));

        PaceProfileResponse.Series series = profile.smoothed();
        int duringStop = series.t().indexOf(460);
        int afterStop = series.t().indexOf(600);
        assertThat(series.paceSecPerKm().get(duringStop)).isNull();
        assertThat(series.paceSecPerKm().get(afterStop)).isCloseTo(300.0, within(1.0));
        assertThat(series.paceSecPerKm().get(series.t().indexOf(200))).isCloseTo(300.0, within(1.0));
    }

    @Test
    void pointsThatGoBackInTimeOrDistanceAreIgnored() {
        List<SamplePoint> clean = stream(100.0, steady(900, 300));
        List<SamplePoint> glitchy = new ArrayList<>(clean);
        glitchy.add(450, point(449, 1490.0, 100.0));
        glitchy.add(600, point(595, 1900.0, 100.0));

        PaceProfileResponse expected = PaceProfileCalculator.compute(clean);
        PaceProfileResponse actual = PaceProfileCalculator.compute(glitchy);

        assertThat(actual.splits()).hasSameSizeAs(expected.splits());
        for (int i = 0; i < expected.splits().size(); i++) {
            assertThat(actual.splits().get(i).paceSecPerKm()).isCloseTo(expected.splits().get(i).paceSecPerKm(), within(0.5));
        }
    }

    @Test
    void twoReadingsAtTheSameSecondCountOnce() {
        List<SamplePoint> doubled = new ArrayList<>();
        for (SamplePoint p : stream(100.0, steady(900, 300))) {
            doubled.add(p);
            if (p.elapsedSeconds() % 10 == 0) {
                doubled.add(point(p.elapsedSeconds(), p.distanceMeters(), p.elevationMeters()));
            }
        }

        PaceProfileResponse profile = PaceProfileCalculator.compute(doubled);

        assertThat(profile.summary().paceSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(profile.splits().get(0).paceSecPerKm()).isCloseTo(300.0, within(0.5));
    }

    @Test
    void sparseReadingsEveryHalfMinuteStillGiveSplits() {
        List<SamplePoint> sparse = new ArrayList<>();
        for (SamplePoint p : stream(100.0, steady(1800, 300))) {
            if (p.elapsedSeconds() % 30 == 0) {
                sparse.add(p);
            }
        }

        PaceProfileResponse profile = PaceProfileCalculator.compute(sparse);

        assertThat(profile.splits()).hasSize(6);
        assertThat(profile.splits().get(2).paceSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(profile.smoothed().t()).isNotEmpty();
    }

    // ----- markers -----

    @Test
    void theFastestAndSlowestFullSplitsAreMarked() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(330, 330), steady(300, 300), steady(310, 310), steady(290, 290), steady(320, 320), steady(100, 300)));

        assertThat(profile.splits()).hasSize(6);
        assertThat(profile.markers().pace().fastestSplit()).isEqualTo(4);
        assertThat(profile.markers().pace().slowestSplit()).isEqualTo(1);
        assertThat(profile.markers().gap().fastestSplit()).isEqualTo(4);
        assertThat(profile.markers().gap().slowestSplit()).isEqualTo(1);
    }

    @Test
    void theGradeAdjustedMarkersCanDifferFromThePaceMarkers() {
        // Km 1 is slower on paper but uphill; km 2 is faster on paper but downhill.
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                new Leg(330, 1000.0 / 330, 0.06), new Leg(300, 1000.0 / 300, -0.06)));

        assertThat(profile.markers().pace().fastestSplit()).isEqualTo(2);
        assertThat(profile.markers().pace().slowestSplit()).isEqualTo(1);
        assertThat(profile.markers().gap().fastestSplit()).isEqualTo(1);
        assertThat(profile.markers().gap().slowestSplit()).isEqualTo(2);
    }

    @Test
    void aPartialSplitIsNeverTheFastestOrSlowest() {
        // Two kilometres at 5:00 and 5:10, then the last 400 m flat out at 2:30 /km.
        PaceProfileResponse profile = PaceProfileCalculator.compute(
                stream(100.0, steady(300, 300), steady(310, 310), new Leg(60, 1000.0 / 150, 0.0)));

        assertThat(profile.splits()).hasSize(3);
        assertThat(profile.splits().get(2).partial()).isTrue();
        assertThat(profile.splits().get(2).paceSecPerKm()).isCloseTo(150.0, within(0.5));
        assertThat(profile.markers().pace().fastestSplit()).isEqualTo(1);
        assertThat(profile.markers().pace().slowestSplit()).isEqualTo(2);
    }

    @Test
    void splitsThatAreTheSameHaveNoFastestOrSlowest() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, steady(900, 300)));

        assertThat(profile.splits()).hasSize(3);
        assertThat(profile.markers()).isNull();
    }

    @Test
    void oneFullSplitHasNothingToCompareWith() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, steady(350, 300)));

        assertThat(profile.splits()).hasSize(2);
        assertThat(profile.markers()).isNull();
    }

    @Test
    void aSplitWhosePaceIsNotAPaceHasNoneAndIsLeftOutOfTheMarkers() {
        // Kilometre 1 at 5:00; kilometre 2 a GPS jump (1000 m in 20 s, a 0:20 /km); kilometre 3 a crawl just above the
        // standing-still speed (0.55 m/s, 30:18 /km); kilometre 4 at 5:30. Only the first and the last are paces.
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(300, 300), new Leg(20, 50.0, 0.0), new Leg(1819, 0.55, 0.0), steady(330, 330)));

        List<PaceProfileResponse.Split> splits = profile.splits();
        assertThat(splits).hasSize(4);
        assertThat(splits.get(0).paceSecPerKm()).isCloseTo(300.0, within(0.5));
        assertThat(splits.get(1).paceSecPerKm()).isNull();
        assertThat(splits.get(1).gapSecPerKm()).isNull();
        assertThat(splits.get(2).paceSecPerKm()).isNull();
        assertThat(splits.get(2).gapSecPerKm()).isNull();
        assertThat(splits.get(3).paceSecPerKm()).isCloseTo(330.0, within(1.0));
        assertThat(splits.get(3).gapSecPerKm()).isCloseTo(330.0, within(1.5));
        assertThat(profile.markers().pace().fastestSplit()).isEqualTo(1);
        assertThat(profile.markers().pace().slowestSplit()).isEqualTo(4);
        assertThat(profile.markers().gap().fastestSplit()).isEqualTo(1);
        assertThat(profile.markers().gap().slowestSplit()).isEqualTo(4);
    }

    @Test
    void aSlowButPlausiblePaceIsKept() {
        // 25:00 /km is a walk, but it is a pace; only what no runner could have run is left out.
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, steady(1500, 1500), steady(300, 300)));

        assertThat(profile.splits().get(0).paceSecPerKm()).isCloseTo(1500.0, within(1.0));
        assertThat(profile.splits().get(1).paceSecPerKm()).isCloseTo(300.0, within(1.0));
    }

    @Test
    void aSplitWithoutAPaceDoesNotCountAsOneToCompare() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, steady(300, 300), new Leg(20, 50.0, 0.0)));

        assertThat(profile.splits()).hasSize(2);
        assertThat(profile.markers()).isNull();
    }

    // ----- the smoothed series -----

    @Test
    void theSmoothedSeriesIsEvenlySteppedAndItsColumnsLineUp() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, steady(3600, 300)));

        PaceProfileResponse.Series series = profile.smoothed();
        assertThat(series.stepSeconds()).isEqualTo(10);
        assertThat(series.windowSeconds()).isEqualTo(30);
        int n = series.t().size();
        assertThat(n).isBetween(300, 620);
        assertThat(series.distanceKm()).hasSize(n);
        assertThat(series.paceSecPerKm()).hasSize(n);
        assertThat(series.gapSecPerKm()).hasSize(n);
        assertThat(series.elevationMeters()).hasSize(n);
        assertThat(series.t().get(0)).isEqualTo(0);
        for (int i = 1; i < n; i++) {
            assertThat(series.t().get(i) - series.t().get(i - 1)).isEqualTo(10);
            assertThat(series.distanceKm().get(i)).isGreaterThan(series.distanceKm().get(i - 1));
        }
        assertThat(series.paceSecPerKm().get(n / 2)).isCloseTo(300.0, within(0.5));
        assertThat(series.gapSecPerKm().get(n / 2)).isCloseTo(300.0, within(1.0));
        assertThat(series.distanceKm().get(n - 1)).isCloseTo(12.0, within(0.02));
    }

    @Test
    void aShortRunIsSampledEveryFiveSecondsAndALongOneLessOften() {
        assertThat(PaceProfileCalculator.compute(stream(100.0, steady(1200, 300))).smoothed().stepSeconds()).isEqualTo(5);
        PaceProfileResponse ultra = PaceProfileCalculator.compute(stream(100.0, steady(36000, 360)));
        assertThat(ultra.smoothed().stepSeconds()).isEqualTo(60);
        assertThat(ultra.smoothed().windowSeconds()).isEqualTo(180);
        assertThat(ultra.smoothed().t().size()).isLessThanOrEqualTo(620);
    }

    @Test
    void theSmoothedPaceFollowsAChangeOfPaceWithinAWindow() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0, steady(600, 360), steady(600, 270)));

        PaceProfileResponse.Series series = profile.smoothed();
        assertThat(series.paceSecPerKm().get(series.t().indexOf(300))).isCloseTo(360.0, within(1.0));
        assertThat(series.paceSecPerKm().get(series.t().indexOf(900))).isCloseTo(270.0, within(1.0));
        // Halfway through the change the window holds both paces.
        Double across = series.paceSecPerKm().get(series.t().indexOf(600));
        assertThat(across).isBetween(280.0, 350.0);
    }

    @Test
    void theSmoothedGradeAdjustedPaceRespondsToTheSlope() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                steady(600, 300), new Leg(600, FIVE_MINUTES_PER_KM, 0.06), steady(600, 300)));

        PaceProfileResponse.Series series = profile.smoothed();
        int flat = series.t().indexOf(300);
        int climb = series.t().indexOf(900);
        assertThat(series.gapSecPerKm().get(flat)).isCloseTo(300.0, within(1.0));
        assertThat(series.paceSecPerKm().get(climb)).isCloseTo(300.0, within(1.0));
        assertThat(series.gapSecPerKm().get(climb)).isCloseTo(300.0 / GradeAdjustedPace.costRatio(0.06), within(4.0));
        assertThat(series.elevationMeters().get(climb)).isGreaterThan(series.elevationMeters().get(flat) + 10.0);
    }

    @Test
    void anImpossiblySpeedyWindowIsNotAPace() {
        // 60 m in one second in the middle of a run is a GPS jump, not a 1:07 /km.
        List<SamplePoint> jumpy = new ArrayList<>();
        for (SamplePoint p : stream(100.0, steady(900, 300))) {
            double extra = p.elapsedSeconds() >= 450 ? 2000.0 : 0.0;
            jumpy.add(point(p.elapsedSeconds(), p.distanceMeters() + extra, p.elevationMeters()));
        }

        PaceProfileResponse profile = PaceProfileCalculator.compute(jumpy);

        PaceProfileResponse.Series series = profile.smoothed();
        int atJump = series.t().indexOf(450);
        assertThat(series.paceSecPerKm().get(atJump)).isNull();
        assertThat(series.paceSecPerKm().get(series.t().indexOf(200))).isCloseTo(300.0, within(1.0));
    }

    @Test
    void aHundredThousandPointsAreFineAndTheAnswerStaysSmall() {
        PaceProfileResponse profile = PaceProfileCalculator.compute(stream(100.0,
                new Leg(100_000, 3.0, 0.01)));

        assertThat(profile.hasStream()).isTrue();
        assertThat(profile.splits()).hasSize(300);
        assertThat(profile.smoothed().t().size()).isLessThanOrEqualTo(620);
        assertThat(profile.summary().distanceMeters()).isCloseTo(300_000.0, within(1.0));
    }
}
