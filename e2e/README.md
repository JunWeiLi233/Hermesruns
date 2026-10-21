# HermesRuns end-to-end tests

Playwright tests for the run-analysis flows, written from `replica/recon.md` (flows F01 to F06) and `replica/test-plan.md`
(every case number in a test title is a row of that plan). They drive a **throwaway stack**: one Spring Boot process on port 18080
with a fresh database, the built frontend served by it, and the local shared runner turned on. They never touch port 8080,
your dev database, Strava or Garmin.

## Run them

```bash
npm --prefix frontend run build                      # the app the tests open
backend/mvnw -f backend/pom.xml compile              # backend/target/classes
npm --prefix e2e install
npx --prefix e2e playwright install chromium         # or set E2E_CHROMIUM_PATH to any recent Chrome / Chromium
npm --prefix e2e test                                # starts the stack, seeds it, runs everything, stops it
```

While you work on one spec, keep the stack up so each run starts in seconds:

```bash
npm --prefix e2e run stack:start
npm --prefix e2e test -- specs/20-f01-review-a-run.spec.ts --project=desktop
npm --prefix e2e run stack:stop
```

| variable | meaning |
| --- | --- |
| `E2E_CHROMIUM_PATH` | a Chrome / Chromium to use instead of the one Playwright downloads |
| `E2E_PORT` | the stack's port (default 18080) |
| `E2E_BASE_URL`, `E2E_RUNNER_EMAIL`, `E2E_RUNNER_PASSWORD` | test a stack you started yourself; the runner must be one the suite may fill with test runs |
| `E2E_DB_URL`, `E2E_DB_USER`, `E2E_DB_PASSWORD` | run the stack on your own database, for example a throwaway PostgreSQL (`jdbc:postgresql://127.0.0.1:55432/hermes_e2e`) |
| `E2E_CLASSPATH_FILE` | a saved `mvn dependency:build-classpath` output, to skip the Maven call |
| `E2E_DESTRUCTIVE=1` | also run the tests that change the seeded runner (Strava disconnect); restart the stack afterwards |

## What is in here

