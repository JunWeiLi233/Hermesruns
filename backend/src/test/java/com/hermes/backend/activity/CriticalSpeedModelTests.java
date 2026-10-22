package com.hermes.backend.activity;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * The straight line of distance against time, fitted through a runner's best efforts. The first tests build efforts that
 * lie exactly on a line with a known critical speed and D', so the fit has to give those back.
 */
class CriticalSpeedModelTests {

    private static CriticalSpeedModel.Point on(String key, double cs, double dPrime, double seconds) {
        return new CriticalSpeedModel.Point(key, dPrime + cs * seconds, seconds);
    }

    /** Efforts of 4, 10, 20 and 30 minutes on the line d = 200 + 4 t. */
    private static List<CriticalSpeedModel.Point> exact() {
        return List.of(on("a", 4.0, 200, 240), on("b", 4.0, 200, 600), on("c", 4.0, 200, 1200), on("d", 4.0, 200, 1800));
    }

    @Test
    void effortsOnALineGiveBackItsSlopeAndIntercept() {
        CriticalSpeedModel.Fit fit = CriticalSpeedModel.fit(exact());

        assertThat(fit.status()).isEqualTo(CriticalSpeedModel.Status.OK);
        assertThat(fit.criticalSpeed()).isCloseTo(4.0, within(1e-9));
        assertThat(fit.dPrime()).isCloseTo(200.0, within(1e-6));
        assertThat(fit.maxErrorPercent()).isCloseTo(0.0, within(1e-9));
        assertThat(fit.pointsUsed()).isEqualTo(4);
        assertThat(fit.usedKeys()).containsExactly("a", "b", "c", "d");
        assertThat(fit.minSeconds()).isEqualTo(240);
        assertThat(fit.maxSeconds()).isEqualTo(1800);
        // 4 m/s is a pace of 4:10 a kilometre, and the line gives the time of any distance.
        assertThat(fit.criticalPaceSecondsPerKm()).isCloseTo(250.0, within(1e-9));
        assertThat(fit.timeFor(5000)).isCloseTo(1200.0, within(1e-6));
    }

    @Test
    void threeEffortsAreEnoughAndTwoAreNot() {
        assertThat(CriticalSpeedModel.fit(exact().subList(0, 3)).status()).isEqualTo(CriticalSpeedModel.Status.OK);

        CriticalSpeedModel.Fit two = CriticalSpeedModel.fit(exact().subList(0, 2));
        assertThat(two.status()).isEqualTo(CriticalSpeedModel.Status.TOO_FEW_POINTS);
        assertThat(two.pointsUsed()).isEqualTo(2);
        assertThat(Double.isNaN(two.criticalSpeed())).isTrue();
        assertThat(two.usedKeys()).isEmpty();
    }

    @Test
    void effortsOutsideThreeToFortyMinutesAreLeftOutOfTheFitNotCounted() {
        List<CriticalSpeedModel.Point> all = new ArrayList<>(exact());
        all.add(on("sprint", 4.0, 200, 179));      // a second short of three minutes
        all.add(on("long", 4.0, 200, 2401));       // a second over forty minutes
        all.add(new CriticalSpeedModel.Point("marathon", 42195, 11000));

        CriticalSpeedModel.Fit fit = CriticalSpeedModel.fit(all);

        assertThat(fit.pointsUsed()).isEqualTo(4);
        assertThat(fit.usedKeys()).containsExactly("a", "b", "c", "d");
        assertThat(CriticalSpeedModel.inDomain(180)).isTrue();
        assertThat(CriticalSpeedModel.inDomain(2400)).isTrue();
        assertThat(CriticalSpeedModel.inDomain(179.9)).isFalse();
        assertThat(CriticalSpeedModel.inDomain(2400.1)).isFalse();
    }

    @Test
    void effortsOfAboutTheSameLengthSayNothingAboutTheSlope() {
        List<CriticalSpeedModel.Point> close = List.of(on("a", 4.0, 200, 600), on("b", 4.0, 200, 900), on("c", 4.0, 200, 1400));

        CriticalSpeedModel.Fit fit = CriticalSpeedModel.fit(close);

        // 1400 / 600 is 2.33, under the 2.5 it takes.
        assertThat(fit.status()).isEqualTo(CriticalSpeedModel.Status.NARROW_RANGE);
        assertThat(fit.pointsUsed()).isEqualTo(3);
        assertThat(CriticalSpeedModel.fit(List.of(on("a", 4.0, 200, 600), on("b", 4.0, 200, 900), on("c", 4.0, 200, 1500))).status())
                .isEqualTo(CriticalSpeedModel.Status.OK);
    }

