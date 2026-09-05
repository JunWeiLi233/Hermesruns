package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class RomeMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Run Rome The Marathon 2026 marathon page/PDF course map, cross-checked against Go&Race 2026 GPX route geometry";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 120;

    private static final String ENCODED_ROUTE =
            "e`u~FwifkAgT|c@Ql@Ep@VlBLZf@\\^LxEf@r@RxBpB|@fA^Xl@XrAd@h@RvAa@v@UtA_@tA_@vAa@tA_@tAa@TGvAXLBpAn@NHlAz@lAz@lAz@b@ZjA|@t@l"
            + "@`AnAbAnA`AnAbAnA`ApAbAnAr@|@|@f@xAKPCrAk@DCpAu@nAw@nAu@nAu@nAw@nAu@nAu@pAu@z@i@lAy@XS~@qA`AsAf@u@\\{@b@mBDMz@wAT[L}AJi@z"
            + "@wAT_@t@_Bt@aBr@_Bt@aBt@aBr@_Bt@aBt@_Br@aBt@aBt@_Br@aBt@aBN[HUVy@Ry@DSBKNm@Jm@BOBQRmAHw@RsBNgBLeBLgBJWJYFYBSBc@?GHqDD]@I"
            + "HSFKB@fCLN@v@@b@@|@BnADL@p@Bh@A~@Cr@EzAOd@@Dp@Gn@EzAAR?Z@ZDx@@b@@lD?J?r@?f@AfC?RAlC?|@@zC?NAtA?F?N?NAlE?T?pA?V?bE?V@pC?X"
            + "?T?b@?dD?`AAFBT?V?HAp@GvGExBAr@Ad@C`@Il@_@bCEZEl@EfAAL?FwAA{@AyAKwAKyAMw@GyAIyAKyAIyAIk@Ek@TCJ?N?X?jD?J?T?V?J@pE?P@jFF`F"
            + "?P@p@BhCBf@B`@Ft@LhAPlAz@zGD\\HdABL@NDV@NLfARzADZNf@@NBJBNJx@NbABPPjAK`@GTCFGTOAiAEy@?YGMA_BEK@QHKHUAUAMAG?G?_EO?MKCIGaBi"
            + "FwDaMKUGCIAuAd@aAXi@NEMMa@Ok@q@gCw@iC[eADCFExCkBRODG@IAMc@aBmAmEa@wAESMHUNM?WPORKFKDg@\\oAt@oAt@qAv@oAt@IFe@o@}@uA_AuA}@u"
            + "A_AuA}@uA_@m@i@@}@j@MJIJKJKHMFSBOBM@c@?o@MO@}EkGsCyDy@aAeB{A_Aw@s@a@}@a@SGk@Qm@MEASE_@Eg@EMCQAe@G_@?e@@cAHg@FMDq@\\o@Ts@\\"
            + "_BdAa@^OPMLo@v@[d@OVMV]r@Sj@Ql@Ml@Ij@IdAE|@RlQCr@Iz@QpAKf@]bAUd@{CbFmIzLuHzJaCxCs@h@uH|Es@`@iA`@YFa@Be@?UA]IYIcB_AE?IDgH"
            + "bKENCX@pTCvAANEJGH]N{Ah@GCQU?I@WLiCDsAAgBGqAk@gNMG{AQgJeAECAI?Sz@y\\AUUoAsAwGEQ?I?IBKpB}ANUBMDS^uKPaIGIGAyAQgAGo@?e@@a@Dg"
            + "@Fq@Nk@No@Pc@Rm@Xg@ZeBnAw@j@eEpCGFCFAH@JfCjQnCtQjDtTRrAnDlUN`AFv@?d@KhJDFf@l@@NEvAELEJKDQD{K|AG?GEGGE@]_Ca@kCCSe@uCCMCQE"
            + "WAGE[U}AUuACOe@uCSiAs@oEI_@COCSG]Km@c@qCo@cEEUCUu@wEe@wC[sB[qB]qB[sB[qBCMwAZG@yAHyAFi@BPtBPlBPtBZtBXrBVdBZpBJr@TtAXlBFXD"
            + "Xf@hDJp@h@bDBVFXFf@ZnBv@zE\\rB@LFRFNBDLr@f@bDBLBNFd@d@tCd@zCBNF\\NbABL`@hC`@jCBNRpAJh@N~@DZDZBJb@rCBPRpAJp@Hb@DXPhA?J?LADE"
            + "NQh@MXYIo@O}@S]IkBWk@Ii@ISEiAUqA_@MEu@]e@Wo@_@OKKKoAgAe@e@k@o@KMq@u@]c@oAaBOUmA_BkAyAO[Yo@S]Y_@KOgAqA@c@D_@AUEOKYCO?MDCH"
            + "IZg@zAiCJOXk@Ti@Po@R{@BUDUBQDYLwA@K@_@@S?S@I@eB@s@?kB?UAQEsBCo@GaACWEg@]{BKi@]}ACSAUFGHWD[@YAMKc@K_@MWGISMICUCKD_@RGBc@V"
            + "ILEREZ?J@LBRCJCFCDIFoJtEyDdBQBK@MAMEMKIM{@sF_AyFkBcLAK?KFOFMH?LFlC~ANDNARGLMDOfB}MR{AAIi@{@IES?o@Ju@VaAl@i@b@a@d@_@h@Yd@"
            + "a@z@Mf@EPOt@G\\S~AG`@Ed@YhCEf@]pDCPSnBANOdAETId@Kd@Md@K`@CLOb@e@fASb@Q^aBpCyA~Bw@vAKREPEXCTALAf@Aj@?VBvB?j@Ih@e@|Ay@hAkA\\"
            + "yAJy@Fy@CYsBYsBKo@WQ[?a@AiARe@Hg@D]@a@?o@EYCk@Iu@Q}Bk@qA]OIyACu@AyAGk@CoAs@}@i@iAcAe@c@cAmAGGgAfAQRiAdAiAdAgAdAiAfA_@^Q@"
            + "{@{Ay@yAy@{A{@{Ay@{Aa@u@Mm@bAoAbAmAbAoAbAmAh@q@b@a@f@I`ArA~@rADH`AnAbAnAbAnA~@lAbAnAX^|@~@nAp@NHrAj@r@ZvATvAVZLtA^tA^x@T"
            + "tATxAF\\@vAMPCjAUjA_@B_@WsBUsBWuBWsBGk@M?y@P]BQ@e@@]?qAG[C_@EqA[}@UQMSM]QsBaAiAo@UOWO_Am@iAw@iAcAcAeACEUWk@s@q@y@]]IGQMOU"
            + "g@u@}BqDc@{@Sc@Uo@CKGSESCc@G]IYAGCMEOESc@kBCIESQu@KoAK}AEiAGuACw@MeDCe@MmCCs@UoE@e@?_@G_BEkAKmA?i@@[@uAFqALuAZsBTgA`@sAp"
            + "@}ALS\\SZQXKZEb@CZBPDTLXNZTVVNRDP@RD|ADx@`@hFBn@F|H@z@PrFX~Dz@pI~@zHF\\D@HAxNeEdAWD?F@DDx@fBHHP?TGlBk@pSgGF@DHBX?NqAdHyCrP"
            + "iBhJuAd@uAd@uAb@sAd@uAb@mA`@Fl@hAbAhAbAhA`A^ZjAOx@CTz@ZVD@FCJG|@i@\\YDCTSVYh@m@V]\\g@n@mAd@gAJ[f@uAX}@Po@Lg@Jc@He@DUXwAPuA"
            + "n@wGDUZgBJg@DOTq@BGJUNWXk@^q@b@o@Z_@JKFGZ[z@s@x@k@RKrAi@tAg@rAg@rAg@tAg@~@]h@GfAEx@?|@Dt@FzC^x@Hn@@t@AvE]x@IjFsA~Be@fCc@"
            + "r@Mf@O~CcAxBw@x@i@lDiClCkBtA_AVMPERCZ@lA?LANGPSJWFa@Fi@TsFFeA?eBAKEEKCMDuD~@eO|ESLGRGXOh@WN]HQAMKGYKaA?OHMNOnAk@VCHATOd@"
            + "e@lB_C`FkG`CwClFuGvCqDb@i@NM~AoABGVw@Va@dDgE~AqB^c@n@{@NKBAFJLx@lEjXd@rCAHCFIHwDxAkKhDCDpBnHhBzGx@bDl@fChArEnBjHBFF@pAo@"
            + "pAo@pAo@`@SVsBCmAjAg@r@MxADR?vAGxAExAGF?vAUvAUlASBIh@iGd@}CTkBLiA@y@GkHCUq@}Ew@oGEcA@k@DQRU\\Ub@QVKPAVFVN~@dAZT\\Nf@HhD`@h"
            + "ATp@f@fCjCZZ\\Rj@Pn@Rd@LT@VEj@OhDeAxI{Bb@?`@DdA`@F?|@wAT_@d@mBb@mBt@cBr@aBt@_B`@_A";

    private RomeMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Via dei Fori Imperiali");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Circo Massimo");
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
