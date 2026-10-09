# Analysis — How It Works (README-ANALYSIS)

The scientific backbone of every coaching recommendation. All formulas come from Jack Daniels' *Running Formula* and peer-reviewed sports science. Hermes shows its work — every number has a traceable basis.

## VDOT (Daniels' VO₂max Estimate)

VDOT is a single number that captures your current aerobic fitness, derived from a recent race performance. A higher VDOT means faster paces. Hermes uses it to compute all training zones.

From a race performance (distance in meters, time in minutes):

```
velocity     = distance / time                              (m/min)
VO₂          = -4.60 + 0.182258 × v + 0.000104 × v²        (ml/kg/min)
%VO₂max      = 0.8 + 0.1894393 × e^(-0.012778 × t) + 0.2989558 × e^(-0.1932605 × t)
VDOT         = VO₂ / %VO₂max
```

**Current VDOT**: Uses performances from the last **90 days**, prefers distances ≥3 km, takes the **mean of the top three** VDOT values.

## Training Paces (from VDOT)

| Zone | %VO₂max | Purpose |
|---|---|---|
| Easy | 54–62% | Aerobic base, recovery |
| Marathon | 78% | Race-specific endurance |
| Threshold | 85% | Lactate clearance |
| Interval | 96% | VO₂max stimulus |
| Repetition | 111% | Speed and economy |

## Training Load — ACWR

ACWR (Acute:Chronic Workload Ratio) is your injury risk meter. It compares your recent training load (last 7 days) to your long-term load (last 28 days). A sudden spike — training much harder than your baseline — predicts injury.

EWMA-based injury risk tracking (Gabbett 2016, Hulin et al. 2014, Williams et al. 2017):

```
Acute  λ = 2/(7+1) = 0.25   (7-day)
Chronic λ = 2/(28+1) = 0.069 (28-day)
ACWR = Acute EWMA / Chronic EWMA
```

| ACWR | Zone | Meaning |
|---|---|---|
| < 0.80 | Under-training | Not enough stimulus |
| 0.80–1.30 | Sweet spot | Optimal loading |
| 1.30–1.50 | Warning | Elevated injury risk |
| > 1.50 | Danger | Reduce load |

## Effort Score

```
intensityRatio = vo₂Fraction / 0.85
effortScore    = duration_hours × intensityRatio² × 100
```

`vo₂Fraction` derived from heart rate or pace. Threshold runs score ~100/hour.

## Run Effort and Heart-Rate Zones

The run page shows an **Effort** score and the time spent in each of five heart-rate zones. This is a different
measure from the Effort Score above: that one feeds the Load balance charts, this one weighs time in zones, and the
two are on different scales and are not comparable. Neither changes the other.

Both numbers are worked out once per run and stored, and worked out again when anything they depend on changes: the
run's heart-rate stream arrives (a Strava run is saved before its stream is fetched), the runner rates the run, the
zones change, the runner's time zone moves the run to another day, or the model version is raised. Each stored row keeps
the zones it was computed with, so a run is always shown with the zone edges its numbers belong to.

### Zones

```
max heart rate = the runner's saved value (120–230 bpm), otherwise 190
boundary_i     = round(max heart rate × percentage_i)      percentages 60 / 70 / 80 / 90
```

A boundary is the first bpm of the next zone: zone 1 is below boundary 1, zone 2 starts at boundary 1, and zone 5 starts
at boundary 4. For a max heart rate of 190 the zones are < 114, 114–132, 133–151, 152–170 and 171+. The runner can
instead set their own four boundaries (40–230 bpm, each higher than the one before); those do not depend on the max
heart rate. The percentages are configuration (`app.training.hr-zone-percentages`).

Nothing is guessed behind the runner's back. When at least 20 runs in the last year have a recorded peak heart rate, the
screen *suggests* the 95th percentile of those peaks (nearest rank, ignoring peaks outside 140–230 bpm) as a max heart
rate, and it takes effect only if the runner accepts it.

### Time in zone

