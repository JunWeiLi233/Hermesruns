package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the muscle-area recommendation cascade in
 * {@link MuscleTrainingMetricsService#deriveRecommendedMuscleArea}. Each test
 * pins one priority of the cascade so the priority order is regression-locked.
 */
class MuscleTrainingMetricsServiceTest {

    private final MuscleTrainingMetricsService service = new MuscleTrainingMetricsService();

    private static MuscleTrainingMetricsService.PlanMetrics metrics(
            String recoveryGate, String loadStatus, String currentFocus, int recentHardRuns
    ) {
        return new MuscleTrainingMetricsService.PlanMetrics(
                0, 0, null, null,
                recoveryGate, loadStatus, false, false,
                1, currentFocus,
                null, null, null, null,
                recentHardRuns
        );
    }

    @Test
    void priority1_protectGateRecommendsCalvesAnkles() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("PROTECT", "STEADY", "POSTERIOR_CHAIN_STABILITY", 0),
                null, null, null
        );
        assertThat(area.focus()).isEqualTo("CALVES_ANKLES");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_PROTECT");
    }

    @Test
    void priority1_raceWeekRecommendsCalvesAnkles() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("OPEN", "RACE_WEEK", "POSTERIOR_CHAIN_STABILITY", 0),
                null, null, null
        );
        assertThat(area.focus()).isEqualTo("CALVES_ANKLES");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_PROTECT");
    }

    @Test
    void priority1_highInjuryRiskRecommendsCalvesAnkles() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("OPEN", "STEADY", "POSTERIOR_CHAIN_STABILITY", 0),
                null, "HIGH", null
        );
        assertThat(area.focus()).isEqualTo("CALVES_ANKLES");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_PROTECT");
    }

    @Test
    void priority2_highSorenessRecommendsPosteriorChain() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("OPEN", "STEADY", "POSTERIOR_CHAIN_STABILITY", 0),
                "HIGH", "LOW", null
        );
        assertThat(area.focus()).isEqualTo("POSTERIOR_CHAIN");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_SORENESS");
    }

    @Test
    void priority3_highVolumeRecommendsCalvesAnkles() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("OPEN", "HIGH_VOLUME", "ELASTIC_STIFFNESS", 0),
                null, "LOW", null
        );
        assertThat(area.focus()).isEqualTo("CALVES_ANKLES");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_HIGH_VOLUME");
    }

    @Test
    void priority4_recentHardRunRecommendsPosteriorChain() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("OPEN", "STEADY", "POSTERIOR_CHAIN_STABILITY", 1),
                null, "LOW", null
        );
        assertThat(area.focus()).isEqualTo("POSTERIOR_CHAIN");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_RECENT_HARD");
    }

    @Test
    void priority5_recoveryFocusRecommendsCoreStability() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("CAUTION", "STEADY", "RECOVERY_CAPACITY", 0),
                null, "LOW", null
        );
        assertThat(area.focus()).isEqualTo("CORE_STABILITY");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_RECOVERY_SESSION");
    }

    @Test
    void priority6_openRecoverySteadyRecommendsLegDay() {
        var area = service.deriveRecommendedMuscleArea(
                metrics("OPEN", "STEADY", "POSTERIOR_CHAIN_STABILITY", 0),
                null, "LOW", null
        );
        assertThat(area.focus()).isEqualTo("LEG_DAY");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_STEADY_DEFAULT");
    }

    @Test
    void priority7_fallbackWhenNoSignalsRecommendsLegDay() {
        // CAUTION gate (not OPEN) + no hard runs + not recovery focus → falls through to fallback.
        var area = service.deriveRecommendedMuscleArea(
                metrics("CAUTION", "STEADY", "POSTERIOR_CHAIN_STABILITY", 0),
                null, "LOW", null
        );
        // Note: this combination hits priority 5 only when currentFocus is RECOVERY_CAPACITY;
        // with POSTERIOR_CHAIN_STABILITY + CAUTION (not OPEN) it reaches the fallback.
        // Adjust: use a focus that doesn't trip priority 5 and a non-OPEN gate.
        assertThat(area.focus()).isEqualTo("LEG_DAY");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_FALLBACK");
    }

    @Test
    void nullMetricsDefaultsOpenAndRecommendsLegDay() {
        // Null metrics → recoveryGate defaults to OPEN → priority 6 steady default.
        var area = service.deriveRecommendedMuscleArea(null, null, null, null);
        assertThat(area.focus()).isEqualTo("LEG_DAY");
        assertThat(area.reasonCode()).isEqualTo("R_AREA_STEADY_DEFAULT");
    }
}
