package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static java.util.Collections.max;
import static java.util.Collections.min;

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

    @Test
    void knownCourseElevationMatchesPublishedFlatProfileRange() {
        List<Integer> samples = ChicagoMarathonKnownCourse.elevationProfileMeters();

        assertThat(samples).hasSize(64);
        assertThat(min(samples)).isEqualTo(176);
        assertThat(max(samples)).isEqualTo(187);
        assertThat(totalClimbMeters(samples)).isEqualTo(74);
        assertThat(ChicagoMarathonKnownCourse.OFFICIAL_TOTAL_CLIMB_METERS).isEqualTo(74);
    }

    private static int totalClimbMeters(List<Integer> samples) {
        int total = 0;
        for (int i = 1; i < samples.size(); i++) {
            total += Math.max(0, samples.get(i) - samples.get(i - 1));
        }
        return total;
    }
}
