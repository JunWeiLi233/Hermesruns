package com.hermes.backend.races;

import com.hermes.backend.routing.RoutePoint;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

final class SupplementalMarathonKnownCourses {

    private static final String AMSTERDAM_MARATHON_ROUTE =
            "g`v~Hq_u\\?\\N^?vEO^_O?O_@{U?O]]?O_@_@?O]?_@M]?}a@O_@?kRO_@?kSN]?oq@O]?oPN]?mr@O_@?mPN_@?oNO_@?mPN_@?{c@O]?oON"
            + "_@?qMO]?a_@N]?sl@O]?iVN_@?mPN_@?sK\\}@N?N]vwG?L\\?|AN^?vEN^?zBN\\?zmLO^?xCO^?xDO^?|@M\\mA?_@|@O?M^iX?O_@yD?O^g~@"
            + "?O_@yF?M]mB?]|@aQ?M_@O?O^eI?O_@gG?O^cM?O_@kC?O^aM?O_@iG?M^}T?M_@O?O^mT?N??_@N^O_@?^fI?N_@?^?uHO_@N^?tGL^M_@O"
            + "^tI?N_@?]N\\O]?\\N?L^|T?L_@hG?N^`M?N_@jC?N^bM?N_@fG?N^dI?N_@N?L^`Q?\\}@lB?L\\xF?N^`O?L_@?^?yEM]?_@?^L\\?xDN^O_@M^"
            + "fZ?L_@?^?wFM_@?]?\\L^?vEN^O_@M^|R?N_@?yCO_@?]?\\N^?zBL\\M]?\\xD?N^fG?N_@?^?yEO]?_@?^N\\?xDN^O_@O^`P?L_@N?^}@lA?L]"
            + "?}@N_@?yDN_@?yCN_@?{mLO]?{BO_@?wEO_@?}AM]wwG?O\\O?]|@?rKO^?lPO^?hVN\\?rl@O\\?`_@N\\?pMO^?nON\\?zc@O^?lPN^?nNO^?lP"
            + "N^?lr@O\\?nPN\\?nq@O\\?jSN^?jRN^?|a@L\\?^N\\^?N^\\?N\\zU?N^~N?N_@?wEO_@?]";

    private static final String GOLD_COAST_MARATHON_ROUTE =
            "~pqiDiljg\\?gCeDiC?iCiIqGoN?eDiCcD?_^wX?sGeDgC?sGcDgC?ePoN{K?iCeDiC?{KcDiC?ePeDgC?ePeDiC?se@dDiC?iCxXmThI?dDi"
            + "CnN?dDiClN?dDgCdD?bDiC?iCdDhCeD?jI?bDhCdD?bDfC?xXcDfC?zKoN|K?pGeDhC?fCcDhC?hCeDhC?fCeDhC?hCcDfC?hCeDhC?hCcDf"
            + "C?rGeDfC?hCoNzKeD?cDhCeD?dD??hC?iCbDiCdD?nN{K?iCdDgC?sGbDgC?iCdDiC?iCbDgC?iCdDiC?gCdDiC?iCbDiC?gCdDiC?qGnN}K"
            + "?{KbDgC?oTdDiCeD?dD?dDgCbD?dDiCnm@?bDiC~]?dDgC|]?dDiCxX?dDiCvtC?dDiCrr@??gCeDfCdDgCbDfCcD?llA?jI?bDgChgA?igA"
            + "?cDfCeD?olA?cDgC?fCsr@?eDhCwtC?eDhCyX?eDhC}]?eDfC_^?cDhCom@?eDhCcD?kIpG?iCcDgCeD?cDiCeD?eDiC?hCcDhCeD?eDfCmN"
            + "?eDhCoN?eDhCiI?yXlT?hCeDhC?re@dDhC?dPdDfC?dPbDhC?zKdDhC?hCnNzK?dPbDfC?rGdDfC?rG~]vXbD?dDhCnN?hIpG?hCdDhC?fC";

    private static final String ROTTERDAM_MARATHON_ROUTE =
            "{cz{H_mjZlGkBl@]z@uAvPal@?_@iCuI@{Af_@_lApN{d@|CwHnG}Q|D_Gl@uA|DmVrHkk@?cEiFm~@I}]RaA\\u@RS\\Wb@MXAtBTt@?nB[~C"
            + "MpAJpIfCdJjD~FvFhAzA`@hBRbCv@bf@Gv@NdBd@zZCb@L`DKnEOfBSpAw@zBaArAe@`@wa@hYcBLm@^CR@RL`@FDLAfDgCdIgF|VwQx@_Aj"
            + "@eAv@{C^cG@cEJ]FGnDg@jAm@rY{VH?|Tb~@|@tFBBvAA~Do@p@SlCeCl@s@hFuET[Ra@rFcSx@c@jB}A@?xGfS|AhL^tAIxjCGjBJfBLltE"
            + "CBu@BcJyA_@KiF}@ACaM_Cm@[EQP}KCSMKkSyEGCIUAMfEsu@fAmZRi[o@}MmAuIGACHtApL`@tK]z]aAtS[hD{Ev`A}@nJKLC?MEyJaQcBu"
            + "BgB{A}A_A}CkA{Cc@oYaDiEs@s@[eIeFeBuAuFsKmA}AwK}v@kAsEgMwjAk@aNIcAa@q^cA}Ja@{AmBuEs@cAsCiCE@{AfDeJ|YwBpIe\\ncA"
            + "YdBBp@Nn@nBlE?Hq@nDcP`j@}@vAaAh@{DvA_Bx@gAJwRNKEGEm@Om@Du@Z_CvACJrBjU]ZaG{h@gEuZ{AaFyAmDEGMAsG|DmL~E{@DuI_@G"
            + "@EIl@uc@gAaGCGGEaLk@mC_AiTuDsUyEu@u@k@kBuBaEcD_E_UsOy@{@wBiD{EiNyMap@yBaXBwFjBkOlEuVFI~AYrFsBbFeChjA__@fEgA`"
            + "CYvCBNDBBTvAnEbi@At@oEvk@IxBGXEl@UlAyFnOyCdGqGbR{Qtu@_BzC}JvMBTT`@f@f@^R`JbB~@XbVlEbGd@tC~@jJt@RTbAvFBz@g@v`"
            + "@DVJPbETjA?p@EhNgGpG}DH@pD|Il@fCpHfl@GHkFrDuF|A";

    private static final String SANTIAGO_MARATHON_ROUTE =
            "vybkEnmfnLfD{AhDyAfD{AfD{AfD{AhDyAfD{AWyFUyFWyFWyFUyFWyFWyFUyFWyFWyFUyFWyFsCoDqCqDsCoDqCoDsCoDqCoDsCqDqCoDsC"
            + "oDqCoDsCqDqCoDsCoDqCoDsCqDsCoDqCoDmCoDkCqDmCoDkCoDmCoDmCoDkCqDmCoDkCoDmCoDkCqDmCoDmCoDkCoDmCqDkCoDmCoDuDaCwD"
            + "aCuDcCuDaCuDaCwDaCuDcCuDaCwDaCuDaCuDaCwDcCuDaCuDaCwDaCuDcCuDaCwDaCuDaCuDaCuDcCwDaCuDaCmCoDkCqDmCoDkCoDmCoDmC"
            + "oDkCqDmCoDkCoDmCoDmCqDkCoDmCoDkCoDmCqDkCoDmCoD|C}C|C}C|C}C|C}C|C}C|C}C|C}C|C}C|C}CzC}C|C{C|C}C|C}C|C}C|C}C|C"
            + "}C|C}C|C}C|C}C|D~A|D|A~D~A|D|A|D~A|D~A~D|A|D~A|D~A|D|A~D~A|D|A|D~A|D~A~D|A|D~A|D|A|D~A~D~A|D|A|D~A~C~C~C~C~C"
            + "~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~C~ChBpEfBpEhBrEfBpEhB"
            + "pEhBrEfBpEhBpEhBpEfBrEhBpEhBpEfBpEhBrEfBpEhBpEhBpEfBrEhBpExCxCxCxCxCxCxCxCxCxCvCvCxCxCxCxCxCxCxCxCxCxCxCxCxC"
            + "xCxCyCxCyCxCyCxCyCxCyCvCyCxCyCxCwCxCyCxCyCxCyCxCyCxCyChBqEfBsEhBqEfBqEhBqEhBsEfBqEhBqEhBqEfBsEhBqEhBqEfBqEhB"
            + "sEfBqEhBqEhBsEfBqEhBqEmC}DoC_EmC}DoC}DmC}DoC}DmC_EmC}DoC}DmC}DoC_EmC}DoC}DmC}DmC_EoC}DmC}DoC}DmC_EoC}DmC}DgE"
            + "oAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAgEoAuDfCuDfCuD"
            + "fCuDhCuDfCsDfCuDfCuDfCuDhCuDfCuDfCuDfCuDfCuDhCuDfCuDfCuDfCsDfCuDfCuDhCuDfCuDfCq@xFq@xFq@xFq@xFq@xFq@xFq@xFq@"
            + "xFq@xFq@xFq@xFq@xFq@xFq@xFq@xFq@xFq@xFq@xFq@xFq@xFxAbFzA`FxAbFzA`FxAbFzAbFxA`FzAbFxAbFxA`FzAbFxAbFzA`FxAbFzA"
            + "`FxAbFzAbFxAbFzA`FxAbFxA`FzAbFhBpEfBpEhBrEfBpEhBpEhBrEfBpEhBpEhBpEfBrEhBpEhBpEfBpEhBrEfBpEhBpEhBpEfBrEhBpEtA"
            + "hFtAhFtAhFrAjFtAhFtAhFtAhF";

