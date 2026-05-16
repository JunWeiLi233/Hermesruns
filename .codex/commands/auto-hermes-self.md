---
name: auto-hermes-self
description: Use when you need the Ralph-style indefinite self-loop variant of auto-hermes to continue until a real stop condition.
---

# Auto-Hermes Self

Codex active execution playbook for the true Ralph self-loop version of `/auto-hermes`.

This mirrors the stronger team-execution contract, adapted for Codex: `/auto-hermes-self` is not a prepare-and-wait note. Codex owns the full cycle when invoked here: initialize, select work, fan out Codex app custom subagents, verify, close the round, and re-enter until a real stop gate fires.

## Continuity Rules

- Empty queue does not immediately stop.
- If there is a promotable task, execute the next bounded round.
- If there is no promotable task, use the standard find-the-task path before stopping.
- Website-audit explorer is the final bounded fallback inside that discovery path.
- Repeated no-candidate audit rounds are the true stop condition.
- Supervisor is the preferred continuity layer for long-running runs.

## Command Notes

- Use `.tools/auto-hermes-self-loop.mjs` for the current Ralph-native indefinite self-loop owner behavior.
- Invoke it as `& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-self-loop.mjs --write --json --runtime codex`; `codex` is the Codex app custom-subagent self-executing runtime for Codex.
- Do not use `--runtime codex-live` as the Codex default. `codex-live` is a coordinator-awaiting mode when no executor is configured, so it can emit `codex-live-awaiting-coordinator` instead of self-executing work. If that status appears, rerun with `--runtime codex` or configure a real executor before claiming `/auto-hermes-self` executed.
- `/auto-hermes-self` is the true Ralph self-loop version of `/auto-hermes`: it keeps iterating until a real stop gate fires instead of treating a single bounded round as the finish state.
- Default Codex child-agent delegation for this command must use the Codex app custom subagent surface with `GPT-5.5` and medium reasoning effort.
- The Codex default is Codex-app-subagents-only: the console helper may emit briefs/state, but it must not launch worker subagents from PowerShell, Node, npm, or any other console wrapper.
- Record skill, plugin, or repo-local loader failures in `.ai-sync/error.md` with `.tools/auto-hermes-error-ledger.mjs`; self-loop coordinator briefs include the ledger summary, and round-close promotes open `blocker` or `error` entries into the next repair task before normal continuation.
- Browser-visible frontend work must wire in Browser Harness proof through the Hermes single-tab silent wrapper at `.tools/auto-hermes-browser.mjs` — never raw `browser-harness -c '...'` invocations. The wrapper consolidates duplicate Hermes tabs, reuses the survivor, and never calls `Target.activateTarget` / `Page.bringToFront`, so it cannot pop the browser to the foreground or pile up tabs across rounds. Subcommands: `cleanup` (close duplicates), `goto --url <url> --wait-ms <ms>`, `eval --js <expr>`, `screenshot --out <path>`, `status`, `reset`. Use `browser-use:browser` only when the in-app browser is the active localhost proof surface and the wrapper cannot reach it. Capture route URL, console summary, and screenshot/DOM evidence; do not claim browser proof if the wrapper or underlying skill is unavailable.
- Screenshots written to `task-images/` during a round are working-set artifacts, not durable evidence. Once the round-result packet records the path string, delete the files (`rm -f task-images/<round>-*.jpg task-images/<round>-*.png task-images/<lane>-*.json`) so the folder stays clean across rounds. Match by lane/round prefix only — never `rm task-images/*` blanket because parallel rounds may still need their captures. The folder is gitignored, so nothing here ever ships.
- Browser-visible frontend quality work must also load `.tools/auto-hermes-skills.mjs --json` and apply `web-quality-audit` from `https://officialskills.sh/addyosmani/skills/web-quality-audit` (GitHub: `https://github.com/addyosmani/web-quality-skills/tree/main/skills/web-quality-audit`): performance, accessibility, SEO, best practices, browser proof, console state, Lighthouse-style observations, Core Web Vitals, mobile responsiveness, and runtime proof gates.
- If Browser Harness or `.tools/auto-hermes-browser.mjs` is unavailable or blocked by local policy, use `.tools/auto-hermes-playwright.mjs` before recording a browser-proof blocker. The proof is valid only when it captures route URL, console summary, and screenshot/DOM evidence.
- Do not invoke OMX, Claude, Gemini, OpenCode, DeepSeek, or a local executor fallback for the worker round unless the user explicitly changes runtime.
- Keep the same Hermes queue, verification, runtime-proof, and finish contracts as `/auto-hermes`; only the loop ownership contract changes.
- Self-executing means the helper prepares the authoritative coordinator brief, the parent Codex app session dispatches Codex app custom subagents for every bounded round, then re-enters after round-close or empty-queue `continue` decisions.
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
5. If `Next Action` is `codex-app-dispatch-round`, the parent Codex app session dispatches Codex custom subagents from the coordinator/controller brief.

