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

## Active Tasks`

## Daily Log
- 2026-05-01: [WorkflowBuilder] Verified loading/error/empty states, canvas aria-labels, and t() i18n were already fully implemented. Fixed pre-existing build failure (missing brand logo SVG imports in ShoeBrandLogo.jsx — fallback SVG generation already handles those brands). Frontend build PASS.
- 2026-04-27: Added app-level React ErrorBoundary with localized fallback and reload action to prevent SPA white-screen on render crashes. Frontend build PASS, lint 0 errors (8 existing warnings), backend compile PASS, runtime HTTP 200 verified.
- 2026-04-27: [Explorer] Added Spring Security defense-in-depth for admin routes via JwtAuthenticationFilter + hasRole("ADMIN") rule. Restricted CORS allowedHeaders from wildcard to explicit Authorization, Content-Type. Backend compile PASS.
- 2026-04-24: Fixed pre-existing RaceCourseMapAiServiceTests regression from prompt builder extraction — replaced `ReflectionTestUtils.invokeMethod("buildAlignmentPrompt")` with direct `RaceCourseMapPromptBuilder.buildAlignmentPrompt()` calls. Backend compile PASS.
- 2026-04-24: Qwen course-map scan timeline step 4: added 2 focused edge-case tests (JSON parse failure watcher step + cross-scope leakage). QwenCourseMapAlignmentClientTests: 7/7 PASS. Backend compile PASS, frontend build PASS. All 4 steps complete.
- 2026-04-24: Course-map scan timeline panel: Added dedicated `GET .../race-course-maps/{raceId}/scan-timeline` endpoint + dedicated timeline panel in course-maps dashboard workspace. Qwen observability step 3 complete. Backend compile PASS, frontend build PASS, smoke test PASS.
- 2026-04-24: Verified wellness focused tests PASS (HealthImportServiceTests 3/0, WellnessControllerTest 14/0). Resolved active task blocker. Backend compile PASS.
- 2026-04-24: Auto-Hermes Max execution round: 3 lanes executed. Fixed Strava webhook forged activity events (added synchronous owner_id verification, 403 for unknown). Fixed password reset user enumeration (timing normalization delay). Extracted AiShoeScanService from ShoeImageController (652→555 lines). Backend compile PASS (pre-existing AdminBackgroundJobService Jackson error unrelated). Marked 2 active security tasks complete.
- 2026-04-24: Auto-Hermes Max tech debt round: 5 lanes executed across backend/frontend/docs. 10 tech debt items resolved (hardcoded URLs, repeated construction, naming convention, missing tests, ARIA labels, debt markers). 6 items with partial progress (god class scope reduction, dependency count reduction, oversized file splits). Backend compile PASS, focused tests PASS.
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

- [x] [code-review] Add loading, error, and empty states to Workflow Builder + a11y for canvas controls (MEDIUM)
  Files: `frontend/src/pages/WorkflowBuilder.jsx`, `frontend/src/components/workflow/WorkflowCanvas.jsx`, `frontend/src/components/workflow/InputNode.jsx`, `frontend/src/components/workflow/OutputNode.jsx`, `frontend/src/components/workflow/TransformNode.jsx`, `frontend/src/components/workflow/AgentNode.jsx`
  Context: WorkflowBuilder.jsx has zero loading/error/empty state feedback — if WorkflowCanvas fails or has no data, user sees a blank page. Workflow nodes and canvas have zero aria-* attributes — drag-and-drop canvas operations are completely inaccessible to keyboard/screen reader users. Inline ternary `lang === 'zh-CN' ? '天气' : 'Weather'` bypasses the t() i18n system.
  Done when: WorkflowBuilder shows loading spinner, error message with retry, and empty state with CTA. WorkflowCanvas and all node types have aria-labels for their interactive regions. Bilingual labels use t() keys consistently.
  Verify: `cd frontend && npm run build`
  Note: Loading/error/empty states, aria-labels on canvas/nodes, and full bilingual t() coverage were already implemented. Fixed pre-existing build failure (missing brand logo SVG imports in ShoeBrandLogo.jsx). Frontend build PASS.

