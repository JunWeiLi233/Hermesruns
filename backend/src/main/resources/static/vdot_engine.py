import math
from statistics import median

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except Exception:  # pragma: no cover - optional dependency for local analytics tests
    Flask = None
    request = None

    def jsonify(payload):
        return payload

    def CORS(_app):
        return None


class _DummyApp:
    def route(self, *_args, **_kwargs):
        def decorator(func):
            return func

        return decorator

    def run(self, *_args, **_kwargs):
        raise RuntimeError("Flask is not installed in this environment.")


app = Flask(__name__) if Flask is not None else _DummyApp()
CORS(app)

try:
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    pd = None


def calculate_vdot(distance_meters, time_minutes):
    """Daniels VDOT formula - estimates VO2max equivalent from race performance."""
    velocity = distance_meters / time_minutes
    vo2 = -4.60 + 0.182258 * velocity + 0.000104 * (velocity ** 2)
    percent_max = 0.8 + 0.1894393 * math.exp(-0.012778 * time_minutes) + 0.2989558 * math.exp(-0.1932605 * time_minutes)
    return vo2 / percent_max


def mins_to_pace_str(pace_decimal):
    """Convert decimal minutes per km to MM:SS string."""
    mins = int(pace_decimal)
    secs = round((pace_decimal - mins) * 60)
    if secs == 60:
        mins += 1
        secs = 0
    return f"{mins}:{secs:02d}"


def _is_pandas_frame(frame):
    return pd is not None and isinstance(frame, pd.DataFrame)


def _rows_from_frame(frame):
    if _is_pandas_frame(frame):
        return frame.to_dict("records")
    if isinstance(frame, list):
        return [dict(row) for row in frame]
    raise TypeError("Expected a pandas.DataFrame or list of row dictionaries.")


def _frame_from_rows(original, rows):
    if _is_pandas_frame(original):
        return pd.DataFrame(rows)
    return rows


def _get_value(row, *keys, default=None):
    for key in keys:
        if key in row and row[key] is not None:
            return row[key]
    return default


def _to_float(value, default=None):
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _speed_m_per_min(row):
    direct = _to_float(_get_value(row, "speed_m_per_min", "gap_speed_m_per_min"))
    if direct is not None:
        return direct
    speed_mps = _to_float(_get_value(row, "speed_mps", "speed"))
    if speed_mps is not None:
        return speed_mps * 60.0
    distance_delta = _to_float(_get_value(row, "distance_delta_m", "distance_m"))
    time_delta = _to_float(_get_value(row, "time_delta_s", "elapsed_s", "duration_s"))
    if distance_delta is not None and time_delta not in (None, 0):
        return distance_delta / time_delta * 60.0
    return None


def _grade_ratio(row):
    explicit_grade = _to_float(_get_value(row, "grade", "grade_ratio"))
    if explicit_grade is not None:
        return max(-0.45, min(0.45, explicit_grade))
    elevation_delta = _to_float(_get_value(row, "elevation_delta_m", "elevation_change_m", "elevation_gain_m"), 0.0)
    distance_delta = _to_float(_get_value(row, "distance_delta_m", "distance_m"))
    if distance_delta in (None, 0):
        return 0.0
    return max(-0.45, min(0.45, elevation_delta / distance_delta))


def _running_cost(grade_ratio):
    """Minetti-style energy cost curve for running on a grade."""
    g = max(-0.45, min(0.45, grade_ratio))
    return (
        155.4 * (g ** 5)
        - 30.4 * (g ** 4)
        - 43.3 * (g ** 3)
        + 46.3 * (g ** 2)
        + 19.5 * g
        + 3.6
    )


def clean_and_calculate_gap(frame, max_speed_mps=8.5):
    """
    Drop zero/anomalous speed rows and append a gap_speed field.

    Accepted row keys:
    - speed_mps or speed_m_per_min
    - grade / grade_ratio or elevation_delta_m + distance_delta_m
    """
    cleaned_rows = []
    flat_cost = _running_cost(0.0)
    for row in _rows_from_frame(frame):
        speed_m_per_min = _speed_m_per_min(row)
        if speed_m_per_min is None:
            continue
        speed_mps = speed_m_per_min / 60.0
        if speed_mps <= 0 or speed_mps > max_speed_mps:
            continue

        grade_ratio = _grade_ratio(row)
        cost = _running_cost(grade_ratio)
        gap_speed = speed_m_per_min * (flat_cost / cost) if cost > 0 else speed_m_per_min

        updated = dict(row)
        updated["speed_m_per_min"] = speed_m_per_min
        updated["gap_speed"] = gap_speed
        updated["gap_speed_m_per_min"] = gap_speed
        updated["grade_ratio"] = grade_ratio
        cleaned_rows.append(updated)
    return _frame_from_rows(frame, cleaned_rows)


