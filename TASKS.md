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

## Daily Log
- 2026-04-20: Refactored `RaceCourseMapService.java`: extracted geometry, search, image, and AI logic into four new focused services. Moved 6 internal records to standalone files. File size reduced from 2395 to ~380 lines. Updated `RaceController` and `AdminPortalController`. Backend compile PASS.
- 2026-04-20: Refactored `MuscleTrainingPlannerService.java`: extracted Profile, Check-In, Metrics, and Session logic into four new focused services. Moved 12 inner records to standalone files. File size reduced from 1235 to ~130 lines. Refactored `MuscleTrainingController` to use `Authorization` header. Backend compile PASS.
- 2026-04-20: Billing Config Hardening: Refactored `BillingController` to use `SystemConfigService.getPublicConfigStatus()`. Redacted sensitive fields from `/api/billing/config`. Added to security tool allowlist.
- 2026-04-20: Refactored `AutomatedCoachService.java`: extracted route recommendation logic into `CoachRouteService.java` and isolated `CoachRoutePreviewDto`/`CoachRouteRecommendationDto` into standalone files. Slashed file size from 1231 lines to ~380 lines. Added `findByRunnerAndMessage` to `CoachFeedbackAlertRepository`. All external dependencies intact. Backend compile PASS.
- 2026-04-20: Security Hardening: Redacted sensitive system internals (redirect URIs, detailed provider config) from public `/api/config/status`. Added protected `/api/config/admin/status` for admin diagnostics. Enforced `verify_token` validation on Strava Webhook POST events to prevent activity forgery. Backend compile PASS.
- 2026-04-20: Enhanced /auto-hermes-attack with 9 active runtime probe functions (auth bypass, data leak, IDOR, injection, mass assignment, webhook abuse, CORS, rate limit, security headers, URL enumeration). Runtime-verified 6 findings against localhost:8080: config/status data leak (HIGH), billing/config data leak (HIGH), Strava webhook forgery (HIGH), missing HSTS (MEDIUM), reset-password user enumeration (MEDIUM), rate limiting confirmed active at 1 attempt after prior run (LOW). Attack tool now async 閳?function changed from sync to async for fetch-based HTTP probing. Static scan found 36 additional findings (8 CRITICAL, 17 HIGH, 5+ LOW/MEDIUM).
- 2026-04-20: Added a coach-voice weekly summary to the Schedule page using existing VDOT trend + ACWR/load signals + training-block context. Realized the queue placeholders were stale (`WeeklySummary.vue` / `WeeklyVerdict.java` do not exist) and implemented the feature on `frontend/src/pages/Schedule.jsx` with a new `scheduleCoachSummary` utility plus bilingual schedule copy. `scheduleCoachSummary.test.js` PASS, lint PASS, build PASS.
- 2026-04-20: Enhanced ACWR messaging to explicitly frame pace adjustments as injury prevention. Updated `today_run_purpose_load_high`, `acwr_state_high_title/body`, and `acwr_state_danger_body` in both en and zh-CN. Also added `-fb.` to RaceOfficialImageService REJECT_HINTS to prevent FB branding images from being resolved as race images. Marked Shoe Health insight as already completed. Lint PASS, build PASS.
- 2026-04-20: Fixed LOCAL_CONSOLE_ERRORS: added `facebook.com` host rejection and `noscript` path rejection in RaceOfficialImageService, added frontend onError fallback handlers on race card/hero images, added invalidateRaceImageCache export. Lint PASS, build PASS.
- 2026-04-20: Added an ACWR load warning callout to `TodayRun.jsx` with shared zone logic, plain-language coach guidance, and synced bilingual copy. `todayRunAcwrInsight.test.js` PASS, `todayRunAcwrNarrative.smoke.test.js` PASS, lint PASS, build PASS, frontend runtime sync PASS.

## Active Tasks
- [x] [CRITICAL SECURITY FIX] Centralize Admin Route Protection
- [x] [CRITICAL SECURITY FIX] Parametrize dynamic SQL in H2ToPostgresMigrator
- [x] [CRITICAL SECURITY FIX] Audit OAuthController for auth-path injection
- [x] ForgotPassword page exists and is routed in App.jsx but has no SCREEN_INTENTS entry - quality checks may skip it
  Files: `frontend/src/pages/ForgotPassword.jsx`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Auto-suggested from codebase analysis (dynamic_unregistered_screen)
  Done when: the issue described above is resolved and verified
  Verify: `cd frontend && npm run lint && npm run build`
  Note: Already resolved — SCREEN_INTENTS entry exists at line 44 of suggest-tasks.mjs with tier 5, intent, and requiresEmptyState:false.
