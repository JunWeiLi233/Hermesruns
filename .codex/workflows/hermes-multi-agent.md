# Hermes Codex Multi-Agent Workflow

This playbook defines how Codex agents collaborate in Hermes without fighting over scope or over-delegating.

Architecture boundary:
- `.codex/workflows/auto-hermes-architecture.md` owns the control plane for `/auto-hermes`
- this file owns delegation behavior and team-shape routing only
- `HERMES_SELF_EVOLVING_ENGINE.md` owns self-generated promotion logic
- `AGENTS.md` still owns policy, truthfulness, and runtime-proof rules

## Canonical Auto-Hermes Loop

Treat `/auto-hermes` as one bounded execution loop, not a giant swarm.

Per round:
1. Read `TASKS.md`, `.ai-sync/AGENT_SYNC.md`, and `.ai-sync/CONTEXT_LEDGER.md`.
2. Read `.ai-sync/HUMAN_LOOP.md` before any self-generated continuation.
3. Choose exactly one bounded work unit.
4. Use the lightest useful shape:
   - `single-agent` for small local work
   - `single specialist` when ownership is obvious
   - `PM -> builder -> reviewer` when the round is loop work, review-driven, cross-stack, or meaningfully user-visible
5. Verify the round, including runtime proof gates when claiming live website/runtime changes.
6. Promote only the strongest next must-fix, improvement, or tech-debt item.
7. Stop only when no promotable next round remains, verification fails, or human steering says pause/stop/must-ask.

On a clean stop with real product-file changes:
- run the repo auto-commit finish action
- `auto-commit` includes local commit by default
- push happens only when a real publish need exists and push gates pass
- do not assume `main` is the destination branch

Guardrails:
- one active task per round
- one file owner per file
- one builder lane unless the fix clearly splits by stack
- `frontend-agent` and `backend-agent` may run together only when the round is already bounded, the contract between them is explicit, and their write scopes do not overlap
- when they run together on a frontend-heavy round, `backend-agent` should default to a concise support lane rather than a co-equal product-design lane
- even with paired builders, keep one PM/reviewer envelope and reunify verification before claiming the round done
- do not force planning, review, or delegation when a direct local fix is cheaper and safer
- human approval is not required every round; ask only when `.ai-sync/HUMAN_LOOP.md` says so or the product fork/risk is non-obvious

## Codex Subagent Runtime

When Codex subagents are available, Hermes uses a standing authorization model: Codex may use subagents automatically when the current bounded round materially benefits from specialist or parallel delegation. `/auto-hermes` remains an especially strong signal to consider that path, but it is not the only authorization source inside this repo.

Visibility rule:
- in `/auto-hermes`, when a round is not tiny and already benefits from delegation, prefer real spawned agents over keeping PM/reviewer/builder roles implicit in the coordinator
- this is a visibility preference, not permission to spawn extra agents without value

Dispatch rule:
- `.tools/auto-hermes-controller.mjs` should emit the Codex subagent dispatch plan for the current bounded round
- `.tools/auto-hermes-loop.mjs` should carry that dispatch plan into the generated worker prompt and coordinator brief
- when the dispatch plan says `useCodexSubagents: true`, the live Codex coordinator should actually spawn the named lanes when the tool/runtime allows it instead of treating them as prose-only roles
- after merge/integration, the coordinator must re-enter controller -> round-close -> controller again in the same `/auto-hermes` invocation until a stop gate fires

Subagent rules:
- Use subagents only when the task is broad enough, risky enough, or parallelizable enough that delegation beats a direct local fix.
- Keep the critical path local when the next step depends immediately on a result.
- Prefer 1 subagent over many; parallelize only disjoint work.
- The coordinator owns the round, final verification, and promotion decision even when subagents implement the slices.
- Every spawned worker must be told it is not alone in the repo and must not revert or overwrite unrelated edits from others.

Allowed subagent shapes:
- `planning-agent` alone for decomposition-first rounds
- `reviewer-agent` alone for review-only rounds
- `debugger-agent` alone for reproduce-and-fix rounds with likely local root cause
- `reviewer-agent` + `debugger-agent` for review-then-fix rounds
- `frontend-agent` + `backend-agent` in parallel only for explicit cross-stack rounds with disjoint file ownership
- when frontend owns the main surface, prefer a heavy frontend lane plus a compact backend support lane
- `planning-agent` plus one builder lane when the request is broad but the first execution unit is still single-stack

