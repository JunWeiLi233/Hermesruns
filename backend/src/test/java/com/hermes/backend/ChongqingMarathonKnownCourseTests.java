package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChongqingMarathonKnownCourseTests {
    @Test
    void knownCourseFollowsOfficialOutAndBackCorridorWithMarathonDistance() {
        List<RoutePoint> routePoints = ChongqingMarathonKnownCourse.routePoints();
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();

        assertThat(routePoints).hasSizeGreaterThan(120);
        RoutePoint first = routePoints.get(0);
        RoutePoint last = routePoints.get(routePoints.size() - 1);
        assertThat(first.lat()).isCloseTo(29.5432, org.assertj.core.data.Offset.offset(0.002));
        assertThat(first.lng()).isCloseTo(106.5651, org.assertj.core.data.Offset.offset(0.002));
        assertThat(last.lat()).isCloseTo(first.lat(), org.assertj.core.data.Offset.offset(0.0001));
        assertThat(last.lng()).isCloseTo(first.lng(), org.assertj.core.data.Offset.offset(0.0001));
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.0, 42.4);
        assertThat(geometryService.isAlignmentPlausible(routePoints, null, null, 42.195, 12, RaceCourseMapService.PromptRaceType.POINT_TO_POINT)).isTrue();
        assertThat(routePoints).anySatisfy(point -> assertThat(geometryService.haversineKm(point.lat(), point.lng(), 29.5702, 106.5903)).isLessThan(0.25));
        assertThat(routePoints).anySatisfy(point -> assertThat(geometryService.haversineKm(point.lat(), point.lng(), 29.4743, 106.5250)).isLessThan(0.25));
        assertThat(routePoints).anySatisfy(point -> assertThat(geometryService.haversineKm(point.lat(), point.lng(), 29.4691, 106.4990)).isLessThan(0.25));
    }
}
