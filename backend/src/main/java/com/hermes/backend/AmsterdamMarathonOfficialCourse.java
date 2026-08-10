package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic Amsterdam Marathon route traced from the organizer's current
 * course map and checked landmark corridor. The encoded geometry is a one-time
 * OSRM street trace through those organizer landmarks, not a runtime network
 * dependency.
 */
final class AmsterdamMarathonOfficialCourse {
    static final String RACE_ID = "amsterdam-marathon";
    static final String OFFICIAL_SOURCE = "verified-official-map:amsterdam-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.tcsamsterdammarathon.nl/parcours-highlights";
    static final String OFFICIAL_COURSE_IMAGE_URL =
            "https://do.occdn.net/p/75/f/tcs-amsterdam-marathon-2025-web-met-logo.jpg";

    private static final String ENCODED_ROUTE =
            "yjn~Hqhs\\u@wFGaAEo@w@{DqBGY@C[M}@c@_BO_AYBUDoAeAgCgDj@aDeGuGiAzDqC`JqCrI[X[FQLGJIr@Sb@}A|@oDhASH" +
            "URcEpAuHlBiBLe@Su@eAmAq@oALk@y@u@{BO}DU}FrAaAp@qBXmCKaCi@yKQiI]aEyAuHyB_GEaF_BiGq@eHoB}FH{AiCsOM" +
            "u@VqK~CwBkAeJc@iHK}@k@eAy@cBFHPc@d@cAz@_AX}A`@sAlFRpJI|EW^X|DNpAf@pCP^RjAN~HBf@f@f@nB|AtCbBfE|@]" +
            "jCcCjCjFzEhGr@Dn@XdBvD|@bBnAxDpAFj@RdAQ|AT`Az@fC~BVdDnFMfD^fGb@tCMtB_@`@p@Pz@BlR@`JMlO?|@LbAt@Kb" +
            "Av@vAl@PxB~@dCJtD^@\\tAG~AB`QDt@OrFE~CBpJ]`A\\aACqJD_DNsFEu@CaQF_BBaM?sD?aACqCJsS@{[EuGQk@GkEh@cOf" +
            "@{IFgKJ_ICaI?}Dl@_KZg@fA_Ae@iB]dDY^s@hEwGpDcHwKuAh@qF_@gHEClAC`A@hBa@KQ{@cDl@bDm@Pz@`@JAiBBaABmA" +
            "_@c@G{E@aD?kIZ_DNAHIDuAF_DFyDJmFHgD@cB\\uRFOLCbDR|A[XS\\a@|AiBp@_@pAD|APRGrDdArHxHjAvICpPr@bDxEdGx" +
            "GmBrEg@tIrHbDjBtFlBzHtDtAf@bCCdDyArAaAbDaGlAmJLyIZaEZyEhF{Q~@sHzBeH`Aa@pBvAzCzLrBtDbCXzGiCnDZhD|" +
            "AtBn@dISjFsCjIeIvET`ExEvEfHxLhT~BxFe@zHwGlOeHyDfGtF|@qBnJoSzBbDjCf@tBFvAw@lB{BPIJKp@y@jCuDK_FLqF" +
            "fAwHH_@oArIq@dCcCrC{@dAgAf@_@H_@Ri@\\W~AeAzB_DoCoBgC}D{H{CqF{E{I_FaHeBwCkFmE_HlCkBs@xAw_@eAcGsEkL" +
            "w@l@mDiJaDsI_FgMq^r_@wQlMwOfHk@vL}@eCm@qRb@cOgBsCgAiAyAeD{EbEfBtHArBgDvE_BaGqAwDkO~MwBj@eDzCkBz@" +
            "uMv@lC{@bCeKjHaEn@e@_AiF`@WaAgJqAeKk@sGzEkE|DgD`HiGjEoFcCyJo@mDMg@?SQLc@FYIdAa@Wy@Uk@i@uB{A}Do@c" +
            "Cs@yC@uA@mBgCg@Ei@GQ]I}@y@Ow@_AsBKaDGc@?QAaFeAyEsAi@uCiBuBaCiCc@s@BoCEk@DQGQqBk@{HcB|CgAjCMOCO]e" +
            "@OGULiAp@uBQeFeBUQo@a@m@LmBQwKqB_C}AeBgDMSOOuHzMcFfJk@|@s@pAKNMLaAcBKRKDK@oAeCeClFyArC{B|ByBPoDi" +
            "Ck@DiCaAqB~AoA~BuIz@cBaD{DdLw@jBmAr@eFfGsFnHe@N_DrCQSW?[PHfAgE~AuBd@uFReJwAEsAEy@GyDYgAE]EpABd@D" +
            "zEFfBJtOL~K@bBw@lA{B|ExAxEHhAJ|A^xHcDbMgBpD[fAmBxHkAzEm@bCFpB~@lBrAv@pGdGj@@f@w@z@gDf@Kh@a@l@eA|" +
            "D}B~AhAHZn@BpAv@vCh@VIv@`DpDpYZ`B`C}@|CzCgAyD~BxGt@jFf@jHOp@jAvKy@bAiDbCHxCd@fFDh@BNIbATpEc@~X@j" +
            "AHzC[~A_@dACr@C|@_@lE{FxO^ZlA|BVh@~CxEx@bBj@dAJ|@b@hHjAdJ_DvBWpKLt@hCrOIzAnB|Fp@dH~AhGD`FxB~FxAt" +
            "H\\`EPhIh@xKJ`CYlCq@pBsA`AT|FN|Dt@zBj@x@nAMlAp@t@dAd@RhBML`@bEcApDi@|Bm@b@QNKnEwAlAOh@j@VGhAi@nCm" +
            "@Ps@zDE~DOdFHR|@d@Of@Xd@t@hBYh@`@Dj@v@dG@P";

    private AmsterdamMarathonOfficialCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> points = decodePolyline(ENCODED_ROUTE);
        setLabel(points, 0, "Start - Olympic Stadium");
        setNearestLabel(points, 52.2968417, 4.9042702, "Ouderkerk turnaround");
        setNearestLabel(points, 52.3485072, 4.9410783, "Science Park east return");
        setNearestLabel(points, 52.3598431, 4.8850395, "Rijksmuseum return");
        setNearestLabel(points, 52.3560000, 4.8570000, "Vondelpark return");
        setLabel(points, points.size() - 1, "Finish - Olympic Stadium");
        return List.copyOf(points);
    }

    static int routePointCount() {
        return decodePolyline(ENCODED_ROUTE).size();
    }

    private static List<RoutePoint> decodePolyline(String encodedPolyline) {
        List<RoutePoint> points = new ArrayList<>();
        int index = 0;
        int latitude = 0;
        int longitude = 0;
        while (index < encodedPolyline.length()) {
            int[] latitudeResult = decodeNextValue(encodedPolyline, index);
            index = latitudeResult[1];
            int[] longitudeResult = decodeNextValue(encodedPolyline, index);
            index = longitudeResult[1];
            latitude += latitudeResult[0];
            longitude += longitudeResult[0];
            points.add(new RoutePoint(latitude / 100000.0, longitude / 100000.0, null));
        }
        return points;
    }

    private static int[] decodeNextValue(String encodedPolyline, int index) {
        int result = 0;
        int shift = 0;
        int currentIndex = index;
        int value;
        do {
            value = encodedPolyline.charAt(currentIndex++) - 63;
            result |= (value & 0x1f) << shift;
            shift += 5;
        } while (value >= 0x20);
        int decoded = (result & 1) != 0 ? ~(result >> 1) : result >> 1;
        return new int[]{decoded, currentIndex};
    }

    private static void setNearestLabel(
            List<RoutePoint> points,
            double latitude,
            double longitude,
            String label) {
        if (points.isEmpty()) {
            return;
        }
        int nearestIndex = 0;
        double nearestDistance = Double.MAX_VALUE;
        for (int index = 0; index < points.size(); index++) {
            RoutePoint point = points.get(index);
            double latitudeDelta = point.lat() - latitude;
            double longitudeDelta = point.lng() - longitude;
            double squaredDistance = latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
            if (squaredDistance < nearestDistance) {
                nearestDistance = squaredDistance;
                nearestIndex = index;
            }
        }
        setLabel(points, nearestIndex, label);
    }

    private static void setLabel(List<RoutePoint> points, int index, String label) {
        if (points.isEmpty()) {
            return;
        }
        int safeIndex = Math.max(0, Math.min(index, points.size() - 1));
        RoutePoint point = points.get(safeIndex);
        points.set(safeIndex, new RoutePoint(point.lat(), point.lng(), label));
    }
}
