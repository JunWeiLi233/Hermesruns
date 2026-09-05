package com.hermes.backend.races;

import java.util.List;

/**
 * Official Tokyo Marathon 2026 course waypoints in route order.
 *
 * <p>The public passing-time table defines the current topology: Shinjuku
 * start, Uenohirokoji north turn, Kuramae/Ryogoku, Tomioka Hachimangu east
 * turn, Nihombashi/Ginza, Tamachi south turn, and Tokyo Station/Gyoko-dori finish. The
 * old Tatsumi/Shinonome/Tsukishima branch is not part of the current official
 * published course and must not be seeded.</p>
 */
final class TokyoMarathonOfficialCourse {

    static final String RACE_ID = "tokyo-marathon";
    static final String OFFICIAL_COURSE_URL = "https://www.marathon.tokyo/en/about/course/";
    static final String OFFICIAL_SOURCE = "tokyo-official-course";

    private static final double[][] WAYPOINTS = new double[][]{
            { 35.6903, 139.6915 }, // [0]  Start - Tokyo Metropolitan Government Bldg. No.1
            { 35.6919, 139.6939 }, // [1]  Shinjuku Mitsui Building
            { 35.6927, 139.7038 }, // [2]  Shinjuku Piccadilly Cinema
            { 35.6925, 139.7145 }, // [3]  Tomihisacho crossroad
            { 35.6927, 139.7248 }, // [4]  Kappazaka-shita crossroad
            { 35.6929, 139.7356 }, // [5]  Musashino Art University Ichigaya Campus
            { 35.7003, 139.7416 }, // [6]  Tokyo University of Science Futaba Building
            { 35.7042, 139.7505 }, // [7]  Koraku Bridge crossroad
            { 35.6960, 139.7569 }, // [8]  Jinbocho
            { 35.6951, 139.7675 }, // [9]  Awajicho crossroad
            { 35.7025, 139.7713 }, // [10] AKIBA CO Building
            { 35.7080, 139.7730 }, // [11] Uenohirokoji turning point
            { 35.7044, 139.7727 }, // [12] Seiki Daiichi Building
            { 35.6955, 139.7702 }, // [13] Hulic Kanda Sudacho Building
            { 35.6868, 139.7739 }, // [14] Mitsui Main Building
            { 35.6815, 139.7792 }, // [15] Tokyo Shoken Building
            { 35.6876, 139.7886 }, // [16] Nihonbashi Hamacho
            { 35.6937, 139.7863 }, // [17] Higashi-Nihonbashi
            { 35.7001, 139.7909 }, // [18] Kuramae 1-chome
            { 35.7088, 139.7963 }, // [19] Komagatabashi-Nishi crossroad
            { 35.7080, 139.7958 }, // [20] Komagata CA Building
            { 35.7009, 139.7935 }, // [21] Kuramae Bridge
            { 35.7036, 139.8015 }, // [22] Resona Bank Honjo Branch
            { 35.6960, 139.8010 }, // [23] Ryogoku half-marathon point
            { 35.6851, 139.7986 }, // [24] Takabashi bus stop
            { 35.6750, 139.7993 }, // [25] Sigma Printing Building
            { 35.6716, 139.7998 }, // [26] Tomioka Hachimangu turning point
            { 35.6734, 139.7987 }, // [27] Mori Building
            { 35.6820, 139.7984 }, // [28] ARTESS MO SCELT
            { 35.6885, 139.7986 }, // [29] BOZO
            { 35.6941, 139.7990 }, // [30] Midori 1-chome crossroad
            { 35.7009, 139.7935 }, // [31] Kuramae Bridge return
            { 35.6957, 139.7869 }, // [32] Higashi-Yanagibashi 1-chome
            { 35.6879, 139.7870 }, // [33] Meijiza
            { 35.6850, 139.7792 }, // [34] Yamaman Building 2
            { 35.6809, 139.7728 }, // [35] Nihombashi Takashimaya
            { 35.6720, 139.7647 }, // [36] Ginza
            { 35.6737, 139.7584 }, // [37] Hibiya
            { 35.6659, 139.7544 }, // [38] Yashima Denki
            { 35.6580, 139.7516 }, // [39] Minato City Hall
            { 35.6490, 139.7495 }, // [40] Mita NN Building
            { 35.6457, 139.7475 }, // [41] Tamachi Station turning point
            { 35.6498, 139.7478 }, // [42] NEC return
            { 35.6576, 139.7515 }, // [43] Le Pain Quotidien
            { 35.6650, 139.7549 }, // [44] CJ Building
            { 35.6740, 139.7584 }, // [45] Hibiya crossroad
            { 35.6815, 139.7627 }, // [46] Yusen Building
            { 35.6815, 139.7649 }, // [47] Finish - Tokyo Station / Gyoko-dori Ave.
    };

    private static final String[] LABELS;
    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Tokyo Metropolitan Government Bldg. No.1";
        LABELS[5] = "Ichigaya";
        LABELS[8] = "Jinbocho";
        LABELS[10] = "Akihabara";
        LABELS[11] = "Uenohirokoji turning point";
        LABELS[21] = "Kuramae Bridge";
        LABELS[23] = "Half - Ryogoku";
        LABELS[26] = "Tomioka Hachimangu turning point";
        LABELS[30] = "Midori 1-chome";
        LABELS[31] = "Kuramae Bridge return";
        LABELS[35] = "Nihombashi Takashimaya";
        LABELS[36] = "Ginza";
        LABELS[39] = "Minato City Hall";
        LABELS[41] = "Tamachi Station turning point";
        LABELS[45] = "Hibiya crossroad";
        LABELS[WAYPOINTS.length - 1] = "Finish - Tokyo Station / Gyoko-dori Ave.";
    }

    private TokyoMarathonOfficialCourse() {
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
