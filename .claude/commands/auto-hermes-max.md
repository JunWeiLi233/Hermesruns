---
name: auto-hermes-max
---

# Hermes Parallel Max Workflow

`/auto-hermes-max` is a **launcher and merger**. It does not implement work. It does not pick tasks. It does not write code.

Its only job:
1. Determine what work exists and how many parallel lanes it warrants
2. Launch 1–5 `/auto-hermes` agents, each owning a disjoint scope
3. Wait for all agents to finish
4. Merge their results through an arbitration gate
5. **Re-assess lane count** based on what was just discovered, then repeat

All implementation, task selection, promotion, and product decisions happen inside the `/auto-hermes` agents — not in this coordinator.

---

## Mode Switch — Check Arguments First

### Concrete Scope Mode (arguments provided)
When `/auto-hermes-max` is called with a scope or task description:
- Use that scope directly as the parent goal for this iteration
- Skip the Explorer step — go straight to Lane Planning
- After this iteration's merge gate clears, switch to Dynamic Reassessment for subsequent iterations

### Explorer Mode (no arguments)
When `/auto-hermes-max` is called with no arguments:
- The queue may be empty, thin, or unknown — do not guess
- Launch one Explorer Agent to discover work and run the first round
- After the Explorer reports back, the coordinator reads the Parallelism Recommendation and decides lane count for the next round
- From that point on, use Dynamic Reassessment after every round

---

## Explorer Mode — First Round

When there are no arguments, the coordinator launches a **single `planning-agent` as the Explorer** before any parallel work begins.

### Explorer Agent job
Before reading `TASKS.md` directly, refresh and read the cached optimized context first:
```
node .tools/generate-codex.js
node .tools/optimize-agent-context.mjs --agent claude --tasks TASKS.md --guide AGENTS.md --queue-mode first --write
powershell -ExecutionPolicy Bypass -File .tools/mempalace/auto-session-sync.ps1 -Quiet
node .tools/omx-auto-hermes-bridge.mjs
```
Then read `.ai-codex/optimized-claude.md` for queue status. Fall back to `TASKS.md` only if the regeneration fails.

The Explorer then reads:
- `AGENTS.md` — policy plane and top-level owner map
- `docs/auto-hermes/index.md` — stable `/auto-hermes` record-system map when present
- `.ai-codex/optimized-claude.md` — queue status snapshot (primary)
- `TASKS.md` — only if optimization fails or a fresh write just happened
- `PRODUCT.md` — personas, tiers, product intent per screen
- `.ai-sync/CONTEXT_LEDGER.md` — what was recently done on each surface
- `.ai-codex/pages.md`, `.ai-codex/routes.md` — current codebase structure

Record-system posture:
- treat `AGENTS.md` as the policy plane and `docs/auto-hermes/index.md` as the stable record-system map
- use progressive disclosure from those files instead of broad workflow rescans unless the parent round actually needs deeper owners

The Explorer then:
1. Identifies the single highest-value task not recently completed (Tier 1 before Tier 2, concrete and bounded)
2. Executes **one `/auto-hermes` loop round** on that task (full PM → Builder → Customer → Reviewer cycle)
3. After that round completes and is verified, writes an **Explorer Report** to *both* `.ai-sync/AUTO_HERMES_MAX_EXPLORER.json` (machine-readable, fields below) and `.ai-sync/AUTO_HERMES_MAX_EXPLORER.md` (short human-readable summary — one paragraph per section: completedTask, remainingWork, parallelismRecommendation). The `.md` pair matches every other `.ai-sync/AUTO_HERMES_MAX_*` artifact and lets the coordinator resume without re-parsing JSON:

```json
{
  "completedTask": "...",
  "changedFiles": [],
  "verification": "...",
  "remainingWork": [
    { "description": "...", "surface": "...", "estimatedScope": "frontend|backend|cross-stack", "effort": "small|medium|large" }
  ],
  "parallelismRecommendation": {
    "suggestedLanes": 2,
    "rationale": "...",
    "proposedScopes": [
      { "goal": "...", "surface": "...", "ownedFiles": [] }
    ]
  }
}
```

