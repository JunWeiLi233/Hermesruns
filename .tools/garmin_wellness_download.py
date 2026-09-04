#!/usr/bin/env python3
"""
Download wellness data from Garmin Connect (daily summary, sleep, HRV, stress, body composition).

Uses garth for Garmin Connect SSO.
Input:  JSON on stdin  {"email":"…","password":"…","start_date":"2026-03-21","end_date":"2026-04-20"}
Output: JSON on stdout {"success":true,"days_fetched":N,"days":[…]}
"""

import json
import sys
from datetime import date, timedelta


def _date_range(start, end):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def _safe_float(val, default=None):
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _safe_int(val, default=None):
    if val is None:
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _model_attributes(entry):
    if entry is None:
        return None
    attrs = {}
    if hasattr(entry, '__dict__'):
        attrs.update(entry.__dict__)
    if hasattr(entry, '_json'):
        attrs.update(entry._json if isinstance(entry._json, dict) else {})
    if hasattr(entry, 'json') and callable(entry.json):
        attrs.update(entry.json())
    return attrs


def _failure_result(exc, message):
    # Inspect provider details for classification only; never emit their text or URLs.
    for error in (exc, exc.__cause__, exc.__context__):
        if error is None:
            continue
        response = getattr(error, "response", None)
        text = str(error).lower()
        if (getattr(response, "status_code", None) == 429
                or getattr(error, "status_code", None) == 429
                or any(marker in text for marker in ("429", "too many requests", "rate limit"))):
            headers = getattr(response, "headers", None) or {}
            retry_after = _safe_int(headers.get("Retry-After", headers.get("retry-after")), 900)
            return {
                "success": False,
                "error": "Garmin is temporarily rate limiting requests. Please retry later.",
                "errorCode": "GARMIN_RATE_LIMITED",
                "retryAfterSeconds": max(60, min(3600, retry_after)),
            }
    return {"success": False, "error": message}


def _fetch_wellness(client, day_str):
    from garth.data import DailySummary
    return _model_attributes(DailySummary.get(client, day_str))


def _build_wellness(summary_data):
    if not summary_data:
        return None
    return {
        "resting_heart_rate": _safe_int(summary_data.get("restingHeartRate") or summary_data.get("resting_heart_rate")),
        "avg_stress_level": _safe_int(summary_data.get("averageStressLevel") or summary_data.get("avg_stress_level")),
        "max_stress_level": _safe_int(summary_data.get("maxStressLevel") or summary_data.get("max_stress_level")),
        "stress_qualifier": summary_data.get("stressQualifier") or summary_data.get("stress_qualifier"),
        "total_steps": _safe_int(summary_data.get("totalSteps") or summary_data.get("total_steps")),
        "total_distance_meters": _safe_float(summary_data.get("totalDistanceMeters") or summary_data.get("total_distance_meters")),
        "active_kilocalories": _safe_int(summary_data.get("activeKilocalories") or summary_data.get("active_kilocalories")),
        "sedentary_seconds": _safe_int(summary_data.get("sedentarySeconds") or summary_data.get("sedentary_seconds")),
        "body_battery_highest": _safe_int(summary_data.get("bodyBatteryHighest") or summary_data.get("highest_body_battery_value")),
        "body_battery_lowest": _safe_int(summary_data.get("bodyBatteryLowest") or summary_data.get("lowest_body_battery_value")),
        "body_battery_at_wake": _safe_int(summary_data.get("bodyBatteryAtWake") or summary_data.get("body_battery_at_wake")),
        "moderate_intensity_minutes": _safe_int(summary_data.get("moderateIntensityMinutes") or summary_data.get("moderate_intensity_minutes")),
        "vigorous_intensity_minutes": _safe_int(summary_data.get("vigorousIntensityMinutes") or summary_data.get("vigorous_intensity_minutes")),
        "average_spo2": _safe_float(summary_data.get("averageSpO2") or summary_data.get("average_spo2")),
        "lowest_spo2": _safe_int(summary_data.get("lowestSpO2") or summary_data.get("lowest_spo2")),
        "floors_ascended": _safe_int(summary_data.get("floorsAscended") or summary_data.get("floors_ascended")),
        "floors_descended": _safe_int(summary_data.get("floorsDescended") or summary_data.get("floors_descended")),
    }


def _fetch_sleep(client, day_str):
    from garth.data import SleepData
    return _model_attributes(SleepData.get(client, day_str))


def _build_sleep(sleep_data):
    if not sleep_data:
        return None
    return {
        "sleep_time_seconds": _safe_int(sleep_data.get("sleepTimeSeconds") or sleep_data.get("sleep_time_seconds")),
        "deep_sleep_seconds": _safe_int(sleep_data.get("deepSleepSeconds") or sleep_data.get("deep_sleep_seconds")),
        "light_sleep_seconds": _safe_int(sleep_data.get("lightSleepSeconds") or sleep_data.get("light_sleep_seconds")),
        "rem_sleep_seconds": _safe_int(sleep_data.get("remSleepSeconds") or sleep_data.get("rem_sleep_seconds")),
        "awake_sleep_seconds": _safe_int(sleep_data.get("awakeSleepSeconds") or sleep_data.get("awake_sleep_seconds")),
        "sleep_score": _safe_int(sleep_data.get("sleepScore") or sleep_data.get("overall_sleep_score")),
        "awake_count": _safe_int(sleep_data.get("awakeCount") or sleep_data.get("awake_count")),
        "average_spo2": _safe_float(sleep_data.get("averageSpO2") or sleep_data.get("average_spo2")),
        "lowest_spo2": _safe_int(sleep_data.get("lowestSpO2") or sleep_data.get("lowest_spo2")),
        "highest_spo2": _safe_int(sleep_data.get("highestSpO2") or sleep_data.get("highest_spo2")),
        "average_respiration": _safe_float(sleep_data.get("averageRespiration") or sleep_data.get("average_respiration")),
        "avg_sleep_stress": _safe_int(sleep_data.get("avgSleepStress") or sleep_data.get("avg_sleep_stress")),
    }


