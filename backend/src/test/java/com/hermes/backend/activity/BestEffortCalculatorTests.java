package com.hermes.backend.activity;

import com.hermes.backend.activity.ActivityAnalyticsHelper.SamplePoint;
import com.hermes.backend.activity.BestEffortCalculator.Effort;
import com.hermes.backend.activity.BestEffortDistances.Distance;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class BestEffortCalculatorTests {

    private static final double FIVE_MINUTES_PER_KM = 1000.0 / 300.0;

    /** A stream from (seconds, metres) pairs, as the pace profile and the best efforts read a stored run. */
    private static RunStream stream(double[]... readings) {
        List<SamplePoint> points = new ArrayList<>();
        for (double[] reading : readings) {
            points.add(new SamplePoint(40.78, -73.96, (int) reading[0], reading[1], null, null, null, null, null));
        }
        return RunStream.of(points, 0.0, 0.0);
    }

    /** One reading a second at a constant speed for {@code seconds}. */
    private static RunStream steady(int seconds, double metersPerSecond) {
        List<double[]> readings = new ArrayList<>();
        for (int t = 0; t <= seconds; t++) {
            readings.add(new double[] {t, t * metersPerSecond});
        }
        return stream(readings.toArray(new double[0][]));
    }

    private static Map<String, Effort> byKey(List<Effort> efforts) {
        return efforts.stream().collect(Collectors.toMap(Effort::key, effort -> effort));
    }

    private static List<Effort> compute(RunStream stream) {
        return BestEffortCalculator.compute(stream, BestEffortDistances.ALL);
    }

    // ----- a steady run -----

    @Test
    void aSteadyRunTakesTheDistanceTimesThePaceForEveryDistanceItIsLongEnoughFor() {
        List<Effort> efforts = compute(steady(3600, FIVE_MINUTES_PER_KM)); // 12 km at 5:00 /km

        assertThat(efforts).extracting(Effort::key)
                .containsExactly("400m", "half_mile", "1km", "1mile", "3km", "2mile", "5km", "10km");
        Map<String, Effort> found = byKey(efforts);
        assertThat(found.get("400m").elapsedSeconds()).isCloseTo(120.0, within(0.1));
        assertThat(found.get("half_mile").elapsedSeconds()).isCloseTo(241.4, within(0.1));
        assertThat(found.get("1km").elapsedSeconds()).isCloseTo(300.0, within(0.1));
        assertThat(found.get("1mile").elapsedSeconds()).isCloseTo(482.8, within(0.1));
        assertThat(found.get("3km").elapsedSeconds()).isCloseTo(900.0, within(0.1));
        assertThat(found.get("2mile").elapsedSeconds()).isCloseTo(965.6, within(0.1));
        assertThat(found.get("5km").elapsedSeconds()).isCloseTo(1500.0, within(0.1));
        assertThat(found.get("10km").elapsedSeconds()).isCloseTo(3000.0, within(0.1));
        assertThat(efforts).allSatisfy(effort -> assertThat(effort.distanceMeters()).isGreaterThan(0));
    }

    @Test
    void theEffortsComeInTheOrderOfTheDistancesGiven() {
        List<Distance> reversed = new ArrayList<>(BestEffortDistances.ALL);
        java.util.Collections.reverse(reversed);

        List<Effort> efforts = BestEffortCalculator.compute(steady(3600, FIVE_MINUTES_PER_KM), reversed);

        assertThat(efforts).extracting(Effort::key).containsExactly("10km", "5km", "2mile", "3km", "1mile", "1km", "half_mile", "400m");
    }

    @Test
    void aStreamShorterThanADistanceHasNoEffortForIt() {
        Map<String, Effort> found = byKey(compute(steady(1350, FIVE_MINUTES_PER_KM))); // 4.5 km

        assertThat(found).containsKeys("1km", "3km", "2mile").doesNotContainKeys("5km", "10km");
    }

    // ----- finding the fastest window -----

    @Test
    void theFastestWindowIsFoundWhereverItSitsInTheRun() {
        // 3 km at 6:00 /km, then 3 km at 5:00 /km.
        List<double[]> readings = new ArrayList<>();
        for (int t = 0; t <= 1080; t++) {
            readings.add(new double[] {t, t * (1000.0 / 360)});
        }
        for (int t = 1; t <= 900; t++) {
            readings.add(new double[] {1080 + t, 3000 + t * FIVE_MINUTES_PER_KM});
        }

        Map<String, Effort> found = byKey(compute(stream(readings.toArray(new double[0][]))));

        assertThat(found.get("3km").elapsedSeconds()).isCloseTo(900.0, within(0.1));
        assertThat(found.get("3km").startOffsetSeconds()).isEqualTo(1080);
        assertThat(found.get("3km").endOffsetSeconds()).isEqualTo(1980);
        // 2 km of the slow part and then the whole fast part is better than the first five kilometres.
        assertThat(found.get("5km").elapsedSeconds()).isCloseTo(1620.0, within(0.1));
        assertThat(found.get("5km").startOffsetSeconds()).isEqualTo(360);
        assertThat(found.get("5km").endOffsetSeconds()).isEqualTo(1980);
    }

    @Test
    void aWindowThatEndsAtAReadingIsFoundEvenWhenItDoesNotStartAtOne() {
        // 2.5 m/s for 1 km, then 10 m/s for 1 km, with readings only at the corners. The fastest 1500 m is the last
        // 500 m of the slow part and the fast part: it ends at a reading but starts between two.
        RunStream sparse = stream(new double[] {0, 0}, new double[] {400, 1000}, new double[] {500, 2000});

        Effort effort = byKey(BestEffortCalculator.compute(sparse, List.of(new Distance("1500", 1500.0)))).get("1500");

        assertThat(effort.elapsedSeconds()).isCloseTo(300.0, within(0.05));
        assertThat(effort.startOffsetSeconds()).isEqualTo(200);
        assertThat(effort.endOffsetSeconds()).isEqualTo(500);
    }

    @Test
    void aWindowThatStartsAtAReadingIsFoundToo() {
        RunStream sparse = stream(new double[] {0, 0}, new double[] {100, 1000}, new double[] {600, 2000});

        Effort effort = byKey(BestEffortCalculator.compute(sparse, List.of(new Distance("1500", 1500.0)))).get("1500");

        // 10 m/s for the first kilometre, then 2 m/s: the fastest 1500 m starts at the start and takes 100 + 250 s.
        assertThat(effort.elapsedSeconds()).isCloseTo(350.0, within(0.05));
        assertThat(effort.startOffsetSeconds()).isEqualTo(0);
    }

    @Test
    void positionsAreLinearBetweenReadingsSoSparseReadingsGiveTheSameAnswerAsDenseOnes() {
        RunStream dense = steady(1200, 4.0);
        RunStream sparse = stream(new double[] {0, 0}, new double[] {600, 2400}, new double[] {1200, 4800});

        for (Distance distance : List.of(new Distance("1km", 1000.0), new Distance("3km", 3000.0))) {
            Effort expected = byKey(BestEffortCalculator.compute(dense, List.of(distance))).get(distance.key());
            Effort actual = byKey(BestEffortCalculator.compute(sparse, List.of(distance))).get(distance.key());
            assertThat(actual.elapsedSeconds()).isCloseTo(expected.elapsedSeconds(), within(0.05));
        }
    }

    @Test
    void theAnswerMatchesABruteForceSearchOnRandomRuns() {
        // A run whose speed changes every few seconds, searched for every window start on a 1 cm grid.
        for (long seed : new long[] {1, 7, 42, 99}) {
            Random random = new Random(seed);
            List<double[]> readings = new ArrayList<>();
            double distance = 0;
            double speed = 3.0;
            for (int t = 0; t <= 900; t++) {
                readings.add(new double[] {t, distance});
                if (t % 7 == 0) {
                    speed = 2.2 + random.nextDouble() * 2.6; // 2.2 to 4.8 m/s
                }
                distance += speed;
            }
            double[][] data = readings.toArray(new double[0][]);

            for (double length : new double[] {400.0, 1000.0, 1609.344}) {
                Effort effort = byKey(BestEffortCalculator.compute(stream(data), List.of(new Distance("x", length)))).get("x");
                assertThat(effort.elapsedSeconds()).as("seed %d, %.0f m", seed, length)
                        .isCloseTo(bruteForce(data, length), within(0.06));
            }
        }
    }

    /** The shortest time to cover {@code length} metres, trying a window start every centimetre along the run. */
    private static double bruteForce(double[][] data, double length) {
        double total = data[data.length - 1][1];
        double best = Double.POSITIVE_INFINITY;
        for (double start = 0; start + length <= total; start += 0.01) {
            best = Math.min(best, timeAt(data, start + length) - timeAt(data, start));
        }
        return best;
    }

    private static double timeAt(double[][] data, double metres) {
        int low = 0;
        int high = data.length - 1;
        while (low < high) {
            int middle = (low + high) >>> 1;
            if (data[middle][1] < metres) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        if (low == 0) {
            return data[0][0];
        }
        double[] before = data[low - 1];
        double[] after = data[low];
        return before[0] + (metres - before[1]) / (after[1] - before[1]) * (after[0] - before[0]);
    }

    // ----- standing still -----

    @Test
    void standingStillInsideAWindowCountsAsTimeInIt() {
        // 500 m at 5 m/s, a minute standing still, then 500 m at 5 m/s.
        List<double[]> readings = new ArrayList<>();
        for (int t = 0; t <= 100; t++) {
            readings.add(new double[] {t, t * 5.0});
        }
        for (int t = 101; t <= 160; t++) {
            readings.add(new double[] {t, 500.0});
        }
        for (int t = 161; t <= 260; t++) {
            readings.add(new double[] {t, 500.0 + (t - 160) * 5.0});
        }

        Map<String, Effort> found = byKey(compute(stream(readings.toArray(new double[0][]))));

        assertThat(found.get("1km").elapsedSeconds()).isCloseTo(260.0, within(0.1));
        assertThat(found.get("400m").elapsedSeconds()).isCloseTo(80.0, within(0.1));
    }

    @Test
    void standingStillAtTheEdgeOfAWindowDoesNot() {
        // A minute standing still at the start, then 1 km at 4 m/s, then a minute standing still at the end.
        List<double[]> readings = new ArrayList<>();
        for (int t = 0; t <= 60; t++) {
            readings.add(new double[] {t, 0.0});
        }
        for (int t = 1; t <= 250; t++) {
            readings.add(new double[] {60 + t, t * 4.0});
        }
        for (int t = 1; t <= 60; t++) {
            readings.add(new double[] {310 + t, 1000.0});
        }

        Effort effort = byKey(compute(stream(readings.toArray(new double[0][])))).get("1km");

        assertThat(effort.elapsedSeconds()).isCloseTo(250.0, within(0.1));
        assertThat(effort.startOffsetSeconds()).isEqualTo(60);
        assertThat(effort.endOffsetSeconds()).isEqualTo(310);
    }

    // ----- glitches and plausibility -----

    @Test
    void aJumpOfThePositionIsNotPartOfAnyEffort() {
        // 3 m/s, but at t=100 the position jumps 500 m in one second. A window that takes the jump in would be an
        // 84 second 400 m.
        List<double[]> readings = new ArrayList<>();
        double distance = 0;
        for (int t = 0; t <= 400; t++) {
            if (t == 101) {
                distance += 500.0;
            }
            readings.add(new double[] {t, distance});
            distance += 3.0;
        }

        Effort effort = byKey(compute(stream(readings.toArray(new double[0][])))).get("400m");

        assertThat(effort.elapsedSeconds()).isCloseTo(400.0 / 3.0, within(0.2));
    }

    @Test
    void aSingleFastSecondInASteadyRunKeepsEveryWindowThatTakesItInOut() {
        // 3 m/s, except that one second covers 15 m: not a jump of 500 m, but faster than anyone runs. A window that took it
        // in would be 12 m shorter, 4 seconds faster, than the steady stretch next to it.
        List<double[]> readings = new ArrayList<>();
        double distance = 0;
        for (int t = 0; t <= 400; t++) {
            readings.add(new double[] {t, distance});
            distance += t == 100 ? 15.0 : 3.0;
        }

        Effort effort = byKey(compute(stream(readings.toArray(new double[0][])))).get("400m");

        assertThat(effort.elapsedSeconds()).isCloseTo(400.0 / 3.0, within(0.1));
    }

    @Test
    void aWindowFasterThanOneFortyPerKilometreIsNotAnEffort() {
        assertThat(byKey(compute(steady(200, 10.5)))).doesNotContainKey("1km");
        assertThat(byKey(compute(steady(200, 9.9))).get("1km").elapsedSeconds()).isCloseTo(101.0, within(0.2));
    }

    @Test
    void aWholeStreamOfJumpsHasNoEfforts() {
        List<double[]> readings = new ArrayList<>();
        for (int t = 0; t <= 100; t++) {
            readings.add(new double[] {t * 10.0, t * 200.0}); // 20 m/s throughout
        }

        assertThat(compute(stream(readings.toArray(new double[0][])))).isEmpty();
    }

    // ----- how close together the readings are -----

    @Test
    void shortDistancesNeedReadingsCloseTogether() {
        Map<String, Effort> every20Seconds = byKey(compute(everyNSeconds(20)));
        Map<String, Effort> every10Seconds = byKey(compute(everyNSeconds(10)));

        assertThat(every20Seconds).doesNotContainKeys("400m", "half_mile").containsKey("1km");
        assertThat(every20Seconds.get("1km").elapsedSeconds()).isCloseTo(300.0, within(0.1));
        assertThat(every10Seconds).containsKeys("400m", "half_mile", "1km");
        assertThat(every10Seconds.get("400m").elapsedSeconds()).isCloseTo(120.0, within(0.1));
    }

    private static RunStream everyNSeconds(int step) {
        List<double[]> readings = new ArrayList<>();
        for (int t = 0; t <= 3600; t += step) {
            readings.add(new double[] {t, t * FIVE_MINUTES_PER_KM});
        }
        return stream(readings.toArray(new double[0][]));
    }

    // ----- what the stream is -----

    @Test
    void offsetsAreSecondsFromTheFirstReadingAndDistancesAreCountedFromIt() {
        // The stream starts 500 s in and 2 km along; the efforts do not care.
        List<double[]> readings = new ArrayList<>();
        for (int t = 0; t <= 1200; t++) {
            readings.add(new double[] {500 + t, 2000 + t * FIVE_MINUTES_PER_KM});
        }

        Effort effort = byKey(compute(stream(readings.toArray(new double[0][])))).get("3km");

        assertThat(effort.elapsedSeconds()).isCloseTo(900.0, within(0.1));
        assertThat(effort.startOffsetSeconds()).isBetween(0, 300);
        assertThat(effort.endOffsetSeconds()).isEqualTo(effort.startOffsetSeconds() + 900);
    }

    @Test
    void anUnusableStreamHasNoEfforts() {
        assertThat(BestEffortCalculator.compute(null, BestEffortDistances.ALL)).isEmpty();
        assertThat(BestEffortCalculator.compute(RunStream.of(List.of(), 0.0, 0.0), BestEffortDistances.ALL)).isEmpty();
        assertThat(BestEffortCalculator.compute(stream(new double[] {0, 0}), BestEffortDistances.ALL)).isEmpty();
    }

    @Test
    void theElapsedTimeIsRoundedToATenthOfASecond() {
        RunStream oddPace = steady(1000, 3.1);

        double elapsed = byKey(compute(oddPace)).get("1km").elapsedSeconds();

        assertThat(elapsed * 10).isCloseTo(Math.round(elapsed * 10), within(1e-9));
        assertThat(elapsed).isCloseTo(322.6, within(0.05));
    }

    @Test
    void aLongRunWithManyReadingsIsFast() {
        // 100,000 readings (a day of 1 Hz data) and all fifteen distances.
        RunStream long1Hz = steady(100_000, 3.0);

        long start = System.nanoTime();
        List<Effort> efforts = compute(long1Hz);
        long millis = (System.nanoTime() - start) / 1_000_000;

        assertThat(efforts).hasSize(BestEffortDistances.ALL.size());
        assertThat(millis).as("milliseconds").isLessThan(5000);
    }
}
