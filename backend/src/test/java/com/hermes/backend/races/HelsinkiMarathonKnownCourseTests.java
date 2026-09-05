package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HelsinkiMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialHelsinkiGoogleMyMapsRoute() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = HelsinkiMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(300);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.0, 42.2);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 60.1551, 24.9524))
                .isLessThan(0.1);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 60.1551, 24.9523))
                .isLessThan(0.1);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(HelsinkiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.LOOP,
                HelsinkiMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