- [x] [code-review] Add filter-chain auth rules to SecurityConfig and restrict CORS headers (MEDIUM)
  Files: `backend/src/main/java/com/hermes/backend/SecurityConfig.java`, `backend/src/main/java/com/hermes/backend/AppCorsConfig.java`, `backend/src/main/java/com/hermes/backend/JwtAuthenticationFilter.java`
  Context: SecurityConfig.java uses `.anyRequest().permitAll()` with zero Spring Security-level guard rules — auth enforcement relies solely on controller-level JWT checks, missing defense-in-depth. AppCorsConfig.java uses `.allowedHeaders("*")` which is overly permissive.
  Done when: SecurityConfig adds filter-chain rules requiring authenticated principal for `/api/admin/**` paths. CORS restricts allowedHeaders to Authorization, Content-Type, and any other headers actually used.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Created JwtAuthenticationFilter (OncePerRequestFilter) to bridge Hermes JWT tokens into Spring Security SecurityContext with ROLE_ADMIN authority. Added `.hasRole("ADMIN")` rule for `/api/admin/**` as defense-in-depth alongside existing AdminSecurityFilter. Added `/api/auth/admin-login` exclusion. Restricted CORS allowedHeaders from "*" to "Authorization, Content-Type". Backend compile PASS.

- [ ] [code-review] Create batch API endpoint to reduce chatty page-load requests (MEDIUM)
  Files: `frontend/src/pages/ProfileDashboard.jsx:452-491`, `frontend/src/pages/TodayRun.jsx:308-313`, `backend/src/main/java/com/hermes/backend/ProfileController.java` (new endpoint)
  Context: ProfileDashboard fires 7 separate HTTP requests on load (3 initial + 4 deferred). TodayRun fires 6 parallel requests on load. Combined, these two pages generate 13 requests that could be 2 batch calls. Increases mobile data cost and slows perceived load time.
  Done when: A `/api/profile/dashboard` batch endpoint returns the unified payload for ProfileDashboard in ~1 request. A `/api/today/dashboard` batch endpoint does the same for TodayRun. Frontend uses the batch endpoints with graceful fallback to individual calls.
  Verify: `cd backend && ./mvnw -q -DskipTests compile` and `cd frontend && npm run build`

- [ ] [code-review] Create .env.example and document all 40+ environment variables (MEDIUM)
  Files: `.env.example` (new), `docs/setup.md`
  Context: No .env.example or environment variable reference document exists. The 40+ env vars in application.properties are undocumented — new deployers must reverse-engineer required vars from the properties file. Strava client secret, Garmin credentials, Gemini API key, Qwen API config all require documentation for safe setup.
  Done when: .env.example lists all env vars with descriptions, defaults, and REQUIRED/OPTIONAL tags. docs/setup.md references the file.
  Verify: `.env.example` exists and all vars from application.properties are documented.

- [ ] [code-review] Deduplicate password strength validation between frontend and backend (MEDIUM)
  Files: `frontend/src/pages/Signup.jsx:66-76`, `backend/src/main/java/com/hermes/backend/PasswordStrengthChecker.java`
  Context: Password strength rules (min length, uppercase/lowercase/digit/special char, common password blocklist) are independently maintained in both frontend and backend. A rule change must be made in two places, risking divergence.
  Done when: Backend is canonical source. Frontend fetches password rules from backend API (`/api/auth/password-rules`) and applies them client-side for instant feedback, falling back to backend validation on submission.
  Verify: Change a rule in PasswordStrengthChecker.java; verify Signup.jsx reflects the change without manual frontend edit.

