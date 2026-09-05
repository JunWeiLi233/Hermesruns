package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DalianMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialDalianLoopCorridor() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = DalianMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(120);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(43.0, 45.0);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 38.9275, 121.6792))
                .isLessThan(0.2);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 38.9275, 121.6792))
                .isLessThan(0.2);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(DalianMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.LOOP,
                DalianMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
