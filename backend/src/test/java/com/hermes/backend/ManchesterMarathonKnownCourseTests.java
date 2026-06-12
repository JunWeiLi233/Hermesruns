package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ManchesterMarathonKnownCourseTests {

    @Test
    void routePointsFollowCheckedManchesterMarathonCourseGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = ManchesterMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(934);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.4);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 53.463686, -2.281654))
                .isLessThan(0.05);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 53.466527, -2.233994))
                .isLessThan(0.05);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(53.3853, 53.3855);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(53.4716, 53.4718);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(-2.3535, -2.3533);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(-2.2285, -2.2283);

        assertThat(nearestKm(geometryService, routePoints, 53.4240, -2.3220)).isLessThan(0.30); // Sale
        assertThat(nearestKm(geometryService, routePoints, 53.3964, -2.3245)).isLessThan(0.20); // Timperley
        assertThat(nearestKm(geometryService, routePoints, 53.3875, -2.3485)).isLessThan(0.10); // Altrincham
        assertThat(nearestKm(geometryService, routePoints, 53.4420, -2.2760)).isLessThan(0.15); // Chorlton-cum-Hardy
        assertThat(nearestKm(geometryService, routePoints, 53.4664, -2.2339)).isLessThan(0.05); // Oxford Road finish

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(ManchesterMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                ManchesterMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
