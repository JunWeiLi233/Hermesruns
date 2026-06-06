package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class PortoMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Porto Marathon 2026 course map from porto-marathon.com, cross-checked against the Finishers/Kavval Maratona do Porto GPS trace";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 12;

    private static final String ENCODED_ROUTE =
            "uxgzFpy_t@|AnAHd@Dd@@n@HZ\\h@ZN^BTC`@STa@Jk@@{@Qi@Oc@c@q@Ei@Fs@PsBRkBv@cJnA{M|AqP~A_QvAaOp@cIM]WUc@@qB@gABeAEqBkAsB}Ac@S[?sFfBeAVg@MU[m@aAYSUDYd@gBvCy@~Bs@dA_ExFIVP^`@t@l@fAp@fBVnA\\"
            + "tD\\tETxDGhAYrAk@dBa@NeALsCf@m@FiDT_DPgE\\yCPU@[ISFQJqDXiBD]MUCOHE\\HXTHVSNOf@AjFWX?VH\\UhGa@vDS|BQhBIbBAdBVPZAj@[`A}AvDcAhCs@pCAfCLjHX~JEn@IVa@t@w@d@m@B}Lx@KR?h@DxAIJMDoIh@qHb@Q@IBQZC"
            + "Pa@^mDbDeI|HwEnEgE|DmDjDO?WAOQ{CiFgBuCaAkC[eAE[@SNWZk@j@w@Py@ZSPJ@Z[n@u@pAkCdEy@`A{CvDsC`DyBfBOF[EKQIYIo@@WHUXOh@SXEVNb@^j@p@fB`DjFxIbFvIb@bBJlBChAGn@YfA_@~@{@~@wA`AiCjCeCjCeAp@oAf"
            + "@yCt@yDvAmBrAw@v@eCxB_@VqAx@sCbBoAx@qF|CkHpEmAp@DNlC}AhC_BlBiAjAu@~CmBvEuCfBeA~CiBfBcA|FoClCyA`B}@`Ay@hDoD~AuArA_An@q@p@wATgAPeBGkBa@gBa@}@wJsP}DgHSq@Mo@Um@Mm@_@mA}@yByAuCoAkC_B}Cc"
            + "AsBsAsCq@oAaAyAaAwAW_@[e@OCOFEPDX^p@`@Zl@b@x@t@n@dAxBlEjBxDtCbG`B`Dh@zBFlAEl@[Vq@`@c@`@UHQRER@d@Jb@Nf@T\\P@PKPWd@c@vAgAfAiAdAiA`AiAdDeEjBsClAkBr@Q`@?TUAWO]Ug@S[a@?UVSt@i@x@c@NWMOc@_"
            + "@qCOiCAaEEuMFqBF_BC_AKkAG_COuBMs@Y{@kE}IIMIFEJPLLRnDnHb@nAR|AFjCG|@GtAJlAJzA?rDHbRHpA`@jD@t@Bb@P^T`@v@jC|@jBrAdCzBlD|@xANJTAHc@bE}DhDeDvBuBzEsEfF{EhDcDXO\\INg@`G[lHi@pCQnHe@ZGzAiAt@"
            + "e@`@I|@Bb@Gd@_@Nc@Z}@n@e@xBuAzCeB|Am@fAIf@?fARvAx@jA|@lAz@\\f@Fd@Bl@Fl@\\h@XTt@Fb@Q`@g@PcAFq@V[\\Sh@S`FcCrGyCjFgCfD{AxDiBtIcEjAi@\\WzKyI~HoGrDwCtA_AdAw@`Ak@rA}@lAm@dBeAt@g@dASl@KLIpAqB"
            + "lB}BfAw@d@[h@aAVo@HgAAu@AwAEgCT_Ad@uAJu@?oBB{CD_@rD{Mz@qCfAuDHu@McAi@wAy@eCUiBCe@?_AJkAdBuOT}@~@uDJk@T}Bb@eE?}@O_A_AaCcBmEsAcDs@}AKe@CQG{@FoAVyDVwEn@qIDiAIq@m@sCc@iCMeAGkAAkB@iAJ{B"
            + "V_DPgCNcCJsBAgBI_BEUs@gFOsA?kCFiAFwCJaFL}BHy@LqAx@qEv@yDXq@Ti@~D}IXk@n@y@p@kAtA_C^_An@qBPy@NiAHkABaA?iBGqBGeBCqEH}@Nu@nAaG|@eEp@iCVq@l@oAf@q@~AcB`@k@vAaCzAmCjCiH`AsCHi@@i@F]Hk@Pq@H"
            + "{@Es@Gg@G_@@MNUHQKgAE}@ImAEa@MkC?IWeDW{COkBKg@CKHa@Be@QaAq@gFa@kCOcAg@gD[uCOwAAeAD{@Dm@GiCIgBSsCOeCEw@@sAL{Bd@kDp@aCxA}DjAeDpAyDp@mBP_AF{@@uAQqDSgGSiEOeDKu@a@{Ai@_Am@cAuBgD]g@qBeBw"
            + "AgASSEF|CdCv@z@l@p@jAnB`BhC\\p@XbAN~@NtCPrETdG?TNzDElAMjAu@dCaBpEuC|Hi@pBSbAQzAYdCA`CBx@PbC^|GDlAIjAAlAPhCj@lE`@pC`@jCPlAb@bDJv@EdASx@_@|@Qv@}@lLALXjAR|@n@lCn@hCJp@l@nCF~@In@i@bBoCr"
            + "H_@z@qDhGc@h@_AbAi@l@Y`@e@dASj@g@`Bi@dCaCbLGd@Cz@DrEDhAHtBAtBGpAOzAWjA[jAm@xAe@z@mBzCe@l@i@~@oAtC{BpFYt@YpA]~As@fES~AIbACt@El@M|GI|CCdCLhBZxB\\nCJ|A@hBItAG~@s@hKIjACzCFvBRvB\\pB`@bBT"
            + "nAAh@GzAMdB{@hMKlBKbBFx@TbAbAbChApCfBnEj@|APx@?h@?n@_@rDW~BO|@o@~B]vAK|@yAzMI`ACnABp@J`AZfA`@jA^hAPp@Fr@Kr@]pA}AbFuD`NENC|BAvBGlAe@~ASz@ENDhCDfCIjAa@z@e@n@c@Z_At@mApAq@bA}@vAMJc@Fw"
            + "@L_@LiBnA_Ab@{@b@wAbA}@d@qBxAgAz@k@b@yC`CgDjCaDfCeEfDiDhCSPoCpAuEzBoClAeEnBwEzBoGxCoFfCkCnASF[?KOIQIMMSCS@]BUDc@P{AHaALuAJeAJiADe@B_@?YGKKBKJOnBe@rESfCObBYZSHOHULMFMDWBSSkA}@}@u@cB"
            + "aAkAUe@AiAL_Bn@{CfB{BpAm@Z[G_@USWUw@GyCKmDEmCCeAFa@RW^IvA[l@UJSBc@BuADiA";

    private PortoMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Sea Life Porto / Castelo do Queijo");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Queimodromo / Parque da Cidade");
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
