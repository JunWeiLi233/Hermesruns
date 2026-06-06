package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JakartaMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialJakartaRunningFestivalStravaRoute() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = JakartaMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(2200);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.5);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), -6.2209, 106.80834))
                .isLessThan(0.1);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), -6.22091, 106.80834))
                .isLessThan(0.1);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(JakartaMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.LOOP,
                JakartaMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
