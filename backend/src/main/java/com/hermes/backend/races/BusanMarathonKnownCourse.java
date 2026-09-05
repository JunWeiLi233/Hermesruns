package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class BusanMarathonKnownCourse {
    static final String SOURCE_NOTE = "106th National Sports Festival official Busan marathon course map PDF";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 8;

    private static final String ENCODED_ROUTE =
            "_axuEe}urWVBTBMMES?W_@\\q@PkCd@]mC[mC_@{Ca@eDc@eDhB_@PGpCo@PEYyBWyBUyBVGYIUE}AZi@L_B\\}A\\{AXyA" +
            "Z_BZ]Vo@NeB^UDu@Ru@RcCj@E@cB`@KBiBb@KBOBgATm@La@FwATi@]kAs@kAs@mAw@oAw@kAs@kAq@wA}@_Ak@oAu@o" +
            "Au@o@_@}AaAEACC}@i@k@]e@YsAm@f@kBl@_B~@sCn@qBx@qC|@sCh@gBj@eBz@iCj@_BNc@DMJa@FQJ[Nk@Nc@Lg@DM" +
            "DK@E\\cANg@FOJ[l@iBdAgDRc@x@mBx@mBHOFMLUL_@DUF]Da@J}@BQNmABYZkCHy@TmBZwC\\wCL{@Lk@H[VeA\\uAl@eC" +
            "l@cCPq@T_Al@mCv@yCn@{Cl@gDl@gDb@eCd@gCToAH_@n@{CF_@D_@F_ADo@HcA?ADs@BOBi@Be@LwAJmA@{@LwAJgAJ" +
            "k@Hc@h@sBT{@HWNe@HWl@gBTo@N_@HY`@aBH_@Fs@HkABYHk@T_EHuAHy@`@wD\\wDQCPBLh@BXCj@DLp@DlASP`@FAZG" +
            "pBe@pBc@pBe@d@SvBo@xBo@xBm@xBo@NGlAa@jAa@`Bi@`Bi@tAc@rAc@xBq@zBs@^M|Ac@dCg@lCm@~@SfCu@fCu@rA" +
            "c@tAc@bCcA|@i@zAiAXUjA}@hA}@hBuAjBsAhBsArB_BrB_BrB_BtB}ArB_BrB_BjByAp@g@JInAs@nAs@nB_BXUBS?S" +
            "EYKa@~@u@j@g@Xe@pAwBh@o@P]HWH[BYH_@B]Bc@?UA_@KaA[eB]eBEQIuACkAFmAPaBj@qBd@aAz@oARWSWoAgBoAgB" +
            "KMy@iAw@iAOUg@j@}AhAyAz@wA|@gAp@eAr@WPw@\\[RGB_@^KHQT]d@c@f@_A~AMXKLk@p@wA|Ag@b@g@l@QVSZCTPLN" +
            "[R]Xa@|@gA~@gAx@aAJMRU\\e@Xc@f@o@v@aAf@i@n@]|@m@dAq@dAq@hB_AfAq@`As@d@_@d@i@`AeBX[Vk@p@_BVy@l" +
            "AqCrAcDRYbA_CJUJ[BI\\kAHUTw@j@}Ar@eBR{@Bw@?GAa@AWAKGa@G]Q{@Pz@F\\F`@@J@V@`@?FCv@Sz@s@dBk@|AsAn" +
            "C@H@DBBH?BI\\kAHUTw@sAnCSRMViAhCGXsA`DMVm@vAm@vAGN[v@ABa@|@e@bAm@~@g@j@}AhAyAz@wA|@gAp@eAr@WP" +
            "w@\\[RGB_@^KHQT]d@c@f@_A~AMXKLk@p@wA|Ag@b@g@l@QVSZCTPLN[R]Xa@|@gA~@gAx@aAJMRU\\e@Xc@f@o@v@aAf@" +
            "i@n@]|@m@dAq@dAq@hB_AfAq@`As@d@_@d@i@v@hAx@hAJLnAfBnAfBRVX]xAiBzAgBNSdBqBn@OJADA~A]hB_@n@M?@" +
            "@B@@B@B?BARR\\h@b@n@|@nAz@lANPPNLBPBT@VEXGhAa@^S`@WT[V_@Rg@Nk@Oj@Sf@W^UZa@V_@RiA`@YFWDUAQCMCQ" +
            "OOQ{@mA}@oAc@o@]i@SS@C@C?EACCACAC?C@AB?B?Bo@LiB^_B\\E@K@o@NeBpBOR{AfByAhBY\\SV{@nAe@`Ak@pBQ`BG" +
            "lABjAHtADP\\dBZdBj@`CRl@x@bCv@dCx@dCx@dCj@fBh@dBRp@Tz@\\bBFVt@nDt@jDZ~A\\|AHlBJnBNpDHdBHdBdAr@|" +
            "AhAZRdAv@fAt@p@d@`@Xf@^vBzATNVPlAz@v@h@hAv@fAv@hBnAFDlAx@jAz@t@f@`@XbAp@JHpBvAlBpANLHMb@y@BG" +
            "h@aARa@^Fh@Lv@PjA?hA]fAYHCpAYpAYjACpB@pB?J?rCDrCB|B@zBBH?TJLJfBlBdBlBd@d@hBpBPPh@l@d@f@t@v@`" +
            "A`APi@?i@Eo@?OCMGs@KyAIyAO_COoBOoBO_COuBGy@Gi@E_@Ga@ESCSESEQEOEMEOM[So@Qg@O_@Ue@U]S]Y_@Y]]_@" +
            "m@o@wBoBkAgAs@q@YWu@s@eBaBmBiBmBkBgBaBeBcBeBcBgBcBeBaBgBeBgBcBgBcBiBeBgBcBsAoAqAmAqBiBqBkByB" +
            "sBwBuBaA}@aA}@mAaA]O{@_@k@Qa@MgAO_BCsAH}A\\yAj@qBnAsA`AgBvAaB`AaAl@y@`@u@T_@Hs@Rm@Lg@Fg@Ba@Ae" +
            "@Ga@Me@S_@]_@g@]k@m@wA{@uBu@gBMy@Sm@g@sAUa@Y]c@[i@W}B}@y@[MEg@O_@IQAI@CFAF@HDJRPv@T~@XXEpBt@" +
            "p@`@v@z@p@nAbAjCDJx@pBfAtCpAdDt@jBFNh@o@P]HWH[BY\\o@DCFCFBNHx@bCv@dCx@dCx@dCj@fBh@dBRp@Tz@\\bB" +
            "nAc@v@YhBo@TI~@f@rAr@pAt@CrB@r@?FNl@lAhCp@rAPf@Hh@NhA@JBPNbABNR`BBNv@`Dd@hBf@hBDLXbA^z@LXz@x" +
            "Ax@xAFHhBtAlAx@lAx@lAz@lAz@jAx@jAx@TNbCdBxA`@h@NS`@i@`ACFc@x@ILKPGNa@r@s@rAc@x@Q\\_AhBGJaCe@]" +
            "GKCw@Oy@Qk@MKAm@MgASa@Ic@Iw@OiBa@IAgAUiBYo@IMCWC}@MwAQoAQKAQC}@MP}BxAR`BVa@vBALRBbCZTDz@Jv@L" +
            "r@LfARFBpAVpAX|@NbARx@NTFlB`@b@Hh@H`Cf@nCb@l@HzBd@~@PjBZtAVvAVrB`@hCd@pATLBXDr@LZFLDHDHH^\\tB" +
            "vB~@~@r@r@fAjAVVPRRPj@n@LNLNPZZr@\\v@l@|Av@rBbAfC^fAd@nAXr@\\z@Xt@L\\Zz@r@lBb@hAh@tA`@jAv@zBv@x" +
            "BHXFVF^RrA@NLnADZDZNtAL`ABXBZBdADnADdCHrD@h@@fABhADpA@nADdB@~@DlBB^HvDBhADdBBdBBnB@t@?r@AV@T" +
            "?VBd@@RBRDXH\\Lh@FTJZXr@\\bANj@JZDPBND^B\\?X?R?PCTCXERI\\K^ITMXu@jBm@vAm@xAu@dBk@rAWj@Yp@aAzBO^W" +
            "p@QXQb@Oz@QhBCbAChD?zAIxB@b@@d@TOPIAq@?aABqCDsBBuBLaBDk@BQFe@`@sAnAuC|BxAq@bBs@bBM|@KnARjAAl" +
            "AAvAAfA?n@?JAlAA`@?n@?JAb@oBs@m@M}@Cg@@cBb@cBd@mBVcAX_AX_ARc@Jy@DmC?kC@qA@oA?_B?}AAmACcB?mA?" +
            "wBBa@DWDw@Rk@VYNQJqA~@s@f@STa@j@Yf@QZIRg@vAWzAMpB]pAwB@yB?{A?_B@M?S?cC?O?Q?]?{A@W?}B@a@?mA?e" +
            "@?qA@I??`@?r@BhD?N?|BYVOJc@HwB_BeCgBc@[cCiBq@g@e@]_@[QS[SoAy@{@o@OKeBqAo@c@IEOKKI[Ue@Ua@Ky@U" +
            "g@Wa@YkBuAcAs@eAs@wAcAwAeAa@Ua@Oy@mAmA{Ae@c@oAaA_As@aBmAy@m@sB}A{BcBg@g@m@g@cAu@qBaB{B}A}AeA" +
            "AAgCkBoAaAg@_@CAQMcAu@CAq@e@{@q@g@c@}@q@[UQOsA_Am@e@o@c@{@o@qAcAWSkA_AGGMIOKECcBmAgCiBeAw@iB" +
            "qAeAu@q@i@e@]G\\ETAFU`Ac@xAk@xBeApDe@jBg@hBg@fDg@bDO~@CDW~@Ut@IXo@lBADw@lBi@rAOb@Wl@{@|B{@zBi" +
            "@xAYjAKt@?dAD|@@^TGVGYIUE@^ZhCPxA\\fCFb@T|AZpA`AfCPx@Nn@BPBZ@R@T?n@Er@Mp@Qj@Sd@_@\\q@PT?X@F?";

    private BusanMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = decodePolyline(ENCODED_ROUTE);
        setLabel(routePoints, 0, "Start - Busan Asiad Main Stadium");
        setLabel(routePoints, routePoints.size() * 18 / 100, "Minam / Wondong IC");
        setLabel(routePoints, routePoints.size() * 39 / 100, "Haeundae Olympic / Dongbaek");
        setLabel(routePoints, routePoints.size() * 55 / 100, "Gwangandaegyo Bridge");
        setLabel(routePoints, routePoints.size() * 72 / 100, "Gwangan / Jigegol");
        setLabel(routePoints, routePoints.size() * 86 / 100, "Seomyeon / Yeonsan");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Busan Asiad Main Stadium");
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
