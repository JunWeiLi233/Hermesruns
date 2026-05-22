---
agent: 'agent'
description: 'Run the bounded Hermes auto-hermes workflow for this repository'
---

Use the Hermes `/auto-hermes` workflow for this repository.

Before doing anything substantial:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Auto-Hermes record map](../../docs/auto-hermes/index.md).
3. Read [Repo rules index](../../docs/repo-rules/index.md).
4. Read [Codex Auto-Hermes architecture](../../.codex/workflows/auto-hermes-architecture.md).
5. Read [Codex command note](../../.codex/commands/auto-hermes.md).

Then execute the workflow with these rules:

- Treat `/auto-hermes` as a repo-local shortcut, not a native Copilot feature.
- Follow the Hermes session-start, truth, task-execution, and runtime-proof rules from `AGENTS.md`.
- Keep the run bounded and repo-backed; use the current loop/supervisor tools when the repo docs call for them.
- If the queue is empty, do not stop immediately; follow the documented website-audit exhaustion fallback.
- If runtime checks or expected tools are unavailable, say so plainly and use the nearest verified fallback.

Current user goal or task:
${input:task:What should /auto-hermes focus on in this run?}
