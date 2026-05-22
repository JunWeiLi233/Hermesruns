# Hermes Design Versions

Use this file to keep a durable history of meaningful Hermes UI and design-system revisions.

Rules
- Append new entries at the top, newest first.
- Log only meaningful user-facing design or layout changes, not every tiny text tweak.
- Prefer commit hashes in `Rollback target:` when a commit exists.
- If no commit exists yet, name the previous version or say `working tree before this change`.
- Keep entries concise but concrete enough that an agent can restore or reconstruct the prior design state.

## Current Versions

### Version: DV-2026-05-22-05
Date: 2026-05-22
Surface: Muscle Training restored card workbench on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the pre-merge `mt-*` card-based Muscle Training frontend design on the current page: warm card canvas, hero progress ring, recommendation banner, target filters, session/history cards, and expandable exercise rows.
Why: The user asked to apply the previous frontend design to the current page after the upstream IRONPULSE merge.
Rollback target: `ecbe742f`
Notes: The removed action-diagram implementation remains excluded and is guarded by the smoke test.

### Version: DV-2026-05-19-07
Date: 2026-05-19
Surface: Muscle Training action protocol drawer on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/locales/en.js`, `frontend/src/i18n/locales/zh-CN.js`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Upgraded the selected exercise detail card into an IRONPULSE-style protocol drawer. Clicking a plan or library row now opens a right-side desktop drawer, or an in-flow mobile sheet, with a breadcrumb, dose/equipment/source tags, a real YouTube nocookie iframe when the exercise has a mapped video, honest no-video copy when it does not, accordion coach tips, and high-contrast numbered step cards.
Why: The prior detail card was too flat for the action-workbench interaction. The user wanted the row click to feel like the reference action-analysis drawer while preserving the practical left-side exercise ledger.
Rollback target: `working tree before this change`
Notes: No backend schema or training-plan generation changed. Optional library exercises remain clearly marked as not participating in today's training recommendation calculation.

### Version: DV-2026-05-19-01
Date: 2026-05-19
Surface: Schedule light-mode text contrast on `/schedule`
Files: `frontend/src/styles/style.css`, `frontend/src/pages/scheduleContrast.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a route-scoped light-theme contrast repair for the Schedule hero and next-session card so the main weekly title, target/completed volume values, and upcoming-session heading stay dark on warm white cards even when broader runner-card rules apply later in the cascade.
Why: The live Schedule page rendered several primary words in near-white text on a white background, making the hero and next-up title hard to read.
Rollback target: `working tree before this change`
Notes: Added `scheduleContrast.smoke.test.js` to guard the Schedule-only contrast selectors.

### Version: DV-2026-05-18-02
Date: 2026-05-18
Surface: Shoes locker and Add Shoes catalog grids on `/shoes` and `/shoes/add`
Files: `frontend/src/styles/style.css`, `frontend/src/pages/shoesGridVisibility.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a profile-aligned Shoes grid visibility pass that gives the locker cards, rotation signal panels, filter/action strips, brand grids, model grids, form fields, placeholders, and empty states explicit warm-paper foreground/background tokens in light mode plus matching dark-mode tokens. The repair targets the real runtime classes `.shoes-dashboard-page` and `.add-shoes-page`, keeping the existing Shoes/Add Shoes structure and data wiring while preventing inherited near-white dark-theme text from disappearing on warm light cards.
Why: Several Shoes grids and card sub-surfaces could become visually invisible after the Profile-aligned redesign because dark-theme text, placeholders, and translucent grid cards were still cascading onto light warm-paper panels, and some older profile-aligned selectors were scoped to a wrapper that the current Shoes runtime does not emit.
Rollback target: `working tree before this change`
Notes: Added `shoesGridVisibility.smoke.test.js` to guard the route-scoped contrast repair selectors and the live Shoes/Add Shoes class hooks.

### Version: DV-2026-05-18-01
Date: 2026-05-18
Surface: Rewards / `/rewards` milestone ledger
Files: `frontend/src/pages/Rewards.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/locales/en.js`, `frontend/src/i18n/locales/zh-CN.js`, `frontend/src/pages/rewardsMilestoneLedger.smoke.test.js`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Reworked the Rewards first fold into an asymmetric milestone ledger that keeps the live earned/all badge progress while promoting `upcomingRewards[0]` into a dedicated closest-next-unlock rail. The page now exposes earned, locked, and logged-run metrics above the existing earned/upcoming badge grids, preserving the shared runner shell and live `buildRewardShowcase` ordering.
Why: The previous Rewards page showed the correct data but made the next achievable badge feel like one generic upcoming card instead of the primary runner decision for the page.
Rollback target: `working tree before this change`
Notes: Focused verification passed with `node frontend/src/pages/rewardsMilestoneLedger.smoke.test.js`, `node frontend/src/utils/rewardsShellMarker.smoke.test.js`, `node --check frontend/src/i18n/locales/en.js`, and `node --check frontend/src/i18n/locales/zh-CN.js`. Full frontend build is currently blocked before Rewards compilation by missing pre-existing Muscle Training imports: `frontend/src/assets/anatomy/muscles-anterior-gray.png` and `frontend/src/assets/anatomy/muscles-posterior-gray-unlabeled.png`.

### Version: DV-2026-04-29-03
Date: 2026-04-29
Surface: Add Shoes / `/shoes/add` Chinese running-brand logos
Files: `frontend/src/components/ShoeBrandLogo.jsx`, `frontend/src/pages/AddShoes.jsx`, `frontend/src/utils/addShoeCatalog.js`, `frontend/src/utils/addShoeCatalog.test.js`, `frontend/vite.config.js`, `frontend/src/assets/brand-logos/lining.svg`, `frontend/src/assets/brand-logos/anta.svg`, `frontend/src/assets/brand-logos/peak.svg`, `frontend/src/assets/brand-logos/bmai.svg`, `frontend/src/assets/brand-logos/do-win.svg`, `frontend/src/pages/addShoesChineseBrandLogoAssets.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added repo-local transparent SVG logo assets for Li-Ning, ANTA, Peak, Bmai, and Do-win, then mapped the catalog's Chinese brand names plus normalized English aliases through the shared `ShoeBrandLogo` component used by `/shoes/add` brand and model cards. The Add Shoes series catalog now keeps parent brand identity on each series model and caches the built series catalog in localStorage so the model browser can recover locally if the live catalog is unavailable.
Why: The Add Shoes brand browser still fell back to synthetic text/emoji marks for several core Chinese running-shoe brands even though the user supplied the correct logo order and expected those brands to display real marks. The follow-up asked for shoe series to get the same local-first treatment, so series/model cards now preserve local brand-logo resolution and keep a local browser cache of the filtered series catalog.
Rollback target: `working tree before this change`
Notes: Added `addShoesChineseBrandLogoAssets.smoke.test.js` to guard the five asset imports, brand aliases, AddShoes shared-logo usage, series-cache hooks, remote-logo avoidance, and the Vite `assetsInlineLimit: 0` setting that keeps small SVG logos emitted as local backend-served asset files. Expanded `addShoeCatalog.test.js` to guard series brand retention and localStorage read/write behavior.

### Version: DV-2026-04-29-02
Date: 2026-04-29
Surface: Runner strength page on `/muscle-training` plus runner-shell sidebars
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/pages/RacesDetail.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/muscleTrainingShellNav.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reconnected Muscle Training to the shared runner-shell sidebar contract, added the strength route to older one-off runner sidebars, and fixed the MuscleTraining control-deck markup so the weekly context and full week plan no longer sit inside the collapsible settings/control section.
Why: The strength page could feel disconnected from the rest of Hermes and its lower page structure was broken by a misplaced section close. The repair keeps the existing Daily Opening Test strength redesign while making navigation and layout behave like the other runner pages.
Rollback target: `working tree before this change`
Notes: Added `muscleTrainingShellNav.smoke.test.js` to guard shared nav usage, side-nav connectivity, clean above-fold copy, and the control-deck close boundary.

### Version: DV-2026-04-29-01
Date: 2026-04-29
Surface: Admin course-map add portal on `/dashboard/course-maps`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/dashboardCourseMapProgressBar.smoke.test.js`, `frontend/src/pages/dashboardCourseMapUploadProcessing.smoke.test.js`, `frontend/src/pages/dashboardCourseMapFifoUploadQueue.smoke.test.js`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Added a live progress bar to the admin course-map upload/re-analysis flow. The portal now starts with upload progress, moves into FIFO queued scan progress, streams admin background-job progress into an accessible progressbar, and keeps a localized helper explaining that maps are scanned in upload order rather than in parallel.
Why: Admins uploading marathon course maps needed visible feedback while Qwen scanning waits for or runs through the FIFO queue, instead of a static queued message that made the scan feel stalled.
Rollback target: `DV-2026-04-24-02`
Notes: Verification passed with `node frontend/src/pages/dashboardCourseMapProgressBar.smoke.test.js`, `node frontend/src/pages/dashboardCourseMapUploadProcessing.smoke.test.js`, `node frontend/src/pages/dashboardCourseMapFifoUploadQueue.smoke.test.js`, `node frontend/src/pages/dashboardCourseMapWorkbench.smoke.test.js`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/Dashboard.jsx||frontend/src/pages/dashboardCourseMapProgressBar.smoke.test.js||frontend/src/pages/dashboardCourseMapUploadProcessing.smoke.test.js||frontend/src/pages/dashboardCourseMapFifoUploadQueue.smoke.test.js||frontend/src/styles/style.css||frontend/src/i18n/translations.js"`.

### Version: DV-2026-04-24-02
Date: 2026-04-24
Surface: Runner race-detail course map on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `frontend/src/utils/raceDetailMapVisualBaseline.smoke.test.js`, `backend/src/main/java/com/hermes/backend/RaceController.java`, `backend/src/main/java/com/hermes/backend/RaceCourseMapImageService.java`, `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`
What changed: Added a generated transparent course-map image layer for trusted aligned course maps. The runner-facing Leaflet map still uses OpenStreetMap as the real-world basemap and still draws extracted route geometry on top, but now it can place a cleared-background course-map PNG in a dedicated middle pane for visual context when Hermes has verified route points and bounds.
Why: Real marathon course-map uploads can carry useful station/marker context that should be visible without turning the runner map back into an opaque poster overlay.
Rollback target: `DV-2026-04-24-01`
Notes: Verification included focused backend and frontend smoke checks before the broader build/runtime gates.

### Version: DV-2026-04-24-01
Date: 2026-04-24
Surface: Admin jobs inspector on `/dashboard/jobs`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/dashboardJobsInspector.smoke.test.js`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Expanded the selected-job rail into a real inspector surface. Selecting a job now fetches `/api/admin/jobs/{jobId}` for the full detail payload, labels course-map and Garmin/Strava background-job types, shows queue/run timing, extracts top-level `detailsJson` highlights, and renders Qwen/course-map watcher steps from `qwenScanSteps` as a readable scan timeline while preserving the raw JSON payload below.
Why: Admins debugging course-map and Qwen scanning jobs needed to inspect more than status counters. The new rail keeps the command-deck layout but makes failed or long-running scan jobs easier to diagnose without leaving `/dashboard/jobs`.
Rollback target: `DV-2026-04-21-07`
Notes: Verification passed with `node frontend/src/pages/dashboardJobsInspector.smoke.test.js`, `node frontend/src/pages/dashboardJobsCommandDeck.smoke.test.js`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/Dashboard.jsx||frontend/src/pages/dashboardJobsInspector.smoke.test.js||frontend/src/styles/style.css||frontend/src/i18n/translations.js"`.

### Version: DV-2026-04-21-07
Date: 2026-04-21
Surface: Admin course-map workbench on `/dashboard/course-maps`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Promoted the course-map review stage into a true side-by-side compare surface so admins can see both the current live website map and the pending candidate map at the same time inside the main stage. The existing preview engine stays intact through `AdminCourseMapPreview`, but the dominant map area now splits into explicit live and pending panels with their own labels, map frames, and compact metadata strips. The operator controls, publish verdict, output deck, and queue rail remain in place underneath the compare stage instead of being replaced.
Why: The previous workbench already carried both live and pending preview data, but it only surfaced one preview at a time in the main stage and pushed the compare logic down into smaller footer signals. The user asked for admins to clearly see the current website map and the new pending map together before making publish decisions.
Rollback target: `DV-2026-04-19-11`
Notes: Verification passed with `node frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/Dashboard.jsx||frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js||frontend/src/styles/style.css"`.

### Version: DV-2026-04-21-06
Date: 2026-04-21
Surface: Admin portal desktop spacing on `/dashboard`, `/dashboard/users`, `/dashboard/course-maps`, `/dashboard/shoes`, `/dashboard/jobs`, `/dashboard/audit`, and `/dashboard/settings`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Loosened the full admin portal while preserving the existing Hermes operator shell and route workbench layouts. The desktop shell now uses a wider canvas, larger outer gutters, more space between the sticky sidebar/topbar/main content, a roomier shared route summary rail, and a new route-surface spacing baseline. The overview, users, shoes, course-maps, jobs, audit, and settings sections all received coordinated padding/gap increases so cards, workbenches, toolbars, and data rows no longer feel packed together, but the route structure, visual identity, and existing data/control flows stay the same.
Why: The current admin portal already had strong route-specific designs, but the user called out that the whole operator experience felt squeezed together. This pass keeps the same shell language and hierarchy while giving the portal more breathing room across every level of the desktop layout.
Rollback target: `DV-2026-04-20-06`
Notes: Verification passed with `node frontend/src/pages/dashboardKineticShell.smoke.test.js`, `node frontend/src/pages/dashboardRouteSections.smoke.test.js`, `node frontend/src/pages/dashboardJobsCommandDeck.smoke.test.js`, `node frontend/src/pages/dashboardAuditTerminal.smoke.test.js`, `node frontend/src/pages/dashboardAdminLightMode.smoke.test.js`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/styles/style.css||frontend/src/pages/Dashboard.jsx"`.

### Version: DV-2026-04-21-05
Date: 2026-04-21
Surface: Today Run shell alignment on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/pages/todayRunShellAlignment.smoke.test.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Aligned Today Run back toward the shared runner-shell structure used by Profile and the other runner pages without replacing its existing coaching content. The page now builds its sidebar navigation from the shared `runnerShellNav` helper instead of maintaining a local copy, restores the same sidebar workout CTA pattern used on Profile, and drops the page-specific light-mode sidebar/topbar overrides so the shared runner shell styling can carry more of the chrome. A focused smoke guard now protects that alignment contract.
Why: Today Run already had the same broad shell scaffolding, but it still behaved like a special-case surface because it hand-rolled its nav and overrode parts of the shared shell styling. The user asked for it to feel like the same runner-shell family as `/profile`, not a separate product inside Hermes.
Rollback target: `DV-2026-04-20-02`
Notes: Verification passed with `node frontend/src/pages/todayRunShellAlignment.smoke.test.js`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/TodayRun.jsx||frontend/src/pages/todayRunShellAlignment.smoke.test.js||frontend/src/styles/style.css"`.

### Version: DV-2026-04-21-03
Date: 2026-04-21
Surface: Runner Settings import surfaces on `/settings`, `/settings/import-data`, and `/settings/garmin-import`
Files: `frontend/src/App.jsx`, `frontend/src/components/SettingsAtlasLayout.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/pages/ImportDataSettings.jsx`, `frontend/src/pages/GarminImportSettings.jsx`, `frontend/src/pages/garminImportRoute.smoke.test.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Split the old mixed Garmin/manual import flow into two clearer settings sibling routes. The Settings atlas manual-import card now opens a new `/settings/import-data` page that keeps the settings-atlas visual family but translates the supplied reference into a lighter editorial intake board with distinct FIT/GPX, COROS, Huawei, and command lanes. The `/settings/garmin-import` page was narrowed so it only handles Garmin account import plus Garmin wellness sync, removing the manual-file guide and mixed-source messaging.
Why: The previous setup blurred two different jobs into one destination: Garmin account sync versus manual file intake. The user asked for a clean route split while keeping the new manual page visually tied to the current Settings atlas rather than turning it into a totally separate dark landing page.
Rollback target: `DV-2026-04-21-01`
Notes: Verification passed with `node frontend/src/pages/garminImportRoute.smoke.test.js`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/App.jsx||frontend/src/components/SettingsAtlasLayout.jsx||frontend/src/pages/Settings.jsx||frontend/src/pages/GarminImportSettings.jsx||frontend/src/pages/ImportDataSettings.jsx||frontend/src/pages/garminImportRoute.smoke.test.js||frontend/src/styles/style.css"`. Repo-wide translation parity still has unrelated pre-existing gaps outside this change set.

### Version: DV-2026-04-20-06
Date: 2026-04-20
Surface: Admin portal / `/dashboard`, `/dashboard/users`, `/dashboard/course-maps`, `/dashboard/shoes`, `/dashboard/jobs`, `/dashboard/audit`, `/dashboard/settings`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `docs/superpowers/specs/2026-04-20-admin-portal-runner-shell-alignment-design.md`, `DESIGN_VERSIONS.md`
What changed: Aligned the full admin portal to the broader Hermes runner-shell family instead of letting each route feel like a separate admin experiment. The shared admin shell now uses a stronger Hermes brand block, richer route-aware sidebar navigation, live operator status cards, a compact editorial topbar with active-route summary, and a shared route metric rail that sits above every admin surface. The existing overview, users, course maps, shoes, jobs, audit, and settings workbenches remain intact, but they now inherit one clearer shell rhythm and typography/spacing language.
Why: The admin portal already had several strong route-level redesigns, but the overall experience still felt stitched together from separate passes. This round implements the approved “shared editorial translation” direction so the operator portal feels like the admin twin of the user portal across pages rather than a collection of isolated admin surfaces.
Rollback target: `DV-2026-04-20-05`
Notes: Verification passed with the admin dashboard smoke tests, `cd frontend && npm run lint` (warning-only state), `cd frontend && npm run build`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/Dashboard.jsx||frontend/src/styles/style.css"`.

### Version: DV-2026-04-20-05
Date: 2026-04-20
Surface: Add Shoes / `/shoes/add` brand deck logo treatment
Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/addShoesKineticEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Refined the new `/shoes/add` brand deck so the featured and secondary brand cards now use the running-shoe brand logo as part of the card background treatment instead of rendering a separate floating `add-shoes-brand-deck-feature-art` badge. The logo now lives inside the card composition itself, which makes the deck feel cleaner and closer to the supplied reference.
Why: The previous featured-brand card still carried a distinct logo badge in the top-right corner, which made the composition feel more layered than the user wanted. This pass simplifies the visual hierarchy and lets the logo act as a built-in card background signal instead.
Rollback target: `DV-2026-04-20-04`
Notes: Verification passed with `node frontend/src/pages/addShoesKineticEditorial.smoke.test.js`, `cd frontend && npm run lint`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/AddShoes.jsx||frontend/src/styles/style.css||frontend/src/pages/addShoesKineticEditorial.smoke.test.js"`.

### Version: DV-2026-04-20-04
Date: 2026-04-20
Surface: Add Shoes / `/shoes/add`
Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/addShoesKineticEditorial.smoke.test.js`, `docs/superpowers/specs/2026-04-20-add-shoes-kinetic-editorial-design.md`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/shoes/add` into a darker kinetic-editorial footwear setup surface inspired by the supplied HERMES STITCH reference. The page keeps the real Hermes add-shoe workflow, but the top fold is now a stronger editorial hero, brand selection has been promoted into a premium brand deck with a featured lane, model picking now reads as a catalog board instead of a plain utility grid, and the final configuration step is presented as a selected-shoe payload panel rather than a generic form card.
Why: The previous Add Shoes page was functional but visually closer to a polished utility wizard than to the stronger premium footwear-selection language the user supplied. This pass brings the page much closer to that reference without sacrificing the existing catalog/search/submit behavior.
Rollback target: working tree before this change
Notes: Verification passed with `node frontend/src/pages/addShoesKineticEditorial.smoke.test.js`, `cd frontend && npm run lint`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/AddShoes.jsx||frontend/src/styles/style.css||frontend/src/pages/addShoesKineticEditorial.smoke.test.js"`.

### Version: DV-2026-04-20-03
Date: 2026-04-20
Surface: Admin Dashboard / `/dashboard/course-maps` left rail race cards
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/components/AdminCourseMapPreview.jsx`, `frontend/src/pages/dashboardCourseMapRailLeaflet.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the static poster-style course-map thumbnails in the `/dashboard/course-maps` left rail with real Leaflet/OpenStreetMap-backed mini map cards. The existing status/confidence chrome still sits on top of each card, but the image layer now comes from a live map viewport: aligned routes still fit to their geometry, while races that only have city-level coordinates now still render a real map centered on that fallback location with a small marker.
Why: The previous rail cards looked like uploaded assets, not like trustworthy geographic previews. This pass makes the queue read as a real map workflow from the first glance without disturbing the main publish stage.
Rollback target: working tree before this change
Notes: Verification passed with `dashboardCourseMapRailLeaflet.smoke.test.js`, `dashboardCourseMapPreview.smoke.test.js`, eslint, Vite build, and frontend runtime sync.

### Version: DV-2026-04-20-02
Date: 2026-04-20
Surface: Today's Run / ACWR load warning callout
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/utils/todayRunAcwrInsight.js`, `frontend/src/utils/todayRunAcwrInsight.test.js`, `frontend/src/utils/todayRunAcwrNarrative.smoke.test.js`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Added a dedicated ACWR load-warning callout beneath the rationale block on `/today-run`, tied to a shared `describeAcwrState` helper so the coaching strip and the new warning surface use the same zone thresholds. The runner now sees the live ACWR number, the safe build zone, and coach-style plain-language guidance instead of only a ratio plus a short strip label.
Why: The previous Today's Run surface already exposed the ACWR number and zone color, but it still made the runner interpret what the ratio meant for today's decision. This pass turns the load signal into a direct coaching answer inside the first screenful.
Rollback target: working tree before this change
Notes: Verification passed with `todayRunAcwrInsight.test.js`, `todayRunAcwrNarrative.smoke.test.js`, eslint, Vite build, and frontend runtime sync.

### Version: DV-2026-04-19-13
Date: 2026-04-19
Surface: Admin command topbar on `/dashboard` and child admin routes
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/utils/dashboardTopbarNav.js`, `frontend/src/utils/dashboardTopbarNav.test.js`, `DESIGN_VERSIONS.md`
What changed: The admin command topbar now reflects the current `/dashboard/*` route instead of always showing the same hardcoded trio. The root overview route shows only the Dashboard entry next to the Hermes wordmark, while child routes show Dashboard plus the current section label with the active item highlighted. The dedicated admin notification icon button was also removed from the topbar so the shell reads more like a route-aware breadcrumb bar.
Why: The previous shell kept showing `Dashboard / Fleet / Events` even when the operator was on a different admin page, which made the topbar feel disconnected from the current route. This pass makes the nav state truthful to the page the user is actually on.
Rollback target: `DV-2026-04-19-12`
Notes: This is a shell-navigation refinement only. It preserves the existing route-driven admin portal, settings access, and avatar/logout action while tightening the visible topbar hierarchy.

### Version: DV-2026-04-19-12
Date: 2026-04-19
Surface: Admin audit terminal on `/dashboard/audit`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/dashboardAuditTerminal.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/dashboard/audit` from a plain filter row plus generic table into a reference-driven Sync Pipeline Terminal. The page now opens with a dark operations hero, a 4-card telemetry strip, a dedicated event-terminal shell with live-log pills, trace search, status badges, and terminal-style rows, plus lower drill-down cards for failure clusters and archive exploration. The redesign stays inside the existing Hermes admin shell and keeps the real audit data source intact.
Why: The old audit route still read like a generic admin table and did not match the stronger terminal-style operator reference the user provided. This pass gives audit the same deliberate command-center identity as the rest of the admin portal.
Rollback target: `DV-2026-04-19-11`
Notes: This is a frontend-only audit-surface redesign. It preserves the current route, query state, pagination contract, and real audit payload fields while changing hierarchy and visual treatment.

### Version: DV-2026-04-19-11
Date: 2026-04-19
Surface: Admin portal light-mode treatment across `/dashboard` overview, users, course maps, shoes, jobs, audit, and settings
Files: `frontend/src/styles/style.css`, `frontend/src/pages/dashboardAdminLightMode.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a real light-mode palette for the full admin portal instead of leaving the route-driven operator shell visually anchored to the midnight treatment. The admin sidebar now uses a vellum editorial shell, the overview hero shifts to a bright kinetic HUD, the course-map track hub and its footer panels render as layered light surfaces, the shoe moderation workbench adopts light queue/repository treatments, and the new settings hero now reads as a light control-room surface instead of a dark holdover.
Why: After the route split, the admin portal still looked effectively dark-first in light theme, especially in the shell chrome and the heavier course-map and shoe workbench sections. The request was to make every admin page actually honor light mode.
Rollback target: `DV-2026-04-19-10`
Notes: This is a light-mode styling pass only. It preserves the route structure, queue behavior, course-map workflow, and settings controls while giving the admin shell a mode-correct visual baseline.

