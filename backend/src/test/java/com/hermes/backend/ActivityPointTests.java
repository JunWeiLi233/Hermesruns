package com.hermes.backend;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ActivityPointTests {

    @Test
    void fieldsRoundTrip() {
        var p = new ActivityPoint();
        p.setId(1L);
        p.setSequenceIndex(5);
        p.setLatitude(47.6);
        p.setLongitude(-122.3);
        p.setElapsedSeconds(120);
        p.setDistanceMeters(400.0);
        p.setElevationMeters(50.0);
        p.setElevationRawMeters(51.0);
        p.setElevationCorrectedMeters(49.5);
        p.setHeartRate(145);
        p.setCadence(82);

        assertEquals(1L, p.getId());
        assertEquals(5, p.getSequenceIndex());
        assertEquals(47.6, p.getLatitude());
        assertEquals(-122.3, p.getLongitude());
        assertEquals(120, p.getElapsedSeconds());
        assertEquals(400.0, p.getDistanceMeters());
        assertEquals(50.0, p.getElevationMeters());
        assertEquals(51.0, p.getElevationRawMeters());
        assertEquals(49.5, p.getElevationCorrectedMeters());
        assertEquals(145, p.getHeartRate());
        assertEquals(82, p.getCadence());
    }

    @Test
    void nullableNumericFields() {
        var p = new ActivityPoint();
        assertNull(p.getElapsedSeconds());
        assertNull(p.getDistanceMeters());
        assertNull(p.getElevationMeters());
        assertNull(p.getElevationRawMeters());
        assertNull(p.getElevationCorrectedMeters());
        assertNull(p.getHeartRate());
        assertNull(p.getCadence());
    }

    @Test
    void activityRelationship() {
        var a = new Activity();
        var p = new ActivityPoint();
        p.setActivity(a);
        assertSame(a, p.getActivity());
    }

    @Test
    void sequenceIndexDefault() {
        var p = new ActivityPoint();
        assertEquals(0, p.getSequenceIndex());
    }

    @Test
    void geoCoordinates() {
        var p = new ActivityPoint();
        p.setLatitude(48.8566);
        p.setLongitude(2.3522);
        assertEquals(48.8566, p.getLatitude());
        assertEquals(2.3522, p.getLongitude());
    }

    @Test
    void elevationHierarchy() {
        var p = new ActivityPoint();
        p.setElevationMeters(100.0);
        p.setElevationRawMeters(102.0);
        p.setElevationCorrectedMeters(99.0);

        assertEquals(100.0, p.getElevationMeters());
        assertEquals(102.0, p.getElevationRawMeters());
        assertEquals(99.0, p.getElevationCorrectedMeters());
    }
}
