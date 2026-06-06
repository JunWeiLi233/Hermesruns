package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MilanMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialMilanMarathonGpxGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = MilanMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1470);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.7, 43.0);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 45.479424, 9.167498))
                .isLessThan(0.01);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 45.463718, 9.190603))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(45.4519, 45.4520);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(45.5001, 45.5003);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(9.1009, 9.1012);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(9.2067, 9.2069);

        assertThat(nearestKm(geometryService, routePoints, 45.4807, 9.1566)).isLessThan(0.05); // CityLife
        assertThat(nearestKm(geometryService, routePoints, 45.4522, 9.1782)).isLessThan(0.15); // Darsena
        assertThat(nearestKm(geometryService, routePoints, 45.45195, 9.2010)).isLessThan(0.05); // Porta Romana
        assertThat(nearestKm(geometryService, routePoints, 45.4738, 9.2066)).isLessThan(0.15); // Porta Venezia
        assertThat(nearestKm(geometryService, routePoints, 45.4778, 9.1237)).isLessThan(0.30); // San Siro / Ippodromo
        assertThat(nearestKm(geometryService, routePoints, 45.4990, 9.1125)).isLessThan(0.70); // Parco di Trenno western loop

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(MilanMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                MilanMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
