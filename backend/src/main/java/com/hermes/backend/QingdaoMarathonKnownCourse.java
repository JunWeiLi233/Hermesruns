package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class QingdaoMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official 2026 Qingdao Marathon road-sequence notice and official route-map video snapshot, with ordered road geometry reconstructed on OpenStreetMap streets";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 80;

    private static final String ENCODED_ROUTE =
            "m_c{Eyev}Ud@tA`BvEZ`AHl@Xr@x@jBt@bBpApCbCxF~@vBRf@pA`DLVRb@V\\fE~ENRv@bAj@z@~EtGFJh@r@\\l@lChF~A~CNXJR~AxCxFnKFNx@vCrBhHBt"
            + "CD~F@|BDn@`@|A@Bl@xBh@fBH\\Ph@r@dCLf@PzACxCUt@[h@YVuAh@QH{Af@YNMNk@l@e@|@_@vA]t@Wl@c@p@QTgBjBORa@n@KNeBbC_Ar@s@l@kDzBSLqC"
            + "z@_@TcBhBe@t@Yx@G^Kf@?|@D~B@RbAzGF^Hd@ZnB`@jCLr@`A|Fp@|E?@Lr@Lx@GBHf@PhADPt@rEJz@LfABv@NtDDT\\r@N\\LX`@|@HXDTD^@b@ATAFQjAY"
            + "x@Yl@EJc@^o@XkAVqAh@a@\\Of@@v@JtA?PIJOPUJOHKFWJSZQb@gAtCIf@@vAC\\IVURy@f@oAp@SLcCnA_DpCn@vCJpACbBAZKpA_@lDCN|Ct@LBM`Aa@pDi"
            + "@rECPCXCLEb@aA|IMhAEXSpBWxBMnASdBMdA?VFxF@vD@j@?D?|A?^?V@|ABJJPJP`@\\JVbCxLBj@Jx@Bd@?JIXUn@iMAhM@z@@Td@NADVP`B^xDdAVfCn@b"
            + "@`B^hBfAnAr@b@d@L^Jf@NRJSKg@O_@KyC|AaC|@QFUBQBYBM@MK{C_C{AzBbFxGp@fABFpAy@r@c@LGTOxBsAZlA|Bh@tCfAtBx@dC|@zCtAGbBFcBp@_GD"
            + "q@@uAAu@Go@EYIk@YmAUq@CI[o@]m@EG[g@GGMSlDiD|AwAL@HM@UrBr@NHVJf@C`@C^Od@e@e@d@_@Na@Bg@BWKOIsBs@KGo@Wm@[yA}As@iBa@wAQ{@Gk@"
            + "AQESS]QSGE[Ia@?]?m@Cq@Mg@Mu@YoAq@cBy@sAWQAO@gAPoAPO@IBQ@_@k@Mc@g@yBQiAYsACOOFmBj@{AZMAFaBD]RyA@KLi@@K@KB[@K`@{Eh@yFDe@Xa"
            + "Fd@gEBW~@}ITqBBWBQ@E|A_MH}@r@aH@KR_@JON[~@{AtB}CLSEEUW_GsGS]x@g@TSHWB]AwAHg@fAuCPc@R[VKJGNITKNQHK?QKuAAw@Ng@`@]pAi@jAWn@"
            + "Yb@_@DKXm@Xy@PkA@G@UAc@E_@EUIYa@}@MYFGBGJI[w@Qe@G[CWEeAEoA@k@Fs@T_Av@sCj@oBXcATq@Tk@BG^s@^k@b@k@HIb@a@j@e@vC_CbA{@FEPMp@"
            + "a@f@QbAQl@YdAo@p@m@Z_@To@V_ARUPGLER@nBdAVJZJ\\Fx@FvG^r@FlAL@QP??Ca@uDMw@Qi@OYm@oAMSKSW_@{@yAWo@Ka@CWCSMsCQyCOyD@eATyA^u@v"
            + "AwBJUMWQWgB}BMOyDwEq@sBH}@RSV_@J{@D]N{AJ}@@U@g@KeAKw@@W?_@@SLeAXi@j@m@~@aAv@_BnDyC_FqFzB{D^m@xAkCdBeDc@DkGUwCO_CMSHKFONo"
            + "CvAqD`C{A|@[JmBbAgCtAaDdB`DeBfCuAlBcAZKzA}@pDaCnCwANOxDzDlE~DmE_EyD{DiEgEKK}B}Bu@u@KUkGkNcA{Bq@{AaA}BiBcE|A_AjA{@Rg@Gk@m"
            + "C}FGy@cAmBw@sBe@cCY_CEuA@cAS??MH}AIsA]_Ao@w@WUg@c@s@u@k@g@MKu@s@qBiBk@o@}@kBe@qACQBQF]BQTq@Jk@Ee@Qm@CIEeAFKZq@JkAQ_A]a@i"
            + "@[]MUSWiAAkDBU\\yCh@{BDKVw@n@qAH[E[W[zA{BsCgDyCqDHMnG{JPWR[jDmFPY^m@jFmINUNShB{ChA_BxFtGX\\pB|BHMhAgBzA_C@QBwBJsABQTmBUlBC"
            + "PKrACvBAP{A~BiAfBILb@pCTp@tBjCZXVFf@@HHbAlAeBpCu@fBQjBPkBt@gBdBqCXe@bDbBcDcBYd@cAmAIIg@AWG[YuBkCUq@c@qCqB}BY]yFuGn@}@`Bi"
            + "BVg@Li@DSxAoEt@_Cr@wB|@oCx@cCyAe@Pu@QEc@?YEQU[m@a@_@a@YWIGEKGO[E]CUWWSS[c@W]UZGDMFKsAOeAYeBQuAQkAGYI]K]MWYk@c@k@qAcBcAoA"
            + "uAgBQYGGUc@Yw@GQEKCMG]Ee@AKAUAc@@iE@wF?[@[?QBi@Dg@Fi@Jo@~@aFH[r@aDv@oD@EBKD]Ho@Dm@Bi@?m@?q@EeAMyBGy@QaCAQE]G}@?GU{DMqBUy"
            + "CIo@Qs@_@kAK[_@q@cAuA{@kAaAmAi@s@eC_DOSIK{C{G_@i@k@i@gBoBkEwEkAqAmG}IgCcDy@uAu@uAcBeDkGuMKW}B_FsAoCqAkC{CiGEg@Ca@AoA\\aAX"
            + "}@Ha@@YAq@Ks@Wm@_@g@s@_@}NqHu@m@YYg@g@i@{@i@gAu@mBcD}H_AcB{@qAW[SYkAgAoByA{AeAwDeCyCwBsByA_BuAOQuEaGmCoDoCoDe@k@wAgByEcG"
            + "KQQOu@i@}@_@u@OKAMAK?[?Z?J?L@J@t@N|@^t@h@PNJPxEbGvAfBd@j@nCnDlCnDtE`GNP~AtArBxAxCvBvDdCzAdAnBxAjAfARXVZz@pA~@bBbD|Ht@lBh"
            + "@fAh@z@f@f@XXt@l@|NpHr@^^f@Vl@Jr@@p@AXI`@Y|@]`A@nAB`@Df@zChGpAjCrAnC|B~EJVjGtMbBdDt@tAx@tAfCbDlG|IjApAjEvEfBnBj@h@^h@zCz"
            + "GHJNRdC~Ch@r@`AlAz@jAbAtA^p@JZ^jAPr@Hn@TxCLpBTzD?FF|@D\\@PP`CFx@LxBDdA?p@?l@Ch@El@In@E\\CJADw@nDs@`DIZ_A`FKn@Gh@Ef@Ch@?PAZ"
            + "?ZAvFAhE@b@@T@JDd@F\\BLDJFPXv@Tb@FFPXtAfBbAnApAbBb@j@Xj@LVJ\\H\\FXPjAPtAXdBNdAJrAFf@B\\?r@?r@CRCPKACj@Gn@M~@ShA[hA[v@{BrEINH"
            + "JFDzJpIMh@Wf@aBhBo@|@xFtGX\\pB|BHMhAgBzA_C{A~BiAfBILb@pCTp@";

    private QingdaoMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Qingdao Municipal Government / Hong Kong Middle Road");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Qingdao International Conference Center");
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
