# Cross-Agent Sync

Updated: 2026-06-13T04:55:37.234Z

Use this file as the shared cross-platform coordination layer for Codex, Claude, and other Hermes-capable agents.

## Rules
- Read this file before starting queue work, resuming a checkpoint, or reclaiming a user-visible task.
- Claim a task before implementation when the work unit is not trivially local.
- Do not re-pick recently completed work unless there is a recorded must-fix, regression, or explicit user request.
- Reviewer must-fix items outrank fresh speculative ideas.
- Before self-generated follow-up rounds, also read `.ai-sync/HUMAN_LOOP.md` for human steering, pause, or reversal requests.
- Keep entries short and overwrite stale claims instead of appending long history.

## Active Claims
- Key: wuxi-marathon-coursemap-fix
  Task: Fix Wuxi Marathon course map against the official 2026 route
  Surface: /races/details/wuxi-marathon
  Agent: codex
  Status: completed
  Started: 2026-06-05T18:15:00-04:00
  Completed: 2026-06-05T19:14:32-04:00
  Verify: official 2026 Wuxi Marathon regulations route text checked; `./mvnw.cmd -q "-Dtest=WuxiMarathonOfficialCourseTests,OfficialCourseStartupSeedConfigurationTests" test`; `cd backend && ./mvnw.cmd -q -DskipTests compile`; `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`; `node frontend/src/pages/raceDetailElevationPerKm.smoke.test.js`; `cd frontend && node scripts/run-vite-build.mjs`; frontend runtime sync PASS; backend runtime sync PASS with `http://localhost:8080 -> 200`; startup reseed log shows `wuxi-marathon -> SEEDED`; live API proof shows `source=wuxi-official-course`, `confidence=90`, `routePointCount=600`; Browser proof on `/races/details/wuxi-marathon` shows official route, `90%` confidence, `600` route points, and no console warnings/errors
  Files: backend/src/main/java/com/hermes/backend/WuxiMarathonOfficialCourse.java | backend/src/main/java/com/hermes/backend/RaceCourseMapBulkSeedService.java | backend/src/main/java/com/hermes/backend/OfficialCourseStartupSeedConfiguration.java | backend/src/main/java/com/hermes/backend/RaceCourseMapService.java | frontend/src/pages/RacesDetail.jsx | backend/src/test/java/com/hermes/backend/WuxiMarathonOfficialCourseTests.java | backend/src/test/java/com/hermes/backend/OfficialCourseStartupSeedConfigurationTests.java

- Key: tokyo-marathon-coursemap-gyoko-dori-finish-fix
  Task: Fix Tokyo Marathon course-map finish marker to the official map's Tokyo Station / Gyoko-dori Ave. finish
  Surface: /races/details/tokyo-marathon
  Agent: codex
  Status: completed
  Started: 2026-06-05T18:50:00-04:00
  Completed: 2026-06-05T19:01:07-04:00
  Verify: official Tokyo Marathon downloadable map labels finish as Tokyo Station / Gyoko-dori Ave.; red/green backend guards for Tokyo official route and startup stale detection; `./mvnw.cmd -q "-Dtest=TokyoMarathonOfficialCourseTests,RaceCourseMapBulkSeedServiceTests,OfficialCourseStartupSeedConfigurationTests" test`; `cd backend && ./mvnw.cmd -q -DskipTests compile`; startup reseed log shows `tokyo-marathon -> SEEDED`; backend runtime sync PASS; DB proof source=tokyo-official-course routePoints=600 last=Finish - Tokyo Station / Gyoko-dori Ave. hasOldWadakura=false; Browser proof on /races/details/tokyo-marathon shows official 600-point Leaflet route with updated geometry and no missing map
  Files: backend/src/main/java/com/hermes/backend/TokyoMarathonOfficialCourse.java | backend/src/main/java/com/hermes/backend/RaceCourseMapBulkSeedService.java | backend/src/main/java/com/hermes/backend/OfficialCourseStartupSeedConfiguration.java | backend/src/test/java/com/hermes/backend/TokyoMarathonOfficialCourseTests.java | backend/src/test/java/com/hermes/backend/RaceCourseMapBulkSeedServiceTests.java | backend/src/test/java/com/hermes/backend/OfficialCourseStartupSeedConfigurationTests.java

