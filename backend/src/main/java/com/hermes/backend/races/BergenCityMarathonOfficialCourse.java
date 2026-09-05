package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

/**
 * Official Bergen City Marathon geometry from the organizer-published GPX.
 * The marathon repeats the official half-marathon circuit twice; the stored
 * line is downsampled only to keep the application artifact compact.
 */
final class BergenCityMarathonOfficialCourse {
    static final String RACE_ID = "bergen-city-marathon";
    static final String OFFICIAL_SOURCE = "verified-official-gpx:bergen-city-marathon";
    static final String OFFICIAL_COURSE_URL =
            "https://www.bergencitymarathon.no/en/distances-and-course-map/sport-1-marathon/";
    static final String OFFICIAL_GPX_URL =
            "https://www.bergencitymarathon.no/wp-content/uploads/gpx/BCM-2025.gpx";
    static final int HALF_ROUTE_POINT_COUNT = 1146;

    private static final String ENCODED_ROUTE =
            "ohsoJusn_@Wt@]~@]`A]v@c@l@]p@]t@[v@Yt@Wt@Yt@Wx@KfA?jAAhAIfAO|@Yt@]r@[p@Wr@Yn@Yd@a@b@g@Vc@Ta@^c@Zc@^_@Zc@LYo@KkAKiAIg" +
            "AMgASeAYy@Wm@Wo@Qw@McA@iALkADaAEgASw@]m@]a@a@_@]_@[W]Ia@Ac@J_@V_@\\]Ta@Fa@E_@W]g@Ym@[m@Ws@Sw@Ow@Sy@Qq@[a@We@[Q_@?_@V" +
            "]^[\\]d@[`@[b@]d@]^a@Ra@@c@Ea@Ec@Ka@Ea@Aa@C]E_@C]O]M_@Kg@Ic@M_@O_@Em@Qe@Oa@Oa@Gc@Mc@@e@@g@Ae@@c@F_@^W|@Wn@]h@Yj@[f@]" +
            "`@_@R]@WEWMY?]H]T[T[R[RYZYZWZSb@Sl@Qj@Ol@Qn@Ov@Mv@St@Sv@Q|@Wz@U|@Sx@Sz@Qz@GdAEhAGfASx@]`@Wp@OdAMbAUp@W`@Ol@Gt@Ep@Kt@" +
            "Mz@K~@Ot@Ub@Q^Kf@Op@Wd@W`@W`@[`@[f@[b@]`@Qa@By@@q@@s@@o@?m@M_@SMQ?CCMa@]u@_@m@@[XH^CZ]Vi@To@Tq@Nm@Hu@@q@Ds@Hw@H{@B}@" +
            "Cw@Io@Io@HI`@^`@H^@ZCXO`@O^WVq@R{@Ry@NaAN}@Tq@Vq@Xu@Pw@P_AR_AR{@Lo@Ji@Dk@@k@@k@Lo@Lo@Jk@Lk@Jk@Lk@Lk@Ho@Li@He@Di@Bq@B" +
            "i@Fc@Ac@Du@Do@Ls@Pw@Rs@Pm@Rk@Rg@V[XW\\STYV]Vc@Ra@T_@R[XWZI\\KXEZGd@E^KZW^Ub@Q`@Od@G\\ON[V_@`@YXQVa@V[Xe@X]Za@\\O\\Of" +
            "@S^]V[TYRONSTQ^ET[MGQ@SLQPQ?@OJKP[Tg@V_@ZSXQRITEZGXIXM^K^A\\KZ_@ZUd@?\\QX[X[T[\\W\\S`@B`@J\\D\\K\\Q`@Q`@U`@K\\^Zr@Zn" +
            "@\\l@\\h@`@`@^N`@A^@`@R\\b@Zd@Z?XGVId@Sh@Ed@Hh@Hf@A^?^G\\QXWXOVB\\D\\D`@J^D\\?VUZYXUT[RUXSV[XUZSVSb@a@b@e@^Ub@Un@Eh@" +
            "Gd@Eb@C`@O`@[Xc@Z_@Zi@Vg@X]Z[b@Ob@T`@Z`@\\`@T`@@`@K^K\\I\\UZg@Tq@Ts@Tu@Vo@Zc@Zi@Vo@Vq@Tq@Vo@Tq@Zc@Xk@^c@`@c@\\e@\\e@" +
            "\\g@\\e@^k@Xo@Pu@P}@R{@Ry@L_AHgAJ_AFs@Fm@Lm@Hs@Lm@Jm@Lq@Ts@P{@P_ATw@Zo@Xo@Nw@Pw@N}@J{@L_AN_ANaAJaAH_AFeAA_AJaA^i@\\q" +
            "@\\m@\\k@^]^]\\c@Ze@\\i@Tq@Ry@Xs@Vq@Ze@^a@\\o@PaAHcAJgANgAZs@b@Sd@Eb@YXs@Vs@Vo@Vq@Xs@Xw@N}@G{@[i@Wo@SeAEgAFgAXy@b@q@" +
            "Xo@Ry@Tu@Tk@Xo@Vo@Xk@Vq@^q@\\e@B}@@cABaAPw@\\o@Vw@P}@HcAN_A`@]\\o@Z_@`@G`@VZh@Xr@\\d@`@E^Od@U`@[Uo@a@g@_@e@_@c@_@_@_" +
            "@]a@U_@Oa@Oa@SSs@PiAT_Ab@Sh@Lb@V^\\b@b@\\f@Xl@Xl@Vn@Vh@Vj@X\\\\R\\L`@F`@D\\^`@d@h@Lf@R\\d@^d@d@`@^TVJd@Jf@Nb@Pb@DRi@" +
            "Ly@^\\HjAHhARz@\\JXAZG\\IZKZEZBVf@Jf@B|@F|@Zp@`@\\`@TZj@\\d@d@Tb@B^BZV@lAAlA?nACjAEpAAlA?hA?hABdA?fAAfA?dAAfA@fA?bA?" +
            "dA?~@E`AIbAK~@MdAM~@O`AQx@]f@a@\\_@Z_@d@]h@Wp@Yr@]l@]j@]j@]j@Wt@Sz@Or@Qz@Yt@Ux@Wt@Yp@Yt@Wp@Yt@Wv@Wt@St@Kx@E~@A`ADfAB" +
            "~@D`AB~@B~@@~@EdAIjAOdAU|@U|@Sz@St@Mz@Gv@EbA?`AEdAA|@Ip@Kw@C_A?aA@{ACuADeADcAJ}@H_AD_ADaA?cA@aA?aA?eAAgAGkAIeAIcAMcA" +
            "My@Q{@KaAIcA@eAFaATy@Zg@^c@\\c@Xm@Rq@Ru@N{@Nw@N{@N{@R{@P{@Pu@Ro@H{@CgAA_A?aA@iA@kAAcAAeA?gAKo@S_@UU[A[j@]l@[h@Yn@Wx@" +
            "Ul@[n@c@Ic@U][a@]c@Yg@Se@Oe@Ac@Na@Na@R_@Na@La@F_@R_@^Ur@Wp@[d@_@Z_@X[d@]h@Yj@_@^Yp@Sp@Sv@Sx@Sz@Qt@Qz@Q|@O|@O`AMbAK`A" +
            "K`AEfAGbAEbAAbAA~@C`ACjACjAGhAGfAM~@M|@Sz@Qz@Qx@Wv@Uz@Q|@OdAMfAKbAK~@O|@O`AObAMz@Ov@Q~@QdAUr@Wh@HYRgAJeAL_AP_APeARcA" +
            "N}@N}@N}@N}@Ny@Py@Ny@Pw@XYVt@P|@Tt@Tt@Rt@Vr@Zb@^V^T^T^T\\T\\T^P^X\\b@Xp@Tv@Rz@Rr@Rx@P|@R`AXn@`@VXh@@v@GbA]V]ZE`AC`AC" +
            "~@BdADv@Dh@?d@WfACv@\\\\^Jb@F`@ZTb@Lj@@dAOjASjASdAQ|@Q|@Q|@U|@Sz@Oz@K|@OfAI`AKbAI|@CbAG|@Mv@G~@I~@?t@Th@Xd@Vb@JlAKjA" +
            "Ut@Uv@St@Ur@Sx@Gz@Qx@Uv@Ut@Ut@Sp@Qr@Ov@Up@Yh@Ul@Sn@Oz@Oz@Ut@Qz@]l@a@^a@X]\\a@Ne@@e@Oe@Qa@Gc@@_@TWh@Yl@Yb@[d@Y\\Y^[f@" +
            "WX[T]Pa@Vc@`@a@`@a@\\]ZODEGMAS@]f@s@`Am@r@k@h@g@d@e@Za@U]]Yc@]a@_@LQbAUz@Sv@Ut@Ut@Mv@Mx@K~@YFQ}@@gAFcALeAJaAJeAH}@Me" +
            "@_@I_@H]L]G?aALgAH_AWW_@W]_@Wc@]MSg@KgAOaAUm@Wc@Uc@QSQZQp@Qn@Kn@Mn@In@Kp@Mn@Mr@Mt@Sp@O`@KAMGMMSQSUU]Q[OXKb@Gj@Mp@In@" +
            "Mr@Kl@Kd@Ml@Mn@Op@St@Ot@Ov@Sp@Qp@Qr@Or@Ur@Yn@Yd@[n@Yd@Kl@Cl@DbAD|@?z@Gv@Ud@Wd@Qh@Uh@Sl@Sn@Kt@Mx@Gz@EbAK~@Qp@W`@UZW^Q" +
            "`@W`@Yd@Yd@Yd@[f@Yb@Yd@Y`@_@I][[_@Y]U]Ue@K{@EgA?cABcADaAJ_AJ}@Ru@`@UXo@Ts@Tw@X_ARaANaAP_ARu@Pu@Vq@Xi@Vo@Z_AT_ARo@Ti@" +
            "Tk@Vg@Xa@Xc@Ze@Ti@Ve@Rg@VaANyAJ_AT_APwAQcAa@c@Is@No@Tg@Xe@Ts@Rw@L{@DoACqAHeAP}@Tw@Tk@T}@P}@ZeATq@Xw@Vm@Xu@Tw@?w@Ym@K" +
            "}@L}@Ty@Ty@Ts@Vy@Nu@Py@N}@Ny@L}@H{@QaA]q@]e@]_@]_@[]a@c@_@U_@b@[p@Yr@Wv@Wr@Yn@_@f@Mz@M|@IZyAtC]~@]`A]v@c@l@]p@]t@[v@" +
            "Yt@Wt@Yt@Wx@KfA?jAAhAIfAO|@Yt@]r@[p@Wr@Yn@Yd@a@b@g@Vc@Ta@^c@Zc@^_@Zc@LYo@KkAKiAIgAMgASeAYy@Wm@Wo@Qw@McA@iALkADaAEgAS" +
            "w@]m@]a@a@_@]_@[W]Ia@Ac@J_@V_@\\]Ta@Fa@E_@W]g@Ym@[m@Ws@Sw@Ow@Sy@Qq@[a@We@[Q_@?_@V]^[\\]d@[`@[b@]d@]^a@Ra@@c@Ea@Ec@Ka" +
            "@Ea@Aa@C]E_@C]O]M_@Kg@Ic@M_@O_@Em@Qe@Oa@Oa@Gc@Mc@@e@@g@Ae@@c@F_@^W|@Wn@]h@Yj@[f@]`@_@R]@WEWMY?]H]T[T[R[RYZYZWZSb@Sl@" +
            "Qj@Ol@Qn@Ov@Mv@St@Sv@Q|@Wz@U|@Sx@Sz@Qz@GdAEhAGfASx@]`@Wp@OdAMbAUp@W`@Ol@Gt@Ep@Kt@Mz@K~@Ot@Ub@Q^Kf@Op@Wd@W`@W`@[`@[f@" +
            "[b@]`@Qa@By@@q@@s@@o@?m@M_@SMQ?CCMa@]u@_@m@@[XH^CZ]Vi@To@Tq@Nm@Hu@@q@Ds@Hw@H{@B}@Cw@Io@Io@HI`@^`@H^@ZCXO`@O^WVq@R{@R" +
            "y@NaAN}@Tq@Vq@Xu@Pw@P_AR_AR{@Lo@Ji@Dk@@k@@k@Lo@Lo@Jk@Lk@Jk@Lk@Lk@Ho@Li@He@Di@Bq@Bi@Fc@Ac@Du@Do@Ls@Pw@Rs@Pm@Rk@Rg@V[X" +
            "W\\STYV]Vc@Ra@T_@R[XWZI\\KXEZGd@E^KZW^Ub@Q`@Od@G\\ON[V_@`@YXQVa@V[Xe@X]Za@\\O\\Of@S^]V[TYRONSTQ^ET[MGQ@SLQPQ?@OJKP[T" +
            "g@V_@ZSXQRITEZGXIXM^K^A\\KZ_@ZUd@?\\QX[X[T[\\W\\S`@B`@J\\D\\K\\Q`@Q`@U`@K\\^Zr@Zn@\\l@\\h@`@`@^N`@A^@`@R\\b@Zd@Z?XGV" +
            "Id@Sh@Ed@Hh@Hf@A^?^G\\QXWXOVB\\D\\D`@J^D\\?VUZYXUT[RUXSV[XUZSVSb@a@b@e@^Ub@Un@Eh@Gd@Eb@C`@O`@[Xc@Z_@Zi@Vg@X]Z[b@Ob@T" +
            "`@Z`@\\`@T`@@`@K^K\\I\\UZg@Tq@Ts@Tu@Vo@Zc@Zi@Vo@Vq@Tq@Vo@Tq@Zc@Xk@^c@`@c@\\e@\\e@\\g@\\e@^k@Xo@Pu@P}@R{@Ry@L_AHgAJ_A" +
            "Fs@Fm@Lm@Hs@Lm@Jm@Lq@Ts@P{@P_ATw@Zo@Xo@Nw@Pw@N}@J{@L_AN_ANaAJaAH_AFeAA_AJaA^i@\\q@\\m@\\k@^]^]\\c@Ze@\\i@Tq@Ry@Xs@Vq" +
            "@Ze@^a@\\o@PaAHcAJgANgAZs@b@Sd@Eb@YXs@Vs@Vo@Vq@Xs@Xw@N}@G{@[i@Wo@SeAEgAFgAXy@b@q@Xo@Ry@Tu@Tk@Xo@Vo@Xk@Vq@^q@\\e@B}@@" +
            "cABaAPw@\\o@Vw@P}@HcAN_A`@]\\o@Z_@`@G`@VZh@Xr@\\d@`@E^Od@U`@[Uo@a@g@_@e@_@c@_@_@_@]a@U_@Oa@Oa@SSs@PiAT_Ab@Sh@Lb@V^\\" +
            "b@b@\\f@Xl@Xl@Vn@Vh@Vj@X\\\\R\\L`@F`@D\\^`@d@h@Lf@R\\d@^d@d@`@^TVJd@Jf@Nb@Pb@DRi@Ly@^\\HjAHhARz@\\JXAZG\\IZKZEZBVf@J" +
            "f@B|@F|@Zp@`@\\`@TZj@\\d@d@Tb@B^BZV@lAAlA?nACjAEpAAlA?hA?hABdA?fAAfA?dAAfA@fA?bA?dA?~@E`AIbAK~@MdAM~@O`AQx@]f@a@\\_@" +
            "Z_@d@]h@Wp@Yr@]l@]j@]j@]j@Wt@Sz@Or@Qz@Yt@Ux@Wt@Yp@Yt@Wp@Yt@Wv@Wt@St@Kx@E~@A`ADfAB~@D`AB~@B~@@~@EdAIjAOdAU|@U|@Sz@St@" +
            "Mz@Gv@EbA?`AEdAA|@Ip@Kw@C_A?aA@{ACuADeADcAJ}@H_AD_ADaA?cA@aA?aA?eAAgAGkAIeAIcAMcAMy@Q{@KaAIcA@eAFaATy@Zg@^c@\\c@Xm@R" +
            "q@Ru@N{@Nw@N{@N{@R{@P{@Pu@Ro@H{@CgAA_A?aA@iA@kAAcAAeA?gAKo@S_@UU[A[j@]l@[h@Yn@Wx@Ul@[n@c@Ic@U][a@]c@Yg@Se@Oe@Ac@Na@N" +
            "a@R_@Na@La@F_@R_@^Ur@Wp@[d@_@Z_@X[d@]h@Yj@_@^Yp@Sp@Sv@Sx@Sz@Qt@Qz@Q|@O|@O`AMbAK`AK`AEfAGbAEbAAbAA~@C`ACjACjAGhAGfAM~" +
            "@M|@Sz@Qz@Qx@Wv@Uz@Q|@OdAMfAKbAK~@O|@O`AObAMz@Ov@Q~@QdAUr@Wh@HYRgAJeAL_AP_APeARcAN}@N}@N}@N}@Ny@Py@Ny@Pw@XYVt@P|@Tt@" +
            "Tt@Rt@Vr@Zb@^V^T^T^T\\T\\T^P^X\\b@Xp@Tv@Rz@Rr@Rx@P|@R`AXn@`@VXh@@v@GbA]V]ZE`AC`AC~@BdADv@Dh@?d@WfACv@\\\\^Jb@F`@ZTb@" +
            "Lj@@dAOjASjASdAQ|@Q|@Q|@U|@Sz@Oz@K|@OfAI`AKbAI|@CbAG|@Mv@G~@I~@?t@Th@Xd@Vb@JlAKjAUt@Uv@St@Ur@Sx@Gz@Qx@Uv@Ut@Ut@Sp@Qr" +
            "@Ov@Up@Yh@Ul@Sn@Oz@Oz@Ut@Qz@]l@a@^a@X]\\a@Ne@@e@Oe@Qa@Gc@@_@TWh@Yl@Yb@[d@Y\\Y^[f@WX[T]Pa@Vc@`@a@`@a@\\]ZODEGMAS@]f@s" +
            "@`Am@r@k@h@g@d@e@Za@U]]Yc@]a@_@LQbAUz@Sv@Ut@Ut@Mv@Mx@K~@YFQ}@@gAFcALeAJaAJeAH}@Me@_@I_@H]L]G?aALgAH_AWW_@W]_@Wc@]MSg" +
            "@KgAOaAUm@Wc@Uc@QSQZQp@Qn@Kn@Mn@In@Kp@Mn@Mr@Mt@Sp@O`@KAMGMMSQSUU]Q[OXKb@Gj@Mp@In@Mr@Kl@Kd@Ml@Mn@Op@St@Ot@Ov@Sp@Qp@Qr" +
            "@Or@Ur@Yn@Yd@[n@Yd@Kl@Cl@DbAD|@?z@Gv@Ud@Wd@Qh@Uh@Sl@Sn@Kt@Mx@Gz@EbAK~@Qp@W`@UZW^Q`@W`@Yd@Yd@Yd@[f@Yb@Yd@Y`@_@I][[_@Y" +
            "]U]Ue@K{@EgA?cABcADaAJ_AJ}@Ru@`@UXo@Ts@Tw@X_ARaANaAP_ARu@Pu@Vq@Xi@Vo@Z_AT_ARo@Ti@Tk@Vg@Xa@Xc@Ze@Ti@Ve@Rg@VaANyAJ_AT_" +
            "APwAQcAa@c@Is@No@Tg@Xe@Ts@Rw@L{@DoACqAHeAP}@Tw@Tk@T}@P}@ZeATq@Xw@Vm@Xu@Tw@?w@Ym@K}@L}@Ty@Ty@Ts@Vy@Nu@Py@N}@Ny@L}@H{@" +
            "QaA]q@]e@]_@]_@[]a@c@_@U_@b@[p@Yr@Wv@Wr@Yn@_@f@Mz@M|@IZ";

    private BergenCityMarathonOfficialCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> points = decodePolyline(ENCODED_ROUTE);
        setLabel(points, 0, "Start - Bryggen");
        setLabel(points, HALF_ROUTE_POINT_COUNT - 1, "Halfway - second official lap");
        setLabel(points, points.size() - 1, "Finish - Bryggen");
        return List.copyOf(points);
    }

    static int routePointCount() {
        return decodePolyline(ENCODED_ROUTE).size();
    }

    private static List<RoutePoint> decodePolyline(String encodedPolyline) {
        List<RoutePoint> points = new ArrayList<>();
        int index = 0;
        int latitude = 0;
        int longitude = 0;
        while (index < encodedPolyline.length()) {
            int[] latitudeResult = decodeNextValue(encodedPolyline, index);
            index = latitudeResult[1];
            int[] longitudeResult = decodeNextValue(encodedPolyline, index);
            index = longitudeResult[1];
            latitude += latitudeResult[0];
            longitude += longitudeResult[0];
            points.add(new RoutePoint(latitude / 100000.0, longitude / 100000.0, null));
        }
        return points;
    }

    private static int[] decodeNextValue(String encodedPolyline, int index) {
        int result = 0;
        int shift = 0;
        int currentIndex = index;
        int value;
        do {
            value = encodedPolyline.charAt(currentIndex++) - 63;
            result |= (value & 0x1f) << shift;
            shift += 5;
        } while (value >= 0x20);
        int decoded = (result & 1) != 0 ? ~(result >> 1) : result >> 1;
        return new int[]{decoded, currentIndex};
    }

    private static void setLabel(List<RoutePoint> points, int index, String label) {
        int safeIndex = Math.max(0, Math.min(index, points.size() - 1));
        RoutePoint point = points.get(safeIndex);
        points.set(safeIndex, new RoutePoint(point.lat(), point.lng(), label));
    }
}

