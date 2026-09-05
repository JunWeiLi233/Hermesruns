package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IstanbulMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialIstanbulGoogleMyMapsRoute() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = IstanbulMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(700);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.4);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 41.0369701, 29.0431668))
                .isLessThan(0.1);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 41.0063300, 28.9762100))
                .isLessThan(0.1);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(IstanbulMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                IstanbulMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
