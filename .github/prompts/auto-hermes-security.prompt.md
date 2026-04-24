---
agent: 'agent'
description: 'Run the Hermes repo-local security audit and optionally write verified findings back to TASKS.md'
---

Use the Hermes `/auto-hermes-security` workflow for this repository.

Before starting:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Codex command note](../../.codex/commands/auto-hermes-security.md).
3. Inspect the audit engine at [`.tools/auto-hermes-security.mjs`](../../.tools/auto-hermes-security.mjs).

Then execute the workflow with these rules:

- Prefer the documented engine:
  `node .tools/auto-hermes-security.mjs --mode audit --command-name auto-hermes-security --write`
- Add `--runtime-base-url http://localhost:8080` only when a local/dev runtime is actually reachable.
- Run static/code-config checks even if runtime probing is unavailable.
- Do not claim production exploitability from static heuristics alone.
- Only write back verified `HIGH` and `CRITICAL` findings to `TASKS.md`.

Optional runtime base URL:
${input:runtime:If you want runtime probing, provide a local/dev runtime URL such as http://localhost:8080. Otherwise leave blank.}
