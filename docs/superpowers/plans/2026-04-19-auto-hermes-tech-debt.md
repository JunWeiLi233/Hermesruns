# Auto-Hermes Tech Debt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repo-local `/auto-hermes-tech-debt` audit command that scans Hermes for bounded tech debt and writes step-by-step tasks into `TASKS.md`.

**Architecture:** Use one shared `.tools` engine plus a shared workflow contract, then keep each runtime surface as a thin adapter that points at the same engine and truth rules. The engine owns scanning, ranking, reporting, and `TASKS.md` writeback so command docs stay aligned instead of drifting.

**Tech Stack:** Node.js `.mjs` tooling, Markdown/TOML command docs, PowerShell installer updates, OpenCode plugin registration, `node:test`-style assertions.

---

### Task 1: Lock The Contract And Audit Surfaces

**Files:**
- Create: `docs/superpowers/specs/2026-04-19-auto-hermes-tech-debt-design.md`
- Create: `docs/superpowers/plans/2026-04-19-auto-hermes-tech-debt.md`
- Create: `.codex/workflows/auto-hermes-tech-debt-contract.md`

- [ ] **Step 1: Write the design doc**

Describe the one-shot audit contract, heuristic types, ranking rules, runtime surfaces, and `TASKS.md` write shape.

- [ ] **Step 2: Write the implementation plan**

Save this plan into `docs/superpowers/plans/2026-04-19-auto-hermes-tech-debt.md`.

- [ ] **Step 3: Add the shared workflow contract**

Write a repo-owned contract that defines:
- audit purpose
- heuristic types
- ranking / dedupe rules
- `TASKS.md` write requirements
- truth rules for heuristic findings

- [ ] **Step 4: Review the three docs for drift**

Run a manual consistency pass so the design doc, plan, and shared contract agree on:
- engine path
- command name
- writeback section
- runtime list

### Task 2: Write The Failing Engine Tests

**Files:**
- Create: `.tools/auto-hermes-tech-debt.test.mjs`

- [ ] **Step 1: Add a fixture builder**

The fixture should create:
- a minimal `TASKS.md` with `## Tech Debt Tasks`
- one oversized frontend file
- one backend file without a matching test
- one `.tools` file with a `TODO` marker

- [ ] **Step 2: Write the candidate-collection assertion**

Assert that the engine reports bounded candidates across:
- `Frontend Debt`
- `Backend Debt`
- `Docs / Automation Debt`

- [ ] **Step 3: Write the writeback assertion**

Assert that a write run inserts:
- checkbox title
- `Files:`
- `Context:`
- `Steps:`
- `Done when:`
- `Verify:`

under the correct `## Tech Debt Tasks` subheadings, then rerun and assert dedupe.

- [ ] **Step 4: Write the runtime-surface assertion**

Assert the repo contains and wires:
- Codex command
- Claude command
- OpenCode command + plugin registration
- Gemini command
- Antigravity guidance
- installer/plugin README references

- [ ] **Step 5: Run the test to verify it fails**

Run: `node --test .tools/auto-hermes-tech-debt.test.mjs`

Expected: FAIL because the engine module, shared contract, and runtime command files do not exist yet.

### Task 3: Implement The Shared Engine

**Files:**
- Create: `.tools/auto-hermes-tech-debt.mjs`

- [ ] **Step 1: Implement repo scanning**

Cover these roots when present:
- `frontend/src`
- `backend/src`
- `.tools`
- `.codex`
- `.claude`
- `.opencode`
- `.gemini`
- `docs`

Ignore obvious non-source folders like `.git`, `node_modules`, `target`, `dist`, and `.ai-sync`.

- [ ] **Step 2: Implement heuristic collectors**

Add deterministic collectors for:
- debt markers
- missing focused tests
- oversized files

- [ ] **Step 3: Implement ranking and file-level dedupe**

Keep at most one strongest candidate per file, then sort the final candidate list and cap it by `--max`.

- [ ] **Step 4: Implement `TASKS.md` writeback**

Write grouped tasks under:
- `### Frontend Debt`
- `### Backend Debt`
- `### Docs / Automation Debt`

Each task must include step-by-step instructions.

- [ ] **Step 5: Implement CLI output**

Support:
- `--write`
- `--max`
- `--json`
- `--command-name`

and print a human-readable summary when `--json` is false.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test .tools/auto-hermes-tech-debt.test.mjs`

Expected: still FAIL because runtime adapter files are not wired yet, but engine-specific assertions should now pass.

### Task 4: Wire Runtime Adapters

**Files:**
- Create: `.codex/commands/auto-hermes-tech-debt.md`
- Create: `.claude/commands/auto-hermes-tech-debt.md`
- Create: `.opencode/commands/auto-hermes-tech-debt.md`
- Create: `.gemini/commands/auto-hermes-tech-debt.toml`
- Modify: `.claude/agents/antigravity.md`
- Modify: `.opencode/hermes-plugin.ts`
- Modify: `.tools/install-hermes-codex-commands.ps1`
- Modify: `.codex/plugins/hermes-workflows/README.md`
- Modify: `.codex/plugins/hermes-workflows/.codex-plugin/plugin.json`
- Create: `.codex/plugins/hermes-workflows/commands/auto-hermes-tech-debt.md`
- Modify: `.codex/commands/README.md`
- Modify: `.claude/commands/README.md`
- Modify: `.opencode/README.md`

- [ ] **Step 1: Add runtime command docs**

Each runtime file should identify:
- runtime identity
- shared engine path
- shared contract path
- writeback target (`TASKS.md`)
- supported arguments

- [ ] **Step 2: Add OpenCode plugin wiring**

Register `auto-hermes-tech-debt` as a real OpenCode tool and route it to the shared Node engine.

- [ ] **Step 3: Add installer/plugin mirrors**

Update the Codex installer and plugin mirror so the new command is copied into local Codex command/plugin directories.

- [ ] **Step 4: Add Antigravity guidance**

Document how Antigravity should run the same shared engine in sequential coordinator mode.

- [ ] **Step 5: Re-run the test to verify it passes**

Run: `node --test .tools/auto-hermes-tech-debt.test.mjs`

Expected: PASS.

### Task 5: Final Verification And Review

**Files:**
- Verify the files from Tasks 1-4

- [ ] **Step 1: Run the full tech-debt test**

Run: `node --test .tools/auto-hermes-tech-debt.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run a focused code review pass**

Review for:
- duplicate task generation
- malformed `TASKS.md` writeback
- runtime drift between adapters
- OpenCode tool-registration mistakes

- [ ] **Step 3: Confirm no unsupported claims are made**

Check that command docs and engine output describe findings as heuristic/bounded debt signals, not guaranteed semantic truth.
