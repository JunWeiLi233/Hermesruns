# Analysis — How It Works (README-ANALYSIS)

This is where HermesRuns writes down how it works out the numbers it shows, so that a runner can read the rule and check a number against their own runs. The VDOT and training-pace equations come from Jack Daniels' *Running Formula* (with Daniels and Gilbert's oxygen-power model); the load ratio follows the acute:chronic workload research it cites; the rest are HermesRuns' own conventions, and each section says so.

**How to read it.** Each section gives the formula and the constants as the code has them, says where the number is worked out (the server or the browser) and where it is shown, and ends with what it does not do. Where the app works out similar numbers in different ways in different places, this document names each one instead of calling them all by one name; the table below says which is which. What has no section yet is in "Not yet documented" at the end. The cards in the app link here: the line "How it is worked out" under a number opens the section for it. If a number on screen disagrees with what is written here, one of them is wrong: write to support@hermesruns.com or open an issue on this repository.

## Where to find the views

These features are part of the existing website pages. Analysis contains the VO2max evidence and history (`/analysis#vo2max-estimates`), Trends (`/analysis#analysis-trends`), and the pace curve (`/analysis#pace-curve`). Quality sessions is inside the existing Intensity view (`/analysis/intensity#quality-sessions`). The weekly training log is inside Runs (`/runs#training-log`). Each view opens within its page and shares its navigation; optional charts load when opened. The earlier feature URLs redirect to these locations and retain their filters.

## Where each number comes from

For a pinned local release, the frontend and backend must be packaged together. `tools/package-reviewed-analysis.ps1 -BuiltJarPath <complete-backend.jar>` creates a candidate with the current analysis build and preserves the activated training-plan code and configuration. It does not activate the candidate. Rehearse `backend/src/main/resources/db/analysis/V001__run_records.sql` against a database copy before applying it to a backed-up PostgreSQL release. `tools/assert-analysis-release.ps1` checks that the candidate includes the analysis controllers and embedded frontend views; the launcher runs this check before starting a pinned release. End-to-end tests can run the exact candidate by setting `E2E_BACKEND_JAR` for the disposable stack.

