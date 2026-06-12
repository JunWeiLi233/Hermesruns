package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class HelsinkiMarathonKnownCourse {
    static final String SOURCE_NOTE = "Helsinki Marathon 2026 official event-info page Google My Maps KML marathon route";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 120;

    private static final String ENCODED_ROUTE =
            "c`dnJoohwCxEgTLgFa@kCyA_CcCyEc@yE_AyIoAuB{AG{Dj@oLpIwAdDcAdJmC`GmBvAoBxByJbPiB~@qCVsFl@uDD" +
            "o@[[oSYkGjC_InKci@pD_Nl@}Fm@{HeHiZgEuOuCuCkCnErDlShCrQaHpIcAxG{@zY}@jIr@|SwBx@[sE_H{CqRwHo" +
            "I`BiBbHi@zFoBpCkEf@Iq[QeF}@cKIeGd@wPl@eJMeYZyGxFw[OuMfAyMvAcLNeEDuDO_Ed@{J?_DvFsc@rK}`@zHw" +
            "R~IoS~AoXlPlEnErMlBkJvBoIaHsHwFwOgJkF?uHwBe_@gJyLoCwJyEaMqBwBqCmFaAaGEgD}A}Va@_IB{AYiAu@yQ" +
            "NqHQoC{IcCoJk@uNrDqGhDgJhJyFjLuEtMqExFyMlGyFFeBj@qDxPyI{DuEkFoHcIaFmDyBkE{L_PkBzGkGmK}EoIa" +
            "CmDYgAyJcRsBoGoD{GgAeBgAsACiC}AcEuCwDuEcD_EqAaFZyErDoArA{ChEyB|FyDrPeBnNwBhXw@xNo@pCoAzBs@" +
            "bEcE|]sIzq@kFbc@kC|SmA`KBtCXjE`@jGG|Fe@`EiDnNk@rDMnA{@`@eA|CcEnPsAnHaC~IkKbUaB|I_AvMAvMTn\\" +
            "R`YE|HIvF]fMI~Jd@tIbAfFtEzLjBdH`G`OvE`LxB|E~DbKnCtInCtKnApEpBfB^nBRjBjAhDn@pE`@lBlAnEh@bEj" +
            "@dBL~CzDbN|BlIhApCnC`DnCrGnC|GlJdL`F`ElEjCdJlExDtAnJdD|FzEvEhAfFr@`EPnCq@~GuAdOeF|Em@rCQxA" +
            "e@lEh@tKpBzD@~CqApASx@s@pDw@nE}@zEcBbN_FdFmBbCmH|@qA|Dc@dBZbBeCpB_Ft@aFIkJHcIbA_GnBkFtAH`E" +
            "jS|Bu@rDgUJeExDg@NbFcBd\\yC|KTz@xAdAdDiC~Ce@fBu@jAqAlEhKJbMiCGuDh@mMxBq@p@i@hHT`F`@lEKxEqAh" +
            "GyBhCiGAaJYuFiBsAJIzAxFvSfDiAbRoH`CiBxDaFfIkJfBeCcBoFLgAzC{AxCwAn@|AhDdKbMbi@jD|M`BvDvDrBp" +
            "KbBpHtBtAJpAlDVnNl@~Tp@fi@^hE|@HxCsAfGwFsCkLwC}NcCcAo@g[VaB{A}MsA_HjEcGfBt@v@eCd@sEOqC_DsM" +
            "FoA^YrBCvCgG`BeFbH}EbIiE`FsCpA@j@zEtBrMlLnILq@oJeK}A\\eBoSUoArAiK\\oQh@wCNkGoEyi@cA{FDmBpA_G";

    private HelsinkiMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> points = new ArrayList<>();
        int index = 0;
        int lat = 0;
        int lng = 0;
        while (index < ENCODED_ROUTE.length()) {
            DecodeResult latResult = decodeValue(index);
            lat += latResult.delta();
            DecodeResult lngResult = decodeValue(latResult.nextIndex());
            lng += lngResult.delta();
            index = lngResult.nextIndex();
            points.add(new RoutePoint(lat / 100000.0, lng / 100000.0, null));
        }
        return List.copyOf(points);
    }

    private static DecodeResult decodeValue(int startIndex) {
        int result = 0;
        int shift = 0;
        int index = startIndex;
        int value;
        do {
            value = ENCODED_ROUTE.charAt(index++) - 63;
            result |= (value & 0x1f) << shift;
            shift += 5;
        } while (value >= 0x20);
        int delta = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
        return new DecodeResult(delta, index);
    }

    private record DecodeResult(int delta, int nextIndex) {
    }
}
