---
name: auto-hermes-max
description: Parallel multi-lane workflow — decomposes one task into disjoint frontend / backend / test lanes, runs them in parallel, then merges. The coordinator never writes code itself.
---

# Hermes Parallel Max Workflow

`/auto-hermes-max` is a launcher and merger. It decomposes, plans, launches lanes, merges, reassesses. It never writes code, picks tasks, or asks the user. All implementation happens inside lane agents.

## Shared Trace-To-Skill Signal

Read `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md` or `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json` before routing lanes. Treat this evidence as a `soft-signal` for workflow/process evolution only; it can guide lane shape and review emphasis, but it is not a hard blocker for ordinary product work.

## MANDATORY: Coordinator Action Sequence

Execute in order. Calling `Agent` in step 4 is the actual launch — skipping it means `/auto-hermes-max` did not run.

**0. Mode check + concurrent scan.**
- Arguments → Concrete Scope. No arguments → Explorer Mode (launch `planning-agent`, wait for report).
- Run `git log --oneline -10`, read `.ai-sync/AGENT_SYNC.md`. Exclude surfaces claimed by other agents. Absorb recent external changes.
- If frontend lanes: bootstrap `bh` daemon (skip if unavailable).
- If multiple frontend/browser lanes are active, read `C:\tmp\browser-harness-sessions.json` before launch. A lane must not take over another lane's page/session; if the target page is already owned or likely in use, open and claim a separate tab with `new_tab(targetUrl)` or a distinct `BU_NAME`.
- If frontend lanes or website-audit fallback are in scope, load `.tools/auto-hermes-skills.mjs --json` and apply `web-quality-audit` from `https://officialskills.sh/addyosmani/skills/web-quality-audit` (GitHub: `https://github.com/addyosmani/web-quality-skills/tree/main/skills/web-quality-audit`) before accepting browser-visible quality findings.

**1. Decompose into lanes.** Classify each sub-item `frontend-only` / `backend-only` / `cross-stack`. Must spawn matching agent types. Cross-stack → sequential pair or separate lanes with `dependsOn`. Apply lane count decision table from Dynamic Reassessment. Single lane: still run full ceremony. Wave model: lanes sharing contract files (translations, pom.xml) run in different waves.

**2. Write plan** to `.ai-sync/AUTO_HERMES_MAX_PLAN.json`:
```json
{"parentGoal":"...","preserve":[],"laneSelection":{"strategy":"auto","laneCount":N},"lanes":[{"laneId":"...","goal":"...","ownedFiles":[],"effort":"medium","parallelSafe":true,"dependsOn":[],"dependencyMode":"parallel-ready"}]}
```
`parallelSafe`=false for shared-contract writes. `dependsOn`=laneIds that must finish first.

**3. Generate lane briefs:** `node .tools/auto-hermes-max.mjs --write --runtime claude --scope "<parent goal>"`

**4. Launch wave-1 lanes.** Call `Agent` ONCE PER LANE in a SINGLE message with parallel blocks. Wave-1 = `parallelSafe: true` AND `dependsOn: []` AND no `ownedFiles` collision. Prompt: `"Lane <id>: <goal>. Owned files: <list>. Read brief at .ai-sync/auto-hermes-max-lanes/<laneId>.md. Follow Lane Agent Contract. <2-3 sentence design notes if needed>."` Agent types: `frontend-agent` (UI), `backend-agent` (services/schemas), `planning-agent` (Explorer), `reviewer-agent` (regression), `debugger` (diagnosis). Lanes default to main tree, never write TASKS.md/CONTEXT_LEDGER.md, use bash commands (`node` from PATH, forward slashes).

Browser lane prompt addendum: "For browser proof, check `C:\tmp\browser-harness-sessions.json` and current page state first. If another agent owns or appears to use the target page, do not take over that page; open a separate tab with `new_tab(targetUrl)` or use a distinct `BU_NAME`, then record your tab/session label in the result packet. Alternative: if the target page is auth-walled or the user is using Chrome for other work, use the Microsoft Playwright wrapper `.tools/auto-hermes-playwright.mjs` (`goto` / `eval` / `screenshot` / `status` / `reset` / `doctor`) — it drives a managed headless Chromium with a persistent context at `.ai-sync/playwright-state/<state>/`, so signing in once with `--headed` makes every later round reuse that login. Use a distinct `--state <name>` per lane when lanes need disjoint sessions."

**5. Wait for wave 1, verify, commit.** Do not poll or read transcript files. For approved lanes: run `lint` + `mvnw compile`, create `wip: auto-hermes-max wave 1 (<ids>)` commit.

**6. Launch wave 2.** Deferred lanes whose `dependsOn` are satisfied and `ownedFiles` no longer collide. Before each wave, re-read AGENT_SYNC.md — drop lanes overlapping new active claims. Repeat until all report or remaining are deadlocked (mark `blocked: shared-contract-deadlock`, write to TASKS.md).

**7. Run merge gate:** `node .tools/auto-hermes-max-merge.mjs --write`. Verdicts: `approve-merge` → proceed. `arbitration-required` → record decisions, rerun. `must-fix-before-merge-complete` → discard must-fix lane changes, write issues to TASKS.md Active Tasks, rerun with remaining approved.

**8. Coordinator-drift gate:** `node .tools/check-coordinator-drift.mjs` — exit 0 required. Product files dirty but not claimed by any lane → revert or update lane packet. Never paper over drift.

