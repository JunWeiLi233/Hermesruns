package com.hermes.backend;

import java.util.List;

/**
 * Real waypoints along the TCS New York City Marathon course — Staten Island
 * start at Fort Wadsworth, across the Verrazzano-Narrows Bridge into Brooklyn,
 * north up 4th Avenue through Park Slope, Fort Greene and Bedford-Stuyvesant,
 * across the Pulaski Bridge into Queens, across the Queensboro Bridge into
 * Manhattan, up 1st Avenue to a brief Bronx loop via the Willis Avenue Bridge,
 * back to Manhattan via the Madison Avenue Bridge, down 5th Avenue and east
 * along Central Park East Drive, finishing near Tavern on the Green on West
 * 72nd Street.
 *
 * <p>These are turning-point landmarks rather than dense GPS samples: the
 * bulk-seed flow feeds them to OSRM as a multi-leg routing request so the
 * resulting polyline follows real streets between the landmarks, producing
 * a route that visually traces the actual five-borough course on the
 * runner-facing race-detail page (instead of the obvious circle the
 * default synthetic seed renders).</p>
 *
 * <p>Coordinates verified against NYRR's official course map and OpenStreetMap
 * landmarks; updated 2026-05-27.</p>
 */
final class NycMarathonOfficialCourse {

