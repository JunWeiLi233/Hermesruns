package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class QueenstownMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialQueenstownMarathonCourseDescription() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = QueenstownMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1913);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(41.7, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), -44.94802, 168.81412))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), -45.03043, 168.65975))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(-45.0368, -45.0364);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(-44.9385, -44.9381);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(168.6588, 168.6592);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(168.8551, 168.8555);

        assertThat(nearestKm(geometryService, routePoints, -44.94247, 168.81926)).isLessThan(0.05); // The Avenue / Malaghans Road
        assertThat(nearestKm(geometryService, routePoints, -44.93879, 168.83359)).isLessThan(0.05); // Buckingham Street, Arrowtown
        assertThat(nearestKm(geometryService, routePoints, -44.96815, 168.85400)).isLessThan(0.08); // Arrow River Trail
        assertThat(nearestKm(geometryService, routePoints, -44.99517, 168.80348)).isLessThan(0.05); // Lake Hayes Trail
        assertThat(nearestKm(geometryService, routePoints, -44.96696, 168.80828)).isLessThan(0.05); // Lake Hayes Trail / Rutherford Road
        assertThat(nearestKm(geometryService, routePoints, -44.96092, 168.80452)).isLessThan(0.05); // Slope Hill / Speargrass
        assertThat(nearestKm(geometryService, routePoints, -44.99675, 168.76024)).isLessThan(0.05); // Spence Road / Old Shotover Bridge
        assertThat(nearestKm(geometryService, routePoints, -45.02801, 168.73361)).isLessThan(0.05); // Kawarau Falls Heritage Bridge
        assertThat(nearestKm(geometryService, routePoints, -45.01872, 168.72695)).isLessThan(0.05); // Frankton Track
        assertThat(nearestKm(geometryService, routePoints, -45.03659, 168.66357)).isLessThan(0.05); // Park Street / Queenstown Gardens
        assertThat(nearestKm(geometryService, routePoints, -45.03268, 168.66032)).isLessThan(0.05); // Marine Parade
        assertThat(nearestKm(geometryService, routePoints, -45.03179, 168.65913)).isLessThan(0.05); // Rees Street

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(QueenstownMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                QueenstownMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
