package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class QingdaoMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialQingdaoMarathonRoadSequence() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = QingdaoMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(974);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(41.9, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 36.06535, 120.37741))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 36.05465, 120.39098))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(36.0492, 36.0494);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(36.0866, 36.0869);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(120.2983, 120.2986);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(120.4558, 120.4562);

        assertThat(nearestKm(geometryService, routePoints, 36.05540, 120.36115)).isLessThan(0.04); // Hong Kong West Road
        assertThat(nearestKm(geometryService, routePoints, 36.05986, 120.34012)).isLessThan(0.04); // Wendeng Road
        assertThat(nearestKm(geometryService, routePoints, 36.05417, 120.30471)).isLessThan(0.04); // Xilingxia Road
        assertThat(nearestKm(geometryService, routePoints, 36.06203, 120.31016)).isLessThan(0.04); // Tancheng Road
        assertThat(nearestKm(geometryService, routePoints, 36.06235, 120.31512)).isLessThan(0.04); // Lanshan Road
        assertThat(nearestKm(geometryService, routePoints, 36.04993, 120.34061)).isLessThan(0.04); // Huiquan Road
        assertThat(nearestKm(geometryService, routePoints, 36.05099, 120.34911)).isLessThan(0.04); // Huanghai Road
        assertThat(nearestKm(geometryService, routePoints, 36.06083, 120.37912)).isLessThan(0.04); // May Fourth Wind / Macao Road
        assertThat(nearestKm(geometryService, routePoints, 36.06107, 120.38632)).isLessThan(0.04); // Qingyuan Road
        assertThat(nearestKm(geometryService, routePoints, 36.05726, 120.39365)).isLessThan(0.08); // Olympic Sailing Center Gate 1
        assertThat(nearestKm(geometryService, routePoints, 36.06748, 120.43164)).isLessThan(0.04); // Donghai East Road
        assertThat(nearestKm(geometryService, routePoints, 36.08673, 120.45599)).isLessThan(0.04); // Haikou Road turnaround
        assertThat(nearestKm(geometryService, routePoints, 36.05796, 120.39716)).isLessThan(0.05); // Zengcheng Road

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(QingdaoMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                QingdaoMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
