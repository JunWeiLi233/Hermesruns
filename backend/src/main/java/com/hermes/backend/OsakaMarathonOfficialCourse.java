package com.hermes.backend;

import java.util.List;

/**
 * Real waypoints along the Osaka Marathon course — point-to-point from
 * the Osaka Prefectural Government / Osaka Castle area in Chuo-ku, south
 * down Midosuji Boulevard through the Yodoyabashi / Honmachi / Shinsaibashi
 * / Namba corridor, across to Tennoji and Shitenno-ji Temple, east through
 * Tsuruhashi and Joto-ku, north along the Okawa River past Sakuranomiya,
 * then south-west along Yotsubashi and Bentencho corridors out to the
 * Osaka Bay finish at INTEX Osaka on Cosmo Square (Suminoe-ku).
 *
 * <p>Waypoints are turning-point landmarks rather than dense GPS samples:
 * the bulk-seed flow feeds them to the pedestrian OSRM (FOSSGIS
 * routed-foot) as a multi-leg routing request so the resulting polyline
 * follows real streets between landmarks. The full course is roughly
 * 42.195 km from start in Chuo-ku to finish at INTEX Osaka.</p>
 *
 * <p>Coordinates verified against the Osaka Marathon's official course
 * map and OpenStreetMap landmarks; updated 2026-05-27.</p>
 */
final class OsakaMarathonOfficialCourse {

    static final String RACE_ID = "osaka-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.osaka-marathon.com/2026/en/";
    static final String OFFICIAL_SOURCE = "osaka-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            // ===== Start: Osaka Prefectural Government / Otemae (大手前) =====
            { 34.6863, 135.5232 }, // Start - Osaka Prefectural Government Office (Otemae)
            // ===== North along Tanimachi-suji toward Osaka Castle west side =====
            { 34.6855, 135.5217 }, // Tanimachi 4-chome
            { 34.6826, 135.5198 }, // Tanimachi 6-chome
            // ===== West along Honmachi-dori to Midosuji =====
            { 34.6824, 135.5128 }, // Honmachi (本町) - Sakaisuji
            { 34.6829, 135.5018 }, // Honmachi - Midosuji (御堂筋) junction
            // ===== South down Midosuji (御堂筋) =====
            { 34.6790, 135.5021 }, // Midosuji - Awaza
            { 34.6735, 135.5017 }, // Midosuji - Shinsaibashi (心斎橋)
            { 34.6680, 135.5017 }, // Midosuji - Dotonbori (道頓堀)
            { 34.6645, 135.5018 }, // Midosuji - Namba (難波)
            { 34.6610, 135.5023 }, // Midosuji - Naniwa-ku
            { 34.6555, 135.5023 }, // Midosuji - Imamiya (今宮)
            // ===== Tennoji / Shitenno-ji =====
            { 34.6502, 135.5078 }, // Naniwa-ku - Ebisucho
            { 34.6477, 135.5141 }, // Tennoji (天王寺) - JR Tennoji Station
            { 34.6535, 135.5167 }, // Shitenno-ji Temple (四天王寺)
            // ===== East through Tsuruhashi / Higashi-Nari =====
            { 34.6648, 135.5210 }, // Uemachi - Tamatsukuri
            { 34.6660, 135.5290 }, // Tsuruhashi (鶴橋)
            { 34.6705, 135.5360 }, // Higashinari-ku - Imazato
            // ===== North through Joto-ku =====
            { 34.6790, 135.5400 }, // Joto-ku - Hanaten
            { 34.6870, 135.5440 }, // Joto-ku - Sekime
            { 34.6950, 135.5400 }, // Joto-ku - Gamo-yonchome
            // ===== West along Okawa River through Sakuranomiya =====
            { 34.6995, 135.5310 }, // Sakuranomiya (桜ノ宮) - Okawa River east bank
            { 34.7000, 135.5210 }, // Sakuranomiya - Tenmabashi area
            // ===== South-west back through Naka-no-shima =====
            { 34.6935, 135.5100 }, // Nakanoshima (中之島) - east end
            { 34.6920, 135.5010 }, // Nakanoshima - Yodoyabashi (淀屋橋)
            // ===== West through Nishi-ku via Tosabori-dori =====
            { 34.6890, 135.4920 }, // Tosabori (土佐堀)
            { 34.6845, 135.4830 }, // Nishi-ku - Edobori
            { 34.6800, 135.4750 }, // Nishi-ku - Awaza
            // ===== South-west along Sennichimae-dori / Asahi-dori =====
            { 34.6720, 135.4690 }, // Nishi-ku - Kujo (九条)
            { 34.6680, 135.4625 }, // Minato-ku - Bentencho (弁天町)
            // ===== South-west to Osaka Bay / Cosmo Square area =====
            { 34.6580, 135.4530 }, // Minato-ku - Tempozan area
            { 34.6480, 135.4440 }, // Cosmo Square - Trade Center Mae
            { 34.6420, 135.4310 }, // Cosmo Square - Asia & Pacific Trade Center
            // ===== Finish: INTEX Osaka =====
            { 34.6342, 135.4194 }  // Finish - INTEX Osaka (Suminoe-ku)
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Osaka Prefectural Government";
        LABELS[4] = "Honmachi - Midosuji";
        LABELS[6] = "Shinsaibashi - Midosuji";
        LABELS[8] = "Namba";
        LABELS[12] = "Tennoji";
        LABELS[13] = "Shitenno-ji Temple";
        LABELS[15] = "Tsuruhashi";
        LABELS[19] = "Joto-ku - Gamo-yonchome";
        LABELS[20] = "Sakuranomiya - Okawa River";
        LABELS[23] = "Nakanoshima - Yodoyabashi";
        LABELS[28] = "Minato-ku - Bentencho";
        LABELS[30] = "Cosmo Square - Trade Center Mae";
        LABELS[WAYPOINTS.length - 1] = "Finish - INTEX Osaka";
    }

    private OsakaMarathonOfficialCourse() {
    }

    static List<double[]> waypoints() {
        double[][] copy = new double[WAYPOINTS.length][2];
        for (int i = 0; i < WAYPOINTS.length; i++) {
            copy[i][0] = WAYPOINTS[i][0];
            copy[i][1] = WAYPOINTS[i][1];
        }
        return List.of(copy);
    }

    static String labelAt(int index) {
        if (index < 0 || index >= LABELS.length) return null;
        return LABELS[index];
    }

    static int waypointCount() {
        return WAYPOINTS.length;
    }
}
