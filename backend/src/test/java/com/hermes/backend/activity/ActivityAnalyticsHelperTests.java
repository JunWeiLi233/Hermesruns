package com.hermes.backend.activity;

import com.hermes.backend.activity.ActivityAnalyticsHelper.SamplePoint;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ActivityAnalyticsHelperTests {

    private static SamplePoint point(Integer cadence) {
        return new SamplePoint(40.78, -73.96, 0, 0.0, 20.0, null, cadence, null, null);
    }

    /** A sample {@code metersNorth} metres north of a fixed spot, with the distance the watch gave it or null. */
    private static SamplePoint at(double metersNorth, Double distance) {
        return new SamplePoint(40.0 + metersNorth / 111_194.93, -73.96, 0, distance, null, null, null, null, null);
    }

    private static List<Double> normalizedDistances(SamplePoint... samples) {
        List<SamplePoint> points = new ArrayList<>(List.of(samples));
        ActivityAnalyticsHelper.normalizeSamples(points, new Activity());
        return points.stream().map(SamplePoint::distanceMeters).toList();
    }

    /** A straight run at a steady pace: a sample every 100 m, {@code secondsPer100m} apart, heart rate 150, ending at {@code metres}. */
    private static List<SamplePoint> steadyRun(int metres, int secondsPer100m) {
        List<SamplePoint> points = new ArrayList<>();
        for (int m = 0; m <= metres; m += 100) {
            points.add(new SamplePoint(40.0 + m / 111_194.93, -73.96, m / 100 * secondsPer100m, (double) m, 20.0, 150, null, null, null));
        }
        if (metres % 100 != 0) {
            points.add(new SamplePoint(40.0 + metres / 111_194.93, -73.96, (int) Math.round(metres / 100.0 * secondsPer100m), (double) metres, 20.0, 150, null, null, null));
        }
        return points;
    }

    @Test
    void theStretchAfterTheLastWholeKilometreIsALapOfItsOwn() {
        // 2.35 km at 5:00 /km: two whole kilometres and 350 m, as the pace profile splits it (BUG-004).
        List<ActivityAnalyticsHelper.LapBreakdown> laps = ActivityAnalyticsHelper.buildLapBreakdown(steadyRun(2350, 30));

        assertThat(laps).hasSize(3);
        assertThat(laps.subList(0, 2)).allSatisfy(lap -> {
            assertThat(lap.partial()).isFalse();
            assertThat(lap.distanceKm()).isEqualTo(1.0);
            assertThat(lap.pace()).isEqualTo("5:00 /km");
        });
        ActivityAnalyticsHelper.LapBreakdown last = laps.get(2);
        assertThat(last.partial()).isTrue();
        assertThat(last.lapIndex()).isEqualTo(3);
        assertThat(last.distanceKm()).isEqualTo(0.35);
        assertThat(last.durationSeconds()).isEqualTo(105);
        assertThat(last.pace()).as("the pace over the 350 m, per kilometre").isEqualTo("5:00 /km");
        assertThat(last.averageHeartRate()).isEqualTo(150);
    }

    @Test
    void aRunOfWholeKilometresHasNoPartialLap() {
        List<ActivityAnalyticsHelper.LapBreakdown> laps = ActivityAnalyticsHelper.buildLapBreakdown(steadyRun(3000, 30));

        assertThat(laps).hasSize(3);
        assertThat(laps).noneMatch(ActivityAnalyticsHelper.LapBreakdown::partial);
    }

    @Test
    void aScrapAfterTheLastKilometreIsLeftOutAsItIsInThePaceProfile() {
        // 2.05 km: the last 50 m is under the profile's 100 m minimum for a split.
        List<ActivityAnalyticsHelper.LapBreakdown> laps = ActivityAnalyticsHelper.buildLapBreakdown(steadyRun(2050, 30));

        assertThat(laps).hasSize(2);
        assertThat(laps).noneMatch(ActivityAnalyticsHelper.LapBreakdown::partial);
    }

    @Test
    void aRunShorterThanAKilometreIsOnePartialLapNotNone() {
        List<ActivityAnalyticsHelper.LapBreakdown> laps = ActivityAnalyticsHelper.buildLapBreakdown(steadyRun(700, 30));

        assertThat(laps).hasSize(1);
        assertThat(laps.get(0).partial()).isTrue();
        assertThat(laps.get(0).lapIndex()).isEqualTo(1);
        assertThat(laps.get(0).distanceKm()).isEqualTo(0.7);
    }

    @Test
    void aRunWithNoDistancesAtAllGetsThemFromTheGpsHopsAlone() {
        List<Double> distances = normalizedDistances(at(0, null), at(100, null), at(250, null), at(400, null));

        assertThat(distances).hasSize(4);
        assertThat(distances.get(0)).isEqualTo(0.0);
        assertThat(distances.get(1)).isCloseTo(100.0, within(0.5));
        assertThat(distances.get(2)).isCloseTo(250.0, within(0.5));
        assertThat(distances.get(3)).isCloseTo(400.0, within(0.5));
    }

    @Test
    void distancesTheWatchGaveAreKeptAsTheyAre() {
        List<Double> distances = normalizedDistances(at(0, 0.0), at(100, 98.0), at(250, 251.5), at(400, 399.0));

        assertThat(distances).containsExactly(0.0, 98.0, 251.5, 399.0);
    }

    @Test
    void gpsHopsThatAddUpToMoreThanTheWatchMeasuredAreScaledBackToFitBetweenTheDistancesAroundThem() {
        // The watch says 1000 m between the first and the last sample; the jittery GPS positions add up to 1250 m. The
        // samples in between used to keep the GPS figures (300 ... 1200) and end up ahead of the last one, 1000.
        List<Double> distances = normalizedDistances(
                at(0, 0.0), at(300, null), at(600, null), at(900, null), at(1200, null), at(1250, 1000.0));

        assertThat(distances.get(0)).isEqualTo(0.0);
        assertThat(distances.get(1)).isCloseTo(240.0, within(1.0));
        assertThat(distances.get(2)).isCloseTo(480.0, within(1.0));
        assertThat(distances.get(3)).isCloseTo(720.0, within(1.0));
        assertThat(distances.get(4)).isCloseTo(960.0, within(1.0));
        assertThat(distances.get(5)).isEqualTo(1000.0);
        assertThat(distances).isSorted();
    }

    @Test
    void gpsHopsThatAddUpToLessThanTheWatchMeasuredAreStretchedToFit() {
        List<Double> distances = normalizedDistances(at(0, 0.0), at(250, null), at(500, null), at(800, 1000.0));

        assertThat(distances.get(1)).isCloseTo(312.5, within(1.0));
        assertThat(distances.get(2)).isCloseTo(625.0, within(1.0));
        assertThat(distances.get(3)).isEqualTo(1000.0);
    }

    @Test
    void aLeadingStretchIsFittedBetweenZeroAndTheFirstDistanceTheWatchGave() {
        List<Double> distances = normalizedDistances(at(0, null), at(100, null), at(200, null), at(300, 250.0));

        assertThat(distances.get(0)).isEqualTo(0.0);
        assertThat(distances.get(1)).isCloseTo(83.3, within(0.5));
        assertThat(distances.get(2)).isCloseTo(166.7, within(0.5));
        assertThat(distances.get(3)).isEqualTo(250.0);
    }

    @Test
    void aStretchAtTheEndHasNothingToFitAndKeepsTheGpsHops() {
        List<Double> distances = normalizedDistances(at(0, 0.0), at(480, 500.0), at(580, null), at(730, null));

        assertThat(distances.get(1)).isEqualTo(500.0);
        assertThat(distances.get(2)).isCloseTo(600.0, within(0.5));
        assertThat(distances.get(3)).isCloseTo(750.0, within(0.5));
    }

    @Test
    void aLaterStretchStartsFromTheFittedDistanceAndNotFromTheOvershootBeforeIt() {
        // The GPS hops before the known 1000 m add up to 1250 m; the stretch after it must go on from 1000, not from 1250.
        List<Double> distances = normalizedDistances(
                at(0, 0.0), at(600, null), at(1200, null), at(1250, 1000.0), at(1350, null), at(1450, null));

        assertThat(distances.get(3)).isEqualTo(1000.0);
        assertThat(distances.get(4)).isCloseTo(1100.0, within(0.5));
        assertThat(distances.get(5)).isCloseTo(1200.0, within(0.5));
    }

    @Test
    void aDistanceBehindTheOneBeforeItLeavesTheStretchBeforeItAsMeasured() {
        // Distances that already go backwards cannot be fitted to; nothing is invented for them.
        List<Double> distances = normalizedDistances(at(0, 1000.0), at(100, null), at(200, 900.0));

        assertThat(distances.get(0)).isEqualTo(1000.0);
        assertThat(distances.get(1)).isCloseTo(1100.0, within(0.5));
        assertThat(distances.get(2)).isEqualTo(900.0);
    }

    @Test
    void aStretchWhoseHopsAddUpToNothingIsSpreadEvenly() {
        List<Double> distances = normalizedDistances(at(0, 0.0), at(0, null), at(0, null), at(0, 90.0));

        assertThat(distances.get(1)).isCloseTo(30.0, within(1e-9));
        assertThat(distances.get(2)).isCloseTo(60.0, within(1e-9));
        assertThat(distances.get(3)).isEqualTo(90.0);
    }

    @Test
    void averageCadenceIsTheMeanOfTheSamplesThatCarryCadence() {
        List<SamplePoint> points = List.of(point(80), point(90), point(null), point(0), point(100));

        assertThat(ActivityAnalyticsHelper.averageCadence(points, new Activity())).isEqualTo(90.0);
    }

    @Test
    void averageCadenceFallsBackToWhatTheDeviceReportedForTheRun() {
        Activity activity = new Activity();
        activity.setAverageCadence(84.0);

        assertThat(ActivityAnalyticsHelper.averageCadence(List.of(point(null), point(null)), activity)).isEqualTo(84.0);
    }

    @Test
    void aRunWithNoCadenceAnywhereHasNoAverageCadenceInsteadOfFailing() {
        // A run without a cadence sensor, such as a phone-only GPX file, has neither samples nor a device average.
        // Choosing between a primitive and a null Double in one expression used to unbox the null and throw, which
        // turned GET /api/activities/{id}/analytics into a 500 for every such run.
        assertThat(ActivityAnalyticsHelper.averageCadence(List.of(point(null), point(0)), new Activity())).isNull();
        assertThat(ActivityAnalyticsHelper.averageCadence(List.of(), new Activity())).isNull();
    }
}
