# Auto-Hermes Docker Gate

Generated: 2026-06-12T17:47:34.964Z
Passed: no
Git Head: 2494edca50318b233d73734bc521b7f8d7072bae
Command: docker build -f C:\Users\Junwei\Downloads\Hermes\.worktrees\runs-route-thumb-pr\Dockerfile -t hermes-autohermes-gate:local .
Reason: Docker publish gate failed for the current working tree.

## Status Snapshot
```text
M  DESIGN_VERSIONS.md
M  backend/src/main/java/com/hermes/backend/ActivityController.java
M  backend/src/main/java/com/hermes/backend/ActivityPointRepository.java
M  backend/src/main/java/com/hermes/backend/ActivityRepository.java
M  backend/src/test/java/com/hermes/backend/ActivityControllerTests.java
M  frontend/src/pages/Runs.jsx
M  frontend/src/pages/runsRoutePreviewCache.smoke.test.js
M  frontend/src/pages/runsThumbDarkMapTile.smoke.test.js
M  frontend/src/styles/_split/runs.css
M  frontend/src/styles/style.css
```

## Output
```text
ERROR: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
Command failed: C:\Program Files\Docker\Docker\resources\bin\docker.exe build -f C:\Users\Junwei\Downloads\Hermes\.worktrees\runs-route-thumb-pr\Dockerfile -t hermes-autohermes-gate:local .
ERROR: failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```
