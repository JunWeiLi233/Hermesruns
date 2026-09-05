package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class NiceCannesMarathonKnownCourse {
    static final String SOURCE_NOTE = "Official Marathon des Alpes-Maritimes Nice-Cannes 2026 route page and GPX track from marathon06.com";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 4;

    private static final String ENCODED_ROUTE =
            "mduiGeljk@BxCDtBBjBBbCBdB@hA@r@@j@Bx@DfAJnCJrCB`@HnAZxDP`CLdBJz@XrB^nCVhB`@pCR|An@|E`@nCf@tDXrBF^Px@l@fCp@nCr@vCl@dCx@bDd@jBj@bCd@jB`@dBp@fCp@`CRn@l@pBx@vB|@pBzAfD|@rBdBvDv@`BhAtBb"
            + "AjB|AzBlA`B`BtBjArApAzAtA|AxA`BjArApAxAt@z@tA|AhBvB|@~@l@r@z@|@|@|@~AlAbAr@hAx@|@l@tA|@|A`A~@l@p@^lAl@pAp@`Ab@|@b@nAj@bAd@hAh@|At@nAl@~Ar@p@\\`@Vl@^d@^f@\\NP|@v@h@f@^`@X\\r@~@n@z@lAlB"
            + "fA~ApAnB~@vAtArB|A~Bt@bAf@v@T\\Td@P`@`AtBt@pBx@fCZrARdAPbANdALvANnBPjCZhFRlDPpCRlDTtDVtEP|CVfEPlCTtDRjDJjBRbDHpANtAJdARlAZdBPl@h@nBbBdGt@jCfBnGh@jBV|@X~@Xv@Rd@f@fAl@lApA~BpAdCd@z@l@"
            + "jA`AhBn@jA^p@x@|AZn@Pb@d@jAl@hBZfAT`AZvAVbBh@hDh@pD\\~Bf@dDd@rCl@xDj@rDn@bE\\zB\\zBTjBJjANzBNjCPfEH~C@zA@bAE`AEhAMpBS~Ac@|Bo@lCw@`D[hASdAOxAMtBC~ACxC?b@A`AJjBV~CJ`Ab@rCVtA^vA^bBv@~CPj"
            + "@Pj@Rv@VhAD\\z@bDv@pCn@|B^xALZZv@v@xCfApDv@`Cb@jAj@rAh@nAt@~A`AhBh@~@z@vArArBbAzAr@`A~@rA^h@LRLTJZXz@Vr@b@n@\\\\^VTVVXXb@j@n@x@t@T`@R^v@z@r@x@XNXVPTPPNZlAjAn@l@TJVPZ\\JTj@h@nAjANHVJVVP"
            + "NNZdAbA\\XPXVf@`@dAPl@Xr@P\\PRPJRF\\DZBIXYn@APGNa@r@QZYj@]p@e@z@i@~@g@bA]h@k@n@eAbAkAx@}AvAxAoAfBuAt@w@x@{@j@iAf@}@|A{Cf@}@^m@PQP]L]BMNBb@^d@j@b@d@~@hA`AfA|@hAt@`AhAvAj@v@Zd@Td@z@pBdA"
            + "fCv@pBp@bBn@`BVn@Zx@d@jAPp@Rv@Vz@Jj@J|ABz@Df@Hf@Ld@PZV\\PNRLf@Jf@@h@?zAAzAA|@A`BEfBE`BAhACT_@mBBo@?}AHeABg@JYDsA@g@C[Gi@Qa@Sm@c@_@_@a@o@u@mBu@sBkAgDc@iAMUOM_@w@_AuBw@kBa@gAPMz@Yn@Uh"
            + "@OLI\\PhAh@z@\\pAl@n@Xt@Zt@\\lAj@v@^l@^VNDJ@d@?jAC`@Iv@Qh@W|@O\\CZ?^D^HVPRVP\\Hd@@VGZOt@c@d@Wn@Qt@OVEN\\Jb@BZ@zA?nA@j@~@Cx@@fCAx@Aj@CZARGX[DUHw@He@DOVBd@R|@^x@Zf@Nf@RXP^Z^ZTVf@b@PTJPDXn@"
            + "P|@XVFT@r@R|@X~@Zt@Tx@VbA\\|@TbA\\p@R~@VvAd@nCz@tBj@vAb@fCz@tAd@nCz@~Ah@nEzAvBp@dA`@bCt@bA^lA`@xAf@b@Lt@V^LZDHFPB\\RfBl@|Ah@vAd@vBp@nBl@pBp@jA\\`@Nv@VtBl@lA`@tA^ZNd@JbAZl@PnA^fAT|ATxAP"
            + "lANjBVnAN~AHnBBrABfB@fA?tA@vA?v@BZGJAJDVA|@BlB?`B?fCB|C@`FBvB@dC@jCBjC@hC?bC@vBBjBDtA@f@DlBDv@@RBTBb@Nz@\\~Ar@r@Xn@Xh@Fn@?jAAb@AT?L@NHJBZPVXX^b@p@Xd@Th@Rp@Nl@Nn@\\p@`@`@b@f@x@v@n@l@n"
            + "@`@r@Zh@JVDj@Jv@N\\BhA?\\E`@IZGp@UZMZS`@URQROPk@?WFa@PKLGPk@Pw@FoAJqB?}@B_ANmDRyDHyBBg@Ha@f@_AFKJADQNQ^i@HKN?REJMt@LN?JaATaALSHSDK\\ET@XHp@Fd@DNGPCPAPFLLj@\\HRLLv@l@XNn@P^LRFRPHF@RC\\AT"
            + "DJv@h@n@j@f@^XXVHt@RNFBRh@Jb@LLJFHJz@PjAHRHBVK`Ag@h@SNIJDHPZhADJPJ^f@TPRBDNRXNRf@Zh@T`@Hh@Bh@Fh@F`AH`@@TA`@GTMLWDe@@ILKNAXIZQl@k@`@_@Zg@LWLWDYF[?w@DuALg@Pc@RS\\[XOr@m@fA{@fA_AnAoAhB"
            + "uBz@qAd@}@Ti@f@eBPq@P{@@i@Cm@Kc@W]i@w@c@aAw@eB[u@Ma@Aa@Hw@X_CFqAGiDEiBBy@RcBRuA?o@Eu@OkAOoAE}@F{@No@Vc@Z]h@SRBXFXVP\\X|@Tz@Ph@Zl@hApAfCbC^Jl@HdANhARz@Lb@DX@VCNG`Ae@pAs@`B_ApAs@hAq@f"
            + "@YNIVGVBTJz@h@lAz@nAp@d@XXZTZTf@Xj@t@z@v@n@|AhArAz@vBxAjBlAn@`@ZLZHj@CzACr@?l@ANA^NZZlBhB|@|@z@z@~@x@rArAp@r@RZv@jBZhAv@pCVdANx@NbBRz@X\\RTPNp@Lb@Df@?h@TTVRVf@jAr@rBx@hCv@vCf@jBX|@f"
            + "@|Aj@vAT|@^xANZl@v@^d@Xd@LNF\\Hn@Dr@An@Cd@Y|A]dBSbAm@zA[p@Oh@CZ@\\FZJRPVNRLNBNAVEPQLS?QSUYSSe@Wu@[eAW]OWQOQM]E]Ba@H_ADaA@_@Ki@Mi@Qg@OW}@Um@K[IIUQ}@IUg@o@[QWMY?Y@{@Ve@DWA[OUOg@_@_@I]?"
            + "s@Nk@Z_@^Uf@[`AOf@UZYDaAE[Ag@Wu@g@s@e@q@[o@]c@Im@?g@FWJc@Rg@Po@B{@CcA?{@F}@\\QL]b@U^c@x@m@lAc@v@q@tA_@l@e@|@[r@I^Gd@Ir@Kd@W\\aAv@g@VYHSDc@A_@B]DQVe@`@[j@Uh@Q`@Uj@[h@Y\\WVqAj@g@Ni@Jg@A"
            + "w@G_AIc@Ei@Kc@M{@lBw@bB_@z@g@dAc@`Ac@tAa@dAK\\FnABxA?\\Gd@U|@Oj@Sn@Ml@GNQB_@Mw@O[~DU`DKnAAt@OrAe@rAg@~Ai@`By@pCi@fBUt@S`ASfBg@jFe@dF_@bDOpAO`BEzC?jD@rDDlBBjBJxBJpBLnBVjDNzBVnENtDPdDN"
            + "~DH|ARnEHvBJhBJtBLzBJpARfBRnAXnANp@^bAb@nAl@dB^z@N\\FXJPVr@t@fBn@xA`@~@`@p@j@z@PXPb@Nb@r@pBb@jALh@^bBLr@RfBH`A?^NxAVfCNn@JXXhAJ\\pA|Db@vAhAxCn@tBj@dBt@pBd@jAn@~Aj@lAj@~@f@z@`AjAjArA|"
            + "@x@PPHND\\Dd@DRN\\V\\z@z@t@r@h@f@XZf@j@b@`@fAx@dB~A|@|@jBjB|AzAn@r@h@`@l@d@v@d@x@b@l@ZnBhAlAr@n@d@d@Zl@l@b@d@`@`@f@j@b@j@x@bA`AlAn@z@Z`@PPl@l@r@n@ZVd@\\r@h@n@`@x@l@x@l@XPZXPLVHRRn@b@v@"
            + "d@x@l@l@`@r@j@l@j@j@f@Z^\\f@\\j@Xh@Tb@R^Xv@Xx@^xAZvALr@J~@Ht@HtABjADnCC|ACtBGpACjAAn@@b@DlDDz@Bx@DVPPLNd@Hf@Dt@DZEVGLIRURa@NOJMNAZVTXVHRNTRT\\x@lAXd@X`Ah@zAFPLTf@tATl@LTVd@BZHlABf@Lp@"
            + "NbA\\z@p@bBN\\RVXr@VTh@f@~@x@^\\f@d@lAj@z@d@j@Xb@Pj@Nd@Bn@Hh@@t@@d@?ZBb@J`@Td@\\j@d@l@b@RHp@Lz@Lf@Dp@Hj@DTBVBJJ@J@VEb@MnBEl@?PCZENKHU?WI[Ka@O]Ik@Bi@L{@f@gAp@_An@}@n@y@v@m@v@a@d@YJSJ_@B"
            + "}@?u@Dk@Lk@Vg@Vc@J[?y@EaAMe@I[K_@Uq@e@g@Yi@O]Ea@C]Bq@Jm@Xm@Ze@Xa@Xc@b@Wd@c@z@_@~@Ud@a@n@Yf@e@fAm@pAcA`Ck@tAgAlCm@pA_AxBiAtCq@xB]nAKf@a@vAq@hCkAxFq@hEq@fFk@fGLDJFJZH`@?hJ";

    private NiceCannesMarathonKnownCourse() {
    }

    static List<RoutePoint> routePoints() {
        List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(ENCODED_ROUTE));
        setLabel(routePoints, 0, "Start - Promenade des Anglais / Theatre de Verdure");
        setLabel(routePoints, routePoints.size() - 1, "Finish - Boulevard de la Croisette / Palais des Festivals");
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
