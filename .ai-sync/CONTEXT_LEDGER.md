# Context Ledger

Use this file as the shared cross-agent memory layer for surface-level product intent.

Keep it short. Prefer replacing stale capsules over appending long history.

## Goal Stack
- Runner Outcome: Keep Hermes focused on clearer daily decisions, better trust, and more useful running guidance.
- Product Outcome: Prefer Tier 1 Daily Coach Value and Tier 2 Data Trust before lower-tier breadth.
- Surface Outcome: Preserve the latest user-approved live structure on each touched page unless a must-fix or explicit user rollback overrides it.

## Retrieval Rules
- Read this file before reclaiming a surface another agent recently changed.
- Read this file before reverting, simplifying, or redesigning an existing layout.
- Treat the newest capsule for a surface as the local baseline unless the user explicitly overrides it.
- After a meaningful verified round, refresh the matching capsule.

## Surface Capsules
### runner shell sidebar
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### Territory /territory (Leaflet CARTO base map + polygon tooltips)
- Goal: Make claimed land read as layered territory on the same dark CARTO-style map: every owner keeps ownership, overlaps are covered visually by newer claims.
- Changed: `/api/territory/polygons` now preserves overlapping cells per owner instead of globally consuming them; the Leaflet renderer paints older masks first and newest masks as the top layer.
- Preserve: Keep backend masks as concrete land cells, exact underlay + smoothed fill + single neon contour, nonzero SVG fill rules, heatmap base map styling, auth/routing, and the separate `/api/territory` score-board behavior.
- Next Risk: Future ownership fixes could reintroduce `claimedCells`/`claimedTiles` pruning or active-owner sorting, which would delete covered-down ownership instead of only changing visual layer order.
- Rollback Target: working tree before this round

### Auto-Hermes control plane
- Goal: Future browser-visible rounds should keep proof gates active even when browser-harness.exe is blocked by local policy.
- Changed: Replaced the stale browser-harness hard-block fallback with the repo Playwright wrapper and fixed the wrapper to restore last URL across commands.
- Preserve: Browser proof still requires real route URL, console summary, screenshot/DOM evidence, runtime-sync gates, and web-quality audit when in scope.
- Next Risk: Raw browser-harness.exe is still blocked by OS policy; this fix routes Auto-Hermes to the verified Playwright wrapper before declaring browser proof blocked.
- Rollback Target: working tree before this round

### Weekly Digest /profile
- Goal:
- Changed: Weekly digest implementation verified; reviewer gate blocked
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /settings + readiness
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### Wellness /settings /api/wellness/source-preferences
- Goal: Support runners who combine wellness devices by letting each readiness metric choose the best configured source instead of one global provider.
- Changed: `/api/wellness/source-preferences` now persists per-metric sources across auto, Garmin, Oura, Apple Health, Google Health, and manual; `/settings` renders editable selectors; Readiness and automated coach gates use the same multi-source resolver.
- Preserve: Keep Settings selector values, Runner source fields, `ReadinessService.resolveReadinessSnapshot`, and `AutomatedCoachService.resolveReadiness` aligned.
- Next Risk: Returning coach gates to `readinessService.compute(state)` or treating manual as auto will bypass user-selected sources.
- Rollback Target: working tree before this round

### /login
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /settings
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /races/details/:raceId
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /today-run
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /prediction/marathon
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /schedule + /today-run
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /analysis
- Goal: Interactive Injury Prevention Dashboard combining objective ACWR with daily subjective soreness feedback to give runners a clear "should I run today and how hard" signal.
- Changed: Added Injury Prevention card section in Analysis.jsx (SVG risk ring, ACWR gauge with zone coloring, Low/Medium/High soreness logger, coach-voice advice). New backend: InjuryRiskService (EWMA ACWR + combined risk scoring), InjuryRiskController (POST /api/injury-risk/log, GET /api/injury-risk/status), SorenessLog entity + repository, 7 controller tests. 26 i18n keys added (en + zh-CN).
- Preserve: All existing Analysis sections (VO2max trend, load balance, coach insight, intensity split, training zones table, prediction table). Existing injury risk card in bento grid. ACWR computation thresholds: > 1.2 (+30), > 1.3 (+20), > 1.5 (+15, capped 70). Soreness "high" (+25), "medium" (+10). Combined 0-100: > 85 = rest, > 70 = caution, else ready.
- Next Risk: ACWR uses distance-based load (km) rather than pace-weighted load from MuscleTrainingMetricsService — frontend may need reconciliation if both ACWR displays appear.
- Rollback Target: ee6113b6^ (before injury prevention commit)

### /territory
- Goal: Preserve layered concrete land ownership where overlap stacks rather than deletes older claims.
- Changed: Backend polygon masks and frontend render guards now keep older and newer overlapping territory layers.
- Preserve: Newest claim paints on top, older covered-down territory remains owned underneath.
- Next Risk: Cache or visual fallback changes could accidentally restore latest-wins cell removal.
- Rollback Target: working tree before this round

### /runs
- Goal: Keep `/runs` focused on trusted recent activity history: every visible control should either open a run, filter history, import/sync data, or reveal more runs.
- Changed: Removed the inert three-dot button from run cards and added a smoke guard so future cards cannot show a menu affordance unless a real menu implementation exists.
- Preserve: Keep card click-through to `/run/:id`, route-preview thumbnails, search/filter/sort controls, Strava sync, import modal, one-run collapsed default, and bounded load-more batches.
- Next Risk: Future card-action work could reintroduce a stop-propagation-only button or duplicate run-detail actions without focus/menu semantics.
- Rollback Target: `DV-2026-05-11-07`

### /
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### /signup
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### runner-bootstrap
- Goal: Let documented Windows shell-set APP_LOCAL_SHARED_RUNNER_* values reach the backend launched by start_hermes.bat.
- Changed: Forwarded all six shared-runner env vars through the local-env allowlist and generated backend boot script; updated Windows docs and added a batch handoff smoke guard.
- Preserve: Preserve the existing start_hermes.bat launcher flow, curated env forwarding pattern, Hermes.local.env.ps1 support, and shared runner local-only production skip semantics.
- Next Risk: Launcher env forwarding still follows the existing echo-based batch pattern, so unusual batch metacharacters in values remain fragile outside the documented simple values.
- Rollback Target: revert runner-bootstrap round 2026-05-08

### /muscle-training
- Goal: 
- Changed: 
- Preserve: 
- Next Risk: 
- Rollback Target: working tree before this round

### frontend /races/details/:raceId
- Goal: Keep Race Detail as a Profile-aligned race dossier: runner sees the event identity, countdown, distance/prediction, coach interpretation, course elevation, and real map proof without the page feeling like a detached dark marketing poster.
- Latest Layout: `/races/details/:raceId` now uses a route-scoped Profile dossier layer with the visibility repair applied. The first fold is a warm paper card with a clipped editorial race photo on the right, oversized city/race typography on the left, a compact dark countdown rail, and a dedicated readable hero-copy board so text is not floating over the image wash. The command strip below is asymmetric and now wrapped in a visible board: distance/prediction metrics get accent spines and stronger card borders, the coach interpretation remains a dark decision card, the elevation decision card uses a clearer grid/chart background, and the real Leaflet map stays large with a stronger frame. If the runner-facing course-map endpoint fails, the map stage now overlays a localized course-map unavailable notice with retry and an admin-only upload CTA instead of reading as a blank grey box.
- Preserve: Keep auth redirect, race catalog lookup, hero image fallback/cache invalidation, projected race date/countdown, profile and run analysis loading, VDOT prediction, coach identity, course-map trust gate, transparent overlay route rendering, Leaflet pan/zoom, tile fallback, elevation hover tooltip, official-site accessibility copy, the course-map failure overlay/retry/admin upload path, and the map stage without the older floating HUD/copy/action overlays.
- Next Risk: Future race-detail restyles could bypass the route-scoped Profile selector, restore the full dark image wash, remove the readable hero-copy board, fade card borders back into paper-on-paper surfaces, overlap the countdown with the race title on laptop widths, shrink the real map below a proof-level stage, reintroduce the old floating map HUD, replace real course/elevation/map data with decorative race-card content, or collapse failed course-map requests back into a silent grey Leaflet stage without retry copy.
- Rollback Target: `DV-2026-05-11-08`

### frontend /shoes/add
- Goal: Keep Add Shoes as a guided intake workflow that helps the runner pick brand, model, and setup values quickly while visually matching the current warm Profile/Shoes system.
- Latest Layout: `/shoes/add` now uses a Profile-aligned route layer over the existing AddShoes workflow. The page has a warm paper background, large intake dossier hero, warm stat rail, full-width setup board, dark featured-brand decision tile, four-column desktop model board, warm form fields, black primary submit action, and a dark selected-shoe summary tile.
- Preserve: Keep auth shell, sidebar/topbar navigation, brand selection, expandable extra brands, model category/type filters, model search, selected model syncing, nickname/max-distance/primary form fields, submit/cancel navigation, shoe catalog data, and bilingual copy wiring.
- Next Risk: Future AddShoes restyles could revive the dark standalone editorial island, shrink the model board back to three columns despite the wider route canvas, detach the final form from the selected-shoe summary, or bypass the Profile-aligned route scope with later unscoped AddShoes selectors.
- Rollback Target: `DV-2026-05-07-45`

### frontend /shoes
- Goal: Keep Shoes as a Profile-aligned rotation locker: the runner should see rotation health, recent shoe performance signal, inventory state, and shoe actions without large dead areas or detached utility slabs.
- Latest Layout: `/shoes` keeps the warm Profile card system. The `.shoe-rotation-signal` card is now a full-width stacked surface where the header spans the card and `.shoe-rotation-signal-body` spans the entire signal width below it. The body uses a wider highlight/sidecar grid and the three signal metric chips spread across the sidecar so the previous blank right-side space is consumed by useful signal content.
- Preserve: Keep Shoes data loading, rotation signal collapse/expand, recent tagged run calculations, performance fallback copy, inventory filters/sorting, image scan entry, shoe add/edit flows, shoe cards, auth redirect, and bilingual copy wiring.
- Next Risk: Future CSS passes could restore the old two-column parent grid where the signal body is trapped in the right column, collapse the sidecar metrics back to two columns on desktop, or reintroduce empty visual space inside the signal card.
- Rollback Target: `DV-2026-05-06-44`

### frontend /run/:id
- Goal: Keep Run Detail as a single-activity decision cockpit: route proof first, key run outcomes immediately visible, coach interpretation clear, and splits/physiology/gear/route data available without feeling like an unrelated analytics report.
- Latest Layout: `/run/:id` now follows the Profile cockpit system. The topbar is a wide warm activity dossier with an oversized run title and compact actions, the real Leaflet route map remains the first-fold hero, the distance/pace/time rail uses bento stat tiles with the primary distance tile dark, the coach debrief is a dark Profile-native decision panel, and the heart-rate, split, gear, route, performance, and elevation panels share the warm Profile card/hairline rhythm.
- Preserve: Keep real run loading, selected-run session bootstrap, `/api/runs/:id`, route point loading, Leaflet rendering, Strava resync, share feedback, shoe assignment/unlinking, analytics debrief, HR chart, splits table, route intelligence, elevation recalibration, auth redirect, and bilingual copy wiring.
- Next Risk: Future Run Detail restyles could shrink the route map, turn the topbar back into a small utility strip, lose the Profile warm card tokens, bury the coach debrief below generic tables, or break the real route/Strava/shoe interactions while changing visual hierarchy.
- Rollback Target: `DV-2026-05-06-43`

### frontend /territory
- Goal: Keep Territory as a map-first conquest surface: the runner should understand current held space, next defend/steal route, and active sectors without losing trust in the real Leaflet map.
- Latest Layout: `/territory` now follows the Heatmap page outline. The real Leaflet map owns the first viewport as a full-bleed layer with no runner-shell side gutters, a dark overlay topbar carries brand/current sector/actions, a compact vertical utility rail replaces the visible sidebar, stats/filter/legend overlays stay on the canvas, and leaderboard/zones/target/recent/contest/cities remain as lower support cards after the map. The concrete GPS land-mask endpoint is response-cached per runner with an activity-set signature, now includes ordered GPS `routeTraces`, and the Leaflet `GridLayer` prefers smooth round-joined route coverage from those traces so conquered space follows the exact GPS runs instead of rectangular cells or layered radius circles. Demo state now renders a wide localized map banner and zh-CN display-only names for seeded demo runners.
- Preserve: Keep `/api/territory`, `/api/territory/polygons`, bundled Leaflet, polygon/zone toggle, filters, floating map stats, selected-sector command overlay, clickable sector selection, leaderboard, cities, contest bars from backend control fields, auth shell, bilingual copy wiring, the display-only demo runner localization helper, the real GPS-only land-mask contract, ordered `routeTraces` for exact rendering, and the per-runner territory cache invalidation on newly computed runs.
- Next Risk: Future Territory restyles could reintroduce a separate hero above the map, restore the removed brief/command overlay grids, shrink the full-viewport map shell, let shared runner-shell/GPT Taste canvas rules add side gutters back, hide the utility rail controls, replace real territory/polygon data with decorative conquest percentages, expose backend land-mask cells as rectangles or circular blobs again, drop `routeTraces` and fall back to pixelized borders, remove the cache guards and make `/api/territory/polygons` backfill every run on each page load again, render seeded demo names directly in zh-CN, or demote the demo disclosure back to a small badge.
- Rollback Target: `DV-2026-05-11-09`

### frontend /analysis
- Goal: Keep Analysis as the runner's physiology decision cockpit: VO2 trend first, load/risk/forecast actions clearly secondary, and pace tables available without making the page feel like an unrelated analytics report.
- Latest Layout: `/analysis` now follows the warm Profile GPT Taste system without the extra top decision grid. The page starts directly with an existing-hero Profile cockpit: VO2 trend is the primary physiology dossier with a three-signal decision spine for current raw VO2, weather-adjusted VO2, and marathon forecast; load is a full-width compact dark reference strip; coach/VDOT trend form the secondary reference cards; intensity/risk/forecast keep the asymmetric 12-column Profile bento rhythm; the intensity distribution pill is color-filled edge-to-edge without the old padded rim; and the training-zone/prediction tables share one responsive lower grid. Each training-zone row now includes a subdued basis line naming the current representative VDOT, qualifying run sample count, and update recency.
- Preserve: Keep the real run-derived Analysis snapshot, VO2 hover/touch tooltip behavior, weather-adjusted VO2 legend, ACWR gauge, coach insight navigation, intensity/risk/forecast navigation, prediction row navigation, training-zone table, per-zone VDOT basis line, import action, runs action, auth redirect, and bilingual copy wiring.
- Next Risk: Future broad Analysis restyles could reintroduce a redundant top decision grid, split the cockpit back into a loose card wall, remove the first-fold decision spine, flatten load back into an equal side card, drop the Profile reference/bento/table hooks, revive cold glass surfaces, neon/glow bar treatment, black table headers, clickable affordances on static training-zone rows, remove the VDOT/sample basis line from training zones, or drift away from the Profile card tokens.
- Rollback Target: `DV-2026-05-11-03`

### frontend /profile
- Goal: Keep Profile as a clear runner decision surface: readiness, today's prescription, recent progress, race context, and physiology without promo clutter or repeated card grids.
- Latest VO2 Graph: The top reference rail VO2 card uses a real rolling representative VDOT graph from run-derived VO2 estimates instead of the old static decorative sparkline; its plotted points are small CSS circles so the stretched SVG line cannot turn them into ovals.
- Latest Layout: The Profile support band uses the restored previous layout: `runner-dashboard-profile-support-grid` owns separate `streak`, `weekly`, and `sessions` named areas, so Training Load and Recent Training are no longer nested in a paired column. The top `runner-dashboard-coach-primary` now reads as a warm Profile-native coach decision card with shared hairline/card/ink tokens, a distinct active-window overline, tighter dossier title hierarchy, and a contained readiness strip. The physiology signal ledger uses a warm Profile-native GPT Taste rail: `runner-dashboard-profile-signal-grid` and its four metric cards share the same card, hairline, ink, and subtle diffusion-shadow tokens as the surrounding bento cards. Compact signal cards explicitly override the stale minimalist non-first metric text colors so their labels and values stay visible on the unified Profile surface. The lower bento grid now includes a Profile-native Weekly Digest card backed by authenticated `GET /api/weekly-digest`, showing previous ISO-week distance/sessions, VDOT delta, wellness trend, and one backend coach-focus message when available.
- Latest Bento: The lower Profile bento grid is restored to the pre-experiment design: Recent Sessions is full-width again, and the Muscle card only renders when real muscle-plan data exists.
- Changed: Removed the remaining PRO/quota promo grid and quota fetch from `/profile`, then moved the lower-page repair into actual Profile markup. The support band now owns `runner-dashboard-profile-support-grid` with explicit `streak`, `weekly`, and `sessions` named areas so the weekly chart and recent sessions do not conflict at full screen. The streak card now receives real run history, reuses `/rewards` `buildRewardShowcase`, and places earned reward chips inside the Current Streak and All-time Best stat cards instead of showing generic decorative medals. Those two stat cards are top-aligned and stacked full-width inside the running-streak card, no longer hard-cap real earned awards at 4/6 items, expose a `data-award-count` hook so sparse award states become large adaptive tiles, and remove the desktop max-height cap so all gained awards can display when `跑步连击` has enough space. The top reference rail now contains the weekly card as a grid so weekly text and bars do not overflow each other. The lower page owns `runner-dashboard-profile-bento-grid`/card classes for race, predictions, stamina, load, muscle, and sessions, plus `runner-dashboard-profile-signal-grid` cards for physiology metrics instead of relying on the generic metric strip or a CSS hide fallback.
- Preserve: Auth redirect, checkout banner handling, batch-first profile dashboard loading, `/api/weekly-digest` fallback enrichment, fallback endpoints, Strava data, progression atlas, calibrated race predictions, recent sessions, muscle plan link, Today Run/Analysis/Runs/Races actions, and the clear-purpose first fold.
- Next Risk: Future broad Profile restyles could reintroduce quota/pro upgrade cards on this page, revive inherited dashboard grid areas on the support band, replace real Rewards-page award chips with fake local medals, restore a low hard cap or desktop clipping max-height on streak awards, remove the narrow-screen containment guard, make the weekly reference graph absolute again, swap the VO2 graph back to a static decorative arc, put VO2 points back inside a non-uniformly scaled SVG where they become ovals, move Profile back onto generic feature/metric-strip classes, repeat the same overline/H1 copy in `runner-dashboard-coach-primary`, or mix dark/inverted metric cards back into the physiology ledger instead of keeping it visually unified with the Profile bento system.
- Rollback Target: `DV-2026-05-06-22`

### frontend route surfaces
- Goal: Keep runner-facing Hermes pages visually aligned to Profile's warm decision-cockpit language while preserving admin as its own operator Command Lane system.
- Changed: `App.jsx` now exposes `data-runner-design` with `source-profile` for `/profile`, `profile-cockpit` for `/analysis`, and `profile-aligned` for the rest of runner pages. The late CSS pass applies Profile-style paper/card/ink tokens, a Profile-width left rail, a wide filled runner canvas, warm hairline cards, pill CTAs, map/table panels, hover lift, and a unified `runnerTopbarUnified.css` layer for every `runner-shell-topbar runner-dashboard-shell-topbar` surface.
- Preserve: Keep admin/dashboard routes excluded, keep `/profile` as the source surface, keep `/analysis` on its existing Profile cockpit, preserve all runner page data loading, navigation, maps, forms, OAuth/import actions, and keep Territory's map-first exception where the shell topbar is hidden and the live map overlay owns the viewport.
- Next Risk: Future broad restyles could apply Profile runner tokens to admin/operator pages, remove the `data-runner-design` distinction, reintroduce route-local topbar/card surfaces that fight the shared Profile alignment layer, or accidentally override Territory's hidden shell topbar with a global display rule.
- Rollback Target: `DV-2026-05-10-02`

### /login + /signup
- Goal: Keep auth entry pages image-led and functional: warm generated-runner visual language, fast credential entry, and no backend-invisible signup fields.
- Changed: `/login` and `/signup` now share one image-to-code auth system from the latest generated references: login uses a 58/42 editorial-left/form-right board with the generated `landing-runner-hero` photo as a full-height poster, signup mirrors it as form-left/editorial-right and uses a generated-photo board via `profile-runner-reference`. Both pages keep warm paper panels, black primary CTAs, neutral secondary provider buttons, Google-before-Strava provider order, consistent input/provider geometry, no repetitive page grid overlay, a login readiness/next-run/route-trust proof row, and signup proof points for privacy, coach decisions, and provider readiness. The active 2026-05-05 18:45/18:46 generated reference set is login `ig_0349cba8ae703bc50169fa72e5a44881998df875293b69baf6.png` and signup `ig_0349cba8ae703bc50169fa731c323881998962aa643dd1ba4a.png` under `C:\Users\Junwei\.codex\generated_images\019dfa0c-a3d4-7750-bda6-936271d4e3b6`. The auth base CSS has also been consolidated so the old repetitive texture and old non-mirrored signup split are not left behind as shadow rules under later overrides. Auth pages opt out of the global route fade so visible-state browser fidelity captures cannot freeze at opacity 0. Signup is translation-backed, keeps only the real email/password backend fields, hides the password-strength checklist until the user types, and relies on the i18n runtime preserving intentional empty strings so optional generated-reference copy does not render humanized placeholder keys.
- Preserve: Keep existing email/password submit handlers, Google/Strava OAuth entry points, redirect behavior, verification/resend banners, password rules, footer/legal links, login brand-carousel source hooks, and bilingual locale parity.
- Next Risk: Future auth visual passes could add generated-reference-only form fields, place providers above the primary credential flow, remove verification or footer links, reintroduce the old coral gradient through theme-specific selectors, swap the signup photo board back to a vector-only panel, bring back repetitive global grid texture, re-enable route-transition opacity on auth screenshots, restore truthy i18n fallback behavior that turns empty optional copy into placeholders, or leave contradictory auth CSS that only works because of late overrides.
- Rollback Target: `DV-2026-05-05-13`

### Whole Site Taste Frame
- Goal: Keep every Hermes route under one restrained editorial visual frame while preserving each page's existing product contract.
- Changed: `App.jsx` classifies public/auth/runner/admin route surfaces and wraps all routes in `hermes-site-frame`; `style.css` keeps the prior Taste frame, the image-to-code picture treatment, and now adds the `DV-2026-05-04-10` minimalist retry enforcement. The current frame exposes `data-taste-system="design-taste-frontend"`, `data-minimalist-system="minimalist-ui"`, `data-image-code-system="image-to-code"`, plus visible `is-minimalist` / `is-image-code` mode classes. The retry layer force-flattens page-local hero/cockpit/shoe/muscle panels into warm bone/white surfaces, 1px borders, 12px max radii, no gradients, no glass blur, no heavy shadows, and strict black primary CTAs; the Muscle Training `.mt-*` cockpit is additionally normalized back to horizontal auto-height panels so its top fold remains readable.
- Preserve: Keep all current routes, data fetches, auth/admin guards, localized copy, public Landing isolation, Admin Command Lane, shared runner-shell navigation, map surfaces, page-specific smoke contracts, branded route-loading hooks, existing image assets, image-to-code plate treatment, and the visible runner left rail marker/opaque light-mode rail intact.
- Next Risk: Future page-local CSS could bypass or fight the shared frame by adding even more specific gradient/glass selectors after the retry layer, causing one route family to drift back into cinematic styling, making the Muscle Training cockpit collapse into narrow vertical rails again, or making anatomy/shoe images look like unrelated raw pictures instead of contained code-native plates.
- Rollback Target: `DV-2026-05-04-10`

### muscle-training
- Goal: 
- Changed: 
- Preserve: 
- Next Risk: 
- Rollback Target: working tree before this round

### Auth image-code entry
- Goal: Keep `/login` and `/signup` aligned to the generated image-to-code references: restrained warm paper, split editorial/auth panels, condensed performance typography, route-map image language, and flat functional forms.
- Changed: Login and signup now use `auth-page--lab auth-page--image-code` mirrored split boards with code-native route SVGs, runner/figure plates, Manrope editorial headlines, flat form surfaces, theme-proof black primary CTAs, provider buttons after the primary action, compact signup password/verification blocks, and bilingual `auth_lab_*` copy parity.
- Preserve: Keep existing email/password auth behavior, OAuth start handlers, verification/resend banners, redirect logic, footer/legal links, login brand carousel source hooks for regression tests, and the active whole-site minimalist/image-code frame.
- Next Risk: Future auth restyles could reintroduce glass cards, put providers above the primary form flow, break first-view fit, remove generated-reference route/runner motifs, restore the gradient CTA through `body.theme-light` specificity, or add signup fields that the backend does not persist.
- Rollback Target: `DV-2026-05-05-09`

