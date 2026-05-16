# Auto-Hermes Docker Gate

Generated: 2026-05-16T10:50:38.075Z
Passed: no
Git Head: 920dee966fcc4ad2a18b0346cf901858cb6a7264
Command: docker build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
Reason: Docker publish gate failed for the current working tree.

## Status Snapshot

clean working tree


## Output
```text
#0 building with "desktop-linux" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 1.12kB done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/node:20-alpine
#2 DONE 0.3s

#3 [internal] load metadata for docker.io/library/eclipse-temurin:17-jre-alpine
#3 DONE 0.3s

#4 [internal] load metadata for docker.io/library/eclipse-temurin:17-jdk-alpine
#4 DONE 0.4s

#5 [internal] load .dockerignore
#5 transferring context: 656B done
#5 DONE 0.0s

#6 [frontend-build  1/13] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
#6 resolve docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 0.1s done
#6 DONE 0.1s

#7 [backend-build 1/8] FROM docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246
#7 resolve docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246 0.1s done
#7 DONE 0.1s

#8 [stage-2 1/3] FROM docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571
#8 resolve docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571 0.1s done
#8 DONE 0.1s

#9 [internal] load build context
#9 transferring context: 66.42kB 0.5s done
#9 DONE 0.5s

#10 [backend-build 4/8] COPY backend/mvnw ./
#10 CACHED

#11 [backend-build 5/8] COPY backend/.mvn ./.mvn
#11 CACHED

#12 [backend-build 2/8] WORKDIR /backend
#12 CACHED

#13 [backend-build 3/8] COPY backend/pom.xml ./
#13 CACHED

#14 [backend-build 6/8] COPY backend/src ./src
#14 CACHED

#15 [frontend-build  2/13] WORKDIR /frontend
#15 CACHED

#16 [frontend-build  3/13] COPY frontend/package*.json ./
#16 CACHED

#17 [frontend-build  4/13] RUN npm ci --ignore-scripts
#17 1.341 npm error code EUSAGE
#17 1.341 npm error
#17 1.341 npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
#17 1.341 npm error
#17 1.341 npm error Missing: react-window@2.2.7 from lock file
#17 1.341 npm error
#17 1.341 npm error Clean install a project
#17 1.341 npm error
#17 1.341 npm error Usage:
#17 1.341 npm error npm ci
#17 1.341 npm error
#17 1.341 npm error Options:
#17 1.341 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
#17 1.341 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
#17 1.341 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
#17 1.341 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
#17 1.341 npm error [--no-bin-links] [--no-fund] [--dry-run]
#17 1.341 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
#17 1.341 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
#17 1.341 npm error
#17 1.341 npm error aliases: clean-install, ic, install-clean, isntall-clean
#17 1.341 npm error
#17 1.341 npm error Run "npm help ci" for more info
#17 1.343 npm notice
#17 1.343 npm notice New major version of npm available! 10.8.2 -> 11.14.1
#17 1.343 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
#17 1.343 npm notice To update run: npm install -g npm@11.14.1
#17 1.343 npm notice
#17 1.343 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T10_50_39_613Z-debug-0.log
#17 ERROR: process "/bin/sh -c npm ci --ignore-scripts" did not complete successfully: exit code: 1
------
 > [frontend-build  4/13] RUN npm ci --ignore-scripts:
1.341 npm error
1.341 npm error aliases: clean-install, ic, install-clean, isntall-clean
1.341 npm error
1.341 npm error Run "npm help ci" for more info
1.343 npm notice
1.343 npm notice New major version of npm available! 10.8.2 -> 11.14.1
1.343 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
1.343 npm notice To update run: npm install -g npm@11.14.1
1.343 npm notice
1.343 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T10_50_39_613Z-debug-0.log
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

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/zfruj60mlq34bsmj577t610g6
Command failed: C:\Program Files\Docker\Docker\resources\bin\docker.exe build -f C:\Users\Junwei\Downloads\Hermes\Dockerfile -t hermes-autohermes-gate:local .
#0 building with "desktop-linux" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 1.12kB done
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/node:20-alpine
#2 DONE 0.3s

#3 [internal] load metadata for docker.io/library/eclipse-temurin:17-jre-alpine
#3 DONE 0.3s

#4 [internal] load metadata for docker.io/library/eclipse-temurin:17-jdk-alpine
#4 DONE 0.4s

#5 [internal] load .dockerignore
#5 transferring context: 656B done
#5 DONE 0.0s

#6 [frontend-build  1/13] FROM docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
#6 resolve docker.io/library/node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 0.1s done
#6 DONE 0.1s

#7 [backend-build 1/8] FROM docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246
#7 resolve docker.io/library/eclipse-temurin:17-jdk-alpine@sha256:5d14725f0e49e19df217f6ce179039f01ca25f5f9aa958573b467312599ca246 0.1s done
#7 DONE 0.1s

#8 [stage-2 1/3] FROM docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571
#8 resolve docker.io/library/eclipse-temurin:17-jre-alpine@sha256:b0ae54a36f82e04dc6c45e40ca5c55762e20b9a0858ee457faf557d440a9b571 0.1s done
#8 DONE 0.1s

#9 [internal] load build context
#9 transferring context: 66.42kB 0.5s done
#9 DONE 0.5s

#10 [backend-build 4/8] COPY backend/mvnw ./
#10 CACHED

#11 [backend-build 5/8] COPY backend/.mvn ./.mvn
#11 CACHED

#12 [backend-build 2/8] WORKDIR /backend
#12 CACHED

#13 [backend-build 3/8] COPY backend/pom.xml ./
#13 CACHED

#14 [backend-build 6/8] COPY backend/src ./src
#14 CACHED

#15 [frontend-build  2/13] WORKDIR /frontend
#15 CACHED

#16 [frontend-build  3/13] COPY frontend/package*.json ./
#16 CACHED

#17 [frontend-build  4/13] RUN npm ci --ignore-scripts
#17 1.341 npm error code EUSAGE
#17 1.341 npm error
#17 1.341 npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
#17 1.341 npm error
#17 1.341 npm error Missing: react-window@2.2.7 from lock file
#17 1.341 npm error
#17 1.341 npm error Clean install a project
#17 1.341 npm error
#17 1.341 npm error Usage:
#17 1.341 npm error npm ci
#17 1.341 npm error
#17 1.341 npm error Options:
#17 1.341 npm error [--install-strategy <hoisted|nested|shallow|linked>] [--legacy-bundling]
#17 1.341 npm error [--global-style] [--omit <dev|optional|peer> [--omit <dev|optional|peer> ...]]
#17 1.341 npm error [--include <prod|dev|optional|peer> [--include <prod|dev|optional|peer> ...]]
#17 1.341 npm error [--strict-peer-deps] [--foreground-scripts] [--ignore-scripts] [--no-audit]
#17 1.341 npm error [--no-bin-links] [--no-fund] [--dry-run]
#17 1.341 npm error [-w|--workspace <workspace-name> [-w|--workspace <workspace-name> ...]]
#17 1.341 npm error [-ws|--workspaces] [--include-workspace-root] [--install-links]
#17 1.341 npm error
#17 1.341 npm error aliases: clean-install, ic, install-clean, isntall-clean
#17 1.341 npm error
#17 1.341 npm error Run "npm help ci" for more info
#17 1.343 npm notice
#17 1.343 npm notice New major version of npm available! 10.8.2 -> 11.14.1
#17 1.343 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
#17 1.343 npm notice To update run: npm install -g npm@11.14.1
#17 1.343 npm notice
#17 1.343 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T10_50_39_613Z-debug-0.log
#17 ERROR: process "/bin/sh -c npm ci --ignore-scripts" did not complete successfully: exit code: 1
------
 > [frontend-build  4/13] RUN npm ci --ignore-scripts:
1.341 npm error
1.341 npm error aliases: clean-install, ic, install-clean, isntall-clean
1.341 npm error
1.341 npm error Run "npm help ci" for more info
1.343 npm notice
1.343 npm notice New major version of npm available! 10.8.2 -> 11.14.1
1.343 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
1.343 npm notice To update run: npm install -g npm@11.14.1
1.343 npm notice
1.343 npm error A complete log of this run can be found in: /root/.npm/_logs/2026-05-16T10_50_39_613Z-debug-0.log
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

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/zfruj60mlq34bsmj577t610g6
```
