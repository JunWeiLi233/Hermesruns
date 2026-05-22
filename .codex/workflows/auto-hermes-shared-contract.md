# Auto-Hermes Shared Contract

This file is the shared contract for `/auto-hermes` across all supported agent runtimes.

Use it to keep shared lifecycle rules in one place instead of duplicating them across:
- `.codex/commands/auto-hermes.md` (Codex)
- `.claude/commands/auto-hermes.md` (Claude Code)
- `.claude/agents/gemini-auto-hermes.md` (Gemini CLI — paste-in prompt)
- `.cursor/rules/` (Cursor)
- `.opencode/commands/` (OpenCode)
- `.claude/agents/antigravity.md` (Antigravity)


This file owns the parts that should not drift by runtime:
- follow-up and tech-debt pass
- canonical round shape
- runtime truth wording
- autonomous decision contract
- human gate
- stop rules
- finish action

Runtime-specific launch details still belong in the command files.

## Claim Taxonomy

Hallucination-sensitive runtime claims must use the shared taxonomy in:
- [auto-hermes-claim-taxonomy.md](./auto-hermes-claim-taxonomy.md)

Allowed claim states:
- `unavailable`
- `configured`
- `requested`
- `prepared`
- `executing`
- `verified`

Never collapse these states in prose or generated briefs.

## Record System Contract

`/auto-hermes` should treat the repository as the durable record system for workflow truth.

Rules:
- `AGENTS.md` is the policy plane and top-level map, not the long-form storage location for every workflow detail.
- `docs/auto-hermes/index.md` is the stable record-system entrypoint for `/auto-hermes` when it exists.
- Durable workflow knowledge must live in versioned repo artifacts: workflow docs, helper scripts, plans, and `.ai-sync` state with a clear owner.
- Controller and loop outputs should emit a minimal knowledge pack for the current round instead of instructing broad repo scans.
- If a round discovers that durable guidance is stale or missing, update the smallest owning doc/script in the same round when bounded; otherwise write a concrete doc-gardening follow-up or must-fix.

## Progressive Disclosure Contract

`/auto-hermes` should start from a small, stable context window and only widen when the current round actually needs more detail.

Rules:
- Read the record-system map first, then the smallest owning file for the current question.
- Prefer a task-specific knowledge pack over broad re-reading of workflow files.
- Do not inject the whole workflow corpus into every round when a smaller read order is enough.
- If a helper brief and an owning doc disagree, prefer the owning doc and fix the helper behavior in code.

## Follow-Up And Tech-Debt Pass

Run both passes after every round verdict.

### Tech-Debt Reviewer

`tech-debt-reviewer` is a required per-round check, not an optional cleanup mood.

Contract:
- runs after Reviewer emits its verdict and before queue writeback
- inspects only the just-changed files plus at most 2 directly related files
- produces at most 1 implementation-ready tech-debt item for the round
- uses strict task format: `Files:`, `Context:`, `Done when:`, `Verify:`
- must not invent vague cleanup, speculative architecture, or backlog spam
- if no bounded debt is found, it should say so internally and leave no task behind

In `mode=concrete`:
- still run the tech-debt review
- do not turn that into autonomous self-loop continuation
- only write a debt item if the current round explicitly owns queue/workflow writeback

Each pass inspects only:
- the just-changed files
- plus at most 2 directly related files

Follow-up pass:
- extract the single strongest improvement candidate
- it must be directly caused by the current work
- it must pass the Daily Opening Test or "Better than Strava" test
- it must be concrete, bounded, and high-value
- compare against the current top item in the matching `## Suggested Next Tasks` section and keep only the stronger one

Tech-debt pass:
- extract the single strongest debt item
- it must be directly caused by the current work
- it must not be vague cleanup or speculative architecture
- it must use strict task format: `Files:`, `Context:`, `Done when:`, `Verify:`

Promote at most:
- 1 improvement
- 1 debt item

Replace weaker duplicates instead of stacking near-identical items.

## Canonical Round Shape

Run one bounded task at a time.
Do not reorder the steps.

### Execution Shape Selection

Before scoping the round, choose the lightest useful shape:

- `single-agent`
  - small, local, obvious fix
  - one file or one function
  - no logic-risk or cross-stack coordination

- `one-specialist`
  - clear single-domain ownership
  - bounded scope
  - no cross-stack risk

- `full-pipeline`
  - loop work
  - new feature
  - cross-stack risk
  - or review value clearly justifies it

For non-trivial frontend rounds, apply the frontend design-review workflow before locking the shape.

### Knowledge Pack

Before implementation, the controller/loop pair should emit a minimal round-specific knowledge pack that:
- points to the smallest set of files the worker should read first
- names the record-system map for the current round
- states when doc-gardening is required vs conditional
- keeps broad workflow-file scanning as a fallback, not the default

### Frontend Design Decision Rule