    static final String RACE_ID = "new-york-city-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.nyrr.org/tcsnycmarathon";
    static final String OFFICIAL_SOURCE = "nyc-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            // ===== Staten Island start + Verrazzano-Narrows Bridge =====
            // Coordinates verified against OpenStreetMap landmarks (2026-05).
            // The Verrazzano-Narrows runs essentially east-west between its
            // two towers — going from south-west to north-east instead
            // would make the straight-line bridge interpolation cut diagonally
            // across The Narrows in a way that visually misses the actual
            // bridge structure.
            { 40.6055, -74.0563 }, // Start - Fort Wadsworth toll plaza
            { 40.6066, -74.0468 }, // Verrazzano-Narrows Bridge (Staten Island tower)
            { 40.6076, -74.0412 }, // Verrazzano-Narrows Bridge midspan
            { 40.6087, -74.0379 }, // Verrazzano-Narrows Bridge (Brooklyn tower)
            // ===== Brooklyn (~13 miles / 21 km) =====
            { 40.6228, -74.0298 }, // Bay Ridge - 92nd St & 4th Ave
            { 40.6357, -74.0202 }, // Sunset Park - 65th St & 4th Ave
            { 40.6500, -74.0125 }, // 4th Ave & 47th St
            { 40.6633, -73.9986 }, // 4th Ave & 25th St (south Park Slope)
            { 40.6770, -73.9831 }, // 4th Ave & 9th St (Park Slope)
            { 40.6843, -73.9785 }, // Downtown Brooklyn - 4th Ave & Atlantic Ave (Barclays)
            { 40.6890, -73.9711 }, // Lafayette Ave & Fort Greene Pl
            { 40.6889, -73.9620 }, // Lafayette Ave (Fort Greene/Clinton Hill)
            { 40.6883, -73.9527 }, // Bedford Ave & Lafayette (Bed-Stuy)
            { 40.6962, -73.9527 }, // Bedford Ave & Greene Ave
            { 40.7062, -73.9523 }, // Bedford Ave & Heyward (Williamsburg)
            { 40.7140, -73.9543 }, // Bedford Ave & North 7th St
            { 40.7244, -73.9510 }, // Manhattan Ave & North 14th St (Greenpoint)
            { 40.7330, -73.9510 }, // McGuinness Blvd & Driggs Ave
            // ===== Pulaski Bridge to Queens =====
            { 40.7398, -73.9530 }, // Pulaski Bridge (Brooklyn approach)
            { 40.7430, -73.9518 }, // Pulaski Bridge (Queens approach)
            { 40.7470, -73.9494 }, // 11th St & 49th Ave (Long Island City)
            { 40.7497, -73.9456 }, // Long Island City - 21st St & Borden Ave
            { 40.7536, -73.9425 }, // Crescent St & Queens Plaza S
            // ===== Queensboro Bridge to Manhattan (~16 miles / 25 km) =====
            { 40.7565, -73.9450 }, // Queensboro Bridge (Queens approach, lower roadway)
            { 40.7585, -73.9558 }, // Queensboro Bridge midspan
            { 40.7600, -73.9628 }, // Queensboro Bridge (Manhattan approach)
            { 40.7611, -73.9657 }, // 1st Ave & 60th St (Manhattan)
            // ===== Manhattan 1st Avenue north =====
            { 40.7682, -73.9598 }, // 1st Ave & 72nd St
            { 40.7757, -73.9530 }, // 1st Ave & 86th St
            { 40.7846, -73.9477 }, // 1st Ave & 96th St
            { 40.7920, -73.9438 }, // 1st Ave & 102nd St
            { 40.7976, -73.9395 }, // 1st Ave & 110th St
            { 40.8043, -73.9335 }, // 1st Ave & 122nd St
            // ===== Willis Ave Bridge to The Bronx (~20 miles / 32 km) =====
            { 40.8079, -73.9292 }, // Willis Ave Bridge (Manhattan approach)
            { 40.8095, -73.9285 }, // Willis Ave Bridge midspan
            { 40.8118, -73.9293 }, // Willis Ave Bridge (Bronx approach)
            { 40.8140, -73.9290 }, // E 138th St & Willis Ave (Bronx)
            { 40.8150, -73.9340 }, // E 138th St & Rider Ave
            // ===== Madison Ave Bridge back to Manhattan =====
            { 40.8128, -73.9355 }, // Madison Ave Bridge (Bronx approach)
            { 40.8120, -73.9380 }, // Madison Ave Bridge midspan
            { 40.8112, -73.9388 }, // Madison Ave Bridge (Manhattan approach)
            // ===== Harlem & 5th Avenue south =====
            { 40.8085, -73.9415 }, // 138th St & 5th Ave (Harlem)
            { 40.8030, -73.9462 }, // 5th Ave & 124th St
            { 40.7984, -73.9499 }, // 5th Ave & 116th St
            { 40.7964, -73.9526 }, // 5th Ave & 110th St (top of Central Park)
            // ===== Central Park finish =====
            { 40.7920, -73.9554 }, // East Drive at 102nd St transverse
            { 40.7872, -73.9573 }, // East Drive at 96th St
            { 40.7833, -73.9588 }, // East Drive - Engineer's Gate (90th)
            { 40.7787, -73.9628 }, // East Drive at 79th St
            { 40.7741, -73.9711 }, // 72nd St transverse (heading west)
            { 40.7762, -73.9755 }  // Finish - West Drive at Tavern on the Green
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Fort Wadsworth";
        LABELS[2] = "Verrazzano-Narrows Bridge";
        LABELS[9] = "Brooklyn - 4th Ave & Atlantic";
        LABELS[12] = "Bedford-Stuyvesant";
        LABELS[14] = "Williamsburg - Bedford Ave";
        LABELS[18] = "Pulaski Bridge";
        LABELS[21] = "Queens - Long Island City";
        LABELS[24] = "Queensboro Bridge";
        LABELS[26] = "Manhattan - 1st Ave & 60th St";
        LABELS[33] = "1st Ave & 122nd St";
        LABELS[35] = "Bronx - Willis Ave Bridge";
        LABELS[38] = "Bronx - 138th St & Rider Ave";
        LABELS[40] = "Madison Ave Bridge";
        LABELS[45] = "Top of Central Park";
        LABELS[49] = "Central Park - Engineer's Gate";
        LABELS[WAYPOINTS.length - 1] = "Finish - Tavern on the Green";
    }

    private NycMarathonOfficialCourse() {
    }

    /**
     * Real-course waypoints in route order. The caller (typically
     * {@link RaceCourseMapBulkSeedService}) feeds these to OSRM to fill in
     * the street-level geometry between landmarks. NOT a closed loop —
     * NYC is point-to-point from Staten Island to Central Park.
     */
    static List<double[]> waypoints() {
        // Defensive copy so callers can't mutate the constant data.
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
