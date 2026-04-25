package com.hermes.backend;

import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.*;

class ActivityTests {

    @Test
    void fieldsRoundTrip() {
        var a = new Activity();
        a.setId(42L);
        a.setName("Morning Run");
        a.setStravaId("12345");
        a.setDistanceKm(10.5);
        a.setMovingTimeSeconds(3600);
        a.setStartDate("2025-01-15");
        a.setProvider(ImportProvider.STRAVA);
        a.setActivityType(ActivityType.RUN);
        a.setStartTime(LocalDateTime.of(2025, 1, 15, 8, 0));
        a.setDistanceMeters(10500.0);
        a.setDurationSeconds(3600L);
        a.setSourceFileName("test.fit");
        a.setSourceChecksum("abc123");

        assertEquals(42L, a.getId());
        assertEquals("Morning Run", a.getName());
        assertEquals("12345", a.getStravaId());
        assertEquals(10.5, a.getDistanceKm());
        assertEquals(3600, a.getMovingTimeSeconds());
        assertEquals("2025-01-15", a.getStartDate());
        assertEquals(ImportProvider.STRAVA, a.getProvider());
        assertEquals(ActivityType.RUN, a.getActivityType());
        assertEquals(LocalDateTime.of(2025, 1, 15, 8, 0), a.getStartTime());
        assertEquals(10500.0, a.getDistanceMeters());
        assertEquals(3600L, a.getDurationSeconds());
        assertEquals("test.fit", a.getSourceFileName());
        assertEquals("abc123", a.getSourceChecksum());
    }

    @Test
    void metricsDelegationRoundTrip() {
        var a = new Activity();
        a.setAverageHeartRate(145.0);
        a.setMaxHeartRate(172.0);
        a.setTotalElevationGain(320.5);
        a.setCalories(650);
        a.setAverageCadence(82.0);
        a.setAverageWatts(210.0);
        a.setMaxSpeedMps(4.5);
        a.setSufferScore(85);
        a.setRoutePreviewPath("/previews/abc.png");
        a.setRoutePreviewStartX(100.0);
        a.setRoutePreviewStartY(200.0);
        a.setRoutePreviewFinishX(300.0);
        a.setRoutePreviewFinishY(400.0);
        a.setPacePenaltySecPerKm(5);
        a.setWeatherAdjusted(true);

        assertEquals(145.0, a.getAverageHeartRate());
        assertEquals(172.0, a.getMaxHeartRate());
        assertEquals(320.5, a.getTotalElevationGain());
        assertEquals(650, a.getCalories());
        assertEquals(82.0, a.getAverageCadence());
        assertEquals(210.0, a.getAverageWatts());
        assertEquals(4.5, a.getMaxSpeedMps());
        assertEquals(85, a.getSufferScore());
        assertEquals("/previews/abc.png", a.getRoutePreviewPath());
        assertEquals(100.0, a.getRoutePreviewStartX());
        assertEquals(200.0, a.getRoutePreviewStartY());
        assertEquals(300.0, a.getRoutePreviewFinishX());
        assertEquals(400.0, a.getRoutePreviewFinishY());
        assertEquals(5, a.getPacePenaltySecPerKm());
        assertTrue(a.getWeatherAdjusted());
    }

    @Test
    void prePersistSetsCreatedAt() {
        var a = new Activity();
        assertNull(a.getCreatedAt());
        a.prePersist();
        assertNotNull(a.getCreatedAt());
        var first = a.getCreatedAt();
        a.prePersist();
        assertEquals(first, a.getCreatedAt());
    }

    @Test
    void addPointSetsBidirectionalRelationship() {
        var a = new Activity();
        var p = new ActivityPoint();
        p.setSequenceIndex(1);
        a.addPoint(p);

        assertEquals(1, a.getPoints().size());
        assertSame(p, a.getPoints().get(0));
        assertSame(a, p.getActivity());
    }

    @Test
    void shoeDelegation() {
        var s = new Shoe();
        s.setId(99L);
        s.setBrand("Nike");
        s.setModel("Vaporfly");
        s.setNickname("Racers");

        var a = new Activity();
        assertNull(a.getShoeId());
        assertNull(a.getShoeName());

        a.setShoe(s);
        assertEquals(99L, a.getShoeId());
        assertEquals("Nike Vaporfly", a.getShoeName());

        s.setBrand(null);
        assertEquals("Vaporfly", a.getShoeName());

        s.setModel(null);
        assertEquals("Racers", a.getShoeName());
    }

    @Test
    void runnerAssociation() {
        var r = new Runner("test@test.com", "active");
        var a = new Activity();
        a.setRunner(r);
        assertSame(r, a.getRunner());
    }

    @Test
    void pointsListMutation() {
        var a = new Activity();
        assertTrue(a.getPoints().isEmpty());

        var p1 = new ActivityPoint();
        a.addPoint(p1);
        assertEquals(1, a.getPoints().size());

        var p2 = new ActivityPoint();
        a.addPoint(p2);
        assertEquals(2, a.getPoints().size());
    }

    @Test
    void createdAtExplicit() {
        var a = new Activity();
        var now = LocalDateTime.of(2024, 6, 1, 12, 0);
        a.setCreatedAt(now);
        assertEquals(now, a.getCreatedAt());
        a.prePersist();
        assertEquals(now, a.getCreatedAt());
    }
}
