package com.hermes.backend.coaching;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * The arithmetic of fitness, fatigue and form, held to closed forms worked out by hand: a single day of load, a
 * constant load, rest. If the recursion in {@link FitnessModel} drifts from the formula in its Javadoc, these fail.
 */
class FitnessModelTests {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 1);
    private static final double EXACT = 1e-9;

    private static Map<LocalDate, Double> loads(Object... dateAndLoad) {
        Map<LocalDate, Double> loads = new HashMap<>();
        for (int i = 0; i < dateAndLoad.length; i += 2) {
            loads.put((LocalDate) dateAndLoad[i], ((Number) dateAndLoad[i + 1]).doubleValue());
        }
        return loads;
    }

    @Test
    void withNoLoadEverythingStaysAtZero() {
        List<FitnessModel.Day> days = FitnessModel.run(Map.of(), DAY, DAY.plusDays(9), 42, 7);

        assertThat(days).hasSize(10);
        assertThat(days).allSatisfy(day -> {
            assertThat(day.load()).isZero();
            assertThat(day.fitness()).isZero();
            assertThat(day.fatigue()).isZero();
            assertThat(day.form()).isZero();
        });
    }

    @Test
    void oneDayOfLoadMovesEachAverageByItsOwnShareOfTheLoad() {
        List<FitnessModel.Day> days = FitnessModel.run(loads(DAY, 100), DAY, DAY, 42, 7);

        // Starting from zero, the day's load closes (1 - e^(-1/N)) of the gap to each average: 100 x 0.02353 and 100 x 0.13312.
        assertThat(days.get(0).fitness()).isCloseTo(100 * (1 - Math.exp(-1.0 / 42)), within(EXACT));
        assertThat(days.get(0).fatigue()).isCloseTo(100 * (1 - Math.exp(-1.0 / 7)), within(EXACT));
        assertThat(days.get(0).fitness()).isCloseTo(2.3528, within(1e-4));
        assertThat(days.get(0).fatigue()).isCloseTo(13.3122, within(1e-4));
        assertThat(days.get(0).form()).isCloseTo(days.get(0).fitness() - days.get(0).fatigue(), within(EXACT));
        assertThat(days.get(0).load()).isEqualTo(100);
    }

    @Test
    void afterTheLoadEachAverageFallsByItsOwnTimeConstant() {
        List<FitnessModel.Day> days = FitnessModel.run(loads(DAY, 100), DAY, DAY.plusDays(30), 42, 7);
        FitnessModel.Day first = days.get(0);

        for (int k = 1; k <= 30; k++) {
            assertThat(days.get(k).fitness()).isCloseTo(first.fitness() * Math.exp(-k / 42.0), within(EXACT));
            assertThat(days.get(k).fatigue()).isCloseTo(first.fatigue() * Math.exp(-k / 7.0), within(EXACT));
        }
    }

    @Test
    void aConstantLoadIsApproachedFromBelowAlongTheClosedForm() {
        Map<LocalDate, Double> constant = new HashMap<>();
        for (int i = 0; i < 300; i++) {
            constant.put(DAY.plusDays(i), 80.0);
        }
        List<FitnessModel.Day> days = FitnessModel.run(constant, DAY, DAY.plusDays(299), 42, 7);

        // After n+1 days at load L from zero, the average is L x (1 - e^(-(n+1)/N)).
        for (int n : new int[] {0, 6, 41, 100, 299}) {
            assertThat(days.get(n).fitness()).isCloseTo(80 * (1 - Math.exp(-(n + 1) / 42.0)), within(EXACT));
            assertThat(days.get(n).fatigue()).isCloseTo(80 * (1 - Math.exp(-(n + 1) / 7.0)), within(EXACT));
        }
        // 300 days is 7 time constants of the slow average: 80 x e^-7.1 short of the load.
        assertThat(days.get(299).fitness()).isCloseTo(80, within(0.1));
        assertThat(days.get(299).form()).isCloseTo(0, within(0.1));
    }

    @Test
    void fatigueClimbsFasterThanFitnessSoFormGoesNegativeInABlockAndPositiveInTheRestAfterIt() {
        Map<LocalDate, Double> block = new HashMap<>();
        for (int i = 0; i < 28; i++) {
            block.put(DAY.plusDays(i), 100.0);
        }
        List<FitnessModel.Day> days = FitnessModel.run(block, DAY, DAY.plusDays(28 + 14 - 1), 42, 7);

        FitnessModel.Day endOfBlock = days.get(27);
        assertThat(endOfBlock.fatigue()).isGreaterThan(endOfBlock.fitness());
        assertThat(endOfBlock.form()).isNegative();

        FitnessModel.Day twoWeeksRest = days.get(days.size() - 1);
        assertThat(twoWeeksRest.fatigue()).isLessThan(endOfBlock.fatigue());
        assertThat(twoWeeksRest.form()).isPositive();
        // Fitness is still most of what it was: only the fast average has gone.
        assertThat(twoWeeksRest.fitness()).isGreaterThan(0.7 * endOfBlock.fitness());
    }

    @Test
    void aDayWithoutALoadOrWithAnUnusableOneCountsAsRest() {
        Map<LocalDate, Double> messy = new HashMap<>();
        messy.put(DAY, 100.0);
        messy.put(DAY.plusDays(1), null);
        messy.put(DAY.plusDays(2), Double.NaN);
        messy.put(DAY.plusDays(3), Double.POSITIVE_INFINITY);
        messy.put(DAY.plusDays(4), -50.0);

        List<FitnessModel.Day> days = FitnessModel.run(messy, DAY, DAY.plusDays(5), 42, 7);

        for (int k = 1; k <= 5; k++) {
            assertThat(days.get(k).load()).isZero();
            assertThat(days.get(k).fitness()).isCloseTo(days.get(0).fitness() * Math.exp(-k / 42.0), within(EXACT));
        }
    }

    @Test
    void theWindowIsInclusiveAtBothEndsAndEmptyWhenBackwards() {
        assertThat(FitnessModel.run(Map.of(), DAY, DAY, 42, 7)).hasSize(1);
        assertThat(FitnessModel.run(Map.of(), DAY, DAY.plusDays(1), 42, 7)).extracting(FitnessModel.Day::date)
                .containsExactly(DAY, DAY.plusDays(1));
        assertThat(FitnessModel.run(Map.of(), DAY, DAY.minusDays(1), 42, 7)).isEmpty();
    }

    @Test
    void aShorterTimeConstantFollowsTheLoadMoreClosely() {
        Map<LocalDate, Double> load = loads(DAY, 100);
        double slow = FitnessModel.run(load, DAY, DAY, 60, 7).get(0).fitness();
        double quick = FitnessModel.run(load, DAY, DAY, 30, 7).get(0).fitness();

        assertThat(quick).isGreaterThan(slow);
        assertThat(FitnessModel.smoothing(1)).isCloseTo(1 - Math.exp(-1), within(EXACT));
    }

    @Test
    void aTimeConstantUnderOneDayIsRefused() {
        assertThatThrownBy(() -> FitnessModel.smoothing(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FitnessModel.run(Map.of(), DAY, DAY, 42, 0)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void restProjectionOnlyDecaysAndFatigueFallsFasterSoFormRises() {
        Map<LocalDate, Double> block = new HashMap<>();
        for (int i = 0; i < 21; i++) {
            block.put(DAY.plusDays(i), 120.0);
        }
        List<FitnessModel.Day> days = FitnessModel.run(block, DAY, DAY.plusDays(20), 42, 7);
        FitnessModel.Day last = days.get(days.size() - 1);

        List<FitnessModel.Day> rest = FitnessModel.restProjection(last, 14, 42, 7);

        assertThat(rest).hasSize(14);
        assertThat(rest.get(0).date()).isEqualTo(last.date().plusDays(1));
        assertThat(rest.get(13).date()).isEqualTo(last.date().plusDays(14));
        for (int k = 1; k <= 14; k++) {
            assertThat(rest.get(k - 1).fitness()).isCloseTo(last.fitness() * Math.exp(-k / 42.0), within(EXACT));
            assertThat(rest.get(k - 1).fatigue()).isCloseTo(last.fatigue() * Math.exp(-k / 7.0), within(EXACT));
            assertThat(rest.get(k - 1).load()).isZero();
        }
        assertThat(rest.get(13).form()).isGreaterThan(last.form());
        assertThat(FitnessModel.restProjection(last, 0, 42, 7)).isEmpty();
    }

    @Test
    void theProjectionAgreesWithRunningTheModelOverRestDays() {
        List<FitnessModel.Day> days = FitnessModel.run(loads(DAY, 100, DAY.plusDays(1), 60), DAY, DAY.plusDays(1), 42, 7);
        List<FitnessModel.Day> projected = FitnessModel.restProjection(days.get(1), 5, 42, 7);
        List<FitnessModel.Day> real = FitnessModel.run(loads(DAY, 100, DAY.plusDays(1), 60), DAY, DAY.plusDays(6), 42, 7);

        for (int k = 0; k < 5; k++) {
            assertThat(projected.get(k).fitness()).isCloseTo(real.get(2 + k).fitness(), within(EXACT));
            assertThat(projected.get(k).fatigue()).isCloseTo(real.get(2 + k).fatigue(), within(EXACT));
            assertThat(projected.get(k).form()).isCloseTo(real.get(2 + k).form(), within(EXACT));
        }
    }
}
