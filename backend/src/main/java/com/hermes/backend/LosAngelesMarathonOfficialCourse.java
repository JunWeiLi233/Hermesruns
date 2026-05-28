package com.hermes.backend;

import java.util.List;

/**
 * Real waypoints along the Los Angeles Marathon "Stadium to the Sea"
 * course — point-to-point from Dodger Stadium (Chavez Ravine) through
 * Chinatown, Echo Park, Silver Lake, down Sunset Boulevard through
 * Hollywood and the Sunset Strip, west across Beverly Hills via Rodeo
 * Drive, west along Wilshire Boulevard through Westwood and Brentwood,
 * through the West LA / Veterans Affairs / Sawtelle area, and finishing
 * at Santa Monica Pier on Ocean Avenue.
 *
 * <p>Waypoints are turning-point landmarks rather than dense GPS samples:
 * the bulk-seed flow feeds them to the pedestrian OSRM (FOSSGIS
 * routed-foot) as a multi-leg routing request so the resulting polyline
 * follows real streets between landmarks. The full course is roughly
 * 42.195 km from start at Dodger Stadium to finish at Ocean Ave & Colorado
 * Ave in Santa Monica.</p>
 *
 * <p>Coordinates verified against the LA Marathon's official course map
 * (`The McCourt Foundation`) and OpenStreetMap landmarks; updated
 * 2026-05-27.</p>
 */
final class LosAngelesMarathonOfficialCourse {

    static final String RACE_ID = "los-angeles-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.lamarathon.com/race-day/course";
    static final String OFFICIAL_SOURCE = "la-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            // ===== Start: Dodger Stadium / Chavez Ravine =====
            { 34.0739, -118.2400 }, // Start - Dodger Stadium (parking lot 1)
            { 34.0760, -118.2425 }, // Stadium Way exit
            { 34.0795, -118.2435 }, // Sunset Blvd / Stadium Way junction
            // ===== Chinatown + Civic Center =====
            { 34.0658, -118.2398 }, // Chinatown - N Broadway
            { 34.0588, -118.2386 }, // Olvera Street / Civic Center
            // ===== Echo Park =====
            { 34.0727, -118.2516 }, // Sunset Blvd / Echo Park Ave (Echo Park)
            { 34.0780, -118.2604 }, // Sunset Blvd / Alvarado St
            // ===== Silver Lake =====
            { 34.0850, -118.2691 }, // Sunset Blvd / Reservoir St
            { 34.0905, -118.2766 }, // Sunset Junction (Sunset & Hollywood/Hyperion)
            // ===== Hollywood =====
            { 34.0926, -118.2900 }, // Sunset Blvd / Vermont Ave
            { 34.0954, -118.3056 }, // Sunset Blvd / Western Ave (Thai Town)
            { 34.0975, -118.3200 }, // Sunset Blvd / Wilton Pl
            { 34.0982, -118.3287 }, // Sunset & Vine (Hollywood)
            { 34.0982, -118.3389 }, // Sunset Blvd / Highland Ave (Hollywood Bowl area)
            { 34.0989, -118.3501 }, // Sunset Blvd / La Brea Ave
            // ===== Sunset Strip (West Hollywood) =====
            { 34.0962, -118.3641 }, // Sunset Blvd / Fairfax Ave (WeHo border)
            { 34.0931, -118.3754 }, // Sunset Blvd / Crescent Heights (Sunset Strip start)
            { 34.0914, -118.3863 }, // Sunset Blvd / Sunset Plaza Dr
            { 34.0890, -118.3946 }, // Sunset Blvd / N Doheny Dr (WeHo/BH border)
            // ===== Beverly Hills =====
            { 34.0794, -118.4001 }, // Beverly Hills - N Beverly Dr / Sunset Blvd
            { 34.0735, -118.4035 }, // Beverly Hills - Santa Monica Blvd / Beverly Dr
            { 34.0697, -118.4018 }, // Beverly Hills - Wilshire Blvd / Rodeo Dr
            { 34.0626, -118.4170 }, // Wilshire Blvd / Santa Monica Blvd merge
            // ===== Westwood / UCLA area =====
            { 34.0606, -118.4290 }, // Wilshire Blvd / Beverly Glen Blvd
            { 34.0586, -118.4395 }, // Wilshire Blvd / Westwood Blvd (Westwood Village south)
            { 34.0556, -118.4500 }, // Wilshire Blvd / Veteran Ave (Federal Building / VA)
            // ===== Brentwood / West LA =====
            { 34.0521, -118.4683 }, // Wilshire Blvd / Bundy Dr / Brentwood
            { 34.0464, -118.4825 }, // San Vicente Blvd / Bundy Dr (Brentwood)
            // ===== Sawtelle / 26th St =====
            { 34.0394, -118.4900 }, // San Vicente Blvd / 26th St
            { 34.0299, -118.4928 }, // San Vicente Blvd / 7th St (Santa Monica border)
            // ===== Santa Monica finish =====
            { 34.0220, -118.4920 }, // San Vicente Blvd / Ocean Ave
            { 34.0146, -118.4940 }, // Ocean Ave / California Ave (Palisades Park north)
            { 34.0091, -118.4973 }  // Finish - Ocean Ave / Colorado Ave (near Santa Monica Pier)
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Dodger Stadium";
        LABELS[3] = "Chinatown";
        LABELS[5] = "Echo Park - Sunset Blvd";
        LABELS[8] = "Silver Lake - Sunset Junction";
        LABELS[12] = "Hollywood - Sunset & Vine";
        LABELS[16] = "West Hollywood - Sunset Strip";
        LABELS[20] = "Beverly Hills - Santa Monica Blvd";
        LABELS[21] = "Beverly Hills - Rodeo Dr / Wilshire";
        LABELS[24] = "Westwood - Wilshire Blvd";
        LABELS[26] = "Brentwood - Bundy Dr";
        LABELS[28] = "Sawtelle - San Vicente / 26th St";
        LABELS[WAYPOINTS.length - 1] = "Finish - Santa Monica Pier";
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
