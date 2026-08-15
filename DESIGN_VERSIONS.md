# Hermes Design Versions

### Version: DV-2026-08-14-23
Date: 2026-08-14
Surface: Injury-risk detail signal card on `/analysis/injury-risk`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/analysisInjuryPanelStrips.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the accidental nested glass strip behind the injury-risk score header and the three signal cells, leaving both content layers transparent on the parent risk card.
Why: The global card sweep and light-theme signal treatment made semantic content wrappers look like extra panels, creating unnecessary bands in the risk summary.
Preserve list: Risk score and status, signal values, outer card surface, spacing, responsive stacking, localization, themes, and keyboard behavior.
Rollback target: `DV-2026-08-14-22`
Notes: Presentation-only correction; no injury-risk calculations, navigation, or API behavior changed.

### Version: DV-2026-08-14-19
Date: 2026-08-14
Surface: Run activity contribution graph on `/settings`
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/components/SettingsAtlasLayout.jsx`, `frontend/src/components/RunActivityContributionGraph.jsx`, `frontend/src/utils/runActivityContribution.js`, `frontend/src/styles/_split/settings.css`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/utils/runActivityContribution.test.js`, `frontend/src/pages/settingsRunActivityGraph.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a Profile-aligned, 53-week contribution graph directly below the Settings profile hero. It groups real completed run activities by local day, shows month and weekday context, has intensity levels and a legend, and remains horizontally scrollable on narrow screens.
Why: Settings showed profile readiness but no compact evidence of the runner's actual training history.
Preserve list: Settings loading and error recovery, profile completion, identity and preference controls, connected-service actions, activity ownership, localization, themes, responsive layout, and keyboard interaction.
Rollback target: `DV-2026-08-14-18`
Notes: Activity retrieval is optional; an unavailable feed leaves the rest of Settings functional and renders an explicit graph status.

### Version: DV-2026-08-14-18
Date: 2026-08-14
Surface: Recent-run metric tiles on `/runs`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/pages/runsCardResponsiveGrid.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Made run-card buttons and their three-metric rows shrink safely, removed value-edge cropping, and added a component-width fit rule that reduces padding and type before wrapping localized values.
Why: Fixed tile padding and a non-wrapping value were being clipped by `overflow: hidden` when the run card's text column became narrow.
Preserve list: Three-metric order, run navigation, route preview, localized distance/pace/time formatting, desktop card grid, mobile row, themes, and keyboard behavior.
Rollback target: `DV-2026-08-14-17`
Notes: Presentation-only responsive correction; no run data or formatting logic changed.

### Version: DV-2026-08-14-17
Date: 2026-08-14
Surface: Map-backed activity header on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/run-detail-profile-minimal.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the overview metric rail and removed the entire activity-header block from map-backed activity pages, including its title, metadata, and actions.
Why: The requested removal includes both the oversized title grid and the elements it contains; the distance, pace, and duration evidence rail remains.
Preserve list: Route map, overview metrics, no-route activity header and actions, responsiveness, localization, keyboard focus, and map lifecycle behavior.
Rollback target: `DV-2026-08-14-16`
Notes: Presentation-only header correction; no activity, metric, or route data changed.

### Version: DV-2026-08-14-16
Date: 2026-08-14
Surface: Personal-record celebration modal on `/profile`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/profilePrModalProfileRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the personal-record celebration as a Profile-aligned paper sheet with a contained header, modest warm record summary, divided record ledger, and charcoal dashboard action.
Why: Its oversized celebration card obscured the record details and did not match the Profile page's light, decision-first surface system.
Preserve list: Breakthrough detection, record values, run and date metadata, close behavior, CTA, scrolling, localization, themes, keyboard focus, and responsive layout.
Rollback target: `DV-2026-08-14-15`
Notes: Presentation-only modal redesign; no record calculations or persistence changed.

### Version: DV-2026-08-14-15
Date: 2026-08-14
Surface: Import settings navigation on `/settings/import-data` and `/settings/garmin-import`
Files: `frontend/src/components/AuthenticatedPageChrome.jsx`, `frontend/src/components/authenticatedPageChromeProfileShell.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the legacy authenticated horizontal navigation and floating language switcher with the Profile runner shell: shared left rail, contextual Settings top bar, notification/settings/profile actions, sidebar collapse, and Today Run action.
Why: The two import destinations still used a separate navigation system, leaving an extra top bar and language control instead of the unified Profile navigation used across authenticated runner surfaces.
Preserve list: Garmin and manual import forms, profile lookup, route transitions, import API actions, localization through Settings, responsive navigation, keyboard focus, notifications, and the profile/account routes.
Rollback target: `DV-2026-08-14-14`
Notes: Shared shell migration only; import data, credentials, and navigation targets are unchanged.

### Version: DV-2026-08-14-14
Date: 2026-08-14
Surface: Leaflet map tiles across runner map surfaces
Files: `frontend/src/index.css`, `frontend/src/pages/leafletTileSeams.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Normalized Leaflet tile compositing and overlapped the default 256px tile grid by one pixel.
Why: Fractional tile placement exposed bright seams between adjacent map tiles in the running-home map view.
Preserve list: Map imagery, route overlays, controls, attribution, panning, zooming, themes, responsive layout, and map-specific tile sources.
Rollback target: `DV-2026-08-14-13`
Notes: Rendering-only correction; no location, route, or map-provider behavior changed.

### Version: DV-2026-08-14-13
Date: 2026-08-14
Surface: Active intensity navigation label on `/analysis/intensity`
Files: `frontend/src/styles/analysis-intensity-profile-alignment.css`, `frontend/src/pages/analysisIntensityProfileParity.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the active navigation item's pill fill, border, and shadow while preserving the “强度分布” label, active color, and coral side marker.
Why: The shared runner navigation cascade added a button-like surface behind the active label, obscuring the text-first sidebar treatment.
Preserve list: Intensity navigation, active route state, marker, label spacing, keyboard focus, localization, responsive collapse, themes, and analysis content.
Rollback target: `DV-2026-08-14-12`
Notes: Presentation-only navigation cleanup; no route or analysis behavior changed.

### Version: DV-2026-08-14-12
Date: 2026-08-14
Surface: Strava OAuth calls to action on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandHeroBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the landing page's handcrafted STRAVA text badge and replaced both OAuth calls to action with Strava's unmodified official Connect with Strava SVG.
Why: The earlier branding correction targeted Login and Signup, while the reported control was a separate landing-page component with its own fake logo implementation.
Preserve list: Strava OAuth routing, localized accessible labels, hero and final CTA placement, responsive layout, keyboard focus, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-14-11`
Notes: Root-cause correction for the landing route; authentication behavior is unchanged.

### Version: DV-2026-08-14-11
Date: 2026-08-14
Surface: Strava OAuth controls on `/login` and `/signup`
Files: `frontend/src/assets/btn_strava_connect_with_orange.svg`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`, `frontend/src/styles/auth-liquid-glass.css`, `frontend/src/styles/dark-mode-cohesion.css`, `frontend/src/pages/authLiquidGlass.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the improvised plus sign and text treatment with Strava's unmodified official Connect with Strava SVG on both authentication routes.
Why: The previous treatment resembled a custom Strava badge instead of the real provider artwork and did not follow Strava's OAuth branding guidance.
Preserve list: Existing OAuth click handlers, provider availability states, localized accessible labels, keyboard focus, responsive layout, light and midnight themes, and email authentication.
Rollback target: `DV-2026-08-14-10`
Notes: Branding-only correction; authentication routing and provider configuration behavior are unchanged.

### Version: DV-2026-08-14-10
Date: 2026-08-14
Surface: Race-destination map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingAirlineAnimation.smoke.test.js`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the all-destination connector with one active pin-to-pin leg at a time. Every three seconds the map advances to the next destination, remounting the aircraft on that exact segment.
Why: Showing the entire loop at once obscured the requested stop-by-stop reading order and made it difficult to see which destination was currently connected.
Preserve list: Calibrated city anchors, closed-loop itinerary order, race captions and countdowns, world-map reference, localization, responsive map framing, aircraft motion, and reduced-motion handling.
Rollback target: `DV-2026-08-14-09`
Notes: Presentation and map-sequencing correction only; race data, countdown logic, and landing navigation are unchanged.

### Version: DV-2026-08-14-09
Date: 2026-08-14
Surface: Landing final trust row on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the inherited rounded backgrounds and inset shadows from the three final trust labels while preserving the centered row and hairline dividers.
Why: The final CTA's trust labels still inherited card chrome from the earlier trust-chip rule, creating an unwanted background strip beneath the actions.
Preserve list: Landing copy, CTA actions, route navigation, centered layout, dividers, responsive wrapping, localization, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-14-08`
Notes: Presentation-only cleanup; no CTA behavior or copy changed.

### Version: DV-2026-08-14-08
Date: 2026-08-14
Surface: Race table order column on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a 12px leading inset to the race table's front order numbers without changing the table grid columns or row content alignment.
Why: The order numbers were flush against the left edge of the rounded race panel and appeared visually clipped.
Preserve list: Race data, map animation, row timing, column positions, mobile layout, localization, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-14-07`
Notes: Presentation-only spacing correction; no race data or navigation behavior changed.

### Version: DV-2026-08-14-07
Date: 2026-08-14
Surface: Race-destination map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingAirlineAnimation.smoke.test.js`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the normalized dashed flight overlay with one continuous curved connector through the calibrated race-destination pins; the aircraft remains the only moving route accent.
Why: The dotted base path and second animated dash made valid destination connections look severed or detached from their markers.
Preserve list: Calibrated city anchors, race order and caption cycle, aircraft motion, static world-map reference, localization, responsive map framing, reduced-motion handling, and landing navigation.
Rollback target: `DV-2026-08-14-06`
Notes: Presentation-only map-route correction; race data, countdown logic, and route behavior are unchanged.

### Version: DV-2026-08-14-06
Date: 2026-08-14
Surface: Running-shoe brand logos on `/shoes/add` and `/shoe-catalog`
Files: `frontend/src/utils/shoeBrandLogo.js`, `frontend/src/utils/shoeBrandLogo.test.js`, `frontend/src/assets/brand-logos/volanti.svg`, `frontend/src/assets/brand-logos/dayan.svg`, `frontend/src/pages/ShoeCatalog.jsx`, `frontend/src/pages/shoeCatalogSearchSelection.smoke.test.js`, `frontend/src/components/shoeBrandLogoFallback.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Corrected the live catalog aliases for 沃兰迪 and 大鲶, replaced their generic dot fallbacks with dedicated brand marks based on official brand references, and moved Shoe Catalog onto the same shared logo resolver as Add Shoes.
Why: The catalog spellings did not match the existing alias table, so both brands fell back to emoji dots; Shoe Catalog also retained a second synthetic badge implementation that could disagree with Add Shoes.
Preserve list: Brand and model selection, model counts, search, filters, catalog API merging, localization, responsive layout, keyboard behavior, loading states, and shoe creation flow.
Rollback target: `DV-2026-08-14-05`
Notes: Browser research used Volanti's official site and official 大鲶 product photography; no shoe catalog data or API contract changed.

### Version: DV-2026-08-14-05
Date: 2026-08-14
Surface: Forecast pipeline header on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherForecastHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the unintended nested liquid-glass strips behind the forecast pipeline kicker and weather title while retaining the outer forecast panel and hourly-card surfaces.
Why: The shared surface sweep interpreted `weather-engine-panel-head` and `weather-engine-card-kicker` as standalone cards because their semantic class names contain `-panel` and `-card`.
Preserve list: Forecast data, hourly cards, outer panel frame, title copy, localization, themes, responsive scrolling, loading and empty states, and weather API behavior.
Rollback target: `DV-2026-08-14-04`
Notes: Presentation-only cascade correction; no forecast calculations, requests, or interactions changed.

### Version: DV-2026-08-14-04
Date: 2026-08-14
Surface: Add Shoes intake grid on `/shoes/add`
Files: `frontend/src/styles/add-shoes-profile-alignment.css`, `frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Capped the Add Shoes canvas at 1500px and centered it with automatic side margins, while retaining the existing desktop, tablet, and mobile grid breakpoints.
Why: The route-local Profile override expanded the intake grid to the full available width, making the page feel left-weighted and disconnected from the centered Profile layout.
Preserve list: Upload flow, brand and model selection, search and filters, form submission, localization, themes, responsive behavior, focus states, and reduced-motion handling.
Rollback target: `DV-2026-08-14-03`
Notes: Presentation-only alignment correction; no shoe data, selection state, or API behavior changed.

### Version: DV-2026-08-14-03
Date: 2026-08-14
Surface: Shoe performance correlation grid on `/shoes`
Files: `frontend/src/styles/_split/shoes.css`, `frontend/src/pages/shoesGridVisibility.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Compacted the evidence-light recommendation grid by keeping its three summary metrics on one desktop row and reducing the sidecar card, detail-row, and gap heights.
Why: The sidecar wrapped three metrics across two rows and imposed large minimum heights, stretching the paired shoe recommendation card into a mostly empty oversized panel.
Preserve list: Recommendation content, evidence status, tagged-run metrics, shoe health, source disclosure, collapse control, localization, themes, and single-column mobile layout.
Rollback target: `DV-2026-08-14-01`
Notes: Presentation-only density correction; no shoe, run, retirement, or recommendation calculations changed.

### Version: DV-2026-08-14-01
Date: 2026-08-14
Surface: Hourly forecast grid on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherForecastHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the forecast panel's light-theme rounded profile surface, solid white background, border, and shadow so the second weather grid visually belongs to the live-conditions grid above it.
Why: A shared liquid-glass cleanup made the forecast panel transparent, leaving the hourly grid without the framed background used by the first weather grid.
Preserve list: Hourly forecast data, card spacing, scrolling, current-slot emphasis, dark themes, localization, responsive layout, loading and empty states, and existing weather API behavior.
Rollback target: `DV-2026-08-13-30`
Notes: Presentation-only restoration; no forecast calculations or data contracts changed.

### Version: DV-2026-08-13-30
Date: 2026-08-13
Surface: Recovery signals on `/schedule`
Files: `backend/src/main/java/com/hermes/backend/ReadinessService.java`, `backend/src/main/java/com/hermes/backend/AutomatedCoachService.java`, `frontend/src/pages/Schedule.jsx`, `frontend/src/utils/scheduleRecoverySignals.js`, `frontend/src/styles/_split/schedule.css`, `frontend/src/styles/_split/light-theme-overrides.css`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `DESIGN_VERSIONS.md`
What changed: Replaced synthetic fatigue percentages and the default 72% sleep bar with evidence-gated signals. Fatigue is explicitly marked as an estimate from recent recovery or current wellness evidence, while sleep requires an exact-date record and displays its actual score.
Why: Cached or absent wellness data previously looked measured, which could mislead a runner making a training decision.
Preserve list: Schedule loading, workouts, coach guidance, routes, shoes, navigation, authentication, localization, themes, responsive behavior, reduced motion, and existing wellness imports.
Rollback target: `DV-2026-08-13-29`
Notes: Missing or incomplete evidence now renders `No supporting data` / `暂无数据支持` with an unfilled patterned track; cached sleep remains available to legacy coaching calculations but is not presented as current-date evidence.

### Version: DV-2026-08-13-29
Date: 2026-08-13
Surface: Training-load decision card on `/analysis/load-balance`
Files: `frontend/src/styles/analysis-load-balance-profile-alignment.css`, `frontend/src/pages/analysisSubpageNav.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the coach decision card to the warm-white Profile surface with charcoal hierarchy, a quiet divider, and no decorative rings in the default theme; preserved the dark treatment only for midnight and high-contrast-dark themes.
Why: The route-specific decision selector still forced a dark command-center card after the shared light-theme rules, so the actual load-balance recommendation remained visually inconsistent and low-contrast in normal white mode.
Preserve list: ACWR and load calculations, coach recommendation, training-window content, Today Run navigation, coach identity, responsive layout, localization, keyboard focus, reduced motion, themes, and API contracts.
Rollback target: `DV-2026-08-13-28`
Notes: Presentation-only correction; the live static bundle was rebuilt and the route was verified with the white decision surface and no browser errors.

### Version: DV-2026-08-13-28
Date: 2026-08-13
Surface: GPS loading indicator on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/_split/heatmap.css`, `frontend/src/pages/heatmapStability.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the character-jump loading copy with a compact GPS-acquisition badge using static high-contrast text, a pulsing lock ring, and sequential signal bars.
Why: Animating every character made the loading message noisy and difficult to read, especially inside the small Heatmap legend panel.
Preserve list: GPS loading state, accessible status label, progressive heatmap loading, diagnostics, localization, responsive legend layout, and reduced-motion behavior.
Rollback target: `DV-2026-08-13-27`
Notes: Presentation-only loading-state redesign; no GPS fetching, caching, rendering, or API behavior changed.

### Version: DV-2026-08-13-27
Date: 2026-08-13
Surface: Map controls on `/heatmap`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/heatmapMobileOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced Heatmap's washed-out liquid-glass controls with opaque obsidian instruments, bordered utility buttons, a coral active state, and a high-contrast keyboard focus outline.
Why: The shared liquid-glass layer placed low-contrast pale controls directly on the dark interactive map, making navigation and zoom actions difficult to recognize.
Preserve list: Heatmap data, map movement, recenter and zoom actions, quick-link navigation, legend data, loading and empty states, localization, responsive utility rail, reduced-motion behavior, and keyboard access.
Rollback target: `DV-2026-08-13-26`
Notes: Presentation-only contrast redesign; no map rendering, GPS, API, or route behavior changed.

### Version: DV-2026-08-13-26
Date: 2026-08-13
Surface: Route recommendation card on `/schedule`
Files: `backend/src/main/java/com/hermes/backend/CoachRouteRecommendationDto.java`, `backend/src/main/java/com/hermes/backend/CoachRouteService.java`, `backend/src/main/java/com/hermes/backend/CoachRouteWaypointDto.java`, `frontend/src/pages/Schedule.jsx`, `frontend/src/pages/scheduleRoutePlanner.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: The coach-route response now includes a compact GPS trace, allowing the card's existing Leaflet/OpenStreetMap layer to become the background instead of showing a disconnected vector sketch.
Why: The history recommendation retained precise activity coordinates server-side but delivered only a normalized preview, so the Schedule card could not activate its real map background.
Preserve list: Route selection, distance and confidence labels, generated-route behavior, history sketch fallback for missing GPS data, localization, accessibility, responsive layout, and all existing map controls.
Rollback target: `DV-2026-08-13-25`
Notes: The GPS trace is sampled to the established preview-point limit; no route-selection or workout-planning logic changed.

### Version: DV-2026-08-13-25
Date: 2026-08-13
Surface: Intensity insight coach judgment card on `/analysis/intensity`
Files: `frontend/src/styles/analysis-intensity-profile-alignment.css`, `frontend/src/pages/analysisIntensityProfileParity.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the judgment card's dark gradient with the white Profile surface, ink coach copy, muted identity text, and the existing coral Today Run action.
Why: The intensity alignment stylesheet reintroduced a dark card after the shared light-theme rules, leaving the coach recommendation grid inconsistent with the surrounding Profile design.
Preserve list: Intensity distribution data, coach recommendation copy, coach identity, Today Run navigation, recovery companion, responsive layout, localization, keyboard focus, and API contracts.
Rollback target: `DV-2026-08-13-24`
Notes: Presentation-only card correction; no intensity calculations or recommendation logic changed.

### Version: DV-2026-08-13-24
Date: 2026-08-13
Surface: Coach insight hero on `/analysis/coach-insight`
Files: `frontend/src/styles/_split/analysis.css`, `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the coach-insight hero's dark command-center treatment with the white Profile surface, readable ink typography, quiet pills, a light readiness card, and a clean readiness dial.
Why: The current coach-insight hero used a separate dark base selector that bypassed the existing Profile-aligned light rules, leaving the headline and readiness panel low-contrast in the user's view.
Preserve list: Readiness score and dial, coach identity, insight copy, navigation, metric values, responsive layout, localization, keyboard focus, reduced motion, and API contracts.
Rollback target: `DV-2026-08-13-23`
Notes: Presentation-only hero correction; no coach-system calculations or recommendation content changed.

### Version: DV-2026-08-13-23
Date: 2026-08-13
Surface: Prediction training advice rail on `/prediction/5k`, `/prediction/10k`, `/prediction/half`, and `/prediction/marathon`
Files: `frontend/src/styles/prediction-profile-alignment.css`, `frontend/src/pages/predictionProfileAlignment.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the advice rail's dark base treatment with the white Profile surface, ink typography, coral kicker, and quiet light advice rows so the grid remains readable in the current render path.
Why: The rail continued to render as a dark card in the user's view despite the theme-scoped light override, making the advice title low-contrast and visually inconsistent with the surrounding Profile surfaces.
Preserve list: Training recommendation content, distance-specific guidance, prediction calculations, weather adjustment, spacing, responsive layout, localization, keyboard focus, and API contracts.
Rollback target: `DV-2026-08-13-22`
Notes: Presentation-only surface correction; the rail no longer depends on theme timing to receive its readable white treatment.

### Version: DV-2026-08-13-22
Date: 2026-08-13
Surface: Training advice rail on `/prediction/5k`, `/prediction/10k`, `/prediction/half`, and `/prediction/marathon`
Files: `frontend/src/styles/prediction-profile-alignment.css`, `frontend/src/pages/predictionProfileAlignment.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the training advice rail to the light Profile surface with ink typography, coral emphasis, and subtle light advice rows in white and high-contrast-light themes.
Why: The same unscoped Prediction stylesheet forced this secondary grid into a dark gradient in normal white mode.
Preserve list: Midnight and high-contrast-dark appearance, coach guidance, forecast calculations, weather adjustment, localization, responsive layout, keyboard focus, and API contracts.
Rollback target: `DV-2026-08-13-21`
Notes: Theme-cascade correction only; no prediction inputs, calculations, or page interactions changed.

### Version: DV-2026-08-13-21
Date: 2026-08-13
Surface: Race forecast hero on `/prediction/5k`, `/prediction/10k`, `/prediction/half`, and `/prediction/marathon`
Files: `frontend/src/styles/prediction-profile-alignment.css`, `frontend/src/pages/predictionProfileAlignment.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the forecast hero to a light Profile surface in white and high-contrast-light themes, with ink typography, a white confidence card, and restrained coral emphasis. Removed the dark decorative backdrop from those themes.
Why: A late unscoped Prediction stylesheet overrode the existing light-theme rules and forced a dark hero grid with low-contrast text in normal white mode.
Preserve list: Midnight and high-contrast-dark appearance, forecasts, weather adjustment, confidence scoring, effort pacing, coach guidance, actions, responsive layout, keyboard focus, localization, and API contracts.
Rollback target: `DV-2026-08-13-20`
Notes: Theme-cascade correction only; no prediction inputs, calculations, or page interactions changed.

### Version: DV-2026-08-13-20
Date: 2026-08-13
Surface: Injury-prevention grid on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/analysisInjuryPreventionStatus.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Made the Risk Score and ACWR cards open their existing detail pages and exposed the daily soreness choices as pressed-state controls.
Why: The grid looked interactive but only the soreness choices responded; its two analysis cards were inert and the selected check-in state was visual-only.
Preserve list: Injury-risk loading and error states, soreness persistence, risk calculations, coach advice, localization, themes, responsive layout, sidebar navigation, and API contracts.
Rollback target: `DV-2026-08-13-19`
Notes: Interaction and accessibility correction only; no injury-risk calculations or API payloads changed.

### Version: DV-2026-08-13-19
Date: 2026-08-13
Surface: Training load balance on `/analysis/load-balance`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/analysis-load-balance-profile-alignment.css`, `frontend/src/index.css`, `frontend/src/pages/analysisSubpageNav.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt Load Balance around Profile's decision-first hierarchy with a compact ACWR status header, a dominant coach recommendation and training window, an asymmetric chart-and-ratio evidence workbench, compact load metrics, a recent-training ledger, and quieter methodology support.
Why: The previous oversized title panel and equal-weight card wall buried the runner's training decision beneath analytical explanation.
Preserve list: ACWR and load calculations, interactive chart scrubber, coaching and training-window content, Today Run and run-detail navigation, recent runs, Analysis Lab sidebar, authentication, localization, units, themes, responsive collapse, focus behavior, reduced motion, and API contracts.
Rollback target: `DV-2026-08-13-18`
Notes: Presentation and information-hierarchy redesign only; no API, data model, calculation, persistence, route, or user-facing copy changed.

### Version: DV-2026-08-13-18
Date: 2026-08-13
Surface: Weather-adjusted forecasts on `/prediction/5k`, `/prediction/10k`, `/prediction/half`, and `/prediction/marathon`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/utils/vdot.js`, `frontend/src/styles/prediction-profile-alignment.css`, `frontend/src/utils/vdotPredictionOrdering.smoke.test.js`, `frontend/src/pages/predictionProfileAlignment.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Promoted weather-corrected VDOT and corrected recent-run anchors into the primary race forecast and effort pacing when meaningful weather evidence exists. Added a compact raw-versus-adjusted impact panel with recovered time, corrected-window count, average recovery, and peak recovery; duplicate adjusted trend lines are hidden when no correction exists.
Why: Prediction pages exposed a weather-adjusted legend but still based the headline time and pace guidance on raw weather-suppressed performance, so the correction did not help the runner make a decision.
Preserve list: Raw forecast as a visible baseline, race-distance calibration, confidence scoring, trend history, effort ladder, coach guidance, activity loading, routing, localization, themes, responsive layout, focus behavior, and API contracts.
Rollback target: `DV-2026-08-13-17`
Notes: The existing activity feed already supplies weather-adjusted moving time and pace penalty, so this is a frontend model and presentation change with no backend contract migration.

### Version: DV-2026-08-13-17
Date: 2026-08-13
Surface: Runs ledger scale on `/runs`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/pages/runsPageScaleParity.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the Runs ledger to the shared Profile-aligned canvas width, headline scale, control spacing, signal cards, insight cards, and full-size run rows instead of the compact scan-first sizing.
Why: `/runs` rendered visibly zoomed out compared with the other authenticated runner pages because a late compact composition reduced both typography and vertical rhythm.
Preserve list: Run data loading, search and filters, month folding, route previews, open/delete actions, Strava sync/import actions, sidebar/topbar navigation, localization, themes, responsive collapse, keyboard focus, and API contracts.
Rollback target: `DV-2026-08-13-16`
Notes: Presentation-only scale correction; no data, routing, interaction, or API behavior changed.

### Version: DV-2026-08-13-16
Date: 2026-08-13
Surface: Analysis drill-down rail on `/analysis/:insightKey` and `/prediction/:distKey`
Files: `frontend/src/components/AnalysisSubpageNav.jsx`, `frontend/src/index.css`, `frontend/src/pages/analysisSubpageNav.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the dedicated Analysis Lab rail on all eight drill-down pages with the exact shared Profile sidebar structure, numbered active treatment, collapse control, and workout CTA styling while retaining the Analysis overview, four insight links, and four prediction links.
Why: The specialized sidebar needed the same visual language as Profile without losing its drill-down navigation.
Preserve list: Analysis overview, all eight analysis and prediction routes, collapse behavior, Today Run action, localization, themes, responsive behavior, keyboard access, and detail-page data and calculations.
Rollback target: `DV-2026-08-13-15`
Notes: Navigation presentation and information architecture only; no analysis or prediction data, API, persistence, or route contracts changed.

### Version: DV-2026-08-13-01
Date: 2026-08-13
Surface: Add Shoe intake workflow on `/shoes/add`
Files: `frontend/src/pages/AddShoes.jsx`, `frontend/src/styles/add-shoes-profile-alignment.css`, `frontend/src/index.css`, `frontend/src/pages/addShoesAwesomeDesignRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recast the Add Shoe route onto the current Profile dossier system with a compact warm hero, asymmetric signal rail, 16-column intake workbench, dark brand and selected-shoe decision cards, warm model/form surfaces, and responsive single-column collapse.
Why: The route still read as an oversized standalone shoe campaign instead of a focused extension of the runner Profile workspace.
Preserve list: Catalog loading and local fallback, brand/category/type filters, model search and selection, nickname and distance fields, primary-shoe selection, save/cancel behavior, API contracts, localization, authentication, sidebar/topbar navigation, theme switching, focus visibility, reduced-motion behavior, and mobile scrolling.
Rollback target: `DV-2026-08-08-34`
Notes: Presentation-only redesign; no shoe data, validation, persistence, routing, or user-visible copy changed.

Use this file to keep a durable history of meaningful Hermes UI and design-system revisions.

Rules
- Append new entries at the top, newest first.
- Log only meaningful user-facing design or layout changes, not every tiny text tweak.
- Prefer commit hashes in `Rollback target:` when a commit exists.
- If no commit exists yet, name the previous version or say `working tree before this change`.
- Keep entries concise but concrete enough that an agent can restore or reconstruct the prior design state.

## Current Versions

### Version: DV-2026-08-13-16
Date: 2026-08-13
Surface: Weather hourly forecast surface on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherForecastHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the warm outer color strip, backdrop, and shadow from the Weather forecast panel and hourly row while preserving the individual forecast card surfaces.
Why: The outer band visually grouped the forecast into a separate colored block and competed with the hourly cards and heading.
Preserve list: Forecast data, hourly card styling, current-slot emphasis, Weather navigation, localization, themes, responsive scrolling, and loading/empty states.
Rollback target: `DV-2026-08-13-15`
Notes: Presentation-only cleanup; no data, interaction, routing, or API behavior changed.

### Version: DV-2026-08-13-15
Date: 2026-08-13
Surface: VO2max trend hero on `/analysis`
Files: `frontend/src/styles/_split/analysis.css`, `frontend/src/pages/analysisVdotTrendAccent.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the concentric-circle pseudo-element from the VO2max trend hero so the Profile-aligned chart surface stays flat, quiet, and focused on the metric and bars.
Why: The decorative ring pattern competed with the chart and overlapped the decision chips, making the otherwise minimal analysis surface feel visually noisy.
Preserve list: VO2max calculations, chart bars and tooltips, weather-adjusted values, forecast chips, responsive layout, navigation, localization, theme behavior, and focus states.
Rollback target: `DV-2026-08-13-14`
Notes: Presentation-only cleanup; no data, interaction, routing, or API behavior changed.

### Version: DV-2026-08-13-14
Date: 2026-08-13
Surface: Shared runner-shell workout CTA across authenticated pages
Files: `frontend/src/index.css`, `frontend/src/styles/runner-shell-workout-button.css`, `frontend/src/pages/WeatherEngine.jsx`, `frontend/src/components/runnerShellWorkoutButtonParity.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Standardized the sidebar workout CTA to the Image 1 coral gradient pill with white arrow and label across all runner-shell pages. Preserved the compact arrow-only geometry when the sidebar is collapsed and removed Weather's page-specific plus glyph.
Why: Page-specific theme layers caused the same action to render with dark text, alternate gradients, or a plus icon, making navigation inconsistent across surfaces.
Preserve list: `/today-run` navigation, localized labels, sidebar collapse behavior, themes, keyboard focus, reduced motion, and every page's existing action handler.
Rollback target: `DV-2026-08-13-13`
Notes: Source parity guard enumerates 13 runner pages. Targeted smoke tests, scoped ESLint, served-bundle inspection, and focused runtime sync pass. A fresh full build is currently blocked by a separate existing `index.css` import for missing `styles/add-shoes-profile-alignment.css`.

### Version: DV-2026-08-13-13
Date: 2026-08-13
Surface: Complete midnight theme across public, runner, detail, settings, map, loading, and admin routes
Files: `frontend/src/styles/dark-mode-cohesion.css`, `frontend/src/components/AppIcon.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/index.css`, `frontend/src/pages/darkModeCohesion.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Extended the Profile-derived warm charcoal midnight system across every routed surface, including public/auth/legal pages, runner and analysis detail pages, loading states, Run and Race maps, settings imports, and all seven admin dashboard tabs. Replaced dashboard and Profile remote symbol-font icons with local SVGs, darkened custom Leaflet panes, removed late white glass sheens, and compressed the admin mobile rail into a usable horizontal navigation row.
Why: Multiple late redesign layers still reapplied white cards, translucent gray panels, light map tiles, and unavailable Material Symbols after the older dark rules, leaving midnight mode visually fragmented and some mobile routes dominated by navigation chrome.
Preserve list: Routing, authentication and role gates, runner/admin data and actions, maps and charts, imports and integrations, calculations, localization, responsive layout behavior, keyboard focus, reduced motion, loading/empty/error states, and API contracts.
Rollback target: `DV-2026-08-13-12`
Notes: Live system-Chrome verification in midnight mode passes 76/76 route-and-viewport cases across desktop 1440x1000 and mobile 390x844. The matrix checks HTTP state, applied theme, document shell color, bright solid/gradient leaks, horizontal overflow, broken icon ligatures, page errors, and application error UI; admin API data was non-destructively mocked only to render the role-protected dashboard tabs. Custom admin and race map tile filters were also inspected from computed browser state. Customer playtest review confirms clear primary actions for casual runners, preserved charts/maps/evidence for experienced runners, compact navigation, and coherent loading, empty, focus, and contrast states.

### Version: DV-2026-08-13-12
Date: 2026-08-13
Surface: Street-map background on `/run/:runId`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/run-detail-profile-minimal.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `docs/superpowers/specs/2026-08-13-run-detail-map-background-design.md`, `docs/superpowers/plans/2026-08-13-run-detail-map-background.md`, `DESIGN_VERSIONS.md`
What changed: Promoted the single interactive Leaflet route map from a contained hero card to a viewport-fixed background owned by the authenticated main column, with Profile-derived activity and evidence surfaces layered above it. The map inherits the main column's computed rail offset in expanded and collapsed states, keeps controls below the sticky topbar, and returns to a contained panel below the activity header at the shared mobile breakpoint.
Why: The contained map underused the route as the primary visual and did not deliver the requested street-map workspace, while a viewport-wide background would have leaked beneath the Runs navigation rail.
Preserve list: Runs navigation and collapse behavior, Leaflet tiles, route fitting, zoom and drag interaction, attribution, no-route fallback, activity data, share and Strava resync, coach and telemetry evidence, gear linking, splits, themes, localization, keyboard focus, reduced motion, loading/empty states, and API contracts.
Rollback target: `DV-2026-08-13-11`
Notes: Browser QA at 1600x1000 proves zero-pixel map/rail boundary deltas in expanded and collapsed states, working map drag, and no horizontal overflow. Mobile QA at 390x844 proves one contained map after the activity header; dark and no-route states were also verified. A follow-up correction adds explicit `has-run-detail-map` shell state and raises the map above shared page-atmosphere layers while keeping the content canvas transparent, avoiding reliance on `:has(...)` for the critical stacking contract. The desktop overview grid is now pulled into the top visual frame beneath the activity header. Targeted smoke tests, Vite build, served-asset inspection, and runtime sync pass.

### Version: DV-2026-08-13-11
Date: 2026-08-13
Surface: Authenticated midnight theme across Profile-style runner and settings routes
Files: `frontend/src/styles/dark-mode-cohesion.css`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/index.css`, `frontend/src/pages/darkModeCohesion.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a final Profile-aligned dark-theme contract that remaps light-only runner tokens to warm charcoal surfaces, repairs hard-coded light islands across Runs, Run Detail, Analysis, Weather, Shoes, Races, Garmin Import, and Import Data, darkens shared controls and the legacy settings top bar, and replaces Profile metric and empty-state symbol-font icons with local SVG icons.
Why: Late minimalist and glass layers reapplied white surfaces after the existing dark rules, producing mixed light/dark pages, low-contrast copy, and raw icon ligatures when the remote symbol font failed.
Preserve list: Route layout and navigation, authentication, Profile metrics, activity history and imports, analysis calculations, maps and charts, weather data, shoe and race actions, Garmin credentials and wellness sync, localization, responsive behavior, keyboard focus, reduced motion, and API contracts.
Rollback target: `DV-2026-08-13-10`
Notes: Theme-only cohesion pass. Browser verification covers 17 authenticated routes at desktop width and a focused mobile route set; no API, persistence, route, calculation, or user-visible copy changed.

### Version: DV-2026-08-13-10
Date: 2026-08-13
Surface: Collapsed runner rail and Analysis subnav toggle on Profile-style routes
Files: `frontend/src/styles/analysis-subnav.css`, `frontend/src/styles/_split/profile.css`, `frontend/src/pages/analysisSubpageNav.smoke.test.js`, `frontend/src/components/runnerShellSidebarRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Inset the Analysis collapse control into a fixed header column, centered it below the compact brand in collapsed state, and centered the collapsed footer workout arrow on the same horizontal rail axis.
Why: The Analysis toggle was crowded against the rail boundary, while the footer used main-axis centering on a column flex container and left its fixed-width arrow visibly offset to the left.
Preserve list: Sidebar collapse behavior, route navigation, active states, workout action, localization, themes, keyboard focus, responsive horizontal navigation, page data, and API contracts.
Rollback target: `DV-2026-08-13-09`
Notes: Layout-only correction. Targeted sidebar, Analysis subnav, and prediction alignment guards pass; the frontend build, runtime sync, and `/prediction/5k` HTTP proof pass.

### Version: DV-2026-08-13-09
Date: 2026-08-13
Surface: Connected services on `/settings`
Files: `frontend/src/styles/_split/settings.css`, `frontend/src/components/settingsAtlasConnectButton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Bounded and centered the desktop Strava and Garmin service-card grid to a maximum width of 960px, and applied compact action sizing to both Strava connection states.
Why: The two equal columns filled the full Settings canvas on wide displays, and the connected-state Manage action escaped the previous compact selector, compressing its provider copy into a one-character column.
Preserve list: Strava connect and disconnect behavior, Garmin import and manual-file actions, sync health, localization, themes, keyboard focus, and responsive single-column behavior.
Rollback target: `DV-2026-08-13-07`
Notes: Layout-only proportion adjustment; no integration, API, routing, or copy behavior changed.

### Version: DV-2026-08-13-08
Date: 2026-08-13
Surface: Profile-minimal Run Detail on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/run-detail-profile-minimal.css`, `frontend/src/index.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt Run Detail as a compact Profile-derived evidence page with a transparent shell canvas, restrained activity header, map-led overview, compact metric rail, structurally aligned Coach and Gear sections, quieter telemetry controls, and borderless tonal data panels. Removed the duplicate distance overlay from the map.
Why: The previous route layered an oversized editorial cockpit over older Run Detail rules, making its hierarchy and card treatment feel heavier and less coherent than Profile.
Preserve list: Runner shell, Runs navigation, map data, activity metrics, share and Strava resync, coach debrief, comparison, telemetry and chart interaction, training effect, device metrics, elevation recalibration, shoe assignment, splits, performance metrics, localization, themes, keyboard focus, loading/empty states, and responsive behavior.
Rollback target: `working tree before this change`
Notes: Presentation-only dual-mode redesign; no API, persistence, route, calculation, or user-visible copy contract changed. The design spec and implementation plan live under `docs/superpowers/`.

### Version: DV-2026-08-13-07
Date: 2026-08-13
Surface: Connected services on `/settings`
Files: `frontend/src/styles/_split/settings.css`, `frontend/src/components/settingsAtlasConnectButton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the shared horizontal provider-card layout by constraining the Strava connect action to its label width and allowing provider summaries to use the remaining grid column.
Why: A broad Settings action rule stretched the Strava control across the card, compressing its Chinese status copy into a one-character column and forcing both service cards to an excessive shared row height.
Preserve list: Strava connect and disconnect behavior, Garmin import and manual-file actions, sync health, localization, themes, keyboard focus, and responsive single-column behavior.
Rollback target: `DV-2026-08-13-06`
Notes: Layout-only correction; no integration, API, routing, or copy behavior changed.

### Version: DV-2026-08-13-06
Date: 2026-08-13
Surface: Analysis heat-adaptation panel on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/analysisHeatAdaptation.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the standalone heat-adaptation interpretation panel from Analysis, including its live weather-context request, decision card, metric grid, and exposure timeline.
Why: The panel duplicated the Weather surface and interrupted the Analysis page's run-performance flow.
Preserve list: Historical per-run weather corrections, the remaining Analysis calculations, navigation, authentication, localization, units, themes, responsive behavior, and API contracts used elsewhere.
Rollback target: `DV-2026-08-13-05`
Notes: Presentation and request-scope cleanup; Weather remains the home for live heat-adaptation context.

### Version: DV-2026-08-13-05
Date: 2026-08-13
Surface: Coach insight detail on `/analysis/coach-insight`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/_split/analysis.css`, `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`, `docs/superpowers/specs/2026-08-13-analysis-coach-insight-profile-redesign.md`, `docs/superpowers/plans/2026-08-13-analysis-coach-insight-profile-redesign.md`, `DESIGN_VERSIONS.md`
What changed: Reframed coach insight with the Profile dashboard's warm editorial hierarchy: a dark judgment and readiness hero, three compact evidence metrics, an asymmetric performance and blueprint workbench, and a quieter bottom evidence grid.
Why: The previous oversized glass command center obscured the current coaching judgment and made the route feel disconnected from Profile's clearer daily training hierarchy.
Preserve list: Coach model construction, readiness, forecast, workout and focus data, trend chart, recent-run navigation, blueprint sessions, Today Run action, phase and reason evidence, authentication, localization, units, themes, responsive behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-13-04`
Notes: Presentation-only Profile alignment; no API, calculation, persistence, route, action, or user-facing copy changed.

### Version: DV-2026-08-13-04
Date: 2026-08-13
Surface: Shoe scan preview on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/_split/shoes.css`, `frontend/src/pages/shoeScanModalLayout.smoke.test.js`, `docs/superpowers/specs/2026-08-13-shoe-scan-minimal-preview-design.md`, `docs/superpowers/plans/2026-08-13-shoe-scan-minimal-preview.md`, `DESIGN_VERSIONS.md`
What changed: Replaced the layered scan HUD with a flat Profile-aligned preview: one quiet metadata label, compact icon and heading, readable guidance, and a small rectangular upload action.
Why: The oversized repeated title, circular framing, corner brackets, scan line, status chip, and glossy surface competed for attention and made the upload step difficult to scan.
Preserve list: Preview image rendering, multi-file selection, scan API behavior, AI quota and processing states, recognition results, duplicate resolution, localization, themes, keyboard access, and responsive scrolling.
Rollback target: `DV-2026-08-13-03`
Notes: Presentation-only simplification; no scan request, API, persistence, route, or translation contract changed.

### Version: DV-2026-08-13-03
Date: 2026-08-13
Surface: Race prediction detail on `/prediction/:distKey`
Files: `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/styles/prediction-profile-alignment.css`, `frontend/src/index.css`, `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/predictionProfileAlignment.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the prediction route with the Profile dashboard's compact padded canvas, one dark forecast focal card, a four-metric evidence strip, a balanced effort-and-coach training grid, a quieter trend card, and a matching loading skeleton.
Why: The previous route rendered every section as a large dark cockpit card, obscuring scan order and making the forecast feel disconnected from the lighter, denser Profile dashboard.
Preserve list: Authentication, activity loading, VDOT and calibrated prediction calculations, confidence and effort models, coach guidance, chart data and tooltips, all four distance routes, Analysis Lab navigation, top-bar actions, localization, themes, responsive navigation, keyboard access, and reduced-motion behavior.
Rollback target: `working tree before this change`
Notes: Presentation-only Profile alignment; no API, calculation, persistence, route, interaction, or user-facing copy changed.

### Version: DV-2026-08-13-02
Date: 2026-08-13
Surface: Shoe scan import modal on `/shoes`
Files: `frontend/src/styles/_split/shoes.css`, `frontend/src/pages/shoeScanModalLayout.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Repaired the Profile-aligned scan sheet so its component-specific width and zero-padding reset outrank the shared compact modal rule, keeping both desktop columns inside the card while retaining the single-column tablet and phone layouts.
Why: The Shoes stylesheet loads before the shared modal stylesheet; equal-specificity selectors let the shared `500px` card width and `24px` padding win, while the scan grid still required at least `780px`, causing the right column to overflow and be clipped.
Preserve list: Shoe image selection, scan API behavior, AI quota states, recognition results, duplicate resolution, save and cancel actions, localization, theme switching, keyboard escape behavior, overlay dismissal, and responsive scrolling.
Rollback target: `DV-2026-08-13-01`
Notes: Cascade and containment fix only; no component markup, copy, route, API, or persistence contract changed.

### Version: DV-2026-08-13-01
Date: 2026-08-13
Surface: Intensity distribution detail on `/analysis/intensity`
Files: `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/styles/analysis-intensity-profile-alignment.css`, `frontend/src/index.css`, `frontend/src/pages/analysisIntensityProfileParity.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the intensity detail route with the Profile dashboard's compact editorial header, concise metric tiles, 20px tonal cards, three-zone scan row, dark coach decision card, and shorter recent-run summaries.
Why: The previous oversized command hero, heavy nested cards, and tall activity previews made the page slower to scan and visually disconnected from Profile.
Preserve list: Intensity calculations, percentages, compliance and status values, coach assignment and guidance, recent-run data, route navigation, authentication, localization, units, themes, responsive behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-09-04`
Notes: Presentation-only Profile alignment; no API, calculation, persistence, route, interaction, or user-facing copy changed.

### Version: DV-2026-08-09-04
Date: 2026-08-09
Surface: Rewards achievement ledger on `/rewards`
Files: `frontend/src/pages/Rewards.jsx`, `frontend/src/styles/rewards-profile-alignment.css`, `frontend/src/index.css`, `frontend/src/pages/rewardsMilestoneLedger.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recast Rewards onto the Profile dashboard's padded canvas and card hierarchy: a compact page introduction, paired light and dark milestone cards, independent translucent metric cards, quieter achievement rows, and a responsive catalog grid.
Why: The previous joined metric ribbon, separately inset sections, decorative card rails, and nested borders made Rewards feel denser and visually disconnected from Profile.
Preserve list: Reward calculation, earned and locked states, live progress values, next-milestone selection, navigation actions, API calls, authentication, localization, theme switching, responsive behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-09-03`
Notes: Presentation-only redesign; no reward data, route, API, persistence, authentication, or user-facing copy changed.

### Version: DV-2026-08-09-03
Date: 2026-08-09
Surface: Login focal hierarchy on `/login`
Files: `frontend/src/styles/auth-liquid-glass.css`, `frontend/src/pages/authLiquidGlass.smoke.test.js`, `TASKS.md`, `DESIGN_VERSIONS.md`
What changed: Lowered the desktop login credential block into the optical center and added a restrained coral heading rail with a soft local halo so the sign-in action becomes the first visual anchor.
Why: The form heading began above the stronger left-side editorial mass, making the page feel top-heavy and drawing the first glance away from the primary login action.
Preserve list: Login and OAuth behavior, provider availability messaging, the open card treatment, brand carousel, signup and admin layouts, mobile stacking, localization, themes, keyboard access, and reduced-motion behavior.
Rollback target: `DV-2026-08-09-02`
Notes: The offset is limited to desktop `/login` viewports at least 760px wide and 640px tall; signup and mobile retain their previous geometry.

### Version: DV-2026-08-09-02
Date: 2026-08-09
Surface: Run-detail navigation on `/run/:id`
Files: `frontend/src/components/RunsSubpageNav.jsx`, `frontend/src/styles/runs-subnav.css`, `frontend/src/index.css`, `frontend/src/pages/RunDetail.jsx`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/pages/runsSubpageNav.smoke.test.js`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the generic application rail on every run-detail route with a dedicated Run Log navigator that identifies the current activity, tracks six in-page detail sections, links to four recent runs, returns to the Runs overview, and becomes a horizontal section switcher on mobile.
Why: Individual run pages had a full product menu but no persistent orientation inside a long activity report and no quick path between neighboring run records.
Preserve list: Activity fetching and caching, route maps, analytics and telemetry, elevation recalibration, Strava sync, shoe assignment, sharing, global top navigation, route contracts, themes, responsive layout, keyboard access, localization, and reduced-motion behavior.
Rollback target: `DV-2026-08-09-01`
Notes: Navigation and information-architecture change only; no activity, analytics, telemetry, API, persistence, or sync contract changed.

### Version: DV-2026-08-09-01
Date: 2026-08-09
Surface: Profile-aligned left navigation on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/pages/shoesProfileSidebarParity.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Aligned the Shoes left navigation identity with Profile by using the same localized status subtitle while retaining the shared numbered route rail, Shoes active state, collapse control, and training CTA.
Why: Shoes still showed the older generic runner greeting, making its otherwise shared navigation look visually inconsistent with Profile.
Preserve list: Shoe inventory data and actions, filters and sorting, rotation insights, image import, authentication, routing, localization, responsive navigation, themes, keyboard access, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-43`
Notes: Navigation presentation only; no shoe, API, persistence, route, or authentication behavior changed.

### Version: DV-2026-08-08-43
Date: 2026-08-08
Surface: Heat-adaptation interpretation on `/analysis`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/styles/_split/analysis.css`, `frontend/src/i18n/locales/en/components.js`, `frontend/src/i18n/locales/zh-CN/components.js`, `frontend/src/pages/analysisHeatAdaptation.smoke.test.js`, `TASKS.md`, `DESIGN_VERSIONS.md`
What changed: Added a compact Analysis heat-context surface backed by the existing weather-context API, including the 14-day dew-point baseline, current dew point, shock delta, pace adjustment, adaptation day, penalty factor, a 14-day exposure track, and explicit historical-correction coverage.
Why: Weather-adjusted VDOT existed in the analysis data but runners could not see the environmental inputs behind it or distinguish historical per-run correction from today's heat guidance.
Preserve list: VDOT and per-run weather correction methodology, training zones, race predictions, load and injury calculations, Weather page engine logic, API contracts, auth, localization, themes, responsive layout, keyboard access, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-42`
Notes: Analysis consumes `/api/v1/weather/context` independently so weather failure cannot block core analytics. Today's pace adjustment is presented as guidance and is not fed into historical VDOT, zone, or prediction inputs.

### Version: DV-2026-08-08-42
Date: 2026-08-08
Surface: Analysis drill-down navigation on `/analysis/:insightKey` and `/prediction/:distKey`
Files: `frontend/src/components/AnalysisSubpageNav.jsx`, `frontend/src/styles/analysis-subnav.css`, `frontend/src/index.css`, `frontend/src/pages/AnalysisInsightDetail.jsx`, `frontend/src/pages/PredictionDetail.jsx`, `frontend/src/i18n/locales/en/components.js`, `frontend/src/i18n/locales/zh-CN/components.js`, `frontend/src/pages/analysisSubpageNav.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the generic application rail on all eight Analysis subpages with a dedicated Analysis Lab navigator that groups training signals and race forecasts, identifies the active module, links back to the Analysis overview, and becomes a horizontal module switcher on mobile.
Why: Analysis drill-down pages previously repeated the global product navigation, leaving no persistent way to understand the current module or move directly between related analyses and predictions.
Preserve list: Analysis and prediction calculations, data loading and APIs, auth, global top navigation, route contracts, themes, responsive layout, keyboard access, localization, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-41`
Notes: Navigation and information-architecture change only; no analysis data, model, API, persistence, or route-generation contract changed.

### Version: DV-2026-08-08-41
Date: 2026-08-08
Surface: Planned-route preview on `/schedule`
Files: `frontend/src/pages/Schedule.jsx`, `frontend/src/styles/_split/schedule.css`, `frontend/src/pages/scheduleRoutePlanner.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the history-derived SVG route sketch whenever a recommendation has normalized preview geometry but not full geographic waypoints, while retaining Leaflet for planner and recent-run routes with real coordinates.
Why: History-backed recommendations displayed their title, distance, and run count but discarded the available preview path, leaving most of the route panel visibly blank.
Preserve list: Planned-route selection, automatic route planning, recent-run fallback, Leaflet maps, target-distance logic, watch action, localization, themes, responsive layout, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-40`
Notes: Resilient presentation fallback only; no API, route-generation, persistence, or navigation contract changed.

### Version: DV-2026-08-08-40
Date: 2026-08-08
Surface: Profile-aligned daily coaching grid on `/today-run`
Files: `frontend/src/pages/TodayRun.jsx`, `frontend/src/styles/_split/today-run.css`, `frontend/src/styles/_split/light-theme-overrides.css`, `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/todayRunCommandDeckRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the oversized five-card strip and billboard-height training hero with a bounded 1320px Profile-style canvas, compact twelve-column status cards, a smaller dark workout focal card, and balanced plan/coach detail columns. Removed the third duplicated shoe recommendation while retaining its quick status and actionable coach-rail detail.
Why: The previous layout spent most of the first viewport on repeated signals and forced useful coaching information into oversized, loosely grouped cards, making the daily decision difficult to scan.
Preserve list: Daily coach data and readiness signals, VDOT and ACWR logic, workout metrics and blueprint, weather adjustment, coach rationale, shoe status and shoe-locker action, schedule actions, localization, themes, responsive layout, keyboard access, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-39`
Notes: Information hierarchy and responsive density change only; no API, recommendation, persistence, routing, or translation contract changed.

### Version: DV-2026-08-08-39
Date: 2026-08-08
Surface: Scan-first run history on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/analysis-detail-redesigns.css`, `frontend/src/pages/runsCompactOverview.smoke.test.js`, `frontend/src/pages/runsInsightPrimaryCard.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the oversized Runs hierarchy into a compact command header, one-row search and filter workbench, unified six-metric glance rail, and denser responsive run-card grid with bounded route previews and horizontal metrics.
Why: The prior hero and stacked summary surfaces consumed the first viewport before runners could see their actual history, while large cards limited at-a-glance comparison.
Preserve list: Run fetching and caching, route previews, search, filters and sorting, month folding, Strava connection, file import, run navigation, loading and empty states, localization, themes, keyboard access, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-38`
Notes: Information hierarchy and responsive density change only; no run data, API, persistence, or routing contract changed.

### Version: DV-2026-08-08-38
Date: 2026-08-08
Surface: Profile-aligned Garmin import grid on `/settings/garmin-import`
Files: `frontend/src/pages/GarminImportSettings.jsx`, `frontend/src/styles/_split/integrations.css`, `frontend/src/pages/garminImportProfileGrid.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the repeated header, visual pane, status card, and nested mega-card with a compact Garmin hero, a three-metric Profile-style strip, a wider account-import form, and a smaller wellness-sync support card that collapses to one column before the authenticated navigation constrains it.
Why: The previous route presented the same Garmin title, instructions, sync mode, and readiness state multiple times while overlapping legacy settings and integration grid styles made the page oversized and difficult to scan.
Preserve list: Garmin account import API and polling, credential fields and save action, activity limit selection, wellness toggle and manual sync, status feedback, Settings navigation, authentication chrome, localization, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-37`
Notes: Information hierarchy and responsive grid repair only; no API, credential, data, routing, or translation contract changed.

### Version: DV-2026-08-08-37
Date: 2026-08-08
Surface: Weather forecast pipeline surface on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherForecastHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Superseded the transparent forecast-panel cascade and restored the original panel surface behind the compact forecast header; the explanatory script remains removed.
Why: The transparent panel rule exposed the page grid and contradicted the requested restored background.
Preserve list: Forecast title, hourly forecast cards and data, current-weather HUD, heat-adaptation logic, localization, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-36`
Notes: Presentation-only cascade correction; no forecast data, API, or interaction contract changed.

### Version: DV-2026-08-08-36
Date: 2026-08-08
Surface: Weather forecast pipeline surface on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherForecastHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the full-width liquid-glass fill, border, shadow, and backdrop blur from both the forecast pipeline container and its header wrapper while retaining the hourly forecast slot surfaces.
Why: The shared `-panel` selector painted both forecast wrappers as standalone cards, leaving an unwanted cream strip behind otherwise unboxed pipeline content.
Preserve list: Forecast title, hourly forecast cards and data, current-weather HUD, heat-adaptation logic, localization, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-35`
Notes: Presentation-only cascade correction; no forecast data, API, or interaction contract changed.

### Version: DV-2026-08-08-35
Date: 2026-08-08
Surface: Weather forecast pipeline copy on `/weather`
Files: `frontend/src/pages/WeatherEngine.jsx`, `frontend/src/pages/weatherEditorialRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the long forecast explanation and attribution script from the forecast header while retaining the pipeline label and hourly forecast data.
Why: The explanatory copy created visual noise in the forecast header and was the text block shown in the reference screenshot.
Preserve list: Forecast API wiring, model selection, hourly forecast cards, current-weather HUD, heat-adaptation logic, localization, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-34`
Notes: Intentional presentation and copy reduction; no forecast data or interaction contract changed.

### Version: DV-2026-08-08-34
Date: 2026-08-08
Surface: Profile-aligned Shoes inventory workspace on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/_split/shoes.css`, `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/shoesGridVisibility.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Consolidated the duplicated inventory title, search, scan, add, status tabs, and filters into one workspace; added a compact three-metric summary strip; rebuilt shoe records for a stable two-column desktop grid and one-column responsive flow; and stopped the shared liquid-glass sweep from rendering nested card anatomy as overlapping strips.
Why: The prior page forced detailed three-column shoe records into narrow auto-fit columns while multiple top-level control surfaces competed for attention, making the inventory hard to scan and causing nested content to overlap.
Preserve list: Sidebar and top navigation, auth/profile controls, rotation intelligence, scan quotas, duplicate merging, search/filter/sort behavior, virtualization, shoe image/edit/retire/reactivate/delete actions, localization, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-33`
Notes: Profile hierarchy and responsive composition repair; no API, data model, route, or translation contract changed.

### Version: DV-2026-08-08-33
Date: 2026-08-08
Surface: Heatmap MacBook zoom performance
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/_split/heatmap.css`, `frontend/src/pages/heatmapStability.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reduced the Retina GPS canvas backing-store budget, retained the transformed route frame until an offscreen replacement is ready, coalesced queued zoom clicks, limited animation to one-level transitions so accumulated input cannot collapse the tile viewport, reduced retained map tiles, and removed continuous backdrop blur from moving-map controls.
Why: The prior alignment fix still composited two oversized Retina canvases under several live blur surfaces and performed intermediate redraws between queued zoom steps, leaving laptop zoom animation visibly heavy.
Preserve list: Heatmap data loading and caching, GPS colors and routes, map controls, recentering, legend, diagnostics, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-32`
Notes: Rendering-budget and animation-lifecycle repair; no API, route-data, or localization contract changed.

### Version: DV-2026-08-08-32
Date: 2026-08-08
Surface: Weather forecast pipeline background on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherForecastHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the original forecast panel surface behind the pipeline title, forecast description, and attribution copy; hourly forecast slots remain unchanged.
Why: The transparent override exposed the page grid behind the copy instead of preserving the weather panel's intended visual separation.
Preserve list: Weather API wiring, forecast attribution, hourly forecast cards, current-weather HUD, heat-adaptation logic, localization, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-31`
Notes: Presentation-only cascade rollback scoped to the forecast panel; no data or interaction contract changed.

### Version: DV-2026-08-08-31
Date: 2026-08-08
Surface: Weather Engine analysis card headings on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherEditorialRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the unintended glass background strip from the heat-adaptation and coach heading wrappers while preserving the parent cards, kicker pill, thermostat tile, and metric surfaces.
Why: The shared liquid-glass card sweep matched nested `weather-engine-card-head` classes as standalone cards.
Preserve list: Weather API wiring, adaptation logic, forecast data, localization, card hierarchy, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-30`
Notes: Presentation-only cascade correction; no data, routing, or interaction contract changed.

### Version: DV-2026-08-08-30
Date: 2026-08-08
Surface: Weather forecast pipeline header on `/weather`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/weatherForecastHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the unintended full-width liquid-glass strip from the forecast panel and its title, description, and attribution wrappers so the copy sits directly on the weather canvas; hourly forecast slots remain filled data tiles.
Why: The shared `[class*="-panel"]` sweep treated the forecast data rail as a standalone paper sheet and reduced the visual separation between the weather canvas and the actual hourly forecast data.
Preserve list: Weather API wiring, forecast attribution, hourly forecast cards, current-weather HUD, heat-adaptation logic, localization, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-29`
Notes: Presentation-only cascade correction scoped to the Weather page's compound root selector; no data or interaction contract changed.

### Version: DV-2026-08-08-29
Date: 2026-08-08
Surface: Settings recovery and interactive liquid-glass canvas
Files: `frontend/src/pages/Settings.jsx`, `frontend/src/contexts/AuthContext.jsx`, `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/styles/_split/settings.css`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/pages/settingsWorkbenchLayout.smoke.test.js`, `frontend/src/contexts/authUrlTokenPersistence.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Made the runner canvas grid explicitly non-interactive, bounded auth/profile loading, and replaced the Settings load dead end with a retry action and a profile escape route, with localized recovery copy.
Why: A decorative canvas pseudo-element could intercept clicks, and a stalled auth or Settings request left the user on an unusable skeleton or message with no recovery path.
Preserve list: Settings API wiring, authentication and routing, form controls, sync actions, theme and language behavior, responsive layout, reduced-motion behavior, and existing liquid-glass surfaces.
Rollback target: `DV-2026-08-08-28`
Notes: Scoped interaction and degraded-state repair; no API or persistence contract changed.

### Version: DV-2026-08-08-28
Date: 2026-08-08
Surface: Heatmap zoom animation and controls
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/_split/heatmap.css`, `frontend/src/pages/heatmapStability.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked zoom settling to replace the transformed GPS canvas with an immediately aligned preview before refining it offscreen, throttled tile updates with a bounded retained buffer, and queued rapid zoom-button clicks.
Why: Zoom completion reset the old GPS bitmap before the replacement frame was ready, producing a visible jump, while oversized tile retention and overlay style toggles added unnecessary work and flashing.
Preserve list: Heatmap data loading and caching, GPS colors and routes, Leaflet map controls, recentering, map legend, diagnostics, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-27`
Notes: Interaction and rendering-lifecycle repair; no API, route-data, or localization contract changed.

### Version: DV-2026-08-08-27
Date: 2026-08-08
Surface: Run detail shell and Profile-aligned analysis grid on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/_split/runs.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the shared authenticated sidebar and top navigation around loading, empty, and loaded run-detail states; added a Runs breadcrumb and active navigation state; constrained the page to the Profile canvas; and rebalanced the map, metric rail, telemetry, and supporting cards into the established dashboard grid.
Why: Run details rendered as a standalone full-viewport cockpit, so navigation disappeared and the oversized title and distance card no longer matched the Profile and Runs surfaces.
Preserve list: Run fetching, route map, telemetry switching and charting, Strava resync, native sharing, shoe linking, elevation recalibration, comparison, splits, performance metrics, localization, themes, responsive behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-26`
Notes: Presentation and shared-shell integration only; no run data or API contract changed.

### Version: DV-2026-08-08-26
Date: 2026-08-08
Surface: Settings atlas card headings
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/settingsWorkbenchLayout.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the unintended glass-paper fill from Settings card heading wrappers while preserving the parent cards and interactive controls.
Why: The shared `-card` selector matched `st-card-head` and `st-card-title` as standalone surfaces, leaving opaque strips behind section headings.
Preserve list: Settings form controls, unit/theme/language toggles, sync actions, logout flow, card surfaces, responsive behavior, theme switching, reduced-motion behavior, and API contracts.
Rollback target: `DV-2026-08-08-25`
Notes: Presentation-only correction; service and theme cards remain intentionally styled.

### Version: DV-2026-08-08-25
Date: 2026-08-08
Surface: Run-history card text surfaces on `/runs`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/runsGridHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Corrected the run-page cascade selector so the title, date, content wrapper, and parent card no longer paint cream background strips; route previews and individual metric tiles retain their intentional fills.
Why: The previous override treated `runner-shell-page` and `runs-dashboard-page` as nested elements even though both classes are on the same page root, so the strip-removal rules never matched the live cards.
Preserve list: Run data, route previews, card borders, navigation, hover and focus behavior, metric tiles and formatting, month grouping, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-24`
Notes: Added a regression guard that rejects the invalid descendant selector and requires the same-root compound selector used by the live page.

### Version: DV-2026-08-08-24
Date: 2026-08-08
Surface: Heatmap sessions drawer
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/_split/heatmap.css`, `frontend/src/pages/heatmapMobileOverlay.smoke.test.js`, `frontend/src/pages/heatmapStability.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the entire right-side viewport sessions drawer, including its current-view summary and run-row grid, while preserving the map, legend, controls, and diagnostics.
Why: The sessions drawer occupied the primary Heatmap surface with a large secondary card and duplicated context already visible on the map.
Preserve list: Heatmap rendering, map controls, legend, GPS diagnostics, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-23`
Notes: Scoped presentation and hierarchy cleanup; no map data, routing, or map interaction contract changed.

### Version: DV-2026-08-08-23
Date: 2026-08-08
Surface: Guided workout import flow on `/analysis` and shared import surfaces
Files: `frontend/src/components/ImportDataGuide.jsx`, `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/profileImportModalDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the seven-paragraph instruction wall with a three-step import path, expandable provider and Strava guidance, clearer numbered source cards, selected-file totals, import-ready and uploading states, visible failure feedback, and a sticky action row that remains reachable while scrolling.
Why: The existing modal looked polished but forced runners to read every instruction before reaching the upload controls, provided weak confirmation after file selection, and silently swallowed upload failures.
Preserve list: Analysis and Runs routing, accepted GPX/TCX/FIT/ZIP formats, multi-file and cross-source uploads, duplicate skipping, post-import analysis refresh, light/dark themes, keyboard focus, responsive stacking, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-22`
Notes: The shared Analysis and Runs entry points now use the same hierarchy and selection-ready states; the Analysis flow additionally distinguishes uploading and batch failure states.

### Version: DV-2026-08-08-22
Date: 2026-08-08
Surface: Responsive run-history cards on `/runs`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/pages/runsCardResponsiveGrid.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the premature three-column month breakpoint with content-width auto-fitting, reserved a bounded route-preview column, tightened card typography and spacing, and kept distance, pace, and moving-time values horizontal across desktop, tablet, and mobile cards.
Why: At the common 1328px browser width, three run cards forced metric labels into vertical stacks and clipped durations even though the card content itself requires substantially more horizontal room.
Preserve list: Run data, route previews, card navigation, month grouping and folding, search and filters, metric formatting, theme behavior, focus states, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-21`
Notes: Scoped run-card layout correction; no API, persistence, routing, localization, or interaction contract changed.

### Version: DV-2026-08-08-21
Date: 2026-08-08
Surface: Heatmap current-view overlay
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/_split/heatmap.css`, `frontend/src/pages/heatmapMobileOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the `当前视野` summary grid from the sessions drawer while preserving viewport-filtered run rows, map controls, and the run detail actions.
Why: The duplicate two-cell current-view summary occupied the top of the drawer without adding information beyond the visible run list.
Preserve list: Heatmap rendering, viewport filtering, run-row navigation, map controls, GPS diagnostics, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-20`
Notes: Scoped presentation and hierarchy cleanup; no map data or interaction contract changed.

### Version: DV-2026-08-08-20
Date: 2026-08-08
Surface: Shared workout import modal on `/analysis` and `/runs`
Files: `frontend/src/pages/Analysis.jsx`, `frontend/src/pages/Runs.jsx`, `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/profileImportModalDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the narrow legacy import dialog as a Profile-aligned warm editorial sheet with numbered guidance, compact upload-source cards, native file-control styling, a wide two-column desktop layout, viewport-contained scrolling, and a single-column mobile fallback.
Why: The existing 500px generic modal made the import guide excessively tall and visually disconnected from the Profile design used by the surrounding runner workspace.
Preserve list: Analysis and Runs routing, modal open/close behavior, localized guide copy, accepted GPX/TCX/FIT/ZIP inputs, multiple-file selection, import handlers, status feedback, themes, keyboard focus, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-19`
Notes: Scoped presentation-only modal variant shared by both import entry points; no API, persistence, upload, or translation contract changed.

### Version: DV-2026-08-08-19
Date: 2026-08-08
Surface: Analysis VDOT trend insight grid
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/analysisVdotTrendAccent.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the coach grid's layered glass surface on the VDOT insight grid while keeping its nested header transparent and preserving the intentional accent badge.
Why: Removing the VDOT article fill also removed its intended grid color, leaving the second grid visually inconsistent with the first coach grid.
Preserve list: VDOT trend calculations, direction icon, delta value, insight copy, accent badge, card border, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-18`
Notes: Scoped presentation-only surface restoration; no data, routing, or interaction contract changed.

### Version: DV-2026-08-08-18
Date: 2026-08-08
Surface: Analysis VO2max trend grid
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/analysisVdotTrendAccent.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the shared liquid-glass fill from the VO2max trend hero and its header wrapper while preserving the `有氧信号` badge, `47.1` metric card, chart bars, and downstream analysis cards.
Why: The later shared card sweep repainted `analysis-profile-primary` and `analysis-overview-card-head` after the Analysis-specific transparent surface rules.
Preserve list: Analysis routing, VO2max values, chart interactions, trend labels, metric formatting, prediction cards, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-17`
Notes: Scoped presentation-only cascade correction; no data, API, or interaction contract changed.

### Version: DV-2026-08-08-17
Date: 2026-08-08
Surface: Run-history card grid on `/runs`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/runsGridHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the remaining full-width gradient fill from each profile-aligned run card so the title/date column sits directly on the grid surface; route thumbnails and metric tiles remain filled.
Why: The parent `recent-runs-card` gradient was still visible behind the right-hand content after nested wrapper backgrounds were cleared.
Preserve list: Run-history routing, search and filters, month folding, card borders, hover/focus feedback, route previews, metric formatting, responsive grid behavior, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-16`
Notes: Scoped presentation-only surface correction; no data, API, or interaction contract changed.

### Version: DV-2026-08-08-16
Date: 2026-08-08
Surface: Run-history card grid on `/runs`
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/runsGridHeaderBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the shared liquid-glass strip from each run card's title/date/content wrappers while preserving the parent card, route thumbnail, and individual metric tiles.
Why: The shared `[class*="-card"]` selector matched the run card's nested `recent-runs-card-*` layout classes and painted extra paper bands inside every grid item.
Preserve list: Run-history routing, search and filters, month folding, run-card navigation, route previews, metric formatting, responsive grid behavior, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-15`
Notes: Scoped presentation-only cascade correction; no data, API, or interaction contract changed.

### Version: DV-2026-08-08-15
Date: 2026-08-08
Surface: Analysis VDOT trend insight card
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/analysisVdotTrendAccent.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the shared liquid-glass strip and the card fill from the VDOT insight content while preserving its border, trend value, copy, and intentional accent badge.
Why: The generic `[class*="-card"]` sweep matched `analysis-overview-card-head`, while the first exception used a descendant selector even though `runner-shell-page` and `analysis-page-shell` are the same root element.
Preserve list: Analysis metrics, VDOT trend calculations, direction icon, delta value, insight copy, accent badge, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-14`
Notes: Presentation-only cascade repair; no data, routing, or user-facing copy changed.

### Version: DV-2026-08-08-14
Date: 2026-08-08
Surface: Profile recent activity / training log header
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/profileRecentActivityHeader.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the shared liquid-glass gradient, shadow, and blur from the nested `近期活动` / `训练日志` header region while preserving the warm glass treatment on the parent sessions card.
Why: The shared card sweep matched `hd-card-head`, `hd-card-kicker`, and `hd-card-title` through their `-card` class names and repainted the header strip after the Profile-local reset.
Preserve list: Profile routing, activity data, row navigation, metric formatting, parent card surface, hover/focus feedback, responsive layout, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-13`
Notes: Late-cascade presentation-only correction; no user-facing copy, API, persistence, or interaction contract changed.

### Version: DV-2026-08-08-13
Date: 2026-08-08
Surface: Analysis VO2max trend hero
Files: `frontend/src/styles/_split/analysis.css`, `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/analysisVdotTrendAccent.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the filled background from the large VO2max trend hero behind the title and metric card while preserving the `有氧信号` label, metric card, chart surfaces, and decorative geometry.
Why: The hero was rendering as a cream strip across the top of the Analysis page instead of sitting directly on the page surface.
Preserve list: VO2max values, trend bars, chart interactions, `有氧信号` label styling, metric card, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-12`
Notes: Presentation-only hero surface cleanup; no data, routing, or interaction contract changed.

### Version: DV-2026-08-08-12
Date: 2026-08-08
Surface: Current weekly training-load chart header on the Profile dashboard
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/profileWeeklyProgressTooltip.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a final shared-layer exception that neutralizes the liquid-glass sweep on the weekly chart's nested header, kicker, title, legend, and weekday-label nodes. The parent chart card and its actual/projected bar colors remain intact.
Why: The shared `[class*="-card"]` selector matched `hd-card-head`, `hd-card-kicker`, and `hd-card-title`, repainting the words with a horizontal glass strip after the original cleanup rule.
Preserve list: Weekly load calculations, tooltip behavior, legend markers, projected/actual bars, parent card surface, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-11`
Notes: Presentation-only cascade repair; no data, routing, or user-facing copy changed.

### Version: DV-2026-08-08-11
Date: 2026-08-08
Surface: Profile recent activity / training log header
Files: `frontend/src/styles/_split/profile-dashboard-redesign.css`, `frontend/src/pages/profileRecentActivityHeader.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored the shared warm liquid-glass surface on the recent-activity card and scoped the transparent treatment to the header and all of its descendants, leaving the surrounding grid/card surface intact.
Why: The previous correction flattened the card to a near-white surface while a nested header element could still paint a white strip behind `近期活动` / `训练日志`.
Preserve list: Profile routing, activity data, row navigation, metric formatting, card surface, hover/focus feedback, responsive layout, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-10`
Notes: Scoped presentation-only correction; no user-facing copy, API, persistence, or interaction contract changed.

### Version: DV-2026-08-08-10
Date: 2026-08-08
Surface: Weather location and loading behavior on `/weather`
Files: `frontend/src/pages/WeatherEngine.jsx`, `backend/src/main/java/com/hermes/backend/AcclimatizationService.java`, `backend/src/main/java/com/hermes/backend/WeatherContextController.java`, weather smoke and service/controller tests, `DESIGN_VERSIONS.md`
What changed: Weather now prefers validated browser coordinates for the live forecast and acclimatization context, starts rendering without waiting for the archive request, and falls back to the server's latest GPS point when location permission is unavailable.
Why: Runners in a new location, such as Fuzhou, could see weather and heat adaptation calculated from an older run location such as New York, while a slow context request could leave the page stuck loading.
Preserve list: Weather routing, forecast cards, hourly pipeline, heat adaptation calculations, permission-denied fallback, request timeouts, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-09`
Notes: Location-aware data-flow repair; no new dependency or user-facing copy change.

### Version: DV-2026-08-08-09
Date: 2026-08-08
Surface: Profile recent activity / training log header
Files: `frontend/src/styles/_split/profile-dashboard-redesign.css`, `frontend/src/pages/profileRecentActivityHeader.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Kept the recent-activity grid's glass card background and removed only the nested strip behind the `近期活动` / `训练日志` header labels; activity rows and hover feedback remain unchanged.
Why: Removing the whole sessions-card surface exposed the page grid and removed the intended card separation. The correction is limited to the header treatment.
Preserve list: Profile routing, activity data, row navigation, metric formatting, card surface, hover/focus feedback, responsive layout, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-08`
Notes: Scoped presentation-only correction; no user-facing copy, API, persistence, or interaction contract changed.

### Version: DV-2026-08-08-08
Date: 2026-08-08
Surface: Legacy weekly training-load chart card surface on the Profile dashboard
Files: `frontend/src/styles/_split/profile.css`, `frontend/src/pages/profileWeeklyProgressTooltip.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Flattened the legacy weekly chart card background and removed its gradient image so the header no longer appears as a separate pale strip behind the chart labels. Borders, bars, legend markers, and tooltip behavior remain unchanged.
Why: The earlier label-only transparency rules could not remove the band because it was painted by the card's own gradient.
Preserve list: Weekly load calculations, tooltip behavior, legend markers, projected/actual bars, borders, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-07`
Notes: Presentation-only card-surface correction; no data, routing, or user-facing copy changed.

### Version: DV-2026-08-08-07
Date: 2026-08-08
Surface: Profile recent activity / training log header
Files: `frontend/src/styles/_split/profile-dashboard-redesign.css`, `frontend/src/pages/profileRecentActivityHeader.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the decorative background fill from the `近期活动` / `训练日志` sessions card so its header and entries sit directly on the surrounding Profile surface; activity-row hover feedback remains unchanged.
Why: The shared liquid-glass layer repainted the whole activity section as a nested panel, making the header-strip cleanup ineffective and competing with the training-log entries below it.
Preserve list: Profile routing, activity data, row navigation, metric formatting, hover/focus feedback, responsive layout, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-06`
Notes: Scoped presentation-only cleanup; no user-facing copy, API, persistence, or interaction contract changed.

### Version: DV-2026-08-08-06
Date: 2026-08-08
Surface: Weekly training-load chart labels across Profile dashboard generations
Files: `frontend/src/styles/_split/profile.css`, `frontend/src/styles/_split/profile-dashboard-redesign.css`, `frontend/src/pages/profileWeeklyProgressTooltip.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the header-strip background from both the current `hd-*` weekly chart and the legacy runner weekly chart selectors, including the legend and weekday labels. The chart cards and actual/projected bar fills remain intact.
Why: The first correction only covered the current redesign classes, while the deployed/legacy profile surface still painted the pale block behind the text.
Preserve list: Weekly load calculations, tooltip behavior, legend markers, projected/actual bars, card surfaces, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-05`
Notes: Presentation-only cross-generation cascade repair; no data, routing, or user-facing copy changed.

### Version: DV-2026-08-08-05
Date: 2026-08-08
Surface: Weather humidity and wind HUD cards on `/weather`
Files: `frontend/src/styles/_split/weather.css`, `frontend/src/styles/style.css`, `frontend/src/pages/weatherEditorialRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the rigid square HUD-card sizing with content-driven minimum height, bounded the weather SVG icons, and kept localized card labels on one readable line beside their icons.
Why: The two weather cards could expand their icons to the browser default SVG size, force Chinese labels into vertical stacks, and clip the lower copy inside the square card boundary.
Preserve list: Live weather values, humidity meter, wind direction, fallback copy, two-column desktop grid, single-column mobile behavior, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-04`
Notes: Presentation-only weather grid repair; no data, routing, API, or user-facing copy changed.

### Version: DV-2026-08-08-04
Date: 2026-08-08
Surface: Weekly training-load chart on the Profile dashboard
Files: `frontend/src/styles/_split/profile-dashboard-redesign.css`, `frontend/src/pages/profileWeeklyProgressTooltip.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed any color fill from the weekly chart header, legend labels, and weekday labels so the words sit directly on the existing glass card surface. The projected and actual bar fills remain unchanged.
Why: The chart labels were rendering with a distracting pale strip behind the text, making the visual hierarchy look broken.
Preserve list: Weekly load calculations, tooltip behavior, legend markers, projected/actual bars, card surface, responsive layout, themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-03`
Notes: Presentation-only label-background correction; no data, routing, or user-facing copy changed.

### Version: DV-2026-08-08-03
Date: 2026-08-08
Surface: Profile Today session card
Files: `frontend/src/styles/contrast-fixes.css`, `frontend/src/pages/profileTodayCardContrast.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored a dependable dark image scrim for the Today session card in light themes, with explicit cream/coral text and a clearer secondary action border so the workout title, purpose, metrics, and controls remain legible without removing the photographic background.
Why: The light glass treatment washed out the card behind the white workout copy, making the primary training recommendation difficult to scan.
Preserve list: Profile routing, workout recommendation data, metric values, action destinations, image loading, responsive layout, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-02`
Notes: Contrast-only presentation repair; no user-facing copy, API, persistence, or action behavior changed.

### Version: DV-2026-08-08-02
Date: 2026-08-08
Surface: Admin dashboard and all `/dashboard/*` workspaces
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Unified the dashboard overview, users, course maps, shoe review, jobs, audit, and settings routes around the runner Profile visual system: one clear hero, wider responsive canvas padding, warm translucent glass cards, strong dark typography, restrained coral accents, and consistent rounded geometry. Removed the repeated route summary band and the duplicate legacy settings controls.
Why: The admin routes had accumulated multiple design generations, including repeated metrics, dark terminal-themed panels, and inconsistent spacing that made the product feel disconnected from the Profile page.
Preserve list: Admin routing, authentication, live data, filters, tables, map interaction, uploads, review/publish actions, job selection, audit pagination, language/theme controls, logout, responsive behavior, dark themes, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-01`
Notes: Shared presentation and hierarchy pass only; no API, persistence, authorization, or user-facing copy changed.

### Version: DV-2026-08-08-01
Date: 2026-08-08
Surface: Admin shoe review actions on `/dashboard/shoes`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardShoeActionButtons.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the shoe review action group into a compact two-button command row with consistent rounded surfaces, non-wrapping labels, keyboard focus states, and a separated full-width delete action.
Why: The previous global button treatment made the primary action a clipped trapezoid and the narrow action grid wrapped Chinese labels into vertical stacks, making the review controls hard to scan and easy to misclick.
Preserve list: Shoe review queue, image upload/replacement, pending/live approval, deletion, catalog filters, pagination, APIs, persistence, authentication, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-07-06`
Notes: Presentation-only action hierarchy pass; no route, API, persistence, authentication, or user-facing copy changed.

### Version: DV-2026-08-06-06
Date: 2026-08-06
Surface: Admin shell top navigation on `/dashboard` and admin routes
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the admin header's repeated breadcrumb, eyebrow, title, and summary stack with the shared `RunnerShellTopNav` identity and runner shell top-bar geometry. Admin shortcuts remain available on the right, while route-specific detail stays in the page content.
Why: The admin header was much taller and denser than the authenticated runner pages, repeating the same route context in three visual layers and reducing the initial information viewport.
Preserve list: Admin routes, tab navigation, authentication, data actions, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-05`

### Version: DV-2026-08-06-05
Date: 2026-08-06
Surface: `/dashboard` admin shell content inset
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reserved the desktop admin rail with an explicit shell padding inset and kept the main route column full-width inside that reserved area. The rail remains viewport-fixed for long routes, while the mobile reset removes the inset entirely.
Why: The fixed-rail/grid combination still allowed the first dashboard information card to render from the viewport edge in Chrome, leaving its content under the navigation rail.
Preserve list: Admin routes, navigation, authentication, tables, maps, data actions, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-04`

### Version: DV-2026-08-06-04
Date: 2026-08-06
Surface: `/dashboard` admin shell rail/content cascade guard
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a final scoped cascade guard so the fixed admin rail width and desktop content offset cannot be replaced by legacy `margin-left: 0` or auto-width rules; the mobile reset is equally explicit.
Why: The live dashboard still showed the first metric column underneath the rail even though the non-important geometry rule was present in the built stylesheet.
Preserve list: Admin routes, navigation, authentication, tables, maps, data actions, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-03`

### Version: DV-2026-08-06-03
Date: 2026-08-06
Surface: `/dashboard` admin shell rail/content geometry
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Made the desktop admin content column explicitly reserve the fixed profile rail width, with matching box sizing and a full-width mobile reset.
Why: The fixed navigation rail could paint over the first dashboard cards and top-level information when the main column fell back to auto width.
Preserve list: Admin routes, navigation, authentication, tables, maps, data actions, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-02`

### Version: DV-2026-08-06-02
Date: 2026-08-06
Surface: `/dashboard` admin overview hierarchy
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reduced the admin overview to one profile-aligned monitoring layer: metrics, health/audit signals, and route actions. Hidden legacy overview copies that repeated users, maps, shoes, queues, and audit workbenches, added consistent content padding, and collapsed long secondary rail descriptions so the sidebar matches the compact runner profile shell.
Why: The overview was rendering multiple generations of admin cards at once, producing blank-looking panels, duplicated status information, and a crowded narrow sidebar before the user reached the useful controls.
Preserve list: All admin routes, tables, maps, shoe review actions, queue filters, audit data, authentication, responsive behavior, and theme/reduced-motion behavior. Detailed work remains available through the dedicated sidebar routes.
Rollback target: `working tree before this change`

### Version: DV-2026-08-06-01
Date: 2026-08-06
Surface: Authenticated runner dashboard pages
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/runnerProfileDesignSystem.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Applied the Profile page's shared visual language across runner routes: warm aerodynamic paper backgrounds, editorial Outfit/Manrope hierarchy, translucent profile cards, restrained coral/moss depth, consistent dark/light actions, and shared rounded map/chart shells. Route-specific data visualizations, maps, forms, and navigation keep their existing behavior and geometry.
Why: Authenticated pages were accumulating separate surface treatments, making Analysis, Runs, Races, Schedule, Weather, Shoes, Strength, Settings, and detail views feel like unrelated products instead of one Hermes workspace.
Preserve list: All route paths, API and persistence contracts, authentication, map/chart interaction, route-specific content, responsive layout, theme switching, and reduced-motion behavior.
Rollback target: `working tree before this change`

### Version: DV-2026-08-05-12
Date: 2026-08-05
Surface: `/admin` administrator login
Files: `frontend/src/pages/AdminLogin.jsx`, `frontend/src/styles/auth-liquid-glass.css`, `frontend/src/pages/adminLoginA11yCopy.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the admin sign-in surface to share the public auth direction: a full-page interactive dot field, editorial HERMES / ADMIN OPS brand rail, one responsive liquid-glass credential sheet, and autofill-friendly email/password fields. Removed the old nested form-panel treatment without changing the admin login endpoint or redirect behavior.
Why: The admin grid looked like a separate legacy auth system instead of the same focused Hermes entry experience used by login and signup.
Preserve list: `/admin` routing, admin authentication contract, role handoff to `/dashboard`, locale-aware copy, language switcher, legal links, responsive layout, and reduced-motion behavior.
Rollback target: `working tree before this change`

### Version: DV-2026-08-05-11
Date: 2026-08-05
Surface: `/` landing loading skeleton shoe geometry
Files: `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the generic polygon shoe placeholder with the EVO SL master frame's alpha silhouette, preserving the shared shimmer while matching the live hero's `0.88fr / 1.12fr` copy-to-art grid, square canvas, visible shoe bounds, heel/toe profile, 1.08× heel-anchored scale, and ground shadow placement.
Why: The skeleton's right-side placeholder was flatter, smaller, and positioned differently from the live landing hero, making the loading transition visibly jump.
Preserve list: Landing copy, navigation/action landmarks, below-fold feature preview, responsive stacking, and reduced-motion-safe skeleton animation.
Rollback target: `DV-2026-08-05-10`

### Version: DV-2026-08-05-10
Date: 2026-08-05
Surface: `/` loading skeleton composition
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the landing skeleton around the actual first viewport: three-column navigation, editorial three-line hero, copy/actions/trust row, reserved shoe artwork and shadow, and the next feature section below the fold.
Why: The previous landing placeholder was a generic title/stats/map layout, so it did not reserve the live hero's right-side shoe or keep the feature grid below the initial viewport.
Preserve list: Hero scroll shoe interaction, navigation and CTA routes, landing sections, bilingual copy, responsive behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-09`

### Version: DV-2026-08-05-09
Date: 2026-08-05
Surface: `/login` and `/signup` loading skeleton compositions
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Matched the public auth skeletons to the live surfaces with a restrained dot field, left Hermes brand/carousel landmarks, liquid-glass form cards, password-field geometry, social status rows, cross-auth links, and legal footer geometry.
Why: The login alias rendered, but signup still used the older root layout, so the two auth previews diverged and omitted the dotted field and lower auth landmarks.
Preserve list: Login form behavior, OAuth availability states, authentication flow, responsive layout, reduced-motion behavior, and signup/admin/forgot-password skeleton variants.
Rollback target: `DV-2026-08-05-08`

### Version: DV-2026-08-05-08
Date: 2026-08-05
Surface: `/login` loading skeleton preview
Files: `frontend/src/App.jsx`, `frontend/src/components/PageSkeleton.jsx`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added the `skeleton-preview=login` alias so the login preview renders the existing two-panel authentication skeleton instead of falling through to the landing skeleton.
Why: The preview query accepted `auth` but not the user-facing `login` name, so `/login` preview showed unrelated landing content.
Preserve list: Login form behavior, OAuth availability states, authentication flow, responsive layout, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-07`

### Version: DV-2026-08-05-07
Date: 2026-08-05
Surface: `/settings` loading skeleton
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the Settings skeleton around the loaded page's compact identity hero, account/preferences row, checklist/weekly-brief row, and connected-services/wellness sections.
Why: The previous placeholder used a generic oversized command hero and stacked the right column incorrectly, causing a visible layout jump while Settings data loaded.
Preserve list: Settings form controls, service linking/import actions, wellness preferences, navigation, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-06`

### Version: DV-2026-08-05-06
Date: 2026-08-05
Surface: `/schedule` loading skeleton
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recalibrated the schedule skeleton to the loaded plan: a compact weekly-plan hero with two volume metrics, a seven-day training strip, and a lower three-column readiness/next-session/coach composition before the route and gear details.
Why: The previous placeholder used three nested metric cards, an oversized hero, and a wider left rail, so its first viewport diverged from the real schedule page.
Preserve list: Schedule hydration, workout editing and navigation, route planning, readiness and coach calculations, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-05`

### Version: DV-2026-08-05-05
Date: 2026-08-05
Surface: `/muscle-training` loading skeleton first viewport
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the strength-training skeleton around the loaded page's three above-fold zones: muscle selector, recommended movements, and exercise reference, followed by the protocol workbench, movement demo, check-in, and tuning surfaces.
Why: The previous skeleton introduced a command hero and omitted the right-hand exercise reference, creating a large layout jump before the real muscle-training page rendered.
Preserve list: Muscle selection, exercise recommendations, movement guidance, check-in controls, plan tuning, route behavior, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-04`

### Version: DV-2026-08-05-04
Date: 2026-08-05
Surface: Remaining route loading skeletons
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced generic placeholders across heatmap, weather, run detail, insight, prediction, schedule, today-run, strength training, rewards, settings, Garmin/import, add-shoes, catalog, and race-detail routes with compositions that reserve their loaded page landmarks; the heatmap now uses a dedicated full-screen map shell.
Why: Computer Use comparison showed several routes still collapsed to a generic hero/chart or runner-frame layout, creating large geometry jumps while data loaded.
Preserve list: Route data hydration, map behavior, navigation, forms, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-03`

### Version: DV-2026-08-05-03
Date: 2026-08-05
Surface: `/shoes` loading skeleton
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the legacy catalog placeholder for the Shoes route with the real rotation insight, inventory stage, health summary, management controls, and final horizontal shoe inventory grid.
Why: The loaded Shoes page ends in a one-column inventory card grid, but its skeleton stopped at three generic product tiles and omitted the page's final data surface.
Preserve list: Shoe hydration, image scanning, duplicate merging, filters, sorting, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-02`

### Version: DV-2026-08-05-02
Date: 2026-08-05
Surface: `/profile` loading skeleton rewards section
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added the final rewards progress, upcoming-milestone, and badge grid to the Profile loading skeleton.
Why: Computer Use comparison showed the loaded Profile page continues below the bottom cards into a distinct Rewards section; ending the skeleton early caused the last grid to jump in during loading.
Preserve list: Reward calculations, reward navigation, user data, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-05-01`

### Version: DV-2026-08-05-01
Date: 2026-08-05
Surface: `/profile` loading skeleton geometry
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recalibrated the Profile skeleton against the live shell canvas, matching the runner topbar height and editorial content insets, adding the comeback card's inter-section spacing, mirroring the full-width weekly chart bars, and reserving all five recent-session rows, the view-all affordance, and five progression tabs.
Why: Computer Use comparison showed the skeleton canvas was wider and higher than the loaded Profile page, while the chart and lower training grid used visibly different landmarks.
Preserve list: Profile data hydration, dashboard actions, route navigation, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-04-03`

### Version: DV-2026-08-04-03
Date: 2026-08-04
Surface: `/profile` loading skeleton
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the Profile skeleton to mirror the editorial dashboard: date and greeting with readiness, comeback coach card, today's session hero, three-metric strip, weekly training/session panels, progression chart, weekly digest, and lower dashboard cards.
Why: The previous avatar-and-generic-stat placeholder did not reserve the Profile page's real top-to-bottom composition while dashboard data loaded.
Preserve list: Profile cache hydration, dashboard enrichment, coach actions, route navigation, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: working tree before this change

### Version: DV-2026-08-04-02
Date: 2026-08-04
Surface: `/analysis` loading skeleton
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the Analysis skeleton to mirror the live physiology cockpit: the VO2 trend card with chart and decision spine, the ACWR gauge/coach/trend rail, the intensity/injury/forecast bento row, prediction tables, and injury-prevention section.
Why: The previous generic hero, gauge, and split chart skeleton did not preserve the Analysis page's actual hierarchy or the large VO2-first composition during the initial data wait.
Preserve list: Analysis calculations, route actions, import flows, injury-risk loading, responsive collapse, theme behavior, and reduced-motion behavior.
Rollback target: working tree before this change

### Version: DV-2026-08-04-01
Date: 2026-08-04
Surface: `/runs` loading skeleton
Files: `frontend/src/components/PageSkeleton.jsx`, `frontend/src/styles/loading-skeleton.css`, `frontend/src/pages/loadingSkeleton.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the Runs skeleton to mirror the live history cockpit: the editorial hero and action row, two-up signal rail with status card, search/filter workbench, summary metrics, coaching insight strip, grouped month history, and route-preview run cards.
Why: The previous generic hero/chart skeleton suggested a different page structure and left the loading state visibly disconnected from the loaded Runs experience.
Preserve list: Runs data loading, cache behavior, Strava linking, imports, filtering, sorting, route previews, responsive collapse, and reduced-motion behavior.
Rollback target: working tree before this change

### Version: DV-2026-08-02-12
Date: 2026-08-02
Surface: Authenticated runner top navigation on narrow screens
Files: `frontend/src/styles/_split/runner-shell.css`, `frontend/src/styles/_split/profile.css`, `frontend/src/components/runnerShellTopNavRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Constrained the remaining page label to the available identity track and enabled safe localized wrapping after the HERMES brand removal.
Why: The narrow profile override still reserved the removed brand column, allowing page-label text to escape or clip inside the compact top-nav pill.
Rollback target: `DV-2026-08-02-11`
Notes: Active labels, parent breadcrumbs, desktop sizing, and shared navigation routes are preserved.

### Version: DV-2026-08-02-11
Date: 2026-08-02
Surface: `/login` and `/signup` — expanded product-introduction carousel
Files: `frontend/src/data/authBrandSlides.js`, `frontend/src/i18n/locales/{en,zh-CN}/pages.js`, `frontend/src/pages/loginBrandCarousel.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added three rotating stories that explain how Hermes works after sign-in: connect or import run data, bring wellness signals into recovery decisions, and review progress before choosing the next run. Each story includes localized detail and stat labels and participates in the existing randomized loop.
Why: The auth rail introduced individual analytics features but did not explain the complete path from data connection to daily training decisions.
Preserve list: Existing auth routes, form and OAuth behavior, random timing, reduced-motion handling, responsive layout, and prior carousel stories.
Rollback target: `DV-2026-08-02-10`

### Version: DV-2026-08-02-10
Date: 2026-08-02
Surface: `/login` and `/signup` — randomized brand intelligence carousel
Files: `frontend/src/components/AuthBrandCarousel.jsx`, `frontend/src/data/authBrandSlides.js`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`, `frontend/src/styles/auth-liquid-glass.css`, `frontend/src/i18n/locales/{en,zh-CN}/pages.js`, `frontend/src/pages/loginBrandCarousel.smoke.test.js`, `frontend/src/pages/authLiquidGlass.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the fixed CSS slide stack with one active brand frame that selects a different slide and a slightly varied display interval on each loop. Added compact localized detail rows to every frame, including PDF route tracing, elevation, and pacing/weather context for the course-map story. The active frame enters with a short fade-and-lift transition and remains readable for several seconds.
Why: The previous loop exposed every slide to assistive technology and advanced through a predictable sequence, while the course-map story needed more concrete product information without expanding the auth layout.
Preserve list: Existing auth routes, email/password and OAuth actions, bilingual copy, dot-field background, responsive layout, reduced-motion behavior, and form state.
Rollback target: `DV-2026-08-02-09`

### Version: DV-2026-08-02-09
Date: 2026-08-02
Surface: Authenticated runner top navigation
Files: `frontend/src/components/RunnerShellTopNav.jsx`, `frontend/src/styles/_split/runner-shell.css`, `frontend/src/styles/_split/tokens.css`, `frontend/src/components/runnerShellTopNavRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the HERMES brand pill from the shared top bar and collapsed the remaining page identity into a single compact column.
Why: The duplicated brand pill competed with the active page label and made the top bar feel unnecessarily heavy.
Rollback target: `DV-2026-08-02-08`
Notes: Shared navigation rendering, active labels, parent breadcrumbs, responsive behavior, and route data are preserved.

### Version: DV-2026-08-02-07
Date: 2026-08-02
Surface: Local shared-runner login hint on `/login`
Files: `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/pages/loginLocalMockHint.smoke.test.js`, `README.md`, `DESIGN_VERSIONS.md`
What changed: Corrected the documented local mock password to the backend default `HermesDev2026!` and clarified that `APP_LOCAL_SHARED_RUNNER_PASSWORD` can override it.
Why: The login hint advertised `HermesLocal1!`, while the backend bootstrap accepted `HermesDev2026!` by default, causing local sign-in attempts to fail.
Rollback target: `DV-2026-08-02-06`
Notes: Authentication flow, account email, environment override, and production safety guards are preserved.

### Version: DV-2026-08-02-06
Date: 2026-08-02
Surface: Public landing page `/` — race map marker scale refinement
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingAirlineAnimation.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Tightened the race marker again: the dark badge is now `0.5` viewBox units with a `0.68px` map label, while the coral locator halo is reduced to `0.72` units and lowered in opacity. The marker keeps its small core and high-contrast edge without competing with the map or flight route.
Why: The prior compact marker pass still read too large at the displayed map scale.
Mode: warm liquid-glass landing map with minimal coral locator cues.
Preserve list: Race ordering, route geometry, aircraft loop, race captions, bilingual copy, responsive behavior, and reduced-motion safeguards.
Rollback target: `DV-2026-08-02-05`

### Version: DV-2026-08-02-05
Date: 2026-08-02
Surface: Landing final CTA heading on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the final CTA heading's forced single-line behavior with a constrained fluid copy track and balanced wrapping, so long Chinese copy stays inside the card instead of widening the grid and clipping past its edge.
Why: The Chinese CTA title exceeded its fixed copy column while `white-space: nowrap` prevented safe wrapping, which made the centered final grid visibly overflow.
Rollback target: `DV-2026-08-02-04`
Notes: CTA routing, bilingual copy, button hierarchy, trust chips, and responsive card structure are preserved.

### Version: DV-2026-08-02-04
Date: 2026-08-02
Surface: Public landing page `/` — race map location markers
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingAirlineAnimation.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reduced the map location badge radius from `1.35` to `0.88` viewBox units and scaled the order label with it so the markers no longer overpower the world map. Added a compact coral halo with sequenced pulse animation, a smaller center accent, and a higher-contrast badge edge to keep each destination visually discoverable.
Why: The previous dark markers read as oversized dots in the map composition. The new treatment preserves location and order recognition while restoring the map's geography and route motion as the primary visual layer.
Mode: warm liquid-glass landing map with restrained coral motion cues.
Preserve list: Race ordering, route geometry, aircraft loop, race captions, bilingual copy, responsive behavior, and reduced-motion safeguards.
Rollback target: `DV-2026-08-02-03`

### Version: DV-2026-08-02-03
Date: 2026-08-02
Surface: All app shells — runner, admin, auth, legal, and shared dashboard pages
Files: `frontend/src/index.css`, `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/allPagesLiquidGlass.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Applied the landing page's liquid-glass material language to every shared surface: runner sidebars and topbars, page navigation, runner content cards, admin command workspaces, shared dashboard chrome, auth sheets, and legal reading frames. The layer adds warm-paper or midnight atmospheres, translucent tonal surfaces, inset edge highlights, coral focus/CTA states, and a backdrop-filter fallback. Maps, charts, media, modals, popovers, and form controls keep their existing specialized treatment so the information hierarchy stays clear.
Why: Give the complete product one recognizable Hermes material system instead of limiting the new glass language to the public entry surfaces.
Mode: Dual-mode safe; warm aerodynamic paper in light mode and charcoal cinematic glass in midnight mode.
Preserve list: Route structure, authentication and admin guards, page-specific layouts, charts, maps, media, modals, controls, bilingual copy, responsive behavior, and reduced-motion support.
Rollback target: `DV-2026-08-02-02`

### Version: DV-2026-08-02-02
Date: 2026-08-02
Surface: Public landing page `/` — liquid glass treatment
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingLiquidGlass.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a route-scoped liquid-glass layer inspired by `rdev/liquid-glass-react`: the sticky navigation, command-deck cards, daily-answer cards, race/map surfaces, comparison table, and final CTA now use translucent blur/saturation, inset edge highlights, soft chromatic light, and hover depth. The hero keeps its existing warm-paper canvas and scroll-driven shoe interaction, with a restrained light-bend haze behind it. Added a CSS fallback for browsers without backdrop-filter/displacement support and preserved reduced-motion behavior.
Why: Bring the public landing page into the same tactile glass direction as the authenticated entry surfaces without adding a runtime dependency or changing routing, auth actions, data, or the existing hero sequence.
Mode: warm paper + black command deck with CSS-only liquid glass enhancement.
Preserve list: Existing bilingual copy, Strava OAuth start, login/signup links, race countdown/map animation, scroll-rigged shoe, responsive layout, accessibility labels, and reduced-motion fallbacks.
Rollback target: working tree before this change

### Version: DV-2026-08-02-01
Date: 2026-08-02
Surface: `/login`, `/signup`, `/terms`, and `/privacy` — restored warm glass public surface
Files: `frontend/src/components/AuthDotField.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Signup.jsx`, `frontend/src/pages/LegalPage.jsx`, `frontend/src/styles/auth-liquid-glass.css`, `frontend/src/pages/authLiquidGlass.smoke.test.js`, `frontend/src/index.css`, `DESIGN_VERSIONS.md`
What changed: Restored the intended warm paper composition: a restrained, interactive dot field across the page; editorial Hermes copy on the left of auth pages; and a quiet form surface with clearly readable inputs. Removed the secondary outside form panel, outer auth card shell, and card crosshair so the page has one open form layout over the dot field instead of nested grid decorations. The desktop form now fills the right-hand auth column while retaining a small page-edge inset. Privacy now uses a compact reading frame and tighter section rhythm so its overview is easier to scan before scrolling. Desktop-sized auth viewports retain the two-column editorial rail even when display scaling reports less than 1024 CSS pixels, while mobile still stacks naturally. Email/password is the primary first action, while the Strava and Google actions are compact horizontal secondary actions below it. Terms and Privacy use the same quiet paper and translucent sheet without the extra panel.
Why: A previous rollback replaced the intended light reference treatment with a dark neon glass variant, which no longer matched the approved login screenshot or the signup surface.
Preserve list: Existing routes, auth redirects, email/password behavior, OAuth handlers and availability states, reCAPTCHA, bilingual copy, legal content, and accessible focus states.
Rollback target: `DV-2026-07-24-07`

### Version: DV-2026-07-24-07
Date: 2026-07-24
Surface: `/muscle-training` page — auto muscle-area recommendation + check-in persistence gap fix
Files: `backend/.../MuscleTrainingMetricsService.java`, `backend/.../MuscleTrainingPlannerService.java`, `backend/.../MusclePlanDto.java`, `backend/.../MuscleTrainingCheckIn.java`, `backend/.../TodayCheckInUpdate.java`, `backend/.../TodayCheckInDto.java`, `backend/.../MuscleTrainingCheckInService.java`, `backend/.../MuscleTrainingMetricsServiceTest.java`, `backend/.../ProfileControllerTests.java`, `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/i18n/locales/{en,zh-CN}/components.js`, `CONTEXT.md`, `DESIGN_VERSIONS.md`
What changed:
- **Backend — auto muscle-area recommendation.** New `MuscleTrainingMetricsService.deriveRecommendedMuscleArea(metrics, sorenessLevel, injuryRisk, sessionType)` method returns a `RecommendedArea(focus, reasonCode)` via a 7-priority cascade (protective → soreness → high-volume → recent-hard-run → recovery-session → steady-default → fallback), mirroring `todayRun.js`. Wired into `MuscleTrainingPlannerService.getPlan(...)` via `SorenessLogRepository` + `InjuryRiskService` injection; consumes `currentFocus` so it never competes with the existing session plan. Exposed as `recommendedMuscleArea` + `recommendedMuscleReasonCode` on `MusclePlanDto`.
- **Backend — persistence gap fix.** `strengthFocus` + `strengthDose` columns added to `muscle_training_check_in` (ddl-auto, no migration). The check-in DTO/update/service now persist these fields (previously the frontend collected them but the backend dropped them).
- **Frontend — auto-select + banner + pre-fill.** On page load, the recommended focus auto-selects the matching anatomy chip (via a new `FOCUS_TO_TARGET_AREA` bridge map) and a one-line reason banner renders above the chips with localized copy. The check-in strength composer opens pre-filled with the recommended focus. Manual chip clicks set a `userOverrideRef` so the auto-selection never clobbers a manual pick.
- **i18n** — `recommended_area_label` + 7 `recommended_area_reason_*` keys in both EN and ZH.
Why: The page required a manual muscle-part pick; now the coach auto-recommends today's strength focus based on the runner's recovery/load/soreness data, reusing the existing engine. Fills the "auto-recommend instead of manual" gap surfaced in the grilling session.
Rollback target: working tree before this change
Notes: CONTEXT_LEDGER content preserves hold (existing day/type/dose engine untouched; the new recommender consumes its output). 10/10 backend cascade tests pass; 128/128 frontend tests pass; translation parity exit 0; lint clean. Live API verified: mock runner → `POSTERIOR_CHAIN / R_AREA_RECENT_HARD` (recentHardRunCount7d=1, recovery OPEN, load STEADY). Domain glossary captured in `CONTEXT.md` ("Today's Strength Focus", `StrengthFocus`, `StrengthDose`).

### Version: DV-2026-07-24-06
Date: 2026-07-24
Surface: Landing final CTA card (`/`, `.landing-cinematic-final-card--minimal`)
Files: `frontend/src/styles/_split/landing.css`, `DESIGN_VERSIONS.md`
What changed: Refined the final CTA card's visual treatment toward the clean minimalist language. Trust chips converted from a loose flex row of mono labels into a tighter centered 3-cell row with `1px` hairline dividers between cells (`span + span { border-left }`), mono weight 600, more even padding — reads as a refined minimalist grid while keeping `display: flex; justify-content: center` (smoke-guard locked). Card widened slightly (`760px → 820px`) for more breathing room, radius softened (`28px → 24px`), padding increased (`clamp(48–88px) → clamp(56–104px)` top, `clamp(28–32px) → clamp(32–48px)` sides), and trust row given its own larger top margin (`clamp(32–44px)`). All smoke-guard constraints preserved: `background: #f4efe6`, `grid-template-columns: 1fr`, `justify-items: center`, centered copy, h2 `letter-spacing: 0` + clamp font-size, coral-gradient primary button, no proof grids / fake metrics / photo panel.
Why: User asked to redesign the whole final CTA card. The `landingCommandEditorial.smoke.test.js` guard locks the centered single-column structure, so the redesign was applied within those rails — refining the trust row into a cleaner divided grid and giving the card more breathable, editorial rhythm.
Mode: light (warm paper `#f4efe6`, locked by guard).
Preserve list: All `landingCommandEditorial.smoke.test.js` final-CTA assertions retained (verified PASS). Auth redirect, Strava start, login/signup routes, bilingual en/zh copy, coral primary button all untouched.
Rollback target: `DV-2026-07-24-05`

### Version: DV-2026-07-24-05
Date: 2026-07-24
Surface: `/privacy` (Privacy Policy) — `LegalPage variant="privacy"`
Files: `frontend/src/pages/LegalPage.jsx`, `frontend/src/styles/_split/misc.css`, `DESIGN_VERSIONS.md`
What changed: Redesigned `/privacy` to the same clean minimalist white-canvas editorial language as `/terms` (`design.md` §5 + minimalism). Unified the markup so privacy now shares the editorial hero (coral mono kicker, Manrope display title, intro, mono meta row), the editorial section rows (mono `01 / 06` index + heading + body, whitespace-first separation with barely-there hairlines), and the footer signoff (`Do you run today?` / `今天，你跑步了吗？`). The whole page reads as **one continuous white card** (`#fdfcf9`, no borders/shadows): hero (open bottom radius) → signal strip (bridges flush) → sections (open top radius). Privacy keeps its identity minimally: the ShieldCheck `privacy-hero-panel` is now a flat 2-col aside inside the hero (small coral ring icon + mono updated + heading + body, no card chrome), and the `privacy-signal-strip` is a flat inline row of 4 mono-label signals separated by faint hairlines (no card chrome, no staggered margins). Hero is a 2-col grid on desktop (copy + panel), collapsing to single column under tablet; signal strip goes 4 → 2 → 1 column responsively. Removed the heavy gradient hero card, breathing-ring large panel, staggered shadowed signal cards, and the 2-column bordered card grid.
Why: The previous privacy page used a heavier dialect (translucent gradient cards, breathing ring, staggered shadowed signals, bordered card grid) that drifted from the landing gallery and the minimalist `/terms` redesign. Aligning it gives both legal surfaces one coherent premium editorial language.
Mode: light (matches `/terms` and the landing runtime).
Preserve list: All `legalPrivacyRedesign.smoke.test.js` guards retained — JSX still imports `Database, FileCheck2, LockKeyhole, ShieldCheck`, renders `privacy-hero-panel`, `privacy-signal-strip`, `privacySignals.map`, `<HermesLogo tone="dark" />`; CSS still contains `.legal-page--privacy`, `.privacy-hero-panel`, `.privacy-signal-strip`, `#f6f3ec`, `#27221e`, `rgba(255,255,255,0.72)`, `@keyframes legal-privacy-breathe`, `@media (max-width: 640px)`, `min-height: 100dvh`; no negative tracking on `.legal-page-hero h1`; no dark `#121110` on privacy. Bilingual en/zh copy unchanged. Routing, back button, `FooterNavLinks` preserved. `/terms` regression verified (no privacy leakage).
Rollback target: `DV-2026-07-24-04`

### Version: DV-2026-07-24-04
Date: 2026-07-24
Surface: Landing hero shoe animation end frame (`ShoeRunCycle` on `/`)
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `DESIGN_VERSIONS.md`
What changed: Added a coach-like prompt ("Do you run today?" / "今天，你跑步了吗？") that fades in on top of the shoe when the scroll-driven gait animation reaches its final `landed` frame. The prompt is a new `.landing-hero-shoe-cycle-prompt` span inside the `ShoeRunCycle` `<figure>`, positioned at the top of the figure, horizontally centered, in `Manrope` display type (`clamp(1.1–1.75rem)`, weight 600). Visibility is CSS-driven off the figure's existing `data-scroll-state` attribute: opacity 0 → 1 with a 0.5s ease when `data-scroll-state="complete"` (progress ≥ 1, gait `landed`). Reduced-motion users (whose `scrollState` is set to `reduced`) see it statically once the shoe bitmap is ready. Mobile (`≤980px`) still reveals it at scroll `complete`. Bilingual copy added as `landing.cinematic_hero_shoe_prompt` in en + zh-CN.
Why: User asked to show "Do you run today?" on top of the shoe when the animation reaches the end — a closing coach prompt that lands with the final stride.
Mode: light (inherits the landing hero's existing theme treatment).
Preserve list: The scroll-driven gait rig, `SHOE_GAIT_MOTION_STOPS`, focus/center mechanics, hero copy opacity/blur/shift, reduced-motion fallback, and all `landingShoeRunCycle.smoke.test.js` guardrails are untouched. The prompt is additive only (no existing shoe-cycle behavior changed). Mobile and reduced-motion paths verified.
Rollback target: `DV-2026-07-24-03`

### Version: DV-2026-07-24-03
Date: 2026-07-24
Surface: `/terms` hero + section grid (whole Terms content surface) — `LegalPage variant="terms"`
Files: `frontend/src/styles/_split/misc.css`, `DESIGN_VERSIONS.md`
What changed: Unified the Terms hero (`法务说明`/`Hermes legal` kicker + `服务条款`/`Terms of Service` title + intro + meta) and the 6 editorial section rows into **one continuous clean white minimalist card** (`#fdfcf9`, no border, no shadow) sitting on the vellum page. The editorial hero now uses the same white canvas as the sections (open bottom radius `24px 24px 0 0`) and connects flush to the sections panel (open top radius `0 0 24px 24px`) with `gap: 0` and a single faint divider (`1px rgba(48,44,38,0.07)`) between hero and rows. Inside the sections: whitespace-first row separation with barely-there hairlines (`inset 0 1px 0 rgba(48,44,38,0.07)`, first-child none), near-imperceptible hover lift (`rgba(32,32,29,0.018)`), lightened mono index (`rgba(32,32,29,0.32)`) that shifts to coral `#f2664f` on hover, tighter `0.16fr` index column, refined subheads (`clamp(1.35–1.75rem)`, `-0.005em` tracking), roomier body (`line-height 1.78`). Removed the hero's decorative radial `::before`/`::after` overlays. Fixed a cascade bug where `.legal-page-hero` card chrome (shadow/28px padding) was leaking onto `.legal-page-hero--editorial`. Radii scale to `22px` on mobile; rows stack single-column under tablet.
Why: User asked to apply the clean minimalism to the hero (`服务条款`) too, for consistency with the section grid. The hero+sections now read as a single restrained white editorial surface instead of a hero-on-vellum plus a separate card.
Mode: light (Terms-only scope).
Preserve list: Privacy variant fully untouched — verified hero card (shadowed), hero-panel, 4 signals, 6 cards intact, no editorial hero/sections leakage. Routing, back button, `FooterNavLinks`, `<HermesLogo tone="dark" />`, en/zh copy, and all `legalPrivacyRedesign.smoke.test.js` guards preserved. No user-visible copy changed.
Rollback target: `DV-2026-07-24-02`

### Version: DV-2026-07-24-02
Date: 2026-07-24
Surface: `/terms` (Terms of Service) — `LegalPage variant="terms"`
Files: `frontend/src/pages/LegalPage.jsx`, `frontend/src/styles/_split/misc.css`, `DESIGN_VERSIONS.md`
What changed: Redesigned the Terms page to the Light Aerodynamic Gallery language shared with the landing runtime (`design.md` §5). Replaced the equal-weight 2-column cream card wall with a flat editorial layout: sticky glass header, coral-dot mono kicker, large `Manrope` display title (weight 520), `Inter` intro + mono `EFFECTIVE · N SECTIONS` meta row, then asymmetric editorial section rows (mono `01 / 06` index + `Manrope` subhead + `Inter` body) separated only by hairline rules (`rgba(48,44,38,.16)`) with a tonal paper hover step — no card borders, no default shadows. Local tokens mirror the landing vellum canvas (`#f6f1e8 → #efe8dc`), coral `#f2664f`, and the `Manrope`/`Inter`/`JetBrains Mono` pairing. Rows collapse to a stacked single column under tablet; `prefers-reduced-motion` disables hover/padding transitions.
Why: The previous Terms layout drifted from the landing's refined editorial gallery (generic cream cards, no mono metadata rhythm, bordered containment). Aligning it with the landing gives the legal surface the same premium, breathable, coach-like feel.
Mode: light (dual-mode-safe; matches the landing runtime which is light-mode vellum).
Preserve list: Privacy variant structure and all privacy CSS (`privacy-hero-panel`, `privacy-signal-strip`, `legal-page-card-index`, privacy keyframes) are untouched. Routing (`/terms`, `/privacy`), auth-aware back button, `FooterNavLinks`, `<HermesLogo tone="dark" />`, bilingual en/zh copy (unchanged), and all `legalPrivacyRedesign.smoke.test.js` guards are preserved.
Rollback target: working tree before this change
Notes: Privacy redesign marks (`#f6f3ec`, `#27221e`, `rgba(255,255,255,0.72)`) retained as fallback tokens/comments in `_split/misc.css` and remain present in the legacy `style.css` bundle for the smoke guard. No user-visible copy changed.

### Version: DV-2026-07-24-01
Date: 2026-07-24
Surface: Landing final CTA card on `/` (`为你的下一场比赛训练得更聪明。`)
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Converted the final CTA from a 2-column (copy + hero photo panel) layout to a single centered warm-paper minimal card. Removed the right-side `landing-cinematic-final-bg` photo panel and the grid-pattern overlay. Added a scoped `.landing-cinematic-final-card--minimal` modifier: single-column centered grid, warm `#f4efe6` surface (no border / no shadow, per §3.1 No-Line Rule), generous padding, centered copy stack, centered Strava + email CTAs (primary keeps the §5 coral gradient `#a0392a→#fc7e69`), and the 3 trust chips restyled as a centered flex row of mono labels. Chinese title held on one line at desktop via `white-space: nowrap !important` (CONTEXT_LEDGER single-line requirement).
Why: The previous 2-column photo-panel layout felt heavy and inconsistent with the minimalist direction of the surrounding sections. A single centered warm card gives a cleaner, more decisive conversion close.
Rollback target: working tree before this change
Notes: Scoped — no cascade leakage. CONTEXT_LEDGER content/theme preserves respected: Strava + email actions, dark-ink heading/paragraph, trust chips, single-line desktop Chinese title, warm page-matching theme, no proof grids, no fake `2:52`/`82%` metrics, no off-theme dark block. Other sections unchanged. 128/128 tests pass; the final-CTA smoke-test assertion was repointed to the new warm-minimal contract.

### Version: DV-2026-07-23-01
Date: 2026-07-23
Surface: Landing `#features` command-deck grid (the 3-card bento)
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandHeroBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Applied the design.md §10 Minimalist Black Grid treatment to the landing `#features` command deck only. Added a scoped `landing-command-deck--minimal-black` modifier. Section canvas is now near-black `#0a0a0b`; all three cards share one dark surface `#121214` with near-white ink `#f4f4f5`. Removed the old per-card warm-paper gradients, the lone dark-accent `:first-child` gradient, the decorative `::after` glow rings, and the box-shadow separators. Hierarchy now comes from the bento spans (focal card 7 cols × 2 rows), not color contrast. The single coral accent `#d85f4c` is reserved for the index numbers and metrics only. Hover shifts `surface → surface-raised` (`#1a1a1d`) over 0.2s; no scale/lift.
Why: User approved a full-black minimalist aesthetic for the grid; the previous warm-paper-with-one-dark-card hybrid read as an inconsistent "weird black theme." Codified the treatment in design.md §10 and applied it here as the reference implementation.
Rollback target: working tree before this change
Notes: Scoped — hero, races, comparison, and final CTA remain on the warm-paper light theme (verified no cascade leakage). Routing, auth, Strava wiring, i18n, and the 12-col bento structure unchanged. Ink/surface contrast ≈ 14.5:1 (AAA). 128/128 tests pass; one smoke-test class regex loosened to accept the modifier.

### Version: DV-2026-07-22-08
Date: 2026-07-22
Surface: Public landing feature deck on `/` (`#features`)
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `.ai-sync/CUSTOMER_PLAYTEST_GATE.md`, `DESIGN_VERSIONS.md`
What changed: Replaced the feature deck's half-empty two-column shell with a full-width 12-column asymmetric composition. The primary “should I run?” decision now spans the full left side across both rows, while progress and shoe decisions form two compact supporting cards on the right. Cards use tonal surfaces, restrained ambient depth, larger editorial metrics, and subtle track-ring details; below 900px the layout collapses to a strict single column.
Why: The deck had only one child inside a two-column outer grid, so the entire right half of the section was reserved but empty. The new composition uses the available width, keeps one clear decision hierarchy, and reduces vertical padding without adding copy or controls.
Rollback target: `DV-2026-07-22-07`
Notes: Computer Use browser proof confirmed the desktop deck fills the section with no dead column and the 400px responsive view collapses cleanly. The existing three bilingual content blocks, glyphs, metrics, anchor, hero handoff, navigation, and downstream sections are unchanged. Focused landing guards, ESLint, the production Vite build, and `git diff --check` passed; the repository's optional frontend runtime-sync verifier is absent on this checkout.

### Version: DV-2026-07-22-07
Date: 2026-07-22
Surface: Public landing hero identity-locked running gait on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/assets/generated/run-gait-v2/evo-sl-side-master.png`, `frontend/src/assets/generated/run-gait-v2/evo-sl-side-master.webp`, `frontend/src/pages/landingShoeRunCycle.smoke.test.js`, `.ai-sync/CUSTOMER_PLAYTEST_GATE.md`, `DESIGN_VERSIONS.md`
What changed: Replaced the 11-image scroll scrub with one immutable, side-on EVO SL bitmap rendered on the existing persistent canvas. Scroll now rigs that single shoe through eased loading, midstance compression, forefoot-pivoted heel rise and toe-off, a flight arc, toe-up terminal swing, heel-first initial contact, and a flat final landing. The timeline assigns 38% to contact/stance and 62% to aerial/swing instead of distributing arbitrary product-photo poses evenly.
Why: The supplied/generated frames changed camera perspective, shoe proportions, branding, and sole geometry, so the sequence read as different images replacing one another rather than one shoe running. One identity-locked rig preserves continuity and removes the frame boundary that caused visible blinking.
Rollback target: `DV-2026-07-22-06`
Notes: The side-on master was created with the built-in image workflow on a removable chroma background, converted locally to alpha, and validated with transparent corners and 21.75% subject coverage. Desktop browser proof at 1280×720 confirmed exact gait milestones at progress `0.380` (toe-off), `0.680` (flight), `0.939` (initial contact), and `1.000` (landed); the feature grid begins immediately afterward. Compact 390×844 remains static with copy visible and zero horizontal overflow. No console warning/error was produced.

### Version: DV-2026-07-22-06
Date: 2026-07-22
Surface: Public landing hero scroll-focus transition on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingShoeRunCycle.smoke.test.js`, `.ai-sync/CUSTOMER_PLAYTEST_GATE.md`, `DESIGN_VERSIONS.md`
What changed: Added a scroll-driven focus transition to the pinned hero. The opening two-column composition remains intact at rest; during the first 14% of desktop hero scrolling, the full left copy group fades, blurs, and shifts away while the shoe moves from the right column to the exact grid center and scales up slightly. The centered shoe then continues the existing one-way frame scrub to the landing pose before the next grid enters.
Why: The user wanted the first grid to become a shoe-only stage once scrolling begins instead of keeping the headline, paragraph, and actions beside the animation.
Rollback target: `DV-2026-07-22-05`
Notes: Hidden hero controls become inert and pointer-inactive, then recover when scrolling back to the top. Compact layouts keep the stacked copy visible and do not apply the centering transform; reduced-motion behavior remains static. The single-canvas renderer and final-frame handoff are unchanged.

### Version: DV-2026-07-22-05
Date: 2026-07-22
Surface: Public landing hero scroll sequence on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingShoeRunCycle.smoke.test.js`, `.ai-sync/CUSTOMER_PLAYTEST_GATE.md`, `DESIGN_VERSIONS.md`
What changed: Replaced the autonomous 1.2-second shoe loop with a one-way, scroll-scrubbed sequence. The first pose remains still on entry, the desktop hero grid pins for a 240-viewport scroll track, all supplied and midpoint poses advance with scroll, the last supplied landing pose holds at completion, and the sticky grid then releases into the feature grid.
Why: The user wanted the first grid to take over the viewport and make the shoe motion part of page progression instead of an endlessly running decoration.
Rollback target: `DV-2026-07-22-04`
Notes: The loop-closure pose is no longer imported, so the sequence cannot restart before the next grid. The persistent high-DPI canvas remains in place to prevent blinking. Smaller screens use normal document flow, reduced-motion users keep the first pose, and route-scoped `overflow-x: clip` preserves sticky positioning without horizontal overflow.

### Version: DV-2026-07-22-04
Date: 2026-07-22
Surface: Public landing hero shoe run-cycle rendering on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingShoeRunCycle.smoke.test.js`, `.ai-sync/CUSTOMER_PLAYTEST_GATE.md`, `DESIGN_VERSIONS.md`
What changed: Replaced the frame-by-frame `<img>` visibility stack with one persistent high-DPI canvas. All 12 WebP poses are loaded and decoded first, then drawn synchronously onto the same surface at the existing 100 ms cadence while the 1.2-second stride transform continues on its wrapper.
Why: The user could see a blink between poses. Runtime probing confirmed that image source boundaries could briefly expose no decoded bitmap even after preloading; the canvas keeps the previous pixels mounted until the next decoded pose is drawn in the same browser task.
Rollback target: `DV-2026-07-22-03`
Notes: The shoe artwork, pose order, road-running cadence, responsive layout, and reduced-motion fallback are unchanged. The final renderer has one canvas and zero animated image layers, avoiding both blank gaps and crossfade ghosting.

### Version: DV-2026-07-22-03
Date: 2026-07-22
Surface: Public landing hero shoe run-cycle cadence on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingShoeRunCycle.smoke.test.js`, `.ai-sync/CUSTOMER_PLAYTEST_GATE.md`, `DESIGN_VERSIONS.md`
What changed: Slowed the synchronized 12-frame shoe animation from a 0.72-second loop to a 1.2-second loop. Each pose now holds for 100 ms instead of 60 ms, and the plant-push-flight-land transform uses the same 1.2-second duration so the shoe reads as one steady road-running stride rather than a rapidly advancing image sequence.
Why: The user reported that the prior cadence moved too quickly and did not resemble running on a road.
Rollback target: `DV-2026-07-22-02`
Notes: The existing shoe assets, frame order, one-visible-frame contract, responsive layout, and reduced-motion fallback are unchanged.

### Version: DV-2026-07-22-02
Date: 2026-07-22
Surface: Public landing hero shoe run-cycle on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/assets/generated/run-cycle/*.webp`, `frontend/src/pages/landingShoeRunCycle.smoke.test.js`, `.ai-sync/CUSTOMER_PLAYTEST_GATE.md`, `DESIGN_VERSIONS.md`
What changed: Added a shoe-only 12-frame stride animation beside the “More Than / Just Tracking. / Every Stride.” hero headline. Six generated midpoint poses now sit between the six supplied keyframes—including the landing-to-next-heel-strike loop closure—while the hero keeps a responsive two-column stage on desktop, collapses the shoe beneath the copy on smaller screens, waits for every frame before looping, and moves one visible shoe through a synchronized plant-push-flight-land path. Reduced-motion users keep a static first pose.
Why: The user supplied six run-cycle keyframes, asked for the shoe to be isolated and animated beside the landing-page headline, then requested additional frames so the motion reads as a smoother run rather than image swapping.
Rollback target: `DV-2026-07-22-01`
Notes: The source keyframes and six generated in-betweens were edited with the built-in image workflow onto a removable chroma background and converted to alpha WebP assets (about 511 KiB total). The final 0.72-second loop advances every 60 ms, deliberately avoids crossfade ghosting, and keeps exactly one shoe visible. Existing landing copy, auth actions, routing, feature sections, and data wiring are preserved.

### Version: DV-2026-07-22-01
Date: 2026-07-22
Surface: Public landing page minimalist refresh on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/pages/landingCommandHeroBackground.smoke.test.js`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `DESIGN_VERSIONS.md`
What changed:
- Removed three dense, unlocked sections from the landing: the Coach Voice giant-quote block, the interactive 4-toggle Formula explorer (VDOT/ACWR/recovery/paces with equation + proof + steps), and the 6-row Training Zones table.
- Simplified the hero to a flat warm-paper surface (`#f4efe6`) with no photo/scrim plate, a single primary "Continue with Strava" CTA plus a quiet "Email sign-up" text link, and a plain coral (`#d85f4c`) accent headline line instead of the multi-stop text gradient.
- Cut the dead legacy CSS layers (`.landing-page`, `.landing-page--notebook`, `.landing-page--notebooklm`, `.landing-v2`, `.landing-page--editorial`) — `landing.css` went from 5722 to ~3360 lines, ~42% reduction with zero rendered change to those layers.
- Fixed a pre-existing bilingual bug: the three command-card metrics were hardcoded Chinese; they are now i18n keys (`landing.command_card_*_metric`) in both `en` and `zh-CN`.
- Resulting landing structure: Nav → Hero (minimal) → Command Deck (3 cards) → Daily Answers (3 questions) → Races (locked) → Comparison (locked) → Final CTA (locked) → Footer.
Why: The landing was maximalist (9 sections, ~7055px tall, dense data tables and an interactive formula widget competing for focus). The refresh targets `design.md §3.3` (cinematic hierarchy / one clear focal point) and §3.1 (tonal separation over hard lines) by reducing section count and visual load while preserving the locked race map, comparison chart, and final CTA contracts.
Rollback target: working tree before this change
Notes: Preserved exactly — auth redirect (`/dashboard` or `/profile`), Strava OAuth start, login/signup routes, the calibrated race map (anchors, spreading-circle animation, 10 labels), the objective comparison chart (honest Runna race-plan win + Strava import credit), and the warm-paper final CTA card with Strava + email actions and trust chips. No routing, backend, or data wiring changed. Locale copy updated in both languages.

### Version: DV-2026-06-23-09
Date: 2026-06-23
Surface: Muscle Training exercise anatomy mapping on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added explicit `EXERCISE_HEATMAP_SLUGS` mappings for every compound-library action and runner-specific action, then changed the exercise detail anatomy panel to use those mappings before falling back to display-text parsing.
Why: Display labels like “Legs”, “Core”, or localized muscle names could over-broaden or miss the actual muscles used by a specific action. Every action now has a deliberate front/back muscle highlight target.
Rollback target: working tree before this change
Notes: Exercise list behavior, top muscle selector, media rail, coach controls, APIs, and backend behavior are unchanged.

### Version: DV-2026-06-23-08
Date: 2026-06-23
Surface: Muscle Training recommendation/grid removal on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/muscle-training-profile-alignment.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the visible `mt-recommend` recommendation band and the standalone target/session `mt-side-grid` cards shown below the top muscle workbench, so the page now moves directly from the anatomy workbench into the exercise protocol list and media rail.
Why: The displayed grid panels duplicated information and did not fit the desired page composition.
Rollback target: working tree before this change
Notes: Top muscle selector, exercise filters, exercise rows, media rail, coach controls, APIs, and backend behavior are unchanged.

### Version: DV-2026-06-23-07
Date: 2026-06-23
Surface: Muscle Training heatmap highlight palette on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/muscle-training-profile-alignment.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the top anatomy selector's neon yellow/green SVG path highlight with Hermes coral/warm red CSS-variable-driven fill and stroke tokens, and added route-scoped heatmap defaults/hover styling so selected muscles read as part of the Profile-aligned visual system.
Why: The bright neon highlight looked disconnected from the rest of the website and made the selected muscles feel like a separate overlay instead of anatomical focus.
Rollback target: working tree before this change
Notes: Muscle selection behavior, SVG path click handling, exercise recommendations, APIs, and backend behavior are unchanged.

### Version: DV-2026-06-23-06
Date: 2026-06-23
Surface: Muscle Training hero removal on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/muscle-training-profile-alignment.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the `mt-hero` section and its weekly-completion ring/CTA from the Muscle Training route, then cleaned the profile-alignment stylesheet and smoke guardrail so the page now flows from the top muscle workbench directly into the recommendation banner.
Why: The route should not render the separate `mt-hero` block.
Rollback target: working tree before this change
Notes: Top muscle selector, recommendation banner, target cards, exercise rows, media rail, coach controls, APIs, and backend behavior are unchanged.

### Version: DV-2026-06-23-05
Date: 2026-06-23
Surface: Muscle Training profile-aligned design language on `/muscle-training`
Files: `frontend/src/index.css`, `frontend/src/styles/muscle-training-profile-alignment.css`, `DESIGN_VERSIONS.md`
What changed: Added a late-loaded profile-alignment stylesheet scoped to the existing Muscle Training route markers that translates the page from the separate black/neon strength-lab dialect into the Profile Dashboard's Kinetic Editorial system: warm light canvas, matching dark-mode tokens, profile-style sidebar/topbar, rounded vellum cards, cinematic dark hero, coral accent states, restored recommendation/support cards, and profile-like exercise/control surfaces.
Why: The Muscle Training route shared the runner shell but visually diverged from `/profile`; it needed to read as the same product surface without changing coaching logic.
Rollback target: working tree before this change
Notes: Muscle plan APIs, exercise selection, SVG heatmap interactions, localized copy, check-in form behavior, and backend training behavior are unchanged.

### Version: DV-2026-06-23-04
Date: 2026-06-23
Surface: Muscle Training full-screen grid layout on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed width caps from the Muscle Training route canvas/content, made the page grid fill the available viewport height, stretched the top workbench across the full route width, and expanded the lower protocol grid/control sections to full-width route proportions.
Why: The Muscle Training page grids felt boxed in; the route should use the full runner-shell screen rather than a centered 1360px content island.
Rollback target: working tree before this change
Notes: Muscle selection logic, SVG highlighting, exercise recommendations, APIs, and backend behavior are unchanged.

### Version: DV-2026-06-23-03
Date: 2026-06-23
Surface: Muscle Training top muscle selector on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the raster `anatomy-neon-selector.png` inside `mt-muscle-visual` with the existing MIT `react-muscle-highlighter` SVG body diagram, using front/back views and target-group highlight data while preserving the transparent hit-zone layer and target buttons.
Why: The top selector needed a license-clear, scalable muscle diagram instead of a user-provided PNG asset.
Rollback target: working tree before this change
Notes: Target area selection state, recommendation logic, exercise library, APIs, and backend behavior are unchanged.

### Version: DV-2026-06-23-02
Date: 2026-06-23
Surface: Muscle Training top muscle selector on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Made `mt-top-panel mt-top-muscle-card` a concrete four-row grid, added a visible neon grid/backplate around the anatomy image, bounded the image sizing, and gave the target shortcut grid stable row sizing. Removed the separate floating hit-zone overlay from the top anatomy selector; the live `react-muscle-highlighter` SVG muscle paths are now the visual and clickable hit zones. Added SVG-path hover feedback, a hard CSS fallback that hides any legacy overlay markup if it reappears, and direct selected-path styling so the active muscle group visibly lights up.
Why: The top selector now renders a live SVG anatomy map. A separate absolute overlay can drift between the front/back bodies and break apart visually, so the only reliable hit-zone is the actual SVG muscle path. The previous selected-state styling was too weak on this diagram, so the active target now gets explicit SVG path styling.
Rollback target: working tree before this change
Notes: Exercise recommendation logic, target selection state, copy, APIs, and backend muscle-training behavior are unchanged.

### Version: DV-2026-06-23-01
Date: 2026-06-23
Surface: Runner Heatmap on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/pages/heatmapStability.smoke.test.js`, `frontend/src/pages/heatmapMobileOverlay.smoke.test.js`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/heatmap.css`, `DESIGN_VERSIONS.md`
What changed: Reworked the current-view sessions drawer so it is always present on desktop, summarizes runs and distance inside the visible map viewport, and derives those sessions from real heatmap GPS `activityId` coverage instead of unavailable activity start coordinates. Stabilized zoom rendering with a padded GPS canvas and Leaflet renderer-style `_getNewPixelOrigin` transform so the dot layer follows the map during zoom and repaints after zoom settles.
Why: The previous sessions drawer could stay empty because the activity feed does not expose `startLatitude`/`startLongitude`, and the zoom animation could swap visible dots from full to preview styling, making the heatmap feel unstable.
Rollback target: working tree before this change
Notes: Heatmap point loading, caching, Leaflet mount lifecycle, speed color legend, route-dot canvas drawing, and backend heatmap APIs are unchanged.

### Version: DV-2026-06-15-59
Date: 2026-06-15
Surface: Public landing final CTA on `/`
Files: `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Widened and centered the final CTA copy container, reduced the desktop title scale slightly, and forced the Chinese CTA title to stay on one line above tablet width.
Why: The CTA headline wrapped awkwardly and the composition did not feel fully centered.
Rollback target: `DV-2026-06-15-58`
Notes: CTA markup, copy, Strava/email actions, trust chips, no-grid layout, routes, race map, comparison chart, and formula panels are unchanged.

### Version: DV-2026-06-15-58
Date: 2026-06-15
Surface: Public landing final CTA on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Removed the three activation/proof grids from the final CTA and tightened the card into a focused warm single-column CTA with headline, copy, actions, and trust chips.
Why: The three grids created cramped vertical text and distracted from the signup action.
Rollback target: `DV-2026-06-15-57`
Notes: Strava/email actions, trust claims, warm page-matching card theme, routes, race map, comparison chart, and formula panels are unchanged.

### Version: DV-2026-06-15-57
Date: 2026-06-15
Surface: Public landing final CTA on `/`
Files: `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Re-themed the final CTA from an isolated dark block into a warm paper/vellum card that matches the surrounding landing sections while preserving the three-step activation flow.
Why: The dark CTA card felt disconnected from the page's warm editorial theme.
Rollback target: `DV-2026-06-15-56`
Notes: CTA markup, translated activation-flow copy, Strava/email actions, trust chips, routes, race map, comparison chart, and formula panels are unchanged.

### Version: DV-2026-06-15-56
Date: 2026-06-15
Surface: Public landing final CTA on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Reworked the final CTA again into a stable dark conversion card with a meaningful three-step activation flow: connect Strava, read training history, open today's answer.
Why: The previous split proof-ticket layout looked broken at the live browser width and used fake race/readiness metrics that did not explain the signup value.
Rollback target: `DV-2026-06-15-55`
Notes: Strava and email signup actions, trust chips, routes, race map, comparison chart, and formula panels are unchanged.

### Version: DV-2026-06-15-55
Date: 2026-06-15
Surface: Public landing final CTA on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Redesigned the final CTA from a flat foggy slab into a two-column editorial decision-ticket grid with dark CTA copy, warm proof cards, readiness/race metrics, and responsive collapse.
Why: The previous CTA had low contrast and an unused empty right side; the new grid makes the product promise tangible while preserving the Strava and email actions.
Rollback target: `DV-2026-06-15-54`
Notes: CTA copy meaning, auth actions, route targets, race map, comparison chart, and formula panels are unchanged.

### Version: DV-2026-06-15-54
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Removed the generated SVG race readout paths that drew diagonal coral lines across the world map.
Why: The lines looked like map artifacts and distracted from the intended race-pin spread animation.
Rollback target: `DV-2026-06-15-53`
Notes: Race pins, calibrated marathon locations, spread-circle animation, timeline chips, guide cards, captions, and comparison chart are unchanged.

### Version: DV-2026-06-15-53
Date: 2026-06-15
Surface: Public landing comparison chart on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the comparison chart as an explained objective table: Runna is credited for structured race-plan calendars, Strava is credited for history import, and Hermes is positioned around transparent formulas, local/private analysis, shoe decisions, and no-feed coaching.
Why: The chart needed to be fair to competitors while still making Hermes' real website advantages obvious.
Rollback target: `DV-2026-06-15-52`
Notes: Compare section only; race map, hero, CTAs, routes, and formula panels are unchanged.

### Version: DV-2026-06-15-52
Date: 2026-06-15
Surface: Public landing comparison chart on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebalanced the Strava column to mark public capabilities objectively: partial for workout/load/offline-like support and yes for shoe tracking plus EN/ZH language support.
Why: The previous Strava column was too absolute and marked several real Strava capabilities as unavailable.
Rollback target: `DV-2026-06-15-51`
Notes: Chart layout, Runna column, Hermes column, CTAs, race map, and routes are unchanged.

### Version: DV-2026-06-15-51
Date: 2026-06-15
Surface: Public landing comparison chart on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Reworked the comparison table into a bordered light-surface chart with compact columns, cell dividers, wrapped comparison cells, centered glyph badges, and visible unavailable/partial states.
Why: The chart looked broken on the light landing page because the old dark-theme no marks were nearly invisible and the table lacked enough structure.
Rollback target: `DV-2026-06-15-50`
Notes: Comparison copy, row data, race map, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-50
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Increased the race-point spread visibility with a stronger translucent coral fill, `1.4px` outline, and higher opacity during expansion.
Why: Browser-plugin inspection showed the wave was technically animating but visually too faint to read reliably.
Rollback target: `DV-2026-06-15-49`
Notes: Race anchors, pin markup, captions, guide deck, race rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-49
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Strengthened the active race spread with a translucent fill, thicker coral outline, higher opacity, and larger radius expansion to `r: 86`.
Why: Browser inspection showed the radius was animating, but it was too faint to read visually as a spreading wave.
Rollback target: `DV-2026-06-15-48`
Notes: Race anchors, pin markup, captions, guide deck, race rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-48
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Replaced the active race wave's SVG transform scaling with direct radius animation from `r: 1.2` to `r: 72`.
Why: The user reported the spread did not read as an animation; animating the circle radius makes the wave visibly expand from the race point.
Rollback target: `DV-2026-06-15-47`
Notes: Race anchors, pin markup, captions, guide deck, race rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-47
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Expanded the active race spread from a local pulse into a gradual full-map wave that grows from the selected race point during its active slot.
Why: The user clarified the animation should be a race point spreading out throughout the map, not just a small nearby circle.
Rollback target: `DV-2026-06-15-46`
Notes: Race anchors, captions, guide deck, race rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-46
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Added a per-race map-wide spreading circle from the active race pin, synchronized to the existing race selection cycle.
Why: The user wanted the animation to show the selected race point radiating through the map instead of only using a small local ping.
Rollback target: `DV-2026-06-15-45`
Notes: Race anchors, captions, guide deck, race rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-45
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recalibrated the Comrades Ultra Marathon marker from the projected ocean gap between Africa and Madagascar onto the visible southeast-Africa landmass.
Why: The user flagged Comrades again; PNG crop inspection showed the prior projection-based anchor still sat offshore on the actual raster map.
Rollback target: `DV-2026-06-15-44`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-44
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Comrades Ultra Marathon marker down and east to the Durban/Pietermaritzburg corridor in southeast South Africa.
Why: The user flagged Comrades as wrong; the previous anchor sat too far north/west for the actual race region on the raster map.
Rollback target: `DV-2026-06-15-43`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-43
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Sydney Marathon marker from an offshore Pacific raster gap to a visible southeast-Australia land point.
Why: The user flagged Sydney as wrong; pixel inspection showed the previous Sydney anchor was transparent/offshore east of Australia.
Rollback target: `DV-2026-06-15-42`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-42
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Valencia Marathon marker from the western-Mediterranean island area to a visible east-coast Spain point.
Why: The user flagged Valencia as wrong; visual raster inspection showed the previous Valencia anchor read east of Spain rather than on the Iberian coast.
Rollback target: `DV-2026-06-15-41`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-41
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Paris Marathon marker west/northwest from a central-Europe-looking raster position to a visible northern-France point.
Why: The user flagged Paris as wrong; visual raster inspection showed the previous Paris anchor read too far east of France.
Rollback target: `DV-2026-06-15-40`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-40
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Berlin Marathon marker west/northwest from the far-eastern Europe raster position to a visible Germany-region point.
Why: The user flagged Berlin as wrong; visual raster inspection showed the previous Berlin anchor read too far east of Germany.
Rollback target: `DV-2026-06-15-39`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-39
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the London Marathon marker from mainland Europe to a visible southeast-UK land point on the stylized map.
Why: The user flagged London as wrong; pixel inspection showed the previous London anchor sat on continental Europe instead of the UK island.
Rollback target: `DV-2026-06-15-38`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-38
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Tokyo Marathon marker from the offshore Pacific raster gap to a visible east-side Japan land point on the stylized map.
Why: The user flagged Tokyo as wrong; pixel inspection showed the previous Tokyo anchor was transparent/offshore on the current map asset.
Rollback target: `DV-2026-06-15-37`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-37
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the New York City Marathon marker from the offshore raster gap to a visible Atlantic-coast point south/southwest of the corrected Boston marker.
Why: The user flagged New York as wrong; pixel inspection showed the previous New York anchor was transparent/offshore on the current map asset.
Rollback target: `DV-2026-06-15-36`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-36
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the Boston Marathon marker from the offshore Atlantic/Canada-side raster gap to a visible northeast-US coastal point on the stylized map.
Why: The user flagged Boston as wrong; pixel inspection showed the previous Boston anchor was transparent/offshore on the current map asset.
Rollback target: `DV-2026-06-15-35`
Notes: Other race anchors, centered numbered badges, guide/caption deck, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-35
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the detached numbered race callouts with compact centered numbered badges, then retuned the raster-map anchors so Tokyo sits on Japan, Sydney on Australia's east coast, and Comrades sits on eastern South Africa.
Why: The user reported the race points were still wrong; browser inspection showed the numbered labels were translated away from the true dot, and pixel inspection showed some anchors were only snapped to nearby land rather than the intended city region.
Rollback target: `DV-2026-06-15-34`
Notes: City anchors, race data, translated labels, guide/caption deck, timeline, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-34
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recalibrated the ten race-map anchors from nearest-land snaps to visible city-region positions: Tokyo sits on Japan, Sydney on southeast Australia, Comrades on eastern South Africa, and the US/Europe pins stay on their intended race regions.
Why: The user reported the race points were still wrong; the prior correction only guaranteed a point touched some land pixel, which could still place coastal races on the wrong coastline or island.
Rollback target: `DV-2026-06-15-33`
Notes: Race data, translated labels, guide/caption deck, timeline, table rows, CTAs, and routes are unchanged.

### Version: DV-2026-06-15-33
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added stable race IDs and PNG-calibrated city anchors for all ten landing race-map pins, while preserving the real lat/lng values for each marathon.
Why: The user reported the race points were still in the wrong places; the generic projection left several coastal races on transparent ocean pixels in the static map asset.
Rollback target: `DV-2026-06-15-32`
Notes: Race list, labels, table rows, guide/caption deck, CTAs, and routes are unchanged; this only corrects pin placement against the current map PNG.

### Version: DV-2026-06-15-32
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Moved the race-map guide chips and active race caption into a shared bottom overlay deck with separate grid lanes, preventing the left guide stack from colliding with the right caption card.
Why: The user reported the lower map grids conflicted visually; the previous absolute-positioned guide and caption overlapped on the current browser width.
Rollback target: `DV-2026-06-15-31`
Notes: Race projection, race data, timeline chips, table rows, auth routes, and CTAs are unchanged; this only separates the map overlay lanes.

### Version: DV-2026-06-15-31
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the landing race-map marker projection from linear equirectangular math to Robinson coefficient interpolation so marathon pins align with the curved political map asset.
Why: The user reported the race points were in the wrong places; the old linear projection put Pacific-side races like Tokyo and Sydney into the ocean on the curved map.
Rollback target: `DV-2026-06-15-30`
Notes: Race names, dates, goals, map asset, table animation, auth routes, and CTAs are unchanged; this is a projection-correctness fix.

### Version: DV-2026-06-15-30
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Expanded the landing race-map sequence from five races to ten famous marathons, adding London, New York City, Paris, Valencia, and Sydney. The animation duration now derives from the race count so every pin/readout/row highlight keeps its own phase.
Why: The user asked to add more famous marathons, and the old fixed 15-second loop would have made added races overlap the original five.
Rollback target: `DV-2026-06-15-29`
Notes: Race section behavior, auth routes, CTAs, and formula panels are unchanged; this is a race-map content and timing update.

### Version: DV-2026-06-15-29
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the latest pulse-heavy race-map playback with a clearer diagram sequence: the active race pin draws an insight line into the metric card, date/countdown/goal read in order, and the matching table row highlights only at the end of that race slot.
Why: The user reported the current animation still felt weird and meaningless; this version makes the motion explain how Hermes turns a race location into structured race-table guidance.
Rollback target: `DV-2026-06-15-28`
Notes: Race data, map asset, pin projection, translated column labels, navigation, auth routes, and formula panels are unchanged.

### Version: DV-2026-06-15-28
Date: 2026-06-15
Surface: Profile no-data empty state on `/profile`
Files: `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/profile.css`, `frontend/src/styles/_split/light-theme-overrides.css`, `frontend/src/styles/style.css`, `frontend/src/pages/profileEmptyStateActions.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the no-run Profile state into an import-first onboarding panel with Strava and file-import actions, a three-step data-unlock walkthrough, and a no-sample-data trust note.
Why: The previous empty state sent new users to Today Run before Profile had real data; the new state points them toward the data source that actually unlocks VDOT, load, readiness, and weekly-change signals.
Rollback target: `DV-2026-06-15-27`
Notes: Existing dashboard data loading, Strava linking flow, authenticated route guard, and populated Profile dashboard behavior are unchanged.

### Version: DV-2026-06-15-27
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the race-map score-card/plan-rail animation with a simpler fixed-pin playback: the active race pin gets a location lock, the guide reads locate/read/match, and the same race's timeline chip, caption, and table row highlight together.
Why: The previous animation still felt weird and over-explained the diagram with artificial route and scoring overlays; this version keeps motion tied to what the user can actually read on the map and table.
Rollback target: `DV-2026-06-15-26`
Notes: Race data, map asset, pin projection, CTAs, navigation, auth routes, and formula panels are unchanged.

### Version: DV-2026-06-15-26
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the race-map motion into a slower 15-second explanatory cycle with three visible flow steps: select race, score date/countdown/goal inside Hermes, and update the matching race row.
Why: The prior packet animation still read as abstract moving UI tokens; the user asked for a new animation that makes sense and helps visualize the diagram.
Rollback target: `DV-2026-06-15-25`
Notes: The race data, map geography, table rows, CTAs, and routes are unchanged; the smoke guard now requires the 3-step flow legend, 3-second race cadence, request question marker, hub fills, output line, and table-row update.

### Version: DV-2026-06-15-25
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the small moving dot tokens with card-shaped request and recommendation packets, added visible mini row targets on the map's table rail, and kept the Hermes field-fill sequence synchronized with the active race.
Why: The user said the current animation felt weird and meaningless; the new motion makes the diagram read as race facts flowing into Hermes and a recommendation landing on the matching row.
Rollback target: `DV-2026-06-15-24`
Notes: The smoke guard now rejects the old dossier/answer token contract and requires request cards, row targets, recommendation cards, hub field fills, synchronized row metrics, and reduced-motion fallback.

### Version: DV-2026-06-15-24
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the abstract hub packet with a diagram-readable pipeline: the active race pin draws an input line, a dossier token travels along that path into Hermes, the hub fills date/days/goal fields, an answer token travels to the matching table node, and the table row remains synchronized.
Why: The user said the current animation felt weird and meaningless; the new sequence explains how the map point becomes Hermes race-table guidance.
Rollback target: `DV-2026-06-15-23`
Notes: Source guards now reject the old signal-line/hub-packet contract and require input lines, dossier tokens, hub field fills, answer tokens, table output nodes, synchronized row metrics, and reduced-motion fallback.

### Version: DV-2026-06-15-23
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the right-edge handoff rail with a clearer signal diagram: the active race pin sends a line into a visible Hermes analysis hub, a packet travels through the hub, and an output line lands on the matching race-table node while the row metrics highlight.
Why: The previous rail still felt arbitrary; the new motion shows the cause-and-effect path from race location to Hermes analysis to table decision.
Rollback target: `DV-2026-06-15-22`
Notes: Source guards now reject the old handoff/decision-rail classes and require route legs, race-to-Hermes signal lines, the hub packet, table output lines, and reduced-motion fallback.

### Version: DV-2026-06-15-22
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the scan-ring race animation with active route-leg playback, map-to-table handoff lines, a right-edge decision rail, active selector corners, and a countdown meter on the synchronized race row.
Why: The previous motion still looked like decorative scanning; the new motion makes the diagram explain which race point maps to which table decision.
Rollback target: `DV-2026-06-15-21`
Notes: Live desktop and mobile Browser proof confirmed 4 route legs, 5 handoff lines, 5 rail nodes, 5 selectors, no old scan/progress nodes, no horizontal overflow, and zero console errors.

### Version: DV-2026-06-15-21
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Increased the active map-caption badge width, minimum height, padding, and metric type size so the labeled date, countdown, and goal rows stay readable while the ordered race-map animation plays.
Why: The new semantic animation explained the diagram, but the caption metric stack was too small after every value became labeled.
Rollback target: `DV-2026-06-15-20`
Notes: Live proof confirmed active caption rows for date, countdown, and goal on desktop and mobile with 388px/320px caption widths, 58px height, 9.6px metric text, no horizontal overflow, and no console/page errors.

### Version: DV-2026-06-15-20
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Labeled the active map-caption date row too and replaced broad caption span styling with explicit order and metric selectors.
Why: The caption had labeled countdown and goal values, but the date still appeared as an unlabeled exception and broad span styling could leak into nested metric labels.
Rollback target: `DV-2026-06-15-19`
Notes: Live proof confirmed three compact metric rows for date, countdown, and goal on desktop and mobile with no horizontal overflow.

### Version: DV-2026-06-15-19
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added translated labels inside the active map caption metrics so countdown and goal read as labeled values instead of raw numbers.
Why: The active caption showed values like `218` and `2:55` without explaining which number meant time remaining versus target.
Rollback target: `DV-2026-06-15-18`
Notes: The labels reuse the existing race-table translations and stay compact on desktop and mobile without changing the table source of truth.

### Version: DV-2026-06-15-18
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the decorative route cursor with ordered race scan windows: race 01 starts the loop, each city gets an active scan ring, and the itinerary rail, map caption, and table row share the same 0s/2s/4s/6s/8s sequence.
Why: The previous moving cursor looked arbitrary and did not clearly explain how to read the race-map diagram.
Rollback target: `DV-2026-06-15-17`
Notes: Reduced-motion users still receive a static full-route fallback; the smoke guard now rejects reintroducing `landing-cinematic-map-cursor-route`.

### Version: DV-2026-06-15-17
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Expanded the synchronized map caption to include the active race countdown and goal alongside date and race name.
Why: The map caption named the active race but still forced users to look to the table for the two most decision-relevant values: time remaining and target.
Rollback target: `DV-2026-06-15-16`
Notes: The caption remains non-interactive and tied to the same `--race-delay` phase as the route cursor, itinerary rail, active row, countdown, and goal badge.

### Version: DV-2026-06-15-16
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Increased desktop race-table header contrast, added a subtle divider, and gave the labels stronger weight so the schedule reads as a trustworthy data table.
Why: The previous header labels were too faint compared with the animated race rows, weakening date/countdown/goal scanability on desktop.
Rollback target: `DV-2026-06-15-15`
Notes: Mobile card labels are unchanged because mobile hides the desktop table header and uses per-value labels.

### Version: DV-2026-06-15-15
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added the race goal badge to the synchronized active-row timeline, so the current race target highlights with the same phase as the route cursor, itinerary rail, caption, row number, and countdown.
Why: The previous active row emphasized the race and countdown but left the target badge visually quiet, making the selected race's actual objective less immediate.
Rollback target: `DV-2026-06-15-14`
Notes: Reduced-motion disables the goal-badge animation along with the rest of the race-map motion.

### Version: DV-2026-06-15-14
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a synchronized 01-05 itinerary rail inside the race map, showing each race step and date while highlighting the active step on the same `--race-delay` timeline as the cursor, caption, and table row.
Why: The cursor timeline was meaningful, but the map still benefited from a compact visual legend that makes the animation read as a race-calendar sequence immediately.
Rollback target: `DV-2026-06-15-13`
Notes: Desktop keeps the rail at the map's top-left and mobile centers it at the top, keeping the bottom active caption unobstructed.

### Version: DV-2026-06-15-13
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the drifting pulse-only race-map animation with a synchronized 10-second planner timeline: the route builds in ordered race beats, a cursor travels through the race pins, captions and table rows share the same phase delay, and reduced-motion users get a static full-route fallback.
Why: The previous animation could read as decorative or arbitrary because pins, rows, and path progress were staggered independently instead of visualizing the race-calendar sequence.
Rollback target: `DV-2026-06-15-12`
Notes: Race data, map asset, layout, CTAs, and mobile compact cards are unchanged.

### Version: DV-2026-06-15-12
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added real screen-reader text for the mobile race card value labels while preserving the same visual compact-card layout.
Why: The previous labels were CSS pseudo-content only, which clarified the cards visually but did not expose the same context reliably to assistive technology.
Rollback target: `DV-2026-06-15-11`
Notes: Uses existing translated race column labels and a local landing visually-hidden utility; no route, CTA, or race data changes.

### Version: DV-2026-06-15-11
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added translated mobile-only labels for race card values so date, countdown, and goal remain understandable after the desktop table header is hidden.
Why: Compact mobile race cards were readable but standalone values like `218` needed context.
Rollback target: `DV-2026-06-15-10`
Notes: Desktop table layout is unchanged; labels reuse existing landing race column translations.

### Version: DV-2026-06-15-10
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the mobile race sequence layout into compact schedule cards and centered the active map-caption strip on phone-sized viewports.
Why: The prior mobile collapse stacked every race field vertically, making the race list much taller than the diagram needed.
Rollback target: `DV-2026-06-15-09`
Notes: Desktop layout and race data are unchanged; this is a responsive readability improvement for the existing sequence animation.

### Version: DV-2026-06-15-09
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a synchronized map-caption strip that names the active race directly on the map while the route path, pin, and table row advance through the same sequence.
Why: The previous improvement linked the map to the table, but the map panel still needed a self-contained explanation of which race was active.
Rollback target: `DV-2026-06-15-08`
Notes: The caption reuses existing race data, adds no new dependencies, and includes a reduced-motion static fallback.

### Version: DV-2026-06-15-08
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the race-map animation into a synchronized calendar walkthrough: the map path advances in ordered steps, each pin keeps its numbered focus, and the matching race-table row/order/day cells pulse on the same timing.
Why: The previous motion still felt abstract because the table did not participate, so users could not easily connect the animated map point to the race it represented.
Rollback target: `DV-2026-06-15-07`
Notes: CSS/SVG-only motion, no new dependencies, no race data changes, and reduced-motion users keep a static readable diagram.

### Version: DV-2026-06-15-07
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Replaced the decorative simultaneous race-dot pulse with a meaningful race-calendar sequence animation: a subtle path draws through the displayed race order, each marker focuses in turn, and small numeric labels map pins back to the race list.
Why: The previous animation looked decorative and did not help users understand the map diagram.
Rollback target: `DV-2026-06-15-06`
Notes: The animation is CSS/SVG-only, respects reduced-motion settings, and does not change race data, links, or section layout.

### Version: DV-2026-06-15-06
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Tightened the race marker halo/core size and recalibrated the displayed map anchors so the visible point centers read as exact race locations on the reference-style map.
Why: The previous animated halo made the race points look offset or placed in surrounding empty map space.
Rollback target: `DV-2026-06-15-05`
Notes: This is a visual marker correction only; race copy, dates, and table data are unchanged.

### Version: DV-2026-06-15-05
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `DESIGN_VERSIONS.md`
What changed: Calibrated the five race pin anchors against the reference-derived political map asset so Berlin, Chicago, Tokyo, Boston, and Comrades land on their intended map locations.
Why: The previous longitude/latitude projection did not match the stylized reference map projection, leaving several race points visibly off-city.
Rollback target: `DV-2026-06-15-04`
Notes: Race metadata keeps the original geographic coordinates; the visual map now uses per-race display anchors for this editorial projection.

### Version: DV-2026-06-15-04
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/assets/generated/landing-world-map-political-dotted.png`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the landing race map from the supplied political world-map reference as a local dotted/transparent map asset, preserving the Hermes coral race pins and editorial race table.
Why: The user supplied a reference political world map and asked to rebuild the map again while preserving the existing Hermes style.
Rollback target: `DV-2026-06-15-03`
Notes: The map remains dependency-free at runtime; race pins still project from real coordinates and lower race section behavior is unchanged.

### Version: DV-2026-06-15-03
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the landing race map geometry from simplified longitude/latitude land polygons instead of fixed screen-space shapes, preserving the dotted land mask, graticule, coastlines, and coral race markers.
Why: The user asked to rebuild the map again using the reference direction while keeping the same style.
Rollback target: `DV-2026-06-15-02`
Notes: Race markers still project from real race coordinates; no copy, CTA, routing, or race-list behavior changed.

### Version: DV-2026-06-15-02
Date: 2026-06-15
Surface: Public landing race map on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Replaced the abstract ellipse-dot race map with a dotted real-world geography silhouette, subtle graticule/coastline layers, and race pins projected from real latitude/longitude.
Why: The user requested turning the map into a real world map while keeping the same landing-page style.
Rollback target: `DV-2026-06-15-01`
Notes: The race list copy, goals, dates, and section layout stay unchanged; this is a visual/geographic map upgrade only.

### Version: DV-2026-06-15-01
Date: 2026-06-15
Surface: Public landing hero markup on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/pages/landingCommandHeroBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the first-fold `RevealSection` wrapper that combined the hero grid, command hero, and reveal-visible classes, leaving the visible hero copy in `landing-command-copy`.
Why: The user requested removing that rendered class combination from the landing page.
Rollback target: `DV-2026-06-14-06`
Notes: The generated hero photo, public auth routes, CTAs, trust line, and lower landing sections remain unchanged.

### Version: DV-2026-06-14-06
Date: 2026-06-14
Surface: Public landing hero background on `/`
Files: `frontend/src/assets/generated/landing-cinematic-hero-runner-dawn.webp`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandHeroBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the landing hero background reference with a generated documentary-style dawn runner photograph saved as a compressed WebP asset.
Why: The user requested generating and applying a photorealistic runner image to `landing-cinematic-hero-photo`.
Rollback target: `DV-2026-06-14-05`
Notes: The asset keeps the runner on the right and dark negative space on the left for the existing headline; no landing routes, CTAs, or copy changed.

### Version: DV-2026-06-14-05
Date: 2026-06-14
Surface: Public landing hero on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `frontend/src/pages/landingCommandHeroBackground.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the right-side `landing-command-board landing-cinematic-hero-proof` proof panel from the landing hero and deleted its now-unused workout/readiness helper code, while keeping the remaining command-hero copy and CTA structure intact.
Why: The user requested removing that proof panel from the landing page.
Rollback target: `DV-2026-06-14-04`
Notes: This is a hero-surface simplification only; public auth routing, Strava CTA wiring, translations, and lower landing sections remain unchanged.

### Version: DV-2026-06-14-04
Date: 2026-06-14
Surface: Run Detail telemetry heading resolution badge on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the `run-detail-telemetry-resolution` badge from the telemetry heading and deleted its unused CSS.
Why: The user requested removing `run-detail-telemetry-resolution`.
Rollback target: `working tree before this change`
Notes: This is a heading cleanup only; telemetry data loading, chart selection, icons, tab values, and units remain unchanged.

### Version: DV-2026-06-12-01
Date: 2026-06-12
Surface: Comeback card reactivation on `/profile`
Files: `frontend/src/components/ComebackMessage.jsx`, `frontend/src/pages/ProfileDashboard.jsx`, `frontend/src/utils/todayRun.js`, `frontend/src/styles/_split/profile.css`, `frontend/src/styles/style.css`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/pages/profileComebackCardActions.smoke.test.js`, `frontend/src/utils/todayRunIntent.test.js`
What changed: Reactivated `runner-comeback-card` on the signed-in profile surface by driving it from the today-run recommendation intent instead of the stale `runsFreshness` plus `daysOff >= 3` gate. The card now renders two real actions, `Open today's run` and `View runs`, and the dismiss control sits above the card body so it can actually be clicked.
Why: The comeback card existed in source but stayed effectively dead in the live profile flow, and its pill affordances looked like buttons without doing anything.
Rollback target: `DV-2026-06-11-13`
Notes: Verified live on the local shared runner: card mounted on `/profile`, primary navigated to `/today-run`, secondary navigated to `/runs`, and dismiss removed the card from the current page state.

### Version: DV-2026-06-11-13
Date: 2026-06-11
Surface: Runs recent insights primary card on `/runs`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/analysis-detail-redesigns.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runsInsightPrimaryCard.smoke.test.js`
What changed: Reworked the primary recent-runs insight card from a dark slab into a warm editorial signal panel with a lead grid column, coral rail, kinetic line accent, large transparent metric type, and dedicated dark-mode styling.
Why: The old primary card fought the current profile-aligned Runs page and looked like a leftover dark theme component inside the light editorial surface.
Rollback target: `DV-2026-06-11-12`
Notes: Added focused split/bundled CSS and late-cascade guardrails for the exact primary-card design path.

### Version: DV-2026-06-11-12
Date: 2026-06-11
Surface: Territory active land fidelity on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`
What changed: Active territory render now keeps preserve-all budgets truly uncapped through region selection and final loop limiting, renders active loops as exact backend-derived topology, preserves internal hole loops, and retains active route-near concrete cells instead of replacing them with a corridor approximation.
Why: The live map still had gaps over backend-owned active cells and false filled land inside active territory. Diagnosis showed `Infinity` budgets fell back to finite caps, exact active loops were smoothed/decimated, and active topology holes were being collapsed into solid land.
Rollback target: `DV-2026-06-11-11`
Notes: Focused territory guards, file-scoped ESLint, escalated frontend build, runtime sync, and authenticated localhost territory-cell proof passed. Browser plugin opened `/territory` but redirected to `/login`, so authenticated Playwright proof is the runtime geometry source.

### Version: DV-2026-06-11-11
Date: 2026-06-11
Surface: Rewards 100-reward catalog on restore-pre-merge
Files: `frontend/src/pages/Rewards.jsx`, `frontend/src/utils/rewardBadges.jsx`, `frontend/src/utils/rewardCatalog.js`, `frontend/src/styles/style.css`, `frontend/src/utils/rewardCatalog.test.js`, `frontend/src/utils/rewardCatalogIntegration.smoke.test.js`
What changed: Ported the 100 additional rewards catalog into the restore-pre-merge worktree's ledger Rewards page, preserving the local `rewards-ledger-*` layout and adding a full catalog grid below the priority pipeline.
Why: The rewards expansion had been applied to a separate worktree/branch; this worktree needed the same catalog rendered in its own Rewards page design.
Rollback target: `DV-2026-06-11-10`
Notes: Focused catalog and wiring tests were added for this port.

### Version: DV-2026-06-11-10
Date: 2026-06-11
Surface: Runs street-accurate route thumbnails on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/pages/runsThumbDarkMapTile.smoke.test.js`, `.tools/verify-runs-route-thumb-runtime.mjs`
What changed: Route thumbnails now keep point-derived Mercator coordinates and rebuild both `recent-runs-thumb-route-svg` and the CARTO tile grid from an aspect-aware viewport frame based on the rendered thumbnail size. Map tiles now preserve square map pixels instead of being stretched into tall rectangles.
Why: The previous fix put the route over real tiles, but it independently scaled x/y into the tall thumbnail. That distorted the raster street grid, so the route could match GPS data while not visually sitting on the correct street.
Rollback target: `DV-2026-06-11-09`
Notes: Focused guards, file-scoped ESLint, escalated frontend build, runtime sync, and escalated browser verifier passed. Live `/runs` proof covered visible runs `1549`, `1548`, and `944`; each SVG path matched `/api/activities/{id}/points` under the measured thumbnail aspect, route SVG stayed over the tile layer, and tile square deltas were `0.02px`, `0.02px`, and `0px`.

### Version: DV-2026-06-11-09
Date: 2026-06-11
Surface: Runs route thumbnails over real map tiles on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runsThumbDarkMapTile.smoke.test.js`, `frontend/src/pages/runsRoutePreviewCache.smoke.test.js`, `.tools/verify-runs-route-thumb-runtime.mjs`
What changed: `recent-runs-thumb-route-svg` is explicitly layered above the real CARTO background tile layer with SVG z-index `2` and tile z-index `0`, while both layers keep the same point-derived Web Mercator coordinate frame and tile images remain uncapped by global responsive image CSS.
Why: The thumbnail must show the actual running route on top of the corresponding real-world map, not just a correct path or a loaded background tile in separate coordinate or stacking contexts.
Rollback target: `DV-2026-06-11-08`
Notes: Focused route/tile guards, route-preview cache guard, file-scoped ESLint, escalated frontend build, runtime sync, and escalated browser verifier passed. Live `/runs` proof covered visible runs `1549`, `1548`, and `944`: each SVG path exactly matched `/api/activities/{id}/points`, each card rendered one background tile layer, SVG `preserveAspectRatio="none"`, z-order `svg=2` over `tile=0`, tile CSS `maxWidth/maxHeight=none`, and `/run/1549` loaded one Leaflet map.

### Version: DV-2026-06-11-08
Date: 2026-06-11
Surface: Runs thumbnail tile sizing on `/runs`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runsThumbDarkMapTile.smoke.test.js`
What changed: Route thumbnail tile images now opt out of global responsive image caps with `max-width: none` and `max-height: none`, so their computed percentage tile rectangles are honored behind `recent-runs-thumb-route-svg`.
Why: The background CARTO tile loaded, but global image CSS capped the tile to the thumbnail width; this broke the corresponding Leaflet/CARTO map background even though the route SVG path was correct.
Rollback target: `DV-2026-06-11-07`
Notes: Focused guards, file-scoped ESLint, escalated frontend build, runtime sync, route verifier, and rendered-tile inspection passed. Live `/runs` for run `1549` showed tile natural size `256x256`, computed `maxWidth/maxHeight=none`, computed tile rect `6036x1788px` behind a `132x239px` thumb, and route proof still matched `2262` actual points plus `/run/1549` Leaflet map.

### Version: DV-2026-06-11-07
Date: 2026-06-11
Surface: Runs Leaflet-aligned thumbnail maps on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/pages/runsThumbDarkMapTile.smoke.test.js`, `.tools/verify-runs-route-thumb-runtime.mjs`
What changed: `recent-runs-thumb-route-svg` route paths now project GPS points into normalized Web Mercator coordinates, and background CARTO tile layers are positioned from the same Mercator `mapFrame`, matching Leaflet/CARTO map geometry instead of linear latitude.
Why: The previous route thumbnail used actual run points, but the SVG path still normalized latitude linearly while the background was a Leaflet-style Web Mercator tile map, so route and map could visually disagree.
Rollback target: `DV-2026-06-11-06`
Notes: Focused route/tile guards, file-scoped ESLint, escalated frontend build, frontend runtime sync, and escalated browser verifier passed. Browser proof on live `/runs` showed run `1549` thumbnail path matched the Web Mercator preview rebuilt from `/api/activities/1549/points` with `2262` commands for `2262` points, `preserveAspectRatio="none"`, background tile layer present, and `/run/1549` loaded one Leaflet route map.

### Version: DV-2026-06-11-06
Date: 2026-06-11
Surface: Runs actual route thumbnails on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/pages/runsRoutePreviewCache.smoke.test.js`, `.tools/verify-runs-route-thumb-runtime.mjs`
What changed: Runs list thumbnails now fetch `/api/activities/{runId}/points` for bounded visible cards even when the activity feed already includes `routePreview`, then prefer that point-derived preview over the feed preview. Run cards expose `data-run-id` for direct runtime comparison with `/run/:runId`.
Why: The feed `routePreview` could be stored, sampled, or stale, so validating the thumbnail against itself did not prove it showed the same actual route as the run detail page.
Rollback target: `DV-2026-06-11-05`
Notes: Focused route-preview and tile guards passed. File-scoped ESLint passed. Escalated frontend build passed and synced live backend static assets. Runtime sync passed. Escalated browser verifier proved `/runs` run `1549` thumbnail path exactly matched a preview rebuilt from `/api/activities/1549/points` with `2262` commands for `2262` actual points, and `/run/1549` loaded one Leaflet route map.

### Version: DV-2026-06-11-05
Date: 2026-06-11
Surface: Runs route thumbnail map alignment on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runsThumbDarkMapTile.smoke.test.js`
What changed: Runs route thumbnails now render positioned CartoDB dark tile layers from the same padded preview bounds used by `recent-runs-thumb-route-svg`, and the SVG uses `preserveAspectRatio="none"` so the route path and tile frame share the rendered thumbnail coordinate space.
Why: The previous thumbnail used one centered map tile stretched under the route SVG, which could not be accurate to the normalized route path because the tile and SVG used different coordinate frames.
Rollback target: `DV-2026-06-11-04`
Notes: `runsThumbDarkMapTile` and route-preview cache guards passed. Escalated frontend build passed and synced backend static/live assets. Frontend runtime sync passed. Escalated Playwright proof on `http://localhost:8080/runs` found a routed thumbnail with `has-route-tile`, one `data-route-tile-layer`, `object-fit: fill`, SVG `preserveAspectRatio="none"`, matching SVG/thumb rects, and non-empty route path bbox.

### Version: DV-2026-06-10-03
Date: 2026-06-10
Surface: Territory Global zoom stability on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`
What changed: Global territory now reuses same-signature processed render geometry after raw polygons hydrate, keeps Global geometry keys stable across zoom, and limits viewport-prioritized loop pruning to selected/Own scope. Leaflet territory layer swaps now paint the replacement layer before removing the previous layer.
Why: Zooming the Global territory map could make owner regions appear/disappear because viewport-keyed raw rerenders reselected loops, and the previous layer could be removed before replacement paths were painted.
Rollback target: `DV-2026-06-10-02`
Notes: Territory wiring and heatmap guards passed. Escalated frontend build passed and synced backend static/live assets. Frontend runtime sync passed. Live shared `/territory` proof passed. Wheel-zoom node-stability proof sampled 236 frames across zooms 10/13/16/17 with active and rival SVG nodes continuously connected, `badCount=0`, and zero console errors. Screenshot: `task-images/territory-wheel-zoom-node-stability-proof.jpg`.

### Version: DV-2026-06-10-02
Date: 2026-06-10
Surface: Territory global owner rendering on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonRepository.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`
What changed: Global territory now includes every non-deleted runner with land-mask territory, including seeded `territory-*` owners. Initial global responses and frontend rendering reserve owner budget by distinct active owner, rank all rival owners instead of using a nearby-only branch, cache full drawable polygons even when `cells=false` is requested, and default `/territory` to Global so all returned owners paint before Own is explicitly selected. Global active land uses a smaller visible-region cap so the active fill remains readable alongside rival layers.
Why: The Global territory page could show only the signed-in runner because generated territory owners were excluded, active masks exhausted the initial cap, `cells=false` could poison the canonical cache, and the page defaulted to Own-only selected-owner rendering.
Rollback target: `DV-2026-06-10-01`
Notes: Focused backend regressions passed. Territory frontend guards passed. Escalated Vite build passed and synced backend static/live assets. Runtime sync passed. Live `/territory` proof passed with `polygonCount=36`, `activePolygonCount=29`, `rivalPolygonCount=7`, `rivalOwnerNames=["Hermes Flushing Conqueror","Hermes Temporal Rival"]`, `rivalConcrete=2`, `rivalContour=2`, no synthetic/helper paths, and zero console errors. Cache runtime proof passed with cached paint `508ms` and preserved active plus rival layers. Screenshots: `task-images/territory-global-owners-proof.jpg`, `task-images/territory-global-cache-proof.jpg`.

### Version: DV-2026-06-10-01
Date: 2026-06-10
Surface: Territory world country stress dataset and own-scope render performance on `/territory`
Files: `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/test/java/com/hermes/backend/LocalSharedRunnerBootstrapServiceTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/api.js`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-world-runtime.mjs`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Completed the world territory stress dataset as `24,900` fake-name owners across `249` ISO countries, with city-sized coarse masks, deliberate neighboring overlap, and a spaced fallback country grid so every owner keeps visible land after newest-overlap conquest. The Territory page now defaults to Own territory and filters topology generation to the selected owner before rendering, while Global territory still has all owners loaded for the global scope. Production API base resolution now uses same-origin so isolated backend proof servers work without cross-port CSP failures.
Why: The global territory and conquest mechanisms need a full-country-scale mock dataset, but the page must still load quickly and not erase owners through anchor collisions or response-grid downsampling.
Rollback target: `DV-2026-06-09-15`
Notes: Targeted backend/frontend guards passed. Escalated frontend build passed. Isolated H2 runtime on `http://localhost:18080` seeded `accounts=24900`, `countries=249`, `seeded shoes=74700`, `seeded activities=24900`. Strict verifier passed with `polygonCount=24900`, `parsedCountryCount=249`, representative countries at `100` owners each, `uniqueCells=356399`, no duplicate-owned cells, and browser page proof `scopeButtonCount=2`, `landLayerCount=1`, `contourLayerCount=1`. Screenshot: `task-images/territory-world-country-owner-proof.jpg`.

### Version: DV-2026-06-09-15
Date: 2026-06-09
Surface: Territory global country stress dataset on `/territory`
Files: `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`, `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapConfiguration.java`, `backend/src/main/resources/application.properties`, `backend/src/test/java/com/hermes/backend/LocalSharedRunnerBootstrapServiceTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `.tools/verify-territory-world-runtime.mjs`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Local world territory generation now creates 100 fake-name mock accounts for every ISO country instead of six continent groups. Accounts use country-coded emails, fake-name display names, city-anchored loop routes, and overlapping neighbor cells to stress global rendering and newest-overlap-wins conquest.
Why: The global territory page needs a broad multi-country test dataset with real-looking users and deliberate land competition, not a small per-continent sample.
Rollback target: `DV-2026-06-09-14`
Notes: `node --check .tools/verify-territory-world-runtime.mjs` passed. Focused service generation/conquest tests passed. Focused controller proof generated the full country account set, asserted all 100 exact fake-name owners for every country, and verified a newer US neighbor owns the contested cell.

### Version: DV-2026-06-09-14
Date: 2026-06-09
Surface: Territory campaign panel removal on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Removed the `terr-game-campaign-panel` overlay from the Territory map and deleted its dedicated campaign child styles. The map, navigation rail, scope switcher, owner inspector, and territory rendering remain intact.
Why: The Territory page should no longer show the campaign card overlay on top of the map.
Rollback target: `DV-2026-06-09-13`
Notes: Static Territory guard passed. Sandboxed Vite build hit the known Windows `spawn EPERM`; escalated Vite build passed and synced backend static/live assets. Frontend runtime sync passed. In-app Browser proof on `http://localhost:8080/territory` showed `campaignPanelCount=0`, no campaign child classes, map section present, scope switcher present, visible land present, and zero console errors.

### Version: DV-2026-06-09-13
Date: 2026-06-09
Surface: Territory locality-aware owner colors on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Territory owner colors now pass through a deterministic locality-aware allocator. The reusable palette can repeat for far-away owners, but when two owners' painted territory bounds are near each other, rivals are reassigned away from same-hue/same-lightness colors. The active user keeps the Hermes coral identity, and the resolved color is shared by map fills, contours, owner metadata, and the Global button's significant-color gradient.
Why: Adjacent territories could previously look like minor shade variations of the same color, such as light green next to darker light green, making ownership boundaries hard to read.
Rollback target: `DV-2026-06-09-12`
Notes: Frontend cache is now `global-owner-territory-cache-v55`. Static Territory guard passed. Sandboxed Vite build hit the known Windows `spawn EPERM`; escalated Vite build passed and synced backend static/live assets. Frontend runtime sync passed. In-app Browser proof on `http://localhost:8080/territory` loaded the current bundle with Global selected, active territory visible, and zero console errors after reload.

### Version: DV-2026-06-09-12
Date: 2026-06-09
Surface: Territory user-first scope focus on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: The Territory page now treats both scope buttons as user-first navigation. Clicking Own territory or Global territory refits the Leaflet viewport to the signed-in owner first; if that owner's territory spans a very large distance, the viewport picks the most recent route/territory cluster instead of zooming out to an unusable whole-world box. Global territory still paints every owner with all-mode classes and significant colors while centering the user's land.
Why: Global and Own were valid display modes, but switching modes could leave the user far from their own territory or focused on a dominant rival/local cluster. The requested behavior is direct navigation to the user's current/recent land first.
Rollback target: `DV-2026-06-09-11`
Notes: Frontend cache is now `global-owner-territory-cache-v54`. Static Territory guard passed. Escalated Vite build passed and synced backend static/live assets after the known sandboxed Vite `spawn EPERM`. Frontend runtime sync passed. In-app Browser proof on `http://localhost:8080/territory` showed zero `.terr-theme-navigator` nodes, one `.terr-scope-switcher`, exactly two buttons (`我的领地`, `全局领地`), Own selected with active selected land visible, and Global selected with all-mode land visible while still focused on the active user.

### Version: DV-2026-06-09-11
Date: 2026-06-09
Surface: Territory scope switcher on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Removed the per-owner `terr-theme-navigator` rail and replaced it with a compact two-button scope switcher: Own territory and Global territory. Own territory derives map focus from the active owner only; Global territory keeps all owners visible with the significant multi-user color treatment. Clicking map land now opens the owner inspector without creating a hidden rival-focus state.
Why: The Territory page needed a simpler mode model with only two explicit choices instead of a horizontal owner navigator that exposed every user as a button.
Rollback target: `DV-2026-06-09-10`
Notes: Static Territory guard passed. Sandboxed Vite build hit the known Windows `spawn EPERM`; escalated Vite builds passed and synced backend static/live assets. Frontend runtime sync passed. In-app Browser proof on `http://localhost:8080/territory` showed zero `.terr-theme-navigator`/`.terr-theme-chip` nodes, one `.terr-scope-switcher`, exactly two buttons (`我的领地`, `全局领地`), Global selected by default with 6 visible land paths at zoom 12, Own selected with one active selected land path and rivals dimmed, then Global restored all-mode paint with 6 visible land paths.

### Version: DV-2026-06-09-10
Date: 2026-06-09
Surface: Territory all-users render recovery on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Territory cache is now `global-owner-territory-cache-v53`, raw polygon and processed render cache reads must contain drawable geometry before they can hydrate the page, and render-only cache can no longer update the raw polygon signature or suppress the full `/api/territory/polygons` fetch. The all-users initial fit now selects the dominant local territory cluster using owner area and geometry instead of always fitting the active account's cluster.
Why: The page could load the shell and owner chips while all Leaflet territory paths clipped to `M0 0`, because stale render-only cache plus a tiny far-away active-account center made the real Flushing/Shared/Temporal territories paint off-screen or not paint at all.
Rollback target: `DV-2026-06-09-09`
Notes: Static Territory guard passed. Escalated Vite build passed and synced backend static/live assets. Frontend runtime sync passed. In-app Browser proof on `http://localhost:8080/territory` showed 20 visible map tiles at zoom 12, 8 land paths/16 territory paths, 6 visible non-`M0 0` land paths, All users selected, and distinct visible fills for `Hermes Temporal Rival` (`rgb(56, 189, 248)`), `Hermes Flushing Conqueror` (`rgb(251, 191, 36)`), and `Hermes Shared Runner` (`rgb(91, 156, 245)`). The signed-in user's tiny far-away land remains off-screen in all-users mode by design so the dominant visible territory cluster loads instead of a blank global view.

### Version: DV-2026-06-09-09
Date: 2026-06-09
Surface: Territory all-users map highlight on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: All users mode now applies an explicit `--theme-all` class to every rendered territory land and contour path. Rival land and contours get dedicated all-mode opacity/filter overrides, so blue, purple, yellow, and red owner territories all read as highlighted at the same time instead of only the active red owner standing out.
Why: All users used an empty `selectedOwnerKey`, and the map focus helper treated that as no theme class. Rival owners therefore fell back to the subdued default rival opacity, making the global/all-owner mode look like only the red current-user territory was highlighted.
Rollback target: `DV-2026-06-09-08`
Notes: Static Territory guard passed. Escalated Vite build passed and synced backend static/live assets. Frontend runtime sync passed. Elevated Playwright proof saved `task-images/territory-v52-all-users-map-highlight-proof.jpg` with no console errors; proof showed All users selected, 1 active owner and 3 rival owners rendered, zero selected/dimmed paths, all land/contours carrying `--theme-all`, rival fill opacity `0.56`, rival contour stroke opacity `0.72`, and visible owner colors for `You`, `Hermes Temporal Rival`, `Hermes Africa Territory 001`, and `Hermes Flushing Conqueror`.

### Version: DV-2026-06-09-08
Date: 2026-06-09
Surface: Territory all-users color chip on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: The owner theme rail now derives significant colors for the All users button from the actual visible owner theme list. The chip label is aligned to `All users`, and the all-users chip body plus swatch render a multi-color gradient using the active user and largest visible rival colors instead of a static hardcoded palette.
Why: The All users button represented a global/all-owner state but visually looked like a generic single-color chip rather than showing the significant user colors currently on the map.
Rollback target: `DV-2026-06-09-07`
Notes: Static Territory guard passed. Sandboxed Vite build hit known Windows `spawn EPERM`; escalated Vite build passed and synced backend static. Frontend runtime sync passed. Elevated Playwright proof saved `task-images/territory-v52-all-users-colors-proof.jpg` with no console errors; proof showed owner colors `#f07561`, `#5b9cf5`, `#c084fc`, all-users band/gradient containing those colors, and non-empty chip body background.

### Version: DV-2026-06-09-07
Date: 2026-06-09
Surface: Territory v52 real-run closed-loop coverage on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Backend land masks are now `mask:v16`; accepted closed loops fill by route-wall flood fill instead of even-odd scanlines, while unclosed route branches remain corridor-only. Backend API cache signatures are now `land-mask-union-v30-wall-flood-loop-fill` and `territory-map-v20-wall-flood-loop-fill`; frontend cache is now `global-owner-territory-cache-v52`.
Why: Live Kissena diagnosis showed the shared-runner activity had a real closed east-park loop plus unclosed western branch, but v15 even-odd loop filling under-filled the concrete loop and stale cache could preserve that bad shape.
Rollback target: `DV-2026-06-09-06`
Notes: `TerritoryPolygonComputerTests`, targeted Territory ownership tests, targeted Flushing seed tests, backend compile, frontend smoke, escalated Vite build, frontend/backend runtime sync, live shared proof, cache proof, and focused Kissena proof passed. Live v52 proof saved `task-images/territory-v52-live-shared-proof.jpg` with active backend cells `2224`, active area `4,112,176m2`, v30 ETag, one active concrete path, two rival owners, unfiltered tiles, and zero console errors. Cache proof saved `task-images/territory-v52-cache-proof.jpg` with cached paint `448ms`. Kissena proof saved `task-images/territory-v52-kissena-centered-proof.jpg` with zoom `14`, active owner `You` above rival fill, `activeNearKissena=1062`, and v30 ETag.

### Version: DV-2026-06-09-06
Date: 2026-06-09
Surface: Territory v47 fragment regression cleanup on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `.tools/verify-territory-live-shared-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Frontend cache is now `global-owner-territory-cache-v47`. The render pass still resolves exact concrete ownership before synthetic repair, but small disconnected components are again pruned against any competing owner concrete, not only already-processed newer concrete. The live shared-account verifier now rejects many tiny active subpaths so the v46 coral-chip regression cannot pass proof again.
Why: v46 fixed activity-time conquest but narrowed fragment pruning to newer-only concrete. Live proof reproduced the broken-piece state with `64` active concrete subpaths because small active winner islands inside rival Flushing territory were no longer compared against older competing concrete.
Rollback target: `DV-2026-06-09-05`
Notes: Static guard passed. `node --check` passed for cache and live shared verifiers. Sandboxed Vite build failed with the known Windows `spawn EPERM`; escalated Vite build passed and synced backend static. Runtime sync passed. Live shared proof saved `task-images/territory-v47-fragment-clean-proof.jpg` with active concrete subpaths reduced from `64` to `6`, small active subpaths `2`, all 3 rival owners rendered, no helper/synthetic paths, unfiltered tiles, and zero console errors. Kissena proof saved `task-images/territory-v47-kissena-newer-run-proof.jpg` with active Kissena backend cells `555`, active geometry visible at zoom 14, nearest active point `17px`, and all 3 rivals present. Cache proof saved `task-images/territory-v47-cache-proof.jpg` with v47 cached paint `467ms`, active move commands `6`, conditional polygon revalidation after paint, no full polygon download, and raw polygon cache deleted before revisit.

### Version: DV-2026-06-09-04
Date: 2026-06-09
Surface: Territory v45 conquered-fragment cleanup on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Frontend cache is now `global-owner-territory-cache-v45`. Territory ownership still starts from backend concrete winner cells, but the render pass now prunes small disconnected components that are mostly adjacent to a competing owner's concrete mask. Larger standalone active land and open-route corridors remain, while the tiny coral chips that survived exact-grid conquest inside the large rival territory are removed.
Why: The v44 map still showed many small coral broken pieces inside a larger owned landmass because exact response-cell ownership could leave tiny active winner islands next to another owner's concrete field. The page needed to keep real global owner territory while removing those low-value conquered fragments.
Rollback target: `DV-2026-06-09-03`
Notes: Static guard and syntax checks passed. Escalated Vite build passed and synced backend static. Runtime sync passed. Live shared proof saved `task-images/territory-v45-competing-fragment-proof.jpg` with active concrete subpaths reduced from 64 to 5, active contour line commands reduced from about 102k to 7,296, all 3 rival owners still rendered, no helper/synthetic paths, unfiltered tiles, and zero console errors. Open-route proof saved `task-images/territory-v45-open-route-proof.jpg` with `p10=8`, `p50=8`, `p90=8`, `thicknessRatio=1`, and 12 samples. Owner theme proof saved `task-images/territory-v45-owner-theme-proof.jpg` with all 4 owner keys and owner inspector. Cache proof saved `task-images/territory-v45-cache-proof.jpg` with v45 cached paint `480ms`, shell API blocked before paint, conditional polygon revalidation after paint, no full polygon download, raw polygon cache deleted before revisit, and active move commands `5`.

### Version: DV-2026-06-09-03
Date: 2026-06-09
Surface: Territory v44 ownership-safe gap and cache pass on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `.tools/verify-territory-open-route-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Frontend cache is now `global-owner-territory-cache-v44`. Territory rendering resolves ownership from backend concrete cells before synthetic repair, so newer/other owners cannot be hidden by same-owner render repair. Dense, fragmented masks get a bounded void/seam repair before contouring, open route traces render as continuous narrow corridors, selected rival territory is more opaque, dimmed owners remain visibly present, and Leaflet starts preloading as soon as the Territory module loads for faster cached replay.
Why: The remaining visible “gaps” were a mix of stale render-cache geometry, synthetic repair competing with concrete owner cells, focus mode making valid rival land look black, and route corridors being clipped into sparse dashed pieces. The page needed to preserve global newest-overlap ownership while making real owner coverage visually legible.
Rollback target: `DV-2026-06-09-02`
Notes: Static guard and syntax checks passed. Escalated Vite build passed and synced backend static. Runtime sync passed. Owner theme proof saved `task-images/territory-v44-owner-theme-proof.jpg` with 4 owner chips/path keys, active plus 3 rival concrete layers, selected/dimmed paths, owner inspector, and zero console errors. Global shared proof saved `task-images/territory-v44-live-shared-proof.jpg` with 4 polygons, all 3 rival owner names, no helper/synthetic paths, unfiltered tiles, and zero console errors. Open-route proof saved `task-images/territory-v44-open-route-proof.jpg` with centerline samples `p10=8`, `p50=8`, `p90=8`, `thicknessRatio=1`, and unfilled interior. Cache proof saved `task-images/territory-v44-cache-proof.jpg` with v44 cached paint `656ms`, shell API blocked before paint, conditional polygon revalidation after paint, no full polygon download, raw polygon cache deleted before revisit, and unfiltered map tiles.

### Version: DV-2026-06-09-02
Date: 2026-06-09
Surface: Territory gapless solid land fill on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-live-shared-runtime.mjs`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Frontend cache is now `global-owner-territory-cache-v28`. The territory renderer no longer promotes interior shared-boundary loops into the solid land fill; each connected concrete component now contributes its dominant outer loop only. The live shared verifier now parses exact SVG line commands and rejects opposite-winding active fill subpaths, so nonzero-filled territory cannot silently render long dark interior cracks.
Why: Large connected territories could show many grid-aligned internal gaps because shared-boundary/interior loops were included as drawable fill rings. Those rings could become opposite-winding SVG subpaths and cut holes through what should read as one solid conquered landmass.
Rollback target: `DV-2026-06-09-01`
Notes: Backend ownership, newest-overlap conquest, route corridor rules, and owner-click behavior did not change. Smoke/static checks passed, sandboxed Vite build failed with the known Windows `spawn EPERM`, escalated Vite build passed and synced live backend static assets, and runtime sync passed. Live shared proof saved `task-images/territory-v28-gapless-shared-proof.jpg` with active/rival owner layers present, active fill/contour aligned, `activeConcreteMoveCommandCount=9`, `activeConcreteSubpathCount=9`, `activeConcreteSubpathSigns=[1]`, no helper/synthetic layers, unfiltered tiles, and zero console errors. Cache proof saved `task-images/territory-v28-gapless-cache-proof.jpg` with v28 cached paint `466ms`, raw polygon cache deleted before revisit, conditional polygon revalidation after paint, and no full polygon download. Owner-click regression proof saved `task-images/territory-v28-owner-click-proof.jpg`.

### Version: DV-2026-06-09-01
Date: 2026-06-09
Surface: Territory click-to-owner inspector on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-theme-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Real Leaflet territory fills and contours are now clickable and keyboard-focusable. Clicking a territory shape selects that owner's theme, dims other owners without hiding them, and opens a map annotation showing username, current/rival status, owned area, mapped region count, and owner id when available. The same owner metadata stays on the SVG paths so the card, theme navigator, and live rendered land all resolve from the same backend owner key.
Why: The global owner map exposed all users visually, but clicking the land itself did not explain which user owned it or show useful owner details. The territory page needed direct map interaction, not only the bottom color-theme rail.
Rollback target: `DV-2026-06-08-12`
Notes: Frontend cache remains `global-owner-territory-cache-v27`; no backend ownership, conquest, or geometry behavior changed. Smoke/static checks passed, sandboxed Vite build failed with the known Windows `spawn EPERM`, escalated Vite build passed and synced live backend static assets, and runtime sync passed. Live owner-click proof saved `task-images/territory-click-owner-info-proof.jpg` with 4 owners, direct path click on `Hermes Temporal Rival`, `role=button`, `tabindex=0`, synchronized selected theme chip, 2 selected paths, 6 dimmed paths, owner info rows in zh-CN, close behavior, and zero console errors. Shared global proof saved `task-images/territory-click-owner-shared-global-proof.jpg`; cache proof saved `task-images/territory-click-owner-cache-proof.jpg` with v27 cached paint `604ms`, raw polygon cache deleted before revisit, conditional polygon revalidation after paint, and no full polygon download.

### Version: DV-2026-06-08-12
Date: 2026-06-08
Surface: Territory owner color-theme navigator on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-theme-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: `/territory` now derives an owner color-theme system from the same global owner keys used by the map paint path. A bottom theme navigator shows every returned owner with a swatch, current/rival status, area, and region count; selecting a chip focuses the Leaflet view to that owner's real concrete territory while dimming, not hiding, the other owner layers. Rendered SVG paths now carry `data-hermes-owner-key` so chips, cached render entries, and live map paths stay aligned.
Why: The global territory map showed all owners, but there was no visible color index or direct way to navigate each user's territory. Users could see colored land but could not easily understand which color belonged to which owner or focus a specific rival such as `Hermes Flushing Conqueror`.
Rollback target: `DV-2026-06-08-11`
Notes: Frontend cache remains `global-owner-territory-cache-v27`; no conquest geometry or backend mask behavior changed. Smoke/static checks passed, sandboxed Vite build failed with the known Windows `spawn EPERM`, escalated Vite build passed and synced live backend static assets, and runtime sync passed. Theme proof saved `task-images/territory-theme-navigator-proof.jpg` with 4 visible owner chips, `aria-pressed` states, selected `Hermes Flushing Conqueror` focus, 2 selected paths, 6 dimmed paths, active plus 3 rival concrete layers still rendered, and zero console errors. Existing shared proof saved `task-images/territory-theme-shared-global-proof.jpg`; cache proof saved `task-images/territory-theme-cache-proof.jpg` with v27 cached paint `479ms`, raw polygon cache deleted before revisit, conditional polygon revalidation after paint, and no full polygon download.

### Version: DV-2026-06-08-11
Date: 2026-06-08
Surface: Territory Central Park seam continuity on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Frontend cache is now `global-owner-territory-cache-v27`. The territory renderer adds a bounded same-owner component seam bridge after route normalization: nearby disconnected concrete route pieces are joined with narrow corridor tiles, not owner-wide hulls, district plates, or flood-filled interiors.
Why: The v26 render fixed broad/uneven Central Park blobs, but the active route still broke into separate lower and mid-park pieces because the returned route trace payload was globally capped and incomplete for Central Park while backend owned mask cells covered the full run.
Rollback target: `DV-2026-06-08-10`
Notes: Source guard, syntax checks, escalated Vite build, and runtime sync passed. Central Park proof saved `task-images/territory-v27-central-park-seam-bridge-proof.jpg` with `sampleCount=36`, `p10=4`, `p50=8`, `p90=10`, and `thicknessRatio=2.5`; visual inspection shows the broken pieces joined while the reservoir/interior remains dark. DOM seam proof confirmed lower and mid seam neighborhoods are filled and the reservoir interior is empty. Shared global proof saved `task-images/territory-v27-shared-global-proof.jpg` with active plus three rival owners and zero console errors. Cache proof saved `task-images/territory-v27-repeat-load-proof.jpg` with v27 cached paint `565ms`, raw polygon cache deleted before revisit, conditional polygon revalidation after paint, and no full polygon download.

### Version: DV-2026-06-08-10
Date: 2026-06-08
Surface: Territory uniform open-route corridor on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `.tools/verify-territory-open-route-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Backend land masks now use `mask:v14`, tighter 6m internal self-near closure, and cache signatures `land-mask-union-v26-wide-route-trace-coverage` / `territory-map-v16-tight-self-loop-closures` so stale false Central-Park-like interiors recompute. The frontend uses `global-owner-territory-cache-v26`, a narrower fixed route corridor, a bounded near-route replacement band, and render-tile-scale contour smoothing so unclosed open routes draw as consistent real-world corridors instead of broad source-cell-scale lobes.
Why: The Central Park open route was no longer filling the whole park, but its displayed shape still had uneven thick/thin blobs because narrow route corridors were being simplified at the original backend cell scale instead of the finer render-tile scale.
Rollback target: `DV-2026-06-08-09`
Notes: Targeted frontend guard passed, Vite build passed after the known sandbox `spawn EPERM` rerun with escalation, and runtime sync passed. Central Park proof saved `task-images/territory-v26-cache-v26-central-park-uniform-corridor-proof.jpg` with `p10=2`, `p50=2`, `p90=4`, and `thicknessRatio=2`. Shared global proof saved `task-images/territory-v26-cache-v26-shared-global-proof.jpg` with active plus three rival land-mask owners, including `Hermes Flushing Conqueror`, and zero console errors. Cache proof saved `task-images/territory-v26-cache-v26-repeat-load-proof.jpg` with v26 cached paint `609ms`, raw polygon cache deleted before revisit, conditional polygon revalidation after paint, and no full polygon download.

### Version: DV-2026-06-08-09
Date: 2026-06-08
Surface: Territory explicit-loop interiors on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Backend land masks now use `mask:v13` and no longer derive owned land from generic flood-fill of the brushed route wall. A run claims its route corridor plus interiors from explicit closed loops only. Endpoint closure remains 25m, while internal self-near loop detection is tightened to 12m so near-parallel park roads do not become false loop interiors. Territory API/cache signatures are bumped to `land-mask-union-v24-explicit-loop-interiors`, `territory-map-v15-explicit-loop-interiors`, and `global-owner-territory-cache-v19`.
Why: Even after endpoint tightening, an open Central Park return path could still render as a broad filled band because the route corridor itself acted as a wall for flood-fill ownership. The intended rule is concrete run coverage: unclosed paths stay corridor-only; only real loops fill interiors.
Rollback target: `DV-2026-06-08-08`
Notes: Green backend coverage now includes `landMaskNarrowOpenReturnPathDoesNotFloodFillBetweenBrushedWalls`, proving both parallel route corridors are owned while the unrun center remains unclaimed. Full `TerritoryPolygonComputerTests` and `TerritoryControllerTests` pass. Runtime proof saved `task-images/territory-explicit-loop-live-proof.jpg` with live `v15`/`v24` signatures, `activeBackendArea=1896000`, active/rival land masks present, no helper/synthetic layers, unfiltered tiles, and zero console errors. Cache proof saved `task-images/territory-explicit-loop-cache-proof.jpg` with v19 cached paint `689ms`, current IndexedDB render cache, conditional polygon revalidation after paint, and no full polygon download. Central Park visual QA saved `task-images/territory-central-park-explicit-loop-proof.jpg`, showing unowned dark space between the open return sides.

### Version: DV-2026-06-08-08
Date: 2026-06-08
Surface: Territory strict open-return corridor rule on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Backend land masks now use `mask:v12` with a 25m real endpoint-closure tolerance and no adaptive open-return fill. Open routes and run-back ribbons now claim only the concrete route corridor unless the route actually returns to the start within that tolerance. Territory API/cache signatures are bumped to `land-mask-union-v23-strict-open-return-corridors`, `territory-map-v14-strict-open-return-corridors`, and `global-owner-territory-cache-v18`.
Why: The previous open-endpoint fix still let parallel open return paths fill the unrun interior between tracks, making Central-Park-style unclosed runs cover much more space than the runner actually ran.
Rollback target: `DV-2026-06-08-07`
Notes: Red backend tests first proved open return/ribbon middles were wrongly claimed. Green tests now prove open parallel tracks keep only upper/lower route cells, mid-route gaps with tails do not fill interiors, true 20m endpoint closures still fill, stale v10/v11 masks are invalidated, and `/api/territory/polygons` does not create hulls between same-owner open runs. Runtime proof passed with live `v14`/`v23` signatures, `task-images/territory-strict-open-return-proof.jpg`, active/rival land masks present, no helper/synthetic layers, unfiltered tiles, and zero console errors. Cache proof saved `task-images/territory-strict-open-return-cache-proof.jpg` with v18 cached paint `487ms`, current IndexedDB render cache, conditional polygon revalidation after paint, and no full polygon download.

### Version: DV-2026-06-08-07
Date: 2026-06-08
Surface: Territory open-endpoint corridor rule on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Backend land masks now use `mask:v10` and cap adaptive endpoint closure at 150m, so a Central-Park-length open route with a 300m+ unrun gap stays a narrow route corridor instead of filling the park interior. Territory API/cache signatures are bumped to `land-mask-union-v21-open-endpoint-corridors`, `territory-map-v12-open-endpoint-corridors`, and `global-owner-territory-cache-v16`.
Why: The previous adaptive closure allowed long routes to bridge up to 500m between endpoints, which made an open Central Park run render as a full filled territory even though the runner did not return near the start.
Rollback target: `DV-2026-06-08-06`
Notes: Red/green backend regression `landMaskOpenCentralParkLengthRouteWithParkScaleEndpointGapStaysCorridor` now proves the center of the implied park loop remains unclaimed while route-edge cells stay owned. Live shared proof saved `task-images/territory-open-endpoint-corridor-proof.jpg` with v21/v12 signatures, `activeBackendArea=2495504`, active/rival land masks present, no helper/synthetic layers, unfiltered tiles, aligned active fill/contour, and zero console errors. Cache proof saved `task-images/territory-open-endpoint-cache-proof.jpg` with v16 cached paint `526ms`, 304 polygon revalidation, and no full polygon download.

### Version: DV-2026-06-08-06
Date: 2026-06-08
Surface: Territory additive coverage final render on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Territory render cache is now `global-owner-territory-cache-v13`. Cached repeat visits still paint a compact preview first, but the cache stores full additive render entries separately and immediately replays the full owner-level multipolygon geometry as the final state. Final active/rival fills and contours render as one multipolygon path per owner, with small post-conflict crumb components filtered before contour extraction instead of permanently capping the owner to preview regions.
Why: The v12 fix made repeat loads look clean by preserving only the largest preview landmasses, but the requested territory model requires final owned land to be the add-up of all run coverage, with newest-overlap clipping only exact contested cells.
Rollback target: `DV-2026-06-08-05`
Notes: Red live proof after removing the cap rendered one active path with `256` move commands and visible Queens crumb artifacts. Green proof saved `task-images/territory-additive-full-shared-proof.jpg` with live backend `activeBackendCells=3566`, `activeRouteTraceCount=608`, final DOM `activeConcrete=1`, `activeContour=1`, `activeConcreteMoveCommandCount=7`, `rivalConcrete=3`, no helper/synthetic paths, aligned fill/contour boxes, and zero console errors. Cache proof saved `task-images/territory-additive-cache-proof.jpg` with v13 full render region count `273`, preview region count `26`, cached paint `689ms`, raw polygon cache deleted before revisit, 304 polygon revalidation, and no full polygon download. Flushing proof saved `task-images/territory-additive-flushing-proof.jpg`; older Flushing still saw `15953` `Hermes Flushing Conqueror` cells with aligned owner-level fill/contours at zoom 11/13/15.

### Version: DV-2026-06-08-05
Date: 2026-06-08
Surface: Territory compact cached render on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Territory render cache is now `global-owner-territory-cache-v12`. Cached and fresh preview geometry no longer spreads one owner across geographic buckets; it sorts concrete regions by real area and keeps the largest landmasses first, capped at 4 active regions and 12 rival regions per owner. The cache runtime verifier now fails active broken-piece regressions and waits for real map tile coverage before saving its screenshot artifact.
Why: The newest-overlap-wins backend was correct, but the previous cache preview still preserved small disconnected crumb fragments, making owned land look broken into pieces.
Rollback target: `DV-2026-06-08-04`
Notes: Red proof reproduced `activeConcrete=64` on live `/territory`. Green shared-account proof saved `task-images/territory-broken-pieces-fixed-shared-proof.jpg` with `activeConcrete=4`, `activeContour=4`, `rivalConcrete=28`, `rivalContour=28`, aligned active fill/contour boxes, unfiltered tiles, and zero console errors. Cache proof saved `task-images/territory-broken-pieces-fixed-cache-proof.jpg` with cached paint `458ms`, v12 render index, deleted raw polygon cache, 304 polygon revalidation, no full polygon download, and no active broken-piece replay. Flushing proof still showed older Flushing sees `15953` `Hermes Flushing Conqueror` cells with aligned fill/contours at zoom 11/13/15.

### Version: DV-2026-06-08-04
Date: 2026-06-08
Surface: Territory newest-overlap conquest on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Territory conquest now follows the user sketch: the newest land-mask row/activity wins each overlapping response cell, the older owner is clipped out of that overlap, and coverage density only tie-breaks equal recency. `/api/territory/polygons` and `/api/territory` now use the same recency-first owner choice. Cache signatures were bumped to `land-mask-union-v18-newest-overlap-wins`, `territory-map-v11-newest-overlap-wins`, and `global-owner-territory-cache-v11` so old strength-first cached renders are ignored.
Why: The previous strength-first rule let older dense masks keep overlap against newer territory, which contradicted the provided conquest layout and made new land claims feel non-conquering.
Rollback target: `DV-2026-06-08-03`
Notes: Backend red/green coverage now proves a sparse newer runner takes overlap from denser older coverage in both the territory grid and polygon mask APIs. Runtime API proof returned polygon signature `land-mask-union-v18-newest-overlap-wins` and territory ETag `territory-map-v11-newest-overlap-wins`. Cache proof saved `task-images/territory-newest-overlap-cache-proof.jpg` with cached paint `560ms`, v11 render index, no raw polygon cache, 304 polygon revalidation, and no full polygon download. Flushing conquest proof saved `task-images/territory-newest-overlap-flushing-proof.jpg`; the older Flushing account saw `15953` cells owned by `Hermes Flushing Conqueror`, kept `1282` older active cells, and rendered aligned conqueror fill/contours at zoom 11/13/15.

### Version: DV-2026-06-07-19
Date: 2026-06-07
Surface: Territory global owner rendering on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-flushing-conquest-runtime.mjs`, `.tools/verify-territory-live-shared-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Restored `/territory` as a global owner map. The frontend now passes every returned backend owner polygon through the owner merge/latest-wins resolver, paints non-active owners in lower rival panes, paints the active owner above them, and stamps owner metadata onto SVG paths for cross-account runtime proof. Fill and contour now both render as owner-level multipolygon paths, so each owner's border follows the same concrete land geometry as the fill.
Why: The previous active-only filter hid global owners from other accounts, so `Hermes Flushing Conqueror` did not show up on the older Flushing account even though the backend returned it.
Rollback target: `DV-2026-06-07-18`
Notes: Verified with older Flushing logged into live `/territory`: API showed `Hermes Flushing Conqueror` owned `32414` cells and older active overlap was `0`; browser proof at zoom 11/13/15 rendered `rivalConcrete=4`, `rivalContour=4`, `conquerorConcrete=1`, `conquerorContour=1`, owner names included `Hermes Flushing Conqueror`, active and conqueror fill/contour boxes aligned, map tile filter was `none`, and screenshot artifact was `task-images/territory-flushing-global-users-proof.jpg`. Shared-account proof rendered `activeConcrete=1`, `activeContour=1`, `rivalConcrete=4`, `rivalContour=4`, zero synthetic/helper paths, zero console errors, and screenshot artifact `task-images/territory-live-shared-global-users-proof.jpg`.

### Version: DV-2026-06-07-18
Date: 2026-06-07
Surface: Territory startup loading animation on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the Territory startup loading treatment with the same Heatmap loading page structure while the route waits for auth hydration and the initial `/api/territory` shell data. The loader now uses the Heatmap shell/empty-state classes and exits before the concrete map renders.
Why: The Territory page previously mounted the map shell immediately at startup, which could read as stuck or blank before the first territory data arrived.
Rollback target: working tree before DV-2026-06-07-18
Notes: Verified with a Playwright proof that delayed `/api/territory`: `heatmap-page territory-loading-page`, `heatmap-page-map-shell`, `heatmap-page-empty`, and `heatmap-page-empty-copy` were present with `aria-busy=true`; no custom route-loading bar was present. The live map then rendered with `activeConcrete=1`, `activeContour=4`, `rivalConcrete=0`, `rivalContour=0`, and zero console errors. Screenshot artifact: `task-images/territory-heatmap-loading-proof.jpg`.

### Version: DV-2026-06-07-17
Date: 2026-06-07
Surface: Territory exact border alignment on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `.tools/verify-territory-live-shared-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Removed the independent cubic SVG contour rewrite from Territory. Active concrete land still renders as one exact Leaflet multi-polygon fill, and the visible border now renders as stroke-only Leaflet polygons built from the same territory rings with `smoothFactor: 0`, so the border follows the actual filled land edge.
Why: Close-zoom proof showed the cubic contour could drift away from the filled territory edge, creating borders that did not draw along the owned land.
Rollback target: working tree before DV-2026-06-07-17
Notes: Verified with in-app Browser on live `/territory`: `activeConcrete=1`, `activeContour=4`, `rivalConcrete=0`, `rivalContour=0`, `lineCommandCount=25721`, `cubicCount=0`, unfiltered tiles, and contour/fill `boxDelta=0`. Runtime proofs passed: authenticated `TERRITORY_PROOF_BROWSER=playwright node .tools/verify-territory-border-runtime.mjs --url http://localhost:8080/territory --screenshot task-images/territory-border-aligned-proof.jpg` and `node .tools/verify-territory-live-shared-runtime.mjs --zoom 12 --screenshot task-images/territory-border-aligned-live-proof.jpg`.

### Version: DV-2026-06-07-16
Date: 2026-06-07
Surface: Territory v8 loop-interior land on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Restored backend v8 closed-loop territory masks so legitimate loop-enclosed land is real owned territory instead of a hollow route corridor. The frontend no longer rewrites the filled land SVG path with smoothed contour geometry; it uses Leaflet's exact composed polygon fill and keeps cubic smoothing only on the visible contour stroke.
Why: The v7 route-corridor-only mask left black holes inside claimed loop territory, and smoothing the fill path could not fix missing backend land. Loop interiors now come from backend mask cells, not fake frontend fields or helper layers.
Rollback target: working tree before DV-2026-06-07-16
Notes: Verified with Browser plugin on live `/territory`: `activeConcrete=1`, `activeContour=1`, `rivalConcrete=0`, `rivalContour=0`, `fieldLayerCount=0`, `genericRegionCount=0`, `fillRule=nonzero`, unfiltered tiles, and no visible interior cutouts. Runtime proofs passed: `node .tools/verify-territory-live-shared-runtime.mjs --screenshot task-images/territory-v8-loop-interior-proof.jpg` and authenticated `TERRITORY_PROOF_BROWSER=playwright node .tools/verify-territory-border-runtime.mjs --url http://localhost:8080/territory --screenshot task-images/territory-v8-border-proof.jpg`.

### Version: DV-2026-06-07-15
Date: 2026-06-07
Surface: Territory solid outer-contour land on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `.tools/verify-territory-live-shared-runtime.mjs`, `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Finalized Territory as active-only concrete land: backend masks use route-corridor v7 rows and response unions no longer flood-fill interior voids; frontend no longer runs visual void sealing, does not paint rival/helper/field layers, and fills each active component from its smoothed outer contour with `fillRule: nonzero` plus fill-only winding normalization so the owned surface no longer shows broken black interior cutouts.
Why: The previous iterations alternated between fake slabs and broken interior holes. The final rendering keeps ownership grounded in backend concrete mask cells while making the visible active territory read as one solid INTLV-style land surface.
Rollback target: working tree before DV-2026-06-07-15
Notes: Verified with Browser plugin on live `/territory`: `activeConcrete=1`, `activeContour=4`, `fieldLayerCount=0`, `genericRegionCount=0`, `fillRules=["nonzero"]`, cubic-only SVG paths. Runtime proofs passed: `node .tools/verify-territory-border-runtime.mjs` and `node .tools/verify-territory-live-shared-runtime.mjs`; screenshot artifact: `task-images/territory-solid-contour-fill-20260607.png`.

### Version: DV-2026-06-07-14
Date: 2026-06-07
Surface: Territory route-grounded visual sealing on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Tightened the Territory frontend visual seal from a broad 32-cell / 32x fill cap to an 8-cell / 6x cap, so a Central Park-style near-closed route gap no longer turns into a fake filled slab. The renderer still repairs small grid voids inside connected concrete components, but true enclosed land remains owned by backend route-loop masks.
Why: The previous wide seal fixed black holes but could visually invent park-sized land across a real route opening, which made the territory look like an artificial blob instead of concrete route-owned land.
Rollback target: working tree before DV-2026-06-07-14
Notes: Red/green guard now simulates a long near-closed Central Park loop and rejects the overfill case (`addedTiles=8460`, accepted before fix). Runtime live shared-account proof is blocked in this session because the in-app browser blocks loopback URLs and the local shared-runner password currently rejects the verifier login; source/runtime sync and backend route-mask tests passed.

### Version: DV-2026-06-07-13
Date: 2026-06-07
Surface: Privacy policy light-mode trust page on `/privacy`
Files: `frontend/src/pages/LegalPage.jsx`, `frontend/src/styles/_split/misc.css`, `frontend/src/styles/style.css`, `frontend/src/pages/legalPrivacyRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Converted the Privacy legal-page treatment from dark Kinetic Editorial to the Hermes light-mode gallery palette: warm paper background, white translucent panels, dark readable typography, muted coral/sage accents, and a dark-tone Hermes logo while preserving the asymmetric trust panel and signal strip.
Why: The page was visually dark even under the site light theme, which conflicted with the requested light-mode Privacy surface.
Rollback target: working tree before DV-2026-06-07-13
Notes: Presentation-only frontend change. Legal copy, routing, auth-aware back navigation, footer links, public `/privacy` access, and the Privacy-only layout split from `/terms` are preserved.

### Version: DV-2026-06-07-12
Date: 2026-06-07
Surface: Territory solid active-land interior on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Increased the component-local visual seal radius and fill cap for Territory concrete masks so route-enclosed interior voids render as solid active land instead of black holes inside the owned shape. The change stays in the frontend visual mask layer, now uses a wider seal tuned from live Browser proof, and does not add backend ownership, synthetic district fields, rival paint, or owner-wide hulls.
Why: Browser proof on the live shared-runner `/territory` page showed the active concrete path had correct nonzero fill winding but still displayed dark interior gaps because the visual seal treated smooth-boundary bays as exterior at grid resolution.
Rollback target: working tree before DV-2026-06-07-12
Notes: Verified with in-app Browser and live zoom-17 proof: `activeConcrete=1`, `activeContour=4`, main contour `stableContourPoints=367`, `fillRule=nonzero`, `rivalConcrete=0`, `rivalContour=0`, `syntheticFields=0`, `helperPaths=0`, unfiltered Leaflet tiles, and zero console errors. Keep future fixes anchored to backend land-mask cells plus component-local interior sealing; do not restore fake INTVL rectangles or broad bounds-derived slabs.

### Version: DV-2026-06-07-11
Date: 2026-06-07
Surface: Privacy policy editorial trust page on `/privacy`
Files: `frontend/src/pages/LegalPage.jsx`, `frontend/src/styles/_split/misc.css`, `frontend/src/styles/style.css`, `frontend/src/pages/legalPrivacyRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Gave the Privacy variant of the shared legal page a distinct Kinetic Editorial layout with an asymmetric hero, a privacy trust panel, icon-led data signal strip, staggered section rhythm, tactile back action, and strict mobile collapse. Terms continues to use the same content and legal page component without receiving the Privacy-only signal strip.
Why: The previous Privacy page used a generic two-column legal card grid, which made an important trust surface feel like boilerplate rather than a clear account-data promise.
Rollback target: working tree before DV-2026-06-07-11
Notes: Presentation-only frontend change. Legal copy, routing, auth-aware back navigation, footer links, and public `/privacy` access are preserved.

### Version: DV-2026-06-07-10
Date: 2026-06-07
Surface: Territory close-zoom concrete border and sealed active-land interior on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `.tools/verify-territory-live-shared-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Retuned the concrete land contour renderer for close zoom by reducing simplification, smoothing, corner radius, cubic tension, control padding, and axis softening while moving the stable contour reference zoom to 16. The Territory visual fill now seals interior voids per connected concrete component before drawing the active land surface, while still avoiding owner-wide hulls or synthetic district plates.
Why: The close-zoom active territory border still looked too coarse and the active land interior had large black voids, making the concrete owned land read as broken instead of a solid INTVL-style territory surface.
Rollback target: working tree before DV-2026-06-07-10
Notes: Verified at map zoom 15 with Hermes Shared Runner: the current main active contour uses 526 stable cubic points, reference zoom 16, zero SVG line commands, one active concrete fill, four active contour components, four active fill subpaths, no rival/helper/synthetic layers, and zero console errors. Browser and Browser Use plugin clients were unavailable in this environment because `scripts/browser-client.mjs` was missing, so runtime evidence used the repo Playwright proof helper.

### Version: DV-2026-06-06-09
Date: 2026-06-06
Surface: Territory ownership color and real-world map color on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Switched Territory to the Heatmap dark real-world tile source, matched the Heatmap tile color filter, strengthened active and rival land opacity, and increased the active ownership glow while preserving the stable contour renderer.
Why: The territory color was too hard to read over the previous real-world map treatment, and the user requested the real-world Territory map to share the Heatmap map color.
Rollback target: `eeff7a7a`
Notes: Territory ownership rendering, map tile color, and runtime proof coverage only. Routing, auth, data ownership, bilingual copy, and the no-reference policy remain unchanged.

### Version: DV-2026-06-06-08
Date: 2026-06-06
Surface: Territory zoom-stable ownership border on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Moved Territory contour simplification and axis softening to a fixed reference zoom, reprojected the same stable LatLng contour during Leaflet zoom and pan updates, and tuned the stable spline to preserve a rounded anti-grid silhouette.
Why: The border was being simplified, deduped, and softened in current screen pixels, so zooming could regenerate a different SVG outline even when the territory geometry had not changed.
Rollback target: `eeff7a7a`
Notes: Rendering stability and proof coverage only. Stroke styling, territory ownership data, auth, route navigation, bilingual copy, and the no-reference policy remain unchanged.

### Version: DV-2026-06-06-07
Date: 2026-06-06
Surface: Territory map border clarity on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Strengthened the active territory contour, slightly lowered active/rival land fill opacity, and sharpened the existing contour glow so the ownership boundary reads as a crisp single border above the land surface.
Why: The previous map pass reduced visual noise but left the active territory edge too close to the fill, making the border look weak against the map substrate.
Rollback target: `0a7d6d13`
Notes: Presentation and proof expectations only. Territory data, auth, route navigation, ownership math, bilingual copy, and the no-reference policy remain unchanged.

### Version: DV-2026-06-06-06
Date: 2026-06-06
Surface: Territory premium map-first composition on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Softened the base map substrate, reduced active/rival land opacity and contour weights, removed the animated dashed active border, and hid the permanent HUD/dock chrome so the full-bleed territory ownership layer reads as the primary organized surface.
Why: Browser comparison showed the previous page still felt visually noisy: multiple permanent panels competed with the map, and the high-opacity/dashed land treatment made the ownership layer look less polished.
Rollback target: `working tree before DV-2026-06-06-06`
Notes: Presentation and proof expectations only. Territory data, auth, route navigation, ownership math, bilingual copy, and the no-reference policy remain unchanged.

### Version: DV-2026-06-06-05
Date: 2026-06-06
Surface: Territory organized ownership layers on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Moved Territory land rendering into explicit Leaflet panes for rival fill, rival contour, active fill, and active contour, with active-owned land always above rival borders. The runtime proof now verifies pane existence, z-order, and layer class placement.
Why: Browser inspection showed rival contour paths were drawn after active fills, letting opponent borders visually cut through the user-owned layer and making the map feel disorganized.
Rollback target: `040ea264`
Notes: Frontend render ordering and proof coverage only. Territory data, auth, route navigation, ownership math, and visual copy remain unchanged.

### Version: DV-2026-06-06-04
Date: 2026-06-06
Surface: Territory owned-land focus on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Split active and rival land-mask SVG layers, strengthened the active owned-land fill and animated boundary, subdued rival territory, and compressed the campaign/HUD/dock chrome so the map territory carries the visual hierarchy.
Why: Browser/reference review showed the prior pass still leaned on surrounding panels instead of making the runner-owned territory feel like the premium game surface.
Rollback target: `f3b7faea`
Notes: Frontend presentation and runtime proof expectations only. Territory APIs, auth, route navigation, ownership logic, and the no-reference policy remain unchanged.

### Version: DV-2026-06-06-03
Date: 2026-06-06
Surface: Territory campaign-quality game layer on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a black/coral campaign panel with oversized conquest messaging, live next-target pressure, start-run and recenter actions, and responsive mobile prioritization that avoids stacking every HUD panel at once.
Why: The prior pass improved data hierarchy but still lacked the bold game proposition, premium contrast, and app-poster confidence requested for the Territory surface.
Rollback target: `e4b9622e`
Notes: Frontend presentation only. Territory APIs, auth, route navigation, ownership logic, land-mask rendering, and verifier no-reference policy remain unchanged.

### Version: DV-2026-06-06-02
Date: 2026-06-06
Surface: Territory personal layout on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Replaced the oversized leaderboard drawer with a compact personal territory dock that foregrounds controlled area, coverage, rank, owned sectors, capture feed, next target, and a smaller local rival stack. The top game HUD is narrower so the concrete land map remains the dominant surface.
Why: Browser measurement showed the previous overlay stack covered too much of the viewport and made the user-owned territory feel secondary to the chrome.
Rollback target: `804d09af`
Notes: Frontend presentation and verifier wording only. Territory ownership, backend APIs, route navigation, auth, and land-mask rendering remain unchanged.

### Version: DV-2026-06-06-01
Date: 2026-06-06
Surface: Territory game-map HUD on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/styles/style.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `frontend/src/pages/territoryMultiPlayerMarkers.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the map-only Territory page as a live territory game board with labelled dark street tiles, an over-map mode selector, active runner status, local battle meter, and bottom leaderboard drawer powered by the existing `/api/territory` leaderboard and summary data.
Why: The prior page still read as a sparse utility map and did not surface capture, battle, rank, and leaderboard state strongly enough.
Rollback target: `DV-2026-06-03-02`
Notes: Frontend presentation only. Backend territory ownership, polygon masks, auth, route navigation, and latest-wins land rendering remain unchanged.

### Version: DV-2026-06-03-02
Date: 2026-06-03
Surface: Territory layered ownership on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Changed territory polygon ownership from deleting older overlapping cells to preserving every owner's claimed land as stacked layers. The API keeps older and newer overlapping masks, while the frontend paints older layers first and the most recent claim on top.
Why: The user clarified that overlapping claims should cover one another visually, not remove ownership from the covered-down territory.
Rollback target: `DV-2026-06-03-01`
Notes: Territory score ranking remains separate; this entry covers the concrete land-mask polygon stack used by `/api/territory/polygons` and the Leaflet territory view.

### Version: DV-2026-06-03-01
Date: 2026-06-03
Surface: Territory exact coverage and smoothed claim map on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Split territory land rendering into a visible exact ownership underlay plus brighter smoothed land fills and a single neon owner contour, using less aggressive smoothing and nonzero SVG fill rules so narrow claimed areas stay covered instead of being clipped by the visual path.
Why: The previous count-based fix still let smoothed fill geometry leave user-owned cells visually uncovered around red, blue, and green overlaps.
Rollback target: `working tree before DV-2026-06-03-01`
Notes: Frontend rendering and proof-harness update only. Backend ownership cells, auth, routing, and territory API contracts remain unchanged.

### Version: DV-2026-06-01-01
Date: 2026-06-01
Surface: Territory concrete land border on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the land-mask edge as layered Leaflet canvas strokes: dark undercut, warm cement bevel, chipped aggregate grit, and owner-color seam. The active territory remains a sealed conquest surface while the border reads more like a physical concrete landmass than a flat vector outline.
Why: The Territory page needed stronger visual proof that occupied land is concrete territory, not overlapping translucent sectors or route traces.
Rollback target: `working tree before DV-2026-06-01-01`
Notes: Frontend presentation only. Territory APIs, auth, route data, ownership rules, and seeded test accounts remain unchanged.
### Version: DV-2026-05-24-04
Date: 2026-05-24
Surface: Muscle Training light-theme settings contrast on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a high-specificity white-theme guard for the bottom training check-in and plan tuning console so headings, helper copy, form controls, normal day chips, select options, summary values, impact copy, and disabled buttons use dark readable text on light surfaces.
Why: The light theme inherited dark-route pale text colors inside the settings console, making several labels, values, and controls nearly invisible on white cards.
Rollback target: `DV-2026-05-24-03`
Notes: CSS and smoke-test guard only. Dark theme styling, red active states, training data, save/reset/profile APIs, exercise selection, Reference Dock, and sidebar behavior remain unchanged.

### Version: DV-2026-05-24-03
Date: 2026-05-24
Surface: Muscle Training sidebar typography on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the strength-route sidebar overrides for nav link font size, weight, letter spacing, and text transform while keeping the dark and white sidebar color branches intact.
Why: Entering the strength page made the shared left navigation text look larger than the rest of the site.
Rollback target: `DV-2026-05-24-02`
Notes: CSS and smoke-test guard only. Strength page content, global theme selection, training logic, save APIs, and the red settings control deck remain unchanged.

### Version: DV-2026-05-24-02
Date: 2026-05-24
Surface: Muscle Training settings control deck on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/styles/contrast-fixes.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the bottom training check-in and plan tuning console's leftover lime active states with the red and coral control palette used elsewhere in Hermes. Primary actions, active chips, sync pills, hover and focus states, summary borders, and the plan-impact strip now share the same red tone in both dark and white muscle themes.
Why: The settings console visually drifted from the rest of the page and still used neon green for important states, making the lower section feel disconnected.
Rollback target: `DV-2026-05-24-01`
Notes: CSS and smoke-test guard only. Check-in save, reset, profile save, fields, routes, backend APIs, exercise recommendations, Reference Dock, and training plan generation remain unchanged.

### Version: DV-2026-05-24-01
Date: 2026-05-24
Surface: Strength route sidebar theme sync on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Split the strength-route sidebar styling into dark-default and white-theme branches so the shared runner sidebar follows the strength page `data-muscle-theme` instead of always rendering as a light shell.
Why: The user reported that entering the strength area made the left sidebar turn white while the strength page itself stayed dark.
Rollback target: `DV-2026-05-19-06`
Notes: This is a scoped visual repair for `/muscle-training`. It does not change the global theme switch, training logic, exercise selection, media, or save APIs.

### Version: DV-2026-05-23-17
Date: 2026-05-23
Surface: Muscle Training global theme sync on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/i18n/locales/en/components.js`, `frontend/src/i18n/locales/zh-CN/components.js`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/styles/contrast-fixes.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the route-local strength theme switch and made the page follow the global app theme directly. The light variant now fixes Reference Dock headings, recommendation names, step indicators, card surfaces, and active controls so they stay readable on the white surface.
Why: The strength page should not have a second theme system, and the first white-theme pass left several titles and neon labels unreadable.
Rollback target: `DV-2026-05-23-16`
Notes: Frontend presentation only. Routes, backend APIs, training plan logic, check-in save, profile save, exercise image mapping, and video embeds remain unchanged.

### Version: DV-2026-05-23-16
Date: 2026-05-23
Surface: Muscle Training local themes on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/i18n/locales/en/components.js`, `frontend/src/i18n/locales/zh-CN/components.js`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/styles/contrast-fixes.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a local dark and white theme switch for the strength page, tied the default to the global app theme, persisted manual selection, and rebuilt the white theme surfaces for the workbench, exercise cards, Reference Dock, and settings console.
Why: The strength page was effectively dark-only because its route CSS overrode the global light theme.
Rollback target: `DV-2026-05-23-15`
Notes: Frontend presentation only. Routes, backend APIs, training plan logic, check-in save, profile save, exercise image mapping, and video embeds remain unchanged.

### Version: DV-2026-05-23-15
Date: 2026-05-23
Surface: Muscle Training settings purpose on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/i18n/locales/en/components.js`, `frontend/src/i18n/locales/zh-CN/components.js`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reframed the training profile panel as plan tuning, added draft-based preview results, field-level impact hints, a synced or unsaved state chip, and clearer save copy that explains the plan refresh.
Why: The previous settings area looked like a questionnaire and did not clearly show why the user should answer those fields.
Rollback target: `DV-2026-05-23-14`
Notes: Frontend presentation and copy only. Check-in, profile save, reset, routes, APIs, fields, and plan generation remain unchanged.

### Version: DV-2026-05-23-14
Date: 2026-05-23
Surface: Muscle Training settings chip readability on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a final light-theme override so active settings chips keep dark text on the lime background.
Why: `body.theme-light` was repainting active settings chips with pale text, leaving `计划中`, `轻松跑`, `周一`, and `周四` at very low contrast.
Rollback target: `DV-2026-05-23-13`
Notes: CSS-only readability fix. Check-in, profile save, reset, fields, layout, routes, APIs, and training data are unchanged.

### Version: DV-2026-05-23-13
Date: 2026-05-23
Surface: Muscle Training settings console readability on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Filled enabled settings primary actions with the lime treatment and replaced the low-contrast profile pills with readable light text on a restrained green tint.
Why: The compact settings console still had dark action text and red-brown preference pills that were hard to read on the black training surface.
Rollback target: `DV-2026-05-23-12`
Notes: CSS-only readability fix. Check-in save, profile save, reset, form fields, APIs, routes, training data, and layout structure are unchanged.

### Version: DV-2026-05-23-12
Date: 2026-05-23
Surface: Muscle Training hero CTA on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a dedicated label wrapper to the top hero CTA and tightened its internal grid, line-height, icon sizing, and no-wrap behavior so `记录今日训练` stays on one readable line beside the arrow.
Why: The CTA text could collapse into three stacked Chinese lines, making the main action look broken.
Rollback target: `DV-2026-05-23-11`
Notes: The CTA still uses the same localized copy and the same `scrollToControls` click behavior. No settings, training data, recommendation, route, or backend behavior changed.

### Version: DV-2026-05-23-11
Date: 2026-05-23
Surface: Muscle Training compact settings console on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the bottom settings area into a compact two-lane control console, with today check-in on the left and training profile preferences on the right. The plan source moved into a lightweight inline note, the profile summary became a compact data strip, and the plan-impact copy became a short bottom strip.
Why: The previous bottom settings area looked like two large stacked admin forms with heavy blank space and weak hierarchy.
Rollback target: `DV-2026-05-23-10`
Notes: Check-in save, check-in reset, profile save, existing fields, backend APIs, training plan generation, muscle selection, exercise details, and Reference Dock behavior are unchanged.

### Version: DV-2026-05-23-10
Date: 2026-05-23
Surface: Muscle Training settings visibility and contrast on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the vague coach-settings disclosure button so the check-in and training profile panels are directly visible, then strengthened the dark settings deck contrast for summary cards, form controls, disabled actions, and native select options.
Why: The grey "Open coach settings" button added no useful meaning, and some settings text was still too dim or washed out when selecting options.
Rollback target: `DV-2026-05-23-09`
Notes: Settings functionality, save flows, check-in reset, profile fields, routes, backend APIs, and training logic are unchanged.

### Version: DV-2026-05-23-09
Date: 2026-05-23
Surface: Muscle Training settings readability on `/muscle-training`
Files: `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Raised contrast inside the expanded settings deck for the today check-in card and training profile card, including muted copy, summary values, form controls, day chips, and disabled buttons.
Why: Some words in the dark bottom settings area were too dim to read clearly.
Rollback target: `DV-2026-05-23-08`
Notes: CSS-only readability fix. Save flows, profile fields, training data, routes, API contracts, and layout structure are unchanged.

### Version: DV-2026-05-23-08
Date: 2026-05-23
Surface: Muscle Training profile controls on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/i18n/locales/en/components.js`, `frontend/src/i18n/locales/zh-CN/components.js`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Upgraded the bottom Training Profile preferences panel with a real summary strip and plan-impact notes, while keeping the existing preference fields and save flow.
Why: The profile record area looked like a plain stacked form and needed clearer information density without adding fake log controls or new backend fields.
Rollback target: `DV-2026-05-23-07`
Notes: This only changes the bottom expanded settings profile panel. Muscle selection, recommendations, exercise details, Reference Dock, profile API shape, routes, and training logic are unchanged.

### Version: DV-2026-05-23-07
Date: 2026-05-23
Surface: Muscle Training expanded exercise detail on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the expanded action detail card so the prescription, steps, and intent stay in a left record area while the existing `MuscleHeatmap` sits inside the same frame on the right.
Why: The lower half of the muscle-training detail card looked unbalanced, and the requested layout was record content on the left with the anatomy figure on the right.
Rollback target: `DV-2026-05-23-06`
Notes: This is a local layout-only change. Top muscle selection, recommended actions, Reference Dock, training logic, routes, backend contracts, videos, and image mappings are unchanged.

### Version: DV-2026-05-23-06
Date: 2026-05-23
Surface: Muscle Training muscle selector on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a persistent selected ring to the anatomy image. Clicking the image keeps that specific ring visible, and clicking a visible muscle button keeps that muscle area's primary ring visible.
Why: The selector needed to show the current body-part choice after the click instead of losing the visual target immediately.
Rollback target: `DV-2026-05-23-05`
Notes: This only changes selector feedback. Training logic, recommendations, videos, exercise images, routes, and backend contracts are unchanged.

### Version: DV-2026-05-23-05
Date: 2026-05-23
Surface: Muscle Training muscle selector on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Restored anatomy-image body-part clicking with transparent hit zones aligned to the current 512px image, while keeping the six visible muscle buttons as the readable labels.
Why: Removing the bad hotspot circles also removed the expected body-part click path, so the selector needed clickable anatomy areas without misleading visible markers.
Rollback target: `DV-2026-05-23-04`
Notes: No training logic, action recommendation rules, video embeds, image mapping, routes, or backend contracts changed.

### Version: DV-2026-05-23-04
Date: 2026-05-23
Surface: Muscle Training muscle selector on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the anatomy-image hotspot layer because its percentage coordinates did not match the current image. The anatomy image is now visual context only, and the six visible muscle buttons are the only selector.
Why: The hotspot circles could appear over the abdomen, chest, or empty space while shoulder was selected, creating a misleading interaction.
Rollback target: `working tree before this change`
Notes: No training logic, action recommendation rules, video embeds, image mapping, routes, or backend contracts changed.

### Version: DV-2026-05-23-03
Date: 2026-05-23
Surface: Muscle Training muscle selector on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Kept the anatomy image hotspots, made their default hit areas visible, and added six clear muscle shortcut buttons below the image. Both paths now use the same top-muscle selection handler and expose a stronger selected state.
Why: The previous selector required users to guess where the invisible hotspots were, making the first interaction feel unreliable.
Rollback target: `working tree before this change`
Notes: No training logic, action recommendation rules, video embeds, image mapping, routes, or backend contracts changed.

### Version: DV-2026-05-23-02
Date: 2026-05-23
Surface: Muscle Training right media rail on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Wrapped the right-side video and reference card in an inner sticky rail for desktop, capped its viewport height, and restored normal document flow below 1180px. The page-level overflow rules now avoid creating an outer scroll ancestor that breaks sticky behavior.
Why: The user wanted the action demo video and professional tip card to stay visible while scrolling the desktop exercise list, without covering the mobile layout.
Rollback target: `working tree before this change`
Notes: No exercise selection, image resolution, video embed mapping, or training data behavior changed.

### Version: DV-2026-05-23-01
Date: 2026-05-23
Surface: Muscle Training exercise reference rail on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/assets/muscle-training/ASSET_SOURCES.md`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the repeated target-area image in the right-side reference rail with action-keyed online exercise images. Top action thumbnails and the top reference dock now use the same exercise image resolver, with target-area imagery only as a fallback.
Why: The user reported that the right-side image stayed the same across exercises and asked for each action to have its own image from the web.
Rollback target: `working tree before this change`
Notes: No backend contract, training recommendation logic, video embed mapping, or route behavior changed.

### Version: DV-2026-05-22-06
Date: 2026-05-22
Surface: Muscle Training top anatomy workbench on `/muscle-training`
Files: `frontend/src/pages/MuscleTraining.jsx`, `frontend/src/styles/_split/muscle-training.css`, `frontend/src/styles/contrast-fixes.css`, `frontend/src/assets/muscle-training/anatomy-neon-selector.png`, `frontend/src/i18n/locales/en/components.js`, `frontend/src/i18n/locales/zh-CN/components.js`, `frontend/src/pages/muscleTrainingFriendlyDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a screenshot-matched top workbench with a local neon anatomy image, clickable muscle-group hotspots, a real recommendation list, and a right Reference Dock synced to the selected action.
Why: The user supplied the target HTML and wanted only the top strength area rebuilt around a usable anatomy image, without reworking the lower action protocol workbench.
Rollback target: `working tree before this change`
Notes: The lower protocol rows and existing plan/library data contracts are preserved.

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

### Version: DV-2026-06-06-01
Date: 2026-06-06
Surface: Territory reference-style plate map on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Reworked the visible ownership layer from coral neon blobs into darker, INTVL-like translucent map plates: muted blue/green/yellow/magenta/slate fills, stronger plate opacity, thinner pale boundaries, no active glow, and a less washed-out dark map veil while preserving sharp Leaflet tiles.
Why: The user asked to continue improving Territory until it looks closer to INTVL's territory screenshot.
Rollback target: working tree before `DV-2026-06-06-01`
Notes: This is a visual layer pass only. `/territory` still renders only Hermes Shared Account active backend masks, keeps all 79 active regions visible in live proof, and does not paint rival/other-user map territory.

### Version: DV-2026-06-06-02
Date: 2026-06-06
Surface: Territory game chrome on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Replaced the visible old map titlebar, side route rail, and campaign card with a centered top game HUD and a rounded bottom leaderboard sheet. The sheet now includes four tabs, up to eight leaderboard rows, and the shared runner navigation as a compact bottom nav while the active territory map remains visible behind it.
Why: The previous plate-map pass still looked broken because the page chrome did not match the reference game-map composition and mobile CSS could still hide the HUD.
Rollback target: `DV-2026-06-06-01`
Notes: This is a frontend chrome/layout pass only. Live Chrome proof after build/runtime sync showed 79 active concrete land paths, 79 active contours, 0 rival paths, visible HUD/dock/tabs/bottom nav, hidden legacy title/rail/campaign chrome, sharp tiles (`filter: none`, `opacity: 1`, `mix-blend-mode: normal`), and no console warnings/errors. Browser Use remains unavailable because the installed plugin lacks `scripts/browser-client.mjs`; the repo wrapper verifier is also blocked by a missing `browser_harness.run` Python module, so direct Chrome proof was used.

### Version: DV-2026-06-06-03
Date: 2026-06-06
Surface: Territory portrait phone-stage on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.omx/state/territory/ralph-progress.json`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `DESIGN_VERSIONS.md`
What changed: Desktop `/territory` now renders as a centered portrait app frame with rounded device rim, notch and home indicator, clipped sharp Leaflet map, top segmented control/player badge, right action rail, and compact bottom tab/nav sheet. The old full-bleed runner-shell two-column grid is overridden for this surface so the frame centers correctly.
Why: The reference territory snapshot is a phone-stage game map, while Hermes was still a full-bleed desktop map after the previous chrome pass.
Rollback target: `DV-2026-06-06-02`
Notes: Live Chrome proof after build/runtime sync showed a centered 500px x 917px frame, 474px x 891px map, visible HUD/dock/side actions, hidden old title/rail/campaign chrome, 79 active owned paths, 0 rival paths, sharp tiles, and no console warnings/errors. Visual verdict is `78/revise`: major chrome/category match is achieved, but the real Hermes owned masks are still sparser than the reference's broad local territory plates.

### Version: DV-2026-06-06-04
Date: 2026-06-06
Surface: Territory active-owner field on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added an active-only broad territory field beneath the precise concrete land mask and removed the active nth-of-type color cycling so Hermes Shared Account renders as one coral owner color. The field expands active backend mask tiles visually without entering ownership resolution, while concrete land and contour remain crisp, normal-blended SVG paths over unfiltered Leaflet tiles.
Why: The previous portrait pass still looked broken because sparse backend cells read as missing territory and the active palette cycling made one Hermes account look like multiple users.
Rollback target: `DV-2026-06-06-03`
Notes: Live Chrome proof after build/runtime sync showed 22 active field paths, 97 active concrete land paths, 97 active contours, 0 rival field/land/contour paths, one active fill color `rgb(240, 117, 97)`, sharp tiles (`filter: none`, `opacity: 1`, `mix-blend-mode: normal`), and a centered 500px x 917px phone frame.

### Version: DV-2026-06-07-01
Date: 2026-06-07
Surface: Territory website-layout correction on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `DESIGN_VERSIONS.md`, `.omx/state/territory/ralph-progress.json`
What changed: Removed the portrait phone-stage chrome, side action bubbles, mobile sheet tabs, and bottom-nav additions from the Territory surface. Restored the website map title/action strip and previous overlay positioning while keeping the active-only coral territory field, sharper real-world tiles, and active-only backend mask rendering.
Why: The user clarified that the goal is not to make `/territory` look like a phone app; only the territory shapes should move toward the INTVL-style filled map treatment.
Rollback target: `DV-2026-06-06-04`
Notes: Targeted smoke guards now reject phone-app selectors and portrait-stage CSS while preserving the broad active field checks. Frontend build and runtime sync passed after this correction.

### Version: DV-2026-06-07-02
Date: 2026-06-07
Surface: Territory INTVL-style plate field on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.omx/state/territory/ralph-progress.json`
What changed: Refined the active-only Hermes Shared Account field into a more INTVL-like territory plate: broader component-bounds expansion, lower translucent fill, subtle coral edge stroke, mitered joins, and no contour-smoothing pass on the broad field. The precise concrete land and active contour still render above it, while the website title/action strip and page layout remain unchanged.
Why: The official INTVL territory screenshot shows large translucent map plates with sharp real-world streets visible through them and straighter neighborhood/block edges, not a rounded glow/blob treatment.
Rollback target: `DV-2026-06-07-01`
Notes: Browser Use could not be used because its required bundled plugin files are missing in this environment. The implementation was guided by the official INTVL site image and guarded by Territory smoke tests, frontend build/runtime sync, and a one-process Playwright fixture proof saved at `task-images/territory-intvl-plate-field-proof.jpg`.

### Version: DV-2026-06-07-03
Date: 2026-06-07
Surface: Territory website map with meter-sized active plate field on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.omx/state/territory/ralph-progress.json`
What changed: Kept the existing website Territory page shell and changed only the map territory rendering: the active-only Hermes Shared Account broad field now uses a meter-sized component envelope with an 8km x 4.8km minimum footprint, 800m expansion, 420m chamfer, 0.44 translucent fill, subtle 1.05px edge, mitered joins, and no smoothing pass on the broad plate. The precise concrete land and active contour remain above it.
Why: The user clarified the target is not a phone-app redesign; the Territory page should stay a website map while the territory shapes move toward INTVL's broad translucent real-map plate style.
Rollback target: `DV-2026-06-07-02`
Notes: Browser Use remains unavailable because the bundled Browser Use skill/client files are missing. The verified Playwright fixture proof saved `task-images/territory-intvl-plate-field-proof.jpg` and showed 1 active field, 1 active concrete land, 1 active contour, 0 rival field/land/contour paths, 0 phone-app selectors, unfiltered Leaflet tiles, and a `276px x 166px` active field footprint.

### Version: DV-2026-06-07-04
Date: 2026-06-07
Surface: Territory block-notched active plate field on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.omx/state/territory/ralph-progress.json`
What changed: Replaced the active field's plain chamfered rectangle with a larger meter-sized block-notched plate outline: 8.8km x 5.8km minimum footprint, 800m expansion, 420m chamfer, 760m deterministic block step, 0.44 fill, and 1.05px mitered edge. Runtime proof now requires a multi-edge field path rather than accepting a simple rectangle.
Why: The prior website-layout pass still looked like a centered UI rectangle. The target territory treatment needs broad, stepped map polygons while keeping `/territory` as a website page and keeping rival/other-user territory removed.
Rollback target: `DV-2026-06-07-03`
Notes: Browser Use remains unavailable because the bundled Browser Use skill/client files are missing. The Playwright fixture proof saved `task-images/territory-intvl-plate-field-proof.jpg` and showed 1 active field, 0 rival field/land/contour paths, 0 phone-app selectors, unfiltered Leaflet tiles, 19 straight line commands, and a `304px x 200px` active field footprint.

### Version: DV-2026-06-07-05
Date: 2026-06-07
Surface: Territory same-owner plate cluster on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.omx/state/territory/ralph-progress.json`
What changed: Replaced the single active broad field with five active-only Hermes Shared Account plate paths derived from the owned component. The cluster uses a 10.4km x 6.8km minimum envelope, 800m expansion, 420m chamfer, 760m deterministic block steps, 0.34 translucent fill, and 1.05px mitered edges so the map reads as same-owner neighborhood plates rather than one centered block.
Why: The previous block-notched pass still looked like one simplified territory tile. The reference territory map reads as a dense arrangement of stepped map plates, while the user explicitly wants the website page kept and other users' territory removed.
Rollback target: `DV-2026-06-07-04`
Notes: Browser Use remains unavailable because the bundled Browser Use skill/client files are missing. The Playwright fixture proof saved `task-images/territory-intvl-plate-field-proof.jpg` and showed 5 active field paths, 1 active concrete land, 1 active contour, 0 rival field/land/contour paths, 0 phone-app selectors, unfiltered Leaflet tiles, 19 straight line commands per field, and a `323px x 211px` active field union.

### Version: DV-2026-06-07-06
Date: 2026-06-07
Surface: Territory broad same-owner mosaic on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.omx/state/territory/ralph-progress.json`
What changed: Expanded the active-only Hermes Shared Account plate layer from five paths to seven same-owner mosaic paths. The field now uses an 11.8km x 7.6km minimum envelope, 800m expansion, 420m chamfer, 760m deterministic block steps, 0.28 translucent fill, and 1.05px mitered edges, producing a wider territory mosaic with visible internal plate seams.
Why: The prior five-plate cluster moved in the right direction but still read as a compact algorithmic group. The reference territory treatment reads as a broader arrangement of stepped map plates over sharp streets.
Rollback target: `DV-2026-06-07-05`
Notes: Browser Use remains unavailable because the bundled Browser Use skill/client files are missing. The Playwright fixture proof saved `task-images/territory-intvl-plate-field-proof.jpg` and showed 7 active field paths, 1 active concrete land, 1 active contour, 0 rival field/land/contour paths, 0 phone-app selectors, unfiltered Leaflet tiles, 19 straight line commands per field, and a `407px x 255px` active field union.

### Version: DV-2026-06-07-07
Date: 2026-06-07
Surface: Territory adjacent district field on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.omx/state/territory/ralph-progress.json`
What changed: Replaced the overlapping same-owner plate offsets with seven adjacent ratio-bounded district plates separated by a 120m seam. The broad active Hermes Shared Account field now uses a brighter 0.46 translucent coral fill, 0.5 plate edge opacity, and a crisp 2px / 0.86 active concrete contour while preserving the website map shell.
Why: The previous seven-plate cluster still read as generated overlapping blocks. The user clarified the website page should remain a website; only the territory layer should move toward the INTVL-style filled district map.
Rollback target: `DV-2026-06-07-06`
Notes: Browser Use remains unavailable because the bundled Browser Use skill/client files are missing. Escalated Playwright fixture proof saved `task-images/territory-intvl-district-field-proof.jpg` and passed with 7 active field paths plus 1 active concrete land/contour, 0 rival paths, 0 helper/phone layers, unfiltered Leaflet tiles, and generated territory color metrics within the reference gates.

### Version: DV-2026-06-07-08
Date: 2026-06-07
Surface: Territory bounded INTVL district cluster on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Constrained the active-only Hermes Shared Account field to the dominant active component and its quantile core, then capped the field envelope at 10.4km x 7.2km with seven staggered block-notched district plates. This removes repeated disconnected-component carpets and the huge rectangular Long Island/Queens slab while preserving the website map shell and concrete active route contour above the field.
Why: The previous adjacent district pass still over-generated broad territory whenever the route data had disconnected activity islands. The target INTVL treatment should read as one owned district cluster around the current user's territory, not every sampled cluster or other users' space.
Rollback target: `DV-2026-06-07-07`
Notes: Escalated Playwright fixture proof saved `task-images/territory-intvl-bounded-core-proof.jpg` and passed with 8 active-fill paths, 1 active contour, 0 rival paths, sharp unfiltered Leaflet tiles, and a visibly bounded seven-district cluster around the active concrete route.

### Version: DV-2026-06-07-09
Date: 2026-06-07
Surface: Territory concrete land and border on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-border-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Removed the synthetic INTVL district-field generator, its field constants, helper functions, render entries, paint function, and CSS classes. The map now renders only real active Hermes Shared Account concrete land from backend mask cells plus its smoothed active contour border; rival panes remain mounted but receive zero paths.
Why: The user clarified that the fake district shapes were wrong. Territory should display concrete owned land and its border, not invented plates derived from bounds.
Rollback target: `DV-2026-06-07-08`
Notes: Escalated Playwright fixture proof saved `task-images/territory-concrete-border-proof.jpg` and passed with 1 active concrete land path, 1 active contour path, 0 synthetic field paths, 0 rival paths, sharp unfiltered Leaflet tiles, cubic-smoothed concrete geometry, and no helper/halo layers.

### Version: DV-2026-06-07-10
Date: 2026-06-07
Surface: Territory concrete land fidelity on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Limited backend response-level interior filling to tiny compact void components so nearby recent-run corridors no longer become one invented land slab. Reduced frontend mask source brush expansion to cell-scale fidelity, removed visual contour pruning that dropped legitimate small owned pieces, and skipped only degenerate screen-space contour strokes while preserving real concrete land fills.
Why: The previous pass still produced weird shapes because backend union hole filling and frontend visual expansion were inventing or deleting land around real runs. Territory should read as concrete land claimed from actual activity masks, with no synthetic district fields and no overfilled gaps between separate corridors.
Rollback target: `DV-2026-06-07-09`
Notes: Focused backend regression passed for recent run corridors and small interior voids. Escalated Playwright proof saved `task-images/territory-concrete-fidelity-proof.jpg` and passed with 65 active concrete land paths, 1 active curved contour, 0 rival paths, 0 synthetic/helper fields, sharp unfiltered Leaflet tiles, and stable cubic contour geometry.

### Version: DV-2026-06-07-11
Date: 2026-06-07
Surface: Territory shared-account concrete land on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-live-shared-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Preserved active route trace ids through unioned shared-runner land-mask responses, added a shared-runner fallback to derive trace ids from RUN activities when stored union rows have no activity id, and changed the Territory renderer to use route traces only as bounded geometry guidance adjacent to real backend-owned cells. The visible border now promotes only the outer contour for each connected concrete component, so internal mask loops no longer render as tangled active borders.
Why: The live Hermes Shared Account page was still exposing raw mask fragments and internal contours as weird shapes instead of one concrete owned land surface around actual conquered routes.
Rollback target: `DV-2026-06-07-10`
Notes: Escalated live Playwright proof logged in as `Hermes Shared Runner` and saved `task-images/territory-live-shared-account-proof.jpg`. Proof showed `activeRouteTraceCount=18`, `activeBackendCells=44475`, `activeContour=1`, `rivalConcrete=0`, `rivalContour=0`, `syntheticFields=0`, `helperPaths=0`, sharp unfiltered Leaflet tiles, and zero console errors after restarting the stale local backend runtime.

### Version: DV-2026-06-07-12
Date: 2026-06-07
Surface: Territory extra-layer cleanup on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-live-shared-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Disabled the stale `.terr-map-section::after` pseudo overlay in Territory map-only mode and changed active concrete land rendering from many semi-transparent per-region polygons to one composed multi-polygon path per owner entry. The composed fill now aligns every SVG subpath to the same winding direction so internal boundary loops cannot become cutout holes.
Why: The old pseudo-element could appear as an extra dark map layer, per-region active fills could visually stack into darker patches inside the territory, and opposite-winding subpaths in the composed fill could cut holes through owned land.
Rollback target: `DV-2026-06-07-11`
Notes: Escalated live Playwright proof logged in as `Hermes Shared Runner` and saved `task-images/territory-live-shared-account-proof.jpg`. Proof showed `activeConcrete=1`, `activeConcreteSubpathSigns=[1]`, `rivalConcrete=0`, `syntheticFields=0`, `helperPaths=0`, `mapSectionAfterStyle.display=none`, `mapSectionAfterStyle.backgroundImage=none`, sharp unfiltered Leaflet tiles, and zero console errors.

### Version: DV-2026-06-07-13
Date: 2026-06-07
Surface: Territory Heatmap startup loading page on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-loading-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Updated the Territory startup loader to mirror Heatmap's full loading-page scaffold: the same `heatmap-page-map-shell`, map canvas, vignette node, topbar brand/search/action strip, and centered `heatmap-page-empty` status card. Territory keeps its own loading copy and links, but the first paint now uses the same page structure as `/heatmap`.
Why: The previous Territory loading pass reused the Heatmap empty-card classes but skipped the surrounding Heatmap canvas and topbar skeleton, so it did not visually read as the same loading page.
Rollback target: `DV-2026-06-07-12`
Notes: Source guard now requires the Heatmap canvas, vignette, topbar, brand/search/action strip, and empty card in `TerritoryInitialLoading`. Escalated runtime proof saved `task-images/territory-heatmap-startup-loading-proof.jpg` and passed with `loadingPage=true`, Heatmap shell/canvas/vignette/topbar/actions/empty card present, `territoryMapMounted=false` while `/api/territory` was pending, and zero console errors.

### Version: DV-2026-06-07-14
Date: 2026-06-07
Surface: Territory Flushing conquest proof on `/territory`
Files: `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`, `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapConfiguration.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/main/resources/application.properties`, `backend/src/test/java/com/hermes/backend/LocalSharedRunnerBootstrapServiceTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `.tools/verify-territory-flushing-conquest-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added the local `territory-flushing-conqueror@hermes.local` mock runner with three recent full-Flushing activities and persisted land-mask territory. Territory ownership proof now uses exact response-cell overlap to verify that older Flushing cells do not remain active where the newer conqueror owns the returned cells. The live zoom verifier samples zoom 11, 13, and 15 for active fill/contour alignment and active-only rendering.
Why: The requested conquest mechanism needs a mock account that covers the full Flushing board and proves latest-activity ownership really transfers territory away from the older Flushing account instead of merely rendering another mock layer.
Rollback target: `DV-2026-06-07-13`
Notes: Live backend restart seeded `Hermes Flushing Conqueror` with shoes=3 and activities=3. Escalated runtime proof saved `task-images/territory-flushing-conqueror-proof.jpg`; conqueror active bounds were `40.723532..40.782966 / -73.866553..-73.77188` with `32414` cells, older Flushing saw those `32414` cells under the conqueror owner, exact overlap with older active cells was `0`, and zoom 11/13/15 passed with active concrete=1, active contour=2, rival paths=0, unfiltered tiles, and aligned boxes.

### Version: DV-2026-06-07-15
Date: 2026-06-07
Surface: Territory cached repeat-load performance on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Added a versioned browser cache for Territory shell data, backend polygon payloads, and compact processed preview render geometry. Repeat visits now seed the map from local cache, paint compact active/rival concrete land before `/api/territory` returns, and defer polygon refresh into the background when cached data exists.
Why: Territory was too slow because repeat visits still waited for heavy polygon payloads and rebuilt million-point mask contours even when no data changed.
Rollback target: `DV-2026-06-07-14`
Notes: Escalated cache proof saved `task-images/territory-cache-proof.jpg` and passed with both `/api/territory` and `/api/territory/polygons` blocked until after paint, `cachedPaintMs=512`, active concrete/contour present, four rival owners present including `Hermes Flushing Conqueror`, unfiltered tiles, and zero console errors. Shared/global regression proof saved `task-images/territory-live-shared-cache-regression-proof.jpg` and passed with five backend polygons, four rival owners, and no synthetic/helper paths.

### Version: DV-2026-06-08-01
Date: 2026-06-08
Surface: Territory v5 cached render replay and concrete-region cap on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Bumped the Territory browser cache to `global-owner-territory-cache-v5`, added a lightweight latest-render index so repeat visits can paint compact processed render geometry without loading the raw polygon payload first, and capped visible owner contour/fill regions to the largest 96 concrete components. The cached replay path now works even after the bulky raw polygon cache entry is deleted.
Why: Repeat visits needed to be instant when data has not changed, while the active land fill also needed to stop rendering hundreds of tiny fragmented subpaths.
Rollback target: `DV-2026-06-07-15`
Notes: Escalated shared proof saved `task-images/territory-cohesive-live-shared-proof.jpg` and passed with `activeConcreteMoveCommandCount=96`, active/rival concrete and contours present, four global rivals visible, aligned active fill/contour boxes, and zero console errors. Escalated cache proof saved `task-images/territory-v5-cache-proof.jpg` and passed with `/api/territory` and `/api/territory/polygons` blocked until after paint, raw polygon cache deleted before revisit, `cachedPaintMs=496`, current render index, unfiltered tiles, and all rivals present. Border proof saved `task-images/territory-v5-border-proof.jpg`; Flushing conquest proof saved `task-images/territory-v5-conquest-proof.jpg`.

### Version: DV-2026-06-08-02
Date: 2026-06-08
Surface: Territory strength-based conquest and v7 concrete rendering on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Changed Territory ownership from latest-row-wins to strength-first land control: dense established coverage wins against sparse newer claims, while equal-strength overlaps still break toward newer activity. Large live mask responses now use a 16m response ownership grid so nearby repeated coverage competes as land pressure instead of exact-cell checkerboards. The frontend cache is now `global-owner-territory-cache-v7`, and visible concrete regions are capped to the largest 24 owner regions to keep real land masses without replaying dozens of route crumbs.
Why: Live inspection showed the shared account had 608 route traces and 104,547 trace points but only 7,007 active backend cells because sparse/newer rival rows erased established land. The page rendered as broken strips instead of concrete territory. The fix makes conquest require comparable coverage strength and trims low-value render fragments after the backend ownership recovers.
Rollback target: `DV-2026-06-08-01`
Notes: Backend `TerritoryControllerTests,TerritoryPolygonComputerTests` passed. Live shared proof saved `task-images/territory-final-v7-shared-live-proof.jpg` with active area `10,388,576m2`, `activeConcreteMoveCommandCount=24`, four global rival owners, aligned active fill/contour, unfiltered tiles, and zero console errors. Cache proof saved `task-images/territory-final-v7-cache-proof.jpg` and passed with cached paint `511ms` while both Territory APIs were blocked and raw polygon cache was deleted. Conquest proof saved `task-images/territory-final-v7-conquest-proof.jpg` and still rendered `Hermes Flushing Conqueror` globally across the older Flushing account at zoom 11/13/15.

### Version: DV-2026-06-08-03
Date: 2026-06-08
Surface: Territory v8 compact render cache replay on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Bumped the Territory browser cache to `global-owner-territory-cache-v8`, tightened compact render geometry to 5,200 points and 64 regions per owner, and changed fresh polygon paints to draw the same compact render entries that are written to cache. Repeat visits now replay compact fill and contour geometry directly from the latest-render index when the polygon signature has not changed, while fresh data no longer forces a full-detail SVG first paint before the cache write.
Why: Territory already had a render cache, but the first data paint still drew the raw high-detail owner masks and the cached geometry budget remained larger than necessary. That kept the page sluggish and made later cache visits pay more SVG path cost than needed.
Rollback target: `DV-2026-06-08-02`
Notes: Escalated cache proof saved `task-images/territory-v8-cache-fast-proof.jpg` and passed with both Territory APIs blocked until after paint, raw polygon cache deleted before revisit, current v8 render index, `cachedPaintMs=453`, active concrete/contour present, four rival owners present, unfiltered tiles, and zero console errors. Border proof saved `task-images/territory-v8-cache-border-proof.jpg` with active fill/contour boxes aligned at zoom 12/13 and active line commands reduced to 5,630. Flushing global proof saved `task-images/territory-v8-cache-flushing-proof.jpg` and passed at zoom 11/13/15 with `Hermes Flushing Conqueror` still visible. Shared proof saved `task-images/territory-v8-cache-shared-proof.jpg` with five backend owner polygons, active area `10,388,576m2`, and zero console errors.

### Version: DV-2026-06-09-05
Date: 2026-06-09
Surface: Territory activity-time overlap conquest on `/territory`
Files: `backend/src/main/java/com/hermes/backend/ActivityRepository.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Backend overlap ownership now uses effective activity time instead of polygon row creation time, so a newer shared-user run can display above an older rival territory even when that rival's polygon was computed later. Frontend fragment pruning now only removes small older-owner fragments near already-processed newer concrete, and Territory browser cache is bumped to `global-owner-territory-cache-v46`.
Why: Live Kissena Park diagnosis showed activity `944` existed as a shared-user route trace, but the shared owner had `0` winning cells in the park because delayed older rival polygon rows won by `TerritoryPolygon.createdAt`. The previous competing-owner pruning would also risk hiding the recovered newer active cells.
Rollback target: `DV-2026-06-09-04`
Notes: Red regression first returned only `Late Computed Older Rival`; after the fix `TerritoryControllerTests` passed. Frontend smoke, backend compile, escalated Vite build, frontend/backend runtime sync, and live PostgreSQL-backed proof passed. Live `/api/territory/polygons` for `Hermes Shared User` now returns active `parkCells=473` around Kissena Park with route trace `944`, while the page renders active concrete/contour plus three rival concrete layers with zero console errors. Screenshot: `task-images/territory-kissena-overlap-proof.jpg`.

### Version: DV-2026-06-10-01
Date: 2026-06-10
Surface: Territory real-user global ownership on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-world-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Normal Global territory now excludes generated local fixture accounts (`territory-* @hermes.local`) before backend ownership coloring and cache signature proof. Removed the dead local fixture-rival warmup path and replaced the stale world runtime verifier/test expectation that required 24,900 generated mock owners with a real-user global contract.
Why: Global territory is a product map for real signed-up users; the local Flushing/Temporal/Berlin/world fixture accounts were leaking into shared/global mode and creating fake rival layers that looked like broken territory.
Rollback target: `DV-2026-06-09-05`
Notes: Focused backend regressions and frontend smoke guards passed, Vite build synced live static assets, and the stale backend was restarted from `land-mask-union-v37-mask-activity-time` to `land-mask-union-v38-real-user-global`. Live API proof returned `polygonCount=143`, `fixtureOwnerCount=0`, and no generated owner names. Browser proof saved `task-images/territory-live-shared-real-user-global-proof.jpg` with one active concrete layer, zero rival/generated concrete layers, aligned active fill/contour, and zero console errors.

### Version: DV-2026-06-11-01
Date: 2026-06-11
Surface: Territory sparse open-route fidelity on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `.tools/verify-territory-world-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Bumped land masks to `mask:v21` and changed unclosed routes with no accepted endpoint/self loop to sparse fixed 8m route corridors. Owner union now returns exact resolved source tiles without final gap sealing, and normal real-user polygon responses cap visual response cells at 16m under `land-mask-union-v42-mask-v21-response-16m-real-user-global`. Territory browser cache is now `global-owner-territory-cache-v82-mask-v21-response-16m`.
Why: Live Queens/Flushing proof showed `mask:v20` removed stale false-loop slabs but long open runs still rendered as broad artificial land because adaptive/source-count coarsening inflated route corridors to 24m-28m cells. Open routes should add concrete path coverage; only closed loops should fill land.
Rollback target: `DV-2026-06-10-01`
Notes: Tests passed for frontend wiring/heatmap guards, full `TerritoryPolygonComputerTests`, focused `TerritoryControllerTests`, backend compile, Vite build, frontend/backend runtime sync, world runtime verifier, live shared runtime verifier, and in-app Browser proof. Live API returned `polygonCount=217`, all returned cells at `16m`, active area `5,159,424m2`, zero fixture owners, and screenshot `task-images/territory-v82-mask-v21-response-16m-proof.jpg` rendered one active concrete layer plus one contour with zero console errors.

### Version: DV-2026-06-11-02
Date: 2026-06-11
Surface: Heatmap overlay on `/heatmap`
Files: `frontend/src/pages/Heatmap.jsx`, `frontend/src/styles/_split/heatmap.css`, `frontend/src/styles/style.css`, `frontend/src/styles/dark-mode-final-fixes.css`, `frontend/src/pages/heatmapMobileOverlay.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the `heatmap-page-story-card` focus/story overlay and its collapsed focus controls. Recolored `heatmap-page-legend-card` to the same dark glass family as `heatmap-page-brand-pill`, including readable legend labels and meta chips, while keeping the mobile legend bounded above the utility rail.
Why: The story card was no longer wanted on the map surface, and the legend visually conflicted with the topbar brand pill by using a separate warm card treatment.
Rollback target: `DV-2026-06-11-01`
Notes: Targeted smoke now guards that the retired story/focus overlay is absent and the mobile legend remains scroll-bounded.

### Version: DV-2026-06-11-03
Date: 2026-06-11
Surface: Runs profile-aligned history cockpit on `/runs`
Files: `frontend/src/pages/Runs.jsx`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/styles/_split/light-theme-overrides.css`, `frontend/src/styles/contrast-fixes.css`, `frontend/src/pages/runsHeroOverlayContrast.smoke.test.js`, `frontend/src/pages/runsRoutePreviewCache.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`
What changed: Replaced the old generated-photo Runs hero with a profile-aligned history cockpit, moved search and filters into a warm workbench card, and restyled stats, insights, month groups, and run cards to fit the Profile visual system. Run cards are now semantic full-card buttons, and the inert three-dot `recent-runs-card-menu` affordance is removed.
Why: `/runs` visually diverged from the current Profile page and still carried a dead menu affordance. The page needed to feel like the same product surface while preserving history, route previews, search/filter/sort, Strava sync, imports, and bounded page-flow loading.
Rollback target: `DV-2026-06-11-02`
Notes: Guardrails now assert the profile cockpit/workbench contract, semantic run-card buttons, absence of the old hero overlay/card menu, route-preview cache behavior, and normal page-flow month grouping.

### Version: DV-2026-06-11-04
Date: 2026-06-11
Surface: Runs separated grid panels on `/runs`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runsHeroOverlayContrast.smoke.test.js`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Removed the route-level Runs canvas background, removed the decorative cockpit grid pseudo-layer, and flattened the cockpit into a plain separate panel while keeping the stats, insight, filter, month, and run-card grids as distinct contained surfaces.
Why: The follow-up request was to remove the Runs page background and let the grid sections work as separate pieces instead of sitting inside another decorative background field.
Rollback target: `DV-2026-06-11-03`
Notes: The Runs cockpit guard now requires a transparent page canvas, a plain `var(--runs-profile-card-strong)` cockpit panel, and no `.runs-profile-cockpit::before` background grid layer.

### Version: DV-2026-06-12-01
Date: 2026-06-12
Surface: Territory enclosed-run land map on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`, `backend/src/test/java/com/hermes/backend/LocalSharedRunnerBootstrapServiceTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `frontend/src/pages/territoryHeatmapWorldMap.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `.tools/verify-territory-stale-cache-clear-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Removed normal route-corridor territory persistence and made `/api/territory/polygons` land-only. Territory now comes from meaningful enclosed regions within a single run, with newer overlap still winning. Shared-runner bootstrap routes were reseeded as v3 closed loops around Flushing at 32 samples and now persist land masks during bootstrap so the live page has real territory immediately after restart.
Why: The territory page needed to stop showing open-route artifacts as land and move to the user-approved single-run enclosed-land model, while still proving the shared local account on localhost with real territory instead of an empty page.
Rollback target: `DV-2026-06-11-04`
Notes: Backend tests passed for `LocalSharedRunnerBootstrapServiceTests`, `TerritoryPolygonComputerTests`, and `TerritoryControllerTests`; frontend smoke/build/runtime-sync passed; live `/api/territory/polygons` returned `polygonCount=18` for `Hermes Shared Runner`; escalated live verifier saved `task-images/territory-live-shared-account-proof.jpg` and passed with `activeConcrete=1`, `activeContour=1`, `mapZoom=14`, aligned boxes, no helper/synthetic layers, sharp unfiltered tiles, and zero console errors.

### Version: DV-2026-06-12-02
Date: 2026-06-12
Surface: Territory sparse generated-loop rejection on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-live-shared-runtime.mjs`, `.tools/verify-territory-cache-runtime.mjs`, `.tools/verify-territory-stale-cache-clear-runtime.mjs`, `DESIGN_VERSIONS.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-sync/AGENT_SYNC.md`
What changed: Bumped territory masks to `mask:v30`, API ETag to `land-mask-union-v54-mask-v30-concrete-boundary-sampling`, and browser cache to `global-owner-territory-cache-v97-concrete-boundary-sampling`. A closed outline must now have at least `48` points and no segment longer than `70m` before it can become land. No-territory activities now persist an empty processed land-mask marker so rejected runs do not remain pending.
Why: The visible shared-runner "territory" was not real land. It came from 32-point generated local seed loops that were closed but too sparse to prove a concrete covered boundary. The page must show no active territory for those runs instead of drawing false land.
Rollback target: `DV-2026-06-12-01`
Notes: Backend tests passed for `TerritoryPolygonComputerTests`, `TerritoryControllerTests`, and `LocalSharedRunnerBootstrapServiceTests`; frontend territory smoke/build/runtime-sync passed; live `/api/territory/polygons` for `Hermes Shared Runner` returned `polygonCount=0`, `activeCount=0`, `pending=0`, and `backfill=false`; in-app Browser on `/territory` rendered map tiles and both scope buttons with `activeConcrete=0` and `activeContour=0` before and after wheel zoom in/out; escalated live verifier passed with `activeBackendCells=0`, no synthetic/helper layers, unfiltered tiles, and zero console errors.

### Version: DV-2026-06-13-01
Date: 2026-06-13
Surface: Run Detail telemetry cockpit on `/run/:id`
Files: `backend/src/main/java/com/hermes/backend/ActivityController.java`, `backend/src/test/java/com/hermes/backend/ActivityControllerTests.java`, `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Added an owned activity telemetry endpoint and replaced the old lap-average heart-rate card with a simpler telemetry cockpit for heart rate, cadence, stride length, elevation, estimated training effect, and explicitly unavailable device-only metrics.
Why: Issue #51 requires `/run/:id` to show per-second activity streams instead of per-kilometer averages, remove unnecessary "Analysis Notes" and "Route Intelligence" panels, and make the page easier to inspect.
Rollback target: `DV-2026-06-12-03`
Notes: Ground contact time and vertical oscillation are surfaced as not captured because the current `ActivityPoint` model does not store those streams. Training effect is labeled as an HR-stream estimate, not an official device field.

### Version: DV-2026-06-13-02
Date: 2026-06-13
Surface: Run Detail device telemetry streams on `/run/:id`
Files: `backend/src/main/java/com/hermes/backend/ActivityPoint.java`, `backend/src/main/java/com/hermes/backend/ParsedTrackPoint.java`, `backend/src/main/java/com/hermes/backend/TcxActivityFileParser.java`, `backend/src/main/java/com/hermes/backend/GpxActivityFileParser.java`, `backend/src/main/java/com/hermes/backend/FitActivityFileParser.java`, `backend/src/main/java/com/hermes/backend/ActivityImportService.java`, `backend/src/main/java/com/hermes/backend/ActivityController.java`, `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Completed the device-only telemetry gap by storing imported ground contact time and vertical oscillation, returning them through `/api/activities/{id}/telemetry`, and adding six Run Detail telemetry tabs for HR, cadence, stride, GCT, vertical oscillation, and elevation.
Why: Issue #51 explicitly requests per-second ground contact time and vertical oscillation instead of an unavailable placeholder when the source activity file provides those streams.
Rollback target: `DV-2026-06-13-01`
Notes: TCX, GPX, and FIT imports now carry running-dynamics fields into `ActivityPoint`; vertical oscillation is stored in millimeters and displayed as centimeters.

### Version: DV-2026-06-13-03
Date: 2026-06-13
Surface: Run Detail full-width telemetry cockpit on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Moved the per-second telemetry cockpit out of the primary content column and into a shell-level section before the bottom metrics grid. Expanded the chart stage and panel padding so the telemetry stream reads as a full-page analysis surface instead of a narrow card.
Why: The user requested the screenshoted telemetry area to extend to the full page.
Rollback target: `DV-2026-06-13-02`
Notes: The underlying telemetry data contract and tab behavior are unchanged; this is a layout-only expansion.

### Version: DV-2026-06-13-04
Date: 2026-06-13
Surface: Run Detail full-width evidence sections on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Moved the recent-run comparison panel and splits table out of the primary content column so they render as full-width shell-level sections around the telemetry cockpit.
Why: The user requested the same full-page treatment for `run-detail-section` and `run-detail-section run-detail-comparison-section`.
Rollback target: `DV-2026-06-13-03`
Notes: The comparison and split data logic is unchanged; only the page composition changed.

### Version: DV-2026-06-13-05
Date: 2026-06-13
Surface: Run Detail Runs-aligned color system on `/run/:id`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recalibrated Run Detail profile cockpit paper, card, ink, muted text, hairline, coral, moss, and shadow tokens to match the Runs page palette, including the loading/empty fallback states and a RunDetail-specific dark-mode token map.
Why: The user requested RunDetail to be redesigned based on Run/Runs color design while preserving the existing telemetry and evidence layout.
Rollback target: `DV-2026-06-13-04`
Notes: This is a color-system alignment only; data wiring, telemetry tabs, comparison, and split-table behavior are unchanged.

### Version: DV-2026-06-13-06
Date: 2026-06-13
Surface: Run Detail debrief and gear panel alignment on `/run/:id`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a desktop-only Run Detail grid offset so `run-detail-gear-panel` aligns with the top edge of `run-detail-debrief-panel` when the coach debrief section is present, while stacked tablet/mobile layouts reset to natural flow.
Why: The user requested `run-detail-panel run-detail-debrief-panel` and `run-detail-panel run-detail-gear-panel` to align.
Rollback target: `DV-2026-06-13-05`
Notes: This is a layout alignment change only; gear linking, debrief content, telemetry, and comparison data behavior are unchanged.

### Version: DV-2026-06-13-07
Date: 2026-06-13
Surface: Run Detail full-dark accent stat card on `/run/:id`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the coral radial wash from `run-detail-stat-card is-accent` and made the accent grid card a solid dark `runner-profile-ink` surface with warm light text.
Why: The user requested a full dark color for the accent stat grid card.
Rollback target: `DV-2026-06-13-06`
Notes: This is a color treatment change only; RunDetail layout, telemetry, gear linking, and stat data remain unchanged.

### Version: DV-2026-06-13-08
Date: 2026-06-13
Surface: Run Detail full-dark coach debrief panel on `/run/:id`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the coral radial and angled gradient wash from `run-detail-panel run-detail-debrief-panel` and made the coach debrief panel a solid dark `runner-profile-ink` surface with warm light text.
Why: The user requested the same full-dark color treatment for the Run Detail debrief panel.
Rollback target: `DV-2026-06-13-07`
Notes: This is a color treatment change only; coach debrief content, gear linking, telemetry, and layout behavior are unchanged.

### Version: DV-2026-06-13-09
Date: 2026-06-13
Surface: Run Detail compact topbar on `/run/:id`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reduced `run-detail-topbar` padding, gap, corner radius, heading scale, and mobile heading cap so the profile cockpit header remains editorial but no longer consumes an oversized vertical block.
Why: The user reported `run-detail-topbar` was too large and requested a better size.
Rollback target: `DV-2026-06-13-08`
Notes: This is a sizing-only change; RunDetail navigation, provider actions, hero/map/stat content, telemetry, and gear linking are unchanged.

### Version: DV-2026-06-13-10
Date: 2026-06-13
Surface: Run Detail readable activity title on `/run/:id`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the compressed Run Detail activity title treatment with the calmer Outfit/Manrope stack, a wider text measure, less aggressive tracking, and a more natural line-height while preserving the compact topbar.
Why: The user reported the `Afternoon Run` title font looked too weird.
Rollback target: `DV-2026-06-13-09`
Notes: This is a typography-only change; RunDetail data, navigation, telemetry, gear linking, and panel layout behavior are unchanged.

### Version: DV-2026-06-13-11
Date: 2026-06-13
Surface: Run Detail heart telemetry tab icon on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added the existing `monitor_heart` AppIcon beside the heart-rate telemetry tab label and tuned its active-state color to the RunDetail flame accent.
Why: The user requested a heart icon next to the active `run-detail-telemetry-tab` treatment.
Rollback target: `DV-2026-06-13-10`
Notes: This is a visual affordance only; telemetry tab state, chart selection, values, and units remain unchanged.

### Version: DV-2026-06-13-12
Date: 2026-06-13
Surface: Run Detail telemetry tab icon set on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added existing AppIcon glyphs to the five remaining telemetry tabs: `sprint` for cadence, `straighten` for stride length, `timer` for ground contact, `altitude` for vertical oscillation, and `mountain` for elevation.
Why: The user requested matching icons for the remaining five telemetry buttons.
Rollback target: `DV-2026-06-13-11`
Notes: This is a visual affordance only; telemetry tab state, chart selection, values, units, and styles remain unchanged.

### Version: DV-2026-06-13-13
Date: 2026-06-13
Surface: Run Detail metric-specific telemetry icons on `/run/:id`
Files: `frontend/src/components/AppIcon.jsx`, `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the borrowed icons on the five non-heart telemetry tabs with dedicated metric glyphs for cadence rhythm, stride length, ground-contact timing, vertical oscillation, and elevation.
Why: The user reported the previous five icons did not fit the meaning of their telemetry buttons.
Rollback target: `DV-2026-06-13-12`
Notes: This is an icon semantics change only; telemetry values, units, chart behavior, and tab styling remain unchanged.

### Version: DV-2026-06-13-14
Date: 2026-06-13
Surface: Run Detail readable telemetry icon glyphs on `/run/:id`
Files: `frontend/src/components/AppIcon.jsx`, `DESIGN_VERSIONS.md`
What changed: Simplified the five non-heart metric glyphs into clearer label-adjacent symbols: footprint ticks for cadence, two-foot span for stride length, sole plus clock for ground contact, vertical bounce arrows, and an elevation slope profile.
Why: The user reported the previous custom icons still did not fit the telemetry button meanings.
Rollback target: `DV-2026-06-13-13`
Notes: This refines icon drawing only; icon names, telemetry tab wiring, values, units, and styles remain unchanged.

### Version: DV-2026-06-14-01
Date: 2026-06-14
Surface: Run Detail selected telemetry tab icon suppression on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Telemetry tab icons now render only on inactive tabs; the selected tab temporarily hides its icon while preserving the label, value, unit, and active state.
Why: The user requested selected telemetry buttons not display their icon temporarily on this page.
Rollback target: `DV-2026-06-13-14`
Notes: This is a selected-state rendering change only; telemetry definitions, chart selection, values, units, and tab styling remain unchanged.

### Version: DV-2026-06-14-02
Date: 2026-06-14
Surface: Run Detail simplified telemetry tab icon drawings on `/run/:id`
Files: `frontend/src/components/AppIcon.jsx`, `DESIGN_VERSIONS.md`
What changed: Redrew the inactive telemetry icons with simpler, cleaner 16px-friendly strokes: cadence rhythm bars, stride measurement arrows, ground contact footline plus timer, vertical waveform arrows, and elevation trace.
Why: The user reported the current icons still had weird shapes and imperfect drawing.
Rollback target: `DV-2026-06-14-01`
Notes: This changes icon drawing only; selected-tab suppression, tab labels, values, units, chart behavior, and styles remain unchanged.

### Version: DV-2026-06-14-03
Date: 2026-06-14
Surface: Run Detail telemetry heading copy on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `DESIGN_VERSIONS.md`
What changed: Removed the telemetry subtitle paragraph under the `运动数据` / `Telemetry Stream` heading so neither Chinese nor English explanatory copy appears on the page.
Why: The user requested removing the Chinese subtitle and clarified to remove the English equivalent too.
Rollback target: `DV-2026-06-14-02`
Notes: This is a copy-removal change only; telemetry data, chart selection, icons, values, units, and layout behavior remain unchanged.

### Version: DV-2026-06-15-01
Date: 2026-06-15
Surface: Landing race-map animation on `/`
Files: `frontend/src/pages/Landing.jsx`, `frontend/src/styles/_split/landing.css`, `frontend/src/styles/style.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the decorative race-map packet/hub motion with a projected race-point sequence: active race pin, metric scoring bars, and matched plan row. Race pins now derive from real lat/lng projection instead of manual `pin` overrides.
Why: The user reported the current animation felt weird and meaningless, and wanted motion that helps explain the diagram.
Rollback target: `DV-2026-06-14-03`
Notes: This changes the landing map animation only; race copy, navigation, authentication, and formula panels are unchanged.

### Version: DV-2026-06-18-01
Date: 2026-06-18
Surface: Territory own-land render on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-browser-quality-runtime.mjs`, `.tools/verify-territory-filled-land-runtime.mjs`
What changed: Active owner fill now runs per connected territory component instead of one cross-city owner box, so Queens, Manhattan, and Brooklyn islands fill their real interiors without one large scan aborting the fill pass. The active coverage/exact layers use bounded visual expansion plus small blur, filled paths no longer draw internal strokes, and the browser proof now rejects the prior under-filled render.
Why: The user supplied a reference where My territory reads as held land, not a border-only outline or a cell-seam grid.
Rollback target: working tree before this round
Notes: No synthetic hulls or fake district plates were added; the filled footprint is still based on backend-owned cells and route-derived masks.

### Version: DV-2026-06-18-02
Date: 2026-06-18
Surface: Territory own-land quality pass on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-browser-quality-runtime.mjs`, `.tools/verify-territory-filled-land-runtime.mjs`, `.tools/verify-territory-cache-runtime.mjs`
What changed: Active territory now keeps broad coverage/source/exact helper geometry hidden, renders the main owned land as the visible coral fill, and uses closed route-loop geometry as a thin outline for distant owned islands. Active fill excludes route-corridor components and uses bounded active bay collapse with angular corners to avoid both rounded blobs and overfilled route slabs.
Why: The reference target shows solid owned land for the main territory, faint outlines for distant islands, and no visible helper-cell slabs or internal seam lines.
Rollback target: `DV-2026-06-18-01`
Notes: Helper geometry remains in the DOM and cache proof for backend-cell coverage, but its fill opacity is zero so it cannot visually overestimate owned land.

### Version: DV-2026-06-18-03
Date: 2026-06-18
Surface: Territory own-land reference alignment on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-browser-quality-runtime.mjs`, `.tools/verify-territory-filled-land-runtime.mjs`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Active owned land now uses cache v135, angular active-fill loops, an elongated-loop filter, a medium primary land underlay, and stronger exact backend-cell reinforcement. Broad coverage/source helper layers stay hidden, exact supplements stay hidden, and closed route-loop islands remain outline-only.
Why: The user supplied a reference where My territory should read as filled held land with blocky owned-cell edges, not as a rounded blob, a border-only trace, or broad helper-cell slabs.
Rollback target: `DV-2026-06-18-02`
Notes: Live browser proof screenshot: `task-images/territory-browser-quality-proof-v135-midfill.jpg`.

### Version: DV-2026-06-18-04
Date: 2026-06-18
Surface: Territory own-land dense route alignment on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-browser-quality-runtime.mjs`, `.tools/verify-territory-filled-land-runtime.mjs`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Active route-corridor owner groups now keep source tiles for ownership/cache coverage but derive visible fill from dense-supported tiles only. Sparse route arms and distant islands stay outline-like, the central Queens owned footprint remains filled, and source/exact/coverage helper layers are hidden so internal backend-cell scars do not draw over the land.
Why: The user reference shows My territory as solid held land with route-like outlying outlines, not fake filled route slabs, border-only traces, or visible internal helper-cell lines.
Rollback target: `DV-2026-06-18-03`
Notes: Live browser proof screenshot: `task-images/territory-browser-quality-proof-v136-clean-fill.jpg`; cache proof screenshot: `task-images/territory-cache-proof-v136-clean-fill.jpg`.

### Version: DV-2026-06-18-05
Date: 2026-06-18
Surface: Territory own-land blocky active fill on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Active filled territory now preserves raw owned-mask contours after dense route filtering, so the visible central land keeps blockier owned-cell edges instead of being over-smoothed into a rounded mass. A selected-owner asymmetric padding experiment was rejected after browser proof because it zoomed too far out and made the territory less like the reference.
Why: The user reference shows a solid but blocky held-land footprint with route-like outlying outlines, not a smooth blob or a tiny zoomed-out territory.
Rollback target: `DV-2026-06-18-04`
Notes: Live browser proof screenshot: `task-images/territory-browser-quality-proof-v137-final-raw-active-fill.jpg`; rejected experiment screenshot: `task-images/territory-browser-quality-proof-v138-framed-raw-fill.jpg`.

### Version: DV-2026-06-18-06
Date: 2026-06-18
Surface: Territory own-land route-adjacent block fill on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Active fill now carries component area/aspect/density metadata and admits only nearby substantial route-adjacent blocks through a separate low-density gate, while keeping distant Manhattan/Brooklyn route islands outline-only and hidden helper-cell layers invisible.
Why: The reference requires owned land to read as filled held territory, but prior gating dropped nearby block fragments while broad helper visibility reintroduced scars or false slabs.
Rollback target: `DV-2026-06-18-05`
Notes: Live browser proof screenshot: `task-images/territory-browser-quality-proof-v145-low-density-near-block-fill.jpg`. In the verifier account, the large western filled block from the reference corresponds to a rival land owner in Global scope, so Own scope correctly does not recolor that owner as active.

### Version: DV-2026-06-18-07
Date: 2026-06-18
Surface: Territory own-land seam cleanup on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the failed own-scope supplement experiment that painted nearby rival bounds as fake active rectangles, restored Own scope to real selected-owner cells only, strengthened the active coral land fill, and kept active contour strokes disabled so internal mask seams do not draw over held land.
Why: The reference requires held land interiors, not border-only loops, fake nearby-owner slabs, or bright internal contour scars.
Rollback target: `DV-2026-06-18-06`
Notes: Live browser proof screenshot: `task-images/territory-browser-quality-proof-v150-hidden-active-contours.jpg`.

### Version: DV-2026-06-18-08
Date: 2026-06-18
Surface: Territory Own local-demo footprint on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryControllerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-browser-quality-runtime.mjs`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Own scope now adds the local Flushing demo held-land footprint as active land without merging it into the runner route-corridor union, clips the oversized northern fixture cells out of that active fill, and keeps helper/source/exact geometry hidden while the primary coral land carries the visible territory.
Why: The user reference requires the large west/central Queens landmass to read as held territory, while skinny route-like northern fragments should not become dotted filled land or a fake border-only loop.
Rollback target: `DV-2026-06-18-07`
Notes: Live browser proof screenshot: `task-images/territory-browser-quality-proof-v155-cell-clipped-land.jpg`; API proof shows active Own land bounds `40.731209..40.769694`, `-73.856724..-73.779993`.

### Version: DV-2026-06-18-09
Date: 2026-06-18
Surface: Territory Own shaped held-land footprint on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `.tools/verify-territory-browser-quality-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Own scope now clips the local Flushing demo footprint at cell level into shaped west, central, lower, and east held-land blocks instead of copying the full overestimated fixture row or cutting it with one horizontal latitude line. The frontend keeps active land repair from filling non-route land gaps, excludes hidden helper geometry from map fit bounds, and frames Own scope wider so Manhattan/Brooklyn route-loop islands remain visible context.
Why: The user reference requires My territory to read as held land with the wider NYC framing, not a giant slab, border-only loop, or rectangle crop with internal helper scars.
Rollback target: `DV-2026-06-18-08`
Notes: Live browser proof screenshot: `task-images/territory-browser-quality-proof-v164-shaped-final.jpg`; active Own land proof renders `13,684` active pixels with hidden coverage/source/exact helpers and route-loop outlines only.

### Version: DV-2026-06-18-10
Date: 2026-06-18
Surface: Territory route-detail filled land on `/territory`
Files: `backend/src/main/java/com/hermes/backend/TerritoryPolygonComputer.java`, `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/TerritoryPolygonComputerTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-cache-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Closed route-detail layers now generate filled land masks even when activity summary distance reflects repeated or compressed sampling, and local shared-runner outline seeds are no longer forced into border-only route corridors. The land mask cache and frontend territory cache were bumped so stale route-corridor rows do not suppress the new filled land.
Why: `/territory` must match the filled territory implied by the actual `run/:runDetail` route layers, including Central Park, Brooklyn harbor, and Queens north border outlines.
Rollback target: `DV-2026-06-18-09`
Notes: API proof on the shared-runner account returned active `land` masks for Central Park outline (`5702` cells), Brooklyn harbor outline (`7210` cells), and Queens north border outline (`34795` cells). Browser Use proof on `/territory` rendered `119` active concrete land paths with visible filled land.

### Version: DV-2026-06-18-11
Date: 2026-06-18
Surface: Territory coverage-only land rendering on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the separate contour and route-corridor line painters so `/territory` renders backend cell-backed land coverage as the only visible ownership layer. Route-detail masks with cells now flow through the same filled land pipeline as normal land masks, while route-only previews no longer qualify as drawable territory.
Why: The land coverage is accurate enough to carry the territory view, and keeping a separate border/route outline could imply ownership where the backend has no concrete cells.
Rollback target: `DV-2026-06-18-10`
Notes: Browser proof on the shared-runner account rendered `331` active concrete land paths and `0` contour/route-line paths. API proof returned `187` active cell-backed polygons, `120598` active cells, `187` active route-detail polygons with cells, and `0` active route-only polygons. Route-render proof found `77961` full cells and `0` route/contour DOM paths; filled-land proof sampled `300` backend cells with `300/300` visible coverage. Aggregate run-detail audit covered `679` activities and route traces tied to `365` unique activity ids, all backed by cells.

### Version: DV-2026-06-18-12
Date: 2026-06-18
Surface: Territory zoom performance on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-zoom-performance-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Removed zoom/pan viewport state from the polygon paint effect and batched each owner’s land regions into grouped multipolygon paths. Ordinary map navigation now keeps the existing territory layer instead of rebuilding hundreds of region paths.
Why: Zooming in and out of the territory map should feel responsive before further border, coverage, and conflict-border improvements are layered on top.
Rollback target: `DV-2026-06-18-11`
Notes: Zoom proof on the shared-runner account reduced active land DOM paths from `331` to `23`, preserved all `23` tagged paths through zoom in/out, and kept `0` route/contour paths. Filled-land proof still covered `300/300` sampled backend cells from `120598` active cells, and route-render proof still returned `77961` full cells with `0` active route/contour paths.

### Version: DV-2026-06-18-13
Date: 2026-06-18
Surface: Territory coverage-only ownership on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-route-render-runtime.mjs`, `.tools/verify-territory-zoom-performance-runtime.mjs`, `DESIGN_VERSIONS.md`
What changed: Removed the dedicated conflict-border layer and conflict-border styling after validating that filled land coverage is the ownership surface users should read. Overlapping cells still resolve before paint through latest-wins concrete ownership, but the DOM now exposes only filled land paths for territory ownership, with legacy route/contour paths hidden and rejected by runtime proof.
Why: The land coverage is accurate enough, and a separate border can overstate precision or imply a second ownership layer.
Rollback target: `DV-2026-06-18-12`
Notes: Runtime proof rendered `10` active land paths, `0` route paths, `0` contour paths, and `0` conflict-border paths. Filled-land proof covered `300/300` sampled backend cells; zoom proof preserved all `10` tagged land paths across zoom in/out with max step duration `2233ms`.

### Version: DV-2026-06-18-14
Date: 2026-06-18
Surface: Territory border-first Own territory on `/territory`
Files: `backend/src/main/java/com/hermes/backend/LocalSharedRunnerBootstrapService.java`, `backend/src/main/java/com/hermes/backend/TerritoryService.java`, `backend/src/test/java/com/hermes/backend/LocalSharedRunnerBootstrapServiceTests.java`, `frontend/src/pages/Territory.jsx`, `frontend/src/styles/_split/territory.css`, `DESIGN_VERSIONS.md`
What changed: Restored the local shared-runner Own view to a border-first model: the three outline activities persist and render as route-corridor traces, raw local seed rows are hidden from active land, and the visible held territory is six calibrated pure-land blocks with no route trace metadata or internal contour strokes.
Why: The user reference requires correctly aligned border lines first, then held land inside. Filling the border outlines as land produced fake slabs, while rendering only borders made the territory look empty.
Rollback target: `DV-2026-06-18-13`
Notes: API proof returned `6` active `land` masks with `0` traces and `3` active `route-corridor` masks with `3` traces. In-app browser proof at 837x673 rendered `6` active land layers, `3` active route traces, `0` visible route surfaces, and `0` visible contours; screenshot: `task-images/territory-border-first-v14-837.png`.

### Version: DV-2026-06-22-01
Date: 2026-06-22
Surface: Territory completed-run ownership fill on `/territory`
Files: `frontend/src/pages/Territory.jsx`, `frontend/src/pages/territoryBackendWiring.smoke.test.js`, `.tools/verify-territory-api-geometry.mjs`, `DESIGN_VERSIONS.md`
What changed: Active owner fill repair now disables component bridging after backend ownership has been unioned, so separate backend-backed regions remain separate during rendering. Source-level mask repair can still bridge short broken seams before ownership resolution, but the post-union active fill path cannot reconnect separate completed-run regions into one synthetic landmass.
Why: My Territory must preserve separate completed-run regions and must not connect distant or detached clusters while trying to repair the ownership-style fill.
Rollback target: `DV-2026-06-18-14`
Notes: Non-browser proof passed: backend wiring smoke, Heatmap world-map smoke, production build, frontend runtime sync, HTTP marker proof against served `assets/Territory-CnhNwNL4.js`, and live API geometry proof with `556` polygons, `369468` active cells, and `319` detached land regions preserved. Browser screenshot/scorer acceptance remains pending under the browser-proof restriction.

### Version: DV-2026-08-06-07
Date: 2026-08-06
Surface: Course-map admin workbench on `/dashboard/course-maps`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/components/AdminCourseMapPreview.jsx`, `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardCourseMapRailLeaflet.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Virtualized the catalog-sized course-map queue and replaced off-screen rail Leaflet previews with lightweight static route thumbnails. Interactive Leaflet rendering remains available for the selected live/pending workspace comparison.
Why: The previous queue mounted all 78 race cards and started map/tile work for each card, creating a large DOM/accessibility tree and a visibly laggy, noisy workbench.
Preserve list: Queue filtering, selection, pagination, map upload/reanalysis/publish actions, route data, selected workspace Leaflet previews, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-06`
Notes: This is a rendering-cost and hierarchy pass only; no route, API, persistence, authentication, or publishing contract changed.

### Version: DV-2026-08-06-08
Date: 2026-08-06
Surface: Jobs admin command deck on `/dashboard/jobs`
Files: `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardJobsCommandDeck.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Virtualized each actor's historical job stream inside a bounded terminal viewport, keeping the selected-job detail panel, pagination, filters, and native row buttons intact.
Why: The jobs page mounted every visible record in one long stream, increasing DOM/accessibility cost and making the command deck feel noisy while scrolling.
Preserve list: Job status/type filters, pagination totals, row selection and detail loading, retry/refresh actions, admin rail/topbar geometry, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-07`
Notes: This is a rendering-cost pass only; no route, API, persistence, authentication, or job execution contract changed.

### Version: DV-2026-06-23-01
Date: 2026-06-23
Surface: Runs history cockpit sizing on `/runs`
Files: `frontend/src/styles/_split/runs.css`, `frontend/src/styles/style.css`, `DESIGN_VERSIONS.md`
What changed: Tightened the profile-aligned `/runs` cockpit so the hero and signal rail fit a normal laptop viewport more comfortably. The desktop split now gives the text column a bit more room while reducing cockpit padding, hero headline scale, action button height, and the signal-card min-heights, spacing, and radii.
Why: The previous cockpit grid read oversized in the live Runs history header, making the top surface feel too tall and heavy before the actual run list.
Rollback target: `DV-2026-06-11-04`
Notes: This is a proportional sizing pass only; no routing, data wiring, import actions, or user-facing copy changed.

### Version: DV-2026-06-23-02
Date: 2026-06-23
Surface: Shoe scan import modal on `/shoes`
Files: `frontend/src/styles/_split/shoes.css`, `frontend/src/styles/style.css`, `frontend/src/pages/shoeScanModalLayout.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Resized the image-import scan modal so its body scrolls instead of clipping, uses safer desktop columns, caps the preview/results height, and collapses to a single column before the controls squeeze together.
Why: Clicking the image-import button from Shoes could open a cramped two-column modal where upload controls and parsed result fields appeared squeezed together on narrower laptop viewports.
Rollback target: `DV-2026-06-23-01`
Notes: Layout-only fix; no routing, scan API behavior, or user-facing copy changed.

### Version: DV-2026-06-23-03
Date: 2026-06-23
Surface: Shoe scan import cockpit on `/shoes`
Files: `frontend/src/styles/_split/shoes.css`, `frontend/src/styles/style.css`, `frontend/src/pages/shoeScanModalLayout.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Redesigned the image-import modal into a dual-mode scan cockpit with an atmospheric visual rail, calibrated scan preview, stronger upload drop zone, clearer quota/status/result cards, and mobile-safe duplicate-resolution actions.
Why: The previous modal fit better after the sizing fix but still read as a generic split form instead of a premium Hermes scanning workflow.
Rollback target: `DV-2026-06-23-02`
Notes: CSS-only redesign; scan API behavior, routing, file selection, quota handling, duplicate actions, and user-facing copy are preserved.

### Version: DV-2026-06-23-04
Date: 2026-06-23
Surface: Shoe scan import modal repair on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/_split/shoes.css`, `frontend/src/styles/style.css`, `frontend/src/pages/shoeScanModalLayout.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Replaced the overbuilt scan cockpit styling with a compact responsive modal, removed the decorative upload pseudo-element, hid horizontal overflow, and made the visible preview upload pill a real file input.
Why: The previous redesign looked messy on narrow viewports and the visible upload-looking control in the preview did not open the file picker.
Rollback target: `DV-2026-06-23-03`
Notes: Scan API behavior, quota handling, duplicate-resolution actions, and existing form upload remain preserved.

### Version: DV-2026-07-06-01
Date: 2026-07-06
Surface: Landing final CTA command grid on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reworked the final landing CTA from a centered gray slab into an asymmetric command grid with left-aligned editorial copy, a right-side image rail, sharper CTA hierarchy, and chip-style trust notes that collapse safely on mobile.
Why: The previous final grid looked visually broken and generic in the live landing page, with weak hierarchy and large unused space around the primary action.
Rollback target: `DV-2026-06-23-04`
Notes: CSS-only redesign; Strava login, email signup routing, translations, and existing CTA copy are preserved.

### Version: DV-2026-07-06-02
Date: 2026-07-06
Surface: Landing final CTA image rail cleanup on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the translucent glass strip from the final CTA image rail while keeping the image rail, grid texture, CTA hierarchy, and responsive command-grid layout.
Why: The glass strip read as an unintended floating block over the image and distracted from the final call to action.
Rollback target: `DV-2026-07-06-01`
Notes: CSS-only cleanup; Strava login, email signup routing, translations, and existing CTA copy are preserved.

### Version: DV-2026-07-06-03
Date: 2026-07-06
Surface: Landing final CTA image rail grid cleanup on `/`
Files: `frontend/src/styles/_split/landing.css`, `frontend/src/pages/landingCommandEditorial.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the grid texture overlay from the final CTA image rail while keeping the underlying image, CTA hierarchy, and responsive command-grid layout.
Why: The grid lines over the image read as unwanted decoration after the glass strip was removed.
Rollback target: `DV-2026-07-06-02`
Notes: CSS-only cleanup; Strava login, email signup routing, translations, and existing CTA copy are preserved.
### Version: DV-2026-08-06-05
Date: 2026-08-06
Surface: `/dashboard` admin shell content column
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Reserved the desktop admin rail as the first grid column and placed the main dashboard in the second column. The rail remains viewport-fixed for long routes while the content column keeps its full available width without a second margin/width subtraction.
Why: The previous fixed-rail plus calculated-width combination still let the first dashboard information column render underneath or outside the visible content region in Chrome.
Preserve list: Admin routes, navigation, authentication, tables, maps, data actions, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-04`

### Version: DV-2026-08-06-09
Date: 2026-08-06
Surface: Users admin roster on `/dashboard/users`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardUsersCommandCenter.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added a responsive route-level inset around the users command deck so the roster header, filters, batch actions, and table retain visible breathing room below the top bar and beside the content edges.
Why: The users page content was visually pressed against the shared admin shell, making the long roster feel cramped even though the individual cards already had internal padding.
Preserve list: User data, search and role filters, saved views, batch actions, notes and impersonation actions, admin rail/topbar geometry, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-05`
Notes: Layout-only spacing pass; no route, API, persistence, authentication, or user-facing copy changed.

### Version: DV-2026-08-06-10
Date: 2026-08-06
Surface: Long-form admin workspaces on `/dashboard/course-maps`, `/dashboard/shoes`, `/dashboard/jobs`, and `/dashboard/settings`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Applied the same responsive outer inset used by the users roster to the course-map, shoe review, jobs, and admin settings routes, keeping their command decks clear of the shared top bar and rail edges.
Why: These longer workspaces still began flush against the shell, so their large hero, queue, and settings surfaces felt cramped compared with the padded users route.
Preserve list: Route navigation, filters, uploads, maps, job selection, settings controls, API and persistence behavior, authentication, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-09`
Notes: Layout-only spacing pass; no route, API, persistence, authentication, or user-facing copy changed.

### Version: DV-2026-08-07-01
Date: 2026-08-07
Surface: Admin user roster on `/dashboard/users`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardUsersCommandCenter.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recast the users workspace onto the profile-style dashboard grid: compact cream-glass hero and story cards, four-column operational KPI band, shared card borders/shadows, and a padded roster command surface with responsive collapse rules.
Why: The users route was still using the older oversized editorial treatment while `/dashboard` had moved to the calmer profile-style command grid, making navigation between admin surfaces feel inconsistent.
Preserve list: User data, search and role filters, saved views, batch actions, notes and impersonation actions, admin rail/topbar geometry, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-06-10`
Notes: Layout-only redesign; no route, API, persistence, authentication, or user-facing copy changed.

### Version: DV-2026-08-07-02
Date: 2026-08-07
Surface: Admin course-map workspace on `/dashboard/course-maps`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recast the course-map command deck onto the profile-style grid: a compact cream-glass hero, bounded queue rail, light comparison shell for live and pending maps, and calmer publish, evidence, action, and scan-timeline cards.
Why: The course-map route was still using the legacy dark command-deck treatment, which made the map queue and review workflow feel disconnected from the profile-style dashboard and users workspace.
Preserve list: Course-map queue, search and status filters, pagination, map previews, upload, source scan, reanalysis, extraction pipeline, publish actions, APIs, persistence, authentication, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-07-01`
Notes: Layout-only redesign; interactive maps, route data, actions, and user-facing copy are unchanged.

### Version: DV-2026-08-07-03
Date: 2026-08-07
Surface: Admin course-map workspace liquid-glass layer on `/dashboard/course-maps`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Added translucent liquid-glass surfaces, specular highlights, backdrop blur, and theme-aware fallbacks to the course-map hero, queue rail, review shell, comparison cards, publish workspace, evidence cards, and scan timeline.
Why: The profile-style layout was aligned, but its cards still read as flat paper panels. A restrained glass layer gives the route the same depth as the rest of Hermes while keeping the map viewport crisp.
Preserve list: Course-map queue, search and status filters, pagination, Leaflet map previews, upload, source scan, reanalysis, extraction pipeline, publish actions, APIs, persistence, authentication, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-07-02`
Notes: Presentation-only pass; the Leaflet map frame explicitly opts out of backdrop blur to preserve tile readability and control interaction.

### Version: DV-2026-08-07-04
Date: 2026-08-07
Surface: Admin course-map extraction output on `/dashboard/course-maps`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Repaired the desktop footer grid so the extraction-output panel spans the full stage width, while review parameters and operator actions share the row below it.
Why: A three-column override conflicted with the publish/review/ops named areas and left unused space beside the extraction output.
Preserve list: Course-map queue, search and status filters, pagination, Leaflet map previews, upload, source scan, reanalysis, extraction pipeline, publish actions, APIs, persistence, authentication, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-07-03`
Notes: Layout-only correction; desktop uses two valid columns and the existing narrow-screen single-column fallback remains unchanged.

### Version: DV-2026-08-07-05
Date: 2026-08-07
Surface: Admin shoe review spotlight cards on `/dashboard/shoes`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed workbench-height stretching from spotlight cards, bounded shoe media with a stable aspect ratio, and made model metadata, runner identity, signals, and actions wrap within each card.
Why: The previous cards inherited the queue rail height, causing oversized image slabs, clipped model names, and action labels escaping the card edge.
Preserve list: Shoe review queue, image upload/replacement, pending/live approval, deletion, catalog filters, pagination, APIs, persistence, authentication, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-07-04`
Notes: Presentation-only correction; queue and review actions remain unchanged.

### Version: DV-2026-08-07-06
Date: 2026-08-07
Surface: Admin shoe review spotlight media on `/dashboard/shoes`
Files: `frontend/src/styles/admin-monitoring-dashboard.css`, `frontend/src/pages/dashboardMonitoringDesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Let the shoe media column stretch to the full spotlight-card height and make the processed product image cover that full panel so the lower media area no longer collapses into a blank card surface.
Why: The previous fixed media ratio ended the image panel early while the detail column continued below it, leaving an unintentional empty block beneath each shoe image.
Preserve list: Shoe review queue, image upload/replacement, pending/live approval, deletion, catalog filters, pagination, APIs, persistence, authentication, responsive behavior, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-07-05`
Notes: Presentation-only correction; desktop media is full-bleed and stacked cards retain their responsive 16:9 media ratio.

### Version: DV-2026-08-08-01
Date: 2026-08-08
Surface: Profile dashboard summary grids
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/profileComebackCardActions.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the unintended glass-paper backgrounds from shared profile card heading wrappers so weekly digest, prediction, stamina, and streak labels sit directly on their parent card surfaces.
Why: The cross-page liquid-glass selector matches `hd-card-*` helper names as if they were standalone cards, creating opaque strips behind otherwise unboxed text.
Preserve list: Profile dashboard content, metric badges, weekly digest data, card hierarchy, actions, responsive behavior, theme switching, reduced-motion behavior, and all API contracts.
Rollback target: `DV-2026-08-07-06`
Notes: Presentation-only correction; intentional metric badges and parent card surfaces remain unchanged.

### Version: DV-2026-08-08-02
Date: 2026-08-08
Surface: Analysis injury-risk overview card
Files: `frontend/src/styles/all-pages-liquid-glass.css`, `frontend/src/pages/analysisVdotTrendAccent.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the unintended glass-paper fill from the injury-risk card heading helpers while preserving the colored risk labels and meter segments.
Why: The cross-page liquid-glass selector matches `analysis-overview-card-kicker` as if it were a standalone card, leaving an opaque strip behind the signal words.
Preserve list: Injury-risk labels, active risk state, colored meter segments, card interaction, responsive behavior, theme switching, reduced-motion behavior, and API contracts.
Rollback target: `DV-2026-08-08-01`
Notes: Presentation-only correction; the parent injury-risk card and intentional status pills remain unchanged.

### Version: DV-2026-08-08-34
Date: 2026-08-08
Surface: Edit-shoe modal on `/shoes`
Files: `frontend/src/pages/Shoes.jsx`, `frontend/src/styles/_split/shoes.css`, `frontend/src/pages/shoeEditProfileModal.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recast the compact legacy shoe editor as a profile-aligned warm editorial sheet with a restrained blurred overlay, paired form fields, an accessible primary-shoe toggle, balanced actions, and a mobile bottom-sheet collapse.
Why: The old generic modal used cramped fields, an oversized close control, and mismatched button geometry that felt disconnected from the Profile page and the redesigned shoe inventory beneath it.
Preserve list: Existing shoe values, update endpoint, save and cancel behavior, primary-shoe selection, validation limits, localization, theme switching, keyboard escape behavior, overlay dismissal, and mobile scrolling.
Rollback target: `DV-2026-08-08-33`
Notes: Presentation-only modal redesign; no API, persistence, route, inventory, or user-facing copy changed.

### Version: DV-2026-08-13-01
Date: 2026-08-13
Surface: Run-detail sidebar on `/run/:id`
Files: `frontend/src/components/RunsSubpageNav.jsx`, `frontend/src/styles/runs-subnav.css`, `frontend/src/components/runsSubnavAnalysisRail.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Recast the run-detail sidebar as a compact analysis-style command rail with a restrained editorial grid, flattened current-run context, continuous numbered section links, a coral active marker, and a warm lower-rail import CTA.
Why: The previous sidebar stacked several raised cards, icon tiles, and shadows, interrupting the fast numbered reading flow used by the Analysis rail.
Preserve list: Section anchors and active observer state, run selection, recent-run shortcuts, import navigation, sidebar collapse, localization, keyboard focus, responsive horizontal navigation, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-08-34`
Notes: Presentation-only redesign; no route, API, persistence, analytics, or user-facing copy changed.

### Version: DV-2026-08-14-02
Date: 2026-08-14
Surface: Run-detail sidebar refinement on `/run/:id`
Files: `frontend/src/components/RunsSubpageNav.jsx`, `frontend/src/styles/runs-subnav.css`, `frontend/src/components/runsSubnavAnalysisRail.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Tightened the run-detail rail to match the Analysis sidebar's direct numbered hierarchy: the visual current-run card and section heading are removed, the activity overview starts at `01`, and recent-run switching is retained behind a compact numbered disclosure.
Why: The initial rail restyle still preserved the legacy stacked context and always-open recent-run list, making the rail denser than the Analysis reference and leaving too little intentional quiet space.
Preserve list: Section anchors and active observer state, activity overview navigation, current-run metadata for assistive technology, recent-run selection, import navigation, sidebar collapse, localization, keyboard focus, responsive horizontal navigation, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-13-01`
Notes: Presentation and information-hierarchy refinement only; no route, API, persistence, analytics, or user-facing copy changed.

### Version: DV-2026-08-14-03
Date: 2026-08-14
Surface: Run-detail sidebar parity on `/run/:id`
Files: `frontend/src/components/RunsSubpageNav.jsx`, `frontend/src/styles/runs-subnav.css`, `frontend/src/components/runsSubnavAnalysisRail.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Rebuilt the run-detail rail from the shared Analysis command-rail primitives, giving it the same header, grid field, counter-driven numbering, active outline/marker, and Today Run footer action as the approved reference.
Why: The prior route-specific CSS approximated the Analysis rail but still diverged in row geometry, counter placement, active-state material, and footer intent.
Preserve list: Section anchors and active observer state, activity overview navigation, current-run metadata for assistive technology, recent-run selection, import navigation through the recent-run disclosure, sidebar collapse, localization, keyboard focus, responsive horizontal navigation, theme switching, and reduced-motion behavior.
Rollback target: `DV-2026-08-14-02`
Notes: Presentation parity refinement only; no route, API, persistence, analytics, or user-facing copy changed.

### Version: DV-2026-08-14-20
Date: 2026-08-14
Surface: Run-detail Overview on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/styles/run-detail-profile-minimal.css`, `frontend/src/i18n/locales/en/pages.js`, `frontend/src/i18n/locales/zh-CN/pages.js`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Consolidated distance, average pace, moving time, coach review, linked gear, recent comparison, and performance metrics inside one localized Overview card. The former standalone sections retain their existing content and controls as structured subsections of that card.
Why: The run summary was scattered between the hero rail, coach/gear columns, comparison panel, and bottom metrics card, making a post-run scan unnecessarily fragmented.
Preserve list: Route map behavior, coach data, shoe assignment and unlinking, recent-comparison calculation, metrics data, telemetry, splits, section anchors, localization, responsive behavior, theme switching, focus behavior, and reduced-motion behavior.
Rollback target: `DV-2026-08-14-17`
Notes: Structural presentation change only; no API, persistence, or analytics calculation changed.

### Version: DV-2026-08-14-21
Date: 2026-08-14
Surface: Coach insight workbench alignment on `/analysis/coach-insight`
Files: `frontend/src/styles/_split/analysis.css`, `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Gave the desktop performance card and primary plan card one shared responsive row height so the adjacent recent-training and secondary-plan grids begin on the same horizontal baseline.
Why: Independent card content heights caused the right-hand plan stack to advance ahead of the left-hand training evidence stack, creating a visible broken grid rhythm.
Preserve list: Coach insight content, recommendations, run navigation, Today Run action, responsive stacking, localization, themes, keyboard focus, and reduced-motion behavior.
Rollback target: `DV-2026-08-14-20`
Notes: Presentation-only alignment correction; the shared row height is cleared when the workbench stacks below the desktop breakpoint.

### Version: DV-2026-08-14-22
Date: 2026-08-14
Surface: Run-detail Overview on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/components/RunsSubpageNav.jsx`, `frontend/src/pages/runDetailPerformanceMetricsRemoval.smoke.test.js`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `frontend/src/pages/runsSubpageNav.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the Performance Metrics grid from both Run Detail render paths and removed its dead subnavigation link.
Why: The large metrics panel was the unwanted overview grid and continued to appear in the active checkout even after the first worktree-only change.
Preserve list: Overview stats, coach review, linked gear, recent comparison, telemetry, splits, route map behavior, localization, responsive behavior, and theme switching.
Rollback target: `DV-2026-08-14-20`
Notes: The active frontend bundle was rebuilt and published to `backend/target/classes/static`.

### Version: DV-2026-08-14-23
Date: 2026-08-14
Surface: Coach insight evidence column fill on `/analysis/coach-insight`
Files: `frontend/src/styles/_split/analysis.css`, `frontend/src/pages/analysisCoachInsightProfileRedesign.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Stretched the left coach evidence column to the height of the right plan stack and let the recent-training card consume the remaining desktop track, removing the large empty region beneath its activity rows.
Why: The right-side plan stack was taller than the left evidence stack, leaving unused blank space that made the workbench feel visually disconnected.
Preserve list: Coach insight content, recommendations, run navigation, Today Run action, responsive stacking, localization, themes, keyboard focus, and reduced-motion behavior.
Rollback target: `DV-2026-08-14-21`
Notes: Presentation-only spacing correction; stacked layouts restore intrinsic card heights below the desktop breakpoint.

### Version: DV-2026-08-14-24
Date: 2026-08-14
Surface: Run-detail Overview stat grid on `/run/:id`
Files: `frontend/src/pages/RunDetail.jsx`, `frontend/src/pages/runDetailProfileCockpit.smoke.test.js`, `DESIGN_VERSIONS.md`
What changed: Removed the accent treatment from the distance tile so distance, average pace, and moving time share the same neutral Overview surface.
Why: The distance tile rendered as a dark isolated block while its adjacent metrics used the light card surface, breaking the visual unity of the stat grid.
Preserve list: Metric values and units, Overview layout, route map behavior, coach review, linked gear, comparison content, localization, responsive behavior, themes, and keyboard focus.
Rollback target: `DV-2026-08-14-22`
Notes: Presentation-only color correction; no run calculations or data wiring changed.