    private static final String SEOUL_MARATHON_ROUTE =
            "aoidF{f_fWpHKbJTrPE|KDj@@tCl@lD~@fDv@jEnA`A\\XKVOBIHYBYcA_FKa@u@kHKsAc@qDQ_AcAkBgBu@iAi@_A[_EcAoGiAi@{@aAiBU_"
            + "ZS{KW_Q_Be{@AiBh@eG~@iJTeD`@yDNcAOElAkGAiAMo@Y]Y{@i@oEe@sAe@s@m@i@u@_@cAKm@@}@\\C`@@`AQz@g@vA]nAAR]bAQt@E\\?HV"
            + "hA|AbAGNjFlDh@X~@|@PVJVBZA`B@Qw@zHuAhO?lB~Ah{@\\`QJ|L`@h]FvK?fIo@_@eIUyEEXmJRgIjAiL^sCb@iEJ}Mk@kTc@yLIyAUmFc@"
            + "iIo@oEsAyNSwCAy@AkKE_LWcQHqOGcVAk@s@aEk@oBoC_HaA}B_AmCWeAOsAEeA?mAVoEpEkUxAcHfB_KHiAF_BCqAM{As@wCw@wBgEuGkAc"
            + "Ca@oAMs@]iDOqBCkACe@EKKCqAAQJIZC`@V|EJj@f@vB`@xAx@lBr@rAxDfGd@~@Rd@Nh@ZxAHv@DhA?tBC^{@bFkFrXwAzHa@jECjAJlCf@"
            + "~D^nAb@hA|E~Kf@~AZpARxAHnUBrNAr@TfKDrEDjID|QH~Al@jFb@|Dj@zD^vDNbCJfBH`Gb@zOf@|LJ~FCpHE~AEr@mAhKS~Bi@nFk@tTiD"
            + "C@cQEmDSGEa[G{DOgFE}CCwDSyGE{G]oPQqCWuKIwAIcGEiAEkKMiNCyKM{@{@wEUgBaBuLyDkRsBoL_GcViCwIR]f@iArGgROom@OmR?sCv"
            + "C}N^iCr@oDTg@lMg_@`@iAz@cBrBwC|FiJlPuVvF_IjFcI|@cBj@yATyAp@}HtA}PxBaZhAcNb@iBxFgS`FmPrDqM\\J^^tAn@rB~@TPhDtAv"
            + "BbAnClAPD~IhD|FhB\\LlGzCnE|B^VjAt@RPcBhKSlBG`AUzCKjBGpA_@zGC`A?j@HpENjELbHDpHMvEm@|HgApH_BbIk@nB}BfHgAnDUz@Yd"
            + "B]|BqApKiAbKEtA?pBZdJHtDr@rAl@XzPmA~SsAn@@tEj@fI`BnFcWn@eDdEeXnBcKxLus@ZcBxAaJ|BaNpE}UhFcXtAcH`E{Rx@aFDw@ByC"
            + "O_CYsA_@uA[aAyAeElBmAdSwNhFqDrB_Bjk@aa@lD_C|FqExI{FfBgAh@a@~FiD~BiBr@`DrBlNPtAbAvST`AjA`V?r@O~QEn@UvBk@pf@?G"
            + "iGbA";

    private static final String SHANGHAI_MARATHON_ROUTE =
            "cot}DsrodVfBzDfB|DhBzDfB|DfBzDfB|DhBzDfB|DfBzDtAfEtAfEtAfErAfEtAfEtAfEtAfEb@tFb@rFb@tFd@tFb@tFb@rFb@tFb@tFd@"
            + "rFb@tFb@tFb@tFb@rFb@tFd@tFb@tFb@rFb@tFb@tFd@rFb@tFb@tFtDmBtDkBtDmBtDkBrDmBtDkBtDmBtDkBtDmBtDmBtDkBWwFWuFUwFW"
            + "uFWwFWuFUwFWuFWwFWuFUwFWuFWwFWuFWwFUwFWuFlEl@nEn@lEl@lEl@nEn@lEl@lEl@nEn@lEl@lEl@nEn@lEl@lEl@nEn@lEl@lEl@nEn"
            + "@lEl@lEl@nEn@lEl@lEl@nEn@lEl@lEl@nEn@lEl@lEl@nEn@lEl@hA~EjA`FhA~EjA`FhA~EjA`FhA~EjA`F~DjB`EhB~DjB`EhB~DjB`Eh"
            + "B~DjB~DjB`EhB~DjB`EhB~DjB`EhB~DjB~DjB`EhB~DjB`EhB~DjB`EhB~DjB~DjB`EhB~DjB`EhB~DjB`EhB~DjBfE|AfE~AfE|AfE|AfE~"
            + "AfE|AfE~AfE|AfE|AfE~AfE|AfE|AfE~AfE|AfE|AfE~AfE|AfE~AfE|AgE}AgE_BgE}AgE_BgE}AgE}AgE_BgE}AgE}AgE_BgE}AgE}AgE_"
            + "BgE}AgE_BgE}AgE}AgE_BgE}A_EkBaEiB_EkBaEiB_EkBaEiB_EkB_EkBaEiB_EkBaEiB_EkBaEiB_EkB_EkBaEiB_EkBaEiB_EkBaEiB_Ek"
            + "B_EkBaEiB_EkBaEiB_EkBaEiB_EkBtD~BtD|BtD~BtD|BrD~BtD~BtD|BtD~BtD~BtD|BtD~BfE|AfE|AfE|AfE|AfE|AfE|AfE|AfE|AfE|"
            + "AfE~AfE|AfE|AfE|AfE|AfE|AfE|AfE|AfE|AfE~AfE|AfE|AfE~AfE|AfE~AfE|AfE|AfE~AfE|AfE|AfE~AfE|AfE|AfE~AfE|AfE~AfE|"
            + "AgE}AgE_BgE}AgE_BgE}AgE}AgE_BgE}AgE}AgE_BgE}AgE}AgE_BgE}AgE_BgE}AgE}AgE_BgE}A_EkBaEiB_EkBaEiB_EkBaEiB_EkB_Ek"
            + "BaEiB_EkBaEiB_EkBaEiB_EkB_EkBaEiB_EkBaEiB_EkBaEiB_EkB_EkBaEiB_EkBaEiB_EkBaEiB_EkB~CvB~CvB~CvB~CvB~CvBlDpCjDr"
            + "ClDpClDpCjDrClDpClDpCjDrClDpClDpCjDrClDpClDpCjDrClDpCmDqCkDsCmDqCmDqCkDsCmDqCmDqCkDsCmDqCmDqCkDsCmDqCmDqCkDs"
            + "CmDqCMnFKnFMnFMnFKnFMnFMnFKnFMnFMnFKnFMnFMnFKnFMnF";

    private static final String SHENZHEN_MARATHON_ROUTE =
            "s~qhCogdwTP`FR`FP`FRbFP`FR`FP`FP`FR`FP`FRbFP`FR`FP`FP`FR`FP`FRbFP`FR`FP`FP`FR`FP`FRbFP`FR`FP`FP`FR`FP`FRbFP`"
            + "FR`FP`FRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRdFRbFRd"
            + "FRbFRdFRbFRdFRbFRdFhDzBjDxBhDzBhDzBhDzBjDzBhDxBhDzBjDzBhDzBhDxBhDzBjDzBhDzBhDxBjDzBhDzBpChDpChDnChDpChDpChDp"
            + "ChDpChDnChDpChDpChDpChDpChDpChDnChDpChDpChDpChDpChDnChDpChDpChDpChDpChDnChDpChDpChDpChDpChDpChDnChDpChDpChDq"
            + "CiDqCiDoCiDqCiDqCiDqCiDqCiDqCiDoCiDqCiDqCiDqCiDqCiDoCiDqCiDqCiDqCiDqCiDoCiDqCiDqCiDqCiDqCiDqCiDoCiDqCiDqCiDq"
            + "CiDqCiDoCiDqCiDqCiDkEv@iEv@kEv@iEt@kEv@iEv@kEv@iEv@kEv@iEv@kEv@iEt@kEv@iEv@kEv@iEv@kEv@iEv@kEv@iEv@kEt@iEv@k"
            + "Ev@iEv@kEv@iEv@kEv@iEv@kEt@kEv@iEv@kEv@iEv@hEw@jEw@hEw@jEw@jEu@hEw@jEw@hEw@jEw@hEw@jEw@hEw@jEu@hEw@jEw@hEw@j"
            + "Ew@hEw@jEw@hEw@jEw@hEu@jEw@hEw@jEw@hEw@jEw@hEw@jEw@hEu@jEw@hEw@jEw@iD{BkD{BiDyBiD{BkD{BiD{BiDyBiD{BkD{BiD{Bi"
            + "DyBkD{BiD{BiD{BiD{BkDyBiD{Bu@~Ew@~Eu@|Eu@~Eu@~Ew@~Eu@~Eu@|Ew@~Eu@~Eu@~Eu@~Ew@~Eu@|Eu@~Eu@~Ew@~Eu@~Eu@|Ew@~Eu"
            + "@~Eu@~Eu@~Ew@~Eu@|Eu@~Eu@~Ew@~Eu@~Eu@|Ew@~Eu@~Eu@~Eu@~Ew@~Eu@|Eu@~Eu@~Ew@~Eu@~Eu@|Ew@~Eu@~Eu@~EgAtEeAtEgAtEg"
            + "AvEgAtEeAtEgAtEgAtEeAtEgAtEgAvEgAtEeAtEgAtEgAtEeAtEgAtEgAvEgAtEeAtEgAtEgAtEeAtEgAtEgAvEgAtEeAtEgAtEdDdCfDbCd"
            + "DdCdDdCfDbCdDdCdDdCfDbCdDdCdDdCfDbCdDdCpEXpEXrEXpEZpEXrEXpEXpEXpEXrEZpEXpEXpEXrEXpEXpEXpEZrEXpEXb@bFb@dFb@bF"
            + "`@bFb@bFb@dFb@bFb@bFb@dFb@bF`@bFb@bFb@dFb@bFc@cFc@eFc@cFa@cFc@cFc@eFc@cFc@cFc@eFc@cFa@cFc@cFc@eFc@cFqEYsEYqE"
            + "[qEYqEYsEYqEYqEYqEYsE[qEYqEYqEYsEYqEYqE[sEYqEYqEYaEO_EQaEOaEO_EQaEO";

