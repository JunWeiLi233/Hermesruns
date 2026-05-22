# Auto-Hermes Invented Lanes Design

**Date:** 2026-04-16
**Status:** Proposed
**Owner:** Codex

## Goal

Make Codex-side `/auto-hermes` and `/auto-hermes-max` capable of inventing extra specialist lanes and extra parallel candidate lanes, with strict guardrails so the workflow stays truthful, bounded, and safe under concurrent thread loading.

## Why

The Claude-side Hermes workflow can behave more aggressively when it sees a bounded task that would benefit from added reviewer/debugger/support lanes or from splitting the task into additional parallelizable slices. The current Codex-side controller is stronger than before, but it still routes mostly from the explicit task shape and recommended agents. That means it can miss high-value extra lanes when:

- one bounded round would benefit from a supporting reviewer or debugger lane
- a frontend-heavy task also needs a narrow backend support lane
- `/auto-hermes-max` has enough information to invent additional parallel candidate lanes safely, but the current plan only reflects the obvious ones

The requested behavior is to let Codex invent those extra lanes too, but only when that invention is well-justified and safe.

## Non-Goals

- Do not let `/auto-hermes` explode into unbounded swarms.
- Do not let invented lanes overlap file ownership.
- Do not let invented lanes bypass same-task claim leasing.
- Do not let `/auto-hermes-max` fabricate lanes when confidence is weak.
- Do not turn invented lanes into theater; if they are not materially useful, the controller should stay with the current route.

## Design Summary

We will add a new deterministic controller-owned layer called `inventedLanePlan`.

The controller remains the only authority allowed to invent extra lanes. Neither the loop helper nor the max launcher invent lanes on their own. They only consume controller-approved invention output.

The controller may invent two classes of lanes:

1. Specialist/support lanes for `/auto-hermes`
- extra `reviewer-agent`
- extra `debugger-agent`
- extra support `frontend-agent` or `backend-agent`

2. Parallel candidate lanes for `/auto-hermes-max`
- extra candidate slices beyond the obvious initial task split
- only when the controller can name bounded ownership and dependency posture up front

## Architecture

### 1. Controller-Owned Invention

File: `.tools/auto-hermes-controller.mjs`

Add a deterministic invention step after base task classification and before final route/subagent-plan emission.

Inputs:
- current task metadata
- `problemClass`
- review sensitivity
- cross-stack contract signals
- explicit file list
- inferred stack ownership
- same-task live claim state
- currently active claims from `.ai-sync/AGENT_SYNC.*`

Outputs:
- `inventedLanePlan`
- updated `route`
- updated `subagentPlan`
- updated reasoning notes

The controller should only invent lanes when confidence is high. If confidence is weak, it must emit no invented lanes.

### 2. Loop Consumption

File: `.tools/auto-hermes-loop.mjs`

The loop helper should surface the invented-lane plan in:
- worker prompt
- coordinator brief
- claim-state narrative

The loop helper must not invent lanes itself. It only reflects controller decisions.

### 3. Max Launcher Consumption

File: `.tools/auto-hermes-max.mjs`

The max launcher should consume controller-approved invented candidate lanes and include them in the candidate set only when:
- ownership is explicit
- dependency posture is explicit
- candidate count remains within the hard cap

The launcher still owns final launch selection and may downshift lane count below the candidate count.

## Lane Types

### Specialist / Support Lanes

These are invented inside normal `/auto-hermes` rounds.

Allowed invented specialist lanes:
- `reviewer-agent`
- `debugger-agent`
- one support `frontend-agent`
- one support `backend-agent`

Use cases:
- backend logic round with contract/auth/validation risk -> add reviewer
- UI round with fragile behavior or repeated regression pattern -> add reviewer or debugger
- frontend-design round with small backend payload dependency -> add narrow backend support lane
- backend round whose only user-facing risk is one frontend contract edge -> add narrow frontend support lane

### Parallel Candidate Lanes

These are invented for `/auto-hermes-max`.

Each invented candidate lane must include:
- `laneId`
- `goal`
- `ownedFiles`
- `effort`
- `dependencyState`
- `problemClass`

Allowed dependency states:
- `parallel-ready`
- `sequential-after:<laneId>`
- `blocked-by-plan`

## Guardrails

### Global Guardrails

- One bounded primary work unit remains the parent task.
- Same-task claim leasing remains authoritative.
- No file may belong to two invented lanes.
- No invented lane may widen the task beyond the selected parent work unit.
- Invention is optional, never mandatory.

### `/auto-hermes` Guardrails

Maximum invented lanes:
- at most 2 extra specialist/support lanes

Recommended ceiling:
- one primary owner lane plus up to 2 invented supporting lanes

If more than 2 supporting lanes seem necessary, the controller should prefer escalating to `/auto-hermes-max` semantics instead of bloating a normal round.

### `/auto-hermes-max` Guardrails

Maximum invented parallel candidate lanes:
- enough to stay within the existing total candidate cap of 5

If invention would exceed the cap:
- keep the strongest candidates only
- mark the rest deferred or blocked-by-plan

