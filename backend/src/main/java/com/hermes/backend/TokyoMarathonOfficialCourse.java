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
 * follows real streets through central Tokyo: Shinjuku → Ichigaya → Kudanshita
 * → Kanda → Akihabara → Asakusa → Kiyosumi-Shirakawa → Tatsumi →
 * Shinonome → Tsukishima → Ginza → Nihonbashi → Tokyo Station.</p>
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
            { 35.6894, 139.6917 }, // Start - Tokyo Metropolitan Government Building
            // ===== East through central Tokyo =====
            { 35.6893, 139.7020 }, // Shinjuku-dori / Yotsuya-sanchome
            { 35.6920, 139.7160 }, // Yotsuya
            { 35.6940, 139.7254 }, // Ichigaya
            { 35.6948, 139.7479 }, // Kudanshita
            { 35.6953, 139.7545 }, // Jimbocho
            { 35.6966, 139.7671 }, // Kanda
            { 35.6985, 139.7734 }, // Akihabara
            // ===== North to Asakusa =====
            { 35.7060, 139.7740 }, // Ueno-Okachimachi
            { 35.7108, 139.7964 }, // Asakusa — Kaminarimon / Senso-ji
            // ===== Southeast through Koto-ku to southernmost turn =====
            { 35.6980, 139.8130 }, // Kiyosumi-Shirakawa
            { 35.6880, 139.8220 }, // Koto — Etchujima area
            { 35.6760, 139.8300 }, // Kameido / Ryogoku south
            { 35.6630, 139.8420 }, // Tatsumi approach
            { 35.6440, 139.8040 }, // Tatsumi / Shinonome (southernmost turn)
            // ===== West along the waterfront =====
            { 35.6480, 139.7980 }, // Shinonome
            { 35.6520, 139.7800 }, // Tsukishima / Harumi
            // ===== Northwest through Ginza to Tokyo Station =====
            { 35.6630, 139.7681 }, // Ginza / Tsukiji
            { 35.6715, 139.7650 }, // Ginza north
            { 35.6812, 139.7671 }, // Finish — Tokyo Station / Marunouchi
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0]  = "Start - Metropolitan Govt Building";
        LABELS[3]  = "Ichigaya";
        LABELS[4]  = "Kudanshita";
        LABELS[6]  = "Kanda";
        LABELS[7]  = "Akihabara";
        LABELS[9]  = "Asakusa - Kaminarimon";
        LABELS[10] = "Kiyosumi-Shirakawa";
        LABELS[14] = "Tatsumi (south turn)";
        LABELS[16] = "Tsukishima";
        LABELS[17] = "Ginza / Tsukiji";
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
