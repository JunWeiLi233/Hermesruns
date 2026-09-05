package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BusanMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialBusanNationalSportsFestivalMarathonMap() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = BusanMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(1000);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.1, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 35.1900767, 129.0595481))
                .isLessThan(0.05);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 35.1900767, 129.0595481))
                .isLessThan(0.05);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(BusanMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                BusanMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
