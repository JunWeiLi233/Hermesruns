package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ParisMarathonKnownCourseTests {

    @Test
    void routePointsFollowOfficialParisMarathonMapAndCheckedGpxGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();
        List<RoutePoint> routePoints = ParisMarathonKnownCourse.routePoints();

        assertThat(routePoints).hasSize(209);
        assertThat(geometryService.polylineDistanceKm(routePoints)).isBetween(42.0, 42.3);
        assertThat(geometryService.haversineKm(routePoints.get(0).lat(), routePoints.get(0).lng(), 48.86929, 2.30940))
                .isLessThan(0.02);
        RoutePoint finish = routePoints.get(routePoints.size() - 1);
        assertThat(geometryService.haversineKm(finish.lat(), finish.lng(), 48.87211, 2.27954))
                .isLessThan(0.02);

        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).min().orElseThrow()).isBetween(48.8186, 48.8189);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lat).max().orElseThrow()).isBetween(48.8728, 48.8731);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).min().orElseThrow()).isBetween(2.2413, 2.2417);
        assertThat(routePoints.stream().mapToDouble(RoutePoint::lng).max().orElseThrow()).isBetween(2.4575, 2.4579);

        assertThat(nearestKm(geometryService, routePoints, 48.8721, 2.2970)).isLessThan(1.0); // Arc de Triomphe
        assertThat(nearestKm(geometryService, routePoints, 48.8656, 2.3212)).isLessThan(0.08); // Place de la Concorde
        assertThat(nearestKm(geometryService, routePoints, 48.8719, 2.3316)).isLessThan(0.08); // Palais Garnier
        assertThat(nearestKm(geometryService, routePoints, 48.8616, 2.3346)).isLessThan(0.05); // Carrousel du Louvre
        assertThat(nearestKm(geometryService, routePoints, 48.8530, 2.3690)).isLessThan(0.05); // Place de la Bastille
        assertThat(nearestKm(geometryService, routePoints, 48.8484, 2.3959)).isLessThan(0.25); // Place de la Nation
        assertThat(nearestKm(geometryService, routePoints, 48.8426, 2.4356)).isLessThan(0.35); // Chateau de Vincennes
        assertThat(nearestKm(geometryService, routePoints, 48.8226, 2.4540)).isLessThan(0.35); // INSEP
        assertThat(nearestKm(geometryService, routePoints, 48.8530, 2.3499)).isLessThan(0.35); // Notre-Dame
        assertThat(nearestKm(geometryService, routePoints, 48.8600, 2.3266)).isLessThan(0.40); // Musee d'Orsay
        assertThat(nearestKm(geometryService, routePoints, 48.8584, 2.2945)).isLessThan(0.45); // Eiffel Tower
        assertThat(nearestKm(geometryService, routePoints, 48.8629, 2.2876)).isLessThan(0.10); // Trocadero
        assertThat(nearestKm(geometryService, routePoints, 48.8540, 2.2545)).isLessThan(0.60); // Hippodrome d'Auteuil
        assertThat(nearestKm(geometryService, routePoints, 48.8738, 2.2841)).isLessThan(0.40); // Avenue Foch

        int selfIntersections = geometryService.countSelfIntersections(routePoints);
        assertThat(selfIntersections).isLessThanOrEqualTo(ParisMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS);
        assertThat(geometryService.assessAlignmentPlausibility(
                routePoints,
                null,
                null,
                42.195,
                20,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                ParisMarathonKnownCourse.MAX_OFFICIAL_SELF_INTERSECTIONS
        ).plausible()).isTrue();
    }

    private double nearestKm(RaceCourseMapGeometryService geometryService, List<RoutePoint> routePoints, double lat, double lng) {
        return routePoints.stream()
                .mapToDouble(point -> geometryService.haversineKm(point.lat(), point.lng(), lat, lng))
                .min()
                .orElse(Double.MAX_VALUE);
    }
}