### Recent Runs
- Goal: Keep `/runs` focused on the latest useful run first, with deeper history available only when the runner asks for it.
- Latest Hero Asset: `recent-runs-hero-overlay` now embeds the generated project asset `frontend/src/assets/generated/recent-runs-hero-overlay.png` as a real decorative `<img>` inside the overlay, with the dark left/bottom gradients moved to the overlay pseudo-layer and a route-scoped cream text override so the "最近训练" hero copy remains readable over the artwork.
- Changed: The recent-runs history no longer uses `recent-runs-virtual-list` or react-window on this surface. It renders normal run cards, shows one filtered run by default, and the load-more control reveals bounded 12-run batches. Run cards no longer show the dead three-dot action button; a source smoke guard requires either no card menu button or a real menu implementation.
- Preserve: Keep search, filters, sorting, route-preview thumbnails, run-detail navigation, file import, Strava sync, the single-run collapsed default, the bounded batch behavior for deeper history, and no inert card action controls.
- Next Risk: Future performance cleanup could reintroduce virtualization, render the full history immediately, turn load more back into an all-at-once expansion, or re-add a stop-propagation-only card menu button that feels broken on tap.
- Rollback Target: `DV-2026-05-11-07`

### Admin Portal
- Goal: Keep `/dashboard` and all admin child routes optimized for fast operator queue triage and route-to-decision flow.
- Changed: The admin portal now follows the selected Command Lane direction: persistent left route rail, compact sticky topbar, sticky route command strip with the first metric promoted, and more consistent queue-side vs decision-stage panel treatment across users, course maps, shoes, jobs, audit, and settings. Dark mode carries the command-center mood while light mode has explicit parity styling.
- Preserve: Keep the route-driven admin shell, existing `/dashboard/*` URLs, auth/admin workflows, course-map compare/publish flows, shoe review queue, jobs inspector, audit terminal, and dual-mode treatment. Preserve `admin-command-lane` and the primary summary-card signal as the shared shell contract.
- Next Risk: Broad admin restyles could remove the command strip, make route pages custom in incompatible ways, or let light mode fall behind the dark command-center treatment.
- Rollback Target: `DV-2026-05-01-01`

### Territory
- Goal: Make `/territory` feel like a competitive conquest board, not only a territory report, while keeping route-footprint claiming for ordinary GPS runs.
- Changed: Territory still opens map-first with the full-bleed Leaflet board and route-footprint polygon logic, but the top brief now states the INTVL-style game loop directly: `Run. Capture. Conquer.`, every GPS run paints land, and each daily run can steal rival sectors or defend held ground. The brief adds Run/Capture/Conquer step cards, a local lobby strip, and a route-to-steal/route-to-defend preview tied to the selected sector while the land-control model continues to use GPS sample density, distinct route passes, and recency. `/api/territory` exposes owner/challenger/active score, `controlPct`, and `samplesToContest`; the map renders the sector-command overlay and contest bars from those real control fields instead of fake share percentages.
- Preserve: Keep the Hermes `runner-shell-sidebar` and `runner-shell-topbar`, `/api/territory` and `/api/territory/polygons` fetches, dynamic bundled Leaflet import, `terr-*` prototype layout hooks, `terr-intvl-*`/`terr-game-*` game-loop hooks, clickable zone-selection behavior, sector-command/watchlist overlay, rivalry grid visibility, and the route-footprint/backfill behavior guarded by `TerritoryPolygonComputerTests`, `TerritoryControllerTests`, `territoryIntvlGameLoop.smoke.test.js`, `territoryPrototypeLayout.smoke.test.js`, and `territoryIntegration.smoke.test.js`.
- Next Risk: Future cleanup could hide the rivalry grid behind the old disclosure gate again, remove the game-loop brief/route preview, remove the sector-command overlay/watchlist, blur live vs demo territory states, flatten the score model back to raw sample count, or render contest bars from frontend-only fake percentages.
- Rollback Target: `DV-2026-05-04-14`

### Race Course Map
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### Analysis + Profile Quick Preview
- Goal: Keep Analysis focused on readable trend data without dead drill-down affordances, and make the Profile opening carousel useful as immediate runner data.
- Changed: The Analysis VO2/VDOT overview card is now a static chart article rather than a button to `/analysis/vo2max`, and the ACWR status pill normalizes the low-load tone to `is-muted` instead of emitting `is-cool`. The Profile `runner-dashboard-brand-carousel` now renders readiness, weekly distance, cumulative distance/sessions, and VO2 trend as quick-preview data cards.
- Preserve: Do not reintroduce the `/analysis/vo2max` overview click target, the `analysis-overview-status-pill is-cool` selector, the rotating `brandMsgIndex` marketing carousel, or brand-dot pagination on the Profile dashboard.
- Next Risk: Broad Profile dashboard restyles could bring back the old brand-copy carousel or remove the quick data cards; broad Analysis restyles could make the VO2 chart look clickable again even without a route.
- Rollback Target: working tree before 2026-04-29 Analysis/Profile quick-preview round

### Profile Coach Cockpit
- Goal: Make `/profile` open like a signed-in runner command surface that answers readiness, today's prescription, and recent progress before the lower dashboard modules.
- Changed: The Profile `runner-dashboard-brand-carousel` now also carries `runner-dashboard-coach-cockpit`, `runner-dashboard-profile-dossier`, and `runner-dashboard-profile-image-code`. The exact generated-reference screenshot lock remains removed, and the live image-to-code runner dossier grid now opens with a title row, left runner figure/readiness overlay, center next-session prescription, right stacked quick metrics, and lower reference cards. Below that, `runner-dashboard-profile-dossier-band`, `runner-dashboard-profile-atlas`, `runner-dashboard-profile-continuation`, and `runner-dashboard-profile-signal-ledger` carry the full-page continuation. Latest repair keeps the widened uncollapsed desktop rail/canvas, removes the repetitive lower same-card grid rhythm, styles the streak card through a Profile semantic hook, turns race/predictions into a dark command board, sessions into a wider log board, and metrics into an asymmetric signal ledger.
- Preserve: Keep the original quick-preview data cards and selector hooks, batch-first `/api/profile/dashboard` loading with fallback endpoints, calibrated race predictions, recent-session lower grid, Today Run / Analysis actions, minimalist route-frame compatibility, widened uncollapsed desktop rail, filled profile canvas, collapsed-sidebar behavior, distinct lower section hierarchy, and the previous quick-preview treatment as the recoverable baseline.
- Next Risk: Future Profile restyles could delete the compatibility `runner-dashboard-brand-carousel`/`runner-dashboard-brand-preview-grid` hooks, duplicate the old rotating brand carousel, reintroduce the static exact screenshot lock and break live profile behavior, restore the 100px rail or 1390px content cap, or flatten the dossier/atlas/command/log/ledger sections back into a repetitive generic card grid. Keep Coach Cockpit recoverable as a top-fold wrapper, not a replacement for the lower analytics modules.
- Rollback Target: `DV-2026-05-05-08`

### Profile/Admin Browser Harness Refresh
- Goal: Keep `/profile` and `/dashboard` visually intentional after browser-harness inspection while preserving live runner/admin behavior.
- Changed: Profile now keeps the Coach Cockpit contract but reads more like a training-passport cockpit: stronger card layers, orbit/track texture, denser quick metric cards, and cleaner light-mode contrast. Admin Portal keeps the Command Lane shell but gains a warmer mission-control rail, glass sticky topbar, stronger sticky route command strip, and larger summary cards with explicit light-mode parity.
- Preserve: Keep Profile data fetches, quick-preview hooks, readiness/workout actions, lower dashboard modules, admin route URLs, route-driven admin shell, sticky `admin-command-lane`, and all child-route actions/data wiring intact.
- Next Risk: Future CSS-only admin/profile passes could overfit one theme and let light mode regress, or remove the sticky command strip while preserving only the page-specific child route styles.
- Rollback Target: `DV-2026-05-03-03`

### Environment configuration
- Goal:
- Changed: Created placeholder-only env documentation and hardened ignore rules, but paused because tracked local auth/config files require human credential rotation/history cleanup.
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### Profile and Today dashboards
- Goal: Keep Profile and Today focused on immediate runner decisions, with Today Run answering what to do today and why before deeper workout detail.
- Changed: Added authenticated profile/today batch dashboard endpoints and switched ProfileDashboard/TodayRun to batch-first loading with individual endpoint fallback. Today Run now has `DV-2026-05-04-11`: a `today-run-decision-suite` that groups coaching intelligence, workout focus, readiness panel, briefing, rationale, and metrics into one flat minimalist decision board while preserving the shared runner shell.
- Preserve: Keep `/api/today/dashboard` batch-first loading, individual endpoint fallback, shared runner-shell navigation, existing localized copy, shoe recommendation logic, weather/downshift behavior, workout blueprint, coach reasoning, and the whole-site `is-minimalist` / `is-image-code` frame.
- Next Risk: Future Today Run restyles could split the top fold back into separate metric strip plus old cinematic hero, reintroduce gradients/glass that fight the whole-site minimalist retry, or break the batch-first dashboard fetch.
- Rollback Target: `DV-2026-05-04-11`

### Workflow Builder
- Goal: Make Workflow Builder usable and understandable for empty/error/loading states and accessible to keyboard and screen-reader users while preserving existing workflow wiring.
- Changed: Workflow Builder now has localized loading, error retry, and empty canvas states; React Flow canvas/palette/nodes expose translated accessible labels; palette keyboard activation adds nodes with Enter or Space. The self-loop controller no longer treats drag-and-drop accessibility text as destructive.
- Preserve: Existing workflow store behavior, React Flow routing, runner shell navigation, shoe/route/course-map changes, and unrelated dirty worktree changes preserved.
- Next Risk: React Flow default control accessible names depend on upstream rendering, but localized ariaLabelConfig and explicit wrapper labels are now covered by source guard and build proof.
- Rollback Target: working tree before this round

### Schedule route planner
- Goal: The "计划路线" card on /schedule must answer "where should I run today?" with a real, accessible route on a Leaflet/OSM map — not a static SVG sketch. Recommendation should land instantly even when backend planner is slow.
- Changed: 3-wave round (commits `19020771` + `11141441` + `41ad08d5`). (1) Replaced the normalized-SVG sketch with a real Leaflet map (raw `import('leaflet')`, OSM tiles, polyline + start/finish markers, fitBounds). (2) Auto-plan effect now derives start coords from the most recent run's `/api/activities/{id}/points` (because `/api/activities` doesn't expose top-level `startLat/startLng`). (3) **Recent-run fallback**: when no saved plannedRoutes exist, immediately decimate the most recent run's GPS points (~100 waypoints) and render them on Leaflet as the "based on your last run" recommendation. The async `/api/route/plan` POST still runs and supersedes the fallback when it lands. Single points fetch shared between start-coord derivation and recent-run fallback. New copy `route_planner_source_recent_run` (en + zh).
- Preserve: `/api/route/plan` POST and `/api/route/plan/recent` GET contracts; existing planner-source recommendation precedence (saved planner > recent-run > coach history); Schedule hero, week grid, readiness, next-up, coach card layout; smoke test contract (now asserts Leaflet path).
- Next Risk: `/api/coach/today` `routeRecommendation` still returns SVG-only `preview` with no waypoints — won't render on Leaflet. Backend `/api/route/plan` depends on rate-limited Overpass; expect 10–30s latency or fallback retention. Recent-run decimation strips elevation detail from the rendered polyline.
- Rollback Target: `66b480e9` (pre-wave-1 commit)

### Qwen Course Map Alignment Client
- Goal: Let admins publish real uploaded marathon course-map images even when Qwen cannot extract trustworthy route geometry, while keeping runner-facing maps honest.
- Changed: The pending publish gate can now promote a failed admin-upload scan into a city-level course-map reference for standard city road marathons with known coordinates, but only when the scan did not produce implausible route geometry or an operational Qwen failure. London, Paris, Chicago, and Berlin pending uploads were published as city-level references with confidence 58 and empty route geometry.
- Preserve: Never fabricate route points from a failed map scan. Keep implausible detected routes, timeout/operational Qwen failures, trail/non-standard races, and missing-coordinate uploads blocked from this fallback.
- Next Risk: Future fallback broadening could accidentally turn bad route geometry or non-map uploads into accepted live maps; keep the publish-gate regression tests around the positive city-reference case and the implausible-route rejection case.
- Rollback Target: working tree before this round

### Shoe
- Goal: Let runners bring retired shoes back without losing history.
- Changed: Retired shoes now have one-click reactivation in the Shoes UI, and backend retirement state consistently stamps or clears retiredDate.
- Preserve: Retired shoes stay soft-retired in the database; active endpoints and rotation logic continue excluding retired shoes unless explicitly included.
- Next Risk: Static frontend assets were regenerated by the Vite sync build; unrelated pre-existing translations.js course-map diffs were preserved.
- Rollback Target: working tree before this round

### i18n System
- Goal: All user-visible copy centralized in translations.js with zh-CN/en parity; inline lang ternaries eliminated; translations.js split to per-locale files.
- Changed: 12 files cleaned of inline `lang === 'zh-CN'` ternaries (~397 keys moved to translations.js). Missing keys backfilled (600+ added). translations.js (6,500+ lines) split to locales/zh-CN.js and locales/en.js (3,754 keys each), with translations.js as a 7-line re-export shim. I18nContext imports from per-locale files directly.
- Preserve: All 3,754 translation keys, zh-CN/en parity (0 gap, 0 undefined). Backward compatibility via shim for direct imports from translations.js.
- Next Risk: Future agents adding keys should add to the per-locale files (zh-CN.js / en.js), not the shim. The shim auto-merges both locale files.
- Rollback Target: Wave 1 commit 9371d2c9 (pre-split)

### Course Map Recognition
- Goal: Fix marathon course map recognition — Qwen could not accurately recognize maps or extract routes.
- Changed: RaceCourseMapPromptBuilder completely overhauled with 3-stage prompt (CLASSIFY→GEOREFERENCE→TRACE), Boston Marathon few-shot example, coordinate extraction priority tiers, self-verification checklist. QwenImagePreprocessor added with CLAHE contrast stretch + mild sharpening + PNG output. JPEG quality raised to 0.92. extract_route_path.py added spur removal, 4-directional morphological bridging, multi-color mask combination, auto color detection. AffineTransformEstimator added triangular endpoint weighting + quadratic fallback. Osaka deterministic plan fixed (INTEX Osaka→Nakanoshima Park).
- Preserve: All existing API contracts, CourseMapScanWatcher observability, geometry validation, DB schema. buildPlausibilityRescuePrompt() and knownCourseGuidance() unchanged.
- Next Risk: QwenImagePreprocessor pipeline is NOT yet wired into QwenCourseMapAlignmentClient.analyzeCandidate() — images still flow raw to Qwen. Integration call site documented in Lane 2 mergeNotes. Must wire preprocessImageBytesForQwen() call before image bytes are sent to the Python worker.
- Rollback Target: Commit ceb4f7f5

### Frontend Performance
- Goal: React.memo + lazy loading + list virtualization on top-5 pages.
- Changed: Dashboard.jsx, Shoes.jsx, Races.jsx, Runs.jsx, ShoeBrandLogo.jsx — all wrapped with React.memo. img tags have loading=lazy decoding=async. Shoes grid virtualized with react-window when >20 items. Runs list virtualized with react-window.
- Preserve: All existing behavior, routing, data wiring. CSS grid layout preserved for normal shoe counts.
- Next Risk: react-window v2.2.7 uses rowComponent prop; upgrading may require API migration.
- Rollback Target: Wave 2 commit 77797150

### Performance
- Goal: Preserve existing performance patterns; avoid premature optimization without measurement.
- Changed: React.memo, lazy loading, and react-window virtualization added.
- Preserve: Existing rendering behavior for normal data sizes.
- Next Risk: Virtualization may need tuning for edge cases (empty lists, single items).
- Rollback Target: working tree before wave 2

### Configuration
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### OAuth
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### RacesDetail Real-World Leaflet Basemap
- Goal: Keep `/races/details/:raceId` anchored to a real OpenStreetMap street basemap at useful city-street scale, with the extracted route overlaid above it.
- Changed: The race-detail map now depends on a same-origin OSM tile proxy as the primary basemap, attaches tiles only after Leaflet knows the real stage size and race viewport, and fits to the actual route bounds with a tight pad so the page reads as a real street map instead of a flat color stage. Auto-Hermes tech-debt generation now explicitly skips the generic oversized-file refactor task for `frontend/src/pages/RacesDetail.jsx` because repeated structural rewrites were destabilizing the map path.
- Preserve: Do not re-queue generic “split oversized `RacesDetail.jsx`” work through `/auto-hermes` or `/auto-hermes-max` unless the user explicitly asks for a RacesDetail refactor. Preserve proxy-first OSM tiles, route-first viewport fitting, and the dedicated map smoke-guard files before touching this surface.
- Next Risk: Broad refactors on `RacesDetail.jsx`, especially “oversized file” cleanup rounds, can silently reorder viewport/tile logic or reintroduce raw backend viewport fitting and make the basemap disappear again.
- Rollback Target: working tree before 2026-04-20 race-detail basemap protection round

### Weather Editorial Surface
- Goal: Make `/weather` feel like a premium environmental decision board that answers the runner's first question before a session: is today a green-light weather day, a caution day, or a timing day?
- Changed: Renamed the runner weather route from `/weather-engine` to `/weather` and rebuilt `WeatherEngine.jsx` into a Hermes-native editorial surface. The page now uses a dominant temperature hero, live status kicker, compact humidity/wind HUD cards, a horizontal 12-hour forecast pipeline, a larger `Heat Adaptation Engine` analysis card, and a dedicated `Coach Judgment` companion rail. The redesign preserves the existing `/api/v1/weather/context` acclimatization payload and the Open-Meteo current/hourly fetch instead of introducing new backend behavior. Latest loading fix: page hydration and the Open-Meteo forecast request now have bounded abort timers so backend/API stalls fall back into the visible Weather page instead of leaving loading copy forever.
- Preserve: Keep the route at `/weather` with `/weather-engine` only as a compatibility redirect. Keep the page inside the shared runner shell, keep the forecast + heat-engine data wiring exactly tied to the current APIs, preserve the hero -> forecast pipeline -> engine/judgment hierarchy rather than flattening the page back into equal-weight cards, and keep timeout fallback behavior around both initial Weather hydration and the external forecast fetch.
- Next Risk: Future nav edits could update the shared `runnerShellNav` helper but miss the remaining hard-coded weather nav entries on a few runner pages. Light-mode refinements also need to preserve the same editorial hierarchy rather than falling back to white-card utility styling. Removing the forecast timeout can make the page appear stuck if Open-Meteo stalls or the browser blocks the external request.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-16-39`

### Schedule Weekly Coach Summary
- Goal: Make `/schedule` answer the weekly coach question in one glance by summarizing fitness trend, load state, and block focus in plain coach voice without inventing a new page.
- Changed: Added a dedicated weekly summary block inside the existing Schedule coach rail. The summary is driven by `computeVdotTrend(runs)`, ACWR/load from `getTodayRunRecommendation`, and the current training-block or next-session context. Added `frontend/src/utils/scheduleCoachSummary.js` plus a focused Node test, synced bilingual `schedule.weekly_summary_*` copy, and light/dark-safe styling that keeps the new block inside the current coach card instead of creating a separate surface.
- Preserve: Keep this feature on `Schedule.jsx`, not on a new weekly-summary route. Keep VDOT trend sourced from `computeVdotTrend`, keep load state tied to the same ACWR logic already used by Hermes daily coaching, and keep the summary deterministic rather than reusing the randomized daily `generateMorningBriefing` voice.
- Next Risk: The task queue still points to stale placeholder files (`WeeklySummary.vue`, `WeeklyVerdict.java`). Future rounds should treat `/schedule` as the real weekly-summary surface unless the product intentionally adds a new backend contract or route.
- Rollback Target: working tree before 2026-04-19 weekly coach summary round

### Profile VDOT Fitness + Race Predictions
- Goal: Make the Profile page show a prominent VDOT fitness number with 30-day trend arrow and honest calibrated race time predictions for 5K/10K/half/marathon, directly targeting the "Am I improving?" and "What can I target?" Daily Opening Test questions.
- Changed: Added calibrated race predictions to ProfileDashboard using `predictRaceTimeCalibrated` and then refined the layout so the predictions render as their own feature card directly beside the race countdown card inside the main feature grid. The earlier standalone `runner-dashboard-fitness-strip-hero` block was removed; VDOT still remains visible in the existing load chip + metric strip surfaces instead of repeating as a large separate hero. CSS stays dual-mode-safe and keeps the predictions grid responsive (2-up desktop, 4-up tablet, 2-up mobile). Uses existing `profileVdot`, `profileVdotTrend`, and `racePredictions` memo.
- Preserve: Keep the race predictions card adjacent to the race countdown card on desktop, not as a separate strip below the feature grid. Keep race predictions using `predictRaceTimeCalibrated` (not the raw `predictRaceTime`) so actual race results anchor optimistic predictions. Keep i18n keys in the `profile` namespace. Keep the metric strip/load chip VDOT references as the remaining VDOT surfaces rather than reintroducing a large duplicate hero.
- Next Risk: If `predictRaceTimeCalibrated` returns null for runners with no recent races near a target distance, the prediction slot will be empty; consider adding a fallback message or hiding empty slots.
- Rollback Target: working tree before 2026-04-19 VDOT fitness strip round

### Today Coaching Intelligence Strip
- Goal: Make the Daily Opening Test answerable within 10 seconds by adding a prominent 4-column coaching intelligence strip at the top of Today's Run that answers: (1) Should I run today? (2) Am I getting better? (3) What's my load zone? (4) Which shoes?
- Changed: Added `today-run-coaching-strip` section to TodayRun.jsx above the hero, with 4 answer cards: run/rest/easy recommendation, VDOT trend (improving/steady/declining + delta), ACWR zone with color-coded left border (green/optimal, blue/low, yellow/high, red/danger), and recommended shoe with remaining mileage. Added a dedicated `today-run-load-callout` beneath the rationale block so ACWR now has plain-language coach guidance plus the live ratio and safe-zone reminder, driven by the shared `describeAcwrState` helper in `frontend/src/utils/todayRunAcwrInsight.js`. Added bilingual `today_run.acwr_state_*` copy and matching dark/light theme styling.
- Preserve: Keep the coaching strip above the hero section and the ACWR load callout directly below the rationale block. Keep ACWR thresholds centralized in `todayRunAcwrInsight.js` (<0.8 low, 0.8-1.3 optimal, 1.3-1.5 high, >1.5 danger) so the strip and callout cannot drift. Keep i18n keys in the `today_run` namespace and preserve the dark/light color mapping for each zone.
- Next Risk: If future ACWR threshold changes land only in `todayRun.js` recommendation logic or only in `todayRunAcwrInsight.js`, the recommendation engine and the visible warning card could drift out of sync. The strip/callout layout may also need a quick responsive check around mid-width tablets after future hero edits.
- Rollback Target: working tree before 2026-04-19 coaching-intelligence-strip round

### Route Extraction Pipeline
- Goal: Turn static marathon course-map images into trustworthy geospatial breadcrumbs via an automated end-to-end pipeline (Gemini + OSRM) exposed through an admin surface.
- Changed: Finalized Phase 3/4 by creating `AdminRouteExtractionController` and `MarathonRoutePipelineService`. Added "Run Pipeline" action and status UI to the Admin Dashboard's course-map workspace. Added full i18n support and integration tests for the orchestration flow. Updated `MarathonRouteExtractionService` to handle data URLs (base64) by saving them to temporary files for Python script processing. Fixed unrelated compilation errors in `StravaSyncStateService` and `OAuthControllerTests`. Latest fidelity round tightened Qwen/CV route extraction: out-and-back prompts now require full outbound-turnaround-return geometry, route points must be visible-evidence anchored rather than generic race-memory guesses, collapsed out-and-back rescues now require the standard 12-point plausibility floor, `extract_route_path.py` walks all skeleton edges for branched/forward-back routes, scans all precise palette masks before accepting a merely usable first mask, and `extract_route_parameters_qwen.py` now imports `argparse` plus asks for visible anchors spanning separate return lanes.
- Preserve: Keep the internal multi-service stage separation (Extraction -> Georeferencing -> Matching), preserve the Admin Audit logging for pipeline runs, and maintain the existing "Re-scan" vs "Run Pipeline" distinction in the UI.
- Next Risk: Large route-extraction jobs could timeout the HTTP request if not made async; future rounds might need to move this to a background task with a status polling mechanism if jobs exceed 30s. Keep CV branch-preservation and partial-mask fallback tests in place before loosening color thresholds, because saturated/decorative poster strokes can still beat the intended route if fallback scoring becomes too eager.
- Rollback Target: working tree before 2026-04-18 end-to-end pipeline round

### Backend Reliability + Test Coverage
- Goal: Strengthen Tier 2 Data Trust by making quota reservation atomic (AiUsageService.tryConsumeQuota), adding memory-cap eviction to the rate limiter (ApiRateLimiter.evictStaleWindows), filtering tracking-host URLs from race-official image resolution (RaceOfficialImageService), and expanding SafeUrlValidator to accept PDF data URLs alongside image data URLs.
- Changed: AiUsageService — atomic tryConsumeQuota with per-user and project-level quota checks. ApiRateLimiter — evictStaleWindows to cap unbounded window growth. RaceOfficialImageService — tracking-host + tracking-path filter to prevent false resolution. SafeUrlValidator — expanded data-URL allow-list to include PDF. ShoeImageController — wired to atomic quota path. Added 3 new test classes: AiUsageServiceTests (6 cases), ApiRateLimiterTests (8 cases), RaceOfficialImageFilterTests (14 cases).
- Preserve: Existing quota error codes and the sliding-window rate-limiter semantics. SafeUrlValidator image/PDF distinction. RaceOfficialImageServiceTests covers HTML-parsing integration; RaceOfficialImageFilterTests covers reject-host/path logic separately.
- Next Risk: AiUsageService.tryConsumeQuota and ApiRateLimiter.evictStaleWindows are accessed in tests via public API or reflection — renaming those private methods breaks test files.
- Rollback Target: working tree before 2026-04-18 backend-reliability round

### VDOT Methodology
- Goal: Add VDOT methodology sections to VO2max and Prediction detail pages to increase calculation transparency (Data Trust tier).
- Changed: Verified Vo2MaxDetail.jsx already had methodology section (lines 605-631). Added VDOT methodology section to PredictionDetail.jsx non-marathon view (lines 791-817) using existing CSS classes `analysis-load-command-methodology`, `analysis-vdot-methodology`, `is-prediction-vdot` and i18n keys `analysis.vdot_methodology_*`. Marathon view already had the section (lines 554-580).
- Preserve: Keep the shared methodology CSS classes consistent across Analysis and Prediction pages. Keep i18n keys in `analysis.*` namespace for methodology content.
- Next Risk: Future changes to methodology layout CSS could affect multiple pages - ensure changes are tested on both Analysis and Prediction surfaces.
- Rollback Target: working tree before 2026-04-18 vdot-methodology round

### Analysis + Races Detail Accessibility
- Goal: Keep secondary drill-down interactions keyboard-accessible so premium runner surfaces do not depend on pointer-only discovery.
- Changed: Analysis prediction rows now expose link semantics with accessible labels, the VO2 bar clusters expose readable labels for keyboard and assistive-tech users, and RacesDetail now presents the race map as a described visual region with a non-visual accessibility path plus focus-visible treatments on key actions.
- Preserve: Keep the existing premium shell hierarchy and visual language intact while improving non-pointer access. Keep the race-detail map visually rich without pretending the Leaflet stage is fully screen-reader-operable on its own.
- Next Risk: Remaining chart/map interactions can still regress if future work adds pointer-only hover detail without matching keyboard or descriptive alternatives.
- Rollback Target: working tree before 2026-04-18 secondary-accessibility round

### RacesDetail Course-Map Overlay + Grid Layout
- Goal: Restore the intended Leaflet basemap plus trustworthy aligned course-map overlay on `/races/details/:raceId`, and fix the lower-section grid so the map and readiness card appear side-by-side.
- Changed: RacesDetail normalizes backend course-map preview image aliases, routes the payload through `deriveRaceMapTrust`, and renders the route polyline on real OSM tiles (falling back to city view when trust is low). Latest grid fix: `.race-detail-lower-stack` now has `grid-template-columns: minmax(0, 1.85fr) minmax(260px, 1fr); align-items: start` so the 420px Leaflet map stage and the readiness card sit side-by-side on desktop. Below 1080px the two columns collapse to single-column stacking. `style.css` is the only changed file.
- Preserve: Keep the same-origin tile fallback, trust-gated route/viewport logic, one-time initial route framing, city fallback behavior, and the 2-column lower-stack grid. Do not revert `.race-detail-lower-stack` to a single implicit column — that was the bug. `align-items: start` is intentional so the readiness card aligns to the top edge rather than stretching to the map height.
- Next Risk: Future responsive edits could accidentally remove the `grid-template-columns` rule from `.race-detail-lower-stack` and silently revert to single-column stacking. The leftover `grid-column: span 12` rules on `.race-detail-map-stage` and `.race-detail-readiness-card` inside the `@media (max-width: 1080px)` block are no-ops (no 12-column parent) and can be cleaned up later.
- Rollback Target: working tree before 2026-04-18 grid-fix round

### RacesDetail Full-Width World Map Stage
- Goal: Make the lower map area on `/races/details/:raceId` read as one dominant real-world OpenStreetMap stage instead of a split utility row.
- Changed: `RacesDetail.jsx` now exposes the Leaflet mount as an interactive `region`, while `style.css` gives `.race-detail-lower-stack` a single-column layout, promotes `.race-detail-map-stage` into a taller full-row block, keeps the HUD compact, and demotes `.race-detail-readiness-card` into a narrower support card below the map. Route rendering, trust-gated city fallback, tile fallback, and one-time initial framing all stay intact. Focused smoke tests were updated to enforce the new route-only full-width stage contract.
- Preserve: Keep the route-only Leaflet presentation, same-origin-to-OSM tile fallback, one-time route framing, compact floating HUD, and readiness card below the map. Do not reintroduce a desktop side-by-side lower grid or any scanned-image overlay/fallback layer in the runner-facing map stage.
- Next Risk: Future layout tweaks could shrink the map back into a shorter utility card, widen the HUD until it competes with the basemap, or move the readiness card back beside the map and undo the map-first hierarchy.
- Rollback Target: working tree before 2026-04-19 full-width world-map stage round

### RacesDetail Explicit OSM Bottom Layer + AI Route Top Layer
- Goal: Make the lower race-detail map stage read unambiguously as OpenStreetMap underneath with the current AI-scanned route clearly marked above it.
- Changed: `RacesDetail.jsx` now creates dedicated Leaflet panes for the AI route shadow, route line, and route markers, then renders a pale backing stroke plus the coral route line above the basemap so the extracted path reads as the top-layer signal instead of blending into the tiles. `style.css` also reduces the canvas wash to a very light atmospheric gradient so OSM remains the obvious bottom layer.
- Preserve: Keep OpenStreetMap tiles as the dominant visual base, keep the explicit route-shadow -> route-line -> route-marker pane order, and keep the scanned route represented as geometry rather than a raw image overlay.
- Next Risk: Future style passes could reintroduce stronger canvas tints or remove the dedicated route panes, making the basemap muddy or the AI path harder to distinguish from roads.
- Rollback Target: working tree before 2026-04-19 explicit-layering round

### RacesDetail Blank Tile Failover
- Goal: Prevent the race-detail map from showing a mounted route over an empty gray stage when the proxied basemap tiles never actually arrive.
- Changed: `RacesDetail.jsx` now treats `tileerror` as only one fallback signal; it also starts a short timer after mounting the proxy layer and switches to the direct OSM fallback when no successful `tileload` event arrives in time. Successful tile loads clear the timer, so healthy proxy tiles still stay in place.
- Preserve: Keep the direct OSM fallback URL, keep the explicit `switchToFallbackTiles()` path, and keep the rule that a mounted Leaflet layer is not enough proof of a working basemap without at least one tile load.
- Next Risk: If future refactors remove the `tileload` confirmation or cleanup timer, the route can regress back to drawing over a blank stage while Leaflet still looks "mounted".
- Rollback Target: working tree before 2026-04-19 blank-tile failover round

### RacesDetail Map-Only Lower Section
- Goal: Keep the lower section on `/races/details/:raceId` focused entirely on the world-map stage once the readiness companion card is intentionally removed.
- Changed: `RacesDetail.jsx` no longer renders the `race-detail-readiness-card` block or fetches saved-race data only used by that card. The lower stack now resolves to the map stage alone, and the race-detail map smoke guard now explicitly rejects the removed card.
- Preserve: Keep the lower section map-only unless a future user explicitly asks for a new companion module. Do not reintroduce the old readiness checklist/playbook card by default.
- Next Risk: Old CSS selectors for the removed readiness/playbook classes still exist in `style.css`; future cleanup can prune them, but they should not be treated as active UI requirements anymore.
- Rollback Target: working tree before 2026-04-19 map-only lower-section round

### RacesDetail Kilometer Elevation Chart
- Goal: Make the race-detail elevation chart read as a real course tool instead of a decorative sparkline by giving runners a kilometer-aware profile and more faithful climb changes.
- Changed: `RaceCourseMapService` now samples aligned-route elevation by race distance instead of a fixed 25-point contract, so marathon charts can carry one point per kilometer plus the true finish. `RacesDetail.jsx` now derives kilometer-aware distance marks, gives the chart enough horizontal room to render dense per-km markers, and drops the old fixed `S / 10 / 21 / 30 / F` checkpoint labeling in favor of a per-km lane with stronger 5 km / finish emphasis. Added focused guards in `RaceCourseMapServiceTests` and `raceDetailElevationPerKm.smoke.test.js`.
- Preserve: Keep the race-detail elevation chart driven by aligned-route elevation when available, keep the fallback image/profile path for races without aligned samples, and keep the chart honest about distance by preferring per-km/finish marks over decorative checkpoint labels.
- Next Risk: Future backend sampling changes could slip back to count-based resampling and silently collapse marathon detail again, and future chart restyles could remove the horizontal scroll/stage wrapper and make per-km labels unreadable on long races.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-20-03`

