from flask import Flask, request, jsonify
from flask_cors import CORS
import math

app = Flask(__name__)
CORS(app) # Allows your HTML frontend to talk to this Python server

def calculate_vdot(distance_meters, time_minutes):
    """Daniels VDOT formula - estimates VO2max equivalent from race performance"""
    velocity = distance_meters / time_minutes

    # VO2 cost of running at that velocity
    vo2 = -4.60 + 0.182258 * velocity + 0.000104 * (velocity ** 2)

    # Fraction of VO2max sustainable for the race duration
    percent_max = 0.8 + 0.1894393 * math.exp(-0.012778 * time_minutes) + 0.2989558 * math.exp(-0.1932605 * time_minutes)

    vdot = vo2 / percent_max
    return vdot


def mins_to_pace_str(pace_decimal):
    """Convert decimal minutes per km to MM:SS string"""
    mins = int(pace_decimal)
    secs = round((pace_decimal - mins) * 60)
    if secs == 60:
        mins += 1
        secs = 0
    return f"{mins}:{secs:02d}"


# ---------------------------------------------------------------------------
# Daniels VDOT Training Pace Lookup Table
# Source: Jack Daniels' "Running Formula", 3rd Edition, Table A.1
# Paces are in decimal minutes per km; rep_400 is seconds per 400 m.
# Using the actual published table eliminates the error introduced by
# applying fixed %-of-VO2max fractions (which vary with VDOT level).
# ---------------------------------------------------------------------------
DANIELS_TABLE = {
    #       easy (slow, fast)        M       T       I     R(s/400m)
    30: {"easy": (9.117, 8.133), "marathon": 7.050, "threshold": 6.550, "interval": 6.133, "rep_400": 144},
    35: {"easy": (7.867, 7.033), "marathon": 6.083, "threshold": 5.667, "interval": 5.300, "rep_400": 124},
    40: {"easy": (7.217, 6.467), "marathon": 5.633, "threshold": 5.250, "interval": 4.900, "rep_400": 112},
    45: {"easy": (6.633, 5.933), "marathon": 5.183, "threshold": 4.833, "interval": 4.517, "rep_400": 104},
    50: {"easy": (6.250, 5.533), "marathon": 4.850, "threshold": 4.550, "interval": 4.283, "rep_400":  96},
    55: {"easy": (5.850, 5.217), "marathon": 4.600, "threshold": 4.333, "interval": 4.050, "rep_400":  90},
    60: {"easy": (5.550, 4.967), "marathon": 4.317, "threshold": 4.033, "interval": 3.783, "rep_400":  84},
    65: {"easy": (5.300, 4.733), "marathon": 4.117, "threshold": 3.867, "interval": 3.633, "rep_400":  80},
    70: {"easy": (5.083, 4.550), "marathon": 3.933, "threshold": 3.700, "interval": 3.483, "rep_400":  76},
    75: {"easy": (4.900, 4.383), "marathon": 3.750, "threshold": 3.550, "interval": 3.333, "rep_400":  72},
    80: {"easy": (4.733, 4.233), "marathon": 3.583, "threshold": 3.400, "interval": 3.200, "rep_400":  68},
}


def interpolate_paces(vdot):
    """Linear interpolation of training paces from the Daniels table."""
    keys = sorted(DANIELS_TABLE.keys())

    # Clamp to table bounds
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
        "easy":      (lerp(lo["easy"][0], hi["easy"][0]), lerp(lo["easy"][1], hi["easy"][1])),
        "marathon":  lerp(lo["marathon"],  hi["marathon"]),
        "threshold": lerp(lo["threshold"], hi["threshold"]),
        "interval":  lerp(lo["interval"],  hi["interval"]),
        "rep_400":   lerp(lo["rep_400"],   hi["rep_400"]),
    }


@app.route('/api/analyze-vdot', methods=['POST'])
def analyze_vdot():
    data = request.json
    distance_km = float(data.get('distance_km', 5.0))
    time_str = data.get('time', '20:00')

    # Parse MM:SS to total minutes
    time_parts = time_str.split(':')
    time_minutes = int(time_parts[0]) + (int(time_parts[1]) / 60)
    distance_meters = distance_km * 1000

    vdot = calculate_vdot(distance_meters, time_minutes)
    paces = interpolate_paces(vdot)

    # Convert R pace from sec/400m → min/km
    rep_km = paces["rep_400"] * (1000 / 400) / 60

    result = {
        "vdot_score":  round(vdot, 1),
        "easy":        f"{mins_to_pace_str(paces['easy'][0])} - {mins_to_pace_str(paces['easy'][1])}",
        "marathon":    mins_to_pace_str(paces["marathon"]),
        "threshold":   mins_to_pace_str(paces["threshold"]),
        "interval":    mins_to_pace_str(paces["interval"]),
        "repetition":  mins_to_pace_str(rep_km),
    }

    return jsonify(result)


if __name__ == '__main__':
    # Running on port 5000 so it doesn't clash with Spring Boot on 8080
    app.run(port=5000, debug=True)