### Version: DV-2026-04-19-10
Date: 2026-04-19
Surface: Admin dashboard shell and operator settings routing on `/dashboard`
Files: `frontend/src/App.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/dashboardRouteSections.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Converted the admin dashboard from a tab-only surface into a route-driven operator shell. `/dashboard` now stays the true overview landing page while the shell exposes dedicated paths for users, course maps, shoes, jobs, audit, and the new `/dashboard/settings` page. The settings icon now routes to a first-class operator preferences page for language, theme, and sign-out, while the existing left rail, top bar, course-map track hub, and shoe workbench remain inside the same kinetic admin shell.
Why: The prior admin shell had the right visual identity, but key operator areas still lived as local tab state with no durable URLs, and settings had no real home inside the dashboard experience.
Rollback target: `DV-2026-04-19-09`
Notes: This pass preserves the existing workbench behavior and queue flows while making the admin shell navigable by route and giving operator preferences a dedicated page instead of a hidden icon jump.

### Version: DV-2026-04-19-09
Date: 2026-04-19
Surface: Admin race-track hub on `/dashboard` course-map workspace
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Extended the `赛事赛道图` workspace so the course-map tab now claims more of the available admin canvas on wide screens. The course-map tab gets its own widened main-shell modifier, the left rail stays intact, the publish/evidence strip expands horizontally, and the lower right workspace now uses a split row where the operations band and preview-review shell sit side by side instead of leaving a large empty right-side area.
Why: The previous track-hub pass improved hierarchy but still tapered early inside the shared admin shell, leaving visible unused space on the right on large screens.
Rollback target: `DV-2026-04-19-08`
Notes: This is a width-and-layout refinement only. It preserves the same course-map actions, preview logic, and admin shell while giving the course-map tab a wider desktop footprint than the other admin tabs.

### Version: DV-2026-04-19-08
Date: 2026-04-19
Surface: Admin race-track hub on `/dashboard` course-map workspace
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Tightened the `赛事赛道图` workspace into a darker, more literal Race Track Hub remap while keeping the Hermes admin shell and left course rail intact. The course queue now sits inside explicit sidebar panels, the dominant map stage now exposes a structured telemetry footer, and the publish decision, evidence cards, operations band, and pending-vs-live comparison now read as one continuous right-side operator canvas instead of separate generic admin blocks.
Why: The prior course-map redesign had the right pieces, but it still felt like multiple admin modules placed next to each other. This pass brings the workspace materially closer to the supplied reference without sacrificing the real upload, scan, reanalyze, pipeline, and publish flows.
Rollback target: `DV-2026-04-19-07`
Notes: This pass also localizes the new track-hub labels in both zh-CN and en, derives the visible alignment-quality grade from confidence instead of using a fixed claim, and keeps `AdminCourseMapPreview` as the live map/overlay engine inside the redesigned stage.

### Version: DV-2026-04-19-07
Date: 2026-04-19
Surface: Admin race-track hub on `/dashboard` course-map workspace
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardCourseHubRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the `赛事赛道图` / course-map tab into a darker reference-shaped Race Track Hub with a new telemetry hero, a left-side course-management column, and a dominant right-side course-intelligence map stage. The underlying Hermes course-map publish workflow remains intact inside the redesigned stage through the same pending/live preview handling, recommendation engine, evidence stack, and operations band.
Why: The previous course-map tab preserved the publish workflow but still read like a generic admin workbench. This pass pulls it much closer to the supplied “Admin Race Track Hub” reference while keeping the real scan/upload/reanalyze/publish behaviors live.
Rollback target: `DV-2026-04-19-06`
Notes: This is a course-map workspace redesign only. It preserves `AdminCourseMapPreview`, confidence/trust logic, PDF/image upload support, and the existing publish controls rather than replacing them with static mock content.

### Version: DV-2026-04-19-06
Date: 2026-04-19
Surface: Admin dashboard overview composition on `/dashboard`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardKineticShell.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Tightened the admin overview toward the supplied kinetic admin reference by turning the overview tab into a real single-page command canvas: a performance HUD top fold, a users-and-tracks row, and a gear-verification plus audit-feed row. The older intermediate overview bento now stays visually hidden, while the deeper course-map publish desk and shoe workbench remain available behind the same admin shell.
Why: The prior pass established the right shell and workbench direction, but the visible overview still read like a hybrid portal rather than a near-direct transplant of the provided dashboard composition.
Rollback target: `DV-2026-04-19-05`
Notes: This pass preserves admin routing, auth, course-map review logic, and shoe-image moderation behavior. It is a hierarchy/layout tightening pass on the overview surface rather than a backend workflow rewrite.

### Version: DV-2026-04-19-05
Date: 2026-04-19
Surface: Admin dashboard shell, overview HUD, and shoe review workbench on `/dashboard`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardKineticShell.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the admin dashboard around a near-direct transplant of the supplied kinetic admin reference by adding a dark editorial sidebar shell, a stronger overview HUD plus bento support panels, and a first-class shoe review workbench with queue rail and focused compare stage. The existing course-map publish desk and Hermes review/publish workflows remain intact, while the older flat overview blocks are visually demoted.
Why: The previous admin dashboard had the right operator features but still read like a generic mixed-mode utility page. This pass brings the shell and top-fold hierarchy closer to the approved reference without sacrificing the real course-map and shoe workbench behaviors Hermes depends on.
Rollback target: `DV-2026-04-18-02`
Notes: This is an admin-only surface redesign. It preserves route/auth behavior, the existing course-map publish canvas and evidence stack, and the image-review modal flows while giving `/dashboard` a more deliberate operator-desk identity.

### Version: DV-2026-04-19-02
Date: 2026-04-19
Surface: Race Detail full-width map stage on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the lower race-detail section from a split map/readiness row into a dominant full-width Leaflet world-map stage with a lightweight floating HUD, moved readiness below the map, and reduced the AI visualization to the georeferenced route line plus start/finish markers instead of any scanned-image treatment.
Why: The previous lower block no longer read as a trustworthy map-first surface and had drifted across multiple fallback- and overlay-oriented layouts. This pass restores clear interactive map ownership and matches the approved route-only redesign.
Rollback target: `DV-2026-04-19-01`
Notes: The hero remains editorial, the course/elevation card remains separate, and the runner-facing map stage now uses route trust to decide whether the AI-scanned geometry is shown on the live Leaflet world map.

### Version: DV-2026-04-19-01
Date: 2026-04-19
Surface: Race Detail course-map card on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the DOM-based static tile/image fallback from the lower race-detail map card so the card is owned entirely by the live Leaflet surface. Route framing, zoom, pan, and city fallback now all happen inside the Leaflet stage itself instead of visually dropping back to a static image layer.
Why: The user explicitly wanted a real Leaflet map they could zoom and drag around, not a lower map card that could still present itself as a static image fallback.
Rollback target: `DV-2026-04-18-49`
Notes: This is an interaction correction on the existing lower map card, not a hero or data-flow redesign. The hero remains editorial while the lower card stays the dedicated interactive map stage.

### Version: DV-2026-04-18-49
Date: 2026-04-18
Surface: Race Detail course-map card on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the interactive Leaflet route map back out of the hero/background and into the lower race-detail map card below the main hero and course section. The hero returns to the editorial race image treatment, while the lower map card keeps the live Leaflet stage with zoom, pan, route polyline, trust-gated course-image overlay, and static-tile fallback during tile paint.
Why: The previous version made the whole hero a map surface, but the requested layout was to keep the map as a dedicated card lower on the page while still behaving like a real Leaflet map the runner can move around.
Rollback target: `DV-2026-04-18-48`
Notes: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `node frontend/src/utils/raceDetailMapTrust.test.js`, `cd frontend && npm run lint`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/RacesDetail.jsx||frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js||frontend/src/styles/style.css"` all passed, and the refreshed frontend bundle synced into the live Spring-served static output.

### Version: DV-2026-04-18-48
Date: 2026-04-18
Surface: Race Detail hero background on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Promoted the Leaflet race map from the lower course-map card into the hero/background stage of the page itself. The top fold now uses the real Leaflet world map as the visual foundation, keeps the route and trusted course-image overlay georeferenced inside that hero map, lets the content chrome float above it without blocking drag/zoom across the whole stage, and collapses the lower layout to a single readiness rail instead of a second duplicate map block.
Why: The previous round improved the lower map card, but it still left the page background reading like a static hero image. The user wanted the race-detail page itself to feel like a movable world map while keeping the route locked to the correct geography.
Rollback target: `DV-2026-04-18-47`
Notes: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `node frontend/src/utils/raceDetailMapTrust.test.js`, `cd frontend && npm run lint`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/RacesDetail.jsx||frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js||frontend/src/styles/style.css"` all passed, and the refreshed frontend bundle synced into the live Spring-served static output.

### Version: DV-2026-04-18-47
Date: 2026-04-18
Surface: Race Detail interactive map stage on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Kept the map-first Leaflet card but changed its interaction baseline so the live Leaflet stage becomes visible as soon as it mounts, the static tile fallback stays underneath only while tiles finish painting, and the route viewport auto-frames once instead of repeatedly snapping the user back after mount. The trusted route polyline and aligned course-image overlay still stay georeferenced in the same map stack, so runners can pan and zoom around the world map without the route drifting out of place.
Why: The user wanted the race-detail background to behave like a real movable world map rather than feeling like a fixed preview. The previous version could still read as static because the Leaflet layer stayed visually hidden until tile paint and its layout helper could re-apply route framing after mount.
Rollback target: `DV-2026-04-18-46`
Notes: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `node frontend/src/utils/raceDetailMapTrust.test.js`, `cd frontend && npm run lint`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/RacesDetail.jsx||frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js||frontend/src/styles/style.css"` all passed, and the refreshed frontend bundle synced into the live Spring-served static output.

### Version: DV-2026-04-18-46
Date: 2026-04-18
Surface: Race Detail map stage on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the first race-detail map grid into a true Leaflet-first stage. The centered poster-style fallback image was removed from the card, the basemap now owns the full surface, trusted route overlays stay embedded inside the map layer, image-only course-map states render as a subdued top-layer visual veil over the map instead of a separate poster block, and the title/source/CTA chrome now lives in compact floating HUD panels at the corners.
Why: The previous card still read like a poster composition sitting on top of a map. The user wanted the first grid to feel like the provided real-map reference, where the course route is embedded in the Leaflet stage itself rather than presented as a detached promo panel.
Rollback target: `working tree before this change`
Notes: `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `node frontend/src/utils/raceDetailMapTrust.test.js`, `cd frontend && npm run lint`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-frontend-runtime-sync.mjs --files "frontend/src/pages/RacesDetail.jsx||frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js||frontend/src/styles/style.css"` all passed, and the refreshed frontend bundle synced into the live Spring-served static output.

### Version: DV-2026-04-16-45
Date: 2026-04-16
Surface: Admin dashboard race-course-map upload workflow on `/dashboard`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/i18n/translations.js`, `backend/src/main/java/com/hermes/backend/SafeUrlValidator.java`, `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`, `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Refined the admin course-map review workspace so operators can upload local image or PDF source files directly from the dashboard, get clearer guidance about what makes a map AI-scannable, and keep the preview path aligned with the same stored route-overlay contract used by the public race-detail flow. Local PDF uploads now normalize into a rasterized preview before AI alignment, while the workspace copy now explicitly steers admins toward one clean course-map page instead of poster-style artwork.
Why: The admin tooling already had pending/live review and AI alignment, but the upload affordance was still image-biased and too easy to misuse with decorative assets. The user wanted admins to upload course maps more easily and make sure the preview path stays useful for AI scanning instead of only looking polished.
Rollback target: `working tree before this change`
Notes: `cd frontend && npm run lint`, `node frontend/src/pages/dashboardCourseMapPreview.smoke.test.js`, `cd backend && ./mvnw -q -Dtest=RaceCourseMapServiceTests test`, `cd backend && ./mvnw -q -DskipTests compile`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-backend-runtime-sync.mjs --files "backend/src/main/java/com/hermes/backend/RaceCourseMapService.java||backend/src/main/java/com/hermes/backend/SafeUrlValidator.java"` all passed, and the synced frontend bundle refreshed the Spring-served static output while the runtime proof helper returned `PASS`.

### Version: DV-2026-04-16-44
Date: 2026-04-16
Surface: Marathon-target adaptation on `/schedule`
Files: `frontend/src/pages/Schedule.jsx`, `frontend/src/styles/style.css`, `frontend/src/utils/scheduleMarathonBlock.js`, `frontend/src/utils/scheduleMarathonBlock.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: When `coachState.activeBlock` is present, `/schedule` now shifts the hero into an explicit race-build read with target distance, countdown, and race-day chips. The weekly strip now marks the long-run day as the block anchor, the planned-route card calls out the target workout distance for the block, and the coach rail now names the current build week, long-run anchor, and race target in a compact focus grid. When no active block exists, the page keeps its prior weekly-plan language and structure.
Why: The user wanted marathon plans to feel unmistakable on `/schedule` without a broad redesign. The previous surface had the data, but it buried the race target inside generic weekly-plan copy and left the long-run anchor visually underplayed.
Rollback target: `DV-2026-04-16-43`
Notes: `node frontend/src/utils/scheduleMarathonBlock.test.js`, `cd frontend && npm run lint`, and `cd frontend && node scripts/run-vite-build.mjs` all passed, and the synced frontend bundle refreshed the Spring-served static output.

### Version: DV-2026-04-16-43
Date: 2026-04-16
Surface: Planned-route card fallback on `/schedule`
Files: `frontend/src/pages/Schedule.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: The planned-route card on `/schedule` now has an explicit no-route fallback branch instead of rendering the normal map-preview shell with nothing inside it. When Hermes has a real `routeRecommendation.preview`, the card still renders the same SVG preview state. When it does not, the card now switches into a deliberate fallback layout with route badges, an honest “Waiting for route history” headline, and a compact supporting explanation so the surface still reads like coach-owned planning rather than a broken grid cell.
Why: The user reported that the route grid on `/schedule` looked broken. The root cause was structural, not cosmetic: the card had no true empty state, so light mode exposed a large pale blank stage whenever preview data was absent.
Rollback target: `DV-2026-04-16-42`
Notes: `cd frontend && npm run lint` and `cd frontend && node scripts/run-vite-build.mjs` both passed, and the updated bundle synced into the Spring-served static output.

### Version: DV-2026-04-16-42
Date: 2026-04-16
Surface: Garmin Connect lane on `/settings`
Files: `frontend/src/components/SettingsAtlasLayout.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the Garmin Connect area in the Settings connectivity column from a generic service row into a premium import lane. The main Garmin surface now carries live state, import scope, and trust framing, manual file import is demoted into a quieter fallback tile instead of a competing dashed card, and the Garmin modal now uses a two-part editorial composition with dual-mode tonal layering and clearer status emphasis while preserving the existing credentials, limit selector, progress messaging, and manual-import escape hatch.
Why: The previous Garmin UI was the weakest truth surface on the page: it showed static copy, duplicated actions across equal-weight utility blocks, and used border-led modal containment that didn’t match Hermes’ Kinetic Editorial system. The redesign makes Garmin import feel more trustworthy and more intentional without changing the real import behavior.
Rollback target: `DV-2026-04-16-41`
Notes: `cd frontend && npm run lint` and `cd frontend && node scripts/run-vite-build.mjs` passed, and the build synced a fresh frontend bundle into the Spring-served static output.

### Version: DV-2026-04-16-41
Date: 2026-04-16
Surface: Distance-aware planned-route intelligence on `/schedule`
Files: `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`, `backend/src/test/java/com/hermes/backend/AutomatedCoachServiceTests.java`, `backend/src/test/java/com/hermes/backend/CoachControllerTests.java`, `frontend/src/pages/Schedule.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Moved the planned-route card decision out of the frontend heatmap helper and into the coach payload Hermes already loads for `/schedule`. The route card now chooses its target mileage from the `is-today` planned workout first, falls back to the next upcoming planned workout when today has no usable distance, and recommends the surrounding area from recent runs whose distances are closest to that target. The card still renders the same compact route preview, but its secondary label now explains whether Hermes found a direct distance match, a near match, or only a lower-confidence best recent area.
Why: The user wanted the route card to feel like real coach logic rather than a generic most-used-zone guess. Tying the card to planned mileage plus recent route evidence makes the recommendation more believable and more useful for the weekly planning surface.
Rollback target: `DV-2026-04-16-40`
Notes: `cd backend && .\mvnw test "-Dtest=AutomatedCoachServiceTests,CoachControllerTests"`, `cd backend && .\mvnw -q -DskipTests compile`, `cd frontend && npm run lint`, `cd frontend && node scripts/run-vite-build.mjs`, and `node .tools/verify-backend-runtime-sync.mjs --files "backend/src/main/java/com/hermes/backend/AutomatedCoachService.java||backend/src/main/java/com/hermes/backend/CoachController.java"` all passed.

### Version: DV-2026-04-16-40
Date: 2026-04-16
Surface: Shared runner-shell notification popover
Files: `frontend/src/styles/style.css`, `frontend/src/components/topbarNotifications.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a dedicated Aerodynamic Gallery light-theme contrast layer for the shared runner-shell notification popover. The tray now keeps the same compact glass structure, but its heading copy, card copy, card surfaces, close chip, and CTA pill no longer inherit the dark-shell text palette when the signed-in shell is in light mode, which restores readable Chinese and English notification content.
Why: The user reported that the `runner-shell-notification-popover is-zh` content was effectively invisible. The root cause was not missing Chinese copy but shared pale text colors sitting on the new vellum light-mode tray background.
Rollback target: `DV-2026-04-16-39`
Notes: `node frontend/src/components/topbarNotifications.smoke.test.js`, `cd frontend && npm run lint`, and `cd frontend && npm run build` all passed, and the fresh frontend bundle synced into the Spring-served static output.

### Version: DV-2026-04-16-39
Date: 2026-04-16
Surface: Weather Engine page on `/weather-engine`
Files: `frontend/src/pages/WeatherEngine.jsx`, `frontend/src/components/AppIcon.jsx`, `frontend/src/App.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/TodayRun.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/styles/style.css`, `backend/src/main/java/com/hermes/backend/SpaForwardingController.java`, `DESIGN_VERSIONS.md`
What changed: Reintroduced the old temperature, weather, and Hermes heat-adaptation engine as a dedicated runner-shell page. The new route combines live Open-Meteo current and hourly weather for the runner's latest route location with the existing Hermes acclimatization engine from `/api/v1/weather/context`, and it adds a dedicated weather-engine slot in the runner shell with its own `thermostat` icon for discovery from the main runner surfaces.
Why: The old weather and heat-readiness system had useful signal but was buried inside `TodayRun`. The new website needed that capability pulled forward into its own first-class page while staying inside the runner-shell navigation model.
Rollback target: `DV-2026-04-16-38`
Notes: Pending frontend lint/build and live static-bundle sync after the new route/style wiring.

### Version: DV-2026-04-16-38
Date: 2026-04-16
Surface: Stamina grid integration redesign on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`, `TASKS.md`
What changed: Removed the standalone circular `体力值 / Stamina` gadget treatment from the lower profile grid and rebuilt that slot as a first-class Hermes feature card. The module now keeps the same backend-driven stamina score, recovery ceiling, target pace, and heart-rate guidance, but expresses them through a shared editorial card language: a score band, integrated recovery sidecar, shared progress rail, and compact data cells that match the surrounding workout/load/session cards.
Why: The previous stamina card still felt like an inserted object rather than part of the grid. The user wanted the functionality preserved but the design absorbed into the `/profile` card system and aligned more closely with `design.md`.
Rollback target: `DV-2026-04-16-37`
Notes: `cd frontend && npm run lint` passed, and `cd frontend && node scripts/run-vite-build.mjs` passed while syncing a fresh live static bundle into the backend runtime directories.

### Version: DV-2026-04-16-37
Date: 2026-04-16
Surface: Integrated stamina card refinement on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Refined the new `体力值 / Stamina` presentation so it no longer behaves like an oversized standalone badge. The stamina module is still circular, but it now sits inside the feature grid as a more compact, editorial Hermes card with tighter proportions, calmer spacing, and better visual balance against the neighboring workout/load/session cards.
Why: The previous implementation matched the raw reference too literally and felt too large for the surrounding grid, which made the `/profile` feature section feel uneven.
Rollback target: `DV-2026-04-16-36`
Notes: Frontend lint and build both passed, and the updated bundle synced into the Spring-served static output.

### Version: DV-2026-04-16-36
Date: 2026-04-16
Surface: Backend-driven `体力值 / Stamina` module on `/profile`
Files: `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`, `backend/src/main/java/com/hermes/backend/CoachController.java`, `backend/src/test/java/com/hermes/backend/AutomatedCoachServiceTests.java`, `backend/src/test/java/com/hermes/backend/CoachControllerTests.java`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the old text-heavy readiness feature card with a circular `体力值 / Stamina` orb modeled on the provided reference. The card now shows current stamina %, recovery ceiling, target pace, and heart-rate guidance inside a bold circular module while keeping the explanatory coach copy below it. The UI is driven by a new backend stamina DTO calculated from coach state and today's planned workout rather than frontend-only heuristics.
Why: The user wanted a visual `体力值` card on `/profile` that looks like the reference image and uses a real backend algorithm instead of a decorative frontend approximation.
Rollback target: `DV-2026-04-15-35`
Notes: Focused backend tests passed, backend compile passed, frontend lint/build passed, and backend runtime sync proof returned `PASS` with `http://localhost:8080` returning `200`.

### Version: DV-2026-04-15-35
Date: 2026-04-15
Surface: Daily-point Progression Atlas refinement on `/profile`
Files: `frontend/src/utils/progressionAtlas.js`, `frontend/src/utils/progressionAtlas.smoke.test.js`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Refined the Progression Atlas data density so the chart now keeps daily cumulative buckets for every timeframe, including `year` and `total`, instead of collapsing longer windows into monthly checkpoints. The section title was also localized from the placeholder English label into runner-facing product copy.
Why: The user wanted more visible daily progression points rather than monthly aggregation, and wanted the atlas heading translated instead of left as “Progression Atlas”.
Rollback target: `DV-2026-04-15-33`
Notes: Frontend smoke/lint/build and local runtime health should be rerun after this refinement.

### Version: DV-2026-04-15-33
Date: 2026-04-15
Surface: Interactive Progression Atlas refinement on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/utils/progressionAtlas.js`, `frontend/src/utils/progressionAtlas.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Refined the `Progression Atlas` chart to behave more like the approved running reference instead of a static callout graphic. The cumulative curve now renders as a smoothed editorial path over the same real progression buckets, the active point uses a cleaner halo/core treatment with a vertical guide rail, and the tooltip now tracks the nearest real data point as the user moves across the chart. The interaction still preserves the existing timeframe switcher, cumulative headline, supporting stat row, and recent-session drill-down lane.
Why: The user wanted the atlas to feel closer to the reference by making the chart explorable, the endpoint marker more intentional, and the progression curve smoother and more detailed without inventing fake samples or leaving the Hermes `design.md` system.
Rollback target: `DV-2026-04-15-31`
Notes: Frontend lint passed, the shared progression smoke test passed, the frontend bundle synced into the Spring-served static output, and `http://localhost:8080` returned `200`.

### Version: DV-2026-04-15-32
Date: 2026-04-15
Surface: Admin dashboard global asset-review redesign on `/dashboard`
Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapAsset.java`, `backend/src/main/java/com/hermes/backend/RaceCourseMapAssetRepository.java`, `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`, `backend/src/main/java/com/hermes/backend/ShoeImageAsset.java`, `backend/src/main/java/com/hermes/backend/ShoeImageAssetRepository.java`, `backend/src/main/java/com/hermes/backend/ShoeImageAssetService.java`, `backend/src/main/java/com/hermes/backend/AdminPortalController.java`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the admin dashboard around one shared global asset-review model. The page now includes a dedicated `Race Course Maps` tab with an operational grid and pending-vs-live comparison workspace, and the existing shoes admin flow now stages pending previews before publishing globally instead of writing images straight to live. Race course-map scans/uploads are stored globally per race, shoe images are staged globally per model identity, and both surfaces now follow the same `pending preview -> accept -> live` workflow.
Why: The user wanted globally stored race course-map images and alignments, admin-controlled publish decisions, a dedicated dashboard tab for race course maps, and the same review/publish logic applied to shoe image uploads so global operator actions stay consistent.
Rollback target: `DV-2026-04-15-30`
Notes: Backend targeted tests passed, backend compile passed, frontend lint/build passed, the frontend bundle synced into the Spring-served static output, and backend runtime sync proof returned `PASS` with `http://localhost:8080` returning `200`.

### Version: DV-2026-04-15-31
Date: 2026-04-15
Surface: Progression Atlas on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a new full-width `Progression Atlas` section between the upper profile dashboard cards and the lower feature grid. The section follows the approved reference structure with a day/week/month/year/total switcher, one large cumulative distance readout, a supporting stat row for elevation gain, average pace, moving time, and session count, a cumulative progression line chart, and a recent-session lane. All numbers come from the existing synced run history already loaded on `/profile`, and the section keeps direct drill-down into real run detail routes.
Why: The user wanted `/profile` to show the runner's progression more explicitly, using the provided screenshot as a structural reference while staying inside the Hermes `design.md` Kinetic Editorial system rather than falling back to a generic boxed dashboard card.
Rollback target: `working tree before this change`
Notes: Frontend lint passed with one unrelated existing warning in `frontend/src/pages/RacesDetail.jsx` about a missing `useEffect` dependency. `node scripts/run-vite-build.mjs` passed and synced the updated frontend bundle into the Spring-served static output.

### Version: DV-2026-04-15-30
Date: 2026-04-15
Surface: AI-aligned course-map and real-world route stage on `/races/details/:raceId`
Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`, `backend/src/main/java/com/hermes/backend/RaceController.java`, `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`, `backend/src/test/java/com/hermes/backend/RaceControllerTests.java`, `frontend/src/pages/RacesDetail.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the old race-detail city-context-only map and chart-only elevation fallback with a new two-stage route intelligence flow. Hermes can now search for likely course-map images, use AI to align a plausible real-world route plus overlay bounds, draw that route on Leaflet, optionally embed the detected course-map image over the real map, and sample elevation from the aligned route when confidence is high enough. The page copy now explicitly labels this as AI-aligned approximation rather than verified official GPS, and it intentionally falls back to the older city-context map when the backend cannot align the course-map confidently.
Why: The user wanted the course-map search engine to find real course maps, place them onto the real world map, and derive elevation from the aligned route instead of stopping at a decorative city map or a separate chart heuristic.
Rollback target: `DV-2026-04-14-29`
Notes: Targeted backend tests passed, backend compile passed, frontend lint/build passed, the frontend bundle synced into the Spring-served static output, and backend runtime sync proof returned `PASS` with `http://localhost:8080` returning `200`.

### Version: DV-2026-04-14-29
Date: 2026-04-14
Surface: Official elevation-chart interpretation on `/races/details/:raceId`
Files: `backend/src/main/java/com/hermes/backend/RaceElevationProfileService.java`, `backend/src/main/java/com/hermes/backend/RaceController.java`, `frontend/src/pages/RacesDetail.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the temporary “embed the sourced course image directly” behavior with a real backend interpretation flow. When Hermes finds an official elevation image, the backend now downloads it, extracts a smoothed set of profile samples from the chart silhouette, returns those samples through `/api/races/elevation-profile`, and the race detail page uses them to render the native Hermes `赛道画像` design. If Hermes cannot extract an official profile, the panel now stays in the explicit “no official elevation map yet” state instead of falling back to the older synthetic SVG estimate.
Why: The user wanted the official chart to drive the Hermes-native course-profile design, not to replace it with a raw embedded image or a guessed fallback profile.
Rollback target: `DV-2026-04-14-28`
Notes: Backend compile passed, backend runtime sync proof returned `PASS`, frontend bundle synced into the Spring-served static output, and `http://localhost:8080` plus `/races` returned `200`.

### Version: DV-2026-04-14-28
Date: 2026-04-14
Surface: Embedded sourced course profile on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Updated the `赛道画像` stage so when Hermes finds a sourced course-profile image for a race, that image is embedded directly into the elevation-chart panel instead of being left as a footer link while the page keeps showing the synthetic SVG profile. The synthetic interactive chart now remains the fallback only for races without a sourced course image.
Why: Once a real course profile is available, continuing to show the estimated SVG as the primary visual weakens trust and hides the more authoritative course artifact the system already found.
Rollback target: `DV-2026-04-14-27`
Notes: Frontend bundle synced into the Spring-served static output and `http://localhost:8080/races` returned `200`.

### Version: DV-2026-04-14-27
Date: 2026-04-14
Surface: Real route-map stage on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the `赛道路线` card into a true map stage backed by live Leaflet tiles instead of the old hero-image backdrop. Every city-marathon detail page now renders a real map centered on the race city, and races with known route points such as Tokyo also draw an overlaid course polyline with start and finish markers rather than decorative placeholder strokes.
Why: The previous card looked premium but was fundamentally misleading because it presented a poster image and fake route lines as if they were a real course map.
Rollback target: `DV-2026-04-14-26`
Notes: Frontend bundle synced into the Spring-served static output and `http://localhost:8080/races` returned `200`. `npm run lint` remains blocked by the same pre-existing `translations.js`, `Shoes.jsx`, `Vo2MaxDetail.jsx`, and `Heatmap.jsx` issues.

