package com.hermes.backend.activity;

import com.hermes.backend.activity.ActivityAnalyticsHelper.SamplePoint;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RunStreamTests {

    private static SamplePoint point(Integer seconds, Double distance) {
        return new SamplePoint(40.78, -73.96, seconds, distance, null, null, null, null, null);
    }

    /** A stored row as the analytics query returns it: latitude, longitude, elapsed seconds, distance. */
    private static Object[] row(Integer seconds, Double distance) {
        return new Object[] {40.78, -73.96, seconds, distance, null, null, null, null, null, null, null};
    }

    // ----- which of the stored readings count -----

    @Test
    void aRunWithFewerThanTwoReadingsHasNoPoints() {
        assertThat(RunStream.samples(null, new Activity()).problem()).isEqualTo(PaceProfileResponse.NO_POINTS);
        assertThat(RunStream.samples(List.of(), new Activity()).problem()).isEqualTo(PaceProfileResponse.NO_POINTS);
        assertThat(RunStream.samples(List.<Object[]>of(row(0, 0.0)), new Activity()).problem()).isEqualTo(PaceProfileResponse.NO_POINTS);
    }

    @Test
    void aTrackWhereFewerThanHalfOfTheReadingsSayWhenHasNoTimes() {
        List<Object[]> rows = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            rows.add(row(i < 4 ? i : null, i * 10.0));
        }

        RunStream.Samples samples = RunStream.samples(rows, new Activity());

        assertThat(samples.problem()).isEqualTo(PaceProfileResponse.NO_TIMES);
        assertThat(samples.points()).isEmpty();
    }

    @Test
    void halfIsEnoughButAnOddCountIsNotRoundedInTheTracksFavour() {
        // 3 of 6 is exactly half and is used; 3 of 7 is fewer than half and is not; 4 of 7 is used.
        assertThat(RunStream.samples(rowsWithTimes(6, 3), new Activity()).problem()).isNull();
        assertThat(RunStream.samples(rowsWithTimes(7, 3), new Activity()).problem()).isEqualTo(PaceProfileResponse.NO_TIMES);
        assertThat(RunStream.samples(rowsWithTimes(7, 4), new Activity()).problem()).isNull();
        // Two timed readings are the least a stream can be made of, however short the track.
        assertThat(RunStream.samples(rowsWithTimes(2, 1), new Activity()).problem()).isEqualTo(PaceProfileResponse.NO_TIMES);
        assertThat(RunStream.samples(rowsWithTimes(2, 2), new Activity()).problem()).isNull();
    }

    private static List<Object[]> rowsWithTimes(int rows, int timed) {
        List<Object[]> list = new ArrayList<>();
        for (int i = 0; i < rows; i++) {
            list.add(row(i < timed ? i : null, i * 10.0));
        }
        return list;
    }

    @Test
    void whenMostReadingsSayWhenOnlyThoseAreUsed() {
        List<Object[]> rows = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            rows.add(row(i % 3 == 1 ? null : i, i * 10.0));
        }

        RunStream.Samples samples = RunStream.samples(rows, new Activity());

        assertThat(samples.problem()).isNull();
        assertThat(samples.points()).hasSize(7);
        assertThat(samples.points()).extracting(SamplePoint::elapsedSeconds).doesNotContainNull();
    }

    // ----- tidying the stream -----

    @Test
    void timeAndDistanceAreCountedFromTheFirstReading() {
        RunStream stream = RunStream.of(List.of(point(500, 2000.0), point(510, 2040.0), point(520, 2090.0)), 0.0, 0.0);

        assertThat(stream.usable()).isTrue();
        assertThat(stream.n()).isEqualTo(3);
        assertThat(stream.t()).containsExactly(0.0, 10.0, 20.0);
        assertThat(stream.d()).containsExactly(0.0, 40.0, 90.0);
    }

    @Test
    void readingsWithNoTimeOrDistanceOrThatGoBackAreDroppedAndTwoInOneSecondBecomeOne() {
        List<SamplePoint> points = new ArrayList<>();
        points.add(point(0, 0.0));
        points.add(point(null, 10.0));          // no time
        points.add(point(10, null));            // no distance
        points.add(point(20, -5.0));            // a distance that is not one
        points.add(point(30, 100.0));
        points.add(point(25, 120.0));           // goes back in time
        points.add(point(40, 90.0));            // goes back in distance
        points.add(point(50, 200.0));
        points.add(point(50, 210.0));           // the same second: the later distance wins
        points.add(point(60, 300.0));
        points.add(null);

        RunStream stream = RunStream.of(points, 0.0, 0.0);

        assertThat(stream.t()).containsExactly(0.0, 30.0, 50.0, 60.0);
        assertThat(stream.d()).containsExactly(0.0, 100.0, 210.0, 300.0);
    }

    @Test
    void nonfiniteDistancesCannotPoisonTheStreamOrItsBestEfforts() {
        List<SamplePoint> points = new ArrayList<>();
        points.add(point(0, Double.NaN));
        points.add(point(1, Double.POSITIVE_INFINITY));
        points.add(point(2, Double.NEGATIVE_INFINITY));
        for (int second = 0; second <= 120; second++) {
            points.add(point(10 + second, 100 + second * (1000.0 / 300.0)));
            if (second == 30) points.add(point(41, Double.NaN));
            if (second == 60) points.add(point(71, Double.POSITIVE_INFINITY));
            if (second == 90) points.add(point(101, Double.NEGATIVE_INFINITY));
        }

        RunStream stream = RunStream.of(points, 0, 0);

        assertThat(stream.t()).hasSize(121);
        assertThat(stream.d()).hasSize(121);
        for (double distance : stream.d()) assertThat(distance).isFinite();
        assertThat(stream.d()[0]).isZero();
        assertThat(stream.d()[120]).isEqualTo(400);
        assertThat(BestEffortCalculator.compute(stream, List.of(BestEffortDistances.byKey("400m").orElseThrow())))
                .singleElement().satisfies(effort -> {
                    assertThat(effort.elapsedSeconds()).isEqualTo(120);
                    assertThat(effort.distanceMeters()).isEqualTo(400);
                });
    }

    @Test
    void aStreamThatIsTooShortOrHasNothingUsableSaysWhy() {
        assertThat(RunStream.of(null, 0.0, 0.0).problem()).isEqualTo(PaceProfileResponse.NO_POINTS);
        assertThat(RunStream.of(List.of(point(0, 0.0)), 0.0, 0.0).problem()).isEqualTo(PaceProfileResponse.NO_POINTS);
        assertThat(RunStream.of(List.of(point(null, 0.0), point(null, 5.0)), 0.0, 0.0).problem()).isEqualTo(PaceProfileResponse.NO_POINTS);
        assertThat(RunStream.of(List.of(point(0, 0.0), point(30, 99.0)), 100.0, 10.0).problem()).isEqualTo(PaceProfileResponse.TOO_SHORT);
        assertThat(RunStream.of(List.of(point(0, 0.0), point(9, 500.0)), 100.0, 10.0).problem()).isEqualTo(PaceProfileResponse.TOO_SHORT);
        assertThat(RunStream.of(List.of(point(5, 0.0), point(5, 400.0), point(5, 800.0)), 0.0, 0.0).problem()).isEqualTo(PaceProfileResponse.TOO_SHORT);
        assertThat(RunStream.of(List.of(point(0, 0.0), point(30, 100.0)), 100.0, 10.0).usable()).isTrue();
    }

    @Test
    void elevationIsKeptWhereThereWasOneAndNotANumberWhereThereWasNot() {
        List<SamplePoint> points = List.of(
                new SamplePoint(40.78, -73.96, 0, 0.0, 12.0, null, null, null, null),
                new SamplePoint(40.78, -73.96, 10, 30.0, null, null, null, null, null),
                new SamplePoint(40.78, -73.96, 20, 60.0, Double.NaN, null, null, null, null),
                new SamplePoint(40.78, -73.96, 30, 90.0, 15.5, null, null, null, null));

        RunStream stream = RunStream.of(points, 0.0, 0.0);

        assertThat(stream.z()[0]).isEqualTo(12.0);
        assertThat(Double.isNaN(stream.z()[1])).isTrue();
        assertThat(Double.isNaN(stream.z()[2])).isTrue();
        assertThat(stream.z()[3]).isEqualTo(15.5);
    }
}
