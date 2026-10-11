package com.hermes.backend.activity;

import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class BestEffortDistancesTests {

    @Test
    void thereAreFifteenDistancesShortestFirstWithUniqueKeys() {
        List<BestEffortDistances.Distance> all = BestEffortDistances.ALL;

        assertThat(all).hasSize(15);
        assertThat(all).extracting(BestEffortDistances.Distance::key).doesNotHaveDuplicates();
        for (int i = 1; i < all.size(); i++) {
            assertThat(all.get(i).meters()).as(all.get(i).key()).isGreaterThan(all.get(i - 1).meters());
        }
        assertThat(all.get(0).key()).isEqualTo("400m");
        assertThat(all.get(all.size() - 1).key()).isEqualTo("50km");
    }

    @Test
    void theLengthsAreTheStandardOnes() {
        assertThat(BestEffortDistances.byKey("half_mile").orElseThrow().meters()).isCloseTo(804.672, within(1e-9));
        assertThat(BestEffortDistances.byKey("1mile").orElseThrow().meters()).isCloseTo(1609.344, within(1e-9));
        assertThat(BestEffortDistances.byKey("2mile").orElseThrow().meters()).isCloseTo(3218.688, within(1e-9));
        assertThat(BestEffortDistances.byKey("10mile").orElseThrow().meters()).isCloseTo(16093.44, within(1e-9));
        assertThat(BestEffortDistances.byKey("half").orElseThrow().meters()).isCloseTo(21097.5, within(1e-9));
        assertThat(BestEffortDistances.byKey("marathon").orElseThrow().meters()).isCloseTo(42195.0, within(1e-9));
    }

    @Test
    void theSixDistancesTheProfilePageKnowKeepTheirKeysAndLengths() {
        assertThat(BestEffortDistances.LEGACY_KEYS).containsExactly("1km", "3km", "5km", "10km", "half", "marathon");
        double[] meters = {1000.0, 3000.0, 5000.0, 10000.0, 21097.5, 42195.0};
        for (int i = 0; i < meters.length; i++) {
            assertThat(BestEffortDistances.byKey(BestEffortDistances.LEGACY_KEYS.get(i)).orElseThrow().meters())
                    .isEqualTo(meters[i]);
        }
    }

    @Test
    void anUnknownKeyIsNotADistance() {
        assertThat(BestEffortDistances.byKey("7km")).isEmpty();
        assertThat(BestEffortDistances.byKey(null)).isEmpty();
        assertThat(BestEffortDistances.byKey("")).isEmpty();
    }
}