Preferred visible defaults for `/auto-hermes`:
- tiny local round -> stay local
- non-tiny single-stack round -> spawn at least one of:
  - `planning-agent`
  - `reviewer-agent`
  - owning builder specialist
- non-trivial frontend round -> default to visible `frontend-agent` + `reviewer-agent`
- review-sensitive round -> prefer `reviewer-agent`
- broad round -> prefer `planning-agent`
- cross-stack round -> prefer visible `frontend-agent` + `backend-agent` pairing when the round is already bounded and ownership is disjoint
- frontend-heavy cross-stack round -> keep `frontend-agent` expansive and `backend-agent` concise unless backend risk or ownership clearly dominates

Default spawning order for `/auto-hermes`:
1. Read queue and choose one bounded round.
2. Read the coordinator brief and decide whether the round stays local or whether Hermes should exercise delegated/subagent execution for this bounded round.
3. If decomposition is needed first, spawn `planning-agent`.
4. If discovery is needed first, spawn `reviewer-agent`.
5. If root cause is unclear, spawn `debugger-agent`.
6. Spawn `frontend-agent` and `backend-agent` together only when:
   - the round is already bounded
   - the API/UI contract between them is explicit
   - their write scopes are disjoint
   - the coordinator can keep doing meaningful non-overlapping work while they run

Parallel coordination contract:
- Never have two subagents edit the same file.
- Name owned files or modules in the spawn prompt.
- Tell each worker what assumption from the other lane must remain true.
- Wait only when the next critical step is blocked on that result.
- After workers finish, the coordinator integrates results, reruns focused verification, then decides whether reviewer value is still worth another pass.
- The controller's emitted `spawnOrder` and `parallelGroups` are the default execution order unless the live round reveals a blocker that requires staying local.

## Max Parallel Mode

`/auto-hermes-max` is the only repo-sanctioned adaptive parallel `/auto-hermes` pattern.

Rules:
- there is still only one coordinator
- child lanes are owned-scope `/auto-hermes` loop workers under one parent iteration, not independent parent coordinators
- cap candidate lanes at 5, but launch only the fastest safe `1..5` selected lanes
- every lane must have explicit owned files/modules before spawn
- every lane must declare whether it is `parallel-ready`, `sequential-after:<laneId>`, or `blocked-by-plan`
- no overlapping ownership
- every lane must return a compact result packet for merge review
- every lane must have a durable correlation id and result file path so long-running parent rounds can reunify later
- every multi-lane parent round should require `isolation: "worktree"` in the lane packet so child execution stays merge-safe
- child lanes defer `TASKS.md` and `.ai-sync/CONTEXT_LEDGER.md` writes to the parent coordinator; queue/context writeback happens only after merge review
- the coordinator must run the command's merge gate before accepting the combined outcome
- `.tools/auto-hermes-max.mjs` should write the launcher brief, lane briefs, durable result-file paths, and merge brief before the live Codex coordinator spawns the child lanes
- `.tools/auto-hermes-max-merge.mjs` should refresh merge state from durable lane result packets when the child runs are long-lived or finish at different times

Use `/auto-hermes-max` only when:
- the parent round already decomposes into 2 to 5 bounded units
- coordination cost is still lower than sequential execution
- there is a clear reason the final result must be reunited in one merged verdict

Launcher rule:
- `.tools/auto-hermes-max.mjs` may downshift the launch count below the candidate lane count when effort is tiny, coordination cost is high, merge complexity is high, or the planner explicitly recommends fewer lanes
- the launcher output should make that decision auditable per lane instead of only reporting one top-line rationale
- if only 1 lane is selected, keep the `/auto-hermes-max` merge/truth contract but run it as a single child `/auto-hermes` worker instead of theater-spawning extras
- if 2 or more lanes are selected, require canonical lane result statuses only: `approved`, `must-fix`, `blocked`; any alias should be treated as blocked during merge

Do not use `/auto-hermes-max` when:
- the work is really one unclear bug
- lanes would race on the same files
- the final integrated verification would be more expensive than just doing the work sequentially

Recommended lane mix:
- `planning-agent` may be used first to carve the 5 bounded lanes
- child lanes should then prefer builder ownership, reviewer ownership, or debugger ownership based on scope
- a separate reviewer lane is optional during child execution, but final review at merge time is mandatory
- each child lane should be launched as a bounded `/auto-hermes` single-round worker, not as its own self-loop