## Invention Rules

### Rule A: Reviewer Invention

Invent `reviewer-agent` when any of these are true:
- `problemClass = backend-logic` and the task touches auth, validation, contract, response shape, persistence, or scheduler logic
- `problemClass = frontend-design`
- the task is marked review-sensitive
- a recent same-surface regression appears in `.ai-sync/AGENT_SYNC.md` or `.ai-sync/CONTEXT_LEDGER.md`

### Rule B: Debugger Invention

Invent `debugger-agent` when:
- the task looks like a bugfix or repeated regression
- root cause confidence is low
- verification pressure is high and the failure mode is unclear

Do not invent debugger lanes for obvious greenfield implementation.

### Rule C: Support Backend Invention

Invent support `backend-agent` for a frontend-led round only when:
- the main surface is frontend
- the backend dependency is narrow and explicit
- ownership can stay disjoint
- the backend lane is support-only, not a co-equal product lane

### Rule D: Support Frontend Invention

Invent support `frontend-agent` for a backend-led round only when:
- the task is mainly backend logic
- one frontend contract or rendering adjustment is clearly required
- ownership is disjoint and narrow

### Rule E: Parallel Candidate Invention

Invent extra `/auto-hermes-max` candidate lanes only when:
- at least 2 disjoint owned file groups can be named immediately
- each candidate is a coherent bounded slice
- merge complexity stays acceptable
- dependency posture is explicit

If any of those checks fail, do not invent the extra lane.

## Claiming and Concurrency

Existing same-task claim leasing under `.ai-sync/auto-hermes-claims/` remains the first concurrency guard.

Invented-lane behavior must also obey:
- if another thread already owns the same parent task, do not invent additional lanes for that same task in the losing thread
- `/auto-hermes-max` must not launch a duplicate invented candidate if an equivalent lane is already represented in fresh parent state
- controller output should distinguish:
  - `invented-but-not-selected`
  - `invented-and-selected`
  - `invented-but-blocked-by-live-claim`

## Data Model Changes

### Controller Result

Add:

```json
{
  "inventedLanePlan": {
    "enabled": true,
    "reason": "...",
    "specialistLanes": [
      {
        "agent": "reviewer-agent",
        "role": "support",
        "reason": "...",
        "ownedFiles": [],
        "dependencyState": "sequential-after:primary"
      }
    ],
    "parallelCandidateLanes": [
      {
        "laneId": "lane-review",
        "goal": "...",
        "ownedFiles": [],
        "problemClass": "backend-logic",
        "effort": "small",
        "dependencyState": "parallel-ready"
      }
    ]
  }
}
```

### Coordinator / Loop Briefs

Expose:
- invention enabled or not
- why invention happened
- which invented lanes were accepted
- which invented lanes were rejected and why

## Verification

### Tests

File: `.tools/auto-hermes-tools.test.mjs`

Add focused cases for:

1. reviewer invention on backend logic
2. debugger invention on unclear bugfix task
3. support backend invention on frontend-design plus contract-sensitive task
4. invented lane rejected when ownership overlaps
5. invented max candidate lane emitted only when disjoint ownership exists
6. same-task live claim suppresses invented lane execution in losing thread
7. launcher respects invention cap and dependency posture

### Smoke Checks

- `node .tools/auto-hermes-tools.test.mjs`
- `node .tools/auto-hermes-controller.mjs --json`
- `node .tools/auto-hermes-max.mjs --write --runtime codex-live --json`

## Files To Change

Primary code:
- `.tools/auto-hermes-controller.mjs`
- `.tools/auto-hermes-loop.mjs`
- `.tools/auto-hermes-max.mjs`
- `.tools/auto-hermes-tools.test.mjs`

Potential helper extraction if needed:
- `.tools/auto-hermes-lane-invention.mjs`

Docs:
- `.codex/commands/auto-hermes.md`
- `.codex/commands/auto-hermes-max.md`
- `.codex/workflows/hermes-multi-agent.md`
- `.codex/workflows/auto-hermes-architecture.md`

## Recommended Implementation Order

1. Implement deterministic invented-lane synthesis in the controller.
2. Reflect it in loop/coordinator briefs.
3. Feed invented parallel candidates into the max launcher.
4. Add focused tests.
5. Align docs last.

## Risks

- Over-invention causing noisy extra lanes
- Claimed-task duplication if invention bypasses claim state
- Support lanes quietly turning into overlapping co-owners
- Max launcher becoming too optimistic about weakly bounded slices

## Risk Mitigation

- Hard caps
- explicit ownership requirement
- explicit dependency posture requirement
- claim-aware suppression
- tests for overlap and same-task contention
- “stay local if uncertain” as the fallback

## Approval Checklist

This design is correct if:
- Codex `/auto-hermes` can invent extra specialist/support lanes
- Codex `/auto-hermes-max` can invent extra parallel candidate lanes
- the behavior stays deterministic and bounded
- no overlapping ownership is allowed
- same-task claim leasing still prevents duplicate execution
