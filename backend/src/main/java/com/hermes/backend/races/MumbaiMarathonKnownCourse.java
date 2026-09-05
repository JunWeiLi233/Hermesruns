package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class MumbaiMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Tata Mumbai Marathon 2026 route map from tatamumbaimarathon.procam.in, cross-checked against the GeeksOnFeet 2026 driven GPX track";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 12;

    private static final String ENCODED_ROUTE =
            "marrBgqp{LD@B?F?ZB`@Jh@NH@d@LRHb@RXNZL^Jj@PTFF@L@`@Jj@HJ@LBd@LLBh@Rf@Pf@Rf@RZNd@Vf@Xh@XVP`@XTPLHh@Xf"
             + "@Xh@Zh@\\XRb@XZPHHDD@??ADJ@BPb@T^\\ZDDDDTV?R@TCh@C\\?\\EXCXCH@B@B?B?@@?@?B?B@F@H@F?LBVBVDLDD?@?B@PFT@L@D"
             + "@HB@?J?NDR@D?XBD?J@J@H@F@B?NAJ@F?N@B?B@B?@?B?ZBP@@@F?H?D?J?F?R?@AH?HAPBP?@AP?HCD?F?LCRAHALANAV?B?HAP"
             + "AL@F@B?P?@?P?H@H?P?NAD?FC@?B?BA@?H?D?D?B@B?J?J?D?B?VAL@V@@AB@FAP?@?B?F?L?@?@AB@@?F?P?@?N@JAD?X@PBHDF"
             + "FDH?@HV@H@H?B?RAB?@AVET?HCNCN?@ADCFADENAFAFCFA@AD?BC@ADA@C@CDA@C@EBCFE@C?A?E@E@E@I?EAi@?UBU@MAY?S?m@"
             + "AK?GAk@Am@?U@e@Ae@AM@g@Cg@Co@Aa@Ag@@g@AO@e@Ak@Aq@?q@?e@?I?W?S?e@@[AYA]DUBEBIBC@EBEBC@A@EBABA@A@C@ABC"
             + "@A@EDKNAFId@CXEf@Gh@ALIp@A`@CPA^Eb@In@?RGd@A\\Er@Ef@C`@Ip@A^CXEX?N@FCJ?BAD?B?@?@?B?@?B?D@@@B@B@BBDTHP"
             + "@\\NNBh@JZFf@LJDb@JXHVHPDDBB@FBB@@@A?JDb@Tr@PJBj@RZLNDl@Pl@TLFh@TLDTLHDXJFBP?DABALKXi@HONi@RYNe@\\m@HO"
             + "HQT_@Zo@Pe@Pc@HORc@Ra@P_@HQR_@Xo@Vo@Xm@Tg@Nc@BKBGDEDG@?D@?@@@?DADKPORKRQ^Ub@Sd@Qb@EHQb@S`@Sf@S`@EHMT"
             + "Qd@Qf@GJUb@S`@Od@Q`@Sf@KZSZKNK\\MTEJELILGHCBCDCD?F@LHNZTHDHF`@T`@RHFVNTRJFb@XJFXNJHf@f@\\XLJf@`@j@b@d@"
             + "^XT`@^d@\\h@\\h@`@JH`@^TTPNDFDH@FADG@ECW[][MS]][Ya@[[S_@YOQ[YSM_@Y_@]_@[QSQUIGW[a@Wc@_@[OKGKEUM]S_@U_@"
             + "SIE]SA??@@?@?@?GCECMI_@UICg@]KGe@Ug@WMGm@W_@Mo@Uk@SKEe@OIEk@WKEk@Q_@KQCq@OOEo@Oa@I_@Ik@M]Gk@MMCi@Km@"
             + "Ks@Ks@Kq@GOAq@Eo@E[Ck@Gm@C[Ae@CK?E?e@Ce@AYAe@Ci@?[Am@?o@@O?m@@m@BO@W@c@@k@B]Ba@D[B[B]DQ@o@Dq@Hq@HQBQ"
             + "Bs@JQBc@Fe@Jc@Hc@Jc@Le@Fg@He@Le@Le@Le@NQFe@Lc@Nc@Pe@Pe@Pc@Ra@Pc@Pc@Ra@Pc@Ra@Ra@Ta@Ra@R_@TOHQJ_@T_@T_"
             + "@TOJkHfFOJa@X[XOL[X_@X]XOLOL]V_@X]V[X[Vg@`@g@b@g@`@g@b@g@b@[XYVMLYXYVe@`@c@\\aCtBSNIDc@Ve@Xi@^g@^[XWX"
             + "a@f@IN]h@IJ]j@S\\U`@INS^Uh@MVEJEJGNAFQ`@ABCB?BCJMd@Mf@IZCLKp@CRCd@CPEd@AREh@Ah@?h@@h@?T@h@@j@?TBh@Ff@"
             + "DTLf@Ld@Nd@N`@Tj@HR@BBDBD@B@D@@AD?D@TGFUBWCi@MKGg@QMEg@Qw@SMGe@Wc@KMKg@[MIWQg@[m@Ym@Yk@YWSSMSMa@OUGK"
             + "GO@QB]LMFg@TWTWHc@P_@PSLc@LWJ]D]R]N_@Pg@Vg@Vk@Ti@RYLe@RYJe@RQFI@a@FODi@FSFM@c@JW@KBa@De@FCBKBk@DO?m@"
             + "Fm@@K@e@AK?I@_@?O?_@?Q?i@AKAKC]IKGe@M[M]Kk@[SGa@QYUa@Oo@Sq@][Q[OMGa@Ke@KUK_@SOEMEE?AAA?AAA?A?CCCAGEU"
             + "G_@MMCe@Sc@Qe@CO?i@@e@CK@i@D[Bm@?O@m@@K@M?M?QAa@@m@D]@M?M@e@DI@G@I@]Bg@@_@Be@De@?e@Di@DS@c@DQ@c@BS@O"
             + "?c@@a@FOBa@Aa@?O?K?UEKCO?ICGAGCSOIAQIYQWKYMCC]]WOUYYg@KUGMK]EMUo@COK_@O_@KKIKUUKIKGUOc@WSQKKAACAIEYS"
             + "GE[OYQCAo@[CACCCA_@WGEIEc@_@ACCC_@WGCSOMIQSCEaAo@]We@YYOg@Ua@QIEKCM?[?MBMDWPKHKJQZGP?NCr@Af@?d@?d@Er"
             + "@?p@@NH\\LZRTVLXFV@VCVEHEHEPONWJUF[@MEYCMGMUc@IIIGKGKEg@O]I[Gm@Mm@Mm@Mq@GOAs@Ba@Dq@Ra@POHa@T_@TOJOL]Z"
             + "[\\Y\\Y\\KNY^Y`@Y^Y^[^MNY\\[Z]V]Ta@ROFa@Nc@HSDc@Fe@BS@g@@e@Ag@ESCg@Ig@OSGe@QSGe@SQIg@QSIg@Sg@QSGSIi@OSEQ"
             + "Ge@Me@Ke@Ig@Ki@Ig@Ie@Gg@Ee@Ee@Ce@Ce@Ae@AS?e@Ag@?i@@i@@g@Bi@Di@BS@UBi@Dk@HUBg@HSBg@Lg@Jg@Jg@Je@Je@HQD"
             + "e@HSDQBg@HSBi@DS@i@Di@Bg@BS@e@?g@?g@?g@AU?S?i@Ai@Ag@Ci@Cg@Eg@Ge@Gg@ISCg@Ke@Ig@Ie@Ke@Me@Me@Og@Qi@Sg@S"
             + "i@SSIk@Si@Qi@Sg@OQGg@Oe@Oe@Qe@Og@Qg@Qg@Qi@KUGi@Ii@GSCi@Eg@CSAU?g@?g@@U@i@Bi@Fi@Ji@Jg@LSFUFSFi@Rg@TSJ"
             + "QJe@Vc@TQJQJa@Ta@Pa@Pa@Lq@Rs@Na@Ds@Hc@Bc@@e@Bc@@e@Ae@?g@Cg@Ak@Ek@KUEo@Mm@Mm@KUEm@Kk@Mi@Ki@Ki@ISEg@Ie"
             + "@Kg@Ig@Ig@Ii@Ii@Ik@Kk@Ii@Ik@Ki@Ik@Kk@Ki@Ik@Ii@Ki@KUCk@Kk@KSEk@Kk@Ki@Im@Mk@Io@Km@Km@Ko@KWEm@Ko@Ko@Mo@"
             + "KWEo@KWEo@Mk@Kk@Ii@Ki@ISEi@Ii@Kk@Ii@Kk@Km@Ik@Ki@Ki@KUCk@Ki@ISCg@KSCg@Ie@Kg@IQCc@Ic@Ic@Ge@ISCg@Ii@Ig@"
             + "KSCUEi@Kk@ISEm@IWEm@Km@Ko@Ko@IWEYGo@Ko@KWEk@KUEi@Ii@Ki@KSCg@Ig@Ke@Ig@Ie@Ig@Ic@Ic@Ke@Gi@Ii@Kg@Ik@Im@I"
             + "UEm@Kk@Kk@Mm@KUGk@Ok@Sk@SUKg@Wg@WSMe@[e@]e@_@a@a@a@a@a@e@OS_@g@]m@MU]q@[q@Ws@Ws@Uq@Sq@K_AYy@Og@Og@IO"
             + "O]Sq@Uq@OUOe@EWK]ES?IACCCAEACAEAEACCEACAEACAEACCEACAEAEACAEACAEACAEACAC?EAEACAC?C?EACACAECEACCEAGCCA"
             + "ECCAE?EAC?E?C?G?E?EAE?CAEACAEACAE?CAEAE?CAEAEAEACAECCAECCAEACCEAEACAEACAEACCEACACCEACAEAC?EAEACAECCA"
             + "ECCACAEACCEAC?CAECCAEACCEACAEACCEACAEAEACAEAEACACCEACCCAEACAEACAEAC?EAEACACACAE?CACAEAEACAE?EACACACA"
             + "ECCACCCACAECCACAEACACAEACACCEACCCACCCAEACCCACACAECEACACCCAECCCCACCCAECCACCEACCEACACCCACCCCCCACCCCACC"
             + "CCCACCCCCAECCACCCCACACCCCCACCCCAACCCCACCCCAACCCCCACCCCCCACCCCCACCCCCCCCCCCCCCCCACCCCCACCCCCCACCCCCCC"
             + "CACCACCACCCCCAACECCCCAACCCCCCCACCCAECCCCCCCCACCCCCCACCCCCACCCACCACCCCEACACCCCCACCCACCCCACCCCCCACACCC"
             + "CCCCACCEACCCAEACCCCCACCEACCCAACCCCCCCACCCCCACCCCCACACCCACCCACCCCCCCCCCACCACCCCCCCCAECCCCCCCCCCACCCCC"
             + "CECAACCCCCCCCACCCCCCCCACCCCECACCCCCCACCCCCCACCECCACCCACCCCCCCCCCAECCCCCCACCCCCCCCCACCCCCCCCCCCCACCCC"
             + "CCCACEACCCCCCCCCCECCCACCCCCCCACCCACCCACCECCACCCCCCECCACCCACACCEACAE?EACAEACAEACCEACAEACAEACAEAEAC?EA"
             + "EACAE?E?E?EAE?EAC?EAE?C?E?E?E?E?E?E?C?E?E@E?C?E@C@E?E@C?E@E@C?E?E?C@E?C?E?E@C@C?E@E?E?E?C@E?E?C?E?E?"
             + "E?E?E?E?C?C?E?C?E?E?E@E?E?E?E@E?E?E?E@E?E@E?E?C?E?E?E?E?E@E?E?E?E?E?E@E?C?E@E?EAC@E?E?E?C@E?E?E@E?E?"
             + "E?E?CAE?E?E?EAC?E?E@E?E?E?EAE?E?CAE?E?C?E?E?C?E?E@E?E?E?E?E?C?E?E?C?E?E?E?E?C?E?E?E?C@E?E?E?C?E?E@E?"
             + "E@E@E@E@C@EBC@E@C@CBEBCBE@CBC@CBCBCBCBCBCDADCDADABAD?BADAD?BAB?D?BABADABADABADABABADABABADAD?D?DAD?D"
             + "?D?D?D?B?D?D?B?DAD?B?D?B?D?B?D?D?B?B?D?D?D?B@D?B?B@D?B?B?D?B@B?D?B?D?D?D?DAD?D?D?DAF?DAD?D?DAD?D?D?D"
             + "?B?D?B?D?B?DAD?B?D?DAD?D?DAB?D?D?D?BADADAD?BCD?BAD?B?B?BADABADAB?DADADCD?BCDADAB?DADCBADABADABADABAB"
             + "ABCDABADABADABCBADABADABCBADABCBADABADABADABADABADABCBABADCBABABADCBABCDABABADABABCDABABABADADABABAB"
             + "ADABABABAB?BCBABABADCBADABCDADABADCBABCDADCDABCDABCBABADABCD?BCBADCBABABCBABCBADCBABCDABADCDABCDADAB"
             + "ADABABADABABABABADABABABABABADADABAD?BABABADCD?FADCLELAH@D?F?D?F?J?D?F?D?J?PBTBF?FBL@H@RDJ@NBLBD@FBL"
             + "BPDF@D@D@F@LDPFPFLBD?FBNBH@H@F?H@NBZDP@H?F?NBH?L@R?PBV@JAH?DAF?D@L?D?V?PBF?P?P?F@D@N@F?D?D@F@F?B@N@H"
             + "BLBD@B@LBDBH@RF@?H@B@D@PBR@P@HBXDRBL@H@H@FBR?F@B?F?F?F?NAJ?D@BAR@HAJ?D?B?T?FAB?LADBD?J?D?BAD@JAL@JAN"
             + "AFBZ?H?@?B?@@B?@?B?D?D@^@h@DLAl@Fj@Fj@D^Fn@DJ@F@B?@@J@B?B@@?B?@@J@f@DL@h@BL@NA`@AV@F?L?B?BAB?B?B?B?@"
             + "?@?B@X?\\?l@ANANAN?`@A\\Br@@R@T?f@HPDLDn@TTFVHVH\\N`@T`@Nn@VNH^Pp@Tl@Xj@Vn@X`@RNH`@TPJNHb@PNF`@N^PZNd@N"
             + "HDf@RRDVLXNZN@?@@DBBBHBRPd@Xb@RTJPH^N`@RVHNJ^Hj@Pf@RPHF@`@TVJh@LVLHDf@RZN^\\^TXN`@VTP\\Td@Z^V^NTTLDFJJ"
             + "HLHB@@??@@@B@@@@@B@@@XTb@Xf@VJJLFb@\\`@\\b@\\b@ZLJb@^f@`@\\VNLJHf@b@RJRJLLTNJF^TFDZT^T^\\^\\\\XJJNLV^HLLRJR"
             + "FHFH@B?@BD@?@@@B@@@B@B@B@BBFDHDHDLBF@DBHBB@FDJDHBF@D@B@D@D@BBDFRFNFTFPPVHNJJDF@BBB?B@@@@BD@BBBHJDHBH"
             + "DDDFHHDHNPDJBBBFBB@BB@@FBBBD@BDFBBBDDFBDDDFF@DBDHHBFHNFHNRHPJNLTHLDLBDDFDLDJHLPRBFFHDJBFDHBDBHHNFPB@"
             + "@B@B@@DJBDJNBJDLBDBFBFBF@DHLFHFLLTJRBJFHJRBBDJHRJRDLFNBD@D@@BFBFFHDNHJLVNVN`@HRR`@HNR`@LRR^X\\Tf@LTX^"
             + "VVLN^\\ZXLR\\Xl@\\n@Xb@Tb@Pd@TRHh@Td@Td@Xb@Rf@Tj@RVJt@Xf@X^NTN^TTH\\NLNd@P`@NXJHBL@@?@?L@ZLh@LHBp@JNBv@L"
             + "d@LPFb@RPH`@Z`@b@\\h@\\h@^h@\\`@NNb@Zb@Xd@Vd@Vd@T`@LLBTJPDf@LPBp@JTF\\@N@P@JDFBHBDJ?FAHAPKPKNMFOTWZW^EHU"
             + "`@QR]\\c@\\a@Za@PGBe@LKBi@POBq@T[BYFIHER@NFPTHVLf@T`@Nb@R`@Vl@Vl@Vj@Zn@Tf@Xd@Td@Nf@LR@f@Bh@?h@?h@?h@?R"
             + "?h@Ah@Cj@@T?j@Bf@@N?f@@D?BDIHE?g@Aq@?Q?g@?i@@W?s@?u@?q@?s@?m@?o@Cm@EWCUEe@Sg@Ug@Wg@WQKc@Ua@S_@Sm@[g@"
             + "YKGGGa@Sc@MGCe@GC?C?E?EACAGASCc@Gm@Io@Kk@Kg@Kc@KMCi@Mi@M]Im@Mo@M[Ge@IUDOLCJAHBVNPJBLBn@Ft@Lb@Lb@Nd@P"
             + "f@Rl@Rl@VTJn@Vp@Tn@Vn@Vp@TXJp@VVHr@Vn@Vn@Rp@Rn@Pn@Nn@LXDn@Jp@Jr@FXBp@Fr@Br@BZ?r@@r@@r@?r@Cp@Cn@El@ET"
             + "Ch@Gj@Gl@Kl@Ml@Ol@KVGn@Mn@Mn@Kp@MXCn@IXEp@Gp@Er@Er@Cr@?r@?r@@r@@p@BXBp@Bp@Fl@DTBl@Jj@Ll@JTFj@Nh@Nj@P"
             + "RFh@Rf@Th@Pf@Rd@Rd@PPHf@NPFd@Ld@Fd@Ff@Dj@ARAl@GTGTGj@Sj@YROPOb@a@NQ\\e@Zg@LSXe@Ta@JOV]\\c@FINSN_@Tc@FK"
             + "Za@`@_@j@_@NKPKd@Wb@W^WJMHODS@QAQQa@]USESCk@Bi@Hi@Lm@Pm@NUDWFq@Ni@Jg@JUDi@Le@Le@Hg@Da@@WCCGCE?CHId@E"
             + "JAd@I\\Kp@Q`@MPGPGb@Qd@Md@QRKf@QTIh@Oh@Qh@Qh@OTGl@KTCR@l@Dl@Dn@Hf@Jp@Jh@Td@Xd@\\b@^RLb@Vb@V`@d@`@Zb@Z`"
             + "@\\d@Vb@\\d@^d@^d@\\f@^PNf@\\b@^`@Z^Z`@Vb@ZPJ\\X^TVXL`@DPBTHr@Fl@BNBLFJPZHNXZZVZTj@Zn@V\\LLDp@LL@^@h@Fv@Ad"
             + "@?TCb@?b@?d@Ed@EPCb@ATAL?\\Cn@ANCn@G\\CPCNAZEh@EPAb@Ad@ETAd@Cb@APARAXAN@Z?LAFCF?NAJ?H?F@DAH?FAPBJ?f@BV"
             + "Jt@^PHb@PRFj@Nd@Lj@R\\HRJLH`@NLLf@XTFTJ\\JZP`@Vd@R^LTPn@Pj@PVJd@Ll@?VBb@?T@f@CX?VEn@Cf@Cl@GRGn@Gj@Gj@I"
             + "j@IXGn@MVGVIn@Sn@Un@YVMTKVKn@Uf@WXMb@UPKXMZMZKVKn@Yh@M^]b@UTIJIREHAN?X@L@JB^V`@P\\TJD\\Xn@`@\\Td@Tb@Z`@"
             + "Tb@VPFb@NPHd@Ld@P^RNDl@PTJd@HD?DA@ADC@ABCDEDOEOGOK[OUYc@K]Uo@Ee@Mm@Ia@GYIm@@k@@i@@i@Bk@@UBg@@SDg@BSF"
             + "i@Fg@Je@Ni@@CA?CB?@ACBGFK@GNg@Pg@FQNg@Pk@Rg@Tg@Te@Tc@X_@Xa@\\e@Za@Zc@\\c@LQ`@_@b@Yh@[h@WRK`@YPM\\Y^_@`@"
             + "]`@_@^_@^]`@[`@_@`@_@`@_@b@_@ROd@c@d@a@d@a@RQf@a@d@a@f@c@f@_@b@_@^Y\\UZWNM^W^[^YNK\\Wj@_@LKd@_@d@]f@]h"
             + "@]LKh@]f@YHG`@Sf@Wd@SNIn@[`@S`@Ud@Ud@Uh@Sh@Sh@Uj@Qj@URGf@Ob@MNE^Gd@MNEDAXKj@Mj@MPEb@Ih@Kh@Ih@Ij@Il@K"
             + "p@If@Kh@Ej@El@Cr@Cl@Ep@Cp@Er@At@?p@Ap@An@@l@?R@f@Bf@DR@h@Bh@@f@@h@@f@Bj@Ff@Fd@BL@j@Jh@Dp@DZBd@DVBV@V"
             + "S@Q?KDi@@QFo@@QDu@Fu@@e@Hi@Be@Fg@De@Bg@@QDu@Fs@Bg@@G@Y@IBQ?A@@BEBM@SHe@BMHo@@S?S@c@@c@Be@Bq@Ba@Fq@?K"
             + "@g@AGQEKCMCg@Em@Mc@C_@Gg@Eq@G]G";

    private MumbaiMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - CSMT");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Bombay Gymkhana / MG Road");
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