def _fetch_hrv(client, day_str):
    from garth.data import HRVData
    return _model_attributes(HRVData.get(client, day_str))


def _build_hrv(hrv_data):
    if not hrv_data:
        return None
    return {
        "last_night_avg": _safe_float(hrv_data.get("lastNightAvg") or hrv_data.get("last_night_avg") or hrv_data.get("hrvLastNightAvg")),
        "last_night_5_min_high": _safe_float(hrv_data.get("lastNight5MinHigh") or hrv_data.get("last_night_5_min_high") or hrv_data.get("hrvLastNight5MinHigh")),
        "weekly_avg": _safe_float(hrv_data.get("weeklyAvg") or hrv_data.get("weekly_avg") or hrv_data.get("hrvWeeklyAvg")),
        "baseline_low_upper": _safe_float(hrv_data.get("baselineLowUpper") or hrv_data.get("baseline_low_upper")),
        "baseline_balanced_low": _safe_float(hrv_data.get("baselineBalancedLow") or hrv_data.get("baseline_balanced_low")),
        "baseline_balanced_upper": _safe_float(hrv_data.get("baselineBalancedUpper") or hrv_data.get("baseline_balanced_upper")),
        "status": hrv_data.get("status") or hrv_data.get("hrvStatus"),
        "feedback_phrase": hrv_data.get("feedbackPhrase") or hrv_data.get("feedback_phrase"),
    }


def _fetch_stress(client, day_str):
    from garth.stats import DailyStress
    return _model_attributes(DailyStress.get(client, day_str))


def _build_stress(stress_data):
    if not stress_data:
        return None
    return {
        "overall_stress_level": _safe_int(stress_data.get("overallStressLevel") or stress_data.get("avg_stress") or stress_data.get("overall_stress_level")),
        "rest_stress_duration": _safe_int(stress_data.get("restStressDuration") or stress_data.get("rest_stress_duration")),
        "low_stress_duration": _safe_int(stress_data.get("lowStressDuration") or stress_data.get("low_stress_duration")),
        "medium_stress_duration": _safe_int(stress_data.get("mediumStressDuration") or stress_data.get("medium_stress_duration")),
        "high_stress_duration": _safe_int(stress_data.get("highStressDuration") or stress_data.get("high_stress_duration")),
    }


def _fetch_body(client, day_str):
    from garth.data import WeightData
    weights = WeightData.list(client, day_str)
    if not weights:
        return None
    entry = weights[0] if isinstance(weights, list) else weights
    return _model_attributes(entry)


def _build_body(body_data):
    if not body_data:
        return None
    return {
        "weight": _safe_float(body_data.get("weight") or body_data.get("bodyWeight")),
        "bmi": _safe_float(body_data.get("bmi") or body_data.get("bodyMassIndex")),
        "body_fat": _safe_float(body_data.get("bodyFat") or body_data.get("body_fat") or body_data.get("fat_percent")),
        "body_water": _safe_float(body_data.get("bodyWater") or body_data.get("body_water") or body_data.get("water_percent")),
        "bone_mass": _safe_float(body_data.get("boneMass") or body_data.get("bone_mass")),
        "muscle_mass": _safe_float(body_data.get("muscleMass") or body_data.get("muscle_mass")),
        "visceral_fat": _safe_int(body_data.get("visceralFat") or body_data.get("visceral_fat")),
        "metabolic_age": _safe_int(body_data.get("metabolicAge") or body_data.get("metabolic_age")),
        "physique_rating": _safe_int(body_data.get("physiqueRating") or body_data.get("physique_rating")),
    }


def main():
    config = json.load(sys.stdin)
    email = config["email"]
    password = config["password"]
    start_date_str = config["start_date"]
    end_date_str = config["end_date"]

    try:
        import garth
    except ImportError:
        json.dump(
            {"success": False, "error": "garth is not installed. Run: pip install garth"},
            sys.stdout,
        )
        return

    try:
        garth.login(email, password)
    except Exception as exc:
        json.dump(_failure_result(exc, "Garmin login failed."), sys.stdout)
        return

    start = date.fromisoformat(start_date_str)
    end = date.fromisoformat(end_date_str)
    client = garth.client

    days = []
    try:
        for d in _date_range(start, end):
            day_str = d.isoformat()

            summary_data = _fetch_wellness(client, day_str)
            sleep_data = _fetch_sleep(client, day_str)
            hrv_data = _fetch_hrv(client, day_str)
            stress_data = _fetch_stress(client, day_str)
            body_data = _fetch_body(client, day_str)

            has_any = any(v is not None for v in [summary_data, sleep_data, hrv_data, stress_data, body_data])
            if not has_any:
                continue

            days.append({
                "date": day_str,
                "wellness": _build_wellness(summary_data),
                "sleep": _build_sleep(sleep_data),
                "hrv": _build_hrv(hrv_data),
                "stress": _build_stress(stress_data),
                "body": _build_body(body_data),
            })
    except Exception as exc:
        json.dump(_failure_result(exc, "Garmin wellness download failed."), sys.stdout)
        return

    result = {
        "success": True,
        "days_fetched": len(days),
        "days": days,
    }

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