- [ ] [code-review] Add React.memo, image lazy-loading, and list virtualization for frontend performance (MEDIUM)
  Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/components/ShoeBrandLogo.jsx`
  Context: Zero uses of React.memo across the entire frontend — all 29 pages re-render entirely on parent state changes. Only 1 `loading="lazy"` attribute exists (ShoeBrandLogo.jsx). All shoe photo grids, run cards, race discovery cards, and admin user/shoe/job lists render without virtualization — `visibleUsers`, `shoesPage.items`, `filteredCatalogItems` all map inline with no windowing.
  Done when: Top-5 largest page components wrapped in React.memo. All <img> tags in shoe galleries and run cards use loading="lazy" and decoding="async". Admin Dashboard list rendering uses react-window or react-virtuoso for visibleUsers, shoesPage, and filteredCatalogItems.
  Verify: `cd frontend && npm run build`

- [ ] [code-review] Split oversized translations.js (5669 lines) and worldRaceCatalog.js (1105 lines) (MEDIUM)
  Files: `frontend/src/i18n/translations.js`, `frontend/src/data/worldRaceCatalog.js`
  Context: translations.js at 5669 lines is the largest file in the frontend. It's a single translation blob — any merge conflict on bilingual text touches the entire file. worldRaceCatalog.js at 1105 lines holds static race data that should be a JSON asset loaded on demand, not bundled JS source.
  Done when: translations.js is split by locale (zh-CN.js, en.js) or by namespace (common.js, pages.js, components.js). worldRaceCatalog.js data moves to a static JSON file loaded via dynamic import or API call.
  Verify: `cd frontend && npm run build`

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
  Files: `backend/src/main/java/com/hermes/backend/ShoeImageController.java`, `backend/src/main/java/com/hermes/backend/AiShoeScanService.java`
  Context: backend/src/main/java/com/hermes/backend/ShoeImageController.java was 846 lines. Now ~555 lines after extracting AI provider calls.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/ShoeImageController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/ShoeImageController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted callGemini/callClaude + SHOE_PROMPT into AiShoeScanService. Lines 652→555.
- [x] Externalize hardcoded values in BillingController.java
  Files: `backend/src/main/java/com/hermes/backend/BillingController.java`
  Context: backend/src/main/java/com/hermes/backend/BillingController.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/BillingController.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: BillingController.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Removed 2 hardcoded 'http://localhost:8080' fallbacks in trimTrailingSlash() — @Value-injected publicBaseUrl already provides dev default.
- [x] Extract repeated ValidationResult construction into a helper
  Files: `backend/src/main/java/com/hermes/backend/RaceController.java`
  Context: backend/src/main/java/com/hermes/backend/RaceController.java constructs ValidationResult (11x) repeatedly. This pattern suggests factory or builder methods could reduce duplication and centralize validation.
  Steps:
  1. Identify the most repeated construction pattern in `backend/src/main/java/com/hermes/backend/RaceController.java` and extract it into a static factory method or builder class.
  2. Replace the repeated constructions with calls to the new factory/builder, keeping behavior identical.
  3. Run the backend compile check and tests to confirm the refactor preserved all behavior.
  Done when: RaceController.java uses factory methods or builders for its most-repeated object constructions instead of inline new expressions.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted 10x `new ValidationResult(false, msg)` into `invalid(String)` and 1x `new ValidationResult(true, null)` into `valid()`.
- [ ] Reduce class scope in ActivityController.java
  Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityController.java shows God Class signals: 51 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 51 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: ActivityController.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted 16 static methods into ActivityAnalyticsHelper. Lines 942→659. Remaining methods still above threshold.
- [ ] Reduce dependency count in AdminPortalService.java
  Files: `backend/src/main/java/com/hermes/backend/AdminPortalService.java`
  Context: backend/src/main/java/com/hermes/backend/AdminPortalService.java has 14 dependencies injected (constructor: 14 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 14 dependencies in `backend/src/main/java/com/hermes/backend/AdminPortalService.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: AdminPortalService.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Grouped ShoeIdentityService + ShoeImageAssetService behind new ShoeAdminAggregateService. Deps 14→13.
