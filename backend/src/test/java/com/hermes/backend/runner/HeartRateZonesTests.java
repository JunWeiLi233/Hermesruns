package com.hermes.backend.runner;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HeartRateZonesTests {

    private static final int[] DEFAULT_PERCENTAGES = {60, 70, 80, 90};

    @Test
    void defaultBoundariesAreRoundedPercentagesOfTheMaxHeartRate() {
        assertThat(HeartRateZones.defaults(190, DEFAULT_PERCENTAGES).boundaries()).containsExactly(114, 133, 152, 171);
        // 185 x 0.7 = 129.5 and 185 x 0.9 = 166.5 round up.
        assertThat(HeartRateZones.defaults(185, DEFAULT_PERCENTAGES).boundaries()).containsExactly(111, 130, 148, 167);
    }

    @Test
    void aBoundaryIsTheFirstBpmOfTheNextZone() {
        HeartRateZones zones = HeartRateZones.defaults(190, DEFAULT_PERCENTAGES);

        assertThat(zones.zoneIndexFor(60)).isZero();
        assertThat(zones.zoneIndexFor(113)).isZero();
        assertThat(zones.zoneIndexFor(114)).isEqualTo(1);
        assertThat(zones.zoneIndexFor(132)).isEqualTo(1);
        assertThat(zones.zoneIndexFor(133)).isEqualTo(2);
        assertThat(zones.zoneIndexFor(151)).isEqualTo(2);
        assertThat(zones.zoneIndexFor(152)).isEqualTo(3);
        assertThat(zones.zoneIndexFor(170)).isEqualTo(3);
        assertThat(zones.zoneIndexFor(171)).isEqualTo(4);
        assertThat(zones.zoneIndexFor(230)).as("the top zone has no upper edge").isEqualTo(4);
    }

    @Test
    void theEffortFloorIsHalfOfTheMaxHeartRate() {
        assertThat(HeartRateZones.defaults(190, DEFAULT_PERCENTAGES).effortFloorBpm()).isEqualTo(95);
        assertThat(HeartRateZones.defaults(185, DEFAULT_PERCENTAGES).effortFloorBpm()).isEqualTo(93);
    }

    @Test
    void validBoundariesAreAcceptedAndAnythingElseIsExplained() {
        assertThat(HeartRateZones.validate(new int[] {110, 130, 150, 170})).isNull();
        assertThat(HeartRateZones.validate(new int[] {HeartRateZones.MIN_BOUNDARY, 50, 60, HeartRateZones.MAX_BOUNDARY})).isNull();

        assertThat(HeartRateZones.validate(null)).contains("exactly 4");
        assertThat(HeartRateZones.validate(new int[] {110, 130, 150})).contains("exactly 4");
        assertThat(HeartRateZones.validate(new int[] {110, 130, 150, 170, 190})).contains("exactly 4");
        assertThat(HeartRateZones.validate(new int[] {39, 130, 150, 170})).contains("between 40 and 230");
        assertThat(HeartRateZones.validate(new int[] {110, 130, 150, 231})).contains("between 40 and 230");
        assertThat(HeartRateZones.validate(new int[] {110, 130, 130, 170})).as("equal boundaries leave a zone empty").contains("must increase");
        assertThat(HeartRateZones.validate(new int[] {110, 150, 130, 170})).contains("must increase");
    }

    @Test
    void zonesCannotBeBuiltFromInvalidBoundaries() {
        assertThatThrownBy(() -> new HeartRateZones(190, new int[] {110, 110, 150, 170}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must increase");
    }

    @Test
    void zonesDoNotShareTheirBoundaryArrays() {
        int[] given = {110, 130, 150, 170};
        HeartRateZones zones = new HeartRateZones(190, given);

        given[0] = 999;
        zones.boundaries()[1] = 999;

        assertThat(zones.boundaries()).containsExactly(110, 130, 150, 170);
    }

    @Test
    void zonesAreEqualWhenTheMaxHeartRateAndBoundariesMatch() {
        assertThat(new HeartRateZones(190, new int[] {110, 130, 150, 170}))
                .isEqualTo(new HeartRateZones(190, new int[] {110, 130, 150, 170}))
                .isNotEqualTo(new HeartRateZones(191, new int[] {110, 130, 150, 170}))
                .isNotEqualTo(new HeartRateZones(190, new int[] {110, 130, 150, 171}));
    }
}
