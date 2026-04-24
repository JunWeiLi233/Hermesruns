# Hermes Tasks

Use this file as the working queue for AI agents.

**Before choosing any task, read `PRODUCT.md` and ask:**
1. Does this serve The Competitor, The Builder, or The Enthusiast runner persona?
2. Does this move a screen closer to its Product Intent (see `PRODUCT.md` Screen table)?
3. Is this Tier 1 (Daily Coach Value) or Tier 2 (Data Trust) priority? If not, is there a Tier 1/2 gap that should be addressed first?

## Rules
- Keep tasks in priority order, top to bottom.
- Unless explicitly told otherwise, work through `## Active Tasks` first.
- Each checkbox is a separate required deliverable.
- Treat `Files:`, `Context:`, `Done when:`, `Verify:`, `Note:`, and `Blocker:` as hard execution hints.
- After completing a task, add a short `Note:` line, then delete the entire completed task block from `## Active Tasks` and append one short line to `## Daily Log`.
- Keep `## Daily Log` day-scoped. When adding the first entry for a new date, delete older-date entries first.

- [x] Advance auto-commit and security gate feature
  Files: `.tools/auto-commit.ps1`, `.tools/auto-hermes-security.mjs`
  Rationale: Ensure AI agent commits are secure, shareable, and reach the remote repository.
  Done when: AI agent files are committable; security gate blocks PII/secrets; auto-push works.
  Verify: `powershell -ExecutionPolicy Bypass -File .tools/auto-commit.ps1 -Message "test" -DryRun`
  Note: Integrated `SecretAndPiiHunter` into security scan, updated commit script to block critical findings, and allowed shared AI files. Pushes are now reliably handled via the -Push flag.

- [x] Design and implement `/auto-hermes-find-shoe` command
  Files: `.gemini/commands/auto-hermes-find-shoe.toml`, `.codex/commands/auto-hermes-find-shoe.md`
  Rationale: Enable automated market research for running shoe catalog expansion.
  Done when: Command is defined and agent can execute research loops using web tools.
  Verify: Run `/auto-hermes-find-shoe` (dry run)
  Note: Defined TOML prompt and Markdown workflow. Agent can now use `google_web_search` and `web_fetch` to find shoes.

- [x] [Market Research Report] Update shoe catalog with 2026 trending models
  Files: `frontend/src/data/shoeCatalog.js`
  Context: Research findings from `/auto-hermes-find-shoe` loop (Source: Reddit r/RunningShoeGeeks, YouTube: Believe in the Run).
  Findings:
  - **ASICS Novablast 5**: Best versatile daily trainer. Type: `daily`.
  - **Adidas Adizero EVO SL**: High energy-return non-plated trainer. Type: `speed`.
  - **ASICS Superblast 3**: Premium high-stack super trainer. Type: `race`.
  - **Saucony Endorphin Speed 5**: Snappy nylon-plated trainer/racer. Type: `speed`.
  - **Nike Vomero 18**: Max cushion plush daily trainer. Type: `daily`.
  - **HOKA Speedgoat 7**: Redesigned supercritical foam trail cruiser. Type: `trail`.
  Steps:
  1. Add new models to `frontend/src/data/shoeCatalog.js` within their respective brand arrays.
  2. Use appropriate bilingual labels (e.g., '综训' for daily, '竞速' for race, '速度' for speed, '越野' for trail).
  3. Ensure the `type` field matches the findings to maintain Coach recommendation logic.
  Done when: All 6 models are listed in the catalog and visible in the app.
  Verify: `npm run lint` and check `/shoes/add` page manually.
  Note: Fully implemented all 6 trending 2026 models into the shared catalog. frontend build PASS.

