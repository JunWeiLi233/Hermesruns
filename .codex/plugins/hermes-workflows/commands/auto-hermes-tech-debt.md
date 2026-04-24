---
name: auto-hermes-tech-debt
---

# Auto-Hermes Tech Debt

Plugin-exposed Hermes tech-debt audit command.

## Purpose

Run the shared Hermes debt-audit engine and write step-by-step debt tasks into `TASKS.md`.

## Command Notes

- Shared engine: `node .tools/auto-hermes-tech-debt.mjs --command-name auto-hermes-tech-debt --write`
- Shared contract: `.codex/workflows/auto-hermes-tech-debt-contract.md`
- Report artifacts land under `.ai-sync/tech-debt/`
