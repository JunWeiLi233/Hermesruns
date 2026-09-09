# Contributor Onboarding (README-DEV)

Everything a new contributor needs: the fastest path from clone to "I changed something and saw it live", the built-in mock accounts, where files live, two worked first-change examples, and the submit/sync workflow.

## First Time Here? Start Here

1. **What is Hermes?** — read the [root README](../README.md) to understand what you're building and who it's for. (5 min)
2. **Quick Start** — get the app live on `localhost:8080` via the root README. (5 min)
3. **Walk the Project Tour** — [repository layout](architecture/repository-layout.md) explains the application directories. (5 min)
4. **Make your first change** — the two worked examples below. Edit something, see it land. (10 min)
5. **Read the development guides** — commands and conventions in [frontend/README.md](../frontend/README.md) and [backend/README.md](../backend/README.md). (10 min)

No prior knowledge of Spring Boot, React, or sports science is required to make the first change.

> **First action for new contributors:** before recording any activities, log in with the **[built-in mock account](#built-in-mock-account)** to see every Hermes feature pre-loaded with realistic data. It takes 30 seconds.

## Built-in Mock Account

Hermes analyzes *your* running data — but you don't have any yet. The mock accounts give you pre-seeded local runners with shoes and run history, so every page shows real content the moment you log in. No Strava connection, no file imports needed.

### The 5 local accounts

| Account | Email | Password |
|---|---|---|
| **Hermes Shared Runner** (main demo runner, seeded shoes + runs) | `strava+140971747@hermes.local` | `HermesDev2026!` by default, or the value of `APP_LOCAL_SHARED_RUNNER_PASSWORD` |
| **Territory rival** (reserved for `/territory` contested-land testing; routes overlap the shared runner with denser GPS samples) | `territory-rival@hermes.local` | `<set-rival-password>` (no default) |
| **Flushing territory occupier** (seeds closed-loop GPS + land masks across Flushing, Queens) | `territory-flushing@hermes.local` | `HermesDev2026!` by default, or `APP_LOCAL_TERRITORY_FLUSHING_PASSWORD` |
| **Inner Flushing occupier** (nested inside the Flushing account; verifies conquest consumes opponent land) | `territory-flushing-inner@hermes.local` | `HermesDev2026!` by default, or `APP_LOCAL_TERRITORY_FLUSHING_INNER_PASSWORD` |
| **Berlin conqueror** (seeds occupied land around Tiergarten, Mitte, Alexanderplatz for screenshots) | `territory-berlin@hermes.local` | `HermesDev2026!` by default, or `APP_LOCAL_TERRITORY_BERLIN_PASSWORD` |

The four territory accounts are only for `/territory` testing — do not repurpose them for normal demos.

After logging in as the shared runner, the dashboard greets you with `早上好, Hermes Shared Runner.` (or `Good morning, Hermes Shared Runner.` in English). If you see a different name, the bootstrap didn't pick up the default — see how to enable below.

### How to enable

**Windows** — copy the example env file, then start Hermes:

```powershell
Copy-Item Hermes.local.env.example.ps1 Hermes.local.env.ps1
.\start_hermes.bat
```

`start_hermes.bat` reads `Hermes.local.env.ps1` automatically. The file already includes:

```powershell
$env:APP_LOCAL_SHARED_RUNNER_ENABLED      = "true"
$env:APP_LOCAL_SHARED_RUNNER_EMAIL        = "strava+140971747@hermes.local"
$env:APP_LOCAL_SHARED_RUNNER_PASSWORD     = "HermesDev2026!"
$env:APP_LOCAL_SHARED_RUNNER_DISPLAY_NAME = "Hermes Shared Runner"
```

Alternatively, set the vars inline without editing any file:

```powershell
$env:APP_LOCAL_SHARED_RUNNER_ENABLED = "true"
.\start_hermes.bat
```

**macOS / Linux** — copy the example env file, then start the backend:

```bash
cp .env.example .env
export APP_LOCAL_SHARED_RUNNER_ENABLED=true
cd backend
./mvnw spring-boot:run
```

The relevant lines in `.env.example` (already present):

```bash
APP_LOCAL_SHARED_RUNNER_ENABLED=true
APP_LOCAL_SHARED_RUNNER_EMAIL=strava+140971747@hermes.local
APP_LOCAL_SHARED_RUNNER_PASSWORD=HermesDev2026!
APP_LOCAL_SHARED_RUNNER_DISPLAY_NAME=Hermes Shared Runner
```

Territory accounts are enabled the same way with `APP_LOCAL_TERRITORY_RIVAL_*`, `APP_LOCAL_TERRITORY_FLUSHING_*`, `APP_LOCAL_TERRITORY_FLUSHING_INNER_*`, and `APP_LOCAL_TERRITORY_BERLIN_*` variables.

### What you get

| Page | What you'll see |
|---|---|
| `/profile` | Runner Hub with readiness, recent run summary, mileage stats |
| `/runs` | Seeded run history with routes and metrics |
| `/analysis` | VDOT card, ACWR load chart, training paces |
| `/today-run` | Daily coaching recommendation with pace ranges |
| `/shoes` | Pre-loaded shoe inventory with mileage tracking |
| `/territory` | Real conquest conflicts between the shared runner and the reserved territory rival |

> **Local-safe.** The mock accounts are disabled by default and skipped entirely in production. Never use these credentials outside your local machine.

## Project Tour: Where Lives What?

The [repository layout](architecture/repository-layout.md), [page map](../frontend/src/pages/README.md), and [backend guide](../backend/README.md) describe the main modules. Quick-answer cheat sheet:

| Question | Answer |
|---|---|
| Where do I fix a page? | Find its browser URL in [the page guide](../frontend/src/pages/README.md); open `frontend/src/pages/<feature>/` and its `__tests__/` directory. |
| Where do I add a new page? | Put it in its feature directory under `frontend/src/pages/`, then register the route in `frontend/src/App.jsx` and loader in `frontend/src/utils/routePreload.js`. |
| Where do I change a button label? | Copy lives in `frontend/src/i18n/locales/en/` and `frontend/src/i18n/locales/zh-CN/` — edit the same key in both. (`frontend/src/i18n/translations.js` is only a re-export shim.) |
| Where do I add a new REST endpoint? | The owning product-domain package under `backend/src/main/java/com/hermes/backend/`; put business operations in its service and queries in its repository. See `docs/architecture/backend-package-migration.md`. |
| Where does the database schema live? | JPA entities in the owning backend domain; schema behavior remains controlled by the existing Spring configuration |
| Where is the main CSS file? | Active imports in `frontend/src/index.css` and `styles/app.css`; `styles/style.css` is a frozen test-referenced legacy file |
| Where do I find the app config? | `backend/src/main/resources/application.properties` |

## How to Make Your First Code Change

### Example A: Change a Label on the Profile Page (Frontend)

**Step 1 — Find where the label string lives.**

All user-visible text lives in locale modules under `frontend/src/i18n/locales/`. Open `frontend/src/i18n/locales/en/` and search for the phrase you want to change (e.g. "Runner Hub"), then edit the matching key in `frontend/src/i18n/locales/zh-CN/` too.

**Step 2 — Start the dev server.**

```bash
cd frontend
npm install    # only needed the first time
npm run dev    # → http://localhost:3000
```

The dev server hot-reloads — save the file and the browser refreshes automatically.

**Step 3 — Verify the change visually.**

Open `http://localhost:3000/profile` and confirm the new label appears in both languages (use the language toggle in Settings).

**Step 4 — Check translations parity.**

```bash
node tools/check-translations.mjs
```

This script verifies that every key in `en` also exists in `zh-CN` and vice versa. It must exit 0 before any commit involving copy changes.

**Step 5 — Lint the file.**

```bash
cd frontend
npm run lint
```

### Example B: Add a Field to the Runner Profile API Response (Backend)

**Step 1 — Find the controller.**

Open `backend/src/main/java/com/hermes/backend/runner/ProfileController.java` and find `GET /api/profile/me`. It calls `ProfileApplicationService.profile(Runner)`; shared response records belong to `runner/ProfileModels.java`.

**Step 2 — Add the field to the response.**

Add the field to the existing `ProfileModels.ProfileResponse` record and populate it in `ProfileApplicationService.profile`. Keep database lookups and profile calculations in the service. Update the corresponding behavior tests and frontend contract/adapter when the response changes.

**Step 3 — Compile to catch errors.**

```bash
cd backend
./mvnw -q -DskipTests compile
```

Fix any compilation errors before continuing.

**Step 4 — Run the backend and test the endpoint.**

```bash
cd backend
./mvnw spring-boot:run
```

Once running, test via curl or your browser:

```bash
curl http://localhost:8080/api/profile/me -H "Authorization: Bearer <your-token>"
```

You should see `newField` in the JSON response.

**Step 5 — Connect it in the frontend (optional).**

The frontend consumes this endpoint in `frontend/src/pages/profile/ProfileDashboard.jsx` and other runner surfaces through `frontend/src/api.ts`. Update the relevant consumer and contract when adding a field.

## How to Submit Your Change

1. Start from the latest `master` on a feature branch. Keep unrelated edits out of the change.
2. Run the frontend lint, tests and production build, compile the backend, and confirm the production Docker image builds. Verify changed pages in a browser and check the diff for credentials or personal data.
3. Use a concise commit title such as `fix: align the race map marker`. Attribute commits to the actual contributor; do not add automated assistant co-author trailers.
4. Open a draft PR targeting `master`. Describe the problem, resulting behavior, and checks actually completed. Link the relevant issue when one exists.
5. Wait for review and required CI before merging. Publishing a branch does not deploy it; deployment is a separate maintainer action.

## How to Sync from Upstream

Preserve local changes in a commit or stash before updating. Fetch `origin`, inspect the incoming changes, and use a fast-forward update for a clean `master` checkout. If your feature branch has diverged or a conflict appears, review it explicitly; do not discard work or force-push to make the update succeed.

## Regression Checklist

Run after changes to auth, import, upload, or third-party integrations.

1. **Expired session**: Block an API call to return `401` while on a page with active edits → should redirect to `/login?return=<path>&reason=expired` with a visible notice
2. **Partial batch import**: Upload valid + invalid files together → should return `200` with `rejectedFiles` listed, modal stays open
3. **Weather outage**: Block `api.open-meteo.com` → weather bar shows "Weather unavailable", rest of page loads normally
4. **Malformed analytics**: Stub analytics endpoint to return `500` → Run Detail renders with inline error card and "Reload" action
5. **Batch file cap**: Submit >50 files → backend returns `400` with limit explanation, frontend shows it in the import modal

## Troubleshooting

| Problem | Fix |
|---|---|
| `ERR_CONNECTION_REFUSED` | Windows: `.\start_hermes.bat`; macOS/Linux: `./start_hermes.sh` (or `cd backend && ./mvnw spring-boot:run`) |
| Port 8080 stuck / stale process | Windows: `.\stop_hermes.cmd`; macOS/Linux: `./stop_hermes.sh` |
| `java` not found | Install Java 17 from [adoptium.net](https://adoptium.net) |
| OAuth callback fails | Backend must run on `localhost:8080`, redirect URIs must match exactly |
| Frontend changes not showing | Run `npm run build` in `frontend/`, then refresh |
| Translation check fails | Run `node tools/check-translations.mjs`, add the missing keys to both `locales/en/` and `locales/zh-CN/` |

## Related Docs

- [Root README](../README.md) — project entry point, quick start, features
- [Repository layout](architecture/repository-layout.md) — application directories and build configuration
- [docs/README-ANALYSIS.md](../docs/README-ANALYSIS.md) — analysis methodology (VDOT, ACWR, recovery)
- [Frontend guide](../frontend/README.md) — browser development and verification
- [Backend guide](../backend/README.md) — packages and backend commands
- [docs/setup.md](../docs/setup.md) — local & production setup, env var reference
