package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SupplementalMarathonKnownCoursesTests {

    @Test
    void supplementalRoutesDecodeToPlausibleMarathonGeometry() {
        RaceCourseMapGeometryService geometryService = new RaceCourseMapGeometryService();

        assertThat(SupplementalMarathonKnownCourses.definitions()).hasSize(22);

        for (SupplementalMarathonKnownCourses.CourseDefinition definition : SupplementalMarathonKnownCourses.definitions()) {
            List<RoutePoint> routePoints = definition.routePoints();
            double distanceKm = geometryService.polylineDistanceKm(routePoints);

            assertThat(routePoints)
                    .as(definition.raceId())
                    .hasSizeGreaterThan(80);
            assertThat(distanceKm)
                    .as(definition.raceId())
                    .isBetween(definition.expectedMinKm(), definition.expectedMaxKm());
            assertThat(routePoints.get(0).label())
                    .as(definition.raceId())
                    .contains("Start");
            assertThat(routePoints.get(routePoints.size() - 1).label())
                    .as(definition.raceId())
                    .contains("Finish");
            assertThat(geometryService.countSelfIntersections(routePoints))
                    .as(definition.raceId())
                    .isLessThanOrEqualTo(definition.maxSelfIntersections());
            assertThat(geometryService.assessAlignmentPlausibility(
                    routePoints,
                    null,
                    null,
                    42.195,
                    20,
                    RaceCourseMapService.PromptRaceType.POINT_TO_POINT,
                    definition.maxSelfIntersections()
            ).plausible())
                    .as(definition.raceId())
                    .isTrue();
        }
    }

    @Test
    void supplementalRoutesMatchCatalogRaceNames() {
        for (SupplementalMarathonKnownCourses.CourseDefinition definition : SupplementalMarathonKnownCourses.definitions()) {
            assertThat(SupplementalMarathonKnownCourses.find(definition.raceName(), definition.city(), definition.country()))
                    .as(definition.raceId())
                    .contains(definition);
        }
    }
}