- Key: race-detail-elevation-major-labels-4km
  Task: Make race detail elevation major markers display explicit 4km-style labels
  Surface: /races/details/chicago-marathon
  Agent: codex
  Status: completed
  Started: 2026-06-05T18:44:00-04:00
  Completed: 2026-06-05T18:49:27-04:00
  Verify: Browser proof on /races/details/chicago-marathon shows major labels 0km/4km/8km/12km and 5 remains a minor tick; `node frontend/src/pages/raceDetailElevationPerKm.smoke.test.js`; `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`; `cd frontend && node scripts/run-vite-build.mjs`; frontend runtime sync PASS
  Files: frontend/src/pages/RacesDetail.jsx | frontend/src/pages/raceDetailElevationPerKm.smoke.test.js

- Key: tokyo-marathon-coursemap-fix
  Task: Re-make Tokyo Marathon course map because the current route is wrong
  Surface: /races/details/tokyo-marathon
  Agent: codex
  Status: completed
  Started: 2026-06-05T17:16:00-04:00
  Completed: 2026-06-05T17:49:00-04:00
  Verify: superseded by `tokyo-marathon-coursemap-gyoko-dori-finish-fix`; current DB/browser proof uses Tokyo Station / Gyoko-dori Ave. finish and excludes the old Wadakura finish label
  Files: backend/src/main/java/com/hermes/backend/TokyoMarathonOfficialCourse.java | backend/src/main/java/com/hermes/backend/RaceCourseMapBulkSeedService.java | backend/src/main/java/com/hermes/backend/OfficialCourseStartupSeedConfiguration.java | backend/src/test/java/com/hermes/backend/TokyoMarathonOfficialCourseTests.java | backend/src/test/java/com/hermes/backend/RaceCourseMapBulkSeedServiceTests.java | backend/src/test/java/com/hermes/backend/OfficialCourseStartupSeedConfigurationTests.java

- Key: boston-marathon-coursemap-fix
  Task: Fix Boston Marathon course map against official B.A.A. route
  Surface: /races/details/boston-marathon
  Agent: codex
  Status: completed
  Started: 2026-06-05T16:58:00-04:00
  Completed: 2026-06-05T17:13:00-04:00
  Verify: `./mvnw.cmd -q "-Dtest=BostonMarathonOfficialCourseTests,RaceCourseMapBulkSeedServiceTests,OfficialCourseStartupSeedConfigurationTests" test`; `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`; `node frontend/src/pages/raceDetailElevationPerKm.smoke.test.js`; `cd backend && ./mvnw.cmd -q -DskipTests compile`; `cd frontend && node scripts/run-vite-build.mjs`; backend/frontend runtime sync PASS; live API proof source=boston-official-course routePoints=600 start=Start - Hopkinton finish=Finish - Boylston Street; Browser plugin Chrome proof on /races/details/boston-marathon shows official route, Leaflet, and 600 route points
  Files: backend/src/main/java/com/hermes/backend/BostonMarathonOfficialCourse.java | backend/src/main/java/com/hermes/backend/RaceCourseMapBulkSeedService.java | backend/src/main/java/com/hermes/backend/RaceCourseMapService.java | backend/src/main/java/com/hermes/backend/OfficialCourseStartupSeedConfiguration.java | backend/src/test/java/com/hermes/backend/BostonMarathonOfficialCourseTests.java | backend/src/test/java/com/hermes/backend/RaceCourseMapBulkSeedServiceTests.java | backend/src/test/java/com/hermes/backend/OfficialCourseStartupSeedConfigurationTests.java | frontend/src/pages/RacesDetail.jsx | frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js

- Key: race-detail-elevation-major-every-4km
  Task: Make race detail elevation chart render major markers every 4 km
  Surface: /races/details/:raceId
  Agent: codex
  Status: completed
  Started: 2026-06-05T16:36:00-04:00
  Completed: 2026-06-05T16:53:00-04:00
  Verify: `node frontend/src/pages/raceDetailElevationPerKm.smoke.test.js`; `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`; `cd frontend && node scripts/run-vite-build.mjs`; frontend runtime sync PASS; localhost 200
  Files: frontend/src/pages/RacesDetail.jsx | frontend/src/pages/raceDetailElevationPerKm.smoke.test.js

- Key: chicago-marathon-elevation-fix
  Task: Fix Chicago Marathon elevation chart against official course-map profile
  Surface: /races/details/chicago-marathon
  Agent: codex
  Status: completed
  Started: 2026-06-05T16:00:00-04:00
  Completed: 2026-06-05T16:15:19-04:00
  Verify: focused Chicago seed tests, backend compile, frontend build/runtime sync, live API proof source=chicago-official-course totalClimb=35 min=176 max=183 samples=64 routePoints=163, Chrome page proof shows 35m and no 289 spike
  Files: backend/src/main/java/com/hermes/backend/ChicagoMarathonKnownCourse.java | backend/src/main/java/com/hermes/backend/RaceCourseMapBulkSeedService.java | backend/src/main/java/com/hermes/backend/RaceCourseMapService.java | backend/src/main/java/com/hermes/backend/OfficialCourseStartupSeedConfiguration.java | backend/src/test/java/com/hermes/backend/ChicagoMarathonKnownCourseTests.java | backend/src/test/java/com/hermes/backend/RaceCourseMapBulkSeedServiceTests.java | backend/src/test/java/com/hermes/backend/OfficialCourseStartupSeedConfigurationTests.java | frontend/src/pages/RacesDetail.jsx | frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js

