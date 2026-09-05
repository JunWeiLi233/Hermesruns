package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MumbaiMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialMumbaiMarathonMapAndDrivenGpxGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = MumbaiMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(3405);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.6, 42.9);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 18.9398, 72.8354))
                .isLessThan(0.10);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 18.9340, 72.8304))
                .isLessThan(0.05);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(18.9256, 18.9258);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(19.0497, 19.0499);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(72.8073, 72.8075);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(72.8400, 72.8402);

        assertThat(nearestKm(geometryService, routePoints, 18.9323, 72.8315)).isLessThan(0.08); // Hutatma Chowk
        assertThat(nearestKm(geometryService, routePoints, 18.9252, 72.8194)).isLessThan(0.12); // NCPA U-turn
        assertThat(nearestKm(geometryService, routePoints, 18.9824, 72.8108)).isLessThan(0.08); // Haji Ali
        assertThat(nearestKm(geometryService, routePoints, 19.0377, 72.8175)).isLessThan(0.05); // Bandra toll / halfway
        assertThat(nearestKm(geometryService, routePoints, 19.0433, 72.8387)).isLessThan(0.15); // Mahim Causeway
        assertThat(nearestKm(geometryService, routePoints, 19.0169, 72.8304)).isLessThan(0.06); // Siddhivinayak
        assertThat(nearestKm(geometryService, routePoints, 18.9717, 72.8093)).isLessThan(0.03); // Jaslok / 36km cut-off
        assertThat(nearestKm(geometryService, routePoints, 18.9385, 72.8258)).isLessThan(0.20); // Wankhede

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(MumbaiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                MumbaiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
