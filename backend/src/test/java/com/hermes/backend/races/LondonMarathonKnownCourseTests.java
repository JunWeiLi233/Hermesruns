package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LondonMarathonKnownCourseTests {

    @Test
    void routePointsFollowCheckedLondonMarathonCourseGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = LondonMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(990);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.4);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 51.47309, 0.01158))
                .isLessThan(0.05);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 51.50265, -0.1386))
                .isLessThan(0.05);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(51.4730, 51.4732);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(51.5127, 51.5129);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(-0.1401, -0.1399);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(0.0633, 0.0635);

        assertThat(nearestKm(geometryService, routePoints, 51.4829, -0.0099)).isLessThan(0.05); // Cutty Sark
        assertThat(nearestKm(geometryService, routePoints, 51.5055, -0.0754)).isLessThan(0.05); // Tower Bridge
        assertThat(nearestKm(geometryService, routePoints, 51.5049, -0.0195)).isLessThan(0.20); // Canary Wharf
        assertThat(nearestKm(geometryService, routePoints, 51.5071, -0.1230)).isLessThan(0.10); // Victoria Embankment

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(LondonMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                LondonMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
