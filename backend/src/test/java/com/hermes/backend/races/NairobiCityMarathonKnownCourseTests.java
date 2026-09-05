package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NairobiCityMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialNairobiCityMarathonMapAndGpxGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = NairobiCityMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(578);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.3, 42.6);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), -1.28709, 36.82183))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), -1.29068, 36.81614))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(-1.3475, -1.3472);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(-1.2589, -1.2587);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(36.7718, 36.7721);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(36.9041, 36.9044);

        assertThat(nearestKm(geometryService, routePoints, -1.28855, 36.82395)).isLessThan(0.30); // City Hall
        assertThat(nearestKm(geometryService, routePoints, -1.2880, 36.8219)).isLessThan(0.12); // KICC
        assertThat(nearestKm(geometryService, routePoints, -1.2848, 36.8260)).isLessThan(0.12); // Kencom
        assertThat(nearestKm(geometryService, routePoints, -1.2859, 36.8229)).isLessThan(0.08); // International House
        assertThat(nearestKm(geometryService, routePoints, -1.2849, 36.8237)).isLessThan(0.06); // Hilton
        assertThat(nearestKm(geometryService, routePoints, -1.2850, 36.8211)).isLessThan(0.08); // Mama Ngina Street
        assertThat(nearestKm(geometryService, routePoints, -1.2898, 36.8197)).isLessThan(0.10); // Nairobi Expressway
        assertThat(nearestKm(geometryService, routePoints, -1.2625, 36.7688)).isLessThan(0.50); // ABC Place

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(NairobiCityMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                NairobiCityMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
