# Auto-Hermes Decision Engine Design

**Date:** 2026-04-15
**Status:** Draft for review
**Owner:** Codex

## Goal

Create one shared decision engine for `/auto-hermes` and `/auto-hermes-max` so the agent can autonomously choose the best next round, execution shape, and merge posture on every loop iteration using a weighted balance of:

- user value
- regression risk
- completion speed

The engine must produce a recommendation every successful round unless a real stop gate applies.

## Why

Today, Auto-Hermes decision-making is split across several helpers:

- `.tools/auto-hermes-controller.mjs`
- `.tools/auto-hermes-round-close.mjs`
- `.tools/suggest-tasks.mjs`
- `.tools/auto-hermes-max.mjs`

That split creates drift:

- one helper may think the loop should continue while another reports `stop-exhausted`
- queue promotion can lag behind controller intent
- lane selection in max mode can use different heuristics from single-lane routing
- “best next task” is not computed from one explicit scoring model

The new design replaces fragmented local choices with one shared decision packet consumed by all workflow surfaces.

## Scope

This design covers:

- next-task selection for `/auto-hermes`
- route selection for `/auto-hermes`
- lane-count and lane-shape selection for `/auto-hermes-max`
- a deterministic fallback when confidence is low
- workflow tests proving the engine recommends one next round whenever promotable work exists

This design does not cover:

- replacing Hermes runtime proof gates
- replacing `HUMAN_LOOP.md`
- changing product-level scoring in `HERMES_SELF_EVOLVING_ENGINE.md`
- changing app behavior outside the Auto-Hermes control plane

## Decision Model

### Optimization target

Each candidate round is scored using a weighted balance:

- `45%` user value
- `35%` regression risk
- `20%` completion speed

Higher total score wins.

### Hard gates

A candidate is disqualified before scoring if any of these apply:

- human loop says `pause`, `stop`, or `must-ask`
- task is not promotable
  - missing concrete files
  - missing `Done when:`
  - missing `Verify:`
- file ownership is unsafe or overlapping for the intended route
- runtime truth requirements would be impossible or dishonest
- task is blocked by an unresolved must-fix

### Confidence model

The engine also produces a confidence score for the winning candidate.

Confidence should be high when:

- the task has concrete files, verify, and done-when
- the problem class is explicit or strongly inferable
- the route has low ambiguity
- recent context does not conflict with the choice

Confidence should be low when:

- multiple candidates score similarly
- ownership is fuzzy
- the candidate came from weak inference instead of explicit queue metadata
- the route depends on broad interpretation

Low confidence does not mean “stop.” It means “choose the safest winner and record why.”

## Architecture

### New shared helper

Add one new shared helper:

- `.tools/auto-hermes-decision-engine.mjs`

This helper becomes the single authority for:

- choosing the best task
- choosing the best route
- choosing the best lane count
- generating fallback behavior

### Consumers

These existing tools consume the decision engine instead of re-deciding locally:

- `.tools/auto-hermes-controller.mjs`
- `.tools/auto-hermes-round-close.mjs`
- `.tools/auto-hermes-max.mjs`

### Outputs

The engine emits one structured decision packet:

```json
{
  "decision": "continue-self-loop|stop-exhausted|pause-self-loop",
  "chosenTask": {
    "title": "...",
    "source": "active-task|suggested-task|tech-debt|generated-fallback",
    "surface": "...",
    "files": [],
    "problemClass": "frontend-design|backend-logic|cross-stack-contract|frontend-logic|workflow",
    "doneWhen": "...",
    "verify": "..."
  },
  "route": {
    "shape": "single-agent|single-specialist|pm-builder-reviewer|parallel-builders|paused",
    "recommendedAgents": [],
    "laneCount": 1,
    "parallelWorthIt": false
  },
  "score": {
    "total": 0,
    "userValue": 0,
    "regressionRisk": 0,
    "completionSpeed": 0
  },
  "confidence": {
    "score": 0,
    "band": "high|medium|low",
    "reason": "..."
  },
  "rejectedAlternatives": [
    {
      "title": "...",
      "reason": "..."
    }
  ],
  "fallbackIfLowConfidence": {
    "strategy": "best-safe-option",
    "reason": "..."
  }
}
```

## Candidate Sources

