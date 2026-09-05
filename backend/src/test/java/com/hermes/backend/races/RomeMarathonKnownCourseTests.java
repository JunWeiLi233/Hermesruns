package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RomeMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialRunRomeMarathonCourseGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = RomeMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1152);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.0, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 41.89203, 12.48940))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 41.88626, 12.48475))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(41.8672, 41.8674);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(41.9366, 41.9369);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(12.4488, 12.4492);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(12.4960, 12.4963);

        assertThat(nearestKm(geometryService, routePoints, 41.89577, 12.48235)).isLessThan(0.08); // Piazza Venezia
        assertThat(nearestKm(geometryService, routePoints, 41.87645, 12.48025)).isLessThan(0.15); // Piramide Cestia
        assertThat(nearestKm(geometryService, routePoints, 41.89184, 12.47824)).isLessThan(0.08); // Isola Tiberina
        assertThat(nearestKm(geometryService, routePoints, 41.90306, 12.46628)).isLessThan(0.35); // Castel Sant'Angelo
        assertThat(nearestKm(geometryService, routePoints, 41.90217, 12.45394)).isLessThan(0.45); // Via della Conciliazione
        assertThat(nearestKm(geometryService, routePoints, 41.93070, 12.45616)).isLessThan(0.30); // Foro Italico
        assertThat(nearestKm(geometryService, routePoints, 41.93605, 12.46640)).isLessThan(0.25); // Ponte Milvio
        assertThat(nearestKm(geometryService, routePoints, 41.91071, 12.47636)).isLessThan(0.08); // Piazza del Popolo
        assertThat(nearestKm(geometryService, routePoints, 41.90599, 12.48280)).isLessThan(0.10); // Piazza di Spagna
        assertThat(nearestKm(geometryService, routePoints, 41.89916, 12.47307)).isLessThan(0.10); // Piazza Navona
        assertThat(nearestKm(geometryService, routePoints, 41.88808, 12.48191)).isLessThan(0.08); // Bocca della Verita
        assertThat(nearestKm(geometryService, routePoints, 41.88621, 12.48518)).isLessThan(0.08); // Circo Massimo

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(RomeMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                RomeMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
