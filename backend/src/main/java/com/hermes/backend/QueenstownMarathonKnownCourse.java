package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class QueenstownMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official 2026 Queenstown Marathon race page, official QTM25 full marathon course map/PDF, and ordered road-trail geometry reconstructed on OpenStreetMap paths";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 120;

    private static final String ENCODED_ROUTE =
            "b|iqGgoje_@{@cBeAmCoH_Re@mA]eDIe@GQIKIIIEICKAI?KBKBAIUk@ETEROV]x@o@dBc@bAo@n@}@\\c@J_@Ck@O[S[]S_@I[IKGC?TK@?{@I?KAQGiCwAm"
            + "DmBUMiFuCQK{@e@MKIKGMEUa@_COy@Gi@G{@Cg@?_@AeABaCAq@Ek@Ew@Cq@?s@Bs@Fw@Jy@DSFWHYHUh@uA^eAGCQEQAoAGICIGEOC[A{BD{ABWDUFW@Q@O"
            + "ASKZJ[GqACy@AG?KAQ@[NaCR{CDm@JiAZqBBOBOZiBb@kC\\uBf@iDFa@DSDMBIHKFIr@g@dIoFXOAKCGi@sBGKEKGMKESCqB}@IKE_@AY@aBVMh@WNKAIM_A"
            + "@Kl@Qz@]nA_A~@aAnA{@~@aBbAcAh@c@NQh@aAXCj@N`@Hr@Qr@{@h@gAt@{Bj@o@fA[|@i@l@Yd@Qf@e@d@[^k@v@k@fAG`BIdB@f@Q\\u@d@e@x@_@r@Ov@"
            + "a@v@?z@]bCoAh@[fA[tAUz@@jASDjAEkATMLENIJINKRMTMRIPKNETGTETEFEHGHKPULILGLOJULUJOTONIPGNEPCN?R@h@@VARANCHEJGNMdAaAh@i@f@k@"
            + "RSFIJGVORQRQVYPQHGHGVINKNUb@k@X[XWh@YZKPGVGH?HEFIHQDEDAN?V?^BN@J@HAHCNGVG`@ILELEJIJIDEFGHMFKHGPGVINIFCFGJQJMJOHGHERGNGFI"
            + "LQPONAPATBLBLBFBF?F?J?NBPDTFRDJ@F?FAHCHINMNM\\U\\[X[HGHEFCD?B@BDBD?J@N?LCZAL?H@J@FBJFPDN@JBL?N@^?z@@FBB@ABC@M@OBy@@a@@Y?E@"
            + "EBC@AD?`@TB@D?BADIJWPq@XaAFSDOFQVi@BEDAFAF@DDDHFNJXHNFFFDD@H?FADCFGV_@FCDCF?RBJ@HAFAJERKFCDAFAH?\\DD@DAH?\\IFAD@DBFFBDBD@H"
            + "AHCHEJEJ?H?LAPVFLBJ@P@L?PEPEh@Yj@Yk@Xi@XQDQDM?QAKAMCWG}@z@}@lAeDlEiFnGG\\n@EbAEf@?f@Bb@F\\H^J`@PtAl@b@Pb@Jf@LxAZd@JdB^ALCR"
            + "I^Ob@KTKRS^ORUTULYJ@L@J?PALENc@lBk@~BM\\KTSXy@fAMPGNALAN@RDRPp@pAxEJf@DVBXB\\?\\?\\?\\C\\cCzYC\\E^IXITMVS^_@t@sBbD_B~BKLEHGJIPG"
            + "PERoB|HMh@Il@Eb@Cj@Cf@MbCElAC`BK|BSpDC^E\\GPGPM\\Uz@Ml@If@Mf@M^OXMRQXOVKZ[~@IXEZCd@?^?b@Bb@PnDR~DBx@@b@?d@A\\Cz@[~GyAv[A`A?"
            + "NdH]vA?`JL~FDnGF~@@xBDfA@fADr@Bt@Hb@F`@Hd@J\\Hb@L`@L^NtCnA`@Pb@Ld@FQ\\R?vBNz@\\h@l@~CKh@NbAQnA]nAWlBBZ?TKh@Ql@D^Bh@Bj@G^DRA"
            + "h@HTBp@PXFT?l@Hd@Dn@?TAd@KRH`@?NFTDr@MLM|@Ef@Qp@Jt@Lp@^h@\\`@`@j@\\p@Rh@\\h@`@j@`@l@`@j@\\j@\\l@\\l@Xj@Zl@Zj@Vl@F\\\\XLNVXn@\\d@T"
            + "J\\ZJHZVf@\\TDPNRHVRf@JVFf@Lb@\\Vh@LXRZJPDVZ^Z`@T`@Nj@`@f@b@jA`@\\b@Zb@f@d@h@x@|@`@r@d@l@^l@Zr@N^NN^RN^Td@d@^PVDNR`@Xr@d@R`@"
            + "h@^ZLAb@VRMn@D`@Lb@P`@d@NR\\h@ZZ\\VTDXFr@HPH\\^b@n@f@r@N`AVjAC~@Gx@Af@AVW`@M|@KZOVe@v@Sf@ERAR@f@H~@Qv@SHi@Gc@NUFYh@G^Av@Ad@"
            + "Gb@c@l@KPINo@?q@Qm@W]OO@KHOTi@JgAf@]ZYh@WTg@RSPy@x@QVMx@Kh@Yd@]\\[LOLI@SEMMUCKAc@MM@MBQFI@c@C]AMFMFa@TMDYF_@Vg@Z_@@[Ae@VI"
            + "@EAg@We@@YC_@GY@SG_@Sa@CM@}@TM@k@]g@SGQe@Uc@Oi@Se@[cAeAK[KCUQa@a@_@c@MG]i@s@}@I[WW]]QYWQu@e@Y_@iAo@GWSYw@o@g@a@i@MYQ]Ee@"
            + "q@e@]e@_@e@Ow@_@KCWCw@[Yu@_@[k@q@O[QUc@k@W]q@e@e@a@q@e@WAMEy@QUCOGaASy@Uq@Qi@e@w@_@O@OIe@]m@[m@Wm@[i@]WKc@AUM[Ok@CYEa@Ak"
            + "@Bc@BQEKESEMAU@QJWHUCWMYEOGQUQG[IMGu@O]Ie@Co@Wm@Ga@U[?y@Qe@@w@?_@OUAk@Ku@Ec@Mm@Ay@IOEe@YM_@Bo@H[E{@E_AKe@GUMMWYiBEcBa@uA"
            + "GuDx@{Ar@yCnBGHKLSrDBXBJ|@|CLhASvG{@GwC]iAa@aDwASIMCOAG?E@^zOxA`j@HfFZ|LFlABr@Hn@Hl@Jf@zAnHJr@Hl@Bn@?r@?p@m@hRCz@@l@@x@B"
            + "p@Fl@Hp@Fj@zFdb@Hj@Nn@Ph@Rj@Td@Vd@bCfETd@`@x@Tf@Tl@HRFTHTFTFTFTFVFRFTFXLl@FTFTNl@Ll@FTFTFVDVFTBLBNBN@J@H@L@LBR@R@P@P@V?V"
            + "@J@L?J@JBXBVDXBTDVBVDTDVRfAz@hF^tB\\tBV~AJn@PdAnApHb@lCBNlSgE~IkBlDw@f@K|A[tK{BbDq@NCbJmB`E{@tCm@z@QjCi@jCk@f@K~@SPEXGFAF"
            + "AHAFCHAF?HAFAHAF?HAF?HAF?H?P?fBAZ?~ECxAAF?F?H?F@F?F@D@H@F@~@\\pBv@CLIRi@|@HNFJFLFNvAjDF^IXERSl@w@vBQj@CR@TBTHLJJLDX@XJR\\v"
            + "@vDAhABTd@hARnA|@z@bAs@hCgAb@EvAe@V?rE~@\\b@t@xBZ^^VdANfATjA^zARZRbBDfALl@O\\Kh@Lv@b@F^JJLDPGVw@Rg@DWBi@S?e@|@If@PnLDf@JJ`"
            + "@LLVv@nAL\\b@bB_@g@_@g@OSMOIIOQQQOYMMM[LZLLNXPPNPHHLNNR^f@^f@?b@TRLJTRVNXLXDv@Hb@Bf@BTAj@Cx@Mf@GdAKd@A`@Ab@?b@?b@Fb@Jv@V\\"
            + "Lf@T^R~@n@RLLHLJLHJDHFHFf@f@Tf@\\t@`@t@|@xAx@rAp@dAzClFxCpEvEtHh@|@`@r@T^Ph@@@pCxE~ApCZl@FPFTF`@@J@FBHBFDDDBDBD@D?F?D?DCL"
            + "FJFHJFF^l@`InMHJF\\HNXf@JPHNFPDHBDDFLJNNDDBDBFBFFNT~@FTTf@b@fA|BhGpBnFfAnCx@rBv@fBPNHPFFFDFBH@F?N@PBHEpAe@FCBNfF_BVIF?ZFD"
            + "@nDqAf@nDJBR@JBLFNJLJFHVj@Vl@HRPf@HXDLF`@BLDHJPXXHHFDNDTDL?L@H@JHFHFTBJLEj@Sb@QJELGLGPIb@SXMHEFCHCJEJCFADCXFH?P@RDF?HADE"
            + "DGLGJGHEJARI\\BL@N@N@P@L?V@L@J@T@f@@fADhD@j@@?N?JDDJDd@Bv@?b@AV@b@Bt@?F@FFFNB\\VpBDXlFmBVGRC?E@G@C?E@E?C@C?C?A@A@A@AB?B?BA"
            + "B?B?@@B?D@D@FBD@B@@?B@@@B@CAAACAA?CAEAGCEAEAC?AAC?C?C@C?C?A@A@A@?@?BAB?BAD?DABAF?DADAD?LAH?JAH?FCHEXGLILHMFMDYBI?G@I?K@I"
            + "?M@E@ESBWFmFlBEYWqBC]GOGGGAu@?c@CWAc@@w@?e@CKEEE?KG?SD_@?_@AODGBE?KAIAE@E@a@LCFABABGFGJGNGAY?HLFJDLNl@H^FZJb@LnAP|@@xAKA"
            + "QDMDMBLCLEPEJ@AyAQ}@MoAKc@G[I_@Om@EMGKIMX?F@FOFKFG@C@CBG`@MDADAH@J@D?FCNE^@^?REF??JDDJDd@Bv@?b@AV@b@Bt@?F@FFFNB\\VpBDXlFm"
            + "BVGRCADAD?LAH?JAH?FCHEXGLILILUT_@^[`@MLQJQHaAf@cAf@kAf@eAb@aA`@eAb@g@Ra@PYRe@b@UNQBc@HwAX}AVoA\\i@Ng@T_Af@y@f@cBjAi@^e@\\m"
            + "@j@g@d@]\\aAx@a@^m@bA{@jAy@jAuA`Ci@t@Oh@wBpHg@lBc@fBMdADxAj@hEbA~GZjBJx@DjE?Rx@IJBHRt@hBHDDGDJxBbFSTAJIJOVE@FVJZ?@@D@BFVN"
            + "h@?FAJAH?J@HJz@DX@V@LA^A\\?\\@T@RBPDPPh@Rd@h@lAN\\FHZ\\DDBFVr@HTDNBNBV@JBH@HZpARhAP|@Jt@D^HbABh@XhBHn@Dp@H`AF|AAtAJjANp@P\\|A"
            + "xANVb@p@\\f@Zn@LVT\\HNHVJd@\\rANj@\\p@HVP|@H^@NBb@@R@LFPFHJLLPFPLXFXFf@F\\Fb@Lf@JXFVHd@Tn@HZN|@F`@H\\JZJPNXLVJ\\N^Tf@NV?@HNHNJJ"
            + "LJPLFBRJXPLJLJHHDHHNJXPf@Tp@h@jBL`@FPFP\\r@^nAN^HLHVHb@Hd@Jt@Bb@Dh@FXLp@JZDJJTDTHp@JtATbAXtAThAJj@FTTj@R\\Zh@d@t@Zh@Xn@Xp@"
            + "N\\JXLn@H\\Tr@FJVd@T`@PRTRXPZXRZNZd@t@d@t@hDvET\\LZd@n@`AtAd@x@d@p@hBdCnAtA`@`@h@f@x@n@TTb@h@RPJRLXX|@b@bBF\\Br@@r@BTBPDVBZ@"
            + "XAh@C^C^?Z@b@Bd@Hv@HbAR`CP~@\\|@Rt@J~@FZf@vAVr@Hd@H|@Hp@RzA@LBNb@lD^tCNjAN~@VtABPALAN_BxFm@lCI^Ef@C|@@nADtBH`C@R@P@PBN@L@"
            + "Pp@dGjApF?L?JCJEJGFgBj@sBl@q@PE?ANIFEBI?KEQKIAWASAIEALFXAFKFCBSXCBOXKNEHYd@GHIL}@rAk@|@?RABCBKPcAbBQb@KTWQACACAIC?C@ABCD"
            + "uAhCIJMNWf@]XSHCBMPa@U}@i@q@a@u@c@SMMG";

    private QueenstownMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - The Avenue / Millbrook Resort");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Queenstown Recreation Ground");
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
