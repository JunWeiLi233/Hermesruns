---
name: auto-hermes-self
description: Run the Ralph self-loop with OpenCode as the active executor until a real stop gate fires.
---

# Auto-Hermes Self For OpenCode

This is the canonical OpenCode execution adapter for `/auto-hermes-self`.
`docs/ai/runtime-command-manifest.json` selects it when generating
`.opencode/commands/auto-hermes-self.md`. The shared lifecycle, verification,
claim, stop, and finish rules remain in
`.codex/workflows/auto-hermes-shared-contract.md` and
`.codex/workflows/auto-hermes-architecture.md`; apply
`docs/ai/EDITING_CONTRACT.md` to every change.

## Executor And Loop Entry

1. Check `.workspace/state/HUMAN_LOOP.md` for pause, stop, or must-ask. Read the active claims in `.workspace/state/AGENT_SYNC.md` and preserve concurrent work before choosing a bounded task.
2. Run `node tools/auto-hermes-self-loop.mjs --write --json --runtime opencode`.
3. Read `.workspace/state/AUTO_HERMES_SELF_LOOP.json`, `.workspace/state/AUTO_HERMES_SELF_COORDINATOR.md`, `.workspace/state/AUTO_HERMES_SELF_CONTROLLER.json`, and `.workspace/state/AUTO_HERMES_SELF_NEXT_PROMPT.md` for the current work unit, scope, route, and verification contract.
4. Verify `runtime: "opencode"` and `selfExecutionContract: "native-runtime-owned"`. An `opencode-awaiting-worker-round` status means OpenCode must execute the emitted work unit now; generating the brief is not evidence of execution or completion.

OpenCode is the executor. Use its current model/session and OpenCode-native
parallel agents only for disjoint lanes; if those agents are unavailable,
execute the same specialist responsibilities sequentially in the active
OpenCode session. The helper prepares state and briefs and does not launch a
worker for this runtime. Do not invoke Codex, `multi_agent_v1.spawn_agent`,
`tools/generate-codex.js`, or an external Codex executor as a fallback. Do not
switch the helper to `--runtime codex` or `--runtime codex-live`.

## Bounded Round And Evidence

Execute exactly the emitted work unit within its owned files. Before a round
that follows changes to loop-critical files, run `node --check
tools/auto-hermes-self-loop.mjs` and `node --check tools/auto-hermes-loop.mjs`,
then run `node tools/auto-hermes-self-loop.mjs --write --runtime opencode
--dry-run` and verify the OpenCode runtime and native ownership contract in
the self-loop state. A dry run proves preparation only. Repair a broken
integrity gate before new product work and record the repair in round evidence.

Require fresh verification from the task's `Verify:` command, runtime proof
when a live frontend or backend surface changes, architect approval, deslop
or an explicit justified skip, and regression re-verification after cleanup.
Keep an explicit review verdict: `approve-next-round`,
`must-fix-before-next-round`, or `reverse-recommended`.

Record round-close writeback through `tools/auto-hermes-round-close.mjs` with
`--write --agent opencode`, the actual task, surface, owner, changed files,
verification command, evidence, and gate verdicts. Pass these state arguments
so the next self-loop invocation consumes this round's results rather than
the ordinary bounded loop's result packet:

```text
--loop-state-json .workspace/state/AUTO_HERMES_SELF_LOOP_STATE.json
--controller-json .workspace/state/AUTO_HERMES_SELF_CONTROLLER.json
--controller-md .workspace/state/AUTO_HERMES_SELF_CONTROLLER.md
--promotion-json .workspace/state/AUTO_HERMES_SELF_PROMOTION.json
--promotion-md .workspace/state/AUTO_HERMES_SELF_PROMOTION.md
--trace-to-skill-json .workspace/state/AUTO_HERMES_SELF_TRACE_TO_SKILL.json
--trace-to-skill-md .workspace/state/AUTO_HERMES_SELF_TRACE_TO_SKILL.md
--round-result-json .workspace/state/AUTO_HERMES_SELF_ROUND_RESULT.json
--round-result-md .workspace/state/AUTO_HERMES_SELF_ROUND_RESULT.md
--no-refresh-loop-briefs
--no-refresh-finish
```

Use `--verify-result pass --architect-verdict approved --deslop-pass pass
--regression-pass pass --verdict pass` only after those gates actually pass;
include `--runtime-proof pass` only when verified. Record failures with
`--verdict fail --blocker "<observed reason>"` and the actual failing gate
values. A prepared result packet or a helper's zero exit code is not proof.

## Re-Entry And Stop Gates

After round-close, re-run `node tools/auto-hermes-self-loop.mjs --write --json
--runtime opencode` and read the refreshed coordinator. If OpenCode has another
work unit, execute it immediately. A single successful bounded round is not
the natural completion condition of this self-loop.

- Empty queue does not immediately stop. Promote existing candidates, seed suggestions when needed, and use the website-audit explorer before exhaustion. Repeated no-candidate audit rounds are the true stop condition, subject to the configured supervisor limit.
- Supervisor is the preferred continuity layer for long-running runs. Respect its authored decision and human stop gates; a configured state file alone does not prove a live supervisor process.
- Preserve the helper's same-work-unit no-progress limit, executor retries, retry backoff, and dedicated self-loop claim/artifact paths. Carry forward the previous round-result evidence; changed evidence can justify progress, while repetition without progress must reach the stop gate. Native OpenCode execution remains owned by the session; retry settings do not imply the helper launches an executor.
- If the helper returns `supervisorState.stop: false` and `decision: "continue"` without a work unit, inspect the self-reentry history. If `selfReentryLimitReached` is true, diagnose the bounded reentry limit before raising `--max-self-reentries`; do not silently declare exhaustion or spin without new evidence.
- Honor human pause/stop/must-ask, repeated audit exhaustion, same-task no-progress, executor unavailability after configured retries, and unsafe recovery gates. For a course-map extraction mission, success requires live non-empty `routePoints` rendered on runner OpenStreetMap; city-level references are not completion evidence.
- Use `.workspace/state/AUTO_HERMES_TRACE_TO_SKILL.json` or `.md` as a `soft-signal` for workflow evolution. Keep fresh task and runtime evidence as the completion authority.

## Finish

On a true clean stop, use `tools/auto-hermes-finish.mjs` under the shared finish
contract and the user's authorized scope. Preserve privacy, commit gates,
unrelated dirty work, and publication authorization. Before push or
main-repository submission, require a fresh passing
`node tools/auto-hermes-docker-gate.mjs --write` result for the current working
tree. The Docker gate blocks publish paths only and does not block normal
local auto-commit when its own gates pass. If a finish gate fails, report the
blocker without claiming publication.
