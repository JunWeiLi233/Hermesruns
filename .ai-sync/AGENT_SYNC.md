# Cross-Agent Sync

Updated: 2026-04-19T23:59:31.6849286-04:00

Use this file as the shared cross-platform coordination layer for Codex, Claude, and other Hermes-capable agents.

## Rules
- Read this file before starting queue work, resuming a checkpoint, or reclaiming a user-visible task.
- Claim a task before implementation when the work unit is not trivially local.
- Do not re-pick recently completed work unless there is a recorded must-fix, regression, or explicit user request.
- Reviewer must-fix items outrank fresh speculative ideas.
- Before self-generated follow-up rounds, also read `.ai-sync/HUMAN_LOOP.md` for human steering, pause, or reversal requests.
- Keep entries short and overwrite stale claims instead of appending long history.

## Active Claims

- Key: vdot-fitness-race-predictions
  Task: Add VDOT Fitness + Race Predictions strip to Profile page with prominent VDOT number, 30-day trend arrow, and calibrated race time predictions for 5K/10K/half/marathon
  Surface: Profile
  Agent: opencode
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T14:30:00.000Z
  Verify: eslint PASS | vite build PASS
  Files: frontend/src/pages/ProfileDashboard.jsx, frontend/src/i18n/translations.js, frontend/src/styles/style.css

- Key: coaching-intelligence-strip
  Task: Add 4-column Coaching Intelligence Strip to TodayRun page answering Daily Opening Test within 10 seconds
  Surface: Today's Run
  Agent: opencode
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T13:00:00.000Z
  Verify: eslint PASS | vite build PASS | runtime sync PASS
  Files: frontend/src/pages/TodayRun.jsx, frontend/src/i18n/translations.js, frontend/src/styles/style.css

## Recently Completed
- Key: races-detail-elevation-per-km
  Task: Upgrade the race-detail elevation chart to use kilometer-aware aligned-route sampling and per-km chart markers
  Surface: Races Detail
  Agent: codex
  Owner: frontend+backend
  Status: completed
  Completed: 2026-04-20T18:54:00.000Z
  Verify: RaceCourseMapServiceTests PASS | raceDetailElevationPerKm PASS | eslint PASS with unrelated warnings | frontend build PASS | frontend runtime sync PASS | backend compile PASS | backend runtime sync PASS
  Files: backend/src/main/java/com/hermes/backend/RaceCourseMapService.java, backend/src/test/java/com/hermes/backend/RaceCourseMapServiceTests.java, frontend/src/pages/RacesDetail.jsx, frontend/src/styles/style.css, frontend/src/pages/raceDetailElevationPerKm.smoke.test.js

- Key: copilot-hermes-slash-commands
  Task: Expose the Hermes auto-hermes command family to GitHub Copilot through repository prompt files so they can be invoked as slash commands
  Surface: Repo tooling / GitHub Copilot prompt integration
  Agent: codex
  Owner: tooling
  Status: completed
  Completed: 2026-04-20T12:00:00.000Z
  Verify: copilotPromptFiles PASS | eslint PASS with unrelated warnings only
  Files: .github/prompts/auto-hermes.prompt.md, .github/prompts/auto-hermes-max.prompt.md, .github/prompts/auto-hermes-market.prompt.md, .github/prompts/auto-hermes-attack.prompt.md, .github/prompts/auto-hermes-security.prompt.md, .github/prompts/auto-hermes-tech-debt.prompt.md, .github/copilot-instructions.md, frontend/src/utils/copilotPromptFiles.smoke.test.js

- Key: weather-editorial-redesign
  Task: Rename the runner weather route from /weather-engine to /weather and redesign the Weather page around the approved cinematic editorial hierarchy
  Surface: Weather
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-20T11:46:00.000Z
  Verify: weatherEditorialRedesign PASS | eslint PASS with unrelated warnings | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/App.jsx, frontend/src/pages/WeatherEngine.jsx, frontend/src/utils/runnerShellNav.js, frontend/src/styles/style.css, frontend/src/pages/weatherEditorialRedesign.smoke.test.js

