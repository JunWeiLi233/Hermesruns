---
agent: 'agent'
description: 'Run the bounded Hermes structure-update workflow and prepare the next eligible /auto-hermes round to fix the highest-value structure issue'
---

Use the Hermes `/auto-hermes-structure-update` workflow for this repository.

Before starting:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Auto-Hermes record map](../../docs/auto-hermes/index.md).
3. Read [Codex command note](../../.codex/commands/auto-hermes-structure-update.md).
4. Read [shared structure-update contract](../../.codex/workflows/auto-hermes-structure-update-contract.md).
5. Inspect the shared engine at [`.tools/auto-hermes-structure-update.mjs`](../../.tools/auto-hermes-structure-update.mjs).

Then execute the workflow with these rules:

- Prefer the documented engine:
  `node .tools/auto-hermes-structure-update.mjs --command-name auto-hermes-structure-update --write --max 4`
- Write a ranked shortlist of bounded structure fixes into `TASKS.md`.
- Mark one task as the recommended default.
- Write the steering brief into `.ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.{json,md}`.
- Keep every suggestion precise, restorable, and verified; do not mutate the whole control plane in the same run.

Maximum number of structure tasks to emit:
${input:max:How many top structure-update tasks should /auto-hermes-structure-update emit? Default: 4.}
