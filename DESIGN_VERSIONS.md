# Hermes Design Versions

Use this file to keep a durable history of meaningful Hermes UI and design-system revisions.

Rules
- Append new entries at the top, newest first.
- Log only meaningful user-facing design or layout changes, not every tiny text tweak.
- Prefer commit hashes in `Rollback target:` when a commit exists.
- If no commit exists yet, name the previous version or say `working tree before this change`.
- Keep entries concise but concrete enough that an agent can restore or reconstruct the prior design state.

## Current Versions

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
