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

## Route Audit Notes
- Premium runner-facing shells now cover: `/profile`, `/analysis`, `/prediction/:distKey`, `/today-run`, `/runs`, `/run/:id`, `/rewards`, `/settings`, `/shoes`, `/races`, `/races/details/:raceId`, `/schedule`, `/muscle-training`, `/heatmap`, and `/weather`.
- Explicit non-runner-shell exceptions: `/` is the public landing page, `/login` and `/signup` are public auth/editorial surfaces, `/admin` and `/dashboard` are admin/operator surfaces, and `/shoe-catalog` remains a utility catalog route rather than a premium runner-facing shell.

## Tech Debt Tasks
### Frontend Debt
### Backend Debt
- [ ] Split oversized AutomatedCoachService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: backend/src/main/java/com/hermes/backend/AutomatedCoachService.java is 1231 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/AutomatedCoachService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Split oversized MuscleTrainingPlannerService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java`
  Context: backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java is 1235 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/MuscleTrainingPlannerService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Split oversized OAuthController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/OAuthController.java`
  Context: backend/src/main/java/com/hermes/backend/OAuthController.java is 1522 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/OAuthController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/OAuthController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Split oversized RaceCourseMapService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`
  Context: backend/src/main/java/com/hermes/backend/RaceCourseMapService.java is 1756 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/RaceCourseMapService.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Split oversized AdminPortalController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/AdminPortalController.java`
  Context: backend/src/main/java/com/hermes/backend/AdminPortalController.java is 1119 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/AdminPortalController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/AdminPortalController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
### Docs / Automation Debt

## Suggested Next Tasks

### TIER 1 - Daily Coach Value (Today's Run / VDOT / Injury Prevention)
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

- [ ] [Market Opportunity] Coach-Voice Weekly Summary
  Files: `frontend/src/pages/WeeklySummary.vue`, `backend/src/main/java/com/hermes/coach/WeeklyVerdict.java`
  Context: Market Intelligence / running coaching apps
  Done when: Weekly view shows a coach-voice summary: 'Your fitness is trending up (+2 VDOT this month). Your ACWR is in the sweet spot. You're on track for your 10K goal.'
  Score: 7.8/10
  Verify: Unit: summary generates correct verdict from input data; E2E: navigate to weekly summary, see verdict text
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`

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
- [ ] [Market Opportunity] Smart Shoe Rotation Tracker
  Files: `frontend/src/components/ShoeRecommendation.vue`, `backend/src/main/java/com/hermes/inventory/ShoeTracker.java`
  Context: Market Intelligence / running coaching apps
  Done when: Today view shows recommended shoe for today's workout based on shoe mileage and workout type; shoe page shows mileage per shoe with replacement alert
  Score: 7.5/10
  Verify: E2E: add shoe, log runs, see mileage accumulate, see recommendation
  Source: `.ai-sync/market/MARKET_INTELLIGENCE.json`

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
