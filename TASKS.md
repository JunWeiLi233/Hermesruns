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

- [x] Refactor Add Shoe UX to searchable single-name selection
  Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`
  Rationale: Simplify the user experience by moving from a brand-series wizard to a unified search-centric discovery.
  Done when: Users can search the flat catalog and pick a shoe name directly.
  Note: Refactored `AddShoes.jsx` to a unified search-first stage. Added kinetic styles for the search box and result grid. Updated bilingual translations. frontend build PASS.

- [x] Run `/auto-hermes-find-shoe` to update catalog with 2026 models
  Files: `frontend/src/data/shoeCatalog.js`
  Context: Keep catalog fresh with latest Reddit/YouTube trends.
  Done when: `shoeCatalog.js` includes 3-5 new 2026 models.
  Verify: `npm run lint`
  Note: Executed research round and implemented 6 new models.

## Daily Log
- 2026-04-21: Unified Search-First Add Shoe UX: Refactored `AddShoes.jsx` to replace the multi-step wizard with a single searchable flat catalog. Added custom kinetic styles for results grid and search box. Updated bilingual translations. Frontend build PASS.
- 2026-04-21: Shoe Catalog Update (2026 Models): Researched and implemented 6 trending 2026 running shoe models (ASICS Novablast 5, Superblast 3; Adidas EVO SL; Saucony Endorphin Speed 5; Nike Vomero 18; HOKA Speedgoat 7) into `shoeCatalog.js`. Frontend build PASS.
- 2026-04-21: Designed `/auto-hermes-find-shoe` command for automated shoe catalog research using Reddit and YouTube. Created TOML prompt and Markdown workflow.
- 2026-04-21: Admin Route Security Audit: Hardened `AdminSecurityFilter.java` to protect any path containing "/admin/" or specific admin entry points (including /api/dev/). Verified manual auth guards across all Admin controllers. Backend compile PASS.
- 2026-04-21: Garmin Wellness Data Auto-Sync Pipeline: Finalized `GarminWellnessImportService.java` with snake_case mapping for Python script. Verified automated 30-minute sync and `CoachRunnerState` updates. Backend compile PASS.
- 2026-04-21: Daily Coaching Decision Engine: Created ReadinessService with composite 0-100 score (sleep 25%, HRV 25%, RHR delta 25%, stress 25%) mapping to GO/EASY/RECOVERY/REST verdicts. Replaced sleep-only readiness gate with full 4-signal engine. Added lastHrvStatus, lastBodyBatteryAtWake, readinessScore, readinessVerdict to CoachRunnerState. Updated GarminWellnessImportService to propagate stress, HRV status, and body battery. Replaced TodayRun Action article with Readiness Decision card showing verdict, score, and 4 mini signal bars. Backend compile PASS, frontend lint 0 errors, frontend build PASS.
- 2026-04-21: Market Research Pipeline (rerun): Synthesized 5 research dimensions. Market score 8.4/10. TAM $12.12B growing at 13.4% CAGR. Top competitive gap: no competitor combines daily coaching decisions with recovery data interpretation. Added 5 new opportunities to TASKS.md.

## Active Tasks
- [ ] [Product Opportunity] Wearable Wellness Interpretation Layer — Turn raw data into coach voice
  Files: `frontend/src/pages/TodayRun.jsx`, `backend/src/main/java/com/hermes/backend/GarminWellnessImportService.java`
  Context: Market Intelligence / running coaching apps — Score 8.7/10
  Done when: Today's Run page shows coach-voice interpretation of each wellness signal (sleep, HRV, stress, RHR) alongside the Readiness verdict
  Verify: After Garmin sync, verify each wellness metric has a plain-language coaching sentence (e.g., 'HRV below baseline — easy day recommended')

- [ ] [Product Opportunity] Coach-Voice Post-Run Debrief — What your body is telling you
  Files: `frontend/src/pages/RunDetail.jsx`, `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: Market Intelligence / running coaching apps — Score 8.3/10
  Done when: Run detail page shows a post-run wellness debrief comparing pre-run readiness to post-run body response, with next-day coaching guidance
  Verify: After completing a run with wellness data, navigate to /run/:id and verify post-run debrief section appears with comparison and next-day guidance

- [ ] [Product Opportunity] Weekly Readiness Trend — 7-day recovery trajectory
  Files: `frontend/src/pages/Schedule.jsx`, `backend/src/main/java/com/hermes/backend/CoachRunnerState.java`
  Context: Market Intelligence / running coaching apps — Score 8.0/10
  Done when: Schedule page shows a 7-day readiness trend line (score 0-100 per day) with average and direction indicator
  Verify: Navigate to /schedule; verify readiness trend renders with daily scores and direction label

- [ ] [Product Opportunity] Injury Prevention Intelligence — 7-day load vs recovery balance
  Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/utils/todayRunAcwrInsight.js`, `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: Market Intelligence / running coaching apps — Score 7.8/10
  Done when: Today's Run shows a load-vs-recovery balance indicator with plain-language coaching guidance when load exceeds recovery capacity
  Verify: After a high-ACWR week with low readiness data, verify overtraining risk alert appears with specific actionable advice

- [ ] [Product Opportunity] Apple Health / Google Health Connect Wellness Sync
  Files: `backend/src/main/java/com/hermes/backend/ImportProvider.java`, `backend/src/main/java/com/hermes/backend/AppleHealthImportService.java`
  Context: Market Intelligence / running coaching apps — Score 7.5/10
  Done when: iOS users can auto-sync Apple Health sleep, HR, steps, and HRV data to Hermes; wellness sync works for Apple Watch users
  Verify: Connect Apple Health to Hermes; verify wellness entity tables populated and CoachRunnerState reflects latest data