| path | what |
| --- | --- |
| `tools/stack.mjs` | starts and stops the throwaway stack |
| `global-setup.ts` | signs in the seeded runner, imports the eleven seed runs through the real import route, waits for the background analysis, makes runners B and C |
| `fixtures/gpx.ts`, `seed.ts` | builds GPX / TCX files from a few numbers; the seed runs and what each one is for |
| `fixtures/test.ts` | the `test` every spec imports: fails on console errors and 5xx, answers map tiles locally, an axe helper (`a11yViolations`) and a contrast check of its own (`contrastProblems`, below) |
| `fixtures/api.ts` | a small API client; `newRunner()` makes a throwaway runner |
| `fixtures/history.ts` | a throwaway runner with weeks of running behind it (`sharedHistoryRunner`, kept in `.auth/history-<label>.json` for the day and the stack, so a retry or the phone project does not import the same weeks again) |
| `fixtures/strain.ts` | the daily loads of a runner and the monotony and strain of a week, worked out from the runs the API lists (for the Load balance cards) |
| `fixtures/analysis.ts` | runs made from a few numbers (`importRunSpecs`: a straight GPX line at a constant pace and heart rate), runners kept for the day (`sharedRunner`, in `.auth/analysis-<label>.json`), the wait for best efforts, and the arithmetic the specs of the Runalyze-review screens check against (`leastSquares`, `zoneTime`; the VO2max rules are in `format.ts`) |
| `fixtures/marks.ts` | `markRatios()`: how well the bars, lines and dots of a chart show against what is behind them (3 to 1, WCAG 1.4.11), read from the computed paint, opacity and backgrounds |
| `fixtures/reflow.ts` | what the screens do with the browser's text made larger and with a narrow screen: `enlargeText()` (the root font size), `readingsThatCollide()` (a name that runs into its number), `elementsBeyondTheEdge()` (what is cut off at the right edge), `readoutSticksOut()` (a chart's readout outside the chart) |
| `fixtures/pages.ts` | `pageOpener()`: pages for a runner you hold a token for, in the project's locale and time zone, closed again after the test |
| `fixtures/format.ts` | how the app writes numbers and days, so a test can build the text it should see |
| `specs/` | one file per flow, run in file-name order: `10` auth, `20` to `22` F01, `30` F02 (the older Load balance), `31` fitness, fatigue and form and the weekly effort range (M4), `32` the training log (M5, M5b), `33` the type and tags of a run (M5), `34` the run summary (M7), `35` the Progression card's comparison with the period before (M8), `36` the edit panel of a run (M8), `37` time in zones (A1), `38` the pace curve (A2), `39` the VO2max estimates (A3), `40` F04, `41` pace zones from a race (M8), `45` F03 goals (M6, and the suggested goals of M8), `46` rest days to zero form (A5), `50` F05, `51` the long-run check on the prediction pages (A4), `52` your races against the number on the VO2max page (A8), `53` training strain on Load balance (A6), `54` the daily effort bars under the fitness chart (A7), `55` your VO2max over time on the VO2max page (A9), `56` the third round on A6 to A9 and what they share (a run dated after the device's date, a rest week before, two runs in a day, every range and theme, a later run that must change nothing before it, a renamed or deleted race, a year that turns on the runner's wall, five thousand runs, a slow, failing or expired network, the "On this page" list of Load balance and the link to the fitness card, on a slow page, with a name for each part, with Back and Forward and with reduced motion, reading one point of the VO2max line), `57` weekly distance and its four-week average on Load balance (A10, and the cases of the fourth round: a runner with one week, the marks of the chart, large text on a phone, the readout of every week), `58` Trends (A15: one of six things about a run over a period, worked out again in the spec from the run list: the middle, the usual range, the straight line, the average of ten, the stretch before, every set of runs over every period, the readout of every run at large text, miles, Chinese, four themes, a phone), `59` Quality sessions (A16: the runs of the types that count over a period, worked out again from the run list for every choice of types over every period: how many, how far, their share of the distance, the middle pace, the count against the stretch before, the order of the table; marking a run on its page and coming back; nothing to compare with against no session before; a rare session; a name of 112 characters; the keyboard's order and focus; a phone), `60` import, `70` new runner and odd addresses, `80` the analysis screens under bad conditions (slow, failing, keyboard, back, refresh), `90` data rights, `99` Strava |

Tests for a known open defect are written as `test.fail(true, 'BUG-nnn ...')`: the suite stays green, and the test fails the day the
defect is fixed, which is the cue to remove the line. `replica/bugs.md` lists every defect, open and fixed.

The suite runs once more (`retries: 1`) a test that fails, and reports it as "flaky", never as a pass. It is there for Windows, which now and
then refuses a new local connection with `ENOBUFS` (`net::ERR_NO_BUFFER_SPACE` in Chromium) while a browser, a JVM and a database are all open; the
API client also tries such a connection again, up to five times, before it gives up. If a run reports flaky tests, look at them.

## Things the suite has to know about the app

* Rate limits and the sign-in lock are keyed on the client address: the connection's own, or, from a trusted proxy, the right-hand
  end of `X-Forwarded-For` (`docs/deployment/client-address.md`, BUG-001). The throwaway stack trusts the connections from this
  machine, as it would a proxy in front of the app, so every browser context and API client here sends an address of its own and
  tests do not use up each other's allowance. The tests that must see the connection's own address (X01-N7 and N8) start a second
  stack on port 18082 that trusts no proxy (`fixtures/stack.ts`, `APP_TRUSTED_PROXIES=none`).
* A second sign-in as the same runner ends the first session. Specs never sign in again as a runner a browser is using.
* Sign-ups are limited to eight an hour per address (same note). Runners B and C are made once and kept in `.auth/accounts.json`.
* Analysis runs in the background after an import; specs wait for it (`eventually`, `expect.poll`) instead of sleeping.
* Dates in the seed are relative to today, in UTC, at 11:00 or 09:00; the browser zone is fixed to America/New_York.
* The browser is started with `--lang=en-US`: the order of the segments of a date field (month, day, year) follows the browser's own language,
  not the locale a test asks for, and a test that types a date would otherwise only work on some machines.
