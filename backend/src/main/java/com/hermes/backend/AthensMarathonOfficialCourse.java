package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

/**
 * Official Athens Marathon route metadata.
 *
 * The official site publishes a GPX download for "Athens Marathon. The
 * Authentic"; the bulk seed service fetches and parses that GPX so the race
 * detail map follows the current official route instead of a synthetic loop.
 */
final class AthensMarathonOfficialCourse {

    static final String RACE_ID = "athens-marathon";
    static final String OFFICIAL_COURSE_URL =
            "https://www.athensauthenticmarathon.gr/en/c/agones-2-26/authentic-marathon-1/marathonios-dromos-33";
    static final String OFFICIAL_GPX_URL =
            "https://www.athensauthenticmarathon.gr/files/product/athens_marathon_the_authentic.gpx";
    static final String OFFICIAL_SOURCE = "athens-official-course";

    private AthensMarathonOfficialCourse() {
    }

    static List<RoutePoint> labelRoute(List<RoutePoint> rawRoute) {
        if (rawRoute == null || rawRoute.isEmpty()) {
            return List.of();
        }
        List<RoutePoint> labeled = new ArrayList<>(rawRoute);
        setLabel(labeled, 0, "Start - Marathonas");
        setLabel(labeled, labeled.size() / 3, "Marathon Avenue");
        setLabel(labeled, Math.max(0, (labeled.size() * 2) / 3), "Mesogeion Avenue");
        setLabel(labeled, labeled.size() - 1, "Finish - Panathenaic Stadium");
        return labeled;
    }

    private static void setLabel(List<RoutePoint> route, int index, String label) {
        if (route == null || route.isEmpty()) return;
        int safeIndex = Math.max(0, Math.min(index, route.size() - 1));
        RoutePoint point = route.get(safeIndex);
        route.set(safeIndex, new RoutePoint(point.lat(), point.lng(), label));
    }
}
