package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class ParisMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Schneider Electric Marathon de Paris 2026 route map from ASO/schneiderelectricparismarathon.com, cross-checked against The Post Trace 2026 GPX track";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 3;

    private static final String ENCODED_ROUTE =
            "axgiHw`bMjTuaAOgAoAyDOyBRkEQsBHsA~D{QLs@s]s]mDv@kCvEkE}@QcBrC}DtEd@vGiAph@}O`GlFxHdE`D{Tz@sQcJgFrSm_ArNa`AtE_RjAoHp@eHLeCGi@_@k@MuAn@kCNwAzB}Ej@eB~Iyi@j@sG|@uVzAqSpAeQ~@uKdD}BpYuV|"
            + "XkURhSH`Gpa@o_B`AgM_@uLkAcJoCuNiD}LwPw`@sD}QsBcUv@gQp~Ac~BjCiAxRve@zAbMy@lSn@vDfFhFjAlDIxJeCfVuD~MePrXaB~H}AjLEfm@cCvUCpEJhNUzEi@zEe@xBa@rAu@lBu@`BmDhG_EhFiBpCwD`I}AfJUrCiY`i@yFfHw"
            + "JvGeKrLwNbM]Nc@x@_k@`{AcCpEyPlGw@IgBe@_@ZQ|@NpAt@d@t@p@v@hEt@T|CnAbFnDjCnD?vBoJ|MeClGoAjEXcAcAxD?~AwEjT_@rAuEtMQhAq@|Be@t@M`@sA~Fy@pC}CjP_@vCiDnQmAvKKb@Ja@Qx@uCbZyExZmYlpADfb@Zhe@H"
            + "fAH`NDjArBrWLlApBfObCjLf@|A`@bAnWj]bAvAd@bAdBhC~IbMdJbMjGpMlEvINd@pE`Jf@v@pk@`l@b@n@zJzUW~@Pq@oIdXoCjHqE~DyDz@Mh@u@vn@uKfq@Sf@_@OYs@g@Ug@\\E`A[`@a@Ng\\nBe^kSUY@o@|A_K^{FuBky@T}PZwEvF"
            + "}YAqBYoBgFyRI}@LgKRaJIwAe@wB}DqNiIsc@_FsQyAKaBLmAw@kc@bHu@x@u@zA{Glg@mAnIa@Uy@aQ";

    private ParisMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Avenue des Champs-Elysees");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Avenue Foch");
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

    private static List<RoutePoint> removeConsecutiveDuplicates(List<RoutePoint> routePoints) {
        List<RoutePoint> deduped = new ArrayList<>();
        RoutePoint previous = null;
        for (RoutePoint point : routePoints) {
            if (previous == null || Math.abs(previous.lat() - point.lat()) >= 1.0e-6 || Math.abs(previous.lng() - point.lng()) >= 1.0e-6) {
                deduped.add(point);
                previous = point;
            }
        }
        return deduped;
    }
}
