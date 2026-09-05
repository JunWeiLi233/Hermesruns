package com.hermes.backend.races;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Official TCS New York City Marathon route seed.
 *
 * <p>The waypoints follow NYRR's 2025 course map: Fort Wadsworth,
 * Verrazzano-Narrows Bridge, Brooklyn 4th/Lafayette/Bedford/Manhattan,
 * Pulaski Bridge, Long Island City, Queensboro Bridge, First Avenue, the Bronx
 * loop, Madison Avenue Bridge, Fifth Avenue, East Drive, Central Park South,
 * Columbus Circle, and West Drive to Tavern on the Green.</p>
 *
 * <p>The elevation samples come from NYRR's 2025 media guide elevation profile.
 * DEM services usually sample bridge deck points at water/ground level, so NYC
 * needs the official profile rather than terrain lookup for runner-facing
 * elevation.</p>
 */
final class NycMarathonOfficialCourse {

    static final String RACE_ID = "new-york-city-marathon";
    static final String OFFICIAL_COURSE_URL = "https://webassets.nyrr.org/nyrrwebsiteassets/TCSNYCM25_Map_Course_080625_M_OL.pdf";
    static final String OFFICIAL_ELEVATION_PROFILE_URL = "https://webassets.nyrr.org/nyrrwebsiteassets/TCSNYCM25_Media%20Guide_DIGITAL_M2_2.pdf";
    static final String OFFICIAL_SOURCE = "nyc-official-course";
    static final int OFFICIAL_TOTAL_CLIMB_METERS = 247;
    private static final String DETAILED_ROUTE_RESOURCE = "/official-courses/nyc-marathon-detailed-route.txt";
    private static final List<double[]> DETAILED_ROUTE = loadDetailedRoute();

    /*
     * NYRR media guide page "Course Map and Elevation Profile" lists elevation
     * in feet across five strip charts. The PDF text extraction emits those
     * strips bottom-up, so this array stores them in actual course order:
     * start/Verrazzano first, Central Park finish last.
     */
    private static final int[] ELEVATION_PROFILE_FEET = new int[]{
            96, 117, 157, 200, 240, 260, 246, 200, 150, 105, 70, 50, 42, 38, 47, 55, 71, 75, 74, 72, 68, 65, 70, 71, 74, 76, 81, 80, 76, 73, 81, 86, 91, 88, 84, 73, 82, 66,
            66, 48, 42, 34, 19, 25, 22, 27, 33, 40, 47, 47, 38, 25, 25, 24, 23, 25, 25, 26, 28, 31, 40, 44, 38, 52, 72, 90, 91, 31, 63, 68, 70, 50, 45, 46, 41, 32, 22, 13, 16,
            16, 24, 37, 48, 51, 45, 44, 40, 51, 34, 27, 33, 28, 18, 19, 14, 18, 22, 27, 34, 28, 19, 16, 14, 10, 33, 56, 40, 28, 14, 19, 13, 8, 10, 10, 18, 18, 16, 15, 24, 72,
            72, 92, 105, 135, 112, 85, 66, 48, 48, 50, 51, 43, 41, 47, 45, 50, 58, 50, 33, 21, 14, 10, 11, 12, 10, 9, 7, 7, 9, 12, 11, 10, 13, 24, 44, 26, 29, 24,
            24, 28, 23, 19, 22, 19, 22, 34, 26, 10, 12, 16, 18, 22, 25, 27, 25, 26, 27, 24, 20, 19, 21, 28, 36, 46, 58, 72, 88, 100, 104, 102, 104, 100, 78, 49, 72, 75, 72, 76, 67, 52, 50, 44, 77, 75, 72, 84
    };

