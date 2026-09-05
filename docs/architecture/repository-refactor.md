# Repository Refactor Report

Implemented in the requested worktree on `codex/repository-architecture-refactor`.
No commit, push, database migration or deployment was performed. The original
attachment and the active-goal attachment were verified identical.

This report records the initial refactor. The subsequent web-only root layout and
iOS removal are documented in [repository-layout.md](repository-layout.md).

For PR #90, frontend design was checked against `origin/master` commit
`1cbf202ddaa97afccc3a68ecb8c149223542f5c4`: all 51 CSS files retain their rules,
public assets and localization remain unchanged, and active page markup is
preserved across route moves and component extraction. The only CSS-file diff is
a comment updating the tooling directory name. No frontend redesign is intended.

## Problems Found

The audit inventoried all 2,036 initially tracked files across application code,
tests, resources, tooling, CI, documentation, agent configuration and iOS.

- Most of the 385 backend Java files shared one package, mixing HTTP, business
  operations, repositories, entities, provider clients and infrastructure.
- Two admin bootstrap configurations registered the same conditional bean and
  implemented identical account initialization.
- Course-map collaborators depended on data types nested in their orchestration
  service, creating a service dependency cycle.
- Profile, race, shoe, wellness and tile controllers mixed substantial business,
  data access or provider work with HTTP handling.
- Dashboard mixed seven admin concerns; MuscleTraining retained four unreferenced
  legacy renderers. Shared cache and hook code had misleading ownership.
- Equivalent presentation and bounds helpers were duplicated. Source-inspection
  tests coupled assertions to old paths and, in one case, Windows line endings.
- Tracked generated frontend files formed an incomplete stale bundle. Architecture
  diagrams and developer instructions contained obsolete owners and commands.
- Some tooling tests wrote generated diagrams or coordination state into the real
  checkout instead of fixtures. Workflow-adapter documentation also had existing
  failing assertions.

## Before

```text
backend/src/main/java/com/hermes/backend/
  <358 root Java files: controllers, services, persistence, clients, configuration>
  auth/mfa/  billing/  rewards/
backend/src/test/java/com/hermes/backend/
  <mostly flat tests>
frontend/src/
  pages/       # route entry points plus large mixed implementations
  components/  # shared UI plus unused legacy components
  utils/       # utilities, a React hook and unused route/mask implementations
backend/src/main/resources/static/
  <nine tracked generated files, including an incomplete old bundle>
```

## After

```text
backend/src/main/java/com/hermes/backend/
  BackendApplication.java
  StartupPhaseDiagnosticsLogger.java
  activity/  admin/  auth/mfa/  billing/  coaching/  imports/
  races/model/  rewards/  routing/  runner/  shoes/  strength/  weather/
  infrastructure/{bootstrap,cache,config,diagnostics,mail,web}/
backend/src/test/java/com/hermes/backend/
  <matching domain packages; whole-application tests at the root>
frontend/src/
  App.jsx, main.jsx, api.ts
  pages/
    Dashboard.jsx
    admin/     # four section views, shared rows, navigation and domain models
    <existing route entry points>
  components/  hooks/  api/  contracts/  contexts/  i18n/  data/  styles/
  utils/{coach,races,heatmap}/
tools/
  check-architecture.mjs
  run-tool-tests.mjs
  run-backend-tests.mjs
  test-support/
  <existing operational entry points>
docs/architecture/
  backend-package-migration.md
  backend-package-moves.json
  repository-refactor.md
```

Frontend implementations remain colocated with their route domain; reusable
behavior stays in hooks and domain utilities. This avoids a parallel ownership
hierarchy. The [backend guide](backend-package-migration.md) and
[project map](../PROJECT_MAP.md) describe where new endpoints, services, queries,
models, integration clients and security logic belong.

## Major Changes

- Moved **355 production Java files and 167 test files** into owning packages.
  The [move record](backend-package-moves.json) includes exact source/destination
  mappings and reasons, including the initial ten-file mail migration.
- Kept the canonical admin bootstrap configuration and removed its duplicate.
  Added configuration/account-preservation tests.
- Extracted seven course-map contracts into `races/model`, eliminating the
  orchestration dependency cycle. Shared types no longer depend on their callers.
- Extracted profile application/heatmap/avatar services, race management, shoe
  inventory, wellness preferences and map-tile delivery. OAuth HTTP exchanges now
  have an explicit provider client. HTTP validation, status codes and response
  construction remain at the edge.
- ProfileController is about 270 lines rather than 1,200; RaceController about 360
  rather than 630; MapTileController about 90 rather than 360. Existing algorithms,
  cache identifiers, limits, image processing and error boundaries were retained.
- Dashboard fell from about 6,300 to 3,900 lines. Four JSX sections, rows and domain
  models were extracted; all 598 existing inspected assertions and the page's
  pre-render orchestration were preserved.
- Removed 1,303 unused lines from MuscleTraining. All 78 surviving bindings,
  including the active component, retained identical source. Test-referenced
  exercise data remains.
- Consolidated equivalent coach presentation and bounds helpers. Moved the shared
  heatmap cache out of pages and the long-press hook out of utilities.
