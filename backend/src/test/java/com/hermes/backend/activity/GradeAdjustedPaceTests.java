package com.hermes.backend.activity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class GradeAdjustedPaceTests {

    /** Minetti et al. (2002), cost of running in J per kg per metre, for a slope as a fraction (0.1 is 10%). */
    private static double minettiCost(double slope) {
        return 155.4 * Math.pow(slope, 5) - 30.4 * Math.pow(slope, 4) - 43.3 * Math.pow(slope, 3)
                + 46.3 * Math.pow(slope, 2) + 19.5 * slope + 3.6;
    }

    @Test
    void theFlatCostsExactlyTheFlatCost() {
        assertThat(GradeAdjustedPace.costRatio(0.0)).isEqualTo(1.0);
    }

    @ParameterizedTest(name = "uphill {0} is {1} times the flat cost")
    @CsvSource({"0.01,1.0554", "0.05,1.3014", "0.10,1.6578", "0.20,2.5019", "0.30,3.4942"})
    void uphillFollowsTheMinettiCostOfRunning(double grade, double expected) {
        assertThat(GradeAdjustedPace.costRatio(grade)).isCloseTo(expected, within(0.0005));
        assertThat(GradeAdjustedPace.costRatio(grade)).isCloseTo(minettiCost(grade) / 3.6, within(1e-9));
    }

    @ParameterizedTest(name = "downhill {0} is {1} times the flat cost")
    @CsvSource({"-0.01,0.9736", "-0.05,0.8814", "-0.10,0.7988", "-0.20,0.7500", "-0.30,0.8420"})
    void downhillGetsHalfOfTheMetabolicSavingMinettiMeasured(double grade, double expected) {
        double minettiRatio = minettiCost(grade) / 3.6;
        assertThat(GradeAdjustedPace.costRatio(grade)).isCloseTo(expected, within(0.0005));
        // Half of the saving Minetti measured on a treadmill: a runner braking on a real descent does not keep all of it.
        assertThat(1 - GradeAdjustedPace.costRatio(grade)).isCloseTo(0.5 * (1 - minettiRatio), within(1e-9));
    }

    @Test
    void aGradeBeyondThirtyPercentCountsAsThirtyPercent() {
        assertThat(GradeAdjustedPace.costRatio(0.5)).isEqualTo(GradeAdjustedPace.costRatio(0.30));
        assertThat(GradeAdjustedPace.costRatio(-0.5)).isEqualTo(GradeAdjustedPace.costRatio(-0.30));
        assertThat(GradeAdjustedPace.costRatio(Double.POSITIVE_INFINITY)).isEqualTo(GradeAdjustedPace.costRatio(0.30));
        assertThat(GradeAdjustedPace.costRatio(Double.NEGATIVE_INFINITY)).isEqualTo(GradeAdjustedPace.costRatio(-0.30));
    }

    @Test
    void anUnknownGradeIsTreatedAsFlat() {
        assertThat(GradeAdjustedPace.costRatio(Double.NaN)).isEqualTo(1.0);
    }

    @Test
    void climbingNeverGetsCheaperAndDescendingNeverCostsLessThanAboutThreeQuartersOfTheFlat() {
        double previous = 1.0;
        for (double grade = 0.0; grade <= 0.30001; grade += 0.005) {
            double ratio = GradeAdjustedPace.costRatio(grade);
            assertThat(ratio).as("grade %.3f", grade).isGreaterThanOrEqualTo(previous);
            previous = ratio;
        }
        for (double grade = 0.0; grade >= -0.30001; grade -= 0.005) {
            assertThat(GradeAdjustedPace.costRatio(grade)).as("grade %.3f", grade).isBetween(0.74, 1.0);
        }
    }

    @Test
    void theBiggestDownhillBenefitIsAroundMinusTwentyPercentAndShrinksAfterThat() {
        assertThat(GradeAdjustedPace.costRatio(-0.30)).isGreaterThan(GradeAdjustedPace.costRatio(-0.20));
        assertThat(GradeAdjustedPace.costRatio(-0.10)).isGreaterThan(GradeAdjustedPace.costRatio(-0.20));
        assertThat(GradeAdjustedPace.costRatio(-0.20)).isCloseTo(0.75, within(0.001));
    }

    @Test
    void aClimbMakesTheFlatEquivalentPaceFasterAndADescentMakesItSlower() {
        assertThat(GradeAdjustedPace.adjust(300.0, 0.10)).isCloseTo(300.0 / 1.6578, within(0.05));
        assertThat(GradeAdjustedPace.adjust(300.0, -0.10)).isCloseTo(300.0 / 0.7988, within(0.05));
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
