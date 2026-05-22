---
agent: 'agent'
description: 'Run the Hermes market-intelligence pipeline and convert verified opportunities into backlog tasks'
---

Use the Hermes `/auto-hermes-market` workflow for this repository.

Before starting:

1. Read [AGENTS.md](../../AGENTS.md).
2. Read [Codex command note](../../.codex/commands/auto-hermes-market.md).
3. Read [Canonical market command](../../.claude/commands/auto-hermes-market.md).
4. Check [human loop state](../../.ai-sync/HUMAN_LOOP.md) and [agent sync](../../.ai-sync/AGENT_SYNC.md).

Then execute the workflow with these rules:

- Run the 5 core market lanes and add the SEO lane only when the scope is consumer-searchable.
- Ground every number, competitor, and price point in an actually fetched source URL.
- Write the machine and human outputs under `.ai-sync/market/` as documented.
- Translate only verified opportunities into concrete `TASKS.md` entries under `## Suggested Next Tasks`.
- If data is partial or conflicting, report it honestly instead of smoothing it over.

Market scope:
${input:scope:What market should /auto-hermes-market research? Leave blank only if you want Copilot to infer it from PRODUCT.md.}
