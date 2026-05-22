# Auto-Hermes Tech Debt Design

## Goal

Add a repo-local `/auto-hermes-tech-debt` command family for Codex, Claude Code, OpenCode, Gemini CLI, and Antigravity that reviews the project, identifies bounded tech debt, and writes step-by-step tasks into the repo-standard `TASKS.md` under `## Tech Debt Tasks`.

## Why This Exists

`/auto-hermes` already executes queued work, but Hermes does not have a dedicated command for whole-project debt review and writeback. That leaves tech-debt discovery split across ad hoc scans, isolated review notes, and manual backlog edits.

The new command should:

- review the project in one bounded audit pass
- rank debt by Hermes priorities instead of generic cleanup taste
- write only implementation-ready debt tasks
- keep runtime behavior aligned across Codex, Claude Code, OpenCode, Gemini CLI, and Antigravity

## Scope

In scope:

- a shared tech-debt contract
- a shared `.tools/auto-hermes-tech-debt.mjs` engine
- runtime command entrypoints for Codex, Claude Code, OpenCode, Gemini CLI, and Antigravity guidance
- OpenCode plugin registration
- deterministic writeback into `TASKS.md`
- report artifacts for audit traceability

Out of scope:

- auto-fixing debt during the audit run
- speculative architecture rewrites
- runtime/browser-based validation of every finding
- replacing `/auto-hermes` queue execution

## Command Contract

`/auto-hermes-tech-debt` is a one-shot audit command, not a self-loop.

Required behavior:

1. Read the Hermes record-system surfaces needed for truthful queue writeback:
   - `AGENTS.md`
   - `docs/auto-hermes/index.md` when present
   - `.ai-sync/AGENT_SYNC.md`
   - `.ai-sync/CONTEXT_LEDGER.md`
   - `TASKS.md`
2. Scan the repo in slices:
   - frontend
   - backend
   - docs / automation / workflow tooling
3. Detect bounded debt using deterministic heuristics.
4. Rank findings.
5. Convert only the top bounded findings into step-by-step debt tasks.
6. Deduplicate against existing queue items.
7. Write the tasks into `## Tech Debt Tasks`.

## Detection Heuristics

The first version should stay deterministic and auditable. It should not claim broad semantic understanding it does not actually have.

Initial finding types:

1. `debt-markers`
   - Trigger: `TODO`, `FIXME`, `HACK`, or `XXX` markers in tracked project files.
   - Why: explicit debt markers are the most honest debt source available in-repo.

2. `missing-focused-tests`
   - Trigger: backend production files or `.tools` scripts that do not have matching focused tests.
   - Why: Hermes relies heavily on workflow scripts and backend guards; missing focused coverage is real trust debt.

3. `oversized-file`
   - Trigger: code files that exceed category thresholds.
   - Why: large files make review, reuse, and bounded edits harder.

The engine should choose at most one strongest task per file so the queue does not get spammed by multiple weak variants for the same path.

## Ranking

Findings should be scored by:

- boundedness
- verification clarity
- maintenance risk
- trust impact
- Hermes category weight

Category preference:

1. backend trust / tooling trust
2. frontend maintainability
3. docs / automation debt

## TASKS.md Write Format

Every inserted item must be implementation-ready and step-by-step.

Required fields:

- title checkbox
- `Files:`
- `Context:`
- `Steps:`
- `Done when:`
- `Verify:`

Example shape:

```md
- [ ] Add focused coverage for AiUsageService quota guards
  Files: `backend/src/main/java/com/hermes/backend/service/AiUsageService.java`, `backend/src/test/java/com/hermes/backend/service/AiUsageServiceTests.java`
  Context: The service owns quota-consumption rules but has no focused regression coverage for the critical guard paths.
  Steps:
  1. Identify the quota branches that are currently unprotected by focused tests.
  2. Add a dedicated backend test class that covers the missing guard paths and edge cases.
  3. Run the focused backend test and then a compile check to confirm the new coverage stays green.
  Done when: the missing guard paths are covered by a focused test class and the service behavior is still compile-safe.
  Verify: `cd backend && ./mvnw test -Dtest=AiUsageServiceTests && ./mvnw -q -DskipTests compile`
```

## Runtime Layout

Shared owner files:

- `.codex/workflows/auto-hermes-tech-debt-contract.md`
- `.tools/auto-hermes-tech-debt.mjs`

Runtime entrypoints:

- `.codex/commands/auto-hermes-tech-debt.md`
- `.claude/commands/auto-hermes-tech-debt.md`
- `.opencode/commands/auto-hermes-tech-debt.md`
- `.gemini/commands/auto-hermes-tech-debt.toml`
- `.claude/agents/antigravity.md` section for `/auto-hermes-tech-debt`

Supporting surfaces:

- `.opencode/hermes-plugin.ts`
- `.tools/install-hermes-codex-commands.ps1`
- `.codex/plugins/hermes-workflows/README.md`
- command readmes / indexes where appropriate

## Safety And Truth Rules

- Do not call the audit "complete" without a fresh engine run.
- Do not claim repo-wide semantic certainty from heuristic findings.
- Do not write vague cleanup tasks.
- Do not write duplicate debt that already exists in `TASKS.md`.
- Do not mutate product code during the debt audit run.

## Verification Plan

Focused verification:

- `node --test .tools/auto-hermes-tech-debt.test.mjs`

The test suite should prove:

- the engine finds bounded candidates across frontend, backend, and automation slices
- writeback inserts step-by-step tasks into `## Tech Debt Tasks`
- rerunning the engine deduplicates previously written debt
- runtime adapter files and installer/plugin wiring expose the new command

## Expected Outcome

Hermes gains a truthful, repeatable command for debt review that turns repo signals into a usable implementation backlog instead of another pile of vague review notes.
