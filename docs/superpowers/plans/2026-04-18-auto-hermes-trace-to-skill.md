# Auto-Hermes Trace-to-Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staged trace-to-skill pipeline so `/auto-hermes` can derive workflow-evolution signals from real round traces.

**Architecture:** Round-close writes compact trace packets into `.ai-sync/trace-to-skill/rounds/`. A new deterministic helper analyzes those packets through four analyst-style passes and merges repeated evidence into soft workflow candidates. Controller and owner docs expose that evidence as advisory input, not a hard gate.

**Tech Stack:** Node.js `.mjs` tooling, markdown/json artifacts, existing `.tools/auto-hermes-tools.test.mjs` harness

---

### Task 1: Add Red Tests For Trace-To-Skill Behavior

**Files:**
- Modify: `.tools/auto-hermes-tools.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add tests that expect:
- `runAutoHermesTraceToSkill` to emit analyst sections and merged rules from repeated packets
- `writeTracePacketArtifacts` to persist a round packet and refresh merged output
- `runAutoHermesController` to expose a soft `traceToSkill` signal when merged evidence exists

- [ ] **Step 2: Run the targeted test file to verify it fails**

Run: `node .tools/auto-hermes-tools.test.mjs`
Expected: FAIL on missing trace-to-skill exports / missing controller evidence field

### Task 2: Implement Trace-To-Skill Helper

**Files:**
- Create: `.tools/auto-hermes-trace-to-skill.mjs`

- [ ] **Step 1: Implement packet normalization and analyst passes**

Create exported helpers for:
- reading round packets
- generating `errorAnalyst`, `successAnalyst`, `structureAnalyst`, `edgeAnalyst`
- merging repeated evidence into bounded workflow candidates

- [ ] **Step 2: Add markdown/json rendering**

Emit:
- `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.json`
- `.ai-sync/AUTO_HERMES_TRACE_TO_SKILL.md`

- [ ] **Step 3: Run the targeted tests**

Run: `node .tools/auto-hermes-tools.test.mjs`
Expected: packet-analysis tests move closer to green

### Task 3: Integrate Round-Close Trace Emission

**Files:**
- Modify: `.tools/auto-hermes-round-close.mjs`

- [ ] **Step 1: Write packet creation integration**

Round-close should build a compact trace packet from the finished round and write it into `.ai-sync/trace-to-skill/rounds/`, then refresh the merged trace-to-skill outputs.

- [ ] **Step 2: Keep the integration soft and deterministic**

Failures in trace synthesis must not block normal queue/state writeback.

- [ ] **Step 3: Run the targeted tests**

Run: `node .tools/auto-hermes-tools.test.mjs`
Expected: round-close trace test passes

### Task 4: Surface Soft Evidence In Controller And Docs

**Files:**
- Modify: `.tools/auto-hermes-controller.mjs`
- Modify: `HERMES_SELF_EVOLVING_ENGINE.md`
- Modify: `.codex/workflows/auto-hermes-architecture.md`

- [ ] **Step 1: Add controller signal**

Expose a `traceToSkill` section with mode, summary, and strongest evidence-backed candidates when merged output exists.

- [ ] **Step 2: Update owner docs**

Document that workflow-evolution changes should prefer trace-backed evidence and that the gate is soft in this stage.

- [ ] **Step 3: Run verification**

Run: `node .tools/auto-hermes-tools.test.mjs`
Expected: PASS for the new trace-to-skill tests and no regressions in existing helper tests

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-18-auto-hermes-trace-to-skill-design.md docs/superpowers/plans/2026-04-18-auto-hermes-trace-to-skill.md .tools/auto-hermes-tools.test.mjs .tools/auto-hermes-trace-to-skill.mjs .tools/auto-hermes-round-close.mjs .tools/auto-hermes-controller.mjs HERMES_SELF_EVOLVING_ENGINE.md .codex/workflows/auto-hermes-architecture.md
git commit -m "Add trace-to-skill signals for auto-hermes"
```
