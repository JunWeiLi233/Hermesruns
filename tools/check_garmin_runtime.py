"""Offline smoke checks for the Garmin workers shipped in the production image."""

import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)
    import garth


TOOLS = Path(__file__).resolve().parent


class GarminRuntimeTests(unittest.TestCase):
    def setUp(self):
        # A missing mock must fail locally instead of contacting Garmin.
        network = patch("requests.sessions.Session.request", side_effect=AssertionError("Network is disabled"))
        network.start()
        self.addCleanup(network.stop)

    def run_worker(self, name, config):
        output = io.StringIO()
        config = {"email": "runtime-check@example.test", "password": "offline-check", **config}
        with patch.object(sys, "stdin", io.StringIO(json.dumps(config))), \
                patch.object(sys, "stdout", output), patch.object(garth, "login"):
            runpy.run_path(str(TOOLS / name), run_name="__main__")
        return json.loads(output.getvalue())

    def test_activity_worker_downloads_running_fit_and_skips_other_sports(self):
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w") as zipped:
            zipped.writestr("activity.fit", b"offline-fit-fixture")
        activities = [
            {"activityId": 101, "activityName": "Fixture run", "activityType": {"typeKey": "running"}},
            {"activityId": 102, "activityType": {"typeKey": "cycling"}},
        ]
        with tempfile.TemporaryDirectory() as output_dir, \
                patch.object(garth, "connectapi", return_value=activities), \
                patch.object(garth.client, "get", return_value=archive.getvalue()):
            result = self.run_worker("garmin_connect_download.py", {"output_dir": output_dir, "limit": 10})
            self.assertTrue(result["success"])
            self.assertEqual(result["downloaded"], 1)
            self.assertEqual(result["skipped"], 1)
            self.assertEqual(Path(result["activities"][0]["filePath"]).read_bytes(), b"offline-fit-fixture")

    def test_wellness_worker_uses_installed_provider_api_and_preserves_missing_data(self):
        def response(path, *args, **kwargs):
            if path.startswith("/usersummary-service/usersummary/daily/"):
                return {"userProfileId": 1, "calendarDate": "2026-09-01", "totalSteps": 1200}
            if path.startswith("/wellness-service/wellness/dailySleepData/"):
                return {"dailySleepDTO": {"id": None}}
            if path.startswith("/hrv-service/hrv/"):
                return None
            if path.startswith("/usersummary-service/stats/stress/daily/"):
                return [{"calendarDate": "2026-09-01", "overallStressLevel": 25}]
            if path.startswith("/weight-service/weight/"):
                return {}
            raise AssertionError(f"Unexpected provider path: {path}")

        with patch.object(garth.client, "connectapi", side_effect=response), \
                patch.object(type(garth.client), "username", new_callable=unittest.mock.PropertyMock, return_value="fixture"):
            result = self.run_worker("garmin_wellness_download.py", {
                "start_date": "2026-09-01", "end_date": "2026-09-01",
            })
        self.assertTrue(result["success"], result)
        self.assertEqual(result["days_fetched"], 1)
        day = result["days"][0]
        self.assertEqual(day["wellness"]["total_steps"], 1200)
        self.assertEqual(day["stress"]["overall_stress_level"], 25)
        self.assertIsNone(day["sleep"])
        self.assertIsNone(day["hrv"])
        self.assertIsNone(day["body"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
