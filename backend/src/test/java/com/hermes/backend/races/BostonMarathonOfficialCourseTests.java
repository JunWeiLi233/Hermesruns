package com.hermes.backend.races;

import java.util.List;
import java.util.Objects;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BostonMarathonOfficialCourseTests {

    @Test
    void officialWaypointsFollowBaaHopkintonToBoylstonCorridor() {
        List<double[]> waypoints = BostonMarathonOfficialCourse.waypoints();

        assertThat(BostonMarathonOfficialCourse.OFFICIAL_COURSE_URL)
                .isEqualTo("https://www.baa.org/wp-content/uploads/2026/03/2026-Course-Map.pdf");
        assertThat(waypoints).hasSizeGreaterThanOrEqualTo(15);

        double[] start = waypoints.get(0);
        double[] finish = waypoints.get(waypoints.size() - 1);
        assertThat(start[0]).isBetween(42.22, 42.24);
        assertThat(start[1]).isBetween(-71.53, -71.50);
        assertThat(finish[0]).isBetween(42.34, 42.36);
        assertThat(finish[1]).isBetween(-71.09, -71.07);
        assertThat(BostonMarathonOfficialCourse.labelAt(0)).contains("Start", "Hopkinton");
        assertThat(BostonMarathonOfficialCourse.labelAt(BostonMarathonOfficialCourse.waypointCount() - 1))
                .contains("Finish", "Boylston");

        List<String> labels = IntStream.range(0, BostonMarathonOfficialCourse.waypointCount())
                .mapToObj(BostonMarathonOfficialCourse::labelAt)
                .filter(Objects::nonNull)
                .toList();
        assertThat(labels)
                .anyMatch(label -> label.contains("Ashland"))
                .anyMatch(label -> label.contains("Framingham"))
                .anyMatch(label -> label.contains("Natick"))
                .anyMatch(label -> label.contains("Wellesley"))
                .anyMatch(label -> label.contains("Newton Fire Station"))
                .anyMatch(label -> label.contains("Heartbreak Hill"))
                .anyMatch(label -> label.contains("Cleveland Circle"))
                .anyMatch(label -> label.contains("Brookline"))
                .anyMatch(label -> label.contains("Kenmore"))
                .anyMatch(label -> label.contains("Hereford"))
                .anyMatch(label -> label.contains("Boylston"));

        long westToEastLegs = IntStream.range(1, waypoints.size())
                .filter(index -> waypoints.get(index)[1] > waypoints.get(index - 1)[1])
                .count();
        assertThat(westToEastLegs).isGreaterThanOrEqualTo(waypoints.size() - 3L);
    }
}
