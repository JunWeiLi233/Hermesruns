package com.hermes.backend;

import java.util.ArrayList;
import java.util.List;

final class IstanbulMarathonKnownCourse {
    static final String SOURCE_NOTE = "Istanbul Marathon official race-course page Google My Maps KML 42K route";
    static final int MAX_OFFICIAL_SELF_INTERSECTIONS = 80;

    private static final String ENCODED_ROUTE =
            "a`nyFyngpDcCjBaCxB_EhEeAlAuAxAeJlJ_n@~o@oIdJuDxDmCxCaCvC_B~Bo@fAaB|CuG`Ny@lBUTuBjDkCfCu@|@Ul@K`@Cd@?b@Db@R~@h@bBp@jBhApC" +
            "rChHhB~EvDfKhAdCl@zAb@`Bn@pEb@xAV^ZTZJv@BRE|Ac@vAKbEj@fDb@ZFrDb@j@HzAPPBtKpAfANRBd@HTBnBV^D~C`@h@Hj@HvBPfALfATPNNPRf@d@n" +
            "FBTP~A@Lj@vDJl@n@~DZzAf@tCvAlIJ^LVTTzBbBRd@RlAj@jBj@~ARt@BZVlANd@RTtB~Ap@`@JFTLjAp@`@ZzB|ArGxF`DzCjBlB`B~A`C~CbBfCJPJJt@" +
            "z@FB|@j@LFhBdAFD`Bt@h@^ZXl@r@V^NTb@bAn@|B`BzHd@vBJh@xB~JFZ`@|Ad@|BRx@Pp@`ArCTh@Xp@jAvCVf@fApB^h@hDbF@@~@tAX^fAzA\\\\XNx@Xx" +
            "A^NDl@NzAv@vUlOd@JR@PATGZUJMHUNi@JqB@]PyDReAhC_JPq@AuAFWb@qBLs@B]JgAEgNEyCAIWqDAKa@}DSqG?o@Bo@ToAb@aAdA}Af@k@lAcA\\SZQbAc" +
            "@f@OhEy@hBYnACn@@tHb@vANhA\\zGxCnI|BnAr@n@j@\\^j@|@fClFr@pAl@~@|@dAHJLLfAdAnAdAx@`An@bAn@lAVp@^tARv@ZpBL`BBr@BjBAt@M|EEzAA" +
            "jC?r@?PB`BFxBHpBF`CDjDNnB@ZBh@?jAEbAQdBc@hCGp@g@pKe@|FEz@QjF?t@?bBEzBUrEM`BUrBa@~CKdAI`AIz@GbAKnCA|B?R@|CFlAPtBZlBNp@Vn@" +
            "Pj@J\\lBtFj@jBT|@TpATvBBd@HtBZzD@r@PfCBL?t@d@|G\\|EDbBAbBC~AUfCWdBgCzMOpAEv@Av@HnBPjAJj@rAlE^hAh@nAJVd@|@nC~E|@lA|@z@f@`@l" +
            "Ar@\\LvHfCjBj@d@Zt@^t@d@`Ax@\\\\l@r@x@nAl@nApBlE|@zAv@~@`EnDn@r@dArA|DrFxJtMh@|@d@bAN\\j@jB^dBPvAJhAFpA@z@AtBIbIKrIMlPBlBJhB" +
            "PvAPbANn@h@~AP`@h@~@lApAtA~@x@ZrA\\v@HtG@`@@|@Pd@N~@d@l@f@p@p@bAxAd@t@d@t@~@nBx@xB~GnURx@VtARbBJvB@n@AlBItBIfAIf@WvA_@nAw" +
            "@lB_ApBq@rAq@|Ai@|AWfA]jBQ|AGhACjA?|@FnBNlBHl@`@rBRt@l@fBX|@bCxHv@bCf@lAnDbG\\h@Xl@^`AJ\\Rz@Rr@nDvNl@|BRl@t@vA\\d@~DrEl@bAp" +
            "@|ARp@l@jC`@nBhBhIDVRbAFb@Dz@A`@Ez@MlA]hBm@|Cy@|E}@dHc@rFa@tHSlDOlC]dGuClf@Cr@El@MpDAhAA`ABnDLdDR`DP`BTdBZpBj@nCj@xBlAvD" +
            "tA`DjBlDv@lAdApAh@l@VXxDvDDPAFEBM?uDoDOS}@_AkBkCeAgBgAwBIUsAeDcAiDeAwEi@uC]kDOmBSgEEeC?cC@k@@y@LsDJ{ArCqf@^cGNoCd@wI^yGJ" +
            "_ANcBjAiIHe@VyAj@aC\\_BL{@LsA?kAC_@a@_CiCqLg@uBSu@Qg@c@aAEIi@{@qC_DeAqAi@{@Yo@Og@CE_F_SQs@YeAa@gAaAeB{AeC_A{A_@{@kEaN[}@M" +
            "c@m@oBWmAUqAQsBEiAAyCJ{B@KVoBTsAZiAl@eB|DyI^_AT_AX}ARsBFyBCqCGgAUqBSoAU_AoEgOYcAkAuDaA}B_AgBe@q@s@cA{@aAk@e@k@[k@Uq@O_AI" +
            "sA?eC?e@?gAGA?@?_@G}@UgAg@{@k@kAmA_AsAi@kAc@yAMo@SwAOgBGaBAy@N_SFcENqM?aAGkB?GKsAMy@O{@m@{BWw@{@eBe@w@mE{F_KcNoAwAcB{AaB" +
            "yA{@eAaAcBwByEk@aAs@eAe@k@y@u@oA}@c@UuAi@wDiA{EwAcAg@w@g@YW_A}@[a@{@qA_CiEw@}Ay@}BuA}DU}@]sBGu@AsA?o@D{@Hw@t@yEtAuHNkABK" +
            "LqADu@BmA@oAGaC_A{MEm@Ko@a@{Ei@yGEe@c@oDi@gCe@gB}BsG_@gBMcAYmDEmC?qA@sAH_DLiCBULuAXgCBg@XkCd@kFDs@H_E?iE?eCDmE^uJVkDVmBb" +
            "@sBJ_@\\gBZqDBgAK_FCiAGwCGsC?_@DaFNkGBu@AeBGqAMwAe@kCi@iBw@eBs@mA[_@u@y@}@u@gAeAMOy@_Ay@oA_@q@cCcFw@yAi@o@][m@c@c@Us@WcFo" +
            "Ai@Qe@OaGkCw@[u@OeLq@cABqBZ}Dr@iA\\eAh@_Al@g@d@e@h@gA~A[l@ABELNF@@dAd@l@f@t@~@zA~BdAhBh@~@z@nBT|@HfBTZVGn@z@n@E^vBl@x@lAp" +
            "AfAhA`@p@R\\@@TLRNl@?^J^AnAt@HFFLJPDA`CL^B|BHdBNRFl@VVP^\\JNt@tBXh@PPJLDDl@j@hAfAx@x@";

    private IstanbulMarathonKnownCourse() {
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