Each heart-rate sample stands for the time until the next sample, at most 30 seconds, so a pause (a watch left
recording, a hole in a file) does not count as time in a zone. A sample outside 30–230 bpm is a sensor error and counts
for nothing. The last sample stands for as long as the one before it.

### Effort

```
weighted minutes = Σ over zones z of  minutes spent in zone z × z          (zone weights 1 to 5)
```

Minutes at less than half of max heart rate count as 0 (standing, walking). The score comes from the best evidence
there is, and is recorded as its *source* so the number can be explained:

| Source | Used when | Score |
|---|---|---|
| `HR_ZONES` | the heart-rate samples cover at least half of the moving time (and at least 60 s) | weighted minutes ÷ coverage, so a strap that dropped out is scaled up to the whole run |
| `PERCEIVED` | no usable stream, and the runner rated the run 1–10 | moving minutes × (1 + (rating − 1) × 4/9), a weight from 1 to 5 |
| `HR_AVERAGE` | only the run's average heart rate is known (it is at least half of max heart rate) | moving minutes × the weight of the zone the average falls in |
| `PACE_MODEL` | none of the above | the pace model the coach uses (`TrainingLoadAnalyzer.loadUnits`) |
| `PACE_CALIBRATED` | as `PACE_MODEL`, once at least 10 runs have both a heart-rate score and a pace score | the pace score × the least-squares fit of heart-rate score on pace score through the origin, kept between 0.5 and 10 |

One hour in the middle of zone 3 scores 180. The unit is arbitrary, as for any training-load number, and the weights are
the published Edwards TRIMP scheme; the rating mapping and the calibration are Hermes' own conventions. The rating, the
pace score and the heart-rate score are all kept on the row, so a run's number can always be explained.

### The runner's day

A run belongs to a calendar day in the runner's own time zone. A run fetched from the Strava API already holds the
runner's local clock time; a run from a file holds UTC and is converted with the time zone in Settings (UTC when none is
set). Reading a UTC time as local would put an evening run in New York on the next day.

## Recovery Estimation

```
durationFactor  = (duration > 90 min) ? 1 + 0.005 × (duration - 90) : 1.0
adjustedScore   = effortScore × durationFactor
baseHours       = 0.45 × adjustedScore^0.85
fitnessDiscount = max(0.80, 1.10 - VDOT / 200)
recoveryHours   = min(96, baseHours × fitnessDiscount)
```

Fitter runner (higher VDOT) → faster recovery. Long runs (>90 min) add penalty. Cap: 96 hours.

## Daniels' Training Zones

| Zone | VO₂ Fraction | Label |
|---|---|---|
| Recovery | < 59% | Easy recovery jog |
| Easy | 59–75% | Aerobic base |
| Marathon | 75–83% | Marathon pace |
| Threshold | 83–92% | Tempo / lactate threshold |
| Interval | 92–105% | VO₂max intervals |
| Repetition | > 105% | Sprint / economy |

## Glossary (analysis terms)

| Term | What it means |
|---|---|
| **VDOT** | A single number representing your aerobic fitness, derived from a race performance (Jack Daniels' formula). Used to compute all training zone paces. |
| **ACWR** | Acute:Chronic Workload Ratio. Compares recent load (7 days) to baseline load (28 days). Values above 1.5 signal elevated injury risk. |
| **EWMA** | Exponentially Weighted Moving Average. A smoothing formula that gives more weight to recent data — used to compute ACWR. |
| **Effort Score** | Hermes' measure of how hard a run was. Combines duration and intensity (VO₂ fraction). A threshold run scores ~100/hour. |
| **Effort** (run page) | Time in heart-rate zones weighted 1 to 5 (or the rating or pace estimate when there is no heart rate). A different scale from the Effort Score above. |
| **Heart-rate zone** | One of five bands of heart rate set from the max heart rate or by the runner. |

## Related Docs

- [Root README](../README.md) — project entry point
- [Frontend page map](../frontend/src/pages/README.md) and [backend guide](../backend/README.md) — where the analysis pages, controllers and domain utilities live
- [docs/README-DEV.md](../docs/README-DEV.md) — contributor onboarding