The engine should evaluate candidates in this order:

1. open `## Active Tasks`
2. promotable `## Suggested Next Tasks`
3. promotable `## Tech Debt Tasks`
4. analyzer output from `.tools/suggest-tasks.mjs`
5. generated fallback candidate from the just-finished surface if the first four are empty

The generated fallback should be bounded, concrete, and derived from:

- touched files
- recent verification output
- recent context ledger capsule
- product tier priority

If no candidate passes the hard gates, the decision may truthfully return `stop-exhausted`.

## Scoring Details

### User value

Higher score when the candidate:

- improves Tier 1 or Tier 2 Hermes value
- removes a trust gap
- improves a runner-facing decision
- strengthens a recently touched high-value surface

### Regression risk

Higher score means safer work.

Safer candidates:

- have narrow file scope
- have explicit tests or focused verification
- stay inside one surface/contract
- avoid shared contract files unless necessary

Lower safety:

- broad shared CSS/token rewrites
- auth, billing, persistence, or schema changes without focused verification
- multi-surface work with unclear ownership

### Completion speed

Higher score when the candidate:

- is small and local
- has existing data/hooks already available
- does not require a new backend contract
- does not require multi-lane coordination

## Route Selection Rules

The decision engine must choose route and task together.

Examples:

- `frontend-design` -> `pm-builder-reviewer` or `single-specialist` with reviewer support
- `backend-logic` -> backend specialist ownership, reviewer-backed when auth/validation/contracts/persistence are involved
- `cross-stack-contract` -> `parallel-builders` only when ownership is truly disjoint
- small workflow helper fix -> `single-agent`

The route output must remain compatible with the current Hermes routing language and truth gates.

## Max Mode Behavior

For `/auto-hermes-max`, the engine should decide:

- whether work is single-lane or multi-lane
- which scopes are parallel-safe
- whether the coordination cost is worth it

Parallel work is allowed only when:

- scopes are disjoint
- merge risk is manageable
- weighted score beats the best single-lane alternative

If not, the engine should explicitly choose:

- `laneCount: 1`
- `parallelWorthIt: false`
- rationale: `best single-lane option outscored parallel coordination`

## Low-Confidence Fallback

If the winning candidate is low confidence:

- do not stop automatically
- choose the safest top-ranked option
- mark the decision as `best-safe-option`
- record why higher-value or faster options were rejected

This preserves autonomy while staying truthful.

## Files To Change

### Create

- `.tools/auto-hermes-decision-engine.mjs`

### Modify

- `.tools/auto-hermes-controller.mjs`
- `.tools/auto-hermes-round-close.mjs`
- `.tools/auto-hermes-max.mjs`
- `.tools/auto-hermes-tools.test.mjs`

Possibly:

- `.codex/commands/auto-hermes.md`
- `.codex/commands/auto-hermes-max.md`

Only if wording must be aligned with the new decision packet semantics.

## Test Plan

Add focused workflow tests for:

1. chooses one active-task winner when multiple valid tasks exist
2. prefers higher user value when regression risk is similar
3. prefers safer candidate when higher-value candidate is low-confidence and risky
4. outputs one next task after a successful round-close whenever promotable work exists
5. chooses backend-specialist route for explicit `backend-logic`
6. chooses design-review route for explicit `frontend-design`
7. picks `laneCount: 1` when parallel coordination is not worth it
8. picks `laneCount: 2+` only when scopes are disjoint and score beats single-lane execution
9. returns truthful `stop-exhausted` only when no promotable candidate exists

## Risks

- If scoring is too opaque, debugging future loop choices becomes difficult.
- If fallback generation is too aggressive, the engine may recommend weak speculative work.
- If controller and round-close do not consume the same packet, drift returns.

## Mitigations

- keep score components explicit in JSON output
- record rejected alternatives and why they lost
- keep hard gates separate from weighted score
- make `generated-fallback` candidates visibly labeled as such
- test controller, round-close, and max mode against the same helper

## Recommendation

Implement the shared decision engine as the single authority and keep existing helpers as thin consumers.

This gives Auto-Hermes real autonomous choice every round while staying truthful:

- it chooses on its own when confidence is high
- it still chooses on its own when confidence is low, but picks the safest optimized option
- it only stops when no promotable work truly remains
