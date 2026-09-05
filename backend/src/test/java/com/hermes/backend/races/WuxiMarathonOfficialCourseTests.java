package com.hermes.backend.races;

import java.util.List;
import java.util.Objects;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WuxiMarathonOfficialCourseTests {

    @Test
    void officialWaypointsFollowPublished2026RouteLandmarks() {
        List<double[]> waypoints = WuxiMarathonOfficialCourse.waypoints();
        List<String> labels = IntStream.range(0, WuxiMarathonOfficialCourse.waypointCount())
                .mapToObj(WuxiMarathonOfficialCourse::labelAt)
                .filter(Objects::nonNull)
                .toList();

        assertThat(WuxiMarathonOfficialCourse.OFFICIAL_COURSE_URL)
                .isEqualTo("https://wuxi.marathon.org.cn/page/wZ2dP3y0a5OB0oGp46LA.html");
        assertThat(waypoints).hasSizeGreaterThanOrEqualTo(18);
        assertThat(labels)
                .contains(
                        "Start - Taihu Avenue / Yinxiu Road",
                        "Hongqiao Road turn",
                        "Yinxiu Road / Wangshan Road",
                        "Jiangnan University South Gate",
                        "Finance Second Street / Fangmiao Road",
                        "Gonghu Bay Wetland Park Greenway",
                        "Finish - Wuxi Taihu International Expo Center"
                );

        double[] start = waypoints.get(0);
        double[] finish = waypoints.get(waypoints.size() - 1);
        assertThat(start[0]).isBetween(31.54, 31.56);
        assertThat(start[1]).isBetween(120.24, 120.27);
        assertThat(finish[0]).isBetween(31.47, 31.49);
        assertThat(finish[1]).isBetween(120.32, 120.33);

        double minLat = waypoints.stream().mapToDouble(point -> point[0]).min().orElseThrow();
        double maxLat = waypoints.stream().mapToDouble(point -> point[0]).max().orElseThrow();
        double minLng = waypoints.stream().mapToDouble(point -> point[1]).min().orElseThrow();
        double maxLng = waypoints.stream().mapToDouble(point -> point[1]).max().orElseThrow();
        assertThat(minLat).isBetween(31.47, 31.49);
        assertThat(maxLat).isBetween(31.55, 31.56);
        assertThat(minLng).isBetween(120.20, 120.23);
        assertThat(maxLng).isBetween(120.32, 120.33);
    }
}
