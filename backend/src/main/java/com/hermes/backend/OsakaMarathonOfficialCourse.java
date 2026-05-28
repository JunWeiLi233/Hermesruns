package com.hermes.backend;

import java.util.List;

/**
 * Real waypoints along the CURRENT Osaka Marathon course (the 2024 redesign
 * used for the Feb 2026 edition), a single loop that both starts and finishes
 * at the Osaka Castle area — NOT the obsolete pre-2018 route that finished out
 * at INTEX Osaka on the bay.
 *
 * <p>Course: start at the Osaka Prefectural Government Office (大阪府庁) on the
 * west side of Osaka Castle Park, run north to the Okawa River (大川) and back
 * down to Nakanoshima (中之島, ~6 km), south down the iconic Midosuji boulevard
 * (御堂筋) through Honmachi / Shinsaibashi to Namba / Dotonbori (~12 km), west
 * to Kyocera Dome Osaka (京セラドーム, ~16 km), south/east along the Naniwasuji
 * corridor, up onto the Uemachi plateau (上町台地) past Shinsekai / Tennoji /
 * Shitenno-ji (the ~30 km climb), east through Tsuruhashi to Imazato (今里,
 * ~36 km), then north-west via Morinomiya to the finish inside Osaka Castle
 * Park (大阪城公園). Roughly 42.195 km.</p>
 *
 * <p>Waypoints are turning-point landmarks rather than dense GPS samples: the
 * bulk-seed flow feeds them to the pedestrian OSRM (FOSSGIS routed-foot) as a
 * multi-leg routing request so the resulting polyline follows real streets
 * between landmarks. Coordinates verified against the official Osaka Marathon
 * course map and OpenStreetMap landmarks; updated 2026-05-28 to the current
 * castle-to-castle loop.</p>
 */
final class OsakaMarathonOfficialCourse {

    static final String RACE_ID = "osaka-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.osaka-marathon.com/2026/en/";
    static final String OFFICIAL_SOURCE = "osaka-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            // ===== Start: Osaka Prefectural Government (大阪府庁) / Otemae =====
            { 34.6861, 135.5205 }, // Start - Osaka Prefectural Government Office
            // ===== North to the Okawa River (大川), then back down =====
            { 34.6905, 135.5158 }, // Temmabashi (天満橋)
            { 34.6978, 135.5115 }, // Okawa River - Sakuranomiya bend (桜ノ宮)
            { 34.6938, 135.5055 }, // Tenjinbashi (天神橋)
            { 34.6928, 135.5008 }, // Nakanoshima (中之島) - ~6 km return
            // ===== South down Midosuji (御堂筋) =====
            { 34.6824, 135.5003 }, // Honmachi (本町) - Midosuji
            { 34.6736, 135.5006 }, // Shinsaibashi (心斎橋)
            { 34.6687, 135.5013 }, // Dotonbori (道頓堀)
            { 34.6659, 135.5011 }, // Namba (難波) - ~12 km
            // ===== West to Kyocera Dome Osaka (京セラドーム) =====
            { 34.6655, 135.4915 }, // Sakuragawa (桜川)
            { 34.6685, 135.4790 }, // Kujo (九条)
            { 34.6694, 135.4762 }, // Kyocera Dome Osaka (京セラドーム大阪) - ~16 km
            // ===== South-east along the Naniwasuji corridor =====
            { 34.6620, 135.4730 }, // Taisho (大正)
            { 34.6545, 135.4790 }, // Tsukamoto-minami / south-west turn
            { 34.6520, 135.4885 }, // Naniwasuji (なにわ筋) - ~22 km
            { 34.6490, 135.4965 }, // Hanazonocho (花園町)
            { 34.6470, 135.5010 }, // Daikokucho (大国町)
            // ===== Up onto the Uemachi plateau (上町台地) =====
            { 34.6470, 135.5078 }, // Shinsekai / Tsutenkaku (新世界・通天閣)
            { 34.6465, 135.5135 }, // Tennoji (天王寺)
            { 34.6539, 135.5167 }, // Shitenno-ji (四天王寺) - ~30 km climb
            // ===== East through Tsuruhashi to Imazato (今里) =====
            { 34.6610, 135.5232 }, // Tamatsukuri (玉造)
            { 34.6660, 135.5310 }, // Tsuruhashi (鶴橋)
            { 34.6688, 135.5390 }, // Imazato (今里) - ~36 km
            // ===== North-west back to Osaka Castle Park (大阪城公園) =====
            { 34.6778, 135.5402 }, // Joto-ku (城東区)
            { 34.6842, 135.5358 }, // Morinomiya (森ノ宮) - ~40 km
            { 34.6875, 135.5298 }, // Osaka Castle Park - east approach
            // ===== Finish: inside Osaka Castle Park (大阪城公園) =====
            { 34.6888, 135.5262 }  // Finish - Osaka Castle Park
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Osaka Prefectural Government";
        LABELS[2] = "Okawa River";
        LABELS[4] = "Nakanoshima";
        LABELS[5] = "Honmachi - Midosuji";
        LABELS[6] = "Shinsaibashi";
        LABELS[8] = "Namba";
        LABELS[11] = "Kyocera Dome Osaka";
        LABELS[14] = "Naniwasuji";
        LABELS[17] = "Shinsekai - Tsutenkaku";
        LABELS[18] = "Tennoji";
        LABELS[19] = "Shitenno-ji Temple";
        LABELS[21] = "Tsuruhashi";
        LABELS[22] = "Imazato";
        LABELS[24] = "Morinomiya";
        LABELS[WAYPOINTS.length - 1] = "Finish - Osaka Castle Park";
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