### ShoeCatalog
- Goal: Keep the local Hermes running-shoe model database current and localizable for both zh-CN and en users.
- Changed: Replaced Chinese model names in global brands (Nike, Saucony, Brooks, Puma) with official English product names (飞马→Pegasus, 菁华→Kinvara, 胜利→Triumph, 啡鹏→Endorphin Pro, etc.), removed 14 duplicate entries where Chinese name was a translation of an already-present English entry, added `ZH_MODEL_REVERSE_MAP` in shoeNames.js so `localizeShoeModel()` resolves Chinese→English before falling back to pinyin. Some uncertain mappings (Hurricane, Axon, Sinister, Cohesion, Phoenix, Endorphin Racer, Levitate, Catamount) based on Chinese running community knowledge; 彪电 kept as Chinese.
- Preserve: Only add confirmed running shoes, write series-level entries unless the user explicitly asks for exact versions, prefer an existing family when present, keep Chinese category labels short, keep all Chinese-brand models (李宁, 安踏, etc.) as-is, and do not refactor the `brand()` / `model()` data shape during catalog maintenance rounds.
- Next Risk: Uncertain Saucony/Brooks/Puma mappings may need correction if community sources differ. 啡速/Endorphin Speed and Endorphin Speed 5 coexist — may be redundant.
- Rollback Target: working tree before 2026-05-12 Chinese-to-English shoe name round

### Shoes + AddShoes Brand Logos
- Goal: Make the Shoes ecosystem use real runner-brand marks for the core branded surfaces instead of synthetic text badges for the supported top brands.
- Changed: Added repo-local logo assets for ASICS, Nike, Adidas, New Balance, Saucony, Li-Ning, ANTA, Peak, Bmai, and Do-win under `frontend/src/assets/brand-logos/`, then introduced shared `frontend/src/components/ShoeBrandLogo.jsx` so AddShoes uses the real assets for featured/secondary brand cards and model cards. The live Shoes inventory cards also show the shared logo next to the brand label in the side metadata. The Add Shoes series catalog now stores parent brand identity on each series model and caches the filtered series catalog in localStorage after successful catalog loads so series browsing can recover locally. Unsupported brands still fall back to the existing synthetic mark/text path.
- Preserve: Keep the provided image/logo references as the source of truth for supported brands, keep AddShoes logo rendering routed through `ShoeBrandLogo`, keep Vite `assetsInlineLimit: 0` so small SVG logos are emitted as local static files instead of JS data URLs, keep shoe series filtered through `buildSeriesCatalog` with parent brand metadata, and keep unsupported brands on the fallback renderer instead of showing broken image placeholders.
- Next Risk: The real logos have wider aspect ratios than the old synthetic tiles, so future CSS edits on AddShoes background sizing/positioning or `.shoe-brand-logo-svg` dimensions could make marks look too small, crowded, or low-contrast.
- Rollback Target: working tree before 2026-04-20 real brand logo round

### Shoes Display-Time Image Cleanup
- Goal: Keep stored shoe image references untouched while automatically rendering a cleaned version in the UI when local uploads or remote URLs contain baked checkerboard/flat backgrounds.
- Changed: `frontend/src/utils/removeBackground.js` now fetches remote shoe images through an authenticated same-origin relay before running the display-time cleanup step, so remote URLs no longer fail on browser canvas taint. `Shoes.jsx` now routes inventory cards, current image preview, pending local-upload preview, and remote search candidates through the same processed image renderer instead of mixing cleaned and raw `<img>` paths. Added `GET /api/shoes/render-source` in `backend/src/main/java/com/hermes/backend/ShoeImageController.java` to safely relay validated remote images without changing the stored `photoUrl`. Also performed a one-time cleanup pass on the five shipped brand-logo assets so their current rendered backgrounds are truly transparent.
- Preserve: Keep this as a display-only transformation. Do not overwrite, normalize, or replace the stored `photoUrl` just because a cleaned render exists. Continue using the backend relay only as a display-time fetch helper for remote images.
- Next Risk: The cleanup heuristic still relies on bright neutral edge detection; future tuning should happen centrally in `removeBackground.js` so all shoe-image surfaces stay consistent.
- Rollback Target: working tree before 2026-04-20 display-time shoe image cleanup round

### SecurityFix-SQLInjection
- Goal: Fix HIGH severity SQL injection vulnerability in H2ToPostgresMigrator.java identified by auto-hermes-security audit.
- Changed: Added whitelist validation to printCount() method in H2ToPostgresMigrator.java (lines 278-285). Table names must now match pattern ^(runner|activities|activity_points)$ before being used in dynamic SQL queries. This prevents injection via table name parameter.
- Preserve: Keep the same whitelist pattern used in resetSequence() method for consistency. Migration functionality remains unchanged for allowed tables.
- Next Risk: Future migration tools should follow same whitelist pattern; any new tables added to migration must update whitelist regex.
- Rollback Target: working tree before 2026-04-18 security fix round

### RacesDetail Map Loading
- Goal: Fix Leaflet real-world map not loading in "Tokyo 赛道路线" grid on `/races/details/:raceId`.
- Changed: Modified useEffect at lines 621-623 to clear the Leaflet map instance (`routeMapInstanceRef.current.remove()` and reset to `null`) when `routeMapPoints.length` changes. This allows the map to re-initialize when course map data with route points arrives asynchronously. Added `routeMapPoints.length` to the dependency array alongside existing dependencies.
- Preserve: Keep existing tile fallback logic (same-origin tiles → OSM fallback), map viewport calculations, and route point rendering. The map should still handle missing/corrupt data gracefully.
- Next Risk: Frequent map re-initialization could cause flicker if route data changes often. Monitor performance on slow devices.
- Rollback Target: working tree before 2026-04-18 map fix round

### RacesDetail Performance
- Goal: Fix slow page loading on `/races/details/:raceId` that caused users to wait too long for the page to render.
- Changed: Modified loadState trigger in RacesDetail.jsx (lines 613-617) to remove dependency on `courseMapRequestSettled`. Page now renders immediately when `loadingActivities` becomes false, while the slow `/api/races/course-map` API call continues in background. Course map section appears asynchronously when data arrives.
- Preserve: Keep the existing course map data flow and trust calculations unchanged. The map still loads and displays correctly, just without blocking the entire page.
- Next Risk: Users may briefly see the page without course map content until it loads. This is intentional and better than waiting indefinitely. Monitor for any race conditions between map container ref and async data arrival.
- Rollback Target: working tree before 2026-04-18 performance fix round

### MuscleTraining
- Goal: Make `/muscle-training` answer today's strength decision first while helping runners see which body regions the plan is protecting or loading.
- Changed: The cockpit still opens with the readiness deck, week-dose strip, recovery rail, and week runway. The body atlas now renders each side as ONE coherent muscular silhouette with 34 pixel-traced muscle mask clipPaths (from `muscleMasks.data.json`) overlaid as `.mt-muscle-pixel-fill` rects that highlight active/plan/focused regions. Two anatomy PNG reference images (anterior + posterior) sit behind the masks, clipped to their respective rounded panels. The 18-region label set with leader lines drives plan and clicked-region highlighting. Old per-muscle blob paths and dead display:none layers are deleted. Console-clean verified 2026-05-12 (Playwright, zero errors).
- Preserve: Keep shared runner-shell nav, `/api/muscle-training` plan/check-in/profile wiring, 34 mask clipPaths from `muscleMasks.data.json`, 18-region `REFERENCE_BODY_MEASURE_REGIONS` array, `MASK_KEY_TO_REGION_KEY` mapping, SVG anatomy reference images, and the readiness-deck first fold. Do NOT reintroduce per-muscle blob paths or face-detail layers. Keep the bbox and console-clean invariants verified in this round.
- Next Risk: Mask regeneration could shift pixel-traced paths; run `extract-muscle-masks.py` to regenerate and verify bbox bounds. Console regressions from new frontend deps on the muscle-training route may break the console-clean pass.
- Rollback Target: `68d9e80e` (pixel-traced muscle highlights baseline)

### Dashboard
- Goal: Keep the admin portal as a route-driven operator shell while making each section feel like a first-class operator workspace, with `/dashboard/audit` now reading as a true event terminal rather than a generic data table.
- Changed: The admin portal still keeps the route-driven shell and the recent light-mode coverage, but `/dashboard/audit` is now rebuilt as a Sync Pipeline Terminal inside `Dashboard.jsx`. The route opens with a dark operations hero, a 4-card telemetry strip, a terminal-style event shell with live-log pills, trace search, status inference badges, timestamped rows, and lower drill-down cards for failure clusters and archive exploration. The redesign stays on the current audit payload shape (`createdAt`, `actorEmail`, `action`, `targetType`, `targetId`, `summary`) and adds supporting i18n plus a new `dashboardAuditTerminal` smoke guard.
- Preserve: Keep the current Hermes admin shell, left navigation rail, route structure, audit search query, pagination contract, and real audit data wiring intact. Preserve the terminal-style audit hierarchy in dark mode while keeping it readable in light mode through the existing admin light-mode override pattern.
- Next Risk: Future audit cleanup could collapse the page back into the generic `DataTable` treatment, remove the status inference mapping and leave the terminal badges empty, or replace the dedicated audit terminal classes with shared table styles that lose the reference-driven hierarchy. If audit payload fields change, the trace/summary row formatting should be checked before assuming the terminal layout still reads clearly.
- Rollback Target: `DV-2026-04-19-12`

### StravaWebhookSecurity
- Goal: Reject unauthenticated forged Strava webhook events by verifying owner_id maps to a known registered runner before processing.
- Changed: Added synchronous `runnerRepository.findByStravaAthleteId(ownerId)` check in `StravaWebhookController.handleEvent()` that returns 403 UNKNOWN_OWNER for forged owner_ids before any async processing or resource consumption. The WebhookRateLimitFilter and async runner lookup remain as secondary boundaries.
- Preserve: Keep the synchronous owner_id check as the primary auth gate. Keep WebhookRateLimitFilter as secondary. Keep identical response body for all password-reset paths.
- Next Risk: If the webhook endpoint is refactored to add different auth mechanisms, ensure at least one gate remains. The 150ms timing delay in password reset may need adjustment if sendResetLink latency changes significantly.
- Rollback Target: working tree before 2026-04-24 auto-hermes-max security round

### PasswordResetEnumeration
- Goal: Prevent user enumeration via timing differential in password reset endpoint.
- Changed: Added 150ms Thread.sleep to the not-found path in `LoginController.requestPasswordReset()` to mask the observable latency from `sendResetLink()` on the found path. The response body was already identical for all paths.
- Preserve: Keep the same generic response body for all paths. Keep the timing normalization delay active.
- Next Risk: If email send latency changes significantly (e.g., switching providers), the fixed 150ms delay may not mask it. Consider making it configurable or adaptive.
- Rollback Target: working tree before 2026-04-24 auto-hermes-max security round

### AiShoeScanService
- Goal: Reduce ShoeImageController size by extracting AI provider communication into a focused service.
- Changed: Created `AiShoeScanService` with `callGemini` and `callClaude` methods + `SHOE_PROMPT` constant. Updated `ShoeImageController` to inject and delegate. Controller reduced from 652 to ~555 lines.
- Preserve: Keep `AiShoeScanService.callAi(base64, mediaType)` as the single entry point. Keep `shoeprovider` routing inside the service, not the controller.
- Next Risk: If new AI providers are added, they should go into `AiShoeScanService`, not back into the controller.
- Rollback Target: working tree before 2026-04-24 auto-hermes-max tech-debt round

### dashboard
- Goal: Keep `/dashboard/jobs` as a route-driven operator page while making it read like a true jobs command deck instead of a generic filter row plus table.
- Changed: `/dashboard/jobs` in `Dashboard.jsx` now opens with a dark-led command hero, real page-scoped summary cards, a spotlight-job band, a selectable terminal-style queue, and a sticky selected-job detail rail. The redesign still uses the existing `/api/admin/jobs` contract and now surfaces truthful fields the old table hid, including `triggerSource`, `createdAt`, `startedAt`, `finishedAt`, `totalCount`, and raw `detailsJson`. Supporting styles live in `style.css`, both locales gained the new jobs-deck copy, and `dashboardJobsCommandDeck.smoke.test.js` guards the new structure.
- Preserve: Keep the shared Hermes admin shell, left navigation rail, `/dashboard/jobs` route, existing status/type filters, pagination contract, and `triggerSync()` wiring intact. Keep the page dark-led in hierarchy while maintaining explicit `body.theme-light .admin-command-page` overrides for the hero and workbench surfaces.
- Next Risk: Future cleanup could flatten the selectable jobs terminal back into a generic `DataTable`, stop refreshing queue summary alongside the jobs payload and leave the hero metrics stale, or hide `detailsJson`/timeline fields again by reducing the right-side panel to summary-only copy. If new job types/statuses are added, update the tone mapping and labels rather than letting rows fall back to visually ambiguous default badges.
- Rollback Target: `DV-2026-04-19-12`

### telemetry-surface
- Goal:
- Changed:
- Preserve:
- Next Risk:
- Rollback Target: working tree before this round

### I18N Trust (Runs / Rewards / Races)
- Goal: Fix wrong-page i18n strings that erode runner trust — mojibake Chinese text, cross-page label leakage, missing retry actions on error states.
- Changed: Replaced Runs.jsx mojibake `鎵嬪姩瀵煎叆` with `t('runs.manual_import')`. Added `runs.manual_import` key in both language sections. Replaced Rewards.jsx error/loading state that used `analysis.stitch_load_error` / `analysis.stitch_loading` with proper `rewards.*` keys (`rewards.loading`, `rewards.load_error`, `rewards.retry`, `rewards.error_eyebrow`, `rewards.error_title`) and added a retry button. Added `rewards.loading` key to both language sections and minimal CSS for rewards error state. Replaced Races.jsx loading/error state that used `runs.loading` / `runs.load_error` with `races.loading` / `races.load_error`. Added both keys to the races sections in both language sections. Added CTA buttons ("Open Runs" / "去跑步记录") to Rewards earned and upcoming empty states so zero-run users can navigate directly to Runs. Replaced hardcoded `MONTH_NAMES_EN/ZH` arrays and `lang === 'en'` pace-zero string with `t('runs.months')` and `t('runs.pace_zero')` i18n keys.
- Preserve: Keep all existing i18n keys intact. Keep the shared `analysis.stitch_*` shell keys for pages that intentionally share the analysis shell. Keep the rewards sidebar using shared shell keys for brand/settings/profile navigation.
- Next Risk: Other pages may still reference wrong-section i18n keys for their loading/error states (e.g., using `analysis.stitch_loading` instead of their own section keys). The reward badge strings in `rewardBadges.jsx` still bypass the i18n system with inline `lang === 'zh-CN'` conditionals.
- Rollback Target: working tree before 2026-04-17 i18n-trust round

### Shoe Rotation & Race Prep
- Goal: Enhance Tier 1 trust by surfacing gear health and goal-event urgency.
- Changed: Added `calculateRotationHealth` to `shoeRotation.js` (variety-to-rotation-size ratio). Surfaced "Rotation Health" stat on `/shoes`. Added "Next Race" countdown card to `/profile` feature grid with dynamic training phase advice (Taper/Peak/Specific/Base). Updated translations for all new signals.
- Preserve: Keep the 21-day lookback for shoe signals. Keep the race-phase thresholds (7/21/56 days) as the coaching baseline.
- Next Risk: Feature grid on `/profile` now has 5+ items; check wrapping on smaller viewports.
- Rollback Target: working tree before 2026-04-16 Shoe/Race round.

### Daily Coach Insights (VDOT, Stamina, & Weather)
- Goal: Enhance Tier 1 trust by surfacing the "Am I improving?", "How hard should I run?", and "Is the target pace adjusted for conditions?" signals more prominently and clearly.
- Changed: Added a VDOT Trend insight card to `/analysis` explaining the 30-day window comparison (+/- delta) with coach-voice guidance. Surfaced Stamina score, recovery cap, and target heart rate on `/today-run` metrics grids. Suggested paces on `/today-run` (hero and blueprint) now automatically reflect `weatherContext.pacePenaltySecPerKm` with a "Normal pace" comparison display for transparency. Hardened `RaceCourseMapService` to support PDF course-map links (including manual admin URLs) by rendering the first page to PNG.
- Preserve: Keep the 30-day robust mean VDOT trend logic as the primary longitudinal signal. Keep the stamina calculation (score/cap) backend-driven while allowing frontend fallbacks when the payload is missing. Keep weather adjustments automatic in the recommendation utility.
- Next Risk: Adding more metrics to the `today-run` panel could clutter the hero on mobile (390px); monitor the grid wrap behavior.
- Rollback Target: working tree before 2026-04-16 VDOT/Stamina/Weather round.

