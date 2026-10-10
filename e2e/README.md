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
| `fixtures/test.ts` | the `test` every spec imports: fails on console errors and 5xx, answers map tiles locally, an axe helper |
| `fixtures/api.ts` | a small API client; `newRunner()` makes a throwaway runner |
| `specs/` | one file per flow, run in file-name order: `10` auth, `20` to `22` F01, `30` F02, `40` F04, `45` F03 (not built), `50` F05, `60` import, `70` new runner and odd addresses, `90` data rights, `99` Strava |

Tests for a known open defect are written as `test.fail(true, 'BUG-nnn ...')`: the suite stays green, and the test fails the day the
defect is fixed, which is the cue to remove the line.

## Things the suite has to know about the app

* Rate limits and the sign-in lock are keyed on the first `X-Forwarded-For` value, which any client can set (BUG-001). Every browser
  context and API client here sends an address of its own so tests do not use up each other's allowance. If the app stops trusting
  that header, run the stack behind a proxy that sets it, or restart the stack between runs.
* A second sign-in as the same runner ends the first session. Specs never sign in again as a runner a browser is using.
* Sign-ups are limited to eight an hour per address (same note). Runners B and C are made once and kept in `.auth/accounts.json`.
* Analysis runs in the background after an import; specs wait for it (`eventually`, `expect.poll`) instead of sleeping.
* Dates in the seed are relative to today, in UTC, at 11:00 or 09:00; the browser zone is fixed to America/New_York.