Frontend/Backend start gate:
- Start `frontend-agent` only if at least one is true:
  - the task changes user-visible layout, interaction, state presentation, or translations
  - the bug root cause is in `frontend/src/**`
  - the round needs a bounded frontend slice after debugger or planner narrowed it
- Start `backend-agent` only if at least one is true:
  - the task changes controller/service/repository logic, validation, persistence, or response shape
  - the bug root cause is in `backend/src/main/java/**` or runtime backend resources
  - the round needs a bounded backend slice after debugger or planner narrowed it
- Start both together only if all are true:
  - neither lane alone can finish the round
  - the contract between the lanes is already explicit
  - file ownership is disjoint
  - the round is still one coherent work unit
- If frontend owns the visible surface and backend starts only to support it, backend should scope itself to the minimum contract, validation, or persistence change needed for the frontend lane to finish.
- If any of those conditions fail, keep the round single-lane or single-agent.

Problem-class routing:
- `Problem: frontend-design` means the controller already proved the round is a frontend design issue; route it through reviewer-backed frontend execution instead of debating whether it is "just UI polish".
- `Problem: backend-logic` means the controller already proved the round is a backend logic issue; route it to `backend-agent`, and add `reviewer-agent` when auth, validation, contract, response-shape, or persistence logic is involved.
- Keep these problem classes disjoint in `/auto-hermes-max` lane planning unless a real contract dependency forces one lane to wait on the other.

Codex runtime mapping:
- `planning-agent` -> `explorer` by default
- `reviewer-agent` -> `explorer`
- `debugger-agent` -> `explorer` for diagnosis-only, `worker` for a bounded fix
- `frontend-agent` -> `worker`
- `backend-agent` -> `worker`

Codex continuation rule:
- after the active bounded round is merged and verified, do not answer the user yet
- run round-close, refresh the controller/loop helper, and continue straight into the next bounded round when the updated coordinator brief still says `codex-coordinator-execute-round`
- answer the user only on clean stop, blocker, or required human intervention

Frontend design-review rule:
- if a frontend round changes layout, hierarchy, empty/loading/error states, or implements a user-provided reference, do not let `frontend-agent` work without a reviewer lane unless the round is truly tiny after scoping
- for these rounds, the reviewer is a design-quality reviewer, not only a bug reviewer
- the reviewer must check hierarchy, spacing, reference fidelity, coach-value tone, and responsive integrity

Recommended spawn prompts:
- `planning-agent`
  - "Break this /auto-hermes round into the smallest execution-ready task first. Keep ownership explicit, files bounded, and verification focused."
- `reviewer-agent`
  - "Review this Hermes surface for concrete defects, trust gaps, and for frontend rounds also hierarchy, spacing, reference fidelity, and coach-value quality. Use Elon, Jobs, and Linus lenses only if the review is broad or high-value, then write implementation-ready findings and name the single strongest next action."
- `debugger-agent`
  - "Own reproduction and root cause for this /auto-hermes round. Keep scope tight and delegate only if the fix cleanly splits by file ownership."
- `frontend-agent`
  - "Own only the frontend slice of this /auto-hermes round. You are not alone in the repo. Do not revert others' edits. Preserve the agreed API contract, extract the visual target before editing, and work only in these files: ..."
- `backend-agent`
  - "Own only the backend slice of this /auto-hermes round. You are not alone in the repo. Do not revert others' edits. If frontend owns the larger surface, keep this lane concise and make only the minimum contract, validation, or persistence change required. Preserve the agreed contract unless you explicitly report the frontend impact. Work only in these files: ..."

## Specialist Role Cards

When `/auto-hermes` routes a real specialist lane, do not stop at naming the agent. Give the worker a short senior-role identity so the lane has a clear bar for judgment and craft.

Use these defaults:

`planning-agent`
- "You are a senior product planning engineer for Hermes."
- "You are highly skilled at decomposition, scope control, ownership mapping, and turning broad product requests into bounded execution-ready rounds."

`reviewer-agent`
- "You are a senior software reviewer for Hermes."
- "You are highly skilled at finding concrete regressions, trust gaps, weak states, and missing verification in runner-facing product work."

`debugger-agent`
- "You are a senior debugging engineer for Hermes."
- "You are highly skilled at reproduction, root-cause isolation, contract tracing, and regression-proof fixes across React, Spring Boot, and shared runtime state."

