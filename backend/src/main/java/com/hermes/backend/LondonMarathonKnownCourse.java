package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class LondonMarathonKnownCourse {
    static final String RACE_ID = "london-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.londonmarathonevents.co.uk/london-marathon/course";
    static final String OFFICIAL_SOURCE = "london-official-course";
    static final String SOURCE_NOTE = "Go&Race 2026 GPX cross-checked against London Marathon Events official course page and 2026 road-closure route leaflet";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 1;

    private static final String ENCODED_ROUTE =
            "yidyHkgA_@{F_@}F_@{F_@{FUmEWmEUmEYiDWiDAMUsBUkCUkCQuAIQi@_@K]E[Bk@Ry@@c@?y@[_E[_EI}AEgAGiEAuAHcD^uFTcDVcDb@iFb@gFb@iFFgB"
            + "D@KOgCsB}CiCsBkBY]o@iAeA{BKYWaAa@mBY_AUq@y@kB_BgD[u@a@kAOUCa@OkBS_FCcAAwCe@gFEYIUGc@YqA{@eGm@oEUeEUwBu@qI?_@k@yFMcAQmAwC"
            + "{NeBcJIUGUSoAEe@e@U{@MmAQq@@[@UC_J{Bs@Ua@QgAa@sAk@@IAHWKUDQCS?k@J]NgCnAuAp@aATqBTeBTgAViC`AwAv@i@XyA`Am@Vc@Fe@@[E_AWK@WF"
            + "KRMfAAL@b@RrJD^BVFb@Jb@Ld@f@nAJZJh@Dj@\\nFAlAF`A?j@CzC@vAL|Aj@|BFRXbAVdANtA@NBp@?l@Cv@y@tSEv@QzBA\\\\|Bf@rBvA`Fn@`E`@jBv@bC"
            + "L^FRtA~CV\\PPH@HJBP?LJVbBnHpC~KL|@L~ADTJZFFDHBN?NANNb@Lr@l@zFd@hEHNVtBFr@NfCDb@HfATlCB~@B\\PvEJpCBRHtB?h@ZhGLnBFd@NdAPl@Pj"
            + "@Px@Fz@BbA?z@G`B@TIzBAR?bCBvAB`@FLP|BBJJPJHFDFFBHBLALEVKPGZAN?NJlAJ`BCf@Ft@PnBNz@J~@D`@Dz@?^?n@UdECdDEpEQlFAxBAdBHxAN`AN"
            + "j@t@jC\\|Af@dCTvAT~APtB`AtEr@|Cr@~CfAxEhAxEb@fCh@rE\\pBXvAj@~Bj@~BAGr@zCr@zCj@bCj@`Cd@lBJd@Cb@o@`AwBbBQFcBdAaBdAFv@jBIvBr@"
            + "hAHXFN\\@vCAjFAjFDlDFlDD~FF~FTxETvE\\jG^lGHVBh@?ZCf@Gj@_@xBSRs@zEi@nEMx@G\\Qz@S`A[hAiBtFmDhJgBnEaAdCa@~@]j@oClDk@dA}@lAa@j@"
            + "MTwApBeArBy@lBy@lBy@lBYn@w@pBw@pBw@nBw@pB{@lB{@jBcAjBGH_AzAcA`BaA~AcA~A_@n@cA|AaAzAy@lBy@lBs@~AQTU?i@m@a@aBu@qBu@aA}@y@o"
            + "AaAECMKSIITCHE|@E`@GVMb@U^Yd@KJo@^a@NWHUBI?K?c@GwCq@a@Ea@?g@H]Ni@Va@O_@e@[]o@Yy@Yi@m@g@c@Qm@Lc@n@yBn@yBp@yBn@yBRs@v@w@xC"
            + "c@xCa@|@i@?eBAGSsAa@cBo@iBgBsDyAiCiB_DgAaBu@_A[SoBs@c@G}@CsADu@FeC`@{AR_BL{ARuANgBZaAVe@Rc@ZcAbAm@jAa@`A_@|AQbAUhCEjA@dD"
            + "FbDJzB^hEj@|Dv@zDp@`Ct@zBN^hBrDhBtDrAfCtAfCvBdE~AdCnAtCpAtC`AzB`AzBf@pAHXHdAEvBNt@r@BZhAJrAClBJlC?HNlCD~@LnCLlCJlBPvAPjC"
            + "RlC@PRlCPlCPlCJxAJnCBn@EpCCrAKjBWjCGj@g@~B_@~Am@xBK\\[xAy@nB}@jBWh@s@jA[z@WlAe@bCAF[zAw@nBw@pBw@nB[t@aAbBq@lAk@d@sAo@k@Ye"
            + "CyAi@[LHqCaBqCcBqCaBqCaBk@[GISME?oBMaC]_AMq@c@QYpAqFz@aE?wAe@aGYcC]kBg@cCg@aCa@cE@}AHiEAsC?uCI_GG_GOmCOmCOmCEy@GoCCgCFoC"
            + "FoCBaAAoC?_BCgBCoCEoCCoC?QAqCCoCAoCAoCAoCW_Cu@cEQkFQkF]yGDeAt@[DCFMHuE@SJsDLoDLuADy@?Kb@iEj@oEZgDJu@n@{CF_@XmC^{CBq@?a@A"
            + "_@Ky@aAuESgAC[]_F?OHaC@oBE_@QaAt@[f@DlAt@DBPL|A`@ZJPDzBVvA[l@OxAAt@?b@[Ls@Zs@tBwC^[ZMb@GpA@r@AXJ^CFCF?zCb@bDL`CPn@?|C?xB"
            + "KzBIbBCnAI~AE~AEhDSjDQJC|AmB\\Q`@CnBG~CBNArAi@dAk@rA{@dA}@lA_BnA_BpAiBrAkC`@aA|@cC|@aCnA{DpA{Dz@yCb@cBf@}BPyBLwDA_DIaBcAG"
            + "eCHo@J}@\\cBtAa@Hu@Fq@Ci@Ho@VQHk@b@m@NQHsAH_BI_BImCWkCUmCWkCUuAIm@?_AFkAGi@KcBm@i@IgDYgDYeBd@g@rDYbFWbFWbFWbFs@vFs@vFs@lG"
            + "I^Ql@S`@_CtC}BtCa@NgAN{@DF?}@KCSH_BNcDZoFRkGTgDJaAHUHKTBRKHw@P{CVgF{Aa@u@GOK[CaCe@_Cc@RgETgEH{@DOLSNQ\\GNDF@b@p@EpC?\\tAd@"
            + "lA`@v@DNoCLmCNmCnAIPkCB]yCi@yCi@MBY`ACd@M^UEi@_BwAkCiBkCu@{@c@]e@SgBi@W[EIAQCy@Fm@Ag@@g@Aw@Km@M[WYOc@MiAKe@O]KK[KSFcA~Aa"
            + "A`BwAtAMjAAfE@b@IbDGbDEbBAxD?zDGvEAnFEnDSjD_@rEQbEGxBCLFA`@dFb@dF@lBk@bCmAzBc@nBcB|BaBzBcB|BoBpDaAxB[z@QbB@jBN|CUdFM~FI|"
            + "FBp@ChAGRMfGKhGF`@API^A^EvBDV?h@I\\C~BFnAl@t@fB|@fB|@XHzABr@T`@nCLdDNhEPjEZjB\\lBJ`ABrAFbC@nCBnC@pC@nCBxBBnCDnCBnC@H@nC@x@"
            + "InCGnCEpAFnCFlCPlCJpCHnCJnCH`CBnC@`B?nC@pC?l@CnCCpC?HXlD\\nBj@jCj@lCXpC^pEBh@EjASrAy@jDm@nB{@hB{@hBe@xA@t@H`AZvBNdCJlE?h@"
            + "WdCKvDDz@p@vBPj@X|APlC@LEdBYtEWbEWdEWbE_@~EGPMrAe@~Dw@nDi@tFM|@]zC[|CAl@WtDUvDGhDEzBAfE?fE?vE@vEd@dGA`ECzGE|GCzGC|G?hEAj"
            + "EDbGJlCLnCVbDXbDFTJ`AAVBJr@bFz@hEhA`FDHF@vA`DbBrCrArA`BvAdBrAx@l@vAz@f@`@j@Vl@^dCp@`BPvCj@xCj@|Bh@~Cf@f@@FHfANHrEEbDC`DO"
            + "vEOxEOvEZtGXrGZtGVhFThFVhFVhFsBrBuA~AM?SOUIYEQDIEIKAG}@yBu@qB";

    private LondonMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = decodePolyline(ENCODED_ROUTE);
        setLabel(routePoints, 0, "Start - Greenwich");
        setLabel(routePoints, routePoints.size() - 1, "Finish - The Mall");
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
