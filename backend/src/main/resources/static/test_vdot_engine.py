import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from vdot_engine import (
    clean_and_calculate_gap,
    estimate_vo2max_from_hrr_regression,
    extract_steady_state_segments,
    tag_hrv_fatigue_outlier,
)


class VdotEngineTests(unittest.TestCase):
    def test_clean_and_calculate_gap_filters_anomalies_and_adds_gap_speed(self):
        rows = [
            {"speed_mps": 0.0, "grade": 0.0},
            {"speed_mps": 4.0, "grade": 0.0},
            {"speed_mps": 4.0, "grade": 0.08},
            {"speed_mps": 12.0, "grade": 0.0},
        ]

        cleaned = clean_and_calculate_gap(rows)

        self.assertEqual(len(cleaned), 2)
        self.assertTrue(all(row["speed_m_per_min"] > 0 for row in cleaned))
        self.assertTrue(all("gap_speed" in row for row in cleaned))
        self.assertAlmostEqual(cleaned[0]["gap_speed"], 240.0, places=3)
        self.assertLess(cleaned[1]["gap_speed"], cleaned[1]["speed_m_per_min"])

    def test_extract_steady_state_segments_returns_long_stable_window(self):
        rows = []
        for minute in range(0, 21):
            rows.append({
                "timestamp_s": minute * 60,
                "heart_rate": 140 + (1 if minute % 4 == 0 else -1 if minute % 5 == 0 else 0),
            })
        for minute in range(21, 27):
            rows.append({
                "timestamp_s": minute * 60,
                "heart_rate": 176,
            })

        steady = extract_steady_state_segments(rows, max_hr=190)

        self.assertGreaterEqual(len(steady), 11)
        self.assertEqual(steady[0]["timestamp_s"], 0)
        self.assertEqual(steady[-1]["timestamp_s"], 1200)
        self.assertTrue(all(row["heart_rate"] < 190 * 0.85 for row in steady))

    def test_estimate_vo2max_from_hrr_regression_matches_expected_line(self):
        rows = [
            {"heart_rate": 130, "gap_speed": 200},
            {"heart_rate": 145, "gap_speed": 230},
            {"heart_rate": 160, "gap_speed": 260},
        ]

        vo2max = estimate_vo2max_from_hrr_regression(rows, resting_hr=70, max_hr=190)
        expected_v_vo2max = 320.0
        expected_vo2max = -4.60 + 0.182258 * expected_v_vo2max + 0.000104 * (expected_v_vo2max ** 2)

        self.assertTrue(math.isclose(vo2max, expected_vo2max, rel_tol=1e-9))

    def test_tag_hrv_fatigue_outlier_flags_low_daily_hrv(self):
        tagged = tag_hrv_fatigue_outlier(58.4, daily_hrv=42, baseline_hrv=60)

        self.assertEqual(tagged["vo2max_score"], 58.4)
        self.assertTrue(tagged["fatigue_outlier"])


if __name__ == "__main__":
    unittest.main()
