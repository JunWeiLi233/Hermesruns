# Self-Evolving Auto-Hermes Design

**Date:** 2026-04-16
**Status:** Approved
**Approach:** Layered Evolution (Reliability → Observation → Adaptation → Discovery)

## Problem

Auto-hermes has self-loop and self-evolution mechanisms in concept but not in practice:
- `SELF_EVOLVING_AUDIT.md` is empty — no meta-observations are recorded
- Executor crashes terminate the loop with no recovery
- No persistent loop state across process restarts
- Gate parameters (SIG, FIG, CPG, SE-7) are fixed text, not adaptive
- `suggest-tasks.mjs` uses a hardcoded screen list — new pages are invisible
- Round scorecards are keyword-based, not measurement-based
- No automatic rollback — only records targets, doesn't execute
- No state file health checks or self-healing
- HUMAN_LOOP blocks the loop on `pause`, `stop`, `must-ask`

## Goal

Transform auto-hermes into a fully autonomous, self-evolving system that:
1. Never crashes without recovery (Layer 1: Resilience)
2. Measures its own performance with real data (Layer 2: Self-Observation)
3. Tunes its own parameters based on measured outcomes (Layer 3: Self-Tuning)
4. Discovers and resolves problems without human intervention (Layer 4: Self-Discovery)

Human intervention is only required for destructive/irreversible actions. All other decisions are autonomous.

---

## Layer 1: Resilience

### 1.1 Persistent Loop State

**File:** `auto-hermes-loop-state.json`

The loop writes a checkpoint after every round. On startup, the loop reads this file. If `status: executing` and `resumable: true`, it resumes from the last checkpoint instead of starting fresh.

```json
{
  "loopId": "loop-2026-04-16-001",
  "currentRound": 7,
  "maxRounds": 24,
  "status": "executing",
  "currentTask": "fix-race-detail-recovery",
  "roundHistory": [
    {
      "round": 6,
      "task": "fix-translation-sync",
      "verdict": "pass",
      "duration_s": 38,
      "files_changed": 2,
      "promoted_to": "tech-debt"
    }
  ],
  "stallCounter": 0,
  "runawayCounter": 0,
  "lastCheckpoint": "2026-04-16T10:30:00Z",
  "resumable": true,
  "preRoundCommit": "abc1234"
}
```

On crash, a health-check marks `status: crashed`. The next run detects this and resumes.

**New files:** `auto-hermes-loop-state.json`, update `auto-hermes-loop.mjs` to read/write state
**Modified files:** `auto-hermes-loop.mjs`, `auto-hermes-round-close.mjs`

### 1.2 Executor Crash Recovery

On executor failure:
1. Write partial result if any
2. Retry with exponential backoff (0s, 30s, 120s, max 3 attempts)
3. If all retries fail, mark round as `executor-unavailable`
4. Write checkpoint with `resumable: true`
5. Continue with next promotable task
6. Re-promote the failed task in the next promotion cycle

The loop does NOT terminate on executor failure. It degrades gracefully and continues.

**Modified files:** `auto-hermes-loop.mjs`

### 1.3 State File Health Checks

**New file:** `auto-hermes-health-check.mjs`

Runs at every loop startup:
1. Schema validation — each state file must parse to expected structure
2. Referential integrity — active claims in AGENT_SYNC reference tasks in TASKS
3. Freshness check — context capsules older than 7 days get flagged
4. Auto-healing — minor corruption (missing sections, stale writebacks) gets silently repaired
5. Backup — before repair, write broken state to `.ai-sync/backups/` with timestamp
6. Major corruption — write diagnostic to `SELF_EVOLVING_AUDIT.md` and pause with structured error

**New files:** `auto-hermes-health-check.mjs`
**Modified files:** `auto-hermes-loop.mjs` (integrate health check at startup)

### 1.4 Automatic Rollback

**New file:** `auto-hermes-rollback.mjs`

Before each round, record current git HEAD as `preRoundCommit`. On `reverse-recommended` or `must-fix` requiring revert:
- If changed files ≤ 5 and all are product files → auto-revert
- If changed files > 5 or include shared contracts → emit rollback brief, do NOT auto-revert
- After rollback, refresh loop state and promote next task