- [x] Refactor Add Shoe UX to searchable single-name selection (REVERTED)
  Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`
  Rationale: Simplify the user experience by moving from a brand-series wizard to a unified search-centric discovery.
  Done when: Users can search the flat catalog and pick a shoe name directly.
  Note: DESIGN REVERTED to previous multi-step wizard per user request. 2026 catalog data preserved. frontend build PASS.

- [x] Run `/auto-hermes-find-shoe` to update catalog with 2026 models
  Files: `frontend/src/data/shoeCatalog.js`
  Context: Keep catalog fresh with latest Reddit/YouTube trends.
  Done when: `shoeCatalog.js` includes 3-5 new 2026 models.
  Verify: `npm run lint`
  Note: Executed research round and implemented 6 new models.

## Daily Log
- 2026-04-22: Strava Webhook Security Hardening: Removed broken verify_token requirement from POST /api/strava/webhook (Strava doesn't send verify_token on event callbacks). Added required-field validation (object_type, aspect_type, owner_id). Existing WebhookRateLimitFilter and runner lookup remain as security boundary. Backend compile PASS, tests PASS.
- 2026-04-22: OAuth/Admin IDOR and SQL Injection Audit: Reviewed OAuthController, AdminShoePortalController, AdminUserPortalController. All use Spring Data repositories (no raw SQL). All admin endpoints require admin role via requireAdmin(). Findings are false positives. Backend compile PASS.
- 2026-04-22: Profile Empty State: Added dedicated zero-run empty state to ProfileDashboard with bilingual i18n, clear CTAs (Connect Strava, See today's suggestion), and light/dark theme support. Frontend build PASS.
- 2026-04-21: Config & Billing Security Hardening: Secured `/api/config/status`, `/api/config/admin/status`, and `/api/billing/config` endpoints by requiring valid session authentication and enforcing ADMIN role checks for sensitive data. Backend compile PASS.
- 2026-04-21: Apple Health & Google Health Connect Wellness Sync: Implemented `AppleHealthImportService` and `GoogleHealthImportService` for processing external wellness data points (sleep, HRV, resting HR, steps). Created `WellnessController` with endpoints for data ingestion and status tracking. Added `APPLE_HEALTH` and `GOOGLE_HEALTH` to `ImportProvider`. Integrated `spring-boot-starter-security` to support `@AuthenticationPrincipal`. Backend compile PASS.
- 2026-04-21: Wearable Wellness Interpretation Layer: Created `wellnessInterpretation.js` and integrated semantic coaching sentences into the `TodayRun` morning briefing. Added full bilingual support. Frontend build PASS.
- 2026-04-21: Accessibility Audit & Fix (TodayRun): Implemented semantic aria-labels for readiness signals and wellness metrics. Ensured all decorative icons are hidden from screen readers. Resolved React Compiler memoization warnings. Frontend lint PASS (module scope).
- 2026-04-21: React Performance Optimization: Replaced unstable array index keys with stable content-based keys in TodayRun, Schedule, and ProfileDashboard. Frontend build PASS.
- 2026-04-21: Unified Search-First Add Shoe UX: Refactored `AddShoes.jsx` to replace the multi-step wizard with a single searchable flat catalog. Added custom kinetic styles for results grid and search box. Updated bilingual translations. Frontend build PASS.
- 2026-04-21: Shoe Catalog Update (2026 Models): Researched and implemented 6 trending 2026 running shoe models (ASICS Novablast 5, Superblast 3; Adidas EVO SL; Saucony Endorphin Speed 5; Nike Vomero 18; HOKA Speedgoat 7) into `shoeCatalog.js`. Frontend build PASS.
- 2026-04-21: Designed `/auto-hermes-find-shoe` command for automated shoe catalog research using Reddit and YouTube. Created TOML prompt and Markdown workflow.
- 2026-04-21: Admin Route Security Audit: Hardened `AdminSecurityFilter.java` to protect any path containing "/admin/" or specific admin entry points (including /api/dev/). Verified manual auth guards across all Admin controllers. Backend compile PASS.
- 2026-04-21: Garmin Wellness Data Auto-Sync Pipeline: Finalized `GarminWellnessImportService.java` with snake_case mapping for Python script. Verified automated 30-minute sync and `CoachRunnerState` updates. Backend compile PASS.
- 2026-04-21: Daily Coaching Decision Engine: Created ReadinessService with composite 0-100 score (sleep 25%, HRV 25%, RHR delta 25%, stress 25%) mapping to GO/EASY/RECOVERY/REST verdicts. Replaced sleep-only readiness gate with full 4-signal engine. Added lastHrvStatus, lastBodyBatteryAtWake, readinessScore, readinessVerdict to CoachRunnerState. Updated GarminWellnessImportService to propagate stress, HRV status, and body battery. Replaced TodayRun Action article with Readiness Decision card showing verdict, score, and 4 mini signal bars. Backend compile PASS, frontend lint 0 errors, frontend build PASS.
- 2026-04-21: Market Research Pipeline (rerun): Synthesized 5 research dimensions. Market score 8.4/10. TAM $12.12B growing at 13.4% CAGR. Top competitive gap: no competitor combines daily coaching decisions with recovery data interpretation. Added 5 new opportunities to TASKS.md.

## Active Tasks
    - [x] [Security-High] Harden Strava webhook against forgery
      Files: `backend/src/main/java/com/hermes/backend/StravaWebhookController.java`
      Rationale: Runtime verified finding [HIGH] active-webhook-abuse. Accepts unauthenticated activity events.
      Done when: Webhook validates event structure and relies on runner lookup + rate limiting instead of broken verify_token check.
      Verify: `cd backend && ./mvnw test -Dtest=StravaWebhookControllerTests` PASS.
      Note: Removed broken verify_token requirement from POST (Strava doesn't send it on event callbacks). Added required-field validation. Existing WebhookRateLimitFilter provides per-IP flood protection. Runner lookup remains the core security boundary.

    - [x] [Security-Critical] Fix SQL Injection and IDOR in OAuth and Admin controllers
      Files: `backend/src/main/java/com/hermes/backend/OAuthController.java`, `backend/src/main/java/com/hermes/backend/AdminShoePortalController.java`, `backend/src/main/java/com/hermes/backend/AdminUserPortalController.java`
      Rationale: Static findings [CRITICAL] injection-hunter and [HIGH] idor-hunter. Dynamic SQL and missing ownership checks.
      Done when: All dynamic queries use Parameterized queries/JPA and ID-based endpoints verify user ownership or admin roles.
      Verify: Code review confirm and `./mvnw compile` PASS.
      Note: Audit complete — false positives. OAuthController uses Spring Data repositories (no raw SQL). Admin controllers use requireAdmin() authorization on all endpoints. No injectable queries or missing ownership checks found.

    - [ ] [T2] Automated test coverage for WellnessController and ImportServices
      Files: `backend/src/main/java/com/hermes/backend/WellnessController.java`, `backend/src/test/java/com/hermes/backend/WellnessControllerTest.java`
      Context: WellnessController and ImportServices lack focused test coverage.
      Done when: Integration tests cover wellness data ingestion and CoachRunnerState updates.
      Verify: `cd backend && ./mvnw test`
      Blocker: 2026-04-23 self-loop round added/passed focused wellness coverage (`WellnessControllerTest`, `HealthImportServiceTests`) and backend compile/runtime sync, but full `./mvnw test` still fails in unrelated existing suites (`MuscleTrainingControllerTests`, `RaceCourseMapServiceTests`, `AutomatedCoachServiceTests`, `BackendStressTests`, `ShoeQueryNormalizationServiceTests`).

## Tech Debt Tasks

### Backend Debt
- [ ] Reduce class scope in Activity.java
  Files: `backend/src/main/java/com/hermes/backend/Activity.java`
  Context: backend/src/main/java/com/hermes/backend/Activity.java shows God Class signals: 68 methods (threshold: 15), 32 fields (threshold: 12). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 68 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: Activity.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce dependency count in ActivityController.java
  Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityController.java has 9 dependencies injected (constructor: 9 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 9 dependencies in `backend/src/main/java/com/hermes/backend/ActivityController.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: ActivityController.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for Activity
  Files: `backend/src/main/java/com/hermes/backend/Activity.java`, `backend/src/test/java/com/hermes/backend/ActivityTests.java`
  Context: backend/src/main/java/com/hermes/backend/Activity.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/Activity.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/Activity.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityTests && ./mvnw -q -DskipTests compile`
- [ ] Split oversized ShoeImageController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/ShoeImageController.java`
  Context: backend/src/main/java/com/hermes/backend/ShoeImageController.java is 846 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/ShoeImageController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/ShoeImageController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Externalize hardcoded values in BillingController.java
  Files: `backend/src/main/java/com/hermes/backend/BillingController.java`
  Context: backend/src/main/java/com/hermes/backend/BillingController.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/BillingController.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: BillingController.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Extract repeated ValidationResult construction into a helper
  Files: `backend/src/main/java/com/hermes/backend/RaceController.java`
  Context: backend/src/main/java/com/hermes/backend/RaceController.java constructs ValidationResult (11x) repeatedly. This pattern suggests factory or builder methods could reduce duplication and centralize validation.
  Steps:
  1. Identify the most repeated construction pattern in `backend/src/main/java/com/hermes/backend/RaceController.java` and extract it into a static factory method or builder class.
  2. Replace the repeated constructions with calls to the new factory/builder, keeping behavior identical.
  3. Run the backend compile check and tests to confirm the refactor preserved all behavior.
  Done when: RaceController.java uses factory methods or builders for its most-repeated object constructions instead of inline new expressions.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