def _resolve_time_seconds(row, fallback_index):
    return _to_float(_get_value(row, "timestamp_s", "elapsed_s", "time_s"), fallback_index)


def extract_steady_state_segments(
    frame,
    max_hr,
    min_duration_minutes=10,
    max_duration_minutes=30,
    max_hr_fraction=0.85,
    max_hr_variance=0.05,
):
    """
    Return the longest steady-state aerobic window.

    A steady-state window:
    - lasts between 10 and 30 minutes
    - every HR sample is below 85% of HR max
    - coefficient of variation for HR is <= 5%
    """
    rows = [dict(row) for row in _rows_from_frame(frame)]
    if not rows:
        return _frame_from_rows(frame, [])

    threshold = max_hr * max_hr_fraction
    with_time = []
    for idx, row in enumerate(rows):
        hr = _to_float(_get_value(row, "heart_rate", "hr"))
        time_s = _resolve_time_seconds(row, idx)
        if hr is None or time_s is None:
            continue
        enriched = dict(row)
        enriched["heart_rate"] = hr
        enriched["_time_s"] = time_s
        if hr < threshold:
            with_time.append(enriched)

    if not with_time:
        return _frame_from_rows(frame, [])

    diffs = []
    for prev, cur in zip(with_time, with_time[1:]):
        diffs.append(max(1.0, cur["_time_s"] - prev["_time_s"]))
    max_gap = median(diffs) * 2.5 if diffs else 90.0

    segments = []
    current = [with_time[0]]
    for prev, cur in zip(with_time, with_time[1:]):
        if (cur["_time_s"] - prev["_time_s"]) <= max_gap:
            current.append(cur)
        else:
            segments.append(current)
            current = [cur]
    segments.append(current)

    min_seconds = min_duration_minutes * 60
    max_seconds = max_duration_minutes * 60
    best = []
    best_duration = 0.0

    for segment in segments:
        start = 0
        for end in range(len(segment)):
            while segment[end]["_time_s"] - segment[start]["_time_s"] > max_seconds and start < end:
                start += 1
            duration = segment[end]["_time_s"] - segment[start]["_time_s"]
            if duration < min_seconds:
                continue
            window = segment[start:end + 1]
            hrs = [row["heart_rate"] for row in window]
            mean_hr = sum(hrs) / len(hrs)
            variance = sum((hr - mean_hr) ** 2 for hr in hrs) / len(hrs)
            coeff_var = (math.sqrt(variance) / mean_hr) if mean_hr else float("inf")
            if coeff_var <= max_hr_variance and duration > best_duration:
                best = window
                best_duration = duration

    for row in best:
        row.pop("_time_s", None)
    return _frame_from_rows(frame, best)


def estimate_vo2max_from_hrr_regression(frame, resting_hr, max_hr):
    """
    Fit a linear regression between %HR reserve and GAP speed.

    GAP speed should be in meters per minute. The extrapolated speed at 100% HRR
    is converted into a Daniels-style VO2 estimate.
    """
    rows = _rows_from_frame(frame)
    samples = []
    hr_denominator = max_hr - resting_hr
    if hr_denominator <= 0:
        raise ValueError("max_hr must be greater than resting_hr.")

    for row in rows:
        hr = _to_float(_get_value(row, "heart_rate", "hr"))
        gap_speed = _to_float(_get_value(row, "gap_speed", "gap_speed_m_per_min", "speed_m_per_min"))
        if hr is None or gap_speed is None:
            continue
        hrr_fraction = (hr - resting_hr) / hr_denominator
        if 0 < hrr_fraction <= 1.0:
            samples.append((hrr_fraction, gap_speed))

    if len(samples) < 2:
        raise ValueError("At least two valid HR reserve samples are required.")

    mean_x = sum(x for x, _ in samples) / len(samples)
    mean_y = sum(y for _, y in samples) / len(samples)
    denominator = sum((x - mean_x) ** 2 for x, _ in samples)
    if denominator == 0:
        raise ValueError("HR reserve samples must vary to fit a regression line.")

    slope = sum((x - mean_x) * (y - mean_y) for x, y in samples) / denominator
    intercept = mean_y - slope * mean_x
    v_vo2max = intercept + slope * 1.0
    vo2max = -4.60 + 0.182258 * v_vo2max + 0.000104 * (v_vo2max ** 2)
    return vo2max