### Version: DV-2026-04-14-26
Date: 2026-04-14
Surface: Tokyo Marathon route trace on `/races/details/tokyo-marathon`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the `赛道路线` card's decorative `race-detail-map-line` placeholder bars with a real SVG route trace for Tokyo Marathon. The card now draws a continuous course path with start, finish, and key turning markers from route points derived from the official Tokyo Marathon course map instead of showing generic diagonal motion lines.
Why: The route card was visually polished but untrustworthy because the line work was fake on a page meant to help runners understand a real race course.
Rollback target: `DV-2026-04-14-25`
Notes: Source direction came from the official Tokyo Marathon course page and downloadable course map. Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/races` returned `200`.

### Version: DV-2026-04-14-25
Date: 2026-04-14
Surface: Admin dashboard control-center refresh on `/dashboard`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Refreshed the admin dashboard into a more coherent control-center surface by tightening the topbar and hero framing, strengthening the status strip and tab rail, upgrading the overview KPI and queue cards, and giving the quick-action lane a cleaner glass-card treatment. The same pass also neutralized the broken emoji action icons by styling the quick-action icon slots as proper dashboard glyphs instead of leaving mojibake text in the interface.
Why: The admin page still had the right operational tooling, but it read like mixed-generation utility panels and visibly broken icon text instead of a trustworthy Hermes operator surface.
Rollback target: `DV-2026-04-14-24`
Notes: Frontend bundle synced into the Spring-served static output and `http://localhost:8080/dashboard` returned `200`.

### Version: DV-2026-04-14-24
Date: 2026-04-14
Surface: Today Run editorial redesign on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the page around the stronger editorial `today-run-plan` layout already present in the design system: the route now opens with one action-first hero, compact status pills, a four-metric command strip, an integrated readiness panel, and the weather alert inside the hero stage instead of splitting those signals across multiple disconnected bands. The lower half now reads as two clear lanes: a workout blueprint card on the left and a coach-command rail on the right for reasoning, support metrics, readiness adjustment, shoe guidance, and next actions.
Why: The previous Today Run surface had the right live data, but the visual hierarchy was fragmented and read more like stacked utility panels than one decisive daily coach page.
Rollback target: `DV-2026-04-14-22`
Notes: Frontend bundle synced into the Spring-served static output. `npm run lint` remains blocked by the same pre-existing `translations.js`, `Shoes.jsx`, `Vo2MaxDetail.jsx`, and `Heatmap.jsx` issues.

### Version: DV-2026-04-14-23
Date: 2026-04-14
Surface: Coach-insight hero metric visibility on `/analysis/coach-insight`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Strengthened the light-mode surface treatment for the three-card metric stack in the coach-insight hero so the non-accent cards now render as readable vellum tiles with ambient lift instead of fading into the white hero stage. The active accent card stays coral-led, but the full grid now reads as one intentional command strip rather than one visible card plus two ghost panels.
Why: In light mode the right-side coach-insight metric grid was still using dark-theme translucency on two of the three tiles, which made the grid look missing even though the data was present.
Rollback target: `DV-2026-04-14-22`
Notes: Pending frontend bundle sync and local route verification for `/analysis/coach-insight`.

### Version: DV-2026-04-14-22
Date: 2026-04-14
Surface: Shared assigned-coach persona across runner coach cards
Files: `frontend/src/components/CoachIdentityBadge.jsx`, `frontend/src/utils/coachIdentity.js`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/RacesDetail.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/style.css`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Added a shared fake-person coach roster plus stable per-runner coach assignment, then threaded that avatar/name/role badge into the main Hermes coach surfaces so coach cards no longer feel anonymous or reuse the runner's own initials. The assigned coach now stays consistent for the same runner key across today-run, schedule, analysis coach cards, prediction, and race detail views.
Why: Hermes already had strong coach logic, but many of its coach panels still felt faceless. Giving each runner a consistent named coach persona makes the product read more like a real coaching relationship without changing any backend training logic.
Rollback target: `working tree before this change`
Notes: Frontend bundle synced successfully into the Spring-served static output. `http://localhost:8080/today-run`, `/schedule`, `/analysis`, and `/prediction/marathon` returned `200`; direct server hits to `/races/details/:raceId` still return `404` as an existing deep-link routing gap.

### Version: DV-2026-04-14-21
Date: 2026-04-14
Surface: Dark editorial marathon detail redesign on `/races/details/:raceId`
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the marathon detail route to follow the supplied Tokyo Marathon reference more closely: the hero is now a lower, full-bleed city stage with tighter countdown glass chips, the metrics and coach insight sit in one floating command strip, the course profile reads as a single dark stage, and the route-preview plus readiness modules now form a cleaner lower two-panel board with darker map treatment and a stronger readiness header.
Why: The previous marathon detail page had the right data blocks, but it still read like a wide desktop dashboard instead of the tighter cinematic race-board composition from the provided reference.
Rollback target: `DV-2026-04-14-20`
Notes: Frontend bundle synced locally; `npm run lint` remains blocked by the same pre-existing `translations.js`, `Shoes.jsx`, and `Vo2MaxDetail.jsx` issues. Direct deep-link verification at `/races/details/tokyo-marathon` still returns `404` in the local Spring runtime, so this round is verified at the synced bundle level rather than route-level direct refresh.

### Version: DV-2026-04-14-20
Date: 2026-04-14
Surface: Admin dashboard shoe management on `/dashboard`
Files: `backend/src/main/java/com/hermes/backend/AdminPortalController.java`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added real admin-side shoe lifecycle support to the dashboard shoes tab by introducing `POST /api/admin/shoes` and `DELETE /api/admin/shoes/{id}` on the backend, then wiring a new runner-targeted add-shoe modal into the dashboard UI. Admins can now create a shoe for a specific runner with brand/model metadata, optional mileage fields, primary flag, and either a pasted image URL or uploaded image file preview, while the existing permanent-delete action now points at a real admin delete endpoint.
Why: The admin dashboard already exposed shoe cards, image review, and a delete button, but shoe creation was missing entirely and deletion was only a frontend affordance without a matching backend contract, which made the operator surface incomplete and misleading.
Rollback target: `DV-2026-04-14-19`
Notes: Backend compile plus runtime sync proof passed, frontend bundle synced locally, and `http://localhost:8080/admin` returned `200`; `npm run lint` is still blocked by the same pre-existing `translations.js`, `Shoes.jsx`, and `Vo2MaxDetail.jsx` issues.

### Version: DV-2026-04-14-19
Date: 2026-04-14
Surface: Light-mode marathon drill-down on `/races/details/:raceId`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a dedicated Aerodynamic Gallery light/high-contrast-light layer for the cinematic marathon detail route so the hero, countdown glass, stat strip, coach card, course profile, route preview, and readiness checklist now translate into vellum-style light surfaces instead of staying as a dark-only island inside the shared light shell.
Why: The new race detail page already had the right event-story structure, but in light mode it still read as a split-theme mismatch where the shell changed and the page-local cards stayed charcoal.
Rollback target: `DV-2026-04-14-17`
Notes: Frontend bundle synced locally; `npm run lint` remains blocked by the same pre-existing duplicate-key issues in `translations.js`, plus existing `Shoes.jsx` and `Vo2MaxDetail.jsx` errors.

### Version: DV-2026-04-14-18
Date: 2026-04-14
Surface: Injury-risk intensity split alignment on `/analysis/injury-risk`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the injury-risk route's intensity metric card so it now uses the same three-way `easy / moderate / hard` summary as the analysis overview, including the green/yellow/red distribution bar and matching share labels, instead of the older easy-vs-hard binary ratio.
Why: The main analysis page and dedicated intensity route already expose the true three-bucket polarized split, so leaving the injury-risk metric on a two-part ratio made that page inconsistent and misleading.
Rollback target: `DV-2026-04-14-17`
Notes: Pending frontend bundle sync and local route verification for `/analysis/injury-risk`.

### Version: DV-2026-04-14-17
Date: 2026-04-14
Surface: Marathon editorial drill-down on `/races/details/:raceId`
Files: `frontend/src/pages/Races.jsx`, `frontend/src/pages/RacesDetail.jsx`, `frontend/src/utils/raceIntel.js`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/App.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the old race-intel modal with a dedicated marathon detail route opened by clicking the discovery image, then redesigned that route around a cinematic dark editorial layout: oversized hero with countdown blocks, bento stat strip, coach-insight panel, course-profile stage, route-preview card, and race-readiness checklist. The page still uses live Hermes prediction math and race catalog data, but now presents it as a reusable major-event detail surface instead of a plain text drill-down.
Why: The earlier race detail implementation exposed the right facts but not the premium event-story hierarchy the user wanted, and it did not match the supplied reference’s “hero + bento + course stage + readiness” structure.
Rollback target: `working tree before this change`
Notes: Frontend bundle synced locally; `npm run lint` remains blocked by pre-existing duplicate-key issues in `translations.js` plus existing `Shoes.jsx` and `Vo2MaxDetail.jsx` errors.

### Version: DV-2026-04-14-16
Date: 2026-04-14
Surface: Injury-risk trend tooltip tracking on `/analysis/injury-risk`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rewired the injury-risk cinematic chart tooltip so it now reads the active scrubber point's `x/y` coordinates and moves with the highlighted circle across the SVG graph, instead of staying pinned in one static position above the chart. The tooltip now also carries a small motion state and mobile fallback so the desktop graph tracks the point while narrow screens still keep the card readable.
Why: The previous tooltip updated its content during scrubbing but not its position, which made the chart feel disconnected and reduced trust in the hover state.
Rollback target: `DV-2026-04-14-15`
Notes: Pending frontend bundle sync and local route verification for `/analysis/injury-risk`.

### Version: DV-2026-04-14-15
Date: 2026-04-14
Surface: Heatmap frontend payload speed normalization on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a route-local speed normalization pass in the heatmap client so incoming point ratios are converted into percentile-ranked `visualSpeedRatio` values before coloring both the GPS dots and the heat layer. The map therefore still spreads visible points across the existing `slow / mid / fast / peak` legend even when the live payload arrives compressed toward the low end.
Why: The backend speed pipeline was improved, but the live route could still render almost entirely red when the current datasource returned tightly bunched low ratios, making the legend technically present but visually untrue.
Rollback target: `DV-2026-04-14-14`
Notes: Pending frontend bundle sync and local route verification for `/heatmap`.

### Version: DV-2026-04-14-14
Date: 2026-04-14
Surface: Marathon prediction tile-grid removal on `/prediction/marathon`
Files: `frontend/src/pages/PredictionDetail.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the marathon-only projection tile grid that surfaced 5K, 10K, and half-marathon cross-distance forecast cards from the `/prediction/marathon` branch, leaving the page focused on the marathon hero, judgment, trend, and evidence sections.
Why: The extra distance tiles diluted the single-distance marathon story and made the page feel busier than the user wanted.
Rollback target: `DV-2026-04-14-13`
Notes: Pending frontend bundle sync and local route verification for `/prediction/marathon`.

### Version: DV-2026-04-14-13
Date: 2026-04-14
Surface: Shared prediction-detail empty-record state on `/prediction/:distKey`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Extended the marathon-style no-record treatment across the shared prediction-detail branch so `/prediction/5k`, `/prediction/10k`, and `/prediction/half` now show `目前还没相关的跑步记录` in the actual-results and comparable-record empty states instead of generic helper copy, and added light-mode styling for the shared `prediction-detail-*` cards so those empty states and side-copy stay readable on the Aerodynamic Gallery vellum palette.
Why: The non-marathon prediction pages were still using the older shared detail surface, which left their empty record messaging less clear than marathon and too faint in light mode.
Rollback target: `DV-2026-04-14-12`
Notes: Pending frontend bundle sync and local route verification for `/prediction/5k`, `/prediction/10k`, and `/prediction/half`.

### Version: DV-2026-04-14-12
Date: 2026-04-14
Surface: Heatmap percentile speed-band normalization on `/heatmap`
Files: `backend/src/main/java/com/hermes/backend/ProfileController.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Kept the new same-run segment-speed calculation, but replaced the backend heatmap color normalization from fragile global `min/max` scaling to percentile-rank scaling before sending `speedRatio` to the client. This preserves the existing four-band legend while ensuring outlier spikes no longer force most GPS dots to remain in the lowest red band.
Why: After the initial segment-speed fix, live heatmap dots could still read almost entirely red when a few unusually fast samples stretched the range and collapsed the rest of the dataset into the low-speed bucket.
Rollback target: `DV-2026-04-14-11`
Notes: Pending backend compile, runtime sync proof, and local route verification for `/heatmap`.

### Version: DV-2026-04-14-11
Date: 2026-04-14
Surface: Heatmap segment-speed color correction on `/heatmap`
Files: `backend/src/main/java/com/hermes/backend/ProfileController.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the backend heatmap speed calculation so each GPS point now inherits color from the local segment speed between adjacent points in the same run, with activity resets between runs, instead of using cumulative distance divided by cumulative elapsed time. This preserves the existing four-band legend contract while finally giving the map real per-route speed variation.
Why: The frontend legend and color bands were already aligned, but the backend was feeding them cumulative average pace values that compressed most points into the same low-speed bucket, so the heatmap stayed almost entirely pink even after the legend cleanup.
Rollback target: `DV-2026-04-14-10`
Notes: Pending backend compile, runtime sync proof, and local route verification for `/heatmap`.

### Version: DV-2026-04-14-10
Date: 2026-04-14
Surface: Heatmap GPS-dot speed band lock on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the heatmap speed-color contract so GPS dots now resolve through an explicit shared `speed band` helper before choosing a color, instead of letting the legend and point styling each infer the band independently. The right-hand speed legend and the visible route dots therefore read from the same band resolution path.
Why: The page already used the same source palette, but this pass removes the last ambiguity between legend rendering and point coloring so the speed chart on the right directly matches the GPS-dot colors on the map.
Rollback target: `DV-2026-04-14-09`
Notes: Pending frontend bundle sync and local route verification for `/heatmap`.

### Version: DV-2026-04-14-09
Date: 2026-04-14
Surface: Shoes scan-import modal light mode on `/shoes`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a dedicated light/high-contrast-light palette pass for the `shoe-scan-modal-*` family so the cinematic scan-import modal now flips into a warm gallery treatment in light mode instead of keeping the old dark-only studio. The modal backdrop, shell, HUD preview, chips, metrics, note/status cards, upload surface, editable result cards, duplicate-resolution state, and action pills now all keep readable dark text and lighter vellum surfaces.
Why: The redesigned scan-import modal was structurally correct, but under a light shell it still stayed in the previous dark treatment, which made the shoes flow feel inconsistent with the rest of the Aerodynamic Gallery pages.
Rollback target: `DV-2026-04-14-08`
Notes: Pending frontend bundle sync and local route verification for `/shoes`.

### Version: DV-2026-04-14-08
Date: 2026-04-14
Surface: Prediction marathon evidence labels and light-mode readability on `/prediction/marathon`
Files: `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Refined the marathon evidence-stage copy so the two supporting grids now read as clearer matched-run sections (`匹配跑步表现 / 匹配跑步记录` in Chinese and `Comparable Run Results / Comparable Run Records` in English), and tightened the light-mode typography layer inside the evidence cards so the chart empty state, table headers, table cells, kicker text, and badges all stay visibly readable on the warm vellum surfaces.
Why: The page already had the correct forecast structure, but the evidence-stage labels still read awkwardly and the light-mode card internals could wash out into low-contrast text, which made the supporting proof harder to trust.
Rollback target: `DV-2026-04-14-07`
Notes: Pending frontend bundle sync and local route verification for `/prediction/marathon`.

### Version: DV-2026-04-14-07
Date: 2026-04-14
Surface: Today Run light-mode pass and shell title on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Switched the Stitch-based `/today-run` route from its old light-mode dark lock into a real Aerodynamic Gallery variant by retuning the runner shell, hero, metric band, coach cards, weather strip, buttons, and supporting tiles for warm vellum surfaces while preserving the same editorial hierarchy and live coaching logic. The topbar active route label now explicitly reads `Today Run` in English and `今日跑步` in Chinese.
Why: The route had been intentionally pinned to a dark treatment even under light theme, which made the page feel inconsistent once the rest of Hermes gained a true light mode, and the active shell label also needed a clearer route name.
Rollback target: `DV-2026-04-14-04`
Notes: Pending frontend bundle sync and local route verification for `/today-run`.

### Version: DV-2026-04-14-06
Date: 2026-04-14
Surface: Heatmap speed legend fidelity on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rewired the heatmap `速度图例` to render directly from the same four `SPEED_BANDS` that color the GPS points, added the missing `peak/峰值` legend copy, and replaced the old blended legend swatches with exact per-band color chips so the visible legend now matches the live map dot palette one-for-one.
Why: The map dots were already colored from a four-band speed scale, but the legend was still showing only three approximate gradient bars, which made the speed explanation misleading.
Rollback target: `DV-2026-04-14-05`
Notes: Pending frontend bundle sync and local route verification for `/heatmap`.

### Version: DV-2026-04-14-05
Date: 2026-04-14
Surface: Analysis coach-insight grid spacing on `/analysis/coach-insight`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Loosened the route-local coach-insight desktop composition by easing the main two-column ratio, increasing the gap between the primary and sidebar lanes, and adding a bit more breathing room inside the performance split, session/reason stacks, and three-up metric/focus/phase grids so the planning cards no longer feel stretched together edge-to-edge.
Why: The page-scoped width expansion solved the earlier wide-screen gutter problem, but the resulting cards started reading too compressed against each other and lost some of the editorial separation the coach surface needs.
Rollback target: `DV-2026-04-14-03`
Notes: Pending frontend bundle sync and local route verification for `/analysis/coach-insight`.

### Version: DV-2026-04-14-04
Date: 2026-04-14
Surface: Today Run Stitch redesign on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt `/today-run` around the provided Stitch reference by replacing the older marathon-progress hero with a cinematic image-led opening, a three-metric HUD plus readiness widget, a workout-blueprint timeline generated from the live plan, and a sticky automated-coach rail that keeps the recommendation, reasons, support metrics, weather, and shoe guidance in one stronger editorial structure. The route now also keeps its dark Stitch treatment even when Hermes is in light mode, and the sidebar active state is restored from the real current route.
Why: The old today-run page still carried a premium shell, but it did not match the sharper reference hierarchy the user asked for and buried the execution story under older card groupings. The redesign makes the daily run decision easier to read while preserving the live coach and recommendation system.
Rollback target: `working tree before this change`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/today-run` returned `200`.

### Version: DV-2026-04-14-03
Date: 2026-04-14
Surface: Analysis coach-insight light-mode text contrast on `/analysis/coach-insight`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the light-mode text palette inside the route-local `analysis-coach-command-*` system so paragraph copy, chart tooltip copy, session metadata, metric labels, and other secondary text stay visibly readable on the vellum coach-insight cards instead of fading into low-contrast gray.
Why: The route already had a dedicated light-mode surface pass, but too many of its secondary text roles were still using soft muted grays tuned for darker cards, which made large parts of the planning page look partially invisible in light mode.
Rollback target: `DV-2026-04-14-02`
Notes: Frontend bundle synced successfully into the Spring-served static output with `index-CBsC0VWv.css` and `index-DsHm5Tiv.js`. `npm run lint` still fails on pre-existing duplicate translation keys plus existing issues in `Races.jsx`, `Schedule.jsx`, `Shoes.jsx`, and `Vo2MaxDetail.jsx`.

### Version: DV-2026-04-14-02
Date: 2026-04-14
Surface: Shoe image-scan import modal on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the shoes `识图导入` flow from the old utility modal into a dedicated cinematic import card with a scan-HUD preview stage, clearer quota/status states, and card-based editable recognition results plus duplicate-resolution actions.
Why: The old scan flow was visually broken and still used a legacy generic modal form, so it no longer matched the premium shoes dashboard and made the import path feel unreliable.
Rollback target: `DV-2026-04-14-01`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/shoes` returned `200`.

### Version: DV-2026-04-14-01
Date: 2026-04-14
Surface: Marathon prediction light-mode route on `/prediction/marathon`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added dedicated light-mode coverage for the marathon forecast branch so the hero, confidence rail, trend/judgment cards, action CTA, performance tiles, and Chart.js axis palette now switch into the Aerodynamic Gallery vellum treatment instead of leaving the route on dark-only surfaces under the light shell.
Why: `/prediction/marathon` already had a strong dark-mode editorial structure, but its page-local `prediction-marathon-*` system and chart ticks were still hardcoded for dark backgrounds, which made light mode feel unfinished.
Rollback target: `DV-2026-04-13-99`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/prediction/marathon` returned `200`.

### Version: DV-2026-04-13-99
Date: 2026-04-13
Surface: Signed-in website theme menu simplification
Files: `frontend/src/contexts/ThemeContext.jsx`, `frontend/src/pages/Settings.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the extra high-contrast dark and high-contrast light theme choices from the real signed-in theme system so Hermes now exposes only `晨光亮面` (`light`) and `午夜脉冲` (`midnight`) in Settings. Existing saved high-contrast preferences now normalize onto the nearest surviving mode instead of leaving users on retired theme values.
Why: The product now wants a cleaner two-theme website experience rather than four public theme variants, so the runtime picker and persisted preference handling needed to match that narrower surface truth.
Rollback target: `DV-2026-04-13-98`
Notes: Frontend bundle synced successfully into the Spring-served static output with `index-Bypbjnyk.css` and `index-gJWgAIpb.js`. `npm run lint` still fails on pre-existing duplicate translation keys plus existing issues in `Races.jsx`, `Schedule.jsx`, and `Vo2MaxDetail.jsx`.

### Version: DV-2026-04-13-98
Date: 2026-04-13
Surface: Run detail light-mode translation on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a dedicated Aerodynamic Gallery light/high-contrast-light layer for the standalone run-detail Stitch surface so the topbar glass, loading shell, route-map hero, metric rail, physiology panels, splits table, gear module, warning state, and empty-state now all move from charcoal-only styling into layered vellum cards with readable dark-on-light contrast.
Why: `/run/:id` still carried its original dark cinematic route-local palette outside a tiny stat-card override, which made the drill-down feel like a split-theme island whenever Hermes switched to light mode.
Rollback target: `DV-2026-04-13-97`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/run/1` returned `200`.

### Version: DV-2026-04-13-97
Date: 2026-04-13
Surface: Analysis injury-risk light-mode translation on `/analysis/injury-risk`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a dedicated Aerodynamic Gallery light/high-contrast-light layer for the injury-risk drill-down so the hero copy, vellum cards, signal strip, coach panel, sample rows, trend chart tooltip/grid, and metric links no longer stay in the old charcoal palette when Hermes switches to light mode. The chart scrubber now also uses theme-aware classes instead of hardcoded dark-only white strokes.
Why: `/analysis/injury-risk` still carried the dark cinematic treatment after the rest of analysis gained route-level light-mode support, which left the page reading as a split-theme island inside the light runner shell.
Rollback target: `DV-2026-04-13-96`
Notes: Frontend bundle synced successfully into the Spring-served static output with `index-E_Ti0OFx.css` and `index-CDFXqHAe.js`. `npm run lint` still fails on pre-existing duplicate translation keys plus existing issues in `Races.jsx`, `Schedule.jsx`, and `Vo2MaxDetail.jsx`.

### Version: DV-2026-04-13-96
Date: 2026-04-13
Surface: Settings atlas feature expansion on `/settings`
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/components/SettingsAtlasLayout.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Expanded the settings command center with three new atlas-native feature modules: one-tap quick controls for theme/unit/language/weekly brief, a sync-health panel that surfaces Strava/Garmin/manual-import state with direct actions, and a readiness checklist that turns account completion into visible setup steps instead of only a percentage.
Why: The page already had live settings handlers and sync state, but too much of that capability was buried inside separate controls and modals. The new modules make `/settings` feel more actionable and more coach-like without changing any backend contracts.
Rollback target: `DV-2026-04-13-95`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/settings` returned `200`. `npm run lint` still fails on the repo's pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus existing issues in `Races.jsx`, `Schedule.jsx`, and `Vo2MaxDetail.jsx`.

### Version: DV-2026-04-13-95
Date: 2026-04-13
Surface: Profile dashboard light-mode completion on `/profile`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Extended the profile light-theme layer beyond the shared dashboard cards so the page background, editorial hero copy, sync/status banners, loading card, sidebar collapse toggle, and workout CTA now all follow the Aerodynamic Gallery light palette instead of leaving the route with dark-mode leftovers around the edges.
Why: `/profile` already had partial light-mode coverage on the main dashboard cards, but the surrounding chrome and status surfaces still used dark-biased text and hover treatments, which made the page feel only half converted in light mode.
Rollback target: `DV-2026-04-13-94`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/profile` returned `200`.

### Version: DV-2026-04-13-94
Date: 2026-04-13
Surface: Runs page light-mode route surfaces on `/runs`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Extended light-mode support across both `/runs` branches, so the populated recent-runs hero, filter chips, status/load-more controls, and the zero-data integration-alert onboarding panels now all use the Aerodynamic Gallery vellum palette instead of leaving dark route-local surfaces under the light shell.
Why: `/runs` already had partial light support for the list cards, but the rest of the route still read as a split-theme page because the hero and onboarding states were bypassing the shared light-mode system.
Rollback target: `DV-2026-04-13-93`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/runs` returned `200`.

### Version: DV-2026-04-13-93
Date: 2026-04-13
Surface: Add-shoes light-mode route on `/shoes/add`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a dedicated light-mode and high-contrast-light palette pass for the add-shoes route so the hero, status cards, browser panel, selection steps, chips, inputs, CTA rows, and loading state now move from the old charcoal-only treatment into layered vellum surfaces with readable dark-on-light contrast.
Why: `/shoes/add` uses its own `add-shoes-*` visual system, so the shared shell theme switch left the nested add flow partially dark and visually inconsistent in light mode.
Rollback target: `DV-2026-04-13-92`
Notes: Frontend bundle synced successfully into the Spring-served static output. `http://localhost:8080/add-shoes` returned `200`; direct `http://localhost:8080/shoes/add` still depends on the local backend forwarder runtime and currently remains `404` in this running backend process.

### Version: DV-2026-04-13-92
Date: 2026-04-13
Surface: Heatmap speed legend clarity on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Bound the heatmap GPS-dot color logic and the legend to one shared speed-band source, and restyled the legend into three explicit slow/mid/fast speed chips with labels stacked directly over the gradient bars so runners can read the dot-speed meaning immediately.
Why: The heatmap dots were already speed-colored, but the legend still read like a looser decorative scale instead of a clear speed key tied to the actual point rendering.
Rollback target: `DV-2026-04-13-91`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/heatmap` returned `200`.

### Version: DV-2026-04-13-91
Date: 2026-04-13
Surface: Settings atlas header and hero compaction on `/settings`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reduced the settings atlas title-band and profile hero scale so the oversized display heading, underline spacing, hero padding, avatar, identity type, pills, and stat rail now fit into a denser editorial command center instead of burning too much first-screen vertical space.
Why: The active settings command-center hierarchy was visually strong but the top title block and profile hero had grown too large, making the page feel wasteful and pushing the real controls too far down.
Rollback target: `DV-2026-04-13-90`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/settings` returned `200`.

