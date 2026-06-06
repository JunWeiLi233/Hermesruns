package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class MilanMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Wizz Air Milano Marathon 2026 route image from milanomarathon.it, cross-checked against the Go&Race 2026 GPX track";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 0;

    private static final String ENCODED_ROUTE =
            "kuqtG{o}v@wExGGFKNCBEHEDCFMPQT_CdDeAzAwApBEHMNMRORILGHgCvDOV}CjEILMPOTCDEDk@z@gBhCwCfECDCBORQTEFGFcEdGoAfBCDEFEAOMCKCW@wA@w@?gA@k@DcFDiGBQDM"
            + "JCHGDKBI@w@@g@?e@AMCKEMGIGCEMCKAKB_D@M?OB_DDoF@aA?GBQDIHODQF[@Q?eACQS_ACWDkH@]?a@?O@y@?I@u@?q@@w@BoBHgG@OD_@DSBW@S?MAMG[CW?WDsDDu@F_@HYHSL[N"
            + "UFGn@g@DC|B{AxGqEXOVKDA`@MTIDCPKGw@CSEYIOCQAU?K@MJiADw@@y@Cu@Cg@I_AG_@AIKq@CKHGJIb@Yt@g@r@e@l@a@b@Mb@[FELIBCb@[HQBCHENIJIPMPKnA{@nAy@TOz"
            + "@gA?qAR{BT{BR}BBSR}BT{BFq@R}BH_AP}BP}BF_AJ_C@MP{BR}BR{BB]N}BBi@@O@WNuCPs@Pg@BGBIBGL]BGDMdAwCj@aBLWNc@FSDMDML[DOBGFQBI@EDMLWDIN]l@_BLa@DMLYHM"
            + "R]l@iAXw@Zu@dAmCdA{CN_@BI@ELYdDsJnB}FBEN[\\m@DIXKhAfAv@t@fAjAFQiAgAiAiAq@q@Ck@HQJQNYDIFCFCr@@dA@bA@fABf@?vAAL?h@ArCKN?TEPCzDSPAtEWn@G`@ED?VCN"
            + "ARATAF?ZAp@?dBGVA~BOTCLA`BMlDYJArAI~AOJCDCRQJEJChAKl@GNAF?VCD?VEf@IXGl@OpAGNJHB^Hl@FVF|@^PFJFLFNH~ArAxAjAjA~@fAt@JFTLrAn@PJFB\\PbMhGVLb@Tb@Tl"
            + "B|@PFl@Nf@LdCd@ZHHDJHDDPVFFPVf@l@FHJ\\H\\B^@^KbCC^?NGtBGjB?f@@hC?JFrE?N?J@`@?p@@rJ?T?fG@V?~H?N?`@@t@?^?bA?V?l@Af@QlDAJKbCALa@bEEZCVI`CGrBCr@AR"
            + "ErAAZC^GzBAPMpDMjDCj@CRKp@CXMnAMjACPAVAd@AjA@d@F|B?V?R?J@JFxADvAFNALALCJEJGHsAjB_C|C[d@yB~C}A~Bi@\\w@lAMRQVsA|BGJYj@m@pA{@`B_AfBGNaAhBc@v@s@t"
            + "AIPQXINe@x@gBdDGLMTWd@cAfB{AlCGNKPaBzDaBvDKVIRORGFIDG@Q@}Bg@WKIGy@w@{A]KC{@SsFmAQEeBa@_B]UGMCSESEqBe@e@Ks@OMCW_@OQEEEC_AaBs@wAOVv@bBXj@Fd@@H"
            + "?F@JBJDJFLZb@@PATEj@Eb@AJCVAFANIt@IV]x@]b@CDAFCn@APIxB?JWtHEnACb@A^EfAAT?FE~AARKnAGlCBZKdBOl@IVGVKh@wAvBcAtAo@z@CTG\\TvAxABxABP@xABv@BAXyACyA"
            + "EwAC[AiASg@UUU[EWDMNG\\Cd@AFAJAFIPCFSVU\\]d@mBnCGJEFIJKNIJMNQZgB`CGJEHuApB[XGFEJMXc@n@W^KL[d@CDEFMVMUEEO[EMAO?]DUJWr@o@NYDKDO@GDUB_@@wADiE?YFi"
            + "F?UBwC?YFyF?Q?QDoD?_ABk@?WAWCQG_@Wg@KMGISMYMQAUAQ@Y@KFu@?_BEQAM?_ACaCGuBEI?wDMYAkCE}BCg@Aq@AY@UBE@KDMHONGNCDI^CNARAdC?d@?bBCtCCVa@fA_@l@GJAD"
            + "Wn@O^ADUv@EVOTQVw@hAOT{@nA_@f@_AtAORMRORJRFJtCbFf@x@x@vAr@fBRd@Yn@_AxA[h@aAvAaAvA_AvAaAvAaAvA_AvAaAvAaAvA_AvAaAvAaAvA_AxAaAvACDeApAcArA}@hAa"
            + "AtAcAtAaAtAe@p@aAvAaAvAaAtAu@hAcArAcArAcArAMNeAnAgAlAeAlAw@z@gAjAYXa@`@]t@o@jB[x@k@nBk@nBm@lBk@nBQh@a@vBIb@[nA_@nAGt@B^N\\Xd@ZPxA@xABxABxADxA"
            + "BhABxABxABxABxABr@BxAAxA?xAAxA?F?xACxACxAExACxACl@An@Gx@e@BIHi@PkAPiAPgAb@uCRkAPgAPgA@KL}@PgANw@R{APcAd@uC\\{B\\wBDYHg@VaBp@mEJ]JW^e@`AeAj@g@l"
            + "@Yn@Qh@MdASPIBFFB~@@dAHf@J^JJBh@Rn@ZTNHHHN?PCNY~AAZs@bECPEXEXAFu@jFCVKn@UdBu@pFWvB[lCCRKdA[vDI|A?p@?\\BbABr@Bf@?TF^?LALYxA?HAR?JOt@m@|COz@CNA"
            + "LBTBLRl@tAvDXx@p@lBJ^BPD`@?`@C^AJg@nCERCLCLi@pCw@lEq@nDKb@EVc@hCBRLb@Nd@Xr@Lt@Lp@JZdAbD^x@RZPLBB`@F|A@fFDvA@nABz@@pA`@`@b@DRDZClG?`@CdHF|@@Z"
            + "Ar@?H?F?p@Ax@YzBQxAOz@wBxICN}@pDGRGJS\\qEjCm@`@a@Z{@n@GByAbAgBbAc@PkBh@KB_EfAsAXeAf@YLgAt@MJ}@p@m@d@ONs@t@g@d@g@`@m@ZgMlGQFiE|A_@Fw@FM?M@{CPm"
            + "AFM@i@Do@Dc@DqBLUBM?Me@SmCCm@Cw@QmBEWGc@G}@AYKBmCb@SBqATeAPSDEe@[eCOkAUsBK_@GWSc@GM?K?M@KDKN]TYRSTQtAgAfAg@x@YFA^ALAD?XCLGXSLOHOB{@Ds@PiCJaB"
            + "F_A^mBf@gCrAkGDM^oAPg@N]r@gB^}@\\w@f@kA`@cAJSpGcOLYDI\\o@Xu@?a@Ek@w@aAaAuAEISe@O}@[M[GYA_@\\KPOJKJEB}@v@c@^MHOPsAhAOLsBdB{BjBYVKJKHg@`@sAhAg@l@"
            + "s@lA_@v@Y\\QPOOCCe@c@cC}BO_@B[h@qBh@qBJ[h@qBf@qBDM\\mBP}AJoAHoB@cAAuA?uA@_C@U?_C?MCu@IUC_@L_ABcBN}BDc@NgBNyAR}BR{BNcC@k@IWQ][Wm@IyA?wA@yA@iA?k"
            + "@Rm@lBm@lBo@lBm@lBm@lBm@lBGNm@nBk@lBm@nBk@lBm@nBk@lBm@nBGTg@_@SQUQuG{FIIHYHWNe@hAsDDMxDaMFSn@eCh@kBFY`@cBJIRw@BGHYHYl@wBBKJ[J]H[@QrDuMJ[DQ@G"
            + "R{@DW~BmKd@{BDQt@qDl@mCNq@DSDShAkFrAmGf@_CZ_BhBsINe@Nu@N{@BS?QTo@BIDGJ@VRRHz@x@ZZPN|AzAb@^v@r@^\\n@@^?p@c@BEbB_Cj@y@p@aAHMRkA}@}AMWa@@SEEKpAs"
            + "@^SnAw@NIhAq@`@KxABxAB`ABvA]vA]JCxATt@L|@|A`@r@d@^bAuA`AuA`AuA`AuANS`AwA`AuAbAuA`AwA`AuAl@y@Y}@y@_B{@_B{@_B{@_B{@}AKQ}@}A}@{A}@{Ay@{ABCFKL]F"
            + "[@[?[G_@IYKUOQSMICUAS@SHIFQPEIGK{AoCsBoDKSGIVOLOpCwD|B_D\\g@DGLSNU`@g@zBeDHMFIdA{AhAeBDGLQFIHOFIJOpAiBBGdAyAJMpBsCHIDIBELOJOBET]n@aAl@{@nBmCV"
            + "_@HMdCmDDINWJQ~A{BTYLFLNl@d@XPd@TFDPFRF^Hf@Hj@B^?VAF?JALAFATGPEb@Ox@a@FERO^[j@o@l@y@\\c@FIDGJKBCHKDGFG|@qAjAqB\\w@`@gAb@}@NWJK^MROPK\\[VWHKDGV]"
            + "R[\\i@p@gAP[JYLs@JSRUr@e@f@k@tAkBRi@{@_B}@}AaA{Ay@oA{@_By@_B{@aBy@_Bq@oACMG@IEKKsAaCKWMSg@{@o@kAUm@AIG[AIAGAKGIwD\\yAPYBwD^}D^g@DI@M@EEYKy@SIA"
            + "MEKAUG@O@KJu@Fc@Da@ToBV{BT{BRiBXyBV{BV{BFg@T{BPgBV{BBQxADvADxAB~@BvAZvAXjATvATj@HvAGG_CA]O}BO}BIsAR{BT}BT{BR{BT}BT{BDe@X{BHi@bAqAdAqAbAqAdAs"
            + "AbAqAdAqAbAqAf@o@hAgAhAiAj@i@jAcAj@g@lA{@nA}@f@]h@CP|BP|BDj@?~B?~AE~BE~BE~BE~BCbCC~BAjAJr@XnAHPrAo@rAo@lAm@v@q@h@Eb@vBZ|Aj@PxA@L?d@TFtB?~B?~"
            + "B?d@";

    private MilanMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Corso Sempione");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Piazza del Duomo");
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