    private static final String SINGAPORE_MARATHON_ROUTE =
            "kn{Fc}|xR_Hh@kDhGmU_BmFgCaDwJoCsD}DcCkBGyFxCGfAtMjSzCwCcb@{s@kBeY{BeDuBaAhGwTdEmHhJpWsAfEkHbCcAxAV|T`CjEe@zB"
            + "hPdZl]di@jObNyCbFkJuHjIsI~GtBnBg@`EoHzL{@LyF{AeBmKjBmQ{@c@`@jAbBfEjBlDgAvBkGeGgp@y@iYsCiKtAyJUe_@`B_J@ak@x@m"
            + "FcCkIoAiNmD_A_Oyi@qC{OhCcL_BaD}GqFeZs|ApYh|A~AbCpFlDj@|AG~B}BpFbDhSpNph@vCb@hAdDRzHhCvJOv]pAzVhLnAf_@fp@pAD`"
            + "GwCzFE`FhB~F~HvBU`@y@lAx@J|AsEjEObCtIlMjCn@rB`DgFbPB~H~DrHpUdN_i@bbAta@nUvZhXdA`gAtb@he@zBvEv@|W[nEo]br@cCtY"
            + "cF~Re@jKCsHtFoTlBkYd^us@XkFu@}VoAaDwe@oh@EueAsZgX}`@{Tm@yC_BkBuRgFwClAwAnB";

    private static final String STOCKHOLM_MARATHON_ROUTE =
            "s~eiJavjmBfB`Hb@nAr@vAb@l@`BxAV\\Rr@DdAcLxs@qEfRNp@`AfBNd@jC~PbCrQ`CpNpBdNrq@qn@tAyAb@`DzH~d@yDfD}ChBKRMrAB`@"
            + "`ArFPXnBiBf@w@JDJK|GyGJQ@_@rB}B?]w@mEnToRx@aB~AqE\\_DjM}UtAfB`CeCbBOjAi@lBaCrAaD|@eDHiADqIlAuFt@{Fe@cAuE_DqIy"
            + "BoCTqCpCaIbKdAfJeIfLOgAoA_Xk@CoBdAg@NuCpAgG|CONQy@U_ULsChFu\\LsB{@ggAw^jQq@eDKQm@a@m@SU@Yd@m@`BGv@AjAHbBFTl@l"
            + "@aO~lAQHqEsCaJqH~Uk{AfKkv@JWLCjNdLRH|AVXJxFfE|@j@f@qER@n@O^Sb@_@j@oAPy@Hy@DmCO_Do@oDoB}He@_GMe@OS_@OYcCu@uPU"
            + "_M~Awp@DyDEkCSwCqAkLCu@Fq@fEkQ~@}Eh@mB`AuBrDmGp@g@^A|ATPHdAdAf@JbEaCrDkBbA[`HsAhCa@nBcA|@u@xBcAl@c@F~KIlAy@n"
            + "GTtII~GLrAfAzBR`AVjBLhDKtD_@|Ee@pF{@vGo@zGc@pEG~BJtBlBjUJh@`ArA`@lAVpAJ`BEpAUbAMVcAv@Mj@\\tN@nFaAdReDh\\gAnDu@"
            + "rAoBdBgD`Ck@TYDq@CkEgA_@?_@JmK`LiCdA{BfAY\\j@bv@BrQKjAqD|TGzAJ|A`@lAb@h@VL`@B`@U\\i@xA}DlCmGxFhK@LeCdKGtDFn@Lf"
            + "@`G|@b@Gr@o@zJiLj@]fCS`@?hInB|GnCjB~AvD~Dl@pApAHpAcA`@eElAiYhEi[HYRQjKaEvDbl@pPcGdBoV|McFpCpRnAhSeWdK|@`MqFj"
            + "DQd@wDvAk@^fHvmAmb@lPnBf[wElBYj@SnA|Eny@}IbDzBnh@InAmNdGuAz@{AvAg^xd@eHjKwDzGs@h@SS}BoDG_@GGhKih@z@kLh@aLrFw"
            + "p@b@}D@eCG{@BcUW}Xq@qPM_@_Cp@Ij@IdHwEtp@gVcKQ`@yIdkAUGk\\uVIYMkBcAmHhH}Ip@iAl@qAf@yAzAaGDDnAuJbDs]pB_Pd@aCpBk"
            + "Bd@u@JDJK|GyGHMBc@rB}B?]w@mEpTqRv@}A|AsE\\{CtE{IvFcKrAhBdCkC`BKjAm@jBeCtAyC~@wDFo@AsFHgBjAwFr@wF_@aAuEcDuIyBm"
            + "CXmMdOx@rJaI`LKi@sAwXSC}QdIM[M}FK_JHiGpFq\\D_C_AyfAi^dQIEw@gDo@e@m@SU@IJw@fBMjADhDHZl@l@aO`mAONiPoLQRqGd_@k@c"
            + "@Ga@bBkN?YiH{LPgAnDzDZJZKZu@De@Aw@Sw@cAyA";

    private static final String SYDNEY_MARATHON_ROUTE =
            "n`omE_y{y[fVrCpIt@`ABzJcIxHeJdA}@hC}@fI_ClL{C`AQnAInB@fAJpBb@hMhFnb@rUtGjDjDpAlLrCtBr@bK|EdNzEbBPbO}@|ECdES|"
            + "ANvBb@l@Zz@r@f@|@~@|C^|CX`GTpCzA|I[ZaGzCud@zTkGpCW@oAgAk@Qe@BmEdAS?UIW]g@uAC[He@RWpCyArG{CjBgBfBNl@f@|AlB~Kc"
            + "FjQ}IxBuAx@aA^y@V}@LoAAmAI}@mAkIa@qBWo@k@aAy@u@q@[{@SeBOuJUw@Ke@Mc@[aAoAG?wKh@kIh@kI\\sC@kJl@{DLgFLyBSo@MeBeA"
            + "W[o@qAGgDO}BUcA[w@yIkMg@YgCo@OOGUDq@V_An@eBTSbBm@j@ERDRLT`@t@rCRZ|@`@`@Bb@E`FaBhEb@bCh@pGp@`Cd@JINcCJO^Ald@l"
            + "CnFLJW\\{ECKuOgA}@S_@MmDqDEI@KPa@jCkE`DLjRhAZO|@aBb@a@p@]dAGnc@nCPCtVw[h@YxQ}BzUiJtGqBvGcBrFgAzTeCdTsBxPqANDF"
            + "j@}Apg@BJDItAe`@\\yFLk@nGqCbG{BlASt@AdXvBpF\\bDLtAErAc@|@o@tGuGr@a@~XaElSuB|Fs@jIsD~@s@~JqOdKaN~A}CpAwC`AgBhAc"
            + "BjAeAvDyBBIKw@OGcCbAmBtAm@n@_B|BkChGs@vA}EzGqEzFoKdQs@n@uDfBiA\\sQrBeIv@{X`Eu@\\aHfH}@n@aA\\yABmKq@yWqBwABgAT}K"
            + "~DqCl@_RxBgMhA}LpA}L|AoGlAuG`BiEjAyEzAJ_@^e@rAm@~ToGHYGuCBwAdBaEHGhXgADJq@dEAf@@b@JFT?FKfHuXFUTSbAwCd@]z@_@r"
            + "AOrE^pA@rASjAa@xDsCfCeCpEsF~B_Ep@{AXeAh@kEB}BMsBYwAs@uBoDaGg@gA_FaNw@sAaAiAcAw@k@]kAWeAAgBHaDXeB`@eBr@uAx@oB"
            + "`B}AbBsCjDgA|AmAvB{@zBi@bCUdBOpB?`DH|AR~Ab@hB`@|@tAfBdGnFbApAn@lA^pAXzAN`BA~Be@xCq@b@wB`IgBvFkYrAsLbAs@VoCzC"
            + "m@\\m@@uCUIR[pCu@tLQ`@qNhG_ARgRhCkUbZm@~@IDgJk@gZuBSGISEoA{B_DkAoBg@gAwAyDoBaCyEcEU]{@uB}BaDoA{@eB}@uDiCgEaBi"
            + "@g@yBeEYOc@G[@iCn@}@LeE@SBOLCL?NRPz@D~Db@hDl@rE~@t@^r@d@tBxBxGtF~@r@xBfAjI|GjB~B`CdGjDzFN|@IbAkAnBa@`AGF]DkV"
            + "}A}@?kh@uD{CoD";