- Removed unused TopNav, LanguageSwitcher, NodePalette, scheduleRoute and legacy
  muscle-mask data. Updated the diagrams that were the mask data's only remaining
  references. Removed the empty workflow-component directory.
- Removed nine generated frontend files from Git tracking. The current build
  remains locally available; the frontend publisher recreates it. Git and Docker
  now exclude local generated static output, while Docker copies its own fresh
  frontend-stage output.
- Removed 131 unused/redundant Java imports and organized import headers with a
  class-body equality check. That cleanup pass did not change class bodies.
- Added portable root verification commands and an executable architecture guard.
  Fixed fixture isolation in tooling tests, updated actual-owner test readers,
  and corrected stale documentation. No libraries or frameworks were added.

## Verification

| Check | Result |
| --- | --- |
| Backend `mvnw -B test package` | **1,351 tests; 0 failures; 0 errors; 1 existing skip. JAR built.** |
| Frontend `npm test` | **Typecheck passed; 80 Vitest tests and 330 Node contracts passed.** |
| Frontend lint | **0 errors; 2 pre-existing I18nContext dependency warnings.** |
| Production Vite build | **Passed. Five entry assets resolved; none missing.** |
| Packaged application | **Required application/service/static entries present; no public source maps.** |
| Architecture source + compiled `jdeps` | **0 violations; 409 Java files, 157 frontend modules, 686 class files checked.** |
| Compiled cycles | **Only the unchanged Activity/ActivityPoint/mapped-superclass JPA association. No service cycle.** |
| HTTP/persistence comparison | **641 route/parameter annotations across 36 controllers and 36 persistence definitions unchanged.** |
| Migration reference audit | **355/355 moves present; no old active literal/escaped-path references found.** |
| Translation parity | **4,770 keys per locale; no gaps or undefined JSX keys.** |
| Functionality direction tree | **19 features and 7 shared concerns valid.** |
| AI context discipline | **Passed; approximately 3,493/5,500 bootstrap tokens.** |
| iOS | **Existing scaffold validation passed; native source unchanged.** |
| Tooling suite | **25/26 test files passed. Remaining file has the same three pre-existing adapter assertions below.** |
| Hygiene | **Whitespace check passed; no introduced credential signatures found in added diff lines.** |

The tooling runner includes the new architecture and runner fixture tests.
Architecture-diagram, static-publisher, SEO and deployment-contract checks passed.
New H2/HTTP tests cover shoe transaction and error compatibility. Read-only review
found no actionable regressions in the race and OAuth extractions.

Verification logs and comparison reports remain in ignored `.workspace/tmp/refactor/` and
`backend/target/`. The packaged application is
`backend/target/backend-0.0.1-SNAPSHOT.jar`.

## Preserved Behavior and Limits

The initial baseline already failed workflow documentation assertions for missing
trace/Docker references in generated adapters and the OpenCode self-command's
runtime instructions. These **three assertions remain failing** in
`tools/auto-hermes-tools.test.mjs`. They were not suppressed or rewritten to hide
failure; changing those runtime-specific workflow contracts is separate from this
application-preserving refactor. The old Docker-version assertion was corrected
against the unchanged canonical Dockerfile, with stronger stage/order/runtime checks.

The existing shoe merge can commit earlier target changes before returning 404 for
a later missing target. This defect was discovered during review and deliberately
preserved, including transaction and unexpected-exception behavior, to honor the
requested database compatibility. An atomicity fix requires a separate behavior
change; the new real H2/HTTP tests characterize the legacy behavior.

Frozen reference CSS, public filename aliases and historical records were retained
where they have a verified purpose. Environment-variable
names/defaults/precedence, database mappings, URLs, security controls, copy and
styles were not changed to simplify the architecture.

Machine-local runtime-sync helpers are absent. Build/packaging evidence is not a running-site
check: **source changed, live website not synced yet**.

## Artifact Cleanup Follow-Up

On 2026-09-04, removed 1,022 disposable files (approximately 19.6 MiB) from this
worktree: generated `backend/course-map-images/` contents, `.tmp/` build staging,
`.workspace/tmp/refactor/route-structure-before/`, per-domain scratch move lists, ten completed
migration scripts, and 334 stale Surefire reports for test classes moved to domain
packages. Final refactor logs, current test reports, dependencies, built application
output, asset-retention metadata and workflow configuration remain intact.

The tracked Boston route fixture was moved unchanged to
`backend/src/test/resources/course-maps/boston-marathon-successful-route.json`.
Its tests now load it from the classpath. Course-map service tests write into
JUnit temporary directories instead of polluting runtime storage. Git/Docker
ignore rules exclude runtime upload directories. No production storage default or
upload behavior changed; real uploads can recreate `course-map-images/`.

Verification: all 187 course-map tests across 12 current suites pass with zero
failures/errors/skips, and the deleted upload directory stays absent afterward.
Architecture, functionality-direction-tree and static-publisher checks also pass.
The source-comparison snapshots/scripts were intentionally removed after their
results were recorded; the retained JSON reports are historical verification,
not rerunnable comparison programs. No running-site verification was performed.
