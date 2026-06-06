package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class JerusalemMarathonKnownCourse {
    static final String SOURCE_NOTE = "Jerusalem Marathon official 2026 marathon route GPX";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 12;

    private static final String ENCODED_ROUTE =
            "_a}`EqyzuEe@v@]Za@Xe@Zk@\\c@\\c@`@g@h@e@d@a@`@k@j@m@n@k@l@m@j@o@p@y@z@g@d@k@l@o@l@k@j@q@n@k@j@iAdAi@d@PXf@h@f@PZ@V" +
            "EJFJVFj@JZj@f@Pm@L_@`@Ib@Dn@FjAVXFbAF~@IlAIxAMr@IdAQ~@UdAWpA[hBc@b@Ex@Kv@Cd@Fv@NbAVtAZzAZd@Fh@DdADr@Fh@Nv@Xn@TRN" +
            "P^Jn@I~@Un@c@f@o@h@i@Tw@Vq@Rq@Ly@L{@DcAD_AB_AFy@FkAD}@?m@@o@H{@Pu@Vs@L}@TgAXq@Js@Hk@?u@?k@?e@Ke@?s@@m@Fg@@k@Go@O" +
            "_@Q][c@a@_@c@Qo@U_AW_Ac@q@Pq@d@wBAUKUOS[M]]g@Yo@i@S_@YR{@b@y@^u@Jg@Ck@]mAu@mAw@mAw@mAw@eBmAG]Dc@z@oAjBeCnB{Cx@wC" +
            "LiBUuDc@mCs@}Cm@kDQkDCqBhBEbDMrBOjBc@vBOpCUrBMrBKbDAzBDnCFvCDpDF|AD|AB|ADdBBdB@pBEpBE|AC|AA|BfAlAlDh@bBj@bBp@rAt" +
            "B|@xBLfCIbDQ|@@n@PvAx@~@~AJTTWEcAYsBYqBk@aCqAwBiA_AuAo@sAi@kAu@w@eAw@mAq@qBe@oCc@cCq@yByAcCs@kAe@Qa@ViAj@m@McAaA" +
            "eA_A_@_@Ww@y@yCk@{BWsAK{A?w@MK?c@NK@eAAgCBcEDgCDgCC{BYiCQk@u@sB]YSTeAjBq@fBu@fAw@pAoAbCy@`B{@jAs@x@y@bAw@`AuAzAm" +
            "@hAqAx@yA|@sAx@{@h@iAp@eBv@UVGj@Sr@Yb@i@\\w@TgAZg@Jq@Bw@K{@Uq@Yq@SYAKVFbABzADh@?^GTO?BOB[B[@M?QAWA[Ce@ASAU?KDUFMD" +
            "?X@N@VJZLVLd@L\\HZF\\@X?TCTETG^Kj@OXK\\MLINKHKJUFUHWDe@HWNKNK\\M`@Sf@UPMZYTW\\WXWXUFILI\\U`@UZSb@Yh@Yd@[KS]k@Sc@Mc@Wg@" +
            "_@u@a@u@a@s@a@w@e@_Ag@aAYm@c@aAa@cA]y@Wq@Gk@Ak@?k@F_ANDd@Ll@Tp@VPFPBVF\\HXF^Hb@J^Fn@Jf@Fh@Bj@?C]E{@AgA@aABiBAa@Fg" +
            "@@Y?[?o@?{@IBSBQ?WCY?I?MHMNWb@Y`@g@r@SVUT[\\Y\\IPE\\Gr@I|@IZK?GBQAUI[Ma@OGCKMGKES?SFe@Ny@TsAPcATwAReALi@Rg@R]T[FMRY" +
            "d@cA^i@r@aADYMSUA[EYAWAk@Vg@h@u@~@i@r@YX]\\WV_@X[R]TULWLUDUDe@A[Kc@Y]w@_@u@Sg@k@aAaAiBe@q@u@cAq@i@i@Ok@Em@?y@Nm@Z" +
            "{@h@q@^eAn@m@Nq@AcA[q@K_AIoAO_A?iAJwAT{APsAL{APaCZuBXmAJcBHuA@wBFiBFqBFcBFcBFgA?iAIcASsAe@_Ak@y@s@gAqAoAyAaBuBgB" +
            "uBqA_B}AiBeAsAqA}A_AkAw@cAc@i@s@m@iAw@_Ac@}@c@qAe@OKDQV]V_ATkAh@iCp@aDNu@h@Ll@At@Ut@s@b@iATu@Zs@XSa@i@g@q@Hq@b@y" +
            "@f@mB^iBVyA^y@t@}@t@_Ab@o@nA{AtBoBtAaAf@}@Kq@@AAIUm@KWAEAQ?MDSJ[BEDIpBmCr@kAt@aAPW\\m@F_@DUB]AYGk@K[GWKOMQy@iAo@y" +
            "@MUGQGOCQCOAOAU?S?SBUBSDSHSHQLQRSNMTMNGTINCNCNAN?B?N@JBLBLHLJNJ`D|DPRdAnAX\\XZPNLHLFTFRBVBX?XCLAn@GdAGP?P@JBHDDD@" +
            "FBDBFBJ@J?N?D?r@EjAATG^Mp@GZMd@MZMVKPEFIJUVs@v@[`@KPGPIVETCREb@KjAObBAHMnAETIZITIPMROLKFC@SHQBO@QAMCGAWISKc@]GES" +
            "OeAu@i@a@GEGCEAC?C?E@CBC@CFKVUd@e@bAO`@CD_@WCAGEEEGIGGGKIMKOIQKSS]SMGCKEIAK?IDQL]\\OLKHs@d@_@ZQPGFEBGJONoAzAMN[`@" +
            "[b@[^KHSTKLQRGHGJCBMRe@nCYlBAFIh@AFCNIb@AF?D?D?B?B?B@B?DLr@@DBFBHDDBDEFEBIFGDEDEDEHEJCHIZEJGRADIXABGPGLKNKNGFGDG" +
            "DGFMFKDJEDBDBGFCCE?C?OFODQBQ?UAQEI?A@ICADg@bCa@rBMj@g@fCCHAHGNINY^l@VJDn@V@@^PLFXLTJZPNJj@^f@d@b@^l@t@T\\XZFHJLLP" +
            "BBNPPVPRVZJLJL@@BD@@@@HJPRHJrA|A~@jAr@x@lAxAzAjBpBbCX\\RVLNRPVTFDNLXPTJp@XNDZH^H|@NV@v@BdAElAEZApBGRAtCIFCGBr@Cb@" +
            "Aj@Aj@AN?t@CHAf@An@Gb@Ex@MTCv@Mz@KPC|@Kv@KPCn@Gd@G^EjBYXC^ELAVCVAJ?N@h@D`@Dx@J^Bt@HL@HBPBH@L?L?HAF?NCHCHCDCNGJEN" +
            "KVOrA{@^Sv@e@vAMnANjAl@nApBbArBd@p@\\t@d@`Ab@z@ZXVDj@?d@EbAi@~@s@jAsAz@gAx@gAh@_@~@GpAF?@P@d@B`@?Z@~@A?QAMCGGIIAM" +
            "?SFSJKBQ@O?MASCa@GiAQKEMEMIGKEMAEOq@EWCOAIAEAI?K?K@CBIFIJGNGLETEB?N?B?F?j@BP?FQ\\AV?Z@`@Br@Fv@BN?hABv@@nABH?X?V?T" +
            "?LAHCDCDG@KBgB?MAOES?M?KF]HF@D@D?BGTJBN?BMGk@A[@ODE?GDm@BIFGFAr@CdAED?HADEFIbAXp@TTJNLHHNNHNDHFLHLPNr@f@PL\\TPLHH" +
            "LNFLFLDTDX@b@?TCZCPERGPSb@sBlDKLKLQNQJQL]NYL@z@@`@Lx@VV\\Np@Jn@Bf@@^?^?r@Ad@M|@o@l@c@v@YlAYn@Kr@Lt@\\XVNj@DdCIx@UN" +
            "aATqAPcBN}APwAh@qAv@eAt@yAbAkAr@g@XGRJx@z@dCXdB?jBEvBGfEEjEB|AAvBRL@Rd@@bBA~ADjBLhARC?v@Rh@LLBNBD[Da@Dc@V{BFc@D[" +
            "@Y?[Ae@?IE_CCkA?sAAg@?o@E{A?]@Q?Q@MFEDIDI@K?KFQFKBEFGHEFCLEVI`@K^KPEHEHGLKJMHKLQHOLSJKBABAJCJ?z@x@dAhAn@p@fAlAHJ" +
            "h@l@b@h@v@~@z@fANPzAlBNPf@p@j@v@VZJLZ`@pA`Bp@x@f@j@f@l@p@v@zAbBVX~@dAz@t@f@^TNFFf@XHDFFDDNGTGZE]k@EGgCcEKMIMYe@}" +
            "CiFoAuBe@s@c@s@i@_A[m@Ue@Sc@KWKYM_@Me@Im@Mu@I}@?CEs@YkGAYGAe@Mg@Qm@Y[KUGUGWGIAi@Km@I{@IKAqFAa@@s@F_BNg@?U?K?E?U?" +
            "O?O?SCa@Gk@MiB_@{AUEMDKFCBA?@`@EfBOhBQfBO^CTI@kAEeCJi@VLv@Xx@PdAN|ALfAFzAHvADhDLhAHvBJz@L`AJjAd@`Bz@rCtA~Ax@`Bv@" +
            "tCnApCz@`DbAzAh@A@RHPHD@B?B?B?B?B?BABAB?BABCBA@C@A@C@CFOHa@DSDQHm@Ho@JkAFwA@w@BgA@UBcBD}ADw@Fo@?CDYHo@Le@F]Pk@Ro" +
            "@bAuCJ[Rs@Lg@Fa@L}@Fs@Bi@b@cJ@QBSDOHQHOPMHG@J?J?J?JCFEJGNGNCR?P?PY|FIpAG`AO`AKl@Mf@Oj@EHGTELOd@m@pBm@pBMb@Kj@Gj@" +
            "Cl@Cb@Cn@Ct@?TCfAATE|AG~AARAZCd@M~@CLCTGZGROd@IRAFAD?F?F?B@D?@@D@FBFDFLH^Vp@`@z@h@LHjBjAd@ZbAp@LHLFNFPFRHz@Zd@Nj" +
            "FxANDPDD@RFdAXxA`@fBh@l@PF@RFTFx@Tr@TTHvFzBxClAZLATg@SkBw@m@W_Aa@a@QcBo@g@SMEg@Ow@Se@MMEKCUG]K]K]M[Ma@Kg@QsA]m@O" +
            "CAgAYwCw@o@QECs@Uy@YQGMGOIQK{B{Au@g@i@]e@Yo@_@e@Y{@g@QIEE?NAPGPOZIP]t@GLEDEFCBCBCFGTKb@Id@e@jCSfAWbBSnAI`@?BCJQn" +
            "Ae@lDERCPIj@CXAZCd@?L?FC`BGRCZEFEFEDGDGBG@UCYE{ASMCOAM?E?IB[DUFOFGLOFcA\\gBp@yBx@gAp@eAp@m@^OJm@`@_An@@B@FAFCFEDC" +
            "@G?EAECSLm@^oCzAG@KADH@HAHGFGDK@E?ECCE_@Pm@Xs@b@QN[Z?A]\\YT_A|@m@l@]XGDSN_@RIF[LuAl@KDBHDPLZNX\\f@JRFFXb@TV`@\\RPJD" +
            "NHTJHBh@Rx@^HFLD^TVLNJ@?V\\T^T^PZP`@DNFNLd@@HBJF\\@JZnB\\pC?JAHCDCDA@EDIF_AeBQSQQWOYMQGCAOCICMEG?UAQ?U@[BU@wAFw@DcA" +
            "Fk@?u@Cc@Ge@MYKQIMEWOQOMOMSKUQc@Um@IWOa@GS?Ea@_BUs@Sg@]k@MEMEMEMEOGUEMCU?@H@d@Bf@@?@TFr@Lz@Nx@j@bCZhAb@lAJVFLXf@" +
            "X`@^`@`@Zl@^`@P\\NTTFFFFHB\\JLFFBDDDHBJBJ@J?`@I`CWXUAEEeAwASYSYi@w@a@m@g@{@O[Sa@M]GMSi@[{@wAgE_AkCEQAECWEy@Cw@Eq@_" +
            "APe@@W?kAFu@Dy@Bw@MmAGiA?w@NwAF_@Bw@DsA@qAEy@Es@Ey@WUEWGk@L_AhAm@o@aAC";

    private JerusalemMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = decodePolyline(ENCODED_ROUTE);
        setLabel(routePoints, 0, "Start");
        setLabel(routePoints, routePoints.size() - 1, "Finish");
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
