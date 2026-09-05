package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class ManchesterMarathonKnownCourse {
    static final String SOURCE_NOTE = "Go&Race 2026 GPX cross-checked against Manchester Marathon official 2026 route map image";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 0;

    private static final String ENCODED_ROUTE =
            "acieIhs|LEc@k@{D_AkGc@eDm@uD_AuF{@oE_@eBgAsEkAaEoAoDo@wAi@gAc@s@gEsGoAaC}@gCa@yAIc@Qs@i@kCWqAEQUmACe@YuAg@eCi@eCe@_Cg@eC"
            + "i@eCi@cCWmA_@{Bi@gCYsA@q@Fu@Zw@Ta@j@HlA`@lAX`ABdA?`AO~@OvAUDAf@YvBQt@Cd@@`BF`AFxBPf@@DTLlAbA|Ib@|D^tCHr@JfAPrBN~@Jv@hAxJ"
            + "|@nId@nELbA^zCbAbJ`@hD^fDDz@Wr@{@qBWo@u@wBu@sBu@wBu@yBu@wBu@wBu@yBu@wBu@yBCGe@c@m@]}@Ws@GwAQm@IyAUwAWWEkASg@DMDOj@C\\F~@t"
            + "AlFl@bBf@hAb@z@d@x@fDfFzAtCPf@j@tA`@nA^pAr@fCbAbEz@`E^rBfAlGbAtGTbBd@tCP^FJHDRAl@u@Tu@Nw@LeAJ{@?k@D_@BiANuBp@iFPkAFSZGR@"
            + "Vh@PzANrCNrCNrCDl@VjBV~@p@|Aj@|Aj@xAx@rBx@pBPb@v@tBr@hBv@vBTp@x@tBv@rBv@tBJVsAp@uAp@sAp@uAn@sAp@uAp@]PKHb@fBZbAtAnDL^DXx"
            + "BpFn@vAL@`ArBL\\@\\xBtF\\v@p@bBd@hAj@bAp@z@fBbBjHjHzDtDt@x@lCfCXVRAfGfFhF~D`@`@p@z@xB~B~NjPbDbEt@`AYtBSjAKRGx@?JEv@Ab@ArD@\\"
            + "Bj@\\|BZpBd@xCF`@FrABnBBrAFp@hBWx@QpAe@rCiAlAYvASt@IvAQr@IvAM^E~@BfANvAZJBtAp@l@XlAfAHFlAjAn@l@jAjAd@b@lAhArAr@l@\\tAh@n@V"
            + "vA^VFvAV\\F`AJp@Kj@Nr@b@pA|@VPnAbAZTnAhA|@v@jApAhApAHHt@j@jAnA`AbAhAtAhAtAhArAbAnAhArAjArADHfAxAX^hAtAFHjApAjAnANPhArAhAr"
            + "AnAtAhApAjApAPRjArAhApAjArAhArAjApAhArAjApAhArAv@z@hArAjArAhApAjArAlAvAhArAjArAhArAhArAj@n@hAtAhArAhAtAhAtAhArAjAtAhArAh"
            + "AtAhAtAhArAhAtAhArAhAtAhAtAjArAhAtAhArAhAtAx@bAhAvAfAxAhAvAfAvAhAvAZ`@hAtAhAtAfArAfAxAfAvAPTlAlAXZDH^kBzAyIlCyOxCmRl@cE|"
            + "@eIZsCLu@hAeGxBaLXcBjAiDDQFa@BS@a@AqDDqCHqCFeABg@b@mEt@wHFk@Lk@Le@`EeMJc@VgAJw@Jc@Vy@d@gAL]No@PaAR{@To@b@gA^e@NONKp@S|A]"
            + "p@M^|ADXB\\FvABvBB`@Fb@Ll@Pl@Tj@Rh@Zl@Zf@lAtAl@r@v@`A^n@vEvIZn@`@fAp@jCJXZl@~C`FhCpENNHBN@PAV@R`GA|@InBk@|IOnCA|@?`B@n@Dx"
            + "AHhBX|DHnABvA?tC?|@Fz@r@bGJ~AN~@BnA@tC?dCAtFBzM@xADlAD~@Rf@FHDDHBVFx@i@tCgBZIZxCJxABTHLFHXRJHDJFN~@xDDPB\\AZM`BMdAELLVDLF"
            + "\\DAJ@r@r@fAzAfAxAdAxAjAnAjApAHHj@{An@qBn@{Ab@_A\\eAq@y@q@gB{@oBEMk@y@_AkBMU^aBd@_Bl@aCDmA@kAAeC@G{FcC{@Yw@Mg@Cu@@g@B{@PaA"
            + "Zg@Vs@`@QFO?KAKEMIk@s@Wg@Ok@_AeFGi@AUAe@B{@Jy@LqAB]Ke@OOWi@MiAAwBSwAYoCWcCQsB?wC?}AG{ASiCQsCCYGuB?eBBmBLsCD{@TsCJoALuC@M"
            + "AgAIuCKsCKmBMuCMsCMsCOuCIkBMsCOuCMsCMuCOsCMsCK_COuCE}@WeBCO_@@_Hq@iAOuAKc@BSBu@RgD|AaAh@m@R}@`@}@aDeAkE[kA{@gDeBgHk@_Cc@"
            + "mBY_BKu@K{@[_EQ_CMy@AMUHQNITMXw@r@gEdD{DhDyHbHiAfAgG|EiGjFoCzBuEhEq@h@iAhAoK`Je@b@yFzEkSjQqAhA]^KFm@l@s@d@Ag@C_@c@cGEcAC"
            + "sB?yDBqJ?mK@iPDwPEeDCiAE{AGqBEy@Ky@WmAUi@oBgFy@_C_B|B]|@ENSfAq@rIc@bIaAL]JwAXqDh@cAT{@JIEeHf\\wApGOGIIGe@s@}HgA{Ls@_IkA_K"
            + "QuA?UDu@N{@h@wDn@mF`@wCTgBz@cIfAkIPeAo@e@yBoBmAgA[g@sAq@yCVo@Bk@NURSVMXM\\Mf@Kj@E\\ATCj@AzCCb@]bCMr@_ArFQr@sA~DI^Kr@QfBGb@"
            + "IZIR_BrDOn@Ov@i@|Co@fE]dCQjAS`CMnBI`AM`BInBClAGlF?h@Bt@VfFA`@[hAQGOWkAoAkAoAoAsAkAoASSeAcAq@q@m@e@{@a@o@[u@UyAW}ASYEiAQs"
            + "@Qo@Su@Ws@W_@Wi@[qA_AoAgAe@a@mAiAQOoA_AGE]UgAo@w@]oA_@_AQw@Ua@Si@_@o@k@s@s@}@oAkAoAIIiAsAe@i@iAuAcAkAiAuAw@aAiAwAo@y@eA}"
            + "Ac@q@Mi@BoAPsC@QRqCRsCRmCJuCDgATqCTqCVqCDk@ReB?qBBwCBuC@wCDwCH}CDiAVqCFw@r@{Bt@wBh@}Ax@uBl@_Br@}BBIj@aCf@aC^kC?yBQsCG}CA"
            + "k@?wC?uC?wCC{CCuCAsB@wC@uCBuCByB@wC@aBa@RoA|@qA|@MHuAn@q@Z{Ad@s@C]Yu@_AuAeAyBq@{Bw@e@SoAi@][oBeBUWe@s@_CwEg@iA_BuB{@iASU"
            + "w@_AHYDe@Ay@KkCGu@AIaAkBm]gp@uEcJiIwOWk@Ke@e@@uKSeIQc@?s@?_BAiL[Q{ASgBkEw`@yDa]sBuQ}@iIHKz@u@PKHCRCVAJChB{A^Ub@WRITK`AYz"
            + "@QrGYd@EPE^UVWTa@Zk@\\k@l@g@DSGGGK[qBgB_MK[NMxBiAXQd@[`@QvGRzFNh@@EaC?eCHyJCgHAW_@iCe@qDc@_Dm@b@g@d@kCrBwAz@yAvAOP_@n@a@j"
            + "@cAlAkApAuCnDcAfAiBlBkAjAWT}@p@";

    private ManchesterMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = decodePolyline(ENCODED_ROUTE);
        setLabel(routePoints, 0, "Start - Old Trafford");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Oxford Road");
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
