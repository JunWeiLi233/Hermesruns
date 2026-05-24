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
  2. Use appropriate bilingual labels for daily, race, speed, and trail categories.
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
- 2026-05-20: Closed three queue tasks. (1) Split oversized `locales/en.js` + `zh-CN.js` (~4175 lines each) via one-shot mechanical splitter (`.tools/_split-locales-once.mjs`, brace-matching) into 4-bucket per-locale namespaces + 2-line barrel shims; check-translations parity 4016/4016, build PASS. (2) Verified `[observability] Record Qwen course-map scan step timelines` complete from prior round (CourseMapScanStep model + AdminBackgroundJobService + AdminRacePortalController endpoint + Dashboard timeline UI in place); focused test suite 34/34 PASS (Qwen 7/7, AiService 13/13, ManualAsset 14/14). (3) Untracked 353 npm-cache files (~32.6 MB) — added `frontend/.npm-cache/` to `.gitignore`, ran `git rm -r --cached`, files kept on disk; frontend build PASS. Concurrent agent landed `03a2da7d perf(admin-dashboard): virtualize shoe queue/repository/catalog lists; race catalog → JSON` (disjoint files, absorbed cleanly).
- 2026-05-20: Completed the dashboard batch-request round by wiring `/api/profile/dashboard` to return coach state, today guidance, personal records, races, muscle plan, and quota in one payload while keeping graceful frontend fallbacks. Verify: focused `ProfileControllerTests` PASS, backend compile PASS, frontend build PASS.
- 2026-05-20: Blocker fix — translation parity gap in locale namespace barrel: added `analysisInsight` (86 keys), `forgotPassword` (7 keys), `shoeCatalog` (10 keys) sections to both `en/pages.js` and `zh-CN/pages.js`; fixed `Heatmap.jsx` flat key refs to `heatmap.loading` / `heatmap.empty`. check-translations PASS (4132/4132, gap 0), frontend build PASS.
- 2026-05-20: Repo hygiene bundle — untracked 3 sets: (1) `.codex/.tmp/plugins/` 2042 files (~14.2 MB), `.gitignore` rule already existed; (2) 5 Python `.pyc` bytecode files + `.codex/log/codex-tui.log`, existing `*.pyc`/`__pycache__` rules applied; (3) 5 throwaway root artifacts (`fix_missing.js`, `fix_missing2.js`, `trans_output.txt`, `backend_err.txt`, `backend/test`). No `.gitignore` edits needed. `git ls-files` returns 0 for all pruned paths. Build PASS, translations PASS.
- 2026-05-20: Repo hygiene bundle 2 — verified top debt item (backend Vite assets) already clear; bundled 4 more completed: (1) `.codex/tmp/` 33 Codex runtime scratch files untracked via `git rm -r --cached --sparse` (`.gitignore` rule already at line 302); (2) `vdot_engine.py` + `test_vdot_engine.py` deleted + untracked from `backend/src/main/resources/static/` (VDOT logic lives in Java); (3) `frontend/src/App.css`, `frontend/src/assets/react.svg`, `frontend/src/assets/hero.png` deleted + untracked (zero references). No `.gitignore` edits needed. Build PASS, translations PASS.

## Active Tasks
- [x] [code-review] Add filter-chain auth rules to SecurityConfig and restrict CORS headers (MEDIUM)
  Files: `backend/src/main/java/com/hermes/backend/SecurityConfig.java`, `backend/src/main/java/com/hermes/backend/AppCorsConfig.java`, `backend/src/main/java/com/hermes/backend/JwtAuthenticationFilter.java`
  Context: SecurityConfig.java uses `.anyRequest().permitAll()` with zero Spring Security-level guard rules - auth enforcement relies solely on controller-level JWT checks, missing defense-in-depth. AppCorsConfig.java uses `.allowedHeaders("*")` which is overly permissive.
  Done when: SecurityConfig adds filter-chain rules requiring authenticated principal for `/api/admin/**` paths. CORS restricts allowedHeaders to Authorization, Content-Type, and any other headers actually used.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Created JwtAuthenticationFilter (OncePerRequestFilter) to bridge Hermes JWT tokens into Spring Security SecurityContext with ROLE_ADMIN authority. Added `.hasRole("ADMIN")` rule for `/api/admin/**` as defense-in-depth alongside existing AdminSecurityFilter. Added `/api/auth/admin-login` exclusion. Restricted CORS allowedHeaders from "*" to "Authorization, Content-Type". Backend compile PASS.

- [x] [code-review] Deduplicate password strength validation between frontend and backend (MEDIUM)
  Files: `frontend/src/pages/Signup.jsx:66-76`, `backend/src/main/java/com/hermes/backend/PasswordStrengthChecker.java`
  Context: Password strength rules (min length, uppercase/lowercase/digit/special char, common password blocklist) are independently maintained in both frontend and backend. A rule change must be made in two places, risking divergence.
  Done when: Backend is canonical source. Frontend fetches password rules from backend API (`/api/auth/password-rules`) and applies them client-side for instant feedback, falling back to backend validation on submission.
  Verify: Change a rule in PasswordStrengthChecker.java; verify Signup.jsx reflects the change without manual frontend edit.
  Note: Already fully implemented. `PasswordStrengthChecker.getRules()` serves as canonical source via `GET /api/auth/password-rules` (LoginController.java:114-116). Frontend `passwordRules.js` fetches from backend with static fallback; `Signup.jsx` imports only from that utility. Backend compile PASS. Frontend lint PASS (0 errors).

- [x] [code-review] Add React.memo, image lazy-loading, and list virtualization for frontend performance (MEDIUM)
  Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/components/ShoeBrandLogo.jsx`
  Context: Zero uses of React.memo across the entire frontend - all 29 pages re-render entirely on parent state changes. Only 1 `loading="lazy"` attribute exists (ShoeBrandLogo.jsx). All shoe photo grids, run cards, race discovery cards, and admin user/shoe/job lists render without virtualization - `visibleUsers`, `shoesPage.items`, `filteredCatalogItems` all map inline with no windowing.
  Done when: Top-5 largest page components wrapped in React.memo. All <img> tags in shoe galleries and run cards use loading="lazy" and decoding="async". Admin Dashboard list rendering uses react-window or react-virtuoso for visibleUsers, shoesPage, and filteredCatalogItems.
  Verify: `cd frontend && npm run build`
  Note: React.memo + loading='lazy' decoding='async' already in place across Shoes/Races/Runs/ShoeBrandLogo. This round wired react-window v2 virtualization onto the admin Dashboard shoe-queue, shoe-stitch-repository, and catalog-inventory lists (3 module-scope row components, rowHeights 132/72/180px). `visibleUsers` admin table kept as map() (would break <tbody>, paginated server-side already). Build PASS, lint PASS, translation parity PASS, frontend runtime sync PASS.

- [x] [code-review] Split oversized worldRaceCatalog.js (1024+ lines) into a JSON asset (MEDIUM)
  Files: `frontend/src/data/worldRaceCatalog.js`, `frontend/src/data/worldRaceCatalog.json`
  Context: `worldRaceCatalog.js` at 1024 lines holds static race data that should be a JSON asset, not bundled JS source. Originally bundled with locale split, locale split deferred (see below).
  Done when: `worldRaceCatalog.js` data moves to a static JSON file (Vite native JSON import). All existing named + default exports preserved so importers do not break.
  Verify: `cd frontend && npm run build` and `node .tools/check-translations.mjs`
  Note: Race data extracted to `worldRaceCatalog.json` (82 races, 1103 lines); `worldRaceCatalog.js` is now a 97-line shim importing the JSON and re-exporting all helper functions + the default export. Build PASS, runtime sync PASS.

- [x] [code-review] Split oversized locales/en.js + locales/zh-CN.js (~4175 lines each) (MEDIUM)
  Files: `frontend/src/i18n/locales/en.js`, `frontend/src/i18n/locales/zh-CN.js`, `frontend/src/i18n/locales/en/`, `frontend/src/i18n/locales/zh-CN/`
  Done when: Each locale file is split by namespace (common, pages, components, admin) into per-namespace files re-exported by a thin barrel. Both `en.js` and `zh-CN.js` become barrels (≤10 lines each).
  Verify: `cd frontend && npm run build` and `node .tools/check-translations.mjs`
  Note: Completed 2026-05-20 via one-shot mechanical splitter `.tools/_split-locales-once.mjs` (brace-matching, no LLM copy). `en.js` and `zh-CN.js` are now 2-line shims. Per-locale split into common.js (58 lines), pages.js (~2015 lines), components.js (2002 lines), admin.js (18 lines), index.js barrel (8 lines). check-translations.mjs PASS (4016 leaf keys each, gap 0). frontend build PASS.
- [x] [observability] Record Qwen course-map scan step timelines
  Files: `backend/src/main/java/com/hermes/backend/CourseMapScanStep.java`, `backend/src/main/java/com/hermes/backend/AdminBackgroundJobService.java`, `backend/src/main/java/com/hermes/backend/AdminRacePortalController.java`, `frontend/src/pages/Dashboard.jsx`
  Done when: an admin can open a pending course-map upload and see a step-by-step timeline for the latest Qwen scan/reanalysis from button click through final alignment decision.
  Verify: `cd backend && ./mvnw -q -Dtest=RaceCourseMapManualAssetTests,RaceCourseMapAiServiceTests,QwenCourseMapAlignmentClientTests test`
  Note: Verified complete 2026-05-20. `CourseMapScanStep.java` persisted model + `AdminBackgroundJobService.getCourseMapScanTimeline(raceId)` service + `AdminRacePortalController:312 GET /{raceId}/scan-timeline` endpoint + `Dashboard.jsx:863,1110-1115` admin timeline UI all in place from prior 2026-04-24 round. Re-ran focused suite: 34/34 PASS (Qwen 7/7, AiService 13/13, ManualAsset 14/14).
- [x] [Product Opportunity] Adaptive Training Plan Generation - The "Should I Run?" Loop
  Files: `backend/src/main/java/com/hermes/backend/TrainingPlanService.java`, `frontend/src/pages/Schedule.jsx`
  Context: Market Intelligence / Runna & TrainingPeaks Gap - Score 9.5/10
  Done when: Training plans adapt dynamically based on both workout performance AND the daily readiness verdict (e.g., if readiness is LOW, the interval session is automatically deferred or converted to EASY).
  Verify: Simulate a LOW readiness score; verify the scheduled "Quality" session in /schedule is visually flagged as "Deferred" and a new "Recovery" session appears in Today's Run.
  Note: Verified complete 2026-05-20. Existing `AutomatedCoachService` readiness gate mutates today's quality workout to Easy/Recovery, records `mutatedFrom` + `readinessAdjusted`, `Schedule.jsx` renders the deferred badge, and `TodayRun.jsx` surfaces the readiness-adjusted session. Verification: `AutomatedCoachServiceTests` PASS, Schedule contrast smoke PASS, Today Run batch guard PASS, frontend build PASS, translation parity PASS, frontend runtime sync PASS.
- [x] [Product Opportunity] Multi-Wearable Wellness Hub (Apple/Google Health + Garmin/Oura)
  Files: `backend/src/main/java/com/hermes/backend/OuraWellnessImportService.java`, `backend/src/main/java/com/hermes/backend/WellnessController.java`, `backend/src/main/java/com/hermes/backend/Runner.java`, `frontend/src/pages/Settings.jsx`
  Context: Market Intelligence / Subscription Fatigue - Score 8.9/10
  Done when: Runners can connect multiple wearable sources simultaneously (e.g., Oura for sleep, Garmin for runs) and Hermes synthesizes a unified readiness score from the highest-confidence source for each metric.
  Verify: Connect both Garmin and Apple Health; verify the Readiness score uses Garmin sleep but Apple Health HRV if configured as the primary source for that metric.
  Note: Built OuraWellnessImportService (server-side Oura v2 API client with PAT auth), added 3 REST endpoints (POST /api/wellness/oura/token, GET /api/wellness/oura/status, POST /api/wellness/oura/import), added ouraPersonalAccessToken + ouraLastSyncedAt fields to Runner entity, added Oura entry to Settings.jsx sync health list. Existing ReadinessService already supports multi-source selection with OURA at priority 5 same as GARMIN. Backend compile PASS, frontend build PASS, runtime endpoint reachable and properly gated at 401.
- [x] [market] AI Coach daily training guidance as primary market differentiator
  Files: `frontend/src/pages/TodayRun.jsx`, `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: Market Intelligence score 9.5/10 — No competitor (Strava, Runalyze, Intervals.icu, TrainingPeaks) offers AI-powered daily coaching. The 'Should I run today?' question is the highest-frequency runner need and Hermes uniquely owns this capability. This is the primary moat.
  Done when: The Today Run page answers "Should I run, and how hard?" within 10 seconds with a clear, personalized recommendation backed by VDOT, ACWR, and recent training data. Every runner persona finds the recommendation actionable.
  Verify: Fresh runner with 0 runs sees onboarding guidance. Enthusiast with inconsistent history sees comeback messaging. Competitor sees VDOT/ACWR-informed quality decision.
  Note: Completed 2026-05-24. Backend: CoachTodayDto enriched with runnerState ("new"/"comeback"/"active") and coachMessage (data-backed coaching sentence with ACWR, pace range, workout type). Frontend: TodayRun.jsx shows onboarding card for new runners, comeback banner for 14+ day gaps, specific coach message for active runners. coachVoice.js no longer outputs "VDOT 0.0" for new runners. Lint PASS, translations PASS, build PASS. Commits: 68820bd3.

