package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class MarrakechMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Marrakech Marathon 2026 GPX from marathonmarrakech.ma, cross-checked against the official 2026 course map image";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 5;

    private static final String ENCODED_ROUTE =
            "qv~_Ejezo@h@fBHV@???Rp@lAxDp@lBRt@HV`AlCj@hB?FBd@D`@u@^mAr@}@h@OHA?mAr@eAl@GBw@d@y@d@mAr@oAr@@D??AEe@Xg@X}@f@??oAr@mAr@m"
            + "Ar@mAp@oAr@mAr@mAr@mAp@oAr@_@T??_@RGDiAn@mAr@kAp@QHKRJTBVVClAs@lAs@lAs@nAq@lAs@lAs@lAq@nAs@TOlAq@nAq@lAq@nAs@lAq@nAq@lAs"
            + "@nAq@lAq@nAs@lAq@lAq@nAs@lAq@b@UVCPRJPHL\\x@f@|Af@~Af@|Af@|Af@~Af@|Ad@~Af@|Af@|A`@nAf@|Ah@|Af@|Ah@|Af@|Ah@|ATr@FRNDHG\\S"
            + "lAq@nAs@lAs@v@e@lAs@lAs@lAs@lAs@t@c@j@]\\ULQLML?VIh@[lAq@lAs@nAs@lAq@lAs@`Ai@lAs@lAs@l@]jAw@v@i@LQDOLu@Ay@KUs@uAs@uAs@uA"
            + "s@sAu@uAg@eAu@uAs@sAs@uAs@uAu@uAs@uAs@uAs@uAu@uAs@uAi@cA[BmAp@oAp@mAr@oAp@y@f@WV[^Wh@I`@O`@C\\Ej@EXKj@Sh@Sh@e@r@a@f@}@f@"
            + "c@Va@Hm@Bo@Do@Ik@Io@Sa@W_@Ak@C[?YH]Ng@XoAp@mAp@mAr@_@RMLQPOKKQKUWD]N??mAp@oAr@mAr@mAp@oAr@mAr@mAp@mAr@oAp@mAr@mAr@oAp@mA"
            + "r@mAr@oAp@mAr@mAr@oAp@mAr@mAr@mAp@oAr@WN??k@P??Pb@@P????PD??lAq@nAs@lAq@nAs@NI??lAq@nAq@lAs@nAq@lAs@lAq@nAq@lAs@nAq@lAq@"
            + "nAs@lAq@nAq@lAs@p@]??lAu@lAs@lAs@lAs@HG??VN??Tn@??f@|Af@~Af@|AHR??f@|Ad@~Af@|Af@|Af@~Af@|Af@|Af@~Ad@|Af@~Ad@xAd@~Ad@~ATv"
            + "@FRFd@OPoAr@iAn@oAr@mAr@mAp@oAr@mAp@mAr@oAr@mAp@mAr@oAp@mAr@}@f@UFW@[LmAt@QJMRQRmAr@mAr@oAp@mAr@mAr@mAp@oAr@c@V??UC??SJO"
            + "VBRNLJALEFIDSLGlAs@lAq@nAs@lAq@lAs@nAq@lAs@\\Qf@Q??f@WVM??XShA{@@A??nAs@lAq@nAs@lAs@lAq@nAs@lAq@lAs@nAq@lAs@lAs@^SlAq@nA"
            + "q@|@e@??lAu@lAs@jAu@lAs@lAu@lAs@lAu@lAs@|@i@??nAq@FCXKXVLNJ\\^`B^bB^`B^`B`@bB^`BXlAJVB^CVEJmAv@kAv@kAv@mAt@kAv@kAv@kAt@m"
            + "Av@_@Vl@zAVp@?NSNiAv@kAx@kAx@kAv@kAx@IDWWi@oAEKIGu@MGAkAv@kAv@kAx@kAv@kAv@kAx@kAv@kAv@kAx@kAv@kAv@s@d@kAt@mAt@gAp@kAv@kA"
            + "v@iAx@kAv@kAv@kAv@kAx@kAv@g@ZYRg@^YLKHULQ@SDONAPBRDN?PKp@g@|Ag@~Ae@|Aa@pAg@|Ai@|Ag@|Ag@~Ag@|ASp@g@~Ag@|Ag@~AQl@KZIVOXMTM"
            + "PKBMCIK?a@FgBDiBFgBFiBFiBFgBDiBFiBFgB@[@kAFiBFgBDiBFgBDuADiB???k@Ai@Cq@Ec@Is@]cB]cB]cBI_@[cB[cB[cB]cB[aB]cB[cB]cB]cB]cB]"
            + "aB]cB]cBCQ]cB]cB[cB]aBO{@W{@Q[OGOMKSOA??]???wAPwAPyAPwAP[DwARwATOBwATwAVwATwATuATwATy@NwARwATwAR_@Fm@HWDwATwATwATKBwARwA"
            + "TwATwAT_APaFt@{@LqATaAP{@HqANuAP??YDiBPcBPe@FmBVu@HE@y@HwFn@cC^eAPe@HU?g@CGAE?A?E@a@Ca@EaD_AEA}Bq@kCu@eCs@{@[ICYKGA]ICIB"
            + "AC@CIGGGEE?IAGBCAi@EUGaAUgAY_HoBiBq@wBmAm@a@CCEGCCGAG?w@a@wOgJk@]CAqI_F_@USKCCsEoCw@c@aCwAk@]kAu@wCgBKGGCIGWO?G?CEIEGGEI"
            + "CI?GB_@UEC_Ae@uBmAk@i@eBwBII_EgEuG}GUWWYuB_CyEgF}AcBmAqA}CmDkF{FoAsA]_@AKCEEAEAQScAgAmAsAMOUWUWMM}@_AUU}@cAuA}AoC{CKMg@o"
            + "@BM?MCMEMIIAAGCMCK@KBWUMKi@k@gAmAII{EgF_@a@qAoAo@g@g@]]Uk@a@o@a@kHoECIGQG]G_@AQ?Q@S@ODOBE^]PSRQZQFCVK\\KTCX?l@F`B^h@HXBT"
            + "@??\\@dAG~AQnBQdBQZCRAl@Af@Ar@@bGBnKDj@BNAp@Ap@Gh@Ir@Q~BiA`@SHGh@Wb@Qb@K`@Cb@?tCPfBHB?|J?xA?zFAvACn@CHAdE_@XEfFo@zEg@dAM"
            + "r@KZIx@Wf@[ZYRSDE^k@l@kAdAgCdAgBT_@HQP]rA}Bt@qAXc@^i@f@i@r@i@`@YLIJGz@]PIp@OnAOz@E~@AhADz@JbOdBVDXBd@FxAP|AT~InA|@LtJpAh"
            + "@Fv@L|@L`Fp@pEp@j@JRBh@H\\LlAVvAPxAN`@FpANl@?r@?bAYAEzBeAXOLGLKPSLSR_@Pk@To@JW~@eCHOJOHKl@e@DGtFqEHKb@k@jAaBTU\\_@NQJMb@"
            + "y@j@iAdAuBNW??RY\\e@TO~As@h@SVUj@STM`@WLMFIlCyCXS^OPG^E^A\\Bd@?RAN?^E`@ITGNEZOFELOP?l@w@n@m@RWPW~BgEN[Re@LYRg@FSHWXiAv@q"
            + "DPg@HSR_@PURQnA}@p@c@ROJEd@W@Ah@W^O@APGDCBA`A]`@MlBi@z@WVKTMzA{@hEgCHETKdAi@nA[VEp@AFAvADVBFXBHx@vBXt@Zt@Xr@Xv@Xt@l@~Ad@"
            + "jARZOt@ANBPFDFDJBJ?NENM\\_@DGx@eAh@o@LOt@u@t@e@h@Wr@_@f@Y`DaBx@c@h@a@DENKD?N?d@NPDhAj@dEtBpC`BjAz@\\VbBvAdB~AtAxAv@z@NJ@"
            + "?NFJBf@BFANG?BHLLDJ@FADCFGTGxB}@h@UFA|A_@t@QHCPE\\GbAUj@MJCLE~EiAb@IRG`ASVI`H{Ab@Mp@MpFoAbAWfCi@|Bi@XGfCk@HARD@@JHJPFHJV"
            + "FNHp@XtBPjA~ApM~ClXl@tEb@hD|A~Lf@|Df@hE\\vCPlAGl@CDCFAJ@HDH@@Df@A`@QfDMfCOfBAP\\TrAd@rAd@rAd@rAd@rAd@rAd@rAd@rAd@rAd@rAf"
            + "@rAd@rAd@pAd@nAb@^KlAs@lAs@nAs@lAs@lAs@lAs@DCDL??mAr@oAp@mAp@oAp@mAp@oAr@mAp@_@RAE]NoC`Bc@TmGjDkGnDgItEgBdAOJcGdDkCxAEB{"
            + "@b@IIEEQKSGSCSBSDQJMLIJGLI\\AN?N@NIJCDo@`@{A|@yCbBm@^k@\\m@\\wAz@w@^o@b@gCxAm@`@i@VwElCIFEBOHKFGDwAz@g@X_Bz@iBdAy@b@e@N["
            + "DG@[?a@GsAa@g@Oa@E]Ew@@g@Fi@Jq@VQLWN_@^UVg@~@O\\Sz@Kn@Gz@Ox@K\\GNW^QRUN_Al@wElCKDMHYLC@MU????ACWa@k@iBaAmCIWSu@q@mBmAyDU"
            + "q@IWk@iB";

    private MarrakechMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Avenue de la Menara");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Avenue de la Menara");
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
