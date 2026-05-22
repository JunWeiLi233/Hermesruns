package com.hermes.backend;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CoachHrZoneClassifierTest {

    @Test
    void classifiesBandsAgainstHrMax() {
        assertEquals(CoachHrBand.LOW, CoachHrZoneClassifier.classify(120.0, 185.0));
        assertEquals(CoachHrBand.GREY, CoachHrZoneClassifier.classify(140.0, 185.0));
        assertEquals(CoachHrBand.HIGH, CoachHrZoneClassifier.classify(160.0, 185.0));
    }

    @Test
    void unknownWhenMissingHr() {
        assertEquals(CoachHrBand.UNKNOWN, CoachHrZoneClassifier.classify(null, 185.0));
    }
}