### Pre-Round Codex Integrity Gate

Before every Codex-executed round, verify the self-loop can still execute:

- Check whether the previous round touched loop-critical files: `.codex/commands/auto-hermes-self.md`, `.claude/commands/auto-hermes-self.md`, `.tools/auto-hermes-self-loop.mjs`, `.tools/auto-hermes-loop.mjs`, `.tools/auto-hermes-teamwork.mjs`, or `.tools/auto-hermes-browser.mjs`.
- Run `node --check .tools/auto-hermes-self-loop.mjs`, `node --check .tools/auto-hermes-loop.mjs`, `node --check .tools/auto-hermes-teamwork.mjs`, and `node --check .tools/auto-hermes-browser.mjs`.
- Also run `node --check .tools/auto-hermes-playwright.mjs` when browser proof is in scope.
- Run `node .tools/auto-hermes-self-loop.mjs --write --runtime codex --dry-run` and verify `.ai-sync/AUTO_HERMES_SELF_LOOP.json` has `selfExecutionContract: "codex-app-subagent-swarm"`.
- Verify `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md` contains `Codex Self-Loop Protocol (Active Execution)`, `codex-app-dispatch-round`, `spawn console commands: no`, and `Browser Harness Skill`.
- Verify `.ai-sync/error.md` exists after the self-loop owner runs. If it contains open `blocker` or `error` entries, fix those loader failures before dispatching product work.
- If any check fails, fix the loop mechanism before executing new product work. Record that repair in round-close evidence as `ralph-integrity-fix: <what changed>`.

### Round Execution

1. Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md` for the current work unit.
2. Read `.ai-sync/AUTO_HERMES_CONTROLLER.json` for the subagent plan, route, knowledge pack, files, and verification contract.
3. Execute the bounded round through Codex app custom subagents only. Use `GPT-5.5` with medium reasoning effort for each lane, run disjoint lanes in parallel, and keep the parent Codex app session focused on coordination, merge, verification, and round-close.
4. If the controller maps the work to only one lane, still spawn the owning Codex app specialist subagent; do not silently fall back to local parent execution.
5. Do not run subagents at the console. The console command only writes durable briefs/state, matching `/auto-hermes-max`; live child lanes are spawned through the Codex app custom subagent ability.
6. Run the required verification command from the task's `Verify:` field.
7. Run runtime proof gates when source changes affect a live frontend or backend surface.
8. For browser-visible frontend routes, console issues, or Leaflet/OpenStreetMap surfaces, run Browser Harness proof through `browser-harness` or `browser-use:browser` and attach the route URL, console summary, and screenshot/DOM observation to the round evidence.
   If Browser Harness is unavailable or blocked, run `.tools/auto-hermes-playwright.mjs` instead of treating browser proof as blocked.
9. Run the merge/review gate. Reviewer verdict must be explicit: `approve-next-round`, `must-fix-before-next-round`, or `reverse-recommended`.
10. Run round-close with real evidence:
   `node .tools/auto-hermes-round-close.mjs --write --agent codex --task "<title>" --surface "<surface>" --owner "<owner>" --files "<f1>||<f2>" --verify "<verify-command>" --verify-result pass --architect-verdict approved --deslop-pass pass --regression-pass pass --verdict pass`
11. If verification fails, round-close with `--verdict fail --blocker "<reason>"`, then re-enter so the must-fix is picked up.
12. If the task came from a GitHub issue, close it after verified completion with `.tools/auto-hermes-issues.mjs` and include `(closes #N)` in the commit message when committing.

### Re-Enter Or Stop

After every round:

1. Run `node .tools/auto-hermes-self-loop.mjs --write --json --runtime codex`.
2. Read `.ai-sync/AUTO_HERMES_SELF_COORDINATOR.md`.
3. If `Next Action` is `codex-app-dispatch-round`, go directly into the next round. Do not wait for the user.
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

## Team Assembly And Teamwork Bulletin (parity with Claude)

`/auto-hermes-self` is a team-execution playbook, not a solo run. Before dispatching Codex app custom subagents for a bounded round, the parent Codex app session must:

1. **Pick the roster from the task surface** using the same decision table the Claude playbook uses:
   - Frontend-only → frontend-agent + reviewer-agent (optional test-writer)
   - Backend-only → backend-agent + reviewer-agent (optional test-writer, security-auditor)
   - Cross-stack → frontend-agent + backend-agent + reviewer-agent (parallel only when ownership is disjoint; optional test-writer, code-reviewer, security)
   - Unknown cause → debugger first, then surface implementer, then reviewer
   - Refactor with no behaviour change → surface implementer + refactorer + reviewer + tests
   - Docs/runbook only → doc-writer + reviewer
   - Browser-visible runner-facing quality → surface implementer + customer-agent + reviewer
   - Auth/OAuth/billing/webhook/admin → surface implementer + security-auditor (mandatory) + reviewer

   Reviewer-agent always runs last. code-reviewer, QA Agent, and security-auditor are sequential-only.

2. **Open a fresh shared bulletin** at `.ai-sync/TEAMWORK.md` for the round:
   ```
   node .tools/auto-hermes-teamwork.mjs init \
     --round "<round id>" --goal "<one-line goal>" \
     --team "frontend:frontend-agent,backend:backend-agent,reviewer:reviewer-agent" \
     --owned "frontend=frontend/src/X.jsx;backend=backend/src/main/java/Y.java"
   ```

3. **Inject the teamwork preamble into every lane brief** so every dispatched Codex app custom subagent:
   - Reads `.ai-sync/TEAMWORK.md` before starting.
   - Posts a `status running` update via `node .tools/auto-hermes-teamwork.mjs status --role <role> --state running --now <text> --next <text> --blockers <text>`.
   - Appends a bulletin note (`status append --role <role> --note <text>`) for any decision a sibling needs to know.
   - Posts a final `status done` / `failed` / `blocked` and an `append` summary when finished.
   - Stays inside its owned files; if it needs sibling output, it appends a blocker note instead of touching the sibling's files.

4. **Coordinator obligations** mirror the Claude playbook: init at round start, append on dispatch + collect, close at round end via:
   ```
   node .tools/auto-hermes-teamwork.mjs close --verdict <approved|must-fix|blocked> --commits "<short-hashes>" --notes "<one-line>"
   ```

5. **Round-close gate addition:** the `.ai-sync/TEAMWORK.md` must have a non-empty `## Round Close` section before `auto-hermes-round-close.mjs` is invoked with `--verdict pass`. If the board was never opened (e.g. a failed pre-flight skipped step 2), record `ralph-integrity-fix: opened teamwork board retroactively` in the round-close evidence.

6. **Codex prohibition still applies inside the team:** the team must only contain Codex app custom subagents for Codex runs and Claude specialist subagents for Claude runs. Never mix runtimes inside a single team.

The helper is at `.tools/auto-hermes-teamwork.mjs`. It is loop-critical: any change to it must keep `node --check .tools/auto-hermes-teamwork.mjs` green and round-close evidence must include `ralph-integrity-fix:` for that file.