**9. Post-merge writeback:**
- Runtime proof: frontend → `run-vite-build.mjs` + `verify-frontend-runtime-sync.mjs`; backend → `mvnw compile` + `verify-backend-runtime-sync.mjs`. CSS touched → `check-design-tokens.mjs` (exit 0). JSX/translations touched → `check-translations.mjs` (exit 0 for touched namespaces). Non-PASS → downgrade to `merged-source-only`, write must-fix.
- Frontend/browser-visible merge proof should include `web-quality-audit` when applicable: performance, accessibility, SEO, best practices, browser proof, console state, and Lighthouse-style observations. This is advisory; Hermes build/runtime gates remain authoritative.
- Update `.ai-sync/CONTEXT_LEDGER.md` (one capsule per touched surface).
- Update `TASKS.md` (remove completed, append follow-ups from `mergeNotes`/`risks`).
- Final commit: per CLAUDE.md checklist. Squash wave commits. Stage only product files.

**10. Dynamic Reassessment → next iteration.** Apply lane count rules. Continue until stop condition.

**Stop conditions:** 0 promotable items AND Explorer finds nothing; unresolvable blocker; `.ai-sync/HUMAN_LOOP.md` says `pause`/`stop`/`must-ask`; Max Runaway Guard fires (counter ≥ 3).

Silent during execution. Speak only on clean stop, blocker, Runaway Guard, or HUMAN_LOOP pause.

### Failure Modes

1. **Launcher output is NOT launch.** Launcher prints "Selected Lane Count: N" but only `Agent` tool calls start subagents. If you don't call `Agent`, no work happens.
2. **Diagnosis-only must-fix.** Lane returns `status: must-fix` with `changedFiles: []` and a fix description → dispatch a FRESH implementation lane with the fix as scope. Coordinator MUST NOT apply the fix itself. Drift gate at step 8 catches this.

---

## Explorer Mode (no arguments)

Launch `planning-agent` as Explorer. Before reading TASKS.md, refresh context:
```
node .tools/generate-codex.js
node .tools/optimize-agent-context.mjs --agent claude --tasks TASKS.md --guide AGENTS.md --queue-mode first --write
node .tools/auto-hermes-issues.mjs --task-format --decompose
```

Explorer reads: `AGENTS.md`, `.ai-codex/optimized-claude.md` (primary), `PRODUCT.md`, `.ai-sync/CONTEXT_LEDGER.md`, `.ai-codex/pages.md`, `.ai-codex/routes.md`. Then: (1) identify highest-value task (Tier 1 > Tier 2), (2) execute ONE `/auto-hermes` loop round, (3) write Explorer Report to `.ai-sync/AUTO_HERMES_MAX_EXPLORER.json` + `.md` with fields: `completedTask`, `changedFiles`, `verification`, `remainingWork[]`, `parallelismRecommendation{suggestedLanes, rationale, proposedScopes[]}`.

Coordinator validates disjointness, decides final lane count. `suggestedLanes === 0` → increment Max Runaway counter. `suggestedLanes === 1` → single-lane path.

---

## Dynamic Lane Reassessment

After every iteration, read result packets (`completedRounds`, `mergeNotes`, `risks`, `changedFiles`) and apply:

| Condition | Decision |
|---|---|
| 2+ independent surfaces, disjoint `ownedFiles` | Launch `min(surfaces, 5)` lanes |
| Sequential (B depends on A) | 1 lane now; queue follower |
| Single bounded fix | 1 lane |
| Unknown or thin | Re-launch Explorer |
| No promotable work | Increment Max Runaway counter; consult guard |

---

## Lane Agent Contract

Each lane runs `/auto-hermes` self-loop within owned files only. Never write outside `ownedFiles`. Never write TASKS.md or CONTEXT_LEDGER.md — put follow-ups in result packet `mergeNotes`/`risks` (`context-ledger:` prefix for capsules). Never update `.ai-sync/RUNAWAY_COUNTER.json` — use lane-local `laneRunawayCount`.

**Verification (mandatory before `status: approved`):** Run the standard gates from CLAUDE.md (lint, build, translations, design-tokens, runtime-sync, browser visual). CSS: read `:root` tokens first, reuse existing class prefixes, mode parity required. All commands in bash.

**Result packet:** Write to `.ai-sync/auto-hermes-max-results/<laneId>.json`. Fields: `laneId`, `parentRunId`, `correlationId`, `goal`, `ownedFiles`, `changedFiles`, `completedRounds`, `verification`, `runtimeProof`, `architectVerdict`, `deslopPass`, `regressionPass`, `risks`, `mustPreserve`, `mergeNotes`, `status`, `worktreePath`. Status: `approved` | `must-fix` | `blocked`.

---

## Merge Arbitration

Autonomous decisions for every conflict:

| Decision | When |
|---|---|
| `accept-as-is` | Changed regions don't overlap |
| `accept-lane-<id>` | One passes verification, other doesn't; or both pass but one is strict superset |
| `synthesize` | Both changed different parts, both independently correct |
| `discard-all` | Cannot safely resolve — revert, write follow-up task |

Record `coordinatorDecision` + `coordinatorRationale` for each. Rerun merge gate.

---

## Max Runaway Guard

Counter at `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json` (`{"count":N}`). Start at 0.

- Explorer `suggestedLanes === 0` → +1. Post-merge completes → reset to 0. Blocker → reset to 0.
- `count ≥ 3` → fire: write handoff checkpoint, stop. "Explorer returned 0 for 3 consecutive reassessments."

Distinct from inner `/auto-hermes` Runaway Guard.
