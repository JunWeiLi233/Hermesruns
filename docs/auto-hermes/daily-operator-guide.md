# Auto-Hermes Daily Operator Guide

Use this guide for everyday local operation of the Hermes autonomous loops.

## Recommended Workspace

- Day-to-day feature work should run from a dedicated worktree, not a dirty primary workspace.
- Use a local path outside your primary checkout, for example:
  - `<path-to-your-Hermes-checkout>/.worktrees/continuous-website-audit-loop`

## Daily Use

### `/auto-hermes`

Use when you want one continuous bounded improvement loop that can pull work from the queue and, when needed, fall back to website audit.

Typical operator flow:

1. Refresh repo context:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/generate-codex.js
& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent codex --tasks TASKS.md --guide AGENTS.md --queue-mode first --write
powershell -ExecutionPolicy Bypass -File .tools/mempalace/auto-session-sync.ps1 -Quiet
& 'C:\Program Files\nodejs\node.exe' .tools/omx-auto-hermes-bridge.mjs
```

2. Start the standard loop:

```text
/auto-hermes
```

3. Expected behavior:
- active queue work runs first
- if the queue is truly empty, website audit tries to produce one bounded next task
- only repeated no-candidate audit rounds are allowed to end the loop

### `/auto-hermes-max`

Use when you want the same behavior but through the parent coordinator and lane planner.

Start it with:

```text
/auto-hermes-max
```

Or with a bounded seed goal:

```text
/auto-hermes-max improve races detail trust
```

## Sample `/auto-hermes-max` Flow

This is the exact high-level flow for a no-argument run:

1. Session bootstrap:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/generate-codex.js
& 'C:\Program Files\nodejs\node.exe' .tools/optimize-agent-context.mjs --agent codex --tasks TASKS.md --guide AGENTS.md --queue-mode first --write
powershell -ExecutionPolicy Bypass -File .tools/mempalace/auto-session-sync.ps1 -Quiet
& 'C:\Program Files\nodejs\node.exe' .tools/omx-auto-hermes-bridge.mjs
```

2. Parent planner:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-max.mjs --write --runtime codex-live
```

3. If queue work exists:
- planner emits normal lane launch state

4. If queue work does not exist:
- planner runs website-audit fallback
- if one bounded candidate is found, planner emits a one-lane parent goal instead of `stop-exhausted`
- if no candidate is found repeatedly, only then does exhaustion become final

5. Parent iteration helper:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-max-loop.mjs --write --runtime codex-live --dry-run
```

6. Merge/reassessment:
- after child lane execution, merge state is refreshed and the parent reassesses whether another bounded round exists

## Expected `.ai-sync` Artifacts

For one sample `/auto-hermes-max` run, expect these artifacts:

### Queue / controller

- `.ai-sync/AUTO_HERMES_CONTROLLER.json`
- `.ai-sync/AUTO_HERMES_CONTROLLER.md`
- `.ai-sync/AUTO_HERMES_PROMOTION.json`
- `.ai-sync/AUTO_HERMES_PROMOTION.md`

### Standard loop

- `.ai-sync/AUTO_HERMES_LOOP.json`
- `.ai-sync/AUTO_HERMES_LOOP.md`
- `.ai-sync/AUTO_HERMES_LOOP_STATE.json`
- `.ai-sync/AUTO_HERMES_COORDINATOR.json`
- `.ai-sync/AUTO_HERMES_COORDINATOR.md`

### Max parent loop

- `.ai-sync/AUTO_HERMES_MAX.json`
- `.ai-sync/AUTO_HERMES_MAX.md`
- `.ai-sync/AUTO_HERMES_MAX_COORDINATOR.json`
- `.ai-sync/AUTO_HERMES_MAX_COORDINATOR.md`
- `.ai-sync/AUTO_HERMES_MAX_LOOP.json`
- `.ai-sync/AUTO_HERMES_MAX_LOOP.md`
- `.ai-sync/AUTO_HERMES_MAX_LOOP_BRIEF.json`
- `.ai-sync/AUTO_HERMES_MAX_LOOP_BRIEF.md`
- `.ai-sync/AUTO_HERMES_MAX_MERGE.json`
- `.ai-sync/AUTO_HERMES_MAX_MERGE.md`
- `.ai-sync/AUTO_HERMES_MAX_EXPLORER.json`
- `.ai-sync/AUTO_HERMES_MAX_EXPLORER.md`

### Website audit

- `.ai-sync/AUTO_HERMES_WEBSITE_AUDIT.json`
- `.ai-sync/AUTO_HERMES_WEBSITE_AUDIT.md`

These appear when queue exhaustion hands off to website audit and a bounded fallback candidate is evaluated.

### Run-state / continuity

- `.ai-sync/auto-hermes-run-state/*.json`

These are the durable run records used by the new run-state helper.

### Trace / learning

- `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json`
- `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md`
- `.ai-sync/trace-to-skill/rounds/*.json`
- `.codex/skills/auto-hermes-evolved/SKILL.md`
- `.codex/skills/auto-hermes-evolved/references/edge-cases.md`

The evolved trace skill is refreshed automatically from repo-side round evidence and loaded back into `/auto-hermes` worker/coordinator briefs as advisory guidance only.

## Practical Notes

- Empty queue is no longer the first stop condition in the copied implementation.
- Website audit is now the first fallback for both standard and max loops.
- Non-empty queue situations like claim contention must not be counted as website-audit exhaustion.
- The supervisor file exists as a bounded continuity skeleton:
  - `.tools/auto-hermes-supervisor.mjs`
- It models the intended long-running continuity layer, but the live max path is not yet fully routed through it.

## Fast Verification

Run this from the repo root after copying/updating the local helper surfaces:

```powershell
& 'C:\Program Files\nodejs\node.exe' .tools/auto-hermes-tools.test.mjs
```

Expected:
- all tests `PASS`
- website-audit fallback tests
- standard and max loop exhaustion tests
- supervisor/doc contract tests