| Number | Worked out | Shown on | Section |
|---|---|---|---|
| VDOT (the VO₂max estimate) | in the browser (`utils/vdot.js`) | Analysis, Today, Home, the prediction pages; the runs behind it on the VO₂max estimates page | VDOT and VO2max |
| Races against the VO₂max number; the VO₂max over time and by year | in the browser (`utils/raceEvidence.js`, `utils/vo2maxHistory.js`), from the same run list and the same rule | the VO₂max estimates page | VDOT and VO2max (Your races against the number; The number over time) |
| Training paces and training zones | in the browser, from the VDOT | Analysis (zones), Today (workout notes), the prediction pages | Training Paces and Training Zones |
| Race predictions, their history, the confidence figure | in the browser | the prediction pages, Analysis, Home | Race Predictions and Their History |
| Long-run check | in the browser (`utils/enduranceCheck.js`) | the prediction pages | Race Predictions and Their History |
| Load ratio (ACWR), acute and chronic load, the load budget | in the browser (`utils/analysisInsights.js`) | Load balance on Analysis and on Today | Training Load and the Load Ratio |
| Monotony and training strain | in the browser (`utils/trainingStrain.js`), from the same daily loads | the Load balance page | Training Load and the Load Ratio (Monotony and training strain) |
| Effort Score | in the browser; a second, pace-only version on the server | run rows on Analysis, recovery on Today; the server's version feeds readiness, the injury-risk check and the pace-model Effort | Effort Score |
| Recovery hours | in the browser | Today | Recovery Estimation |
| Run Effort, heart-rate zones, time in zone | on the server | the run page | Run Effort and Heart-Rate Zones |
| Splits, smoothed pace, grade-adjusted pace, pace zones | on the server (the zones in the browser) | the run page | Pace Analysis and Grade-Adjusted Pace |
| Best efforts, places, same-route runs | on the server | the run page, Profile | Best Efforts and Same-Route Runs |
| Fitness, fatigue, form; the weekly effort range | on the server (the bars of the day's effort, the arrows and the 14 day change in the browser, `utils/fitnessChart.js`) | the Load balance page | Fitness, Fatigue and Form; Weekly Effort |
| Weekly distance and its four-week moving average | in the browser (`utils/weeklyDistance.js`), from the run list the page loads | the Load balance page | Weekly Distance and its Moving Average |
| Trends: a run's pace, distance, time, heart rate, efficiency or cadence over a period; its middle, usual range, trend line and the comparison with the stretch before | in the browser (`utils/metricTrend.js`), from the same run list | the Trends page | Trends |
| Quality sessions: the runs of the types that count in a period, their share of the distance and their middle pace | in the browser (`utils/qualitySessions.js`), from the same run list | the Quality sessions page | Quality Sessions |
| Time in zones, the intensity distribution | on the server | the Load balance page | Time in Zones and the Intensity Distribution |
| Pace curve, critical pace and D' | on the server, from the best efforts | the Pace curve page (from Analysis and the prediction pages) | Pace Curve and Critical Pace |
| Goals | on the server | Profile, the run page, the Training log | Goals |
| Run summary | the findings on the server, the words in the browser | the run page | Run Summary |
| Today's call, readiness, the plan | on the server (the words and the heat adjustment in the browser) | Today, the Schedule, Home | Today's Call and Readiness |
| Injury risk | the server's check (the card, the plan); a second version in the browser (the coach insight) | Analysis, Today's call | Injury Risk |
| Easy and hard share, the coach insight | in the browser | Analysis | Easy and Hard Share, and the Coach Insight |
| Heat pace adjustment | on the server | Today, the Weather page, each run | Heat and the Pace Adjustment |
| Shoe mileage and shoe health | mileage on the server; health words, rotation and suggestions in the browser | Shoes, Today | Shoes |

## VDOT and VO2max

VDOT is one number for current aerobic fitness: a higher VDOT means faster paces. HermesRuns works it out in the browser (`utils/vdot.js`) from the runner's recent runs, one estimate for each run, and shows the mean of the best three. Cards label it VO₂max.

### The equations (Daniels and Gilbert)

```
velocity     = distance / time                              (m/min)
VO₂ cost     = -4.60 + 0.182258 × v + 0.000104 × v²        (ml/kg/min: the oxygen cost of running at that speed)
%VO₂max      = 0.8 + 0.1894393 × e^(-0.012778 × t) + 0.2989558 × e^(-0.1932605 × t)       (t in minutes)
race VDOT    = VO₂ cost / %VO₂max
```

### One estimate for each run

A run of at least 1.5 km with a moving time gets an estimate by one of two methods:

1. **A run with an average heart rate.** When the run has an average heart rate (over 40 bpm) and the runner has a highest heart rate on record of at least 130 bpm. That highest heart rate is the highest *maximum heart rate* found on any of the runner's runs, not the value saved in Settings.

   ```
   fraction  = average heart rate / highest heart rate          (kept between 0.60 and 0.98)
   estimate  = VO₂ cost of the run's average speed / fraction
   ```

   This takes the share of maximum heart rate the run was held at to be the share of VO₂max it used. It is a rule of thumb, and it is **not** Daniels' race equation: a run with a heart rate never goes through the race equation above.
2. **A run without one.** The race equation is applied to the whole run (its distance and its moving time), but only when the run's pace is no more than 1.18 times slower than the median pace of the runner's runs of 1.5 km or more. A slower run (an easy jog) is left out, because it says little about fitness.

An estimate is kept between 24 and 88. The same 10 km run in 50:00 (a 5:00 per km pace, an oxygen cost of 36.0) gives **45.6** with an average heart rate of 150 against a highest heart rate of 190, and **40.0** with no heart rate: the method, not the run, accounts for the difference.

A **weather-adjusted** estimate is worked out the same way after the run's own heat adjustment (seconds per km, see "Heat and the Pace Adjustment") is taken off its pace, so a hot run counts a little higher. Where a card shows both, it labels them.

### The current VDOT

Estimates from the last **90 days**. If any of them comes from a run of 3 km or more, only those runs are used; otherwise runs of 1.5 km or more. The current VDOT is the **mean of the top three** estimates, to one decimal (fewer when there are fewer runs).

### The runs behind the number

The VO₂max estimates page (the line "The runs behind this number" under the VO₂max card on Analysis and under a race prediction opens it) lists the runs the rule above looks at, so the number can be checked against the runs. It is worked out in the browser from the same run list as Analysis and the same code as the number (`utils/vdot.js`, `utils/vdotEvidence.js`); it adds no estimate of its own, and it changes nothing.

- **The rows.** Every run of the last 90 days that has an estimate, highest first: its day, distance and pace, its average heart rate (with the share of the highest heart rate that is, when the estimate came from heart rate), the method that gave the estimate, and the estimate to two decimals. A weather-adjusted column appears only when some run was adjusted by 0.05 points or more; it is that run's own adjusted estimate and is not what the number is taken from.
- **Counted.** The runs the number is the mean of: the top three of the pool, as above. A run of under 3 km while a run of 3 km or more exists is marked *not used* however high its estimate is.
- **The sum.** The counted estimates added and divided by how many there are, to two decimals, then *shown as* the one-decimal number on the cards. The number is worked out from the unrounded estimates, so adding the rounded ones from the table by hand can land 0.1 away from the card where a rounding edge falls.
- **Without the best run.** When the pool has a fourth run: the mean the number would have without the highest estimate (the next run in line takes its place), and how far lower that is. It is left out when the difference is under 0.1.
- **The runs left out.** How many runs of 1.5 km or more in the 90 days got no estimate: those with no heart-rate estimate that are more than 18% slower than the median pace. The page gives that median (of all the runner's runs of 1.5 km or more, not only the last 90 days) and the pace 1.18 times slower than it.
- **The highest heart rate.** The highest maximum heart rate found on any run, which every heart-rate estimate is scaled by (see "Known limits"). Shown as *none* when no run has a peak of 130 bpm or more; every estimate then comes from the race equation.

The dot chart draws the same rows by day, with the number as a line; dots are *counted*, *not used* (the pool had a better run) or *outside the pool* (under 3 km while a longer run exists).

### Your races against the number

The VO₂max estimates page also sets each race the runner flagged against the number. A run is a race when the runner has set its type to Race on its page (see "Run Type and Tags"); `GET /api/activities/analysis`, the list the Analysis pages load, carries each run's `runType` for this, so nothing else is asked of the server. It is worked out in the browser (`utils/raceEvidence.js`) with the same code as the number, and it changes nothing: no number on any page is moved by a race.

For each race, newest first:

```
VO₂max from the time = the race equation (above) on the run's distance and its moving time, to one decimal
VO₂max before it     = the current VO₂max (the mean of the best three estimates of the last 90 days, as above), worked out
                       for the 90 days ending where the race began, from the runs that began before it
difference           = VO₂max from the time − VO₂max before it, as the two are printed
```

The number before a race is the number the runner would have seen that day: the same rule on the runs that had been run by then, with the highest heart rate and the median pace taken from those runs. The race itself is not in it, nor is any run after it; a second race on the same day sees the first. The race's own number never uses a heart rate: it is what its time alone says.

A positive difference means the race was better than the number said, a negative one that it was worse. Worked example: three 5 km runs of 25:00 give 36.01 ÷ 94.0% = 38.31, shown as 38.3. A 10 km race in 45:00 gives 41.04 ÷ 90.7% = 45.26, shown as 45.3, so its difference is 45.3 − 38.3 = +7.0. One 10 km race in 60:00 gives 32.3 and a difference of −6.0.

Under the table the page says the mean of the differences of the races that have one (to one decimal, of the printed differences), how many came out above, below and level, and what one race can and cannot say. It never turns the mean into a correction: the number is the same with and without it.

A race under 1.5 km gets no number from its time and none before it (the shortest run that gets an estimate is 1.5 km); it is listed with the reason. A race with no run in the 90 days before it that gives an estimate has "No estimate" before it and no difference. A runner with no flagged race is told how to flag one.

### The number over time

Under the races the page draws the number over time and lists it by year. A **point** is the number as the page would have shown it right after a run, by the rule above: the estimates of the runs of the 90 days ending at that run, the mean of the best three of the pool, to one decimal. It is worked out from the runs there were by then (`utils/vo2maxHistory.js`, in the browser, from the same run list as the rest of the page): the highest heart rate on record and the median pace are the ones of the runs up to that run, so a later run with a higher peak does not move the points before it. The line ends at one more point, today, which is the number on the page and falls as runs leave the 90 days. This is the number a race is set against ("Your races against the number"): the number before a race is the number the rule gives at the moment the race began, which is the point of the run before it unless runs have left the 90 days between the two.

Worked example, three 5 km runs of 25:00, 24:00 and 23:00 (38.31, 40.20 and 42.27 by the race equation): the points are 38.3 (one run), 39.3 (the mean of the first two, 39.26) and 40.3 (the mean of the three, 40.26). The same 10 km run in 50:00 with an average heart rate of 150 reads 43.2 while the highest heart rate on record is 180 and 45.6 once a later run has put it at 190, so the point after the run keeps 43.2 and the points after the later run use 45.6.

A point is **firm** when the number is the mean of three runs. With one run or two in the pool it is their estimate and swings with them: such a point is drawn hollow and is left out of the highest, the lowest and the average.

Above the line, four readings: today's number, the highest and the lowest firm point of the range with their days, and the average. The range is 6 months, a year (to begin with) or all of it, counted back from today; it changes what is drawn and read, not a number. The table by year has a row for each calendar year of the runner's own clock that has a run: the highest and the lowest firm point of the year with the day, the average, the number at the end of the year (the number after its last run; for this year, today's) and the runs and distance of the year, every run counted whether or not it gave an estimate.

**Reading one point.** The line is a slider, as the fitness chart is: the pointer picks the nearest point as it moves, a finger picks on touching and keeps the point after it lifts (touching anything else lets go), and the arrow keys move one point at a time once the chart has the keyboard (Home and End go to the oldest and the newest, Escape and leaving the chart let go; the chart starts on the newest). A ring and a thin line mark the point, and a note beside it gives its date, its number and the run it came after; a hollow point says so in a few words. For a screen reader the slider's value is the same in a sentence ("Mar 3, 2026: 48.2, after Morning 10k", and for a hollow point why it is left out of the highest, the lowest and the average), and a list under the chart, not drawn, has the sentence of every point, oldest first. Nothing is worked out for this: each is the number printed on its dot.

The **average** is of the number over the days it stood, and not of the points: the number is worked out after each run and not every day, so a point counts for the days from its run to the next point (to today for the last one), and for 90 days at most, because a number is made from the runs of the 90 days and with none in that time there is no number left to stand.

```
average = the sum of (a firm point's number x the days it stood) / the sum of the days they stood
```

It is worked out from the numbers as they are printed on the dots, so it can be checked by hand, and only the firm points count, so it always lies between the highest and the lowest. A hollow point counts for nothing, but it ends the stand of the point before it. The average of a range is of the points that range draws, from the first of them to today; the average of a year is of that year's own points, to the end of the year (to today for this year). The reading says how many days it is of. Worked example: a firm point of 40.0 that stood 3 days and the next, of 44.0, that stood 27 days give (40.0 x 3 + 44.0 x 27) / 30 = 43.6, where the mean of the two points would be 42.0 and say how often the runner ran and not how high the number was. With no firm point that stood any time (a runner with two runs, say) there is no average and the reading is a dash.

### Trend and history

- The trend badge compares the best three estimates of the last 30 days with the best three of the 30 days before: a rise of 0.8 or more is *improving*, a fall of 0.8 or more *declining*, otherwise *maintaining*. It needs runs in both stretches.
- The monthly bars on Analysis show the best estimate of each calendar month. The prediction history uses the same estimates (see "Race Predictions and Their History").
- The coach insight on Analysis uses its own comparison, the last three estimates against the three before them (see "Easy and Hard Share, and the Coach Insight").

### Known limits

- The highest heart rate is the highest on any of the runner's runs, however old. One wrong peak from a wrist sensor raises every heart-rate estimate (a smaller share of maximum heart rate means a higher estimate) until that run is deleted.
- A heart-rate estimate follows the heart rate: heat, fatigue, caffeine or a loose strap move it, and nothing in the number says so.
- A runner with no heart-rate data gets race-equation estimates from ordinary runs, which are slower than race efforts, so the number reads low until a hard effort of 3 km or more is in the last 90 days.
- The runs behind the number are picked by their raw estimate. The weather-adjusted prediction on the prediction pages takes the mean of the best three *adjusted* estimates, which can be a different set of runs from the three counted on the VO₂max estimates page.
- The estimates from heart rate and from the race equation are on different footings (the example above: 45.6 against 40.0 for the same run), so a pool that mixes them ranks a heart-rate run above an equal effort without a heart rate. The page shows the method of each run so the mix can be seen.
- A race's time is the run's moving time, not a chip time: a pause the watch did not count shortens it, and the number from it reads a little higher.
- One race says little: a bad day, heat, hills or a race not run all out make it come out low, and the page makes no correction for the course. Several races on the same side of the number say more, and one cause to check is the highest heart rate on record: a peak that is too high makes the number before a race too high, so the races look worse against it, and one that is too low does the opposite.
- The number before an old race is worked out from the runs as they are now. A run edited or deleted since, or a highest heart rate that has changed, gives a different number from the one that was on screen that day.
- The line over time is the rule applied again to the runs as they are now, point by point, and not what the app showed on the day: an edit or a deletion since changes the points it fed.
- Between two runs the line is straight. A long gap in running shows as a long straight stretch and not as the number falling: it falls only when it is read, at the last point (today).
- The highest and the lowest of a range depend on how often the runner ran in it. A quiet stretch leaves the number where the last run put it, and a runner with few runs has few firm points.
- The average holds each number until the next run. Between two runs the real number can fall as runs leave the 90 days, so after a break the average reads a little high; a number is held for 90 days at most, and the days of a longer break are not counted. The days before the first point of a range or of a year are not counted either, even if an earlier number still stood on them.

## Training Paces and Training Zones

Both are cut from the runner's VDOT. The pace at a share of VO₂max is the speed whose oxygen cost (the equation above) equals the VDOT times that share. They appear in three forms, worked out in the browser (`utils/vdot.js`, `utils/analysisInsights.js`, `utils/paceAnalysis.js`):

| Zone | Training pace in workout notes (a point or a range) | Training zone on Analysis (a range) | Pace-zone edge on the run page |
|---|---|---|---|
| Recovery | | | below 59% |
| Easy | 59% to 74% | 59% to 74% | 59% |
| Marathon | 80% | 75% to 83% | 75% |
| Threshold | 88% | 83% to 92% | 83% |
| Interval | 98% | 92% to 105% | 92% |
| Repetition | 105% | 105% to 110% | 105% |

(All are shares of VO₂max.) For a VDOT of 50 the workout-note paces are 5:52 to 4:54 per km (easy), 4:36 (marathon), 4:15 (threshold), 3:54 (interval) and 3:41 (repetition). The training paces appear in the prediction pages' coaching lines; the zones on Analysis show the ranges; the run page cuts its pace zones at the edges in the last column (see "Pace zones" below).

**The paces Today asks for are not these.** When the server has a session for today, its pace range comes from the runner's own average pace over the last 28 days, not from the VDOT (see "Today's Call and Readiness"). The two can differ, and neither is a check on the other.

## Race Predictions and Their History

Each prediction page (5K, 10K, half marathon, marathon at `/prediction/:distance`) turns the runner's fitness into a time over
that distance, all in the browser (`utils/vdot.js`, `pages/prediction/PredictionDetail.jsx`).

- **The time.** The runner's VDOT (the mean of their top three estimates of the last 90 days, above) gives a base time over
  the distance by Daniels' equations: the time at which the race VDOT of that distance equals the runner's VDOT, found by
  bisection. The fastest run of the last **90 days** within 20% of that distance (its pace times the distance) is blended in,
  the more the nearer it is in distance and the fresher it is:

  ```
  closeness = 1 − |run distance ÷ distance − 1| ÷ 0.2                      (0 to 1)
  freshness = 1 − the run's age in days ÷ 90                              (0 to 1)
  weight    = (0.45 + 0.35 × closeness) × max(0.15, freshness^1.7)
  blended   = base × (1 − weight) + the run's time over the distance × weight
  ```

  A run 45 days old or less also keeps the result from being more than half a percent faster than that run's own time over
  the distance (the result is at least 0.995 times that time). The window is the one the page says it looks at
  (`PREDICTION_ANCHOR_DAYS`); it was 180 days, so a run the page did not list could move the time (BUG-015). The four
  distances are kept in order, a longer race never faster than a shorter one.
- **Pace by effort.** The ladder next to the headline has a row for easy, moderate, hard and the race itself. The race row is
  the predicted time and the pace it makes, not a fixed share of VO₂max (BUG-014). The other rows are worked out from the
  fitness that makes exactly that prediction (the VDOT of the predicted time over that distance): easy at 65% and moderate at
  75% of VO₂max, hard halfway between moderate and the race's own share, so the ladder steps up to the headline for every
  distance and cannot pass it.
- **The history.** One point for each date in the runner's VDOT series, each worked out **as of its own day**: only the runs
  up to that day count, and their ages are taken from it, so a runner who got six minutes faster has a line that fell by six
  minutes instead of every point leaning on today's best run (BUG-035). A switch above the chart picks the last **1, 3 or 6
  months** (30, 90 and 180 days; 3 by default; the choice is kept in the browser and an unknown stored value is ignored). The
  range, the number of points and the chart's text alternative follow it; a range with no points says so and offers a longer one.
  The "change over time" figure in the headline stays on 3 months whatever the chart shows.
- **The weather-adjusted time.** The page also works the time out from the weather-adjusted VDOT, with each run's time reduced
  by its heat adjustment (see "Heat and the Pace Adjustment"). It is the headline only when some run in the last 90 days has
  an adjustment, the adjusted VDOT is more than 0.05 higher, and the adjusted time is faster by more than a second; the page
  then says the time is weather adjusted and shows the raw one beside it.
- **The confidence figure.** 34, plus 24 when the runner has a run in the last 90 days, plus 4 for each point in the VDOT
  history (at most 24), plus 6 for each run among the top three (at most 18); between 38 and 95, and 0 with no VDOT. It is a
  HermesRuns convention for how much evidence stands behind the time, not a probability.

### The long-run check

Under the time, each prediction page says whether the runner has run anything like the distance lately (`utils/enduranceCheck.js`,
`pages/prediction/EnduranceCheck.jsx`, in the browser). The time above is what the runner's fitness would allow over the distance;
it does not know whether they have trained for it (see "Known limits"), and this is the one place the page says so.

```
window      = the last 8 weeks (56 days), counted back from now
longest     = the longest run in the window, by distance
asked for   = 0.75 × the race distance
enough      = the longest run reaches the asked-for distance, both shown to one decimal in the runner's unit
```

- **Three states.** *Enough*: the longest run reaches the asked-for distance. *Short*: it does not; the page then says the time is
  what the fitness would allow, not a sign of having trained for the distance, in an amber note like the weather box. *None*: no
  run in the window. Beside the sentence it gives the number of runs in the window and the average distance a week (the window's
  total distance divided by 8).
- **A HermesRuns rule of thumb.** Three quarters of the distance is not a research finding. It is the share the familiar 20-mile
  run before a marathon is (about 76%), used for every distance so the check reads the same on every page. For a 5K or a 10K
  nearly any recent run reaches it, so the page seldom has anything to say there. Plans differ, and a runner who prepares in a
  different way (many shorter runs, run-walk long runs) is not served well by it.
- **Compared as shown.** Both distances are rounded to the one decimal the page prints, in the unit the runner reads, before they
  are compared, so the sentence can never print a longest run equal to the asked-for distance and still say *short*. A run within
  a few hundredths of a kilometre of the line can be *enough* in kilometres and *short* in miles for the same reason.
- **It changes nothing.** The time, the confidence figure and the history do not take the check into account.

### Known limits

- The base time is the formula's: it does not know the course, the weather on the day, or whether the runner has trained for
  the distance. A 5K runner's marathon time is what their fitness would allow, not a plan.
- The VDOT behind it can be a heart-rate estimate (see "VDOT and VO2max"), so a prediction inherits that method's limits.
- The long-run check looks only at the distance of the longest run in the last 8 weeks. It does not look at the pace, at how many
  long runs there were, at a race that served as the long run, or at the weekly distance (which it shows but does not judge).
- The prediction pages show paces and the recent-effort distance in kilometres whatever the kilometre or mile setting says; only
  the long-run check follows it.

## Training Load and the Load Ratio

The **load ratio** (ACWR, the acute:chronic workload ratio) compares recent training load with the load the runner is used to. In the research it comes from, a sudden jump above what the body has been doing goes with more injuries; HermesRuns uses it as a signal, not a diagnosis. It is the exponentially weighted version (Williams et al. 2017), with the 0.8 to 1.3 "sweet spot" and the danger above 1.5 from Gabbett (2016) and Hulin et al. (2014).

### The load ratio on Analysis and Today (browser)

`buildTrainingLoad` in `utils/analysisInsights.js` works it out for the Load balance page and for the Load balance card on Today (the Home and Schedule cards read the same function):

```
daily load   = the sum of the Effort Score of the day's runs           (see Effort Score; a day with no run is 0)
acute        = load × 2/8  + previous acute × (1 − 2/8)                 λ = 2/(7+1) = 0.25
chronic      = load × 2/29 + previous chronic × (1 − 2/29)              λ = 2/(28+1) ≈ 0.069
load ratio   = acute / chronic                                           shown only while chronic is above 0.5
```

Acute and chronic both start at the first day with a run (that day's load) and run to the runner's today, so a long history is in the ratio. A run is on the day it was run on the runner's own calendar. At least 7 days of history are needed (Today also needs 3 runs).

| Load ratio | Zone | Meaning |
|---|---|---|
| under 0.80 | low | Not enough stimulus |
| 0.80 to 1.30 (1.30 included) | optimal | The sweet spot |
| above 1.30 to 1.50 (1.50 included) | high | Elevated injury risk |
| above 1.50 | danger | Reduce load |

The Load balance page adds, from the same acute and chronic series: the **load budget** for each of the next seven days (the most load a single run on that day could add, with no run on the days between, and still leave the ratio at 1.30 or below: `1.3 × chronic − acute`, divided by `0.25 − 1.3 × 2/29`); the distance of the last 7 days against the 7 days before; the **monotony** and the **training strain** of the last 7 days (the next subsection); and the trend of chronic load (rising or falling when it moved by more than 3% against a week earlier).

### Monotony and training strain

Two numbers read off the same daily loads as the load ratio above, after Foster (1998): the Effort Score of the day's runs, a day with no run counting as 0. They are worked out for the **last 7 days**, today and the six days before it. That is a rolling week and not a calendar week, so the cards can be read on any day.

```
week load = the sum of the 7 daily loads
mean      = week load / 7
spread    = sqrt( the sum of (daily load - mean)^2 / 7 )      the standard deviation of the 7 days, divided by 7
monotony  = mean / spread
strain    = week load x monotony
```

Monotony says how alike the days of a week were. One long run among six rest days has a spread as large as its mean, so a monotony near 1; the same easy hour every day has almost no spread and a monotony in the tens. Strain is the week's load made heavier the more alike its days were: the same total costs more as seven even days than as one big day among rests.

Worked example, daily loads of 0, 100, 50, 0, 150, 75 and 0. The week load is 375 and the mean 53.57. The squared gaps from the mean add up to 20,535.7, so the spread is the square root of 20,535.7 / 7, which is 54.16; the monotony is 53.57 / 54.16 = 0.989 and the strain 375 x 0.989 = 370.9. The Monotony card prints 1.0 and the Strain card prints 371, with "Week load 375 x monotony 0.99" under it. The strain is taken from the unrounded numbers, so multiplying the printed ones by hand can come out a unit or two away. Loads of 60, 50, 60, 50, 60, 50 and 60 add up to 390 and have a spread of 4.95: monotony 11.26, strain 4,391. The same 390 as one hard day among six rests has a monotony of 0.41 and a strain of 159.

Under the number the Strain card says how it compares with the week before: the same sum over the 7 days before those, as a whole percent. It says "No prior week to compare" when there are fewer than 14 days of history. When the week before is there but has no strain to compare with, it says why: "No load the week before" for a rest week, and "The week before was the same every day" for a week whose days were all the same. The Weekly volume card says "No runs the week before" for a rest week. With no load at all in the 7 days there is no monotony and no strain, and both print "--". When every day had exactly the same load the spread is zero and both are endless, printed as "∞"; loads that differ only in the last bits of the arithmetic count as the same.

Both cards link here. The Monotony card turns amber at 2.0 or more, the line usually quoted from Foster's work: a rule of thumb, and the only line on the row. The Strain card has none (see the limits below).

### Other ratios in the app, and what each decides

The load ratio above is not the only ratio. They are not the same number, are not meant to match, and are worked out from different inputs:

| Name here | Worked out from | Window | Used for |
|---|---|---|---|
| Load ratio (above) | the browser's Effort Score | the same EWMA, from the first run | The Load balance cards, the zone words, the load budget; the coach insight and the injury insight on Analysis |
| Server load ratio | the server's pace-only load units (see Effort Score) | the same EWMA over the last 35 days, from that window's first day; shown while chronic is above 0.5 | The load part of readiness; the server's injury-risk check and its trend |
| Distance ratio | kilometres | the last 7 days divided by (the last 28 days ÷ 4) | The plan's *absorb* phase and its `high_load` reason (the line is 1.30) |

The browser also keeps a second rule set for the day's call, used only when the server sends no session for today (see "Today's Call and Readiness"); it reads the load ratio at 1.2 and 0.85.

Where a ratio crosses a line, and what happens:

| Line | Where | What happens |
|---|---|---|
| 0.80, 1.30, 1.50 | the zone words on the cards | the words above |
| 0.8 to 1.3, 1.3, 1.5, 1.65 | the load part of readiness (server load ratio) | +7 inside 0.8 to 1.3; −8 above 1.3; −25 above 1.5; −33 above 1.65 |
| 1.18, 1.3, 1.5 (at or above) | the server's injury-risk check (server load ratio) | 1, 2 or 3 risk points |
| 1.18, 1.35 | the injury insight and the coach-insight states on Analysis (load ratio) | +16 or +28 injury points; *absorb* from 1.18, *protect* from 1.35 |
| 1.30 | the coach insight on Analysis (load ratio); the plan's *absorb* phase (distance ratio) | *absorb* |


### Known limits

- The ratio is a rule of thumb from group studies. It does not predict an injury for one runner, and the scattered lines above are conventions, not measurements.
- The browser's ratio needs the runner's VDOT (a pace is judged against it when there is no heart rate), which the server does not have. That is why the server keeps its own, pace-only version.
- Effort Score from pace does not know about hills or heat: a hilly run reads easier, and a run slowed by heat reads easier, than the effort it took.
- Foster's daily load was the athlete's rating of the session (0 to 10) times its minutes. Here it is the Effort Score, a different unit, so no strain figure from a paper, a coach or another app carries over. There is no known danger level for a strain in this unit, so the card draws no line: compare it with your own earlier weeks.
- Rest days count as 0 in the spread, and they are what makes a week varied. A runner who runs every day reads a higher monotony and strain than one who rests two days with the same total, however sensible each week is.
- The spread is divided by 7, the whole week. Dividing by 6 (a sample of seven days) would make the spread 8% larger and the monotony and the strain 7% smaller (by the square root of 6/7, 0.926). The Monotony card has always divided by 7.

## Effort Score

A training-load unit for one run. About 100 for an hour is a steady hard effort (a threshold run). HermesRuns has three versions; they share the idea and differ in how they find the intensity. Do not compare numbers between them.

```
intensityRatio = vo₂Fraction / 0.85
effortScore    = duration_hours × intensityRatio² × 100
```

| Version | Where | vo₂Fraction is |
|---|---|---|
| **Effort Score** | the browser (`utils/analysisInsights.js`): the load ratio, the run rows on Analysis, recovery on Today | from the run's average heart rate when it has one and the runner has a highest heart rate over 100: `(100 × min(1, average heart rate / highest heart rate) − 20) / 80`, not below 0. Otherwise the oxygen cost of the run's average pace divided by the runner's VDOT; 0.65 when there is no VDOT. Kept between 0.4 and 1.2 |
| **Server load units** | the server (`TrainingLoadAnalyzer.loadUnits`): the server load ratio, readiness, the injury-risk check, and the `PACE_MODEL` source of the run page's Effort | the oxygen cost of the run's average pace divided by **50**, a fixed reference and not the runner's VO₂max, kept between 0.42 and 1.2. No heart rate |
| **Run Effort** | the server (next section) | a different scale, from time in heart-rate zones |

The first two have the same shape and a different yardstick. In the browser's version a run at 85% of the runner's VDOT scores 100 an hour whoever the runner is, so a fit runner's easy run scores low. In the server's version a run with an oxygen cost of 42.5 ml/kg/min scores 100 an hour for everyone. A 50-minute run at 5:00 per km costs 36.0, which is 0.72 of the server's reference: intensity ratio 0.847, so the server scores it 59.8. The browser's version scores the same run 73.9 from its pace when the runner's VDOT is 45, or 62.6 from an average heart rate of 150 against a highest heart rate of 190.

The unit is arbitrary, as for any training-load number. It is not the Effort of the run page, which is on its own scale.

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
the published Edwards TRIMP scheme; the rating mapping and the calibration are HermesRuns' own conventions. The rating, the
pace score and the heart-rate score are all kept on the row, so a run's number can always be explained.

### The runner's day

A run belongs to a calendar day in the runner's own time zone. A run fetched from the Strava API already holds the
runner's local clock time; a run from a file holds UTC and is converted with the time zone in Settings (UTC when none is
set). Reading a UTC time as local would put an evening run in New York on the next day.

The pages that add up a week in the browser (Load balance, Home, the coach cards) count from the runner's today. That is the date on the device, or the date of the latest run when that is after it: the clock on the runner's wall (the zone in Settings, or the UTC clock of a file) can be a day or two ahead of the device's, and a run is never from the future, so the runner's today is at least the date of their latest run. Counting from the device's date left such a run out of the week, the load and the strain until the device's own date caught up. Two days is the most two zones in the world are apart (UTC-12 and UTC+14); a run dated further ahead than that is taken for a wrong clock on a watch and is not followed. The server's own windows (the fitness series, the training log) use the runner's zone and do not need this.

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
[pickletech.eu](https://pickletech.eu/blog-gap/); the post itself could not be read when this was written). HermesRuns uses a
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
climb. Strava takes elevation from its own terrain data; HermesRuns uses the run's own elevation (the corrected one after
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

### Pace zones from a race

A runner who has not run hard lately, or who knows what a recent race said about their fitness, can cut the pace zones from
that race instead. It is one race at a time, entered in Settings > Training > Pace zones:

- **The race** is a distance (5K, 10K, half marathon, marathon, or any distance from 1.5 km to 100 km, typed in the
  runner's unit), a time (`mm:ss` or `h:mm:ss`, from 4 minutes to 24 hours) and the day it was run (not in the future, not more
  than five years back). The time over the distance must be a pace between 2:00 and 20:00 a kilometre; nobody has run
  outside that. Entering another race replaces the first; removing it goes back to the runner's runs.
- **The fitness** is the VDOT the race stands for, worked out in the browser with the same function as the rest of the analysis
  (`calculateVdot`, Daniels and Gilbert's oxygen-power model), to one decimal. The server stores only the three numbers, never
  the VDOT, so there is one copy of the arithmetic. The six zones are then cut from that VDOT as above.
- **Which runs follow it.** A run on or after the race date uses the race's zones; a run before it keeps the zones it had going
  into it, from the runner's runs (the 90 days before it, or today's if nothing came before). The run's day is the runner's own
  day, read from the run's start as the run page writes it, so a run on the day of the race counts whatever time it started. A
  run with no usable date has nothing to place it by and gets the race's zones. The run page says which it used: "Zones are cut
  from 10K in 45:00 on Sep 20, 2026 (VDOT 45.3), which you entered in Settings."
- **Settings shows both.** The card says where today's zones come from, previews the zones a typed race would give (and says
  nothing changes until the runner uses it), and says when the race is more than about six months old, since an old result says
  less about today's pace. It never decides anything for the runner: an old race stays in force until they replace or remove it.
- **What it does not touch.** Only the pace zones follow the race: the Analysis page's training paces, the race predictions,
  Effort, fitness and form, and the heart-rate zones all keep working from the runner's runs and settings.
- **Where it is kept.** The table `runner_pace_zone_race` (one row a runner, see
  [m8-schema-upgrade.md](deployment/m8-schema-upgrade.md)), `GET`, `PUT` and `DELETE /api/training/pace-zones`, the account
  export (`pace-zone-race.csv`), and the account deletion. The refusals are the server's (`PaceZoneRaceService`) and the limits
  come with the form, so the page says each one in the runner's language. Two requests from one runner at once take turns on the
  runner's row, so the second replaces the first and neither fails.

### Known limits

- A GPS jump in the distance stream moves the split boundaries after it, as it inflates the run's distance; the
  smoothed line shows no pace for a window with an impossible one.
- A race sets the pace zones of the whole of a day: a warm-up run on the morning of the race gets the race's zones as well. There
  is one race at a time, no history of earlier ones, and no separate race for the road, the track or the trail.
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
30 km, the marathon (42 195 m) and 50 km: Strava's fourteen, and the 3 km HermesRuns has always had. A run has an effort
at a distance only when its stream is that long. The personal records on the Profile page (1 km, 3 km, 5 km, 10 km, half
and marathon) read the same table, so the two can no longer disagree.

### How a best effort is found

The input is the same tidied stream as the pace profile (see "The stream and moving time" above), so only readings that
say when they were recorded are used, and a run without them has no measured efforts. The runner is taken to move in a
straight line between two readings. Distance is then a piecewise linear function of time, and the time a window of `D`
metres takes when it starts `s` metres into the run, `arrival(s + D) - departure(s)`, is piecewise linear in `s`. Its
smallest value is at a breakpoint: a window that starts at a reading or one that ends at one. HermesRuns tries both kinds, so
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

The thresholds are HermesRuns' own and are settings (`app.records.match.endpoint-tolerance-m`,
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

## Pace Curve and Critical Pace

The Pace curve page (`/analysis/pace-curve`, linked from Analysis and from the prediction pages) draws the runner's fastest time over each standard distance within a window (3, 6 or 12 months, or all time) by how long that effort lasted, and fits the classic *critical speed* line through the efforts of three to forty minutes. `GET /api/training/pace-curve?days=180` (1 to 3660, or `all`) reads the best efforts every run already carries (see "Best Efforts and Same-Route Runs") and adds nothing to them: nothing is stored for the curve, so it cannot drift from the runs it is made of.

### The dots

There is one dot for each standard distance that has an effort in the window: the fastest *visible, measured* effort, on a day from the first day of the window to the runner's today. A window of `n` days is the runner's today and the `n - 1` days before it, on their own calendar (see "The runner's day"). Two kinds of effort never count:

- an effort that is only an estimate (a run with no stream, whose average pace was carried over to the distance), because a curve of what a runner has held has to be made of what they were measured holding;
- an effort the runner hid.

A time the runner typed in (a chip time) counts as they typed it, and the table says so. A dot is placed by how long the effort lasted, on a log scale, and by its pace, the faster the higher. The table under the chart has the same efforts with their run and day, and says whether the line was fitted through each one.

### The line

The model is Monod and Scherrer's critical power model (1965), in the form Hill (1993) and Jones et al. (2010) give it, for running:

```
distance = D' + CS x time
```

`CS`, the critical speed, is the slope: the speed the line says could be held for ever, which no one can, so it is read as a threshold-like pace and not as a pace to race at. `D'` is the intercept: a distance that can be covered above that speed before the runner is spent. The critical pace is `1000 / CS` in seconds a kilometre.

The line is fitted by ordinary least squares (distance on time) through the efforts that lasted **3 to 40 minutes** (180 to 2,400 seconds). Shorter efforts lean on other energy supplies and longer ones fall below the line, so they are drawn but left out of the fit. It takes at least **3** such efforts, and the longest has to last at least **2.5** times the shortest. How good the fit is comes from the worst effort in it: the time the line gives for that effort's distance, `(distance - D') / CS`, against the time it took, in percent of the time it took.

| Status | When |
|---|---|
| ok | the worst effort is no more than 5% off |
| rough | the worst is more than 5% and no more than 10% off: the numbers are shown with a warning |
| no fit | the worst is more than 10% off: no numbers |
| too few efforts | fewer than 3 efforts last 3 to 40 minutes |
| too narrow | the longest effort is under 2.5 times the shortest |
| negative D' | the line would start below zero: the longer efforts are too fast for the shorter ones |

Which durations count, how many efforts it takes, the 2.5 and the two error limits are HermesRuns' conventions: the literature gives ranges, not a rule. For example, efforts that lie exactly on `distance = 200 + 4 x time` are 1 km in 3:20, 1 mile in 5:52, 3 km in 11:40 and 5 km in 20:00; the fit gives back `CS = 4.00` m/s (a critical pace of 4:10 a kilometre) and `D' = 200` m, and the worst effort is 0% off. The half mile (2:31) and the 10 km (40:50) on the same line are drawn but are outside 3 to 40 minutes, so they are left out of the fit.

### Not the same as the training paces

The training paces and zones (see "Training Paces and Training Zones") come from the VDOT, a formula applied to the runner's best runs. The critical pace comes from the runner's own best times over several distances. They are separate estimates, are not meant to agree, and neither feeds the other. The page gives no race predictions: the line is a poor guide over an hour or more, and the predictions have their own page.

### Known limits

- A best effort is only as hard as the run it came from. A runner who has never raced has bests below what they could hold, and the critical pace reads slow.
- The efforts of one run are not independent: the mile and the 5 km of one race share their stretch. A window with one race in it is a line through that race.
- A long window reaches back to fitter or less fit days; a short one may hold too few efforts. The page offers 3, 6 and 12 months and all time for that reason.
- Heat, hills and wind are not taken out of the times.
- A line through three efforts has little room for error: a single poor effort moves it. The worst-effort percentage says when that has happened.

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
a swing of under 3 points is always *even*. This is HermesRuns' own convention to make the number readable, not a measurement,
and the three words do not appear in the answer: the browser works them out.

### The days after today

The dotted stretch is arithmetic, not a forecast: with no load, each average only decays (`fitness x e^(-k/42)`,
`fatigue x e^(-k/7)` after k days), so fatigue falls faster than fitness and form rises.

**Rest days to zero.** Under the chart the card says how many days of no running it would take for form to reach zero: the
first day of the dotted stretch whose form, as printed to one decimal, is 0.0 or more, counting tomorrow as 1
(`restDaysToZeroForm` in `utils/fitnessChart.js`, in the browser). Without load the two averages are equal where
`fitness x e^(-k/42) = fatigue x e^(-k/7)`, that is at k = 8.4 x ln(fatigue / fitness) days for the 42 and 7 days the model
ships with, so a runner at fitness 60 and fatigue 90 has form 0 after 3.4 days and the card says the 4th day. Nothing is
said when form is zero or above already, or when the window does not end today (there is no stretch to read). When none of
the 14 days gets there (fatigue more than about 5.3 times fitness) the card says form would still be below zero after them.
It assumes no running at all and no other change, and is not advice to rest.

### The daily effort bars

Below the form panel a strip draws each day's own effort, the sum of the Effort scores of the day's runs (the number the tooltip calls "Effort that day"), as a bar, so that what fed the lines can be read beside them. It has a scale of its own, because a day's effort is not an average and can be several times either line: from 0 to the smallest round number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten) that is at least the largest day in the window, and never under 10. A day with no run has no bar, and neither does a day after today: the dotted stretch assumes no running. The bar of the day being looked at is drawn in the ink colour, and the day's effort is in the key above the chart, in the tooltip and, for a screen reader, in the list that has every day's figures.

The strip has a switch in the same key as the three lines. It is not a line: the last of the three lines still cannot be switched off, and the bars can always be.

### The change under each number

Each tile says how far its number moved over the last 7 days and over the last 14 days, with an arrow before each. The 7 days come from the server, which works them out from the unrounded series (`fitnessChange7d` and the like). The 14 days are the difference between the number on the last day and the number 14 days before it, **as the chart prints them to one decimal**, so a runner can check one by pointing at the two days on the chart; they are left out when the chart does not reach back 15 days. Fitness also gets the change as a share of what it was 7 or 14 days ago; fatigue and form do not, because fatigue swings too much for a share to mean much and form crosses zero.

The arrow is ↑ or ↓ when the number moved by 3% of where it started or more, and → when it moved by less or when the change prints as 0.0. For form, which can start near zero or below it, the share is taken of the larger of where it started and where it ended. The 3% is the line the chronic-load trend already uses, and the arrow is a HermesRuns convention to point at a change, not a measurement. It is for the eye only: the sign and the words next to it say the same.

### Known limits

- The averages start at zero. A runner whose history starts long after they began running reads low for the first weeks.
- Only runs are counted (HermesRuns only analyses runs): cross-training, strength and walking add no load.
- A run's Effort comes from several sources (heart-rate zones, a rating, an average heart rate, pace). A history made of
  different sources mixes scales a little; the card says how many runs came from each.
- A time zone change moves runs between days (their Effort rows are recomputed when read), so a run can change day.
- The numbers are the runner's own and relative: 140 is not "good" or "bad", it is more or less than before.
- The 7-day change is the server's, from unrounded numbers, and the 14-day change is the difference of two rounded ones, so a figure for the same days can differ by 0.1 in the last digit between them.
- Only the last 14 days are compared. A runner who wants a longer trend reads it off the chart; the range switch above it goes to a year.

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
is a convention of HermesRuns' (Strava does not publish how it sets its range), and the card says what it is.

## Weekly Distance and its Moving Average

Under the weekly effort the Load balance page has a card that draws how far the runner ran in each of the last weeks (12, 26 or 52, 26 to begin with) with a line through the **four-week moving average**. It is worked out in the browser from the run list the page loads (`utils/weeklyDistance.js`): nothing is stored and no endpoint is asked.

A week is Monday to Sunday on the runner's own calendar. A run belongs to the week of its date, read off the text of its start as the other pages do (so an evening run is not moved to the next day). The distance of a week is the sum of the distance of its runs; a run with no distance, or dated after the runner's today, is left out. Every week from the week of the first run to this week is listed, a week with no run as a real zero, and the weeks before the first run are not weeks at all.

```
average of a week = (the distance of the week + the distance of the three weeks before it) / 4
```

It is given to a week that is over and has three weeks of the runner's history before it, so the line begins at the fourth week. The week still going is drawn lighter and dashed, and has no average. Worked example: weeks of 10, 20, 30 and 40 km: the average of the fourth is 25 km. A week of rest inside the four counts as a zero: 20, 0, 20 and 20 km give 15 km.

The three readings above the chart are the week still going (so far), the average of the last four weeks that are over (the average of the last finished week, with the Monday of it) and the highest week that is over in the range (the later one when two are the same, with its Monday). They follow the range chosen, except that the average does not depend on it. The scale is in whole kilometres or miles, as the runner counts.

**What this is not.** It is not a target and it is not a judgement. HermesRuns draws no right distance, no band and no colour for a big week: the weekly effort above has a usual range (a convention of HermesRuns', plus or minus 20% of the three weeks before), and a rule for distance would need a source this card does not have. The average says how much the runner has been running and nothing about how much they should. It is not the "Weekly volume" card of the row above either, which is the last 7 days against the 7 before them, counted from today and not from a Monday.

Known limits:
- A run's distance is the file's: a GPS error counts, and a run edited since is counted as it is now.
- The line is the mean of four weeks, so one very long week lifts it for four weeks.
- The weeks before the first run are not weeks of zero, so a new runner's line begins at their fourth week and a runner who has taken up running again after a long break has the weeks of the break as zeros.
- A week is the runner's own days: a run is in the week that the clock the app has for the runner (the time zone in Settings) puts it in.

## Trends

The Trends page (`/analysis/trends`, linked from Analysis) follows one thing about the runner's runs, run by run, over a period: the pace, the distance, the time, the heart rate, the efficiency or the cadence. It is worked out in the browser from the run list the Analysis page loads (`utils/metricTrend.js`, the picture in `utils/metricTrendPlot.js`, the sentences in `utils/metricTrendWords.js`): nothing is stored and no endpoint is asked. The four choices (the thing followed, which runs, the period and the line) are kept in the address, so a view can be shared and Back leaves the page.

**The value of a run.** For a run with a date, a distance and a moving time:

```
pace        = moving time (s) / distance (km)         shown in seconds a kilometre or a mile
distance    = distance (km)
time        = moving time (s)
heart rate  = the run's average heart rate (bpm), when it is above 40 and under 250
efficiency  = (distance in metres / moving time in minutes) / average heart rate
cadence     = the average cadence the run carries (steps a minute), when it is above 0 and under 300
```

A run with no value for the thing followed (no heart rate, no cadence) is left out, and the page counts them ("Runs with no heart rate are left out: 3"). The pace axis is turned over, so that a quicker pace is higher up and a line that climbs is a runner getting quicker, as it is for every other value. Worked example: 5 km in 25 minutes at an average of 150 bpm is a pace of 300 s/km, a speed of 200 m a minute, and an efficiency of 200 / 150 = 1.33 metres for each heartbeat.

The efficiency is the speed over the heart rate that other tools' aerobic-efficiency measures take, without a scaling constant, so that it has a unit that means something: how far a heartbeat carries the runner. More metres for each beat is the same heart rate at a higher speed, or the same speed at a lower heart rate. It describes a run and does not judge it: it moves with heat, hills, drift and the hour of the day.

**Which runs.** All runs; the ordinary runs, which are those with none of the three types set (race, long run, workout; see "Run Type and Tags"); or the runs of one of the three types. A run counts in a period if its date is in it and is not after the runner's today (the device's date, or the date of the latest run when that is ahead of it by a day or two; see "Weekly Distance and its Moving Average").

**The period.** The last 3 months, 6 months or year end on the runner's today and start on the same day of the month that many months before (31 March a month back is 28 February, or the 29th in a leap year). "All time" starts at the date of the first run that has a value. The stretch before the period is as many months long and ends the day before the period starts; all time has none.

**The middle and the usual range.** The middle is the median of the values of the runs in the period. The usual range is the 10th to the 90th percentile when there are at least 10 runs, and the lowest to the highest with fewer, which is all that can be said of so few. A percentile is worked out between the two nearest values, in proportion:

```
position = (n - 1) x p
value    = x[floor(position)] + (position - floor(position)) x (x[ceil(position)] - x[floor(position)])     (x in ascending order)
```

Worked example: for the values 1 to 10 the 10th percentile is at position 0.9, which is 1 + 0.9 x (2 - 1) = 1.9, and the 90th is 9.1.

**The straight line.** The least-squares line through the runs of the period, with the day across (the hour of a run's start counts as a fraction of a day, so two runs of a day are side by side) and the value up:

```
slope            = sum((x - mean x)(y - mean y)) / sum((x - mean x)^2)         in value a day
a month's change = slope x 30 days
the period's     = slope x (days from the first run to the last)
fit (R squared)  = sum((x - mean x)(y - mean y))^2 / (sum((x - mean x)^2) x sum((y - mean y)^2)),  and 0 when the runs are all the same
```

It needs at least 5 runs spread over at least 14 days; with fewer the page says what is missing and draws no line. The fit is the share of the differences between the runs that the line accounts for, and the page says it in words: under 10% "hardly a trend", under 30% "a loose trend", 30% and over "a clear trend". The two limits are a convention of HermesRuns', chosen so that the words are cautious; they are not a statistical test and do not say that a trend is real. A change that rounds to nothing at the precision it is written to is called level (for a pace or a time, under half a second; for a distance, a heart rate or a cadence, under 0.05; for the efficiency, under 0.005).

Worked example: values 1, 3, 2, 4, 5 at days 0, 10, 20, 30, 40: mean x 20, mean y 3, the sums are 90 (xy), 1000 (xx) and 10 (yy), so the slope is 0.09 a day, 2.7 for a month, and the fit is 90^2 / (1000 x 10) = 0.81.

**The average line.** The other line, for a runner whose pace rose and then levelled off, which a straight line is wrong for. At each run from the 5th on, the mean of the values of the latest 10 runs up to and including it (fewer than 10 for the first ones). The page says where it began and where it is.

**The comparison with the stretch before.** The middle of this period set against the middle of the stretch before it (the same number of months, ending the day before). It needs 3 runs in each; with fewer the page says how many the stretch before has. The change is the middle now less the middle then, written with its direction: quicker or slower for a pace, longer or shorter for a distance or a time, higher or lower for the rest.

**What this is not.** It is not a judgement. HermesRuns draws no good side of the line and no colour for a change: a quicker pace over a lower heart rate is a runner who is fitter, and the same pace in the heat is not, and nothing here knows which it was. The trend line says what the runs did, not what they will do.

Known limits:
- The pace is the moving time over the distance the file gives: a GPS error counts, and the weather adjustment that a run page can show is not applied here.
- The heart rate and the cadence are the averages the run carries; runs from different sources can count a step differently (one foot or both), and a strap that slipped counts as it read.
- Runs of different kinds are in one line unless a set is chosen: a race and an easy run are different paces, so the ordinary runs are the set to read a trend of everyday pace in.
- A straight line is straight: a runner who improved and then stopped improving has a line that is right for neither part; the average line follows them.
- A month in the slope is 30 days, and the periods are calendar months, so a "6 months" period is 181 to 184 days.

## Quality Sessions

Quality Sessions lists manually typed and automatically detected sessions for a period, with their numbers. It is worked out in the browser from the full `/api/activities/analysis` summary history (`utils/qualitySessions.js`), rather than the capped activity feed used by the parent page. The shared resource cache avoids repeat requests. Detection stores no labels. Explicit local demo provenance (`local-shared-runner-bootstrap` or a `local-shared-` provider ID) excludes an activity from sessions, totals and the pace baseline; an activity's name alone never marks it as demo data. The type and period choices stay in the address, so a view can be shared.

**What counts.** Manual run types (see "Run Type and Tags") take priority. Runs without a type are classified automatically for this view; nothing is written back to the run. Workouts and races count by default, with long runs available through the type filter. Automatically detected rows show their reason beside their type.

Automatic detection uses these rules, in order:

- Clear session names identify workouts (for example intervals, tempo, threshold, fartlek, hill repeats, `6 × 800 m`, 间歇 or 节奏), races (`race`, `parkrun` or 比赛, excluding race-pace training), and long runs (`long run`, `LSD`, 长距离 or 长跑).
- Otherwise, at least 16 km or 90 minutes identifies a long run.
- Otherwise, a run of at least 3 km and 20 minutes is a workout estimate when its moving pace is at least 10% faster than the median of at least three earlier ordinary runs in the previous 90 days. Comparable runs have between half and twice its distance. Explicitly named easy/recovery runs do not receive this pace-based classification. Workouts, races and long runs are excluded from the ordinary-pace baseline. Later runs never influence an earlier run's type.

These are product heuristics, not measured workout intent. Uniformly paced history does not automatically produce a fastest-percentile quota of workouts. Pace alone never creates a race classification. Missing or invalid date, distance or moving time excludes a run as before.

**The period.** As for Trends ("Trends", the period): the last 3 months (to begin with), 6 months or year ending on the runner's today, or all time from the first run, with the stretch of the same length before it ending the day before it starts.

**What is read.**

```
sessions          = the runs of the period of a type that counts
a week            = sessions / (the days of the period / 7)
distance in them  = the sum of the distance of the sessions
share             = that / the distance of all the runs of the period
middle pace       = the median of (moving time / distance) of the sessions
the other runs'   = the same for the runs of the period that are not sessions
```

The sessions a week are written to one decimal. A rate under 0.05 (a session every twenty weeks, or fewer) is written "Under 0.1 a week", because "0.0" would read as none.

Against the stretch before, the page gives the number of sessions now less the number then ("2 more"), when the runner ran at all in that stretch. With no run at all in it there is nothing to compare with, which is not the same as no sessions, and the page says so. All time has no stretch before it and shows the latest session instead. Worked example: three sessions of 8, 6 and 10 km in the 93 days from 15 July to 15 October, among 69 km run in all: 3 sessions, 24 km, 24 / 69 = 35% of the distance, and 3 / (93 / 7) = 0.23 a week.

The table lists the sessions newest first: the day, the run (a link to its page, which has the pace chart and the splits of each kilometre), its type, its distance, its moving time, its pace, and the run's average and highest heart rate (a heart rate under 40 or over 250 is a fault of the sensor and is left out).

**What this is not.** It is not a judgement of a session, and it does not read the sections of one. The tool this stands for shows the tempo sections or the repeats of each session, from the laps of the recording, which have to be marked as active; HermesRuns does not keep the laps of a run, so a session is one row and the run's own page has the splits.

Known limits:
- Automatic detection may miss intervals whose whole-run average resembles an easy run, or sessions without a descriptive name or enough earlier history. A manual type overrides the estimate.
- The pace is the whole run's, warm-up and cool-down included: a session of 5 x 1 km inside 10 km has the pace of the 10 km.
- Two sessions on a day are two rows. A race is one session of its own distance.
- The middle pace and the share of a few sessions are those of a few: three sessions are three sessions.

## Time in Zones and the Intensity Distribution

The Load balance page has a card under the weekly effort, "Time in zones": for each of the last 12 weeks, how long the runner's heart rate was in each of their five zones, and one name for how the weeks add up. It is worked out on the server from the time in each zone every run already carries (see "Run Effort and Heart-Rate Zones"). Nothing is stored for it: `GET /api/training/intensity?weeks=12` (1 to 52) adds up the stored rows each time, so it cannot drift from the runs it is made of.

### The weeks

A week is Monday to Sunday on the runner's own calendar (see "The runner's day"). A week's time in a zone is the sum, over its runs, of the seconds those runs spent in the zone. The time a week *covers* is the sum of its five zone times. Only a run with a heart-rate stream has time in zones: a run without one is counted as a run (each week says how many of its runs had a heart rate) and adds no time. A run whose stream covers only part of it adds only that part; unlike the run's effort, it is not scaled up. Weeks before the runner's first run are left out, a week with no run is an empty week, and a week still going is drawn lighter. Each run keeps the zone edges it was worked out with, so after a change of zones the weeks are made of the old and the new edges until the runs are worked out again (the card says how many are still waiting).

### The three bands

```
low      = zones 1 to 3     (below 80% of max heart rate with the default edges)
moderate = zone 4           (80% to under 90%)
high     = zone 5           (90% and above)
share    = seconds in the band / seconds in all five zones
```

The bands are made from the zone *numbers*, so they follow the runner's own edges. They stand in for the three zones of the research behind the index below, which are cut at the first and second lactate or ventilatory thresholds: low is below the first, moderate between them and high above the second. Those thresholds sit at different heart rates in different people, and a percentage of max heart rate is only a rough way to find them.

### The Polarization Index and the names

The Polarization Index is Treff, Winkert, Sareban, Steinacker and Sperlich's (Frontiers in Physiology, 2019):

```
PI = log10( (low / moderate) x high x 100 )     the shares as fractions of one
```

An empty moderate share is taken as 1% so the index has no zero to divide by; no high share at all gives 0; and the index is not defined when the high share is larger than the low one (the paper says it must not be calculated). The paper calls a spread polarized when the index is above 2, and expects low to be the largest share and high to be larger than moderate. For a month of 200 minutes a week, 160 in zones 1 to 3, 10 in zone 4 and 30 in zone 5, the shares are 0.80, 0.05 and 0.15 and the index is log10(240) = 2.38. With 140, 40 and 20 minutes the shares are 0.70, 0.20 and 0.10 and the index is log10(35) = 1.54.

The card gives the weeks together one name, the first of these that applies (`IntensityModel`):

| Name | When |
|---|---|
| not enough yet | fewer than 3 runs with a heart rate, or under one hour of heart-rate time in the weeks |
| threshold | moderate is at least as large as both of the other shares |
| polarized | low is the largest share, high is larger than moderate and the index is above 2 |
| pyramidal | low is the largest share and moderate is at least as large as high |
| high | high is larger than both of the others |
| mixed | anything else (a tie, or low largest with more high than moderate but an index of 2 or less) |

*Polarized*, *pyramidal*, *threshold* and *high intensity* are the names the paper uses (its examples of the last three are 70-20-10, 40-50-10 and 20-10-70). Where the line between two of them falls, for a spread that is none of those exactly, is HermesRuns' reading and is the table above. The card also says what share of the time is above zone 3. About 20% is a common rule of thumb in endurance coaching, from observations of elite endurance athletes (Seiler, 2010: *What is best practice for training intensity and duration distribution in endurance athletes?*, International Journal of Sports Physiology and Performance 5:276 to 291). The card quotes it as a guideline and does not score the runner against it.

### Not the same as the easy and hard share

Analysis also shows an *easy and hard share* (see "Easy and Hard Share, and the Coach Insight"). That one places each *run* in one band by its average intensity, so an interval session lands wherever its average falls, and it works from pace when a run has no heart rate. This card spreads each run's *time* over the zones, so the same session counts its warm-up and rests as low and its hard stretches as moderate and high, and a run with no heart rate adds nothing. The two answer different questions and can disagree; neither is the other's check.

### Known limits

- The zones are percentages of a maximum heart rate. A maximum that is too low or too high moves the time between bands, and the card cannot tell (the zones card on a run's page and Settings say which maximum is in use).
- Heart rate lags effort: a short hard repetition may be over before the heart rate reaches zone 5, so heart-rate time at the top reads lower than the effort was. Wrist sensors add noise of their own, and heat or fatigue raise the heart rate for the same effort.
- Only running counts. Cross-training, strength and walking add no time.
- A runner with a watch on some runs and a phone on the others has weeks made of the watch runs alone; the card says how many runs are left out.
- The index and the names describe a spread of time. They say nothing about whether the spread is right for this runner, and the research they come from is on endurance athletes, not on every runner.

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

The VO₂max estimates page reads the races off the type (see "Your races against the number"): `GET /api/activities/analysis` carries each
run's `runType`, and saving a type loads that list again.

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

### The view

Two things are about how the log is looked at, not about which runs are in it. Both live in the page's address with the filters
(`?runType=RACE&tag=hills&metric=time&to=2026-03-31`), so a view can be bookmarked, and **neither is sent to the server except
`to`**, which is what `GET /api/training/log` already takes.

- **Metric**: distance (the default, nothing in the address), time, climb or effort. It chooses what the seven bars of a week's
  strip show (each day's runs added up in that metric, drawn against the biggest day in that metric among the weeks on the page),
  which total is written beside each day's heading, and which figure is highlighted on each week and each run. Time is moving
  time; a run without a figure (no elevation, not analysed yet) adds nothing, and a day with none shows a dash. Every run shows
  its climb as well as its distance, time, pace and effort, so all four metrics can be read in words; the strip itself is for
  the eye and is hidden from a screen reader, which has the day totals.
- **Jump to a date**: a date field from 1970-01-01 to the runner's today. A whole, real day sets `to`, so the log starts at the
  week of that day and goes back from there. A date still being typed is not a day: typing 2026 passes through 0002, 0020 and
  0202, so only a complete date between the floor and today is passed on, and the field keeps what it holds meanwhile. A day
  after today, or an empty field, does nothing. Once the weeks on screen stop short of today (the newest week ends before it),
  **Show later weeks** is offered above them: it asks for the page of weeks after the newest one (`to` = the end of the newest
  week plus twelve weeks, or today if that is sooner) and puts them in front. **Latest weeks** takes the day out of the
  address and starts again from today; it is offered whenever the log was *started* from a past day (the first weeks that came
  for these filters stopped short of today), also after later weeks have been added up to today, so a jump can always be
  undone. A day in the week going on is not a jump. Earlier and later weeks load independently and each moves the keyboard to
  the first of the weeks it added.

### Known limits

- Whether older runs exist is looked up among the runner's newest 5,000 runs before the window; beyond that the page simply does
  not offer earlier weeks.
- A jump before the runner's first run shows empty weeks and says there is nothing in them or before them; the page does not
  know the date of the first run, so the field cannot refuse it.
- The strip's bars carry no number of their own; the figure is in the day's heading, and in the bar's hover title.
- A run that has not been analysed has no effort and adds none to its week; the page shows it without one.
- The log lists runs only (as the rest of the analysis does); cross-training, strength and walking are not in it.

## Goals

A runner can set a **goal** for a week, a month or a year: so many kilometres, so much time, so many runs or so much climb.
Progress is never stored. It is added up from the runner's runs each time a goal is read, on the runner's own calendar (see
"The runner's day"), so it follows a run that is imported, deleted or moved to another day without anything to keep in step.

### What a goal is

| | |
| --- | --- |
| Period | `WEEK` (Monday to Sunday, as everywhere in the analysis), `MONTH` (a calendar month) or `YEAR` (a calendar year) |
| Metric | `DISTANCE` (km), `TIME` (seconds of moving time), `COUNT` (runs), `ELEVATION` (metres of climb) |
| Target | in the metric's own unit; distance is kept to 10 m, the rest to a whole number; more than zero and at most 100,000 km, a year of seconds, 10,000 runs or 1,000,000 m |

A runner has **at most one goal for each period and metric**: a weekly distance goal and a weekly runs goal can sit side by
side; a second weekly distance goal is refused (409) with "change its target instead". The period and the metric of a goal do
not change; to move a goal to another period or metric, delete it and set a new one. Only runs count (HermesRuns analyses runs
only). A run's day is the day its effort row is filed under when it has one, else the day worked out as in "The runner's day".

### What is worked out

For the period the runner's today is in:

- **progress**: the sum of the metric over the runs from the first day of the period to today, today included; **remaining**
  is the target minus that, nothing once the goal is reached; **percent** is progress over target, rounded down (so 59.99 of
  60 is 99, not 100), over 100 once it is passed.
- **days left** counts today (1 on the last day), and **needed per day** is remaining over days left. It is not given once the
  goal is reached.
- **expected by now** is `target x days gone / days in the period`, where the days gone are the full days before today. A
  weekly goal of 70 km on a Wednesday expects 20 km by the start of the day. **Done by now** is what the runner had done on
  those days. **Status** compares them: `ahead` when done is at least a tenth over expected, `on_track` within a tenth under,
  `behind` below that, `reached` once the goal is met, and `early` on the first day of a period (no full day has passed, so there
  is nothing to judge). Today's run is not held against the runner (the day is not over) and does not count towards "ahead".
  The tenth is HermesRuns' own convention, not a measurement, and is said so on the card.
- **previous** is the period before this one, added up the same way, with whether it would have reached today's target.
- **this run**: `GET /api/goals?runId=` adds to each goal what that run contributes, when it is in the period being judged now
  (a run from last week adds nothing to this week's goal). A run that is not the runner's, or does not exist, is ignored.

One query reads the runner's runs from the start of the period before the oldest period any goal needs to today (a year goal
reads two years), so a request costs the same however many goals there are, and each metric is added up once however many
goals use it.

### Suggested goals

`GET /api/goals/suggestions` reads the same selected plan as `GET /api/coach/today`. A published plan takes precedence; otherwise the personalized running planner uses actual recent running and supported recovery evidence.

- Weekly distance is exactly the shared plan's `targetWeeklyKm`. Weekly runs is exactly its `sessionsPerWeek`. Goal suggestions add no extra growth percentage.
- Historical active-week averages are displayed only as a comparison. They never replace a recovery target with a larger number.
- No monthly, yearly, time or climb target is extrapolated from an unrelated average. Those tracking goals can still be set manually.
- Without recent positive running distance or a confirmed published plan, no numeric personalized target is offered. Invalid or nonfinite inputs do not create a baseline.
- Existing goals are not suggested again. Saving or adjusting a tracking goal preserves the runner's explicit choice and does not silently republish a training plan.

Home, Today, Schedule, routes and Coach Analysis format shared prescriptions. A missing or stale response shows unavailable data, with no browser-generated distance range or readiness score. Future session cards use the server's dated schedule; unknown stage durations stay unknown. Published-plan adapters preserve its actual weekly totals and step paces.

An explicit easier-day request is saved through `POST /api/coach/today/ease`. It reduces the current prescribed distance to 75%, rounded down to a tenth of a kilometre, and reduces its existing duration to 75%. Its weekly budget is reduced by that day's distance difference. Rest and unknown-distance sessions do not become runs. Reset removes the request and regenerates from current evidence; published plans are changed through their own editing flow.

Successful training, activity, wellness and plan changes invalidate cached data and refresh recommendation consumers. Account dates and the selected plan timezone govern stale-prescription checks.

### Known limits

- Goals are for runs. A walk, a ride or a strength session adds nothing.
- A goal is judged from the day the period began, including runs from before the goal was set (a goal set on Thursday counts
  Monday's run).
- Nothing is said when a period ends: the next read is simply about the next period, and "previous" is how the one before went,
  against the target as it is now.
- There is no history of past periods beyond the one before. A suggestion is a rule of thumb (a little more than you usually
  do), not a training plan: it knows nothing about a race, an injury or the season.

## Progression and the Comparison with the Period Before

The Progression card on Home (`utils/progressionAtlas.js`) adds up the runner's runs over a range (all time, 12, 6, 3 or 1
months back from today): total distance, climb, average pace, moving time and the number of sessions, a running total of
distance day by day, and the distance of each week.

### Compare

With **Compare** on, a range of 1, 3, 6 or 12 months is set beside the stretch of the same length just before it: the 3 months
before the last 3 months. All time has nothing before it, so the button is off there and says why.

- **The stretch before** is the same number of calendar months, ending the instant before the current stretch begins. 3 months
  back from 10 October is 10 July; the stretch before is 10 April to 9 July.
- **The line**: the stretch before is drawn dashed on the same chart and the same scale (the scale fits the longer of the two),
  with its running total laid on the current days, day 1 against day 1, so the two lines read against each other. Where one
  stretch is a day shorter (months differ), its line ends where it ends. Moving the scrubber, with a pointer or the arrow keys,
  reads out what the stretch before had added up to by the same day ("Before: 22.0 km").
- **The change** is written under each figure: distance as an amount and a percentage of the stretch before ("10.0 km more
  (+50%)"), moving time, climb and sessions as amounts, and pace as how much faster or slower (a smaller number of seconds per
  kilometre is the faster pace). A change that is too small to mean anything (under 50 m, a minute, a metre, a session, a second
  a kilometre) says "Same as before". A figure one of the stretches does not have (a pace with no runs, a climb neither has) has
  no change under it. More distance, time, climb and sessions, and a faster pace, are shown as the better direction, in words as
  well as colour.
- Compare is a view of the same runs: it changes nothing stored. The choice is kept in the browser.

### Known limits

- Only whole numbers of months are compared; "this week against last week" or a custom range is not offered.
- A run is on the day it was run on the runner's wall (see "The runner's day"); a stretch is judged by those days in the
  browser's own clock for "today".

## Editing a Run

The **Edit** button next to a run's title opens a panel (a drawer from the right on a wide screen, the whole screen on a phone)
with everything a runner can say about a run in one place:

- **Title.** One line, up to 120 characters; spaces of any kind become single spaces. A run cannot be left without a title.
  A title the runner sets is theirs: the run is marked `name_edited`, and a later Strava sync brings Strava's title back for every
  run except the ones that are marked. (Strava's other data on the run, distance and time and the rest, still follows Strava.)
  Setting the title a run already has is not a rename.
- **Notes.** Free text up to 2000 characters, private to the runner: shown under the run's title (folded to a few lines when long),
  read through `GET /api/activities?id=` for that one run and never part of a list, and in the account export. Line breaks are kept.
  Control characters other than tab and line break are refused. Lengths are counted in the unit a browser's `value.length` counts
  (an emoji is two), the same number the counter in the panel shows and the server applies.
- **How it felt, and whether it counts.** The 1 to 10 rating of the Effort card, and a choice to **use it instead of the heart
  rate** for this run's effort (Strava's "use it instead of heart rate"). Without the choice a rating is only used when a run has
  little or no heart-rate data, as before. With it, the effort score is the moving minutes times the rating's weight (1 for a
  rating of 1 to 5 for a rating of 10, evenly between), the source reads *From your rating of N out of 10, as you chose*, and the
  run's effort is recomputed at once (its stored row remembers the choice it was made with, `rating_preferred`, so a row made
  before a change of mind is recomputed when the run is next read, as it is for a changed rating). A choice needs a rating: `useRatingForEffort: true` without one is refused,
  and clearing the rating clears the choice. Only that run's effort changes; the zones, the fitness model and the weekly range
  read the effort rows as they always did.
- **Run type and tags**, as on the Type and tags card (see Run Type and Tags): the same rules and the same words, but a draft
  here, saved with the rest.
- **Shoes**, through the shoe route the gear card uses.

Nothing is saved until **Save changes**. One `PATCH` holds only the fields that changed (a title Strava gave the run is not sent
back as if the runner had chosen it), the shoe has its own request, and a refused request changes nothing. The server applies the
request as one unit (`ActivityEditService`): it takes the run's row first and holds it until the edit has committed, so a request
that fails part-way (the title, the rating and the tags are written together) changes nothing, and two requests for one run take
turns, each changing only the fields it names on the run as it is by then, not on the copy it read earlier. The effort score and
the cached records list are brought up to date after the commit, from the saved run. If the fields are saved
and the shoe is not, the panel says so and keeps the shoe as the one thing left to do. Leaving with something unsaved (Cancel, the
close button, Escape or a click outside) asks first. The panel reads the run afresh each time it opens, so a change made in
another tab is not overwritten by an old draft; the Type and tags card, the Effort card and the run summary on the page follow a
save without a reload, and a rename drops the cached records list (it shows run names).

**Left out on purpose.** Strava's edit page also has privacy, hidden details (start time, calories, heart rate, pace, power),
mute, photos, the sport and the map type. The first four belong to the social side of that product (who can see a run); every
HermesRuns run is private to its runner. HermesRuns analyses runs only, and draws one kind of map.

**Known limits.** There is no history of earlier titles or notes, and no way back to the title a run came with (Strava's title
returns only for runs the runner has not renamed). Two panels open on one run at once save field by field, so the last save of a
field wins, but a field one of them did not touch is never overwritten by it (two saves at the same moment are applied one after the
other, and the tags one of them sets never collide with the other's).

## Run Summary

The run page has a **Run summary**: a headline that says what kind of run it was, and up to four lines that compare it with the
runner's own recent runs, say how it was paced, how the heart rate behaved, how fresh the runner was going in and how hilly it
was. It is made to be checked: every line is the result of a fixed rule over stated numbers, each can be opened to show those
numbers and the rule (the thresholds are the ones in the code, sent with the line), and nothing is generated, guessed or called AI.
A runner can hide the summary on one run, or on every run, and the setting is kept in the browser like the distance unit.

`GET /api/activities/{id}/summary` answers `state: "ready"` with `findings`, or `state: "none"` with `reason: "too_short"` (under
1 km or under 5 minutes moving), and 404 for a run that is not the caller's, not a run, or not there. The server sends findings,
not sentences: each has an `id`, a `variant`, a `tone` (positive, neutral or caution: a colour, never a verdict), a `weight`, the
`facts` it was worked out from (seconds per kilometre, kilometres, seconds, percent) and the `thresholds` of its rule. The browser
words them in the runner's language and distance unit. Nothing is stored; the same run says the same until its numbers, or the
runs around it, change.

### The headline

In this order of trust: what the runner labelled the run (**race**, **workout**: see "Run Type and Tags"), then whether the
kilometre paces vary too much to call it one steady effort (**changes of pace**: the standard deviation over the mean of at least
four full kilometres is above 10%, in grade-adjusted pace when the run had elevation), then the heart-rate zones (**hard** when
zones 4 and 5 hold at least 30% of the time with heart rate, else **easy** when zones 1 and 2 hold at least 70%, else
**moderate**; needs 10 minutes of heart rate), then the effort against the usual (**hard** at 1.25 times the usual or more,
**easy** at 0.75 or less, else **moderate**), else it says it cannot tell. A run the runner called a workout is never called
steady, and a run with changes of pace is not called easy because its heart rate was low on average.

### The lines

The most worth saying come first; a line that only says "as usual" is shown only to make up two lines when fewer than two say
something more; at most four lines.

| Line | Says | Rule | Needs |
| --- | --- | --- | --- |
| longest (3) | the longest run of the last 4 weeks | longer than every non-workout run in the 28 days before, and at least 5 km | 4 such runs |
| effort (3 / 2 / 1) | higher, lower or typical against the usual effort; **hardest** when it is above all the runs it is compared with | the median Effort of the runner's earlier runs of the same kind in the 90 days before (for runs that are not workouts, also 70% to 140% of this run's distance); 1.25 times or more is higher, 0.75 or less lower; hardest needs 8 runs and more than all of them | 5 runs (workouts: 3 workouts of any length); not for a race |
| drift (3 / 2 / 1) | how much more heart rate the second half took for the same pace | the existing efficiency drift of the run page: above 5% a slight rise, above 10% a high one, below that low | 20 minutes, a heart-rate stream; not for a workout |
| shape (2 / 1) | the second half faster (**negative split**), slower (**faded**) or about the same (**even**) as the first | the mean pace of the second half of the full kilometres against the first (the middle one left out when odd), at least 2% apart; grade-adjusted pace when every kilometre has it, and the line says which | 4 full kilometres, not varying by 10% or more, not a workout |
| pace (2 / 1) | faster, slower or about the same as the recent runs | this run's pace against total time over total distance of the runs of the last 30 days that are neither workouts nor races and are 70% to 140% of its distance; 3% or more apart is faster or slower | 3 such runs; not for a workout or a race |
| form (2) | **fresh** or **tired** going in | fitness, fatigue and form at the end of the day before (see "Fitness, Fatigue and Form"): the same words as the fitness card, a swing of under 3 points says nothing | 14 days of effort before the run |
| climb (2) | **hilly**, with the grade-adjusted pace when it is 5 s/km or more from the clock pace | 12 m of climb a kilometre or more | elevation |

(The number in brackets is the weight. Hilly runs make raw paces differ, which is why the pacing line and the headline use the
grade-adjusted pace when there is elevation.)

### What it will not say

- A race is not compared with training, and a workout gets no pace, pacing or heart-rate verdict; its effort is compared with the
  runner's other workouts only.
- A run whose kilometres vary by more than 10% gets no "even" or "faded", and is not called steady.
- Nothing is said from fewer runs than the rule needs; with too little to compare with, the summary is the headline alone, or says
  it cannot tell how hard the run was.
- Nothing about health, injury or what to do tomorrow.

### What is read

One run, its stream once (the pace profile and the drift), one query of the runner's runs of the 90 days before (the same rows
as the training log), the run's effort row, and, for the form, one read of the effort series. Only the runner's own runs.

### Known limits

- Runs are compared by length (70% to 140%) and kind only; terrain, weather and time of day are not taken into account, except
  that the pacing line uses grade-adjusted pace.
- Effort scores from different sources (heart-rate zones, a rating, pace) are compared as they are; see "Run Effort and Heart-Rate
  Zones".
- The usual effort and pace are those of the runs HermesRuns has; a runner who has just imported a long history sees summaries as
  good as the history, and one with a short history sees fewer lines.

## Today's Call and Readiness

Today, the Schedule and the Home card show one **call** for the day: a kind of session (rest, recovery, easy, long run, tempo, threshold or intervals), a distance, a pace range and a reason. The server works it out with fixed rules from the runner's runs, a readiness score, an injury-risk check and a saved race. The same inputs always give the same plan (`PersonalizedRunningPlanner` is pure, and `identicalInputsProduceIdenticalPlans` holds it to that). No model writes any of it and nothing in it is random. The browser puts the result into words, adds the heat adjustment to the pace, and shows the numbers the rules used.

### When it is worked out

After every run that is imported (the next 14 days are planned again), whenever Today, the Schedule or the coach state is read, and once a night for every runner who has a run (03:00 server time). A day that already has a completed run keeps what it has. A future day is not a promise: it is worked out again from the inputs of the day it is read, so it can change.

### What goes in

The server reads the runner's last 90 days of runs, with windows of 28 and 7 days ending on the server's date.

| Input | How it is worked out |
|---|---|
| Runs ever, days with a run | the number of runs; the number of different days with a run in the last 28 days |
| Distance, last 7 and 28 days | the sum of the runs' distances |
| Average run, longest run | the 28-day distance divided by the number of runs in the 28 days; the longest run in the 28 days |
| Average pace | the 28-day moving seconds divided by the 28-day kilometres: the runner's own pace, not a VDOT pace |
| Share run hard, last 7 days | the minutes of the last 7 days' runs whose own peak heart rate was 88% of the maximum heart rate or more, divided by the minutes of runs that have a recorded peak. The run's peak decides for the whole run |
| Hours since the last hard run | now minus the start of the latest hard run. A run is hard when its peak heart rate is 88% of the maximum or more, or it is 16 km or longer, or it lasted 90 minutes or more |
| Days since the last run | calendar days |
| Weekdays | how many runs there were on each weekday in the 28 days |
| Maximum heart rate | the value saved in Settings when it is over 120; otherwise the highest peak in the last 90 days when it is over 140; otherwise 190 |
| Readiness | next section |
| Injury risk, soreness | the server's check (see "Injury Risk") |
| Goal | the active training block, else the nearest race with a date of today or later that is neither cancelled nor completed: its distance, date and goal time |

### Readiness

A score from 0 to 100 and a verdict, from up to five parts (`ReadinessService`). Each part is scored 0 to 100 on its own:

| Part | Weight | From | Scored as |
|---|---|---|---|
| Sleep | 28% | today's sleep score from a connected device or a check-in | the score |
| Heart-rate variability | 24% | last night's average (ms) or the device's status | status BALANCED 85; LOW, POOR or UNBALANCED 45. Otherwise against the runner's own baseline (the mean and standard deviation of the 28 days before, when at least 5 of them have a value and half the deviation is over 0.5 ms): at least two half-deviations below the mean 45, at least one below 60, less than one above 75, otherwise 85. With no baseline: 80 ms or more 85, 55 or more 75, 35 or more 60, below 35 45 |
| Resting heart rate | 14% | last night's resting heart rate against the resting heart rate saved in Settings | 3 bpm or more lower 85; up to 2 higher 78; 3 to 6 higher 62; more than 6 higher 45. With no saved value: 50 bpm or less 82, up to 60 75, above 60 60 |
| Stress | 14% | the day's overall stress level (0 to 100) | 100 minus the stress level |
| Training load | 20% | the runner's runs of the last 42 days | below |

```
training load part = 78
                     + 7  if the server load ratio is from 0.8 to 1.3
                     − 8  if it is above 1.3, − 25 if above 1.5, − 33 if above 1.65
                     − 8  if the weekly monotony is above 2.0, − 15 if above 2.5
                     − 5  if a hard run ended less than 48 hours ago, − 10 if less than 24 hours ago
                     (kept between 30 and 90; none when there are no runs in the window)

available weight W = the sum of the weights of the parts that have data
score              = round( weighted mean of those parts × W + 75 × (1 − W) )
```

A part with no data is left out, and the score is pulled toward 75 by as much as is missing: partial data moves the score without freezing it at neutral. With no data at all the score is 75 and the confidence 0; the confidence on screen is W as a percentage. The weekly monotony is the mean of the last 7 days' server load units divided by their standard deviation (rest days count as zero; at most 3.0).

| Score | Verdict (as the page words it) |
|---|---|
| 85 or more | GO (Good to go) |
| 70 to 84 | EASY (Take it easy) |
| 50 to 69 | RECOVERY (Recovery day) |
| under 50 | REST (Rest day) |

For each part the reading comes from the source the runner chose in Settings, else from the source with the most usable value, with ties broken by device (Garmin and Oura first, then Apple Health, Google Health, COROS, Huawei). A manual check-in is stored as a reading for its own day only; it does not carry into tomorrow. The Today page draws four meters (sleep, HRV, resting heart rate, stress) and, under "How this score is worked out", lists all five parts, including the training load, with their weights.

**A runner with no device or check-in data has only the training load part** (W = 0.20), so the score is `0.2 × the training load part + 60`, which can only be between 66 and 78. Their verdict is EASY or RECOVERY, never GO and never REST, and the page says the score is estimated from running history only.

### The phase

The plan has one phase, the first of these that applies:

| # | Phase | When | The weekly target is the 28-day weekly average times |
|---|---|---|---|
| 1 | race | today is the date of the goal race | 0.75 |
| 2 | protect | injury risk is HIGH, or today's soreness is HIGH, or the readiness verdict is REST | 0.55 |
| 3 | comeback | 14 or more days since the last run | 0.65 |
| 4 | onboarding | fewer than 3 runs | 1.0 |
| 5 | taper | a goal race 0 to 14 days away | 0.70 |
| 6 | absorb | the distance ratio is above 1.30 (last 7 days ÷ the 28-day weekly average) | 0.80 |
| 7 | rebalance | more than 20% of the last 7 days' running minutes were hard | 0.90 |
| 8 | build | otherwise | 1.05 |

The weekly target is the larger of a floor and that product, and with a 28-day history it is never more than 1.10 times the weekly average (but not below the floor). The floor is 6 km in protect, 9 km in comeback and onboarding, and the smaller of 18 km and 3 km a session otherwise. The weekly average is the 28-day distance divided by 4 (else the average run times the sessions a week, else 12 km). The sessions a week are the run days of the last 28 divided by 4, rounded, between 3 and 6; protect has at most 3; onboarding and comeback have 3.

### The week

- **Run days.** The runner's most frequent weekdays of the last 28 days; ties are taken in the order Tuesday, Thursday, Sunday, Saturday, Wednesday, Friday, which also fills up the days a runner has not used. With 3 or more sessions and no weekend day among them, the last one chosen is replaced by Sunday. The long-run day is the weekend day among them the runner uses most (Sunday on a tie), else the last day; the quality day is the weekday, other than the long-run day, the runner uses most, else the first day. Every other day is rest (reason `scheduled_rest`).
- **The session on a run day.**

| Phase | Session |
|---|---|
| protect | recovery run |
| onboarding, comeback | easy |
| absorb | easy on the long-run day, recovery on the others |
| rebalance | long run on the long-run day, easy on the others |
| taper | tempo on the quality day when the race is more than 3 days away, easy otherwise |
| build, race | long run on the long-run day; threshold (with a goal race) or tempo (without) on the quality day; easy on the others |

  The race day itself is a long-run session of exactly the race distance.
- **Distance.** With `a` the average run (or the weekly target divided by the sessions a week when there is no history): recovery `a × 0.65`, between 3 and 10 km; easy `a × 0.90`, between 4 and 16; tempo, threshold and intervals `a × 1.05`, between 5 and 18; the long run the larger of `a × 1.6` and 0.95 times the longest run of the 28 days, between 8 and 32, and with a goal race at most 0.75 of its distance (and at least 8). Then onboarding is capped at 5 km, comeback at 6, protect at 5, and taper is multiplied by 0.75.
- **Pace.** From the runner's own average pace `p` (seconds per km): recovery `p + 50` to `p + 95`; easy `p + 20` to `p + 60`; long run `p + 15` to `p + 50`; tempo `p − 20` to `p + 5`; threshold `p − 35` to `p − 10`; intervals `p − 60` to `p − 25`. With a goal time, tempo and threshold are no slower than the goal pace plus 20 seconds, and their fast end is no slower than the goal pace. Never faster than 2:00 per km, at least 5 seconds wide. The browser adds the heat adjustment. **These are not the VDOT training paces.**
- **Duration** is the distance times the middle of the pace range (360 seconds per km when there is no pace), at least 20 minutes.
- **Confidence** of the plan: 30, plus 2 for each run ever (at most 35), plus 10 when there is an average pace, plus 15 when readiness has data, plus 10 with a goal race; between 30 and 95. It says how much the plan had to go on, not how likely it is to be right.

### Today's session: the last adjustments

Only for today, the first that applies:

1. In the protect phase today is a **rest day** when the readiness verdict is REST and the injury risk is not HIGH, otherwise a recovery run. The reason is `injury_protect` when the injury risk or the soreness is HIGH, else `readiness_protect`.
2. A hard session (tempo, threshold, intervals) when a hard run ended less than **36 hours** ago becomes easy (`recovery_after_hard`).
3. A hard session when the readiness verdict is EASY or RECOVERY becomes easy (`readiness_protect`).

So a hard session is kept today only when the verdict is GO, a score of 85 or more. The session that was planned is kept with the plan (`mutatedFrom`) and the Today page says "Changed from … to …" with the reason.

### The reasons

Each day carries one reason code, and the plan carries a few more. Today shows the reason in a sentence with the numbers the rule used next to it (from `plan.reasonFacts`):

| Code | When | Numbers shown with it |
|---|---|---|
| `scheduled_rest` | a day that is not a run day | run days in the last 28; sessions a week |
| `injury_protect` | protect, because the injury risk or the soreness is HIGH | the injury risk; today's soreness |
| `readiness_protect` | protect because the verdict is REST; or a hard session made easy because the verdict is not GO | the readiness score and verdict; the parts under 70 |
| `onboarding` | fewer than 3 runs | the runs so far |
| `comeback` | 14 or more days since the last run | the days since |
| `high_load` | the absorb phase | the 7-day distance, the 28-day weekly average, their ratio and the 1.30 line |
| `intensity_rebalance` | the rebalance phase | the share run hard and the 20% line |
| `race_taper` | the other days of the taper | the days to the race |
| `race_day` | the day of the race | the race distance |
| `aerobic_progression` | the long run in build | the average run, the longest run of the 28 days, the cap |
| `goal_specific` | the quality day with a goal race | the days to the race, its distance, the goal pace |
| `quality_window` | the quality day without a goal | the 28-day weekly average and this week's target |
| `build_consistency` | any other run day in build | the same |
| `recovery_after_hard` | a hard session made easy by a hard run under 36 hours ago | the hours since, and the 36-hour line |

The plan-level extras are `readiness_data` (the score and verdict, when readiness has data), `load_data` (the 7- and 28-day distances) and `goal_specific`.

### What Today shows

The readiness score, the verdict and four meters (with the five parts under "How this score is worked out"); the session, distance, pace range and estimated time; "Changed from … to …" when the plan changed today's session; a briefing built from fixed sentences (a greeting, the VDOT, the load ratio, the recovery hours, the plan's type and its reason); under "Training context" the reasons with their numbers and the share of the last 7 days run hard; and three cards: VO₂max with the recovery estimate, **Load balance** (the load ratio of "Training Load and the Load Ratio", not the distance ratio the plan uses), and the shoe suggestion.

### When the server sends no session

If the shared prescription is missing or belongs to another account-calendar day, all running recommendation views show it as unavailable. The browser keeps descriptive run analytics, but does not prescribe its own replacement distance, pace, or extra sessions. Missing recent running history produces the server reason history_required and no numeric running target.

### Known limits

- With no device or check-in data a runner's readiness is between 66 and 78 (see above), so a hard session that falls on today always becomes easy, although the Schedule still shows it as planned for the days ahead. The page words this as conservative; it is a limit, not a measurement of the runner.
- Coach history and daily prescriptions use the account calendar. A selected published plan uses its captured timezone, which is included in the shared response.
- The share run hard is decided by each run's peak heart rate, not by time in zones, so one sprint at the end of an easy run can make the whole run count as hard.
- The plan's paces are the runner's own recent pace plus or minus fixed seconds. A runner who runs every run fast gets fast "easy" targets.

## Injury Risk

Two checks carry this name, and they are not the same number.

**The server's check** (`InjuryRiskService`). The Analysis card shows its score and level, and the plan reads its level and today's soreness.

```
points = 3 if the server load ratio is 1.5 or more, 2 if 1.3 or more, 1 if 1.18 or more
       + 3 if the soreness logged today is HIGH, 2 if MEDIUM, 1 if LOW
level  = HIGH from 5 points, MODERATE from 3, LOW below
score  = round(points / 6 × 100)
```

Soreness is what the runner logs for today on the Analysis page; with no entry it adds nothing. The server load ratio is the pace-only one (see "Training Load and the Load Ratio"). The trend (rising, falling or flat) compares it with its value 7 days earlier, with 0.10 as the line. The sentence beside the card is a fixed text for each level (two for HIGH).

**The browser's insight** (`buildInjuryInsight`). The coach-insight sections on Analysis use it; the card's level is replaced by the server's once the server has answered.

```
score = 6
      + 28 if the load ratio is 1.35 or more, else 16 if 1.18 or more
      + 24 if the average cadence of the last 14 days is 2% or more below the 28 days before them, else 12 if 1% or more
      + 26 if heart rate × pace ÷ 300 s/km is 4.5% or more above the same earlier runs, else 14 if 2% or more
level = HIGH from 72, MODERATE from 46, LOW below
```

Only runs of at least 4 km and 20 minutes count, and the comparison needs runs in both stretches (cadence and heart rate are skipped when a stretch has none).

### Known limits

- Neither check diagnoses anything. Both turn a load ratio and a few signals into a level with fixed points, and the points are HermesRuns' own conventions.
- The two can disagree: they use different load ratios, different lines and different extra signals (the server's has soreness, the browser's has cadence and the cost of heart rate).

## Easy and Hard Share, and the Coach Insight

Analysis shows how the last 28 days of running time (moving seconds) split into easy, moderate and hard (`buildPolarized`). Each run is placed by its intensity, the same `vo₂Fraction` as in the Effort Score: below 75% of VO₂max is easy (the recovery and easy zones), 75% to under 83% moderate (marathon), and 83% or more hard (threshold, interval and repetition). The *easy* and *hard* percentages in the insight leave the moderate share out (`easy ÷ (easy + hard)`).

The time in heart-rate zones is a separate analysis, on the Load balance page (see "Time in Zones and the Intensity Distribution"): it spreads each run's *time* over the zones instead of placing each run by its average, and the two can disagree.

The coach insight is the first of these that applies (`buildCoachInsight`):

| Insight | When |
|---|---|
| protect | the injury level is high |
| absorb | the load ratio is above 1.30 |
| rebalance | hard is 32% or more of the easy and hard time |
| press | the marathon prediction is faster than the time a VDOT 1.2 lower would give |
| build | otherwise |

The three "coach system" sections on the insight page use their own lines: the load section is *protect* when the injury level is high or the load ratio is 1.35 or more, *absorb* from 1.18, else *build*; the mix section is *rebalance* at 32% hard, *balanced* at 75% easy; the forecast is *reset* when the injury level is high; else *press* when the VDOT rose by more than 0.4 (the last three estimates against the three before) or the marathon prediction is faster than the VDOT − 1.2 time; else *reset* when the VDOT fell by more than 0.4 or the marathon time is more than 45 seconds slower; else *hold*.

These are labels from fixed lines, not forecasts. The marathon prediction is nearly always faster than the time of a VDOT 1.2 lower (unless a run of 34 to 50 km in the last 90 days pulls it slower), so *press* is the default when nothing else applies and *build* is rare.

## Heat and the Pace Adjustment

The server (`AcclimatizationService`, `GET /api/v1/weather/context`) works out how much slower to run in humid heat from the dew point: Open-Meteo's daily mean for past days and its current value for today, at the place of the runner's latest run with a GPS track (or the device's location when the weather page asks).

```
full adjustment = round( (today's dew point − 13 °C) × 2 ) seconds per km, between 0 and 30
acclimatization = the days since the first day of the last 14 whose dew point was above 13 °C:
                  days 1 to 3 count in full, days 4 to 9 fade by a sixth a day, from day 10 the adjustment is 0
adjustment      = round( full adjustment × that factor )
```

The page compares today with a baseline, the mean dew point on the days the runner ran in the last 14 (the mean of all those days when there was no run, 15 °C with no data). A day 4 °C or more above it is flagged as a heat shock, and 26 °C or more as extreme heat stress. The coefficient (2 seconds per km for each degree above 13 °C) is HermesRuns' reading of published dew-point pace tables, whose impact starts around a 13 °C dew point, and of heat-and-endurance studies (Cheuvront et al. 2010; Roecker et al. 2013). It is not a measurement and it knows nothing about the runner's own heat tolerance.

Today adds the adjustment to the target pace and shows the normal pace beside it. Each run also keeps an adjustment of its own, worked out when it is imported (for the run's day, and at the place of the runner's *latest* run with a track, which is not always where that run was); the weather-adjusted VDOT and the weather-adjusted prediction use it.

## Shoes

### Mileage

```
mileage = round( (the distances of the runs assigned to the shoe + its starting mileage) × 100 ) / 100       (km)
```

A run's distance is its kilometres, or its metres divided by 1000 when it has no kilometre value. Every activity assigned to the shoe counts, whatever its date, and the server works the figure out each time the shoe is read. The account export has the inputs: `runs.csv` has a `shoe` column and `shoes.csv` has `initial_distance_km`.

### Health, and when to retire a shoe

There is no single rule. The three places that use a lifespan assume different ones when the shoe has no maximum mileage set:

| Where | Lifespan used | What it says |
|---|---|---|
| Today's shoe card and the shoe health function (`predictRetirement`) | the maximum set on the shoe, else by type: daily and stability 800 km, speed 600, trail 650, race 500, anything else 800 | health = (lifespan − mileage) ÷ lifespan: *Healthy* above 50%, *Wear noted* above 20%, *Replace soon* at 20% or less. With 2 or more runs in the last 30 days, the days left are the remaining kilometres divided by the 30-day distance on that shoe per day |
| The Shoes page | the maximum set on the shoe, else 650 km | the bar is green below 70% of the lifespan, amber from 70%, red from 90%; a shoe is counted as "retire soon" at 70% of the lifespan, or within 100 km of it, or within 30 days of it |
| The server's shoe suggestion | the maximum set on the shoe, else 800 km | shoes past it are skipped |

### Suggestions

- **Today's shoe card** (browser, `utils/shoeRotation.js`): from the last 21 days of runs. If a shoe's heart rate at the same pace is more than 0.8 bpm lower than other shoes' at that pace (3 or more runs of at least 4 km on the shoe, and 2 or more at that pace for it and for the others), it is suggested for that. Otherwise the shoe with the best score among those used lately: a score by role (trainer 7, stability 6, speed 3.5, trail 2, unknown 1, race −6), plus its remaining life (×4), its recent use (up to 4 runs × 1.1 and 30 km × 0.08), how recently it was worn (up to 2), 0.75 for the primary shoe, minus 3 or 6 when under 30% or 15% of its life is left. A runner with no active shoes who has run in the last 21 days is shown a pick from a fixed list of well-reviewed shoes (`REDDIT_RECOMMENDED_SHOES`), chosen by their average pace and rotating by the day of the year.
- **The server's suggestion** (`ShoeTrackerService.recommendShoe`): tempo, threshold and intervals pick a speed shoe, the rest a daily shoe; on a surface hint it prefers the least recently worn shoe of that surface; otherwise the primary shoe, else the one with the lowest mileage.
- **Rotation health** (the Shoes page): the share of the active shoes worn in the last 21 days, with *excellent* from 80% (or 3 different shoes), *good* from 50% (or 2), otherwise *stale*; it says nothing with one shoe or fewer than 3 recent runs.

### Known limits

- The suggestions are heuristics with hand-set weights, not a measurement of fit or wear.
- A shoe's real life depends on the runner, the surface and the shoe; the lifespans above are common rules of thumb.

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

### Pace zones from a race

A runner who has not run hard lately, or who knows what a recent race said about their fitness, can cut the pace zones from
that race instead. It is one race at a time, entered in Settings > Training > Pace zones:

- **The race** is a distance (5K, 10K, half marathon, marathon, or any distance from 1.5 km to 100 km, typed in the
  runner's unit), a time (`mm:ss` or `h:mm:ss`, from 4 minutes to 24 hours) and the day it was run (not in the future, not more
  than five years back). The time over the distance must be a pace between 2:00 and 20:00 a kilometre; nobody has run
  outside that. Entering another race replaces the first; removing it goes back to the runner's runs.
- **The fitness** is the VDOT the race stands for, worked out in the browser with the same function as the rest of the analysis
  (`calculateVdot`, Daniels and Gilbert's oxygen-power model), to one decimal. The server stores only the three numbers, never
  the VDOT, so there is one copy of the arithmetic. The six zones are then cut from that VDOT as above.
- **Which runs follow it.** A run on or after the race date uses the race's zones; a run before it keeps the zones it had going
  into it, from the runner's runs (the 90 days before it, or today's if nothing came before). The run's day is the runner's own
  day, read from the run's start as the run page writes it, so a run on the day of the race counts whatever time it started. A
  run with no usable date has nothing to place it by and gets the race's zones. The run page says which it used: "Zones are cut
  from 10K in 45:00 on Sep 20, 2026 (VDOT 45.3), which you entered in Settings."
- **Settings shows both.** The card says where today's zones come from, previews the zones a typed race would give (and says
  nothing changes until the runner uses it), and says when the race is more than about six months old, since an old result says
  less about today's pace. It never decides anything for the runner: an old race stays in force until they replace or remove it.
- **What it does not touch.** Only the pace zones follow the race: the Analysis page's training paces, the race predictions,
  Effort, fitness and form, and the heart-rate zones all keep working from the runner's runs and settings.
- **Where it is kept.** The table `runner_pace_zone_race` (one row a runner, see
  [m8-schema-upgrade.md](deployment/m8-schema-upgrade.md)), `GET`, `PUT` and `DELETE /api/training/pace-zones`, the account
  export (`pace-zone-race.csv`), and the account deletion. The refusals are the server's (`PaceZoneRaceService`) and the limits
  come with the form, so the page says each one in the runner's language. Two requests from one runner at once take turns on the
  runner's row, so the second replaces the first and neither fails.

### Known limits

- A GPS jump in the distance stream moves the split boundaries after it, as it inflates the run's distance; the
  smoothed line shows no pace for a window with an impossible one.
- A race sets the pace zones of the whole of a day: a warm-up run on the morning of the race gets the race's zones as well. There
  is one race at a time, no history of earlier ones, and no separate race for the road, the track or the trail.
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

### The view

Two things are about how the log is looked at, not about which runs are in it. Both live in the page's address with the filters
(`?runType=RACE&tag=hills&metric=time&to=2026-03-31`), so a view can be bookmarked, and **neither is sent to the server except
`to`**, which is what `GET /api/training/log` already takes.

- **Metric**: distance (the default, nothing in the address), time, climb or effort. It chooses what the seven bars of a week's
  strip show (each day's runs added up in that metric, drawn against the biggest day in that metric among the weeks on the page),
  which total is written beside each day's heading, and which figure is highlighted on each week and each run. Time is moving
  time; a run without a figure (no elevation, not analysed yet) adds nothing, and a day with none shows a dash. Every run shows
  its climb as well as its distance, time, pace and effort, so all four metrics can be read in words; the strip itself is for
  the eye and is hidden from a screen reader, which has the day totals.
- **Jump to a date**: a date field from 1970-01-01 to the runner's today. A whole, real day sets `to`, so the log starts at the
  week of that day and goes back from there. A date still being typed is not a day: typing 2026 passes through 0002, 0020 and
  0202, so only a complete date between the floor and today is passed on, and the field keeps what it holds meanwhile. A day
  after today, or an empty field, does nothing. Once the weeks on screen stop short of today (the newest week ends before it),
  **Show later weeks** is offered above them: it asks for the page of weeks after the newest one (`to` = the end of the newest
  week plus twelve weeks, or today if that is sooner) and puts them in front. **Latest weeks** takes the day out of the
  address and starts again from today; it is offered whenever the log was *started* from a past day (the first weeks that came
  for these filters stopped short of today), also after later weeks have been added up to today, so a jump can always be
  undone. A day in the week going on is not a jump. Earlier and later weeks load independently and each moves the keyboard to
  the first of the weeks it added.

### Known limits

- Whether older runs exist is looked up among the runner's newest 5,000 runs before the window; beyond that the page simply does
  not offer earlier weeks.
- A jump before the runner's first run shows empty weeks and says there is nothing in them or before them; the page does not
  know the date of the first run, so the field cannot refuse it.
- The strip's bars carry no number of their own; the figure is in the day's heading, and in the bar's hover title.
- A run that has not been analysed has no effort and adds none to its week; the page shows it without one.
- The log lists runs only (as the rest of the analysis does); cross-training, strength and walking are not in it.

## Goals

A runner can set a **goal** for a week, a month or a year: so many kilometres, so much time, so many runs or so much climb.
Progress is never stored. It is added up from the runner's runs each time a goal is read, on the runner's own calendar (see
"The runner's day"), so it follows a run that is imported, deleted or moved to another day without anything to keep in step.

### What a goal is

| | |
| --- | --- |
| Period | `WEEK` (Monday to Sunday, as everywhere in the analysis), `MONTH` (a calendar month) or `YEAR` (a calendar year) |
| Metric | `DISTANCE` (km), `TIME` (seconds of moving time), `COUNT` (runs), `ELEVATION` (metres of climb) |
| Target | in the metric's own unit; distance is kept to 10 m, the rest to a whole number; more than zero and at most 100,000 km, a year of seconds, 10,000 runs or 1,000,000 m |

A runner has **at most one goal for each period and metric**: a weekly distance goal and a weekly runs goal can sit side by
side; a second weekly distance goal is refused (409) with "change its target instead". The period and the metric of a goal do
not change; to move a goal to another period or metric, delete it and set a new one. Only runs count (Hermes analyses runs
only). A run's day is the day its effort row is filed under when it has one, else the day worked out as in "The runner's day".

### What is worked out

For the period the runner's today is in:

- **progress**: the sum of the metric over the runs from the first day of the period to today, today included; **remaining**
  is the target minus that, nothing once the goal is reached; **percent** is progress over target, rounded down (so 59.99 of
  60 is 99, not 100), over 100 once it is passed.
- **days left** counts today (1 on the last day), and **needed per day** is remaining over days left. It is not given once the
  goal is reached.
- **expected by now** is `target x days gone / days in the period`, where the days gone are the full days before today. A
  weekly goal of 70 km on a Wednesday expects 20 km by the start of the day. **Done by now** is what the runner had done on
  those days. **Status** compares them: `ahead` when done is at least a tenth over expected, `on_track` within a tenth under,
  `behind` below that, `reached` once the goal is met, and `early` on the first day of a period (no full day has passed, so there
  is nothing to judge). Today's run is not held against the runner (the day is not over) and does not count towards "ahead".
  The tenth is Hermes' own convention, not a measurement, and is said so on the card.
- **previous** is the period before this one, added up the same way, with whether it would have reached today's target.
- **this run**: `GET /api/goals?runId=` adds to each goal what that run contributes, when it is in the period being judged now
  (a run from last week adds nothing to this week's goal). A run that is not the runner's, or does not exist, is ignored.

One query reads the runner's runs from the start of the period before the oldest period any goal needs to today (a year goal
reads two years), so a request costs the same however many goals there are, and each metric is added up once however many
goals use it.

### Suggested goals

`GET /api/goals/suggestions` offers goals worth setting, worked out from the runner's own running (the rule is the same for
everyone, and every suggestion carries the numbers it comes from, so the card can show its working):

- **A usual week** is the mean of the weeks that had a run among the last 8 complete weeks (Monday to Sunday, not the one that
  is still going). A week with no run is a holiday or an injury, not a short week, so it does not lower the bar.
- **Nothing is suggested** before there are at least 4 active weeks and 6 runs in those 8 weeks; the card then says what it
  takes (`enough: false`).
- **Weekly distance**: the usual week plus 10%, rounded to a number a person would pick (a kilometre under 20 km, 5 km up to
  60, 10 km up to 200, 25 km up to 600, 50 km up to 2,000, 100 above) and always above the usual week.
- **Weekly runs**: the usual number of runs in an active week, between 2 and 7; more runs is not what a runner of three runs a
  week is asking for.
- **Monthly distance**: the average of the last 3 complete calendar months that had a run (at least 2 of them), plus 10%.
- **Yearly distance**: the distance of the last 365 days (a runner who ran in at least 6 of the 12 months), plus 5%.
- **Weekly time**: the usual week's moving time plus 10%, to the quarter hour, at least half an hour.
- **Weekly climb**: only for a runner whose usual week climbs 100 m or more; plus 10%, to 50 m.
- A goal the runner already has is not suggested, and the card shows three at a time, in that order. "Set this goal" saves the
  target as it is; "Adjust" opens the dialog filled in. The arithmetic runs on the server and nothing leaves it.

### Known limits

- Goals are for runs. A walk, a ride or a strength session adds nothing.
- A goal is judged from the day the period began, including runs from before the goal was set (a goal set on Thursday counts
  Monday's run).
- Nothing is said when a period ends: the next read is simply about the next period, and "previous" is how the one before went,
  against the target as it is now.
- There is no history of past periods beyond the one before. A suggestion is a rule of thumb (a little more than you usually
  do), not a training plan: it knows nothing about a race, an injury or the season.

## Progression and the Comparison with the Period Before

The Progression card on Home (`utils/progressionAtlas.js`) adds up the runner's runs over a range (all time, 12, 6, 3 or 1
months back from today): total distance, climb, average pace, moving time and the number of sessions, a running total of
distance day by day, and the distance of each week.

### Compare

With **Compare** on, a range of 1, 3, 6 or 12 months is set beside the stretch of the same length just before it: the 3 months
before the last 3 months. All time has nothing before it, so the button is off there and says why.

- **The stretch before** is the same number of calendar months, ending the instant before the current stretch begins. 3 months
  back from 10 October is 10 July; the stretch before is 10 April to 9 July.
- **The line**: the stretch before is drawn dashed on the same chart and the same scale (the scale fits the longer of the two),
  with its running total laid on the current days, day 1 against day 1, so the two lines read against each other. Where one
  stretch is a day shorter (months differ), its line ends where it ends. Moving the scrubber, with a pointer or the arrow keys,
  reads out what the stretch before had added up to by the same day ("Before: 22.0 km").
- **The change** is written under each figure: distance as an amount and a percentage of the stretch before ("10.0 km more
  (+50%)"), moving time, climb and sessions as amounts, and pace as how much faster or slower (a smaller number of seconds per
  kilometre is the faster pace). A change that is too small to mean anything (under 50 m, a minute, a metre, a session, a second
  a kilometre) says "Same as before". A figure one of the stretches does not have (a pace with no runs, a climb neither has) has
  no change under it. More distance, time, climb and sessions, and a faster pace, are shown as the better direction, in words as
  well as colour.
- Compare is a view of the same runs: it changes nothing stored. The choice is kept in the browser.

### Known limits

- Only whole numbers of months are compared; "this week against last week" or a custom range is not offered.
- A run is on the day it was run on the runner's wall (see "The runner's day"); a stretch is judged by those days in the
  browser's own clock for "today".

## Editing a Run

The **Edit** button next to a run's title opens a panel (a drawer from the right on a wide screen, the whole screen on a phone)
with everything a runner can say about a run in one place:

- **Title.** One line, up to 120 characters; spaces of any kind become single spaces. A run cannot be left without a title.
  A title the runner sets is theirs: the run is marked `name_edited`, and a later Strava sync brings Strava's title back for every
  run except the ones that are marked. (Strava's other data on the run, distance and time and the rest, still follows Strava.)
  Setting the title a run already has is not a rename.
- **Notes.** Free text up to 2000 characters, private to the runner: shown under the run's title (folded to a few lines when long),
  read through `GET /api/activities?id=` for that one run and never part of a list, and in the account export. Line breaks are kept.
  Control characters other than tab and line break are refused. Lengths are counted in the unit a browser's `value.length` counts
  (an emoji is two), the same number the counter in the panel shows and the server applies.
- **How it felt, and whether it counts.** The 1 to 10 rating of the Effort card, and a choice to **use it instead of the heart
  rate** for this run's effort (Strava's "use it instead of heart rate"). Without the choice a rating is only used when a run has
  little or no heart-rate data, as before. With it, the effort score is the moving minutes times the rating's weight (1 for a
  rating of 1 to 5 for a rating of 10, evenly between), the source reads *From your rating of N out of 10, as you chose*, and the
  run's effort is recomputed at once (its stored row remembers the choice it was made with, `rating_preferred`, so a row made
  before a change of mind is recomputed when the run is next read, as it is for a changed rating). A choice needs a rating: `useRatingForEffort: true` without one is refused,
  and clearing the rating clears the choice. Only that run's effort changes; the zones, the fitness model and the weekly range
  read the effort rows as they always did.
