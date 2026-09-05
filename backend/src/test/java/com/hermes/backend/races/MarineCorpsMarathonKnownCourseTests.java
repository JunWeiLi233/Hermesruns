package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MarineCorpsMarathonKnownCourseTests {

    @Test
    void routePointsFollowCheckedMarineCorpsMarathonCourseGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = MarineCorpsMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(114);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(43.0, 43.2);

        RoutePoint start = routePoints.get(0);
        assertThat(geometryService.haversineKm(start.lat(), start.lng(), 38.882706, -77.062642))
                .isLessThan(0.01);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 38.8893, -77.0697))
                .isLessThan(0.15);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(38.8541, 38.8542);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(38.9210, 38.9211);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(-77.0963, -77.0962);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(-77.0122, -77.0120);

        assertThat(nearestKm(geometryService, routePoints, 38.9040, -77.0630)).isLessThan(0.20); // Georgetown
        assertThat(nearestKm(geometryService, routePoints, 38.8893, -77.0502)).isLessThan(0.25); // Lincoln Memorial
        assertThat(nearestKm(geometryService, routePoints, 38.8570, -77.0210)).isLessThan(0.25); // Hains Point
        assertThat(nearestKm(geometryService, routePoints, 38.8565, -77.0490)).isLessThan(0.30); // Crystal City
        assertThat(nearestKm(geometryService, routePoints, 38.8719, -77.0563)).isLessThan(0.45); // Pentagon
        assertThat(nearestKm(geometryService, routePoints, 38.882706, -77.062642)).isLessThan(0.01); // certified Route 110 start

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(MarineCorpsMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                MarineCorpsMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