Auto-revert uses `git diff --name-only preRoundCommit..HEAD` to identify changes, then `git checkout preRoundCommit -- <files>` for the safe case.

**New files:** `auto-hermes-rollback.mjs`
**Modified files:** `auto-hermes-round-close.mjs` (integrate rollback for must-fix/reverse verdicts)

### 1.5 HUMAN_LOOP Redesign: Autonomous-First

**New file:** `auto-hermes-human-loop.json`

Replace freeform markdown with structured JSON. Default mode is autonomous:

```json
{
  "mode": "autonomous",
  "safety_brakes": {
    "destructive_actions": "require_human",
    "irreversible_changes": "require_human",
    "everything_else": "auto_proceed"
  },
  "human_requests": [],
  "priority_overrides": [],
  "reversal_requests": [],
  "agent_writeback": {
    "last_action": "",
    "next_action": "",
    "risk_level": "low"
  }
}
```

Key changes:
- Default is autonomous — loop continues unless a safety brake is triggered
- Safety brakes are explicit: only destructive actions (DB migrations, deletions, force pushes) and irreversible changes require human confirmation
- `must-ask` is removed as default loop-stopper
- Human can still override via `priority_overrides` and `reversal_requests`
- Each round computes a risk level (`low`/`medium`/`high`). Only `high` risk pauses automatically
- Backward compatible: existing `HUMAN_LOOP.md` continues to work; the new JSON takes precedence when present

**New files:** `auto-hermes-human-loop.json`
**Modified files:** `auto-hermes-controller.mjs` (read new JSON first, fallback to markdown), `HERMES_SELF_EVOLVING_ENGINE.md`, `AGENTS.md`

---

## Layer 2: Self-Observation

### 2.1 Activate SELF_EVOLVING_AUDIT.md

After every round, the round-close helper writes a structured observation:

```markdown
## Round 7 — 2026-04-16

- Task: fix-race-detail-recovery
- Verdict: pass
- Duration: 45s
- Tokens: 12,400
- Promotion path: active → tech-debt
- Gate package: minor-fix (EG+SP+tiny QA)
- Complexity score: 2
- Problem class: frontend-logic
- Execution shape: single-agent
- Self-check: pass
- Stall counter: 0
- Runaway counter: 0

### Observation
- Frontend-logic rounds averaging 38s, down from 52s last week
- suggest-tasks produced 3 new candidates this cycle
- No must-fix verdicts in last 5 rounds

### Candidate Workflow Fix
— none this round
```

Records what happened, not what to change. Adjustment is Layer 3.

**Modified files:** `auto-hermes-round-close.mjs` (write observations to audit file)

### 2.2 Measurement-Backed Scorecards

Replace keyword-based grades (A/B/C/D) with numeric scores (0-100):

| Dimension | Measurement Method |
|---|---|
| `hallucination_control` | Claims without file reference vs. claims with verified reference |
| `task_achievability` | Did the round produce a verify command that passes? Binary |
| `task_completeness` | Percentage of `Done when:` conditions satisfied |
| `verification_reliability` | Did the `Verify:` step actually run and pass? Binary |
| `promotion_accuracy` | Of promoted follow-ups, % that became completed tasks within 3 rounds |
| `time_efficiency` | Wall time per round vs. 7-day moving average for same problem class |

Track moving averages per dimension per problem class in telemetry.

**Modified files:** `auto-hermes-round-close.mjs` (replace letter grades with numeric scores)

### 2.3 Per-Round Telemetry

**New file:** `auto-hermes-telemetry.json`

```json
{
  "rounds": [
    {
      "round": 7,
      "task": "fix-race-detail-recovery",
      "problemClass": "frontend-logic",
      "executionShape": "single-agent",
      "verdict": "pass",
      "duration_s": 45,
      "files_changed": 3,
      "must_fix_count": 0,
      "gate_package": "minor-fix",
      "complexity_score": 2,
      "promotion_type": "tech-debt",
      "timestamp": "2026-04-16T10:30:00Z"
    }
  ],
  "moving_averages": {
    "frontend-logic": {
      "avg_duration_s": 38,
      "avg_verdict_pass_rate": 0.85,
      "avg_promotion_accuracy": 0.72
    },
    "backend-logic": {
      "avg_duration_s": 62,
      "avg_verdict_pass_rate": 0.78,
      "avg_promotion_accuracy": 0.65
    }
  }
}
```

