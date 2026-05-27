package com.hermes.backend;

import java.util.List;

/**
 * Official course waypoints for the Tokyo Marathon — a 42.195 km point-to-point
 * race starting at the Tokyo Metropolitan Government Building in Shinjuku and
 * finishing at Marunouchi / Tokyo Station (the current finish line introduced
 * for the 2023 edition).
 *
 * <p>These are landmark turning-point coordinates in route order. The bulk-seed
 * flow feeds them per-leg to OSRM (pedestrian profile) so the resulting polyline
 * follows real streets through central Tokyo: Shinjuku → Yotsuya → Ichigaya →
 * Kudanshita → Kanda → Akihabara → Asakusa → Kiyosumi-Shirakawa →
 * Fukagawa → Tatsumi 2-chome (southernmost turn, max east ~139.806°E) →
 * Shinonome → Tsukishima → Ginza → Tokyo Station.</p>
 *
 * <p>Coordinates verified against the official Tokyo Marathon course map and
 * OpenStreetMap landmarks; updated 2026-05-27.</p>
 */
final class TokyoMarathonOfficialCourse {

    static final String RACE_ID = "tokyo-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.marathon.tokyo/en/";
    static final String OFFICIAL_SOURCE = "tokyo-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            // ===== Start — Shinjuku =====
            { 35.6894, 139.6917 }, // [0]  Start - Tokyo Metropolitan Government Building
            // ===== East-northeast through central Tokyo =====
            { 35.6858, 139.7154 }, // [1]  Yotsuya-sanchome
            { 35.6912, 139.7377 }, // [2]  Ichigaya
            { 35.6948, 139.7518 }, // [3]  Kudanshita
            { 35.6953, 139.7545 }, // [4]  Jimbocho
            { 35.6966, 139.7671 }, // [5]  Kanda
            { 35.6985, 139.7734 }, // [6]  Akihabara
            // ===== North to Asakusa =====
            { 35.7060, 139.7740 }, // [7]  Ueno-Okachimachi
            { 35.7108, 139.7964 }, // [8]  Asakusa — Kaminarimon / Senso-ji
            // ===== South through Koto-ku to Tatsumi turn =====
            // Max east ~139.806°E — the course never enters Tokyo Bay
            { 35.6841, 139.8012 }, // [9]  Kiyosumi-Shirakawa (near Shin-Ohashi bridge)
            { 35.6740, 139.8048 }, // [10] Fukagawa / Etchujima
            { 35.6570, 139.8058 }, // [11] Shinonome approach
            { 35.6490, 139.8058 }, // [12] Tatsumi 2-chome (southernmost turn)
            // ===== West along the waterfront =====
            { 35.6498, 139.7970 }, // [13] Shinonome (heading west)
            { 35.6520, 139.7800 }, // [14] Tsukishima / Harumi
            // ===== Northwest through Ginza to Tokyo Station =====
            { 35.6630, 139.7681 }, // [15] Ginza / Tsukiji
            { 35.6715, 139.7650 }, // [16] Ginza north
            { 35.6812, 139.7671 }, // [17] Finish — Tokyo Station / Marunouchi
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0]  = "Start - Metropolitan Govt Building";
        LABELS[2]  = "Ichigaya";
        LABELS[3]  = "Kudanshita";
        LABELS[5]  = "Kanda";
        LABELS[6]  = "Akihabara";
        LABELS[8]  = "Asakusa - Kaminarimon";
        LABELS[9]  = "Kiyosumi-Shirakawa";
        LABELS[12] = "Tatsumi (south turn)";
        LABELS[14] = "Tsukishima";
        LABELS[15] = "Ginza / Tsukiji";
        LABELS[WAYPOINTS.length - 1] = "Finish - Tokyo Station";
    }

    private TokyoMarathonOfficialCourse() {
    }

    /**
     * Official-course waypoints in route order. Fed per-leg to OSRM by
     * {@link RaceCourseMapBulkSeedService} to generate a street-following
     * polyline. NOT a closed loop — Tokyo is point-to-point from Shinjuku
     * to Marunouchi.
     */
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
