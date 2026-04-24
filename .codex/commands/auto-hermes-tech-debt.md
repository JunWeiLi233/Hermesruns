---
name: auto-hermes-tech-debt
---

# Auto-Hermes Tech Debt

Repo-local Hermes tech-debt audit command.

## Purpose

Run a bounded, whole-project tech-debt review that:

- scans frontend, backend, and docs / automation surfaces
- identifies deterministic, bounded debt candidates across 10 specific categories
- writes only step-by-step tasks into `TASKS.md`
- keeps command behavior aligned with the shared Hermes debt-audit contract

## Command Notes

- Preferred engine: `node .tools/auto-hermes-tech-debt.mjs --command-name auto-hermes-tech-debt --write --max 8`
- Shared contract: `.codex/workflows/auto-hermes-tech-debt-contract.md`
- Writeback target: repo-standard `TASKS.md` under `## Tech Debt Tasks`
- Use `--json` when another tool or runtime wants machine-readable output

## Debt Categories

| Kind | Description | Priority Boost |
|---|---|---|
| `debt-markers` | Explicit TODO/FIXME/HACK/XXX comments | +10 |
| `god-class` | Classes with 15+ methods, 12+ fields, or 8+ injected dependencies | +9 |
| `missing-error-handling` | Empty catch blocks, e.printStackTrace(), or swallowed exceptions | +8 |
| `circular-dependency-risk` | Controllers/services with 8+ injected dependencies | +7 |
| `hardcoded-config` | Hardcoded URLs, localhost refs, magic numbers, inline hex colors | +6 |
| `dead-code` | @Deprecated members on public API surface | +5 |
| `duplicate-logic` | Repeated object construction patterns (5+ occurrences) | +4 |
| `oversized-file` | Files exceeding line thresholds | +3 |
| `inconsistent-naming` | Spring beans not following naming conventions | +2 |
| `missing-focused-tests` | Java classes or .mjs tools without matching test files | +1 |

## Truth Rules

- Treat findings as heuristic debt signals, not guaranteed bugs.
- Do not write vague cleanup tasks.
- Do not claim the repo was semantically "fully understood" when the engine only ran deterministic heuristics.