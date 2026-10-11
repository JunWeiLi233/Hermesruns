package com.hermes.backend.activity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.assertj.core.api.Assertions.withinPercentage;

class GradeAdjustedPaceTests {

    /** The quadratic, written out here so a change to the constants cannot make the table below agree by accident. */
    private static double quadratic(double slope) {
        return 1 + 2.896 * slope + 15.14 * slope * slope;
    }

    @Test
    void aFlatMetreIsWorthExactlyAFlatMetre() {
        assertThat(GradeAdjustedPace.effortRatio(0.0)).isEqualTo(1.0);
    }

    @ParameterizedTest(name = "a {0} climb: a metre is worth {1} flat metres")
    @CsvSource({"0.01,1.0305", "0.05,1.1826", "0.10,1.4410", "0.15,1.7750", "0.20,2.1848", "0.30,3.2314"})
    void aClimbIsWorthMoreThanAFlatMetre(double grade, double expected) {
        assertThat(GradeAdjustedPace.effortRatio(grade)).isCloseTo(expected, within(0.0005));
        assertThat(GradeAdjustedPace.effortRatio(grade)).isCloseTo(quadratic(grade), within(1e-9));
    }

    @ParameterizedTest(name = "a {0} descent: a metre is worth {1} flat metres")
    @CsvSource({"-0.01,0.9726", "-0.05,0.8931", "-0.10,0.8618", "-0.15,0.9062", "-0.20,1.0264"})
    void aGentleDescentIsWorthLessAndASteepOneBringsItBackUp(double grade, double expected) {
        assertThat(GradeAdjustedPace.effortRatio(grade)).isCloseTo(expected, within(0.0005));
        assertThat(GradeAdjustedPace.effortRatio(grade)).isCloseTo(quadratic(grade), within(1e-9));
    }

    @Test
    void aClimbBeyondThirtyPercentCountsAsThirtyAndADescentBeyondTwentyAsTwenty() {
        assertThat(GradeAdjustedPace.effortRatio(0.5)).isEqualTo(GradeAdjustedPace.effortRatio(0.30));
        assertThat(GradeAdjustedPace.effortRatio(Double.POSITIVE_INFINITY)).isEqualTo(GradeAdjustedPace.effortRatio(0.30));
        assertThat(GradeAdjustedPace.effortRatio(-0.30)).isEqualTo(GradeAdjustedPace.effortRatio(-0.20));
        assertThat(GradeAdjustedPace.effortRatio(-0.5)).isEqualTo(GradeAdjustedPace.effortRatio(-0.20));
        assertThat(GradeAdjustedPace.effortRatio(Double.NEGATIVE_INFINITY)).isEqualTo(GradeAdjustedPace.effortRatio(-0.20));
        assertThat(GradeAdjustedPace.effortRatio(0.31)).isEqualTo(GradeAdjustedPace.effortRatio(0.30));
        assertThat(GradeAdjustedPace.effortRatio(0.29)).isLessThan(GradeAdjustedPace.effortRatio(0.30));
    }

    @Test
    void anUnknownGradeIsTreatedAsFlat() {
        assertThat(GradeAdjustedPace.effortRatio(Double.NaN)).isEqualTo(1.0);
    }

    @Test
    void climbingNeverGetsCheaperAsItGetsSteeper() {
        double previous = 1.0;
        for (double grade = 0.0; grade <= 0.30001; grade += 0.005) {
            double ratio = GradeAdjustedPace.effortRatio(grade);
            assertThat(ratio).as("grade %.3f", grade).isGreaterThanOrEqualTo(previous);
            previous = ratio;
        }
    }

    // What is public about Strava's grade adjusted pace, which the quadratic is held to (see the class comment).

    @Test
    void theEasiestDescentIsAboutMinusTenPercentAsStravasHelpCentreSays() {
        double easiestGrade = 0.0;
        double easiest = 1.0;
        for (double grade = 0.0; grade >= -0.20001; grade -= 0.001) {
            double ratio = GradeAdjustedPace.effortRatio(grade);
            if (ratio < easiest) {
                easiest = ratio;
                easiestGrade = grade;
            }
        }

        assertThat(easiestGrade).isBetween(-0.105, -0.09);
        assertThat(easiest).isBetween(0.85, 0.87);
    }

    @Test
    void aDescentOfAboutEighteenPercentIsWhereTheAdjustedPaceStopsBeingSlowerThanThePaceRun() {
        assertThat(GradeAdjustedPace.effortRatio(-0.16)).isLessThan(1.0);
        assertThat(GradeAdjustedPace.effortRatio(-0.18)).isLessThan(1.0);
        assertThat(GradeAdjustedPace.effortRatio(-0.20)).isGreaterThan(1.0);
        assertThat(GradeAdjustedPace.adjust(300.0, -0.20)).isLessThan(300.0);
    }

    @Test
    void aTenPercentClimbIsWorthWhatStravasExampleSaysWithinThreePercent() {
        // The pace that matches 3:30 /km on the flat is 5:08 /km on a 10% climb (Strava's 2017 post, as quoted).
        double pacedUp = 210.0 * GradeAdjustedPace.effortRatio(0.10);

        assertThat(pacedUp).isCloseTo(308.0, withinPercentage(3.0));
        assertThat(GradeAdjustedPace.adjust(308.0, 0.10)).isCloseTo(210.0, withinPercentage(3.0));
    }

    @Test
    void aClimbIsNotAsDearAsMinettisTreadmillCostWouldMakeIt() {
        // Minetti's cost of running makes a 10% climb 1.66 times a flat metre, which Strava's own example contradicts.
        assertThat(GradeAdjustedPace.effortRatio(0.10)).isLessThan(1.5);
    }

    @Test
    void aClimbMakesTheFlatEquivalentPaceFasterAndAGentleDescentMakesItSlower() {
        assertThat(GradeAdjustedPace.adjust(300.0, 0.10)).isCloseTo(300.0 / 1.4410, within(0.05));
        assertThat(GradeAdjustedPace.adjust(300.0, -0.10)).isCloseTo(300.0 / 0.8618, within(0.05));
        assertThat(GradeAdjustedPace.adjust(300.0, 0.0)).isEqualTo(300.0);
        assertThat(GradeAdjustedPace.adjust(300.0, 0.10)).isLessThan(300.0);
        assertThat(GradeAdjustedPace.adjust(300.0, -0.10)).isGreaterThan(300.0);
    }

    @Test
    void aMissingPaceStaysMissing() {
        assertThat(GradeAdjustedPace.adjust(Double.NaN, 0.05)).isNaN();
        assertThat(GradeAdjustedPace.adjust(0.0, 0.05)).isEqualTo(0.0);
    }
}