### Version: DV-2026-04-13-90
Date: 2026-04-13
Surface: Schedule light-mode planning dashboard on `/schedule`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Extended the Schedule page light-theme layer across the remaining page-local planning surfaces, so the weekly day cards, readiness ring, next-session hero, route panel, coach rail, gear module, and action buttons now all switch into bright vellum surfaces instead of leaving the route half-dark in `theme-light` and `theme-high-contrast-light`.
Why: `/schedule` already had partial light-mode support, but the core planning widgets still used dark hardcoded colors and looked broken once the shell switched themes.
Rollback target: `DV-2026-04-13-89`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/schedule` returned `200`.

### Version: DV-2026-04-13-89
Date: 2026-04-13
Surface: Shared runner avatar fallback on `/shoes` and `/races`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/utils/profileIdentity.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Normalized the topbar avatar fallback on shoes and races so both routes now resolve the runner letter from the actual Hermes profile identity instead of route-local data like race names or auth-only email fallback. The shared shell avatar now stays anchored to Junwei's profile initial (`J`) when no custom profile image exists.
Why: The avatar was visually changing between pages because some routes were deriving the fallback from page content instead of the runner identity, which made the shell feel inconsistent and less trustworthy.
Rollback target: `DV-2026-04-13-88`
Notes: Frontend bundle synced successfully into the Spring-served static output and both `http://localhost:8080/shoes` and `http://localhost:8080/races` returned `200`.

### Version: DV-2026-04-13-88
Date: 2026-04-13
Surface: Intensity detail light-mode dashboard on `/analysis/intensity`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added dedicated `theme-light` and `theme-high-contrast-light` overrides for the intensity command-center route so the hero, distribution card, judgment panel, recovery card, sample tiles, track fills, and CTA now switch from the charcoal-only cinematic palette into layered vellum surfaces with readable dark-on-light contrast.
Why: `/analysis/intensity` uses its own page-local `analysis-intensity-command-*` visual system, so the shared shell light mode left the route partially dark and visually broken.
Rollback target: `DV-2026-04-13-87`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/analysis/intensity` returned `200`.

### Version: DV-2026-04-13-87
Date: 2026-04-13
Surface: Shoes dashboard light-mode support on `/shoes`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Expanded the Shoes page light-theme layer beyond the inventory cards so the stage panels, sticky topbar, search/filter controls, browser/watch panels, duplicate panel, and the large performance insight module now all switch into coherent light surfaces instead of leaving the page half-dark in light mode.
Why: The user wanted `/shoes` to actually work in light mode, and the page was only partially theme-aware because most of its custom Shoes surfaces were still hardcoded to dark-only colors.
Rollback target: `DV-2026-04-13-86`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/shoes` returned `200`. `npm run lint` still fails on the repo’s pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus existing issues in `Races.jsx`, `Schedule.jsx`, and `Vo2MaxDetail.jsx`.

### Version: DV-2026-04-13-86
Date: 2026-04-13
Surface: Settings light-mode command center on `/settings`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added dedicated `theme-light` and `theme-high-contrast-light` overrides for the active settings command-center surface so the hero, cards, territory map, pills, action rows, and form controls now switch to bright vellum-style surfaces with readable dark-on-light typography instead of staying in the dark palette.
Why: `/settings` was still using page-local dark hardcoded values, so the shared shell could enter light mode while the settings content itself still looked broken and low-contrast.
Rollback target: `DV-2026-04-13-85`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/settings` returned `200`.

### Version: DV-2026-04-13-85
Date: 2026-04-13
Surface: Coach insight light-mode dashboard on `/analysis/coach-insight`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a dedicated light-mode palette pass for the coach-insight route so the hero, performance chart stage, recent-session rows, blueprint cards, focus chips, pills, and tooltips now switch from hardcoded charcoal styling into layered vellum surfaces with readable dark-on-light typography and softer grid chrome.
Why: `/analysis/coach-insight` used its own page-local cinematic card system, so the shared shell light mode left the route partially dark and low-contrast instead of behaving like a finished Hermes light-theme page.
Rollback target: `DV-2026-04-13-84`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/analysis/coach-insight` returned `200`.

### Version: DV-2026-04-13-84
Date: 2026-04-13
Surface: VO2max detail light-mode dashboard on `/analysis/vo2max`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Translated the dedicated VO2max kinetic dashboard into the Aerodynamic Gallery light-mode system, so the hero shell, chart stage, axis labels, threshold marker, tooltip, scrubber contrast, footer insights, and CTA now use layered vellum surfaces and readable dark-on-light typography instead of staying in the old charcoal-only cinematic palette.
Why: `/analysis/vo2max` uses its own page-local visual system, so the shared light-mode shell and grid overrides were not enough to make the route read coherently in light mode.
Rollback target: `DV-2026-04-13-83`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/analysis/vo2max` returned `200`.

### Version: DV-2026-04-13-83
Date: 2026-04-13
Surface: Race Center light-mode contrast and grid surfaces on `/races`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Extended the Aerodynamic Gallery light-mode system into the Race Center’s page-local `race-center-*` surfaces, so the hero copy, PB cards, discovery cards, country chips, calendar rows, search field, and action buttons now move off the old charcoal treatment into layered vellum cards with readable text contrast and softer ambient depth.
Why: The shared shell was already in light mode, but `/races` still used its own dark hardcoded card system, which left the words low-contrast and the main race grids visually disconnected from the rest of the light-theme product.
Rollback target: `DV-2026-04-13-82`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/races` returned `200`.

### Version: DV-2026-04-13-82
Date: 2026-04-13
Surface: Global design authority for mode-aware Hermes theming
Files: `design.md`, `.codex/commands/auto-hermes.md`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the old dark-only `design.md` with a unified Kinetic Editorial spec that now defines shared invariants plus explicit dark-mode (`The Cinematic Athlete`) and light-mode (`The Aerodynamic Gallery`) behavior, and updated `/auto-hermes` so non-trivial frontend rounds must lock a target theme mode (`dark`, `light`, or `dual-mode`) and review for cross-mode regressions when shared selectors change.
Why: Hermes had a strong dark-mode design authority but light-mode work was being inferred ad hoc from user prompts, which made `/auto-hermes` less deterministic when handling theme-specific or shared theme-system UI rounds.
Rollback target: `DV-2026-04-13-81`
Notes: Documentation/workflow change only; no live runtime sync was required for this round.

### Version: DV-2026-04-13-81
Date: 2026-04-13
Surface: Analysis overview load-balance contrast on `/analysis`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the light-mode contrast on the analysis overview load-balance card so the gauge value, helper copy, gauge track, and status pill colors now stay readable against the vellum light card instead of fading into the background.
Why: The user flagged the load-balance grid as visually broken in light mode because its dark-theme text treatments were still being reused on a light surface.
Rollback target: `DV-2026-04-13-80`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/analysis` returned `200`.

### Version: DV-2026-04-13-80
Date: 2026-04-13
Surface: Profile dashboard light-mode grid surfaces on `/profile`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Extended the Aerodynamic Gallery light-mode pass into the profile dashboard’s dedicated editorial grid families, so the readiness card, hero workout card, weekly-load chart, recent-sessions list, feature cards, and metric strips now swap their hardcoded charcoal fills for layered vellum surfaces, softer ambient shadows, lighter overlay treatment, and warmer text hierarchy when `light` theme is active.
Why: The shared shell and several other page grids had already moved into the new light-mode system, but `/profile` still looked visually broken because its own card classes were bypassing the shared light overrides and staying dark.
Rollback target: `DV-2026-04-13-79`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/profile` returned `200`.

### Version: DV-2026-04-13-79
Date: 2026-04-13
Surface: Shared light-mode grid/card surfaces across runner pages
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Extended the Aerodynamic Gallery light-mode pass from the shell into the main runner-facing grid systems, so analysis overview cards, today-run panels, schedule cards, runs cards, shoe inventory cards, and run-detail metric tiles now swap their hardcoded charcoal fills for layered light surfaces, softer ambient shadows, and warmer typography contrast when `light` theme is active.
Why: The shell had already moved to the new light-mode language, but many page-local card grids were still using dark hardcoded backgrounds, which made the pages feel visually split between two themes.
Rollback target: `DV-2026-04-13-78`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/profile`, `/analysis`, `/today-run`, `/schedule`, and `/shoes` all returned `200`.

### Version: DV-2026-04-13-78
Date: 2026-04-13
Surface: Shared light-mode foundation across signed-in runner pages
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebased the shared `light` theme onto the new Aerodynamic Gallery light-mode direction by replacing the global light tokens with warmer smoke-toned surfaces, switching the signed-in runner shell to vellum-like glass layers, softening hard border contrast into ghost-border treatment, and upgrading shared light-mode controls and CTAs to the editorial gradient/glass language.
Why: The user provided a new light-mode design spec and wanted Hermes light-theme pages to follow that warmer no-line editorial system instead of the older brighter SaaS-like light chrome.
Rollback target: `DV-2026-04-13-77`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/profile`, `/analysis`, and `/settings` all returned `200`.

### Version: DV-2026-04-13-77
Date: 2026-04-13
Surface: Settings command-center redesign on `/settings`
Files: `frontend/src/components/SettingsAtlasLayout.jsx`, `frontend/src/styles/style.css`, `frontend/src/contexts/ThemeContext.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the settings page around the provided reference’s oversized editorial title, profile-led hero, three-up stat rail, and lower three-column `Preferences / Connectivity / Account Actions` structure while preserving the real Hermes save-profile flow, theme/language/unit controls, Strava and Garmin/manual import actions, digest toggle, and logout path. The same round also fixed theme persistence so the settings theme buttons now reliably keep the selected theme across reloads.
Why: The user wanted `/settings` redesigned to match a stronger command-center reference rather than the previous darker atlas layout, and also needed the theme controls to behave like real global settings instead of looking interactive while resetting on reload.
Rollback target: `DV-2026-04-13-76`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/settings` returned `200`.

### Version: DV-2026-04-13-76
Date: 2026-04-13
Surface: Global theme system and signed-in light mode across Hermes
Files: `frontend/src/contexts/ThemeContext.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Promoted `light` into a first-class global theme with its own `body.theme-light` and `data-theme="light"` hooks, then added a warmer editorial light palette for the shared Hermes shell so dashboard backgrounds, glass surfaces, cards, top navigation, controls, dropdowns, import cards, and settings modals all restyle coherently when runners switch to light mode.
Why: The existing design system and theme branches were dark-first, so picking light in settings did not apply a deliberate all-site light language across the shared runner shell.
Rollback target: `DV-2026-04-13-75`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080`, `/profile`, `/analysis`, `/races`, `/prediction/marathon`, and `/settings` all returned `200`.

### Version: DV-2026-04-13-75
Date: 2026-04-13
Surface: Load-balance detail on `/analysis/load-balance`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the load-balance detail route into a dedicated editorial dashboard with a giant load-ratio hero, acute-vs-chronic trend stage, four supporting metric cards, a coach-judgment side rail, and a recent-samples evidence list, all driven from the live Hermes training-load, injury, and recent-run data instead of the old generic insight-detail template.
Why: The user supplied a stronger KINETIC-style reference and wanted `/analysis/load-balance` redesigned to match that hierarchy without losing the shared Hermes shell, live ACWR/training-load math, or run drill-down behavior.
Rollback target: `DV-2026-04-13-68`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/analysis/load-balance` returned `200`.

### Version: DV-2026-04-13-74
Date: 2026-04-13
Surface: Marathon prediction detail on `/prediction/marathon`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the marathon forecast typography so the hero time, metadata values, card titles, and performance tiles no longer overpower the page, and replaced the last hardcoded short labels (`km`, `PR`) with unit-aware distance formatting and localized badge copy.
Why: The route still felt visually top-heavy after the redesign, and a few small labels were bypassing the translation/unit system, which made the page read less polished in Chinese.
Rollback target: `DV-2026-04-13-72`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/prediction/marathon` returned `200`.

### Version: DV-2026-04-13-73
Date: 2026-04-13
Surface: Race discovery catalog on `/races`
Files: `frontend/src/data/worldRaceCatalog.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Expanded the world-race catalog with additional marathon entries across the United States, Japan, China, and South Korea, removed duplicate catalog records that were surfacing the same event more than once, and collapsed Hong Kong/Taiwan out of the country-strip map so those races now live only under the China grouping.
Why: The user wanted the races page to show more world marathons while treating Hong Kong and Taiwan as part of the China country bucket instead of separate country filters.
Rollback target: working tree before this change
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/races` returned `200`.

### Version: DV-2026-04-13-72
Date: 2026-04-13
Surface: Marathon prediction detail on `/prediction/marathon`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the marathon prediction route into a more cinematic forecast surface with a large hero time read, a trend-led left stage, a coach-judgment rail, secondary performance tiles, and a lower evidence layer for actual-run scatter and normalized race-history proof, while preserving the live VDOT prediction model, unit-aware pace math, chart tooltips, and run drill-down behavior.
Why: The user supplied a stronger race-prediction reference and wanted `/prediction/marathon` redesigned to match that hierarchy without losing Hermes' real prediction logic or evidence trail.
Rollback target: working tree before this change
Notes: Focused ESLint passed for `PredictionDetail.jsx`, the frontend bundle synced into the Spring-served static output, and `http://localhost:8080/prediction/marathon` returned `200`.

### Version: DV-2026-04-13-71
Date: 2026-04-13
Surface: Intensity detail on `/analysis/intensity`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the intensity detail route into an authored intensity dashboard with a large editorial hero, a dominant three-bucket distribution stage, a coach-judgment sidebar, a quieter recovery prompt, and a three-card supporting-samples lane, while keeping the page wired to Hermes' live `buildPolarized(...)` data and run drill-downs.
Why: The user supplied a stronger intensity-dashboard reference and wanted `/analysis/intensity` redesigned to match that hierarchy without losing the real Hermes analysis shell, translations, or underlying three-way intensity truth.
Rollback target: `DV-2026-04-13-68`
Notes: Focused ESLint passed for `AnalysisInsightDetail.jsx`, the frontend bundle synced into the Spring-served static output, and `http://localhost:8080/analysis/intensity` returned `200`.

### Version: DV-2026-04-13-70
Date: 2026-04-13
Surface: Coach insight detail on `/analysis/coach-insight`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Expanded the coach insight route into a wider desktop canvas and rebalanced the hero, main content, and inner performance grids so the planning dashboard uses more of the available horizontal space instead of leaving large side gutters on wide screens.
Why: The user wanted the coach-insight page to better fill the left and right blank space without changing the route's structure or coach-data hierarchy.
Rollback target: `DV-2026-04-13-69`
Notes: This is a page-scoped layout expansion for `/analysis/coach-insight` only; the shared runner shell cap for other routes stays unchanged.

### Version: DV-2026-04-13-69
Date: 2026-04-13
Surface: Coach insight detail on `/analysis/coach-insight`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the coach insight route into a stronger daily-coach dashboard with a cinematic readiness hero, a chart-led kinetic insights stage, a recent-sessions evidence lane, and a tighter blueprint side rail for the next key sessions, while toning the lower support cards so they back up the blueprint instead of competing with it.
Why: The user supplied a stronger coach-dashboard reference and wanted the coach page redesigned without losing Hermes’ real training-planning data and runner-shell behavior.
Rollback target: `DV-2026-04-12-47`
Notes: Focused ESLint passed for `AnalysisInsightDetail.jsx`, the frontend bundle synced into the Spring-served static output, `http://localhost:8080/analysis/coach-insight` returned `200`, and a reviewer pass confirmed the reference structure is now mapped into Hermes while preserving the current shell and live coach data.

### Version: DV-2026-04-13-68
Date: 2026-04-13
Surface: Analysis overview intensity card on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Corrected the overview intensity card so it now shows the real three-way training distribution (`easy / moderate / hard`) in both the headline ratio and segmented bar, and added a dedicated moderate-intensity label instead of collapsing the middle bucket into a misleading binary split.
Why: The old overview card could sit at `100/0` even when recent training contained a substantial moderate bucket, which made the visible summary disagree with the underlying intensity analysis.
Rollback target: `DV-2026-04-13-66`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/analysis` returned `200`.

### Version: DV-2026-04-13-67
Date: 2026-04-13
Surface: VO2max detail chart on `/analysis/vo2max`
Files: `frontend/src/pages/Vo2MaxDetail.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Simplified the VO2max chart so the main plot now presents a clean trend-line read with the existing scrubber cursor and tooltip, while the extra per-run scatter dots, trend node dots, and latest-point glow were removed from the visible graph.
Why: The user explicitly wanted the graph to stop feeling cluttered and read as one clear line while keeping the cursor interaction.
Rollback target: `DV-2026-04-13-53`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/analysis/vo2max` returned `200`.

### Version: DV-2026-04-13-66
Date: 2026-04-13
Surface: Analysis overview and injury-risk localization on `/analysis` and `/analysis/injury-risk`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the remaining hardcoded English strings from the restored analysis overview and the cinematic injury-risk detail route, then routed both surfaces through shared `analysis` translation keys so the hero, coach judgment, signals, evidence rail, trend legend, and metric cards now localize cleanly in Chinese and English.
Why: The user explicitly wanted both analysis surfaces translated instead of showing mixed localized and hardcoded English copy after the route split restore.
Rollback target: `DV-2026-04-13-65`
Notes: Focused ESLint passed for `Analysis.jsx` and `AnalysisInsightDetail.jsx`, the frontend bundle synced into the Spring-served static output, and both `http://localhost:8080/analysis` and `http://localhost:8080/analysis/injury-risk` returned `200`.

### Version: DV-2026-04-13-65
Date: 2026-04-13
Surface: Analysis route split between `/analysis` and `/analysis/injury-risk`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Restored the original analysis overview dashboard on `/analysis` with the VO2, load, intensity, injury, and prediction-table hierarchy, and moved the newer cinematic injury-risk experience into the dedicated `/analysis/injury-risk` detail route so the dramatic risk layout now lives on the injury page instead of replacing the overview.
Why: The user explicitly wanted the old analysis landing page back while keeping the newer injury-analysis screen available on the injury route.
Rollback target: `DV-2026-04-13-62`
Notes: Frontend build synced successfully into the Spring-served static output and both `http://localhost:8080/analysis` and `http://localhost:8080/analysis/injury-risk` returned `200`.

### Version: DV-2026-04-13-64
Date: 2026-04-13
Surface: Editorial profile feature grid on `/profile`
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Normalized the four-card profile feature grid so the readiness, suggested workout, training load, and recent sessions cards now stretch to matched row heights in the desktop 2x2 layout instead of free-sizing to different heights based on their content.
Why: The user explicitly wanted the four featured profile cards to align as one balanced grid rather than reading as mismatched panels.
Rollback target: `DV-2026-04-13-57`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/profile` returned `200`.

### Version: DV-2026-04-13-63
Date: 2026-04-13
Surface: Settings page on `/settings`
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/components/SettingsAtlasLayout.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the broken mixed-generation settings surface with a single atlas-style settings body rendered through a dedicated component, preserved the real account/preferences/integration handlers, and removed the stale duplicate legacy settings block that had been breaking the page structure.
Why: The user supplied a stronger settings reference and the previous merge had left `/settings` in a broken hybrid state with overlapping layouts and dead JSX still living under the active shell.
Rollback target: `DV-2026-04-13-60`
Notes: Frontend bundle synced successfully into the Spring-served static output and `http://localhost:8080/settings` returned `200`. `npm run lint` still fails only on the repo's pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus the existing warnings in `Races.jsx` and `Schedule.jsx`.

### Version: DV-2026-04-13-62
Date: 2026-04-13
Surface: Analysis landing page on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the older VO2/load dashboard hierarchy on the analysis landing page with a cinematic injury-risk composition: a dominant risk hero driven by live injury/load signals, a coach-judgment follow-up, a supporting-samples evidence rail, a full-width drift/load trend chart, and three closing metric cards for VO2, intensity split, and marathon forecast.
Why: The user supplied a stronger injury-analysis reference and wanted the main analysis page to read like a premium risk-and-coach surface instead of a generic stack of separate summary widgets.
Rollback target: `DV-2026-04-13-59`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/analysis` returned `200`. `npm run lint` still fails on the repo's pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus unrelated warnings in `Races.jsx` and `Schedule.jsx`.

### Version: DV-2026-04-13-61
Date: 2026-04-13
Surface: Add-shoes flow under the shoes section
Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/ShoeCatalog.jsx`, `frontend/src/App.jsx`, `frontend/src/styles/style.css`, `backend/src/main/java/com/hermes/backend/SpaForwardingController.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the right-hand add-shoes rail cards, let the guided brand/model/configure flow use the full main column, and moved the route to `/shoes/add` with a shoes-section breadcrumb/back path so the screen now reads as a child page of the main shoes hub instead of a detached standalone destination.
Why: The extra side panels were diluting the setup flow, and the user explicitly wanted add-shoes to feel like part of the shoes page hierarchy rather than a separate page family.
Rollback target: `DV-2026-04-13-60`
Notes: Frontend bundle and backend runtime route forwarding both need to be synced before claiming the local route changed.

### Version: DV-2026-04-13-60
Date: 2026-04-13
Surface: Settings control room on `/settings`
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/styles/style.css`, `frontend/src/components/FooterNavLinks.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the duplicate legacy settings stack that was still rendering beneath the new control-room layout, eliminated the old giant-image brief card from the live page, restored a complete `settings-command-*` visual system for the active hero/grid/territories structure, and fixed the shared footer link component to use the current I18n context import.
Why: The settings page had regressed into a broken mixed-generation surface where an older image-backed section leaked back into the live layout and the new shell was missing its owning styles.
Rollback target: `DV-2026-04-13-59`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/settings` returned `200`.

### Version: DV-2026-04-13-59
Date: 2026-04-13
Surface: Shared footer links across public, auth, legal, and runner pages
Files: `frontend/src/components/FooterNavLinks.jsx`, `frontend/src/pages/Landing.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`, `frontend/src/pages/LegalPage.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/AddShoes.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Rewards.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/pages/ShoeCatalog.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the drifting footer variants with one shared four-link row so Hermes now shows `条款 / 隐私 / 支持 / 设置` consistently across the public landing flow, auth/legal pages, and signed-in runner surfaces instead of mixing `联系`, `Logout`, placeholder anchors, or page-specific link sets.
Why: The old footer language had split into several inconsistent patterns, which made the product feel uneven and caused the user-visible alignment/content issue to resurface on some pages but not others.
Rollback target: `DV-2026-04-13-58`
Notes: Frontend build should be re-synced before claiming the live site changed.

### Version: DV-2026-04-13-58
Date: 2026-04-13
Surface: Shared runner topbar notifications on signed-in shell pages
Files: `frontend/src/components/TopbarNotifications.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the notification tray into a more self-contained glass panel with cleaner active-button feedback, stronger card surfaces, and a persistent seen-state so opening the tray clears the unread dot and leaves the bell as a normal utility button afterward.
Why: The first notification rollout exposed a broken-feeling open state, and the user explicitly wanted the unread indicator removed once notifications had been checked.
Rollback target: `DV-2026-04-13-56`
Notes: Frontend build should be re-synced before claiming the live site changed.

### Version: DV-2026-04-13-57
Date: 2026-04-13
Surface: Editorial profile feature grid on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a second-layer editorial feature grid beneath the core profile dashboard that turns the live readiness state, suggested workout, weekly load, and recent sessions into a more reference-driven dark bento composition with stronger hierarchy, glass depth, and direct drill-down actions.
Why: The user wanted the profile page to pick up the stronger grid language from the supplied mock while still staying wired to real Hermes coach and activity data instead of becoming a static redesign.
Rollback target: `DV-2026-04-13-56`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/profile` returned `200`. `npm run lint` still fails on the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus unrelated warnings in `Races.jsx`, `Schedule.jsx`, and `Settings.jsx`.

### Version: DV-2026-04-13-56
Date: 2026-04-13
Surface: Shared runner topbar notifications on signed-in shell pages
Files: `frontend/src/components/TopbarNotifications.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Rewards.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/AddShoes.jsx`, `frontend/src/pages/TodayRun.jsx`, `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the old bell icon that only jumped to `/runs` with a reusable glass notification popover that opens a compact Hermes message panel directly from the signed-in topbar across the main runner surfaces.
Why: The user wanted the notification button to feel like a real in-app utility control, so the shared shell now gives runners a lightweight message tray instead of a dead-looking redirect icon.
Rollback target: `DV-2026-04-13-55`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080` returned `200`. `npm run lint` still fails only on the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus unrelated warnings in `Races.jsx` and `Schedule.jsx`.

### Version: DV-2026-04-13-55
Date: 2026-04-13
Surface: Foldable shoe performance correlation module on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a header-side collapse toggle to the redesigned `跑鞋表现相关性` block so runners can fold the full editorial insight grid down to its summary header and expand it again without losing the featured shoe state, pills, or live data-driven recommendation logic.
Why: The redesigned card is intentionally high-signal, but the user wanted control over page density so the whole module can step out of the way when they are focusing on the inventory grid below it.
Rollback target: `DV-2026-04-13-54`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/shoes` returned `200`.