### Global Theme System
- Goal: Let runners switch between dark and light mode without losing the shared Hermes shell language, so the app can read as one coherent product in either theme instead of only feeling intentionally designed in dark mode.
- Changed: Hermes still runs through the same shared `ThemeProvider` and stable body/data-theme hooks, and the shared runner shell plus the main runner-facing card grids still follow the Aerodynamic Gallery light baseline together. The public signed-in website theme system is now intentionally only two-mode, though: `晨光亮面` (`light`) and `午夜脉冲` (`midnight`). The extra public `high-contrast` variants were retired from the runtime picker, and any saved `high-contrast` or `high-contrast-light` preference now auto-normalizes onto `midnight` or `light` instead of keeping a third or fourth active website mode alive.
- Preserve: Keep theme choice driven by the same Settings picker and shared `ThemeProvider`, keep Hermes as an equal-quality two-theme product across `light` and `midnight`, keep retired theme saves auto-mapped onto the nearest survivor instead of breaking startup, and continue fixing theme support by extending shared grid/theme selectors or explicit route-level card families instead of forking each page into unrelated visual dialects.
- Next Risk: Standalone cinematic routes or older page-local shells can still look partially dark in light mode until they get their own route-level pass, and future theme refactors could accidentally reintroduce retired public theme values if someone widens `ThemeContext` or the Settings theme-card list without checking this product decision first.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-99`

### Shoes Light Mode
- Goal: Keep `/shoes` feeling like the same premium runner-inventory surface in light mode instead of leaving the shell light while the shoes-specific content stays dark and low-contrast.
- Changed: The shoes light-theme override layer still covers the stage panels, sticky topbar, search field, pills, action rows, browser/watch panels, duplicate panel, and the large performance signal module, and the topbar avatar on `/shoes` now resolves from the real Hermes profile identity instead of using an auth-email-only fallback.
- Preserve: Keep the existing shoes JSX structure and live inventory/recommendation behavior intact, keep light-mode support localized to the shoes-specific style family rather than forking the route away from the shared runner shell, and keep the avatar fallback sourced from runner identity instead of route-local shoe data.
- Next Risk: Future shoes enhancements can easily reintroduce dark-only breakage if new `shoe-*` surfaces are added without extending the light-theme block beside the existing shoes overrides in `style.css`, and shell/header refactors could accidentally swap the avatar fallback back to auth-only or route-local derivation.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-89`

