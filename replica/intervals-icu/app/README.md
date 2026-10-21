# Training workspace local build

An original React/Vite implementation of all 30 Intervals.icu recon surfaces, using the accepted architecture and design. Athlete training, individual coaching and existing-team management are reviewable in one browser. See [build status](../build-log.md) and [screenshots](../clone-screens/README.md).

From `D:\Hermesruns`, using the already installed `frontend/node_modules`:

```powershell
node frontend/node_modules/vite/bin/vite.js --config replica/intervals-icu/app/vite.config.mjs
```

Open `http://127.0.0.1:4318/#/calendar`. The earlier design preview uses port 4317. No package installation or dependency-manifest change is required.

## Review the flows

1. Rowan Ellis: import the included original GPX/TCX example or a file, open its timeline/intervals/training load, author and publish a workout, schedule it, then explicitly match a completion.
2. Mara Quinn: select Rowan/Jules, compose or choose a plan, choose recipients, preview the frozen operation and open its review to apply. Receipts are per athlete; current grants and revisions are rechecked at commit.
3. Tori Bell: manage the seeded team, approve pending members and adjust roles/policy. Membership gives no training-data access by itself. Switch to Rowan to accept, decline or revoke group data scope. Revoke one source and observe independent direct grants remain.
4. Sam Rivera: select Rowan and inspect read-only sessions. Write actions are disabled/rejected.

Use Sample account to simulate actors and Selected athlete for data context. Sample sign-in uses password `demo`; no real password is persisted. New local profiles are private. The app persists invented data under `hermes-intervals-build-v1` in this browser, with a fixed demo date of 15 October 2026. Keep personal/sensitive data out of this prototype. There is no real account, message delivery, provider connection or billing transaction.

Each route offers a Screen state review with empty, loading, error, denied and 60-character content states. These controls change presentation only; actual access checks remain active. Mobile navigation groups collapse and the calendar becomes an agenda. Charts have point controls and a data-table alternative. Dragging has date/button alternatives.

## Architecture boundary

`data/local.mjs` implements asynchronous screen-facing methods with browser transactions, revisions, permission-source checks, immutable workout/plan snapshots and frozen bulk previews. This makes the local product flow testable. The user can inspect/edit localStorage: it is not authentication or a security boundary.

`data/http.mjs` now selects the real Hermes backend when `?backend=1` appears before the URL hash, or `VITE_TRAINING_MODE=server` is set. Start the isolated backend with `../backend/start-demo.ps1` from this directory (or follow [backend setup](../backend.md)). The server uses the existing verified identity, HttpOnly cookie/CSRF transport and server authorization. Sample actors remain exclusive to local mode. Provider registration, advanced configuration bundles and subscription billing remain pending. Never send sample identifiers to production migrations or the reference service.

The workout language supports duration/target steps and one level of repetition, with bounded input. Calculations are independent illustrative methods: five maximum-HR bands; duration-weighted HR load with 90% coverage or RPE fallback; exponential fitness/fatigue; coarse power samples. They do not reproduce proprietary numerical output. Advanced scientific methods, per-sport historical zones, nested workout ASTs and additional file/device formats remain partial in the matrix.

## Verification

```powershell
node frontend/node_modules/vitest/vitest.mjs run --config replica/intervals-icu/app/vite.config.mjs --maxWorkers 1 --no-file-parallelism
node frontend/node_modules/eslint/bin/eslint.js --config replica/intervals-icu/app/eslint.config.mjs replica/intervals-icu/app
node frontend/node_modules/vite/bin/vite.js build --config replica/intervals-icu/app/vite.config.mjs
python replica/intervals-icu/design/validate-design.py
```

The earlier local-stage run passed 32 tests across six files, lint, build and 100 contrast pairs. The historical browser report records 60 responsive layout/label checks, 150 shared state checks, 12 local flows and a clean post-fix 30-route console sweep. Current backend/frontend verification is recorded in [backend-verification.json](../backend-verification.json). Automated coverage includes authorization/revocation between preview and commit, stale revisions, consent scope, last-admin protection, unique completion, unknown/zero metrics, import deduplication, chart names and pending membership approval. Browser visual/keyboard checks are bounded evidence, not a complete accessibility or recon-flow certification.

Generated `dist/` is ignored. No source, text, images, endpoints or assets from the original service are used at runtime. Server implementation extends the existing Hermes backend; frontend changes remain in this replica package. `features.csv` preserves historical local clone assessments and adds separate backend status/notes. Next: replica-test against server mode, then replica-diff.
