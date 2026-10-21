package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class HonoluluCourseMapAlignmentTests {
    private final RaceCourseMapGeometryService geometry = new RaceCourseMapGeometryService();

    @Test
    void rejectsLegacyDiagonalThatNeverVisitsTheOfficialStartAndFinish() {
        var points = List.of(new RoutePoint(21.25, -157.95, "Start - Waikiki Beach"),
                new RoutePoint(21.30, -157.90, null), new RoutePoint(21.35, -157.85, null),
                new RoutePoint(21.40, -157.80, null), new RoutePoint(21.35, -157.75, "Finish - Downtown Honolulu"));
        assertThat(RaceKnownOrderedCourseCatalog.assessKnownCourseRoute(points, "Honolulu Marathon", "Honolulu", "United States", geometry).accepted()).isFalse();
    }

    @Test
    void acceptsOrganizerLandmarkOrderAndRejectsRoutesMissingHawaiiKai() {
        var points = MarathonOfficialLandmarkCourseCatalog.find("honolulu-marathon").landmarks().stream()
                .map(point -> new RoutePoint(point.lat(), point.lng(), point.label())).toList();
        assertThat(RaceKnownOrderedCourseCatalog.assessKnownCourseRoute(points, "JAL Honolulu Marathon", "Honolulu", "United States", geometry).accepted()).isTrue();
        var shortened = points.stream().filter(point -> point.lng() < -157.75).toList();
        assertThat(RaceKnownOrderedCourseCatalog.assessKnownCourseRoute(shortened, "Honolulu Marathon", "Honolulu", "United States", geometry).accepted()).isFalse();
    }
}
