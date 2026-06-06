package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class MunichMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official MARATHON MUNCHEN by Brooks 2026 course PDF from marathonmuenchen.org, cross-checked against the Go&Race 2025 GPX track for the same one-lap route";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 6;

    private static final String ENCODED_ROUTE =
            "cv_eHcwmeAfAm@f@e@\\_@T]Tb@n@nATd@HRN^Tx@Rr@Ll@Fd@F`@NhAJpBHvABV@NLrCDbAF`A@T@XBj@@F?z@J?hAEr@?b@FXFJDb@PTJDYVqABIHKZQTM\\OHEo@gDoAaHSaAmAmGKm@UkAIw@CuAAUE{@CWW{A"
            + "UqAMi@Gg@E_@IgBGe@U{@MOGGDGFGDETSNOf@]nDqBb@UPKp@a@JKX_@LQJWNo@Fi@BW?y@Ao@UaGEmAAq@@_@De@D]J_@Ne@Vi@\\k@HOLSNRt@fAbA`ArAz@f@Tl@TjATjANv@BZBZ?^?tHDfDD`C@J@Z?HCDEP"
            + "Q?a@Aa@A}A?qH@}B?{B@]?G?_@@_@?i@@e@@yB?I?I@URGHCHGNQXiADSb@gBXoAf@{BNm@l@}BF]BULgBNaC@U@K@O@W@O@I@Sb@wH@O@Kj@eHBO@SRqBPiBD_@`@}DDYDYD]v@wEVuALu@d@kCv@oELkAToCBQ"
            + "@UFg@@_@?s@?K?UAG?Q?SA_A?SAM?W?KGqBEcCIeCAuAEqCAw@DgCB}A^qM?Ij@cELo@Ju@@MB_@RH`ExALFdBn@`@NdBn@RHbBn@XJTH~Al@zAj@^Lp@TJNZh@NPNDJ@D?XAR?L@`Cz@LDHDXJnAf@b@BjAb@zA"
            + "h@FBx@Xr@XPFPFVJf@Pz@ZzCfAfBp@FBRFVJFBjAb@r@Vt@Vn@TVHFBF@HDF@XLTJ^NlBp@tAj@v@Xt@VbAf@f@TRH@XD@DAf@PLDhAb@\\N^NHDd@R|@^TJn@VhCdAHD\\LHNh@T^VDARBb@TZJpAXf@PF@t@ZH@z"
            + "@P\\FLBPD^LFTHNTb@v@xAx@vAAf@BX@Lb@nA?H@LBF@Ft@~BX|@DJ`@nADPBLZhAJZ`@rAJ\\HXPl@Rr@Ph@Zt@Vd@Xh@z@dBDJCG}@iBYi@We@[u@Qi@Ss@Qm@Uw@a@sAK[[iACMEQa@oAEKY}@u@_CAGCGAM?Ic"
            + "@oAAMDa@B_@D_@R_ALi@DYBIK]EIEMOa@GQIQIQW_@W]QQIGSQGIEG?GASAY@WKKWQCCqCgBEA]EWKq@WOEYIWGMCEAgB]OEC?[Eg@@G?O@OB_AJG@}@IOAkASe@Ik@Ia@E}@KyAK[CyAWwAWSEWIuAk@mBq@OGO"
            + "GUKYMGAIEGAGCWIo@Uu@Ws@WkAc@GCWKSGGCgBq@{CgA{@[g@QWKQGQGs@Yy@YGC{Ai@kAc@a@YmAg@YKUIiCcAOMCEW[EEOIOAM@EHDI_@DS@q@U_@M{Ak@_Bm@UIYKcBo@SIeBo@]MiBq@MGaEyAGCKEBWBY@G"
            + "Jq@v@iFF[Gs@Gw@?YBQ^wELaBDk@BQ@MWE{B_@c@M?_@IW_AaCYo@IS]m@i@_@ECIEiAk@_Bw@[Qe@WcAc@Ws@GK[[a@Qo@COCMEgAq@eAUeASUAS??[@[Dg@DWb@aAb@mA?SK]e@y@g@w@s@eAW_@g@_AKECWUw"
            + "@q@_CCGWw@D[{@s@e@]k@g@cDeCaBiAo@c@yAmASQo@k@kCwByE_EeDeCkA}@}@s@GEHQLWFOTc@bAqBvA}CLYh@eAa@yAWy@[i@Qa@EIe@m@cAWe@Da@JYPa@h@k@|@g@^oB`@s@Ik@WiAyAo@aB_@m@c@g@]k@"
            + "Us@i@iAm@eAcA}AYs@_@y@c@q@m@k@q@_@]M]S]g@c@c@KGKCSCa@A}@HWDu@TMFKF}@`AQF_@DIASG[]Wm@OYUWOMYMQE_@Yg@]q@o@_As@q@w@m@gAe@mAq@mCYgBYmAWqCB}BCmBKmASoA[o@g@]e@Uq@O_AI"
            + "k@@g@Hw@j@c@l@g@dAW`AUf@MRYL]?[Ie@U{@m@{BwBe@w@e@oACIUeAWkBS_Cb@CzBs@v@UJCHEDCjBkAZM\\MbAw@ZQRKx@BlAXd@V\\`@\\t@b@hA`@v@p@~@lAdAz@h@f@ZbAd@XLrAz@VXp@f@`@h@\\h@b@b@v"
            + "@Nj@?bARx@n@x@nAh@pA^bAR^\\`@j@Zh@b@x@fAt@l@pBbA^\\DB`@t@Z`@p@\\R?RFr@`@~A|@hBr@d@d@Vb@d@|A^f@LPdDdCv@`AxA`DvAfCzAnBz@r@r@f@LL~@f@NBPHHFTP`@t@v@r@d@n@RT\\T|@ZZb@h@h"
            + "BvB~@l@|@p@n@r@l@Xh@b@hB`@`@f@\\t@`Ad@d@VHp@BL@p@\\x@j@dAd@p@t@VVRe@x@v@d@t@T\\V~APh@Pq@Jy@Aq@?c@JYDDDKJQTQ^GR@PPVf@Zl@Pd@TdAHt@HEHJp@f@JDVVXb@DNBR?z@AFO`@WlARbA~B"
            + "bA^Dz@[FCf@Ch@Jp@j@l@`@\\V\\|@hApB`@^tEhDjAl@d@Tf@dAHn@Hv@FTdBb@f@@p@Ar@KDEtBsAx@BdARV`@LTARX]|@cA~@oALSFKLQ@GnAgDLSH[L]DIPe@f@wA@Q@IXu@DMd@sArAyDL_@D]BW@S?U?a@AY"
            + "?i@EqCCsAAm@Gy@G}@AIAQA[MiAy@wDo@}DOy@a@mBQw@a@aBSo@Qi@u@mBYu@SaAi@gAkAaAU]m@u@kA{A[a@[i@Yk@u@}Ak@y@YWYQuBoAMIEEe@g@e@m@Wa@kAcBmAcB{@}@iB{AeBwA{BmBs@k@e@a@eDqCU"
            + "Q]YIIm@i@][iGkFeFgEe@u@O[Yy@EG_@y@Wm@_@o@CEeAaB{@aAo@g@oAo@e@Wk@S{@_@m@Yc@]{DaDi@g@y@u@_@[QOa@SMEZiADSNq@Hs@D}@@GDkADqCJkBNwA@GRyAr@cF\\aCBSFDx@^PHFBTFh@Jh@L^DlA"
            + "J~@BvDJn@FfADF?V?VAZ?lGPJ?T@~ABxCJF?T@T?~@?|@C\\A\\E|AU`AUbA_@fA[tAQd@ELAn@AJ?n@?T?r@BhCNzANF@J@NBJBTBNB~@NPCl@PHBhAXD@rCp@bB^x@@dA@t@?^?d@Ad@?h@@p@@zAJ~@Hj@FpALT"
            + "BR@RBRB~D`@~@JhBRvEf@P@zBCjAAv@BD?f@Ft@Lb@Nf@Xd@V^RPJJFPHd@Fx@Hr@BxBDjAEdACH?RAAV?PBbBDlADr@RdBBTLt@HRNNTJXFZ@l@?D?`@?dA?t@?B?H?D?D?hC@R@f@?r@@\\?TYHWDYBq@?YGsCG"
            + "_EWmLIiCGoBAoAAqAC{@EwDA}@CyCAQAu@TLDBDBHDpAp@JF`@RfFt@p@JH@JDnAZFBPPAJAN?nAAz@O~BAVCr@?XJfAFv@ATGNS^ET?PBZ@NBNPlANfAL~@DLHFLH^Nt@TvAb@vAb@h@PND[rCIx@Ix@EXALE`@"
            + "Gb@Ix@Kv@Ih@CLE\\E\\GZ[nBIh@QlAEVS`BWpBKx@UlBU|BALIjAEx@Ez@GpBAP@^?j@@RBFDDFBf@DLBZJ\\NVJpAd@xAh@p@Vj@THBJDO|AS`BCRALEj@CVL@PBJB\\JXJD@j@PFB^J|@`@FBTLd@VjAn@lAn@JFZ"
            + "PVPHDNJB@d@XLDh@P^Fd@B^JD@JDHBJBD@d@NvA\\dBTnAJh@BtAHJ@NZ?P?NAr@Ap@?d@A`AAZ?p@ANCRCFgBzCWd@GJYd@HJbAdBnAvBBFn@dAR\\TQHBh@k@hAjCi@t@{@nAs@v@WZq@z@GHQZe@x@S\\IPMPqAz"
            + "B~@~A`@r@DFj@bAf@x@@DPXDDdAhB\\l@FJh@|@NVHJQb@c@`Aa@x@[v@c@`AUh@OLIFw@bBCDEHO\\Cb@ITINe@`A_AdBc@|@m@jAk@lAsBbEkCdFCFCFCFMVm@lA[V_@n@INKREDEFCDILGJ]h@{AfCo@fAGJ[j@"
            + "cAdBqAtBsB`DEFQTmA~AKNGHEDCFEFDJFf@Dv@B~@?d@@n@DrA@T@VAREf@Kt@OnAIh@YrAGZUz@Wr@ENIPIZKZCHaBbEGNKNSPiBpAa@XIFEBCBQJg@Xi@ZOHs@TIBMDMFOHKFMNKRO`@GbACd@EJq@vCW`AO~@"
            + "CNOv@O~@CVMdBMbAKv@WdAK\\Ud@GJKPe@|@ILKVIZGd@CFKKWQCCqCgBEA]EWKq@WOEq@QMCEA{A[KAOEC?[Eg@@G?O@OB_AJG@}@IOAkASe@Ik@Ia@Ea@EyAOy@KwASyAUSEUIuAk@mBq@_@OUKYMGAIEGAGCWI"
            + "o@Uu@Ws@WkAc@GCWKSGGCgBq@{CgA{@[g@QWKQGQGs@Yy@YGC{Ai@kAc@a@YmAg@YKUIECcC_AOMCEW[EEOIOAM@_@DS@q@U_@M{Ak@_Bm@UIYKcBo@SIeBo@]MiBq@MGaEyASGEb@K|@Mn@k@bE?H_@pMC|AEfC"
            + "@v@FfFBh@DzADbCFpB?J?V@L?R@~@?R?P@F?T?J?r@A^Gf@ATCPUnCMjAw@nEe@jCMt@WtAw@vEE\\EXEXa@|DE^QhBSpBARCNk@dHAJANc@vHARAHANAVANAJATO`CMfBCTG\\m@|BOl@g@zB}@vDERYhAOPIFIBS"
            + "FM@C?O?AL?JExACnA?b@?H?^?\\?n@?X@rO?lA?T?d@YAkCAO?gB?m@AwA?wFCI?[?w@Cy@IwBa@a@OaA_@i@[_@[_@]]c@SWOWGIKUQXMRGH_@p@Wh@Od@K^E\\Ed@AZ@t@DlADfANxD@n@?x@CVGh@On@KVMPY^K"
            + "Jq@`@QJc@TkDlBk@`@e@b@EDGFEFOSY_@OSQUc@y@Sq@GUEYAa@@q@BWVqABS?U?[C[CYGWEM[y@Yk@EMUe@IWIa@AS?Q@s@?W?e@Ca@G_@Se@]a@MQWa@CGEKIQGUE]AY?c@K?W@k@[IM]u@ISYa@UUYSk@MK?S"
            + "BI@KBOA?d@FnB?D";

    private MunichMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Spiridon-Louis-Ring");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Willi-Daume-Platz");
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
