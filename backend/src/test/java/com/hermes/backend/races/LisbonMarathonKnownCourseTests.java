package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LisbonMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialLisbonGoogleMyMapsRoute() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = LisbonMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSizeGreaterThan(1000);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.2, 42.6);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 38.681308, -9.329188))
                .isLessThan(0.05);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 38.70786, -9.136601))
                .isLessThan(0.05);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(38.6769, 38.6772);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(38.7087, 38.7089);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(-9.4376, -9.4374);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(-9.1367, -9.1365);

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(LisbonMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                PromptRaceType.POINT_TO_POINT,
                LisbonMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }
}
