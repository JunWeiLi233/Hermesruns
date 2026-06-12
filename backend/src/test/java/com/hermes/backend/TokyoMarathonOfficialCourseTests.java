package com.hermes.backend;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Objects;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class TokyoMarathonOfficialCourseTests {

    @Test
    void officialCourseFollowsCurrentPublishedPassingTimeLandmarks() {
        List<double[]> waypoints = TokyoMarathonOfficialCourse.waypoints();
        List<String> labels = IntStream.range(0, TokyoMarathonOfficialCourse.waypointCount())
                .mapToObj(TokyoMarathonOfficialCourse::labelAt)
                .filter(Objects::nonNull)
                .toList();

        assertThat(waypoints).hasSizeGreaterThanOrEqualTo(25);
        assertThat(labels)
                .contains(
                        "Start - Tokyo Metropolitan Government Bldg. No.1",
                        "Uenohirokoji turning point",
                        "Kuramae Bridge",
                        "Tomioka Hachimangu turning point",
                        "Ginza",
                        "Tamachi Station turning point",
                        "Finish - Tokyo Station / Gyoko-dori Ave."
                )
                .doesNotContain(
                        "Kiyosumi-Shirakawa",
                        "Tatsumi (south turn)",
                        "Tsukishima",
                        "Finish - Wadakura Gate"
                );

        double[] yusenBuilding = waypoints.get(46);
        double[] finish = waypoints.get(waypoints.size() - 1);
        assertThat(finish[0]).isBetween(35.681, 35.682);
        assertThat(finish[1]).isBetween(139.764, 139.766);
        assertThat(finish[1]).isGreaterThan(yusenBuilding[1]);

        double minLat = waypoints.stream().mapToDouble(point -> point[0]).min().orElseThrow();
        double maxLat = waypoints.stream().mapToDouble(point -> point[0]).max().orElseThrow();
        double minLng = waypoints.stream().mapToDouble(point -> point[1]).min().orElseThrow();
        double maxLng = waypoints.stream().mapToDouble(point -> point[1]).max().orElseThrow();

        assertThat(minLat).isBetween(35.64, 35.66);
        assertThat(maxLat).isBetween(35.70, 35.715);
        assertThat(minLng).isBetween(139.68, 139.70);
        assertThat(maxLng).isBetween(139.79, 139.805);
    }
}