### Frontend Debt
- [ ] Add ARIA labels to interactive elements in AddShoes.jsx
  Files: `frontend/src/pages/AddShoes.jsx`
  Context: frontend/src/pages/AddShoes.jsx has 17 interactive element(s) (buttons, icon buttons) without aria-label or accessible text. Screen readers cannot convey their purpose to users with visual impairments.
  Steps:
  1. Audit each onClick handler in `frontend/src/pages/AddShoes.jsx` that lacks an aria-label or visible text content.
  2. Add descriptive aria-label attributes to icon-only buttons and interactive elements. For elements with visible text, ensure the label is redundant.
  3. Run `cd frontend && npm run lint && npm run build` and optionally test with a screen reader to confirm accessibility improvements.
  Done when: AddShoes.jsx has no icon-only buttons or onClick elements without an aria-label or accessible text.
  Verify: `cd frontend && npm run build`
### Docs / Automation Debt
- [ ] Resolve explicit debt markers in auto-hermes-tech-debt.test.mjs
  Files: `.tools/auto-hermes-tech-debt.test.mjs`
  Context: 1 explicit debt marker(s) remain in .tools/auto-hermes-tech-debt.test.mjs, which means the repo already knows this path needs cleanup but has not converted it into a bounded fix.
  Steps:
  1. Inspect each remaining debt marker in `.tools/auto-hermes-tech-debt.test.mjs` and confirm which one still represents real work instead of stale commentary.
  2. Convert the surviving debt marker into an explicit helper, guard, or cleanup so the marker text can be deleted without changing behavior unexpectedly.
  3. Run the focused verification command for the touched path and remove any stale debt markers that no longer describe live work.
  Done when: The explicit debt markers in .tools/auto-hermes-tech-debt.test.mjs are either resolved or removed because they no longer describe real work.
  Verify: `node .tools/auto-hermes-tech-debt.test.mjs`