- **Run type and tags**, as on the Type and tags card (see Run Type and Tags): the same rules and the same words, but a draft
  here, saved with the rest.
- **Shoes**, through the shoe route the gear card uses.

Nothing is saved until **Save changes**. One `PATCH` holds only the fields that changed (a title Strava gave the run is not sent
back as if the runner had chosen it), the shoe has its own request, and a refused request changes nothing. The server applies the
request as one unit (`ActivityEditService`): it takes the run's row first and holds it until the edit has committed, so a request
that fails part-way (the title, the rating and the tags are written together) changes nothing, and two requests for one run take
turns, each changing only the fields it names on the run as it is by then, not on the copy it read earlier. The effort score and
the cached records list are brought up to date after the commit, from the saved run. If the fields are saved
and the shoe is not, the panel says so and keeps the shoe as the one thing left to do. Leaving with something unsaved (Cancel, the
close button, Escape or a click outside) asks first. The panel reads the run afresh each time it opens, so a change made in
another tab is not overwritten by an old draft; the Type and tags card, the Effort card and the run summary on the page follow a
save without a reload, and a rename drops the cached records list (it shows run names).

**Left out on purpose.** Strava's edit page also has privacy, hidden details (start time, calories, heart rate, pace, power),
mute, photos, the sport and the map type. The first four belong to the social side of that product (who can see a run); every
HermesRuns run is private to its runner. HermesRuns analyses runs only, and draws one kind of map.

