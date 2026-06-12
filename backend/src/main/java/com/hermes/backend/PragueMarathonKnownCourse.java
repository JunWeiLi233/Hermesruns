package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class PragueMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official RunCzech 2026 Prague Marathon race page, JPG/PDF course map, and linked Mapy.com GPX route geometry";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 140;

    private static final String ENCODED_ROUTE =
            "euupH}p_wAcAr@sA`AgBdAcCnAiJjF?@c@TuLxGYTURGP?N@P`A|F\\hDNlA^lBpAdEx@fBjAlBrBxDDT@VANAH]jAAJ?HBNlD~JLf@DRDTBZ@`E?J@LBLNd@"
            + "JZHJLVLLNHVH`ADfETFDDBFFDHDDFDfCTFABGPyAp@gGNcBBWBYb@mDx@cIn@gKp@eJJeA?i@Ac@?a@EUEOGEqCsAeBm@]IcDm@S?KDGFCH}A|DEVGXmB~NE"
            + "TMDkAaAsLmLQGUD]Na@PM?OEGUGgBGiA[uB[oASaAQaAWuAeAkJ]oDQuBIkA_@}GKaCMoCGo@I]ScAQs@Ge@Eg@Cu@?iBEsBQuBQcBQeBw@kHS_BYmC_@}Bg"
            + "A{Gu@}DaAwGw@qEaA}EaAcGc@oDU}CGqB?sBB_C@sBDeHBaDDgEEyCIeCG}AOoB]cCc@}CUiAMYMSWG]AuCEuACMCIICU@UZiID_B?_@@m@A]@e@Ay@C}@Mg"
            + "AG]EQU_AUo@S]Yc@YYWQWO]OWIi@GeAKu@EwBMSEECCGAEAKBq@A_C?iAAyJEeJEuIAcD?Q?w@?g@@S@MFiA@eADiDBc@JuAJs@TeAPm@`@eADGDEDADAFAD"
            + "@F@RLdAj@|@j@jHfFtD|BfAv@`@X^j@d@hAhEtMxEb\\xC|RzBlPvDtXp@pGBt@A`AK|BQrBc@`HI|C?v@FrCDdFL|EJjE@~@lAn^VdHHrCHdGFnC?`@BtABf"
            + "CF`IBf@DXFd@@b@BxAFtDF|CJhCR~DN|BRlBXhB\\lBf@vBFFLCzCeAv@i@lAo@zBwA|A{@h@YhCqA~@o@bBcARQf@[r@e@JQBW?W?UEw@IgBAkBPaDDyDA{C"
            + "AsACq@?U?[A}AAm@C_ACw@?[DYJgABKDADDFHHRfAxBxBdEhChFfCjEx@pAv@nAbBrCbBpCT`@BDBLVjANt@Jn@D\\H|@d@|DZfBfApGf@fCb@|CFf@Fh@@RD"
            + "`AB`ABdE@rA?R@HDLDDHDF@LANEf@QFC`Ae@^U^S`Ag@j@QvA[`AMz@El@G|AM^CfACJ@PDhDn@l@NVNHRBLF\\RxBVrEv@fMFn@Pf@TRl@J\\JR\\J^L~@Db@D"
            + "\\HFJ?jHoAj@MJIDO?a@UqEc@kJQ_EQsDCq@B_@FWPGb@E\\EfBSh@Ex@MlBYtCYpC[n@KjH{@\\WHY@]CaAKqB[{DQ_CKkAQeBCu@Ek@A_@Ds@Hu@NkALy@@o@"
            + "@]?IDMHILK\\Qv@k@t@i@l@g@dBcCbA}AZi@J[Li@@YAYQo@w@uBw@eCIe@Gm@Cy@EoAKsUHaCP}Aj@iCb@kBh@gBTe@JMD?DDLLNVVb@L`@BlABzA?hB@|AF"
            + "nC?fC?~A@pH@v@?v@?l@Af@@dHAp@UhAQn@Wr@Wl@mA|BoBvCm@|@g@f@m@h@u@d@o@^SLGFEJ?L@b@ARGb@OdAKbAG~@Bt@HdBV~Ch@dF`@dGD`@DNPBNAv"
            + "AInBUrGu@nAUr@St@_@b@SJILGl@KXMREPIPIVSLORYN]L[n@cBJYLSLUNSh@q@n@}@t@u@n@c@r@YXKTIh@Mp@K^GhBQvAEf@?^@Z@h@Dz@JzBXt@L|AVhC"
            + "n@dBf@`A^jBv@dBt@r@`@TJdBx@bAb@vCxAv@\\r@Z|L|FhHzC`Bv@l@ZDJCTMBsG{CkF_CaKqEkCsAoBaAiBy@cCkA{BaAeBq@_Aa@aD}@qDo@oDe@eBKmAC"
            + "iAB{@DsALk@Jy@Ro@To@\\e@X{@j@w@x@k@t@MTOZ_@`Ae@nAMZGJINMNSPSNOHUFYDO@Q@SFSNQN]Rs@ZWLe@Nk@LWDkCZ{BXgCZiBLe@Hk@JiDf@{ANuEf@"
            + "iCXyAPi@H}@NgANaBLo@JGBCBABADAF?FAFBh@HfBd@tLJfBNxDHnBDj@BJDBD?|B[~Dm@nASr@K~@UNCx@KrB]~Cg@t@OjEs@hG}@dDg@xIoAvCc@jC[fBC"
            + "~CJzAH|DLvBJzBRzBTfBTjCZpBP|@@d@CrAChBKd@CrCOTAdAIpACB?BC?CAECAE?}@?M?M?s@Be@FaBF{BLuDN_AA{@IqC[aD_@sBUiBOkBKoBK{AI}BEmB"
            + "E}@?{@DwALuBT}AXwBXwBXkC`@qARY?[Eg@Ui@YYK]I[E]Aw@Dk@DsBJoBJoCN_CFoBFy@CmBEqCIeAA]?y@Pi@HqAXm@RmAd@yAl@u@\\w@ZcAXeDnA{B`Aa"
            + "@Tq@P}AVmAFoCHmFLqDHgCJEAAACCAG?ICw@AkAE_COuLGmCGeBAG?GCCCCMAg@GeDYsCWwCUe@Ks@Ue@ScBu@wAo@oD_B{Aw@iBq@gB_@wAUMAMFOT[v@Yv"
            + "@_@~@Ql@[`BIz@w@|GKv@Gj@KLICCAkAw@{@_AeAcAkEoEwAuA]IYFm@TQF??ICOKQeDUqBi@_Co@eDc@aEk@uEM}AOoBKiAIqAMsBMgCEaAMkCIaBEe@CSO"
            + "u@]qAAMEYC[CWAg@AmA?}@E_BMwAM}AIm@c@eE_@oDWmBQaBQqAMu@W_BYcB_@{Bc@gC[cBWmBe@wCa@aCo@iDe@aCm@qDe@qDGe@YkDEsBAwBHaK@wBDsFB"
            + "iB?c@AoAGuCGeBUaDY{Be@{CWkAIYMQUK_@Ei@AgBAy@Cg@AMEGIAO?W\\uH?ADkB?O@sA?qACiAKeAGg@g@oBo@qAMO_@_@o@]o@UoAMmBMgBMICEEAACE?G"
            + "?e@?uA@oBAaA?iCAuDCuFAwCCeGC{F?u@@]FeABe@@{@DcD@w@Dk@Hs@TiA\\qARm@P[FEJCF?D@\\R`@RnAr@jAz@j@`@b@ZrA`A`Ap@r@b@vA|@tA|@|@n@Z"
            + "d@j@nAhAdDxBxGHXDPT`Bz@`Gd@|CpBjNbB|K~AfL`@lCpAnJr@fF|@pGTzBV~BRdBBv@EpAU~Dc@~FIlBE~A@zBFrG@|@NdGDzABr@@h@D`BH`CLlDNjEFj"
            + "BFdBN|ELbDJfCH|CFfEDjBBvAFvGFdHNhBHjEDvBFlCNbDJjBPxCTrB\\dC`@rBZrADLDFnDmAvBgAt@e@lBkAzAu@hBgArAo@nAw@pBsARM";

    private PragueMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Parizska / Old Town Square");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Old Town Square");
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
