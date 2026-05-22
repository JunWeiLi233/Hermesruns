package com.hermes.backend;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ActivityMetricsTests {

    @Test
    void fieldRoundTrip() {
        ActivityMetrics m = new ActivityMetrics();
        m.setAverageHeartRate(145.0);
        m.setMaxHeartRate(182.0);
        m.setTotalElevationGain(234.5);
        m.setCalories(450);
        m.setAverageCadence(88.0);
        m.setAverageWatts(210.0);
        m.setMaxSpeedMps(5.2);
        m.setSufferScore(67);
        m.setRoutePreviewPath("/previews/route-abc.png");
        m.setRoutePreviewStartX(0.5);
        m.setRoutePreviewStartY(0.3);
        m.setRoutePreviewFinishX(0.8);
        m.setRoutePreviewFinishY(0.7);
        m.setPacePenaltySecPerKm(12);
        m.setWeatherAdjusted(true);

        assertEquals(145.0, m.getAverageHeartRate());
        assertEquals(182.0, m.getMaxHeartRate());
        assertEquals(234.5, m.getTotalElevationGain());
        assertEquals(450, m.getCalories());
        assertEquals(88.0, m.getAverageCadence());
        assertEquals(210.0, m.getAverageWatts());
        assertEquals(5.2, m.getMaxSpeedMps());
        assertEquals(67, m.getSufferScore());
        assertEquals("/previews/route-abc.png", m.getRoutePreviewPath());
        assertEquals(0.5, m.getRoutePreviewStartX());
        assertEquals(0.3, m.getRoutePreviewStartY());
        assertEquals(0.8, m.getRoutePreviewFinishX());
        assertEquals(0.7, m.getRoutePreviewFinishY());
        assertEquals(12, m.getPacePenaltySecPerKm());
        assertTrue(m.getWeatherAdjusted());
    }

    @Test
    void nullableDefaults() {
        ActivityMetrics m = new ActivityMetrics();
        assertNull(m.getAverageHeartRate());
        assertNull(m.getMaxHeartRate());
        assertNull(m.getTotalElevationGain());
        assertNull(m.getCalories());
        assertNull(m.getAverageCadence());
        assertNull(m.getAverageWatts());
        assertNull(m.getMaxSpeedMps());
        assertNull(m.getSufferScore());
        assertNull(m.getRoutePreviewPath());
        assertNull(m.getRoutePreviewStartX());
        assertNull(m.getRoutePreviewStartY());
        assertNull(m.getRoutePreviewFinishX());
        assertNull(m.getRoutePreviewFinishY());
        assertNull(m.getPacePenaltySecPerKm());
        assertNull(m.getWeatherAdjusted());
    }

    @Test
    void zeroValuesDistinctFromNull() {
        ActivityMetrics m = new ActivityMetrics();
        m.setAverageHeartRate(0.0);
        m.setCalories(0);
        m.setSufferScore(0);
        m.setPacePenaltySecPerKm(0);

        assertNotNull(m.getAverageHeartRate());
        assertNotNull(m.getCalories());
        assertNotNull(m.getSufferScore());
        assertNotNull(m.getPacePenaltySecPerKm());
        assertEquals(0.0, m.getAverageHeartRate());
        assertEquals(0, m.getCalories());
        assertEquals(0, m.getSufferScore());
        assertEquals(0, m.getPacePenaltySecPerKm());
    }

    @Test
    void weatherAdjustedBooleanSemantics() {
        ActivityMetrics m = new ActivityMetrics();
        assertNull(m.getWeatherAdjusted());
        m.setWeatherAdjusted(false);
        assertFalse(m.getWeatherAdjusted());
        m.setWeatherAdjusted(true);
        assertTrue(m.getWeatherAdjusted());
    }

    @Test
    void routePreviewCoordinates() {
        ActivityMetrics m = new ActivityMetrics();
        m.setRoutePreviewStartX(0.1);
        m.setRoutePreviewStartY(0.2);
        m.setRoutePreviewFinishX(0.9);
        m.setRoutePreviewFinishY(0.8);
        assertEquals(0.1, m.getRoutePreviewStartX());
        assertEquals(0.2, m.getRoutePreviewStartY());
        assertEquals(0.9, m.getRoutePreviewFinishX());
        assertEquals(0.8, m.getRoutePreviewFinishY());
    }
}