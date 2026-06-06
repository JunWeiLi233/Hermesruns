package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class DohaMarathonKnownCourse {
    static final String SOURCE_NOTE = "Doha Marathon by Ooredoo 2026 official race-guide route map";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 180;

    private static final double[][] COORDINATES = {
            {25.321800, 51.529500},
            {25.320500, 51.524000},
            {25.325000, 51.516000},
            {25.314000, 51.510500},
            {25.300000, 51.513000},
            {25.289000, 51.525000},
            {25.286000, 51.536500},
            {25.292000, 51.543500},
            {25.293500, 51.533000},
            {25.297500, 51.524000},
            {25.306500, 51.520000},
            {25.321800, 51.529500},
            {25.320500, 51.524000},
            {25.325000, 51.516000},
            {25.314000, 51.510500},
            {25.300000, 51.513000},
            {25.289000, 51.525000},
            {25.286000, 51.536500},
            {25.292000, 51.543500},
            {25.293500, 51.533000},
            {25.297500, 51.524000},
            {25.306500, 51.520000},
            {25.321800, 51.529500},
            {25.320500, 51.524000},
            {25.325000, 51.516000},
            {25.314000, 51.510500},
            {25.300000, 51.513000},
            {25.289000, 51.525000},
            {25.286000, 51.536500},
            {25.292000, 51.543500},
            {25.293500, 51.533000},
            {25.297500, 51.524000},
            {25.306500, 51.520000},
            {25.321800, 51.529500},
            {25.322666, 51.520149},
            {25.321800, 51.529500},
    };

    private DohaMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> points = new ArrayList<>(COORDINATES.length);
        for (double[] coordinate : COORDINATES) {
            points.add(new RoutePoint(coordinate[0], coordinate[1], null));
        }
        return points;
    }
}
