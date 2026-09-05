import importlib.util
import io
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).resolve().parents[4] / "tools" / "garmin_wellness_download.py"
SPEC = importlib.util.spec_from_file_location("garmin_wellness_download_under_test", SCRIPT)
downloader = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(downloader)


class GarminWellnessDownloadTests(unittest.TestCase):
    def setUp(self):
        self.garth = ModuleType("garth")
        self.garth.__path__ = []
        self.garth.client = object()
        self.garth.login = Mock()
        data = ModuleType("garth.data")
        stats = ModuleType("garth.stats")
        self.fetches = {}
        for name, model, method, module in (
            ("wellness", "DailySummary", "get", data),
            ("sleep", "SleepData", "get", data),
            ("hrv", "HRVData", "get", data),
            ("stress", "DailyStress", "get", stats),
            ("body", "WeightData", "list", data),
        ):
            fetch = Mock(return_value=None)
            setattr(module, model, SimpleNamespace(**{method: fetch}))
            self.fetches[name] = fetch
        self.modules = {"garth": self.garth, "garth.data": data, "garth.stats": stats}
        self.addCleanup(patch.stopall)
        patch.dict(sys.modules, self.modules).start()

    def run_main(self):
        config = {
            "email": "private-runner@example.test",
            "password": "private-password-marker",
            "start_date": "2026-09-01",
            "end_date": "2026-09-02",
        }
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch.object(sys, "stdin", io.StringIO(json.dumps(config))), \
                patch.object(sys, "stdout", stdout), patch.object(sys, "stderr", stderr):
            downloader.main()
        for secret in (config["email"], config["password"], "private-token-marker"):
            self.assertNotIn(secret, stdout.getvalue())
            self.assertNotIn(secret, stderr.getvalue())
        self.assertEqual(stderr.getvalue(), "")
        return json.loads(stdout.getvalue())

    def failure(self, **attributes):
        error = RuntimeError(
            "private-runner@example.test private-password-marker "
            "https://provider.test/?token=private-token-marker")
        for name, value in attributes.items():
            setattr(error, name, value)
        return error

    def reset_fetches(self):
        for fetch in self.fetches.values():
            fetch.reset_mock(return_value=True, side_effect=True)
            fetch.return_value = None

    def test_each_fetch_propagates_provider_failure(self):
        for name, fetch in self.fetches.items():
            with self.subTest(path=name):
                self.reset_fetches()
                error = self.failure()
                fetch.side_effect = error
                with self.assertRaises(RuntimeError) as raised:
                    getattr(downloader, "_fetch_" + name)(self.garth.client, "2026-09-01")
                self.assertIs(raised.exception, error)

    def test_each_fetch_accepts_legitimate_none(self):
        for name in self.fetches:
            with self.subTest(path=name):
                self.assertIsNone(getattr(downloader, "_fetch_" + name)(self.garth.client, "2026-09-01"))

    def test_empty_weight_list_is_legitimate_no_data(self):
        self.fetches["body"].return_value = []
        self.assertIsNone(downloader._fetch_body(self.garth.client, "2026-09-01"))

    def test_each_fetch_propagates_model_conversion_failure(self):
        for name, fetch in self.fetches.items():
            with self.subTest(path=name):
                self.reset_fetches()
                fetch.return_value = SimpleNamespace(json=Mock(side_effect=self.failure()))
                with self.assertRaises(RuntimeError):
                    getattr(downloader, "_fetch_" + name)(self.garth.client, "2026-09-01")

    def test_empty_window_is_successful(self):
        self.assertEqual(self.run_main(), {"success": True, "days_fetched": 0, "days": []})
        for fetch in self.fetches.values():
            self.assertEqual(fetch.call_count, 2)

    def test_successful_payload_keeps_all_existing_data_paths(self):
        for name, payload in (
            ("wellness", {"totalSteps": 1200}), ("sleep", {"sleepScore": 90}),
            ("hrv", {"lastNightAvg": 60}), ("stress", {"overallStressLevel": 25}),
            ("body", {"weight": 70}),
        ):
            self.fetches[name].return_value = SimpleNamespace(_json=payload)
        result = self.run_main()
        self.assertTrue(result["success"])
        self.assertEqual(result["days_fetched"], 2)
        day = result["days"][0]
        self.assertEqual(day["wellness"]["total_steps"], 1200)
        self.assertEqual(day["sleep"]["sleep_score"], 90)
        self.assertEqual(day["hrv"]["last_night_avg"], 60)
        self.assertEqual(day["stress"]["overall_stress_level"], 25)
        self.assertEqual(day["body"]["weight"], 70)

    def test_failure_in_each_path_after_a_successful_day_fails_the_window(self):
        for name, fetch in self.fetches.items():
            with self.subTest(path=name):
                self.reset_fetches()
                self.fetches["wellness"].return_value = SimpleNamespace(totalSteps=1200)
                first_day = SimpleNamespace(totalSteps=1200) if name == "wellness" else None
                fetch.side_effect = [first_day, self.failure()]
                result = self.run_main()
                self.assertFalse(result["success"])
                self.assertEqual(result["error"], "Garmin wellness download failed.")
                self.assertNotIn("days", result)
                self.assertEqual(fetch.call_count, 2)

    def test_login_failure_is_sanitized(self):
        self.garth.login.side_effect = self.failure()
        self.assertEqual(self.run_main(), {"success": False, "error": "Garmin login failed."})
        for fetch in self.fetches.values():
            fetch.assert_not_called()

    def test_rate_limit_metadata_survives_login_and_each_fetch_failure(self):
        for name, operation in {"login": self.garth.login, **self.fetches}.items():
            with self.subTest(path=name):
                self.reset_fetches()
                self.garth.login.reset_mock(side_effect=True)
                operation.side_effect = self.failure(response=SimpleNamespace(
                    status_code=429, headers={"Retry-After": "120"}))
                result = self.run_main()
                self.assertFalse(result["success"])
                self.assertEqual(result["errorCode"], "GARMIN_RATE_LIMITED")
                self.assertEqual(result["retryAfterSeconds"], 120)

    def test_text_only_rate_limit_retains_safe_default_cooldown(self):
        self.garth.login.side_effect = RuntimeError("HTTP 429 private-password-marker")
        result = self.run_main()
        self.assertFalse(result["success"])
        self.assertEqual(result["errorCode"], "GARMIN_RATE_LIMITED")
        self.assertEqual(result["retryAfterSeconds"], 900)

    def test_rate_limit_retry_after_is_bounded_and_invalid_values_use_default(self):
        for value, expected in (("1", 60), ("7200", 3600), ("private-password-marker", 900)):
            with self.subTest(retry_after=value):
                self.garth.login.side_effect = self.failure(response=SimpleNamespace(
                    status_code=429, headers={"Retry-After": value}))
                self.assertEqual(self.run_main()["retryAfterSeconds"], expected)

    def test_missing_provider_dependency_reports_safe_failure(self):
        with patch.dict(sys.modules, {"garth": None}):
            result = self.run_main()
        self.assertFalse(result["success"])
        self.assertIn("garth is not installed", result["error"])


if __name__ == "__main__":
    unittest.main()
