package com.hermes.backend.goals;

import com.hermes.backend.coaching.TrainingLogRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What a goal can be about, what a target may be, and what one run adds. */
class GoalMetricsTests {

    /** A run row with only what a test sets. */
    private static final class Row implements TrainingLogRepository.LogRunRow {
        Double km;
        Double meters;
        Integer moving;
        Long duration;
        Double climb;

        Row km(Double value) { km = value; return this; }
        Row meters(Double value) { meters = value; return this; }
        Row moving(Integer value) { moving = value; return this; }
        Row duration(Long value) { duration = value; return this; }
        Row climb(Double value) { climb = value; return this; }

        @Override public Long getId() { return 1L; }
        @Override public String getName() { return "run"; }
        @Override public LocalDateTime getStartTime() { return null; }
        @Override public LocalDateTime getCreatedAt() { return null; }
        @Override public Boolean getStravaApiSourced() { return false; }
        @Override public Double getDistanceKm() { return km; }
        @Override public Double getDistanceMeters() { return meters; }
        @Override public Integer getMovingTimeSeconds() { return moving; }
        @Override public Long getDurationSeconds() { return duration; }
        @Override public Double getElevationGain() { return climb; }
        @Override public String getRunType() { return null; }
        @Override public LocalDate getLocalDate() { return null; }
        @Override public Double getEffortScore() { return null; }
        @Override public String getEffortSource() { return null; }
    }

    @Test
    void thereAreFourMetricsEachWithItsOwnUnit() {
        assertThat(GoalMetrics.ALL).containsExactly("DISTANCE", "TIME", "COUNT", "ELEVATION");
        assertThat(GoalMetrics.unit(GoalMetrics.DISTANCE)).isEqualTo("km");
        assertThat(GoalMetrics.unit(GoalMetrics.TIME)).isEqualTo("s");
        assertThat(GoalMetrics.unit(GoalMetrics.COUNT)).isEqualTo("runs");
        assertThat(GoalMetrics.unit(GoalMetrics.ELEVATION)).isEqualTo("m");
        for (String not : new String[] {null, "", "distance", "PACE", "DISTANCE "}) {
            assertThat(GoalMetrics.isValid(not)).as("'%s'", not).isFalse();
        }
        assertThatThrownBy(() -> GoalMetrics.unit("PACE")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aDistanceTargetIsKeptToTheNearestTenMetresAndTheRestToAWholeNumber() {
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, 42.196)).isEqualTo(42.2);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, 10.004)).isEqualTo(10.0);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, 0.01)).isEqualTo(0.01);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.TIME, 3600.4)).isEqualTo(3600.0);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.TIME, 3600.5)).isEqualTo(3601.0);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.COUNT, 4.6)).isEqualTo(5.0);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.ELEVATION, 1200)).isEqualTo(1200.0);
    }

    @Test
    void aTargetThatRoundsToNothingIsRefusedAndSaysWhatTheSmallestIs() {
        assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, 0.004))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("0.01 km");
        assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.COUNT, 0.4))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("at least 1");
    }

    @ParameterizedTest
    @ValueSource(doubles = {0, -1, -0.5, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY})
    void zeroNegativeAndNotANumberAreRefused(double bad) {
        assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, bad))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("more than zero");
    }

    @Test
    void whatIsNotANumberIsRefusedWhateverItLooksLike() {
        for (Object bad : new Object[] {null, "50", "fifty", true, java.util.List.of(5), java.util.Map.of("v", 5)}) {
            assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, bad))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("must be a number");
        }
    }

    @Test
    void theLargestTargetIsAllowedAndOneMoreIsNot() {
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, 100_000)).isEqualTo(100_000.0);
        assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.DISTANCE, 100_000.01))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("at most 100000 km");
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.TIME, 31_536_000)).isEqualTo(31_536_000.0);
        assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.TIME, 31_536_001)).isInstanceOf(IllegalArgumentException.class);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.COUNT, 10_000)).isEqualTo(10_000.0);
        assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.COUNT, 10_001)).isInstanceOf(IllegalArgumentException.class);
        assertThat(GoalMetrics.cleanTarget(GoalMetrics.ELEVATION, 1_000_000)).isEqualTo(1_000_000.0);
        assertThatThrownBy(() -> GoalMetrics.cleanTarget(GoalMetrics.ELEVATION, 1_000_001)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aRunAddsItsDistanceFromKilometresElseFromMetres() {
        assertThat(GoalMetrics.of(GoalMetrics.DISTANCE, new Row().km(5.0))).isEqualTo(5.0);
        assertThat(GoalMetrics.of(GoalMetrics.DISTANCE, new Row().km(5.0).meters(9000.0))).as("kilometres first").isEqualTo(5.0);
        assertThat(GoalMetrics.of(GoalMetrics.DISTANCE, new Row().meters(8000.0))).isEqualTo(8.0);
        assertThat(GoalMetrics.of(GoalMetrics.DISTANCE, new Row().km(0.0).meters(8000.0))).isEqualTo(8.0);
        assertThat(GoalMetrics.of(GoalMetrics.DISTANCE, new Row())).isZero();
        assertThat(GoalMetrics.of(GoalMetrics.DISTANCE, new Row().km(-3.0))).isZero();
    }

    @Test
    void aRunAddsItsMovingTimeElseItsDuration() {
        assertThat(GoalMetrics.of(GoalMetrics.TIME, new Row().moving(1500))).isEqualTo(1500.0);
        assertThat(GoalMetrics.of(GoalMetrics.TIME, new Row().moving(1500).duration(1800L))).as("moving time first").isEqualTo(1500.0);
        assertThat(GoalMetrics.of(GoalMetrics.TIME, new Row().duration(1800L))).isEqualTo(1800.0);
        assertThat(GoalMetrics.of(GoalMetrics.TIME, new Row().moving(0).duration(1800L))).isEqualTo(1800.0);
        assertThat(GoalMetrics.of(GoalMetrics.TIME, new Row())).isZero();
    }

    @Test
    void aRunCountsAsOneAndAddsItsClimbWhenItHasAny() {
        assertThat(GoalMetrics.of(GoalMetrics.COUNT, new Row())).isEqualTo(1.0);
        assertThat(GoalMetrics.of(GoalMetrics.ELEVATION, new Row().climb(120.5))).isEqualTo(120.5);
        assertThat(GoalMetrics.of(GoalMetrics.ELEVATION, new Row())).isZero();
        assertThat(GoalMetrics.of(GoalMetrics.ELEVATION, new Row().climb(-4.0))).isZero();
        assertThatThrownBy(() -> GoalMetrics.of("PACE", new Row())).isInstanceOf(IllegalArgumentException.class);
    }
}
