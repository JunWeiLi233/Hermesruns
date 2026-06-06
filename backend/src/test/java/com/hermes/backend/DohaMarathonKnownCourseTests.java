package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DohaMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialCornicheCorridorWithMarathonDistance() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = DohaMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(30);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.0, 42.4);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 25.3218, 51.5295))
                .isLessThan(0.1);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 25.3218, 51.5295))
                .isLessThan(0.1);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(DohaMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.LOOP,
                DohaMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