    private static final String TAIPEI_MARATHON_ROUTE =
            "qcywCg|}dVaAdqAo@nC{BdCC`CtBfCmAxy@p@r@o@|Cd@ra@[|h@sDni@pCbA`Rcg@nR`KqNhb@oBfZ}J~`@oaAmRZiGtCeJbm@t@v@yN~Ai"
            + "I}AqBaa@}Hai@iRox@mBgSbCcIJoo@_LcGeNaHa@uBeBsEcLo@sI|@{JxCkvCdE_^@oN}EgTb@oLxCaEdF{CzMuEvSL|LfC~H^rs@kGxHmEt"
            + "BsGCeE_BqFyd@igAp@aFvEcE~DgKb@{JfCsNUeV}Bu\\uCoNuEaJgKoJeBqC]mDfC}LvRiM~GmHbDYfCnAgCoAcDXcYzRlFkKxL_L_@o@_K|H"
            + "cH~K}ApDoCvSr@xB~NzLfFrKbCfMbC~_@L|OqCxPPhJbDzJzDdCrL~MnFvMtHlb@dHjk@e@nIiKtGmP?aV|B_WtHcIUiMeGeQwEgINwJtBkD"
            + "jBq@fChO|ZdCpKPse@tZfA|IzAxuAmMi@`xB";

    private static final String TORONTO_WATERFRONT_MARATHON_ROUTE =
            "apniGfnocN}x@bWZbCbAvJzDrY`G`f@|CtUnBvPrDzYP|@Hv@NAx@WflAi^xXiI|DkAf@GdCs@fn@eRRz@PR`@nAf@rAR`A`BxDNTLn@Ff@H"
            + "pDXrGJr@JVXf@RRXPZHLJLDtANb@A|A[Lv@r@nCRf@Pn@Tf@Xb@x@|@VLd@Jl@JzAr@p@b@^Vn@v@d@dA@x@t@pDXb@xAtGdBfIHd@Az@R|B"
            + "Db@Pd@~@hKXhDEx@RrDTjAdArYAtAGdASfAkDtNYd@aA|BeEpIo@xAYfA]xBcAvKKjCOpHIf@a@pAg@bAS|@mGbRU\\s@xBgAtEiAbE_CxHcA"
            + "`GyA`KSjBsAbOKpBFtCJ`BD~A?tAGbEBjDFhBRjDRvBfAjJFbB?vCFzAXzBZtAPh@xA~CVj@VdAx@rDj@_@m@wCYkA[{@o@mAk@sAc@{ASkA"
            + "Iq@KaB@sCAq@E}@sAkLGo@WeFEoC@qBFeCZuHb@wG|BqTLcBD_B?mAIiC?y@B_@N_AjDsKZmAp@eD|@mDFk@~FeQL]j@{@^o@l@_AxAmBVa@"
            + "Pa@j@}Ah@uBVoANaAd@wEt@cLRcCT{Ad@_DP}@VeBjDuNRgAFeA@uAeAsYBmAUqDQy@yAsPBk@YcDOg@DCSsAoAwFiDiPc@qAGFQa@o@w@_@"
            + "Wq@c@{As@c@c@eAs@}BgCSg@Sy@EoAWqCI_AMw@s@yTKgB_@}COaAwBaJ_@uBeA}D}BqJQsAKwAE{AU{Bu@aFYiAaAaFuAcNQqDi@_Fu@aGq"
            + "AuH[qAi@yCy@eIG]wKhD}Ab@YCaElAIRiBn@UT_@AiF`B}CkVcFo_@wAiIuCoK]gAsAwJgBqLkEq[_@mAW[aAk@w@k@o@eAiDkHpFaBmAyII"
            + "qAgAcIa@iC]J{ANa@EgBk@gBeA]OSE[Au@JUJiCfCuAdBq@n@WPoA^iA`@kAXgFz@gE`AqMlCoDp@aFlAcB\\yAPxAQbB]`FmA~IeBvImBdE{"
            + "@|Ey@dDeAb@Sz@w@bAoAdCkC`@Yl@Mr@DbAd@j@\\zAl@`APl@?n@El@QjAfI^|CFlAbA`IgEnAe@FwBoEOi@_I{SoAgEi@aCUgBQwCCaCR{B"
            + "v@qDT}ADaA?kAGm@m@qDu@wFo@eEw@mGqDeXdQoFbAc@\\[_AuCeCaHaFsM_CyGiCuIq@qBa@gBeAsFa@aC{BkPyAyGk@iDM]}Fob@Ay@}Hqj"
            + "@eAmHUaA]kAs@aBq@gAgAmAk@g@y@e@i@Qm@Gc@@q@P_@LIJ}KhD}Ea^aCyQiIep@TvB`Er\\fIhn@dClQtJwCd@SP@lAWl@A`@DXHr@^dBzA"
            + "rArB|@~Bf@|BhF|^dBvMf@jDTp@^fCn@`FlDdWHbATfB|@`GnEb\\p@~CpA|D|DzK~JfXnB`GkSrGnE|\\|C|THfBErAIv@eAtFQzAAbAJzDVx"
            + "CTpAn@jCnElMRd@JLXp@jBxET`@FBlBdEbFhKtAhAd@RRRTZTt@tItm@t@rFLlAZtAfBfGbArDNr@xGrf@o[|J";

    private static final String VALENCIA_MARATHON_ROUTE =
            "apyoF`gdAsA{@sIkCQSAe@G[M[IOYU]KYAQDSH[VQ^gBe@eEqAD{@`Iwb@lHkg@x@yPg@uPwAwGOKM?m@LY@c@ECQ_KiLq@aAk@sAe@{AHW?"
            + "g@M_@YSO[Ks@[eFA_EKA?oFISI?KQa@GkGQiCBAU@Ta@FqERmAL_@NARMRKHOAQKcAVyADcc@Ce@Bo@\\EvBGVKHERIfDSrAaHn^MVWHSRELE"
            + "V?VBVHRCb@y\\jfBIRHSp@R|@yE`FeVHBBEFAFWvGfC|HfCrDfApGtBRTDV?x@eE|S_@`A_@b@MX?h@FPIbBoBpJWl@WFYRS@e@IyIgDmBcAw"
            + "@m@gD_Em@_AeBcDmC\\cDwAc^tF[La@`@Gf@GLUTMDU@SEMKIMk@@q^lVYj@Gh@Bp@Kt@Vv@fFvKd@x@~A|Bx@tApFdLRAf@[NCNHBYxBoKtI"
            + "fDxGtCtEjBrBt@RBf\\nMpJbDjAP^AzAWr@?HDXKri@oa@FUPGt@q@b@}Bt@_ADa@k@cA}BmD{@m@cHoC}FaCcLkEeFgBE_@SYDi@~BoLVi@N"
            + "QF[C]R_C`EcSZu@TKTc@F{@Zw@|Pw{@cBi@iQn|@o@p@m`@}M`SmdAJc@NSTQLSFW?[Ic@?g@pFmYr@_DRWrfAtIJRf@HRXv@dBt@fApBzBn"
            + "GtHj@TATk@tC_H|\\e`@|nBdQ|Gh@Rt@RZ`@GpAq@\\kA[QSoVpJ_A~AWl@]^yAIeAj@ELKDMCui@pa@]d@mB~AOnBO`@}FpKiA|Ck@r@qBjBg"
            + "A|C[n@eDjFeA~Aq@|@k@hAeDpHKd@_@tLEjEGz@\\zCNj@NlAtCbJXp@ZMrFkDFQ?_@UWWi@qBmIGu@?k@l@kGZcBr@{B|DiIXw@j@oBhAaDv"
            + "B_HxFqKj@u@fCqC|@s@fAY|@O`EBTFjA@vC^j@JDHBPcDjXDDF@p@?jAPLJb@?nC]bG[LQLr@XlH|@N|@Op@BLZB`CEv@{A~HXTbDvBKGrBp"
            + "AZ^M`Ag@tBeA~CoH~JCLBpFI`@cD|ByCfBsQdLBFge@b\\DnBCEFb@tBhGCIbKn[\\dB@f@OtMUnLfA`JHVzNoBzEc@|Fu@vBQ^FZ?|IgAXHDD"
            + "tA\\tDn@dFlA~AQbAYnReAl@AXMR?PFxAEh@M`FmCnQeJNq@MqBk^ia@_AkAqFgGa@i@wFgGeDsBhDi^fEs_@KcAUy@IQ}@w@cKmHYOBa@n@c"
            + "D`BoLz@kFFq@EeA_@w@?GGI@GyAaCEOKEkB_DsBaDGQ{D_GmA}AsGkHGQHa@?kAOCLq@~EoMNi@Tk@d@[x@a@hEeCt@i@pKyF|D}BfEuBlGe"
            + "BtA[tC}@p@Y`CqArIgGFKLu@ZeA~@kGTOHKXCZiBt@sClCkF";

    private static final String VANCOUVER_MARATHON_ROUTE =
            "eypkHdxknVsIpN}@hT`NjS~LPhPiMlgAvA}EdeCmAtnEmOfk@s@td@i\\|lAicAiAg@nNwRz`@mG_LmJgEi_@xH_B|kAs]g@h]zC`B|rA~`@j"
            + "kBu]hl@gLhFsEjLmNdHwE~JcVuFqSo_@kNcByS_]eMqb@~DkqAnL{yArIaa@cAqYzIKdHcQ~LaDzA{Lp@guAsUeDlFo~AqIu^^ciA{LcCwM}"
            + "MrAwU`Xj@f@aEiZinAgn@~_AyVOkYbg@cNbCoBpOkLjGHlOsD~EkOhCkIqLac@sB_IiTaIoDgDkImDy[wBmVfE{I~R}QxPqFdGwPrOwL|AuX"
            + "pP}a@TgIsFiMfCy@zK`FqAlTjD|HWfPpIlOiI`OnDfWjDvE`Dj@jG}QzEvBvO_VfK{l@";

