package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PragueMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialPragueMarathonMapAndLinkedMapyGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = PragueMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(1017);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(41.9, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 50.08739, 14.42079))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 50.08738, 14.42080))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(50.0469, 50.0471);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(50.1032, 50.1035);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(14.4044, 14.4047);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(14.4677, 14.4680);

        assertThat(nearestKm(geometryService, routePoints, 50.08736, 14.42100)).isLessThan(0.03); // Old Town Square
        assertThat(nearestKm(geometryService, routePoints, 50.08845, 14.42008)).isLessThan(0.03); // Parizska
        assertThat(nearestKm(geometryService, routePoints, 50.09185, 14.41173)).isLessThan(0.08); // Manesuv most
        assertThat(nearestKm(geometryService, routePoints, 50.09471, 14.42711)).isLessThan(0.10); // Stefanikuv most
        assertThat(nearestKm(geometryService, routePoints, 50.10318, 14.45598)).isLessThan(0.05); // Libensky most
        assertThat(nearestKm(geometryService, routePoints, 50.07540, 14.41362)).isLessThan(0.08); // Jiraskuv most
        assertThat(nearestKm(geometryService, routePoints, 50.06812, 14.41481)).isLessThan(0.08); // Vyton
        assertThat(nearestKm(geometryService, routePoints, 50.08357, 14.41372)).isLessThan(0.08); // Smetanovo nabrezi
        assertThat(nearestKm(geometryService, routePoints, 50.08770, 14.42813)).isLessThan(0.08); // namesti Republiky
        assertThat(nearestKm(geometryService, routePoints, 50.09587, 14.43337)).isLessThan(0.12); // Hlavkuv most

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(PragueMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.LOOP,
                PragueMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
