package com.hermes.backend.coaching;

import com.hermes.backend.runner.HeartRateZones;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class EffortModelTests {

    /** Max 190: zones start at 114, 133, 152 and 171; effort floor 95. */
    private static final HeartRateZones ZONES = HeartRateZones.defaults(190, new int[] {60, 70, 80, 90});

    /** An hour of heart-rate samples, all in zone 3 (3 x 60 = 180 weighted minutes). */
    private static HrZoneAnalysis.Result hourInZoneThree(double coveredSeconds) {
        double[] zoneSeconds = {0, 0, coveredSeconds, 0, 0};
        return new HrZoneAnalysis.Result(zoneSeconds, coveredSeconds, coveredSeconds / 60.0 * 3);
    }

    private static EffortModel.Input input(double movingSeconds, double km, Integer rating, Double averageHr,
                                           HrZoneAnalysis.Result hr, Double scale) {
        return new EffortModel.Input(movingSeconds, km, rating, averageHr, hr, ZONES, scale);
    }

    // --- heart-rate stream ------------------------------------------------------------------------------------

    @Test
    void anHourInZoneThreeScoresOneHundredAndEighty() {
        EffortModel.Result result = EffortModel.compute(input(3600, 10, null, null, hourInZoneThree(3600), null));

        assertThat(result.source()).isEqualTo(EffortModel.HR_ZONES);
        assertThat(result.score()).isEqualTo(180.0);
        assertThat(result.hrEffort()).isEqualTo(180.0);
        assertThat(result.paceEffort()).as("the pace score is always kept beside it, for calibration").isNotNull();
    }

    @Test
    void heartRateWinsOverEveryOtherSource() {
        EffortModel.Result result = EffortModel.compute(input(3600, 10, 9, 160.0, hourInZoneThree(3600), 2.0));

        assertThat(result.source()).isEqualTo(EffortModel.HR_ZONES);
    }

    @Test
    void aStreamThatDroppedOutIsScaledUpToTheWholeRun() {
        // The strap recorded 30 of the 60 minutes. The recorded half was 90 weighted minutes, so the run is 180.
        EffortModel.Result result = EffortModel.compute(input(3600, 10, null, null, hourInZoneThree(1800), null));

        assertThat(result.source()).isEqualTo(EffortModel.HR_ZONES);
        assertThat(result.score()).isEqualTo(180.0);
    }

    @Test
    void aStreamThatCoversLessThanHalfTheRunIsNotTrusted() {
        EffortModel.Result result = EffortModel.compute(input(3600, 10, 6, null, hourInZoneThree(1799), null));

        assertThat(result.source()).isEqualTo(EffortModel.PERCEIVED);
    }

    @Test
    void aFewSecondsOfHeartRateIsNotAStream() {
        EffortModel.Result result = EffortModel.compute(input(90, 0.3, null, null, hourInZoneThree(59), null));

        assertThat(result.source()).isEqualTo(EffortModel.PACE_MODEL);
    }

    @Test
    void aStreamBelowTheEffortFloorIsASensorFaultNotAnEasyRun() {
        HrZoneAnalysis.Result allBelowFloor = new HrZoneAnalysis.Result(new double[] {3600, 0, 0, 0, 0}, 3600, 0);

        EffortModel.Result result = EffortModel.compute(input(3600, 10, null, null, allBelowFloor, null));

        assertThat(result.source()).isEqualTo(EffortModel.PACE_MODEL);
    }

    @Test
    void heartRateSamplesLongerThanTheMovingTimeAreNotScaledDown() {
        // The watch kept recording through pauses, so the stream is longer than the moving time.
        EffortModel.Result result = EffortModel.compute(input(1800, 5, null, null, hourInZoneThree(3600), null));

        assertThat(result.score()).as("coverage is capped at 100%").isEqualTo(180.0);
    }

    // --- perceived exertion -----------------------------------------------------------------------------------

    @Test
    void perceivedExertionWeighsOneToFiveAcrossTheScale() {
        assertThat(EffortModel.ratingWeight(1)).isEqualTo(1.0);
        assertThat(EffortModel.ratingWeight(10)).isEqualTo(5.0);
        assertThat(EffortModel.ratingWeight(5)).isCloseTo(2.78, within(0.01));
        assertThat(EffortModel.ratingWeight(6)).isGreaterThan(EffortModel.ratingWeight(5));
    }

    @Test
    void aRatingScoresMinutesTimesItsWeight() {
        EffortModel.Result easy = EffortModel.compute(input(3600, 10, 1, null, HrZoneAnalysis.Result.empty(), null));
        EffortModel.Result max = EffortModel.compute(input(3600, 10, 10, null, HrZoneAnalysis.Result.empty(), null));

        assertThat(easy.source()).isEqualTo(EffortModel.PERCEIVED);
        assertThat(easy.score()).isEqualTo(60.0);
        assertThat(max.score()).isEqualTo(300.0);
        assertThat(easy.hrEffort()).isNull();
    }

    @Test
    void aRatingBeatsAnAverageHeartRateAndThePaceModel() {
        EffortModel.Result result = EffortModel.compute(input(3600, 10, 4, 150.0, HrZoneAnalysis.Result.empty(), 2.0));

        assertThat(result.source()).isEqualTo(EffortModel.PERCEIVED);
    }

    @Test
    void ratingsOutsideOneToTenAreIgnored() {
        assertThat(EffortModel.validRating(0)).isFalse();
        assertThat(EffortModel.validRating(11)).isFalse();
        assertThat(EffortModel.validRating(null)).isFalse();
        assertThat(EffortModel.validRating(1)).isTrue();
        assertThat(EffortModel.validRating(10)).isTrue();

        EffortModel.Result result = EffortModel.compute(input(3600, 10, 11, null, HrZoneAnalysis.Result.empty(), null));
        assertThat(result.source()).isEqualTo(EffortModel.PACE_MODEL);
    }

    // --- average heart rate -----------------------------------------------------------------------------------

    @Test
    void anAverageHeartRateCountsTheWholeRunAtItsZonesWeight() {
        // 140 bpm is zone 3: 60 minutes x 3.
        EffortModel.Result result = EffortModel.compute(input(3600, 10, null, 140.0, HrZoneAnalysis.Result.empty(), null));

        assertThat(result.source()).isEqualTo(EffortModel.HR_AVERAGE);
        assertThat(result.score()).isEqualTo(180.0);
    }

    @Test
    void anAverageBelowTheFloorOrOutOfRangeIsNotUsed() {
        assertThat(EffortModel.compute(input(3600, 10, null, 90.0, HrZoneAnalysis.Result.empty(), null)).source())
                .isEqualTo(EffortModel.PACE_MODEL);
        assertThat(EffortModel.compute(input(3600, 10, null, 250.0, HrZoneAnalysis.Result.empty(), null)).source())
                .isEqualTo(EffortModel.PACE_MODEL);
        assertThat(EffortModel.compute(input(3600, 10, null, 0.0, HrZoneAnalysis.Result.empty(), null)).source())
                .isEqualTo(EffortModel.PACE_MODEL);
    }

    // --- pace model -------------------------------------------------------------------------------------------

    @Test
    void withNothingElseThePaceModelTheCoachAlreadyUsesGivesTheScore() {
        EffortModel.Result result = EffortModel.compute(input(3600, 10, null, null, HrZoneAnalysis.Result.empty(), null));

        double expected = EffortModel.round1(TrainingLoadAnalyzer.loadUnits(10, 3600));
        assertThat(result.source()).isEqualTo(EffortModel.PACE_MODEL);
        assertThat(result.score()).isEqualTo(expected).isGreaterThan(0);
        assertThat(result.paceEffort()).isEqualTo(expected);
    }

    @Test
    void aCalibrationScaleMovesThePaceModelOntoTheHeartRateScale() {
        EffortModel.Result raw = EffortModel.compute(input(3600, 10, null, null, HrZoneAnalysis.Result.empty(), null));
        EffortModel.Result scaled = EffortModel.compute(input(3600, 10, null, null, HrZoneAnalysis.Result.empty(), 2.5));

        assertThat(scaled.source()).isEqualTo(EffortModel.PACE_CALIBRATED);
        assertThat(scaled.score()).isCloseTo(raw.score() * 2.5, within(0.1));
        assertThat(scaled.paceEffort()).as("the raw pace score is kept").isEqualTo(raw.paceEffort());
    }

    @Test
    void withNothingToGoOnThereIsNoScore() {
        EffortModel.Result noData = EffortModel.compute(input(0, 0, null, null, HrZoneAnalysis.Result.empty(), null));
        EffortModel.Result noTime = EffortModel.compute(input(0, 5, null, null, HrZoneAnalysis.Result.empty(), null));

        assertThat(noData.score()).isNull();
        assertThat(noData.source()).isNull();
        assertThat(noTime.score()).isNull();
    }

    // --- calibration ------------------------------------------------------------------------------------------

    @Test
    void theCalibrationScaleIsALeastSquaresFitThroughTheOrigin() {
        // hr = 2 x pace exactly: sum(hr x pace) = 2 x sum(pace^2).
        Double scale = EffortModel.calibrationScale(10, 200.0, 100.0);

        assertThat(scale).isEqualTo(2.0);
    }

    @Test
    void theCalibrationNeedsEnoughRunsAndSaneSums() {
        assertThat(EffortModel.calibrationScale(9, 200.0, 100.0)).as("too few runs").isNull();
        assertThat(EffortModel.calibrationScale(10, 200.0, 0.0)).isNull();
        assertThat(EffortModel.calibrationScale(10, 0.0, 100.0)).isNull();
        assertThat(EffortModel.calibrationScale(10, -5.0, 100.0)).isNull();
    }

    @Test
    void theCalibrationScaleStaysInASaneRange() {
        assertThat(EffortModel.calibrationScale(50, 1000.0, 1.0)).isEqualTo(EffortModel.MAX_CALIBRATION_SCALE);
        assertThat(EffortModel.calibrationScale(50, 1.0, 1000.0)).isEqualTo(EffortModel.MIN_CALIBRATION_SCALE);
    }
}