**New files:** `auto-hermes-telemetry.json`
**Modified files:** `auto-hermes-round-close.mjs` (append telemetry), `auto-hermes-loop.mjs` (read telemetry for routing)

### 2.4 Problem Discovery Seed

Seed for Layer 4, producing data in Layer 2 for observation:

1. **Dynamic screen discovery:** Parse `App.jsx` route definitions → extract page components → auto-register new pages (replaces hardcoded `SCREEN_INTENTS`)
2. **Test failure integration:** Read JUnit XML and Vitest JSON results → map failing tests to source files → create task candidates
3. **Lint/compile warning ingestion:** Parse lint and compile warnings → map to source files → create task candidates

**Modified files:** `suggest-tasks.mjs` (add dynamic discovery sources)

---

## Layer 3: Self-Tuning

### 3.1 Configurable Gate Parameters

**New file:** `auto-hermes-config.json`

All tunable parameters live in one config file. Existing tools read from this config instead of hardcoded values. Initial values match current hardcoded defaults.

Sections:
- `gates` — gate packages and complexity thresholds per round classification
- `complexity` — weights for each complexity factor and tech-debt threshold
- `promotion` — priority weights for each promotion category
- `loop` — round limits, stall thresholds, runaway thresholds, retry counts
- `routing` — thresholds for single-agent / specialist / parallel routing
- `rollback` — auto-revert file limits and safety constraints
- `human_gate` — mode, which actions require human, risk level thresholds

**New files:** `auto-hermes-config.json`, `auto-hermes-config-history.json`
**Modified files:** `auto-hermes-controller.mjs`, `auto-hermes-loop.mjs`, `auto-hermes-round-close.mjs`, `HERMES_SELF_EVOLVING_ENGINE.md` (reference config instead of hardcoded values)

### 3.2 Evolution Engine

**New file:** `auto-hermes-evolve.mjs`

The adaptation kernel. Runs after every 5 completed rounds (configurable):

Cycle: **observe → diagnose → propose → apply → verify → record**

1. **Observe:** Read `auto-hermes-telemetry.json` for last N rounds. Compute moving averages, trends, per-problem-class patterns.

2. **Diagnose:** Compare against baseline thresholds:
   - `must-fix` rates spike for a problem class → increase gate strictness
   - `pass` rates > 90% with low complexity → relax gates for minor-fix
   - `stall_counter` increases → increase `max_same_work_unit_repeats`
   - `runaway_counter` triggers frequently → increase `runaway_threshold`
   - Average duration increases > 2x baseline → flag for investigation
   - `promotion_accuracy` drops below 50% → tighten promotion priority gaps

3. **Propose:** Generate concrete adjustment with `proposal_id`, `based_on_rounds`, `changes` (path/from/to/reason), `confidence`, `rollback_to`.

4. **Apply:** Write changes to `auto-hermes-config.json`. Record pre-change config in `auto-hermes-config-history.json`.

5. **Verify:** After next 5 rounds, check whether adjustment improved targeted metric:
   - Improvement ≥ 10% → keep, record as successful evolution
   - No change → keep for 5 more rounds, then revert if still no improvement
   - Regression ≥ 10% → immediately revert, record as failed evolution

6. **Record:** Write to `SELF_EVOLVING_AUDIT.md`.

**New files:** `auto-hermes-evolve.mjs`
**Modified files:** `auto-hermes-round-close.mjs` (trigger evolve every 5 rounds)

### 3.3 Safety Constraints

Hard limits the evolution engine can never exceed:

| Parameter | Minimum | Maximum | Step Size |
|---|---|---|---|
| `max_rounds` | 12 | 48 | 4 |
| `max_same_work_unit_repeats` | 2 | 6 | 1 |
| `runaway_threshold` | 2 | 5 | 1 |
| `complexity.tech_debt_threshold` | 3 | 7 | 1 |
| `promotion.*_priority` | 10 | 100 | 10 |
| `routing.*_threshold` | 0.1 | 0.9 | 0.05 |
| `rollback.auto_revert_max_files` | 3 | 10 | 1 |

