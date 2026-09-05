package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PortoMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialPortoMarathonMapAndCheckedTraceGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = PortoMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(804);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(41.9, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 41.16891, -8.68777))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 41.17240, -8.68348))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(41.1398, 41.1400);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(41.1979, 41.1982);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(-8.7104, -8.7101);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(-8.5872, -8.5869);

        assertThat(nearestKm(geometryService, routePoints, 41.17309, -8.68484)).isLessThan(0.03); // Queimodromo
        assertThat(nearestKm(geometryService, routePoints, 41.16894, -8.68838)).isLessThan(0.06); // Sea Life Porto
        assertThat(nearestKm(geometryService, routePoints, 41.16849, -8.69039)).isLessThan(0.12); // Castelo do Queijo
        assertThat(nearestKm(geometryService, routePoints, 41.1857, -8.7000)).isLessThan(0.15); // Porto de Leixoes
        assertThat(nearestKm(geometryService, routePoints, 41.1857, -8.6960)).isLessThan(0.03); // Ponte Movel de Leca
        assertThat(nearestKm(geometryService, routePoints, 41.1748, -8.6902)).isLessThan(0.05); // Matosinhos Beach
        assertThat(nearestKm(geometryService, routePoints, 41.1482, -8.6724)).isLessThan(0.12); // Foz do Douro
        assertThat(nearestKm(geometryService, routePoints, 41.1472, -8.6404)).isLessThan(0.16); // Arrabida Bridge
        assertThat(nearestKm(geometryService, routePoints, 41.1401, -8.6091)).isLessThan(0.11); // Dom Luis I Bridge
        assertThat(nearestKm(geometryService, routePoints, 41.1430, -8.6423)).isLessThan(0.60); // Marina da Afurada
        assertThat(nearestKm(geometryService, routePoints, 41.1428, -8.5876)).isLessThan(0.06); // Quinta da China

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(PortoMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.LOOP,
                PortoMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
