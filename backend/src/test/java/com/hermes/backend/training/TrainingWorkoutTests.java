package com.hermes.backend.training;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeout;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TrainingWorkoutTests {
    @Test
    void malformedWhitespaceHeavyStepIsRejectedWithoutQuadraticBacktracking() {
        String source = "1m @70% " + " ".repeat(40_000) + "\u2028invalid";
        assertTimeout(Duration.ofSeconds(1), () -> {
            TrainingFailure failure = assertThrows(TrainingFailure.class, () -> TrainingWorkout.compile(source));
            assertThat(failure.status).isEqualTo(422);
            assertThat(failure.getMessage()).isEqualTo("INVALID_WORKOUT_STEP");
        });
    }

    @Test
    void compilerPreservesDecimalsUnitsNamesAndWhitespaceSeparators() {
        var compiled = TrainingWorkout.compile("12.5m\t @70.5%   Easy run\n2m @150bpm Tempo\n1.25m @200W Power\n3m @80rpm Cadence\n4m @3.2m/s Speed");
        List<Map<String, Object>> steps = steps(compiled);
        assertThat(compiled.get("minutes")).isEqualTo(22.75);
        assertThat(steps).extracting(step -> step.get("unit")).containsExactly("%", "bpm", "W", "rpm", "m/s");
        assertThat(steps).extracting(step -> step.get("name")).containsExactly("Easy run", "Tempo", "Power", "Cadence", "Speed");
        assertThat(steps.get(0).get("minutes")).isEqualTo(12.5);
        assertThat(steps.get(0).get("target")).isEqualTo(70.5);
    }

    @Test
    void indentedRepeatedBlocksRetainTheirOrderAndDuration() {
        var compiled = TrainingWorkout.compile("2x\n  1m @50% Warm\n\t2.5m @145bpm Main\n3m @70% End");
        assertThat(compiled.get("minutes")).isEqualTo(10.0);
        assertThat(steps(compiled)).extracting(step -> step.get("name")).containsExactly("Warm", "Main", "Warm", "Main", "End");
    }

    @Test
    void longValidSeparatorsRemainValidWithinTheExistingSourceLimit() {
        var compiled = TrainingWorkout.compile("1m" + " ".repeat(20_000) + "@70%" + " ".repeat(20_000) + "Easy");
        assertThat(compiled.get("minutes")).isEqualTo(1.0);
        assertThat(steps(compiled)).hasSize(1);
        assertThat(steps(compiled).get(0).get("name")).isEqualTo("Easy");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> steps(Map<String, Object> compiled) {
        return (List<Map<String, Object>>) compiled.get("steps");
    }
}