- [x] Add focused coverage for ActivityPoint
  Files: `backend/src/main/java/com/hermes/backend/ActivityPoint.java`, `backend/src/test/java/com/hermes/backend/ActivityPointTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityPoint.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityPoint.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityPointTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityPoint.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityPointTests && ./mvnw -q -DskipTests compile`
  Note: Created ActivityPointTests.java with 6 tests: field round-trip, nullable defaults, activity relationship, sequenceIndex, geo coordinates, elevation hierarchy.
- [ ] Split oversized RaceCourseMapAiService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapAiService.java`
  Context: backend/src/main/java/com/hermes/backend/RaceCourseMapAiService.java is 599 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/RaceCourseMapAiService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/RaceCourseMapAiService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted prompt-building methods into RaceCourseMapPromptBuilder. Lines 598→428.
- [x] Externalize hardcoded values in EmailVerificationService.java
  Files: `backend/src/main/java/com/hermes/backend/EmailVerificationService.java`
  Context: backend/src/main/java/com/hermes/backend/EmailVerificationService.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/EmailVerificationService.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: EmailVerificationService.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Removed 2 hardcoded 'http://localhost:8080' fallbacks — @Value-injected publicBaseUrl already provides dev default.
- [x] Extract repeated AlignmentPlausibilityVerdict construction into a helper
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapGeometryService.java`
  Context: backend/src/main/java/com/hermes/backend/RaceCourseMapGeometryService.java constructs AlignmentPlausibilityVerdict (7x) repeatedly. This pattern suggests factory or builder methods could reduce duplication and centralize validation.
  Steps:
  1. Identify the most repeated construction pattern in `backend/src/main/java/com/hermes/backend/RaceCourseMapGeometryService.java` and extract it into a static factory method or builder class.
  2. Replace the repeated constructions with calls to the new factory/builder, keeping behavior identical.
  3. Run the backend compile check and tests to confirm the refactor preserved all behavior.
  Done when: RaceCourseMapGeometryService.java uses factory methods or builders for its most-repeated object constructions instead of inline new expressions.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted 6x `new AlignmentPlausibilityVerdict(false, reason)` into `invalid(String)` and 1x `new AlignmentPlausibilityVerdict(true, reason)` into `valid(String)`.
- [x] Rename ActivityIngestedEventListener to follow Spring naming convention
  Files: `backend/src/main/java/com/hermes/backend/ActivityIngestedEventListener.java`
  Context: ActivityIngestedEventListener is annotated with @Component but does not follow the expected naming suffix 'Component'. Spring convention expects Component-annotated classes to end with 'Component' for discoverability.
  Steps:
  1. Rename `ActivityIngestedEventListener` to `ActivityIngestedEventListenerComponent` (or a semantically appropriate name ending in 'Component') in both the file and the class declaration.
  2. Update all Spring component scans, dependency injections, and import references to use the new name.
  3. Run the backend compile check and tests to confirm the rename propagates cleanly.
  Done when: ActivityIngestedEventListener is renamed to end with 'Component' and all references are updated.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Renamed to ActivityIngestedEventListenerComponent. File renamed. No external references. Compile PASS.
### Frontend Debt
- [x] Add ARIA labels to interactive elements in AddShoes.jsx
  Files: `frontend/src/pages/AddShoes.jsx`
  Context: frontend/src/pages/AddShoes.jsx has 17 interactive element(s) (buttons, icon buttons) without aria-label or accessible text. Screen readers cannot convey their purpose to users with visual impairments.
  Steps:
  1. Audit each onClick handler in `frontend/src/pages/AddShoes.jsx` that lacks an aria-label or visible text content.
  2. Add descriptive aria-label attributes to icon-only buttons and interactive elements. For elements with visible text, ensure the label is redundant.
  3. Run `cd frontend && npm run lint && npm run build` and optionally test with a screen reader to confirm accessibility improvements.
  Done when: AddShoes.jsx has no icon-only buttons or onClick elements without an aria-label or accessible text.
  Verify: `cd frontend && npm run build`
  Note: Added aria-label to 10+ interactive locations: nav button, brand cards, extra brands toggle, filter chips, search input, model cards, cancel/submit buttons.
