---
agent: 'agent'
description: 'Run the Hermes bounded tech-debt audit and write concrete debt tasks to TASKS.md'
---

Use the Hermes `/auto-hermes-tech-debt` workflow for this repository.

Before starting:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Codex command note](../../.codex/commands/auto-hermes-tech-debt.md).
3. Read [shared tech-debt contract](../../.codex/workflows/auto-hermes-tech-debt-contract.md).
4. Inspect the audit engine at [`.tools/auto-hermes-tech-debt.mjs`](../../.tools/auto-hermes-tech-debt.mjs).

Then execute the workflow with these rules:

- Prefer the documented engine:
  `node .tools/auto-hermes-tech-debt.mjs --command-name auto-hermes-tech-debt --write --max 8`
- Scan frontend, backend, and docs/automation surfaces within the documented debt categories only.
- Write only deterministic, bounded, step-by-step debt tasks into `TASKS.md`.
- Treat findings as heuristic debt signals, not guaranteed bugs.
- Use `--json` only when another tool needs machine-readable output.

Maximum number of debt tasks to write:
${input:max:How many top debt tasks should /auto-hermes-tech-debt emit? Default: 8.}
