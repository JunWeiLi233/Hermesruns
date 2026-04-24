---
agent: 'agent'
description: 'Run the true Ralph self-loop version of the Hermes auto-hermes workflow'
---

Use the Hermes `/auto-hermes-self` workflow for this repository.

Before doing anything substantial:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Auto-Hermes record map](../../docs/auto-hermes/index.md).
3. Read [Repo rules index](../../docs/repo-rules/index.md).
4. Read [Codex Auto-Hermes architecture](../../.codex/workflows/auto-hermes-architecture.md).
5. Read [Codex command note](../../.codex/commands/auto-hermes-self.md).

Then execute the workflow with these rules:

- Treat `/auto-hermes-self` as a repo-local Ralph self-loop command, not a native Copilot feature.
- Use [.tools/auto-hermes-self-loop.mjs](../../.tools/auto-hermes-self-loop.mjs) as the true loop owner.
- Keep iterating until a real stop gate fires.
- If a promotable task exists, execute the next bounded round.
- If no promotable task exists, use the standard Hermes find-the-task path before stopping: promote queue candidates when present, otherwise seed suggestions, then use website-audit fallback.
- If runtime checks or expected tools are unavailable, say so plainly and use the nearest verified fallback.

Current self-loop goal:
${input:task:What should /auto-hermes-self keep working on?}
