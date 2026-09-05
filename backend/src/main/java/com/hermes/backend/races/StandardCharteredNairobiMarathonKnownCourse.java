package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class StandardCharteredNairobiMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Standard Chartered Nairobi Marathon 2026 runner's guide map from nairobimarathon.com, traced on OpenStreetMap Southern Bypass road geometry";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 12;

    private static final String ENCODED_ROUTE =
            "bebGa}r_FXt@Zr@Vn@Vr@Nb@Rf@N^p@dBTf@Xt@JVLXHTd@h@THREPKzAqAvBeCv@u@FCD?tBgCz@eAn@eAr@mATi@HSj@sAPi@XgATcAVsAJu@JsADcA@WD_A@qA@sB@gAXk_@Am@CqBEiAE{@AQKoAQqBkAwKW"
            + "cCMwAC]?UCcA?u@?Y@UDq@Fw@LaALu@He@PcAPcANaARwAJqADmBAiCEw@IaA]}B_@_BUy@Uq@c@eA_@q@k@kA{AqCg@aAc@cAs@kBSw@UeASeAY}B_Fce@kAqKYkC}@mEu@sDm@}AOa@Im@AYHc@BQhA{ALWBa@"
            + "Cu@qAiEm@cEMgBC_AA}BBiBL}Ad@uD|@gDlA_DjAuBv@aBx@wAlCuE|AmC~AwCxBwD|BcEtFmJlE_ItDqGpBkDhBaDxCoFhBgDzAqCxC}EyC|E{ApCiBfDyCnFiB`DqBjDuDpGmE~HuFlJ}BbEyBvD_BvC}AlCmC"
            + "tEy@vAw@`BkAtBmA~C}@fDe@tDM|AChB@|BB~@LfBl@bEpAhEBt@C`@MViAzACPIb@@XHl@N`@l@|At@rD|@lEXjCjApK~Ebe@X|BRdATdARv@r@jBb@bAf@`AzApCj@jA^p@b@dATp@Tx@^~A\\|BH`ADv@@hCEl"
            + "BKpASvAO`AQbAQbAId@Mt@M`AGv@Ep@AT?X?t@BbA?TB\\LvAVbCjAvKPpBJnA@PDz@DhABpB@l@Yj_@AfAArBApAE~@AVEbAKrAKt@WrAUbAYfAQh@k@rAIRUh@s@lAo@dA{@dAuBfCE?GBw@t@wBdC{ApAQJSDU"
            + "Ie@i@IUMYKWYu@Ug@q@eBO_@Sg@Oc@Ws@Wo@[s@Yu@y@gBUi@K]GOC@C@C?EACAAAIFi@N]LaB\\KBaB`@OBo@N]JyDv@]LMJILEREXt@jFDd@PlBt@pGDXKHEDCDABAD?HPrBNp@Nn@Pf@`@|@x@hBt@xAt@xAb@"
            + "`AR`@v@bBl@fAG`@CFEDKFK@a@?U?O@SDQJKFEFQVWf@UVQLKDQBMAKEGCEGACEK?K@OFSTa@_C~A{BvAmCbBwDbCiG|DgAt@y@p@w@p@g@b@w@`Ag@p@k@~@y@fBWt@]jAg@fCMrAGhBA|@B|@NrBX`CPhANfAp"
            + "@|EVxCDr@D~ABtACn@Bp@A`AAb@GfAEh@I`@G`@OlAc@`B[~Ak@xCMz@Mt@Gp@I~@C|@?x@@fADp@Hr@Jt@N~@Np@`@vA\\~@p@rAl@bAp@|@TX\\^d@d@^`@^\\d@b@b@`@\\^ZX`@d@l@p@V^Zf@l@jANZPd@`@pAV"
            + "fAP~@Fj@Fn@FdABvA@|@@hAAp@@pADzALtARrAJj@Pr@L`@X~@`@|@j@fAb@p@f@t@n@~@j@t@Zb@X`@`@t@d@`A`@`AHXNf@Pn@Nt@L~@PbBb@lFRxBj@zGb@~Et@`Jr@hIb@jFPnBJxADrA@f@?z@G|AGn@Gr@"
            + "Mn@Kj@Qr@Mb@m@jBmLr]o@fBm@tAo@dAy@hAm@t@o@j@}@v@_Av@yBhBeDjCo@h@]Xs@l@q@h@m@d@i@d@i@b@g@`@g@d@c@\\e@`@o@h@WR]Xe@^uAbAUL_@T_@T]Ng@Rq@Ti@Pk@Py@P{Cp@oAXeARo@Ng@L_@L"
            + "SFWHUHKFe@R_@PYPWNYPWRWTa@\\[XWVe@f@{@`AcArAw@nAgArAsAxBSZQZU`@O`@sAdCm@tAa@|@Sd@kArCg@tAYz@Wz@[dAOn@Of@S~@K`@GZS~@SdAOv@O~@Kl@y@rFeAtI}@vHqBnVc@lH[hIOxCCf@Kv@Qb"
            + "APcAJw@Bg@NyCZiIb@mHpBoV|@wHdAuIx@sFJm@N_ANw@ReAR_AF[Ja@R_ANg@No@ZeAV{@X{@f@uAjAsCRe@`@}@l@uArAeCNa@Ta@P[R[rAyBfAsAv@oAbAsAz@aAd@g@VWZY`@]VUVSXQVOXQ^Qd@SJGTIVIR"
            + "G^Mf@Mn@OdASnAYzCq@x@Qj@Qh@Qp@Uf@S\\O^U^UTMtAcAd@_@\\YVSn@i@d@a@b@]f@e@f@a@h@c@h@e@l@e@p@i@r@m@\\Yn@i@dDkCxBiB~@w@|@w@n@k@l@u@x@iAn@eAl@uAn@gBlLs]l@kBLc@Ps@Jk@Lo@F"
            + "s@Fo@F}A?{@Ag@EsAKyAQoBc@kFs@iIu@aJc@_Fk@{GSyBc@mFQcBM_AOu@Qo@Og@IYa@aAe@aAa@u@Ya@[c@k@u@o@_Ag@u@c@q@k@gAa@}@Y_AMa@Qs@Kk@SsAMuAE{AAqA@q@AiAA}@CwAGeAGo@Gk@Q_AWgA"
            + "a@qAQe@O[m@kA[g@W_@m@q@a@e@[Y]_@c@a@e@c@_@]_@a@e@e@]_@UYq@}@m@cAq@sA]_Aa@wAOq@O_AKu@Is@Eq@AgA?y@B}@H_AFq@Lu@L{@j@yCZ_Bb@aBNmAFa@Ha@Di@FgA@c@@aACq@Bo@CuAE_BEs@Wy"
            + "Cq@}EOgAQiAYaCOsBC}@@}@FiBLsAf@gC\\kAVu@x@gBj@_Af@q@v@aAf@c@v@q@x@q@fAu@hG}DvDcClCcBzBwA~B_BU`@GRAN?JDJ@BDFFBJDL@PCJEPMTWVg@PWDGJGPKRENAT?`@?JAJGDEBGFa@m@gAw@cBS"
            + "a@c@aAu@yAu@yAy@iBa@}@Qg@Oo@Oq@QsB?I@E@CBEDEJIEY";

    private StandardCharteredNairobiMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Southern Bypass / CALE entrance");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Uhuru Gardens");
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
