package com.hermes.backend.races;

import java.util.List;

/**
 * Real waypoints along the ASICS Los Angeles Marathon "Stadium to the Stars"
 * course used on the official 2026 map: Dodger Stadium start, Downtown LA,
 * Chinatown, Little Tokyo, Echo Park, Hollywood, Sunset Strip, Beverly Hills,
 * West LA / Brentwood turnaround at Bundy, then the Century City finish at
 * Santa Monica Blvd & Avenue of the Stars.
 *
 * <p>Waypoints are turning-point landmarks rather than dense GPS samples: the
 * bulk-seed flow feeds them to the pedestrian OSRM (FOSSGIS routed-foot) as a
 * multi-leg routing request so the resulting polyline follows real streets
 * between landmarks. The full course is 26.2 miles from Dodger Stadium to
 * Century City.</p>
 *
 * <p>Coordinates verified against The McCourt Foundation's official 2026
 * course map and OpenStreetMap landmarks; updated 2026-06-04.</p>
 */
final class LosAngelesMarathonOfficialCourse {

    static final String RACE_ID = "los-angeles-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.mccourtfoundation.org/wp-content/uploads/2026/02/LA-Marathon-2026-Course-Map_Final.pdf";
    static final String OFFICIAL_SOURCE = "la-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            // ===== Start: Dodger Stadium / Chavez Ravine =====
            { 34.0739, -118.2400 }, // Start - Dodger Stadium
            { 34.0711, -118.2421 }, // Stadium Way / Sunset Blvd
            // ===== Chinatown + Downtown loop =====
            { 34.0636, -118.2387 }, // Chinatown Dragon Gate
            { 34.0575, -118.2371 }, // Olvera Street
            { 34.0537, -118.2431 }, // Los Angeles City Hall
            { 34.0497, -118.2390 }, // Little Tokyo
            { 34.0484, -118.2460 }, // 3rd St / Main St
            { 34.0577, -118.2467 }, // Cathedral / Dorothy Chandler area
            // ===== Echo Park + Hollywood =====
            { 34.0745, -118.2606 }, // Echo Park Lake
            { 34.0842, -118.2696 }, // Sunset Blvd / Silver Lake Blvd
            { 34.1015, -118.2917 }, // Barnsdall Park / Vermont Ave
            { 34.1016, -118.3092 }, // Hollywood Blvd / Western Ave
            { 34.1017, -118.3267 }, // Hollywood & Vine / Pantages
            { 34.1016, -118.3387 }, // Hollywood Blvd / Highland Ave
            { 34.1016, -118.3444 }, // Grauman's Chinese Theater / La Brea approach
            // ===== Sunset Strip =====
            { 34.0971, -118.3620 }, // Sunset Blvd / Fairfax Ave
            { 34.0984, -118.3685 }, // Chateau Marmont
            { 34.0893, -118.3893 }, // Sunset Strip / Doheny Dr
            // ===== Beverly Hills + Century City pass =====
            { 34.0838, -118.3894 }, // Doheny Dr / Santa Monica Blvd
            { 34.0739, -118.4000 }, // Beverly Hills City Hall
            { 34.0675, -118.4010 }, // Rodeo Dr / Wilshire Blvd
            { 34.0696, -118.4140 }, // Burton Way / Century Park East
            { 34.0594, -118.4179 }, // Santa Monica Blvd / Avenue of the Stars pass
            // ===== West LA / Brentwood turnaround =====
            { 34.0570, -118.4255 }, // Santa Monica Blvd / Beverly Glen Blvd
            { 34.0490, -118.4385 }, // Santa Monica Blvd / Westwood Blvd
            { 34.0437, -118.4448 }, // Santa Monica Blvd / Sepulveda Blvd
            { 34.0392, -118.4630 }, // Santa Monica Blvd / Bundy Dr
            { 34.0466, -118.4658 }, // San Vicente Blvd / Bundy Dr turnaround
            { 34.0491, -118.4597 }, // San Vicente Blvd / Barrington Ave
            { 34.0437, -118.4448 }, // Santa Monica Blvd / Sepulveda Blvd return
            { 34.0562, -118.4256 }, // Santa Monica Blvd / Beverly Glen Blvd return
            { 34.0597, -118.4177 }  // Finish - Santa Monica Blvd / Avenue of the Stars
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Dodger Stadium";
        LABELS[2] = "Chinatown Dragon Gate";
        LABELS[3] = "Olvera Street";
        LABELS[4] = "Los Angeles City Hall";
        LABELS[5] = "Little Tokyo";
        LABELS[8] = "Echo Park Lake";
        LABELS[10] = "Barnsdall Park";
        LABELS[12] = "Hollywood & Vine";
        LABELS[13] = "Hollywood Walk of Fame";
        LABELS[14] = "Grauman's Chinese Theater";
        LABELS[16] = "Chateau Marmont";
        LABELS[17] = "Sunset Strip";
        LABELS[19] = "Beverly Hills City Hall";
        LABELS[20] = "Rodeo Drive";
        LABELS[27] = "Bundy turnaround";
        LABELS[WAYPOINTS.length - 1] = "Finish - Century City";
    }

    private LosAngelesMarathonOfficialCourse() {
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