    private static final double[][] WAYPOINTS = new double[][]{
            // Staten Island start and Verrazzano-Narrows Bridge.
            {40.6055, -74.0563}, // Start - Fort Wadsworth toll plaza
            {40.6066, -74.0468}, // Verrazzano-Narrows Bridge (Staten Island tower)
            {40.6076, -74.0412}, // Verrazzano-Narrows Bridge midspan
            {40.6087, -74.0379}, // Verrazzano-Narrows Bridge (Brooklyn tower)

            // Brooklyn.
            {40.6228, -74.0298}, // Bay Ridge - 92nd St & 4th Ave
            {40.6357, -74.0202}, // Sunset Park - 65th St & 4th Ave
            {40.6500, -74.0125}, // 4th Ave & 47th St
            {40.6633, -73.9986}, // 4th Ave & 25th St
            {40.6770, -73.9831}, // 4th Ave & 9th St
            {40.6843, -73.9785}, // 4th Ave & Atlantic Ave
            {40.6890, -73.9711}, // Lafayette Ave & Fort Greene Pl
            {40.6889, -73.9620}, // Lafayette Ave
            {40.6883, -73.9527}, // Bedford Ave & Lafayette Ave
            {40.6962, -73.9527}, // Bedford Ave & Greene Ave
            {40.7062, -73.9523}, // Bedford Ave & Heyward St
            {40.7140, -73.9543}, // Bedford Ave & N 7th St
            {40.7244, -73.9510}, // Manhattan Ave & N 14th St
            {40.7330, -73.9510}, // McGuinness Blvd & Driggs Ave

            // Pulaski Bridge and Queens.
            {40.7398, -73.9530}, // Pulaski Bridge (Brooklyn approach)
            {40.7430, -73.9518}, // Pulaski Bridge (Queens approach)
            {40.7455, -73.9500}, // 11th St & 50th Ave
            {40.7489, -73.9444}, // Vernon Blvd / Jackson Ave / 44th Dr corridor
            {40.7536, -73.9425}, // Crescent St & Queens Plaza S

            // Queensboro Bridge and Manhattan First Avenue.
            {40.7565, -73.9450}, // Queensboro Bridge (Queens approach)
            {40.7585, -73.9558}, // Queensboro Bridge midspan
            {40.7600, -73.9628}, // Queensboro Bridge (Manhattan approach)
            {40.7611, -73.9657}, // 1st Ave & 60th St
            {40.7682, -73.9598}, // 1st Ave & 72nd St
            {40.7757, -73.9530}, // 1st Ave & 86th St
            {40.7846, -73.9477}, // 1st Ave & 96th St
            {40.7920, -73.9438}, // 1st Ave & 102nd St
            {40.7976, -73.9395}, // 1st Ave & 110th St
            {40.8043, -73.9335}, // 1st Ave & 122nd St

            // Willis Avenue Bridge and the Bronx loop.
            {40.8079, -73.9292}, // Willis Ave Bridge (Manhattan approach)
            {40.8095, -73.9285}, // Willis Ave Bridge midspan
            {40.8118, -73.9293}, // Willis Ave Bridge (Bronx approach)
            {40.8136, -73.9292}, // Willis Ave & E 135th St
            {40.8147, -73.9324}, // E 135th St & Rider Ave
            {40.8150, -73.9340}, // E 138th St & Rider Ave

            // Madison Avenue Bridge back to Manhattan.
            {40.8128, -73.9355}, // Madison Ave Bridge (Bronx approach)
            {40.8120, -73.9380}, // Madison Ave Bridge midspan
            {40.8112, -73.9388}, // Madison Ave Bridge (Manhattan approach)

            // Harlem and Fifth Avenue.
            {40.8085, -73.9415}, // 138th St & 5th Ave
            {40.8030, -73.9462}, // 5th Ave & 124th St
            {40.7984, -73.9499}, // 5th Ave & 116th St
            {40.7964, -73.9526}, // 5th Ave & 110th St
            {40.7907, -73.9558}, // 5th Ave & 100th St

            // Central Park final miles.
            {40.7843, -73.9586}, // Engineer's Gate / East 90th St
            {40.7813, -73.9603}, // East Drive by the Metropolitan Museum of Art
            {40.7767, -73.9637}, // East Drive southbound
            {40.7713, -73.9691}, // East Drive / lower park loop
            {40.7655, -73.9729}, // Central Park South at Grand Army Plaza
            {40.7668, -73.9770}, // Central Park South
            {40.7681, -73.9819}, // Columbus Circle / re-enter Central Park
            {40.7703, -73.9795}, // West Drive northbound
            {40.7728, -73.9775}, // West Drive by Tavern on the Green
            {40.7740, -73.9766}  // Finish - West Drive at Tavern on the Green
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
        LABELS[32] = "1st Ave & 122nd St";
        LABELS[35] = "Bronx - Willis Ave Bridge";
        LABELS[38] = "Bronx - 138th St & Rider Ave";
        LABELS[40] = "Madison Ave Bridge";
        LABELS[45] = "Top of Central Park";
        LABELS[47] = "Central Park - Engineer's Gate";
        LABELS[51] = "Central Park South";
        LABELS[53] = "Columbus Circle";
        LABELS[WAYPOINTS.length - 1] = "Finish - West Drive at Tavern on the Green";
    }

    private NycMarathonOfficialCourse() {
    }

    static List<double[]> waypoints() {
        double[][] copy = new double[WAYPOINTS.length][2];
        for (int i = 0; i < WAYPOINTS.length; i++) {
            copy[i][0] = WAYPOINTS[i][0];
            copy[i][1] = WAYPOINTS[i][1];
        }
        return List.of(copy);
    }

    static List<double[]> detailedRoute() {
        double[][] copy = new double[DETAILED_ROUTE.size()][2];
        for (int i = 0; i < DETAILED_ROUTE.size(); i++) {
            copy[i][0] = DETAILED_ROUTE.get(i)[0];
            copy[i][1] = DETAILED_ROUTE.get(i)[1];
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

    static List<Integer> elevationProfileMeters() {
        List<Integer> meters = new ArrayList<>(ELEVATION_PROFILE_FEET.length);
        for (int feet : ELEVATION_PROFILE_FEET) {
            meters.add(Math.round(feet * 0.3048f));
        }
        return List.copyOf(meters);
    }

    private static List<double[]> loadDetailedRoute() {
        InputStream inputStream = NycMarathonOfficialCourse.class.getResourceAsStream(DETAILED_ROUTE_RESOURCE);
        if (inputStream == null) {
            throw new IllegalStateException("Missing NYC marathon detailed route resource: " + DETAILED_ROUTE_RESOURCE);
        }
        List<double[]> points = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                String trimmed = line.trim();
                if (trimmed.isBlank() || trimmed.startsWith("#")) {
                    continue;
                }
                String[] parts = trimmed.split(",");
                if (parts.length != 2) {
                    throw new IllegalStateException("Invalid NYC route coordinate at line " + lineNumber);
                }
                points.add(new double[]{Double.parseDouble(parts[0]), Double.parseDouble(parts[1])});
            }
        } catch (IOException | NumberFormatException ex) {
            throw new IllegalStateException("Unable to load NYC marathon detailed route", ex);
        }
        if (points.size() < 100) {
            throw new IllegalStateException("NYC marathon detailed route is too sparse: " + points.size());
        }
        return List.copyOf(points);
    }
}