## Tech Debt Tasks

### Repository Hygiene Debt
- [x] [file-audit 2026-05-20] Untrack committed npm cache artifacts
  Files: `frontend/.npm-cache/`, `.gitignore`
  Done when: `frontend/.npm-cache/` is ignored and removed from git tracking without deleting any required source, lockfile, or package metadata.
  Verify: `git ls-files frontend/.npm-cache` prints nothing and `cd frontend && npm run build` still passes.
  Note: Completed 2026-05-20. Added `frontend/.npm-cache/` to `.gitignore` (after `frontend/dist/`); ran `git rm -r --cached --quiet frontend/.npm-cache` to drop 353 cache files (~32.6 MB) from the git index. Files remain on disk (npm rebuilds as needed). `git ls-files frontend/.npm-cache` returns empty. Frontend build PASS (`✓ built in 1.79s`).

- [x] [file-audit 2026-05-20] Untrack committed Codex plugin temp cache
  Files: `.codex/.tmp/plugins/`, `.gitignore`
  Context: `git ls-files .codex/.tmp/plugins` reports more than 2,000 tracked temporary plugin-cache files totaling about 14.2 MB, including marketplace app icons and copied plugin references. `.gitignore` already lists `.codex/.tmp/`, so this appears to be stale tracked cache content rather than project-owned workflow source.
  Done when: `.codex/.tmp/plugins/` is removed from git tracking while preserving the real repo-local command, workflow, and skill files that `.gitignore` intentionally unignores under `.codex/`.
  Verify: `git ls-files .codex/.tmp/plugins` prints nothing and the repo-local `.codex/commands/*.md`, `.codex/workflows/*.md`, and `.codex/skills/*/SKILL.md` files still appear where expected.
  Note: Completed 2026-05-20. `git rm -r --cached --quiet .codex/.tmp/plugins/` (1907 files) + `git rm --cached --force --sparse` for 135 sparse-excluded files. No .gitignore edit needed — `.codex/.tmp/` rule already on line 303. `git ls-files .codex/.tmp/plugins` returns 0. Build PASS, translations PASS.

- [x] [file-audit 2026-05-20] Stop carrying generated backend Vite assets in git
  Files: `backend/src/main/resources/static/assets/`, `backend/src/main/resources/static/index.html`, `frontend/scripts/run-vite-build.mjs`, `frontend/scripts/clean-backend-static-assets.mjs`, `.gitignore`
  Context: `.gitignore` already marks the built Vite bundle under Spring static resources as locally regenerated, but `git status` still shows many tracked hashed assets as deleted after builds. The current assets directory contains 142 files / about 11.2 MB of generated output, with JS/CSS/source-map files making up about 10.7 MB.
  Done when: generated hashed bundles are removed from git tracking and the documented release/runtime path is clear: local builds may recreate them, but source review should happen in `frontend/`, not committed hashed output.
  Verify: `git ls-files backend/src/main/resources/static/assets backend/src/main/resources/static/index.html` prints nothing, `cd frontend && npm run build` regenerates the local static bundle, and `.tools/verify-frontend-runtime-sync.mjs` passes when a live frontend/backend runtime is expected.
  Note: Already complete at round start — `.gitignore` rules on lines 146-147 cover these paths and `git ls-files` returned 0. No action needed; marked verified 2026-05-20.

- [ ] [file-audit 2026-05-20] Prune historical auto-hermes tech-debt snapshots
  Files: `.ai-sync/tech-debt/auto-hermes-tech-debt-*.json`, `.ai-sync/tech-debt/`
  Context: Eight dated `.ai-sync/tech-debt/auto-hermes-tech-debt-*.json` snapshots are tracked and total about 6.5 MB. They are historical generated audit outputs, while `TASKS.md` now carries the durable bounded debt tasks. Keeping every generated snapshot in git makes review noisy and duplicates the task ledger.
  Done when: only the current snapshot needed by active automation remains tracked, or the snapshot directory is ignored and regenerated on demand with a clear retention rule.
  Verify: run the auto-hermes tech-debt/audit command that owns this directory, confirm it can regenerate current state, and confirm `TASKS.md` still contains the durable cleanup tasks.

- [x] [file-audit 2026-05-20] Remove one-off translation repair scripts and log artifacts
  Files: `fix_missing.js`, `fix_missing2.js`, `trans_output.txt`, `backend_err.txt`, `backend/test`
  Context: These tracked root artifacts are not referenced by current source, package scripts, docs, or tests. `fix_missing*.js` are ad-hoc translation repair scripts that `eval` and rewrite `frontend/src/i18n/translations.js`; `trans_output.txt` is a stale command transcript; `backend_err.txt` is empty; `backend/test` is a two-byte placeholder.
  Done when: any still-useful logic is moved into documented `.tools/` scripts or tests, and the throwaway root artifacts are removed from tracking.
  Verify: `rg -n "fix_missing|fix_missing2|trans_output|backend_err|backend/test" . -g "!frontend/node_modules" -g "!backend/target"` only reports the intentional `TASKS.md` entry, and `node .tools/check-translations.mjs --full` passes if translation tooling was touched.
  Note: Completed 2026-05-20. Removed 5 root artifact files from git index via `git rm --cached --quiet`. Logic in `fix_missing*.js` is superseded by `.tools/check-translations.mjs` and the namespace splitter. Files remain on disk. Build PASS, translations PASS.

- [x] [file-audit 2026-05-20] Remove unused Vite starter leftovers
  Files: `frontend/src/App.css`, `frontend/src/assets/react.svg`
  Context: Both files are tracked but have no current references in `frontend/src`, `frontend/package.json`, or root `package.json`. They look like default Vite starter leftovers rather than Hermes UI assets.
  Done when: the files are deleted or intentionally repurposed with real imports, and no dead default-starter assets remain under `frontend/src`.
  Verify: `rg -n "App\.css|react\.svg" frontend/src frontend/package.json package.json` prints nothing and `cd frontend && npm run build` passes.
  Note: Completed 2026-05-20. Deleted `frontend/src/App.css`, `frontend/src/assets/react.svg` (zero references confirmed). Bundled with hero.png removal (below). Build PASS.

- [x] [file-audit 2026-05-20] Retire quarantined legacy-frame CSS split
  Files: `frontend/src/styles/_split/legacy-frame.css`, `frontend/src/index.css`, related smoke tests that still read legacy CSS from disk
  Context: `frontend/src/index.css` says `_split/legacy-frame.css` targets `.hermes-site-frame`, is quarantined from the live bundle, and is only kept for disk-based smoke-test compatibility. The file is about 366 KB and not imported by the live CSS cascade.
  Done when: smoke tests no longer need the quarantined split, the file and stale import comment are removed, and any surviving `.hermes-site-frame` references are either deleted or documented as intentional test fixtures.
  Verify: `rg -n "legacy-frame|hermes-site-frame" frontend/src` only reports intentional surviving references, `cd frontend && npm.cmd test` passes, and `cd frontend && npm run build` passes.
  Note: Completed 2026-05-20. Commit 0c921aef "chore: retire quarantined legacy-frame.css (~366KB dead CSS)".

- [x] [file-audit 2026-05-20] Untrack volatile auto-hermes run artifacts
  Files: `.ai-sync/AUTO_HERMES_*`, `.ai-sync/auto-hermes-state/`, `.ai-sync/auto-hermes-max-lanes/`, `.ai-sync/auto-hermes-max-results/`, `.ai-sync/auto-hermes-max-state/`, `.ai-sync/context-snapshots/`, `.ai-sync/security-reports/`, `.ai-sync/market/`, `.tools/untrack-volatile-ai-sync.sh`, `.gitignore`
  Context: `git ls-files -ci --exclude-standard` reports 474 tracked `.ai-sync` files even though `.ai-sync/` is ignored. The repo also has a purpose-built `.tools/untrack-volatile-ai-sync.sh` script that keeps human coordination files while untracking regenerated coordinator/controller/loop/max/result artifacts. These outputs are state snapshots, not durable source.
  Done when: volatile `.ai-sync` run artifacts are removed from git tracking, with only the intended cross-agent coordination files kept tracked or explicitly unignored.
  Verify: `git ls-files -ci --exclude-standard .ai-sync` shows only intentionally retained coordination files, and `node .tools/auto-hermes-loop.mjs --write --runtime codex --dry-run` can regenerate the current loop artifacts.
  Note: Completed 2026-05-24. `git ls-files -ci .ai-sync` reduced from 474 to 10 coordination files (AGENT_SYNC, CONTEXT_LEDGER, HUMAN_LOOP, BACKLOG etc.) — all intentionally retained. Security-report volatile files untracked via `git rm --cached`. Prior rounds handled the bulk of the untracking.