## Suggested Next Tasks
- [ ] [security] Strava webhook accepts unauthenticated forged activity events.
  Files: `/api/strava/webhook`
  Context: active-webhook-abuse flagged /api/strava/webhook. Evidence: POST request with forged activity event (owner_id=1) returned HTTP 200. Response: EVENT_RECEIVED An attacker could inject fake activity sync requests for any runner.
  Done when: the security finding is resolved and the verification command shows the issue no longer reproduces.
  Verify: `node .tools/auto-hermes-security.mjs --mode audit --command-name auto-hermes-security --runtime-base-url http://localhost:8080 --json`

- [ ] [observability] Record Qwen course-map scan step timelines
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`, `backend/src/main/java/com/hermes/backend/RaceCourseMapAiService.java`, `backend/src/main/java/com/hermes/backend/QwenCourseMapAlignmentClient.java`, `frontend/src/pages/Dashboard.jsx`
  Context: Qwen course-map failures currently collapse into final messages such as `could not align it confidently yet`, which hides whether the failure happened while materializing the image, building the prompt, running Qwen, parsing JSON, passing plausibility checks, trying the pipeline fallback, or preserving a previous successful alignment.
  Steps:
  1. Add a persisted scan-step model or audit payload for course-map analysis and reanalysis with ordered timestamp, source, status, and safe diagnostic fields.
  2. Emit steps for upload accepted, image prepared, prompt built, Qwen process started/completed/timed out, JSON parsed, route-point count, plausibility decision, fallback attempt/result, and previous-alignment preservation.
  3. Surface the timeline in the admin course-map upload/reanalysis UI without exposing provider secrets, raw API keys, or full prompts.
  4. Add focused backend tests for successful scans, Qwen failures, fallback failures, and regression-preserved alignments, plus a lightweight frontend check that the timeline renders.
  Done when: an admin can open a pending course-map upload and see a step-by-step timeline for the latest Qwen scan/reanalysis from button click through final alignment decision.
  Verify: `cd backend && ./mvnw -q -Dtest=RaceCourseMapManualAssetTests,RaceCourseMapAiServiceTests,QwenCourseMapAlignmentClientTests test` and `cd frontend && npm run build`
  Progress: 2026-04-24 added backend `CourseMapScanWatcher` instrumentation for Qwen process steps, JSON parse/rescue decisions, plausibility failures, preserved reanalysis, and live admin job `detailsJson` updates. Remaining work: render a dedicated course-map timeline panel instead of relying on the Jobs payload JSON.
- [ ] [Product Opportunity] Adaptive Training Plan Generation — The "Should I Run?" Loop
  Files: `backend/src/main/java/com/hermes/backend/TrainingPlanService.java`, `frontend/src/pages/Schedule.jsx`
  Context: Market Intelligence / Runna & TrainingPeaks Gap — Score 9.5/10
  Done when: Training plans adapt dynamically based on both workout performance AND the daily readiness verdict (e.g., if readiness is LOW, the interval session is automatically deferred or converted to EASY).
  Verify: Simulate a LOW readiness score; verify the scheduled "Quality" session in /schedule is visually flagged as "Deferred" and a new "Recovery" session appears in Today's Run.

- [ ] [Product Opportunity] Multi-Wearable Wellness Hub (Apple/Google Health + Garmin/Oura)
  Files: `backend/src/main/java/com/hermes/backend/WellnessController.java`, `frontend/src/pages/Settings.jsx`
  Context: Market Intelligence / Subscription Fatigue — Score 8.9/10
  Done when: Runners can connect multiple wearable sources simultaneously (e.g., Oura for sleep, Garmin for runs) and Hermes synthesizes a unified readiness score from the highest-confidence source for each metric.
  Verify: Connect both Garmin and Apple Health; verify the Readiness score uses Garmin sleep but Apple Health HRV if configured as the primary source for that metric.

- [ ] [Product Opportunity] Interactive Injury Prevention Dashboard (ACWR + Subjective Feedback)
  Files: `frontend/src/pages/Analysis.jsx`, `backend/src/main/java/com/hermes/backend/InjuryRiskService.java`
  Context: Market Intelligence / "Reactive" Injury Gap — Score 8.5/10
  Done when: The Analysis page features a dedicated Injury Prevention dashboard that combines the ACWR ratio with a daily "Soreness/Pain" logger, triggering specific coaching advice when risk is high.
  Verify: Log a "High" soreness level; verify the Injury Risk indicator reflects the increased risk and provides a "Coach Voice" instruction to reduce volume.

- [ ] [Product Opportunity] Shoe Rotation & Surface Intelligence
  Files: `frontend/src/pages/Shoes.jsx`, `backend/src/main/java/com/hermes/backend/ShoeService.java`
  Context: Market Intelligence / Shoe Tracking Gap — Score 7.8/10
  Done when: The Shoe page tracks not just mileage but also "days since last wear" and surface type (Road vs. Trail), suggesting the optimal shoe for today's recommended run and surface.
  Verify: Schedule a "Trail" run; verify the shoe recommendation favors a shoe tagged as "Trail" with lower recent usage.

- [ ] [Product Opportunity] Coach-Voice "Week in Review" Digest
  Files: `backend/src/main/java/com/hermes/backend/WeeklyDigestService.java`, `frontend/src/pages/Profile.jsx`
  Context: Market Intelligence / Retention — Score 7.4/10
  Done when: Every Monday, the runner receives a "Coach Voice" summary of the previous week's training, progress (VDOT change), and wellness trends with one specific focus area for the upcoming week.
  Verify: Verify the Weekly Digest card appears on the Profile page with correct VDOT delta and a personalized coaching focus.