## Recently Completed
- Key: run-id-issue-51-run-detail-telemetry-cockpit
  Task: Issue #51 Run Detail telemetry cockpit
  Surface: /run/:id
  Agent: codex
  Owner: codex
  Status: completed
  Completed: 2026-06-13T04:55:37.234Z
  Verify: backend targeted tests; backend compile; frontend smoke; frontend lint; translation parity; Vite build; localhost:8092 API import telemetry proof; Browser /run/49 proof
  Files: backend/src/main/java/com/hermes/backend/ActivityController.java | backend/src/main/java/com/hermes/backend/ActivityPoint.java | backend/src/main/java/com/hermes/backend/TcxActivityFileParser.java | backend/src/main/java/com/hermes/backend/GpxActivityFileParser.java | backend/src/main/java/com/hermes/backend/FitActivityFileParser.java | backend/src/test/java/com/hermes/backend/ActivityFileParserDeviceTelemetryTests.java | frontend/src/pages/RunDetail.jsx | frontend/src/pages/runDetailProfileCockpit.smoke.test.js | frontend/src/i18n/locales/en/pages.js | frontend/src/i18n/locales/zh-CN/pages.js | frontend/src/styles/_split/runs.css | frontend/src/styles/style.css | DESIGN_VERSIONS.md
  Review: approve-next-round

- Key: nyc-marathon-coursemap-elevation-fix
  Task: Fixed New York City Marathon course map and elevation chart seed
  Surface: /races/details/new-york-city-marathon
  Agent: codex
  Completed: 2026-06-05T12:27:00-04:00
  Verify: `./mvnw.cmd -q "-Dtest=RaceCourseMapBulkSeedServiceTests,OfficialCourseStartupSeedConfigurationTests" test`; `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`; `node frontend/src/pages/raceDetailElevationPerKm.smoke.test.js`; `cd frontend && node scripts/run-vite-build.mjs`; frontend/backend runtime sync scripts; browser proof on localhost
  Files: backend/src/main/java/com/hermes/backend/NycMarathonOfficialCourse.java | backend/src/main/java/com/hermes/backend/RaceCourseMapBulkSeedService.java | backend/src/main/java/com/hermes/backend/OfficialCourseStartupSeedConfiguration.java | backend/src/test/java/com/hermes/backend/RaceCourseMapBulkSeedServiceTests.java | backend/src/test/java/com/hermes/backend/OfficialCourseStartupSeedConfigurationTests.java | frontend/src/pages/RacesDetail.jsx | frontend/src/i18n/locales/en/pages.js | frontend/src/i18n/locales/zh-CN/pages.js | frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js

## Must-Fix Queue
- Key: runner-shell-sidebar-fix-squeezed-left-sidebar-collapsed-state
  Task: Fix squeezed left sidebar collapsed state
  Surface: runner shell sidebar
  Agent: codex
  Owner: codex
  Status: must-fix
  Started: 2026-06-03T17:14:27.204Z
  Verify: node frontend/src/components/runnerShellSidebarRedesign.smoke.test.js; cd frontend; node scripts/run-vite-build.mjs; node .tools/verify-frontend-runtime-sync.mjs --files frontend/src/styles/_split/profile.css,frontend/src/styles/style.css,frontend/src/components/runnerShellSidebarRedesign.smoke.test.js; localhost CSS asset signature check for 96px rail, icon-only brand, hidden counters, bounded 52x60 squeeze button
  Files: frontend/src/styles/_split/profile.css | frontend/src/styles/style.css | frontend/src/components/runnerShellSidebarRedesign.smoke.test.js
  Review: ralph-gate-must-fix

- Key: profile-fix-profile-empty-state
  Task: Fix Profile empty state
  Surface: Profile
  Agent: codex
  Status: must-fix
  Started: 2026-05-31T21:24:38.122Z
  Verify: `cd frontend && npm run lint && npm run build`
  Files: frontend/src/pages/Profile.jsx
  Review: ralph-gate-must-fix

## Human Inbox
- none
