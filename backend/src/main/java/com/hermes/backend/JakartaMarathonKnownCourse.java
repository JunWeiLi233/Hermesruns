package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class JakartaMarathonKnownCourse {
    static final String SOURCE_NOTE = "Jakarta Running Festival official marathon page Strava route embed 3324246221713590402";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 90;

    private static final String ENCODED_ROUTE =
            "r_~d@c_|jS`A?@?XI??`@UTMd@ULIXO??HEq@}@?Ae@m@e@o@OSKIAAq@i@??y@u@OOKEYO_@M??qA[a@KaAUYIYGOEYGYGOEGCG" +
            "AGAICWCC?M?G?G?A?G@QBOBQBWDA?k@Zk@\\]ROHULMHOHi@\\YRUL[R]Vg@Xw@h@w@f@MHA@w@f@A@o@\\m@ZA@YPe@XmAv@A@_An@" +
            "[\\k@j@e@d@QPA@M\\ELCJEVOxA?BBDPxABPHr@Hj@Fj@??@t@@X?BDXVxA\\vBDXV~ANbADRFb@XfBLr@ZnBRtAH`@RtAJp@@B?ADT" +
            "XdBHh@F`@Jj@Hj@@FJTHFPDF@j@EhBKJAF?`@AX?|ACF?r@Aj@?`AA`@?t@AD?|@AF?r@@|@@z@@vA@n@@??F?@?F?P@??D???B?" +
            "@?D@??BB@?@B?B?@CD???@GBQ???K?@?m@???M?@?A?k@?s@AQ?Y?c@?}@AQ?]?Q?@?[?Y?Y?i@Ay@?U?C?i@@cBBC?eBH}@Dk@B" +
            "Y@Y@c@BU@GGMOQc@ISIe@EYCQM{@EYIo@O_AYqBGa@Ks@[qBWgBGa@U{ACSKo@M{@Ks@Ks@G_@Ks@AMEU?@SwAEWSm@EUEYGa@Gc" +
            "@COMs@Ks@EYEGIOEICAEA]CE?SFWFGBWLm@Ze@TULo@ZSNUNSNSNA@QPKJm@h@_@\\MHeAv@i@^SNSPg@`@[VaAx@u@l@a@\\QNc@\\" +
            "UP[TSPi@`@SP[T[VMHSP[TSP??MHc@ZgAt@q@b@MJEBGB_@POF]N??UJs@ZOFC@a@PWHGBGBOFOFGBOFOFGBOFODGBOFOFo@VWJ_" +
            "@Lg@R_@NOF_@NUHIBUJUJ[LIDKDGI??CM?C?SBMFS?AFO@Cf@SLEVIJENGFC??NEDCPGNGVKVKVI^ONGNGNGNEFCFCFCNGFCFCFC" +
            "NGNENGPGFCVK??\\OFC\\Ob@UVKLGRMNGFE^STMTM??ROROLMPQXWd@c@h@g@NM`@[d@]@A`@Wr@e@TOn@g@|@s@n@g@h@a@ZURQRQ" +
            "^]XWJKZWROl@g@h@_@f@a@b@[t@m@??t@_@TMd@WVMd@UTM~@k@fAs@NQRULQX_@PUBC\\_@PSJKVYRS@APOv@m@TQDC`@Yf@_@TO" +
            "b@WTMd@Wj@]VODCb@Yh@]j@_@x@g@lAw@HEp@[ZOVMDCr@a@NIZQRMXOHOJUHMBG@ABMDODODQ??BU?C@a@?O?G@]@]@Q@Y@QDeA" +
            "@KAMA[?ACQAIGWEUACIMGKSUU[OS[a@IKEIEIAQCEQWEKK[k@w@OEQOIISWU[IMeAuA]g@_@g@W[OSOUa@i@gAyAOSe@[AAII]a@" +
            "GG[c@QOSQs@m@MK??w@i@WQKGc@WMIYOCAk@YOGe@UAAy@]c@Qu@[kCeA]Oo@UMGe@S[McA_@cA]YIcAY[I[Gq@K]GgBS]EC?{@E" +
            "kAIw@E_DQsAGcAG{@E_@C]CoAMa@CUCUEYEa@G_@GICa@KOCCA{ASOCQCcAOGAWEA?QCa@EQAOCa@EIAc@AYCk@C[AKAM?c@?O?[" +
            "@a@?O?{@?q@@O?O?Q?_@?I?}@@s@@_@@o@@g@?k@@s@@Q@s@?c@@eA@_@@a@D_@By@t@QFEBYFYAA?a@MCCYSIGg@c@??ICU?k@?" +
            "kA@k@?q@?uC@G?gA@wA@c@?wA@G?cADM?Y?a@?I?c@?k@?kB?u@?M?e@Am@AO?[A[?a@Ai@AcAC_@?OAQ?g@CqACu@Cc@Ai@?i@?" +
            "_@?S?uAHWBa@BA?i@@Q?O?c@?O@c@?i@@S?s@Bk@@qABc@BoABiBDkADI?OTWNS@G?YIO?w@Cg@Ac@?Y?oBCeAAoAAyBCa@?s@Aa" +
            "BAQ?s@Ac@AW?i@Ay@?C?mACW?k@?e@AI?CASEEG?W@E@AZO??t@?`A@`@?@?bA@fA@`@?fA@xABfA@l@?dCBP?b@@nA@P?r@@@?`" +
            "@Ab@AFA??b@EB?XE\\Cb@E?EBQ@WCqAAyAAe@?W?gA?e@AcA?YA[???Y?I?F?G?QAe@Ao@A[?a@CoAAu@Ak@?QAu@As@EsBAcAAk@" +
            "?A?TDpB@t@@t@?P@j@@t@?N@~@@`@?Z@n@@d@?P@X@j@?ZBhB@l@?V?~@?l@@j@BhB?P@h@?@Ef@?DVKBAZ???JBB@JFFF@@h@DD" +
            "?f@ALA^AJ?dAC|AEdACn@CZCj@CB?fACl@Aj@Cn@AXAlAC`@AP?P@r@@b@?R@V?r@@lABP?N?L@X?n@@R@h@@j@@j@@P@Z@n@@R?" +
            "~@@T@d@?p@@hA@rBBF?P?X?b@AP?b@?t@AdCAN?Z?x@AZAbDEp@Ap@?T?HABAVM\\Qh@Y^M??T?TAB?f@UNMb@_@^Y`@Yf@_@XUf@" +
            "]HI`@]`@]^]f@c@`@[l@i@x@s@??f@c@RSPQd@e@LMJKj@k@DGVYDGHMXe@BGTo@`@mABMFU@EBe@?I@OFk@F{@JgADa@Dg@BY@Q" +
            "@IJ}AFu@@YHeADg@??Du@?EBW?O?MLB??VHERAFCXOxAAFAREb@Ej@En@??C\\CXKpAAPCXEt@Ej@CZEj@C`@CVZBr@Fj@DL@\\BN@" +
            "h@Db@@X@r@Bb@@X@X@D?J@H?N@Z@P@XBX@^BJ?t@@P?N?H?F?H?N@P?H?F?H?N?H?F?H@P?P?F?PANAZANCPEn@WTINIVMj@YDC@" +
            "?LIROLITORMn@a@PIVKTK^Of@SJEb@Oh@Sv@YNGh@QVK^MXKLENGTINKDEp@Of@KRCx@KbAKl@CPAhAG|AGLAl@CF?jABX?x@@F?" +
            "N?R?t@AX?XAr@?D?L?jAAz@A^Ax@Ej@CJ?hAEH?lAEfAEfAE|@EB?z@K`@Ez@IB?l@K@Az@Mp@MHAh@KVGXEZG^I`@KtA]JCXGl@" +
            "S|@[RGFCFC^INEh@OPEVEHANCXGb@Gd@If@If@Ih@Ih@I^GPCr@MbAOj@KPCFAr@Il@ID?d@CfAG~@E\\A`ACPAVAXApAEdACn@CN" +
            "?nAEJ?FA|@CB?LAn@APAH?t@C@HB?bACbACr@CJ?h@?F?r@FF?XDr@JH@VFtAXjAVB@d@Pf@PPFr@^\\PTL^PNHRNl@h@B@ZZLJXX" +
            "BB\\b@JLb@f@DF\\h@T\\Pf@N^Vn@Pf@Vp@N`@BBLNDLHVFTPVNTBDPX`@^b@b@JHVPJFXRXR??f@Z??\\PXP?@??TLFBALAJGJA@MD?" +
            "?]SOGMIQKi@YOIKGqA}@GGU[UWM_@e@w@Yc@MSGSKWq@iBOc@ACKWMUSe@CEy@qAEIMO_@g@IMQQWUWWSSCC]Uy@k@SMe@WA?aAe" +
            "@UKWIYKMEUEWIQEWGq@Mi@KYGs@GMCu@GG?_BBQ?_@@Y@g@@cABkADm@@Y@i@B_@@o@@U@C?Q@c@@m@@Q?G?Q@Q?aBDs@BQ?Q@i@" +
            "B[@O@k@BQ@Q@]@MBOBQBYDODa@Fs@JuATYFa@FG@_@HcARo@NQDA?E@O@sAPE@OD_@HKBSLE@iA\\YH_@LWHi@Ni@JWFQB_@HQDa@" +
            "Hs@NI@E@_ANA?_ALc@FWBk@DYBk@F??YDs@HUBo@B[@Q@}@DY@u@BQ@Y@Q@gAD_@@c@Ba@@Q@k@@s@DK?_@?c@@sA@O?Y@]?_@?y" +
            "A?u@?k@?I?u@DQ@Q@Y@Q@Q@a@B[@Q@s@Dc@BYBa@FC?UDI@q@Ls@NG@w@R??SDGBODQDE@c@J??g@RWJe@RE@a@RMF_@Pe@TWL??" +
            "UNOHEBWLOHULWLMHOFMHOH??OF]Ng@TOFIDE@GBODOFG@GB??I@G@QDOBG@OBA?I?O@Q?C?E?Q?QAG?G?M?C?c@Ak@Ak@CG?Q?OA" +
            "I?QAI?GAYAs@Gk@EQAIAG?G?G???KAG?I?Q?GAI?G?B?C?c@AgAAG?IAYCQAQAIAOAQAIAQAa@E[COAY`BENMf@EFMTi@z@MTEFW" +
            "XKNKHYXs@p@QP_@\\GD]Z{@r@OLa@ZoAdAKJMJQNSNYVMJKBUP[TiA|@SPQLEB??OLCFIN?\\@B??BX?@l@TB@f@?d@A`@?H?`@?r@" +
            "AbCCX?fBC|@Ab@?PAnAAP?P?`@AL?J?j@?Z?P?b@@j@?b@?H?j@@P@b@DR@^F`@FN@XDXDPBNB|AT`ANz@LTBn@Hb@D`@Dr@Hn@H" +
            "|@Fh@DdAFX@XB\\BL@r@DbCLtAFh@DdADL@j@Fz@J`@D^DPD^FPDNBl@Lh@PXHf@PJBLD^N~Ap@lAf@~An@rAh@`A`@bA`@DBnAl@" +
            "~@f@FBnAv@bAt@^XDDRR^^BBFFb@f@|@~@\\^\\\\X`@TZ^f@NRV^NPl@z@TXb@n@NRRX^f@d@n@TX^h@@BPTb@P@@HJDFd@p@\\f@@@" +
            "JHPN@@TLTDhAVl@LhB^NBPDNBF@FBPB^HXFNDH@F@F?PB??F?P?H?@?p@E??NEFCLITM\\SJGp@a@JGNKd@Y`C{A\\Wr@o@BC\\URMJ" +
            "Gz@m@JGPIbDaBTKb@W~@i@TOTMdAm@DCRMb@Y`@Wx@g@NKr@_@FEh@]bAq@DCLIr@a@RMNGRONGLIn@_@FEXQZQNIRQZ[HIBCdAq" +
            "@@ARKpBeATM\\St@_@TO|@e@|@e@NIPK`@YZSJGHGVSDEd@_@@ATSdA{@BCZ]JMJKHK@ANUHMXa@@ALU`@u@NWZi@FK^k@HMHMr@i" +
            "AXc@Zg@DKRe@JWXo@Pc@b@u@Zi@HMLU??BEBGDEBE??HM?ADAFCNEF?J@J?B@BB@?FJDZ?X?@ILk@bAs@lAQZEF_@j@W`@KJWZAB" +
            "s@hACD_@p@OXCVQd@EHc@t@[j@EHORSX_@f@?@{@~@a@b@ABMLc@^c@`@UPOJUNu@d@[Tm@^CBaAl@OHi@ZUNcBbAk@\\SLUNSLi@" +
            "Zc@VOJqAv@eBdAOHMHUN{@f@[RSLq@`@yBpAi@\\C@g@ZqAt@i@Zq@`@c@Vq@b@{D|BC@e@Zy@h@YR}@l@QLa@R[PULOFo@\\YNg@X" +
            "]R]RWL??k@\\gAr@IFABILCDCFILGJMb@CLCRAPEt@?FAb@AXE|@?PCj@A\\?\\@P?V?@Nd@HLRZTZT^LRLP@@x@hAh@t@RX??`@z@?" +
            "?Vd@\\j@Xd@nAxBHLp@lALTLVh@`AT`@LRRXf@x@DFHLT\\NT^h@`@n@h@v@t@fAd@p@NRXb@~@rANRNTXb@j@v@d@p@^j@d@p@HLn" +
            "@~@RX\\f@TZ^j@HJLNZ`@NTFF??RVf@p@DD?@HHHLNPTXBBNJ??j@JXFZP??TXj@r@XPDBVJh@PHDtA`@XFNBh@LF@d@FjAHTB\\?h" +
            "@@??l@?z@@@???nA?n@?P?j@?dA?b@?|@?j@?F?b@?hB@t@@j@?X?L?n@@jA?p@@|@?P?b@@N?P?dA?P?X@b@?Z?N?X@V?V?N?@?" +
            "H?`@?j@?@??XC?o@?Y?a@?I?k@?[?O?k@?[?_@?aA?G?q@?a@?K?M?I@Q?i@?k@?[?oD@a@?uA?u@@Y?c@?u@?oA?u@@i@?Q?o@?" +
            "[?a@Ak@?W?k@Aa@?[AYCSAWCc@GOAc@IWE[IWGk@Oa@KSIUIk@SOGOG@?EAOGo@KQCa@QCAUQIMACSs@?Ae@k@[]_@e@i@m@]e@Y" +
            "a@s@eAk@w@]i@OUSYg@s@GKW_@e@o@i@u@aB}BCEaAuACC[e@KMo@_As@gAQUc@q@_@k@CCQWIOc@q@]m@QWQ[MU_@s@MWa@s@KS" +
            "Q[Ue@S]?@_@q@MWS[S[QYGIOWCEDFJP@?KOGIKFc@TWLw@b@OH??YH??aA?";

    private JakartaMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> points = new ArrayList<>();
        int index = 0;
        int lat = 0;
        int lng = 0;
        while (index < ENCODED_ROUTE.length()) {
            DecodeResult latResult = decodeValue(index);
            lat += latResult.delta();
            DecodeResult lngResult = decodeValue(latResult.nextIndex());
            lng += lngResult.delta();
            index = lngResult.nextIndex();
            points.add(new RoutePoint(lat / 100000.0, lng / 100000.0, null));
        }
        return List.copyOf(points);
    }

    private static DecodeResult decodeValue(int startIndex) {
        int result = 0;
        int shift = 0;
        int index = startIndex;
        int value;
        do {
            value = ENCODED_ROUTE.charAt(index++) - 63;
            result |= (value & 0x1f) << shift;
            shift += 5;
        } while (value >= 0x20);
        int delta = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
        return new DecodeResult(delta, index);
    }

    private record DecodeResult(int delta, int nextIndex) {
    }
}