**Known limits.** There is no history of earlier titles or notes, and no way back to the title a run came with (Strava's title
returns only for runs the runner has not renamed). Two panels open on one run at once save field by field, so the last save of a
field wins, but a field one of them did not touch is never overwritten by it (two saves at the same moment are applied one after the
other, and the tags one of them sets never collide with the other's).

## Run Summary

The run page has a **Run summary**: a headline that says what kind of run it was, and up to four lines that compare it with the
runner's own recent runs, say how it was paced, how the heart rate behaved, how fresh the runner was going in and how hilly it
was. It is made to be checked: every line is the result of a fixed rule over stated numbers, each can be opened to show those
numbers and the rule (the thresholds are the ones in the code, sent with the line), and nothing is generated, guessed or called AI.
A runner can hide the summary on one run, or on every run, and the setting is kept in the browser like the distance unit.

`GET /api/activities/{id}/summary` answers `state: "ready"` with `findings`, or `state: "none"` with `reason: "too_short"` (under
1 km or under 5 minutes moving), and 404 for a run that is not the caller's, not a run, or not there. The server sends findings,
not sentences: each has an `id`, a `variant`, a `tone` (positive, neutral or caution: a colour, never a verdict), a `weight`, the
`facts` it was worked out from (seconds per kilometre, kilometres, seconds, percent) and the `thresholds` of its rule. The browser
words them in the runner's language and distance unit. Nothing is stored; the same run says the same until its numbers, or the
runs around it, change.

### The headline

In this order of trust: what the runner labelled the run (**race**, **workout**: see "Run Type and Tags"), then whether the
kilometre paces vary too much to call it one steady effort (**changes of pace**: the standard deviation over the mean of at least
four full kilometres is above 10%, in grade-adjusted pace when the run had elevation), then the heart-rate zones (**hard** when
zones 4 and 5 hold at least 30% of the time with heart rate, else **easy** when zones 1 and 2 hold at least 70%, else
**moderate**; needs 10 minutes of heart rate), then the effort against the usual (**hard** at 1.25 times the usual or more,
**easy** at 0.75 or less, else **moderate**), else it says it cannot tell. A run the runner called a workout is never called
steady, and a run with changes of pace is not called easy because its heart rate was low on average.

### The lines

The most worth saying come first; a line that only says "as usual" is shown only to make up two lines when fewer than two say
something more; at most four lines.

| Line | Says | Rule | Needs |
| --- | --- | --- | --- |
| longest (3) | the longest run of the last 4 weeks | longer than every non-workout run in the 28 days before, and at least 5 km | 4 such runs |
| effort (3 / 2 / 1) | higher, lower or typical against the usual effort; **hardest** when it is above all the runs it is compared with | the median Effort of the runner's earlier runs of the same kind in the 90 days before (for runs that are not workouts, also 70% to 140% of this run's distance); 1.25 times or more is higher, 0.75 or less lower; hardest needs 8 runs and more than all of them | 5 runs (workouts: 3 workouts of any length); not for a race |
| drift (3 / 2 / 1) | how much more heart rate the second half took for the same pace | the existing efficiency drift of the run page: above 5% a slight rise, above 10% a high one, below that low | 20 minutes, a heart-rate stream; not for a workout |
| shape (2 / 1) | the second half faster (**negative split**), slower (**faded**) or about the same (**even**) as the first | the mean pace of the second half of the full kilometres against the first (the middle one left out when odd), at least 2% apart; grade-adjusted pace when every kilometre has it, and the line says which | 4 full kilometres, not varying by 10% or more, not a workout |
| pace (2 / 1) | faster, slower or about the same as the recent runs | this run's pace against total time over total distance of the runs of the last 30 days that are neither workouts nor races and are 70% to 140% of its distance; 3% or more apart is faster or slower | 3 such runs; not for a workout or a race |
| form (2) | **fresh** or **tired** going in | fitness, fatigue and form at the end of the day before (see "Fitness, Fatigue and Form"): the same words as the fitness card, a swing of under 3 points says nothing | 14 days of effort before the run |
| climb (2) | **hilly**, with the grade-adjusted pace when it is 5 s/km or more from the clock pace | 12 m of climb a kilometre or more | elevation |