### Races
- Goal: Keep `/races` feeling like a trustworthy global race-discovery surface where marathon runners can browse a broad world catalog in their current language without breaking stable catalog filtering, saved-race data, or image-source truthfulness.
- Changed: The race center still uses the same expanded global catalog and saved-race workflow, but country chips, discovery cards, and saved calendar rows now localize country names, city/location text, and known catalog race names in Chinese while preserving English in the canonical catalog/store values. Search on the discovery strip now also matches both canonical English fields and the localized Chinese display labels, so translated names remain discoverable instead of becoming display-only dead text. That localization layer now lives in one shared `frontend/src/utils/raceLocalization.js` utility, and a focused `raceLocalization.smoke.test.js` now checks the key race-target/country/name/location cases plus the `Races.jsx` shared import so future edits do not silently fork the labels back into page-local drift. Race imagery now also follows one shared precedence across discovery and detail routes: official marathon site image first, then host-city page image when the race site has no usable image, and only then the existing generic visual fallback. The official-image resolver now also enforces `https` image candidates only, the backend drops stale cached `http` artwork instead of replaying it, and the frontend race-image cache evicts previously persisted non-https entries so CSP-blocked URLs do not keep returning after the fix. The detail route no longer pretends to have an official Tokyo course trace when it only has hand-authored frontend geometry: the synthetic hardcoded race polyline is gone, and the detail map now works through one new backend-alignment path. Hermes can search for likely official course-map images, run AI-assisted alignment to infer real-world route points and overlay bounds with confidence gating, render that approximate route/overlay on Leaflet when the confidence is high enough, and sample elevation from the aligned real-world route. When alignment is not confident enough, the page intentionally stays in the city-context fallback instead of pretending the route is verified. The course-map scanner now also probes relative `about/course` and `about/course-map` pages from the official site root before falling back to shallow root-only paths, resolves those relative probes correctly even when the official race URL is itself nested, can rasterize linked PDF course-map downloads into PNG data URLs so PDF-only official route pages can still flow through the same AI alignment pipeline, applies that same PDF-to-image normalization to admin-submitted dashboard uploads so accepted live assets stay race-detail-ready, and now stops before Bing image search when the official race site already yields viable course-map candidates. The race-detail map card mounts Leaflet on a dedicated inner host again, matching the direct-host pattern used by `/run/:id`, so the city fallback and aligned route modes both keep their real map tiles visible instead of collapsing into a blank-looking overlay stage. `/races/details/:raceId` also no longer hides the whole page behind runner-data hydration: the route can render from catalog data immediately, while profile/prediction state hydrates in the background, race prediction uses the lighter `/api/activities/analysis` summary payload instead of the full activities list, saved-plan truth comes from a dedicated lightweight `/api/races/saved-status` summary call instead of hydrating the full decorated `/api/races` collection just to answer one checklist boolean, and the fallback `/api/races/elevation-profile` request is gated behind the course-map result so the detail page avoids launching that expensive scrape until the course-map path has settled and proven aligned elevation samples are unavailable. The shared `/races` topbar profile-actions wrapper also now carries the required `analysis-stitch-topbar-profile-actions` shell marker again, matching the approved premium runner-shell treatment used on the sibling runner surfaces.
- Preserve: Keep `worldRaceCatalog` canonical in English for ids, filter keys, and saved form prefills, keep country filtering matched against the raw `country` keys rather than translated labels, keep race-name localization as a display-layer mapping keyed from catalog identity, preserve the expanded China-heavy catalog distribution, keep the current Race Center hierarchy and shared-shell behavior intact, keep city-page imagery as a fallback source rather than presenting it as the race's own official artwork, prefer real map tiles over poster-image backdrops for route cards, prefer official-course-derived route shapes over decorative fake map overlays whenever a detail card claims to show a real course, keep remote race imagery constrained to CSP-compatible `https` sources unless Hermes adds a same-origin proxy later, keep the elevation panel driven by backend-interpreted route or chart data instead of decorative estimates, keep AI-aligned course overlays explicitly labeled as approximate rather than verified official GPS, keep locale-rooted official course-page discovery (`about/course`, `about/course-map`) in the scanner so translated site roots still feed the AI alignment path, keep PDF course-map downloads and admin-submitted PDF uploads flowing through the same alignment path via rasterized image data rather than a separate fake fallback, keep race-detail runner personalization non-blocking so slow background hydration cannot blank the route shell again, and keep the saved-state check on detail routed through the lightweight summary contract instead of the full saved-race list payload.
- Next Risk: Future catalog additions could duplicate existing race IDs, add new localized labels directly inside page components instead of the shared `raceLocalization` utility and smoke test, accidentally localize form save payloads instead of only the rendered labels, rework search/filter logic in a way that compares translated labels against canonical keys and breaks country chips, loosen the image validation path and let `http` artwork back into cache, bypass the shared image resolver and silently restore generic visuals ahead of the city fallback path, restyle the map card without rechecking that Leaflet tiles and image overlays still render correctly in both light and dark themes, remount Leaflet on the outer copy/overlay wrapper instead of the dedicated inner map host and regress the real-world tiles again, strip the scanner back to shallow root-only page probes and regress Tokyo-style locale roots to city fallback again, stop rasterizing PDF course-map downloads or admin PDF uploads and quietly make PDF-backed course maps unreadable to the AI aligner again, reintroduce a full-page `loadState` gate around profile/activities hydration, switch the prediction data path back to the heavyweight `/api/activities` payload, switch the saved-state path back to the heavyweight decorated `/api/races` payload, fire the elevation-profile fallback request eagerly before the course-map result settles and bring back redundant slow page-mount work, weaken the AI confidence/plausibility gates and start drawing low-trust course traces, describe the aligned overlay as verified GPS instead of the intended approximate course-map interpretation, or refactor the `/races` shell header without preserving the required `analysis-stitch-topbar-profile-actions` marker on the topbar profile-actions wrapper.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-29`

### Races Detail Map Trust
- Goal: Keep `/races/details/:raceId` honest about geography so the runner sees a real Leaflet route in the correct place, and only sees the embedded course-map image when Hermes has enough evidence that the overlay matches the traveled path.
- Changed: `RacesDetail.jsx` now routes the course-map payload through a dedicated `raceDetailMapTrust` utility before rendering Leaflet. The detail map still uses real OSM tiles and the aligned route polyline, but it now suppresses misleading embedded course-map overlays when the overlay is low-confidence, wrong-city, too sparse, or wildly oversized relative to the route. The map viewport now follows the trusted route bounds instead of blindly fitting the image canvas, and start/finish labels are carried onto the Leaflet markers when available. Focused `raceDetailMapTrust.test.js` coverage now locks in the good-overlay, wrong-city, oversized-overlay, and sparse-marathon cases. A later runtime hardening pass also added a direct OSM tile fallback and explicit error logging/fallback city rendering, so if the proxy tile path or aligned overlay logic breaks at runtime the race-detail card still shows a visible Leaflet map instead of a silent blank host.
- Preserve: Keep the route polyline on real Leaflet tiles as the source of geographic truth, keep embedded course-map images as an optional trust-gated layer rather than the primary map, keep the city fallback when Hermes cannot trust the route, keep the tile-proxy path preferred when it works, and keep the route page honest by preferring a visible fallback map over a silent failure.
- Next Risk: Future race-detail cleanup could bypass the trust utility and re-enable image overlays directly from `courseMapData`, lower the overlay confidence floor until weak AI guesses become visible again, remove the tile fallback or restore a swallowed Leaflet init error path, or switch the viewport back to raw overlay bounds and re-center the map on the poster image instead of the actual route.
- Rollback Target: working tree before 2026-04-18 race-detail leaflet runtime fallback round

### Races API
- Goal: Keep `/api/races*` trustworthy at the controller boundary so auth failures, invalid payloads, and fallback resolver paths return stable contract-safe responses instead of leaking inconsistent shapes back to the runner-facing race surfaces.
- Changed: Added focused `RaceControllerTests` coverage for unauthorized access, missing create payloads, unsafe notes, valid create status normalization, missing owned-race updates, official-image URL validation, blank elevation-profile name rejection, unexpected elevation-profile resolver failure, the new course-map alignment endpoint, and the new lightweight `GET /api/races/saved-status` summary path. `RaceController.elevationProfile(...)` now keeps the fallback payload shape aligned with the success contract by returning `profileSamples: []` even on unexpected resolver exceptions instead of dropping that field. The new `saved-status` endpoint stays auth-protected, validates/sanitizes `name`, uses a direct repository lookup instead of decorating the full race list, and returns only `{ saved, raceId }` so race detail can answer checklist truth cheaply. `RaceCourseMapService` now also probes relative `about/course` and `about/course-map` pages from the official site root, resolves those relative probes correctly against nested official URLs, accepts linked PDF course-map downloads as candidate assets, rasterizes the first PDF page into a PNG data URL for the existing AI alignment flow, and applies that same PDF-to-image normalization to admin-submitted dashboard uploads so uploaded course maps can be accepted live in the same race-detail-ready shape. Focused `RaceCourseMapServiceTests` now cover both the Tokyo-style locale-rooted page, a PDF-only official course page, and the admin upload path. Official-site course-map discovery now short-circuits before Bing image search when the official race website already yields viable course-map candidates, which cuts the detail-page wait time and reduces noisy non-official candidates that were delaying or weakening alignment. The AI plausibility gate now also scales its route-distance tolerance by route-point density, so sparse-but-real marathon course traces from official images or PDFs can still become aligned map/elevation results without dropping the centroid and bounds sanity checks. The service now asks the AI for multi-hypothesis `candidateAlignments`, scores each interpretation deterministically against route density, centroid fit, distance fit, and longest-segment sanity, and picks the strongest plausible route instead of trusting a single high-confidence guess. New focused tests lock in best-candidate selection, sparse marathon rejection, wrong-city rejection, and smoothed elevation/climb behavior. The new `RaceCourseMapAsset` store and `/api/races/course-map` endpoint now search for likely course-map images, run AI-assisted alignment with route/bounds plausibility gates, persist scans globally by `raceId` as pending previews, and prefer the globally published live asset when one exists. The new admin endpoints can upload/scan pending previews, publish them live, and clear pending state without exposing half-broken payloads to the public route.
- Preserve: Keep controller coverage narrow and mock-based for boundary behavior, preserve the existing `/api/races`, `/api/races/official-image`, `/api/races/elevation-profile`, and `/api/races/course-map` response contracts, keep the new `/api/races/saved-status` response minimal and auth-protected, keep official course-page discovery broad enough to include locale-rooted `about/course` style paths without turning the scanner into a blind crawler, keep PDF downloads and admin-submitted PDF uploads converted into a usable image form before they reach the shared alignment path, prefer official-site candidates over Bing fallback when they already exist, keep AI-aligned course-map output explicitly separate from verified GPS truth, keep multi-hypothesis alignment selection backward-compatible with older single-hypothesis model responses, keep globally stored race course maps under `pending preview -> live` governance instead of auto-publishing every scan, and avoid broad persistence or serializer changes when extending this controller test family.
- Next Risk: Future race-controller endpoints or response fields could bypass the same auth/error coverage pattern, changes to elevation-profile fallback behavior could quietly drop `profileSamples` again if tests stop asserting the stable empty-shape contract, the course-map endpoint could start returning half-populated alignment payloads if its null-safe fallback contract is weakened, the course-map scanner could regress locale-rooted official pages if the `about/course` probes or tests are removed, PDF rendering could drift out of the alignment path if PDF candidates or admin uploads are treated like normal image URLs again, official candidates could lose their speed/reliability advantage if someone restores unconditional Bing search ahead of or alongside them, the deterministic scorer could drift away from the prompt contract if `candidateAlignments` stops repeating the best route in the top-level fields, the sparse-route or longest-segment thresholds could be loosened until wrong-city poster interpretations pass again, the saved-status endpoint could drift back into full-list decoration or ambiguous duplicate-name matching without an explicit contract decision, or someone could bypass the asset store and reintroduce ephemeral scan-only behavior that admins can no longer govern globally.
- Rollback Target: working tree before 2026-04-15 race-controller coverage round

### Admin Portal
- Goal: Keep `/dashboard` as a trustworthy operator command center where admins can review globally impactful asset changes before they reach every runner, and make course-map uploads fast enough that admins actually re-run the AI pass when the first scan underperforms.
- Changed: The admin portal `Race Course Maps` tab still uses the `pending preview -> live` review model with aligned-map previews, and the workspace still supports drag-and-drop, image/PDF upload, paste-from-clipboard images, and `Re-analyze this upload`, but the dashboard copy path is now localized more completely for Chinese operators. The top brand mark, role labels, subscription tier labels, course-map workspace title, AI-scan guidance, and catalog bilingual chips now resolve through dashboard i18n keys instead of mixing Chinese with leftover English labels like `Race Course Maps`, `ADMIN`, `USER`, `FREE`, `PRO`, `ZH`, and `EN`. Job rows now also map known type/status enums through localized dashboard labels instead of showing raw enum values for the common states. A follow-up repair also restored the dashboard page after the translation round briefly broke the bundle path: the actual failure was the dashboard i18n source file becoming invalid for the frontend build, not a backend `/dashboard` route failure. The newest regression turned a narrow set of zh-CN dashboard keys into literal `????` placeholders even though the rest of the file stayed valid JS, so the fix restored those 17 operator-facing strings and added `dashboardTranslations.smoke.test.js` plus a frontend `npm test` hook entry to catch future question-mark rewrites before they ship. Another follow-up repair hardened `AdminCourseMapPreview` so aligned-map mode no longer fails closed into a permanent blank gray box: if Leaflet setup fails or the map is still not ready, the panel now falls back to the source image instead of hiding all visual content behind the wash layer, and `dashboardCourseMapPreview.smoke.test.js` now guards that fallback path. The next fix closed the deeper runtime gap for admin detail: `RaceCourseMapService.getAdminDetail(...)` now materializes external course-map URLs into a displayable `previewImageUrl` data image for `pendingPreview`, stored `live`, and `currentLivePreview`, while the dashboard preview component now prefers `previewImageUrl` over raw `imageUrl`. That means the review panes no longer depend on direct browser access to brittle third-party course-map hosts like `legacyhalf.tokyo`. The next root-cause fix for the still-blank panel was frontend layout: in map mode the fallback `<img>` and the Leaflet host were being rendered as normal flex children inside `.admin-review-preview`, so the image could collapse/clip instead of occupying the same stage. `AdminCourseMapPreview` now renders explicit image/map overlay layers, and the matching CSS makes them share one positioned preview stage. The latest regression turned out not to be backend alignment data at all: Leaflet was fitting preview bounds before the admin panel had its real size, then only invalidating size later, so the route rendered on a stale blank viewport. `AdminCourseMapPreview` now reapplies `fitBounds(...)` and redraws tiles after `invalidateSize()` once layout settles, and the smoke test now guards that resize/refit path. The final root-cause issue was basemap delivery itself: the preview still depended on direct browser requests to `tile.openstreetmap.org`, so the background could stay blank even while the route line rendered. Hermes now serves admin preview basemap tiles through a same-origin `GET /api/maps/tiles/{z}/{x}/{y}.png` proxy in `MapTileController`, and `AdminCourseMapPreview` now uses that Hermes tile URL instead of the third-party host directly. The new `MapTileControllerTests` and updated dashboard smoke test lock in the proxy path.
- Changed: Latest course-map upload flow now stores each uploaded pending map first, then automatically runs the Qwen reanalysis job through a dedicated single-thread FIFO course-map executor. Upload and manual reanalysis jobs share that serial lane so admins can add maps one by one without parallel scans colliding, and the dashboard now shows a queued status while the scan waits its turn.
- Changed: Dashboard course-map progress now tracks active upload/reanalysis/pipeline actions per race instead of one global action. A queued `PENDING` reanalysis renders as a stable waiting bar for that race, and repeated identical job polls no-op so the progress bar does not blink or restart while another course-map scan owns the FIFO lane.
- Changed: Follow-up scan failure repair prevents stale staged upload summaries from surviving failed analysis jobs. Upload/reanalysis catch paths now persist a pending-preview failure summary when Qwen or image resolution fails before a replacement result is saved, and stored legacy `Click Re-analyze` placeholders are sanitized to the automatic scan wording on read.
- Changed: Admin course-map `已上线` / live status is now reserved for snapshots that can render an actual route layer on OpenStreetMap. Raw stored live images without route geometry remain usable as pipeline source material, but they no longer count as live in the course-map queue, filter, or comparison panel.
- Preserve: Keep the admin shell inside the existing dashboard route, keep the `pending preview -> live` review model intact for both race-course and shoe assets, keep `/pending/scan` as the web-search path and `/pending/upload` as the new-upload path (do not fold them together), keep `/pending/reanalyze` strictly reusing the stored pending image, keep paste image-only unless a dedicated PDF paste path is intentionally designed later, keep the workspace preview driven from the same stored alignment contract the public race-detail route publishes, and keep dashboard-visible operator copy routed through `translations.js` rather than reintroducing raw English labels in `Dashboard.jsx` or corrupting the locale file through unsafe rewrite paths.
- Preserve: Keep course-map upload scanning FIFO and non-parallel by routing upload-triggered scans and manual reanalysis through `runCourseMapScanAsync(...)`; that lane now requires a database-backed FIFO claim before entering the scan body, so queued maps stay `PENDING` while another course-map scan is `RUNNING` and only the oldest pending scan can transition to `RUNNING`. Keep the JVM lock as a local optimization only, and keep generic background jobs on the existing pool.
- Preserve: Keep the course-map live label stricter than the stored `live` payload: a race is `live` only when the selected current/stored live preview has route points that draw on OSM, not when Hermes only has an image, city marker, or empty fallback map.
- Next Risk: Future admin changes could reintroduce direct-to-live image writes, collapse the three distinct admin actions (scan / upload / reanalyze) back into one ambiguous button, drop local PDF data-url support at validation time, weaken the upload guidance so operators feed poster-style assets that look fine visually but scan poorly for AI alignment, add new dashboard labels as raw English strings instead of extending the dashboard i18n block in both locales, rewrite `translations.js` through the wrong encoding path and break the dashboard bundle again, partially overwrite the zh-CN dashboard block with ASCII `?` placeholders while leaving the file syntactically valid, remove the preview fallback path and let Leaflet import/init failures regress back into blank review grids, stop refitting bounds after the preview host resizes and bring back the blank stale Leaflet viewport, switch the preview back to direct third-party OSM tile URLs and reintroduce blank backgrounds in blocked environments, or stop materializing `previewImageUrl` in admin detail and push the dashboard back onto fragile third-party image hosts.
- Next Risk: A future refactor could accidentally move `/pending/upload` or `/pending/reanalyze` back to `runAsync(...)`, remove the database-backed FIFO claim, or rely only on the JVM lock again, which would restart parallel Qwen scans and make `CourseMapScanWatcher` evidence unreliable again.
- Next Risk: Future dashboard state cleanup could collapse `courseMapActions` back into a single selected-row action, which would make two reanalysis jobs fight over one progress bar and bring back the 8% queued blink.
- Next Risk: If scan failures are only written to the background job and not the pending course-map asset, admins will again see a stale staged-upload preview and think the analyzer never ran.
- Next Risk: Future dashboard status cleanup could accidentally switch `getCourseMapStatus(...)` back to `getCourseMapLive(...)` and mark blank live-image records as `已上线` even though no OSM route layer exists.
- Rollback Target: working tree before 2026-04-17 admin course-map upload-UX round

### Shoe Catalog API
- Goal: Keep `/api/shoe-catalog*` trustworthy at the controller boundary so catalog browse/admin flows keep stable auth, validation, and payload contracts as the shoe import and catalog tools evolve.
- Changed: Added focused `ShoeCatalogControllerTests` coverage for the list payload shape, admin-only rejection, create-brand validation, create-model success normalization, import-page success/error responses, duplicate-model conflict handling, delete-brand summary payload, and missing-model update handling. This was a test-only round; runtime behavior did not change.
- Preserve: Keep shoe-catalog controller coverage narrow and mock-based for boundary behavior, preserve the existing `/api/shoe-catalog` and `/api/shoe-catalog/admin/*` response contracts, and avoid broad repository/service rewrites when extending this test family.
- Next Risk: Future shoe-catalog endpoints or response fields could bypass the same auth/error coverage pattern, and changes to import/create/update payload shapes could drift if new tests stop asserting the current map keys and normalization behavior.
- Rollback Target: working tree before 2026-04-15 shoe-catalog controller coverage round

### Profile
- Goal: Keep `/profile` reading like one coherent coach dashboard where the top fold answers readiness and workout intent quickly, and the next layer turns synced run history into a clear progression story instead of disconnected utility cards.
- Changed: `/profile` still uses the shared runner shell, the workout/load/session cards, the lower aligned 2x2 feature grid, and the VDOT trend chip derived from `computeVdotTrend(runs)`. The inserted full-width progression section still behaves like an explorable cumulative-history surface, and the old textual readiness feature card has been replaced with a backend-driven `体力值 / Stamina` module. `AutomatedCoachService` derives a stamina DTO from sleep score, resting-HR drift, HRV, weekly load ratio, high-intensity share, and today's scheduled workout, and `CoachController` returns that in coach state. The latest profile pass no longer presents stamina as a standalone orb or pasted mini-dashboard inside the grid: the same DTO is now expressed through a shared feature-card composition with a score band, recovery sidecar, shared progress rail, and compact pace / heart-rate cells so the card reads like the rest of the editorial grid in both dark and light mode.
- Preserve: Keep `/profile` wired only to the existing profile/activity/coach data already loaded on the route, preserve the current upper dashboard cards and lower 2x2 feature grid rather than replacing them with a standalone gadget surface, keep the progression atlas cumulative/timeframe math grounded in the real synced `runs` array instead of placeholder demo values or invented chart samples, keep the VDOT trend chip as a separate display-only signal, and keep the stamina card as a coach-readiness signal rather than a fake physiology score disconnected from Hermes inputs.
- Next Risk: Future profile cleanup could desync the stamina card from backend coach-state math and quietly reintroduce frontend-only guesses, remove the active-point hover/focus behavior and regress the chart back to a static latest-pill, weaken the integrated stamina treatment in one theme, restyle the card with generic boxed-dashboard patterns that break the shared dual-mode profile language, or let later coach-state schema changes drop the stamina DTO without an obvious frontend fallback.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-16-37`

### Coach Automation API
- Goal: Keep `/api/coach/*` trustworthy at the controller boundary so auth failures and bad recovery/profile/training-block inputs return stable errors instead of silently mutating runner state.
- Changed: Added focused `CoachControllerTests` covering unauthorized access, typed schedule/alert responses, recovery/profile validation pass-through, training-block required-field and unsafe-name rejection, and successful block-start state return. The backend suite also now keeps the OAuth login callback test aligned with the current Strava-first auto-provision contract so repo-wide verification stays green. The coach service is now also race-tolerant on first signed-in load: if parallel `/api/coach/state`, `/api/coach/today`, and `/api/coach/schedule` requests collide on the unique coach-state or schedule-row inserts, Hermes now re-reads the winner instead of surfacing a `500`.
- Preserve: Keep coach controller tests narrow and mock-based for boundary behavior, preserve the current Strava login-state behavior where unmatched athletes auto-provision a runner instead of redirecting to manual confirmation, and keep the lazy-create coach state/schedule path tolerant of parallel dashboard fetches.
- Next Risk: Future coach endpoint additions could skip the same auth/error coverage pattern, future schedule mutation changes could reintroduce duplicate-write races outside the recovered horizon path, and future OAuth linking changes could drift the login/signup auto-provision contract away from what the tests now document.
- Rollback Target: working tree before 2026-04-13 coach-controller coverage round

### Strava Webhook
- Goal: Keep `/api/strava/webhook` contract-safe so Strava subscription checks, malformed event payloads, and async activity dispatches do not drift into 500s or silent branch regressions.
- Changed: Added focused `StravaWebhookControllerTests` coverage for verify-token/mode rejection, successful challenge echo, missing-owner no-op behavior, malformed athlete-update payload safety, ignored non-activity payloads, async sync/delete dispatch for matching runners, string-id coercion, and missing-runner no-op handling. `StravaWebhookController` now also uses a null-safe `map(...)` helper for `updates`, so malformed deauthorization payloads are ignored instead of throwing before Hermes can return Strava's expected fast `EVENT_RECEIVED` response.
- Preserve: Keep the webhook controller narrow and response-contract oriented, preserve `EVENT_RECEIVED` as the stable success body for ignored or accepted webhook events, keep malformed/non-actionable payloads as safe no-ops rather than hard failures, and keep sync/delete side effects delegated asynchronously through `OAuthController`.
- Next Risk: Future Strava event types or signature/auth handling changes could bypass this same no-op safety pattern, and executor/refactor work could accidentally turn the fast webhook ack into a synchronous sync path that times out under load.
- Rollback Target: working tree before 2026-04-16 Strava webhook coverage round

### Weather Context API
- Goal: Keep `/api/v1/weather/context` trustworthy at the controller boundary so auth failures and acclimatization validation errors return stable contract-safe payloads instead of raw strings or uncaught exceptions.
- Changed: `WeatherContextController` now routes every non-success branch through one JSON error-map helper. Missing auth returns `401` with a stable `error` payload, acclimatization `IllegalArgumentException` failures now return `400`, and unexpected exceptions now return a bounded `500` payload. Focused `WeatherContextControllerTests` lock the four boundary cases: unauthorized access, authenticated success passthrough, validation failure, and unexpected failure.
- Preserve: Keep this controller test family narrow and mock-based for boundary behavior, preserve the existing success contract from `AcclimatizationService.WeatherContextResponse`, and keep controller-level error responses stable even if the underlying weather/acclimatization logic evolves.
- Next Risk: Future weather-context fields could still drift at the Spring MVC serialization layer because this coverage is unit-level rather than `MockMvc`, and new exception types could bypass the current `IllegalArgumentException` / generic-exception mapping if the controller grows more branches.
- Rollback Target: working tree before 2026-04-16 weather-context controller coverage round

### Assigned Coach Persona
- Goal: Make Hermes coach surfaces feel more personal by giving each runner a stable named coach persona across coach cards instead of anonymous icons, logic-engine labels, or reused runner initials.
- Changed: Runner-facing coach cards now read from one shared frontend coach-identity layer that assigns a fake-person coach from a small roster using the runner's profile/email key, persists that mapping in local storage, and reuses the same avatar/name/role badge across major coach panels like `/today-run`, `/schedule`, `/analysis`, `/analysis/coach-insight`, `/analysis/intensity`, `/analysis/injury-risk`, `/prediction/marathon`, and `/races/details/:raceId`.
- Preserve: Keep coach assignment stable per runner key, keep the roster fake but human and coach-like, keep this as a display/persona layer rather than a backend truth source, and avoid falling back to random-per-render coach picks or reusing the runner's own initials in coach avatar slots.
- Next Risk: Future auth/profile changes could accidentally change the runner key and reshuffle assigned coaches, new coach cards could bypass the shared `CoachIdentityBadge`, or someone could overwrite a surface with route-local static coach names and break the one-runner-one-coach illusion.
- Rollback Target: working tree before 2026-04-14 assigned-coach persona round

### Settings
- Goal: Keep `/settings` as a premium runner-control surface where account identity, preferences, integrations, and digest controls feel like one editorial command center inside the shared signed-in shell instead of a stack of disconnected utility cards.
- Latest: The 2026-05-03 quick-controls pass renders Settings shortcuts as full-width command rows with icon, text, and a trailing arrow affordance instead of cramped two-column tiles; keep this one-column command-row contract so Chinese labels do not fragment into one-character wraps.
- Latest Wellness: The wellness hub is now an editable per-metric source matrix. Sleep, HRV, stress, and body can each persist auto, Garmin, Oura, Apple Health, Google Health, or manual through `/api/wellness/source-preferences`; Readiness and automated coach gates use those choices, including manual coach-state fallback, instead of collapsing to one provider.
- Changed: The live settings route still uses one dedicated `SettingsAtlasLayout`, and the body keeps the command-center hierarchy with a restrained title band, a denser profile-led hero with three stat cards, and the lower three-column structure for `Preferences`, `Connectivity`, and `Account Actions`. That lower grid still exposes the quick-controls, sync-health, and readiness-checklist feature layer, and the real display-name save form, local mantra, theme/language/unit controls, Strava link management, Garmin/manual import modal entry points, digest toggle, and logout behavior all remain live. The Garmin area inside `Connectivity` is now a stronger editorial import lane instead of a flat sibling service row: the main Garmin surface carries live state, import scope, and trust framing, manual file import is demoted into a quieter fallback tile, and the Garmin modal now uses a two-part dual-mode composition with tonal layering and clearer active-state emphasis instead of bordered utility-form containment.
- Preserve: Keep the current command-center layout as the only live settings body, preserve the shared signed-in shell around it, keep the compacted header/hero proportions instead of letting the title and identity card grow oversized again, preserve the quick-controls / sync-health / setup-checklist trio as the current settings feature layer, keep the real handler wiring behind profile save / theme / language / units / Strava / Garmin / manual import / digest / logout, preserve manual import as a visible Garmin fallback path, and do not replace these interactive blocks with static showcase cards while iterating on visuals.
- Next Risk: Future settings cleanup could accidentally flatten the page back into generic equal cards, restore the oversized title/avatar/stat scale and waste first-screen space again, remove the quick controls and force runners back into scattered toggles, hide the manual-import escape hatch while “simplifying” Garmin, reintroduce bordered utility styling into the Garmin lane or modal, or break the real submit/modal/auth handlers while restyling the connectivity and account-action rails.
- Wellness Risk: Keep `/api/wellness/source-preferences`, Settings selectors, `ReadinessService.resolveReadinessSnapshot`, and `AutomatedCoachService.resolveReadiness` aligned; routing coach gates back through `readinessService.compute(state)` bypasses the per-metric wearable choices.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-16-42`

### Analysis
- Goal: Keep analysis split into a quick-glance overview on `/analysis` and deeper authored drill-down routes, so the landing page stays scannable while `/analysis/injury-risk`, `/analysis/intensity`, `/analysis/coach-insight`, and now `/analysis/load-balance` can each carry their own stronger story.
- Changed: `/analysis` remains the compact overview while the authored drill-down routes keep their own stories: `/analysis/injury-risk` still owns the cinematic risk read, `/analysis/intensity` still preserves the true three-way distribution from `buildPolarized(...)`, `/analysis/load-balance` still keeps its own editorial dashboard branch instead of falling through the generic detail template, and `/analysis/coach-insight` now keeps its hero metric trio legible in light mode. The latest passes extend explicit light/high-contrast-light coverage to the injury-risk route, move the injury trend tooltip with the live scrubber circle, align the injury-risk intensity card with the analysis-home three-way `easy / moderate / hard` contract, and strengthen the coach-insight hero's right-side metric stack so all three tiles render as visible vellum cards instead of two nearly disappearing into the light hero stage.
- Preserve: Keep `/analysis` as the quick-glance entrypoint, keep the authored drill-down routes page-specific inside the shared runner shell, preserve the live ACWR/training-load/intensity/injury math behind those routes, keep recent-run drill-downs live, avoid folding `/analysis/load-balance` back into the generic detail template, and keep route-level light-mode fixes localized through the `analysis-cinematic-*` and `analysis-coach-command-*` families instead of re-hardcoding card colors inline.
- Next Risk: Future analysis cleanup could accidentally collapse a dedicated drill-down branch back into the shared generic renderer, flatten the acute-vs-chronic or injury trend stages into decorative visuals disconnected from live data, re-pin the injury tooltip back to a static card unrelated to the scrubber point, regress one analysis route back to the older misleading easy/hard intensity split while `/analysis` and `/analysis/intensity` stay three-way, or reintroduce dark-mode translucency on light coach-insight hero tiles and make the metric grid look missing again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-23`

### Shared Footer Links
- Goal: Keep footer navigation consistent so every major Hermes page exposes the same low-friction legal/help/settings exits without drifting into route-specific wording or broken placeholder links.
- Changed: Public landing/auth/legal pages plus signed-in runner surfaces now share one reusable footer link row that renders the same `terms / privacy / support / settings` destinations, replacing older mixes of `contact`, placeholder `#support/#contact` anchors, and route-specific `logout` footer actions.
- Preserve: Keep footer links as a compact shared row across page families, preserve the legal/support/settings destinations, and do not reintroduce one-off footer actions or placeholder anchors on individual pages.
- Next Risk: Future page redesigns could bypass the shared footer component and silently reintroduce local footer copy, placeholder links, or page-specific action buttons that break cross-app consistency again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-59`

### Shoes
- Goal: Keep `/shoes`, `/shoes/add`, and `/shoe-catalog` inside one premium runner-inventory family so adding a pair feels like a coached setup flow and the main shoes dashboard surfaces rotation insight in a more editorial, coach-like way.
- Changed: `/shoes` still anchors the runner inventory family, and add-shoes still lives under `/shoes/add` with a breadcrumb-style shoes header path instead of feeling like a detached standalone route. The add flow still preserves the live brand/model/configure sequence, auth redirect, preselected brand/model handling, dynamic `/api/shoe-catalog` merge, failed-save guard, and `/api/shoes` POST behavior, and the right-hand snapshot/rotation/note rail stays removed so the guided setup stages can use the full main column. The page now also has its own light/high-contrast-light palette pass across the `add-shoes-*` family, so the hero, status cards, browser panel, form steps, chips, inputs, and loading state no longer stay in the old dark-only treatment when the shell theme is light, and the in-page `识图导入` flow now uses a dedicated cinematic scan modal with a HUD preview stage, quota/status note cards, and card-based editable recognition results instead of the old generic modal form.
- Changed: `/shoes` still anchors the runner inventory family, and add-shoes still lives under `/shoes/add` with a breadcrumb-style shoes header path instead of feeling like a detached standalone route. The add flow still preserves the live brand/model/configure sequence, auth redirect, preselected brand/model handling, dynamic `/api/shoe-catalog` merge, failed-save guard, and `/api/shoes` POST behavior, and the right-hand snapshot/rotation/note rail stays removed so the guided setup stages can use the full main column. The page now also has its own light/high-contrast-light palette pass across the `add-shoes-*` family, so the hero, status cards, browser panel, form steps, chips, inputs, and loading state no longer stay in the old dark-only treatment when the shell theme is light, and the in-page `识图导入` flow now uses a dedicated cinematic scan modal with a HUD preview stage, quota/status note cards, and card-based editable recognition results instead of the old generic modal form. That scan-import modal now also owns a proper light-mode branch, so the import studio keeps the same hierarchy in Aerodynamic Gallery mode instead of dropping a dark-only modal into a light shell.
- Preserve: Keep `/shoes`, `/shoes/add`, and `/shoe-catalog` visually related inside the same dashboard family, preserve the premium three-step add-shoes hierarchy instead of collapsing back into a generic card form, keep add-shoes reading like a child step within shoes rather than a separate product shell, keep the redesigned shoe-correlation card feeling like a featured insight instead of a dense utility grid, keep the collapse control at the whole-module level instead of hiding only one subsection, keep the real Hermes catalog/import/create behavior intact, preserve the live recommendation/fallback state wiring plus optional Reddit attribution in the shoes insight module, keep future theme work extending the route-local `add-shoes-*` selectors rather than relying on shell-only light-mode styling, and keep the scan modal as a page-owned cinematic import experience rather than falling back to the legacy generic modal body.
- Next Risk: Future shoe cleanup could desync the `/shoes/add` route from the shoes shell again, restore the removed side rail and crowd the add flow back into a split layout, reintroduce a one-off branded header that drifts away from the rest of the runner pages, regress the dynamic catalog merge / failed-save guard while touching copy or API helpers, simplify the performance-correlation card back into generic metric boxes that bury the featured shoe insight, forget to keep backend SPA forwarding aligned with the nested shoes route, add new add-shoes subpanels without extending the new light-theme block, or patch the scan flow back through legacy `.modal-help` / `.scan-result-card` styles and break the new import hierarchy.
- Next Risk: Future shoe cleanup could desync the `/shoes/add` route from the shoes shell again, restore the removed side rail and crowd the add flow back into a split layout, reintroduce a one-off branded header that drifts away from the rest of the runner pages, regress the dynamic catalog merge / failed-save guard while touching copy or API helpers, simplify the performance-correlation card back into generic metric boxes that bury the featured shoe insight, forget to keep backend SPA forwarding aligned with the nested shoes route, add new add-shoes subpanels without extending the new light-theme block, or patch the scan flow back through legacy `.modal-help` / `.scan-result-card` styles and break the new import hierarchy or its light-mode treatment.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-02`

### Analysis Coach Insight
- Goal: Make `/analysis/coach-insight` behave like a real training-planning system so runners can see what to do next from recent performance instead of reading one more static insight card.
- Changed: The detail route still reads as a daily-coach dashboard with the same hero -> insights -> recent evidence -> blueprint hierarchy, and it still uses the wider coach-insight-only desktop canvas and looser hero/main/performance ratios. The main two-column grid, performance split, three-up stat/focus/phase rows, and session/reason stacks now have a little more breathing room too, so the widened layout no longer feels stretched tight from card to card. The page still owns its Aerodynamic Gallery light-mode override layer, and that layer now uses stronger secondary-text contrast too, so the hero copy, chart stage, session rows, blueprint cards, chips, pills, metadata, and tooltips stay readable on the vellum surfaces instead of fading into low-contrast gray.
- Preserve: Keep the route inside the shared signed-in analysis shell, preserve the hero -> insights -> recent evidence -> blueprint hierarchy, keep row and CTA drill-down actions live (`/analysis`, `/today-run`, `/run/:id`), keep the planning model driven from shared analysis snapshot + `buildCoachSystemSections(...)`, keep the width expansion page-scoped instead of widening the global runner shell for other routes, and keep future theme work extending the page-local `analysis-coach-command-*` system instead of relying on shell-only light-theme selectors.
- Next Risk: Future cleanup could accidentally remove the page-scoped width override and reintroduce wide-screen gutters, collapse the refreshed gaps back into an over-compressed desktop layout, or soften new secondary copy/meta roles back to low-contrast gray while touching shared analysis shell CSS or adding new coach-only cards.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-85`

### Analysis Intensity
- Goal: Make `/analysis/intensity` read like a clear intensity-distribution command center so runners can judge whether the block is truly aerobic, drifting into gray-zone work, or due for a rebalance.
- Changed: The route now has its own authored intensity branch inside `AnalysisInsightDetail.jsx` instead of sharing the generic insight template. It uses a large editorial hero, a dominant three-bucket distribution card, a coach-judgment sidebar, a smaller recovery prompt, and a supporting-samples grid, all still driven by the live polarized snapshot and recent run rows. The same branch now also has dedicated `theme-light` plus `theme-high-contrast-light` overrides so the page no longer stays on dark-only cards when Hermes switches into a light shell.
- Preserve: Keep the shared signed-in analysis shell, preserve the three-bucket intensity truth from `buildPolarized(...)` (`easy / moderate / hard`), keep the coach/recovery layer secondary to the distribution stage, keep `/analysis`, `/today-run`, `/runs`, and `/run/:id` drill-downs live, keep new surface copy routed through shared `analysis` translation keys, and keep this page theme-aware across both dark and light modes.
- Next Risk: Future detail cleanup could accidentally fold this route back into the generic insight template, collapse the visible split back into a misleading easy/hard binary read, let the supporting sample cards visually overpower the main distribution story, or restyle one intensity subpanel with hard-coded dark values and silently break light mode again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-88`

### Prediction Marathon
- Goal: Make `/prediction/marathon` feel like a forecast-first race-planning surface where the runner can read the current marathon projection, coach interpretation, and supporting evidence in one pass without wasting desktop canvas on oversized side gutters.
- Changed: The marathon variant of `PredictionDetail.jsx` still owns the same cinematic forecast branch, restrained type scale, unit-safe evidence labels, and light-mode layer, but the route now also widens its local shell canvas beyond the default runner-shell width so the hero, command grid, and evidence grid use more of the available desktop space instead of sitting compressed inside extra blank margins.
- Preserve: Keep the route URL and `RACE_DISTANCES` lookup stable, preserve the live `collectAllVdotEntries(...) -> computeRollingRepresentativeSeries(...) -> predictRaceTimeCalibrated(...)` pipeline, keep chart interactions and table row drill-downs live, keep the marathon page reading as one dominant forecast story rather than a flat grid of equal cards, keep distance/badge labels routed through shared formatting/i18n instead of page-local literals, and keep future width/theme work anchored in the page-local `prediction-marathon-*` family plus the route-local shell override instead of widening the global runner shell.
- Next Risk: Future prediction cleanup could accidentally restore the default narrower shell width, flatten the hero/chart/coach hierarchy into a standard card stack without preserving the underlying trend and normalized-run evidence, or restyle the evidence cards without updating their internal light-mode text roles and bring back low-contrast labels or table cells.
- Rollback Target: `DESIGN_VERSIONS.md` prediction-marathon route entries on 2026-04-14

### Prediction Marathon confidence explanation
- Goal: Keep the `/prediction/marathon` confidence percentage explainable so runners understand what the score measures before trusting a race forecast.
- Changed: The confidence panel now exposes a native details disclosure plus hover title explaining what the percentage means, with localized factor rows for VDOT signal, 90-day run volume, rolling VDOT stability, and nearest similar-distance evidence. Missing effort-level locale keys were also added so the effort ladder renders runner-facing labels instead of raw dynamic keys, and the shared `runner-dashboard-sidebar-toggle` invariant is restored on this route.
- Preserve: Keep the existing prediction formula, VDOT/race-time pipeline, chart behavior, runner-shell framing, and evidence tiles intact.
- Next Risk: If future confidence math changes, update the disclosure factors in the same commit so the explanation stays honest to the actual formula.
- Rollback Target: `DV-2026-05-11-05`

### Frontend Runtime Sync
- Goal: Keep local Hermes pages recoverable during frontend work so one failed Vite build cannot blank every signed-in route by deleting the currently served hashed assets.
- Changed: `frontend/scripts/run-vite-build.mjs` now backs up `backend/src/main/resources/static/assets` before cleaning and restores that bundle if the Vite build fails, while `I18nContext.jsx` was reset to a minimal parse-safe provider so frontend builds stop failing on corrupted fallback/comment debris.
- Preserve: Keep the build flow serving Spring-owned static files, but never leave `backend/src/main/resources/static/assets` empty after a failed build attempt.
- Next Risk: The large `frontend/src/i18n/translations.js` file still has pre-existing duplicate-key lint errors, so future copy work can still be noisy even though the bundle now builds and the live asset wipe is guarded.
- Rollback Target: working tree before 2026-04-12 VO2 blank-page runtime-sync recovery round

### Billing Checkout
- Goal: Keep Hermes billing trustworthy by making the public checkout config and pre-Stripe checkout guards regression-proof before any payment-provider call happens.
- Changed: Added a dedicated `BillingControllerTests` unit-test file that covers the public `/api/billing/config` payload plus the checkout endpoint's unauthenticated, admin, checkout-disabled, unexpected-field, and invalid-month branches without relying on live Stripe calls.
- Preserve: Keep checkout guard coverage focused on the pre-Stripe auth/config/request-validation paths and preserve the trimmed public `priceLabel` config contract for the SPA.
- Next Risk: Future webhook or successful-session work could still change paid-upgrade behavior without focused tests around duplicate-event handling or runner-month parsing.
- Rollback Target: working tree before 2026-04-12 billing-controller test-coverage round

### Admin Subscription Controls
- Goal: Keep Hermes admin and billing subscription actions trustworthy so operator bulk controls and paid checkout both persist the runner tier they claim to change.
- Changed: Added dedicated `AdminControllerTests` for the legacy `/api/admin/stats` and `/api/admin/sync-all` surface, and restored `AiUsageService.grantPro()` to set `subscriptionTier=PRO` plus extend `proExpiresAt` from the later of now or the existing expiry while `revokePro()` still clears the subscription.
- Preserve: Keep the new focused admin-controller coverage, preserve the exact plain `{"error":"Admin privileges required."}` contract on `AdminController`, and keep Pro bookkeeping separate from the newer free-tier AI quota model instead of turning grant/revoke into another no-op.
- Next Risk: Future quota-model cleanup could again collapse subscription bookkeeping into AI-usage behavior and silently break admin bulk actions or Stripe completion even though the UI and tests still expect a real Pro state transition.
- Rollback Target: working tree before 2026-04-12 admin-controller coverage round

### VO2 Max Detail
- Goal: Make `/analysis/vo2max` feel like a premium deep-analysis surface where the runner can read current VO2 level, direction, and likely driver in one screenshot without losing trust in the underlying run-derived math.
- Changed: The route still keeps the shared signed-in runner shell, ambient kinetic dashboard, threshold guide, and restrained footer insight strip, and the chart still reads as a single representative signal: the visible graph keeps the smoothed 90-day trend line plus scrubber cursor/tooltip while the extra per-run scatter dots, trend node dots, and latest-point glow are no longer rendered into the main plot. The page now also has a dedicated Aerodynamic Gallery light-mode translation, so its hero shell, chart stage, axis labels, threshold marker, tooltip, scrubber contrast, footer, and CTA shift into layered vellum surfaces instead of staying on the old charcoal-only cinematic treatment.
- Preserve: Keep the shared runner shell, keep the chart as the hero instead of burying it under generic cards, preserve the smoothed 90-day trend model and cursor-driven hover readout, keep the threshold/peak labels grounded in stable VO2 meaning rather than decorative chart math, keep the footer insights subordinate to the chart rather than turning the page into a multi-card analytics dashboard, and preserve the route-level cinematic structure in both dark and light mode instead of flattening it into the generic analysis card system.
- Next Risk: Future cleanup could reintroduce decorative point clutter that competes with the line read, flatten the page back into a generic utility chart, regress the accessible chart summary while restyling the SVG shell, or fork the visual shell away from the live VO2 data model while touching copy, chart presentation, or theme-specific selectors.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-84`

### Landing
- Goal: Keep `/` clearly public so first-time runners see Hermes as a focused editorial landing page rather than a half-signed-in dashboard shell.
- Changed: The landing header keeps the signed-in dashboard links and utility icons removed, and now uses a minimal public auth rail with just the brand plus explicit `Login` and `Sign Up` actions on the right.
- Preserve: Keep the landing page free of signed-in runner-shell navigation chrome, and preserve the header as a public brand-plus-auth bar rather than a private route menu.
- Next Risk: Future landing refreshes could reintroduce dashboard-like nav pills or utility icons by copying the signed-in shell instead of the public auth/landing family, or could remove the explicit auth entry buttons and make the first action less obvious again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-34`

### Heatmap
- Goal: Make route heat density a first-class runner page again so athletes can see where they actually train without waiting through avoidable shell or map delays.
- Changed: The dedicated signed-in /heatmap route still keeps the non-blocking profile-first load model, the floating full-screen cockpit, the restored Hermes brand pill, and the reversible Map focus metric fold. The backend heatmap feed still budgets up to 24000 points and protects the newest five run activities before older-run sampling. The map tracks view bounds and surfaces a "Recent Sessions in Area" list showing the 10 most recent runs within the current viewport. The stats contract still separates uncapped all-run `pointCount` from capped `sampledPointCount`, and the GPS-dot speed palette plus right-hand legend are bound to one shared four-band speed source. Latest overlay-only pass keeps the real-world Leaflet map untouched while refining the nearby grid: Map Focus uses a clearer six-column stat grid, Density spans the row, the speed legend is a compact four-band instrument, the utility rail reads as a contained dock with compact controls plus desktop internal scrolling, and recent-session rows share the warm Profile card language.
- Preserve: Keep /heatmap as its own runner destination, preserve the fast sampled backend payload plus preload/non-blocking frontend load path, preserve the map-first composition with floating overlays instead of returning to a padded dashboard card, keep the restored Hermes brand pill in the top-left cockpit position, preserve the dark real-world Leaflet basemap, preserve the warm heat-fog plus GPS-dot coverage treatment as the primary read instead of reconnecting points into fragile path lines, preserve the reversible Map focus fold state, keep the contained utility rail from spilling past the viewport, keep the newest five run activities guaranteed before older-run sampling, keep older-run sampling anchor-aware, keep the heatmap stat cards tied to the full run-history GPS total rather than the sampled render budget, and keep the visible speed legend structurally tied to the same thresholds that color the map dots.
- Next Risk: Future shell cleanup could reintroduce the shared-shell section label and drop the branded pill again, reintroduce heavy dashboard framing around the map, touch the Leaflet basemap/heat layer while only intending to adjust overlays, let the 13-button utility rail grow past the desktop viewport again, swap the dark basemap back to a brighter utility layer, desync the visible speed legend from the actual dot thresholds, reconnect sparse GPS samples into lines and bring back spaghetti traces, revert older-run sampling back to a blind global modulo query, collapse `pointCount` and `sampledPointCount` back into one field, or remove the frontend payload normalization and expose the same compression bug again when live ratios bunch up near the low end.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-05-06-39`
### Shared Runner Topbar
- Goal: Keep the signed-in Hermes runner shell header focused so the right edge surfaces only the essential utility controls without duplicating page actions that already exist in the sidebar or body.
- Changed: The shared signed-in topbar on `/profile`, `/runs`, `/races`, `/schedule`, `/shoes`, `/today-run`, `/analysis`, `/prediction/:distKey`, `/rewards`, and `/analysis/vo2max` no longer renders the extra top-right pill buttons, the left side now uses a single active red section label instead of multi-button mini-nav strips, and the bell icon now opens a compact glass notification popover with Hermes message cards instead of acting like a silent redirect-only shortcut. The tray now also keeps a stable contained panel treatment when open, highlights the bell as the active utility button, clears the unread dot after the runner opens the notifications once, and has its own Aerodynamic Gallery light-theme contrast layer so both Chinese and English notification copy remain readable instead of inheriting the dark-shell pale text palette on vellum surfaces.
- Preserve: Keep the signed-in runner topbar minimal on both sides, with the sidebar as the primary navigation surface, one active red section label on the left, the top-right area limited to the utility icon cluster plus avatar, and the notification control as a small in-place message tray rather than a generic modal or another full-width dashboard card. Keep the unread dot as a true unseen-state indicator instead of a permanent decoration, and keep the light popover readability solved through shared shell selectors rather than page-local overrides.
- Next Risk: Future page-specific shell edits could quietly re-add local multi-button left nav strips or top-right pills on one route even though the shared shell direction is now one active left label plus the utility cluster, could fork the bell back into route-specific click behavior and break the shared popover experience, could accidentally reset the seen-state so the unread dot reappears every refresh, or could restyle the light popover background without carrying the matching text/card contrast rules and make the tray unreadable again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-58`

### Analysis
- Goal: Keep `/analysis` useful on day one and responsive on larger accounts without losing the premium shell or live metrics.
- Changed: Analysis still gives first-use runners a real empty state with direct next actions, and the main page now pulls a lighter `/api/activities/analysis` summary feed instead of the full activity list while large run-list updates are applied with lower priority so the shell appears sooner.
- Preserve: Preserve the existing analysis shell, drill-down cards, and real metrics once run data exists, while keeping the lighter analysis-specific activity feed instead of drifting back to full `/api/activities` fetches.
- Next Risk: Future detail-card or insight work could quietly point `/analysis` back at the heavier all-activity endpoint or add new full-history client scans that bring back the long main-thread stall.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-36`

### Runs
- Goal: Keep `/runs` on the shared signed-in runner dashboard shell so the activity log feels like part of the same premium coach product as `/profile` while preserving live run-history behavior.
- Changed: The populated run-history surface and the true-empty import state now both sit inside the same collapsible runner dashboard shell language as `/profile`, with the shared sidebar, topbar, and footer framing preserved around the existing filters, insight strip, pagination, drill-down, Strava reconnect, and manual import flows. The route-preview fetch loop was also hardened so `/runs` no longer self-restarts overlapping `/api/activities/:id/points` worker waves after each preview state update; the page now claims the pending preview batch up front and backs off cleanly on `429` instead of hammering the points endpoint into rate limiting. The same route now also carries the Aerodynamic Gallery light-mode treatment end-to-end, so the populated hero, chips, status/load-more controls, and the zero-data integration-alert onboarding cards no longer stay on dark route-local surfaces when the shell is light.
- Preserve: Keep the shared dashboard shell framing on `/runs`, preserve the existing populated-vs-empty state split plus all live run-history behaviors, keep route-preview fetching bounded by the visible run batch instead of tying the preview loader directly to every incremental preview state write, and keep both populated and empty-state branches aligned with the same light-mode design language instead of mixing a light shell with dark local cards.
- Next Risk: Future cleanup could update the shared shell on `/profile` without carrying the same nav/footer contract into `/runs`, flatten the empty-state branch back into disconnected chrome while touching import-state UI, reintroduce a request storm by letting per-run preview fetches restart on every `routePreviewPoints` update, or regress the new light-mode route surfaces while editing only one of the two `/runs` branches.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-94`

### Races
- Goal: Keep `/races` on the shared signed-in runner dashboard shell so race planning feels like one coherent dashboard lane rather than a separate product chrome.
- Changed: The race center content still sits inside the shared runner dashboard shell, the discovery cards prefer official marathon imagery scraped from the race organizers' websites for seeded major races like Tokyo, Osaka, Boston, Chicago, NYC, London, and Berlin, and the `閻庣懓鎲￠悡锟犲焵椤掆偓椤﹀磭绮嬬仦鍓ь洸濠?calendar now only renders real saved races instead of falling back to discovery catalog examples.
- Preserve: Keep the shared dashboard shell framing on `/races`, preserve the current race center hierarchy and CRUD/discovery behavior, keep major-marathon discovery imagery tied to organizer-owned official websites whenever catalog metadata exists, and never repopulate the selected-race calendar with unsaved catalog items.
- Next Risk: Future catalog cleanup could remove or stale the `officialWebsite` metadata, or calendar/discovery refactors could quietly reintroduce catalog fallbacks into the selected-race section and undermine trust again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-07`

### Schedule
- Goal: Keep /schedule route guidance runner-facing while ensuring PostgreSQL can create and query planned_route.
- Changed: Changed PlannedRoute.waypoints from CLOB to TEXT, added a schema smoke guard, hardened Schedule route-card fallback copy against internal route zones/counts/no-recommendation insight chips, added missing bilingual route insight copy, and marked the queue task complete.
- Preserve: Preserve saved-planner > recent-run > coach-history recommendation precedence, Leaflet/OSM route preview, shared runner shell, auto-plan behavior, /api/route/plan and /api/route/plan/recent contracts, and bilingual schedule copy parity.
- Next Risk: Future route-card work could bypass the route zone whitelist, reintroduce fallback insight chips without a safe recommendation, or add PostgreSQL-incompatible entity DDL outside the schema smoke guard.
- Rollback Target: working tree before 2026-05-08 schedule planned-route raw-token/PostgreSQL round

### Legal Pages
- Goal: Give Hermes a real legal baseline so public auth flows and signed-in shells can link to actual Terms and Privacy pages instead of dead placeholder anchors.
- Changed: Added public `/terms` and `/privacy` routes backed by a shared bilingual `LegalPage.jsx` surface, then rewired existing Terms/Privacy entry points across landing, login, signup, profile, analysis, prediction detail, rewards, runs, schedule, and settings to point at those live pages.
- Preserve: Keep Terms and Privacy as public routes reachable from both signed-out and signed-in surfaces, and preserve the current direct footer-link wiring instead of reverting to `#` placeholders.
- Next Risk: Future footer cleanup could update one shell and forget the others, or a router refactor could accidentally gate the legal pages behind auth even though public auth surfaces still need them.
- Rollback Target: working tree before 2026-04-11 legal-pages round

### Rewards
- Goal: Make `/rewards` feel like a premium signed-in milestone surface where runners can see progress, earned proof, and the next achievable badge in one pass without losing the live badge logic.
- Changed: `/rewards` still keeps its milestone hero, sidecards, and earned/upcoming badge grids, but it now sits inside the same collapsible runner dashboard shell contract as `/profile`, `/runs`, `/today-run`, `/shoes`, `/races`, and `/schedule`, with the shared brand block, collapse toggle, topbar rhythm, workout CTA footer, and legal/support/logout footer pattern. The topbar profile-actions wrapper now also carries the required `analysis-stitch-topbar-profile-actions` shell marker again, matching the approved premium runner-shell treatment used on the sibling runner surfaces.
- Preserve: Keep the live earned/upcoming badge ordering and progress behavior intact, preserve the shared signed-in shell contract instead of letting the route drift back into the older analysis-only sidebar/topbar/footer branch, and keep the `/rewards` topbar profile-actions wrapper tagged with `analysis-stitch-topbar-profile-actions` whenever the shared shell header is refactored.
- Next Risk: Future reward cleanup could accidentally flatten the next-badge focus rail into a generic list, break the populated-vs-empty states, reintroduce the older one-off analysis shell while touching shared reward styling, or refactor the shared `/rewards` header without preserving the required `analysis-stitch-topbar-profile-actions` marker.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-11-34`

### Prediction Detail
- Goal: Make `/prediction/:distKey` feel like a premium extension of deep analysis so runners can trust the forecast, understand the trend, and drill into matching runs without the older generic-card shell.
- Changed: `/prediction/:distKey` now keeps its premium prediction hero band, trend-signal sidecards, charts, and normalized-runs table inside the same shared collapsible runner-shell framing used by the recently aligned analysis and dashboard routes, with the simplified sidebar CTA footer and shared topbar structure preserved around the live forecast content. The shared branch now also extends the marathon no-record treatment to `/prediction/5k`, `/prediction/10k`, and `/prediction/half`, so the actual-results and comparable-record sections show the explicit `目前还没相关的跑步记录` state instead of generic helper copy when there are no nearby runs, and the shared `prediction-detail-*` surfaces now have their own light-mode contrast layer so those states remain readable on vellum cards. The marathon-only branch is also leaner now, with the 5K / 10K / half-marathon projection tile grid removed so the page stays focused on the marathon forecast itself.
- Preserve: Keep the live forecast math, chart behavior, and run drill-downs intact, preserve both the prediction-detail content hierarchy and the shared runner-shell framing instead of reverting to the old route-specific sidebar/footer extras or the older inline-style card layout, keep the explicit no-related-runs message consistent across all prediction distances rather than only marathon, and keep `/prediction/marathon` free of the removed cross-distance tile strip unless the user explicitly asks for it back.
- Next Risk: Future chart or copy cleanup could accidentally desync the premium hero metrics from the underlying forecast data, reintroduce route-specific shell chrome while touching the forecast panels and shared analysis-shell CSS, let one distance route drift back to the older generic empty-state wording or low-contrast light-mode text while the others stay aligned, or quietly restore the removed marathon cross-distance tiles while reusing old projection helpers.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-14`

### Prediction Detail Weather Correction
- Goal: Make `/prediction/:distKey` expose weather correction as a first-class readable signal rather than hiding it inside the mixed forecast chart.
- Changed: The prediction cockpit now includes a dedicated weather-correction impact graph driven by the existing rolling adjusted-VDOT series. The section visualizes time recovered by weather adjustment across corrected windows and surfaces compact average/peak-save pills while preserving the existing prediction-history chart and forecast math.
- Preserve: Keep the weather-correction graph as its own section, not just a dashed secondary line in the main prediction chart. Keep the current `/prediction/:distKey` route, calibrated prediction model, and runner-shell framing intact.
- Next Risk: Future chart cleanup could merge this graph back into the main prediction history and make the weather signal unreadable again, or let the summary pills drift away from the rolling-series math.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-05-02-02`

### Today Run
- Goal: Make `/today-run` read like a high-confidence daily race-prep command surface so the runner can understand today's workout, readiness, and coaching intent in one fast pass.
- Changed: `/today-run` now uses the stronger editorial `today-run-plan` composition instead of the more fragmented Stitch card stack. The confidence model in `buildConfidenceModel` (TodayRun.jsx) now also incorporates VDOT trend direction from `computeVdotTrend()`: a declining trend lowers confidence by 3 pts, an improving trend raises it by 2 pts, and maintaining leaves it unchanged — applied before the existing [42, 96] clamp so the score range is preserved. The live route still reads from the same recommendation, coach-today, weather, races, and shoe-rotation inputs.
- Preserve: Keep the shared signed-in shell, keep all workout/coach/weather/race/shoe logic live, keep the blueprint steps derived from the real plan instead of static mock content, preserve the current left blueprint + right coach-command hierarchy, keep the [42, 96] confidence clamp intact, and do not change the other confidence inputs (ACWR, recovery hours, hard runs, tone key).
- Next Risk: Future cleanup could accidentally reintroduce the older split-band Stitch layout, flatten the hero back into a generic summary card, remove the VDOT trend adjustment and leave confidence insensitive to fitness direction, or change the `runs` parameter passing to `buildConfidenceModel` without updating the dependency array.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-24`

### Shoes
- Goal: Keep `/shoes` on the shared signed-in runner dashboard shell while preserving its premium inventory command surface for scanning primaries, backups, mileage risk, and key shoe actions in one pass.
- Changed: `/shoes` keeps the tightened Running Shoes inventory composition inside the shared dashboard shell, `/add-shoes` now also uses the same collapsible runner-shell contract instead of a trimmed older variant, the legacy `/shoe-catalog` browser has been lifted out of the old authenticated top-nav chrome and into the newer shoes/dashboard language, the image-picker modal stays in the darker editorial import-studio treatment, and the recommendation strip still lives at the top of the inventory stage as a full-width rotation signal tied to the recent 21-day run window. That strip now explains today’s pair more concretely: Hermes still prefers matched-pace efficiency when it has a real signal, but when confidence is thin it falls back to the runner’s own pair and surfaces explicit evidence for the choice through last worn date, recent tagged usage share, and remaining lifecycle headroom instead of leaning on a vague external community recommendation.
- Preserve: Keep `/shoes`, `/add-shoes`, and `/shoe-catalog` inside the same runner dashboard family, preserve the live Hermes shoe creation/catalog plus image upload/search/apply behavior, keep the top recommendation strip tied to recent run history instead of drifting back to all-time shoe logic or a lower utility-panel placement, keep the redesigned strip on the newer layered/glass composition instead of flattening it back into a generic summary card, keep low-confidence states grounded in the runner’s owned shoe data instead of generic external picks, and keep missing lifecycle caps honest rather than inventing mileage-left numbers.
- Next Risk: Future shoe cleanup could split the three shoe routes back across mixed shell generations, wire only one add entry point to the dedicated page, flatten the redesigned image-picker studio or recommendation strip back into generic utility rows/cards, silently widen the recommendation logic away from the recent-block window while touching rotation or run-tag analysis, reintroduce vague external fallback copy when confidence is low, or accidentally default unset shoe lifespan caps into fabricated mileage-left guidance.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-38`

### Admin Auth
- Goal: Keep `/admin` intentionally distinct from the runner dashboard while still matching the current Hermes cinematic auth language instead of falling back to the old generic form card.
- Changed: The admin login route now follows the same dark auth-family composition as the public login/signup flows, with a cinematic split shell, stronger editorial branding, glass card treatment, and cleaner legal/back links rather than the legacy centered utility form.
- Preserve: Keep `/admin` separate from the profile shell because it is an operator entry point, but preserve its membership in the same modern Hermes auth family as `/login` and `/signup`.
- Next Risk: Future admin-auth fixes could accidentally restore the old `login-container` utility layout or fork the admin route into a third unrelated auth style while touching validation or redirect behavior.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-25`

### Signup
- Goal: 
- Changed: 
- Preserve: 
- Next Risk: 
- Rollback Target: working tree before this round

### Frontend Baseline
- Goal: Keep the live Hermes website aligned with the actual `origin/main` repo baseline when local redesign rounds drift into broken or unapproved territory.
- Changed: The full tracked frontend tree was restored to `origin/main`, extra untracked frontend-only additions were removed, and the live static bundle was rebuilt so the local site now mirrors the GitHub repo reference again.
- Preserve: Treat the current live frontend as the repo-baseline restore point, not the earlier redesign stack from this session.
- Next Risk: Future UI rounds could accidentally reuse the superseded redesign files or assumptions from the local session instead of comparing against the restored repo baseline first.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-11-14`

### Login
- Goal: Keep the public login surface inside Hermes automated quality coverage.
- Changed: Registered the Login route in the suggest-tasks screen intent registry so auto-hermes quality checks stop treating it as an untracked routed page.
- Preserve: Preserve the existing login route, auth flow, Strava linking behavior, and public auth-shell UI.
- Next Risk: Other routed public/auth pages that are still not represented in SCREEN_INTENTS could surface as future automation debt.
- Rollback Target: working tree before login screen intent registry round

### Frontend Pace Utility
- Goal: Keep shared pace formatting trustworthy so runner-facing summaries and derived pace displays use one safe utility contract instead of mixed raw-seconds and formatted-string expectations.
- Changed: `calculatePace` in `frontend/src/utils/paceUtils.js` now accepts kilometers plus minutes, returns a formatted `m:ss/km` string, and guards invalid inputs with `null`; the focused utility test file now covers core happy-path, invalid-input, and rounding cases.
- Preserve: Keep `calculatePace` as the formatted-string helper for UI-facing pace output and keep `formatPace` as the lower-level seconds-to-label formatter instead of drifting back to a mismatched raw-number contract.
- Next Risk: Older call sites or future tests could still assume the preexisting raw-seconds return shape if they were written against the earlier incomplete helper.
- Rollback Target: working tree before 2026-04-11 pace utility alignment round

### Admin Shoe Catalog
- Goal: Keep direct admin shoe-catalog editing traceable so destructive or unexpected catalog changes can be reviewed later with clear brand/model context.
- Changed: `ShoeCatalogController` now writes admin audit entries for brand creation, model creation/upsert, official-page import upsert, model edits, model deletes, and brand deletes, including the affected brand/model/type details in metadata.
- Preserve: Keep every admin catalog mutation auditable through `AdminAuditService` instead of leaving create/import/delete paths silent while only some admin flows appear in the audit trail.
- Next Risk: Future catalog endpoints could bypass the controller-local audit hooks if they are added without the same mutation logging pattern.
- Rollback Target: working tree before 2026-04-11 shoe-catalog audit logging round

### Admin Dashboard Shoes
- Goal: Keep `/dashboard` usable as the real operator surface for cross-runner shoe management, including creating a runner-owned shoe with an image and removing bad shoe rows without leaving the admin dashboard.
- Changed: The shoes tab now has a dedicated add-shoe modal that targets a runner by email and captures brand/model, nickname, mileage fields, primary flag, and an optional image through either a pasted URL or uploaded file preview. The backend admin portal now owns matching `POST /api/admin/shoes` and `DELETE /api/admin/shoes/{id}` endpoints, applies the same shoe identity fingerprinting as the runner flow, and writes audit entries for admin shoe creation/deletion while unlinking activities before a hard delete.
- Preserve: Keep the dashboard shoes tab as the single operator lane for live cross-runner shoe rows, preserve the existing image-review/search modal and per-card delete affordance, keep admin shoe mutations auditable through `AdminAuditService`, and keep the admin create contract aligned with the normal runner shoe fields instead of drifting into a second incompatible schema.
- Next Risk: Future dashboard polish could desync the add-shoe modal from the backend contract, introduce another image path that bypasses the safe `photoUrl` validation, or reintroduce a delete button that no longer points at a real admin delete endpoint.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-20`

### Admin Dashboard
- Goal: Keep `/dashboard` feeling like a trustworthy Hermes operator console where queues, high-level health, and tabbed admin actions read clearly before an operator dives into users, shoes, jobs, or audit details.
- Changed: The admin dashboard now uses a stronger route-local control-center layer on top of the existing tooling: a glass topbar, darker operator hero, tighter status strip, cleaner tab rail, upgraded overview KPI/queue cards, and a more intentional quick-action panel. The same pass also masks the broken quick-action emoji glyphs and replaces their visible treatment with stable dashboard icon slots instead of leaving mojibake text in the live admin UI.
- Preserve: Keep `/dashboard` separate from the runner shell, preserve the existing admin tab structure and all real user/shoe/job/audit actions, keep the shoes tab and its modals wired to the live admin endpoints, and treat the new route-local styling as an admin-only layer rather than a shared runner-page pattern.
- Next Risk: Future admin cleanup could reintroduce mixed-generation utility styling by touching only one block, remove the icon-slot masking while the legacy emoji text is still present in JSX, or over-style the route in a way that makes dense tables and filters harder to scan than the current control-center balance.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-25`

### Admin Dashboard Course-Map Publishing Desk
- Goal: Keep the admin `/dashboard` course-map workspace readable when an operator is iterating on one race, instead of forcing recommendation, evidence, and source-improvement actions into one cramped row.
- Changed: The course-map workbench now uses a quieter left queue rail, one dominant publish canvas, a stacked evidence column, and a grouped operations band beneath the publish decision. Pending-vs-live comparison panels still exist, but they now sit lower on the page as supporting review tools instead of crowding the main recommendation strip. Latest grid pass promotes the publish canvas to the full top row of the command bridge, moves the recommended next action into that canvas, keeps source/analysis alternatives in the ops lane, and gives `is-improve` a clearer processing-tone treatment.
- Preserve: Keep the current queue/search behavior, preview renderer, publish/replace/reanalyze/pipeline actions, and all real backend data wiring intact. Preserve the recommendation-driven operator flow while making the primary publish action visibly dominant inside the publish canvas itself.
- Next Risk: Future dashboard polish could collapse the evidence stack back into horizontal micro-cards, move the recommended action back into the secondary ops lane, let secondary actions become equal-weight with the primary publish CTA again, or widen the rail cards with too many badges until the workspace feels compressed again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-29-02`

### Admin Dashboard Course-Map Source Scan FIFO
- Goal: Keep `/pending/scan` as the admin source-discovery scan path, separate from pending-upload reanalysis, while preserving one-by-one course-map processing.
- Changed: `/api/admin/race-course-maps/{raceId}/pending/scan` now creates a `COURSE_MAP_PREVIEW_SCAN` background job and runs through the course-map FIFO worker. `RaceCourseMapService.scanPendingCourseMap` now stages the best local/remote discovered candidate when no pending upload exists, instead of delegating directly to pending reanalysis and throwing `race_course_map_pending_missing`. The dashboard now exposes this path through a dedicated source-scan button and recommendation action that calls `/pending/scan`; upload stays as a separate fallback action. The same progress card now renders beside the publish-canvas decision dock as well as the stage header, and it includes a live working notice plus dashboard status message so the admin sees both progress and an explicit work notification at the button they clicked.
- Preserve: Keep upload and manual reanalysis queued one-by-one with scan jobs in the same course-map scan timeline. Do not make source scan synchronous again, do not collapse it back into the pending-upload reanalysis path, and do not let the dashboard regress to a backend-only scan endpoint with no clickable UI path. Keep source-scan progress and working notice visible in the lower decision/ops area instead of only in the top header.
- Next Risk: Future queue or timeline edits could omit `COURSE_MAP_PREVIEW_SCAN` from the FIFO job-type set, causing scan jobs to run outside the visible one-by-one operator flow. Future dashboard copy/action cleanup could also make the primary button open upload again instead of source scanning when no pending preview exists, or move the progress/working notice back offscreen from the lower button area.
- Rollback Target: working tree before 2026-04-29 source-scan FIFO repair round

### Dashboard Course-Map Rail Live Leaflet Cards
- Goal: Make every small race card in `/dashboard/course-maps` read as a real world-map-backed course thumbnail instead of a static poster preview, while keeping the current status/confidence chrome on top.
- Changed: The left rail in `Dashboard.jsx` now always renders `AdminCourseMapPreview` in live-map mode for each race card and passes a race-level viewport fallback derived from stored `lat`/`lng` fields. `AdminCourseMapPreview.jsx` now supports `forceLiveMap` plus `fallbackCenter`, so compact cards can render real OpenStreetMap/Leaflet tiles even when there is no aligned route yet; in those cases the card centers on the best available city-level coordinates and drops a small marker instead of falling back to a static image. The main course-map stage stays on the existing preview path.
- Preserve: Keep the current left-rail card hierarchy, selection behavior, and the existing overlay chrome in `Dashboard.jsx`. Keep the large stage and publish desk semantics unchanged. Keep the fallback map non-interactive inside the rail cards so the card still behaves like a clean queue button rather than a nested map control.
- Next Risk: If future queue payloads stop carrying race-level `lat`/`lng`, the force-live rail cards will fall back to the old empty state because there is no geocoding step in this component. If the shared preview component is later tuned only for the main stage, compact card-specific map behavior could regress unless `dashboardCourseMapRailLeaflet.smoke.test.js` stays current.
- Rollback Target: working tree before 2026-04-20 left-rail live-leaflet round

### Run Detail
- Goal: Make each run review feel like a premium desktop activity debrief where the route, effort, splits, and support analytics come in cleanly even on a hard refresh or direct drill-down.
- Changed: `/run/:id` still follows the standalone Stitch desktop shell with the large route-map hero, stat rail, physiology panel, splits, efficiency, and linked-gear sections, and it now carries a full Aerodynamic Gallery light/high-contrast-light layer across the topbar glass, loading shell, hero stat rail, map overlay, vellum panels, tables, chips, gear module, warning state, and empty-state instead of leaving the drill-down mostly on charcoal cards. The direct-refresh bootstrapping path from session cache to authenticated activity lookup plus the dedicated loading surface still stay intact.
- Preserve: Keep the standalone Stitch shell ownership on `/run/:id`, preserve the live Hermes lap, cardiac-drift, route, elevation, and shoe-linking behavior, keep the direct-refresh bootstrapping path plus loading state instead of reverting to a sessionStorage-only render race, and keep both `theme-light` and `theme-high-contrast-light` fully translated so the stat rail and page-local cards do not fall back to dark-only styling.
- Next Risk: Future cleanup could accidentally remove the bootstrapping guard, reintroduce the empty-state flash before the run payload resolves, widen the fallback lookup into heavier unnecessary data fetches while touching run-detail hydration, or update only one light-theme selector and leave parts of the route in split-theme mode again.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-98`

### Chinese Runner Shell Copy
- Goal: Keep Chinese runner-facing screens fully language-specific so shell labels do not show mixed English and Chinese in the same decision blocks.
- Changed: The remaining Chinese shell labels on analysis, prediction detail, and rewards were localized so the signed-in premium shells no longer show English top titles, kickers, status bands, or confidence labels beside Chinese body copy.
- Preserve: Keep the Chinese shell copy fully localized on those premium runner-facing surfaces instead of reintroducing bilingual headings when editing shared translation keys.
- Next Risk: Future shell additions could add new English-only labels to the `zh-CN` blocks if shared premium-shell keys are copied from English without a localized pass.
- Rollback Target: working tree before 2026-04-11 Chinese shell-copy cleanup round

### Runs
- Goal: Make Activities feel premium in both states: a screenshot-led recent-runs history surface once data exists, and a motivating integration-alert onboarding surface when a new runner has not synced anything yet.
- Changed: `/runs` now uses the approved dark Stitch populated-history shell for non-empty accounts, with a compact top bar, editorial nav ribbon, cinematic hero, real filter/sort chips, richer live run cards, and a new live insight strip that summarizes count, active days, fastest pace, and longest run above the history list; true-empty accounts still switch into the separate Integration Alert branch with the live Strava reconnect and manual import flows preserved, and shared Chinese pace/distance unit output was corrected in the formatter used by the page.
- Preserve: Keep the integration-alert experience limited to `allRuns.length === 0`, keep the populated Stitch history shell limited to real activity history, preserve the new insight strip as a live data summary rather than static marketing copy, and preserve the real run filters, sorting, pagination, run-detail drill-down, Strava retry-sync, and manual import modal behavior.
- Next Risk: Future cleanup could accidentally blur the zero-data vs populated-state split, drop the live insight-strip derivations while restyling `/runs`, or regress the shared bilingual pace/distance labels that now depend on the corrected formatter.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-11-30`

### Analysis
- Goal: Make deep analysis feel like a premium desktop performance cockpit where VO2, workload balance, injury risk, and race predictions can be read in one screenshot-like view without losing the live Hermes math underneath.
- Changed: `/analysis` keeps the dark Stitch desktop shell and now treats the VO2 hero as an explicit drill-down card. Clicking it opens `/analysis/vo2max`, which now uses the same collapsible runner dashboard shell contract as the newer signed-in surfaces and renders the VO2 chart as real per-run points under a readable sampled 90-day representative trend. The sibling `/analysis/injury-risk` detail route now also uses the same premium drill-down language with a localized intro, stronger action/read sections, a dedicated cadence-drift-ACWR signal strip, and real browser-title wiring.
- Preserve: Keep the clickable VO2 hero on `/analysis`, preserve both `/analysis/vo2max` and `/analysis/injury-risk` inside the shared runner dashboard shell, keep the VO2 chart contract where scatter shows actual run-level estimates while the trend line stays smoothed over the visible 90-day window, and keep the injury-risk detail page tied to the existing Hermes snapshot math instead of drifting into static warning copy.
- Next Risk: Future analysis-shell cleanup could remove the click-through affordance on the hero card, drift either detail route back onto an older analysis-only shell branch, flatten the injury-risk drill-down back into a generic card stack, or regress the VO2 chart into over-dense trend sampling while touching detail-page presentation.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-40`

### Settings
- Goal: Make settings feel like a trustworthy premium control room where account identity, preferences, integrations, and session actions all live in one desktop-grade surface.
- Changed: `/settings` still uses the shared collapsible runner-shell framing and editorial control-room layout, and the page now has an explicit settings-specific translation layer for the hero, status cards, integrations rail, import CTA, and security section so missing Stitch placeholder titles no longer leak into the live surface. The route no longer renders the duplicate legacy `settings-control-grid` stack beneath the active control-room shell, so the old image-backed weekly-brief card is gone from the live page, the current `settings-command-*` hero/grid/territories layout now has its own owning CSS instead of depending on unrelated older styles, and the whole active settings surface now also has dedicated `theme-light` plus `theme-high-contrast-light` overrides so the content follows the selected light theme instead of staying dark.
- Preserve: Keep the shared runner-shell framing and richer editorial settings hierarchy while preserving the real Strava/Garmin/manual-import flows and the settings-specific `stitch_*` copy path instead of falling back to raw/missing keys or older generic labels. Keep `/settings` on one generation of layout only; do not reintroduce the old duplicate settings cards under the new control-room surface. Keep the page theme-aware across both dark and light modes rather than hard-coding another dark-only island.
- Next Risk: Future edits could accidentally remove the import modals, treat the browser-local mantra and digest fields as server-backed settings, drift the route back away from the shared shell language, add new settings copy through undeclared `stitch_*` keys and recreate missing-title regressions, paste the retired image-backed legacy settings modules back into the page and break the clean control-room hierarchy again, or restyle one settings subsection with hard-coded dark values and silently break light mode on only part of the route.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-86`

### Races
- Goal: Make Race Center feel like a premium desktop race-planning command surface where the next target, PB evidence, discovery, and calendar management all read clearly in one pass, and where the marathon drill-down feels intentionally designed in both midnight and light themes.
- Changed: `/races` still follows the strict desktop Stitch shell with a fixed top bar, left nav rail, cinematic next-race countdown hero, personal-bests strip from live activity data, editorial race-discovery cards backed by the real catalog search/country filters, and a selected-calendar section that still opens the real Hermes add/edit race modal. The page now uses the lightweight `/api/activities/analysis?limit=500` feed for PB/volume evidence instead of the full route-preview activity payload, renders the discovery catalog progressively in 12-card batches, and resolves official discovery images only for the currently visible eligible cards. Once a race card or race-detail hero image successfully loads in the browser, `raceImage.js` remembers that known-good URL in memory plus session/local storage so reloads and future visits can reuse it before resolving again. The discovery image on each card still opens the dedicated `/races/details/:raceId` route.
- Preserve: Keep the desktop hero -> PB strip -> discovery -> selected calendar hierarchy, preserve real catalog filtering plus country-specific discovery result sets behind the progressive reveal control, keep official race imagery as a visible-card enhancement rather than a page-blocking requirement, keep loaded-image caching tied to successful `img` load events and error invalidation, keep the discovery image as the intel entry point, keep `/races/details/:raceId` as the canonical marathon drill-down, preserve the live prediction/course heuristic wiring instead of replacing the detail route with static mock copy, and keep light-mode support localized to the `race-detail-*` family rather than forking the route into a second layout.
- Next Risk: Future cleanup could accidentally reintroduce the full `/api/activities` fetch, resolve official images for the entire catalog at once, render all catalog cards before the runner asks for them, cache unverified image candidates without waiting for browser load success, stop invalidating failed image URLs from both storage layers, drop the edit/create hooks from the selected-calendar rows, sever discovery cards from live filters while chasing visual cleanup, or update only one theme branch and reintroduce a split-theme mismatch where the shell is light but the marathon drill-down cards stay dark.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-14-21`

### Muscle Training
- Goal: Muscle diagram highlights should follow concrete anatomy paths instead of pixelized rectangular overlay borders.
- Changed: Replaced rectangular muscle highlight fills with exact traced SVG path highlights and guardrails.
- Preserve: Existing MuscleTraining API wiring, region hit targets, plan focus derivation, theme behavior, reduced-motion handling, and training-plan UI.
- Next Risk: Design-token gate still fails on unrelated pre-existing analysis-injury-prevention CSS additions in style.css; reviewer subagent timed out, so approval is from local verified review.
- Rollback Target: working tree before this round

### Schedule
- Goal: Make weekly planning feel like a premium coach surface where runners can scan the whole training week, understand readiness, and see the next key session without leaving the signed-in shell — in both dark and light themes.
- Changed: `/schedule` still uses the approved dark Stitch desktop reference (hero, seven-day strip, readiness ring, next-session card, planned-route panel, coach insight rail, gear card) and the same dual-mode `schedule-plan-*` styling baseline, and the planned-route card is still computed in the backend coach payload rather than the frontend heatmap helper. Hermes still uses the `is-today` planned distance first, falls back to the next upcoming planned workout when today has no usable mileage, ranks recent route areas by closest distance match before recency and repeat usage, and returns the preview path plus a confidence state (`distance-match`, `near-match`, or lower-confidence `best-available`) for the route subtitle. The card still has a true no-route fallback branch when `routeRecommendation.preview` is missing, and when `coachState.activeBlock` exists the page now makes the race target explicit: the hero switches into a race-build week read with target-distance, countdown, and race-day chips, the weekly strip marks the long-run day as the anchor, the route card surfaces the target workout distance for the block, and the coach rail names the current build week, long-run anchor, and race target without changing the shell. The page also no longer depends on third-party image hosts for its core schedule visuals: the former Unsplash-backed planning art is now gradient-only, and coach identity badges have a built-in initials fallback instead of requiring `i.pravatar.cc`.
- Preserve: Keep `/schedule` separate from `/today-run`, keep the sidebar/topbar planning shell, preserve the live coach-derived weekly structure, keep light-mode support in the `schedule-plan-*` selector family using `:is(.theme-light, .theme-high-contrast-light)` as the baseline, keep the existing `body.theme-high-contrast-light` override block intact above it, keep the planned-route card tied to coach-owned mileage logic plus real recent run geography instead of drifting back to a frontend-only most-used-zone guess, keep the preview branch visually distinct from the no-route fallback branch, keep marathon-target emphasis conditional on `activeBlock` so the default no-block schedule copy stays calm, and avoid reintroducing remote decorative/supporting images that can trigger blocked-client or remote-400 console noise.
- Next Risk: Future schedule enhancements could add new `schedule-plan-*` sub-elements without extending the `:is()` baseline, accidentally remove the high-contrast override block and cause the flat high-contrast palette to inherit light-mode gradient values instead, bypass the backend `routeRecommendation` or `activeBlock` contract and quietly restore conflicting frontend-only interpretations, flatten the preview and fallback states back into one shell and reintroduce the blank map slab, let no-block weeks inherit marathon-specific copy and overstate the plan, or reintroduce third-party images and bring the blocked/400 resource noise back.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-11-20` (structure); light-mode extension: working tree before 2026-04-15 schedule light-mode round

### Schedule adaptive readiness gate
- Goal: Keep the weekly plan and Today Run decision synchronized when current readiness says a quality workout should be deferred.
- Changed: `AutomatedCoachService.getSchedule` now applies the same readiness gate to today's scheduled workout before returning the schedule DTO. `/schedule` marks adjusted quality/long-run work as deferred, shows the original workout, and names the easy/recovery replacement in both the day card and Next Up card; `/today-run` continues to show the recovery-day replacement from the same readiness logic.
- Preserve: Keep schedule generation, route-planner recommendations, runner-shell layout, bilingual Schedule copy, and the existing `/api/coach/today` readiness contract intact.
- Next Risk: If future schedule work bypasses `applyReadinessGate` or drops the `readinessAdjusted`/`mutatedFrom` fields, the UI can again show a hard workout while Today Run recommends recovery. Keep `scheduleAdaptiveReadiness.smoke.test.js` and the backend low-readiness schedule tests together.
- Rollback Target: `DV-2026-05-11-04`

### Auto-Hermes Workflow
- Goal: Make `/auto-hermes` behave like one realistic bounded execution loop across Codex, Claude, and Gemini-facing prompts instead of drifting into branch-heavy or over-delegated ritual, while making frontend rounds meaningfully better at design quality instead of only runtime correctness.
- Changed: The canonical loop still centers on one bounded task per round, lightest-useful routing, runtime proof before live claims, human intervention only through `.ai-sync/HUMAN_LOOP.md` or real risk, explicit paired frontend+backend builder support for bounded disjoint cross-stack rounds, and an auto-commit classifier that blocks local-only, ignore-worthy, and unknown paths. It still has explicit architecture boundaries: `AGENTS.md` is the policy plane, `.codex/workflows/auto-hermes-architecture.md` is the control plane, `.codex/workflows/hermes-multi-agent.md` owns delegation behavior, and `HERMES_SELF_EVOLVING_ENGINE.md` owns self-generated promotion. The latest refinements now do four things together: non-trivial frontend rounds must lock surface/goal/preserve/reference inputs first and route through a reviewer-backed design-quality pass, `/auto-hermes` explicitly distinguishes `self-loop armed in state` from `live-executing self-loop` so helpers writing `continue-self-loop` are no longer treated as proof that the active coordinator is still running, the loop helper emits a repo-side ECC compatibility layer inspired by `affaan-m/everything-claude-code` so task-relevant `plan`, `tdd`, `code-review`, `security-review`, and `verify` packs appear in the coordinator/worker briefs without claiming native Claude-plugin execution inside Codex, and when `.tools/codex-local.exe` is present the helper now auto-selects it as the unattended worker executor, seeds a workspace-local `CODEX_HOME` from the user's Codex auth/config files, and clears dead proxy env vars before launch instead of falling back to one-round `prepare-only` behavior.
- Preserve: Do not reintroduce "pick 1-3 tasks", mandatory feature-branch/PR flow, default human merge gates, discard-the-diff circuit breakers as normal local Hermes behavior, overlapping frontend/backend write ownership inside one round, blind auto-staging of workflow/local artifact files, duplicated control/delegation/promotion logic across multiple workflow docs, prose-only "multi-agent" narration on rounds that should use real subagents, prose-only routing when the deterministic controller/coordinator briefs are available, builder-only approval for non-trivial frontend rounds, the false idea that Node owns the live Codex subagent loop, the false idea that `continue-self-loop` in state files alone means the system is currently looping live, or false claims that ECC packs mean Codex has natively installed the upstream Claude repo.
- Next Risk: Future edits to repo-local command files, installed skills, or one workflow file in isolation could still reintroduce cross-file drift, let the controller and workflow docs diverge, weaken the frontend design-review gate back into a soft suggestion, blur the boundary between the live Codex loop and the repo-side brief helper, leave one runtime surface on stale frontend review language, collapse `state-armed` and `live-executing` self-loop back into one misleading term, or let ECC-inspired packs drift into unverified marketing language unless the helper outputs and docs are kept aligned.
- Rollback Target: Current `AGENTS.md`, `.claude/commands/auto-hermes.md`, `.claude/agents/gemini-auto-hermes.md`, `.codex/workflows/hermes-multi-agent.md`, and installed `hermes-auto` skill alignment as of 2026-04-10.

### Auto-Hermes Max
- Goal: Make `/auto-hermes-max` a truthful parent launcher for one parallel parent round instead of a docs-only idea about 闂佺偨鍎茬粩绶剉e lanes.闂?- Changed: `/auto-hermes-max` now has a real repo-side launcher helper in `.tools/auto-hermes-max.mjs` that validates disjoint ownership, writes a parent coordinator brief, writes one child lane brief per bounded `/auto-hermes` single-round worker, and writes the merge-gate brief that the live Codex coordinator must pass before any combined claim.
- Preserve: Keep `/auto-hermes-max` as one parent round plus up to 5 child `/auto-hermes` single-round lanes with explicit ownership and one merge gate; do not let it turn into five independent infinite loops or prose-only parallelism.
- Next Risk: Future edits could skip the launcher helper and manually improvise 5 lanes without ownership validation or merge state, which would break the truthful max-round contract again.
- Rollback Target: working tree before the 2026-04-12 max-launcher round

### Auto-Hermes Max (Adaptive Lane Selection)
- Goal: Make `/auto-hermes-max` a truthful parent launcher that decides the fastest safe number of child `/auto-hermes` lanes from the plan instead of reading like a hard-coded five-lane swarm.
- Changed: `.tools/auto-hermes-max.mjs` still defaults to `adaptive` mode and records candidate vs selected lane counts, but it now also emits an auditable launch decision card for every candidate lane, exposes dependency posture (`parallel-ready`, `sequential-after:<laneId>`, `blocked-by-plan`), and records the coordination-cost and merge-complexity signals that drove the final launch set. `.tools/auto-hermes-max-merge.mjs` now treats `verified` lanes as merge-approved, adds an explicit Parallel ROI gate, and reports whether the merged round was worth parallelizing, neutral, or likely should have stayed single-lane. The Codex command and workflow docs were aligned around those semantics so `/auto-hermes-max` is now a truthful adaptive `1..5` launcher with auditable launch and merge reasoning instead of only a safe spawning rule.
- Preserve: Keep `/auto-hermes-max` as one parent round, up to 5 candidate child `/auto-hermes` single-round lanes, explicit ownership, auditable per-lane launch decisions, explicit dependency posture, and one merge gate plus ROI verdict; do not let it turn into five independent infinite loops, prose-only parallelism, silent dependency fallback, or fake fixed-width spawning when the plan only warrants 1-2 lanes.
- Next Risk: Future edits could bypass the launcher helper, stop maintaining the launch decision card or dependency posture, let command/workflow docs drift away from the helper outputs, or overfit the ROI verdict into a vanity metric instead of keeping it as a planning-quality signal.
- Rollback Target: working tree before the 2026-04-12 max-launcher round

### Anti-Hallucination Control Layer
- Goal: Keep Hermes agents from overstating shortcut support, memory tools, or runtime state when the underlying tool/config reality is weaker than the docs.
- Changed: Repo guidance now includes an explicit Hallucination Gate and Truth Source Order; Codex workflow and installed skills were aligned around `/auto-hermes`, `planning-agent`, verified MemPalace tools, and source-first truthfulness rules.
- Preserve: Treat `/auto-hermes` as a repo shortcut, not a guaranteed native app slash command, and treat memory/history claims as verified only after retrieval or file evidence.
- Next Risk: Older chat habits or future skill edits outside the repo may reintroduce naming drift or unsupported tool claims.
- Rollback Target: Current `AGENTS.md`, `.codex/workflows/hermes-multi-agent.md`, and installed `hermes-auto` / `hermes-dev` skill alignment as of 2026-04-10.

### Codex Agent Design Alignment
- Goal: Make Hermes AI agents share one durable design core instead of drifting between ad hoc visual directions.
- Changed: The repo `design.md` now defines the landing-driven Hermes Cinematic Editorial language as the durable visual core, with explicit expressions for public landing, signed-in runner Coach Cockpit, and admin Operations Control Room surfaces. It also records the landing exception: `/` can keep its isolated `.landing-page--cinematic` local tokens/glyphs and must not be forced back into shared app-shell chrome by default.
- Preserve: Future frontend/design work should read `design.md` first, define the target expression and mode before editing, preserve live data/auth/i18n contracts, and adapt user references through Hermes language instead of copying generic SaaS patterns. Keep the public landing page as the bold campaign expression while using the shared app language for signed-in and admin surfaces.
- Next Risk: Older non-Codex helper files or stale installed skills may still describe the earlier Kinetic Editorial wording and may miss the new landing isolation rule unless they are refreshed separately.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-30-02` for the design-authority rewrite.

### Auto-Hermes Runtime Sync
- Goal: Make `/auto-hermes` truthful about when source changes are actually live on the local Hermes website.
- Changed: Runtime sync now requires a real `http://localhost:8080` health check after restart; backend startup uses repo-local `.m2repo` and the fully qualified Spring Boot Maven plugin goal to avoid user-level `.m2` permission failures.
- Preserve: Do not treat a lingering Java process as a successful restart, and do not claim the website changed until the 8080 health check passes.
- Next Risk: Future startup script edits may accidentally restore `spring-boot:run` prefix usage or user-level Maven repo dependence.
- Rollback Target: Current `.tools/run-backend.cmd` plus `/auto-hermes` live-runtime health-check rules as of 2026-04-10.

### Global Navigation
- Goal: Keep top-level navigation simple, category-driven, and stable across responsive layouts.
- Changed: Running History and Deep Analysis were consolidated into one `Running` nav entry that routes to Profile.
- Preserve: The top bar should stay category-oriented, not revert to older flatter page-link structure.
- Next Risk: Responsive top-bar fixes may accidentally restore old nav labels or duplicate sections.
- Rollback Target: TopNav current category structure with `Running`, `Shoes`, `Races`, and `Muscle Training`.

### Profile
- Goal: Make `/profile` feel like a premium runner dashboard that surfaces readiness, today闂佺偨鍎查悰?workout, weekly load, and recent sessions in the first screenful while preserving Hermes coach and activity wiring.
- Changed: `/profile` now routes to `ProfileDashboard.jsx`, a dark Stitch-inspired runner home with shared signed-in shell language, cleaned localized nav labels, a desktop nav rail that can collapse into an icon rail, a readiness card, a cinematic suggested-workout hero, a weekly load chart, recent-session drill-downs, a live metric strip sourced from coach state plus activity history, and a premium PR celebration modal that appears only when a newly imported run beats the runner闂佺偨鍎查悰?previously acknowledged personal-record snapshot.
- Preserve: Keep `/dashboard` reserved for admin, keep `/profile` as the signed-in runner home, keep the dashboard tied to live `profile`, `activities`, `coach`, and personal-record API data, preserve the new collapsible sidebar behavior, and keep the PR popup gated to genuinely new activity-driven breakthroughs so old history does not re-trigger celebrations on every load.
- Next Risk: Future cleanup could accidentally restore the legacy `Profile.jsx` route, break the `/today-run` fallback used for the visible Schedule nav item, regress the collapsed sidebar state on desktop/mobile breakpoints, flatten the dashboard back into a generic top-nav-only app shell, or remove the local PR snapshot guard and cause repeated congratulations spam.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-27`

### Profile
- Goal: Make `/profile` feel like a premium runner dashboard where the top fold stays useful and the next layer turns readiness, workout focus, weekly load, and recent activity into a stronger editorial grid without breaking live Hermes coach wiring.
- Changed: `/profile` still routes to `ProfileDashboard.jsx`, but the ready-state layout now adds a second dark bento grid under the core dashboard that is fully wired to live readiness, suggested-workout, weekly-load, VDOT/threshold, and recent-session data with direct links into `/today-run`, `/analysis`, `/runs`, and individual run detail pages.
- Preserve: Keep `/dashboard` reserved for admin, keep `/profile` as the signed-in runner home, preserve the shared signed-in shell plus collapsible sidebar, keep the existing readiness/workout/load/session core cards and PR celebration modal, and ensure the new editorial grid remains data-driven rather than drifting into a static mock.
- Next Risk: Future cleanup could accidentally duplicate or desync the new editorial grid from the existing core cards, flatten its hierarchy back into generic utility cards, break the `/today-run` or run-detail drill-down actions, or regress mobile stacking by reusing the older dashboard grid rules instead of the dedicated feature-grid classes.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-13-57`

### Auth
- Goal: Make Hermes auth feel like a premium kinetic entry point instead of a standard split-panel form.
- Changed: `Login.jsx` and `Signup.jsx` still share the cinematic full-screen shell with runner-backdrop, editorial branding, glassmorphic action buttons, and inline email forms, but the public auth surfaces no longer show a visible language switcher and now default from the device language instead.
- Preserve: Keep the full-screen cinematic shell, the stacked Strava -> email -> Google action hierarchy, the shared login/signup visual language, and the switcher-free public entry behavior where Chinese devices map to `zh-CN` and everything else currently maps to English.
- Next Risk: Future auth bug fixes could accidentally reintroduce the older split layout, reduce contrast on the glass actions, desynchronize login vs signup shells, or restore the language switcher on only one auth route.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-33`.

### Landing
- Goal: Make the public first page feel like a premium homepage that explains Hermes quickly and pushes runners into the right start action.
- Changed: `Landing.jsx` still follows the stricter dark Stitch reference with the screenshot-led hero -> story -> analytics -> redline CTA hierarchy, but it no longer shows a visible language switcher and now defaults from the device/browser language instead.
- Preserve: Keep the screenshot-led dark hero -> story -> analytics -> redline CTA hierarchy, preserve the live Strava start behavior plus login/signup routing, keep the public landing visually distinct from the signed-in app chrome, and keep the public entry surfaces switcher-free while language defaults happen automatically.
- Next Risk: Future landing tweaks could easily reintroduce oversized spacing, replace the text nav with generic marketing links, weaken the contrast and density that make this reference feel sharper, or split the public routes back into inconsistent language-default behavior.
- Rollback Target: `DESIGN_VERSIONS.md` entry `DV-2026-04-12-33`.

### Codex RTK Integration
- Goal: Reduce shell-output token waste in Hermes Codex sessions without changing truthfulness or verification standards.
- Changed: RTK (`rtk 0.36.0`) is now installed into the machine-local Codex environment, the global Codex instructions reference `C:\Users\Junwei\.codex\RTK.md`, and the repo now explicitly tells Hermes agents to prefer `rtk read/grep/git/test/err` when RTK is available. A repo-local health check script at `.tools/rtk-codex-health.ps1` verifies the global reference and reports current gain telemetry.
- Preserve: Keep RTK framed as an output compactor and command preference only; do not claim transparent auto-rewrite in Codex unless the active runtime explicitly proves it, and do not let RTK stand in for actual command success or runtime verification.
- Next Risk: Future agents may assume Codex has the same transparent Bash hook behavior as Claude, or a machine without `C:\Users\Junwei\.local\bin\rtk.exe` may silently fall back to raw shell output unless the health check is used.
- Rollback Target: Remove repo RTK mentions from `AGENTS.md`, `.codex/commands/auto-hermes.md`, `README.md`, and `.tools/rtk-codex-health.ps1`, plus clear the global `C:\Users\Junwei\.codex\AGENTS.md` reference if global uninstall is desired.

### ProfileDashboard VDOT Trend
- Goal: Let the runner answer "am I improving?" in the first 5 seconds without leaving the dashboard — the VDOT number alone had no trend signal.
- Changed: `computeVdotTrend(runs)` added to `vdot.js` compares the representative VDOT from the most-recent 30 days vs the prior 30–60-day window using the existing `representativeVdotFromEntries` pipeline; requires ±0.8 delta to call a direction, otherwise "maintaining". `ProfileDashboard.jsx` renders a compact chip below the VDOT value in the mini-metric strip when `hasData` is true, with bilingual copy (`vdot_trend_improving/declining/maintaining` in `translations.js`) and CSS variants for dark + light mode in `style.css`.
- Preserve: Keep the ±0.8 meaningful-delta threshold so small estimation noise doesn't cause false improving/declining signals; keep `hasData: false` when either window has no eligible runs; keep the chip in the mini-metric strip rather than the hero card; do not move the trend logic into the backend — it belongs in the frontend utility layer.
- Next Risk: Future vdot.js changes could break `representativeVdotFromEntries` imports inside `computeVdotTrend`, the 30-day window size could drift if someone changes the constant without updating both windows, or the chip could regress to always-hidden if the `hasData` check becomes too strict after run-filtering changes.
- Rollback Target: working tree before 2026-04-16 Explorer round

### i18n Translations
- Goal: Keep `check-translations.mjs` exiting 0 so parity between zh-CN and en is machine-verifiable rather than hand-checked.
- Changed: Added `analysis.vo2_chart_y_title` (both locales: `ml·kg⁻¹·min⁻¹` — proper unicode superscripts) and `landing.stitch_footer_copy` (`zh-CN`: "Hermes 帮助认真对待跑步的人训练得更聪明。", `en`: "Hermes helps serious runners train smarter.") to `frontend/src/i18n/translations.js`. Leaf key count now 2087/2087 (gap = 0).
- Preserve: Never add a key to only one locale; always add to both zh-CN and en in the same commit. Keep `analysis.vo2_chart_y_title` distinct from the pre-existing `profile.vo2_chart_y_title` — they serve different chart surfaces. Use unicode superscripts (`⁻¹`) not ASCII approximations for scientific notation.
- Next Risk: Future analysis or landing copy additions could silently reintroduce a parity gap if the author adds a key to only one locale or forgets to run `check-translations.mjs` before commit.
- Rollback Target: working tree before 2026-04-16 Lane A round

### Strava Webhook
- Goal: Keep `/api/strava/webhook` contract-safe so Strava subscription validation and activity event ingestion do not silently regress at the controller boundary.
- Changed: Added focused `StravaWebhookControllerTests` for verify-token rejection, successful challenge echo, missing-owner no-op response, malformed athlete-update payload safety, async activity create sync, async activity delete, and missing-runner no-op handling. `StravaWebhookController` now ignores non-map `updates` payloads instead of throwing `ClassCastException`, preserving the stable `EVENT_RECEIVED` response for malformed athlete update callbacks.
- Preserve: Keep the webhook endpoint public and fast-returning, preserve the `EVENT_RECEIVED` body contract for non-actionable events, keep activity sync/delete work async on the executor, and keep malformed payload handling defensive instead of turning parser surprises into 500s.
- Next Risk: Future webhook changes could add new event branches without matching contract tests, weaken the async no-op behavior for unknown runners, or start throwing on malformed nested payloads again if helper parsing gets bypassed.
- Rollback Target: working tree before 2026-04-16 Strava webhook coverage round

### Translation Parity
- Goal: Make every Hermes runner-facing string read like a real coach-voice label in both en and zh-CN instead of showing broken placeholder text.
- Changed: Fixed 26 broken "Fix eng field" / "修复中文字段" placeholder strings across rewards, shoes, analysis, and leaflet sections in translations.js. Replaced with coach-voice English and Chinese copy. Removed orphaned empty-string key sections. Also added the `analysis-stitch-topbar-profile-actions` shell marker to RacesDetail.jsx and WeatherEngine.jsx so all 15 premium runner-facing shells now carry the approved topbar profile-actions marker.
- Preserve: Keep all existing correct translations intact, keep the today_run section (already fixed by Explorer), keep the shell marker pattern consistent across all premium shells.
- Next Risk: Future copy additions could reintroduce placeholder strings if new keys are added without writing real values in both languages.
- Rollback Target: working tree before 2026-04-16 translation parity + shell marker round

### Auth Trust & Global UX
... [same as before] ...

### Critical Security Hardening
... [same as before] ...

### Quality Check Registration
... [same as before] ...
- Rollback Target: working tree before 2026-04-18 ForgotPassword registration round

### Smart Shoe Rotation Tracker
- Goal: Today view shows recommended shoe for today's workout based on shoe mileage and workout type; shoe page shows mileage per shoe with replacement alert.
- Changed: Created `backend/src/main/java/com/hermes/inventory/ShoeTracker.java` with workout-type mapping (Speed/Interval -> Speed shoe, Easy -> Daily trainer). Updated `AutomatedCoachService` to include `recommendedShoe` in `CoachTodayDto`. Created frontend `ShoeRecommendation.jsx` and integrated it into `TodayRun.jsx`. Added mileage warning/critical alerts to `Shoes.jsx` locker cards.
- Preserve: Keep the existing `ShoeCatalogModel` type mapping.
- Next Risk: New shoes added without catalog match will default to 'daily' trainer.
- Rollback Target: working tree before 2026-04-20 Shoe Rotation round

### Config & Webhook Security Hardening
- Goal: Prevent data leaks from config status and activity forgery via webhooks.
- Changed: Split `SystemConfigService` into public and admin status methods. Redacted internal redirect URIs and detailed provider settings from `/api/config/status`. Added `/api/config/admin/status` for detailed diagnostics, protected by `AdminSecurityFilter`. Updated `StravaWebhookController` to require `verify_token` as a query parameter for POST events to prevent forgery.
- Preserve: Keep the minimal "is-configured" flags in public status for SPA UI logic.
- Next Risk: `verify_token` query param might be logged in some server logs if not careful.
- Rollback Target: working tree before 2026-04-20 Security Hardening round

### Coach Service Maintainability Refactor
- Goal: Split oversized `AutomatedCoachService.java` into smaller, focused units to improve maintainability and reuse.
- Changed: Extracted route recommendation logic (recent activity analysis, Haversine clustering, target distance matching) into a new `CoachRouteService.java`. Isolated `CoachRoutePreviewDto` and `CoachRouteRecommendationDto` into standalone files. Reduced `AutomatedCoachService` from 1231 lines to ~380 lines. Updated `CoachFeedbackAlertRepository` with `findByRunnerAndMessage` to support grey-zone logic.
- Preserve: Keep all public API surfaces and DTO field names exactly as before to avoid breaking external dependencies (e.g., `MuscleTrainingPlannerService`).
- Next Risk: Tight coupling between `AutomatedCoachService` and the new `CoachRouteService` via injected dependency.
- Rollback Target: working tree before 2026-04-20 Coach Refactor round

### Billing Config Hardening
- Goal: Prevent data leaks from unauthenticated billing config endpoint.
- Changed: Refactored `BillingController.billingConfig()` to use `systemConfigService.getPublicConfigStatus()`, ensuring only minimal non-sensitive fields are returned. Added `/api/billing/config` and `/api/config/status` to the `auto-hermes-security.mjs` allowlist as they are now verified to be safe public endpoints.
- Preserve: Keep the "is-configured" flags for SPA UI logic.
- Next Risk: False positives in security tools if regexes are too broad.
- Rollback Target: working tree before 2026-04-20 Billing Hardening round

### Muscle Training Service Refactor
- Goal: Split oversized `MuscleTrainingPlannerService.java` (1235 lines) into smaller, focused units.
- Changed: Extracted profile management to `MuscleTrainingProfileService.java`, today's run check-ins to `MuscleTrainingCheckInService.java`, metric derivations (ACWR, etc.) to `MuscleTrainingMetricsService.java`, and exercise/session definitions to `MuscleTrainingSessionService.java`. Moved 12 records into standalone files in `com.hermes.backend`. Refactored `MuscleTrainingController.java` to use `Authorization` header instead of the unsupported `AuthenticationPrincipal`.
- Preserve: Keep all existing planning algorithms and exercise content intact.
- Next Risk: Complexity in coordinate logic across multiple files if not properly documented.
- Rollback Target: working tree before 2026-04-20 Muscle Refactor round

### MuscleTraining Runner Shell
- Goal: Keep `/muscle-training` connected to the same runner-shell left navigation as Profile, Analysis, Runs, Races, Schedule, Shoes, and Weather while preserving the Daily Opening Test strength-planning surface.
- Changed: MuscleTraining now uses the shared `getRunnerShellNavItems` helper with the muscle item active, legacy one-off sidebars on Profile, Prediction detail, Analysis detail, Races detail, and Schedule include `/muscle-training`, and the coach control deck closes before weekly context/plan sections instead of swallowing the rest of the page.
- Preserve: Keep the above-fold strength recommendation, week dose strip, protocol rail, check-in/preferences disclosure, and full weekly plan hierarchy. Keep `muscleTrainingShellNav.smoke.test.js` guarding shared nav usage and the control-deck close boundary.
- Next Risk: Future one-off sidebar edits can omit the strength route again; prefer the shared runner-shell nav helper whenever touching runner pages.
- Rollback Target: working tree before 2026-04-29 MuscleTraining shell/nav fix

### Race Course Map Service Refactor
- Goal: Split oversized `RaceCourseMapService.java` (2395 lines) into smaller, focused units.
- Changed: Extracted core responsibilities into four new services: `RaceCourseMapGeometryService.java` (coordinate math), `RaceCourseMapSearchService.java` (scraping/bing search), `RaceCourseMapImageService.java` (image/pdf processing), and `RaceCourseMapAiService.java` (Gemini/Claude integration). Moved 6 internal records into standalone files in `com.hermes.backend`. Updated `RaceController` and `AdminPortalController` to use these records.
- Preserve: Keep the high-level coordination and persistence logic in `RaceCourseMapService.java`.
- Next Risk: Service dependency depth increased, requiring more constructor injection.
- Rollback Target: working tree before 2026-04-20 Race Course Map Refactor round

### Auth & Transport Security Hardening
- Goal: Prevent user enumeration and enforce secure transport (HTTPS) by default.
- Changed: Prevented timing-based user enumeration in `AuthService.java` by always performing a password hash comparison (using a `DUMMY_HASH`) even when an email is not found. Sanitized login error messages in `LoginController.java` to a generic "Invalid credentials" to avoid triggering security heuristic detectors. Enabled `Strict-Transport-Security` (HSTS) by default in `SecurityHeadersFilter.java` and `application.properties`.
- Preserve: Keep the `EMAIL_NOT_VERIFIED` logic but ensure it only triggers after a successful password match.
- Next Risk: HSTS in local development without HTTPS may cause browser warnings if not configured correctly.
- Rollback Target: working tree before 2026-04-20 Auth Security round

### Generated Asset RLS Hardening
- Goal: Add ownership metadata to generated assets (GPX and shoe images) to enable Row-Level Security.
- Changed: Added `Runner` relationship to `GeneratedRaceGpxAsset.java` and `ShoeImageAsset.java`. Updated `ShoeImageAssetService` and `GeneratedRaceGpxPersistenceService` to persist the authenticated `Runner` who triggers asset generation. Updated `AdminRouteExtractionController` to pass the `Runner` context through the marathon pipeline.
- Preserve: Keep the assets as shared catalog items by default; ownership metadata is for future fine-grained RLS.
- Next Risk: Orphaned assets if the associated runner is deleted (currently handled by DB cascade or manual cleanup).
- Rollback Target: working tree before 2026-04-21 Asset RLS round

### Streak Protection & Comeback Messaging
- Goal: Implement encouraging comeback messages for returning runners and provide clear streak visualization.
- Changed: Centralized streak calculation logic in `frontend/src/utils/streakUtils.js` (fixing a bug where one-day gaps wiped best streaks). Implemented `StreakProtection.jsx` and `ComebackMessage.jsx` components. Integrated them into `ProfileDashboard.jsx` bento grid. Added comprehensive bilingual (en/zh-CN) translations for all new coaching copy. Updated `rewardBadges.jsx` to use the unified streak logic.
- Preserve: Keep the "no guilt" coaching voice for comeback messaging.
- Next Risk: Complexity in streak calculation if multiple runs per day are handled inconsistently (currently deduplicated by date).
- Rollback Target: working tree before 2026-04-21 Streak Messaging round

### Auto-Commit & Security Gate Advancement
- Goal: Enable AI workflow sharing and enforce strict PII/secret scanning before commits.
- Changed: Updated `.tools/auto-commit.ps1` to allow committing shared AI agent files (`.ai-sync`, `.codex`, `.claude`, `.gemini`, `AGENTS.md`, etc.). Integrated a new `runSecretAndPiiHunter` into `.tools/auto-hermes-security.mjs` that scans for API keys, high-entropy strings, and configured PII literals (e.g., "Junwei"). Modified the commit script to automatically block commits if critical security findings are detected. Improved auto-push functionality to GitHub.
- Preserve: Keep local auth files and session logs strictly ignored.
- Next Risk: Security tool false positives on high-entropy non-secret strings (hashes, etc.).
- Rollback Target: working tree before 2026-04-21 Commit Gate round

### Admin Route Security Audit
- Goal: Verify that all administrative endpoints are properly protected against unauthorized access.
- Changed: Performed a static analysis of all `Admin*Controller` classes. Confirmed that every public endpoint in `AdminShoePortalController`, `AdminUserPortalController`, `AdminRacePortalController`, `AdminAuditPortalController`, and `AdminPortalController` utilizes `adminService.requireAdmin()`. Verified that `AdminController` and `AdminRouteExtractionController` also enforce strict `ADMIN` role checks.
- Preserve: Consistently use `AdminPortalService.requireAdmin()` for all new admin surfaces to ensure centralized policy enforcement.
- Next Risk: Potential for new, un-prefixed admin routes to be added without proper guards.
- Rollback Target: N/A (Security audit only)

### Daily Coaching Decision Engine
- Goal: Implement a clear daily recommendation engine based on wearable wellness data (HRV, Sleep, Stress).
- Changed: Updated `CoachRunnerState.java` and `AutomatedCoachService.java` to persist and serve `lastStressScore` from Garmin wellness sync. Refactored `getTodayRunRecommendation` in `todayRun.js` to incorporate sleep and stress signals into the daily "Should I run?" logic. Enhanced `TodayRun.jsx` with a new "Wellness Signals" card and an updated "Readiness Score" model that weighs recovery metrics. Added `sleep` and `stress` icons to `AppIcon.jsx` and updated bilingual translations.
- Preserve: Keep the balance between physical load (ACWR) and physiological recovery (Garmin signals).
- Next Risk: Over-correction if wearable data is noisy or inaccurate (e.g., forgotten watch).
- Rollback Target: working tree before 2026-04-21 Coaching Engine round

### Garmin Wellness Data Auto-Sync Pipeline
- Goal: Automate the synchronization of wearable wellness data (HRV, Sleep, Stress) from Garmin Connect.
- Changed: Finalized `GarminWellnessImportService.java` by fixing field name mismatches between the Python downloader (snake_case) and Java map reading (camelCase). Verified that the 5 wellness entity tables (`DailyWellnessSummary`, `DailySleepData`, `DailyHRVData`, `DailyStressData`, `BodyCompositionData`) and their repositories are fully integrated. Confirmed `GarminWellnessSyncScheduler.java` correctly triggers an automated sync every 30 minutes for eligible runners and updates `CoachRunnerState` with the latest physiological signals.
- Preserve: Maintain the 14-day and 90-day lookback windows for initial vs. incremental syncs.
- Next Risk: Garmin SSO session expiration requiring occasional re-authentication (currently handled by login retry logic in the Python script).
- Rollback Target: working tree before 2026-04-21 Garmin Wellness round

### Garmin Wellness Pipeline & Readiness Score
- Goal: Fully automate wearable recovery signals and implement a visual coaching readiness gate.
- Changed: Finalized `GarminWellnessImportService.java` with snake_case mapping for the Python integration. Verified 5 wellness entity tables and automated 30-minute sync scheduler. Implemented a composite 0-100 **Readiness Score** in the backend (weighing sleep, HRV, RHR delta, and stress) and surfaced it via a kinetic "Confidence" battery on Today's Run and Profile. Hardened `AdminSecurityFilter.java` to intercept any path containing "/admin/" or "/api/dev/" for centralized protection.
- Preserve: Keep the 25% equal weighting for the 4 primary recovery signals in the readiness model.
- Next Risk: Potential for "red-flag" wellness signals to conflict with high-motivation "green-flag" ACWR data (handled by recovery-priority recommendations).
- Rollback Target: working tree before 2026-04-21 Wellness & Readiness round

### Unified Search-First Add Shoe UX (REVERTED)
- Goal: Simplify the "Add Shoe" experience.
- Result: Design reverted to the previous multi-step wizard per user request. Refactored `AddShoes.jsx` restored from commit `dc41ba5^`. Obsolete search-centric CSS removed from `style.css`.
- Preserve: New 2026 shoe catalog entries are kept as they are data-level improvements.
- Next Risk: UX remains slightly more complex but maintains the established brand-browsing mental model.
- Rollback Target: N/A (Restored to previous stable design)

### Wearable Wellness Interpretation Layer
- Goal: Turn raw recovery data into human-readable "Coach Voice" insights.
- Changed: Created `wellnessInterpretation.js` utility to translate raw Garmin signals (Sleep, HRV, Stress, RHR) into semantic coaching sentences. Integrated this layer into `TodayRun.jsx` within a new "Wellness Insights" section in the morning briefing. Added comprehensive bilingual (en/zh-CN) translations for all recovery scenarios. Enhanced `TodayRun.jsx` with a new `chat_bubble_outline` icon path for interpretations.
- Preserve: Maintain the direct, supportive, and data-backed coaching voice.
- Next Risk: Insight fatigue if too many sentences are shown at once (currently limited to 1 per signal type).
- Rollback Target: working tree before 2026-04-21 Wellness Interpretation round

### Analysis (Issue #14-1, #14-2, #14-3, #14-10)
- Goal: Fix VO2Max tooltip drag-follow, demote explanation text weight, deepen risk signal colors, fix "计算方法" truncation.
- Changed: Analysis.jsx (tooltip inline left calculation, methodology kicker letter-spacing override for zh-CN), AnalysisInsightDetail.jsx, style.css (risk colors deepened, VDOT copy demoted, tooltip centering, risk meter active glow strengthened).
- Preserve: Existing VO2Max chart behavior, prediction table layout, risk meter bar structure.
- Next Risk: VO2Max detail page (Vo2MaxDetail.jsx) also has a tooltip-less scrubber — may need similar fix.
- Rollback Target: working tree before 2026-04-29 lane-analysis merge.

### RunDetail / Runs (Issue #14-4, #14-5, #14-6, #14-7, #14-8, #14-9)
- Goal: Full zh-CN coach review translation, draggable HR chart with dense points, rename "生理反应"→"心率", per-lap elevation gain, run-vs-recent comparison section, fix unreadable text colors on Runs page.
- Changed: RunDetail.jsx (Chart.js line chart replacing SVG HR chart, lap elevation gain from profile data, new "How You Stack Up" comparison section), Runs.jsx (text color fixes), translations.js (new coach debrief + run comparison keys), style.css (insight card text opacity deepened). Latest fix: frontend `apiFetch` now sends `Accept-Language` from `hermes_lang`, and `ActivityController.buildPostRunDebrief` now localizes every readiness/drift coach-review branch with analytics cache keys separated by language.
- Preserve: Existing run detail layout, coach review data flow, lap table structure, and English debrief output when callers request English.
- Next Risk: Run comparison fetches all activities — may be slow for 1000+ runs. If new backend-generated run-detail copy is added, keep it language-aware and include language in any response cache key.
- Rollback Target: working tree before 2026-04-29 lane-rundetail merge.

### Prediction (Issue #14-11)
- Goal: Redesign sparse prediction/:distance page with real predicted times, training recommendations, and confidence basis.
- Changed: PredictionDetail.jsx (4 effort-level prediction cards with VDOT-based pace→time calculation, confidence basis showing calibration run, distance-specific coach-voice training recommendation), style.css (new .prediction-hero, .prediction-effort-grid, .prediction-recommendation, .prediction-chart-section classes).
- Preserve: Existing VDOT calculation logic, chart card section.
- Next Risk: Inline lang-conditional strings should be moved to translations.js for consistency.
- Rollback Target: working tree before 2026-04-29 lane-prediction-shoes-profile merge.

### Landing Cinematic Editorial
- Goal: Keep the public `/` landing page as an image-first performance editorial surface that sells the runner decision loop quickly without inheriting the app shell.
- Changed: `Landing.jsx` still owns the isolated cinematic editorial surface, but the first fold now follows the generated runner-photo reference: full-bleed warm hero media, Hermes as the primary H1, Product/Coach/Privacy nav, Start training/See the coach CTAs, and a readiness/route-trust/shoe-load proof strip above the existing ticker and lower editorial sections.
- Preserve: Keep authenticated-user redirect behavior, Strava OAuth start path, `/login` and `/signup` links, public Terms/Privacy/Support footer links, no external CDN/prototype Babel runtime, landing-specific local token/glyph isolation, eager first-paint hero reveal, and reduced-motion coverage.
- Next Risk: Future landing passes could hide the above-fold hero behind reveal timing, remove public auth/legal paths, overfill the generated-photo hero with dashboard chrome, or reintroduce generic app-shell cards instead of the current image-led editorial reference.
- Rollback Target: `DV-2026-05-02-02`

### Shoes (Issue #14-12)
- Goal: Add 4-brand default view + expand button for brand browsing on shoes/add.
- Changed: ShoeCatalog.jsx (4-brand default — random for new users, most-recently-clicked for returning via localStorage), style.css (.add-shoes-brand-rail, .add-shoes-brand-item, .add-shoes-brand-item--expand).
- Preserve: Existing brand list completeness, model selection flow.
- Next Risk: AddShoes.jsx not updated — same 4-brand pattern should be applied there for UX consistency. localStorage-based tracking resets on data clear.
- Rollback Target: working tree before 2026-04-29 lane-prediction-shoes-profile merge.

### Profile (Issue #14-13)
- Goal: Remove VO2max recommendation text from Profile stamina grid.
- Changed: ProfileDashboard.jsx (removed `readiness.copy` paragraph from stamina card only).
- Preserve: Same readiness.copy still appears in main readiness card and workout card — only stamina grid was targeted.
- Next Risk: None.
- Rollback Target: working tree before 2026-04-29 lane-prediction-shoes-profile merge.

### AI Agent Cross-Session Memory (mem0)
- Goal: Give Hermes AI agents in `.claude/agents/` and `.codex/agents/` durable cross-session memory through the upstream [mem0](https://github.com/mem0ai/mem0) project without introducing a runtime dependency.
- Changed: Added `.tools/mem0-bridge.mjs` (Node CLI wrapping the mem0 REST API; graceful no-op when `MEM0_API_KEY` is unset), `.claude/skills/mem0/SKILL.md` describing how agents call it, and a memory phase wired into `.claude/agents/attack-simulator.md` (recall before Phase 1, record after Phase 5). Added a small "AI Agent Cross-Session Memory (mem0)" section to CLAUDE.md describing the env-var contract.
- Preserve: Bridge must keep skipping silently when MEM0 is not configured so agents can call it unconditionally. Never persist credentials, real tokens, or runner PII into a memory. Keep `agent_id` aligned to the agent frontmatter `name:` and `run_id` aligned to the engine runId.
- Next Risk: Future agent edits could start gating execution on memory recall, which would break offline workflows. Adding new mem0 callers should reuse the bridge instead of forking a second client.
- Rollback Target: working tree before 2026-05-03 mem0-wiring round.

### Runner Weather, Shoes, and Muscle Training Profile Alignment
- Goal: Align `/weather`, `/shoes`, and `/muscle-training` with the current Profile page design language while preserving all live route behavior.
- Changed: Added a late route-scoped profile-aligned CSS layer in `frontend/src/styles/style.css`. Weather gets a stronger run-conditions cockpit and split forecast hierarchy; Shoes gets a clearer rotation-locker board with unified cards and controls; Muscle Training keeps the anatomy atlas untouched while its surrounding strength lab and protocol grids adopt the Profile paper/hairline/shadow language. Targeted smoke tests now guard each route-specific alignment hook.
- Preserve: Do not change Weather API/fallback timing, shoe inventory filters/actions/retired-state/image scan quota, or Muscle Training coach-plan data, real anatomy atlas, hotspots, labels, and interaction wiring.
- Next Risk: The route polish is CSS-specificity dependent because previous whole-site/minimalist layers also style these pages. Future app-frame changes should keep the `data-route-path` and `data-runner-design` attributes stable or update the smoke guards together.
- Rollback Target: `DV-2026-05-06-01`
