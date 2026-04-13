# Hermes Design Versions

Use this file to keep a durable history of meaningful Hermes UI and design-system revisions.

Rules
- Append new entries at the top, newest first.
- Log only meaningful user-facing design or layout changes, not every tiny text tweak.
- Prefer commit hashes in `Rollback target:` when a commit exists.
- If no commit exists yet, name the previous version or say `working tree before this change`.
- Keep entries concise but concrete enough that an agent can restore or reconstruct the prior design state.

## Current Versions

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