(The number in brackets is the weight. Hilly runs make raw paces differ, which is why the pacing line and the headline use the
grade-adjusted pace when there is elevation.)

### What it will not say

- A race is not compared with training, and a workout gets no pace, pacing or heart-rate verdict; its effort is compared with the
  runner's other workouts only.
- A run whose kilometres vary by more than 10% gets no "even" or "faded", and is not called steady.
- Nothing is said from fewer runs than the rule needs; with too little to compare with, the summary is the headline alone, or says
  it cannot tell how hard the run was.
- Nothing about health, injury or what to do tomorrow.

### What is read

One run, its stream once (the pace profile and the drift), one query of the runner's runs of the 90 days before (the same rows
as the training log), the run's effort row, and, for the form, one read of the effort series. Only the runner's own runs.

### Known limits

- Runs are compared by length (70% to 140%) and kind only; terrain, weather and time of day are not taken into account, except
  that the pacing line uses grade-adjusted pace.
- Effort scores from different sources (heart-rate zones, a rating, pace) are compared as they are; see "Run Effort and Heart-Rate
  Zones".
- The usual effort and pace are those of the runs Hermes has; a runner who has just imported a long history sees summaries as
  good as the history, and one with a short history sees fewer lines.

## Recovery Estimation

How many hours a run is likely to ask for before the next hard one, from the run's Effort Score (the browser's version, see
"Effort Score"; `utils/todayRun.js`):

