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
means every profile has at least one split. When there is no profile the answer says why in `reason`, and the card
says it in words: `no_points` (no readings with a time and a distance, such as a run entered by hand), `no_times` (the
positions are there but fewer than half say when, such as a planned route) or `too_short` (under 100 m or 10 s).

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
run. The grade at a point is the rise over the 80 m around it (40 m each way), as a fraction; a climb beyond 30% counts
as 30% and a descent beyond 20% as 20%. This keeps GPS altitude that wanders by a couple of metres from reading as
hills.

### Grade-adjusted pace

The flat pace that is worth the same effort as the pace run on a slope. Strava does not publish its formula. Its model
is described as a fit to the pace runners held at the same heart rate on different grades, from the data of hundreds of
thousands of athletes (Strava's 2017 engineering post, "An Improved GAP Model", as summarised at
[pickletech.eu](https://pickletech.eu/blog-gap/); the post itself could not be read when this was written). Hermes uses a
quadratic that approximates how that model behaves, with the slope `s` as a fraction:

```
ratio(s) = 1 + 2.896 s + 15.14 s^2      (a climb beyond 30% counts as 30%, a descent beyond 20% as 20%)
```

The quadratic is the rough fit published by [Fellrnr](https://fellrnr.com/wiki/Grade_Adjusted_Pace). It agrees with
what is public about Strava's numbers, and `GradeAdjustedPaceTests` holds it to each of these:

| what is public | where | the quadratic |
|---|---|---|
| the downhill adjustment peaks around -10% | [Strava's help centre](https://support.strava.com/en-us/articles/15402117-grade-adjusted-pace-gap) | easiest at -9.6%, where a metre is worth 0.86 of a flat one |
| the adjusted pace is no longer slower than the pace run on a descent of about -18% | [an analysis of a Strava data export](https://aaron-schroeder.github.io/reverse-engineering/grade-adjusted-pace.html) | crosses 1 at -19.1% |
| the pace that matches 3:30 per km on the flat is 5:08 per km on a 10% climb | Strava's 2017 post, as quoted at [pickletech.eu](https://pickletech.eu/blog-gap/) | 5:03 |

The ratio says how many flat metres of effort one metre at that slope is worth. Each stretch between two readings counts
`ratio x its length` in flat-equivalent metres, and the grade-adjusted pace of a split, a window or the whole run is its
moving seconds divided by its flat-equivalent kilometres. A 5:00 per km run is worth this on the flat:

| grade | ratio | worth |
|---|---|---|
| +20% | 2.18 | 2:17 |
| +10% | 1.44 | 3:28 |
| +5% | 1.18 | 4:14 |
| 0 | 1.00 | 5:00 |
| -5% | 0.89 | 5:36 |
| -10% | 0.86 | 5:48 |
| -15% | 0.91 | 5:31 |
| -20% and steeper | 1.03 | 4:52 |

The numbers will be close to Strava's, not the same. Strava's model is also reported to adjust a fast runner's climbs
more than a slow runner's, and this one does not depend on pace, so for a slower runner it reads a little fast on a
climb. Strava takes elevation from its own terrain data; Hermes uses the run's own elevation (the corrected one after
"Recalibrate"). The quadratic is a third party's fit, not Strava's formula. The card says all of this in a line.

The first version of M2 used the energy cost of running from Minetti et al. (2002), measured on a treadmill, with half of
the descent saving counted. It made a 10% climb 1.66 times a flat metre, against 1.47 in Strava's own example (5:08 per
km for 3:30 on the flat), and a steep descent worth far more than anyone runs, so it was replaced.

### Pace zones

The browser works the pace zones out the way the Analysis page works out the training paces. The VDOT of the runner's
best recent runs gives the pace at 59%, 75%, 83%, 92% and 105% of VO2max (Daniels' oxygen-cost equation), which
are the edges of six zones: recovery, easy, marathon, threshold, interval and repetition (the table under Daniels'
Training Zones). Time at each zone is counted on pace, or on grade-adjusted pace when that is switched on. The zones
are the ones the runner had going into the run: the VDOT comes from their best runs in the 90 days before it, and the run
itself is left out, so a personal best does not pull its own pace into a harder zone. A run with nothing to go on before
it (the first of a history, or after a break of more than 90 days) is read against today's zones instead, and the card
says which it used. A runner without any VDOT (runs of at least 1.5 km are needed, and 3 km or more are preferred) sees
the chart without zones.

### Known limits

- A GPS jump in the distance stream moves the split boundaries after it, as it inflates the run's distance; the
  smoothed line shows no pace for a window with an impossible one.
- Elevation from a GPS-only watch is noisy. The cleaning above keeps the grade-adjusted pace of a flat run within 0.2% of
  its pace when every reading is off by 1.7 m (standard deviation), within 0.5% at 3 m and within 1.3% at 5 m (measured
  over twelve random runs of 30 minutes each), always on the faster side, because the ratio bends upwards: random ups
  and downs net out to a slightly faster pace.
- Where only some readings carry a distance of their own, the others get theirs from the GPS positions, and the stretch
  is scaled to fit between the distances the watch gave on either side of it (`ActivityAnalyticsHelper.normalizeSamples`).
  Before, hops that added up to more than the watch measured left the later readings behind the earlier ones, and the
  later ones were dropped.
- A stream with a reading only every 30 seconds works but is coarse. A treadmill or no-GPS run has no stream.
- A Strava run's stream is fetched when its run page first opens; the pace card waits for that instead of fetching it a
  second time.

## Best Efforts and Same-Route Runs

Every run page lists the fastest stretch the run holds of each standard distance, with its place among the runner's
whole history (**PR**, 2nd, 3rd, and so on), and the runs over the same route with the pace of each. The Profile page has
a best-efforts analysis: the three best ever at a distance, the ten best of a year, and how the best time moved from year
to year. The server works the efforts and the route out once for a run, in the background, and keeps them in
`activity_best_effort` and `route_match_group`. The places are not kept: they are read from the other efforts every time,
so they cannot be out of date when a run is added, edited or deleted.

### The distances

400 m, half a mile, 1 km, 1 mile, 3 km, 2 miles, 5 km, 10 km, 15 km, 10 miles, 20 km, the half marathon (21 097.5 m),
30 km, the marathon (42 195 m) and 50 km: Strava's fourteen, and the 3 km Hermes has always had. A run has an effort
at a distance only when its stream is that long. The personal records on the Profile page (1 km, 3 km, 5 km, 10 km, half
and marathon) read the same table, so the two can no longer disagree.

### How a best effort is found

The input is the same tidied stream as the pace profile (see "The stream and moving time" above), so only readings that
say when they were recorded are used, and a run without them has no measured efforts. The runner is taken to move in a
straight line between two readings. Distance is then a piecewise linear function of time, and the time a window of `D`
metres takes when it starts `s` metres into the run, `arrival(s + D) - departure(s)`, is piecewise linear in `s`. Its
smallest value is at a breakpoint: a window that starts at a reading or one that ends at one. Hermes tries both kinds, so
the answer is exact for the stream and does not depend on where the readings fall. A search that starts windows only at
readings misses a window whose fast stretch ends at a reading; `BestEffortCalculatorTests` compares the result with a
brute-force search on a 1 cm grid.

Standing still counts when it happens inside a window and not when it happens at its edge: a window starts when the
runner leaves a spot (the last reading there) and ends when the runner arrives (the first reading at the end). A runner
who stops at a crossing in the middle of a 5 km window loses that time; one who waits at the start does not.

Three guards keep a GPS fault from becoming a record:

- a window whose average speed is above 10 m/s (a 1:40 per km pace) is not an effort;
- a window that takes in a stretch between two readings covered faster than 12.5 m/s, or in no time at all, is not an
  effort either: that is the position jumping, not a runner;
- under 1 km the window is located only to the nearest reading, so when the readings are more than 15 s apart (the
  median) the distances under 1 km are not worked out at all.

The time is rounded to 0.1 s. The start and the end of the window are kept as seconds from the first reading, so the
run page can show where the effort sits in the run; each is rounded to a whole second on its own, so the end minus the
start can differ from the time by a second.

### Estimates

A distance of 1 km or more that the stream does not hold still gets an effort when the run itself covered at least 90% of
it: the run's moving seconds per metre times the distance (and only when that is no faster than 1:40 per km). That is the
case for a run with no stream (entered by hand, or a treadmill run) and for a run a little short of the distance. It is marked **estimated** wherever it is shown, and it is
replaced by the measured effort as soon as the run has a stream that holds one. An estimate takes part in places and
records like any other effort, so a hand-entered 5 km can be the 5 km record; the runner can hide it.

### What the runner decides

- **A chip time.** The time of an effort can be typed in, in whole seconds, when the watch missed the start or the run
  was timed by a race. It must be a time a runner could run: between 1:40 per km and 30:00 per km. A typed time counts
  everywhere in place of the measured one, is marked **edited**, and is kept when the run is analysed again. Taking it back
  (`elapsedSeconds: null`) restores the measured time.
- **Hiding.** A hidden effort has no place, is left out of every list and record and does not push the others down. The row
  stays, so analysing the run again does not bring it back.

An effort for a distance the run no longer holds (after the stream was replaced) is removed when the run is analysed
again, unless the runner typed a time for it or hid it.

### Places and lists

The place of an effort is one more than the number of the runner's efforts at that distance that are faster, with a tie
going to the earlier day and then the earlier run. Hidden efforts are not counted. The lists on the Profile page:

| list | what it holds |
|---|---|
| lifetime | the three best efforts ever at the distance |
| annual | the ten best efforts of one calendar year (the latest year with an effort unless one is chosen) |
| trend | the best time of every year, with the number of efforts that year |

A run belongs to the calendar day in the runner's own time zone (see "The runner's day" above). Each run can hold only
one effort per distance, so two places in a list are always two different runs.

### When a run is analysed

When it is imported (after the import commits), when its stream arrives (a Strava run is saved before its stream is
fetched), and, for any run that has not been, when its records are first read (a run page, the best-efforts analysis, or
the Profile page's personal records): a request analyses up to 100 runs for at most 1.5 s, newest first, and says in
`complete` whether some are still waiting, so the screen can say that places may still change. Two requests that read
the same waiting run do it once: the second finds it done when its turn comes. After every start, a background pass analyses up to 500 runs that have not been
(`app.records.catchup-on-startup`, `app.records.catchup-max-runs`), which is also how an existing history is picked up
after an upgrade. A run is marked with the version of the analysis that last ran for it (`BestEffortService.MODEL_VERSION`),
so raising that number analyses every run again. Deleting a run takes its efforts with it, and so does deleting the
account; the account export has them in `best-efforts.csv`.

### Same-route runs

Two runs are the same route when they start within 150 m of each other, finish within 150 m of each other, are within 5%
of each other in distance, and go the same way:

- a run that finishes within 150 m of where it started is a **loop**, and two loops match only when they go round the
  same way (the sign of the area the track encloses). A loop that encloses less than 5% of the area a circle of its length
  would is an **out-and-back** and matches only other out-and-backs;
- a loop never matches an open route. For an open route the two ends already fix the direction: the same route run the
  other way starts where the first finished, which is not within 150 m of its start.

The thresholds are Hermes' own and are settings (`app.records.match.endpoint-tolerance-m`,
`app.records.match.distance-tolerance-pct`); Strava names start, end, direction and distance as its criteria and does not
publish its numbers. A route is at least 1 km. A run joins the nearest group of the runner's that it fits (the gap at the
start plus the gap at the finish, in metres, plus a hundredth of the difference in distance), or starts a group. A group
is anchored at the run that founded it, so two runs that each fit the founder are in one group even if they do not fit
each other. Groups belong to one runner and are never shared.

The server returns the runs of the group oldest first with their date, distance, moving time and pace (moving seconds per
kilometre), marks the fastest (the earlier one when two are equal) and the run being viewed, and returns no runs at all
when the run is the only one of its route. At most the newest 500 runs of a route are sent.

### Known limits

- The shape between the start and the finish is not compared, so two different loops of the same length from the same
  door are one route, and a loop run from another point of the same circuit is another route.
- A run imported twice (once from a file and once from Strava) is two runs: it can take two of the three lifetime places
  and appears twice in its own route. Delete one of them.
- An effort is only as good as the stream. A watch that records a position every 30 s works but is coarse, and a stream
  whose distance is inflated by GPS drift makes efforts faster than they were (the guards above only catch jumps).
- Estimates are the run's average pace carried over to the distance, which is slower than a runner's best stretch and
  faster than a runner who tired; they are marked so they can be hidden.
- Only whole seconds can be typed, and only for an effort the run already has.

## Fitness, Fatigue and Form

The Load balance page has a card under its acute and chronic chart that follows how a runner's training has built up over
weeks and how fresh it leaves them: **fitness**, **fatigue** and **form**. It is made from the Effort score of each run
(see "Run Effort and Heart-Rate Zones"), not from the load the acute and chronic chart uses. The two are on different scales
and neither changes the other; the page says so under the chart. Bringing them onto one scale would change numbers runners
already see, so it is the owner's decision and has not been made.

### The model

A day's load is the sum of the Effort scores of the runner's runs on that day, on the runner's own calendar (see "The
runner's day"); a day without a run is a day of zero. Fitness and fatigue are two exponentially weighted averages of the same
daily numbers, a slow one and a fast one, and form is the gap between them:

```
fitness(t) = fitness(t-1) + (load(t) - fitness(t-1)) x (1 - e^(-1/42))      slow, 42 days
fatigue(t) = fatigue(t-1) + (load(t) - fatigue(t-1)) x (1 - e^(-1/7))       fast, 7 days
form(t)    = fitness(t) - fatigue(t)
```

This is the impulse-response model of Banister et al. (1975) in the exponentially weighted form that training software uses
(chronic and acute training load). The 42 and 7 days are the common convention, not any one product's numbers (Strava does
not publish its time constants); they are settings (`app.training.fitness-days`, `app.training.fatigue-days`, fatigue
must be the shorter). Both averages start at zero the day before the first day read.

The unit is the unit of the Effort score, per day. A runner who spends an hour in the middle of zone 3 (Effort 180) every day
ends up with a fitness near 180; one who does it four days a week ends up near 103 (180 x 4/7), with the daily swings around
it. Fatigue swings much more, which is the point: after a hard block fatigue is above fitness and form is negative, and a few
days of rest bring fatigue down faster than fitness, so form rises above zero.

### What is read

One indexed query per request: the sum of the Effort scores and the number of runs for each day from the runner's first run
(or 730 days before the first day asked for, whichever is later) to the last day asked for. Nothing is stored for these
numbers, so they cannot drift from the runs they are made of, and no run's stream is read. Load older than 730 days before
the window adds under a millionth to the slow average at 42 days and is not read.

`GET /api/training/series?from=yyyy-MM-dd&to=yyyy-MM-dd` returns a day each from the later of `from` and the first run to `to`
(`to` is never after the runner's today; at most 400 days), the same numbers for the 14 days after today as if the runner
did not run (only when the window ends today), where the last day stands and how far each number moved over the 7 days
before it, the days of the window on which the runner raced (see "Run Type and Tags"; the chart marks them), how many runs
of the window got their effort from each source, and how many of the runner's runs are not counted yet. The runner's today is the date where they live (the time zone in Settings, UTC when none is set).

### When the numbers are shown

- `none`: no run has an Effort score yet.
- `building`: the first run is less than 14 days old (today counted), so the averages have seen too little. The card says how
  long the history is and shows nothing else.
- `ready`: otherwise.

A run is **not counted yet** when it has no Effort row (it has not been analysed) or its row is out of date because the
zones or the model changed and it is being worked out again. Either makes the numbers different from what they will be, so the
answer carries the count and the card says so, with a way to load again.

### Saying form in a word

The card says *fresh* when form is above a tenth of fitness, *tired* when it is below minus a tenth, and *even* in between;
a swing of under 3 points is always *even*. This is Hermes' own convention to make the number readable, not a measurement,
and the three words do not appear in the answer: the browser works them out.

### The days after today

The dotted stretch is arithmetic, not a forecast: with no load, each average only decays (`fitness x e^(-k/42)`,
`fatigue x e^(-k/7)` after k days), so fatigue falls faster than fitness and form rises.

### Known limits

- The averages start at zero. A runner whose history starts long after they began running reads low for the first weeks.
- Only runs are counted (Hermes only analyses runs): cross-training, strength and walking add no load.
- A run's Effort comes from several sources (heart-rate zones, a rating, an average heart rate, pace). A history made of
  different sources mixes scales a little; the card says how many runs came from each.
- A time zone change moves runs between days (their Effort rows are recomputed when read), so a run can change day.
- The numbers are the runner's own and relative: 140 is not "good" or "bad", it is more or less than before.

## Weekly Effort

The Load balance page also shows the runner's effort for each of the last 12 weeks against **the range of their own last three
weeks**, so a week can be called usual, light or heavy without a target.

A week is Monday to Sunday on the runner's calendar. The usual range of a week is the mean of the three weeks before it, plus
and minus a band (`app.training.weekly-range-band`, 20%): after weeks of 300, 350 and 400 the usual range is 280 to 420. A week
that has ended is **below**, **within** or **above** its range (the edges are within). A week still going cannot be below yet,
because the days left can still add to it, so it is **above** or **within** already, or **building** towards the range.

A week has **no range** when the three weeks before it do not all fall after the runner's first run (a week off after the first
run is a real week of zero and counts; a week before the first run is not a week at all), and when the mean of the three is
under 5, which is noise rather than a pattern. A week that ended before the first run is not listed.

`GET /api/training/weekly-effort?weeks=12` (1 to 52) returns the weeks oldest first, the last of them the week of the runner's
today, each with its start and end, the total, the number of runs, whether it has ended, its range and its status. The band
is a convention of Hermes' (Strava does not publish how it sets its range), and the card says what it is.

## Run Type and Tags

A runner can say **what kind of run** it was and put a few **words of their own** on it. Both are labels for the runner's own use:
nothing is computed from them, so setting or changing one recomputes nothing, and the effort scores, zones and the fitness curve
are the same with or without them.

**Run type** is one of `RACE`, `LONG_RUN` or `WORKOUT`, or nothing (the default; most runs are just runs). The three are the ones
the log and the fitness chart do something with; a longer list would be a list of tags, which is what tags are for.

**Tags** are up to 6 words per run, each up to 24 characters (an emoji or a Chinese character counts as one). Leading and
trailing space is trimmed, runs of white space become one space, control characters are dropped and the text is normalised so
two ways of writing an accent are one tag. The same word in another case is the same tag: the first spelling in the request is
kept ("Hills" and "hills" are one tag, shown as "Hills"). Setting the tags **replaces** the whole set, so a request says what
the run should have, not what to add; the order the runner gave is the order kept.

`PATCH /api/activities/{id}` takes `runType` (a string, or `null` to clear) and `tags` (a list, or `null` for none) next to
`perceivedExertion`. A request changes only the fields it names, **checks every value before saving any** (one bad value saves
none of the good ones) and refuses a field that cannot be edited instead of ignoring it, so a typo does not look like a save.
`GET /api/activities/{id}/labels` reads a run's type and tags with the runner's most used tags (the picker's suggestions): a tag
is shown the way the runner writes it most often, the earliest spelling when two are equally common. A run that is not the
caller's answers 404 whether or not it exists, as everywhere else.

Tags are stored one row per run and tag (`activity_tag`, unique on the run and the lower-case form of the tag), with the runner
on the row so that "all my tags" never has to go through a run. They are deleted with their run and with the account, and they
are in the account export (`runs.csv`, columns `run_type` and `tags`).

The fitness chart marks the days of races: `raceDays` in `GET /api/training/series` is the days of the window under which the
runner's runs typed as a race were filed. A race that has not been analysed yet has no day to mark and is left out until it
is.

### Known limits

- A run has one type. A race that is also a long run is a race; the tags are there for the rest.
- Tags cannot be renamed or merged yet; editing a word means setting it again on each run.
- A tag with a semicolon in it is ambiguous in the export, which joins a run's tags with "; ".

## Training Log

The **Training log** page (`/training-log`) lays a runner's runs out by week and day so a month can be read at a glance. Each
week is a row with its totals (runs, distance, moving time, effort and climb) and, under it, the days that had a run with each
run's distance, time, pace, effort, type and tags. Weeks are Monday to Sunday on the runner's calendar, newest first, and every
week of the window is listed even when it had no run, because a gap is information.

`GET /api/training/log` takes:

| Parameter | Meaning |
| --- | --- |
| `weeks` | how many weeks, 1 to 26; 12 when not given |
| `to` | a day; the newest week is the week of it (never after the runner's today; today when not given) |
| `runType` | keep only runs of this type |
| `tag` | keep only runs with this tag; repeat it to ask for runs that have **every** one of them (not any) |

Earlier weeks are the next request with `to` a day before the oldest week it got; `olderRuns` says whether the runner has a run
(that passes the filters) before the first week, so the page knows whether to offer them. A refused value is a 400 with the code
`INVALID_LOG_REQUEST` and a plain reason.

The answer also carries what the filters need: the run types the runner has used (in the order race, long run, workout,
whatever the filters leave) and their 30 most used tags with how many runs have each. Week totals add up only the runs shown,
so a filtered log reads "my races" with the totals of the races.

A run's place is the runner's day for it: the day its effort row is filed under when it has one, else the day worked out the
way "The runner's day" describes (a Strava API run keeps its local clock; a file's UTC time is converted with the runner's time
zone). Runs near the edges of the window are read a day wider and placed before they are kept, so a run in Auckland on a Monday
morning is on Monday whichever clock it was recorded on.

### Known limits

- Whether older runs exist is looked up among the runner's newest 5,000 runs before the window; beyond that the page simply does
  not offer earlier weeks.
- A run that has not been analysed has no effort and adds none to its week; the page shows it without one.
- The log lists runs only (as the rest of the analysis does); cross-training, strength and walking are not in it.

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
| **Grade-adjusted pace (GAP)** | The flat pace that is worth about the same effort as the pace run on the slope: faster than the pace run on a climb, slower on a gentle descent. Hermes uses a quadratic that approximates how Strava describes its own GAP, so it is close to Strava's numbers but not the same. |
| **Best effort** | The fastest continuous stretch of a standard distance (400 m to 50 km) inside one run, found exactly from the stream. Its place (PR, 2nd, 3rd...) is among the runner's efforts at that distance. |
| **Chip time** | A time the runner typed in for a best effort, replacing the one measured; kept when the run is analysed again. |
| **Estimated effort** | A best effort worked out from the run's average pace when there is no stream to measure, for a run that covered at least 90% of the distance. Marked wherever it is shown. |
| **Same-route runs** | Runs that start and finish within 150 m of the same places, go the same way and are within 5% of the same distance. |
| **Fitness** | A slow (42-day) exponentially weighted average of a runner's daily Effort. It rises with steady training and falls slowly with rest. |
| **Fatigue** | A fast (7-day) average of the same daily Effort. It jumps after hard days and falls within days of rest. |
| **Form** | Fitness minus fatigue. Above zero the runner is fresher than their recent training has been; below zero they are carrying fatigue. |
| **Usual range (weekly effort)** | The mean of the effort of the three weeks before a week, plus and minus 20%. A week is below, within or above it. |

## Related Docs

- [Root README](../README.md) — project entry point
- [Frontend page map](../frontend/src/pages/README.md) and [backend guide](../backend/README.md) — where the analysis pages, controllers and domain utilities live
- [docs/README-DEV.md](../docs/README-DEV.md) — contributor onboarding
