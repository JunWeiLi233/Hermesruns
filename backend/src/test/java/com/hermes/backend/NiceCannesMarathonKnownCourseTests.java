package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class NiceCannesMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialNiceCannesMarathonGpxGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = NiceCannesMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1297);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.3, 42.7);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 43.69495, 7.26739))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 43.55024, 7.01950))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(43.5365, 43.5368);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(43.6948, 43.6951);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(7.0193, 7.0197);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(7.2672, 7.2676);

        assertThat(nearestKm(geometryService, routePoints, 43.6954, 7.2653)).isLessThan(0.08); // Theatre de Verdure
        assertThat(nearestKm(geometryService, routePoints, 43.6947, 7.2667)).isLessThan(0.04); // Promenade des Anglais
        assertThat(nearestKm(geometryService, routePoints, 43.6653, 7.2150)).isLessThan(0.20); // Nice Airport
        assertThat(nearestKm(geometryService, routePoints, 43.6585, 7.1867)).isLessThan(0.05); // Saint-Laurent-du-Var port
        assertThat(nearestKm(geometryService, routePoints, 43.6484, 7.1514)).isLessThan(0.15); // Cagnes-sur-Mer hippodrome
        assertThat(nearestKm(geometryService, routePoints, 43.6389, 7.1387)).isLessThan(0.08); // Villeneuve-Loubet Marina
        assertThat(nearestKm(geometryService, routePoints, 43.5804, 7.1251)).isLessThan(0.25); // Antibes old town
        assertThat(nearestKm(geometryService, routePoints, 43.5689, 7.1131)).isLessThan(0.15); // Juan-les-Pins
        assertThat(nearestKm(geometryService, routePoints, 43.5660, 7.0747)).isLessThan(0.03); // Golfe-Juan
        assertThat(nearestKm(geometryService, routePoints, 43.5514, 7.0174)).isLessThan(0.25); // Palais des Festivals

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(NiceCannesMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                NiceCannesMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