Safety rules:
- No single adjustment can change more than 3 parameters at once
- No parameter can change by more than 1 step size per evolution cycle
- If any verification shows regression ≥ 25%, all recent changes in that cycle are reverted
- Human gate thresholds (destructive/irreversible require human) are never auto-adjusted — hard safety boundary

### 3.4 Adaptive Routing

Routing thresholds come from config and evolve based on measured success rates:

- Track success rate per execution shape per problem class
- If `single-agent` for `frontend-logic` has >85% pass rate → keep routing light
- If `single-agent` for `cross-stack-contract` has <60% pass rate → bump to `one-specialist` or `parallel-builders`
- Routing adjustments follow same observe → diagnose → propose → apply → verify cycle

**New file:** `auto-hermes-routing-stats.json` (per-shape success rates)

---

## Layer 4: Self-Discovery

### 4.1 Dynamic Problem Discovery

**New file:** `auto-hermes-discover.mjs`

Replaces static `SCREEN_INTENTS` with dynamic discovery from 6 sources:

1. **Route-based discovery:** Parse `App.jsx` route definitions → extract page components → auto-register new pages
2. **Test failure discovery:** Parse JUnit XML + Vitest JSON → map failing tests to source files → create task candidates
3. **Lint/compile warning discovery:** Parse lint + compile warnings → map to source files → create task candidates
4. **Git-blotch discovery:** Files changed in >50% of recent commits → flag as hotspots → create task candidates
5. **Dead-code discovery:** Exports not imported anywhere, unreachable routes, unused components → create task candidates
6. **Dependency drift discovery:** `npm audit` + vulnerable dependency versions → create task candidates

Each source produces task candidates in standard TASKS.md format with `Files:`, `Context:`, `Done when:`, `Verify:`.

**New files:** `auto-hermes-discover.mjs`
**Modified files:** `suggest-tasks.mjs` (integrate discovery sources)

### 4.2 Semantic Gap Detection

Lightweight semantic analysis at two levels:

1. **API contract gaps:** Parse `@Controller` endpoints ↔ frontend API calls → surface missing error handling, missing loading states, or orphaned endpoints
2. **Feature coverage gaps:** Parse route definitions ↔ page components ↔ rendered sections → surface pages with missing empty/error/loading states

Runs as part of `suggest-tasks`, powered by discovery sources.

### 4.3 Self-Healing Problem Resolution

Low-severity high-confidence problems bypass the queue:

| Confidence | Severity | Action |
|---|---|---|
| High | Low | Auto-fix and verify (dead imports, missing translations, lint auto-fix) |
| High | Medium | Create task and auto-promote to Active |
| Medium | Any | Create task in Suggested, normal promotion |
| Low | Any | Create task in Suggested with lower priority |

Auto-fix criteria:
- Fix is deterministic (not creative/design)
- Fix affects exactly 1 file
- Fix can be verified by a single command
- Risk level is `low` per HUMAN_LOOP config

Auto-fixes follow the same round lifecycle: claim → execute → verify → write back.

### 4.4 Continuous Health Monitoring

**New file:** `auto-hermes-health-monitor.mjs`

Runs alongside the loop, producing a health dashboard:

```json
{
  "last_check": "2026-04-16T10:30:00Z",
  "checks": {
    "state_files": "healthy",
    "git_repo": "clean",
    "test_suite": "1_failure",
    "lint": "2_warnings",
    "loop_state": "executing",
    "config_drift": false
  },
  "alerts": [
    {
      "type": "test_failure",
      "severity": "medium",
      "source": "backend/src/test/...",
      "auto_fixable": true
    }
  ]
}
```

When health degrades:
- **Degraded but functional** → log observation, continue loop
- **Partially broken** → pause current round, attempt auto-repair, resume
- **Broken** → pause loop, write diagnostic, emit coordinator brief for human attention on truly unresolvable failures only

**New files:** `auto-hermes-health-monitor.mjs`

---

## File Changes Summary

### New Files (Layer 1)