`frontend-agent`
- "You are a senior frontend developer for Hermes."
- "You are highly skilled in React, JavaScript, JSX, CSS, responsive UI systems, state presentation, interaction design, translation-safe UI copy, and premium product polish grounded in `design.md`."

`backend-agent`
- "You are a senior backend developer for Hermes."
- "You are highly skilled in Spring Boot, Java, REST API design, controller/service/repository contracts, validation, persistence flows, schedulers, and backend/runtime verification. In frontend-heavy rounds, you keep your role compact and contract-focused."

Role-card rules:
- keep the card short, specific, and technical
- include the main languages/frameworks for that lane
- keep Hermes-specific product expectations in the card when they matter, especially `design.md` for frontend and contract stability for backend
- do not use role cards as fluff; they should sharpen decisions, not pad prompts

## Adaptive Routing

Routing rule:
- if a decision here would change loop stop conditions, promotion rules, or shared state ownership, change the control-plane doc instead of this file
- if a decision here is only about who should perform a bounded round, this file is the right place

Choose the lightest useful shape for the prompt:

`single-agent`
- Use when the task is small, obvious, and local.
- Also use by default for `/auto-hermes` when delegation would not materially improve the bounded round.
- Good fit:
  - one-file UI tweak
  - one backend validation fix with a clear location
  - one translation or copy update
  - one focused test addition
- Do not delegate if coordination would cost more than the work.

`single specialist`
- Spawn only one specialist when the task clearly belongs to one lane.
- Good fit:
  - `planning-agent` for broad work that needs decomposition first
  - `frontend-agent` for page redesign, responsive cleanup, translation-safe UI changes, or design-system-safe polish
  - `backend-agent` for controller/service/repository/API-response work
  - `reviewer-agent` for review-only requests
  - `debugger-agent` for reproduce-and-fix bug requests with a likely local root cause

`paired agents`
- Use two agents when the work has one clear owner and one supporting lane.
- Good fit:
  - `reviewer-agent` + `debugger-agent` for "find bugs and fix the top one"
  - `debugger-agent` + `frontend-agent` for UI bugs with tricky reproduction
  - `debugger-agent` + `backend-agent` for API/data bugs with tricky reproduction
  - `frontend-agent` + `backend-agent` for clearly cross-stack work with explicit API/UI contract and disjoint file ownership

`full workflow`
- Use `planning-agent` -> `reviewer-agent`/`debugger-agent` -> `frontend-agent`/`backend-agent` only when the request is broad, ambiguous, clearly cross-stack, or the loop needs structured review before continuing.
- Good fit:
  - "review the project"
  - "work through TASKS.md"
  - "find bugs and fix them"
  - "audit this full flow"
  - "review frontend and backend drift"

## Routing Heuristics

Default to `single-agent` unless at least one of these is true:
- the user explicitly asks for multiple agents, delegation, swarm, or parallel work
- the prompt is broad enough that it should be decomposed before implementation
- the prompt asks to review first and then fix
- root cause is unclear
- the task likely spans both `frontend/src` and `backend/src/main/java`
- the task involves `TASKS.md` triage or writing findings before implementation
- the task is a batch or loop-mode run

For `/auto-hermes`, default to a visibly multi-agent shape unless most of these are true:
- the scoped round is truly tiny
- one file or one subsystem is enough
- no review or decomposition value exists
- no cross-stack risk exists
- the coordinator is faster and safer than a real spawn

Stay out of multi-agent mode when most of these are true:
- one file or one subsystem is named
- the requested outcome is obvious
- no review phase is needed
- no cross-stack contract risk is apparent
- the user is asking a question or wants a quick explanation

## Team Shape

`planning-agent`
- Breaks broad work into small Hermes-sized tasks.
- Chooses likely ownership and verify steps.
- Keeps frontend or cross-stack plans aligned with the current user brief/reference, runner value, and bounded delivery.
- Does not implement the task in the same pass.

`reviewer-agent`
- Finds concrete product, reliability, resilience, and contract issues.
- Writes implementation-ready tasks into `TASKS.md`.
- Names `approve-next-round`, `must-fix-before-next-round`, or `reverse-recommended`.
- For non-trivial frontend rounds, also acts as the design-quality gate on hierarchy, spacing, mimic fidelity, responsive integrity, and coach-value tone.
- May use the Hermes review-lens triad:
  - `elon-lens` for first-principles, speed, and business-value pressure
  - `jobs-lens` for taste, DX, defaults, and flow quality
  - `linus-lens` for correctness, abstractions, and engineering rigor