When a round enters the frontend `design-review` branch:
- load the frontend design skill manifest with `node .tools/auto-hermes-skills.mjs --json`
- treat `design.md` as the final Hermes visual authority and the skill manifest as execution guidance
- explore 2-3 candidate directions internally when that improves the decision
- choose the strongest direction autonomously from:
  - `design.md`
  - the current approved live Hermes surface
  - any explicit user-provided reference
- carry only the selected direction into implementation and review
- do not ask the user to choose among internal design options during a normal run
- report any missing required frontend design skill as unavailable and use the nearest verified fallback instead of claiming it ran

Escalate design choice to the Human Gate only when:
- the design would change product scope or behavior in a non-obvious way
- preserving two conflicting references would materially change the shipped outcome
- the next move is risky, destructive, or irreversible

### Steps

1. Choose exactly one task from the level selected by the self-loop engine.
2. Select execution shape.
3. PM step: scope the round.
4. Builder step: implement.
5. Verify: run task verification plus any runtime proof gate.
6. Translation sync: only if user-visible JSX strings changed.
7. Code-review pass: full pipeline only.
8. Customer pass: runner-facing surfaces only, full pipeline only.
9. Reviewer: emit exactly one verdict:
   - `approve-next-round`
   - `must-fix-before-next-round`
   - `reverse-recommended`
10. Tech-debt-reviewer pass:
   - required every round
   - may write at most 1 implementation-ready debt item
11. Follow-up + queue writeback pass:
   - skip in `mode=concrete`
12. Re-enter Level 1 of the self-loop engine:
   - unless `mode=concrete`, in which case stop

### Must-Fix Handling

If Reviewer emits `must-fix-before-next-round`:
- annotate the original task with `Blocked by: <must-fix title> | Original: <section name>`
- move it to `## Blocked Tasks`
- increment or add `mustFixCount: N`
- write the must-fix as the new top item in `## Active Tasks`
- skip follow-up/debt pass

### Reverse Handling

If Reviewer emits `reverse-recommended`:
- revert the round using the best available checkpoint/commit info
- if automatic revert is not safe, escalate through the Human Gate
- write a reversal task to `## Active Tasks`

## Runtime Truth

- Do not claim the live website changed unless the frontend runtime proof gate passes.
- Do not claim backend behavior changed unless the backend runtime proof gate passes.
- If source changed but runtime sync did not happen, report: `source changed, live site not synced yet.`
- Treat `/auto-hermes` as a repo workflow/command convention, not a guaranteed native app feature.
- For self-loop, subagent, coordinator, executor, ECC, and RTK claims: use the shared claim taxonomy instead of raw yes/no wording.
- Prefer executor-backed loop ownership over prompt-only continuation whenever an executor path is configured.
- In the default Codex executor-backed path, worker agents run in YOLO/full-permission mode: OMX Ralph uses `--madmax`, and the bundled Codex fallback uses `--dangerously-bypass-approvals-and-sandbox`.
- Generated coordinator and worker briefs must expose the executor permission mode so full-permission agent spawning is visible as configuration, not claimed as proof that a child agent already executed.

## Autonomous Decision Contract

The agent makes all normal run decisions without asking the user.

This includes design-direction decisions for frontend `design-review` rounds.
Internal option exploration is allowed; user voting is not the default control path.

Never emit these mid-run:
- "If you want, I can do one more round"
- "Would you like me to..."
- "Should I..."
- "Let me know if you'd like me to fix it"
- "Which design option do you want?"
- "Pick a layout/style direction before I continue"

Replace them with:
- do the next bounded round
- fix the problem now
- or write a must-fix task and continue

When verification fails:
1. diagnose root cause internally first
2. fix it in-round if cheap and bounded
3. otherwise write a must-fix task and continue through the loop
4. only escalate when the next move is risky, destructive, or irreversible

## Human Gate

Ask the human only when:
- `.ai-sync/HUMAN_LOOP.md` says `pause`, `stop`, or `must-ask`
- verification failed and the next move is risky or irreversible
- a `reverse-recommended` revert cannot be performed automatically
- a product fork has non-obvious consequences

Do not ask the human between normal rounds.

## Stop Rules

Stop only when:
- all promotion levels are exhausted
- verification fails with a real unresolvable blocker
- a required revert cannot be completed safely
- `.ai-sync/HUMAN_LOOP.md` says `pause`, `stop`, or `must-ask`
- runaway guard fires

`## Active Tasks` being empty is not a stop condition by itself.

## Finish Action

On a true stop:
- run the auto-commit finish action if product source files changed
- `needed` means the run reached a true clean stop and publishable product files remain after policy filtering; workflow-only, memory, and local-only files never qualify on their own
- for `/auto-hermes` and `/auto-hermes-max`, a true clean stop that produces a publishable product commit is the `needed` case for auto-push
- commit when commit gates pass
- push only when a real publish need exists, push gates pass, and `origin` still points to `https://github.com/520HXC/run.git`
- local commit is the default finish state
- push/main-repository submission requires a fresh passing Docker gate artifact for the current working tree
- the Docker gate does not block normal local auto-commit; it blocks only publish paths

Do not trigger finish behavior for workflow-only files by themselves.
