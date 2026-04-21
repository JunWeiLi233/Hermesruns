# Auto-Hermes Tech Debt Contract

This file is the shared contract for `/auto-hermes-tech-debt` across Hermes-supported runtimes.

Use it to keep the tech-debt audit behavior aligned across:

- `.codex/commands/auto-hermes-tech-debt.md`
- `.claude/commands/auto-hermes-tech-debt.md`
- `.opencode/commands/auto-hermes-tech-debt.md`
- `.gemini/commands/auto-hermes-tech-debt.toml`
- `.claude/agents/antigravity.md`

## Purpose

`/auto-hermes-tech-debt` is a bounded repo-wide debt audit.

It should:

- inspect the current repository
- identify bounded tech debt using deterministic heuristics
- rank the debt
- write only implementation-ready, step-by-step items into `TASKS.md`

It should not:

- auto-fix product code during the audit run
- write vague cleanup notes
- claim semantic certainty beyond current repo evidence

## Record-System Inputs

Before task writeback, read:

- `AGENTS.md`
- `docs/auto-hermes/index.md` when present
- `.ai-sync/AGENT_SYNC.md`
- `.ai-sync/CONTEXT_LEDGER.md`
- `TASKS.md`

The command is one-shot, not a self-loop.

## Audit Slices

The engine should review the repo in bounded slices:

1. frontend
2. backend
3. docs / automation / workflow tooling

## Allowed Heuristics

Initial heuristics are intentionally deterministic:

1. `debt-markers`
   - `TODO`, `FIXME`, `HACK`, `XXX`

2. `missing-focused-tests`
   - backend production files without matching focused tests
   - `.tools` scripts without matching focused tests

3. `oversized-file`
   - files that exceed category thresholds and are likely resisting bounded edits

The engine should keep at most one strongest candidate per file.

## Ranking Rules

Rank findings by:

- boundedness
- verification clarity
- maintenance risk
- Hermes trust impact
- category weight

Category order:

1. `Backend Debt`
2. `Frontend Debt`
3. `Docs / Automation Debt`

## TASKS.md Write Rules

Write only into `## Tech Debt Tasks`.

Preferred subheadings:

- `### Frontend Debt`
- `### Backend Debt`
- `### Docs / Automation Debt`

Every inserted task must include:

- checkbox title
- `Files:`
- `Context:`
- `Steps:`
- `Done when:`
- `Verify:`

The `Steps:` block must be step-by-step and implementation-ready.

## Dedupe Rules

Do not add a debt task when:

- the same generated title already exists anywhere in `TASKS.md`
- the same file already has an equivalent generated debt task
- the candidate is weaker than an already written debt item for the same file

## Truth Rules

- Treat findings as heuristic debt signals, not guaranteed bugs.
- Do not call the audit “complete” without a fresh engine run.
- Do not claim repo-wide semantic review when only deterministic heuristics ran.
- Prefer bounded debt over architecture-fiction.

## Shared Engine

Preferred engine:

`node .tools/auto-hermes-tech-debt.mjs --command-name auto-hermes-tech-debt --write`

Recommended arguments:

- `--write`
- `--max 5`
- `--json`

## Verification

Focused verification:

`node .tools/auto-hermes-tech-debt.test.mjs`
