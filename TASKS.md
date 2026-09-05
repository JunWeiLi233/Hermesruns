# Hermes Tasks

Use this file as the working queue for AI agents.

**Before choosing any task, read `PRODUCT.md` and ask:**
1. Does this serve The Competitor, The Builder, or The Enthusiast runner persona?
2. Does this move a screen closer to its Product Intent (see `PRODUCT.md` Screen table)?
3. Is this Tier 1 (Daily Coach Value) or Tier 2 (Data Trust) priority? If not, is there a Tier 1/2 gap that should be addressed first?

## Rules
- Keep tasks in priority order, top to bottom.
- Unless explicitly told otherwise, work through `## Active Tasks` first.
- Each checkbox is a separate required deliverable.
- Treat `Files:`, `Context:`, `Done when:`, `Verify:`, `Note:`, and `Blocker:` as hard execution hints.
- After completing a task, add a short `Note:` line, then delete the entire completed task block from `## Active Tasks` and append one short line to `## Daily Log`.

## Daily Log
- 2026-09-04: Removed four unused/duplicate frontend files and the broken Codex npm shortcut; reused byte-identical prediction hero assets and corrected asset-removal test paths. Kept active dependencies, public icon aliases, CSS/test resources and build-retention metadata. Typecheck, 80 unit tests, 330 contracts, lint, architecture and production build pass.
- 2026-09-04: Removed the two sample shoe HTML fixtures, their tools/fixtures directory and fixture-only import manifest. Retained the real importer with user-supplied-config documentation; layout, importer syntax/help and direction-tree checks pass. Backend test resources and test-support helpers remain intact.
- 2026-09-04: Audited tools for duplicates and consumers; removed the deprecated CSS alias, two one-off browser probes and unused empty config-history placeholder. Kept live routing/human-loop configuration and integrations. All 330 contracts pass; tooling remains 26/27 with the same three pre-existing adapter assertions, and lint has no errors.
- 2026-09-04: Audited root files; deleted the legacy stop batch file, redundant local-start wrapper and stale April ticket, and moved the domain glossary under docs. Updated stop-command references and added root-file guards; layout, startup, deployment, context and integration-config checks pass.
- 2026-09-04: Removed the unrelated iOS project; grouped repository tools under `tools/` and state/cache/scratch output under `.workspace/`. Preserved all integrations at discovery paths, hidden from normal Explorer navigation, and added the app-first `Hermes.code-workspace`. Frontend 80 unit/330 contract tests, 10 targeted backend tests, build and layout checks pass; three existing workflow assertions remain.
- 2026-09-04: Removed generated course-map output, Vite staging, completed migration scratch files and obsolete pre-move test reports. Preserved the Boston fixture under test resources; 187 course-map tests pass without recreating the deleted upload folder.
- 2026-09-04: Completed the user-requested repository architecture refactor; domain packages, service/UI extraction, cleanup and verification are recorded in `docs/architecture/repository-refactor.md`, including retained compatibility issues.
- 2026-09-04: Grouped frontend routes into 17 human-readable feature directories with colocated tests, a URL-to-owner guide and feature-scoped test commands; typecheck, 80 unit tests, 330 contracts, lint and build pass. See `docs/architecture/frontend-route-structure.md`.

## Active Tasks
- [x] Improve Analysis page
  Files: `frontend/src/pages/analysis/Analysis.jsx`
  Problem: frontend-design
  Owner: frontend-agent
  Context: Pages index resolves Analysis to an existing frontend page (Quality Score: 1400).
  Done when: the website-audit fallback candidate is investigated and the bounded surface issue is resolved with targeted verification.
  Verify: cd frontend && npm run lint && npm run build
  Surface: Analysis
  Website Audit: fallback-selected
  Website Audit Summary: Controller reported no promotable work; website audit selected Analysis as the bounded fallback candidate (frontend/src/pages/analysis/Analysis.jsx).
  Result: Integrated the existing heat-adaptation context into Analysis with six live engine metrics, historical per-run correction coverage, an exposure-day track, bilingual interpretation, and responsive/dark presentation without changing VDOT, zone, or prediction methodology.
  Verified: focused heat-adaptation, VDOT, and Weather smoke tests; frontend lint; production Vite build/static sync; authenticated desktop and mobile browser checks with no horizontal overflow or console errors.

## Tech Debt Tasks

### Territory Map Debt
### Backend Debt
