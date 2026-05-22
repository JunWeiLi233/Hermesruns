package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RaceCourseMapGeometryServiceTests {

    @Test
    void assessAlignmentPlausibilityExplainsWhenRouteHasTooFewPoints() {
        RaceCourseMapGeometryService service = new RaceCourseMapGeometryService();

        RaceCourseMapGeometryService.AlignmentPlausibilityVerdict verdict = service.assessAlignmentPlausibility(
                List.of(
                        new RoutePoint(42.3601, -71.0589, "Start"),
                        new RoutePoint(42.3610, -71.0575, "Finish")
                ),
                42.3601,
                -71.0589,
                42.195,
                5,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT
        );

        assertThat(verdict.plausible()).isFalse();
        assertThat(verdict.reason()).contains("2 route points").contains("need at least 5");
    }

    @Test
    void assessAlignmentPlausibilityExplainsWhenRouteCentroidIsTooFarFromRaceLocation() {
        RaceCourseMapGeometryService service = new RaceCourseMapGeometryService();

        RaceCourseMapGeometryService.AlignmentPlausibilityVerdict verdict = service.assessAlignmentPlausibility(
                List.of(
                        new RoutePoint(43.1800, -71.3000, "Start"),
                        new RoutePoint(43.2100, -71.2300, null),
                        new RoutePoint(43.2400, -71.1600, null),
                        new RoutePoint(43.2700, -71.0900, null),
                        new RoutePoint(43.2940, -71.0340, "Finish")
                ),
                42.3601,
                -71.0589,
                null,
                5,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT
        );

        assertThat(verdict.plausible()).isFalse();
        assertThat(verdict.reason()).contains("centroid").contains("too far");
    }

    @Test
    void assessAlignmentPlausibilityAllowsSparseButCredibleAdminMarathonTrace() {
        RaceCourseMapGeometryService service = new RaceCourseMapGeometryService();

        RaceCourseMapGeometryService.AlignmentPlausibilityVerdict verdict = service.assessAlignmentPlausibility(
                List.of(
                        new RoutePoint(42.0000, -71.0000, "Start"),
                        new RoutePoint(42.0600, -71.0000, null),
                        new RoutePoint(42.1400, -71.0000, null),
                        new RoutePoint(42.2600, -71.0000, null),
                        new RoutePoint(42.3800, -71.0000, "Finish")
                ),
                42.1900,
                -71.0000,
                42.195,
                5,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT
        );

        assertThat(verdict.plausible()).isTrue();
        assertThat(verdict.reason()).contains("passed plausibility checks");
    }

    @Test
    void assessAlignmentPlausibilityStillRejectsCollapsedSparseTraceWithOneHugeSegment() {
        RaceCourseMapGeometryService service = new RaceCourseMapGeometryService();

        RaceCourseMapGeometryService.AlignmentPlausibilityVerdict verdict = service.assessAlignmentPlausibility(
                List.of(
                        new RoutePoint(42.0000, -71.0000, "Start"),
                        new RoutePoint(42.0200, -71.0000, null),
                        new RoutePoint(42.0500, -71.0000, null),
                        new RoutePoint(42.1000, -71.0000, null),
                        new RoutePoint(42.3800, -71.0000, "Finish")
                ),
                42.1900,
                -71.0000,
                42.195,
                5,
                RaceCourseMapService.PromptRaceType.POINT_TO_POINT
        );

        assertThat(verdict.plausible()).isFalse();
        assertThat(verdict.reason()).contains("one segment covers");
    }

    @Test
    void processRoutePointsCollapsesDuplicateCityCenterRoutePoints() {
        RaceCourseMapGeometryService service = new RaceCourseMapGeometryService();
        List<RoutePoint> repeatedCityCenterPoints = java.util.stream.IntStream.range(0, 20)
                .mapToObj(index -> new RoutePoint(41.8781, -87.6298, index == 0 ? "Start" : null))
                .toList();

        List<RoutePoint> processed = service.processRoutePoints(repeatedCityCenterPoints, RaceCourseMapService.PromptRaceType.LOOP);

        assertThat(processed).hasSize(1);
    }
}
