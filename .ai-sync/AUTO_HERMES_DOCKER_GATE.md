# Auto-Hermes Docker Gate

Generated: 2026-05-28T05:19:26.513Z
Passed: no
Git Head: e5e78ef53cf4508e0799a8a44cd1d5aeabc54951
Command: docker build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
Reason: Docker publish gate failed for the current working tree.

## Status Snapshot
```text
M .ai-sync/AGENT_SYNC.json
 M .ai-sync/AGENT_SYNC.md
 M .ai-sync/AUTO_HERMES_DOCKER_GATE.json
 M .ai-sync/AUTO_HERMES_DOCKER_GATE.md
 M .ai-sync/CONTEXT_LEDGER.md
 M .ai-sync/HUMAN_LOOP.md
 M .tools/auto-hermes-browser.mjs
 M .tools/auto-hermes-playwright.mjs
 M .tools/auto-hermes-self-loop.mjs
 M AGENTS.md
 M TASKS.md
M  backend/src/main/java/com/hermes/backend/AcclimatizationService.java
M  backend/src/main/java/com/hermes/backend/AdminRacePortalController.java
A  backend/src/main/java/com/hermes/backend/LosAngelesMarathonOfficialCourse.java
M  backend/src/main/java/com/hermes/backend/MarathonRouteGeoreferencingService.java
M  backend/src/main/java/com/hermes/backend/NycMarathonOfficialCourse.java
A  backend/src/main/java/com/hermes/backend/OsakaMarathonOfficialCourse.java
M  backend/src/main/java/com/hermes/backend/RaceCourseMapService.java
M  backend/src/main/java/com/hermes/backend/WeatherContextController.java
A  backend/src/test/java/com/hermes/backend/BostonMarathonRouteAccuracyTests.java
D  frontend/src/assets/generated/landing-command-hero-background.png
A  frontend/src/assets/generated/landing-command-hero-background.webp
A  frontend/src/assets/generated/recent-runs-hero-overlay.jpg
M  frontend/src/components/AppIcon.jsx
M  frontend/src/components/MuscleHeatmap.jsx
A  frontend/src/components/appIconCoverage.smoke.test.js
M  frontend/src/i18n/locales/en/pages.js
M  frontend/src/i18n/locales/zh-CN/pages.js
M  frontend/src/pages/MuscleTraining.jsx
M  frontend/src/pages/ProfileDashboard.jsx
M  frontend/src/pages/Runs.jsx
M  frontend/src/pages/Territory.jsx
M  frontend/src/pages/WeatherEngine.jsx
M  frontend/src/pages/landingCommandHeroBackground.smoke.test.js
A  frontend/src/pages/muscleTrainingDailyComposer.smoke.test.js
A  frontend/src/pages/runsHeroOverlayContrast.smoke.test.js
M  frontend/src/pages/runsRoutePreviewCache.smoke.test.js
A  frontend/src/pages/runsThumbDarkMapTile.smoke.test.js
A  frontend/src/pages/territoryMultiPlayerMarkers.smoke.test.js
M  frontend/src/styles/_split/analysis.css
M  frontend/src/styles/_split/landing.css
M  frontend/src/styles/_split/muscle-training.css
M  frontend/src/styles/_split/profile.css
M  frontend/src/styles/_split/runs.css
M  frontend/src/styles/_split/settings.css
M  frontend/src/styles/_split/territory.css
M  frontend/src/styles/_split/weather.css
M  frontend/src/styles/style.css
?? .claude/commands/auto-hermes-structure-update.md
?? .codex/commands/auto-hermes-language.md
?? .codex/commands/auto-hermes-structure-update.md
?? .codex/commands/auto-hermes-submit-main.md
?? .codex/commands/deepseek.md
?? .codex/workflows/auto-hermes-structure-update-contract.md
?? .opencode/commands/auto-hermes-attack.md
?? .opencode/commands/auto-hermes-find-shoe.md
?? .opencode/commands/auto-hermes-language.md
?? .opencode/commands/auto-hermes-market.md
?? .opencode/commands/auto-hermes-pull-main.md
?? .opencode/commands/auto-hermes-push-main.md
?? .opencode/commands/auto-hermes-security.md
?? .opencode/commands/auto-hermes-structure-update.md
?? .opencode/commands/auto-hermes-tech-debt.md
?? .opencode/commands/deepseek.md
?? .tools/_split-locales-once.mjs
?? .tools/agent-login.mjs
?? .tools/audit-course-maps.ps1
?? .tools/auto-hermes-browser-multi-agent.test.mjs
?? .tools/auto-hermes-worktree-audit.mjs
?? backend/src/main/java/com/hermes/backend/OuraWellnessImportService.java.disabled
?? backend/test
?? docs/auto-hermes/attack.md
?? docs/auto-hermes/market.md
?? docs/auto-hermes/security.md
?? opencode.json
```

## Output
```text
ERROR: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
Command failed: C:\Program Files\Docker\Docker\resources\bin\docker.exe build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
ERROR: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```