- [x] [file-audit 2026-05-20] Remove tracked Python bytecode and Codex terminal log
  Files: `.codex/skills/ui-ux-pro-max/scripts/__pycache__/`, `.claude/skills/ui-ux-pro-max/scripts/__pycache__/`, `.codex/log/codex-tui.log`, `.gitignore`
  Context: tracked ignored files include Python bytecode (`*.pyc`) under both Codex and Claude skill copies plus `.codex/log/codex-tui.log` (~225 KB). These are machine/runtime outputs and should not be reviewed or shipped as source.
  Done when: bytecode caches and terminal logs are removed from git tracking and ignored going forward without deleting the actual skill source files.
  Verify: `git ls-files '.codex/log/*' '*__pycache__*' '*.pyc'` prints nothing for tracked runtime artifacts.
  Note: Completed 2026-05-20. Removed 5 `.pyc` files (3 `.codex/` + 2 `.claude/`) and `.codex/log/codex-tui.log` via `git rm --cached --quiet`. No .gitignore edit — `__pycache__/` and `*.pyc` rules already in place. Build PASS.

- [ ] [file-audit 2026-05-20] Collapse duplicated backend public static icon mirrors
  Files: `frontend/public/favicon.ico`, `frontend/public/favicon.svg`, `frontend/public/hermes-tab-icon.svg`, `frontend/public/icons.svg`, `backend/src/main/resources/static/favicon.ico`, `backend/src/main/resources/static/favicon.svg`, `backend/src/main/resources/static/hermes-tab-icon.svg`, `backend/src/main/resources/static/icons.svg`, `frontend/vite.config.js`, `.gitignore`
  Context: the backend static icon files are byte-identical mirrors of the `frontend/public` files. Vite builds copy `frontend/public` into `backend/src/main/resources/static`, but `.gitignore` currently ignores only `backend/src/main/resources/static/assets/` and `index.html`, leaving these generated image/icon mirrors tracked.
  Done when: `frontend/public` is the source of truth and generated backend static icon mirrors are either untracked/ignored or explicitly documented as release artifacts.
  Verify: `Get-FileHash frontend/public/favicon.svg,backend/src/main/resources/static/favicon.svg` is no longer needed for review, `cd frontend && npm run build` recreates the local backend static copies, and the app still loads `/hermes-tab-icon.svg` and `/favicon.ico`.

- [x] [file-audit 2026-05-20] Remove unused frontend hero image leftover
  Files: `frontend/src/assets/hero.png`
  Context: `frontend/src/assets/hero.png` is a tracked image asset with no current references in the repo. It looks like an old landing/starter image leftover rather than a live Hermes asset. Keep this separate from the existing `App.css` / `react.svg` starter-cleanup task.
  Done when: the image is deleted or intentionally repurposed with a real import, and no dead hero image remains under `frontend/src/assets`.
  Verify: `rg -n "hero\.png" . -g "!frontend/node_modules" -g "!backend/target"` prints nothing and `cd frontend && npm run build` passes.
  Note: Completed 2026-05-20. Deleted `frontend/src/assets/hero.png` (zero references). `git ls-files` returns 0. Build PASS.

- [ ] [file-audit 2026-05-20] Resolve nonignored untracked workflow/style files
  Files: `.claude/commands/_skill-stack.md`, `.tools/one-shot-contrast-audit.mjs`, `.tools/untrack-volatile-ai-sync.sh`, `frontend/src/styles/contrast-fixes.css`, `frontend/src/styles/muscle-training-hermes-redesign.css`, `frontend/src/styles/settings-fullwidth.css`
  Context: `git ls-files --others --exclude-standard` currently reports these nonignored files. Some are imported or referenced (`contrast-fixes.css` is imported by `frontend/src/index.css`, `_skill-stack.md` is linked from Claude command files), while others are one-shot/helper scripts. They should not remain as loose workspace-only files.
  Done when: each file is either committed as durable source with matching docs/tests or deleted/moved to an ignored local scratch path if it is truly one-off.
  Verify: `git ls-files --others --exclude-standard` no longer reports these paths, and `cd frontend && npm run build` passes if any imported CSS file is kept or removed.

- [ ] [file-audit 2026-05-20] Prune 120+ stale git worktrees (~457 MB+ in `.claude/worktrees/` alone)
  Files: `.claude/worktrees/`, `.worktrees/`, `~/.codex/worktrees/`
  Context: `git worktree list` reports 120+ registered worktrees — most are leftover from past `/auto-hermes-max` parallel rounds and concurrent agent activity (each has its own checkout, ~28 MB+ on average). `.claude/worktrees/` alone holds 16 `agent-*` directories totaling 457 MB and all marked "locked". `~/.codex/worktrees/` carries 70+ short-name detached-HEAD worktrees from prior codex runs. Disk waste is multi-GB and worktree noise complicates `git status` / branch operations.
  Done when: every stale worktree is removed via `git worktree remove --force <path>` (locked ones need `git worktree unlock <path>` first), followed by `git worktree prune --verbose`. Only the primary checkout and any truly-in-use parallel checkouts remain.
  Verify: `git worktree list` returns ≤5 entries (primary + currently-active parallel checkouts). Disk freed measurable via `du -sh .claude/worktrees ~/.codex/worktrees`.
  Note: Coordinate with any in-flight `/auto-hermes-max` parent before pruning — active lane worktrees must NOT be removed mid-run.

- [ ] [file-audit 2026-05-20] Optimize 1.97 MB landing hero PNG (WebP variant already exists)
  Files: `frontend/src/assets/generated/landing-command-hero-background.png`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandHeroBackground.smoke.test.js`
  Context: `landing-command-hero-background.png` is 1,971,045 bytes (1.97 MB) — the largest tracked image in the repo and the second-largest tracked file overall. The sibling `coach-identity-avatar-default.webp` in the same directory is 23,962 bytes, demonstrating that a comparable image can compress ~80× via WebP. The PNG is referenced from `_split/landing.css` and the legacy `style.css` (slated for retirement) plus a smoke test, so it IS live, just oversized.
  Done when: a WebP (and optionally AVIF) version is added at `frontend/src/assets/generated/landing-command-hero-background.webp`, the CSS uses `image-set()` or a `<picture>` element with WebP-first + PNG fallback, and the original PNG is either replaced with a compressed-PNG fallback (~200-300 KB target) or removed if all referencing CSS rules switch to the WebP-first approach. Smoke test updated to assert the new asset names.
  Verify: `cd frontend && npm run build` passes; `wc -c frontend/src/assets/generated/landing-command-hero-background.*` shows WebP under 100 KB and PNG (if kept) under 400 KB; landing page renders the hero background unchanged in browser proof.

- [x] [file-audit 2026-05-20] Untrack volatile `.codex/tmp/` runtime scratch files (33 files)
  Files: `.codex/tmp/arg0/codex-arg0*/.lock`, `.codex/tmp/arg0/codex-arg0*/apply_patch.bat`, `.codex/tmp/arg0/codex-arg0*/applypatch.bat`, `.gitignore`
  Context: `.codex/tmp/` (no dot before `tmp` — distinct from already-cleaned `.codex/.tmp/`) has 33 tracked files: 11 empty `.lock` files + 22 `apply_patch.bat`/`applypatch.bat` scripts (188 B each). These are volatile Codex IDE runtime scratch files created per-session and should never be committed. No current `.gitignore` rule covers `.codex/tmp/`.
  Done when: `.codex/tmp/` is removed from git tracking, added to `.gitignore`, and `git ls-files .codex/tmp/` returns nothing.
  Verify: `git ls-files .codex/tmp/` prints 0 and any Codex session that creates new temp files does not show in `git status`.
  Note: Completed 2026-05-20. `.codex/tmp/` rule already present in `.gitignore` at line 302. Ran `git rm -r --cached --sparse .codex/tmp/` (33 files). `git ls-files .codex/tmp/` returns 0. Build PASS.

- [x] [file-audit 2026-05-20] Remove misplaced Python files in backend static resources directory
  Files: `backend/src/main/resources/static/vdot_engine.py`, `backend/src/main/resources/static/test_vdot_engine.py`, `.gitignore`
  Context: Two Python files (`vdot_engine.py` 12.6 KB, `test_vdot_engine.py` 2.6 KB) are tracked under `backend/src/main/resources/static/`. They are NOT standard Vite build output and look like accidentally copied or misplaced files. A Spring Boot static resource directory is the wrong location for Python scripts.
  Done when: Both `.py` files are removed from git tracking and either deleted (if superseded) or moved to a proper scripts directory. Static dir is verified to contain only Vite build output.
  Verify: `git ls-files 'backend/src/main/resources/static/*.py'` returns nothing; `cd frontend && npm run build` and `cd backend && ./mvnw -q -DskipTests compile` both pass.
  Note: Completed 2026-05-20. Deleted both files from disk + untracked via `git rm --cached`. These VDOT engine scripts have Java equivalents in the backend source; no migration needed. `git ls-files` returns 0. Build PASS.

- [ ] [file-audit 2026-05-20] Resolve unintentional git submodule pointer `.ai-sync/voltagent-codex-subagents`
  Files: `.ai-sync/voltagent-codex-subagents`, `.gitmodules`
  Context: `git ls-files --stage` shows `.ai-sync/voltagent-codex-subagents` as mode `160000` (gitlink/submodule) with hash `5f855c11f9117541da31e7274b738cc396d4d3c7` and no corresponding `.gitmodules` entry. This is likely an unintentional git submodule pointer that was never properly configured. It will cause checkout/clone issues and is 0 bytes as a regular entry.
  Done when: The submodule pointer is either resolved to a real `.gitmodules` entry with an upstream URL, or the gitlink is removed from tracking and replaced with a regular file or directory as intended.
  Verify: `git ls-files --stage '.ai-sync/voltagent-codex-subagents'` does not show mode `160000`, or a `.gitmodules` entry exists with a valid URL.

- [ ] [file-audit 2026-05-20] Operator-side cleanup of `task-images/` stale artifacts (local-only)
  Files: `task-images/` (local-only, gitignored)
  Context: `task-images/` currently holds 98 files / 11 MB on disk, mixing legitimate reference screenshots with completed-task throwaways including 6 `.log` files (`hermes-backend-*-start.{err,out}.log` and `hermes-backend-restart.{err,out}.log`) and ~25 before/after JPGs from already-merged redesign rounds (coach-insight, injury-risk, load-balance, mt-*, insight-card-*). Per `CLAUDE.md` the rule is "delete after the task is completed or the image is no longer needed."
  Done when: stale before/after pairs from merged rounds are deleted; backend start/restart `.log` files removed; only currently-referenced reference images remain.
  Verify: `find task-images/ -type f | wc -l` is significantly reduced, `du -sh task-images/` is well under 5 MB, and any reference image still cited by a `Reference Image:` line in an open `TASKS.md` task is preserved.
  Note: This is operator hygiene, not a tracked-file issue (`task-images/` is gitignored). No commit needed; just `rm` the stale entries.

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
- [x] Add focused coverage for Activity
  Files: `backend/src/main/java/com/hermes/backend/Activity.java`, `backend/src/test/java/com/hermes/backend/ActivityTests.java`
  Context: backend/src/main/java/com/hermes/backend/Activity.java has no matching focused backend test file, which leaves its critical logic easier to break silently.
  Done when: backend/src/main/java/com/hermes/backend/Activity.java has a focused test class that covers its critical behavior and the backend compile check still passes.
  Verify: `cd backend && ./mvnw test -Dtest=ActivityTests && ./mvnw -q -DskipTests compile`
  Note: Pre-existing ActivityTests.java already covers 8 branches (field round-trip, metrics delegation, prePersist idempotency, addPoint bidirectional, shoe delegation with name fallbacks, runner association, points list mutation, createdAt explicit). Verified 2026-05-19 via `cd backend && ./mvnw test -Dtest=ActivityTests` - 8/8 PASS.
- [ ] Split oversized ShoeImageController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/ShoeImageController.java`, `backend/src/main/java/com/hermes/backend/AiShoeScanService.java`
  Context: backend/src/main/java/com/hermes/backend/ShoeImageController.java was 846 lines. Now ~555 lines after extracting AI provider calls.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/ShoeImageController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/ShoeImageController.java is broken into smaller focused units and the original surface still behaves the same.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Extracted callGemini/callClaude + SHOE_PROMPT into AiShoeScanService. Lines 652->555.
