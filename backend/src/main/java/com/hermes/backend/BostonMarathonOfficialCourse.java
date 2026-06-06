package com.hermes.backend;

import java.util.List;

/**
 * Official Boston Marathon route seed based on the B.A.A. course map.
 *
 * <p>The Boston course is point-to-point: Main Street in Hopkinton, Route 135
 * through Ashland, Framingham, Natick, and Wellesley, Route 16 into Newton,
 * Commonwealth Avenue over the Newton hills, Beacon Street through Brookline,
 * then Hereford Street and Boylston Street to the Copley finish.</p>
 */
final class BostonMarathonOfficialCourse {

    static final String RACE_ID = "boston-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.baa.org/wp-content/uploads/2026/03/2026-Course-Map.pdf";
    static final String OFFICIAL_SOURCE = "boston-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            {42.2294, -71.5176}, // Start - Hopkinton
            {42.2284, -71.4980}, // Hopkinton Main Street
            {42.2475, -71.4754}, // Route 135 eastbound
            {42.2614, -71.4640}, // Ashland
            {42.2773, -71.4202}, // Framingham
            {42.2839, -71.3492}, // Natick Center
            {42.2960, -71.2932}, // Wellesley / halfway
            {42.3072, -71.2778}, // Wellesley Hills
            {42.3186, -71.2533}, // Newton Lower Falls / Route 16
            {42.3284, -71.2226}, // Newton Fire Station right turn
            {42.3342, -71.2075}, // Commonwealth Avenue / Newton hills
            {42.3367, -71.1700}, // Heartbreak Hill
            {42.3380, -71.1539}, // Cleveland Circle
            {42.3402, -71.1396}, // Beacon Street / Coolidge Corner approach
            {42.3417, -71.1232}, // Brookline
            {42.3489, -71.0954}, // Kenmore Square
            {42.3478, -71.0850}, // Hereford Street
            {42.3486, -71.0830}, // Boylston Street
            {42.3496, -71.0786}  // Finish - Boylston Street
    };

    private static final String[] LABELS;

    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Hopkinton";
        LABELS[3] = "Ashland - Route 135";
        LABELS[4] = "Framingham - Route 135";
        LABELS[5] = "Natick Center";
        LABELS[6] = "Wellesley / halfway";
        LABELS[8] = "Newton Lower Falls";
        LABELS[9] = "Newton Fire Station";
        LABELS[11] = "Heartbreak Hill";
        LABELS[12] = "Cleveland Circle";
        LABELS[14] = "Brookline - Beacon Street";
        LABELS[15] = "Kenmore Square";
        LABELS[16] = "Hereford Street";
        LABELS[17] = "Boylston Street";
        LABELS[WAYPOINTS.length - 1] = "Finish - Boylston Street";
    }

    private BostonMarathonOfficialCourse() {
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
