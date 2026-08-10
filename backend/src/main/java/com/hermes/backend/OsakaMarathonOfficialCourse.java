package com.hermes.backend;

import java.util.List;

/**
 * Ordered landmarks for the current Osaka Marathon course.
 *
 * <p>The 2026 course is not a simple castle-to-castle city loop.  It has a
 * north-side opening, the Nakanoshima/Midosuji section, a west out-and-back
 * past Kyocera Dome, and three explicit turnarounds on the Naniwasuji and
 * Matsuyamachi-suji corridors before the final Imazato-suji approach to Osaka
 * Castle.  Keeping the turnarounds as paired waypoints is important: removing
 * either side shortens the line to roughly 24 km and makes the map visibly
 * wrong even when its start and finish are correct.</p>
 *
 * <p>Waypoints are routed one leg at a time through pedestrian OSRM.  When the
 * router is unavailable, the same ordered landmarks become a straight-line
 * corridor rather than a synthetic city loop.  The official PDF is the source
 * of truth for this sequence.</p>
 */
final class OsakaMarathonOfficialCourse {

    static final String RACE_ID = "osaka-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.osaka-marathon.com/2026/en/info/course/";
    static final String OFFICIAL_COURSE_PDF_URL = "https://www.osaka-marathon.com/2026/en/info/course/pdf/course_en.pdf";
    static final String OFFICIAL_SOURCE = "osaka-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            // Start and the north-side opening section.
            {34.685708, 135.520778}, // Osaka Prefectural Government start
            {34.690150, 135.519370}, // Keihan Higashiguchi
            {34.693520, 135.527210}, // Katamachi
            {34.697600, 135.530000}, // Higashinodamachi
            {34.696980, 135.517950}, // Higashitenma
            {34.710798, 135.510788}, // Tenjinbashi 6
            {34.696500, 135.513000}, // Tenjinbashi

            // Nakanoshima and the Midosuji section.
            {34.692200, 135.502200}, // Yodoyabashi
            {34.693700, 135.502300}, // Osaka City Hall / challenge marker
            {34.692300, 135.501000}, // Oe Bridge south end
            {34.692200, 135.494800}, // Watanabebashi-minamizume
            {34.692355, 135.496182}, // Higobashi
            {34.692200, 135.502200}, // Yodoyabashi return
            {34.665454, 135.503290}, // Namba

            // West out-and-back: the official route passes Kyocera Dome and
            // turns at Ichioka Motomachi 3 before returning east.
            {34.667100, 135.480300}, // Taishobashi
            {34.669400, 135.476200}, // Kyocera Dome Osaka
            {34.676181, 135.481718}, // Hakurakubashi-nishizume
            {34.678212, 135.479925}, // Honden 1
            {34.662540, 135.465649}, // Ichioka Motomachi 3 turnaround
            {34.678212, 135.479925}, // Honden 1 return
            {34.676181, 135.481718}, // Hakurakubashi-nishizume return
            {34.667100, 135.480300}, // Taishobashi return

            // Naniwasuji out-and-back: the second official turnaround.
            {34.671300, 135.488400}, // Saiwaicho 1
            {34.659500, 135.488500}, // Yanagi-dori turnaround
            {34.671300, 135.488400}, // Saiwaicho 1 return

            // Matsuyamachi-suji out-and-back: the third official turnaround.
            {34.657000, 135.511700}, // Shitaderamachi
            {34.650000, 135.515500}, // Koenkitaguchi turnaround
            {34.657000, 135.511700}, // Shitaderamachi return
            {34.660000, 135.514500}, // Shimoajimachi
            {34.664700, 135.519500}, // Uehonmachi 6

            // Final south/east section and the Osaka Castle finish.
            {34.650800, 135.522000}, // Gojonomiya-mae
            {34.652800, 135.529900}, // Katsuyama 4 / Katsuyama-dori
            {34.655400, 135.544000}, // Oikebashi
            {34.668000, 135.539000}, // Imazato-suji
            {34.691000, 135.548000}, // Shiginohigashi 2
            {34.690000, 135.532000}, // Shiromi 1 Nishi
            {34.688800, 135.526200}  // Osaka Castle Park finish
    };

    private static final String[] LABELS = new String[]{
            "Start - Osaka Prefectural Government",
            "Keihan Higashiguchi",
            "Katamachi",
            "Higashinodamachi",
            "Higashitenma",
            "Tenjinbashi 6",
            "Tenjinbashi",
            "Yodoyabashi",
            "Osaka City Hall",
            "Oe Bridge",
            "Watanabebashi-minamizume",
            "Higobashi",
            "Yodoyabashi return",
            "Namba",
            "Taishobashi",
            "Kyocera Dome Osaka",
            "Hakurakubashi-nishizume",
            "Honden 1",
            "Ichioka Motomachi 3 turnaround",
            "Honden 1 return",
            "Hakurakubashi-nishizume return",
            "Taishobashi return",
            "Saiwaicho 1",
            "Yanagi-dori turnaround",
            "Saiwaicho 1 return",
            "Shitaderamachi",
            "Koenkitaguchi turnaround",
            "Shitaderamachi return",
            "Shimoajimachi",
            "Uehonmachi 6",
            "Gojonomiya-mae",
            "Katsuyama 4",
            "Oikebashi",
            "Imazato-suji",
            "Shiginohigashi 2",
            "Shiromi 1 Nishi",
            "Finish - Osaka Castle Park"
    };

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
