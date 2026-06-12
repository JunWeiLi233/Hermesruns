package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class MarineCorpsMarathonKnownCourse {
    static final String SOURCE_NOTE = "HelloDrifter 2026 route polyline cross-checked against Marine Corps Marathon official 2026 event course map and certified 2025 course map";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 25;

    private static final double CERTIFIED_START_LAT = 38.882706;
    private static final double CERTIFIED_START_LNG = -77.062642;

    private static final String ENCODED_ROUTE =
            "{rjlFtlkuMdImC[aIkHzHqV\\gJhQeRDa@`a@jKp`@zId`AC|JoFlMuOwQiGaYFmOiMa_@d@}S`K}g@i^}RW_a@dOILwh@`J^g@rDgDDmd@uOmFwGe@uLiDc"
            + "BeOvNePz\\aHlCmFcEgR{e@fR|f@`FtDdJiDrSyb@dKuHpGnU|Z`OdPtCzPsDvXQlJ_FtG{Q|KrAdHcFbCmg@tKClExGhKyNzGyL|Acb@e@pSjCjB~Rq\\~X"
            + "yXptAys@wB_Bgx@dAyd@jLuPdOi]hg@cIcD{EbEeRE`ClOgA~]cCmH\\yd@iMoCy@wDi@ohBwDDrDwRbJFhCdR_C?b@vgB~]VjThMxJv]deAn|@nErROdXpE"
            + "l@nB}W|H}BnBkRtIvBxg@@BgBgh@bBwHgCuBpNsD]cBi@fC_F_F}FsD`GuNyXqEyAiL`a@gNhHsMSoI`F}AlFhF`O}]t_@wd@zWZ`I_IfC";

    private MarineCorpsMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = new ArrayList<>();
        routePoints.add(new RoutePoint(CERTIFIED_START_LAT, CERTIFIED_START_LNG, "Start - Route 110"));
        routePoints.addAll(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, routePoints.size() - 1, "Finish - Marine Corps War Memorial");
        return List.copyOf(routePoints);
    }

    private static List<RoutePoint> decodePolyline(String encodedPolyline) {
        List<RoutePoint> points = new ArrayList<>();
        int index = 0;
        int lat = 0;
        int lng = 0;
        while (index < encodedPolyline.length()) {
            int[] latResult = decodeNextValue(encodedPolyline, index);
            index = latResult[1];
            int[] lngResult = decodeNextValue(encodedPolyline, index);
            index = lngResult[1];
            lat += latResult[0];
            lng += lngResult[0];
            points.add(new RoutePoint(lat / 100000.0, lng / 100000.0, null));
        }
        return points;
    }

    private static int[] decodeNextValue(String encodedPolyline, int index) {
        int result = 0;
        int shift = 0;
        int currentIndex = index;
        int b;
        do {
            b = encodedPolyline.charAt(currentIndex++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        int value = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
        return new int[] { value, currentIndex };
    }

    private static void setLabel(List<RoutePoint> routePoints, int index, String label) {
        if (routePoints.isEmpty()) return;
        int safeIndex = Math.max(0, Math.min(index, routePoints.size() - 1));
        RoutePoint point = routePoints.get(safeIndex);
        routePoints.set(safeIndex, new RoutePoint(point.lat(), point.lng(), label));
    }
}