    private static final String VIENNA_MARATHON_ROUTE =
            "_dkeHc`ecBz^ry@~Zbs@bLnWJn@HjDJ~@Nn@Zv@z@zA\\`@bAr@h@N^?RE|@w@bA{BL[l@iC@_ACk@v`A}{BxKwVr@t@n@`@jA\\|@NhDBf@Bj"
            + "BVfARp@TjFpCtA`A`Az@`B`BxAnB~CzEd@zAGLa@h@}FlEkJdG}@r@gAvAw@lAsAzC}@jCo@tCa@`Cc@nDmBzRWbB_@fAk@jAkAbBs@t@yAd"
            + "AcBt@q@LmGb@kAJ{BZwG~BgB~@}GfEaEvD_@b@aAdBwBlGQ~Aa@|Bm@fGW`D@`DTrDVbAzBpHl@hCb@tCTxBTnCdU~Dbk@dl@XtAh@jDB\\Cd"
            + "@}DrXs@jFbJfExFvK|E|KZdAbCtG\\zArCvU\\tBRbA\\lAj@xA`@x@bA`B^d@b@^`Af@jAV~AExBO|AAf@@xAT\\JjAh@`@TrA`An@h@~AhB^f@"
            + "Vf@r@nBXxA`@pCz@nIdBjRNjD~@b_@NvBJn@Pz@Rv@j@pArAvBxA|AtCzBl@`@x@t@h@p@pClEj@jATp@dAdEXhBLjBLlE?vQUpCQjA_CdL["
            + "vAq@dC}AvHYtBg@nCaIj`@SdAMfA[@mARW@oJgEGsAn@oWE_E[gJI{C_@iDqBmMi@uEOoDUkJQaFUwCI]uHuJyAqB}@wA{@iBDGy@mBo@aCs"
            + "CwL?eBK_AOi@Ua@]}@[gBWaC_@eBAi@cAiKMcAkCcRu@oDeBeHoBmG{CoLoCaNkBkMg@}Dm@uB[u@a@s@cAoA{AeBQCeB`B_D`FiQpViDrA}"
            + "DhAad@sFBUt@_NZaIMaBqAuDoSkk@iBoCON{@bBw@fAg@v@a@`@uA`AgAj@iDx@cF`@{J\\eAFmAVw@\\_Ar@}@x@cBjBeCtD]kAuAuDWe@tE_"
            + "HrAiA~B}ApBu@jBg@vAw@XMf@MpHm@t@?hE`@R?\\GLG`@[nAuAtA_CpDkHz@wAn@g@`Ae@xBkBdDcDrBcBzDiCXMpBQPGt@c@RYt@yApAgE\\"
            + "}APgAZiDPsCJ}D?_DEiCMaCO?sBZUF{ATUKW_@wC_G_AwBW}@wDiIOc@mD{I_CyFGe@PmAn@sA`@cAl@iCBgAbUwh@n[gu@`[qt@{@cAgC{B"
            + "uCyBUUOUkAw@u@]i@Cc@JQPq@\\m@H_@C[Ku@u@qCmDBYPPRZjCbDb@X^FP@d@It@Wp@Kh@Bt@\\jAv@x@`@vGhFZZFOLTtfAufCTs@IOIY?_@"
            + "D]FOPOREPDJHJPDP@TC`@KZUPU@UMUr@_Q~`@uP|a@cc@ncAh@l@n@`@jA\\|@NhDBf@BjBVfARp@TjFpCtA`A`Az@`B`BjA|A|DlGT|@gAnA"
            + "kQxL}@r@gAvAw@lAsAzC}@jCo@tCa@`Cc@nDmBzRWbB_@fAk@jAkAbBs@t@yAdAcBt@q@LmGb@kAJ{BZwG~BgB~@}GfEaEvD_@b@aAdBwBlG"
            + "Q~Aa@|BGr@Dc@PJhC|@LRhIpCJJHRq@lZH`BXlA~I|@|An@dBhArIdGiBvLb`@na@T`An@bE@\\Ab@oEh[i@`E_DfUuTz[QBWEoV}E";

    private static final String WARSAW_MARATHON_ROUTE =
            "kpx}H{ze_CRsIRsIRsIRsIRsIRsIRsIRsIRsIgAyHeAyHgAyHgA{HgAyHeAyHgAyHgAyHeAyHgAyHgA{HgAyHeAyHgAyHcBiGcBkGcBiGcBi"
            + "GcBkGcBiGzDaDxDcDzDaDzDaDzDaDxDcDzDaDzDaDzDaDxDcDzDaDzDaDzDaDxDcDzDaDzDaDeD|EgD|EeD|EeD|EgD~EeD|EeD|EgD|EeD|"
            + "EeD|EgD|EeD|EeD|EgD~EeD|EeD|EgD|EeD|E{ChF}CjF{ChF{CjF{ChF}ChF{CjF{ChF{ChF}CjF{ChF{CjF{ChF}ChF{CjF{ChF{CjF}Ch"
            + "F{ChF{CjF}ChF{CjF{ChFRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIRrIlB`HlB`HlB`HlB`HlB`HlB`HlB`"
            + "HlB`HlB`HlB`HlB`HlB`HlB`HlB`HlB`HlB`HlB`HlB`HlB`HlB`Hx@|Hz@|Hx@zHz@|Hx@|Hx@|Hz@|Hx@|Hz@zHx@|Hx@|Hz@|Hx@|Hz@z"
            + "Hx@|Hz@|Hx@|HgD|DgDzDiD|DgD|DgD|DgDzDiD|DgD|DgD|DgDzDgD|DiD|DgD|DgDzDgD|DgD|DiDzDgD|DgD|D}DlC_EnC}DlC}DnC}Dl"
            + "C}DnC_ElC}DlC}DnC}DlC_EnC}DlC}DnC}DlC_ElC}DnC}DlC}DnC_ElC}DnC}DlCuCxFuCxFuCxFuCxFuCxFuCxFuCxFuCxFuCxFuCxFuCx"
            + "FuCxFuCxFuCxFuCxFuCxFuCxFuCxFuCxFuCxFuDuDuDuDuDuDuDuDuDuDuDsDsDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDsDs"
            + "DuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDuDsDsDuDuDuDuDuDuDuDuDuDxA}HzA}HxA}HzA}HxA_IzA}HxA}HzA}HxA}HxA}HzA}HxA}"
            + "HzA}HxA}HzA}HxA_IzA}HxA}HzA}HxA}HxA}HzA}HxA}HzA}HxA}HzA}HxA_IzA}HxA}HzA}HxA}HxA}HzA}HxA}HzA}HxA}HzA}HxA_IzA}"
            + "HxA}HzA}HxA}HxA}HzA}HfEaCfEaCfEaCfEcCfEaCfEaCfEaCfEaCfEaCfEaCfEaCfEaCfEcCfEaCfEaCfEaCfEaCfEaCfEaCfEaCfEaCfEc"
            + "CfEaCfEaCfEaCfEaCfEaCfEaCfEaCfEcCfEaCfEaCfEaCfEaCfEaCfEaCfEaCfEaCfEcCfEaCfEaCfEaCfEaC|DgCzDiC|DgC|DiC|DgCzDi"
            + "C|DgC|DgC|DiCzDgC|DiC|DgC|DiCzDgC|DgC|DiCzDgC|DiC|DgCpDjBnDhBpDjBpDjBpDjBnDhBpDjBpDjB";

    private static final String WUHAN_MARATHON_ROUTE =
            "{mwyD_dtxTfDrChDpCfDrCfDrChDrCfDpChDrCfDrCfDrChDpCfDrCfDrChDrCfDpChDrCfDrCnBrEnBrEpBtEnBrEnBrEnBrEpBtEnBrEnB"
            + "rEnBrEpBtEnBrEnBrEnBrEpBtEnBrEfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEnAfEf@fEf@fEf@fEf@fE"
            + "f@fEf@fEf@fEf@fEf@fEf@nAaFnAcFnAaFnAaFnAcFnAaFnAaFnAcFnAaFnAaFnAcFnAaFnAaFnAcFnAaFl@eFl@gFl@eFl@gFl@eFl@eFl@"
            + "gFn@eFl@gFl@eFl@eFl@gFl@eFtCuCtCuCtCuCtCuCi@qFk@sFi@qFk@sFi@qFk@sFi@qFi@qFk@sFi@qFk@sFi@qFk@sFi@qFmCyDoCyDmC"
            + "yDoCwDmCyDoCyDmCyDmCyDoCyDmCyDoCwDmCyDoCyDmCyDkD_CiDaCkD_CkD_CkD_CiDaCkD_CkD_CiDaCkD_CkD_CkD_CiDaCkD_CrAwEpA"
            + "yErAwErAwEpAyErAwErAwEpAyErAwErAwEpAyErAwEgEi@gEk@gEi@gEk@gEi@gEk@gEi@gEi@gEk@gEi@gEk@gEi@gEk@gEi@cBgEcBgEcB"
            + "gEcBgEcBgEcBgEcBgEcBgEcBgEcBgEcBgEcBgEjAeFlAgFjAeFlAgFjAeFlAeFjAgFlAeFjAgFlAeFjAeFjAgFlAeF~DcB~DcB~DcB`EcB~D"
            + "cB~DcB~DcB~DcB~DcB~DcB`EcB~DcB~DcB~DcB~DcB~DcB`EcB~DcB~DcB~DcB~DcB~DcB~DcB`EcB~DcB~DcBfAcFdAeFfAcFfAcFfAcFdA"
            + "eFfAcFfAcFdAeFfAcFfAcFfAcFdAeFfAcFfAcFdAeFfAcFfAcFfAcFdAeFfAcFfAcFdAeFfAcFfAcFfAcFdAeFfAcFg@oFg@oFg@oFg@oFg@"
            + "oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFg@oFoEYoEWqEYoEWoEYoEWoEYoEWqE"
            + "YoEWoEYoEWoEYoEWqEYoEWoEYoEWoEYoEWqEYoEWoEYoEW}B~D{B~D}B|D{B~D}B~D{B~D}B~D{B~D}B|D{B~D}B~D{B~D}B~D{B~D}B|D{B"
            + "~D}B~D{B~D}B~D{B~D}B|D{B~D}B~D{B~D?tF?tF?tF?rF?tF?tF?tF?tF?tF?tF?rF?tF?tF?tF?tF?tF?tF?rF?tF?tF?tF?tF?tF?tF?r"
            + "F?tF?tF?tF?tF?tF?tF?rF?tF?tF?tF}BgE{BgE}BgE{BgE}BgE{BgE}BgE{BgE";