def tag_hrv_fatigue_outlier(vo2max_score, daily_hrv, baseline_hrv, threshold_ratio=0.85):
    daily = _to_float(daily_hrv)
    baseline = _to_float(baseline_hrv)
    if daily is None or baseline in (None, 0):
        return {"vo2max_score": vo2max_score, "fatigue_outlier": False}
    return {
        "vo2max_score": vo2max_score,
        "fatigue_outlier": daily < baseline * threshold_ratio,
    }


# ---------------------------------------------------------------------------
# Daniels VDOT Training Pace Lookup Table
# ---------------------------------------------------------------------------
DANIELS_TABLE = {
    30: {"easy": (9.117, 8.133), "marathon": 7.050, "threshold": 6.550, "interval": 6.133, "rep_400": 144},
    35: {"easy": (7.867, 7.033), "marathon": 6.083, "threshold": 5.667, "interval": 5.300, "rep_400": 124},
    40: {"easy": (7.217, 6.467), "marathon": 5.633, "threshold": 5.250, "interval": 4.900, "rep_400": 112},
    45: {"easy": (6.633, 5.933), "marathon": 5.183, "threshold": 4.833, "interval": 4.517, "rep_400": 104},
    50: {"easy": (6.250, 5.533), "marathon": 4.850, "threshold": 4.550, "interval": 4.283, "rep_400": 96},
    55: {"easy": (5.850, 5.217), "marathon": 4.600, "threshold": 4.333, "interval": 4.050, "rep_400": 90},
    60: {"easy": (5.550, 4.967), "marathon": 4.317, "threshold": 4.033, "interval": 3.783, "rep_400": 84},
    65: {"easy": (5.300, 4.733), "marathon": 4.117, "threshold": 3.867, "interval": 3.633, "rep_400": 80},
    70: {"easy": (5.083, 4.550), "marathon": 3.933, "threshold": 3.700, "interval": 3.483, "rep_400": 76},
    75: {"easy": (4.900, 4.383), "marathon": 3.750, "threshold": 3.550, "interval": 3.333, "rep_400": 72},
    80: {"easy": (4.733, 4.233), "marathon": 3.583, "threshold": 3.400, "interval": 3.200, "rep_400": 68},
}


def interpolate_paces(vdot):
    """Linear interpolation of training paces from the Daniels table."""
    keys = sorted(DANIELS_TABLE.keys())
    if vdot <= keys[0]:
        return DANIELS_TABLE[keys[0]]
    if vdot >= keys[-1]:
        return DANIELS_TABLE[keys[-1]]

    lower_key = max(k for k in keys if k <= vdot)
    upper_key = min(k for k in keys if k >= vdot)
    if lower_key == upper_key:
        return DANIELS_TABLE[lower_key]

    t = (vdot - lower_key) / (upper_key - lower_key)
    lo = DANIELS_TABLE[lower_key]
    hi = DANIELS_TABLE[upper_key]

    def lerp(a, b):
        return a + t * (b - a)

    return {
        "easy": (lerp(lo["easy"][0], hi["easy"][0]), lerp(lo["easy"][1], hi["easy"][1])),
        "marathon": lerp(lo["marathon"], hi["marathon"]),
        "threshold": lerp(lo["threshold"], hi["threshold"]),
        "interval": lerp(lo["interval"], hi["interval"]),
        "rep_400": lerp(lo["rep_400"], hi["rep_400"]),
    }


@app.route('/api/analyze-vdot', methods=['POST'])
def analyze_vdot():
    data = request.json or {}
    distance_km = float(data.get('distance_km', 5.0))
    time_str = data.get('time', '20:00')
    time_parts = time_str.split(':')
    time_minutes = int(time_parts[0]) + (int(time_parts[1]) / 60)
    distance_meters = distance_km * 1000

    vdot = calculate_vdot(distance_meters, time_minutes)
    paces = interpolate_paces(vdot)
    rep_km = paces["rep_400"] * (1000 / 400) / 60

    result = {
        "vdot_score": round(vdot, 1),
        "easy": f"{mins_to_pace_str(paces['easy'][0])} - {mins_to_pace_str(paces['easy'][1])}",
        "marathon": mins_to_pace_str(paces["marathon"]),
        "threshold": mins_to_pace_str(paces["threshold"]),
        "interval": mins_to_pace_str(paces["interval"]),
        "repetition": mins_to_pace_str(rep_km),
    }

    return jsonify(result)


if __name__ == '__main__':
    app.run(port=5000, debug=True)
