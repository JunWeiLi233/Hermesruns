package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MarrakechMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialMarrakechMarathonGpxGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = MarrakechMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1157);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.7, 42.95);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 31.619774, -8.003576))
                .isLessThan(0.01);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 31.619776, -8.003569))
                .isLessThan(0.01);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(31.5924, 31.5925);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(31.6857, 31.6858);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(-8.0370, -8.0368);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(-7.9709, -7.9707);

        assertThat(nearestKm(geometryService, routePoints, 31.6206, -8.0020)).isLessThan(0.20); // Avenue de la Menara / Sofitel area
        assertThat(nearestKm(geometryService, routePoints, 31.6332, -8.0166)).isLessThan(0.05); // Gueliz corridor
        assertThat(nearestKm(geometryService, routePoints, 31.5925, -7.9913)).isLessThan(0.05); // Agdal southern turn
        assertThat(nearestKm(geometryService, routePoints, 31.6743, -7.9904)).isLessThan(0.05); // Palmeraie northern section

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(MarrakechMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.LOOP,
                MarrakechMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
