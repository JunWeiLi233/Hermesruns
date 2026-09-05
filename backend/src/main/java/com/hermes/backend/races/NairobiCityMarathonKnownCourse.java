package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class NairobiCityMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Nairobi City Marathon 2026 course map and GPX file from nairobicitymarathon.com";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 5;

    private static final String ENCODED_ROUTE =
            "hkzFmwv_FkAwCMECEAGDMi@uAg@sAm@oAGGUAcAZk@BQWaA_Cc@kAe@j@A?wAlBwAjByAlBwAjB{ApByArB{ApB_AvA_AtAkA|As@lAM`A?TDRh@zA|CkA|CkA~CkA|CmA|CkA|CkAA@n@`Bl@`BwCjAwCjAuCjA"
            + "wCjAwCjAwCjAO\\~@zB~@|B~@zBJBPNDTGZBCON[BKC[@a@JeCz@sA`@uA`@eBZyBNyBPwAN{B^dA@t@KrBUtBOtBQxAWdCo@`CaAIUyC|@gCj@eCXkCTiCTeBXyBr@g@R{Az@e@Z{@v@kApAaAnAgA`BiA~AgA`B"
            + "mA~AoA~AoAxA}A|A_BzAgBvA_CpB_CpB_CpB_CpB_CpB}BrB_CpB_CpB_CpB_CpB_CpBqAhAoAfA}@`Ay@hA{@fAw@~Ac@~@}@|CYvAUzAMlBMjBIlCKjCIlCY|C[zC]xC[zC]xCSbCUzCGfCIdCS~CS~CU~CS~C"
            + "S~CSnCSlCSnCOjDIvCBnCLzCLfBXlCZnCXlC`@~C`@|C`@~C`@~C?@WBYkDa@{C_@{Ca@{CSiBSiBSiBSgBMmBIsCKsCHoCHoCHgBHgBRcDRaDTcDRcDRaDRcDLkCLiCLkCLkCR_CR}B`@wATmBRoBVwCTwCLmBL"
            + "kBFeBFeBJkBJkB`@uCVgAd@{AvA{CvA}Br@y@`AaA~@_AbCuBbCuBbCuBbCuBbCuBbCuB`CuBbCuBbCuBbCuBbCuBbCuB~BiBrAwArAyAbAuAbAuA`B_C~A}B`B_ChAqApBgBfBaA`A]bAY`Ce@~BU`CS~BUfDq@"
            + "xAg@`DmA~CoA`DmA`DmA`DmA~CoA`DmApCeAnCeApCeAnCgApCeAnCeAbCcAbCeAlAs@lAs@lAy@jAy@hASzAy@xAy@pAo@rAq@jAw@nAo@lCkAjCs@hCu@zBk@|Bk@zBk@|Ae@~By@|By@~By@|By@nBu@nBu@p"
            + "CcApCeApCcApCcArCeApCcApCcApCeArCcApCeApCcAxAi@xAi@pBcAvA}@vAcAhBeBzAaB|@uA|@uAnAgCpAiCnAgCnAiCnAgCpAiCnAgCp@sAp@sAnAeClAgCnAeChAcChAcCtAoCtAqCtAoCtAoCtAoCrAqCt"
            + "AoCtAoCtAoCtAqCtAoCtAoCrAoCtAqCrAoCtAoCjA_CjAaCjA_ChAcCh@qAh@oBZwA`@}BPqANkDBqCEaBIiBUiDWiDUgDWiDUiDWiDUgDWiDUiDU{CU{CU{CU{CU{CU{CUiDUiDUiDWgDUiDUiDUaDWaD@uC@sC"
            + "T{CX_Cf@oCb@gBz@uBjAcCbAgBhAyAhAyAtA_BrAaBnB}BnB}BlB}BnB}BnB}BhBqBfBsBhBkBhBmBhBkBhBmBfBgBdBgBfBeBdBgBfBgBvB{BtByBvB{BtB{BbBoBpAiBrAiBpAiBh@e@bAsAbAsAbCwBnAy@n@"
            + "[vAL^ZFPHh@m@~@k@p@q@n@s@d@eAf@aAX_Bp@kCdBuAvAuAtA{B|B}B|B{BzB}B|BiBhBiBhBgBjBiBhBiBhBsAtAqAtAqAnAoAlAwAzAwAzAkBvBkBvBmBvBkBvBeBrBgBtBeBrBgBrBeBtBgBrBeB~BmAtBq@"
            + "zAm@bBs@fCe@dCSdBSbBEnAEjBDzBJ|BR|CT~CR|CR~CT|CR~CTzCT|CTzCT|CTxCRxCTxCRxCTxCRxCTxCRxCTxCTxCTxCRxCTxCJ|AH|AD~AD~AEnBElB_@nDW|AY|Ae@tAc@tAo@rAo@rAoAbCqAbCoAlCqAl"
            + "CoAlCqAlCw@zAw@xA{@hB}@hB{@hBgAtBeAvBgAtBsAxCqAfCqAfCqAfCcAvBeAtBcAvBeAtBoAdCoAdCoAdCqAbCoAdCoAdCuApCuApCuApCoAfCqAhCoAfCqAfC{@pA{@pAqBzByBnB{BxAoB~@wBv@uBv@wBv"
            + "@uBv@uBv@}ChA}ChA}ChA}ChA}ChA}ChA}ChAaDjAaDlAcDjAaDlAaDjA{C~@wA\\wA\\qCx@qCv@wAp@wAn@wAr@kBnAmBlAkBnAsAn@uAl@{Bz@{B|@{Bz@iAf@oAlAmAlA_@l@k@vAHp@p@nAr@pAJNh@bA^lAB"
            + "`@uB@_CbA";

    private NairobiCityMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - City Hall / KICC");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Uhuru Park");
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
