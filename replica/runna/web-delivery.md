# Hermes web delivery

Decision: 2026-10-13. The user selected a website integrated into Hermes and authorized deployment.

This document supersedes the mobile implementation choices in `architecture.md`, `schema.sql`, and `design/README.md` for the current release. Those files remain research and future proposals. Do not apply the nine-table proposed mobile schema to the deployed website.

## Delivered scope

- Private, responsive `/training-plan`, discoverable in the runner navigation.
- Existing Hermes account and sign-in flow. No separate app or new credentials.
- Set a 5K or 10K target and date; review the goal before replacing the active goal.
- Today’s session and a fourteen-day schedule from Hermes’s existing coaching endpoints.
- Manual runs with start instant, browser time zone, distance, elapsed time, and name; saved as real MANUAL activities in existing run history.
- Owner-scoped, transactional save receipts prevent duplicate activities when retrying the same request. Deleted runs remain deleted on replay; deletion redacts receipt details; account deletion purges receipts; account export includes manual-run declarations.
- English and Simplified Chinese, km and miles, loading/error/rest/saved states, responsive forms and keyboard-accessible existing dialogs.

## Implementation

Frontend: existing React/Vite app, protected route and existing Hermes design/navigation components. Page source: `frontend/src/pages/training-plan/`.

Backend: existing Spring Boot, PostgreSQL and bearer sessions. Reuse `/api/coach/today`, `/api/coach/schedule`, `/api/coach/training-block`; add authenticated POST `/api/manual-runs`. Admin sessions cannot use the runner write endpoint. Existing ingestion events update coaching data. No GPS track or heart-rate measurements are fabricated.

Database: one additive `manual_run_receipt` table. Production currently uses Hibernate schema update. Reviewed equivalent DDL: `docs/deployment/run-plan-web.sql`; deployments with validate mode must apply it first.

Host: existing Railway Hermesruns / production / hermes-web, existing domain `https://hermesruns.com`. The release starts at deployed commit `9bc2e6ad26efd54aba7e5691e06d1d44c789f182` in an isolated worktree; unrelated local edits are excluded.

## Deferred

Full onboarding with availability, ability and volume preferences; versioned plans and full schedule preview before activation; workout matching/completion transitions; persistent offline run outbox; native GPS/background recording, wearable integrations and store distribution. The existing feature matrix covers a broader research scope and is not a claim of complete parity. Goal review confirms the target, not the generated schedule. Manual retry protection lasts for the open form; after an uncertain save, check history before closing or starting another entry.

This implementation is an original Hermes experience based on public behavior research, not Runna’s private training algorithm.

## Design evidence

Original neutral token proposal and native isolation gallery remain under `design/`. Production web layout uses the existing Hermes logo, typography, account menu and modal, with scoped responsive styles in `training-plan.css`. Fixture screenshots were captured under `output/playwright/runna-web/` in the original workspace; they demonstrate layout only, not authenticated production saves.

## Checks recorded before packaging

- New frontend form/page suite: 8 passed; frontend typecheck and production build succeeded.
- Expanded backend checks: 48 passed, zero errors/failures (manual controller/service, lifecycle coverage, account export/deletion and SPA routes).
- Full frontend unit suite passed. Contract suite initially had 350 passes and a missing `/training-plan` private-title failure. English/Chinese route titles were added and the failing SEO contract passed afterward.
- Desktop and 390px mobile fixture previews inspected; opaque goal dialog corrected.

Live deployment evidence is recorded in `../deploy.md`. Native device checks and a real signed-in production run save have not been performed.
