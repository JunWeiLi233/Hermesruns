package com.hermes.backend.coaching;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * The spread of running time over three bands and the name it is given. The index is checked against the values the
 * Polarization-Index paper (Treff et al., 2019) gives for its own examples, so the formula is the published one.
 */
class IntensityModelTests {

    private static IntensityModel.Shares shares(double low, double moderate, double high) {
        return new IntensityModel.Shares(low, moderate, high);
    }

    @Test
    void zonesOneToThreeAreLowZoneFourIsModerateAndZoneFiveIsHigh() {
        IntensityModel.Shares shares = IntensityModel.shares(new long[] {100, 200, 300, 400, 500});

        assertThat(shares.low()).isCloseTo(600.0 / 1500, within(1e-12));
        assertThat(shares.moderate()).isCloseTo(400.0 / 1500, within(1e-12));
        assertThat(shares.high()).isCloseTo(500.0 / 1500, within(1e-12));
        assertThat(shares.low() + shares.moderate() + shares.high()).isCloseTo(1.0, within(1e-12));
    }

    @Test
    void noTimeInTheZonesIsNoShares() {
        assertThat(IntensityModel.shares(new long[] {0, 0, 0, 0, 0})).isNull();
        assertThat(IntensityModel.polarizationIndex(null)).isNull();
    }

    @Test
    void aNegativeTimeCountsForNothing() {
        IntensityModel.Shares shares = IntensityModel.shares(new long[] {-50, 100, 0, 0, 0});

        assertThat(shares.low()).isEqualTo(1.0);
    }

    @Test
    void thereAreFiveZonesAndNoOtherNumber() {
        assertThatThrownBy(() -> IntensityModel.shares(new long[] {1, 2, 3}))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> IntensityModel.shares(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theIndexIsTheOneThePaperPublishes() {
        // (low / moderate) x high x 100, shares as fractions of one, then the base 10 logarithm.
        assertThat(IntensityModel.polarizationIndex(shares(0.80, 0.05, 0.15))).isCloseTo(Math.log10(240), within(1e-9));
        assertThat(IntensityModel.polarizationIndex(shares(0.75, 0.05, 0.20))).isCloseTo(2.4771, within(1e-4));
        // The paper's examples: 60-14-26 is just over the line, 60-19-21 just under it, 67.3-30.2-2.5 is 0.75.
        assertThat(IntensityModel.polarizationIndex(shares(0.60, 0.14, 0.26))).isCloseTo(2.047, within(1e-3));
        assertThat(IntensityModel.polarizationIndex(shares(0.60, 0.19, 0.21))).isCloseTo(1.822, within(1e-3));
        assertThat(IntensityModel.polarizationIndex(shares(0.673, 0.302, 0.025))).isCloseTo(0.75, within(0.005));
    }

    @Test
    void anEmptyModerateShareIsOnePercentAndNoHighShareIsZero() {
        // 80-0-20: the moderate share stands as 1%, so the index is log10(80 x 0.2 x 100).
        assertThat(IntensityModel.polarizationIndex(shares(0.80, 0.0, 0.20))).isCloseTo(Math.log10(1600), within(1e-9));
        assertThat(IntensityModel.polarizationIndex(shares(0.90, 0.10, 0.0))).isEqualTo(0.0);
    }

    @Test
    void theIndexIsNotDefinedWhenThereIsMoreHighTimeThanLowTime() {
        assertThat(IntensityModel.polarizationIndex(shares(0.20, 0.10, 0.70))).isNull();
    }

    private static IntensityModel.Pattern named(double low, double moderate, double high) {
        IntensityModel.Shares shares = shares(low, moderate, high);
        return IntensityModel.pattern(shares, IntensityModel.polarizationIndex(shares), 10, 36000);
    }

    @Test
    void aSpreadIsNamedByWhichBandHoldsTheMostTimeAndHowTheRestIsOrdered() {
        assertThat(named(0.80, 0.05, 0.15)).isEqualTo(IntensityModel.Pattern.POLARIZED);
        assertThat(named(0.70, 0.20, 0.10)).isEqualTo(IntensityModel.Pattern.PYRAMIDAL);
        assertThat(named(0.40, 0.50, 0.10)).isEqualTo(IntensityModel.Pattern.THRESHOLD);
        assertThat(named(0.20, 0.10, 0.70)).isEqualTo(IntensityModel.Pattern.HIGH);
    }

    @Test
    void moreHighThanModerateTimeIsNotPolarizedWhenTheIndexSaysNot() {
        // 60-19-21: low is the largest and high is larger than moderate, but the index is 1.82, under the line.
        assertThat(named(0.60, 0.19, 0.21)).isEqualTo(IntensityModel.Pattern.MIXED);
        // 60-14-26: the same order, index 2.05: polarized.
        assertThat(named(0.60, 0.14, 0.26)).isEqualTo(IntensityModel.Pattern.POLARIZED);
    }

    @Test
    void aTieForTheLargestBandIsReadTheSafeWay() {
        // Moderate as large as low is threshold-heavy; low and high level with a smaller middle have no name of their own.
        assertThat(named(0.45, 0.45, 0.10)).isEqualTo(IntensityModel.Pattern.THRESHOLD);
        assertThat(named(0.40, 0.20, 0.40)).isEqualTo(IntensityModel.Pattern.MIXED);
    }

    @Test
    void aLowBandThatIsAllOfItIsPyramidalNotPolarized() {
        assertThat(named(1.0, 0.0, 0.0)).isEqualTo(IntensityModel.Pattern.PYRAMIDAL);
    }

    @Test
    void tooLittleHeartRateTimeNamesNothing() {
        IntensityModel.Shares shares = shares(0.80, 0.05, 0.15);
        Double index = IntensityModel.polarizationIndex(shares);

        assertThat(IntensityModel.pattern(shares, index, 2, 36000)).isEqualTo(IntensityModel.Pattern.INSUFFICIENT);
        assertThat(IntensityModel.pattern(shares, index, 10, 3599)).isEqualTo(IntensityModel.Pattern.INSUFFICIENT);
        assertThat(IntensityModel.pattern(shares, index, 3, 3600)).isEqualTo(IntensityModel.Pattern.POLARIZED);
        assertThat(IntensityModel.pattern(null, null, 10, 0)).isEqualTo(IntensityModel.Pattern.INSUFFICIENT);
    }

    @Test
    void readingTheZonesGivesTheSharesTheIndexAndTheNameTogether() {
        // 200 minutes in all: 160 low (zones 1 to 3), 10 moderate (zone 4), 30 high (zone 5).
        IntensityModel.Reading reading = IntensityModel.read(new long[] {3600, 3600, 2400, 600, 1800}, 6);

        assertThat(reading.shares().low()).isCloseTo(0.8, within(1e-12));
        assertThat(reading.shares().moderate()).isCloseTo(0.05, within(1e-12));
        assertThat(reading.shares().high()).isCloseTo(0.15, within(1e-12));
        assertThat(reading.polarizationIndex()).isCloseTo(Math.log10(240), within(1e-9));
        assertThat(reading.pattern()).isEqualTo(IntensityModel.Pattern.POLARIZED);
        assertThat(reading.pattern().code()).isEqualTo("polarized");
    }

    @Test
    void readingNoTimeGivesNothingToSay() {
        IntensityModel.Reading reading = IntensityModel.read(new long[5], 0);

        assertThat(reading.shares()).isNull();
        assertThat(reading.polarizationIndex()).isNull();
        assertThat(reading.pattern()).isEqualTo(IntensityModel.Pattern.INSUFFICIENT);
    }
}
