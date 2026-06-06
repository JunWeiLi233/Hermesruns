package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StandardCharteredNairobiMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialStandardCharteredNairobiMarathonGuideMapGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = StandardCharteredNairobiMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(830);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.4);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), -1.32706, 36.80225))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), -1.32392, 36.79853))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(-1.3391, -1.3387);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(-1.3040, -1.3037);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(36.7068, 36.7071);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(36.8665, 36.8669);

        assertThat(nearestKm(geometryService, routePoints, -1.32923, 36.80090)).isLessThan(0.15); // Carnivore / CALE
        assertThat(nearestKm(geometryService, routePoints, -1.3259256, 36.7992997)).isLessThan(0.30); // Uhuru Gardens
        assertThat(nearestKm(geometryService, routePoints, -1.3276311, 36.8336643)).isLessThan(0.40); // College of Insurance
        assertThat(nearestKm(geometryService, routePoints, -1.3270079, 36.8457652)).isLessThan(0.08); // Emara Ole Sereni
        assertThat(nearestKm(geometryService, routePoints, -1.33893, 36.86671)).isLessThan(0.03); // ICD / east turn
        assertThat(nearestKm(geometryService, routePoints, -1.3218803, 36.7845284)).isLessThan(0.50); // Southlands Estate
        assertThat(nearestKm(geometryService, routePoints, -1.3038279, 36.7123603)).isLessThan(0.12); // Ngong Road Forest
        assertThat(nearestKm(geometryService, routePoints, -1.31765, 36.78665)).isLessThan(0.03); // Langata interchange

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(StandardCharteredNairobiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.OUT_AND_BACK,
                StandardCharteredNairobiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