### Coordinator reads the Explorer Report
After the Explorer writes its report, the coordinator:
1. Reads `.ai-sync/AUTO_HERMES_MAX_EXPLORER.json`
2. Validates the proposed scopes are provably disjoint
3. Decides the final lane count for the next round (may differ from `suggestedLanes` if scopes aren't disjoint or effort is too thin)
4. Proceeds to Lane Planning with that count

**If `parallelismRecommendation.suggestedLanes === 0`** — the Explorer found no further promotable work. Increment the Max Runaway counter (see Max Runaway Guard below) and either:
- re-launch the Explorer if the counter is still below threshold (work may have just been completed and a reassessment is cheap), OR
- if the counter has reached threshold, stop cleanly with "explorer found 0 remaining promotable work; auto-hermes-max exhausted."

**If `remainingWork` is non-empty but `suggestedLanes === 1`** — go directly to the single-lane path in Step 1, no launcher needed.

---

## Dynamic Lane Reassessment

**After every completed iteration** (whether from Explorer or from a parallel round), the coordinator reassesses how many lanes the next round needs. The lane count is never fixed — it adapts based on what was just discovered.

### Reassessment inputs
Read from the just-completed lane result packets:
- `completedRounds` — what was actually done
- `mergeNotes` — what follow-up work the lanes identified
- `risks` — dependency chains or blockers the lanes flagged
- `changedFiles` — which surfaces were touched

### Lane count decision rules (apply in order)

| Condition | Decision |
|---|---|
| Follow-up work spans 2+ independent surfaces with provably disjoint `ownedFiles` | Launch `min(surfaces, 5)` parallel lanes |
| Follow-up work is sequential (B depends on A's output) | Launch 1 lane now; queue the follower for next iteration |
| Follow-up work is a single bounded fix | Launch 1 lane |
| Remaining work is unknown or thin | Launch 1 Explorer Agent to reassess — subject to Max Runaway Guard |
| No remaining promotable work | Increment Max Runaway counter, then consult guard (stop only when counter reaches threshold) |

### Re-launching the Explorer
If the coordinator cannot confidently split remaining work into disjoint scopes after reading the result packets, it re-launches the Explorer Agent (same contract as Explorer Mode above) instead of guessing at lane boundaries. The Explorer runs one round and reports back, then the coordinator reassesses again. Explorer re-launch is still subject to the Max Runaway Guard — if the counter reaches 3, the coordinator stops rather than re-launching a fourth Explorer in a row.

---

## Coordinator Role — What the Coordinator Does and Does Not Do

### The coordinator DOES:
- Launch the Explorer Agent when no concrete scope is provided
- Read Explorer Reports and lane result packets to decide next lane count
- Split the parent goal into scopes with disjoint file ownership
- Write the plan JSON to `.ai-sync/AUTO_HERMES_MAX_PLAN.json`
- Run the launcher script to generate lane briefs
- Launch the `/auto-hermes` lane agents in parallel
- Wait for all lane result packets to be written
- Run the merge gate script
- Make autonomous arbitration decisions for every conflict
- Update `TASKS.md` and `.ai-sync/CONTEXT_LEDGER.md` after a clean merge
- Reassess lane count after every iteration and continue

### The coordinator does NOT:
- Write application code
- Pick individual tasks for lanes (that is the `/auto-hermes` agent's job)
- Make product decisions within a lane's scope (that is the `/auto-hermes` agent's job)
- Implement fixes for merge conflicts (use `discard-all` + follow-up task instead)
- Ask the user to pick anything — all decisions are made autonomously

---

## Execution Steps (Per Iteration)

### Step 0 — Mode check + concurrent agent scan (first iteration only)
- **Arguments provided** → use the provided scope as the parent goal; go to Step 1 to split it into lanes
- **No arguments** → launch Explorer Agent (see Explorer Mode above), wait for Explorer Report, then go to Step 1 using the Explorer's recommended scopes

**Concurrent agent scan (always, before Step 1):**
Before assigning any lanes, run `git log --oneline -10` and read `.ai-sync/AGENT_SYNC.md`:
- For each surface in `## Active Claims` owned by another agent: exclude that surface's files from all lane scopes this iteration. Do not compete with an active claim.
- For each entry in `## Recently Completed` from the past 30 minutes: note the `changedFiles`. If a proposed lane's scope overlaps those files, read them before writing the lane brief so the lane starts from the current state, not a stale snapshot.
- This scan does not stop the loop. It narrows scope and absorbs external state.

### Step 1 — Split scope into lanes and determine lane count
Using either the provided scope or the Explorer/Reassessment recommendation:
- Divide the parent goal into disjoint ownership scopes (each scope names specific files/modules, no overlap)
- Apply the lane count decision rules from Dynamic Reassessment
- **If lane count = 1**: launch a single `/auto-hermes` agent for that scope, wait for it to finish, go directly to **Step 7** (no merge gate needed for a single lane — just update TASKS.md and CONTEXT_LEDGER, then reassess). A single lane does not require worktree isolation; it writes to the main tree directly.
- **If Explorer found 0 promotable work**: increment the Max Runaway counter; if counter ≥ 3, go to **Stop** — report "no promotable work found for 3 consecutive reassessments; auto-hermes-max exhausted." If counter < 3, defer and re-launch the Explorer in the next iteration.
- **If lane count ≥ 2**: continue to Step 2 (all launched lanes must use `isolation: "worktree"`)

### Step 2 — Write the plan
Serialize to `.ai-sync/AUTO_HERMES_MAX_PLAN.json` before running the launcher:
```json
{
  "parentGoal": "...",
  "preserve": [],
  "laneSelection": { "strategy": "auto", "laneCount": N },
  "lanes": [{
    "laneId": "...",
    "goal": "...",
    "ownedFiles": [],
    "effort": "medium",
    "parallelSafe": true,
    "dependsOn": [],
    "dependencyMode": "parallel-ready"
  }]
}
```

**Lane dependency fields** (consumed by `.tools/auto-hermes-max.mjs`):
- `parallelSafe` — `true` if the lane can run concurrently with other `parallelSafe` lanes; `false` forces the launcher to defer it. Use `false` for lanes with shared-contract writes (e.g., `translations.js`, `pom.xml`, `App.jsx`) unless another lane is guaranteed not to touch them this round.
- `dependsOn` — array of `laneId`s that must complete first. Non-empty values turn the lane into `sequential-after:<laneId>` in the launcher brief.
- `dependencyMode` — `parallel-ready` (default), `sequential-after-deps` (has `dependsOn`), or `blocked-by-plan` (explicitly deferred by the coordinator this round).

Omitting these fields defaults the launcher to `parallelSafe: true`, `dependsOn: []`, `dependencyMode: "parallel-ready"`, but omission is discouraged — declare them explicitly so the launch decision card is auditable.

### Step 3 — Generate lane briefs
```
node .tools/auto-hermes-max.mjs --write --runtime claude --scope "<parent goal>"
```
Produces: `.ai-sync/AUTO_HERMES_MAX_COORDINATOR.{json,md}`, `.ai-sync/auto-hermes-max-lanes/*.md`, `.ai-sync/auto-hermes-max-results/`, `.ai-sync/AUTO_HERMES_MAX_MERGE.{json,md}`

### Step 4 — Launch lanes in parallel
Each lane is a `/auto-hermes` agent scoped to its owned files:
- **Isolation requirement (Claude Code)**: when `laneCount ≥ 2`, every lane MUST be launched with `isolation: "worktree"` so parallel edits never race on the shared tree. A lane launched without worktree isolation must be serialized — the coordinator either runs it alone or refuses to start the parallel round.
- Runs the full `/auto-hermes` self-loop within its owned scope
- Stops when its owned scope has no more promotable work
- Writes a result packet to its `resultFile` when done
- Never touches another lane's files
- **Lanes do not write `TASKS.md` or `.ai-sync/CONTEXT_LEDGER.md`** during their loop. Queue promotion, follow-up writes, and CONTEXT_LEDGER updates are deferred to the coordinator in Step 7. Lanes record follow-ups and debt in their result packet's `mergeNotes` and `risks` fields instead — the coordinator merges them into `TASKS.md` after the merge gate clears.

### Step 5 — Wait for all lanes
Do not proceed until all launched lanes have written their result packets.

### Step 6 — Run the merge gate
```
node .tools/auto-hermes-max-merge.mjs --write
```
Make autonomous arbitration decisions for every detected conflict (see Arbitration below). Rerun after all decisions are recorded to confirm `approve-merge`.

**Handling gate verdicts:**
- `approve-merge` → proceed to Step 7
- `arbitration-required-before-merge` → record coordinator decisions for all pending conflicts, rerun gate
- `must-fix-before-merge-complete` → for each must-fix lane: discard that lane's changes, write its unresolved issues as new tasks in `## Active Tasks`, then rerun the gate with the remaining approved lanes; if no approved lanes remain, go to Step 8 (Dynamic Reassessment)

**`must-fix` lane handling:** A lane with status `must-fix` or `blocked` is excluded from the merge. Its `changedFiles` changes are not applied. Its unresolved issues from `mergeNotes` and `risks` are written as concrete tasks to `## Active Tasks` so they are not lost.

### Step 7 — Post-merge update
After `approve-merge`, the coordinator performs these in order (all coordinator-owned — lanes are already done):
1. **Integrate lane changes**: if lanes ran in isolated worktrees, fast-forward or cherry-pick their commits into the primary working tree. Resolve any unexpected merge conflict via the Arbitration rules (never silently overwrite).
2. **Post-merge runtime proof gate** — for each runtime-facing surface touched by any merged lane:
   - Frontend surfaces: `& 'C:\Program Files\nodejs\node.exe' frontend\scripts\run-vite-build.mjs` then `node .tools/verify-frontend-runtime-sync.mjs --files "<merged files joined with ||>"`.
   - Backend surfaces: `node .tools/verify-backend-runtime-sync.mjs --files "<merged files joined with ||>"`.
   - If any proof gate returns non-PASS, downgrade the merge verdict from `verified` to `merged-source-only`, write a must-fix task for the failing surface, and do not claim the live site changed.
3. **Update `.ai-sync/CONTEXT_LEDGER.md`** for every touched surface — one short capsule per surface (coordinator is the single writer during `/auto-hermes-max`; lanes did not write this file).
4. **Update `TASKS.md`** — remove completed tasks, append follow-ups from each lane's `mergeNotes`, add must-fix tasks for excluded/blocked lanes and any post-merge proof failures. TASKS.md is serialized to the coordinator so there is no race.
5. **Run the auto-commit finish action** per the commit gates in `CLAUDE.md`.

### Step 8 — Dynamic Reassessment → next iteration
Read all lane result packets (and the Explorer Report if one was written this iteration). Apply the lane count decision rules. Go back to Step 1 with the new count. Continue until a stop condition fires.

---

## Lane Agent Contract

Each `/auto-hermes` lane agent must:
- Run the `/auto-hermes` self-loop within its owned scope (not a single round)
- Check scope before every task selection — only pick tasks that touch owned files
- Never edit a file outside its declared `ownedFiles`
- **Apply the Concurrent Agent Resilience rules** from `.claude/commands/auto-hermes.md` for every file it writes — if a file changed externally since the lane last read it, re-read and synthesize rather than overwrite. Record absorptions in `mergeNotes` with an `absorbed:` prefix.
- **Lane-mode overrides of the inner `/auto-hermes` loop**:
  - Step 11 (TASKS.md write) is **deferred** — the lane accumulates completed-task deltas, follow-ups, and must-fix items into its result packet's `completedRounds` / `mergeNotes` / `risks` arrays instead. The coordinator performs the actual TASKS.md write after the merge gate in parent Step 7.
  - CONTEXT_LEDGER.md writes are also deferred to the coordinator — lanes put their proposed capsule update into `mergeNotes` with a `context-ledger:` prefix so the coordinator can apply them.
  - The inner `/auto-hermes` Runaway Guard (`.ai-sync/RUNAWAY_COUNTER.json`) is per-repo-shared, but the lane MUST NOT update it in parallel runs — lanes keep a lane-local counter in their result packet's `laneRunawayCount` field; the coordinator reconciles after merge.
- Append a round summary to its `activityLogFile` (typically `.ai-sync/auto-hermes-max-results/<laneId>-activity.json`) after every completed round
- Write the result packet to its `resultFile` when the loop stops
- Never declare the parent iteration complete — that is the coordinator's job

Lane result packet fields: `laneId`, `parentRunId`, `correlationId`, `goal`, `ownedFiles`, `changedFiles`, `completedRounds`, `verification`, `runtimeProof`, `risks`, `mustPreserve`, `mergeNotes`, `status`, `worktreePath` (when `isolation: "worktree"` was used — required for coordinator integration in Step 7).

**Canonical lane statuses** (exactly one of):
- `approved` — lane finished, verification passed, changes ready for merge
- `must-fix` — lane found a defect in its own work or a cross-lane contract break that blocks merge
- `blocked` — lane could not proceed (external blocker, missing dependency, ambiguous scope)

Drop legacy aliases: writers must emit `approved` — not `verified`, `complete`, or `passed`. The merge gate only recognizes the three canonical values above; anything else is treated as `blocked`.

---

## Preferred Lane Agent Types

- `planning-agent` — Explorer role; also scopes lanes when parent goal is broad
- `frontend-agent` — owns a page group or UI surface
- `backend-agent` — owns a controller, service, or schema group
- `reviewer-agent` — reviews integrated merged result when regression risk is high
- `debugger` — owns a broken surface needing diagnosis before implementation

Recommended mixes:
- First iteration (Explorer Mode): `planning-agent` (Explorer) → coordinator reassesses → `frontend-agent` + `backend-agent`
- Regression-sensitive iteration: `frontend-agent` + `backend-agent` + `reviewer-agent`
- Frontend multi-surface: 2–3 `frontend-agent` lanes each owning a different page group
- Unknown or thin queue: `planning-agent` (Explorer re-launched) → coordinator reassesses

---

## Merge Arbitration

After all lanes finish, the coordinator makes autonomous arbitration decisions for every detected conflict. **Never ask the user to pick.**

### Conflict types detected automatically
- **File-touch overlap** — multiple lanes changed the same file
- **Undeclared edits** — a lane changed a file outside its declared `ownedFiles`
- **Shared contract changes** — a lane modified `translations.js`, `pom.xml`, `App.jsx`, schema files, etc.
- **Competing surface work** — multiple lanes completed rounds on the same named surface

### Autonomous decision rules (apply in order)

| Decision | When |
|---|---|
| `accept-as-is` | Changed regions don't overlap — changes are additive |
| `accept-lane-<id>` | One lane has passing verification, the other does not |
| `accept-lane-<id>` | Both pass but one is a strict superset of the other |
| `synthesize` | Both lanes changed different parts of the same file and both parts are independently correct |
| `discard-all` | Conflict cannot be safely resolved — revert and write a follow-up task |

Record `coordinatorDecision` + `coordinatorRationale` for each conflict. Rerun the merge gate to confirm `approve-merge`.

---

## Merge Gate

**[auto]** = evaluated by script. **[coordinator-autonomous]** = Claude evaluates and decides without asking the user.

1. **[auto]** Ownership Gate — no declared ownership overlap between lanes
2. **[coordinator-autonomous]** Contract Gate — read shared contract files; if they agree → `pass`; if a lane broke a contract → mark that lane `must-fix`, continue with remaining approved lanes
3. **[auto]** Verification Gate — each approved lane ran and passed focused verification
4. **[coordinator-autonomous]** Runtime Truth Gate — all approved lanes report non-empty `runtimeProof` → `pass`; otherwise run the proof gate command from `CLAUDE.md` and record the result
5. **[coordinator-autonomous]** Regression Gate — compare changed surfaces against `.ai-sync/CONTEXT_LEDGER.md` baseline; no regression → `pass`; regression found → create must-fix task, block merge for that surface only
6. **[coordinator-autonomous]** Concurrent-Work Absorption Gate — run `git log --oneline` since the lanes were launched; if any external agent committed to files that a lane also changed: apply synthesis rules from the Concurrent Agent Resilience section (`accept-as-is` if regions don't overlap, `synthesize` if compatible changes, `discard-all` if unresolvable). External agent changes that are strictly additive and non-conflicting pass automatically. Record each absorption decision in `coordinatorDecision` with prefix `absorbed-external:`. This gate never fails the merge — it may add a `[concurrent-conflict]` task to the pending TASKS.md write queue if synthesis is not clean.
7. **[auto]** Arbitration Gate — every detected conflict has a recorded `coordinatorDecision` AND the decision is internally consistent: `accept-lane-<id>` requires that lane's `status === "approved"` and its `verification` non-empty; `synthesize` requires both lanes' statuses to be `approved`; `discard-all` requires a follow-up task already appended to the coordinator's pending TASKS.md write queue. A decision that references a `must-fix` or `blocked` lane as the accepted source is rejected and forces a rerun with arbitration-required.
8. **[auto]** Review Gate — emits `approve-merge`, `arbitration-required-before-merge`, or `must-fix-before-merge-complete`
9. **[auto]** Evidence Gate — final claims grounded in workspace state and post-merge verification

**Never ask the user to confirm a gate.**

---

## Coordinator Reply Rules

The coordinator is silent during execution. It speaks to the user only on:
- **Clean stop** — no remaining promotable work found after reassessment; report final summary
- **Unresolvable blocker** — autonomous continuation would cause data loss or irreversible harm
- **Runaway Guard fires** — Explorer re-launched 3 times in a row with no parallel work found
- **`.ai-sync/HUMAN_LOOP.md`** explicitly says `pause`, `stop`, or `must-ask`

---

## Max Runaway Guard

The Max Runaway counter lives in `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json` as `{ "count": N }`. If the file does not exist, start at 0 and create it.

**Counter writes** (only these paths):
- **`suggestedLanes === 0` from the Explorer** → increment by 1.
- **Post-merge Step 7 completes successfully** → reset to 0.
- **Lane or merge gate produces an unresolvable blocker** → reset to 0 (we stop for a different reason; the counter only tracks "explorer-found-nothing" streaks).

**Guard evaluation at the start of every iteration**:
- If `count ≥ 3`: **fire Max Runaway Guard** — write a `handoff-state` checkpoint, stop with "auto-hermes-max: Explorer returned 0 remaining work for 3 consecutive reassessments; waiting for human direction."
- If `count < 3`: proceed into the iteration.

This is distinct from the inner `/auto-hermes` Runaway Guard (in `.ai-sync/RUNAWAY_COUNTER.json`) — each loop owns its own counter so a lane that exhausts L4 does not also trip the max-level guard.

## Stop Rules

The self-loop stops when:
- Dynamic Reassessment finds 0 promotable items and the Explorer also finds nothing
- A lane or merge gate finds a real unresolvable blocker
- `.ai-sync/HUMAN_LOOP.md` says `pause`, `stop`, or `must-ask`
- Max Runaway Guard fires (counter in `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json` reaches 3)

The self-loop **does not stop** when:
- `## Active Tasks` is empty — reassess and continue
- A single iteration's merge gate passes — reassess and continue
- Lane count drops to 1 — run sequentially and reassess after

---

## Truth Rules

- The coordinator does not implement work. If it finds itself writing code, it has drifted out of role.
- Do not claim "all N lanes succeeded" unless all selected lane agents ran to completion and the merge gate cleared.
- Do not claim the website or runtime changed until the merged post-arbitration proof gates pass.
- Do not declare the self-loop done until the stop condition fires.
- Do not advance to the next iteration until the current iteration's merge gate emits `approve-merge` (or the single-lane path completes and TASKS.md is updated).
- For launcher, explorer, lane, and merge claims, use the shared taxonomy in [auto-hermes-claim-taxonomy.md](C:\Users\Junwei\Downloads\Hermes\.codex\workflows\auto-hermes-claim-taxonomy.md).
- `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json` / `.md` supplies a `soft-signal` for future workflow changes only; it does not override the live merge gate or runtime-proof contract.
