package com.hermes.backend.activity;

import com.hermes.backend.activity.RouteMatcher.Route;
import com.hermes.backend.activity.RouteMatcher.Tolerances;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalDouble;
import java.util.Random;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class RouteMatcherTests {

    private static final double METERS_PER_DEGREE = 6_371_000.0 * Math.PI / 180.0;
    private static final Tolerances DEFAULTS = Tolerances.defaults();
    private static final double LAT = 40.78;
    private static final double LON = -73.96;

    /** North from a start for {@code meters}, a position every 10 m. */
    private static List<double[]> north(double startLat, double startLon, double meters) {
        List<double[]> points = new ArrayList<>();
        for (double d = 0; d <= meters; d += 10) {
            points.add(new double[] {startLat + d / METERS_PER_DEGREE, startLon});
        }
        return points;
    }

    /** A circle of the given length that starts at its bottom and runs round counter-clockwise or clockwise. */
    private static List<double[]> loop(double startLat, double startLon, double length, boolean counterClockwise) {
        double radius = length / (2 * Math.PI);
        double cosLat = Math.cos(Math.toRadians(startLat));
        List<double[]> points = new ArrayList<>();
        for (int i = 0; i <= 300; i++) {
            double theta = 2 * Math.PI * i / 300;
            double east = radius * Math.sin(theta) * (counterClockwise ? 1 : -1);
            double north = radius * (1 - Math.cos(theta));
            points.add(new double[] {startLat + north / METERS_PER_DEGREE, startLon + east / (METERS_PER_DEGREE * cosLat)});
        }
        return points;
    }

    private static List<double[]> outAndBack(double startLat, double startLon, double oneWayMeters) {
        List<double[]> points = north(startLat, startLon, oneWayMeters);
        List<double[]> back = new ArrayList<>(points);
        java.util.Collections.reverse(back);
        points.addAll(back);
        return points;
    }

    private static Route route(List<double[]> points, double meters) {
        return RouteMatcher.of(points, meters, DEFAULTS);
    }

    // ----- the route of one run -----

    @Test
    void anOpenRouteHasItsEndsItsDistanceAndWhichWayItGoes() {
        Route route = route(north(LAT, LON, 6000), 6012.0);

        assertThat(route.startLatitude()).isEqualTo(LAT);
        assertThat(route.endLatitude()).isCloseTo(LAT + 6000 / METERS_PER_DEGREE, within(1e-9));
        assertThat(route.distanceMeters()).isEqualTo(6012.0);
        assertThat(route.loop()).isFalse();
        assertThat(route.winding()).isZero();
        assertThat(route.bearingDegrees()).isCloseTo(0.0, within(0.01));
    }

    @Test
    void theBearingOfARouteIsClockwiseFromNorth() {
        List<double[]> east = new ArrayList<>();
        for (double d = 0; d <= 3000; d += 10) {
            east.add(new double[] {LAT, LON + d / (METERS_PER_DEGREE * Math.cos(Math.toRadians(LAT)))});
        }

        assertThat(route(east, 3000).bearingDegrees()).isCloseTo(90.0, within(0.05));
        assertThat(RouteMatcher.bearing(new double[] {LAT, LON}, new double[] {LAT - 0.01, LON})).isCloseTo(180.0, within(0.01));
        assertThat(RouteMatcher.bearing(new double[] {LAT, LON}, new double[] {LAT, LON - 0.01})).isCloseTo(270.0, within(0.5));
    }

    @Test
    void aLoopKnowsWhichWayRoundItWasRun() {
        Route counterClockwise = route(loop(LAT, LON, 5000, true), 5000);
        Route clockwise = route(loop(LAT, LON, 5000, false), 5000);

        assertThat(counterClockwise.loop()).isTrue();
        assertThat(counterClockwise.winding()).isEqualTo(1);
        assertThat(counterClockwise.bearingDegrees()).isNull();
        assertThat(clockwise.loop()).isTrue();
        assertThat(clockwise.winding()).isEqualTo(-1);
    }

    @Test
    void anOutAndBackIsALoopThatEnclosesNothing() {
        Route route = route(outAndBack(LAT, LON, 3000), 6000);

        assertThat(route.loop()).isTrue();
        assertThat(route.winding()).isZero();
    }

    @Test
    void aLoopStaysWoundTheSameWayWithGpsNoise() {
        Random random = new Random(11);
        List<double[]> noisy = new ArrayList<>();
        for (double[] point : loop(LAT, LON, 5000, false)) {
            noisy.add(new double[] {point[0] + random.nextGaussian() * 5 / METERS_PER_DEGREE, point[1] + random.nextGaussian() * 5 / METERS_PER_DEGREE});
        }

        assertThat(route(noisy, 5000).winding()).isEqualTo(-1);
    }

    @Test
    void aRunThatEndsJustOutsideTheToleranceIsAnOpenRouteNotALoop() {
        List<double[]> back = new ArrayList<>(north(LAT, LON, 3000));
        java.util.Collections.reverse(back); // from 3 km down to the start

        List<double[]> endsOneHundredMetresShort = new ArrayList<>(north(LAT, LON, 3000));
        endsOneHundredMetresShort.addAll(back.subList(0, back.size() - 10));
        List<double[]> endsTwoHundredMetresShort = new ArrayList<>(north(LAT, LON, 3000));
        endsTwoHundredMetresShort.addAll(back.subList(0, back.size() - 20));

        assertThat(route(endsOneHundredMetresShort, 5900).loop()).isTrue();
        Route open = route(endsTwoHundredMetresShort, 5800);
        assertThat(open.loop()).isFalse();
        assertThat(open.bearingDegrees()).isCloseTo(0.0, within(0.01));
    }

    @Test
    void thePositionsAreCleanedAndAShortOrEmptyRunIsNoRoute() {
        List<double[]> dirty = new ArrayList<>(north(LAT, LON, 3000));
        dirty.add(0, new double[] {0.0, 0.0});
        dirty.add(1, new double[] {Double.NaN, LON});
        dirty.add(2, new double[] {95.0, LON});
        dirty.add(3, null);
        dirty.add(4, new double[] {LAT});

        assertThat(route(dirty, 3000).startLatitude()).isEqualTo(LAT);
        assertThat(route(north(LAT, LON, 600), 600)).isNull();
        assertThat(route(north(LAT, LON, 600), 0)).isNull();
        assertThat(route(List.of(), 5000)).isNull();
        assertThat(route(null, 5000)).isNull();
        assertThat(route(List.of(new double[] {LAT, LON}), 5000)).isNull();
    }

    @Test
    void whenTheDeviceGaveNoDistanceTheLengthOfTheTrackIsUsed() {
        Route route = route(north(LAT, LON, 3000), 0);

        assertThat(route.distanceMeters()).isCloseTo(3000.0, within(1.0));
    }

    // ----- is it the same route -----

    private static OptionalDouble fit(Route group, Route run) {
        return RouteMatcher.fit(group, run, DEFAULTS);
    }

    @Test
    void theSameRouteFitsAndTheNearerOneFitsBetter() {
        Route group = route(north(LAT, LON, 6000), 6000);
        Route sameDoor = route(north(LAT, LON, 6000), 6000);
        Route aLittleOff = route(north(LAT + 40 / METERS_PER_DEGREE, LON, 6000), 6000);

        assertThat(fit(group, sameDoor)).isPresent();
        assertThat(fit(group, aLittleOff)).isPresent();
        assertThat(fit(group, sameDoor).getAsDouble()).isLessThan(fit(group, aLittleOff).getAsDouble());
    }

    @Test
    void aStartOrAFinishMoreThanTheToleranceAwayIsAnotherRoute() {
        Route group = route(north(LAT, LON, 6000), 6000);
        Route startsLater = route(north(LAT + 170 / METERS_PER_DEGREE, LON, 5830), 5830);
        Route finishesEarlier = route(north(LAT, LON, 5830), 5830);
        Route startsEarlier = route(north(LAT - 120 / METERS_PER_DEGREE, LON, 6000), 6000);

        assertThat(fit(group, startsLater)).isEmpty();
        assertThat(fit(group, finishesEarlier)).isEmpty();
        assertThat(fit(group, startsEarlier)).isPresent();
    }

    @Test
    void theDistancesMustBeWithinFivePercentOfTheGroups() {
        Route group = route(north(LAT, LON, 6000), 6000);

        assertThat(fit(group, route(north(LAT, LON, 6000), 6290))).isPresent();
        assertThat(fit(group, route(north(LAT, LON, 6000), 5710))).isPresent();
        assertThat(fit(group, route(north(LAT, LON, 6000), 6310))).isEmpty();
        assertThat(fit(group, route(north(LAT, LON, 6000), 5690))).isEmpty();
    }

    @Test
    void aRouteRunTheOtherWayRoundIsAnotherRoute() {
        Route there = route(north(LAT, LON, 6000), 6000);
        List<double[]> reversed = new ArrayList<>(north(LAT, LON, 6000));
        java.util.Collections.reverse(reversed);

        assertThat(fit(there, route(reversed, 6000))).isEmpty();
    }

    @Test
    void loopsMustGoRoundTheSameWay() {
        Route counterClockwise = route(loop(LAT, LON, 5000, true), 5000);
        Route clockwise = route(loop(LAT, LON, 5000, false), 5000);

        assertThat(fit(counterClockwise, route(loop(LAT, LON, 5000, true), 5030))).isPresent();
        assertThat(fit(counterClockwise, clockwise)).isEmpty();
        assertThat(fit(clockwise, counterClockwise)).isEmpty();
    }

    @Test
    void aLoopAnAnOutAndBackAndAnOpenRouteAreNeverTheSameRoute() {
        Route open = route(north(LAT, LON, 5000), 5000);
        Route loop = route(loop(LAT, LON, 5000, true), 5000);
        Route outAndBack = route(outAndBack(LAT, LON, 2500), 5000);

        assertThat(fit(open, loop)).isEmpty();
        assertThat(fit(loop, open)).isEmpty();
        assertThat(fit(loop, outAndBack)).isEmpty();
        assertThat(fit(outAndBack, loop)).isEmpty();
        assertThat(fit(outAndBack, route(outAndBack(LAT, LON, 2500), 5010))).isPresent();
    }

    @Test
    void theNearerFinishAlsoFitsBetter() {
        Route group = route(north(LAT, LON, 6000), 6000);
        Route finishesNear = route(north(LAT, LON, 5980), 6000);
        Route finishesFar = route(north(LAT, LON, 5880), 6000);

        assertThat(fit(group, finishesNear)).isPresent();
        assertThat(fit(group, finishesFar)).isPresent();
        assertThat(fit(group, finishesNear).getAsDouble()).isLessThan(fit(group, finishesFar).getAsDouble());
    }

    @Test
    void aLoopIsNeverAnOpenRouteEvenWhenTheEndsOfTheOpenOneAreWithinTheTolerance() {
        Route loop = route(loop(LAT, LON, 5000, true), 5000);
        // Two ends 240 m apart, centred on the loop's door: each is 120 m from it, inside the 150 m tolerance.
        Route open = route(north(LAT - 120 / METERS_PER_DEGREE, LON, 240), 5000);

        assertThat(loop.loop()).isTrue();
        assertThat(open.loop()).isFalse();
        assertThat(fit(loop, open)).isEmpty();
        assertThat(fit(open, loop)).isEmpty();
    }

    @Test
    void theTolerancesAreSettings() {
        Route group = route(north(LAT, LON, 6000), 6000);
        Route off = route(north(LAT + 300 / METERS_PER_DEGREE, LON, 5700), 5700);

        assertThat(RouteMatcher.fit(group, off, DEFAULTS)).isEmpty();
        assertThat(RouteMatcher.fit(group, off, new Tolerances(400.0, 0.06))).isPresent();
        assertThat(RouteMatcher.fit(group, off, new Tolerances(400.0, 0.04))).isEmpty();
    }
}
