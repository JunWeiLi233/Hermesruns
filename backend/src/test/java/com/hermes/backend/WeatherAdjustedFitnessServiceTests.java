package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WeatherAdjustedFitnessServiceTests {

    @Test
    void calculateAdjustedFitnessFallsBackToImportedDistanceAndDurationFields() {
        WeatherAdjustedFitnessService service = new WeatherAdjustedFitnessService();

        Activity importedRun = new Activity();
        importedRun.setId(5L);
        importedRun.setName("Imported FIT Run");
        importedRun.setActivityType(ActivityType.RUN);
        importedRun.setDistanceKm(0.0);
        importedRun.setMovingTimeSeconds(0);
        importedRun.setDistanceMeters(12345.0);
        importedRun.setDurationSeconds(3660L);
        importedRun.setPacePenaltySecPerKm(18);

        WeatherAdjustedFitnessService.WeatherAdjustedFitnessResult result =
                service.calculateAdjustedFitness(List.of(importedRun));

        assertThat(result.activities()).hasSize(1);
        WeatherAdjustedFitnessService.AdjustedActivityEntry entry = result.activities().get(0);
        assertThat(entry.distanceKm()).isEqualTo(12.345);
        assertThat(entry.movingTimeSeconds()).isEqualTo(3660);
        assertThat(entry.pacePenaltySecPerKm()).isEqualTo(18);
    }
}
