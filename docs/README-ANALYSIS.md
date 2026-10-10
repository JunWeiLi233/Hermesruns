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

## Pace Analysis and Grade-Adjusted Pace

The run page's pace card draws pace along the run as kilometre splits or as a smoothed line, with the elevation behind
it, an optional grade-adjusted pace, the fastest and slowest splits, and the time spent at each pace zone. The server
works the splits, the smoothed line and the grade adjustment out of the run's stored stream on every request to
`GET /api/activities/{id}/pace-profile`. Nothing is stored, so a recalibrated elevation shows up on the next view. The
pace zones are worked out in the browser.

### The stream and moving time

The stream is tidied first: a reading with no time or distance is dropped, so is one that goes back in time or distance,
and two readings in the same second become one. Time and distance are counted from the first reading. Only readings that
say when they were recorded are used: the other analytics spread a time evenly along the distance for readings without
one, which would draw an even pace the runner never ran, so a run where fewer than half of the readings carry a time
(a GPX file of a route) has no pace profile. A run needs at least 100 m and 10 s of stream to have a profile, which also
means every profile has at least one split.

Between two readings the runner counts as **moving** when they covered 0.5 m/s or more. Every pace on the card is
moving seconds divided by the metres run in those stretches, so time standing at a crossing, or paused on the watch, is
left out of every pace, and so are the few metres a watch drifts while standing still. The time is shown as "standing
still". The splits table lower on the page divides elapsed seconds, so the two differ for a run with stops.

### Splits

Each full kilometre of the stream is a split. What is left after the last one is a split too if it is at least 100 m, and
is marked partial. A split is cut where the stream's distance crosses the kilometre, and its pace is its moving seconds
divided by the kilometres run inside it. A split has no pace when none of it was run (all of it slower than the
standing-still speed) or when the pace is outside 1:40 to 30:00 per km, the same limits as the smoothed line: a GPS jump,
or a crawl just above 0.5 m/s. A split without a pace is drawn as a gap. The fastest and slowest are chosen among the
full splits that have a pace; there are none to mark when fewer than two of them have one or all of them are the same to
a tenth of a second. Fastest and slowest are chosen separately by pace and by grade-adjusted pace, so they can differ.

### The smoothed line

The line is sampled at an even step along the run's time: the run's length divided by 600, rounded up to a multiple of
5 s, and never less than 5 s, so a run has about 600 samples however long it is. A sample's pace is the moving seconds
divided by the distance in a window centred on it, `max(30 s, 3 x step)` wide. A window that moved less than 3 m, or
whose pace is outside 1:40 to 30:00 per km (a GPS jump, a stop), has no pace and the line breaks there. Because every
sample stands for one step of time, the time at a pace zone is the number of samples in it times the step.

### Grade

Elevation is the corrected elevation if the run has one, else the raw elevation, else the stored value. A run has
usable elevation when at least 10 readings, covering at least 80% of the stream and 200 m of distance, are there;
otherwise there is no grade-adjusted pace at all (the card says so), not a guess. Elevation is cleaned before it is
used: each reading becomes the median of the five around it, then the average of those within 20 m of it along the
run. The grade at a point is the rise over the 80 m around it (40 m each way), as a fraction, and a grade beyond +/-30%
counts as 30%. This keeps GPS altitude that wanders by a couple of metres from reading as hills.

### Grade-adjusted pace

The energy cost of running one metre at a slope, from Minetti et al. (2002), who measured it on a treadmill from -45% to
+45%, in J per kg per metre with the slope `s` as a fraction:

```
cost(s) = 155.4 s^5 - 30.4 s^4 - 43.3 s^3 + 46.3 s^2 + 19.5 s + 3.6
ratio   = cost(s) / 3.6                         (3.6 is the cost on the flat)
descent: ratio = 1 - 0.5 x (1 - ratio)          (only for s < 0 where the ratio is below 1)
```

The ratio says how many times dearer a metre is on that slope than on the flat. Each stretch between two readings is
worth `ratio x its length` in flat-equivalent metres, and the grade-adjusted pace of a split, a window or the whole run
is its moving seconds divided by its flat-equivalent kilometres. The same effort on a 5% climb is therefore worth
a faster flat pace than the pace run:

| grade | ratio | 5:00 per km run on it is worth |
|---|---|---|
| +10% | 1.66 | 3:01 |
| +5% | 1.30 | 3:51 |
| 0 | 1.00 | 5:00 |
| -5% | 0.88 | 5:40 |
| -10% | 0.80 | 6:16 |
| -20% | 0.75 | 6:40 |

Two choices are Hermes' own, not Minetti's. A grade beyond 30% counts as 30%. And on a descent only half of the saving
Minetti measured is counted: his runners held a steady effort on a treadmill, while a runner on a road or a trail brakes
and takes the impact on the way down. With his full figure a 5:00 per km run down a 10% hill would be worth 8:21 on the
flat. These figures will not match Strava's, whose model is its own fit to heart-rate data. The card says so.

### Pace zones

The browser works the pace zones out the way the Analysis page works out the training paces. The VDOT of the runner's
best recent runs gives the pace at 59%, 75%, 83%, 92% and 105% of VO2max (Daniels' oxygen-cost equation), which
are the edges of six zones: recovery, easy, marathon, threshold, interval and repetition (the table under Daniels'
Training Zones). Time at each zone is counted on pace, or on grade-adjusted pace when that is switched on. The zones are
today's zones, so a run from last year is read against the runner's fitness now. A runner without a VDOT yet (a few
runs of 3 km or more in the last 90 days are needed) sees the chart without zones.

### Known limits

- A GPS jump in the distance stream moves the split boundaries after it, as it inflates the run's distance; the
  smoothed line shows no pace for a window with an impossible one.
- Elevation from a GPS-only watch is noisy. The cleaning above keeps the grade-adjusted pace of a flat run within about 1% of
  its pace when every reading is off by 1.7 m (standard deviation), and within about 2% at 3 m, always on the faster
  side, because a climb is dearer than a descent is cheap. On such a run the figure is an estimate.
- A stream with a reading only every 30 seconds works but is coarse. A treadmill or no-GPS run has no stream.
- A Strava run's stream is fetched when its run page first opens; the pace card waits for that instead of fetching it a
  second time.

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
| **Moving pace** | Moving seconds per kilometre: time spent standing still is left out. Every pace on the run page's pace card is one. |
| **Grade-adjusted pace (GAP)** | The flat pace that would cost about the same energy as the pace run on the slope: faster than the pace run on a climb, slower on a descent. Hermes' own estimate (Minetti 2002, half the descent saving). |

## Related Docs

- [Root README](../README.md) — project entry point
- [Frontend page map](../frontend/src/pages/README.md) and [backend guide](../backend/README.md) — where the analysis pages, controllers and domain utilities live
- [docs/README-DEV.md](../docs/README-DEV.md) — contributor onboarding
