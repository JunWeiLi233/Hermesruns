package com.hermes.backend.races;

import com.hermes.backend.races.model.PromptRaceType;
import com.hermes.backend.races.model.RouteGeometryDiagnosis;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CopenhagenMarathonKnownCourseTests {
    @Test
    void knownCourseUsesOfficialInteractiveRouteWithMarathonDistance() {
        List<RoutePoint> routePoints = CopenhagenMarathonKnownCourse.routePoints();
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();

        assertThat(routePoints).hasSizeGreaterThan(150);
        RoutePoint first = routePoints.get(0);
        RoutePoint last = routePoints.get(routePoints.size() - 1);
        assertThat(first.lat()).isCloseTo(55.7031, org.assertj.core.data.Offset.offset(0.002));
        assertThat(first.lng()).isCloseTo(12.5690, org.assertj.core.data.Offset.offset(0.002));
        assertThat(last.lat()).isCloseTo(first.lat(), org.assertj.core.data.Offset.offset(0.001));
        assertThat(last.lng()).isCloseTo(first.lng(), org.assertj.core.data.Offset.offset(0.001));
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.7, 43.1);

        RouteGeometryDiagnosis diagnosis = geometryService.diagnoseRouteGeometry(
                routePoints,
                PromptRaceType.LOOP,
                42.195
        );
        assertThat(diagnosis.selfIntersectionCount()).isBetween(4, 8);
        assertThat(diagnosis.allowedSelfIntersections()).isEqualTo(3);
    }
}