    private static final String WUXI_MARATHON_ROUTE =
            "guq_Eg|}|UlClCnCnClClCnCnClClCnCnClClCvDxBxDzBvDzBvDxBvDzBxDxBvDzBvDxBxDzBvDxBvDzBxDxBvDzBtD_CtD}BtD_CtD_CrD"
            + "}BtD_CtD_CtD}BtD_CtD}BtD_CfAjFhAjFfAjFfAlFhAjFfAjFfAjFhAjFfAlFhAjFfAjFlDzBnD|BlDzBnD|BlDzBnD|BlDzBnD|B}C|C{C"
            + "zC}C|C{CzC}C|C{CzC}C|C}C|C{CzC}C|C{CzC}C|C{CzC}C|CbBzEbBzEbBzEbBzEbBzEbBzEbBzEbBzEbBzEbBzEfEPfEPfEPfEPfEPfEP"
            + "fERfEPfEPfEPfEPzDoBxDqBzDoBzDoBzDoBxDqBzDoBzDoBzDoBxDqBzDoBzDoBzDoBxDqBzDoBzDoBl@uFj@uFl@sFl@uFl@uFj@sFl@uFl"
            + "@uFj@uFl@sFl@uFl@uFj@uFl@sFl@uFl@uFj@sFl@uFl@uFj@uFl@sFl@uFj@sFh@sFj@qFj@sFj@sFh@qFj@sFj@sFj@sFh@qFj@sFj@sFj"
            + "@sFh@qFj@sFj@sFj@sFh@qFj@sFj@sFh@sFj@qFj@sFlCkDnCiDlCkDnCkDlCkDnCiDlCkDSoFSoFSoFSoFSoFSoFSoFSoFSoFSoFSoFSoFS"
            + "oFSoFSoFSoFSoFSoFSoFSoFVwFTuFVwFVuFVwFVuFTwFVuFVwFVuFTwFVuFVwFVuFTwFVwFVuFuCaDuCcDuCaDuCaDuCaDuCcDuCaDuCaDuC"
            + "aDuCcDuCaDuCaDuCaDuCcDuCaDuCaDsEl@sEn@sEn@sEl@qEn@sEl@sEn@sEl@sEn@sEl@sEn@sEl@sEn@qEl@sEn@sEl@sEn@mAdFkAfFkA"
            + "dFmAdFkAfFmAdFkAfFmAdFkAdFmAfFkAdFmAfFkAdFlCjDnChDlCjDnCjDlCjDnChDlCjDlCjDnChDlCjDnCjDlCjDnChDlCjDrAvEpAxErA"
            + "vErAvEpAxErAvErAvEpAxErAvErAvEpAxErAvEfEt@fEr@fEt@fEt@fEr@fEt@fEt@fEr@fEt@fEt@fEr@fEt@fEt@fEr@fEt@dCyDbC{DdC"
            + "yDdCyDbC{DdCyDdCyDbC{DdCyDdCyDbC{DdCyDdCyDbC{DdCyDn@mFn@mFl@mFn@mFn@mFn@mFn@mFl@mFn@mFn@oFn@mFn@mFl@mFn@mFn@"
            + "mFn@mFn@mFn@mFl@mFn@mFn@mFuE[uE]uE[wE[uE[uE]uE[uE[uE]uE[wE[uE[uE]uE[?nF?nF?nF?nF?nF?nF?nF?nF?nF?nF{CdC{CbCyC"
            + "dC{CdC{CbC{CdCyCdC{CbC{CdC";

    private static final String XIAMEN_MARATHON_ROUTE =
            "{vjtCkujpUdCjDrLjFvEkM`w@pg@vMdL|I`LbXte@d`@ze@zJ~SlTjYvHbSjEjH~W~XtCdGzEvX~CvGhK`J`^~JdF|FfBdGc@rKuFvQSxYu@"
            + "`Fy@|CuQf[eAdRiDbQqC`YkRlt@ElFlFlHsBld@{AjJkD`HeUlVwKfHm^fO}OvEwLjHeZ`^ySjIaGj@w^_K}GsJqY}|AlY~}AtHtJf]hJbEG"
            + "jXqKv[g_@|KgGtMiDnf@mT`ZwZxCqFlBeLtBad@mEsKEoDxQus@nC}XjDgQ~@sQfN{TlDwJv@}FFqWnGsTZaIeC{I}EgF{]wJeIqGuFgLmD{"
            + "T{B_Gw[c^kMgZeRaWqLoUm`@ef@aXge@sI{Ked@y[{@oBg`Aml@cx@k[qMwC`MdDjx@v[p_@|UkEpM}KcFyCeD";

    private static final String XIAN_MARATHON_ROUTE =
            "{v`pEwu}wSsEUqEUsEUqEUsEWqEUsEUqEUsEUMqFMsFMqFOsFMqFMsFMqFMqFMsFMqFOsFMqFMsFMqFgEoAgEoAgEoAgEoAgEoAgEoAgEoAg"
            + "EoAgEoAgEoAqEIsEKqEIqEIqEIsEKqEIqEIqEIsEKqEIqEIqEIsEKqEIqEIsEKqEIqEImEu@kEu@mEu@mEu@kEu@mEu@mEu@mEu@kEu@mEu@"
            + "mEu@kEu@mEu@mEu@mEu@kEu@mEw@mEu@kEu@mEu@mEu@kEu@mEu@mEu@mEu@kEu@mEu@mEu@kEu@mEu@mEu@mEu@kEu@mEu@mEu@kEu@mEu@"
            + "mAeFkAgFkAeFmAgFkAeFmAeFkAgFmAeFkAgFmAeFkAeFmAgFkAeFMcGOaGMcGOcGMaGMcGOaGMcGOcGMaGMcGOcGMaGOcGMaGOcGMcGMaGOc"
            + "GMcGOaGMcGMcGOaGMcGOaGMcGGcGIeGGcGGeGIcGGeGGcGIeGGcGIcGGeGGcGIeGGcGGeGIcGGcGGeGIcGGeGGcGIeGGcGzBgExBgEzBgExB"
            + "gEzBgExBgEzBgExBgEzBgExBgEzBgExBgEzBgErBgEtBgErBgErBgEtBgErBgErBgEtBgErBgErBgEtBgErBgExCxCxCxCxCxCxCxCxCxCvC"
            + "vCxCxCxCxCxCxCxCxCxCxCxCxCxCxCsEVuEXsEVsEXsEVuEXsEVsEXsEVuEXsEVsEXsEVuEXsEVsEXrEKrEKrEKrEKrEKrEKrEKrEMrEKtEK"
            + "rEKrEKrEKrEKrEKrEKrEKrEKrEKrEKrEKrEKrEKtEMpEKtEKrEKrEKrEKrEKrEKrEKrEKfEr@fEt@fEr@fEr@fEt@fEr@fEr@fEr@fEt@fEr"
            + "@fEr@fEt@fEr@fEr@fEt@fEr@fEr@fEt@fEr@gEs@gEu@gEs@gEs@gEu@gEs@gEs@gEu@gEs@gEs@gEu@gEs@gEs@gEs@gEu@gEs@gEs@gEu"
            + "@gEs@sCxDsCvDsCxDsCvDsCxDsCxDuCvDsCxDsCvDsCxDsCvDsCxDsCxDsCvDsCxDsCvDsCxDsCxDsCvDuCxDsCvDsCxDsCxDsCvDsCxDsCv"
            + "DsCxDgBxEgBvEgBxEiBxEgBvEgBxEgBxEgBxEiBvEgBxEgBxEgBvEgBxEgBxEiBvEgBxEgBxEgBvEgBxEiBxEgBxEgBvEgBxEL|FJzFL|FL|"
            + "FJzFL|FL|FJzFL|FL|FJzFL|FL|FJzFL|F";

