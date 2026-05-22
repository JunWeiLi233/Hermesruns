# Auto-Hermes Trace-to-Skill Design

## Goal

Make `/auto-hermes` evolve its workflow from real Hermes execution traces instead of only from hand-written workflow edits.

## Scope

This is a staged rollout.

Stage 1 adds a deterministic trace-to-skill pipeline:
- round-close writes compact per-round trace packets
- a repo-side helper runs four analyst-style passes over those packets
- the helper merges repeated evidence into workflow-rule candidates
- controller/coordinator surfaces that output as a soft signal only

Stage 2 can later harden that signal into a stricter promotion gate after enough real run evidence exists.

## Design

### 1. Trace packets

Every meaningful `/auto-hermes` round should leave behind a compact packet under `.ai-sync/trace-to-skill/rounds/`.

Each packet should capture only durable evidence needed for workflow evolution:
- task, surface, files, problem class, route shape
- verdict, review result, blocker, runtime proof, verification summary
- self-check outcome
- promotion decision
- small derived fingerprints for repeated-success and repeated-failure clustering

This keeps the evidence layer agent-readable without scraping old chat.

### 2. Four analyst passes

Add a deterministic helper that reads the trace packets and produces four analyst outputs inspired by the article:
- `errorAnalyst`: repeated failure roots and preventive rules
- `successAnalyst`: repeated success behaviors worth codifying
- `structureAnalyst`: sequencing/verification/order patterns
- `edgeAnalyst`: defensive checks for blocked or must-fix rounds

These are repo-side heuristic analysts, not a claim that Hermes is already running a full LLM trace lab.

### 3. Merge layer

The same helper should merge overlapping analyst findings into a bounded set of evidence-backed workflow candidates with:
- rule text
- evidence count
- supporting round ids
- severity / confidence
- status: `soft-signal`

Rules with weak evidence stay informational. Repeated evidence becomes a candidate for future workflow updates.

### 4. Soft evidence gate

The controller/coordinator should read the merged trace-to-skill output and expose:
- whether workflow evolution ideas are evidence-backed
- the strongest current candidate rules
- that the signal is advisory only for now

This must not block normal product execution yet.

## Owners

Smallest owner files for this stage:
- `.tools/auto-hermes-round-close.mjs`
- new `.tools/auto-hermes-trace-to-skill.mjs`
- `.tools/auto-hermes-controller.mjs`
- `HERMES_SELF_EVOLVING_ENGINE.md`
- `.codex/workflows/auto-hermes-architecture.md`

## Non-Goals

- No hard workflow mutation gate yet
- No retroactive chat-log scraping
- No automatic editing of workflow docs from the helper
- No claim that Codex is natively running the exact article workflow

## Success Criteria

- Round-close emits usable trace packets automatically
- The trace helper produces analyst sections plus merged rule candidates
- Controller output shows the soft evidence-backed signal
- Docs describe trace-to-skill as the preferred way to justify workflow evolution
