package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MunichMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialMunichMarathonMapAndCheckedGpxGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = MunichMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1697);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.5, 42.8);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 48.17266, 11.54434))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 48.17399, 11.55493))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(48.1236, 48.1238);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(48.1848, 48.1851);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(11.5387, 11.5390);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(11.6336, 11.6339);

        assertThat(nearestKm(geometryService, routePoints, 48.1336, 11.5672)).isLessThan(0.10); // Sendlinger Tor
        assertThat(nearestKm(geometryService, routePoints, 48.1372, 11.5755)).isLessThan(0.05); // Marienplatz
        assertThat(nearestKm(geometryService, routePoints, 48.1420, 11.5775)).isLessThan(0.05); // Odeonsplatz
        assertThat(nearestKm(geometryService, routePoints, 48.1523, 11.5821)).isLessThan(0.05); // Siegestor
        assertThat(nearestKm(geometryService, routePoints, 48.1523, 11.5920)).isLessThan(0.25); // Chinesischer Turm
        assertThat(nearestKm(geometryService, routePoints, 48.1591, 11.6167)).isLessThan(0.05); // Oberfoehringer Strasse
        assertThat(nearestKm(geometryService, routePoints, 48.1240, 11.6080)).isLessThan(0.05); // Werksviertel
        assertThat(nearestKm(geometryService, routePoints, 48.1346, 11.5820)).isLessThan(0.05); // Isartor
        assertThat(nearestKm(geometryService, routePoints, 48.1568, 11.5748)).isLessThan(0.10); // Franz-Joseph-Strasse

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(MunichMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.LOOP,
                MunichMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
