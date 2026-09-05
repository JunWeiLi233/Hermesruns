package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class DubaiMarathonKnownCourse {
    static final String SOURCE_NOTE = "Dubai Marathon 2026 official routes-and-maps page plus 42.195km route-map PDF";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 220;

    private static final double[][] COORDINATES = {
            {25.130200, 55.190200},
            {25.132400, 55.188600},
            {25.133375, 55.187380},
            {25.109990, 55.169429},
            {25.102800, 55.157200},
            {25.096000, 55.151000},
            {25.102800, 55.157200},
            {25.109990, 55.169429},
            {25.133375, 55.187380},
            {25.141327, 55.185397},
            {25.141588, 55.190845},
            {25.145500, 55.195200},
            {25.152670, 55.201708},
            {25.174890, 55.217292},
            {25.184200, 55.226100},
            {25.174890, 55.217292},
            {25.152670, 55.201708},
            {25.145500, 55.195200},
            {25.141588, 55.190845},
            {25.141327, 55.185397},
            {25.133375, 55.187380},
            {25.141327, 55.185397},
            {25.141588, 55.190845},
            {25.145500, 55.195200},
            {25.152670, 55.201708},
            {25.174890, 55.217292},
            {25.184200, 55.226100},
            {25.174890, 55.217292},
            {25.152670, 55.201708},
            {25.145500, 55.195200},
            {25.141588, 55.190845},
            {25.141327, 55.185397},
            {25.133375, 55.187380},
            {25.132400, 55.188600},
            {25.126800, 55.193000},
    };

    private DubaiMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> points = new ArrayList<>(COORDINATES.length);
        for (double[] coordinate : COORDINATES) {
            points.add(new RoutePoint(coordinate[0], coordinate[1], null));
        }
        return points;
    }
}