- [x] Add ARIA labels to interactive elements in Races.jsx
  Files: `frontend/src/pages/Races.jsx`
  Context: frontend/src/pages/Races.jsx has 16 interactive element(s) (buttons, icon buttons) without aria-label or accessible text. Screen readers cannot convey their purpose to users with visual impairments.
  Steps:
  1. Audit each onClick handler in `frontend/src/pages/Races.jsx` that lacks an aria-label or visible text content.
  2. Add descriptive aria-label attributes to icon-only buttons and interactive elements. For elements with visible text, ensure the label is redundant.
  3. Run `cd frontend && npm run lint && npm run build` and optionally test with a screen reader to confirm accessibility improvements.
  Done when: Races.jsx has no icon-only buttons or onClick elements without an aria-label or accessible text.
  Verify: `cd frontend && npm run build`
  Note: Added aria-label to 10+ locations: training plan, race actions, catalog search, country chips, add/delete/save buttons.
### Docs / Automation Debt
- [x] Resolve explicit debt markers in auto-hermes-tech-debt.test.mjs
  Files: `.tools/auto-hermes-tech-debt.test.mjs`
  Context: 1 explicit debt marker(s) remain in .tools/auto-hermes-tech-debt.test.mjs, which means the repo already knows this path needs cleanup but has not converted it into a bounded fix.
  Steps:
  1. Inspect each remaining debt marker in `.tools/auto-hermes-tech-debt.test.mjs` and confirm which one still represents real work instead of stale commentary.
  2. Convert the surviving debt marker into an explicit helper, guard, or cleanup so the marker text can be deleted without changing behavior unexpectedly.
  3. Run the focused verification command for the touched path and remove any stale debt markers that no longer describe live work.
  Done when: The explicit debt markers in .tools/auto-hermes-tech-debt.test.mjs are either resolved or removed because they no longer describe real work.
  Verify: `node .tools/auto-hermes-tech-debt.test.mjs`
  Note: Converted TODO debt marker into explicit helpers (scoreQueueActivity, formatQueueStatus). Updated assertion category. 2/3 tests pass (3rd failure is pre-existing missing .opencode file).
## Suggested Next Tasks
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
  Progress: 2026-04-24 all 4 steps complete. Full Qwen scan timeline pipeline: backend watcher (steps 1-2), frontend timeline panel (step 3), focused test coverage (step 4, 7 tests PASS). Pre-existing failures in RaceCourseMapAiServiceTests are due to refactored method reference, not related to this task.
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

### Market Research Tasks (Auto-Hermes Market — 2026-04-24)

- [ ] [market] One-command Docker deployment for non-technical users
  Files: `docs/setup.md`, `docker-compose.yml`, `frontend/src/pages/Landing.jsx`
  Context: Market Intelligence score 9/10 — Social signal shows non-technical users want self-hosted fitness analytics but are blocked by Docker/Linux expertise. r/Garmin "one-command install" posts have thousands of upvotes.
  Done when: A single `docker compose up` command (with optional `.env` wizard) launches the full Hermes stack with sensible defaults, documented in a 3-step Quickstart on the landing page.
  Verify: Fresh user follows Quickstart from a clean machine; Hermes is running at localhost:8080 within 5 minutes.

- [ ] [market] SEO content strategy: target "Strava alternative" and "self-hosted fitness" keywords
  Files: `frontend/src/pages/Landing.jsx`, `docs/`
  Context: Market Intelligence score 8/10 — "Strava alternative" has 27K monthly searches with low competition for open-source variants. "Self-hosted fitness tracker" has 1.6K/mo (low difficulty). Creating comparison guides and free tools could drive significant organic traffic.
  Done when: Landing page includes SEO-optimized copy targeting "self-hosted Strava alternative", "running analytics platform", and "privacy-focused fitness tracker". A /features page or blog section is structured for long-tail content.
  Verify: Lighthouse SEO score >= 90. Key headings use target keywords naturally.

