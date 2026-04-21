---
agent: 'agent'
description: 'Run the bounded Hermes parent coordinator workflow with /auto-hermes-max'
---

Use the Hermes `/auto-hermes-max` workflow for this repository.

Before doing anything substantial:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Auto-Hermes record map](../../docs/auto-hermes/index.md).
3. Read [Repo rules index](../../docs/repo-rules/index.md).
4. Read [Codex Auto-Hermes architecture](../../.codex/workflows/auto-hermes-architecture.md).
5. Read [Codex command note](../../.codex/commands/auto-hermes-max.md).

Then execute the workflow with these rules:

- Treat `/auto-hermes-max` as a repo-local parent-coordinator shortcut, not a native Copilot feature.
- Keep the run bounded to one parent coordination round with explicit reassessment.
- Use the documented exhaustion flow: empty queue is not a stop by itself, and website-audit is the first fallback.
- Route true-stop decisions through the documented supervisor/finish contract instead of inventing new stop rules.
- Be explicit about lane ownership, merge safety, and verification before claiming the coordinator round is complete.

Current parent-round goal:
${input:task:What should /auto-hermes-max coordinate right now?}
