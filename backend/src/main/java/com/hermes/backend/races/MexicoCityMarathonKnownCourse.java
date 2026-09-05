package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class MexicoCityMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Mexico City Marathon route poster from maraton.cdmx.gob.mx, cross-checked against the 2024 Wikiloc route track and published street-by-street route descriptions";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 1;

    private static final String ENCODED_ROUTE =
            "yx~tBx`l|QsDVWUM@c@@UAOC_@Ks@Bq@@}@@{B@cBF_ABaBLw@DoBL_@BUHIBEBK@O@wAHi@D]BBK@KDSSDSBSB?k@EMGMmBaAc@]QMMK_ByCi@eAyAoAQQMYSeAOo@OYQMUGg@GYCYM"
            + "WSS[S]a@]ACq@w@o@{@[s@Wi@q@{@]k@GSAK?g@AUGKIIMC_@Ii@SmAw@q@QaAMk@Eo@G_@Gw@Os@c@QSe@Ia@OyBaAUIoIqDI{C?KE_B@[]Ky@k@e@a@q@w@wBiCg@q@OOcCwCWOmAi"
            + "@UMSKq@{@}DcFYYa@]{BaBiDyCgB}AYWkAeAeA{@_Ag@}DoAYKeBi@{Bs@c@Oa@OcC_Aa@QsCiAc@OKGo@[e@WqAi@uAs@c@WECOIaDaCs@e@cJeFs@c@WMUOuAs@sDmBc@Yg@YaAi@m"
            + "@[iBaAe@Wa@UKGoDoBECCCOIOKeCsAGCmE_CeLmG{GoDsC_BmIsESc@MWOSUQiCg@m@M_H{A_AUuA]eE}@uMsBqCc@}F}@aAOmJq@sGc@qIYmHWu@EkFOyAGK?K?oLa@SAUASAqI]mA?"
            + "kAE_BI{@Ec@CoDI{EMI?{@EG?sEW}@CoCII?e@C[?G?qCM?LMA@f@QTAd@Q?[ASJm@NqBR_@FOHSHMBMD]JG@ODON]XmAQU`@[j@ON{@l@STQ^mB{@]QSAAW}Bb@gEp@_Ft@aDf@iBZ}"
            + "@Pf@jEBND^DVl@jF\\pCZnCz@rHyDn@_C^gCb@k@JeC\\MBu@Lm@LSD^pCh@bE`AlHBNSB[DMBoEr@QBQBcDf@b@`DZbCeDh@oAPy@JQ@BR?B@BZbC[cCAC?CCSAIACEYq@eFAIAGAGAE?"
            + "GI@E?GAI?CAE?EA?Cw@aGAGO@GAE?A?E@CWCSAGAIESYuBEa@Ky@EBGBACUHCBAEEIKFKD_Bp@q@ZOFgBv@w@ZQJ_C`Aq@ZE@BDAD?BC@E@GD[LABAD@PATCLSh@EJAHIBMFGBA@ACCG"
            + "GQKWEMCGAEAECEDCBE@CABCDEBBD@D@DBFDLJVFPBF@B@AFCLGHC?F@Fv@vBFPDJrBnFBJFLhAzCFNDBLBP@LBHDFFHCHCFA@A@?@BDNFP@BA?@B?F@J?F?H?R?DBHBF?@@DBD?@Xt@@"
            + "@@D@B@@Rh@L\\C@GBFLDL@B@DDJTl@pAjD@BDLDL@BBD@F@@L\\Nb@LX@B@T?J?RAH?HF@@?C`@?H?R@`A@AXz@DJjB`FJZ\\z@t@rBBJBFHT@BL^BD@BL^BD?BDHMJINEP?RDRDDBFVVJH"
            + "BBu@hAOTWx@Qt@CTGj@Cn@@h@@j@Bj@Ff@L`AH^Nn@HZRz@Nx@Jv@J~@m@@E?D?l@AJtB?`@PRZb@jAZJK\\XRFLHFBt@?rDD@NC@C@ADAB@B?DBB@@qB|AiAr@K@cAN_BFm@?BfB@jCD"
            + "nANtBNdANp@@CB@DBB?DADABC@E?Ej@?xAL`BJVBWCaBKyAMk@??DADCBE@E@C?ECCAABKNg@p@[j@P~A`@rDDb@ZtC@BBVG@_@@CLETCLA@kBAU?{BQ{B?_CS}@K{@MMAuEk@QJAHQt"
            + "BKlAC^FPHt@CVKlAJmABWIu@GQB_@JmAPuB@I@KBY@SQAGAGAI?GAMABSM?KAJIFKBKCSGWgAeDGBsHlC]_A\\~@iBp@DJUCsBQSzCUtCYxCoGk@aCU@P?~@?f@?H?PAPQ?ItB?LKzBA\\"
            + "AZCp@GdBwEQvEPAJP@N@T@P@@C@C@ABA?cA@?@????A???A??AAJUHSHOxBpAbCxAH?dCRl@DD@EAm@EAVWdDAHOlBC`@M`BKAKlAGt@El@HRe@Ci@CkAMqBbCmE_@OAATIhB_He@qBM"
            + "SfBCZ[|CEXYpCUA_@AO?iFGU?cIUiBGGxCE`DElB?^AbBq@YeAi@}@m@IEEAE?A?C@C?GBG@A@G@G?I?oAWWOe@AiCCWA?G@k@Aj@?FwBEQAY?qBAOAyBETmL?INwG@G@gA@s@DaDJD?"
            + "I?Q@O?KKEF_GfFHF?J?P@F?H?jBBJcK?UFaBRgMLeIBiABk@FkA\\WTOd@]^a@\\a@n@cA^s@JIJCJCL?|@@jEDD_C@gAB{@?K@g@?MDkBBsCBuB@]@]Aw@@cB?C?EAC?CAAAACAA?CAC?"
            + "Q?P?B?B@@?B@@@@@?B@B?D?BAbB@v@A\\A\\EBGF?B?DlABX?DADGnJDV?xB@tGLHqCP?BkBCjBGpCItDN?xD?dDHL?hEFlA@|@@PGn@xCHjDAlB?LLBJHDLLGdAe@|@jC}@kCfHuCXKTK"
            + "^EN@VBZFO}@XAX@h@@XATH`@?\\BTF\\BPqBFu@@UHeA~@aLDm@Hw@XmD^iEx@oKBODi@D]ZuDEQU]mCeBKQMWw@}Cw@yC}DlA|DmAXMFC|@a@LGISwBaG}@gC}@aC{@_C}@kCaAgC{@{B"
            + "_AeC_AeCy@{B{@gCcAiCy@aC{@{BM]Se@a@cAyBiGcBoEm@iBq@mBs@cBSg@l@}Di@Ou@O@IBIP}@Jq@\\{A@I@EBWKEICGCw@YOGQIUo@IUi@wACI_AgCQe@o@gBw@yBT?v@[w@ZU?]}"
            + "@ECGEOASCMA@WaCSJeBHoA?CA?E?CAC?gCUQCG?IAMAARGn@OfB[F_@HAHe@ELuADc@Eb@MtAe@E@IYO[SPkBDo@D]@ODc@KAIA@E?GDg@L{ABKFOHGJEJEJALAP?N@P?@M@M?EH}@@O"
            + "JmA@KJ{ANoBBU?S?Y?C?G@Q@I?O?QAQEWAEU_ASi@HGDGGUKYe@qAk@_AmBeDS]s@mAKQSYS_@c@g@{G_I_DqDW[PQPOHKIKCC?CFY@MDS@EDKAC?CCSEQEQGQIMKKMMIGCCACGCDIBI"
            + "@CNa@@E@EDMBI@KBY@KB_@BW?I?CBcA@Q?KDsA?C@g@@G?I?EHW}AM[EQABe@Cd@IAYCC?KAIAI?k@SsHq@k@GOCMGMGoAq@k@Wk@YYO@YLyCLqDD}@JaCFmABoAZ_GJiCHiBp@FhCPj"
            + "AHzALtALzAJjDVJlB?HVxDNpBDx@BjCBjAGnCAxFCpAI|CKXIV?DH@F@CXEtB?BAF?HlAJfBPE`@H@JBpC\\ANH@H@Gp@?BzARHBb@FAB?BG`@WhBABIl@ERALAF?BCLMbADBFBAFxBZD"
            + "@PBBM^DNBAFNGBDBDDBF@F?DCFCBG@GrAN?D?D@DBDDBBBD@D?F?N`BOaBDABCDEBE@E?ICICGGCnAeCB?@@B?@?B?BABA@C@C?C@CAEACCCAAtAmCB@@?B?@A@A@A@A?C?C?AACAAFK"
            + "N@BYRB@G@I@Q\\cEaBMOAKACR?B?CBSJ@Ba@HiA?KDo@TBhBPJ?P}B^yE\\oEZcE@I@KZaEVBzAJJ@j@Dv@FN@NB`@Bj@FJ?bAJ@KDm@@KB[JwA@QhDXdBN~@HQjC[jEGbAhBNATAJARCh"
            + "@CDE@MAICa@E`@DHBL@DABEBi@@S@K@UiBOiD[gDYUxCEd@De@TyCZmEFy@@KB[JwA@QhDXdDXX}DTcCB]HsAhBNN@OAiBOA?]COAWC}AM_DUKAGDEBABCAuA?aAAARAHG?CAE?G@M@G"
            + "?G@O@@DCXMdB";

    private MexicoCityMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Estadio Olimpico Universitario / Avenida Insurgentes Sur");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Zocalo / Plaza de la Constitucion");
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
