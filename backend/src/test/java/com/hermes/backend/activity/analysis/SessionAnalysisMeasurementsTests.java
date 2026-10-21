package com.hermes.backend.activity.analysis;

import java.util.List;
import org.junit.jupiter.api.Test;
import static com.hermes.backend.activity.analysis.SessionAnalysisMeasurements.*;
import static org.assertj.core.api.Assertions.assertThat;

class SessionAnalysisMeasurementsTests {
    @Test void timerPaceAndElapsedHrCoverageAreIndependentForPausedSourceLaps() {
        var samples = List.of(new Sample(0, 0d, 120, null), new Sample(10, 100d, 160, null),
                new Sample(40, 100d, 100, null), new Sample(50, 200d, 120, null));
        var m = measure(samples, 0, 50, 20d, 200d, "source-lap");
        assertThat(m.durationSeconds()).isEqualTo(20); assertThat(m.elapsedDurationSeconds()).isEqualTo(50);
        assertThat(m.paceSecondsPerKm()).isEqualTo(100); // 20 timer seconds / 0.2 km
        assertThat(m.averageHeartRate()).isEqualTo(125); // equal 10s windows at 140 and 110 bpm
        assertThat(m.hrCoverageSeconds()).isEqualTo(20); assertThat(m.hrCoverageFraction()).isEqualTo(.4);
    }
    @Test void clippedWindowsUseOnlyTimeWithinTheSegmentAndNeverExtendTheFinalSample() {
        var samples = List.of(new Sample(0, 0d, 120, null), new Sample(10, 100d, 160, null),
                new Sample(40, 100d, 100, null), new Sample(50, 200d, 120, null));
        var m = measure(samples, 5, 45, 40d, null, "derived-stream");
        assertThat(m.averageHeartRate()).isEqualTo(127.5); assertThat(m.hrCoverageSeconds()).isEqualTo(10);
        assertThat(m.hrCoverageFraction()).isEqualTo(.25);
        var lone = measure(List.of(new Sample(0, 0d, 170, null)), 0, 20, 20d, 100d, "derived-stream");
        assertThat(lone.averageHeartRate()).isNull(); assertThat(lone.hrCoverageSeconds()).isZero();
        assertThat(lone.paceSecondsPerKm()).isEqualTo(200);
    }
    @Test void duplicateAndOutOfOrderTimestampsNeverDoubleCountCoverage() {
        var samples = List.of(new Sample(0, 0d, 100, null), new Sample(5, 50d, 120, null),
                new Sample(5, 50d, 140, null), new Sample(10, 100d, 160, null),
                new Sample(8, 80d, 150, null), new Sample(12, 120d, 180, null));
        var m = measure(samples, 0, 10, 10d, 100d, "derived-stream");
        assertThat(m.averageHeartRate()).isEqualTo(130); assertThat(m.hrCoverageSeconds()).isEqualTo(10);
        assertThat(m.hrCoverageFraction()).isEqualTo(1);
    }
    @Test void missingHrAndZeroDistanceRemainNullWithoutRemovingDuration() {
        var samples = List.of(new Sample(0, 0d, null, null), new Sample(10, 0d, null, null));
        var m = measure(samples, 0, 10, 10d, 0d, "derived-stream");
        assertThat(m.durationSeconds()).isEqualTo(10); assertThat(m.distanceMeters()).isZero();
        assertThat(m.paceSecondsPerKm()).isNull(); assertThat(m.averageHeartRate()).isNull();
        assertThat(m.averageCadence()).isNull(); assertThat(m.hrCoverageFraction()).isZero();
    }
    @Test void distanceCounterResetsCannotProduceAFalseSegmentDistance() {
        var samples = List.of(new Sample(0, 0d, null, null), new Sample(5, 100d, null, null),
                new Sample(6, 50d, null, null), new Sample(10, 200d, null, null));
        assertThat(boundaryDistance(samples, 0, 10)).isNull();
    }
}