    private static final String ZURICH_MARATHON_ROUTE =
            "yib`Hwrcs@W_C?_@Lw@h@s@l@g@p@_@FMdJyEtUiLhc@qYzAsAbAwAz@eBRm@t@_D~@_HXqASIe@LyD`FuEpF}x@xl@r@|DoLnFuApAWdA?h"
            + "A\\hFt@pHFpAMfAsMbDiCd@w@?c@J{Av@aEfAWBWTsA\\iFV}A?BbDNt@\\VpAVRp@jAzGRvB^z@hBf@Z?VMnCoC|JaRdFsEZOd@|EjHh[dLgHr"
            + "@YTr@r@pFdDs@tLeAIuFyRt@{AwC}GoQgBoE[m@E]a@mAMm@]aDc@_Ba@{DYwC?_@Lw@h@s@l@g@p@_@FMz`@cSl]cUjFuDt@w@fAaBr@{At"
            + "@qCvAmJb@cBb@iA|GcLbIwINAlCkCxCcCfDaDzJwLdDmD`EsBdBg@~T_Bd@?x@OhAo@HOjF_CtIgBn@a@pEcF|@w@|AaA|HaBt@[nJoFt@Wl"
            + "AOzDSfAUnAc@z@k@zGoFrBqBrAgBr@uA|@kA|AcAxCaBfCw@tKcCjEmA`AQb@A`GaA~IiBp@IzAe@fGqDdQ}OJApAqAt@gA@OtB_DbMsQ~Ak"
            + "BjCqAFKjI}CN@|Ay@jBkAh@k@jA{@rKcJvAoBhC{HvA}CrAyBBSfEeF~@e@n@SnAWbAEt@JvD|@pA@|@MvAi@vAeA|ImJHCzG}JJ_@dEoGvA"
            + "iBjCmCrCiEt@{@jJoI`DyBbEmExD_CjA_BdBgDl@}@tHcIdEcCvCqDrAoCfGuO~EiQ|A}E~@}BdCcFfAyCpCwIpFcLf@cBd@oCFmALuKjB}R"
            + "VoB\\sA`@u@`Ay@~DaCf@gAeA_B_BkAkDeEM~CjBhKe@h@q@vA]rAWnBkB|RMtKGlAe@nCg@bBqFbLyEpNkDhH}@`CyG|UgGtOsAnCwCpDeEb"
            + "C}GfHs@|@aCpEmA|A{CdBaEhEuDjCkJnIu@z@sChEkClCwAhBeEnGUNsAnBeErGAL}IlJwAdAwAh@}@LqAAwD}@u@KcAD{@NcAZ_Ad@gEdFk"
            + "BnCa@zAa@~@iCzHwAnBsKbJkAz@Q?uCjBqAp@IPsHrCWHKCcA^{@n@GP_BjBiP~UuC`DO\\gPdOqG|DoBp@q@HgJjBiF|@s@Bu@LwEpA_OhDk"
            + "Aj@sErC[^uBpD{A`BaA~@sErDcCfBuBn@_BP}CNm@Jk@P}@d@qIzEeA^qCd@eCj@kChBwDlEkA`AcJlBkF~BsDnA_U~AeBf@uEzBuAfAcB`B"
            + "wKpMmJvIe@f@GTo@v@sG~GiG`Kc@`Aw@lCwAlJ_AfD_AhBsA`BwAlAub@~Xoc@rT}@z@[dDlBvQnAbBVh@pKhXD^x@bCb@xCDdAH\\?pAr@c@"
            + "vBo@b_@mDz@CJDJe@A]iBcAg@Q]EsFJYCuYv@eA^}LnHaBsGeEwQk@_GaGnFgJfQ_AfAmBfB_@HwAUk@o@]cCwAcIKW_@UmAQEEGWG{AAgBT"
            + "I~GMlIcCrB}@lAIvCi@|G_B`DoAHqAQ}BcRnDe@o@HyAAg@FiAvOZr@C\\ID_@u@kI?yBVaAtAwADqBb@c@";

    private static final String MELBOURNE_MARATHON_ROUTE =
            "xvyeF{szsZ{CJwC|AuGbMqEdExG~]`r@gU|Hq@rRRjHy@|FqCrEsJrKyG|qB{h@|JwApF~LiE|DcDtAgRhAuRfGcItMGtGe@|AmHtJoCjA}D"
            + "`@kDa@{LcEwJ`AsD`Dy@xCYlFiBjCxEtPrC`GbLnDt@rCh@LtI_GhNeP@wAjLsVnIkL|IyH~BrD?dCk^tg@eFc@dF`@h_@yg@KaCoCaDNs@x"
            + "HaF`@eBtBKtH_OCi@`C_A`FmEhGtJhPf\\gUjUoZrt@au@znB{BpHk@pGoBdGnBaEvA_Ljx@avBfb@w|@hF}EjCaAlCJjCxAtGDdDsBlEeFxU"
            + "oLzeAoHzEyA`HuElEwEha@{w@ea@dw@oDpDcMjHejA~IiTtKuE~F}CpB{FCcDeCsb@_{@iBBavBhi@eMjG_DfDqC~G}FpCkHx@aVOoEl@kMh"
            + "ES`@v@tFsA~MwA}BeHmA}AkGIeHrD{VfAb@|@jGz@nB|@jAdBLpKkFxII|GcGdH}BlAsBrBaIlFoF`CcEjA_Fb@sLjAsAx@VoFb|@s@v@kA`"
            + "AiEbAm^Pqu@jXsJch@lCg]fJz@dBk@jLuTsAkAf@}Bg@{CcAk@_Bv@";

