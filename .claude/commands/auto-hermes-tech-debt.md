---
name: auto-hermes-tech-debt
description: One-shot tech-debt audit — scans the codebase, writes findings as bounded tasks into TASKS.md with Files / Context / Done when / Verify.
---

# Hermes Tech Debt Audit

Treat `/auto-hermes-tech-debt` as the canonical Hermes repo shortcut for one-shot tech-debt review.

## Runtime Identity

- **Runtime**: Claude Code
- **Execution model**: one-shot bounded audit, not a self-loop
- **Shared engine**: `.tools/auto-hermes-tech-debt.mjs`
- **Shared contract**: `.codex/workflows/auto-hermes-tech-debt-contract.md`
- **Writeback target**: `TASKS.md` `## Tech Debt Tasks`

## Purpose

`/auto-hermes-tech-debt` reviews the project and writes only implementation-ready debt tasks. It does not auto-fix code in the same run.

## What It Detects

| Kind | Description | Priority Boost |
|---|---|---|
| `debt-markers` | Explicit TODO/FIXME/HACK/XXX comments | +10 |
| `god-class` | Classes with 15+ methods or 12+ fields or 8+ injected dependencies | +9 |
| `missing-error-handling` | Empty catch blocks, e.printStackTrace(), or swallowed exceptions | +8 |
| `circular-dependency-risk` | Controllers/services with 8+ injected dependencies | +7 |
| `hardcoded-config` | Hardcoded URLs, localhost refs, magic numbers, inline hex colors | +6 |
| `dead-code` | @Deprecated members, especially on public/protected API | +5 |
| `duplicate-logic` | Repeated object construction patterns (5+ occurrences) | +4 |
| `oversized-file` | Files exceeding line thresholds (550 backend, 700 frontend, 450 tools) | +3 |
| `inconsistent-naming` | Spring beans not following naming convention (e.g. `@Service` class not ending in "Service") | +2 |
| `missing-focused-tests` | Java classes or .mjs tools without matching test files | +1 |

The tool selects up to 2 findings per file, then spreads selection across debt kinds for variety.

## Preferred Invocation

```bash
node .tools/auto-hermes-tech-debt.mjs --command-name auto-hermes-tech-debt --write --max 8
```

## Arguments

| Argument | Description | Default |
|---|---|---|
| `--max <n>` | Max task count to write | `8` |
| `--write` | Write into `TASKS.md` and report artifacts | `true` |
| `--json` | Output JSON instead of Markdown | `false` |
| `--command-name` | Command name for run ID | `auto-hermes-tech-debt` |

## Command Rules

- Read `AGENTS.md`, `.ai-sync/AGENT_SYNC.md`, `.ai-sync/CONTEXT_LEDGER.md`, and `TASKS.md` before trusting writeback state.
- Audit frontend, backend, and docs / automation slices.
- Keep only bounded debt findings.
- Reject vague cleanup and duplicate debt.
- Write step-by-step tasks with `Files:`, `Context:`, `Steps:`, `Done when:`, and `Verify:`.

## Output

- JSON / Markdown report artifacts under `.ai-sync/tech-debt/`
- Queue writeback into `TASKS.md` `## Tech Debt Tasks`

## Truth Rules

- Treat findings as heuristic debt signals, not guaranteed bugs.
- Do not write vague cleanup tasks.
- Do not claim the repo was semantically "fully understood" when the engine only ran deterministic heuristics.