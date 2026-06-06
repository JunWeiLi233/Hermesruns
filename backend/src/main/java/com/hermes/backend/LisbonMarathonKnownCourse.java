package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class LisbonMarathonKnownCourse {
    static final String SOURCE_NOTE = "EDP Lisbon Marathon official Google My Maps route linked from the 2026 race-course page";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 4;

    private static final String ENCODED_ROUTE =
            "e}akFlb}w@Z]TUHITSVSp@g@LIZSRK`@Qb@Sd@QPGp@Q|@Q`AKLCjAEf@@|@DV@DRBLDJBPAP?DATCNCNG\\CJIXM^Sh@g@|AQh@Y|@Sh@Wp@W|@s" +
            "AzDmApDkA`Di@|AgA|Cy@bCe@fBa@pCo@xFc@xC]x@Ib@H^?j@K`AQxAQ`BY`CMpBNfB^~Bp@pCT`AZxAPhAFz@EvAIhA[rA_@jAq@rAoA|A{AtB" +
            "y@t@{@l@k@Xq@\\i@Xe@\\]XYj@Ob@Oh@Qn@Gr@Q`Ca@dAi@x@o@n@i@z@c@v@Wv@YdBMbAQx@M`AEvAAjAExACrAIdAIv@Q|@UfAY|@Sv@]j@Yh@m" +
            "@p@e@f@u@l@sAtAu@dAm@lAa@lAq@xBg@zAq@dB{@|Ag@t@s@r@_BvAgB~AyAfA{@fA{@zAUf@i@bBg@lAWt@ONMTCN@j@[~@_@lA]hAUn@_@jA[" +
            "bBMjACvC@~E?dC?bACt@?VMlASfAe@~Ak@hBm@vBk@~AWz@{@rB_ApBm@bBa@xASv@YhAYfASx@a@xAYp@g@jAcAxByA~Bo@tAiBbDy@tAo@jAw@" +
            "pAe@bA_@`AYx@[xAi@tBOb@cAzBuAzCkBzD_BnDYd@m@pAWfAGdAHtAF~@HfAL~ADhAGbAWlAYf@i@d@_@h@Q|@Gx@Cr@D`F@zACbAMtAOhCC|BA" +
            "`CCn@D|AFnA?lAIz@Up@[n@a@b@e@n@Uj@UvAEhA@|AA~ABxAEn@It@In@EZAPTLV`@H`@Ll@h@`Af@v@f@z@\\b@b@Vn@^X\\f@bB^rA^vAXvAPhA" +
            "^rBLjAPdBJnBZnDT`DT`CHpAF`ABlC?bBCn@GfASrADb@I~@k@fEk@|DM^Oh@KZ?P@LDJTLvA~@n@f@Vx@JbAa@tBAbB@rAFr@Jx@DRNf@Nh@DNL" +
            "XTj@RVJNBJ@F@HBDDDB?DDd@l@d@z@z@fALVFNDNHNPHZ`@|@pAnArBhBhCn@|@`@j@`@\\b@`@tAt@XTXRx@Tv@VPJFLHDJANAn@@\\Bx@Lt@F`@H" +
            "ZH^`@Al@G|@I~@WzB[dDWjBUfDi@zJIjBQxB?HB@@?JQf@}@f@}@`AaBt@gAn@_At@iAd@u@^k@d@q@j@i@^a@Xa@\\YVc@T[NYLYLc@Li@Ha@LsA" +
            "D{@JaBBm@Dg@TkA^_ATi@bA}B^y@ViAZsAVsALs@J_AB}C?yHTaDLoA@i@Ak@Ag@Mg@Qe@Mk@Sa@Y]a@]c@Wa@QSKu@cAYc@UU][]OyGsAYISHm@" +
            "\\{@b@OEaAgCm@uA]q@KIOGQ?MBy@h@mCdCWBYAYEWUa@m@q@}AMIM?G?sF|E_APq@GsCe@UGQSGUIKMEYSOIICGM[o@M_@I[GYE[Gi@Gw@SgCG_A" +
            "KwAEuAAu@Ay@?k@CmBEcAIaAEs@OoCOqBIuAKsAQsBKoAQeAq@{Dm@aDYgAUu@Qy@c@{@c@c@_Am@s@w@[g@[i@[e@Uw@Om@I}@IqHEsBBoAHy@N" +
            "o@Pg@Pq@`@g@Ze@Zo@Ry@FgACuAC}@h@oNBcBBaBGaGJwAPu@Xm@f@_Ab@s@TkAFw@Aq@IiAIaACaABe@N_AVm@rCkGhCsF|AqDbA{BZkAf@kBlC" +
            "mKf@gB`@eAb@_A\\u@j@eApDqG^aA^}@\\aAXu@d@gBVmATw@n@aCTo@Xw@|@oB`@}@^_A`@sAZ_Ab@wAf@}A`@sARu@VoAJoAFiAC{JA}CDgANaAJ" +
            "k@VcArB{FVk@RUPOB_@B_@@SZyA`@{A`@aA\\s@j@w@h@s@nAaAv@u@pDeD|@cA\\k@^m@Zs@@EZu@XcAVu@f@aBd@yAf@eA`@q@n@u@z@w@l@i@r@" +
            "m@b@g@Xc@Xk@Rk@Vs@TcANu@Ns@Ds@JaAD{ADuADgB@y@Bg@N{@j@}CViATi@VY\\e@b@e@Xa@\\i@Pc@Po@Fo@Ho@JmAJs@Pq@Re@Le@Z]XU^Uv@_" +
            "@h@Yf@Wf@[d@]\\[h@k@hA{An@}@^q@\\q@Ro@Pm@Le@Ju@FgABq@Ay@Mw@OiA[_Bi@wB]{AOw@Ky@Eo@?g@@w@Ho@Fo@JcAJu@Js@Z}CJa@HONQD]" +
            "C_@EWB]d@{Dd@wEPoAJm@Rw@Vy@lGaRfA{CxEkNXy@Ja@Lu@ToAHWPWD_@EY?OJa@He@Js@H_ABqADs@IcXI}@IaAe@eCUuAYeAa@iAe@w@a@i@k" +
            "AcAy@k@s@g@{KoHuEkD{AqAuCsCcFyEs@u@u@iAI_@[aAOu@I_@G_@Eu@Ce@?gABe@NkE@k@?a@CcACaAKiBGk@S{AMs@SgAOs@YuAW}ASaASeA[" +
            "gBS_AOu@Kk@Og@Qe@Wm@o@_Am@w@o@k@g@a@w@k@iA{@g@e@[][_@g@o@o@eAc@y@iAkCcAcCw@wB[uAc@mBa@cBWgA[wAWeAMg@eA_DcA{Cq@oB" +
            "g@sASm@O]Y_@]c@UOq@YUO_@Ik@YYMWUWYu@eA}A{Cy@yAc@_Aa@u@Ki@Ou@K}AIsAOeAMk@Qi@_@}@c@s@Y_@Si@Qc@Oi@I]MiAI{AMsAQ{AKq@" +
            "M]O_@g@w@c@k@e@q@Ya@a@k@Q_@_@iAMs@Eo@Es@SiG@gCDiAPcGLuDD}ATyGF_BBi@BSReAL_@J_@Xm@Jg@He@Dq@Cy@Ag@k@}B?M?G?C]mAOc@" +
            "c@aBGSK]Ke@EYEUESCWIa@O{@?_@TgF@a@?a@E}AI_AK{@Mq@e@qBg@gBSu@Ia@WmBIo@Aa@Co@@u@TsFJmAFgB?o@Ag@EgA]sDUqBYuCK}@EeAA" +
            "mA@k@NkCXuCHy@Pu@DUAKGAo@C{CQcDQEQ@]H{AN_ANm@J]Ti@r@oAj@_AtA}Bl@_Af@_AVu@Lm@Lu@Dq@F_BNyHb@sOTaLFiB`@kNR}GFoABoAD" +
            "gAL}CJ{DAqIE}E@cCFyCReDNwAR{A`AwEvAoEj@{A`EaJ|EeK|BiFl@qBh@sAh@wA`AkE`@yBNeC?mASmC]aEc@aM]wH_@oIKoBM{BQiByAmN_Bi" +
            "OkBeQw@eHOsBOgGKsC]oMOcDw@yJe@yEmAyMUkCOaC{@}HWkBu@qEo@{Cg@yBaBmGyAmEmBeF_EsJy@iBY{@{AmD{@}Ak@yAg@_Bo@oCu@gGYsCE" +
            "{B@qACsGBwG?gA?yA?uD?eEOcDqAiLo@oCu@qC_BiEsFgOU}@Ow@QuBCeBFiFBqCC{BFgKBcB@yBB_HDmI?oFJ_AHg@FSFcACg@Mu@Q_ASqAWyBv" +
            "@m@|@]Zm@Ha@Bi@Cg@{AsJYeBU{A[wBII_Dv@{Cx@aAVe@}C~DgA";

    private LisbonMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = decodePolyline(ENCODED_ROUTE);
        setLabel(routePoints, 0, "Start - Estrada N6-7, Carcavelos");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Praca do Comercio");
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