| File | Purpose |
|---|---|
| `auto-hermes-loop-state.json` | Persistent loop state for crash recovery and resume |
| `auto-hermes-health-check.mjs` | State file validation and auto-repair |
| `auto-hermes-rollback.mjs` | Safe automated rollback for bad rounds |
| `auto-hermes-human-loop.json` | Autonomous-first human gate (replaces freeform markdown) |

### New Files (Layer 2)

| File | Purpose |
|---|---|
| `auto-hermes-telemetry.json` | Per-round measurements and moving averages |

### New Files (Layer 3)

| File | Purpose |
|---|---|
| `auto-hermes-config.json` | All tunable parameters in one place |
| `auto-hermes-config-history.json` | Rollback safety for config changes |
| `auto-hermes-evolve.mjs` | The adaptation kernel (observe → diagnose → propose → apply → verify) |
| `auto-hermes-routing-stats.json` | Per-shape success rates for adaptive routing |

### New Files (Layer 4)

| File | Purpose |
|---|---|
| `auto-hermes-discover.mjs` | Dynamic problem discovery from 6 sources |
| `auto-hermes-health-monitor.mjs` | Continuous health monitoring dashboard |

### Modified Files

| File | Changes |
|---|---|
| `auto-hermes-loop.mjs` | Persistent state read/write, crash recovery, retry logic, health check integration, telemetry read |
| `auto-hermes-controller.mjs` | Read from config instead of hardcoded values, read human-loop JSON, routing from config |
| `auto-hermes-round-close.mjs` | Write observations to audit, numeric scorecards, telemetry append, trigger evolve every 5 rounds |
| `suggest-tasks.mjs` | Replace SCREEN_INTENTS with dynamic discovery, integrate test/lint/git sources |
| `HERMES_SELF_EVOLVING_ENGINE.md` | Reference config file instead of hardcoded rules, document evolution engine |
| `AGENTS.md` | Update human gate references, document autonomous-first mode, reference new files |
| `.codex/workflows/auto-hermes-architecture.md` | Document resilience layer, persistent state, crash recovery |

---

## Implementation Order

Build in strict dependency order:

1. **Layer 1: Resilience** (foundation — makes everything else safe to build on)
   - 1.1 Persistent loop state
   - 1.2 Executor crash recovery
   - 1.3 State file health checks
   - 1.4 Automatic rollback
   - 1.5 HUMAN_LOOP redesign

2. **Layer 2: Self-Observation** (measurement — gives Layer 3 data to tune)
   - 2.1 Activate SELF_EVOLVING_AUDIT.md
   - 2.2 Measurement-backed scorecards
   - 2.3 Per-round telemetry
   - 2.4 Problem discovery seed (dynamic screen list)

3. **Layer 3: Self-Tuning** (adaptation — tunes itself based on Layer 2 data)
   - 3.1 Configurable gate parameters
   - 3.2 Evolution engine
   - 3.3 Safety constraints
   - 3.4 Adaptive routing

4. **Layer 4: Self-Discovery** (problem finding — uses Layer 1-3 as safe infrastructure)
   - 4.1 Dynamic problem discovery
   - 4.2 Semantic gap detection
   - 4.3 Self-healing problem resolution
   - 4.4 Continuous health monitoring

Each layer has verification criteria before moving to the next:
- **Layer 1:** Loop survives executor crash, resumes from checkpoint, auto-repairs state files, auto-reverts bad rounds
- **Layer 2:** Telemetry accumulates, scorecards produce numeric data, SELF_EVOLVING_AUDIT.md has real observations
- **Layer 3:** Evolution engine produces at least 1 verified config adjustment, routing adapts to measured success rates
- **Layer 4:** Discovery engine finds problems not in hardcoded lists, auto-fix resolves at least 1 high-confidence low-severity issue

---

## Safety Boundaries

These boundaries are never auto-adjusted:
- Human gate for destructive actions (`destructive_actions: require_human`)
- Human gate for irreversible changes (`irreversible_changes: require_human`)
- Evolution engine cannot modify safety constraint min/max values
- Evolution engine cannot change more than 3 parameters per cycle
- Evolution engine cannot change any parameter by more than 1 step size per cycle
- 25% regression triggers immediate full revert of the cycle's changes
- Auto-fix is limited to deterministic, single-file, low-risk fixes