    @Test
    void aLineThatWouldStartBelowZeroIsNotAModel() {
        // Longer efforts relatively faster than shorter ones: the intercept is negative.
        List<CriticalSpeedModel.Point> points = List.of(
                new CriticalSpeedModel.Point("a", 1000, 300),
                new CriticalSpeedModel.Point("b", 3000, 850),
                new CriticalSpeedModel.Point("c", 5000, 1400));

        CriticalSpeedModel.Fit fit = CriticalSpeedModel.fit(points);

        assertThat(fit.status()).isEqualTo(CriticalSpeedModel.Status.NEGATIVE_D_PRIME);
        assertThat(Double.isNaN(fit.dPrime())).isTrue();
    }

    @Test
    void aSmallScatterIsAFitABigOneIsAFitWithAWarningAndABiggerOneIsNone() {
        // The 20-minute effort took 4%, 12% and 45% longer than the line through the other three says.
        assertThat(scattered(0.04).status()).isEqualTo(CriticalSpeedModel.Status.OK);
        assertThat(scattered(0.04).maxErrorPercent()).isLessThanOrEqualTo(CriticalSpeedModel.OK_ERROR_PERCENT);
        CriticalSpeedModel.Fit rough = scattered(0.12);
        assertThat(rough.status()).isEqualTo(CriticalSpeedModel.Status.ROUGH);
        assertThat(rough.maxErrorPercent()).isBetween(CriticalSpeedModel.OK_ERROR_PERCENT, CriticalSpeedModel.ROUGH_ERROR_PERCENT);
        assertThat(rough.criticalSpeed()).isGreaterThan(0);
        assertThat(scattered(0.45).status()).isEqualTo(CriticalSpeedModel.Status.NO_FIT);
    }

    /** Four efforts on a line, the third one's time `error` too long (its distance stays on the line). */
    private static CriticalSpeedModel.Fit scattered(double error) {
        return CriticalSpeedModel.fit(List.of(
                on("a", 4.0, 200, 240), on("b", 4.0, 200, 600),
                new CriticalSpeedModel.Point("c", 200 + 4.0 * 1200, 1200 * (1 + error)),
                on("d", 4.0, 200, 1800)));
    }

    @Test
    void itIsTheLeastSquaresLineNotALineThroughTwoOfThePoints() {
        // Worked by hand: t = 200, 600, 1000 and 1400 s, d = 1100, 2600, 3900 and 5600 m.
        // mean t = 800 and mean d = 3300; Sxx = 800 000; Sxy = 1 320 000 + 140 000 + 120 000 + 1 380 000 = 2 960 000.
        List<CriticalSpeedModel.Point> points = List.of(
                new CriticalSpeedModel.Point("a", 1100, 200),
                new CriticalSpeedModel.Point("b", 2600, 600),
                new CriticalSpeedModel.Point("c", 3900, 1000),
                new CriticalSpeedModel.Point("d", 5600, 1400));
        double slope = 2_960_000.0 / 800_000.0;          // 3.7 m/s
        double intercept = 3300 - slope * 800;           // 340 m

        CriticalSpeedModel.Fit fit = CriticalSpeedModel.fit(points);

        assertThat(fit.criticalSpeed()).isCloseTo(slope, within(1e-9));
        assertThat(fit.dPrime()).isCloseTo(intercept, within(1e-6));
    }

    @Test
    void nothingAtAllIsTooFewEfforts() {
        assertThat(CriticalSpeedModel.fit(null).status()).isEqualTo(CriticalSpeedModel.Status.TOO_FEW_POINTS);
        assertThat(CriticalSpeedModel.fit(List.of()).pointsUsed()).isZero();
        assertThat(CriticalSpeedModel.fit(List.of()).status().code()).isEqualTo("too_few_points");
    }

    @Test
    void aPointThatIsNotANumberIsIgnored() {
        List<CriticalSpeedModel.Point> all = new ArrayList<>(exact());
        all.add(new CriticalSpeedModel.Point("bad", 5000, Double.NaN));
        all.add(new CriticalSpeedModel.Point("zero", 0, 600));
        all.add(null);

        assertThat(CriticalSpeedModel.fit(all).pointsUsed()).isEqualTo(4);
    }
}