```
durationFactor  = (duration > 90 min) ? 1 + 0.005 × (duration − 90) : 1.0
adjustedScore   = effortScore × durationFactor
baseHours       = 0.45 × adjustedScore^0.85
fitnessDiscount = max(0.80, 1.10 − VDOT / 200)                     (VDOT 40 when there is none)
recoveryHours   = min(96, baseHours × fitnessDiscount)
```

Fitter runner (higher VDOT) → faster recovery. Long runs (>90 min) add a penalty. Cap: 96 hours. Today shows the hours still to
go: for each run of the last 4 days, its recovery hours minus the hours since it started; the largest, rounded and capped at
96. The constants are HermesRuns' own conventions.

## Daniels' Training Zones

The edges the run page cuts its pace zones at (59%, 75%, 83%, 92% and 105% of VO₂max); the ranges on Analysis use them too (see
"Training Paces and Training Zones").

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
| **ACWR** | Acute:chronic workload ratio, called the load ratio on the cards. Compares recent load (a 7-day weighted average) with baseline load (a 28-day weighted average). Above 1.30 is high and above 1.50 is danger, by the lines on the cards. The app has more than one ratio; see "Training Load and the Load Ratio". |
| **Distance ratio** | The last 7 days' distance divided by the 28-day weekly average. The plan's *absorb* phase reads it (above 1.30); it is not the load ratio. |
| **Readiness** | A 0 to 100 score from sleep, heart-rate variability, resting heart rate, stress and training load, with a verdict (Good to go, Take it easy, Recovery day, Rest day). See "Today's Call and Readiness". |
| **Call** | The day's session (type, distance, pace range and reason) that the server works out with fixed rules. |
| **EWMA** | Exponentially Weighted Moving Average. A smoothing formula that gives more weight to recent data — used to compute ACWR. |
| **Effort Score** | HermesRuns' training-load unit for a run: duration and intensity (VO₂ fraction), about 100 for an hour at threshold. There are three versions (the browser's, the server's pace-only load units, and the run page's Effort); see "Effort Score". |
| **Effort** (run page) | Time in heart-rate zones weighted 1 to 5 (or the rating or pace estimate when there is no heart rate). A different scale from the Effort Score above. |
| **Heart-rate zone** | One of five bands of heart rate set from the max heart rate or by the runner. |
| **Moving pace** | Moving seconds per kilometre: time spent standing still is left out. Every pace on the run page's pace card is one. |
| **Grade-adjusted pace (GAP)** | The flat pace that is worth about the same effort as the pace run on the slope: faster than the pace run on a climb, slower on a gentle descent. HermesRuns uses a quadratic that approximates how Strava describes its own GAP, so it is close to Strava's numbers but not the same. |
| **Best effort** | The fastest continuous stretch of a standard distance (400 m to 50 km) inside one run, found exactly from the stream. Its place (PR, 2nd, 3rd...) is among the runner's efforts at that distance. |
| **Chip time** | A time the runner typed in for a best effort, replacing the one measured; kept when the run is analysed again. |
| **Estimated effort** | A best effort worked out from the run's average pace when there is no stream to measure, for a run that covered at least 90% of the distance. Marked wherever it is shown. |
| **Same-route runs** | Runs that start and finish within 150 m of the same places, go the same way and are within 5% of the same distance. |
| **Fitness** | A slow (42-day) exponentially weighted average of a runner's daily Effort. It rises with steady training and falls slowly with rest. |
| **Fatigue** | A fast (7-day) average of the same daily Effort. It jumps after hard days and falls within days of rest. |
| **Form** | Fitness minus fatigue. Above zero the runner is fresher than their recent training has been; below zero they are carrying fatigue. |
| **Usual range (weekly effort)** | The mean of the effort of the three weeks before a week, plus and minus 20%. A week is below, within or above it. |
| **Critical speed (critical pace)** | The slope of the line `distance = D' + CS x time` through a runner's best efforts of 3 to 40 minutes: the speed the line says could be held for ever, which no one can, so it is read as a threshold-like pace and not as a pace to race at. See "Pace Curve and Critical Pace". |
| **D' (D prime)** | The intercept of that line: a distance that can be covered above the critical speed before the runner is spent. |
| **Polarization Index** | Treff et al.'s (2019) log-ratio of the time spent in the low, moderate and high intensity zones; above 2 reads as polarized. See "Time in Zones and the Intensity Distribution". |
| **Pool (VDOT)** | The runs the best three estimates behind the VDOT are taken from: the runs of 3 km or more among the last 90 days' runs when there is one, otherwise the runs of 1.5 km or more. See "VDOT and VO2max". |
| **Monotony** | The mean of the last 7 days' loads divided by their spread (their standard deviation): high when the days were alike. The Monotony card turns amber at 2.0. See "Monotony and training strain". |
| **Training strain** | The last 7 days' load times their monotony (Foster 1998): a number to compare with your own earlier weeks, with no line of its own. See "Monotony and training strain". |
| **Long-run check** | The line under a prediction that says whether the longest run of the last 8 weeks reached three quarters of the distance. A HermesRuns rule of thumb. See "Race Predictions and Their History". |

## Not Yet Documented

These numbers or features are shown by the app and have no section here yet: the rewards (digital cosmetics) and the thresholds that grant them; the muscle-training planner; the weekly digest and its messages; the race catalogue and the reading of race course maps by an image model (it works on race maps only); the Home page's other cards; the shoe-photo scan (an AI reads a screenshot of a shoe app, only when the runner starts it); the arithmetic of some of the small figures on Analysis cards. A number that is not in this document and not in this list is a gap: please report it.

## Related Docs

- [Root README](../README.md) — project entry point
- [Frontend page map](../frontend/src/pages/README.md) and [backend guide](../backend/README.md) — where the analysis pages, controllers and domain utilities live
- [docs/README-DEV.md](../docs/README-DEV.md) — contributor onboarding