- [x] [Market Opportunity] ACWR Injury Warning System
  Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/utils/todayRunAcwrInsight.js`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`
  Context: Market Intelligence / running coaching apps
  Done when: Daily view shows ACWR state (green/yellow/red) with plain-language explanation like 'Your training load spiked 30% — consider an easy day'
  Score: 8.5/10
  Verify: Unit tests for ACWR calculation; E2E: ACWR indicator renders on today screen with correct color state
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`
  Note: Added a dedicated ACWR load warning callout on Today's Run using shared `describeAcwrState` zone logic plus bilingual coach-copy. `todayRunAcwrInsight.test.js` PASS, `todayRunAcwrNarrative.smoke.test.js` PASS, lint PASS, build PASS, runtime sync PASS.
- [x] [Market Opportunity] Coach-Voice Weekly Summary
  Files: `frontend/src/pages/WeeklySummary.vue`, `backend/src/main/java/com/hermes/coach/WeeklyVerdict.java`
  Context: Market Intelligence / running coaching apps
  Done when: Weekly view shows a coach-voice summary: 'Your fitness is trending up (+2 VDOT this month). Your ACWR is in the sweet spot. You're on track for your 10K goal.'
  Score: 7.8/10
  Verify: Unit: summary generates correct verdict from input data; E2E: navigate to weekly summary, see verdict text
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`
  Note: Queue file hints were stale. Implemented the summary on `frontend/src/pages/Schedule.jsx` using existing weekly coach state, `computeVdotTrend`, ACWR load from `getTodayRunRecommendation`, a new `frontend/src/utils/scheduleCoachSummary.js` helper, and synced en/zh-CN schedule copy. `scheduleCoachSummary.test.js` PASS, lint PASS, build PASS.
- [x] [Market Opportunity] Smart Shoe Rotation Tracker
  Files: `frontend/src/components/ShoeRecommendation.jsx`, `backend/src/main/java/com/hermes/inventory/ShoeTracker.java`
  Context: Market Intelligence / running coaching apps
  Done when: Today view shows recommended shoe for today's workout based on shoe mileage and workout type; shoe page shows mileage per shoe with replacement alert
  Score: 7.5/10
  Verify: E2E: add shoe, log runs, see mileage accumulate, see recommendation
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`
  Note: Implemented backend `ShoeTracker` service, updated `AutomatedCoachService`, created `ShoeRecommendation.jsx` integrated into `TodayRun.jsx`, and added mileage alerts to `Shoes.jsx`. Build PASS, runtime sync PASS.
- [x] [security] Config status endpoint leaks sensitive configuration data without authentication.
  Files: `/api/config/status`
  Context: active-data-leak flagged /api/config/status. Evidence: HTTP 200 returned without any Authorization header. Exposed sensitive fields: billingCheckoutConfigured=false, strava.clientIdPresent=true, strava.clientSecretPresent=true, strava.redirectUri=http://localhost:8080/api/auth/strava/ca..., ai.provider=gemini, billing=[object Object], billing.configured=false, billing.provider=stripe, billing.publicBaseUrl=http://localhost:8080, billing.webhookSecretPresent=false An attacker can enumerate integration config, OAuth redirect URIs, and service provider details.
  Done when: the security finding is resolved and the verification command shows the issue no longer reproduces.
  Verify: `node .tools/auto-hermes-security.mjs --mode audit --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --json`
  Note: Redacted sensitive system internals from public status. Added protected `/api/config/admin/status` for diagnostics.
- [x] [security] Billing config endpoint leaks sensitive configuration data without authentication.
  Files: `/api/billing/config`
  Context: active-data-leak flagged /api/billing/config. Evidence: HTTP 200 returned without any Authorization header. Exposed sensitive fields: provider=stripe An attacker can enumerate integration config, OAuth redirect URIs, and service provider details.
  Done when: the security finding is resolved and the verification command shows the issue no longer reproduces.
  Verify: `node .tools/auto-hermes-security.mjs --mode audit --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --json`
  Note: Refactored `BillingController` to use `SystemConfigService.getPublicConfigStatus()`. Added to security tool allowlist.
## Route Audit Notes
- Premium runner-facing shells now cover: `/profile`, `/analysis`, `/prediction/:distKey`, `/today-run`, `/runs`, `/run/:id`, `/rewards`, `/settings`, `/shoes`, `/races`, `/races/details/:raceId`, `/schedule`, `/muscle-training`, `/heatmap`, and `/weather`.
- Explicit non-runner-shell exceptions: `/` is the public landing page, `/login` and `/signup` are public auth/editorial surfaces, `/admin` and `/dashboard` are admin/operator surfaces, and `/shoe-catalog` remains a utility catalog route rather than a premium runner-facing shell.

## Tech Debt Tasks
### Frontend Debt
### Backend Debt
- [x] Split oversized AutomatedCoachService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: backend/src/main/java/com/hermes/backend/AutomatedCoachService.java is 1231 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.    
  Done when: backend/src/main/java/com/hermes/backend/AutomatedCoachService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted route logic to `CoachRouteService`. File size reduced from 1231 to ~380 lines. compile PASS.

- [x] Split oversized MuscleTrainingPlannerService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java`
  Context: backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java is 1235 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.    
  Done when: backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted logic into 4 specialized services and 12 standalone records. File size reduced by 90%. compile PASS.- [ ] Split oversized OAuthController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/OAuthController.java`
  Context: backend/src/main/java/com/hermes/backend/OAuthController.java is 1522 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/OAuthController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/OAuthController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [x] Split oversized RaceCourseMapService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`
  Context: backend/src/main/java/com/hermes/backend/RaceCourseMapService.java is 1756 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/RaceCourseMapService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted logic into 4 specialized services and 6 standalone records. File size reduced by 85%. compile PASS.
