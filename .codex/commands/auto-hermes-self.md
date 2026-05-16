---
name: auto-hermes-self
description: Use when you need the Ralph-style indefinite self-loop variant of auto-hermes to continue until a real stop condition.
---

# Auto-Hermes Self

Codex active execution playbook for the true Ralph self-loop version of `/auto-hermes`.

This mirrors the stronger Claude Code contract, adapted for Codex: `/auto-hermes-self` is not a prepare-and-wait note. Codex owns the full cycle when invoked here: initialize, select work, execute or delegate authorized lanes, verify, close the round, and re-enter until a real stop gate fires.

## Continuity Rules

- Empty queue does not immediately stop.
- If there is a promotable task, execute the next bounded round.
- If there is no promotable task, use the standard find-the-task path before stopping.
- Website-audit explorer is the final bounded fallback inside that discovery path.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.

## Command Notes

- Use `.tools/auto-hermes-self-loop.mjs` for the current Ralph-native indefinite self-loop owner behavior.
- Invoke it as `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-self-loop.mjs --write --json --runtime codex`; `codex` is the executor-backed self-executing runtime for Codex.
- Do not use `--runtime codex-live` as the Codex default. `codex-live` is a coordinator-awaiting mode when no executor is configured, so it can emit `codex-live-awaiting-coordinator` instead of self-executing work. If that status appears, rerun with `--runtime codex` or configure a real executor before claiming `/auto-hermes-self` executed.
- `/auto-hermes-self` is the true Ralph self-loop version of `/auto-hermes`: it keeps iterating until a real stop gate fires instead of treating a single bounded round as the finish state.
- When explicitly using `codex-live`, child-agent delegation for this command should use `GPT-5.5` with medium reasoning effort.
- Keep the same Hermes queue, verification, runtime-proof, and finish contracts as `/auto-hermes`; only the loop ownership contract changes.
- Self-executing means the helper runs in an executor-backed runtime, lets the configured executor execute bounded rounds, re-enters after empty-queue `continue` decisions, and writes round-close evidence after successful bounded rounds.
- The self-loop owner must normalize Ralph runtime defaults itself: same-work-unit no-progress limit, executor retries, retry backoff, and dedicated self-loop claim/artifact paths must not fall through to empty values.
- Do not manually stop after one empty-queue observation. If `.ai-sync/AUTO_HERMES_SELF_LOOP.json` shows `supervisorState.stop: false`, `supervisorState.decision: "continue"`, and no work unit, the self-loop helper should already have re-entered; if `selfReentryLimitReached` is true, inspect the loop state before raising `--max-self-reentries`.
- Every generated self-loop artifact should carry the strict Ralph gate policy: fresh verification, runtime proof when needed, architect approval, deslop or explicit skip, regression re-verification, and round-close writeback.
- When the same bounded work unit repeats, carry forward the last round-result evidence and keep iterating if the result packet shows meaningful progress; reserve the repeated-task stop gate for no-progress loops.
- If the controller reports no promotable work, use the standard Hermes discovery path first: promote existing queue candidates when present, otherwise seed suggestions, then use website-audit fallback before allowing stop.
- If Human Requests define a course-map extraction mission, synthesize a `human-mission` work unit instead of stopping on an empty queue. Stop only after a standard city road marathon course-map candidate produces live non-empty `routePoints` and the runner OpenStreetMap renders the extracted route; city-level-only references are not success.

## Active Execution Playbook

When `/auto-hermes-self` is invoked in Codex, execute this playbook. Do not stop after emitting artifacts, and do not ask the user to continue after a normal successful round.

### Loop Entry

1. Scan GitHub issues for actionable work:
   `node .tools/auto-hermes-issues.mjs --task-format`
   If actionable issues exist, they become active tasks with `Source: GitHub issue #N` and take priority.
2. Run the Codex self-loop owner:
   `node .tools/auto-hermes-self-loop.mjs --write --json --runtime codex`
3. Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md`.
4. If `Next Action` is `stop`, report the stop reason, run finish actions when eligible, and stop.
5. If `Next Action` is `loop-owner-execute-round`, the executor-backed loop owner owns the bounded round. Inspect its emitted evidence before re-entry.
6. If `Next Action` is `codex-coordinator-execute-round`, the parent Codex session executes the bounded round directly from the coordinator/controller brief.

### Pre-Round Codex Integrity Gate

Before every Codex-executed round, verify the self-loop can still execute:

- Check whether the previous round touched loop-critical files: `.codex/commands/auto-hermes-self.md`, `.claude/commands/auto-hermes-self.md`, `.tools/auto-hermes-self-loop.mjs`, or `.tools/auto-hermes-loop.mjs`.
- Run `node --check .tools/auto-hermes-self-loop.mjs` and `node --check .tools/auto-hermes-loop.mjs`.
- Run `node .tools/auto-hermes-self-loop.mjs --write --runtime codex --dry-run` and verify `.ai-sync/AUTO_HERMES_SELF_LOOP.json` has `selfExecutionContract: "executor-backed"`.
- Verify `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md` contains `Codex Self-Loop Protocol (Active Execution)`.
- If any check fails, fix the loop mechanism before executing new product work. Record that repair in round-close evidence as `ralph-integrity-fix: <what changed>`.

### Round Execution

1. Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md` for the current work unit.
2. Read `.ai-sync/AUTO_HERMES_CONTROLLER.json` for the subagent plan, route, knowledge pack, files, and verification contract.
3. Execute the bounded round. If the active command context explicitly authorizes subagents and the controller has disjoint lanes, use Codex subagents; otherwise execute locally with the same specialist responsibilities.
4. Run the required verification command from the task's `Verify:` field.
5. Run runtime proof gates when source changes affect a live frontend or backend surface.
6. Run the merge/review gate. Reviewer verdict must be explicit: `approve-next-round`, `must-fix-before-next-round`, or `reverse-recommended`.
7. Run round-close with real evidence:
   `node .tools/auto-hermes-round-close.mjs --write --agent codex --task "<title>" --surface "<surface>" --owner "<owner>" --files "<f1>||<f2>" --verify "<verify-command>" --verify-result pass --architect-verdict approved --deslop-pass pass --regression-pass pass --verdict pass`
8. If verification fails, round-close with `--verdict fail --blocker "<reason>"`, then re-enter so the must-fix is picked up.
9. If the task came from a GitHub issue, close it after verified completion with `.tools/auto-hermes-issues.mjs` and include `(closes #N)` in the commit message when committing.

### Re-Enter Or Stop

After every round:

1. Run `node .tools/auto-hermes-self-loop.mjs --write --json --runtime codex`.
2. Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md`.
3. If `Next Action` is `loop-owner-execute-round` or `codex-coordinator-execute-round`, go directly into the next round. Do not wait for the user.
4. If `Next Action` is `stop`, route through the configured finish behavior and report the stop reason.

### Auto-Publish On Stop

On a true clean stop, use the configured Hermes finish path rather than ad-hoc Git commands:

- Run `.tools/auto-hermes-finish.mjs` or the current finish helper emitted by the coordinator.
- Auto-commit only when the finish helper says product files changed and proof gates passed.
- Auto-push only when the repo policy allows it: unpublished local commits, current branch, and `origin` still equals `https://github.com/520HXC/run.git`.
- If no product files changed, report `Loop stopped - no product changes to publish.`
- If publish is blocked by security, compile, auth, or dirty-state gates, report the blocker and stop.

## Ralph Strength Gates

- A single successful bounded round is never the natural completion condition for `/auto-hermes-self`.
- Count a round as complete only after `.tools/auto-hermes-round-close.mjs` records real gate evidence.
- Stop only on a real gate: human pause/stop/must-ask, repeated website-audit exhaustion, same-task no-progress loop, executor unavailable after configured retries, or unsafe recovery needing human input.
- For the course-map extraction mission, the real stop gate is live extracted route geometry on runner OpenStreetMap with non-empty `routePoints`; keep diagnosing and repairing Qwen/CV/georeference/publish failures until that proof exists.
