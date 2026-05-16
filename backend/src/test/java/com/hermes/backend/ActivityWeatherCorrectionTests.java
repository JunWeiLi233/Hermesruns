package com.hermes.backend;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityWeatherCorrectionTests {

    @Test
    void fromActivityAppliesWeatherPenaltyAsDerivedNormalizedRecord() {
        Activity activity = new Activity();
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(5.0);
        activity.setMovingTimeSeconds(1800);
        activity.setPacePenaltySecPerKm(12);
        activity.setWeatherAdjusted(true);

        ActivityWeatherCorrection.Value value = ActivityWeatherCorrection.from(activity);

        assertThat(value.pacePenaltySecPerKm()).isEqualTo(12);
        assertThat(value.weatherAdjusted()).isTrue();
        assertThat(value.weatherAdjustedMovingTimeSeconds()).isEqualTo(1740);
        assertThat(value.weatherAdjustedPaceSecPerKm()).isEqualTo(348.0);
        assertThat(value.weatherCorrectionFactor()).isEqualTo(0.9667);
    }

    @Test
    void fromRawFieldsFallsBackToMetersAndDurationWithoutChangingRawData() {
        ActivityWeatherCorrection.Value value = ActivityWeatherCorrection.fromRawFields(
                null,
                10000.0,
                3600,
                3650L,
                15,
                false
        );

        assertThat(value.pacePenaltySecPerKm()).isEqualTo(15);
        assertThat(value.weatherAdjusted()).isTrue();
        assertThat(value.weatherAdjustedMovingTimeSeconds()).isEqualTo(3450);
        assertThat(value.weatherAdjustedPaceSecPerKm()).isEqualTo(345.0);
        assertThat(value.weatherCorrectionFactor()).isEqualTo(0.9583);
    }

    @Test
    void missingPenaltyKeepsWeatherCorrectionNeutral() {
        Activity activity = new Activity();
        activity.setActivityType(ActivityType.RUN);
        activity.setDistanceKm(8.0);
        activity.setMovingTimeSeconds(2880);

        ActivityWeatherCorrection.Value value = ActivityWeatherCorrection.from(activity);

        assertThat(value.pacePenaltySecPerKm()).isZero();
        assertThat(value.weatherAdjusted()).isFalse();
        assertThat(value.weatherAdjustedMovingTimeSeconds()).isEqualTo(2880);
        assertThat(value.weatherAdjustedPaceSecPerKm()).isEqualTo(360.0);
        assertThat(value.weatherCorrectionFactor()).isEqualTo(1.0);
    }
}
