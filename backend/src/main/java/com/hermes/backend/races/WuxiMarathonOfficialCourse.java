package com.hermes.backend.races;

import java.util.List;

/**
 * Official 2026 Wuxi Marathon turning points following the organizer's
 * published route sequence.
 *
 * <p>These waypoints are intentionally hand-curated corridor anchors, not
 * survey-grade per-meter geometry. The bulk seed service routes each leg
 * through OSRM so Hermes renders a street-following marathon course instead of
 * the older coarse supplemental polyline.</p>
 */
final class WuxiMarathonOfficialCourse {

    static final String RACE_ID = "wuxi-marathon";
    static final String OFFICIAL_COURSE_URL = "https://wuxi.marathon.org.cn/page/wZ2dP3y0a5OB0oGp46LA.html";
    static final String OFFICIAL_SOURCE = "wuxi-official-course";
    static final String SOURCE_NOTE =
            "Official 2026 Wuxi Marathon regulations route sequence cross-checked against the race traffic-control notice";

    private static final double[][] WAYPOINTS = new double[][]{
            {31.55300, 120.25300}, // [0]  Start - Taihu Avenue / Yinxiu Road
            {31.55240, 120.26180}, // [1]  Taihu Avenue eastbound
            {31.54680, 120.26880}, // [2]  Hongqiao Road turn
            {31.54040, 120.25980}, // [3]  Zhongnan West Road
            {31.53950, 120.24820}, // [4]  Yinxiu Road / Wangshan Road
            {31.54179, 120.24070}, // [5]  Huanhu Road / Taihu Avenue (Lihu Zhiguang)
            {31.53146, 120.24318}, // [6]  Building Road
            {31.52382, 120.23991}, // [7]  Shili Fangdi
            {31.51500, 120.22900}, // [8]  Yuantouzhu Road
            {31.52600, 120.21800}, // [9]  Shanshui East Road / Gaolang West Road
            {31.50531, 120.20881}, // [10] Yuanxi Dao / Zhenze Road
            {31.49296, 120.22605}, // [11] Jiangnan University South Gate
            {31.49068, 120.23832}, // [12] Central Avenue / Emeishan Road
            {31.48631, 120.26270}, // [13] Jiangnan University East Gate / Jiangnan Avenue
            {31.48275, 120.29637}, // [14] Wudu Road U-turn near Lide Road
            {31.48387, 120.31938}, // [15] Finance Second Street / Fangmiao Road
            {31.51126, 120.32398}, // [16] Gonghu Bay Wetland Park Greenway north section
            {31.51510, 120.31244}, // [17] Gonghu Bay Wetland Park return
            {31.47320, 120.31169}, // [18] Qingyuan Road
            {31.47879, 120.32221}, // [19] Qingshu Road / Hefeng Road
            {31.47836, 120.32303}, // [20] Finish - Wuxi Taihu International Expo Center
    };

    private static final String[] LABELS;

    static {
        LABELS = new String[WAYPOINTS.length];
        LABELS[0] = "Start - Taihu Avenue / Yinxiu Road";
        LABELS[2] = "Hongqiao Road turn";
        LABELS[3] = "Zhongnan West Road";
        LABELS[4] = "Yinxiu Road / Wangshan Road";
        LABELS[5] = "Huanhu Road / Taihu Avenue";
        LABELS[7] = "Shili Fangdi";
        LABELS[8] = "Yuantouzhu Road";
        LABELS[10] = "Yuanxi Dao / Zhenze Road";
        LABELS[11] = "Jiangnan University South Gate";
        LABELS[12] = "Central Avenue / Emeishan Road";
        LABELS[13] = "Jiangnan University East Gate";
        LABELS[14] = "Wudu Road U-turn near Lide Road";
        LABELS[15] = "Finance Second Street / Fangmiao Road";
        LABELS[16] = "Gonghu Bay Wetland Park Greenway";
        LABELS[19] = "Qingshu Road / Hefeng Road";
        LABELS[WAYPOINTS.length - 1] = "Finish - Wuxi Taihu International Expo Center";
    }

    private WuxiMarathonOfficialCourse() {
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
