package com.hermes.backend.activity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class ElevationAscentTests {

    private static List<Double> profile(Double... elevations) {
        return Arrays.asList(elevations);
    }

    @Test
    void aSmoothHillIsCountedInFull() {
        List<Double> climb = new ArrayList<>();
        for (int metre = 0; metre <= 30; metre++) climb.add((double) metre);

        assertThat(ElevationAscent.of(climb)).isEqualTo(30.0);
    }

    @Test
    void everyRiseFromAValleyToAPeakCounts() {
        // 0 up to 20, down to 5, up to 25: two rises of 20.
        assertThat(ElevationAscent.of(profile(0.0, 10.0, 20.0, 12.0, 5.0, 15.0, 25.0))).isEqualTo(40.0);
    }

    @Test
    void aRunThatEndsOnTheWayUpCountsTheRiseSoFar() {
        // Up 10, down 6, up 5 and the file stops: 10 + 5.
        assertThat(ElevationAscent.of(profile(0.0, 10.0, 4.0, 9.0))).isEqualTo(15.0);
    }

    @Test
    void theFlickerOfASensorOnFlatGroundIsNotAClimb() {
        List<Double> flat = new ArrayList<>();
        for (int i = 0; i < 2000; i++) flat.add(100.0 + (i % 2 == 0 ? 1.0 : -1.0) + (i % 7 == 0 ? 0.8 : 0.0));

        assertThat(ElevationAscent.of(flat)).isEqualTo(0.0);
    }

    @Test
    void aRiseSmallerThanTheNoiseThresholdIsNotCounted() {
        assertThat(ElevationAscent.of(profile(50.0, 52.0, 51.5, 52.5))).isEqualTo(0.0);
    }

    @Test
    void aDescentOnlyIsAClimbOfZeroNotNoFigure() {
        assertThat(ElevationAscent.of(profile(80.0, 60.0, 40.0, 20.0))).isEqualTo(0.0);
    }

    @Test
    void noElevationDataIsNoFigureNotZero() {
        assertThat(ElevationAscent.of(null)).isNull();
        assertThat(ElevationAscent.of(List.of())).isNull();
        assertThat(ElevationAscent.of(profile(null, null, null))).isNull();
        assertThat(ElevationAscent.of(profile(12.0))).as("one point is no profile").isNull();
    }

    @Test
    void pointsWithoutElevationAreSkippedWhereTheyFall() {
        assertThat(ElevationAscent.of(profile(0.0, null, 10.0, null, 20.0, Double.NaN, 30.0))).isEqualTo(30.0);
    }

    @Test
    void theFirstRiseCountsFromTheStartEvenWhenItBeginsWithinTheNoise() {
        // The first points wobble; the climb that follows starts from where the run did.
        assertThat(ElevationAscent.of(profile(100.0, 101.0, 100.5, 108.0, 120.0))).isEqualTo(20.0);
    }

    @Test
    void theResultHasOneDecimal() {
        assertThat(ElevationAscent.of(profile(0.0, 10.04, 20.04))).isEqualTo(20.0);
        assertThat(ElevationAscent.of(profile(0.0, 12.34))).isEqualTo(12.3);
    }
}
