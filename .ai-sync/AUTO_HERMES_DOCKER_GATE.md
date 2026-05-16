# Auto-Hermes Docker Gate

Generated: 2026-05-16T12:21:02.542Z
Passed: no
Git Head: c773bcb38123f95e51f3eeee420cee49efe2d4f7
Command: docker build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
Reason: Docker publish gate failed for the current working tree.

## Status Snapshot
```text
M .ai-sync/OMX_AUTO_HERMES_BRIDGE.json
 M .ai-sync/OMX_AUTO_HERMES_BRIDGE.md
M  .claude/commands/auto-hermes-max.md
M  .codex/commands/auto-hermes-self.md
M  .gitignore
A  .opencode/commands/auto-hermes-max.md
A  .opencode/commands/auto-hermes-self.md
A  .opencode/commands/auto-hermes.md
A  .tools/auto-hermes-composition-patterns.mjs
A  .tools/auto-hermes-error-ledger.mjs
A  .tools/auto-hermes-notify.mjs
M  .tools/auto-hermes-self-loop.mjs
```

## Output
```text
#0 building with "desktop-linux" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 1.12kB done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/eclipse-temurin:17-jdk-alpine
#2 ...

#3 [auth] library/eclipse-temurin:pull token for registry-1.docker.io
#3 DONE 0.0s

#4 [auth] library/node:pull token for registry-1.docker.io
#4 DONE 0.0s

#5 [internal] load metadata for docker.io/library/eclipse-temurin:17-jre-alpine
#5 ...

#6 [internal] load metadata for docker.io/library/node:20-alpine
#6 DONE 0.6s

#5 [internal] load metadata for docker.io/library/eclipse-temurin:17-jre-alpine
#5 DONE 0.6s

#2 [internal] load metadata for docker.io/library/eclipse-temurin:17-jdk-alpine
#2 DONE 0.6s

#7 [internal] load .dockerignore
#7 transferring context: 656B 0.0s done
#7 DONE 0.0s

#8 [internal] load build context
#8 DONE 0.0s

#9 [stage-2 1/3] FROM docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571
#9 resolve docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571 0.2s done
#9 DONE 0.2s

#10 [frontend-build  1/13] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
#10 resolve docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
#10 resolve docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 0.2s done
#10 DONE 0.2s

#11 [backend-build 1/8] FROM docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246
#11 resolve docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246 0.2s done
#11 DONE 0.2s

#8 [internal] load build context
#8 transferring context: 12.58MB 1.3s done
#8 DONE 1.4s

#12 [frontend-build  2/13] WORKDIR /frontend
#12 CACHED

#13 [frontend-build  3/13] COPY frontend/package*.json ./
#13 CACHED

#14 [backend-build 2/8] WORKDIR /backend
#14 CACHED

#15 [backend-build 3/8] COPY backend/pom.xml ./
#15 CACHED

#16 [backend-build 4/8] COPY backend/mvnw ./
#16 CACHED

#17 [backend-build 5/8] COPY backend/.mvn ./.mvn
#17 CACHED

#18 [backend-build 6/8] COPY backend/src ./src
#18 DONE 0.6s

#19 [frontend-build  4/13] RUN npm ci --ignore-scripts
#19 3.458 npm error code EUSAGE
#19 3.458 npm error
#19 3.458 npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
#19 3.458 npm error
#19 3.458 npm error Missing: react-window@2.2.7 from lock file
#19 3.458 npm error
#19 3.458 npm error Clean install a project
#19 3.458 npm error
#19 3.458 npm error Usage:
#19 3.458 npm error npm ci
#19 3.458 npm error
#19 3.458 npm error Options:
#19 3.458 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
#19 3.458 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
#19 3.458 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
#19 3.458 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
#19 3.458 npm error [--no-bin-links] [--no-fund] [--dry-run]
#19 3.458 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
#19 3.458 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
#19 3.458 npm error
#19 3.458 npm error aliases: clean-install, ic, install-clean, isntall-clean
#19 3.458 npm error
#19 3.458 npm error Run "npm help ci" for more info
#19 3.461 npm notice
#19 3.461 npm notice New major version of npm available! 10.8.2 -> 11.14.1
#19 3.461 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
#19 3.461 npm notice To update run: npm install -g npm@11.14.1
#19 3.461 npm notice
#19 3.461 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T12_21_05_736Z-debug-0.log
#19 ERROR: process "/bin/sh -c npm ci --ignore-scripts" did not complete successfully: exit code: 1
------
 > [frontend-build  4/13] RUN npm ci --ignore-scripts:
3.458 npm error
3.458 npm error aliases: clean-install, ic, install-clean, isntall-clean
3.458 npm error
3.458 npm error Run "npm help ci" for more info
3.461 npm notice
3.461 npm notice New major version of npm available! 10.8.2 -> 11.14.1
3.461 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
3.461 npm notice To update run: npm install -g npm@11.14.1
3.461 npm notice
3.461 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T12_21_05_736Z-debug-0.log
------
WARNING: current commit information was not captured by the build: git was not found in the system: exec: "git.exe": executable file not found in %PATH%
Dockerfile:6
--------------------
   4 |     
   5 |     COPY frontend/package*.json ./
   6 | >>> RUN npm ci --ignore-scripts
   7 |     
   8 |     COPY frontend/index.html ./
--------------------
ERROR: failed to build: failed to solve: process "/bin/sh -c npm ci --ignore-scripts" did not complete successfully: exit code: 1

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/7kfu2ebueq9i19rqolzoqpu9t
Command failed: C:\Program Files\Docker\Docker\resources\bin\docker.exe build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
#0 building with "desktop-linux" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 1.12kB done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/eclipse-temurin:17-jdk-alpine
#2 ...

#3 [auth] library/eclipse-temurin:pull token for registry-1.docker.io
#3 DONE 0.0s

#4 [auth] library/node:pull token for registry-1.docker.io
#4 DONE 0.0s

#5 [internal] load metadata for docker.io/library/eclipse-temurin:17-jre-alpine
#5 ...

#6 [internal] load metadata for docker.io/library/node:20-alpine
#6 DONE 0.6s

#5 [internal] load metadata for docker.io/library/eclipse-temurin:17-jre-alpine
#5 DONE 0.6s

#2 [internal] load metadata for docker.io/library/eclipse-temurin:17-jdk-alpine
#2 DONE 0.6s

#7 [internal] load .dockerignore
#7 transferring context: 656B 0.0s done
#7 DONE 0.0s

#8 [internal] load build context
#8 DONE 0.0s

#9 [stage-2 1/3] FROM docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571
#9 resolve docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571 0.2s done
#9 DONE 0.2s

#10 [frontend-build  1/13] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
#10 resolve docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
#10 resolve docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 0.2s done
#10 DONE 0.2s

#11 [backend-build 1/8] FROM docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246
#11 resolve docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246 0.2s done
#11 DONE 0.2s

#8 [internal] load build context
#8 transferring context: 12.58MB 1.3s done
#8 DONE 1.4s

#12 [frontend-build  2/13] WORKDIR /frontend
#12 CACHED

#13 [frontend-build  3/13] COPY frontend/package*.json ./
#13 CACHED

#14 [backend-build 2/8] WORKDIR /backend
#14 CACHED

#15 [backend-build 3/8] COPY backend/pom.xml ./
#15 CACHED

#16 [backend-build 4/8] COPY backend/mvnw ./
#16 CACHED

#17 [backend-build 5/8] COPY backend/.mvn ./.mvn
#17 CACHED

#18 [backend-build 6/8] COPY backend/src ./src
#18 DONE 0.6s

#19 [frontend-build  4/13] RUN npm ci --ignore-scripts
#19 3.458 npm error code EUSAGE
#19 3.458 npm error
#19 3.458 npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
#19 3.458 npm error
#19 3.458 npm error Missing: react-window@2.2.7 from lock file
#19 3.458 npm error
#19 3.458 npm error Clean install a project
#19 3.458 npm error
#19 3.458 npm error Usage:
#19 3.458 npm error npm ci
#19 3.458 npm error
#19 3.458 npm error Options:
#19 3.458 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
#19 3.458 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
#19 3.458 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
#19 3.458 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
#19 3.458 npm error [--no-bin-links] [--no-fund] [--dry-run]
#19 3.458 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
#19 3.458 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
#19 3.458 npm error
#19 3.458 npm error aliases: clean-install, ic, install-clean, isntall-clean
#19 3.458 npm error
#19 3.458 npm error Run "npm help ci" for more info
#19 3.461 npm notice
#19 3.461 npm notice New major version of npm available! 10.8.2 -> 11.14.1
#19 3.461 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
#19 3.461 npm notice To update run: npm install -g npm@11.14.1
#19 3.461 npm notice
#19 3.461 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T12_21_05_736Z-debug-0.log
#19 ERROR: process "/bin/sh -c npm ci --ignore-scripts" did not complete successfully: exit code: 1
------
 > [frontend-build  4/13] RUN npm ci --ignore-scripts:
3.458 npm error
3.458 npm error aliases: clean-install, ic, install-clean, isntall-clean
3.458 npm error
3.458 npm error Run "npm help ci" for more info
3.461 npm notice
3.461 npm notice New major version of npm available! 10.8.2 -> 11.14.1
3.461 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
3.461 npm notice To update run: npm install -g npm@11.14.1
3.461 npm notice
3.461 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T12_21_05_736Z-debug-0.log
------
WARNING: current commit information was not captured by the build: git was not found in the system: exec: "git.exe": executable file not found in %PATH%
Dockerfile:6
--------------------
   4 |     
   5 |     COPY frontend/package*.json ./
   6 | >>> RUN npm ci --ignore-scripts
   7 |     
   8 |     COPY frontend/index.html ./
--------------------
ERROR: failed to build: failed to solve: process "/bin/sh -c npm ci --ignore-scripts" did not complete successfully: exit code: 1

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/7kfu2ebueq9i19rqolzoqpu9t
```
