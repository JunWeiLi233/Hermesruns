#!/usr/bin/env python3
"""
Download running activities from Garmin Connect as FIT files.

Uses garth (the authentication library from GarminDB) for Garmin Connect SSO.
Input:  JSON on stdin  {"email":"…","password":"…","output_dir":"…","limit":50}
Output: JSON on stdout {"success":true,"downloaded":N,"skipped":N,"activities":[…]}
"""

import json
import os
import sys
import zipfile
from io import BytesIO
from pathlib import Path

RUNNING_TYPE_KEYS = frozenset({
    "running",
    "trail_running",
    "treadmill_running",
    "track_running",
    "street_running",
    "casual_running",
    "speed_running",
    "ultra_running",
})


def _download_fit(client, activity_id, output_dir):
    """Download the original FIT file for a given activity ID.

    Garmin serves a ZIP containing the FIT; this extracts it to *output_dir*
    and returns the path to the extracted .fit file, or None on failure.
    """
    path = f"/download-service/files/activity/{activity_id}"
    try:
        response = client.get("connect", path)
    except Exception:
        response = client.request("GET", "connect", path)

    data = response.content if hasattr(response, "content") else response

    if not data or len(data) < 4:
        return None

    # Garmin wraps the FIT inside a ZIP
    if data[:2] == b"PK":
        try:
            with zipfile.ZipFile(BytesIO(data)) as zf:
                for name in zf.namelist():
                    if name.lower().endswith(".fit"):
                        fit_bytes = zf.read(name)
                        dest = os.path.join(output_dir, f"{activity_id}.fit")
                        with open(dest, "wb") as f:
                            f.write(fit_bytes)
                        return dest
        except zipfile.BadZipFile:
            pass

    # Not a ZIP – assume raw FIT bytes
    dest = os.path.join(output_dir, f"{activity_id}.fit")
    with open(dest, "wb") as f:
        f.write(data)
    return dest


def main():
    config = json.load(sys.stdin)
    email = config["email"]
    password = config["password"]
    output_dir = config["output_dir"]
    limit = int(config.get("limit", 50))

    try:
        import garth
    except ImportError:
        json.dump(
            {"success": False, "error": "garth is not installed. Run: pip install garth"},
            sys.stdout,
        )
        return

    os.makedirs(output_dir, exist_ok=True)

    # Authenticate with Garmin Connect SSO (same mechanism as GarminDB)
    try:
        garth.login(email, password)
    except Exception as exc:
        json.dump(
            {"success": False, "error": f"Garmin login failed: {exc}"},
            sys.stdout,
        )
        return

    # Fetch activity list
    try:
        activities = garth.connectapi(
            "/activitylist-service/activities/search/activities",
            params={"start": 0, "limit": limit},
        )
    except Exception as exc:
        json.dump(
            {"success": False, "error": f"Failed to list activities: {exc}"},
            sys.stdout,
        )
        return

    if not isinstance(activities, list):
        json.dump({"success": False, "error": "Unexpected response from Garmin Connect."}, sys.stdout)
        return

    downloaded = []
    skipped = 0
    errors = []

    for activity in activities:
        activity_id = activity.get("activityId")
        if not activity_id:
            continue

        type_info = activity.get("activityType") or {}
        type_key = (type_info.get("typeKey") or "").lower()

        if type_key not in RUNNING_TYPE_KEYS:
            skipped += 1
            continue

        try:
            fit_path = _download_fit(garth.client, activity_id, output_dir)
            if not fit_path:
                errors.append(f"No FIT data for activity {activity_id}")
                continue

            downloaded.append({
                "activityId": str(activity_id),
                "name": activity.get("activityName", ""),
                "type": type_key,
                "distance": activity.get("distance"),
                "duration": activity.get("duration"),
                "startTime": activity.get("startTimeLocal", ""),
                "avgHr": activity.get("averageHR"),
                "maxHr": activity.get("maxHR"),
                "calories": activity.get("calories"),
                "elevationGain": activity.get("elevationGain"),
                "filePath": fit_path,
            })
        except Exception as exc:
            errors.append(f"Activity {activity_id}: {exc}")
            continue

    result = {
        "success": True,
        "downloaded": len(downloaded),
        "skipped": skipped,
        "activities": downloaded,
    }
    if errors:
        result["warnings"] = errors[:20]

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