### Version: DV-2026-04-13-54
Date: 2026-04-13
Surface: Shoe performance correlation redesign on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the `跑鞋表现相关性` grid into a cinematic editorial insight card with a featured shoe highlight, a glass metric rail, compact mileage/run-count meta tiles, and a source footer that can pivot between Hermes rotation analysis and the live `r/RunningShoeGeeks` recommendation fallback while preserving the real insight, recommendation, and empty-state logic.
Why: The previous grid read like a dense utility block, but the user supplied a much stronger reference that should make the shoe signal feel premium, coach-like, and immediately readable without changing the underlying Hermes data contract.
Rollback target: `working tree before this change`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/shoes` returned `200`. `npm run lint` still fails only on the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus unrelated warnings in `Races.jsx` and `Schedule.jsx`.

### Version: DV-2026-04-13-53
Date: 2026-04-13
Surface: VO2max detail refinement on `/analysis/vo2max`
Files: `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the reference-driven VO2 detail redesign with stronger editorial metadata above the hero, a cleaner chart legend/read strip, richer ambient depth around the glass dashboard, a stable range-floor threshold instead of a scale-dependent pseudo-threshold, a peak metric tied back to the real sample max, and an explicit accessible chart summary for screen readers.
Why: The first redesign already matched the supplied kinetic reference structurally, but the follow-up pass needed to make the page more truthful, more readable, and more durable without backing away from the chart-first premium composition.
Rollback target: `DV-2026-04-13-52`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/analysis/vo2max` returned `200`. `npm run lint` still fails only on the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus unrelated warnings in `Races.jsx` and `Schedule.jsx`.

### Version: DV-2026-04-13-52
Date: 2026-04-13
Surface: VO2max detail redesign on `/analysis/vo2max`
Files: `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the VO2 detail route into a cinematic glass dashboard inside the shared runner shell, with a dramatic VO2 hero header, right-aligned peak/average/trend stats, a chart-dominant center stage, a floating latest-session chip, and a restrained footer insight band while keeping the underlying Hermes VO2 samples and smoothed 90-day trend wired to real activity data.
Why: The user supplied a much stronger editorial reference for the VO2 page, and the route needed that visual confidence without losing the actual Hermes data model, navigation, auth behavior, or analysis-shell continuity.
Rollback target: `DV-2026-04-12-35`
Notes: Frontend runtime sync returned `PASS`, the Vite build produced a fresh `Vo2MaxDetail` bundle in the Spring-served static output, and `http://localhost:8080/analysis/vo2max` returned `200`. `npm run lint` still fails only on the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` plus unrelated warnings in `Races.jsx` and `Schedule.jsx`.

### Version: DV-2026-04-13-51
Date: 2026-04-13
Surface: Add Shoes page alignment on `/add-shoes`
Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reworked `/add-shoes` away from the standalone `PULSE gear garage` tone and into the same shared runner-shell family as `/shoes`, `/settings`, and `/profile`, with the standard topbar action cluster, a clearer editorial hero, aligned stage/card hierarchy for the three-step add flow, and a stickier support rail that reads like the rest of the shoes family.
Why: The route already lived inside the shared shell technically, but its custom topbar, branding, and panel rhythm still felt like a detached mini-product instead of a natural child surface of the running shoes experience.
Rollback target: `DV-2026-04-13-49`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/add-shoes` returned `200`. Frontend lint still reports the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js`.

### Version: DV-2026-04-13-50
Date: 2026-04-13
Surface: Global GPS dot density correction on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Corrected the visible GPS-dot sampling logic so the stride is chosen from the total visible heatmap payload again, while still preserving each run's first and last point instead of switching the page to a per-run stride rule.
Why: The previous follow-up incorrectly changed the density contract to per-run sampling, but the intended heatmap behavior is that the visible GPS point density should reflect the combined total across the runner's heatmap data.
Rollback target: `DV-2026-04-12-48`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/heatmap` returned `200`.

### Version: DV-2026-04-13-49
Date: 2026-04-13
Surface: PULSE-style add-shoes studio on `/add-shoes`
Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt `/add-shoes` into a premium three-step gear-studio flow with a glass topbar and signed-in runner shell, a brand-first selection grid, richer model filtering/search, a stronger configure-pair stage, and a sticky inventory snapshot rail that previews active rotation impact while preserving the live Hermes shoe-create route.
Why: The prior add-shoes surface was missing its routed page file and did not match the stronger editorial transaction flow the user provided, so the route needed a real, coach-like add-gear composition instead of a brittle or generic form.
Rollback target: `DV-2026-04-12-38`
Notes: Frontend bundle sync helper returned `PASS`, `http://localhost:8080/add-shoes` returned `200`, and the add-shoes route now honors the dynamic shoe-catalog payload shape plus failed-save handling. `npm run lint` still reports the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js` and unrelated warnings in `Races.jsx` and `Schedule.jsx`.

### Version: DV-2026-04-12-48
Date: 2026-04-12
Surface: GPS-dot coverage reset on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `backend/src/main/java/com/hermes/backend/ProfileController.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the visible heatmap route rendering with a GPS-dot-first coverage layer over a quieter heat fog, so the page now shows where the runner has actually been without drawing fragile lines between sparse samples. Also corrected the backend heatmap bounds reader so the live map viewport uses latitude and longitude from the current sampled row shape after `activityId` was added to the payload.
Why: The previous line-based treatment could still turn noisy or thinned GPS into unreadable spaghetti, and the stale bounds indexing made the map itself less trustworthy.
Rollback target: `DV-2026-04-12-47`
Notes: Backend compile passed, backend runtime sync helper returned `PASS`, frontend build synced successfully into the Spring-served static output, and `http://localhost:8080/heatmap` returned `200`.

### Version: DV-2026-04-12-47
Date: 2026-04-12
Surface: Garmin Coach-style training system on `/analysis/coach-insight`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/utils/analysisInsights.js`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reframed the coach-insight detail route into a coach-system surface that reads recent performance like a training plan, with a Garmin Coach-style hero, readiness score, adaptive microcycle, system signal cards, rationale panel, and recent-proof run evidence instead of a generic analytics detail card.
Why: The route needed to help runners decide how to train next, not just explain metrics in isolation, and the user explicitly wanted a more coached-system feeling similar to Garmin Coach.
Rollback target: `DV-2026-04-12-40`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/analysis/coach-insight` returned `200`. Frontend lint still reports the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js`.

### Version: DV-2026-04-12-46
Date: 2026-04-12
Surface: StatsHunter-style route signal cleanup on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reworked the live heat layer toward a darker StatsHunter-style read by tightening the map treatment, shifting the visible route palette into a warm coral-to-amber range, adding a subtle glow under each route stroke, and splitting outlier geometry jumps so broken GPS samples stop drawing fake diagonal lines across the city.
Why: The previous route layer was technically connected but still looked broken because large point jumps could create impossible cross-city spikes and the warmer road-trace reference the user asked for was getting diluted by the older green-heavy heat treatment and heavier dashboard glass.
Rollback target: `DV-2026-04-12-45`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/heatmap` returned `200`.

### Version: DV-2026-04-12-45
Date: 2026-04-12
Surface: Full `Map focus` collapse state on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Updated the `Map focus` interaction so collapsing it now shrinks the whole story-card content into the single top-right red dot, and clicking that dot restores the kicker, headline, copy, and metric grid together.
Why: The earlier fold state only hid part of the content, which still left the card reading as partially open instead of fully collapsed.
Rollback target: `DV-2026-04-12-44`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/heatmap` returned `200`.

### Version: DV-2026-04-12-44
Date: 2026-04-12
Surface: Folded `Map focus` dot state on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the folded `Map focus` interaction so collapsing the metric grid now leaves only one active red dot in the story-card header toggle and fully hides the extra standalone dot below the copy.
Why: The previous folded state still looked partially open because it showed two red-dot cues instead of one clean folded indicator.
Rollback target: `DV-2026-04-13-43`
Notes: Frontend build synced successfully into the Spring-served static output and `http://localhost:8080/heatmap` returned `200`.

### Version: DV-2026-04-13-43
Date: 2026-04-13
Surface: Heatmap route precision and cockpit recovery on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the heat kernel so the route signal renders with smaller, less smeared samples, added a zoom-aware dot trace so zoomed-in views read like the exact roads the runner used, and restored the top-left Hermes brand pill so the cockpit regained the branded control anchor that had drifted out during later heatmap tweaks.
Why: The heatmap still looked too blobby for road-level reading, and the newer top-left section-label swap weakened the approved cockpit identity while the user asked for lost heatmap components to be fixed.
Rollback target: `DV-2026-04-12-42`
Notes: Frontend build synced successfully, `verify-frontend-runtime-sync.mjs` returned `PASS`, and `http://localhost:8080/heatmap` returned `200`. Frontend lint still fails on the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js`.

### Version: DV-2026-04-12-42
Date: 2026-04-12
Surface: Foldable map-focus grid on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a reversible fold state for the floating `地图焦点` / `Map focus` metric grid so the story card can collapse that stats cluster into a small glowing dot and restore it in place on click without disturbing the rest of the map cockpit.
Why: The heatmap page needed a quick way to clear more map attention on demand while still keeping the route summary metrics one click away.
Rollback target: `DV-2026-04-12-41`
Notes: Frontend build synced successfully and `http://localhost:8080/heatmap` returned `200`. Frontend lint still reports the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js`.

### Version: DV-2026-04-12-41
Date: 2026-04-12
Surface: Heatmap left utility rail alignment on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Realigned the heatmap page's left utility rail to match the shared runner-shell button order used on the other signed-in pages, restoring the activities-before-heatmap sequence and adding the missing races and schedule destinations while keeping the compact icon-only rail treatment.
Why: The heatmap page's left-side button stack was out of order and incomplete relative to the rest of the app, which made the navigation feel inconsistent even though the heatmap design itself was otherwise correct.
Rollback target: `DV-2026-04-13-39`
Notes: The frontend build regenerated assets successfully but the final mirror into `backend/target/classes/static` failed with a locked-directory `ENOTEMPTY` error, so the source fix is in place and `http://localhost:8080/heatmap` returned `200`, but the live Spring-served bundle is not fully confirmed synced yet.

### Version: DV-2026-04-12-40
Date: 2026-04-12
Surface: Injury-risk detail on `/analysis/injury-risk`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/contexts/I18nContext.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reworked the injury-risk detail route into the current Stitch analysis-detail language with a stronger editorial intro, a localized back/action/read/recent-runs copy layer, a dedicated injury signal strip for cadence, drift, and ACWR, a cleaner recent-run row treatment, and route-level tab-title wiring so the page now reads like a first-class analysis drill-down instead of a generic card stack.
Why: The injury-risk page was partially untranslated, visually flatter than the rest of the analysis family, and blocked from a truthful live claim by a corrupted i18n provider that prevented the frontend from rebuilding.
Rollback target: `DV-2026-04-13-39`
Notes: Frontend build synced successfully and `http://localhost:8080/analysis/injury-risk` returned `200`. Frontend lint still reports the pre-existing duplicate-key errors in the races translation blocks.

### Version: DV-2026-04-13-39
Date: 2026-04-13
Surface: Heatmap cockpit redesign on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `frontend/src/contexts/I18nContext.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt `/heatmap` into a full-viewport map cockpit with a darker live basemap, floating glass control chips, a compact utility rail, a bottom story card, and a visible speed legend while keeping Hermes' deep-dark editorial surfaces and the red-for-slow / yellow-for-mid / green-for-fast heat treatment.
Why: The old heatmap still read like a dashboard card inside runner-shell chrome, while the requested reference called for a map-first experience where the route signal owns the screen without leaving Hermes' design language.
Rollback target: `DV-2026-04-12-38`
Notes: Frontend build synced the new bundle into both backend static outputs and `verify-frontend-runtime-sync.mjs` returned `PASS`. Frontend lint still reports the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js`.

### Version: DV-2026-04-12-38
Date: 2026-04-12
Surface: Inventory control placement on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Moved the inventory action and filter control cluster so the scan, sort, brand, and category pills now sit directly beneath the main `shoe-inventory-hero` heading instead of dropping below the empty/results state area, and tightened the spacing so the hero and controls read as one command surface.
Why: The control stack was visually detached from the hero and easy to miss in the page's upper-left flow, especially on sparse or empty inventory states where those actions should be the next obvious thing to use.
Rollback target: `DV-2026-04-12-37`
Notes: Source updated, but frontend lint and Vite build are still blocked by pre-existing `frontend/src/contexts/I18nContext.jsx` and `frontend/src/i18n/translations.js` errors, so the live `/shoes` bundle is not confirmed synced even though `http://localhost:8080/shoes` returned `200`.

### Version: DV-2026-04-12-37
Date: 2026-04-12
Surface: Settings copy reliability on `/settings`
Files: `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added the missing settings-specific `stitch_*` translation keys for both Chinese and English so the settings hero, status cards, integrations rail, and security/import sections now render clean Hermes copy instead of leaking broken Stitch placeholder keys.
Why: The settings page was still pulling missing or stale Stitch-era title labels, which made the premium control-room surface feel broken even though the layout and functionality were intact.
Rollback target: `DV-2026-04-12-36`
Notes: Frontend build synced successfully and `http://localhost:8080/settings` returned `200`. Frontend lint still reports the pre-existing duplicate-key errors in the races translation blocks.

### Version: DV-2026-04-12-36
Date: 2026-04-12
Surface: Analysis and heatmap loading behavior on `/analysis` and `/heatmap`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/Heatmap.jsx`, `backend/src/main/java/com/hermes/backend/ActivityController.java`, `backend/src/main/java/com/hermes/backend/ActivityRepository.java`, `backend/src/main/java/com/hermes/backend/ProfileController.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Moved `/analysis` off the heavyweight full-activity feed onto a lighter summary endpoint, let the page shell render while runs load, and lowered the client update priority for large result sets; `/heatmap` now preloads Leaflet, no longer hard-blocks the whole page on the profile request, and the backend heatmap response trims the first sampled payload down further for large accounts.
Why: The analysis and heatmap routes were feeling stuck for runners with larger histories because they were overfetching and overblocking before the first meaningful paint.
Rollback target: `DV-2026-04-12-35`
Notes: Frontend build synced the updated bundle into backend static output and backend compile passed. Frontend lint still fails on the pre-existing duplicate-key errors in `frontend/src/i18n/translations.js`, and the local Hermes runtime remained unhealthy with `http://localhost:8080` timing out during this round, so the source and live bundle were updated but the server health proof did not pass.

### Version: DV-2026-04-12-35
Date: 2026-04-12
Surface: VO2 max detail on `/analysis/vo2max`
Files: `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reduced the VO2 max detail page body down to one dedicated chart stage inside the shared runner shell, removed the surrounding hero, summary, method, recent-run, and reading panels, then refined the graph into a smoother development-focused curve with a glow pass, warmer gradient stroke, quieter per-run dots, clearer start/end emphasis, and a stronger time axis that now shows day plus date with compact max/average chart stats in the top-right corner.
Why: The page was carrying too much surrounding chrome for the user’s goal, and the VO2 signal itself needed to read more like visible fitness development over time instead of a standard metric line inside a multi-card dashboard.
Rollback target: `DV-2026-04-12-28`
Notes: Frontend build synced the updated bundle into the backend static output. A later local runtime probe for `http://localhost:8080/analysis/vo2max?_v=1775987734523` timed out, so the source and live bundle were updated but the local Hermes runtime was not healthy enough to reconfirm the route in this follow-up round.

### Version: DV-2026-04-12-34
Date: 2026-04-12
Surface: Public landing header auth actions on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added explicit public `Login` and `Sign Up` buttons to the top-right landing header while keeping the signed-in dashboard links and utility icons removed, so the page now has clear auth entrypoints without drifting back into app-shell chrome.
Why: The public landing page needed obvious account entry actions after the old pseudo-dashboard header was removed, but those actions needed to read as public auth controls rather than private in-product navigation.
Rollback target: `DV-2026-04-12-33`
Notes: Frontend build synced the live bundle into the backend static output and `http://localhost:8080/` returned `200`.

### Version: DV-2026-04-12-33
Date: 2026-04-12
Surface: Public language handling on `/`, `/login`, and `/signup`
Files: `frontend/src/contexts/I18nContext.jsx`, `frontend/src/pages/Landing.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the visible Chinese/English switcher from the landing, login, and signup pages, and changed the frontend language boot logic so those public surfaces now default from the device/browser system language: Chinese systems map to `zh-CN`, while English, Japanese, French, and other non-Chinese systems all fall back to English for now.
Why: The public entry surfaces should feel automatic and less like a settings page; the product now picks a sensible language by default instead of asking first-time visitors to toggle it manually.
Rollback target: `DV-2026-04-12-32`
Notes: Pending frontend build sync and live route verification for `/`, `/login`, and `/signup`.

### Version: DV-2026-04-12-32
Date: 2026-04-12
Surface: Public landing header on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the signed-in-style dashboard section links and the notification/settings/profile icon cluster from the public landing header, leaving the top bar as a minimal brand-only public shell instead of a confusing pseudo-app nav.
Why: The landing page was advertising private in-product destinations before sign-in and visually borrowing signed-in chrome that does not belong on the public homepage.
Rollback target: `DV-2026-04-12-31`
Notes: Pending frontend lint/build and live landing-page verification for the simplified public header.

### Version: DV-2026-04-12-31
Date: 2026-04-12
Surface: Login polish and Strava unavailable state on `/login`
Files: `frontend/src/pages/Login.jsx`, `frontend/src/contexts/I18nContext.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced missing Stitch-era login fallback strings with real Hermes copy, removed the broken password placeholder glyphs, and softened the Strava-unconfigured state into a disabled CTA plus calm explanatory note instead of showing raw backend config detail inside the form card.
Why: The login screen was visibly broken because missing translation keys were surfacing placeholder labels like "Stitch hero line one," and the Strava section looked like a product failure rather than a normal server-configuration state.
Rollback target: `DV-2026-04-12-30`
Notes: Pending frontend build sync and direct local runtime verification for the repaired login surface.

### Version: DV-2026-04-12-30
Date: 2026-04-12
Surface: Heatmap page body on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reduced the dedicated heatmap page down to a single large map stage inside the shared signed-in runner shell, removing the hero summary, density metrics, route-footprint readouts, and hotspot sidecards while preserving the live Leaflet heat layer and the empty-state fallback.
Why: The fuller editorial composition was more than the user wanted for this surface, and the page now matches the requested simpler utility: just open the route heatmap and see the map.
Rollback target: `DV-2026-04-12-28`
Notes: Pending frontend lint/build and live route verification for this simplification round.

### Version: DV-2026-04-12-29
Date: 2026-04-12
Surface: Recent shoe-rotation signal presentation on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the recent shoe-rotation signal into a more current Hermes editorial band with one shared content structure for the top and inline variants, a larger asymmetrical spotlight panel for the recommended shoe insight, a glass sidecar for the current-window context, and denser stat surfaces instead of the older flat dark card with a pale inset tile.
Why: The recommendation logic was already useful, but the module still looked like an older utility panel and visually lagged behind the newer Hermes drill-down and dashboard surfaces even though it sits in one of the highest-value first-screen positions on `/shoes`.
Rollback target: `DV-2026-04-12-28`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200`.

### Version: DV-2026-04-12-28
Date: 2026-04-12
Surface: Dedicated route heatmap on `/heatmap` plus shared runner sidebar access
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/App.jsx`, `frontend/src/contexts/I18nContext.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/TodayRun.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/AddShoes.jsx`, `frontend/src/pages/ShoeCatalog.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Rewards.jsx`, `backend/src/main/java/com/hermes/backend/SpaForwardingController.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Restored Hermes' old route heatmap as a dedicated signed-in runner page with a large editorial map stage, route-footprint and hotspot sidecards, live `/api/profile/heatmap` wiring through Leaflet plus `leaflet.heat`, and a new direct `Heatmap` button threaded into the shared left sidebar across the runner-shell pages.
Why: The old heatmap capability still mattered as runner-facing route memory and data-trust signal, but it had disappeared from the new design system and was no longer reachable as a first-class destination.
Rollback target: `DV-2026-04-12-27`
Notes: Frontend lint passed, the frontend build synced the live bundle into the backend static output, backend compile passed, the local backend was restarted, and direct requests to `http://localhost:8080/heatmap` and `http://localhost:8080/heatmap?_v=1775987734523` returned `200`.

### Version: DV-2026-04-12-27
Date: 2026-04-12
Surface: Personal-record celebration on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a premium personal-record celebration modal to the signed-in profile dashboard. Hermes now snapshots the last acknowledged PR state per runner, compares it with newly loaded personal-record data after fresh activity imports, and opens a cinematic congratulations popup only when a newly seen run actually breaks a prior benchmark.
Why: Hermes already computes personal records, but the runner had no emotional reward moment when fresh data crossed a meaningful milestone. Adding a clear PR celebration makes progress visible immediately and gives imported data a stronger coach-like payoff.
Rollback target: `DV-2026-04-12-26`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200`.

### Version: DV-2026-04-12-26
Date: 2026-04-12
Surface: Daily coach truthfulness and shoe decision support on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/utils/shoeRotation.js`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the marathon progress math on `/today-run` so long-run progress now reads from the current marathon block instead of lifetime history, then added a first-screen shoe recommendation module that uses shared recent-rotation logic and a graceful owned-shoe fallback when tagging history is thin.
Why: The page was selling coach-like marathon readiness while overstating progress from old-season long runs, and it still was not answering the full morning question of what to wear today even though Hermes already had the underlying shoe signal.
Rollback target: `DV-2026-04-12-25`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200`.

### Version: DV-2026-04-12-25
Date: 2026-04-12
Surface: Route-shell alignment audit on `/admin`, `/shoe-catalog`, `/add-shoes`, and `/rewards`
Files: `frontend/src/pages/AdminLogin.jsx`, `frontend/src/pages/ShoeCatalog.jsx`, `frontend/src/pages/AddShoes.jsx`, `frontend/src/pages/Rewards.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the admin login route into the current cinematic auth family, moved the legacy shoe-catalog browser out of the old top-nav authenticated chrome and into the shared runner dashboard shell, tightened `/add-shoes` onto the same collapsible runner-shell contract, and updated `/rewards` to use the shared sidebar/topbar/footer language instead of the older analysis-only shell variant.
Why: A full-site audit against `design.md` and the current `/profile` shell showed that these routes were still the clearest visual outliers, which made Hermes feel like several different products instead of one coherent system.
Rollback target: `DV-2026-04-12-23`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200`.

### Version: DV-2026-04-12-23
Date: 2026-04-12
Surface: Marathon-personalized daily coach on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/Shoes.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reframed `/today-run` around the runner's next saved marathon by wiring race data into the page, adding countdown and long-run progression signals, surfacing a locked-target or choose-a-race state in the readiness rail, and aligning the route to the current runner-shell footer contract. A blocking pre-existing `Shoes.jsx` parse break was also repaired so the frontend could build and sync again.
Why: The daily coach page still behaved like a generic workout recommendation screen instead of a marathon-training dashboard, and runners without a saved goal race had no clear next action to make the page truly personal.
Rollback target: `DV-2026-04-11-32`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200`.

