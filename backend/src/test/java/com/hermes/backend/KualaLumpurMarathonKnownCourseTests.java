package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class KualaLumpurMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialKualaLumpurPdfRouteMap() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = KualaLumpurMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(500);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 3.15551, 101.69440))
                .isLessThan(0.05);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 3.13927, 101.70077))
                .isLessThan(0.05);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(KualaLumpurMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                KualaLumpurMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
