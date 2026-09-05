package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MexicoCityMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialMexicoCityMarathonRoutePosterGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = MexicoCityMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1385);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.4);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 19.332128, -99.190051))
                .isLessThan(0.01);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 19.43255, -99.13318))
                .isLessThan(0.08);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(19.3321, 19.3322);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(19.4439, 19.4440);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(-99.2059, -99.2058);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(-99.1324, -99.1323);

        assertThat(nearestKm(geometryService, routePoints, 19.4159, -99.1577)).isLessThan(0.10); // Insurgentes/Roma corridor
        assertThat(nearestKm(geometryService, routePoints, 19.4216, -99.1710)).isLessThan(0.10); // Sonora / Parque Espana
        assertThat(nearestKm(geometryService, routePoints, 19.4218, -99.1928)).isLessThan(0.10); // Chapultepec / Gandhi
        assertThat(nearestKm(geometryService, routePoints, 19.4415, -99.2048)).isLessThan(0.10); // Polanco / Moliere
        assertThat(nearestKm(geometryService, routePoints, 19.4404, -99.1397)).isLessThan(0.10); // Plaza Garibaldi
        assertThat(nearestKm(geometryService, routePoints, 19.4285, -99.1328)).isLessThan(0.10); // 20 de Noviembre

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(MexicoCityMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                MexicoCityMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