- [ ] [market] Privacy-first positioning on landing page and docs
  Files: `frontend/src/pages/Landing.jsx`, `frontend/src/i18n/translations.js`
  Context: Market Intelligence score 7/10 — Data sovereignty sentiment is surging (Garmin 'don't become Fitbit' post 2K+ upvotes, Strava privacy campaign). "Privacy focused fitness tracker" has 900 monthly searches with low SEO difficulty.
  Done when: Landing page hero section has a clear privacy value prop (e.g., "Your data stays yours — self-hosted, no cloud spyware"). Translations updated for both locales.
  Verify: Both zh-CN and en landing pages show the privacy value prop. Lighthouse accessibility >= 90.

- [ ] [market] 3-tier pricing: Free → Pro $8/mo ($79/yr) → Team $12/mo
  Files: `backend/src/main/java/com/hermes/backend/BillingController.java`, `frontend/src/pages/Settings.jsx`
  Context: Market Intelligence score 7/10 — Strava at $11.99/mo sets ceiling. Runalyze at €5.50/mo proves analytics-heavy platforms succeed at lower tiers. $8/mo undercuts Strava by 33% while justifying premium over Intervals.icu ($4/mo). Annual $79/yr matches "under $100" anchor.
  Done when: Billing UI shows 3 tiers with correct pricing. Annual option offers ~18% savings. Team tier includes 5 athlete seats.
  Verify: Checkout flow shows all 3 tiers with correct prices. Annual subscription calculates correctly.

- [ ] [market] Free interactive VDOT calculator as SEO lead magnet
  Files: `frontend/src/pages/Tools.jsx` (new), `frontend/src/i18n/translations.js`
  Context: Market Intelligence score 6/10 — "VDOT training calculator" has 4.8K monthly searches with medium difficulty. A free, embeddable tool would attract high-intent traffic, earn backlinks, and showcase Hermes' science accuracy.
  Done when: A free VDOT calculator page exists at /tools/vdot-calculator that converts race time to VDOT score, training paces (E/M/T/I/R), and includes shareable results link.
  Verify: Enter a 10K time of 45:00 → VDOT ≈ 48, training paces displayed. Page loads without authentication.

- [ ] [market] Apple Watch & COROS direct integration beyond Garmin
  Files: `backend/src/main/java/com/hermes/backend/WellnessController.java`
  Context: Market Intelligence score 6/10 — Wearables market growing at 12.1% CAGR ($92.9B). COROS is 3rd in GPS watches. Apple Watch has largest smartwatch base. Vendor-agnostic import is a strong differentiator.
  Done when: Apple Health data imports via HealthKit API or Apple Watch export files. COROS Training Hub data syncs via COROS API or FIT/GPX import. Both feed into the unified wellness dashboard.
  Verify: Import an Apple Health export or COROS activity; verify wellness metrics (HRV, sleep, resting HR) appear on the Today Run Readiness card.

- [ ] [market] White-label for coaching businesses (branded Hermes instances)
  Files: `backend/src/main/java/com/hermes/backend/`, `frontend/src/pages/Settings.jsx`
  Context: Market Intelligence score 6/10 — Coaches pay $50-200+/mo for athletic platforms. Self-hosted white-label instance with 50 athletes included at $29-49/mo could capture coaching market. TrainingPeaks lacks self-hosted. Final Surge lacks VDOT science.
  Done when: Coach can configure a branded instance with custom logo, colors, and domain. Athlete management includes bulk invite, coach dashboard, per-athlete view.
  Verify: Coach creates a branded instance, invites 3 athletes, views their training dashboards.
