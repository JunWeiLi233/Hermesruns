package com.hermes.backend.coaching;

import com.hermes.backend.runner.HeartRateZones;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class HrZoneAnalysisTests {

    /** Max 190: zones start at 114, 133, 152 and 171; effort floor 95. */
    private static final HeartRateZones ZONES = HeartRateZones.defaults(190, new int[] {60, 70, 80, 90});

    private static int[] seconds(int count) {
        int[] values = new int[count];
        Arrays.setAll(values, i -> i);
        return values;
    }

    private static int[] constant(int count, int bpm) {
        int[] values = new int[count];
        Arrays.fill(values, bpm);
        return values;
    }

    @Test
    void aSteadyRunLandsInOneZone() {
        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(seconds(600), constant(600, 140), 600, ZONES);

        assertThat(result.zoneSeconds()).containsExactly(0, 0, 600, 0, 0);
        assertThat(result.coveredSeconds()).isEqualTo(600);
        assertThat(result.weightedMinutes()).as("10 minutes in zone 3 weigh 3 each").isCloseTo(30.0, within(1e-9));
    }

    @Test
    void timeIsSplitAcrossZonesAtTheBoundaries() {
        int[] elapsed = seconds(8);
        int[] bpm = {100, 113, 114, 132, 133, 170, 171, 200};

        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(elapsed, bpm, 8, ZONES);

        assertThat(result.zoneSeconds()).containsExactly(2, 2, 1, 1, 2);
    }

    @Test
    void theLastSampleStandsForAsLongAsTheOneBeforeIt() {
        int[] elapsed = {0, 5, 10};

        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(elapsed, new int[] {140, 140, 140}, 3, ZONES);

        assertThat(result.coveredSeconds()).isEqualTo(15);
    }

    @Test
    void aPauseDoesNotCountAsTimeInAZone() {
        // The watch kept its last reading through a five-minute hole in the file.
        int[] elapsed = {0, 10, 310, 320};

        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(elapsed, new int[] {140, 140, 140, 140}, 4, ZONES);

        // 10 s + 30 s (capped) + 10 s + 10 s for the last sample
        assertThat(result.coveredSeconds()).isEqualTo(60);
        assertThat(HrZoneAnalysis.MAX_SAMPLE_GAP_SECONDS).isEqualTo(30);
    }

    @Test
    void sensorErrorsCountForNothing() {
        int[] bpm = {140, 0, 255, 29, 231, 140};

        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(seconds(6), bpm, 6, ZONES);

        assertThat(result.coveredSeconds()).as("only the two real readings").isEqualTo(2);
        assertThat(result.zoneSeconds()[2]).isEqualTo(2);
    }

    @Test
    void minutesBelowTheEffortFloorAreTimeInZoneOneButNoEffort() {
        // Floor is 95: 90 bpm is in zone 1 and weighs nothing, 100 bpm is in zone 1 and weighs 1.
        int[] elapsed = seconds(120);
        int[] bpm = new int[120];
        Arrays.fill(bpm, 0, 60, 90);
        Arrays.fill(bpm, 60, 120, 100);

        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(elapsed, bpm, 120, ZONES);

        assertThat(result.zoneSeconds()[0]).isEqualTo(120);
        assertThat(result.weightedMinutes()).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void aRepeatedTimestampStandsForNoTime() {
        // Two readings at t=0 and one each at t=1 and t=2: the first two have no time to stand for.
        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(new int[] {0, 0, 0, 1, 2}, constant(5, 140), 5, ZONES);

        assertThat(result.coveredSeconds()).isEqualTo(3);
    }

    @Test
    void aSampleThatGoesBackwardsInTimeStandsForNoTime() {
        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(new int[] {0, 10, 5, 15}, constant(4, 140), 4, ZONES);

        // t=0 stands for 10 s, t=10 goes backwards to t=5 so it stands for nothing, t=5 stands for 10 s,
        // and the last sample repeats the last gap, 10 s.
        assertThat(result.coveredSeconds()).isEqualTo(30);
    }

    @Test
    void noSamplesIsAnEmptyResult() {
        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(new int[0], new int[0], 0, ZONES);

        assertThat(result.hasSamples()).isFalse();
        assertThat(result.zoneSeconds()).containsExactly(0, 0, 0, 0, 0);
        assertThat(result.weightedMinutes()).isZero();
    }

    @Test
    void onlyTheLeadingCountEntriesOfTheArraysAreSamples() {
        int[] elapsed = {0, 1, 2, 3, 99, 99};
        int[] bpm = {140, 140, 140, 140, 200, 200};

        HrZoneAnalysis.Result result = HrZoneAnalysis.analyze(elapsed, bpm, 4, ZONES);

        assertThat(result.coveredSeconds()).isEqualTo(4);
        assertThat(result.zoneSeconds()[4]).isZero();
    }

    @Test
    void differentZonesGiveDifferentSplitsForTheSameRun() {
        int[] bpm = constant(60, 150);
        HeartRateZones lowerMax = HeartRateZones.defaults(170, new int[] {60, 70, 80, 90}); // zone 5 starts at 153, zone 4 at 136

        assertThat(HrZoneAnalysis.analyze(seconds(60), bpm, 60, ZONES).zoneSeconds()[2]).isEqualTo(60);
        assertThat(HrZoneAnalysis.analyze(seconds(60), bpm, 60, lowerMax).zoneSeconds()[3]).isEqualTo(60);
    }
}