    private static final List<CourseDefinition> DEFINITIONS = List.of(
            new CourseDefinition(
                    "amsterdam-marathon",
                    "Amsterdam Marathon",
                    "Amsterdam",
                    "Netherlands",
                    new String[] { "TCS Amsterdam Marathon" },
                    "Existing Amsterdam Marathon extracted route sidecar re-published through admin review after API geometry verification",
                    "Known ordered Amsterdam Marathon route replaced auto-acquired review geometry.",
                    "Start - Olympic Stadium",
                    "Finish - Olympic Stadium",
                    500,
                    41.844,
                    42.544,
                    AMSTERDAM_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "gold-coast-marathon",
                    "Gold Coast Marathon",
                    "Gold Coast",
                    "Australia",
                    new String[] { "Gold Coast Marathon" },
                    "Existing Gold Coast Marathon extracted route sidecar re-published through admin review after API geometry verification",
                    "Known ordered Gold Coast Marathon route replaced auto-acquired review geometry.",
                    "Start - Southport Broadwater Parklands",
                    "Finish - Southport Broadwater Parklands",
                    500,
                    41.843,
                    42.543,
                    GOLD_COAST_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "rotterdam-marathon",
                    "Rotterdam Marathon",
                    "Rotterdam",
                    "Netherlands",
                    new String[] { "NN Marathon Rotterdam" },
                    "Official NN Marathon Rotterdam 2026 GPX route and official course-map PDF geometry",
                    "Known ordered Rotterdam Marathon route replaced synthetic placeholder geometry.",
                    "Start - Erasmus Bridge / Schiedamsedijk",
                    "Finish - Coolsingel",
                    500,
                    41.761,
                    42.461,
                    ROTTERDAM_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "santiago-marathon",
                    "Santiago Marathon",
                    "Santiago",
                    "Chile",
                    new String[] { "Maraton de Santiago" },
                    "Published Maraton de Santiago 2025 42K map corridor and route descriptions through La Moneda, Alameda, Providencia, Parque Metropolitano, Estadio Nacional and Parque Bicentenario",
                    "Known ordered Santiago Marathon route replaced synthetic placeholder geometry.",
                    "Start - Palacio de La Moneda / Plaza de la Ciudadania",
                    "Finish - Palacio de La Moneda / Plaza de la Ciudadania",
                    5000,
                    40.816,
                    41.916,
                    SANTIAGO_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "seoul-marathon",
                    "Seoul Marathon",
                    "Seoul",
                    "South Korea",
                    new String[] { "Seoul International Marathon" },
                    "Checked Seoul Marathon 2025 GPX route geometry cross-checked against Seoul city start and Jamsil finish corridor",
                    "Known ordered Seoul Marathon route replaced synthetic placeholder geometry.",
                    "Start - Gwanghwamun Square",
                    "Finish - Jamsil Sports Complex",
                    500,
                    42.106,
                    42.806,
                    SEOUL_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "shanghai-marathon",
                    "Shanghai Marathon",
                    "Shanghai",
                    "China",
                    new String[] { "Shanghai International Marathon" },
                    "Published 2025 Shanghai Marathon route corridor via the Bund, Nanjing Road, Jing-an Temple, Huaihai Road, Xintiandi, Longteng Avenue, Longhua Road and Xujiahui Sports Park",
                    "Known ordered Shanghai Marathon route replaced synthetic placeholder geometry.",
                    "Start - Bund Golden Bull Plaza",
                    "Finish - Xujiahui Sports Park",
                    5000,
                    39.69,
                    40.79,
                    SHANGHAI_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "shenzhen-marathon",
                    "Shenzhen Marathon",
                    "Shenzhen",
                    "China",
                    new String[] { "Shenzhen International Marathon" },
                    "Published 2025 Shenzhen Marathon road sequence via Civic Center, Shennan Avenue, Shahe West Road, Wanghai Road, Baoan Avenue, Qianhai Avenue and Haibin Square",
                    "Known ordered Shenzhen Marathon route replaced synthetic placeholder geometry.",
                    "Start - Shenzhen Civic Center",
                    "Finish - Baoan Haibin Square",
                    5000,
                    45.786,
                    46.886,
                    SHENZHEN_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "singapore-marathon",
                    "Standard Chartered Singapore Marathon",
                    "Singapore",
                    "Singapore",
                    new String[] { "Singapore Marathon" },
                    "Checked Singapore Marathon 2024 GPX route geometry from Go&Race, aligned with F1 Pit Building start and Padang finish corridor",
                    "Known ordered Singapore Marathon route replaced synthetic placeholder geometry.",
                    "Start - F1 Pit Building",
                    "Finish - Padang",
                    1200,
                    41.715,
                    42.815,
                    SINGAPORE_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "stockholm-marathon",
                    "Stockholm Marathon",
                    "Stockholm",
                    "Sweden",
                    new String[] { "ASICS Stockholm Marathon", "Adidas Stockholm Marathon" },
                    "Official Stockholm Marathon 2026 course page/PDF, cross-checked against Go&Race 2026 GPX geometry",
                    "Known ordered Stockholm Marathon route replaced synthetic placeholder geometry.",
                    "Start - Lidingovagen",
                    "Finish - Stockholm Olympic Stadium",
                    500,
                    42.579,
                    43.779,
                    STOCKHOLM_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "sydney-marathon",
                    "Sydney Marathon",
                    "Sydney",
                    "Australia",
                    new String[] { "TCS Sydney Marathon" },
                    "Official TCS Sydney Marathon GPX route from the marathon course page and official course-map PDF geometry",
                    "Known ordered Sydney Marathon route replaced hand-corrected partial geometry.",
                    "Start - Miller Street, North Sydney",
                    "Finish - Sydney Opera House",
                    500,
                    41.875,
                    42.575,
                    SYDNEY_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "taipei-marathon",
                    "Taipei Marathon",
                    "Taipei",
                    "China",
                    new String[] { "Taipei Marathon" },
                    "Checked Taipei Marathon 2024 GPX route geometry from Go&Race",
                    "Known ordered Taipei Marathon route replaced synthetic placeholder geometry.",
                    "Start - Taipei City Hall Plaza",
                    "Finish - Taipei Municipal Stadium",
                    1200,
                    42.144,
                    43.244,
                    TAIPEI_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "toronto-waterfront-marathon",
                    "Toronto Waterfront Marathon",
                    "Toronto",
                    "Canada",
                    new String[] { "TCS Toronto Waterfront Marathon" },
                    "Checked Toronto Waterfront Marathon 2025 GPX route geometry",
                    "Known ordered Toronto Waterfront Marathon route replaced synthetic placeholder geometry.",
                    "Start - University Avenue",
                    "Finish - Nathan Phillips Square",
                    500,
                    41.806,
                    42.506,
                    TORONTO_WATERFRONT_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "valencia-marathon",
                    "Valencia Marathon",
                    "Valencia",
                    "Spain",
                    new String[] { "Valencia Marathon Trinidad Alfonso Zurich" },
                    "Checked Valencia Marathon 2025 GPX route geometry",
                    "Known ordered Valencia Marathon route replaced synthetic placeholder geometry.",
                    "Start - City of Arts and Sciences",
                    "Finish - City of Arts and Sciences",
                    500,
                    42.28,
                    43.28,
                    VALENCIA_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "vancouver-marathon",
                    "Vancouver Marathon",
                    "Vancouver",
                    "Canada",
                    new String[] { "BMO Vancouver Marathon" },
                    "BMO Vancouver Marathon 2026 official route page cross-checked against public HelloDrifter encoded path geometry",
                    "Known ordered Vancouver Marathon route replaced synthetic placeholder geometry.",
                    "Start - Queen Elizabeth Park",
                    "Finish - Pender Street / Downtown Vancouver",
                    500,
                    40.834,
                    42.384,
                    VANCOUVER_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "vienna-marathon",
                    "Vienna City Marathon",
                    "Vienna",
                    "Austria",
                    new String[] { "Vienna Marathon" },
                    "Checked Vienna City Marathon 2026 GPX route geometry",
                    "Known ordered Vienna City Marathon route replaced synthetic placeholder geometry.",
                    "Start - Reichsbrucke",
                    "Finish - Ringstrasse / Burgtheater",
                    500,
                    42.168,
                    42.968,
                    VIENNA_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "warsaw-marathon",
                    "Warsaw Marathon",
                    "Warsaw",
                    "Poland",
                    new String[] { "Maraton Warszawski" },
                    "Published Warsaw Marathon 2026 route description via Palace of Culture and Science, Aleje Jerozolimskie, Poniatowski Bridge, Praga, Gdanski Bridge, Wola, Bemowo, Bielany, Krolewska and Mazowiecka",
                    "Known ordered Warsaw Marathon route replaced synthetic placeholder geometry.",
                    "Start - Palace of Culture and Science",
                    "Finish - Palace of Culture and Science",
                    5000,
                    40.39,
                    41.49,
                    WARSAW_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "wuhan-marathon",
                    "Wuhan Marathon",
                    "Wuhan",
                    "China",
                    new String[] { "Wuhan Marathon" },
                    "Published 2025 Wuhan Marathon road sequence via Yanjiang Avenue, Jianghan Bridge, Wuhan Yangtze River Bridge, Yellow Crane Tower, Shahu Bridge, East Lake and Happy Valley",
                    "Known ordered Wuhan Marathon route replaced synthetic placeholder geometry.",
                    "Start - Yanjiang Avenue / Sanyang Road",
                    "Finish - Wuhan Happy Valley",
                    5000,
                    40.391,
                    41.491,
                    WUHAN_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "wuxi-marathon",
                    "Wuxi Marathon",
                    "Wuxi",
                    "China",
                    new String[] { "Wuxi Marathon" },
                    "Published 2026 Wuxi Marathon road sequence via Taihu Avenue, Lihu/Yuantouzhu, Jiangnan University, Wudu Road, Gonghu Bay and Wuxi Taihu International Expo Center",
                    "Known ordered Wuxi Marathon route replaced synthetic placeholder geometry.",
                    "Start - Taihu Avenue / Yinxiu Road",
                    "Finish - Wuxi Taihu International Expo Center",
                    5000,
                    39.52,
                    40.62,
                    WUXI_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "xiamen-marathon",
                    "Xiamen Marathon",
                    "Xiamen",
                    "China",
                    new String[] { "C&D Xiamen Marathon" },
                    "Checked C&D Xiamen Marathon 2025 GPX route geometry from Go&Race",
                    "Known ordered Xiamen Marathon route replaced synthetic placeholder geometry.",
                    "Start - Xiamen International Conference and Exhibition Center",
                    "Finish - Xiamen International Conference and Exhibition Center",
                    1200,
                    41.537,
                    42.637,
                    XIAMEN_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "xian-marathon",
                    "Xi'an Marathon",
                    "Xi'an",
                    "China",
                    new String[] { "Xian Marathon" },
                    "Published 2025 Xi-an Marathon road sequence via Yongning Gate, Bell Tower, East Gate, Taihua Road, Chanba, Bahe East Road and Xi-an Olympic Sports Center",
                    "Known ordered Xi-an Marathon route replaced synthetic placeholder geometry.",
                    "Start - Yongning Gate South Square",
                    "Finish - Xi-an Olympic Sports Center Stadium",
                    5000,
                    39.261,
                    40.361,
                    XIAN_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "zurich-marathon",
                    "Zurich Marathon",
                    "Zurich",
                    "Switzerland",
                    new String[] { "Zurich Maraton de Zurich" },
                    "Checked Zurich Marathon 2026 GPX route geometry",
                    "Known ordered Zurich Marathon route replaced synthetic placeholder geometry.",
                    "Start - Quaibrucke",
                    "Finish - Sechselautenplatz",
                    500,
                    42.051,
                    42.851,
                    ZURICH_MARATHON_ROUTE
            ),
            new CourseDefinition(
                    "melbourne-marathon",
                    "Melbourne Marathon",
                    "Melbourne",
                    "Australia",
                    new String[] { "Nike Melbourne Marathon" },
                    "Official Nike Melbourne Marathon 2025 GPX route from the marathon event page",
                    "Known ordered Melbourne Marathon route replaced auto-acquired partial geometry.",
                    "Start - Batman Avenue",
                    "Finish - Melbourne Cricket Ground",
                    1200,
                    41.752,
                    42.852,
                    MELBOURNE_MARATHON_ROUTE
            )
    );

    private SupplementalMarathonKnownCourses() {
    }

    static List<CourseDefinition> definitions() {
        return DEFINITIONS;
    }

    static boolean matches(String raceName, String city, String country) {
        return find(raceName, city, country).isPresent();
    }

    static Optional<CourseDefinition> find(String raceName, String city, String country) {
        String normalizedRaceName = normalize(raceName);
        String normalizedCity = normalize(city);
        String normalizedCountry = normalize(country);
        return DEFINITIONS.stream()
                .filter(definition -> definition.matches(normalizedRaceName, normalizedCity, normalizedCountry))
                .findFirst();
    }

    record CourseDefinition(
            String raceId,
            String raceName,
            String city,
            String country,
            String[] aliases,
            String sourceNote,
            String description,
            String startLabel,
            String finishLabel,
            int maxSelfIntersections,
            double expectedMinKm,
            double expectedMaxKm,
            String encodedRoute
    ) {
        List<RoutePoint> routePoints() {
            List<RoutePoint> routePoints = removeConsecutiveDuplicates(decodePolyline(encodedRoute));
            setLabel(routePoints, 0, startLabel);
            setLabel(routePoints, routePoints.size() - 1, finishLabel);
            return List.copyOf(routePoints);
        }

        private boolean matches(String normalizedRaceName, String normalizedCity, String normalizedCountry) {
            boolean raceMatches = containsEither(normalizedRaceName, normalize(raceName));
            for (String alias : aliases) {
                raceMatches = raceMatches || containsEither(normalizedRaceName, normalize(alias));
            }
            boolean cityMatches = normalizedCity.isBlank() || containsEither(normalizedCity, normalize(city));
            boolean countryMatches = normalizedCountry.isBlank() || containsEither(normalizedCountry, normalize(country));
            return raceMatches && cityMatches && countryMatches;
        }
    }

    private static boolean containsEither(String left, String right) {
        if (left == null || right == null || left.isBlank() || right.isBlank()) {
            return false;
        }
        return left.contains(right) || right.contains(left);
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " " ).trim();
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