### Version: DV-2026-04-12-22
Date: 2026-04-12
Surface: Selected race calendar truthfulness on `/races`
Files: `frontend/src/pages/Races.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the fallback that populated the selected-race calendar from discovery catalog entries, so the `已选赛事` section now stays empty until the runner has actually added a race.
Why: Showing catalog races inside the selected calendar made the page feel misleading and broke trust by implying the runner had already picked targets they never saved.
Rollback target: `DV-2026-04-12-07`
Notes: Verified in the same frontend lint/build/runtime-sync round as the `/today-run` personalization update.

### Version: DV-2026-04-12-21
Date: 2026-04-12
Surface: Analysis drill-down detail pages on `/analysis/*`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reframed the new analysis drill-down pages into a more cinematic Hermes detail language with asymmetrical hero sheets, floating glass chips, stronger tonal layering, and less utility-card stacking so the detail routes now read like premium editorial analysis surfaces instead of generic dashboard expansions.
Why: The initial drill-down routes were functionally correct, but they still felt too much like stacked summary cards and did not fully express the Kinetic Editorial design rules from `design.md`.
Rollback target: `DV-2026-04-12-20`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and a tiny sidebar-label normalization in `Shoes.jsx` was included only to clear an unrelated parser issue that was blocking verification.

### Version: DV-2026-04-12-20
Date: 2026-04-12
Surface: Analysis drill-down navigation on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/App.jsx`, `frontend/src/utils/analysisInsights.js`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Turned the main analysis overview cards into interactive drill-down cards, extracted the shared analysis calculations into a dedicated helper, and added new full-detail routes for load balance, intensity split, injury risk, and coach insight while preserving the existing VO2 and marathon prediction detail paths.
Why: The analysis overview had rich summary cards, but most of them stopped at the overview screen, which made the page feel shallower than the rest of Hermes' runner-facing drill-down flows.
Rollback target: `DV-2026-04-12-15`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and the new detail-route bundle is now part of the live local site.

### Version: DV-2026-04-12-19
Date: 2026-04-12
Surface: Recent shoe-rotation signal on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Moved the shoe-performance recommendation block from the lower intel rail to the top of the inventory stage and redesigned it into a full-width editorial signal bar with recent-window pills, a stronger highlight card, and inline source/meta chips that match the current dark shoes shell.
Why: The old recommendation card sat too low in the page and used a dated panel treatment, while its fallback logic was judging shoes from all available runs instead of the runner's current block.
Rollback target: `DV-2026-04-12-18`
Notes: The recommendation logic now only reads the recent 21-day run window for both comparative shoe insights and fallback suggestions; frontend lint/build passed, the synced local bundle refreshed, and `http://localhost:8080` returned `200`.

### Version: DV-2026-04-12-18
Date: 2026-04-12
Surface: Shoe image import studio on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the shoe photo picker modal into a darker editorial import studio with a stronger shoe-specific hero, a left-side current/upload/URL control rail, a clearer pending-preview state, and a larger search-result gallery while preserving the same live upload, paste, search, apply, and clear-photo flows.
Why: The old shoe image picker still looked like a utility modal with thin rows and generic inputs, which felt visually out of step with the newer premium shoes inventory surface.
Rollback target: `DV-2026-04-12-17`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200` after the redesign.

### Version: DV-2026-04-12-17
Date: 2026-04-12
Surface: Settings shell alignment and editorial refresh on `/settings`
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Aligned `/settings` to the current shared runner dashboard shell with the collapsible sidebar and simplified topbar, then reshaped the page into a more editorial control-room surface with a new identity/status hero, stronger card layering, and cleaner hierarchy across account, preferences, integrations, digest, and danger sections while preserving all live settings and import flows.
Why: The settings route was still on an older shell branch and its layout read more like a plain utility form than the newer premium runner surfaces, which made it feel out of step with the rest of the signed-in app.
Rollback target: `DV-2026-04-12-16`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and the live local bundle refreshed successfully.

### Version: DV-2026-04-12-16
Date: 2026-04-12
Surface: Prediction detail shell alignment on `/prediction/:distKey`
Files: `frontend/src/pages/PredictionDetail.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Aligned the prediction detail route to the current signed-in runner dashboard shell by adding the shared collapsible sidebar framing, reducing the sidebar footer to the primary workout CTA, and matching the topbar structure used by the newer runner pages.
Why: The prediction detail route was still using an older shell branch, which made `/prediction/marathon` feel visually detached from the recently updated analysis and runner dashboard pages.
Rollback target: `DV-2026-04-12-15`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and the live local bundle refreshed successfully.

### Version: DV-2026-04-12-15
Date: 2026-04-12
Surface: VO2max shell alignment on `/analysis/vo2max`
Files: `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the VO2max detail route onto the current shared runner dashboard shell with the collapsible sidebar, simplified topbar, runner-footer treatment, and a new in-canvas editorial intro band so the page now matches the recent design direction used on analysis, races, shoes, and the other signed-in runner surfaces.
Why: `/analysis/vo2max` was still using an older analysis-only shell branch, so it felt visually detached even after the shared signed-in pages had converged on the newer runner dashboard language.
Rollback target: `DV-2026-04-12-14`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200` after the shell alignment.

### Version: DV-2026-04-12-14
Date: 2026-04-12
Surface: Analysis shell alignment on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Aligned `/analysis` to the current signed-in runner dashboard shell by adding the shared collapsible sidebar framing, reducing the sidebar footer to the primary workout CTA, and matching the topbar structure used by the newer runner pages.
Why: The analysis route was still using an older shell branch, so even after the left-header cleanup it still felt visually detached from profile, runs, races, schedule, and shoes.
Rollback target: `DV-2026-04-12-13`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and the live local bundle refreshed successfully.

### Version: DV-2026-04-12-13
Date: 2026-04-12
Surface: VO2 trend chart correctness on `/analysis/vo2max`
Files: `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rebuilt the VO2 detail chart so the representative line is now sampled into a readable 90-day trend instead of being drawn as an over-dense stair-step, then tightened the chart rendering with a defined plot area, better axis spacing, lighter run dots, and a filled trend layer that makes the line and scatter feel like one coherent view.
Why: The previous graph looked logically wrong and visually broken because the trend series was plotted too densely against per-run points, which flattened the line and made it feel disconnected from the actual samples.
Rollback target: `DV-2026-04-12-12`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and `http://localhost:8080` returned `200` after the chart fix.

### Version: DV-2026-04-12-12
Date: 2026-04-12
Surface: Analysis header cleanup on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the three left-side analysis header tabs and replaced them with the same single active red section label used by the other signed-in runner pages.
Why: `/analysis` was still using an older multi-tab left header treatment, which looked inconsistent after the shared shell was simplified to one active red label on the other pages.
Rollback target: `DV-2026-04-12-11`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and the live local bundle refreshed successfully.

### Version: DV-2026-04-12-11
Date: 2026-04-12
Surface: Shared signed-in runner header left-nav cleanup on `/profile`, `/runs`, `/races`, `/schedule`, `/shoes`, `/today-run`, `/prediction/:distKey`, and `/rewards`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/TodayRun.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/Rewards.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the small left-side header buttons that repeated dashboard and related page links inside the signed-in runner topbar, leaving the main sidebar as the primary navigation surface while keeping the right-side utility controls intact.
Why: Those inline header buttons were duplicating the sidebar navigation and made the shell feel busy, especially on `/profile` where they sat directly beside the marked dashboard area.
Rollback target: `DV-2026-04-12-10`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and the live local bundle refreshed successfully.

### Version: DV-2026-04-12-10
Date: 2026-04-12
Surface: Dedicated add-shoes browser flow on `/add-shoes` and shoes CTA routing
Files: `frontend/src/App.jsx`, `frontend/src/pages/AddShoes.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rewired the signed-in shoes add CTA into a dedicated `/add-shoes` route and rebuilt that flow as a full-page dark browser surface with the current Hermes dashboard shell, a brand rail, category/type chips, model grid, right-rail status cards, and a live add form that posts the selected or manually entered shoe into the inventory.
Why: The new shoe inventory shell still handled adding shoes through an old modal, while the requested flow called for a real page using the first reference’s brand-browser layout and the current Hermes signed-in design language.
Rollback target: `DV-2026-04-12-09`
Notes: The add-shoe topbar CTA on `/shoes` now opens `/add-shoes`, and browser quick-pick selections route into the same page with the brand/model prefilled.

### Version: DV-2026-04-12-09
Date: 2026-04-12
Surface: Shared signed-in runner topbar actions on `/profile`, `/runs`, `/races`, `/schedule`, `/shoes`, `/analysis`, `/prediction/:distKey`, `/rewards`, and `/analysis/vo2max`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/Rewards.jsx`, `frontend/src/pages/Vo2MaxDetail.jsx`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the extra pill buttons that were sitting in the signed-in topbar next to the notifications/settings/avatar cluster, so those pages now keep only the icon controls on the right side while preserving the primary sidebar CTA and each page's main content behavior.
Why: The duplicated topbar pills were repeating actions that already existed elsewhere in the shell, making the header feel crowded and visually inconsistent with the cleaner dashboard direction.
Rollback target: `DV-2026-04-12-08`
Notes: Frontend lint passed, the frontend build synced the updated bundle into the backend static output, and the local live bundle refreshed successfully.

### Version: DV-2026-04-12-08
Date: 2026-04-12
Surface: VO2 detail header balance on `/analysis/vo2max`
Files: `frontend/src/styles/style.css`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Centered the `/analysis/vo2max` page title block against the full signed-in topbar instead of letting it drift inside the left cluster, while preserving the back link on the left and the notifications/settings/avatar block on the right. Mobile keeps the stacked left-aligned fallback.
Why: The large VO2 detail title was reading visibly off-center because the page-specific topbar flex rules were balancing the left and right groups rather than the title itself.
Rollback target: `DV-2026-04-12-07`
Notes: Frontend lint passed, the frontend build synced into the backend static bundle, and `http://localhost:8080` returned `200` after the update.

### Version: DV-2026-04-12-07
Date: 2026-04-12
Surface: Race discovery imagery on `/races`
Files: `frontend/src/pages/Races.jsx`, `frontend/src/data/worldRaceCatalog.js`, `backend/src/main/java/com/hermes/backend/RaceController.java`, `backend/src/main/java/com/hermes/backend/RaceOfficialImageService.java`, `DESIGN_VERSIONS.md`
What changed: Replaced the static generic race-discovery hero art flow with official-site marathon imagery for seeded major races by adding official website metadata to the race catalog, a backend official-image scraper endpoint, and frontend discovery cards that prefer each race's scraped official website image over the old placeholder visuals.
Why: The race discovery cards were using unrelated stock or AI-style images, which weakened trust and made events like Tokyo, Osaka, and NYC Marathon feel disconnected from their real organizers.
Rollback target: `DV-2026-04-12-06`
Notes: Frontend lint/build passed, backend compile passed, backend runtime sync returned `PASS`, and `http://localhost:8080` returned `200`; live official images still depend on the target race websites remaining reachable and exposing a usable `og:image`, `twitter:image`, or inline hero image.

### Version: DV-2026-04-12-06
Date: 2026-04-12
Surface: Analysis VO2 drill-down on `/analysis` and `/analysis/vo2max`
Files: `frontend/src/App.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/Vo2MaxDetail.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Turned the main VO2 hero on `/analysis` into a real drill-down target and added a new signed-in `/analysis/vo2max` page that matches the current Hermes dashboard shell while showing the full per-run VO2 history overlaid with the rolling 90-day representative trend, plus supporting summary and interpretation panels.
Why: The old Hermes experience exposed a dedicated VO2 graph view, but the rebuilt analysis shell only kept a compressed six-bar summary in the hero card. Runners needed a direct path from the headline VO2 surface into the full historical chart without falling back to old UI language.
Rollback target: `DV-2026-04-12-05`
Notes: Frontend lint passed; frontend build synced the new route into the Spring-served static bundle; `http://localhost:8080` returned `200` after sync.

### Version: DV-2026-04-12-05
Date: 2026-04-12
Surface: Shoes shell alignment on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Removed the old authenticated top-nav chrome from `/shoes` and rewired the existing premium Running Shoes inventory surface into the shared signed-in Hermes dashboard shell with the collapsible sidebar, signed-in topbar actions, and shared footer used by the other upgraded runner pages.
Why: The shoe inventory content had already been redesigned, but the route was still framed by the older Hermes app chrome, which made it feel visually detached from the newer signed-in runner experience.
Rollback target: `DV-2026-04-12-04`
Notes: Frontend lint passed; frontend build/runtime sync and local health verification were run after the shell migration.

### Version: DV-2026-04-12-04
Date: 2026-04-12
Surface: Runs route-preview loading on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `DESIGN_VERSIONS.md`
What changed: Adjusted the Runs route-preview loader so visible cards preload route points in a bounded queue with light prefetching beyond the current batch and retry behavior for transient misses, helping older recent-run cards keep their route thumbnails as the user scrolls down the list.
Why: The first route-preview pass favored the top few recent runs, and later visible run cards could stay on the empty fallback thumbnail when point fetches lagged or transiently failed.
Rollback target: `DV-2026-04-12-03`
Notes: Frontend build/runtime sync completed and `http://localhost:8080` returned `200`; frontend lint still reports unrelated pre-existing warnings in `frontend/src/pages/Shoes.jsx`.

### Version: DV-2026-04-12-03
Date: 2026-04-12
Surface: Running Shoes inventory redesign on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Reshaped the top of `/shoes` into the stricter Stitch Running Shoes Inventory composition with a floating search-and-add top bar, a simplified hero and All/Active/Retired pill set, and horizontal editorial shoe cards that foreground photo, mileage, lifespan, and quick manage actions while preserving the deeper Hermes browser, metrics, performance, and duplicate-management sections below.
Why: The prior shoes surface kept the live logic but read more like an internal tool than the provided premium inventory reference, so it needed a tighter screenshot-first hierarchy without losing real shoe-management behavior.
Rollback target: `DV-2026-04-12-02`
Notes: Frontend lint passed, the Vite build synced the updated `/shoes` bundle into both backend static directories, and `http://localhost:8080` returned `200`; the frontend runtime-sync helper reported a stale CSS false negative because the shared hashed stylesheet filename stayed unchanged while the new JS bundle and live behavior updated correctly.

### Version: DV-2026-04-12-02
Date: 2026-04-12
Surface: Runs route thumbnails on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Replaced the abstract Runs card thumbnails with lightweight route-preview tiles that draw each visible run's real GPS path on a map-style surface, while preserving the existing run cards, metrics, and drill-down behavior.
Why: The old thumbnail blocks looked decorative instead of useful, and the reference direction called for route-like previews that feel closer to real run maps.
Rollback target: `DV-2026-04-12-01`
Notes: Verification passed with frontend lint, frontend build/runtime sync, backend compile, and a `200` response from `http://localhost:8080`; one frontend sync attempt hit a transient locked `backend/target/classes/static/assets` cleanup issue and succeeded after a safe local asset-dir clear plus rerun.

### Version: DV-2026-04-12-01
Date: 2026-04-12
Surface: Runs, Races, and Schedule shell alignment on `/runs`, `/races`, and `/schedule`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/pages/Races.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Reframed `/runs`, `/races`, and `/schedule` inside the shared signed-in runner dashboard shell so these runner-facing routes now use the same collapsible sidebar, topbar, and footer language as `/profile` while preserving their existing history, race planning, and weekly scheduling content and live actions.
Why: Those routes still felt visually detached from the profile dashboard shell, which made the signed-in experience inconsistent even though the underlying Hermes route behavior was already working.
Rollback target: `DV-2026-04-11-35`
Notes: Verification pending for frontend lint/build/runtime sync after the shell alignment round.

### Version: DV-2026-04-11-35
Date: 2026-04-11
Surface: Profile shell refinement on `/profile` plus new public legal pages on `/terms` and `/privacy`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/LegalPage.jsx`, `frontend/src/App.jsx`, `frontend/src/i18n/translations.js`, `frontend/src/styles/style.css`, `frontend/src/pages/Landing.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/pages/Rewards.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/Settings.jsx`, `DESIGN_VERSIONS.md`
What changed: Cleaned the signed-in profile nav labels, removed redundant settings/history shell actions, added a collapsible desktop sidebar that shrinks into an icon rail, and introduced real bilingual public Terms and Privacy pages that are now linked from the existing public and signed-in footer entry points.
Why: The profile shell still had noisy nav wording and a permanently wide left rail, while legal links across Hermes were still dead placeholders instead of trustworthy destination pages.
Rollback target: `DV-2026-04-11-34`
Notes: Verification passed with frontend lint, frontend build/runtime sync, backend compile, and a `200` response from `http://localhost:8080`; the worktree still contains unrelated pre-existing changes, so this round was left uncommitted locally.

### Version: DV-2026-04-11-34
Date: 2026-04-11
Surface: Rewards / premium runner rewards shell on `/rewards`
Files: `frontend/src/pages/Rewards.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/rewards` onto the signed-in dark Stitch shell with a premium progress hero, upcoming-focus side rail, earned and upcoming badge galleries, and preserved live reward showcase, progress-bar, and earned/upcoming badge logic in both populated and empty states.
Why: Rewards was one of the last runner-facing routes still sitting on the older generic authenticated card shell, which made the badge system feel detached from the rest of the premium signed-in Hermes product.
Rollback target: `DV-2026-04-11-33`
Notes: Verification passed with frontend build/runtime sync, backend compile, and a `200` response from `http://localhost:8080`.

### Version: DV-2026-04-11-33
Date: 2026-04-11
Surface: Prediction Detail / premium analysis-shell rebuild on `/prediction/:distKey`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/prediction/:distKey` into the signed-in dark analysis shell with a prediction hero band, signal and confidence sidecards, preserved weekly trend and actual-runs charts, and a premium normalized-runs table that still links back to `/analysis` and into individual run details.
Why: Prediction Detail was still using the older generic card shell even though it is part of the same race-prediction flow as the already-upgraded deep analysis surface.
Rollback target: `DV-2026-04-11-32`
Notes: Verification passed with frontend build/runtime sync, backend compile, and a `200` response from `http://localhost:8080`.

### Version: DV-2026-04-11-32
Date: 2026-04-11
Surface: Today's Run / premium daily coach redesign on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/today-run` into a premium dark daily-coach surface with the shared signed-in Stitch shell, a first-screen recommendation hero, live confidence and recovery signals, an integrated weather adjustment callout, a coach-side execution panel, a structured session-plan stack, and a reasons rail that keeps the existing Hermes recommendation, coach, and weather logic intact.
Why: Today's Run is the highest-priority runner decision screen and was still on the older card shell, which made the recommendation feel less trustworthy and less connected to the newer signed-in Hermes navigation and coaching surfaces.
Rollback target: working tree before this change
Notes: Verification passed with frontend build/runtime sync, backend compile, and a `200` response from `http://localhost:8080`; direct ESLint CLI remains blocked by the repo's ESLint v9 config mismatch.

### Version: DV-2026-04-11-31
Date: 2026-04-11
Surface: Muscle Training / stitch shell recovery and live planner reintegration on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Reattached the approved dark Stitch shell on `/muscle-training` with the fixed top bar, nav rail, premium hero, protocol strip, focus rail, coaching cues, recovery-impact card, and mobile dock while keeping the real Hermes check-in, preferences, weekly status, rationale, and 7-day strength planner inside the preserved lower control deck.
Why: The prior recovery round had to restore `MuscleTraining.jsx` to a healthy baseline after a failed shell edit, which kept the repo safe but temporarily regressed the page away from the approved premium design direction.
Rollback target: `DV-2026-04-11-21`
Notes: Verification passed with frontend lint, frontend build, backend compile, frontend runtime sync, and a `200` response from `http://localhost:8080`; the stitched shell is now restored without reintroducing the earlier parser break.

### Version: DV-2026-04-11-30
Date: 2026-04-11
Surface: Recent Runs / populated-history insight-strip follow-up on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/utils/format.js`, `DESIGN_VERSIONS.md`
What changed: Added a compact live insight strip above the populated recent-run cards so runners can scan activity count, active days, fastest pace, and longest run at a glance, while also correcting shared Chinese distance and pace unit copy in the formatting utility used by the runs surface.
Why: The strict Stitch recent-runs shell looked right structurally, but the page still lacked one fast pattern-recognition layer and still carried mistranslated unit labels that weakened trust on bilingual output.
Rollback target: `DV-2026-04-11-29`
Notes: Verification passed with frontend lint, frontend build, backend compile, frontend runtime sync, and a `200` health check on `http://localhost:8080`; a separate attempt to reattach the Stitch shell on `/muscle-training` was backed out and is not part of this version.

### Version: DV-2026-04-11-29
Date: 2026-04-11
Surface: Recent Runs / strict Stitch populated-history redesign on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/scripts/run-vite-build.mjs`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the populated `/runs` state into the approved dark Stitch recent-runs composition with a compact top bar, editorial nav ribbon, cinematic hero, tighter activity and date filter chips, and richer run cards that keep the real Hermes run-history filters, sorting, pagination, drill-down behavior, and manual import modal intact; also hardened the frontend build sync script so the live backend asset mirror repopulates correctly before runtime verification.
Why: The previous Hermes Log activity history no longer matched the new screenshot-led desktop reference, and the runtime-sync path needed a small adjacent fix so the rebuilt page could be verified honestly against the live backend bundle.
Rollback target: `DV-2026-04-11-25`
Notes: The true-empty Integration Alert branch on `/runs` remains separate and still only renders when the account has zero activities; the Stitch history shell only applies once real activities exist.

### Version: DV-2026-04-11-28
Date: 2026-04-11
Surface: Shoes / Running Shoes Inventory strict Stitch redesign on existing shoes route
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the visible shoes route into the approved dark Running Shoes Inventory composition with a floating top bar, oversized inventory hero, category and sort chips, image-led inventory cards, a lower brand-browser panel, a right-side metrics/watchlist rail, and preserved performance plus duplicate-review sections while keeping live Hermes add, edit, photo upload, retire, delete, mileage-health, and catalog-browser behavior wired.
Why: The earlier Shoes page still reflected the older Shoe Vault direction, while the new screenshot calls for a stricter inventory-first hierarchy that surfaces current rotation, backups, and replacement risk at a glance without losing real Hermes shoe-management capability.
Rollback target: `DV-2026-04-11-03`
Notes: Frontend lint, frontend build, and runtime sync all passed after the redesign; the screenshot shell now owns the visible inventory surface while the real Hermes browser, watchlist, and performance logic remain active underneath.

### Version: DV-2026-04-11-27
Date: 2026-04-11
Surface: Race Center / strict Stitch desktop redesign on `/races`
Files: `frontend/src/pages/Races.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/races` into the approved dark desktop Race Center shell with a fixed top utility bar, desktop nav rail, cinematic countdown hero for the next target race, a four-card personal-bests strip sourced from real activity data, editorial race-discovery feature cards with live search and country filtering, and a selected-calendar list that still opens the real race modal for add/edit management.
Why: The previous `/races` page still followed the earlier mobile planner layout, while the user supplied a final desktop-first Race Center reference and asked for a strict screenshot-led implementation that preserves real Hermes countdown, discovery, records, and race-goal flows.
Rollback target: `DV-2026-04-11-08`
Notes: Frontend lint, frontend build, and runtime sync all passed after the redesign; the old map-first discovery block was replaced by the screenshot-led editorial discovery section, but real catalog search/filtering and race CRUD behavior remain live through the new shell.

### Version: DV-2026-04-11-26
Date: 2026-04-11
Surface: Run Detail / strict Stitch desktop redesign on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the run detail surface into the approved dark Stitch composition with a compact top bar, large live route map hero, right-side stat rail for distance/pace/time, a physiology panel driven by lap heart-rate data, a structured splits table with expandable rows, an efficiency card, a linked-gear card, and preserved lower analytics blocks for performance, route intelligence, and elevation.
Why: The previous Hermes run-detail page still used the earlier Activity Insights shell, while the new screenshot called for a stricter desktop-first map-plus-metrics hierarchy that keeps the real Hermes analytics, shoe linking, Strava resync, and elevation recalibration behavior intact.
Rollback target: `DV-2026-04-11-12`
Notes: Frontend lint, frontend build, and live static-bundle sync all passed after the redesign; the live route map, physiology chart, splits table, and preserved Hermes support actions are now aligned to the new desktop reference.

### Version: DV-2026-04-11-25
Date: 2026-04-11
Surface: Activities / Integration Alert empty-state redesign on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the old Awaiting Data branch on true-empty `/runs` accounts with a stricter Stitch-style Integration Alert layout featuring the warm interruption band, oversized reconnect/import hero, pipeline-status right rail for Strava/manual/Garmin paths, and a fallback manual-import support card while preserving the live Strava authorize-or-sync action and the existing workout-file import modal.
Why: The new reference is an integration-warning state rather than a generic empty-state hero, and `/runs` is the most appropriate live Hermes surface because it already gates on missing activity data while wiring the real Strava and manual import behavior.
Rollback target: `DV-2026-04-11-23`
Notes: This redesign only changes the true-empty no-data branch; populated activity history, filtering, sorting, and run-detail navigation remain unchanged.

### Version: DV-2026-04-11-24
Date: 2026-04-11
Surface: Signup / Stitch editorial redesign on `/signup`
Files: `frontend/src/pages/Signup.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/signup` into the approved dark Stitch editorial auth surface with a cinematic runner backdrop, oversized Outrun Your Limits hero, glass signup panel, Strava-first CTA, inline email account creation with confirm-password validation, compact security-requirements block, secondary Google signup, and a matching verification-done state while preserving real Hermes signup, OAuth, verification, and redirect behavior.
Why: The existing signup flow still used the older expandable auth shell, while the user supplied a final Stitch signup screenshot and asked for a strict screenshot-led implementation that keeps the real Hermes account-creation flow working.
Rollback target: `DV-2026-04-11-02`
Notes: The page keeps the live password-rule fetch, Strava status banner handling, Google and Strava OAuth starts, and verification-required completion state instead of replacing them with a static marketing form.

### Version: DV-2026-04-11-23
Date: 2026-04-11
Surface: Activities / Awaiting Data empty-state redesign on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Added a screenshot-led premium Awaiting Data state to the true-empty Activities surface on `/runs` with the shared dark Stitch shell, centered sync hero, Strava-first connect CTA, honest secondary manual-import CTA, and three editorial value cards for analytics, prediction, and gear while preserving the live run-history page for accounts that already have activities.
Why: The user supplied a final Awaiting Data reference for the no-data experience and asked for it to live on the most appropriate real Hermes surface without inventing a disconnected route or breaking the actual onboarding and import flows.
Rollback target: `DV-2026-04-11-11`
Notes: This state only renders when the account truly has no synced activities; filter-empty or search-empty states still use the normal runs experience instead of the onboarding screen.

### Version: DV-2026-04-11-22
Date: 2026-04-11
Surface: User Settings / Stitch desktop redesign on `/settings`
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/settings` into the approved dark Stitch desktop settings surface with the shared premium nav shell, oversized Settings header, account-info card, preferences and security cards, right-rail data ecosystem controls, weekly-brief tile, danger-zone panel, and preserved live display-name save, language, theme, unit, Strava connect/disconnect, Garmin import, manual FIT/GPX import, and logout flows.
Why: The existing settings page still used the older generic account/preferences layout, while the user supplied a final premium desktop Stitch reference and asked for a strict settings-only implementation that keeps real Hermes controls working.
Rollback target: `DV-2026-04-11-09`
Notes: The weekly brief toggle and profile mantra field are browser-local only because Hermes does not currently expose server-backed settings for those preferences.

### Version: DV-2026-04-11-21
Date: 2026-04-11
Surface: Muscle Training / strict Stitch weight-training redesign on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the visible `/muscle-training` surface into the approved dark Stitch weight-training reference with a fixed editorial top bar, left nav rail, oversized kinetic hero, protocol-first exercise list, coach-cue sidebar, recovery-impact card, and a preserved Hermes control deck underneath for check-in, preferences, rationale, and rolling 7-day planning.
Why: The earlier muscle-training pass improved the workout-detail header, but the user then provided a stricter desktop weight-training reference and asked for the existing live route to match that screenshot much more closely without dropping real strength-planning behavior.
Rollback target: `DV-2026-04-11-07`
Notes: The screenshot shell now owns the first screen while the live Hermes strength engine, exercise prescriptions, coach explanations, and planner controls remain operational below the fold instead of being replaced by a static mock.

### Version: DV-2026-04-11-20
Date: 2026-04-11
Surface: Training Schedule / Stitch desktop redesign on `/schedule`
Files: `frontend/src/pages/Schedule.jsx`, `frontend/src/App.jsx`, `frontend/src/components/TopNav.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Added a first-class signed-in `/schedule` surface and rebuilt it into the dark Stitch weekly-planning reference with a dedicated sidebar/topbar shell, oversized Weekly Velocity hero, seven-day schedule strip, readiness ring, next-session preview, planned-route card, coach insight rail, and current-gear card driven by live Hermes profile, activity, coach-state, coach-schedule, and shoe data.
Why: Hermes did not actually have a real `/schedule` route yet, but the user supplied a final Stitch training-plan reference and asked for a strict screenshot-led implementation that preserves live coach planning instead of turning the page into a static mock.
Rollback target: `DV-2026-04-11-05`
Notes: `/today-run` remains intact as the execution/detail surface; `/schedule` is now the dedicated weekly planning view and the shared signed-in nav points to it.

### Version: DV-2026-04-11-19
Date: 2026-04-11
Surface: Deep Analysis / Stitch desktop redesign on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the signed-in deep-analysis surface into the dark Stitch desktop reference with a fixed nav rail, sticky top bar, large VO2 hero card, ACWR gauge, AI coach insight card, 80/20 intensity panel, injury-risk panel, marathon forecast tile, and a full race-prediction table while preserving live Hermes profile, activity, import, rename, VO2, ACWR, injury, and prediction wiring.
Why: The previous mobile-first analysis shell no longer matched the new approved desktop Stitch reference, and the user explicitly asked for a strict screenshot-led implementation on the existing `/analysis` route.
Rollback target: `DV-2026-04-11-10`
Notes: Import-data and profile-name edit flows are preserved as lower-visibility actions inside the new shell so the page stays operational instead of becoming a static mock.

### Version: DV-2026-04-11-18
Date: 2026-04-11
Surface: Runner home / Stitch dashboard redesign on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/App.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the signed-in runner home into the dark Stitch dashboard reference by moving `/profile` onto a new premium dashboard shell with a fixed top bar, left-side nav rail, readiness card, cinematic suggested-workout hero, weekly load chart, recent-session rail, and live bottom metric strip driven by Hermes profile, activity, and coach-state data.
Why: The approved Stitch dashboard is clearly a runner home, but Hermes currently uses `/dashboard` for the admin console; mapping the new design onto `/profile` preserves the admin workflow while giving runners the requested first-glance dashboard.
Rollback target: `DV-2026-04-11-06`
Notes: The legacy `frontend/src/pages/Profile.jsx` remains in the tree as rollback context while `/profile` now renders the new dashboard component.

### Version: DV-2026-04-11-17
Date: 2026-04-11
Surface: Public landing / strict Stitch polish pass
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Tightened the dark public landing against the screenshot with more exact top-nav labels and actions, stronger hero contrast, closer button sizing, a more compact story section, a denser analytics grid, and a more screenshot-faithful final redline section while keeping the live Strava, login, and signup routes intact.
Why: The first Stitch implementation landed the right structure, but the screenshot still showed noticeable differences in the top bar, hero rhythm, section density, and CTA treatment that were worth correcting in a focused polish pass.
Rollback target: `DV-2026-04-11-16`
Notes: This is a screenshot-tightening pass, not a structural landing rewrite.

### Version: DV-2026-04-11-16
Date: 2026-04-11
Surface: Public landing / Stitch dark editorial redesign
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the public `/` landing page into the new dark editorial Stitch reference with a fixed premium top bar, cinematic hero, right-aligned intensity and VO2 decals, an “Architecture of Speed” story section, an elite analytics grid, and a large final redline CTA while keeping real Strava, login, and signup entry behavior wired.
Why: The restored repo-baseline landing page was functional again, but the user then provided a new final Stitch direction and asked for a strict landing-only implementation that matches the darker Hermes marketing language more closely.
Rollback target: `DV-2026-04-11-14`
Notes: This round updates only the public landing surface and shared styles/copy needed for it; signed-in pages and auth routing behavior remain intact.

### Version: DV-2026-04-11-15
Date: 2026-04-11
Surface: Login / Stitch dark editorial auth redesign
Files: `frontend/src/pages/Login.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the restored baseline `/login` page into the new dark Stitch reference with an editorial left-side brand story, warm cinematic background treatment, a glass login card, always-visible Strava and Google CTAs, an inline email sign-in form, and lower-right legal links while preserving the real verification, resend, routing, and OAuth/email auth flows.
Why: The repo-baseline restore fixed the previously broken login surface, but the user then supplied a new final Stitch reference and asked for a strict login-only implementation on top of that stable baseline.
Rollback target: `DV-2026-04-11-14`
Notes: This round only changes the login page and shared auth styling/copy needed for it; signup and the rest of the restored frontend baseline were left alone.

### Version: DV-2026-04-11-14
Date: 2026-04-11
Surface: Frontend-wide rollback to `origin/main` repo baseline
Files: `frontend/**`, `backend/src/main/resources/static/**`, `DESIGN_VERSIONS.md`
What changed: Restored the full tracked frontend tree to `origin/main` from `https://github.com/520HXC/run.git`, removed extra untracked frontend-only pages/components created by later redesign rounds, and rebuilt the live static bundle so the local website matches the repo reference again.
Why: The latest redesign stack had drifted too far from the GitHub project baseline and the login/auth surface was visibly broken, so the safest fix was to restore the website to the repo’s known reference implementation.
Rollback target: working tree before this change
Notes: This is a repo-baseline restoration, not a fresh redesign. Backend runtime logic outside the frontend tree was left alone.

### Version: DV-2026-04-11-13
Date: 2026-04-11
Surface: Login / editorial split-screen redesign
Files: `frontend/src/pages/Login.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the live login page into the new split-screen editorial auth reference with a blurred left-side action panel, stronger stacked headline, Strava-first CTA, cleaner Google and email access buttons, compact email form reveal, and anchored brand/legal footer treatment over the runner photography background.
Why: The previous login redesign preserved auth behavior but still read like the earlier cinematic shell rather than the more exact split editorial composition the user approved.
Rollback target: working tree before this change
Notes: The redesign keeps the real Strava, Google, email login, verification-banner, and resend-verification flows intact while matching the new visual hierarchy more closely.

### Version: DV-2026-04-11-12
Date: 2026-04-11
Surface: Run Detail / Activity Insights redesign
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the live `/run/:id` surface into the new Activity Insights mobile reference with a custom top bar, cinematic hero, quick summary metrics, split-focused session breakdown, heart-rate decoupling hero, live route map card, support cards for elevation and source quality, and cleaner secondary panels for shoe linking, Strava resync, performance metrics, and route intelligence.
Why: The previous run-detail page exposed rich Hermes analytics but no longer matched the approved mobile-first activity-insights reference or its clearer session-review hierarchy.
Rollback target: working tree before this change
Notes: The redesign keeps real Hermes lap data, cardiac drift, Leaflet route rendering, elevation recalibration, shoe assignment, and Strava resync behavior instead of collapsing the page into a static showcase.

### Version: DV-2026-04-11-11
Date: 2026-04-11
Surface: Recent Runs / Runs page Hermes Log redesign
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the live `/runs` surface into the new Hermes Log mobile reference with a custom activity top bar, oversized editorial heading, stacked summary cards, pill-based time filters, compact sort controls, card-style recent-run entries, and a mobile bottom dock while preserving the real Hermes run-history filters, sorting, pagination, and tap-through run detail behavior.
Why: The previous Recent Runs page kept the right data depth but no longer matched the approved Hermes Log reference or its cleaner mobile-first activity-journal hierarchy.
Rollback target: working tree before this change
Notes: The redesign intentionally keeps year/month/day filtering and sort modes even though the reference is visually simpler, tucking them into quieter secondary controls so the surface stays live rather than becoming a static mock.

### Version: DV-2026-04-11-10
Date: 2026-04-11
Surface: Deep Analysis / Analysis page mobile redesign
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the live deep-analysis surface into the new Elite Analysis mobile reference with a custom top bar, large VO2 hero, simplified training-load card, injury and 80/20 micro-cards, race-prediction stack, coach-insight block, pace-zone section, VO2 progress chart, and a mobile bottom dock while preserving the real Hermes VO2, ACWR, prediction, import, and profile-edit flows.
Why: The previous analysis page had strong data depth but no longer matched the approved mobile-first performance-dashboard direction or the clearer information hierarchy from the new reference.
Rollback target: working tree before this change
Notes: The redesign intentionally keeps the import modal and underlying analysis calculations intact, and it also fixed previously malformed inline Chinese literals in the Daniels zone definitions that were blocking production builds.

### Version: DV-2026-04-11-09
Date: 2026-04-11
Surface: Account Settings / Profile Settings mobile redesign
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the live settings surface into the new mobile profile-settings reference with a dedicated top bar, profile hero, compact account-preference list, import-data cards for Strava/Garmin/COROS/Huawei, anchored preference detail cards, a large logout action, and a floating profile dock while preserving live display-name save, theme/language/unit controls, Strava connect-disconnect, manual file import, and Garmin import flows.
Why: The previous settings page kept the account controls but no longer matched the approved profile-settings reference or its simpler mobile-first hierarchy for preferences and integrations.
Rollback target: working tree before this change
Notes: The redesign intentionally keeps both the manual import modal and the Garmin credential import modal so the page remains a real settings and data-ingestion surface instead of a static profile mock.

### Version: DV-2026-04-11-08
Date: 2026-04-11
Surface: Race Center / Races page mobile redesign
Files: `frontend/src/pages/Races.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the live `/races` surface into the new mobile Race Center reference with a stripped top app bar, discovery/records/goals tab structure, map-first race discovery card, upcoming-race countdown block, tighter personal-best rows, a global highlight feature card, and a mobile bottom dock while keeping the real catalog search, country filtering, countdown logic, personal-best derivation, and add/edit/delete race flows.
Why: The previous Race Center pass had the right data depth but no longer matched the new approved mobile reference or its simpler tab-led information hierarchy.
Rollback target: `DV-2026-04-10-02`
Notes: The redesign intentionally keeps the real race-management modal and Leaflet-backed discovery behavior instead of replacing the page with a static mock.

### Version: DV-2026-04-11-07
Date: 2026-04-11
Surface: Muscle Training / workout-detail section
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Reframed the live `/muscle-training` surface around a new workout-detail hero and “Today’s Protocol” stack that uses the existing coach-derived strength session, exercise prescriptions, RPE targets, demo links, and localized exercise copy while preserving the check-in, preferences, rationale, and rolling 7-day planner below.
Why: The existing muscle-training page had the right logic depth but did not match the new workout-detail reference or make today’s strength slot feel immediately legible and actionable.
Rollback target: working tree before this change
Notes: The older top hero remains in the file as hidden legacy structure for safer rollback, but the visible page now follows the new workout-detail hierarchy.

### Version: DV-2026-04-11-06
Date: 2026-04-11
Surface: Training Profile / Profile page
Files: `frontend/src/pages/ProfileTraining.jsx`, `frontend/src/App.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the signed-in Profile surface into the new Training Profile language with a weekly-status hero card, live ACWR and next-key-run metrics, a training-logic card, strength-preference controls, an editorial focus block, and support cards for runner signals plus environment while keeping real Hermes data behind the layout.
Why: The previous signed-in profile was much denser and no longer matched the user-approved training-profile reference for Hermes’s main runner hub.
Rollback target: working tree before this change
Notes: The older `frontend/src/pages/Profile.jsx` was left intact as rollback-safe legacy context while `/profile` now routes to the new `ProfileTraining.jsx` surface.

### Version: DV-2026-04-11-05
Date: 2026-04-11
Surface: Weekly Schedule / Schedule feature
Files: `frontend/src/pages/Schedule.jsx`, `frontend/src/App.jsx`, `frontend/src/components/TopNav.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Added a new first-class signed-in Schedule feature with its own route and nav entry, built around the provided Velocity Prime reference with a cinematic hero, weekly target and phase micro-stats, a coach-shaped upcoming-session stack, a Garmin sync CTA, and a mobile bottom dock.
Why: Hermes did not yet have a dedicated weekly schedule surface, and the user requested this reference as a proper new feature instead of a mock or a rewrite of an unrelated page.
Rollback target: working tree before this change
Notes: The page is wired to existing activity and coach endpoints so it behaves like a live Hermes feature rather than a static design paste.

### Version: DV-2026-04-11-04
Date: 2026-04-11
Surface: Public landing / first page
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the public Hermes first page into the new editorial homepage reference with a cinematic runner hero, sticky glass top bar, metric intro cards, long-form feature storytelling, a three-step onboarding section, mobile bottom nav treatment, and real Strava/signup CTAs wired into the new structure.
Why: The previous landing page was a different marketing surface and no longer matched the user-approved homepage direction for Hermes’s public entrypoint.
Rollback target: working tree before this change
Notes: This is a landing-page redesign, not a login-page form rewrite; it preserves the real routing and Strava start behavior while replacing the public-first-screen design.

### Version: DV-2026-04-11-03
Date: 2026-04-11
Surface: Shoe Vault / Shoes page reference refinement
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Tightened the Shoes redesign to match the provided Shoe Vault reference more closely with a cleaner editorial hero subtitle, cleaner visible health/pace/mileage blocks, stronger The Lab brand storytelling, and safer bilingual surface copy while preserving the existing shoe vault behaviors and keeping the prior redesign structure available as rollback context.
Why: The previous Shoes redesign established the right hierarchy, but a few visible labels and reference details still needed to be brought closer to the approved mock so the live page felt finished instead of almost-there.
Rollback target: `DV-2026-04-11-01`
Notes: This is a refinement pass on top of the earlier Shoe Vault redesign, not a new behavior rewrite. It keeps the same inventory, image, catalog, and rotation workflows intact.

### Version: DV-2026-04-11-02
Date: 2026-04-11
Surface: Login and Signup auth surfaces
Files: `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt both auth pages into a cinematic Kinetic Editorial entry flow with a full-screen runner background, large editorial wordmark/taglines, stacked glassmorphic action buttons, and a shared immersive shell while preserving Strava, Google, email, verification, resend, and route-link behavior.
Why: The previous auth screens were functional but visually disconnected from the user-provided reference and no longer felt like a strong premium first impression for Hermes.
Rollback target: working tree before this change
Notes: Login and signup now share the same auth design language; signup success also uses the same cinematic shell instead of falling back to the older form-card layout.

### Version: DV-2026-04-11-01
Date: 2026-04-11
Surface: Shoe Vault / Shoes page
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the Shoes surface into a stronger Shoe Vault composition with a more editorial active-shoe hero, backup/specialist rotation rail, collection-style feature cards, a sharper brand explorer, and a cleaner featured-brand browser while preserving inventory management, image picking, health logic, catalog browsing, and localization.
Why: The previous Shoes page already had the right data depth, but it did not fully match the new design-pack hierarchy or premium visual language the user approved for the redesign series.
Rollback target: working tree before this change
Notes: This is the second bounded surface pass in the approved redesign series and intentionally keeps the existing Hermes shoe behaviors intact instead of replacing them with a static mock.

### Version: DV-2026-04-10-02
Date: 2026-04-10
Surface: Race Center / Races page
Files: `frontend/src/pages/Races.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the Races page into a more editorial Race Center with a dark kinetic hero for the next target race, countdown tiles, a personal-bests strip based on real runs, a stronger global race hub/map composition, and cleaner right-rail coach plus target panels while preserving add/edit/delete race flows.
Why: The previous Races surface was functional but visually flat and did not reflect the stronger Stitch reference language the user provided for Hermes.
Rollback target: DV-2026-04-10-01
Notes: This is the first surface-specific pass from the new design pack. It keeps existing race data, catalog search/filtering, and modal workflows intact.

### Version: DV-2026-04-10-01
Date: 2026-04-10
Surface: Shared signed-in light shell readability, Profile hero, top-nav user/menu contrast
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Re-established explicit light-mode text and line tokens on the shared `.dashboard-body` shell so signed-in pages stop inheriting pale dark-theme text variables on bright surfaces.
Why: Restore readable contrast across the Profile hero, summary cards, and top-nav account area after the full-site premium shell refresh left some light surfaces washed out.
Rollback target: working tree before this change
Notes: This is a contrast/stability fix, not a layout redesign. Dark and accessibility theme overrides still win through their more specific selectors.

### Version: DV-2026-04-08-01
Date: 2026-04-08
Surface: Profile page recommendation layout, shared theme palette, measurement-system UI, nav running label
Files: `frontend/src/pages/Profile.jsx`, `frontend/src/styles/style.css`, `frontend/src/contexts/UnitContext.jsx`, `frontend/src/utils/format.js`, `frontend/src/components/TopNav.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/i18n/translations.js`, `design.md`
What changed: Moved Profile's recommended run into a compact bar beneath Recent Runs, introduced the shared Hermes design system in `design.md`, smoothed shared light/midnight/high-contrast-light theme tokens, upgraded unit controls to full measurement-system semantics, and changed the top-nav running label to Running Profile / 跑步档案.
Why: Improve UI consistency, reduce theme drift, make Profile hierarchy cleaner, and align nav wording with the broader running hub.
Rollback target: working tree before this change
Notes: No design-specific commit hash was captured when this version was introduced, so restoring this exact version later may require using the file notes plus git history around the same date if available.
### Version: DV-2026-04-18-01
Date: 2026-04-18
Surface: Admin Portal / Race Course Maps workbench
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/dashboardCourseMapPreview.smoke.test.js`, `frontend/src/pages/dashboardCourseMapWorkbench.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the admin race course-map flow into a single-race workbench with a left-side race queue, a recommended-next-step status block, grouped source/analysis actions, larger pending-vs-live comparison panels, and stronger publish controls placed closer to the pending preview decision point.
Why: The previous admin course-map flow was optimized for generic review, not for repeatedly uploading, scanning, reanalyzing, and publishing one race at a time. The new workbench reduces context switching and makes the next operator action more obvious.
Rollback target: working tree before this change
Notes: This is an admin-only workflow redesign. It preserves the existing backend review actions and aligned preview component while reorganizing the operator experience around one-race iteration speed.

### Version: DV-2026-04-18-02
Date: 2026-04-18
Surface: Admin Portal / Race Course Maps publishing workspace refinement
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/dashboardCourseMapPreview.smoke.test.js`, `frontend/src/pages/dashboardCourseMapWorkspace.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the course-map review surface from a squeezed summary row into a quieter editorial publishing desk with a calmer queue rail, one dominant publish canvas, a stacked evidence column, and a grouped operations band beneath the decision surface. The comparison panels remain available lower on the page, but no longer compete with the primary publish call.
Why: The previous workbench still compressed recommendation, evidence, and actions into too many equal-weight cards. This pass restores clearer hierarchy so operators can understand what is ready, what is weak, and what to do next in one glance.
Rollback target: `DV-2026-04-18-01`
Notes: This is a structural refinement of the admin course-map workbench, not a backend workflow rewrite. It preserves the existing review actions, previews, and pipeline triggers while giving the publish decision materially more visual priority.

### Version: DV-2026-04-19-01
Date: 2026-04-19
Surface: Races Detail / lower world-map stage
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `frontend/src/utils/raceDetailMapLayering.smoke.test.js`, `frontend/src/utils/raceDetailMapVisualBaseline.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Promoted the lower `/races/details/:raceId` map block into a taller full-width OpenStreetMap stage with a compact floating HUD, changed the Leaflet host to a described map region, and moved the readiness/playbook card into a narrower supporting row below instead of keeping the old desktop split-grid layout.
Why: The previous lower section still treated the map like one peer card in a utility row, which weakened the spatial hierarchy and made the real-world map feel less central than the approved race-detail map-stage direction.
Rollback target: working tree before this change
Notes: This is a runner-facing map-stage refinement, not a backend route-pipeline rewrite. It keeps the existing route-only Leaflet rendering, trust logic, city fallback, and tile fallback behavior intact while clarifying the layout hierarchy.

### Version: DV-2026-04-19-02
Date: 2026-04-19
Surface: Races Detail / OSM basemap and AI-route emphasis
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/utils/raceDetailMapVisualBaseline.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Refined the lower race-detail map stage so the OpenStreetMap tiles stay visually cleaner underneath, while the AI-scanned route now renders through dedicated top-layer Leaflet panes with a bright backing stroke, stronger coral path, and route markers that sit explicitly above the basemap.
Why: The previous implementation already used Leaflet tiles plus an AI route, but the layering was implicit. This pass makes the bottom-layer map and top-layer scanned route visually unambiguous.
Rollback target: `DV-2026-04-19-01`
Notes: This is a visual/runtime layering refinement only. It preserves the existing route trust logic, city fallback, and non-image route presentation.

### Version: DV-2026-04-19-03
Date: 2026-04-19
Surface: Races Detail / basemap failover reliability
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/utils/raceDetailMapFallback.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a tile-load confirmation gate to the race-detail Leaflet basemap flow so the page no longer trusts the local tile proxy just because the layer mounted. If no real tile arrives quickly, the map now switches to the direct OpenStreetMap fallback instead of leaving the AI route over a blank gray canvas.
Why: The screenshot showed Leaflet controls and route overlays without any real-world tiles, which meant the map looked mounted but the basemap itself had failed. This pass makes blank-tile failure recover automatically.
Rollback target: `DV-2026-04-19-02`
Notes: This is a runtime reliability fix, not a visual redesign. It keeps the existing route-on-top layering and only hardens how the bottom-layer basemap is proven working.

### Version: DV-2026-04-19-04
Date: 2026-04-19
Surface: Races Detail / lower section simplification
Files: `frontend/src/pages/RacesDetail.jsx`, `frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the lower `race-detail-readiness-card` checklist/playbook block from `/races/details/:raceId`, stopped fetching saved-race data that only fed that card, and tightened the race-detail smoke guard so the lower section stays map-only.
Why: The user asked to remove the readiness companion and keep the lower area focused on the world-map stage itself.
Rollback target: `DV-2026-04-19-03`
Notes: This is a surface simplification only. The map stage, basemap failover path, and AI-route rendering remain unchanged.

### Version: DV-2026-04-19-05
Date: 2026-04-19
Surface: Admin Dashboard / shoes moderation tab
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the admin shoes moderation tab around the provided HERMES STITCH reference with a cinematic audit hero, darker search and database-health band, spotlight review cards, and a stronger global repository list while preserving the existing queue rail, moderation actions, bulk controls, catalog access, and sidebar shell.
Why: The previous shoes tab still read like a generic admin workbench. The user asked for this section to match the stronger reference composition without changing the left sidebar.
Rollback target: working tree before this change
Notes: This redesign is scoped to the shoes section only. Existing admin navigation and review behavior stay wired to the real Hermes data and modal flows.

### Version: DV-2026-04-19-06
Date: 2026-04-19
Surface: Admin Dashboard / shared right-side canvas width
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Removed the tighter shared width cap on the admin dashboard content container so the overview, users, shoes, jobs, audit, and course-map tabs can all expand farther to the right inside the existing main column. The left sidebar, its width, and its positioning stay unchanged.
Why: The user asked for the dashboard pages to fill the blank space on the right without touching the sidebar. The real bottleneck was the shared dashboard container width, not the per-tab content blocks.
Rollback target: `DV-2026-04-19-05`
Notes: This is a shell-width refinement only. It preserves the current tab layouts and simply gives them more horizontal room to breathe.

### Version: DV-2026-04-19-07
Date: 2026-04-19
Surface: Admin Dashboard / 赛事赛道图 comparison workspace
Files: `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Expanded the lower pending-vs-live comparison area in the course-map track hub by letting both the operations band and the review shell span the full stage width, then restoring the review cards to a real two-column comparison grid instead of squeezing them into the old narrow right-side lane.
Why: The provided screenshot showed the comparison previews and copy getting crushed together in the `赛事赛道图` workspace. The issue was the shell column assignment, not the sidebar or the preview component itself.
Rollback target: `DV-2026-04-19-06`
Notes: This is a layout-only fix for the course-map workspace. It preserves the sidebar, publish canvas, and the existing preview/review actions.

### Version: DV-2026-04-19-08
Date: 2026-04-19
Surface: Admin Dashboard / 赛事赛道图 footer workspace
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the lower course-map workspace against the supplied Admin Race Track Hub reference by replacing the broken stacked compare/evidence area with a cleaner three-panel footer: neural parameters, extraction output, and operator controls. The dominant map stage and left course-management rail remain intact, while the lower action area now uses wider reference-like panels instead of overlapping narrow cards and button columns.
Why: The previous iterative fixes left the bottom half of `赛事赛道图` structurally unstable. Resetting the footer to the reference’s three-column operator layout was safer and clearer than continuing to patch the broken stacked grids.
Rollback target: `DV-2026-04-19-07`
Notes: This redesign is scoped to the course-map workspace only. It preserves the existing sidebar shell, map preview engine, scan/upload/reanalyze/pipeline actions, and real Hermes race data wiring.

### Version: DV-2026-04-19-09
Date: 2026-04-19
Surface: Admin Dashboard / course-map command bridge
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Refined the `admin-track-hub-workspace-stack` into a denser command-bridge deck by making the publish canvas the dominant left-side panel, turning operator controls into a dedicated right-side lane, and compressing the review signals into a supporting block beneath the publish area. The existing course-map actions, evidence cards, preview wiring, and responsive collapse remain intact.
Why: The user asked to extend this grid into a denser multi-column command deck. The prior equal-weight three-panel footer still felt like adjacent cards instead of one coordinated command surface.
Rollback target: `DV-2026-04-19-08`
Notes: This is a hierarchy/layout refinement on top of the existing track-hub redesign. On narrower breakpoints the bridge collapses back to a single-column sequence so the denser desktop deck does not crowd the workspace.

### Version: DV-2026-04-19-10
Date: 2026-04-19
Surface: Admin Dashboard / course-map command bridge stabilization
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Repaired the broken command-bridge footer by replacing the fragile nested publish subgrid with a simpler publish-body wrapper, changing the footer panels from mixed flex-row behavior to safer stacked grid behavior, forcing the review signals back to a single-column support block, adding earlier desktop-to-single-column collapse for the bridge, and adding wrap-safe text rules for verdicts, headings, and metadata rows.
Why: The previous command-bridge refinement over-compressed the lower dashboard deck into narrow cards at medium desktop widths, which caused large text to spill vertically and made the section visually unusable.
Rollback target: `DV-2026-04-19-09`
Notes: This is a stabilization pass, not a new visual direction. It preserves the dark track-hub hierarchy of publish-left / ops-right on wide screens, but removes the brittle nested layout contract that caused catastrophic overflow.

### Version: DV-2026-04-19-11
Date: 2026-04-19
Surface: Admin Dashboard / course-map workspace full-width span
Files: `frontend/src/styles/style.css`, `frontend/src/pages/dashboardCourseMapTrackHubRefactor.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Fixed the remaining lower-deck squeeze by forcing `admin-track-hub-workspace-stack` to span the full width of the parent 12-column stage grid inside the course-map shell. The command bridge was already simplified, but the wrapper itself was still auto-placing into a single parent column, which compressed the entire lower workspace into a narrow strip. The smoke guard now explicitly requires that full-width span rule.
Why: The latest screenshot showed the whole lower dashboard deck crammed into a thin left-side band with empty space to the right, which pointed to a parent grid placement bug rather than only inner-card density.
Rollback target: `DV-2026-04-19-10`
Notes: This is a grid-placement correction, not a new visual redesign. It keeps the stabilized bridge contract and ensures the lower deck can actually use the full stage width it was designed for.

### Version: DV-2026-04-19-12
Date: 2026-04-19
Surface: Admin Dashboard / users command center
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/dashboardUsersCommandCenter.smoke.test.js`, `docs/superpowers/specs/2026-04-19-dashboard-users-command-center-design.md`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/dashboard/users` from a legacy filter-row plus plain table into a darker roster command center with a dominant roster-story hero, balanced signup/billing/selection/filter KPI cards, an integrated command strip for search and saved views, a dedicated bulk-actions deck, and a denser premium roster table that keeps notes and impersonation intact.
Why: The user asked for a Hermes-adapted redesign based on the provided reference, but explicitly wanted a stronger command-center layout rather than a close mimic or another generic admin table.
Rollback target: `DV-2026-04-19-11`
Notes: This redesign stays inside the existing route-driven admin shell and preserves real `/api/admin/users` data wiring, queue-driven filters, saved filters, export, notes, and impersonation behavior.

### Version: DV-2026-04-20-01
Date: 2026-04-20
Surface: Admin Dashboard / users command center light mode
Files: `frontend/src/styles/style.css`, `frontend/src/pages/dashboardAdminLightMode.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Translated the new `/dashboard/users` command-center surface from the dark roster deck into Hermes light mode by re-expressing the hero, KPI cards, saved-view lane, bulk-actions deck, roster-board shell, avatar treatments, and role/tier badges as warm editorial vellum surfaces with softer coral emphasis and readable light-theme contrast.
Why: The user asked to apply light mode specifically to `dashboard/users`, and the new command-center surface had been implemented only in the dark treatment while the rest of the admin shell already supported light mode.
Rollback target: `DV-2026-04-19-12`
Notes: This is a theme translation only. It preserves the existing `/dashboard/users` hierarchy, routing, data wiring, filters, bulk actions, notes, impersonation, and export behavior.

### Version: DV-2026-04-19-12
Date: 2026-04-19
Surface: Admin Dashboard / jobs command deck
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/dashboardJobsCommandDeck.smoke.test.js`, `frontend/package.json`, `DESIGN_VERSIONS.md`
What changed: Rebuilt `/dashboard/jobs` into an editorial command deck with a dark-led hero, real page-scoped summary cards, a spotlight job band, a selectable terminal-style queue, and a sticky selected-job detail rail. The route keeps the existing `/api/admin/jobs` filters and pagination contract, but now also surfaces truthful fields the old flat table hid, including trigger source, created/started/finished times, total count, and raw `detailsJson`.
Why: The old jobs route was still just a utility filter row and plain data table, which did not match the stronger operations-terminal reference or the newer Hermes admin-shell hierarchy. This pass brings the top fold much closer to the reference while keeping the lower inspection area calmer and more Hermes-consistent.
Rollback target: `DV-2026-04-19-11`
Notes: This redesign is scoped to `/dashboard/jobs` only. The shared admin shell, routing model, backend jobs contract, and page-level filter/pagination behavior remain intact.

### Version: DV-2026-04-20-02
Date: 2026-04-20
Surface: Weather page on `/weather`
Files: `frontend/src/App.jsx`, `frontend/src/pages/WeatherEngine.jsx`, `frontend/src/utils/runnerShellNav.js`, `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/TodayRun.jsx`, `frontend/src/pages/WorkflowBuilder.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/weatherEditorialRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Promoted the old `/weather-engine` runner surface into `/weather`, updated runner-nav targets to the new route, and rebuilt the page as a Hermes-native cinematic weather board instead of a pair of equal-weight utility cards. The new structure uses a temperature-led hero with live engine status, compact humidity/wind HUD cards, a horizontal 12-hour forecast pipeline, a larger `Heat Adaptation Engine` analysis card, and a dedicated `Coach Judgment` rail with direct training actions.
Why: The user supplied a stronger editorial weather reference and explicitly asked for the route/name shift from `weather-engine` to `weather`. Matching that intent required both the navigation rename and a hierarchy reset so the page reads like a decision surface before a run rather than a generic weather dashboard.
Rollback target: `DV-2026-04-16-39`
Notes: This redesign preserves the existing `/api/v1/weather/context` and Open-Meteo weather wiring. `frontend/src/pages/weatherEditorialRedesign.smoke.test.js`, `cd frontend && npm run lint` (with unrelated pre-existing warnings only), `cd frontend && node scripts/run-vite-build.mjs`, and frontend runtime sync all passed.

### Version: DV-2026-04-20-03
Date: 2026-04-20
Surface: Races Detail elevation chart on `/races/details/:raceId`
Files: `backend/src/main/java/com/hermes/backend/RaceCourseMapService.java`, `backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java`, `frontend/src/pages/RacesDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/raceDetailElevationPerKm.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the race-detail elevation profile from a fixed sparse checkpoint chart into a kilometer-aware course tool. The backend now samples aligned-route elevation by race distance instead of a flat 25-point contract, so long races can carry one elevation point per kilometer plus the true finish. The frontend chart now derives kilometer distance marks, renders every kilometer on a wider scrollable stage, keeps stronger emphasis on 5 km / finish milestones, and removes the old hard-coded `S / 10 / 21 / 30 / F` marker scheme that was flattening long-course detail.
Why: The user wanted the elevation chart to respect every kilometer and show more accurate elevation change over the full course. That required fixing both the data contract and the chart geometry instead of only restyling the existing sparse profile.
Rollback target: `DV-2026-04-14-29`
Notes: `cd backend && ./mvnw -q -Dtest=RaceCourseMapServiceTests test`, `cd backend && ./mvnw -q -DskipTests compile`, `node frontend/src/pages/raceDetailElevationPerKm.smoke.test.js`, `cd frontend && npm run lint` (with unrelated pre-existing warnings only), frontend build, frontend runtime sync, and backend runtime sync all passed.

### Version: DV-2026-04-21-01
Date: 2026-04-21
Surface: Runner Settings Garmin import on `/settings/garmin-import`
Files: `frontend/src/App.jsx`, `frontend/src/pages/Settings.jsx`, `frontend/src/pages/GarminImportSettings.jsx`, `frontend/src/components/SettingsAtlasLayout.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/garminImportRoute.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Garmin activity-import and wellness-sync experience out of the in-place settings modal and into a dedicated routed page with a focused back-link workflow. The Settings atlas now stays as the control hub and launches the Garmin surface, while the new route reuses the existing Garmin import/wellness APIs inside a full-page split editorial layout that keeps manual file import as a secondary path.
Why: The user asked for the Garmin modal-card settings surface to become a standalone page instead of a modal, while keeping both activity import and wellness controls together. A route-level redesign gives the flow more space and clearer hierarchy without changing the backend contract.
Rollback target: `DV-2026-04-20-03`
Notes: This redesign is scoped to the Garmin import path only. `/settings` remains the runner settings hub, and the Garmin APIs plus manual import modal behavior stay intact behind the new page entry point.

### Version: DV-2026-04-21-02
Date: 2026-04-21
Surface: Profile dashboard feature grid on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `DESIGN_VERSIONS.md`
What changed: Removed the standalone recent-sessions summary card from the lower Profile feature grid. The grid now ends after the training-load card while the earlier recent-sessions timeline module stays in place.
Why: The user explicitly asked to remove the duplicate recent-sessions card because it repeated information already shown elsewhere on the Profile surface.
Rollback target: `DV-2026-04-21-01`
Notes: This is a subtraction-only UI change. No data wiring, translations, routes, or backend contracts changed.

### Version: DV-2026-04-21-03
Date: 2026-04-21
Surface: Profile dashboard hero on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Moved the recent-sessions utility card into a new hero row so it now sits beside the welcome heading at the top of the Profile dashboard. The lower dashboard grid now focuses on readiness, workout, and weekly progress, while the greeting and session history read as one top-level opening band.
Why: The user explicitly asked to place the white/dark utility card next to the `欢迎回来, JunWei Li.` greeting instead of keeping that card lower on the page.
Rollback target: `DV-2026-04-21-02`
Notes: This is a layout-only repositioning of existing Profile content. Session data, interactions, and routes remain unchanged.

### Version: DV-2026-04-21-04
Date: 2026-04-21
Surface: Profile dashboard hero and grid on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Restored the recent-sessions utility card to its previous origin in the lower Profile dashboard grid and reverted the hero back to the simpler greeting-plus-subline layout.
Why: The user asked to restore the previous version so the white/dark utility card returns to the place it originally came from instead of staying attached to the greeting row.
Rollback target: `DV-2026-04-21-03`
Notes: This is a rollback of the hero-row repositioning only. The existing recent-sessions card content, links, and session interactions remain unchanged.

### Version: DV-2026-04-28-01
Date: 2026-04-28
Surface: Login brand introduction on `/login`
Files: `frontend/src/pages/Login.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/loginBrandCarousel.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Turned the static `auth-flow-brand-inner` login brand block into a three-message rolling introduction carousel with website-value slides for daily decisions, training trust, and race readiness. The form side, OAuth/email auth behavior, and public footer remain unchanged.
Why: The user asked for `auth-flow-brand-inner` on the login page to use a slide animation that rolls information introducing the website.
Rollback target: `DV-2026-04-21-04`
Notes: The animation is CSS-only, dual-mode-safe for the existing login treatment, and includes a reduced-motion fallback that shows the first slide without auto movement.

### Version: DV-2026-04-29-02
Date: 2026-04-29
Surface: Admin Dashboard course-map publish canvas on `/dashboard/course-maps`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardCourseMapPublishCanvasGrid.smoke.test.js`, `frontend/src/pages/dashboardCourseMapWorkspace.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the course-map command bridge so the publish canvas owns the recommended next action and spans the full top row, while secondary source/analysis controls and parameter review sit beneath it. The improve state now has a stronger processing-tone treatment so admins can immediately see that the next useful action is to improve/re-analyze the map before publishing.
Why: The user asked to redesign the `admin-coursemap-publish-canvas admin-track-hub-footer-panel admin-track-hub-footer-panel--publish is-improve` grid to make admin map processing easier.
Rollback target: `DV-2026-04-29-01`
Notes: This is a layout and hierarchy change only. It preserves existing upload, re-analyze, pipeline, accept-live, preview, and backend course-map contracts.

### Version: DV-2026-04-29-03
Date: 2026-04-29
Surface: Admin Dashboard course-map working notice on `/dashboard/course-maps`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/dashboardCourseMapWorkingNotification.smoke.test.js`, `frontend/src/pages/dashboardCourseMapUploadProcessing.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added an explicit live working notice to the course-map progress card and made upload, source-scan, and re-analysis actions announce their active/queued state immediately through the dashboard status banner. The progress card still appears in the header and beside the publish-canvas decision dock, but now it includes a pulsing work indicator plus accessible status copy.
Why: The admin source-scan and re-analysis jobs were running, but the UI only showed completion/failure messages, so operators could miss that Hermes was actively working after they clicked the button.
Rollback target: `DV-2026-04-29-02`
Notes: This is a feedback-layer change only. It preserves the existing FIFO job lane, polling helper, course-map action buttons, and backend contracts.

### Version: DV-2026-04-29-04
Date: 2026-04-29
Surface: Prediction detail on `/prediction/:distKey`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/predictionDetailCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the prediction detail page into a Race Forecast Cockpit. The page now leads with a dominant predicted finish-time hero, confidence bar, trend delta, Today Run / Analysis actions, an effort ladder, coach judgment rail, evidence tiles, and a larger prediction trend card. User-facing copy now routes through i18n instead of hard-coded strings.
Why: The old route stacked small utility sections and made the main forecast feel secondary. The new structure answers the runner's first questions faster: what can I run, how trustworthy is it, and what should I train next?
Rollback target: `DV-2026-04-29-03`
Notes: This redesign preserves the existing `/prediction/:distKey` route, `/api/activities` fetch, VDOT utilities, calibrated prediction math, Chart.js trend, auth shell, and distance keys.

### Version: DV-2026-04-29-05
Date: 2026-04-29
Surface: Analysis overview and Profile dashboard quick preview on `/analysis` and `/profile`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/analysisVdotTrendAccent.smoke.test.js`, `frontend/src/pages/profileDashboardBrandCarouselLightMode.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Made the Analysis VO2/VDOT trend card a static data grid instead of a clickable navigation target, removed the old VO2 detail CTA affordance, and normalized the low-load ACWR status pill away from the removed `is-cool` variant. Reworked the Profile `runner-dashboard-brand-carousel` into a user-data quick preview with readiness, weekly distance, cumulative distance/sessions, and VO2 trend cards.
Why: The user asked for the Analysis VO2max trend grid to stop behaving like a click target, to remove the `analysis-overview-status-pill is-cool` treatment, and to make the Profile brand carousel useful as a fast user-data preview instead of rotating brand copy.
Rollback target: `DV-2026-04-29-04`
Notes: This is a frontend presentation change only. It preserves existing Analysis/Profile data fetches, dashboard calculations, auth shell, and routing outside the removed VO2 overview click affordance.

### Version: DV-2026-04-30-01
Date: 2026-04-30
Surface: Public landing page on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/translations.js`, `frontend/src/pages/landingCinematicEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the public landing page into a cinematic editorial runner experience inspired by premium sports journalism and a performance HUD. The page now leads with an asymmetric dark hero, readiness/workout HUD, live training ticker, coach voice pull-quote, three-answer product cards, methodology paper, race landscape map, comparison table, Daniels zone grid, and final CTA.
Why: The user supplied a prototype direction for a premium sports-journalism x performance-HUD landing redesign and asked to apply it to Hermes.
Rollback target: `DV-2026-04-29-05`
Notes: The redesign preserves the existing public `/` route, authenticated-user redirect behavior, `/login` and `/signup` links, Strava OAuth start path, public footer links, and bilingual translation contract.

### Version: DV-2026-04-30-02
Date: 2026-04-30
Surface: Public landing page on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCinematicEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Isolated the cinematic landing page from the broader app design system by removing the legacy `landing-page` root class, replacing shared `AppIcon` and `FooterNavLinks` usage with landing-local SVG glyphs and footer links, and moving the landing CSS onto local `--lc-*` typography tokens.
Why: The user explicitly asked to keep using the same landing files but not apply the system `design.md` visual language to the landing page.
Rollback target: `DV-2026-04-30-01`
Notes: The page still preserves the supplied cinematic editorial direction, authenticated redirect behavior, `/login` and `/signup` links, Strava OAuth start path, and public Terms/Privacy/Support footer destinations.

### Version: DV-2026-04-30-03
Date: 2026-04-30
Surface: Global design authority in `design.md`
Files: `design.md`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Rewrote `design.md` around the new Hermes Cinematic Editorial language with explicit surface expressions for the public landing page, signed-in runner app, and admin operations tools. The document now treats the landing page as the signature campaign expression while keeping it intentionally isolated from shared app-shell components and global typography tokens.
Why: The user asked to rewrite `design.md` based on the new landing-driven design language.
Rollback target: `DV-2026-04-30-02`
Notes: Documentation/workflow authority change only. No frontend runtime sync is required because no shipped UI source changed in this round.

### Version: DV-2026-04-30-04
Date: 2026-04-30
Surface: Profile dashboard Coach Cockpit on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/profileCoachCockpitRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Reworked the Profile opening surface into the approved Coach Cockpit option. The top fold now combines the runner greeting, readiness score, quick-preview data cards, and suggested workout prescription into one editorial cockpit while retaining the existing `runner-dashboard-brand-carousel` and quick-preview hooks.
Why: The user chose option A for the profile redesign and explicitly asked to remember the original version.
Rollback target: `DV-2026-04-29-05`
Notes: This is a top-fold presentation change only. It preserves the batch-first dashboard data loading, quick-preview data model, calibrated race predictions, lower recent-session card, existing Today Run / Analysis actions, and the original quick-preview design as the rollback baseline.

### Version: DV-2026-05-18-02
Date: 2026-05-18
Surface: Territory full-screen world map on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Opted Territory into the Heatmap-style full-viewport Leaflet shell, using the same dark real-world CARTO map treatment as the page background with glass overlay cards, an overlay brand/sector/action topbar, and a compact route utility rail.
Why: The user asked to inspect the Heatmap page and apply the same real-world map background style to Territory.
Rollback target: `DV-2026-05-18-01`
Notes: This is a presentation-layer change only. It preserves the live `/api/territory` and `/api/territory/polygons` wiring, polygon/zone toggle, sidebar route availability via the overlay utility rail, and existing Territory backend contracts.

### Version: DV-2026-05-18-03
Date: 2026-05-18
Surface: Territory full-screen world map on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the obsolete `terr-brief` overlay card from the Territory full-screen map so the real-world Leaflet surface owns the viewport without a duplicate conquered-space panel.
Why: The user said the `terr-brief` block was unnecessary and asked to remove it.
Rollback target: `DV-2026-05-18-02`
Notes: This is a presentation cleanup only. It preserves the Heatmap-style world-map shell, overlay topbar, route utility rail, polygon/zone toggle, and live backend territory rendering.

### Version: DV-2026-05-18-04
Date: 2026-05-18
Surface: Territory map-only land view on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryRouteSidebar.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the Territory page's visible buttons, overlay topbar, utility rail, filters, legend, lower panels, and footer so `/territory` renders only the full-screen real-world Leaflet map plus concrete backend conquered-land masks.
Why: The user asked to remove the page buttons and keep only the concrete lands visible.
Rollback target: `DV-2026-05-18-03`
Notes: This preserves `/api/territory` and `/api/territory/polygons` data loading, Leaflet readiness, full-bleed map sizing, and external route availability from other runner sidebars; the Territory page itself no longer renders local navigation controls.

### Version: DV-2026-05-18-05
Date: 2026-05-18
Surface: Territory map-only land view on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `frontend/src/pages/territoryRouteSidebar.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Restored the compact icon-only navigation rail on top of the Territory map while keeping the page free of action buttons, filters, legends, cards, footer, and Leaflet controls.
Why: The user clarified that necessary buttons, specifically navigation buttons, should remain available.
Rollback target: `DV-2026-05-18-04`
Notes: This preserves the concrete backend land-mask map-only treatment and reuses the shared runner navigation model for route exits.

### Version: DV-2026-05-18-06
Date: 2026-05-18
Surface: Territory map title strip on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryRouteSidebar.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added the Heatmap-style title strip to Territory with a Hermes/territory brand pill, recenter status with map coordinates, View Runs, Open Settings, and avatar actions while keeping the land map, navigation rail, and concrete backend mask as the main view.
Why: The user shared the Heatmap top strip reference and asked to add those titles to Territory too.
Rollback target: `DV-2026-05-18-05`
Notes: This preserves the removed filters, legends, lower panels, footer, and Leaflet controls; only title/action chrome and the navigation rail remain over the map.

### Version: DV-2026-05-18-07
Date: 2026-05-18
Surface: Territory concrete land and competition model on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `backend/src/test/java/com/hermes/backend/ProfileControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Hardened latest-run territory competition so a newer rival capture blocks older loop interior refill, then changed the map renderer from dotted circle markers to aggregated filled Leaflet rectangles so straight routes and loop interiors read as concrete occupied land tiles.
Why: The user asked to redesign the occupied-land mechanism so borders fill concretely, loops fill their interiors, and newer user coverage consumes the land it overlaps from previous owners.
Rollback target: `DV-2026-05-18-06`
Notes: The backend still uses activity start time as the ownership ordering source, preserves the existing `/api/territory/polygons` land-mask contract, and keeps only the necessary Territory navigation/title controls over the map.

### Version: DV-2026-05-18-08
Date: 2026-05-18
Surface: Territory concrete border polish on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Increased client mask density and added continuous anti-aliased land-mask border loops plus rounded route-trace skins over the filled tiles so occupied land reads as a concrete map shape rather than a pixelized grid edge.
Why: The user said the Territory border still looked pixelized and asked to make it more concrete.
Rollback target: `DV-2026-05-18-07`
Notes: This is a visual renderer refinement only. It preserves the backend latest-wins ownership model, `/api/territory/polygons` land-mask data contract, filled tile occupation, title strip, and icon-only navigation rail.

### Version: DV-2026-05-18-09
Date: 2026-05-18
Surface: Territory active red land rendering on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Demoted route traces into a low-opacity underlay, removed the bright route-core overlay, and suppresses heavy concrete border halos for small active red masks so active territory no longer reads as stamp-like markers on top of the land fill.
Why: The user asked to review a visible bug on the red Territory land after the border polish pass.
Rollback target: `DV-2026-05-18-08`
Notes: The backend ownership data was verified as non-empty and consistent; this is a frontend paint-order/opacity/border-threshold repair that preserves concrete filled tiles, smooth mask borders for larger land, title strip, and navigation rail.

### Version: DV-2026-05-18-10
Date: 2026-05-18
Surface: Territory narrow land-conquest mechanism on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Tightened the backend land-mask grid from 16m to 8m cells, reduced open-route claim radius from 22m to a center-strict 6m paint radius, and bumped mask/cache versions so old wide masks are treated as stale and recomputed. A regression now requires an open straight run to stay within a narrow corridor, including rejecting land 20m off the route, instead of claiming a broad territory block.
Why: The user said a single line was over-estimating occupied land and asked for more concrete land-conquering semantics.
Rollback target: `DV-2026-05-18-09`
Notes: Open routes now claim a road-like strip; closed loops still flood-fill the genuinely enclosed interior. Latest-wins ownership and frontend concrete tile rendering remain unchanged.

### Version: DV-2026-05-18-11
Date: 2026-05-18
Surface: Territory personal route visibility on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Restored a slim, high-contrast active-runner route centerline above the concrete land fill while keeping the broad route skin as a low-opacity underlay. The visible line is independent from the backend 6m land-conquest radius, so personal routes remain readable without inflating conquered land.
Why: After narrowing the backend conquest radius, the user's own running route visually disappeared because the route trace was only a subtle underlay below the filled land tiles.
Rollback target: `DV-2026-05-18-10`
Notes: This is a frontend paint-order/visibility repair. It preserves the narrow backend land mask, latest-wins ownership, concrete tile fill, title strip, and navigation rail.

### Version: DV-2026-05-18-12
Date: 2026-05-18
Surface: Territory authenticated route loading on `/territory`
Files: `frontend/src/contexts/AuthContext.jsx`, `frontend/src/contexts/authUrlTokenPersistence.smoke.test.js`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Persisted URL tokens synchronously in `AuthProvider` before child route effects can call `apiJson`, and made Territory wait for auth hydration before loading `/api/territory` and `/api/territory/polygons`. This prevents the page from briefly using unauthenticated fallback/demo data with zero route overlays on first load.
Why: The user's running routes were not displaying because `/territory?token=...` could race: the page requested route/land-mask data before the URL token reached localStorage, then stayed on the empty/demo map until a reload.
Rollback target: `DV-2026-05-18-11`
Notes: This preserves the narrow land-conquest backend, visible route centerline, concrete land fill, title strip, and navigation rail.

### Version: DV-2026-05-18-13
Date: 2026-05-18
Surface: Territory continuous route and loop-fill conquest on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Bumped the land-mask encoding to v5 so stale persisted masks cannot keep rendering old broken/wide geometry, and explicitly paints detected mid-route loop closures before flood-fill so a route that returns to an earlier border seals and fills the enclosed land. Added regressions for connected sparse straight routes, mid-route loop interior fill, and stale v4 mask rejection.
Why: The user reported straight route territory appearing broken into pieces and route loops failing to cover the enclosed area.
Rollback target: `DV-2026-05-18-12`
Notes: This preserves the 8m concrete mask grid, 6m open-route conquest radius, latest-wins ownership, active route centerline, title strip, and navigation rail.

### Version: DV-2026-05-18-14
Date: 2026-05-18
Surface: Territory own-route warmup refresh on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Territory now schedules a bounded refresh while `/api/territory/polygons` reports `backfillInProgress` or pending activity recomputation, so the page automatically repaints the active runner's route traces after backend land-mask versions rebuild.
Why: The user's own running route could appear erased when the first load happened during polygon backfill: the warming response contained only already-cached rival land and no active own route traces until a later manual reload.
Rollback target: `DV-2026-05-18-13`
Notes: This is a frontend hydration/polling repair only. It preserves the 8m concrete mask grid, 6m open-route conquest radius, mid-route loop fill, latest-wins ownership, active route centerline, title strip, and navigation rail.

### Version: DV-2026-05-18-15
Date: 2026-05-18
Surface: Territory land-first route highlight removal on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the bright white personal-route centerline overlay from active Territory land masks while keeping the subtle low-opacity route skin underneath the concrete fill for corridor softness.
Why: The user pointed at the white route highlighting and asked to remove it so the page reads as occupied land rather than a route-tracing view.
Rollback target: `DV-2026-05-18-14`
Notes: This is a visual paint-layer repair only. It preserves the 8m concrete mask grid, 6m open-route conquest radius, mid-route loop fill, latest-wins ownership, warmup refresh, title strip, and navigation rail.

### Version: DV-2026-05-18-16
Date: 2026-05-18
Surface: Territory solid land fill on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the remaining route-skin underlay and made occupied land tiles substantially more opaque, so background road/route lines no longer show through conquered territory.
Why: The user pointed at visible background lines inside the red occupied land and asked to remove them.
Rollback target: `DV-2026-05-18-15`
Notes: Territory still uses backend land-mask cells and route traces for bounds, but it no longer paints route lines over or under the concrete land fill; active fill opacity is now `0.9`.

### Version: DV-2026-05-18-17
Date: 2026-05-18
Surface: Heatmap continuous route rendering on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/pages/heatmapStability.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the visible GPS sample overlay from isolated Leaflet circle markers with same-activity rounded route polylines, while leaving the real-world basemap and heat-fog layer intact.
Why: The user reported that a straight heatmap route appeared broken into separated pieces instead of reading as one continuous line.
Rollback target: `DV-2026-05-18-16`
Notes: This is a frontend rendering repair only. Backend `/api/profile/heatmap` still owns sampling, newest-run protection, and point totals; the frontend now uses those sampled points as route continuity geometry instead of disconnected dots.

### Version: DV-2026-05-18-18
Date: 2026-05-18
Surface: Territory sealed concrete land rendering on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the same-color `routeTraces` corridor bridge and instead seals the concrete land-mask tile bounds with a small client-side overlap, so straight or diagonal conquered land reads continuously without painting any route highlight on the Territory map.
Why: The user clarified that route highlighting is unnecessary on Territory; the broken-straight-line issue must be solved at the occupied-land mask level.
Rollback target: `DV-2026-05-18-17`
Notes: This does not restore the removed white route highlighter, route-skin overlay, or same-color route bridge. Backend route traces remain available only for bounds/warmup reference; visible continuity comes from slightly overlapped concrete land tiles while preserving the narrow 8m/6m conquest semantics.

### Version: DV-2026-05-19-01
Date: 2026-05-19
Surface: Heatmap auth-hydrated loading on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/pages/heatmapStability.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Heatmap now reads `authHydrated` from `AuthContext`, waits for hydration before redirecting to `/login`, and waits for hydration before requesting `/api/profile/heatmap` plus `/api/activities`.
Why: The live `/heatmap` route could bounce to `/login` before URL/local token hydration completed, matching the earlier Territory first-load race.
Rollback target: `DV-2026-05-18-17`
Notes: This preserves the current Heatmap map-first layout, Leaflet heat layer, same-activity rounded route polylines, and signed-in auth requirement; unauthenticated sessions still redirect to `/login` after hydration.

### Version: DV-2026-05-19-02
Date: 2026-05-19
Surface: Heatmap visible GPS dot restoration on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/pages/heatmapStability.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Restored the visible GPS overlay from same-activity route polylines back to sampled Leaflet circle markers while keeping the auth-hydrated redirect/data-loading guard added in the previous round.
Why: The user explicitly asked to restore Heatmap to the dot version.
Rollback target: `DV-2026-05-19-01`
Notes: This changes only the visible overlay style. The heat-fog layer, sampled backend payload, and auth requirement stay intact.

### Version: DV-2026-05-19-03
Date: 2026-05-19
Surface: IRONPULSE strength cockpit on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/locales/zh-CN.js`, `frontend/src/i18n/locales/en.js`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the existing single strength route as a dark route-scoped cockpit with an acid-lime hero, weekly strength goal ring, target-area filters, weekly runway, real run-load/recovery metrics, sticky exercise detail panel, and clearly labeled placeholder strength-history cards.
Why: The user asked to remake the strength area using the provided IRONPULSE references while preserving Hermes runner-strength logic and avoiding fake PR/1RM data.
Rollback target: `DV-2026-05-19-02`
Notes: No backend schema or route was added. Check-in save/reset now uses the existing `/api/training/muscle/today` backend endpoint instead of the stale `/check-in/today` path.

### Version: DV-2026-05-19-04
Date: 2026-05-19
Surface: IRONPULSE reference-one strength home on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/locales/zh-CN.js`, `frontend/src/i18n/locales/en.js`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `frontend/src/assets/muscle-training/*.svg`, `DESIGN_VERSIONS.md`
What changed: Replaced the failed hybrid cockpit with a reference-one IRONPULSE home layout: centered weekly strength goal ring, current training arrangement strip, six local dark target-area image cards, explicit pending strength-history records, and secondary protocol/check-in panels below the first visual pass.
Why: The user clarified that the main content should match the first IRONPULSE reference rather than retain the Runner Atlas white-card or anatomy-board direction.
Rollback target: `DV-2026-05-19-03`
Notes: The visible main route now uses `mt-ironpulse-page` instead of `muscle-training-page`, removes `data-friendly-strength-lab`, and suppresses the old Runner Atlas white canvas overlay for `/muscle-training`. Check-in still uses `/api/training/muscle/today`; PR, total lifted, and 1RM remain clearly marked as pending real strength history.

### Version: DV-2026-05-19-05
Date: 2026-05-19
Surface: Compound target library on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `frontend/src/i18n/locales/zh-CN.js`, `frontend/src/i18n/locales/en.js`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a frontend-only compound exercise library for all six target areas, with four optional movements per area, split from real `today plan` rows and wired into target-card counts, row selection, and the detail panel.
Why: The user wanted every muscle-area card to expose several compound-focused exercise options without pretending those optional movements are part of the backend-generated runner strength plan.
Rollback target: `DV-2026-05-19-04`
Notes: This does not change backend planning or recommendation math. Optional library rows are labeled as not participating in today's training suggestion calculation, while real check-in still uses `/api/training/muscle/today`.

### Version: DV-2026-05-19-06
Date: 2026-05-19
Surface: Practical protocol workbench on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/style.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Promoted the exercise protocol area into the primary route experience: compact target filters, ledger-style exercise rows, and a right-side detail panel with dose, equipment, intent, and execution phases.
Why: The user clarified that the image-card-first layout was not practical and asked for a page closer to the action detail/workbench reference.
Rollback target: `DV-2026-05-19-05`
Notes: The six target photos remain available only as small filter thumbnails. Real plan/recovery/check-in wiring is unchanged, and optional library movements still do not participate in today's recommendation calculation.