- Key: shoes-real-brand-logos
  Task: Replace synthetic top-brand marks with real ASICS/Nike/Adidas/New Balance/Saucony logo assets on Shoes/AddShoes live brand-logo surfaces
  Surface: Shoes + AddShoes
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-20T11:45:00.000Z
  Verify: addShoesKineticEditorial PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/components/ShoeBrandLogo.jsx, frontend/src/pages/AddShoes.jsx, frontend/src/pages/Shoes.jsx, frontend/src/styles/style.css, frontend/src/assets/brand-logos/*

- Key: shoes-display-image-cleanup
  Task: Automatically clean baked checkerboard/flat backgrounds at display time for shoe images from local uploads and remote URLs without mutating stored image references
  Surface: Shoes image pipeline
  Agent: codex
  Owner: frontend+backend
  Status: completed
  Completed: 2026-04-20T12:01:00.000Z
  Verify: targeted eslint PASS | addShoesKineticEditorial PASS | vite build PASS | frontend runtime sync PASS | backend compile PASS | backend runtime sync PASS
  Files: frontend/src/utils/removeBackground.js, frontend/src/pages/Shoes.jsx, backend/src/main/java/com/hermes/backend/ShoeImageController.java, frontend/src/assets/brand-logos/*

- Key: schedule-weekly-coach-summary
  Task: Add a coach-voice weekly summary to the Schedule page using VDOT trend, ACWR/load state, and block focus
  Surface: Schedule
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T23:59:31.6849286-04:00
  Verify: scheduleCoachSummary PASS | eslint PASS | vite build PASS
  Files: frontend/src/pages/Schedule.jsx, frontend/src/utils/scheduleCoachSummary.js, frontend/src/utils/scheduleCoachSummary.test.js, frontend/src/i18n/translations.js, frontend/src/styles/style.css

- Key: dashboard-coursemap-rail-live-leaflet
  Task: Make the `/dashboard/course-maps` left rail use live Leaflet/OpenStreetMap thumbnails instead of static course-map posters
  Surface: dashboard course maps
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-20T02:37:06.660Z
  Verify: dashboardCourseMapRailLeaflet PASS | dashboardCourseMapPreview PASS | eslint PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/pages/Dashboard.jsx, frontend/src/components/AdminCourseMapPreview.jsx, frontend/src/pages/dashboardCourseMapRailLeaflet.smoke.test.js

- Key: today-run-acwr-warning-system
  Task: Add ACWR load warning callout with plain-language coaching guidance on Today's Run
  Surface: Today's Run
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-20T02:09:30.000Z
  Verify: todayRunAcwrInsight PASS | todayRunAcwrNarrative PASS | eslint PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/pages/TodayRun.jsx, frontend/src/utils/todayRunAcwrInsight.js, frontend/src/utils/todayRunAcwrInsight.test.js, frontend/src/utils/todayRunAcwrNarrative.smoke.test.js, frontend/src/i18n/translations.js, frontend/src/styles/style.css

- Key: dashboard-jobs-command-deck
  Task: Redesign `/dashboard/jobs` into an editorial command deck with terminal queue and selected-job detail rail
  Surface: dashboard jobs
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-20T00:05:30.000Z
  Verify: dashboardJobsCommandDeck PASS | dashboardTranslations PASS | eslint PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/pages/Dashboard.jsx, frontend/src/styles/style.css, frontend/src/i18n/translations.js, frontend/src/pages/dashboardJobsCommandDeck.smoke.test.js, frontend/package.json

- Key: dashboard-audit-terminal-redesign
  Task: Redesign `/dashboard/audit` into a Sync Pipeline Terminal based on the provided operator reference
  Surface: dashboard audit
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T23:56:28.714Z
  Verify: dashboardAuditTerminal PASS | dashboardRouteSections PASS | dashboardKineticShell PASS | dashboardCourseMapTrackHubRefactor PASS | dashboardAdminLightMode PASS | eslint PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/pages/Dashboard.jsx, frontend/src/styles/style.css, frontend/src/i18n/translations.js, frontend/src/pages/dashboardAuditTerminal.smoke.test.js

- Key: dashboard-admin-light-mode-pass
  Task: Apply light mode across every page in the admin portal
  Surface: dashboard
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T23:47:53.289Z
  Verify: dashboardAdminLightMode PASS | dashboardRouteSections PASS | dashboardKineticShell PASS | dashboardCourseMapTrackHubRefactor PASS | eslint PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/styles/style.css, frontend/src/pages/dashboardAdminLightMode.smoke.test.js

- Key: dashboard-route-shell-settings-surface
  Task: Convert the admin dashboard into route-driven pages with a dedicated operator settings surface
  Surface: dashboard
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T23:25:26.339Z
  Verify: dashboardRouteSections PASS | dashboardKineticShell PASS | dashboardCourseMapTrackHubRefactor PASS | eslint PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/App.jsx, frontend/src/pages/Dashboard.jsx, frontend/src/styles/style.css, frontend/src/i18n/translations.js, frontend/src/pages/dashboardRouteSections.smoke.test.js

- Key: dashboard-fix-broken-ui
  Task: Redesign and fix the broken Course Maps dashboard UI
  Surface: dashboard
  Agent: opencode
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T15:12:00.000Z
  Verify: vite build PASS | ui test PASS
  Files: frontend/src/styles/style.css

- Key: races-detail-fix-osm-world-map-tile-ordering
  Task: Fix reversed race-detail Leaflet tile ordering so the world basemap renders with proxy-first and direct OSM fallback behavior
  Surface: Races Detail
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T05:00:00.000Z
  Verify: raceDetailMapFallback PASS | raceDetailMapLifecycle PASS | raceDetailMapHost PASS | raceDetailCourseMapOverlay PASS | eslint PASS | vite build PASS | frontend runtime sync PASS
  Files: frontend/src/pages/RacesDetail.jsx, frontend/src/utils/raceDetailMapFallback.smoke.test.js

- Key: races-detail-restore-real-world-osm-tile-rendering-on-race-detail-route-map
  Task: Restore real-world OSM tile rendering on race detail route map
  Surface: Races Detail
  Agent: claude
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T04:53:20.868Z
  Verify: eslint PASS | vite build PASS | runtime sync PASS
  Files: frontend/src/pages/RacesDetail.jsx

- Key: races-detail-map-stage-full-width-world-map
  Task: Redesign the race-detail lower map area into a full-width OpenStreetMap Leaflet stage with the readiness card below it
  Surface: Races Detail
  Agent: codex
  Owner: frontend
  Status: completed
  Completed: 2026-04-19T04:23:30.000

## Must-Fix Queue
- none

## Human Inbox
- none