* Weeks, months and years of a goal, the training log and the weekly effort are the runner's, in UTC unless the runner set a zone, so the specs of
  the new screens work out "this week" from `utcDay(0)` and not from the browser's clock. They are run at any time of day; a run today is
  imported at 00:00 UTC so that it has already happened (`todayRun` in `fixtures/history.ts`).
* The training series looks back six months by default, and `waitForEffort` reads it: a run older than that is never counted by it, so a spec that
  imports one passes `{ wait: false }` and waits on something else (the best efforts, say). A run from a GPX line of `n` km measures about 0.1% under `n`:
  a spec that needs a measured 5 km imports 5.07, not 5.
* A run's time in zones is its moving time and up to four seconds more (the last sample takes the gap before it, `HrZoneAnalysis`), so a spec that
  adds up zone seconds from moving time allows four a run.
* Runs imported from GPX, TCX or FIT files carry no climb figure (BUG-036): only runs from Strava or Garmin Connect, and the seeded runner's
  twenty-one local runs, do. The specs that need climb use the seeded runner and only read it; the others check that a file's run shows a dash.

### Large text and the edge of the screen

The page hides what is beyond its right edge (`html { overflow-x: hidden }`), so a document that "does not scroll sideways" says nothing about whether a
chip or a status is cut off at 320 px with the browser's text at 200%. The cases for that (`A10-M2`, `A2-M3`, `A3-M3`, `A10-M3`, `A9-K9`, `A10-K7`, `A15-K5`, `A15-M2`, `A16-M2`) ask for the
box of every element and of every readout (`fixtures/reflow.ts`) and are run with the `@mobile` project where they are about a phone.

### Contrast

axe's `color-contrast` rule gives up on a page when something behind the content is a pseudo-element: on the Training log it puts all 886 pieces
of text in "incomplete" and reports no violation at all, so a scan with axe finds nothing there however pale the text is. The specs of the new
screens therefore also use `contrastProblems(page, { include: [...] })`, which reads the computed colour of each piece of text and lays the
backgrounds of its ancestors over each other, and holds only the parts named to 4.5 to 1 (3 to 1 for large text). The older parts of the
runner pages are known to fall short (BUG-005) and are left out of it by naming only the new cards.

## Local Hermes training-plan QA

These specs use the real built website and Spring APIs. Two loopback-only, test-classpath Java fixtures create disposable H2 databases and synthetic runners. Port 4331 explicitly approves `hermes-road-v1` **for tests only**; port 4332 leaves approval empty. Port 4330 is a readiness probe. No production settings, external accounts, original-app servers or persistent databases are used.

From the repository root on Windows:

```powershell
cd backend
.\mvnw.cmd -q -DskipTests test-compile
.\mvnw.cmd -q dependency:build-classpath '-Dmdep.includeScope=test' '-Dmdep.outputFile=../.workspace/run-plan-classpath.txt'
cd ../frontend
npm ci
npm run build
cd ../e2e
npm ci
npx playwright install chromium
npm run test:runna
```

Compile/build before starting the tests. The fixture freezes compiled classes and static resources before launching its two JVMs, and disables devtools restart. Test shutdown stops those JVMs. Runtime snapshots remain only beneath `output/run-plan-qa/` if Windows terminates the process tree before its cleanup callback runs; they can be removed after the tests stop. The tests do not touch the regular backend or the browser fixture on port 4320.

Reports: `output/run-plan-qa/results.json`, `report/index.html`, and failure screenshots/traces in `artifacts/`. Axe reports are attached for every inspected product screen. Every browser spec checks console errors, uncaught exceptions and 5xx responses. Deliberate network failures and one deliberately expired manual-save request are narrowly annotated; the expected coaching-review 503 is asserted in an API-only negative case.

The complete test matrix and reproduced bugs are in `replica/runna/test-plan.md` and `replica/runna/bugs.md`. GPS recording, new provider OAuth, payment failures, new email delivery and a standalone manual-edit UI are outside this website slice.
## Analysis features within the current pages

`npm run test:analysis:integrated` runs `61-analysis-existing-pages.spec.ts`. It checks that Trends, VO2max evidence and the pace curve open within Analysis; Quality sessions opens within Intensity; and the training log opens within Runs. It also checks saved-link redirects, filter anchors, one page shell, and the mobile layout at large text. The isolated-stack setup and environment options above apply to this command too.
