---
agent: 'agent'
description: 'Run the Hermes local/dev attack-simulation workflow with the documented safety gates'
---

Use the Hermes `/auto-hermes-attack` workflow for this repository.

Before starting:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Codex command note](../../.codex/commands/auto-hermes-attack.md).
3. Inspect the shared security engine at [`.tools/auto-hermes-security.mjs`](../../.tools/auto-hermes-security.mjs).

Then execute the workflow with these rules:

- This command is local/dev only. Never target production.
- Prefer the documented engine:
  `node .tools/auto-hermes-security.mjs --mode attack --command-name auto-hermes-attack --write --runtime-base-url http://localhost:8080`
- Add `--aggressive` only when explicitly requested and still keep the target local/dev only.
- Reuse the documented probe families: auth bypass, data leak, IDOR, injection, mass assignment, webhook abuse, CORS, rate limit, security headers, URL enumeration, and user enumeration.
- If the local runtime is unavailable, degrade honestly to static-only reporting and call out skipped active probes.

Runtime base URL:
${input:runtime:Which local or dev runtime should /auto-hermes-attack target? Default is http://localhost:8080.}

Additional mode or constraints:
${input:mode:Optional notes such as --aggressive, skip runtime probing, or extra guardrails.}