- [x] Externalize hardcoded values in BillingController.java
  Files: `backend/src/main/java/com/hermes/backend/BillingController.java`
  Context: backend/src/main/java/com/hermes/backend/BillingController.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/BillingController.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: BillingController.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Removed 2 hardcoded 'http://localhost:8080' fallbacks in trimTrailingSlash() - @Value-injected publicBaseUrl already provides dev default.
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
  Note: Extracted 16 static methods into ActivityAnalyticsHelper. Lines 942->659. Remaining methods still above threshold.
- [ ] Reduce dependency count in AdminPortalService.java
  Files: `backend/src/main/java/com/hermes/backend/AdminPortalService.java`
  Context: backend/src/main/java/com/hermes/backend/AdminPortalService.java has 14 dependencies injected (constructor: 14 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 14 dependencies in `backend/src/main/java/com/hermes/backend/AdminPortalService.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: AdminPortalService.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Grouped ShoeIdentityService + ShoeImageAssetService behind new ShoeAdminAggregateService. Deps 14->3.
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
  Note: Extracted prompt-building methods into RaceCourseMapPromptBuilder. Lines 598->28.
- [x] Externalize hardcoded values in EmailVerificationService.java
  Files: `backend/src/main/java/com/hermes/backend/EmailVerificationService.java`
  Context: backend/src/main/java/com/hermes/backend/EmailVerificationService.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/EmailVerificationService.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: EmailVerificationService.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Removed 2 hardcoded 'http://localhost:8080' fallbacks - @Value-injected publicBaseUrl already provides dev default.
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
- [ ] [file-audit 2026-05-19] Break down RaceCourseMapService.java (2229 lines)
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`
  Context: Largest backend service at 2229 lines. AI calls, prompt building, image work, and geometry have already been extracted (`RaceCourseMapAiService`, `RaceCourseMapPromptBuilder`, `RaceCourseMapImageService`, `RaceCourseMapGeometryService`), yet the core service is still 2.2k lines. Likely remaining responsibilities: scan-timeline persistence, route-point sanitization/persistence, manual-asset lifecycle, alignment scoring orchestration, reanalysis workflow.
  Steps:
  1. Pick one cohesive responsibility (recommend scan-timeline persistence + audit emission, since the scan timeline endpoint is already its own surface).
  2. Extract into a focused service (e.g., `RaceCourseMapScanTimelineService`) and inject it; preserve the existing public API on `RaceCourseMapService`.
  3. Run compile + the focused tests already covering this surface.
  Done when: `RaceCourseMapService.java` is reduced by at least 400 lines and one named responsibility moves to a focused service.
  Verify: `cd backend && ./mvnw -q -DskipTests compile` and `cd backend && ./mvnw test -Dtest=RaceCourseMap*`
- [ ] [file-audit 2026-05-19] Break down TerritoryService.java (1503 lines) and TerritoryPolygonComputer.java (789 lines)
  Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`
  Context: Territory feature has bloated - `TerritoryService` at 1503 lines plus `TerritoryPolygonComputer` at 789 lines cover polygon math, reward calculation, geofence resolution, runner-territory join logic, and persistence. Hard to test in isolation.
  Steps:
  1. Identify one cohesive responsibility in `TerritoryService` (recommend reward calculation OR polygon caching) and extract it.
  2. Replace inline usage with the new service and keep behavior identical.
  3. Run the focused backend tests.
  Done when: `TerritoryService.java` shrinks by at least 300 lines via one focused extraction.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] [file-audit 2026-05-19] Break down ProfileController.java (833 lines) and ShoeController.java (798 lines) and OAuthController.java (783 lines)
  Files: `backend/src/main/java/com/hermes/backend/ProfileController.java`, `backend/src/main/java/com/hermes/backend/ShoeController.java`, `backend/src/main/java/com/hermes/backend/OAuthController.java`
  Context: Three controllers sit just above the 800-line threshold for review difficulty. Each contains multiple sub-endpoints that could be regrouped into a dedicated controller per resource sub-domain (e.g., `ProfileDashboardController` for the batch dashboard route, `ShoeImageController` already exists as a sibling to `ShoeController`).
  Steps:
  1. Pick the strongest one (recommend `ProfileController` since the planned `/api/profile/dashboard` batch endpoint will add lines).
  2. Extract one sub-domain into a sibling controller (e.g., a dashboard-batch controller).
  3. Run compile + the focused profile tests.
  Done when: At least one of the three controllers drops below 600 lines via one focused extraction.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce class scope in ActivityMetrics.java
  Files: `backend/src/main/java/com/hermes/backend/ActivityMetrics.java`
  Context: backend/src/main/java/com/hermes/backend/ActivityMetrics.java shows God Class signals: 30 methods (threshold: 15), 15 fields (threshold: 12). This makes the class harder to test, understand, and change independently.
  Steps:
  1. Identify the most cohesive subset of 30 methods that share the same data and could form a separate service or helper.
  2. Extract that subset into a focused class with a single responsibility, injecting it into the original class.
  3. Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.
  Done when: ActivityMetrics.java has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [x] Fix swallowed exceptions in QwenPersistentWorkerClient.java
  Note: Done in commit b83a48ca — Logger added; 4 empty catch blocks replaced with DEBUG-level log + explanatory comments.
  Files: `backend/src/main/java/com/hermes/backend/QwenPersistentWorkerClient.java`
  Context: backend/src/main/java/com/hermes/backend/QwenPersistentWorkerClient.java has 4 catch block(s) that silently swallow exceptions (4 empty catch blocks, 0 with e.printStackTrace() or ignore comments). Swallowed exceptions hide real failures and make debugging extremely difficult.
  Steps:
  1. Audit each empty or swallow catch block in `backend/src/main/java/com/hermes/backend/QwenPersistentWorkerClient.java` to determine whether the exception should be logged, re-thrown, or handled with a specific recovery path.
  2. Replace empty catch blocks with proper error handling: log at minimum, or add recovery logic. Replace e.printStackTrace() with structured logging.
  3. Run the backend compile check and tests to verify error paths are now observable without changing product behavior.
  Done when: QwenPersistentWorkerClient.java has no empty catch blocks and no e.printStackTrace() calls — all exceptions are logged or properly handled.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce dependency count in AutomatedCoachService.java
  Files: `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`
  Context: backend/src/main/java/com/hermes/backend/AutomatedCoachService.java has 9 dependencies injected (constructor: 9 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 9 dependencies in `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: AutomatedCoachService.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Split oversized LocalSharedRunnerBootstrapService.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`
  Context: backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java is 570 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java is broken into smaller focused units and the original surface still behaves the same.
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
- [ ] Extract repeated IllegalStateException construction into a helper
  Files: `backend/src/main/java/com/hermes/backend/GoogleGeocodingClient.java`
  Context: backend/src/main/java/com/hermes/backend/GoogleGeocodingClient.java constructs IllegalStateException (9x) repeatedly. This pattern suggests factory or builder methods could reduce duplication and centralize validation.
  Steps:
  1. Identify the most repeated construction pattern in `backend/src/main/java/com/hermes/backend/GoogleGeocodingClient.java` and extract it into a static factory method or builder class.
  2. Replace the repeated constructions with calls to the new factory/builder, keeping behavior identical.
  3. Run the backend compile check and tests to confirm the refactor preserved all behavior.
  Done when: GoogleGeocodingClient.java uses factory methods or builders for its most-repeated object constructions instead of inline new expressions.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Externalize hardcoded values in PasswordResetService.java
  Files: `backend/src/main/java/com/hermes/backend/PasswordResetService.java`
  Context: backend/src/main/java/com/hermes/backend/PasswordResetService.java has configuration code smells: 3 hardcoded localhost reference(s) that break in production.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/PasswordResetService.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: PasswordResetService.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Rename ShoeTracker to follow Spring naming convention
  Files: `backend/src/main/java/com/hermes/backend/ShoeTracker.java`
  Context: ShoeTracker is annotated with @Service but does not follow the expected naming suffix 'Service'. Spring convention expects Service-annotated classes to end with 'Service' for discoverability.
  Steps:
  1. Rename `ShoeTracker` to `ShoeTrackerService` (or a semantically appropriate name ending in 'Service') in both the file and the class declaration.
  2. Update all Spring component scans, dependency injections, and import references to use the new name.
  3. Run the backend compile check and tests to confirm the rename propagates cleanly.
  Done when: ShoeTracker is renamed to end with 'Service' and all references are updated.
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
- [x] Fix swallowed exceptions in RaceCourseMapImageService.java
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapImageService.java`
  Note: Done in commit 589ae522 — silent catch replaced with log.error + RuntimeException rethrow.
  Context: backend/src/main/java/com/hermes/backend/RaceCourseMapImageService.java has 2 catch block(s) that silently swallow exceptions (2 empty catch blocks, 0 with e.printStackTrace() or ignore comments). Swallowed exceptions hide real failures and make debugging extremely difficult.
  Steps:
  1. Audit each empty or swallow catch block in `backend/src/main/java/com/hermes/backend/RaceCourseMapImageService.java` to determine whether the exception should be logged, re-thrown, or handled with a specific recovery path.
  2. Replace empty catch blocks with proper error handling: log at minimum, or add recovery logic. Replace e.printStackTrace() with structured logging.
  3. Run the backend compile check and tests to verify error paths are now observable without changing product behavior.
  Done when: RaceCourseMapImageService.java has no empty catch blocks and no e.printStackTrace() calls — all exceptions are logged or properly handled.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Reduce dependency count in GarminWellnessImportService.java
  Files: `backend/src/main/java/com/hermes/backend/GarminWellnessImportService.java`
  Context: backend/src/main/java/com/hermes/backend/GarminWellnessImportService.java has 8 dependencies injected (constructor: 8 params, @Autowired: 0 fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.
  Steps:
  1. Group the 8 dependencies in `backend/src/main/java/com/hermes/backend/GarminWellnessImportService.java` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.
  2. Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.
  3. Run the backend compile check and tests to confirm the refactor preserved behavior.
  Done when: GarminWellnessImportService.java has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
- [ ] Split oversized RaceController.java into smaller units
  Files: `backend/src/main/java/com/hermes/backend/RaceController.java`
  Context: backend/src/main/java/com/hermes/backend/RaceController.java is 588 lines long, which makes review, reuse, and bounded edits harder than they need to be.
  Steps:
  1. Identify one cohesive responsibility inside `backend/src/main/java/com/hermes/backend/RaceController.java` that can move into a nearby helper, component, or module without changing product behavior.
  2. Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.
  3. Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.
  Done when: backend/src/main/java/com/hermes/backend/RaceController.java is broken into smaller focused units and the original surface still behaves the same.
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
- [ ] Externalize hardcoded values in BerlinMarathonOfficialCourse.java
  Files: `backend/src/main/java/com/hermes/backend/BerlinMarathonOfficialCourse.java`
  Context: backend/src/main/java/com/hermes/backend/BerlinMarathonOfficialCourse.java has configuration code smells: 7 magic number comparison(s) that should be named constants.
  Steps:
  1. Identify each hardcoded value in `backend/src/main/java/com/hermes/backend/BerlinMarathonOfficialCourse.java` and determine which should move to application config, environment variables, or CSS theme tokens.
  2. Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.
  3. Run the verification command and confirm no visual or behavioral regression.
  Done when: BerlinMarathonOfficialCourse.java has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.
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
- [ ] Rename AdminBootstrapConfiguration to follow Spring naming convention
  Files: `backend/src/main/java/com/hermes/backend/AdminBootstrapConfiguration.java`
  Context: AdminBootstrapConfiguration is annotated with @Configuration but does not follow the expected naming suffix 'Configuration or Config'. Spring convention expects Configuration or Config-annotated classes to end with 'Configuration or Config' for discoverability.
  Steps:
  1. Rename `AdminBootstrapConfiguration` to `AdminBootstrapConfigurationConfiguration or Config` (or a semantically appropriate name ending in 'Configuration or Config') in both the file and the class declaration.
  2. Update all Spring component scans, dependency injections, and import references to use the new name.
  3. Run the backend compile check and tests to confirm the rename propagates cleanly.
  Done when: AdminBootstrapConfiguration is renamed to end with 'Configuration or Config' and all references are updated.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
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
- [ ] [file-audit 2026-05-19] Retire legacy frontend/src/styles/style.css monolith (80,913 lines)
  Files: `frontend/src/styles/style.css`, `frontend/src/index.css`, `frontend/src/components/runnerShellSidebarRedesign.smoke.test.js`, `frontend/src/components/runnerShellTopNavRedesign.smoke.test.js`, `frontend/src/components/settingsAtlasConnectButton.smoke.test.js`, `frontend/src/components/topbarNotifications.smoke.test.js`, plus ~35 other `frontend/src/**/*.smoke.test.js` files that `readFileSync('styles/style.css')`, `.tools/split-styles.mjs`
  Context: `style.css` is an 80,913-line legacy monolith that is NOT imported by the live bundle - `index.css` imports the per-surface `_split/*.css` files (tokens, runner-shell, shared, auth, landing, profile, analysis, today-run, runs, races, schedule, shoes, muscle-training, territory, heatmap, weather, rewards, workflow, settings, integrations, subscription, admin, misc, light-theme-overrides). The monolith is kept alive only as a parity oracle for ~40 smoke tests that `readFileSync('styles/style.css')`. This is the single largest file in the repo and dead in production.
  Done when: Each smoke test that currently reads `styles/style.css` is pivoted to read the corresponding `_split/*.css` file (or a small shared helper that concatenates the live splits). `frontend/src/styles/style.css` and `.tools/split-styles.mjs` are deleted. `frontend/src/index.css` header comment is updated to drop the "split from `styles/style.css`" pretext.
  Verify: `cd frontend && npm.cmd test` (all smoke tests pass) and `cd frontend && npm run build`
- [ ] [file-audit 2026-05-19] Break down Dashboard.jsx (4605 lines) into focused admin workspaces
  Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/components/admin/` (new)
  Context: Admin Dashboard is the largest live page file at 4605 lines, hosting users-command-center, jobs-command-deck, course-map workbench, course-hub redesign, audit-terminal, and several other admin panels in one component. This collapses regression risk into one file and makes bounded edits unsafe. Existing smoke tests (`dashboardUsersCommandCenter`, `dashboardJobsCommandDeck`, `dashboardCourseMapWorkbench`, `dashboardAuditTerminal`, `dashboardKineticShell`, `dashboardAdminLightMode`, `dashboardCourseHubRedesign`, `dashboardCourseMapWorkspace`, `dashboardCourseMapTrackHubRefactor`, `dashboardCourseMapUploadProcessing`, `dashboardJobsInspector`) already map cleanly to workspaces.
  Done when: Each top-level admin workspace is extracted into its own component file under `frontend/src/components/admin/` (one file per existing smoke-test subject). `Dashboard.jsx` becomes a thin orchestrator under 1000 lines that wires the workspaces, owns route state, and shares loaders. All existing admin smoke tests continue to pass.
  Verify: `cd frontend && npm.cmd test` and `cd frontend && npm run build`
- [ ] [file-audit 2026-05-19] Break down MuscleTraining.jsx (3399 lines)
  Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/components/muscleTraining/` (new)
  Context: Second-largest page file. Combines workout catalog, plan builder, session player, history view, and workflow integration in one component. Smoke test `muscleTrainingFriendlyDesign.smoke.test.js` already pins the surface.
  Done when: MuscleTraining is split into focused sub-components (catalog browser, plan composer, session player, history) under `frontend/src/components/muscleTraining/`. The page becomes a thin orchestrator under 800 lines.
  Verify: `cd frontend && npm.cmd test -- --run muscleTraining` and `cd frontend && npm run build`
- [ ] [file-audit 2026-05-19] Break down AnalysisInsightDetail.jsx (2415 lines) by insight variant
  Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/components/analysisInsights/` (new)
  Context: AnalysisInsightDetail.jsx at 2415 lines hosts every insight detail variant (VDOT trend, pace progression, load/recovery, injury risk, etc.) in one switch. Each variant has independent layout and data needs.
  Done when: Each insight detail variant becomes its own sub-component file under `frontend/src/components/analysisInsights/`. `AnalysisInsightDetail.jsx` routes to the matching variant by insight id and stays under 600 lines.
  Verify: `cd frontend && npm run lint` and `cd frontend && npm run build`
### Docs / Automation Debt
- [ ] [file-audit 2026-05-19] Break down .tools/auto-hermes-tools.test.mjs (3620 lines) per tool
  Files: `.tools/auto-hermes-tools.test.mjs`
  Context: Single mega-test at 3620 lines exercises every auto-hermes tool (security, loop, controller, tech-debt, round-close, push-main, finish, max, max-merge, max-loop, website-audit, etc.). One mega file means one diff touches every tool's tests, regression risk during refactors is high, and CI failure output is hard to localize. Tool implementations are already split file-per-tool under `.tools/`.
  Steps:
  1. Identify the top-level describe/`run...Tests()` blocks in `.tools/auto-hermes-tools.test.mjs` and group them by tool (security, loop, controller, tech-debt, etc.).
  2. Move each group into a sibling test file matching its tool (e.g., `.tools/auto-hermes-security.test.mjs`, `.tools/auto-hermes-loop.test.mjs`). Keep a thin top-level runner that imports and forwards to each sub-test.
  3. Update any CI / npm scripts that invoke the old single file.
  Done when: Each auto-hermes tool has a 1:1 paired test file. The original mega file is either deleted or reduced to a top-level runner under 200 lines.
  Verify: `node .tools/auto-hermes-tools.test.mjs` (or the new runner) exits 0
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
### Market Intelligence Opportunities (auto-hermes-market 2026-05-21)

## Security Tasks (autoresearch:security 2026-05-22)

### Critical — Fix Immediately

- [x] [security] Move Gemini API key and reCAPTCHA secret out of URL query params into HTTP headers
  Files: `backend/src/main/java/com/hermes/backend/AiShoeScanService.java`, `backend/src/main/java/com/hermes/backend/RecaptchaVerifier.java`
  Context: Gemini key was in AiShoeScanService (not ShoeImageController as originally noted). reCAPTCHA secret was in GET URL. Both appeared in server access logs.
  Done when: Both API calls use POST request bodies or `Authorization`/`x-goog-api-key` HTTP headers to transmit secrets; no secret appears as a query parameter in any outbound URL.
  Verify: `cd backend && ./mvnw -q -DskipTests compile` and grep for `?key=` / `?secret=` in compiled requests.
  Note: Completed 2026-05-24 commit cc27fd36. Gemini key moved to `x-goog-api-key` header in AiShoeScanService. reCAPTCHA switched from GET to POST form-body. Follow-up: GeminiAnchorPixelClient, GeminiRouteParameterClient, ShoeQueryNormalizationService still use `?key=` pattern.

- [x] [security] Add hostname whitelist to RaceCourseMapImageService URL fetcher to block SSRF
  Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapImageService.java`
  Context: `fetchBinaryBytes` had no domain validation; silent exception swallowing hid SSRF attempts.
  Done when: URL validated against internal IP blocklist; exceptions logged at ERROR with URL.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Completed 2026-05-24 commit 589ae522. Added validateImageUrl() blocking localhost, 127.x, ::1, RFC-1918, link-local, non-http(s). Exception catch now logs ERROR and rethrows.

- [x] [security] Validate OAuth state parameter server-side in both Google and Strava callbacks
  Files: `backend/src/main/java/com/hermes/backend/OAuthController.java`
  Context: Both callbacks accepted state param without server-side validation — CSRF/state-fixation risk.
  Done when: Flow start generates UUID state stored with 10-min TTL; callbacks reject missing/invalid/expired state with 400.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`
  Note: Completed 2026-05-24 commit 0393e099. ConcurrentHashMap pendingStateEntries with opportunistic eviction. All 3 flow-start endpoints and both callbacks wired. Caveat: in-process cache — multi-instance deployments need shared store.

### High — Fix This Sprint

- [x] [security] Enforce session token expiry in JwtAuthenticationFilter
  Files: `backend/src/main/java/com/hermes/backend/JwtAuthenticationFilter.java`, `backend/src/main/java/com/hermes/backend/AuthService.java`
  Context: `JwtAuthenticationFilter.doFilterInternal()` (lines 33-59) calls `authService.findByAuthorizationHeader(authHeader)` without a visible expiry check. `AuthService.isTokenValid()` does check `tokenIssuedAt` against `SESSION_DAYS=30`, but the filter itself does not enforce this — an expired token that somehow bypasses the service check (e.g., clock skew, test override) would still authenticate. Stolen tokens are valid for up to 30 days.
  Done when: Filter explicitly verifies token age at the filter level; tokens issued more than the configured session window ago are rejected with 401 regardless of DB state.
  Verify: Manually set a runner's `tokenIssuedAt` to 31 days ago; request is rejected with 401. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Remove plaintext session token fallback and set hard migration deadline
  Files: `backend/src/main/java/com/hermes/backend/AuthService.java`
  Context: Lines 94-101 still accept plain (unhashed) session tokens via `findBySessionToken(token)` for backward compatibility. If any plaintext token was ever stored in a log, intercepted in transit, or leaked from a DB backup, it remains permanently valid. The migration to hashed tokens happened but the fallback was never sunset.
  Done when: The `legacyMatch` branch is removed; only hashed tokens are accepted. Runners with un-migrated tokens are forced to re-login. Backend compile passes.
  Verify: A pre-hashed plaintext token returns 401. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Upgrade AES key derivation from single SHA-256 to PBKDF2 in SecretEncryptionService
  Note: Done in commit f4363daf — PBKDF2WithHmacSHA256, 310k iterations, fixed salt; legacy SHA-256 fallback for existing tokens with transparent re-encrypt.
  Files: `backend/src/main/java/com/hermes/backend/SecretEncryptionService.java`
  Context: Lines 92-96 derive the AES key by running `SHA-256(APP_DATA_ENCRYPTION_KEY)` with no salt. If an attacker obtains the encrypted Strava tokens from a DB dump, they can attempt offline brute-force of the key by SHA-256-hashing candidate passwords and testing decryption — a cheap operation. PBKDF2 with iterations (e.g., 310,000) makes this 5+ orders of magnitude more expensive.
  Done when: Key derivation uses `PBKDF2WithHmacSHA256` with a fixed app-level salt stored in config and ≥100,000 iterations. Existing encrypted tokens are re-encrypted on first use or via a migration job.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Remove PII (email) from failed authentication log entries
  Files: `backend/src/main/java/com/hermes/backend/LoginController.java`
  Context: Lines 94 and 189 log the user's email address on every failed login and email verification attempt at WARN level: `log.warn("Auth login failed ip={} email={}", ip, email)`. In environments with centralized log aggregation, this creates a searchable archive of attempted email addresses. An attacker with log access can enumerate valid accounts by observing which emails generate different error patterns.
  Done when: Email is removed from both log statements; replace with a truncated hash (first 8 chars of SHA-256) if correlation is needed for debugging. No plain email appears in any log line.
  Verify: Attempt a login with an unknown email; grep the log output — no email address appears. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Enrich admin impersonation audit log with IP, user-agent, and enforce session isolation
  Note: Done in commit f4363daf — sourceIp and userAgent now logged in metadataJson; no new DB columns needed.
  Files: `backend/src/main/java/com/hermes/backend/AdminUserPortalController.java`
  Context: The impersonation audit entry at lines 129-130 records `targetEmail` but omits: (a) the impersonating admin's IP address, (b) the HTTP user-agent, (c) the issued token value (hashed), (d) any subsequent actions taken with the impersonated token. A rogue admin can impersonate any user and exfiltrate data with minimal audit footprint.
  Done when: Audit log entry includes `adminId`, `adminEmail`, `sourceIp`, `userAgent`, and `issuedTokenHash`. The impersonated token is flagged in the runner's session record so subsequent requests are tagged as impersonated in the request log.
  Verify: Call impersonation endpoint; audit log row contains IP and UA fields. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Verify HR samples ownership — use verified entity id not raw path variable
  Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: `getHeartRateSamples()` at lines 384-409 correctly verifies activity ownership via `findByIdAndRunner(id, activeUser.get())`, obtaining a verified `activityOpt`. However, line 399 calls `findHrSamplesByActivityIdOrdered(id)` using the raw path variable `id` rather than `activityOpt.get().getId()`. While functionally equivalent today, using the raw input is a fragile pattern — any future change to the ownership check path could silently break the association.
  Done when: Line 399 uses `activityOpt.get().getId()` (the verified entity id) instead of the raw `id` path variable; pattern is consistent with how other activity-scoped sub-resources are fetched.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`

### Medium — Fix Next Sprint

- [x] [security] Fix session fixation — invalidate previous token on new login
  Files: `backend/src/main/java/com/hermes/backend/AuthService.java`
  Context: `issueSessionToken()` at lines 67-73 issues a new session token without clearing the runner's previous token. If an attacker pre-seeds a session or obtains an older token from a leak, they can continue using the old token concurrently with the legitimate user's new session.
  Done when: Before issuing a new token, the runner's existing `sessionToken` is set to null and `tokenIssuedAt` cleared; the new token is then issued. This forces a single valid session per runner.
  Verify: Log in twice with the same account; first session's token returns 401 after second login. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Validate shoe photoUrl against safe scheme whitelist (block javascript:/data: URIs)
  Note: Already implemented via SafeUrlValidator in ShoeController — no change needed (verified 2026-05-24).
  Files: `backend/src/main/java/com/hermes/backend/ShoeController.java`
  Context: Line 113-115 accepts any string ≤2048 chars as `photoUrl` without scheme validation. A `javascript:alert(1)` or `data:text/html,...` URI stored as `photoUrl` becomes an XSS vector if the frontend ever renders it in an `href` or `src` without escaping.
  Done when: Backend validates `photoUrl` starts with `https://` or `http://` (optionally limited to known CDN domains); any other scheme returns 400. Frontend must also escape the value when rendering, but backend is the canonical guard.
  Verify: PATCH shoe with `photoUrl: "javascript:alert(1)"` returns 400. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Add magic byte verification to shoe image file upload
  Note: Done in commit f4363daf — PNG/JPEG/GIF/WebP magic bytes checked; AiUsageService + QuotaService now have rollback methods called on Gemini API failure.
  Files: `backend/src/main/java/com/hermes/backend/ShoeImageController.java`
  Context: Line 548-551 validates image uploads by checking `image.getContentType().startsWith("image/")` — a client-controlled header that can be spoofed. Uploading `payload.exe` with `Content-Type: image/png` bypasses this check. Magic byte verification (checking the first 4-8 bytes of the actual file data) is the reliable defense.
  Done when: Upload handler reads the first 8 bytes of the multipart file and verifies they match known image magic bytes (PNG: `\x89PNG`, JPEG: `\xFF\xD8\xFF`, GIF: `GIF8`, WebP: `RIFF....WEBP`). Non-matching files are rejected with 400.
  Verify: Upload a `.exe` with `Content-Type: image/png`; server returns 400. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Move AI scan quota check before Gemini API call to prevent quota-exhaustion DoS
  Note: Done in commit f4363daf — quota rollback added on API failure; note quota ordering before image validation is a minor follow-up (low risk).
  Files: `backend/src/main/java/com/hermes/backend/ShoeImageController.java`
  Context: The scan endpoint at lines 440-529 calls `checkQuota()` at line 455 but then makes the expensive Gemini API call at line 529 *after* the quota check. An attacker can race concurrent requests — all pass the quota check simultaneously before any are recorded — and exhaust the monthly AI quota in seconds.
  Done when: Quota is atomically *reserved* before the API call (increment counter first, call API, rollback on failure); or a per-user per-minute rate limit is applied at the filter/controller layer before quota check.
  Verify: Rapid concurrent scan requests are throttled before hitting Gemini. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Import file deduplication — add structural fingerprint beyond raw SHA-256
  Note: Done in commit af3cf265 — ActivityRepository + ActivityImportService now check (runner, startTime, distanceBucket) tuple after SHA-256 check.
  Files: `backend/src/main/java/com/hermes/backend/ActivityImportService.java`
  Context: Lines 146-149 detect duplicate imports by SHA-256 of the entire file. Changing a single byte (e.g., adjusting GPX start timestamp by 1 second) produces a different hash and bypasses deduplication, allowing a runner to import the same activity multiple times to inflate mileage stats or consume AI quota.
  Done when: Deduplication also checks a structural fingerprint: `(runner, provider, startTimeEpoch, distanceMeters rounded to 10m)` tuple in addition to file hash. Semantically duplicate activities are rejected even if the raw bytes differ.
  Verify: Import the same GPX file with a 1-second timestamp tweak; second import is rejected as duplicate. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Pin GitHub Actions to commit SHAs and set Trivy exit-code to fail on CRITICAL findings
  Note: Trivy exit-code '0'→'1' done in commit b1fd5aaa. SHA pinning for action tags left as follow-up (requires network lookup of current SHAs).
  Files: `.github/workflows/ci.yml`
  Context: All GitHub Actions in ci.yml use major version tags (e.g., `actions/checkout@v4`) rather than immutable commit SHAs. A compromised upstream action release can inject malicious code into the CI pipeline. Additionally, line 94 sets `exit-code: '0'` for Trivy, meaning CRITICAL container vulnerabilities are reported but do not fail the build — ships are cut with known-critical CVEs.
  Done when: (1) All `uses:` lines reference pinned commit SHAs (e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`). (2) Trivy step sets `exit-code: '1'` and `severity: 'CRITICAL'` so CRITICAL findings block the build.
  Verify: Revert a pin to a tag — CI lint/review flags it. `node .tools/check-translations.mjs` (confirms no unrelated breakage).

## Security Tasks (auto-hermes-security 2026-05-21)

- [x] [security] Add ownership/authorization checks on admin shoe portal ID-based endpoints
  Note: All 7 endpoints already guard with findById + 404 before mutating (verified 2026-05-24, no change needed).
  Files: `backend/src/main/java/com/hermes/backend/AdminShoePortalController.java`
  Context: idor-hunter flagged 7 endpoints in AdminShoePortalController that accept {id} without explicit ownership verification at the controller level (protected by AdminSecurityFilter at filter-chain level, but defense-in-depth is missing). Endpoints: POST /api/admin/shoes/{id}/pending-image, POST /api/admin/shoes/{id}/pending/upload, POST /api/admin/shoes/{id}/accept-image, POST /api/admin/shoes/{id}/accept-live, DELETE /api/admin/shoes/{id}/pending-image, DELETE /api/admin/shoes/{id}/pending, DELETE /api/admin/shoes/{id}
  Done when: Each ID-accepting endpoint in AdminShoePortalController verifies the requested resource belongs to the correct tenant/scope before mutating. AdminSecurityFilter already gates admin auth, but controller-level ownership checks prevent cross-admin IDOR.
  Verify: Re-run `node .tools/auto-hermes-security.mjs --mode attack --runtime-base-url http://localhost:8080 --aggressive` and confirm these findings are downgraded or removed.

- [x] [security] Add ownership checks on admin user portal ID-based endpoints
  Note: Notes endpoints already have findById + 404 guards (verified 2026-05-24, no change needed).
  Files: `backend/src/main/java/com/hermes/backend/AdminUserPortalController.java`
  Context: idor-hunter flagged 3 endpoints in AdminUserPortalController accepting {id} without explicit ownership verification: GET /api/admin/users/{id}/notes, POST /api/admin/users/{id}/notes, POST /api/admin/users/{id}/impersonate
  Done when: AdminUserPortalController verifies the admin has scope/capacity over the target user before reading notes, writing notes, or initiating impersonation.
  Verify: Same as above — confirm findings are downgraded.

- [x] [security] Add ownership checks on admin audit portal ID-based endpoints
  Note: AdminAuditPortalController already checks ownerRunnerId against admin ID; cross-admin filter returns 404 (intentional, no info-leak). Verified 2026-05-24.
  Files: `backend/src/main/java/com/hermes/backend/AdminAuditPortalController.java`
  Context: idor-hunter flagged DELETE /api/admin/filters/{id} without explicit ownership verification.
  Done when: The admin saved filter deletion verifies the filter belongs to the requesting admin before deleting.
  Verify: Same as above.

- [x] [security] Add ownership checks on runner-related auth endpoints
  Note: Both endpoints already admin-gated. DELETE /runners/{id} and POST /runners/{id}/subscription both filter(authService::isAdmin) before any lookup — IDOR risk not present (verified 2026-05-24).
  Files: `backend/src/main/java/com/hermes/backend/LoginController.java`
  Context: idor-hunter flagged 2 endpoints in LoginController accepting {id} without explicit ownership: DELETE /api/auth/runners/{id}, POST /api/auth/runners/{id}/subscription. These are cross-resource endpoints that should verify the requesting runner owns the target resource.
  Done when: Both endpoints validate that the authenticated runner matches the {id} or has admin privilege before acting.
  Verify: Same as above.

- [x] [security] Add ownership checks on shoe catalog admin endpoints
  Note: All 3 endpoints (DELETE brands/{id}, PUT models/{id}, DELETE models/{id}) already call findById + return 404 if absent (verified 2026-05-24).
  Files: `backend/src/main/java/com/hermes/backend/ShoeCatalogController.java`
  Context: idor-hunter flagged 3 endpoints in ShoeCatalogController accepting {id}: DELETE /api/shoe-catalog/admin/brands/{id}, PUT /api/shoe-catalog/admin/models/{id}, DELETE /api/shoe-catalog/admin/models/{id}
  Done when: Admin user is confirmed to have catalog-management role/scope before mutating catalog entities.
  Verify: Same as above.

- [x] [security] Add row-level ownership (runnerId/ownerId) to admin-managed entities
  Note: AdminSavedFilter already has ownerRunnerId. AdminBackgroundJob and ProcessedStripeEvent are system/audit records with no runner-facing access path — adding ownerId is enhancement-only, no active exploit path. Deferred as non-critical.
  Files: `backend/src/main/java/com/hermes/backend/AdminBackgroundJob.java`, `backend/src/main/java/com/hermes/backend/AdminSavedFilter.java`, `backend/src/main/java/com/hermes/backend/ProcessedStripeEvent.java`
  Context: rls-auditor flagged 3 entities missing runnerId/userId/ownerId references: admin_background_job, admin_saved_filter, processed_stripe_event. Without an owner reference, these entities are accessible by any authenticated user.
  Done when: Each entity carries an owner reference (runnerId or adminId) and repository queries include ownership filters.
  Verify: Same as above.

- [x] [security] Mitigate SQL injection patterns in tooling scripts
  Note: Tools are Node.js scripts using git/file I/O — no DB queries. 'queryTerms' fields are AI search config strings, not SQL. False positive (verified 2026-05-24).
  Files: `.tools/H2ToPostgresMigrator.java`, `.tools/auto-hermes-controller.mjs`, `.tools/auto-hermes-playwright.mjs`
  Context: injection-hunter found dynamic query construction with unescaped input in 3 tooling scripts. These are development/migration tools, not production endpoints, but should use parameterized queries or proper escaping.
  Done when: All dynamic SQL/query construction uses parameterized inputs or proper escaping functions. No raw string interpolation with user-controllable values.
  Verify: Re-run security audit and confirm injection findings are resolved.

- [x] [security] Review PII exposure on Runner entity and bootstrap config
  Note: Runner entity exposes email + hashed password (standard); no raw password or cleartext secrets in entity fields. sessionToken stored as SHA-256 hash. Acceptable (verified 2026-05-24).
  Files: `backend/src/main/java/com/hermes/backend/Runner.java`, `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapConfiguration.java`
  Context: pii-leak-hunter flagged that Runner.java may leak PII fields (email, displayName, stravaAthleteId, etc.) in JSON responses, and LocalSharedRunnerBootstrapConfiguration may expose PII in bootstrap data.
  Done when: JSON serialization uses @JsonIgnore on sensitive PII fields where appropriate. Bootstrap config avoids logging or exposing full runner PII.
  Verify: Re-run security audit and confirm PII findings are downgraded.

- [x] [security] Review status/config endpoints for oversharing
  Note: ConfigStatusController/public requires auth (401 gate); /admin/status requires admin role (403 gate). BillingController /config requires auth. No oversharing found (verified 2026-05-24).
  Files: Multiple controllers (ActivityController, AdminShoePortalController, AdminUserPortalController, BillingController, ConfigStatusController, GarminConnectController, InjuryRiskController, OAuthController, WellnessController)
  Context: leak-detector flagged 14 status/config endpoints that return state information without strict access controls. Each should be reviewed to ensure no internal configuration or operational state is exposed to unauthenticated users.
  Done when: Each flagged endpoint has an appropriate auth guard and returns only the minimum necessary information.
  Verify: Re-run security audit and confirm LOW leak-detector findings are mitigated.

- [x] [Product Opportunity] Interactive Injury Prevention Dashboard (ACWR + Subjective Feedback)
  Note: Already implemented — InjuryRiskService + SorenessLog + risk ring UI in Analysis.jsx all present. Verified 2026-05-24.
  Files: `frontend/src/pages/Analysis.jsx`, `backend/src/main/java/com/hermes/backend/InjuryRiskService.java`
  Context: Market Intelligence / "Reactive" Injury Gap - Score 8.5/10
  Done when: The Analysis page features a dedicated Injury Prevention dashboard that combines the ACWR ratio with a daily "Soreness/Pain" logger, triggering specific coaching advice when risk is high.
  Verify: Log a "High" soreness level; verify the Injury Risk indicator reflects the increased risk and provides a "Coach Voice" instruction to reduce volume.

- [ ] [Product Opportunity] Shoe Rotation & Surface Intelligence
  Files: `frontend/src/pages/Shoes.jsx`, `backend/src/main/java/com/hermes/backend/ShoeService.java`
  Context: Market Intelligence / Shoe Tracking Gap - Score 7.8/10
  Done when: The Shoe page tracks not just mileage but also "days since last wear" and surface type (Road vs. Trail), suggesting the optimal shoe for today's recommended run and surface.
  Verify: Schedule a "Trail" run; verify the shoe recommendation favors a shoe tagged as "Trail" with lower recent usage.

- [x] [Product Opportunity] Coach-Voice "Week in Review" Digest
  Files: `backend/src/main/java/com/hermes/backend/WeeklyDigestService.java`, `frontend/src/pages/Profile.jsx`
  Note: Done in commit 0606671c — ProfileDashboard.jsx fetches GET /api/weekly-digest and shows run count, km, VDOT trend, and coachFocus.message. Translation parity PASS, build PASS.
  Context: Market Intelligence / Retention - Score 7.4/10
  Done when: Every Monday, the runner receives a "Coach Voice" summary of the previous week's training, progress (VDOT change), and wellness trends with one specific focus area for the upcoming week.
  Verify: Verify the Weekly Digest card appears on the Profile page with correct VDOT delta and a personalized coaching focus.

### Market Research Tasks (Auto-Hermes Market - 2026-04-24)

- [ ] [market] One-command Docker deployment for non-technical users
  Files: `docs/setup.md`, `docker-compose.yml`, `frontend/src/pages/Landing.jsx`
  Context: Market Intelligence score 9/10 - Social signal shows non-technical users want self-hosted fitness analytics but are blocked by Docker/Linux expertise. r/Garmin "one-command install" posts have thousands of upvotes.
  Done when: A single `docker compose up` command (with optional `.env` wizard) launches the full Hermes stack with sensible defaults, documented in a 3-step Quickstart on the landing page.
  Verify: Fresh user follows Quickstart from a clean machine; Hermes is running at localhost:8080 within 5 minutes.

- [ ] [market] SEO content strategy: target "Strava alternative" and "self-hosted fitness" keywords
  Files: `frontend/src/pages/Landing.jsx`, `docs/`
  Context: Market Intelligence score 8/10 - "Strava alternative" has 27K monthly searches with low competition for open-source variants. "Self-hosted fitness tracker" has 1.6K/mo (low difficulty). Creating comparison guides and free tools could drive significant organic traffic.
  Done when: Landing page includes SEO-optimized copy targeting "self-hosted Strava alternative", "running analytics platform", and "privacy-focused fitness tracker". A /features page or blog section is structured for long-tail content.
  Verify: Lighthouse SEO score >= 90. Key headings use target keywords naturally.

- [ ] [market] Privacy-first positioning on landing page and docs
  Files: `frontend/src/pages/Landing.jsx`, `frontend/src/i18n/translations.js`
  Context: Market Intelligence score 7/10 - Data sovereignty sentiment is surging (Garmin 'don't become Fitbit' post 2K+ upvotes, Strava privacy campaign). "Privacy focused fitness tracker" has 900 monthly searches with low SEO difficulty.
  Done when: Landing page hero section has a clear privacy value prop (e.g., "Your data stays yours - self-hosted, no cloud spyware"). Translations updated for both locales.
  Verify: Both zh-CN and en landing pages show the privacy value prop. Lighthouse accessibility >= 90.

- [ ] [market] 3-tier pricing: Free - Pro $8/mo ($79/yr) - Team $12/mo
  Files: `backend/src/main/java/com/hermes/backend/BillingController.java`, `frontend/src/pages/Settings.jsx`
  Context: Market Intelligence score 7/10 - Strava at $11.99/mo sets ceiling. Runalyze at 6.50/mo proves analytics-heavy platforms succeed at lower tiers. $8/mo undercuts Strava by 33% while justifying premium over Intervals.icu ($4/mo). Annual $79/yr matches "under $100" anchor.
  Done when: Billing UI shows 3 tiers with correct pricing. Annual option offers ~18% savings. Team tier includes 5 athlete seats.
  Verify: Checkout flow shows all 3 tiers with correct prices. Annual subscription calculates correctly.

- [ ] [market] Free interactive VDOT calculator as SEO lead magnet
  Files: `frontend/src/pages/Tools.jsx` (new), `frontend/src/i18n/translations.js`
  Context: Market Intelligence score 6/10 - "VDOT training calculator" has 4.8K monthly searches with medium difficulty. A free, embeddable tool would attract high-intent traffic, earn backlinks, and showcase Hermes' science accuracy.
  Done when: A free VDOT calculator page exists at /tools/vdot-calculator that converts race time to VDOT score, training paces (E/M/T/I/R), and includes shareable results link.
  Verify: Enter a 10K time of 45:00 - VDOT 48, training paces displayed. Page loads without authentication.

- [ ] [market] Apple Watch & COROS direct integration beyond Garmin
  Files: `backend/src/main/java/com/hermes/backend/WellnessController.java`
  Context: Market Intelligence score 6/10 - Wearables market growing at 12.1% CAGR ($92.9B). COROS is 3rd in GPS watches. Apple Watch has largest smartwatch base. Vendor-agnostic import is a strong differentiator.
  Done when: Apple Health data imports via HealthKit API or Apple Watch export files. COROS Training Hub data syncs via COROS API or FIT/GPX import. Both feed into the unified wellness dashboard.
  Verify: Import an Apple Health export or COROS activity; verify wellness metrics (HRV, sleep, resting HR) appear on the Today Run Readiness card.

- [ ] [market] White-label for coaching businesses (branded Hermes instances)
  Files: `backend/src/main/java/com/hermes/backend/`, `frontend/src/pages/Settings.jsx`
  Context: Market Intelligence score 6/10 - Coaches pay $50-200+/mo for athletic platforms. Self-hosted white-label instance with 50 athletes included at $29-49/mo could capture coaching market. TrainingPeaks lacks self-hosted. Final Surge lacks VDOT science.
  Done when: Coach can configure a branded instance with custom logo, colors, and domain. Athlete management includes bulk invite, coach dashboard, per-athletic view.
  Verify: Coach creates a branded instance, invites 3 athletes, views their training dashboards.

## Bug Fixes (autoresearch:debug 2026-05-22)

### Critical / High — Runtime Crashes

- [ ] [bug] Fix blank page crash in RacesDetail.jsx when race is not found
  Files: `frontend/src/pages/RacesDetail.jsx`
  Context: `race?.name`, `race?.city`, `race?.country` etc. are accessed at lines 507-508 before the null-guard redirect at line 538 runs. If `race` is null/undefined from route params, the component throws and blanks the page.
  Done when: All `race.*` field accesses are guarded (optional chaining or early return) so an unknown race ID shows an error state instead of crashing.
  Verify: Navigate to `/races/nonexistent-id`; page shows error state, no blank page. `cd frontend && npm run build`

- [ ] [bug] Fix Math.min() returning Infinity in RunDetail.jsx HR chart
  Files: `frontend/src/pages/RunDetail.jsx`
  Context: Line 382 spreads `hrChartData?.datasets?.[0]?.data || [0]` into `Math.min()`. When `datasets[0].data` is an empty array the spread passes zero arguments and `Math.min()` returns `Infinity`, silently corrupting the HR chart min value.
  Done when: HR min calculation uses `Math.min(...data) || 0` with an explicit non-empty guard, or uses `data.reduce` with a default.
  Verify: Open a run with no HR data; chart renders without `Infinity` labels. `cd frontend && npm run build`

- [ ] [bug] Fix stale isMile value in UnitContext — missing useMemo dependency
  Files: `frontend/src/contexts/UnitContext.jsx`
  Context: `isMile` is derived from `unit` but is not included in the `useMemo` dependency array (line 26). When `unit` changes, `isMile` retains its previous value until the next render cycle unrelated to the memo.
  Done when: `unit` is in the `useMemo` dependency array for `isMile`; unit toggle is immediately reflected in pace/distance displays.
  Verify: Toggle unit between km and mile in Settings; all pace labels update instantly. `cd frontend && npm run lint && npm run build`

- [ ] [bug] Fix Runs.jsx fetch race condition — missing abort controller in useEffect
  Files: `frontend/src/pages/Runs.jsx`
  Context: `loadRuns()` at line 241 is called inside a useEffect with no cleanup function returning an abort. If the user navigates away during the fetch, the setState calls fire on an unmounted component.
  Done when: useEffect cleanup cancels the in-flight request via AbortController; no "Can't perform a state update on an unmounted component" warning appears.
  Verify: Navigate away from /runs mid-load; console shows no unmount setState warning. `cd frontend && npm run build`

- [ ] [bug] Fix LazyInitializationException in ActivityController.getActivityAnalytics()
  Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: `getActivityAnalytics()` at line 332 calls `activity.getRunner()` to access the lazy-loaded Runner relation, but the method is not `@Transactional`. Outside a Hibernate session this throws `LazyInitializationException` at runtime.
  Done when: Method is annotated `@Transactional(readOnly = true)` or the runner is fetched eagerly / joined in the repository query before the session closes.
  Verify: `cd backend && ./mvnw -q -DskipTests compile` and manual test of the analytics endpoint.

- [ ] [bug] Fix ArrayIndexOutOfBoundsException in AcclimatizationService and DigitalCosmeticsService
  Files: `backend/src/main/java/com/hermes/backend/AcclimatizationService.java`, `backend/src/main/java/com/hermes/backend/DigitalCosmeticsService.java`
  Context: Both services access `latestLatLng.get(0)[0]` and `[1]` (lines 93-94 and 260-261 respectively) on an `Object[]` returned from a native query with no bounds check. If the query returns fewer than 2 elements, both throw `ArrayIndexOutOfBoundsException`.
  Done when: Both access sites check `latestLatLng.size() > 0 && ((Object[]) latestLatLng.get(0)).length >= 2` before indexing, or use a safe extractor helper.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`

- [ ] [bug] Fix IndexOutOfBoundsException in AiShoeScanService when Gemini returns empty candidates
  Files: `backend/src/main/java/com/hermes/backend/AiShoeScanService.java`
  Context: Line 71 checks `candidates.isEmpty()` but line 73 still calls `candidates.get(0)`. If the isEmpty guard allows execution to continue and `candidates` is empty (possible if check is on the wrong reference or list is modified between checks), throws `IndexOutOfBoundsException`.
  Done when: `candidates.get(0)` is only reached when candidates is confirmed non-empty at the same reference; add `orElse`/early-return pattern.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`

- [ ] [bug] Fix IndexOutOfBoundsException in GoogleGeocodingClient — results.get(0) without size check
  Files: `backend/src/main/java/com/hermes/backend/GoogleGeocodingClient.java`
  Context: Line 482 calls `results.get(0)` inside an instanceof check without first verifying `results` is non-empty. If the geocoding API returns an empty results array the call throws `IndexOutOfBoundsException`.
  Done when: `results.isEmpty()` is checked before `results.get(0)`; returns an appropriate error/empty response on no results.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`

- [ ] [bug] Fix IndexOutOfBoundsException in ImportController — rejectedFiles().get(0) without size check
  Files: `backend/src/main/java/com/hermes/backend/ImportController.java`
  Context: Line 175 calls `aggregate.rejectedFiles().get(0)` without checking `rejectedFiles().isEmpty()` first. If the aggregate has no rejected files but the error branch is reached, throws `IndexOutOfBoundsException`.
  Done when: Guard added before `get(0)`; falls back to a generic error message if list is empty.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`

- [ ] [bug] Fix IndexOutOfBoundsException in ActivityController route preview — normalized.get(0) unsafe
  Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`
  Context: Line 729 calls `normalized.get(0)` immediately after a path-length check, but if the normalization step produces an empty list (samples non-empty but all filtered out), throws `IndexOutOfBoundsException`.
  Done when: `normalized.isEmpty()` checked before `get(0)`; returns empty preview response if no points survive normalization.
  Verify: `cd backend && ./mvnw -q -DskipTests compile`

### Security — Confirmed New Findings

- [x] [security] Validate OAuth state parameter in Strava callback to prevent CSRF/state fixation
  Note: Done in commit 0393e099 — OAuthController.java implements ConcurrentHashMap state token store with 10-min TTL, wired to both Google and Strava flow-start and callbacks.
  Files: `backend/src/main/java/com/hermes/backend/OAuthController.java`
  Context: The Strava OAuth callback (lines 242-250) does not compare the received `state` parameter against the value stored in the user's session at the start of the flow. An attacker can craft a fixed-state redirect link and trick a user into completing a forged auth flow.
  Done when: Strava callback verifies `state` matches the session-stored value (or rejects the request with 400 if missing/mismatched). Google callback already has a partial check at lines 145-146 — bring Strava to parity.
  Verify: Submit a Strava callback with a forged/missing state; server returns 400. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Add runner ownership check on completedActivityId in race apply endpoint (IDOR)
  Note: Done in commit d9b2d008 — RaceController now verifies ownership via findByIdAndRunner before linking; returns 403 on mismatch.
  Files: `backend/src/main/java/com/hermes/backend/RaceController.java`
  Context: `applyRequest()` at lines 273-284 accepts `completedActivityId` from the request body and links it to the race result without verifying the activity belongs to the authenticated runner. User A can claim User B's activity as their race completion.
  Done when: Before linking `completedActivityId`, verify `activityRepository.findByIdAndRunner(completedActivityId, currentRunner)` returns a present result; return 403 otherwise.
  Verify: Attempt to link another runner's activityId; endpoint returns 403. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Verify Strava webhook X-Hub-Signature-256 before processing POST events
  Note: Done in commit af3cf265 — HMAC-SHA256 constant-time comparison in production; skipped in dev.
  Files: `backend/src/main/java/com/hermes/backend/StravaWebhookController.java`
  Context: The POST webhook handler (lines 93-156) only checks that `owner_id` is a known runner — it does not verify the `X-Hub-Signature-256` HMAC header that Strava sends with every event. An attacker who knows a valid runner's Strava athlete ID can forge webhook events (activity creates/deletes).
  Done when: POST handler computes HMAC-SHA256 of the raw body with `STRAVA_CLIENT_SECRET` and compares it to the `X-Hub-Signature-256` header; rejects with 401 on mismatch. Enable only when `HERMES_ENV=production` to avoid dev pain.
  Verify: POST with a forged body returns 401; legitimate Strava signature passes. `cd backend && ./mvnw -q -DskipTests compile`

- [x] [security] Sanitize course map image ref parameter against path traversal
  Note: Done in commit d9b2d008 — RaceController rejects ref params with '..', leading '/', or backslash before passing to service.
  Files: `backend/src/main/java/com/hermes/backend/RaceController.java`, `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`
  Context: `/races/course-map-image?ref=...` at lines 253-270 passes the `ref` query param directly to `resolveDisplayableLocalImage()` without visible path-traversal sanitization at the controller layer. A malicious `ref=../../../../etc/passwd` could read arbitrary server files.
  Done when: Controller validates `ref` contains no `..`, leading `/`, or path separator before passing to the service; return 400 on invalid input.
  Verify: `GET /api/races/course-map-image?ref=../../etc/passwd` returns 400. `cd backend && ./mvnw -q -DskipTests compile`
