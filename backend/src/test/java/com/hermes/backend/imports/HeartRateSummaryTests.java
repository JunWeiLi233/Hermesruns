package com.hermes.backend.imports;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HeartRateSummaryTests {

    private static ParsedTrackPoint point(Integer elapsed, Integer heartRate) {
        return new ParsedTrackPoint(40.0, -73.0, elapsed, null, null, heartRate, null, null, null);
    }

    @Test
    void averagesByTimeNotByNumberOfReadings() {
        // 140 for 20 s (two readings) and 180 for 30 s (one reading, then a long gap): the time-weighted mean is 164, the plain mean 160.
        HeartRateSummary summary = HeartRateSummary.of(List.of(point(0, 140), point(10, 140), point(20, 180), point(50, 180)));

        assertThat(summary.average()).isEqualTo(164.0);
        assertThat(summary.max()).isEqualTo(180.0);
    }

    @Test
    void aGapLongerThanThirtySecondsCountsForThirtySecondsAtMost() {
        HeartRateSummary summary = HeartRateSummary.of(List.of(point(0, 100), point(600, 200)));

        assertThat(summary.average()).isEqualTo(100.0);
        assertThat(summary.max()).isEqualTo(200.0);
    }

    @Test
    void leavesOutReadingsNoHeartCouldMake() {
        HeartRateSummary summary = HeartRateSummary.of(List.of(point(0, 0), point(5, 150), point(10, 255), point(15, 29), point(20, 150), point(25, 150)));

        assertThat(summary.average()).isEqualTo(150.0);
        assertThat(summary.max()).isEqualTo(150.0);
    }

    @Test
    void withoutTimesItIsThePlainMean() {
        HeartRateSummary summary = HeartRateSummary.of(List.of(point(null, 140), point(null, 150), point(null, 160)));

        assertThat(summary.average()).isEqualTo(150.0);
        assertThat(summary.max()).isEqualTo(160.0);
    }

    @Test
    void aTrackWithoutHeartRateHasNoSummary() {
        List<ParsedTrackPoint> none = new ArrayList<>();
        for (int i = 0; i < 20; i++) none.add(point(i * 5, null));

        assertThat(HeartRateSummary.of(none)).isNull();
        assertThat(HeartRateSummary.of(List.of())).isNull();
        assertThat(HeartRateSummary.of(null)).isNull();
    }
}