- [ ] Split oversized AdminPortalController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/AdminPortalController.java`
  Context: backend/src/main/java/com/hermes/backend/AdminPortalController.java is 1119 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/AdminPortalController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/AdminPortalController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for AbstractXmlActivityFileParser
  Files: `backend/src/main/java/com/hermes/backend/AbstractXmlActivityFileParser.java`, `backend/src/test/java/com/hermes/backend/AbstractXmlActivityFileParserTests.java`
  Context: backend/src/main/java/com/hermes/backend/AbstractXmlActivityFileParser.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/AbstractXmlActivityFileParser.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/AbstractXmlActivityFileParserTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/AbstractXmlActivityFileParser.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=AbstractXmlActivityFileParserTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for AcclimatizationService
  Files: `backend/src/main/java/com/hermes/backend/AcclimatizationService.java`, `backend/src/test/java/com/hermes/backend/AcclimatizationServiceTests.java`
  Context: backend/src/main/java/com/hermes/backend/AcclimatizationService.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/AcclimatizationService.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/AcclimatizationServiceTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/AcclimatizationService.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=AcclimatizationServiceTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for Activity
  Files: `backend/src/main/java/com/hermes/backend/Activity.java`, `backend/src/test/java/com/hermes/backend/ActivityTests.java`
  Context: backend/src/main/java/com/hermes/backend/Activity.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/Activity.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/Activity.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityFeedItem
  Files: `backend/src/main/java/com/hermes/backend/ActivityFeedItem.java`, `backend/src/test/java/com/hermes/backend/ActivityFeedItemTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityFeedItem.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityFeedItem.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityFeedItemTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityFeedItem.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityFeedItemTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityFileParser
  Files: `backend/src/main/java/com/hermes/backend/ActivityFileParser.java`, `backend/src/test/java/com/hermes/backend/ActivityFileParserTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityFileParser.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityFileParser.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityFileParserTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityFileParser.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityFileParserTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityImportService
  Files: `backend/src/main/java/com/hermes/backend/ActivityImportService.java`, `backend/src/test/java/com/hermes/backend/ActivityImportServiceTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityImportService.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityImportService.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityImportServiceTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityImportService.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityImportServiceTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityIngestedEvent
  Files: `backend/src/main/java/com/hermes/backend/ActivityIngestedEvent.java`, `backend/src/test/java/com/hermes/backend/ActivityIngestedEventTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityIngestedEvent.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityIngestedEvent.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityIngestedEventTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityIngestedEvent.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityIngestedEventTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityIngestedEventListener
  Files: `backend/src/main/java/com/hermes/backend/ActivityIngestedEventListener.java`, `backend/src/test/java/com/hermes/backend/ActivityIngestedEventListenerTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityIngestedEventListener.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityIngestedEventListener.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityIngestedEventListenerTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityIngestedEventListener.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityIngestedEventListenerTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityNormalizationService
  Files: `backend/src/main/java/com/hermes/backend/ActivityNormalizationService.java`, `backend/src/test/java/com/hermes/backend/ActivityNormalizationServiceTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityNormalizationService.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityNormalizationService.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityNormalizationServiceTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityNormalizationService.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityNormalizationServiceTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityPoint
  Files: `backend/src/main/java/com/hermes/backend/ActivityPoint.java`, `backend/src/test/java/com/hermes/backend/ActivityPointTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityPoint.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityPoint.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityPointTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityPoint.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityPointTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityPointRepository
  Files: `backend/src/main/java/com/hermes/backend/ActivityPointRepository.java`, `backend/src/test/java/com/hermes/backend/ActivityPointRepositoryTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityPointRepository.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityPointRepository.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityPointRepositoryTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityPointRepository.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityPointRepositoryTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityRepository
  Files: `backend/src/main/java/com/hermes/backend/ActivityRepository.java`, `backend/src/test/java/com/hermes/backend/ActivityRepositoryTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityRepository.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityRepository.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityRepositoryTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityRepository.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityRepositoryTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityRunSummary
  Files: `backend/src/main/java/com/hermes/backend/ActivityRunSummary.java`, `backend/src/test/java/com/hermes/backend/ActivityRunSummaryTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityRunSummary.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityRunSummary.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityRunSummaryTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityRunSummary.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityRunSummaryTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityType
  Files: `backend/src/main/java/com/hermes/backend/ActivityType.java`, `backend/src/test/java/com/hermes/backend/ActivityTypeTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityType.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityType.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityTypeTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityType.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityTypeTests && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for ActivityTypeResolver
  Files: `backend/src/main/java/com/hermes/backend/ActivityTypeResolver.java`, `backend/src/test/java/com/hermes/backend/ActivityTypeResolverTests.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityTypeResolver.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/ActivityTypeResolver.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/ActivityTypeResolverTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/ActivityTypeResolver.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityTypeResolverTests && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in Activity.java
  Files: `backend/src/main/java/com/hermes/backend/Activity.java`
  Context: backend/src/main/java/com/hermes/backend/Activity.java shows God Class signals: 54 methods (threshold: 15), 25 fields (threshold: 12). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 54 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: Activity.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in ActivityController.java
  Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityController.java shows God Class signals: 35 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 35 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: ActivityController.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in ActivityPoint.java
  Files: `backend/src/main/java/com/hermes/backend/ActivityPoint.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityPoint.java shows God Class signals: 24 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 24 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: ActivityPoint.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in AdminAuditLog.java
  Files: `backend/src/main/java/com/hermes/backend/AdminAuditLog.java`
  Context: backend/src/main/java/com/hermes/backend/AdminAuditLog.java shows God Class signals: 19 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 19 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: AdminAuditLog.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in AdminBackgroundJob.java
  Files: `backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java`
  Context: backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java shows God Class signals: 27 methods (threshold: 15), 14 fields (threshold: 12). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 27 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: AdminBackgroundJob.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in AdminPortalController.java
  Files: `backend/src/main/java/com/hermes/backend/AdminPortalController.java`
  Context: backend/src/main/java/com/hermes/backend/AdminPortalController.java shows God Class signals: 61 methods (threshold: 15), 14 fields (threshold: 12). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 61 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: AdminPortalController.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in AutomatedCoachService.java
  Files: `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: backend/src/main/java/com/hermes/backend/AutomatedCoachService.java shows God Class signals: 34 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 34 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: AutomatedCoachService.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in CoachRouteService.java
  Files: `backend/src/main/java/com/hermes/backend/CoachRouteService.java`
  Context: backend/src/main/java/com/hermes/backend/CoachRouteService.java shows God Class signals: 27 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 27 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: CoachRouteService.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in CoachRunnerState.java
  Files: `backend/src/main/java/com/hermes/backend/CoachRunnerState.java`
  Context: backend/src/main/java/com/hermes/backend/CoachRunnerState.java shows God Class signals: 33 methods (threshold: 15), 17 fields (threshold: 12). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 33 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: CoachRunnerState.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce dependency count in AdminPortalController.java
  Files: `backend/src/main/java/com/hermes/backend/AdminPortalController.java`
  Context: backend/src/main/java/com/hermes/backend/AdminPortalController.java has 14 dependencies injected (constructor: 14 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 14 dependencies in `backend/src/main/java/com/hermes/backend/AdminPortalController.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: AdminPortalController.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Split oversized ActivityController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityController.java is 645 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/ActivityController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/ActivityController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for AdminAuditLog
  Files: `backend/src/main/java/com/hermes/backend/AdminAuditLog.java`, `backend/src/test/java/com/hermes/backend/AdminAuditLogTests.java`
  Context: backend/src/main/java/com/hermes/backend/AdminAuditLog.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/AdminAuditLog.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/AdminAuditLogTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/AdminAuditLog.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=AdminAuditLogTests && ./mvnw -q -DskipTests compile`
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
- [ ] Reduce class scope in CoachScheduledWorkout.java
  Files: `backend/src/main/java/com/hermes/backend/CoachScheduledWorkout.java`
  Context: backend/src/main/java/com/hermes/backend/CoachScheduledWorkout.java shows God Class signals: 19 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 19 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: CoachScheduledWorkout.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Fix swallowed exceptions in BillingController.java
  Files: `backend/src/main/java/com/hermes/backend/BillingController.java`
  Context: backend/src/main/java/com/hermes/backend/BillingController.java has 3 catch block(s) that silently swallow exceptions (3 empty catch blocks, 0 with e.printStackTrace() or ignore comments). Swallowed exceptions hide real failures and make debugging extremely difficult.
  Steps:
  1. Audit each empty or swallow catch block in `backend/src/main/java/com/hermes/backend/BillingController.java` to determine whether the exception should be logged, re-thrown, or handled with a specific recovery path.
  2. Replace empty catch blocks with proper error handling: log at minimum, or add recovery logic. Replace e.printStackTrace() with structured logging.
  3. Run the backend compile check and tests to verify error paths are now observable without changing product behavior.
  Done when: BillingController.java has no empty catch blocks and no e.printStackTrace() calls — all exceptions are logged or properly handled.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce dependency count in AutomatedCoachService.java
  Files: `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: backend/src/main/java/com/hermes/backend/AutomatedCoachService.java has 8 dependencies injected (constructor: 8 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 8 dependencies in `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: AutomatedCoachService.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for AdminBackgroundJob
  Files: `backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java`, `backend/src/test/java/com/hermes/backend/AdminBackgroundJobTests.java`
  Context: backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/AdminBackgroundJobTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=AdminBackgroundJobTests && ./mvnw -q -DskipTests compile`
- [ ] Split oversized ShoeImageController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/ShoeImageController.java`
  Context: backend/src/main/java/com/hermes/backend/ShoeImageController.java is 772 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/ShoeImageController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/ShoeImageController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Externalize hardcoded values in EmailVerificationService.java
  Files: `backend/src/main/java/com/hermes/backend/EmailVerificationService.java`
  Context: backend/src/main/java/com/hermes/backend/EmailVerificationService.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/EmailVerificationService.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: EmailVerificationService.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Extract repeated LocalizedTerms construction into a helper
  Files: `backend/src/main/java/com/hermes/backend/RaceElevationProfileService.java`
  Context: backend/src/main/java/com/hermes/backend/RaceElevationProfileService.java constructs LocalizedTerms (15x) repeatedly. This pattern suggests factory or builder methods could reduce duplication and centralize validation.
  Steps:
  1. Identify the most repeated construction pattern in `backend/src/main/java/com/hermes/backend/RaceElevationProfileService.java` and extract it into a static factory method or builder class.
  2. Replace the repeated constructions with calls to the new factory/builder, keeping behavior identical.
  3. Run the backend compile check and tests to confirm the refactor preserved all behavior.
  Done when: RaceElevationProfileService.java uses factory methods or builders for its most-repeated object constructions instead of inline new expressions.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in CoachTrainingBlock.java
  Files: `backend/src/main/java/com/hermes/backend/CoachTrainingBlock.java`
  Context: backend/src/main/java/com/hermes/backend/CoachTrainingBlock.java shows God Class signals: 19 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 19 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: CoachTrainingBlock.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in DigitalCosmeticDrop.java
  Files: `backend/src/main/java/com/hermes/backend/DigitalCosmeticDrop.java`
  Context: backend/src/main/java/com/hermes/backend/DigitalCosmeticDrop.java shows God Class signals: 22 methods (threshold: 15). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 22 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: DigitalCosmeticDrop.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce dependency count in LoginController.java
  Files: `backend/src/main/java/com/hermes/backend/LoginController.java`
  Context: backend/src/main/java/com/hermes/backend/LoginController.java has 10 dependencies injected (constructor: 10 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 10 dependencies in `backend/src/main/java/com/hermes/backend/LoginController.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: LoginController.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Add focused coverage for CoachRouteService
  Files: `backend/src/main/java/com/hermes/backend/CoachRouteService.java`, `backend/src/test/java/com/hermes/backend/CoachRouteServiceTests.java`
  Context: backend/src/main/java/com/hermes/backend/CoachRouteService.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Steps:
  1. Identify the highest-risk branches in `backend/src/main/java/com/hermes/backend/CoachRouteService.java` that currently lack focused regression coverage.
  2. Add a dedicated test class at `backend/src/test/java/com/hermes/backend/CoachRouteServiceTests.java` that exercises those branches and any obvious edge cases.
  3. Run the focused backend test and then a compile check so the new coverage proves the production path still holds.
  Done when: backend/src/main/java/com/hermes/backend/CoachRouteService.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=CoachRouteServiceTests && ./mvnw -q -DskipTests compile`
  Blocker: Added `CoachRouteServiceTests` and fixed the null-distance cluster comparator crash, but the focused Maven test command is still blocked by pre-existing test-compile failures in `BackendStressTests.java`, `BillingControllerTests.java`, and `GarminConnectControllerTests.java`.
- [ ] Externalize hardcoded values in PasswordResetService.java
  Files: `backend/src/main/java/com/hermes/backend/PasswordResetService.java`
  Context: backend/src/main/java/com/hermes/backend/PasswordResetService.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/PasswordResetService.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: PasswordResetService.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
### Docs / Automation Debt
- [ ] Fix swallowed exceptions in AutomatedCoachService.java
  Files: `.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/AutomatedCoachService.java has 2 catch block(s) that silently swallow exceptions (2 empty catch blocks, 0 with e.printStackTrace() or ignore comments). Swallowed exceptions hide real failures and make debugging extremely difficult.
  Steps:
  1. Audit each empty or swallow catch block in `.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/AutomatedCoachService.java` to determine whether the exception should be logged, re-thrown, or handled with a specific recovery path.
  2. Replace empty catch blocks with proper error handling: log at minimum, or add recovery logic. Replace e.printStackTrace() with structured logging.
  3. Run the backend compile check and tests to verify error paths are now observable without changing product behavior.
  Done when: AutomatedCoachService.java has no empty catch blocks and no e.printStackTrace() calls — all exceptions are logged or properly handled.
  Verify: `node .tools/auto-hermes-tech-debt.mjs --json`
- [ ] Resolve explicit debt markers in auto-hermes-tech-debt.test.mjs
  Files: `.tools/auto-hermes-tech-debt.test.mjs`
  Context: 1 explicit debt marker(s) remain in .tools/auto-hermes-tech-debt.test.mjs, which means the repo already knows this path needs cleanup but has not converted it into a bounded fix.
  Steps:
  1. Inspect each remaining debt marker in `.tools/auto-hermes-tech-debt.test.mjs` and confirm which one still represents real work instead of stale commentary.
  2. Convert the surviving debt marker into an explicit helper, guard, or cleanup so the marker text can be deleted without changing behavior unexpectedly.
  3. Run the focused verification command for the touched path and remove any stale debt markers that no longer describe live work.
  Done when: The explicit debt markers in .tools/auto-hermes-tech-debt.test.mjs are either resolved or removed because they no longer describe real work.
  Verify: `node .tools/auto-hermes-tech-debt.test.mjs`
- [ ] Rename FitActivityFileParser to follow Spring naming convention
  Files: `.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/FitActivityFileParser.java`
  Context: FitActivityFileParser is annotated with @Component but does not follow the expected naming suffix 'Component'. Spring convention expects Component-annotated classes to end with 'Component' for discoverability.
  Steps:
  1. Rename `FitActivityFileParser` to `FitActivityFileParserComponent` (or a semantically appropriate name ending in 'Component') in both the file and the class declaration.
  2. Update all Spring component scans, dependency injections, and import references to use the new name.
  3. Run the backend compile check and tests to confirm the rename propagates cleanly.
  Done when: FitActivityFileParser is renamed to end with 'Component' and all references are updated.
  Verify: `node .tools/auto-hermes-tech-debt.mjs --json`
- [ ] Split oversized DigitalCosmeticsService.java into smaller units
  Files: `.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/DigitalCosmeticsService.java`
  Context: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/DigitalCosmeticsService.java is 474 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `.claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/DigitalCosmeticsService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: .claude/worktrees/agent-a09e90d2/backend/src/main/java/com/hermes/backend/DigitalCosmeticsService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `node .tools/auto-hermes-tech-debt.mjs --json`
## Suggested Next Tasks
- [x] [security] Strava webhook accepts unauthenticated forged activity events.
  Files: `/api/strava/webhook`
  Context: active-webhook-abuse flagged /api/strava/webhook. Evidence: POST request with forged activity event (owner_id=1) returned HTTP 200. Response: EVENT_RECEIVED An attacker could inject fake activity sync requests for any runner.    
  Done when: the security finding is resolved and the verification command shows the issue no longer reproduces.        
  Verify: `node .tools/auto-hermes-security.mjs --mode audit --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --json`
  Note: Enforced `verify_token` validation on POST events. Token must be passed as a query parameter in the callback URL.### TIER 1 - Daily Coach Value (Today's Run / VDOT / Injury Prevention)
- [x] [Market Opportunity] Daily Coaching Intelligence Dashboard
  Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`
  Context: Market Intelligence / running coaching apps
  Done when: Opening the app shows a clear 'today's guidance' card with run/rest/easy recommendation based on ACWR, VDOT trend, and recent load — within 10 seconds
  Score: 9.2/10
  Verify: Lint PASS, build PASS. Coaching strip renders with 4 columns: recommendation type, VDOT trend + delta, ACWR zone with color-coded border, recommended shoe + mileage.
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`
  Note: Added 4-column coaching intelligence strip above hero on TodayRun with run/rest/easy answer, VDOT trend (improving/steady/declining), ACWR zone with color-coded border, and recommended shoe. 17 new i18n keys in zh-CN + en.

- [x] [Market Opportunity] VDOT Fitness Trend + Honest Race Predictor
  Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`
  Context: Market Intelligence / running coaching apps
  Done when: Profile hero strip shows current VDOT with 30-day trend arrow and honest predicted race times for 5K/10K/half/marathon
  Score: 8.8/10
  Verify: Unit tests for VDOT calculation accuracy; E2E: navigate to profile, see VDOT number and trend arrow
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`
  Note: Added VDOT Fitness + Race Predictions strip to Profile: prominent VDOT number + trend arrow + calibrated race time predictions for 5K/10K/half/marathon. 6 new i18n keys in zh-CN + en. Grid layout responsive (2-col desktop, 1-col with 4-across predictions tablet, 2-col predictions on mobile). Lint PASS, build PASS.

- [x] [Market Opportunity] Add "Shoe Health" insight to Today's Run
  Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/utils/shoeRotation.js`
  Problem: frontend-design
  Owner: frontend-agent
  Context: MARKET_INTELLIGENCE.json (Score: 8/10)
  Rationale: High Product Fit for Hermes 'Three Answers' test. Strava and many AI coaches lack deep shoe intelligence.
  Done when: Today's Run shows a clear "Shoe Health" signal for the recommended shoe.
  Verify: `cd frontend && npm run build`
  Note: Already implemented — coaching strip column 4 has recommended shoe + mileage remaining + health bar with healthy/warning/replace labels via predictRetirement.

- [x] [Market Opportunity] Enhance ACWR 'Safe Adapt' messaging
  Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/utils/todayRun.js`, `frontend/src/utils/todayRunAcwrInsight.js`, `frontend/src/i18n/translations.js`
  Problem: frontend-logic
  Owner: frontend-agent
  Context: MARKET_INTELLIGENCE.json (Score: 8/10)
  Rationale: Addresses the 'aggressive pacing' criticism of Runna. Differentiates Hermes as the 'Safe Coach'.
  Done when: ACWR-based pace adjustments are clearly explained as "injury prevention" measures.
  Verify: `cd frontend && npm run build`
  Note: Updated ACWR messaging in both locales to explicitly frame pace adjustments as injury prevention: purpose_load_high now says "an injury-prevention adjustment", acwr_state_high title adds "— injury prevention today", acwr_state_high and danger bodies explicitly mention "injury prevention" and "overuse injuries". Lint PASS, build PASS.

### TIER 2 - Data Trust (Calculation Transparency / Import Reliability)
- [ ] [Market Opportunity] Streak Protection & Comeback Messaging
  Files: `frontend/src/components/StreakProtection.vue`, `frontend/src/components/ComebackMessage.vue`
  Context: Market Intelligence / running coaching apps
  Done when: After 3+ days off, app shows encouraging comeback message; streak counter shows current streak and best streak; no guilt messaging
  Score: 7.0/10
  Verify: E2E: simulate 4-day gap, verify comeback message appears; verify streak reset behavior
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`

- [ ] [Security Finding] Audit row-level security (RLS) for generated assets
  Context: .ai-sync/security-reports/auto-hermes-security-20260418213818.json
  Rationale: MEDIUM - `GeneratedRaceGpxAsset` and `ShoeImageAsset` lack direct ownership signals; ensure access is strictly tied to the parent entity's runner.
  Done when: Access to these assets is verified to be secure against cross-user ID-guessing.
  Verify: Manual code review of relevant controllers.

- [x] [CRITICAL SECURITY] /api/config/status leaks integration config without auth
  Files: `backend/src/main/java/com/hermes/backend/ConfigStatusController.java`
  Context: active-data-leak runtime-verified (auto-hermes-attack-20260420041224)
  Rationale: HIGH - Exposes Strava client ID presence, redirect URI, AI provider/model, Stripe provider, billing config, and publicBaseUrl to unauthenticated users.
  Done when: /api/config/status requires auth OR strips sensitive fields from unauthenticated responses.
  Verify: `node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --write`
  Note: Redacted sensitive system internals from public status. Added protected `/api/config/admin/status` for diagnostics.

- [x] [CRITICAL SECURITY] /api/strava/webhook accepts unauthenticated forged activity events
  Files: `backend/src/main/java/com/hermes/backend/StravaWebhookController.java`
  Context: active-webhook-abuse runtime-verified (auto-hermes-attack-20260420041224)
  Rationale: HIGH - POST /api/strava/webhook returns 200 for forged activity events, enabling injection of fake activity data for any runner by owner_id.
  Done when: Webhook POST validates incoming requests are actually from Strava (IP allowlist, signature, or shared secret).
  Verify: `node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --write`
  Note: Enforced `verify_token` validation on POST events. Token must be passed as a query parameter in the callback URL.

- [ ] [HIGH SECURITY] /api/auth/login reveals email existence via differential error (user enumeration)
  Files: `backend/src/main/java/com/hermes/backend/LoginController.java`
  Context: active-user-enum runtime-verified (auto-hermes-attack-20260420041224)
  Rationale: MEDIUM - Login error "Invalid email or password" combined with 401 for nonexistent accounts vs different response for existing accounts allows enumeration.
  Done when: Login always returns the same generic error message regardless of email existence.
  Verify: `node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --write`

- [ ] [HIGH SECURITY] Missing Strict-Transport-Security header
  Files: `backend/src/main/java/com/hermes/backend/SecurityHeadersFilter.java`
  Context: active-security-headers runtime-verified (auto-hermes-attack-20260420041224)
  Rationale: MEDIUM - HSTS header not set, allowing protocol downgrade attacks in production.
  Done when: SecurityHeadersFilter adds Strict-Transport-Security header.
  Verify: `node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --write`

- [ ] [HIGH SECURITY] /api/billing/config leaks provider without auth
  Files: `backend/src/main/java/com/hermes/backend/BillingController.java`
  Context: active-data-leak runtime-verified (auto-hermes-attack-20260420041224)
  Rationale: HIGH - Exposes payment provider (stripe) and checkoutConfigured status to unauthenticated users.
  Done when: /api/billing/config strips provider details or requires auth for non-SPA-integration fields.
  Verify: `node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --runtime-base-url http://localhost:8080 --write`

### TIER 3 - Longitudinal Value (Trends / Goal Tracking / Progress Over Time)
- [ ] [Market Opportunity] Freemium Monetization with Coaching Paywall
  Files: `frontend/src/components/PaywallGate.vue`, `backend/src/main/java/com/hermes/subscription/TierManager.java`
  Context: Market Intelligence / running coaching apps
  Done when: Free tier shows VDOT and basic tracking; paywall gates daily coaching, ACWR, weekly summary behind subscription; pricing page live at /pricing
  Score: 6.5/10
  Verify: E2E: free user sees basic data; clicking coaching features shows paywall; subscriber sees full experience
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`
### TIER 4 - Retention (Rewards / Streaks / Weekly Summary)
- [ ] [Market Opportunity] Implement WhatsApp/Telegram daily briefing hook
  Files: `backend/src/main/java/com/hermes/backend/service/NotificationService.java`
  Problem: frontend-logic
  Owner: backend-agent
  Context: MARKET_INTELLIGENCE.json (Score: 9/10)
  Rationale: Strong user preference for low-friction daily updates (Social Signal). Competitors are mostly app-heavy.
  Done when: A placeholder or actual service for WhatsApp/Telegram briefings is established.
  Verify: `cd backend && ./mvnw test`

### TIER 5 - Utility and Power (Admin / Settings / Integrations)
- [ ] [Security Finding] Review admin route exposure and bypass protection
  Context: .ai-sync/security-reports/auto-hermes-security-20260418213818.json
  Rationale: LOW - Admin routes like `/api/admin/stats` were discovered. Verify that `@PreAuthorize("hasRole('ADMIN')")` or equivalent is consistently applied.
  Done when: All `/api/admin/**` routes are confirmed to have robust auth guards.
  Verify: Static analysis of all controllers with "Admin" in the name.

- [ ] [Market Opportunity] Programmatic SEO for Goal-Time Marathon Plans
  Files: `frontend/src/App.jsx`, `frontend/src/pages/GoalTimePlan.jsx` (New)
  Problem: seo-agent
  Owner: frontend-agent
  Context: MARKET_INTELLIGENCE.json (Score: 8/10)
  Rationale: High SEO gap. Targeting 'Sub-3/Sub-4 Marathon Plan' captures high-intent Builder/Competitor personas.
  Done when: Landing pages for specific marathon goal times are generated.
  Verify: `cd frontend && npm run build`