- Does not fix the bug in the same pass.

`tech-debt-reviewer`
- Runs after the main reviewer on every bounded round.
- Inspects only the just-changed files plus at most 2 directly related files.
- Looks for one reusable engineering cleanup exposed by the round, not generic polish.
- Writes at most 1 implementation-ready debt task into `TASKS.md`, or writes none if the round exposed no bounded debt.
- Must not inflate the backlog with speculative cleanup or weaker duplicates.

`debugger-agent`
- Picks up reviewer-written bug tasks.
- Reproduces, traces, and fixes the root cause.
- Delegates narrowly to frontend/backend workers when the fix splits cleanly.

`frontend-agent`
- Owns UI design, page structure, interactions, translations, and frontend verification.
- Uses `design.md` as Hermes's visual core, then adapts it to the current task/reference without drifting into generic SaaS patterns.
- When a UI reference or mimic target is provided, extracts hierarchy, spacing, typography, color roles, and exact mimic scope from that reference before editing.
- Before editing non-trivial frontend rounds, explicitly defines: surface, visual goal, preserve list, round type, and reference source.
- Improves runner usefulness, trust, and motivation before decorative polish.

`backend-agent`
- Owns controllers, services, repositories, entities, validation, JSON contracts, and backend verification.
- Preserves stable contracts or documents the exact frontend impact when a contract changes.
- In frontend-heavy cross-stack rounds, behaves as a concise backend support lane unless the backend is the true primary risk or owner.

## Recommended Execution Order

1. If the request is broad, `planning-agent` breaks it into at most 3 execution-ready tasks, but the coordinator promotes only 1 bounded task into the current round.
2. `reviewer-agent` inspects the target surface and writes at most 3 high-signal tasks into `TASKS.md` only when discovery is needed.
3. `debugger-agent` takes the first new review task and confirms root cause.
4. `debugger-agent` either fixes it directly or delegates:
   - `frontend-agent` for UI/state/copy/rendering work
   - `backend-agent` for API/validation/persistence/response-shape work
   - `frontend-agent` + `backend-agent` together only when the round is clearly cross-stack and their ownership stays disjoint
5. The builder or debugger runs the narrow verification and any required runtime proof gate before claiming the change is live.
6. `reviewer-agent` does a quick confirmation pass only when review value is still high for the just-finished surface, except for non-trivial frontend rounds where the reviewer pass is mandatory.
7. `tech-debt-reviewer` performs the mandatory per-round debt check.
8. The coordinator promotes the single strongest next must-fix, improvement, or tech-debt item, or stops.

## TASKS.md Format For Reviewer Handoffs

Use this exact shape for each new finding:

```md
- [ ] Fix session-expired return path after login
  Files: frontend/src/pages/Login.jsx, frontend/src/lib/api.js
  Context: Reviewer: expired-session redirect drops the intended return path after re-auth. Owner: debugger
  Done when: Logging back in returns the runner to the original protected page instead of the dashboard fallback.
  Verify: Reproduce a 401 on a protected page, log back in, and confirm the original page is restored.
```

## Collaboration Guardrails

- Do not spawn unused agents just because they exist.
- Prefer the minimum agent set that can finish the task cleanly.
- Use `planning-agent` before implementation when the request is too large or fuzzy for safe direct execution.
- Reviewer should not silently become debugger.
- Non-trivial frontend rounds should not skip the reviewer/design-quality lane just because the code change looks small.
- Frontend should not guess backend payload changes.
- Backend should not invent UI copy or layout.
- Debugger should not widen scope beyond the reviewed bug unless verification proves a direct dependency.
- Do not force a PM ticket, feature branch, or human merge ritual for every local Hermes round.
- All agents should reuse Hermes rules from `AGENTS.md`, `TASKS.md`, and the `.ai-codex/` index instead of rescanning the repo.
- Codex-side frontend work should read `design.md`, follow the current task/reference direction, avoid generic SaaS layouts, and prioritize runner usefulness over decoration.
- Do not describe repo shortcuts or skill triggers as native Codex app features unless that was verified separately.
- Do not describe memory recall as confirmed unless it came from MemPalace retrieval, a cited file, or the current diff/history.
- Do not force the full Elon/Jobs/Linus review triad on tiny or obvious rounds; use it only when review depth will materially improve the decision.
