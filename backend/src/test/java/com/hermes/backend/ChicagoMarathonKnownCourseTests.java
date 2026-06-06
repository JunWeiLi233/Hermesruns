package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChicagoMarathonKnownCourseTests {
    @Test
    void knownCourseStartsAndFinishesAtGrantParkWithMarathonDistance() {
        List<RoutePoint> routePoints = ChicagoMarathonKnownCourse.routePoints();
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();

        assertThat(routePoints).hasSizeGreaterThan(150);
        RoutePoint first = routePoints.get(0);
        RoutePoint last = routePoints.get(routePoints.size() - 1);
        assertThat(first.label()).contains("Start");
        assertThat(last.label()).contains("Finish");
        assertThat(first.lat()).isCloseTo(41.8809, org.assertj.core.data.Offset.offset(0.002));
        assertThat(first.lng()).isCloseTo(-87.6207, org.assertj.core.data.Offset.offset(0.002));
        assertThat(last.lat()).isCloseTo(41.8699, org.assertj.core.data.Offset.offset(0.002));
        assertThat(last.lng()).isCloseTo(-87.6205, org.assertj.core.data.Offset.offset(0.002));
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.0, 43.5);
    }
}
