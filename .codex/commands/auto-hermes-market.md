---
name: auto-hermes-market
---

# Auto-Hermes Market — Codex Runtime

Codex implementation note for the market research pipeline.

**Canonical command**: `.claude/commands/auto-hermes-market.md` is the single source of truth for the full protocol, agent schemas, output files, and anti-hallucination gate. This file adapts execution to Codex's capabilities.

## Runtime Identity

- **Runtime**: Codex (Ralph executor, parallel agent execution available)
- **Execution model**: Run the 5 core research agents as parallel tasks via the Ralph executor when available. Add the optional SEO lane in the same parallel wave only when the scope is consumer-searchable. Fall back to sequential if executor is unavailable or scope does not warrant parallel search.
- **Canonical command**: `.claude/commands/auto-hermes-market.md`

## Arguments

- `scope` — required: market segment to research (e.g. `running analytics apps`)
- No argument: infer from `PRODUCT.md` → North Star section

---

## Session Start

1. Check `.ai-sync/HUMAN_LOOP.md` — if `pause/stop/must-ask`, stop immediately
2. Create `.ai-sync/market/` directory if absent
3. If no scope: read first 40 lines of `PRODUCT.md` and extract target market

---

## Execution

### Phase 1 – Parallel Research (5 core agents + optional SEO lane)

Launch all 5 core research agents simultaneously. When the scope is consumer-searchable, also launch the SEO support lane. Each writes to its own JSON file:

| Agent | Output file | Primary search queries |
|---|---|---|
| Market Analyst | `.ai-sync/market/market-analyst.json` | `"<scope>" market size 2024`, `"<scope>" TAM billion` |
| Competitor Hunter | `.ai-sync/market/competitor-hunter.json` | `best <scope> apps 2024`, `<scope> alternatives site:reddit.com` |
| Pricing Engineer | `.ai-sync/market/pricing-engineer.json` | `<competitor>/pricing` for each verified competitor |
| Social Signal | `.ai-sync/market/social-signal.json` | `site:reddit.com "<scope>"`, `"<scope>" "worth paying for"` |
| Trend Validator | `.ai-sync/market/trend-validator.json` | `"<scope>" funding 2024 site:techcrunch.com`, `"<scope>" trend growing` |
| SEO Agent (optional) | `.ai-sync/market/seo-agent.json` | `best <scope>`, `<scope> alternatives`, `<scope> vs`, `<scope> guide` |

Full agent brief for each: see `.claude/commands/auto-hermes-market.md` → Agent Briefs section. The SEO lane should use `.codex/agents/seo-agent.md` as its Codex-side support identity.

**Verification rule (all agents)**: every number and competitor must have a fetched `sourceUrl`. No URL = mark `unverified`. Partial is better than fabricated.

### Phase 2 — Synthesis

When all required files exist (or are marked `partial`/`failed`): run the synthesis step defined in `.claude/commands/auto-hermes-market.md` → Synthesis Step. The coordinator reads all required reports, scores opportunities, and writes `MARKET_INTELLIGENCE.json` + `MARKET_INTELLIGENCE.md`.

### Phase 3 — Task generation

Insert scored opportunities (≥ 6/10) as concrete tasks into `TASKS.md` `## Suggested Next Tasks` under the correct tier section. Follow the task format in `.claude/commands/auto-hermes-market.md` → Generate tasks.

### Phase 4 — Reset runaway counter

Write `{"count": 0}` to `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json`.

---

## Codex-Specific Notes

- Use the Ralph executor for parallel agent launch when the core market agents are independent. The SEO lane should be added only when the scope is consumer-searchable and should still keep its write scope isolated to `.ai-sync/market/seo-agent.json`.
- If the executor is unavailable, run the 5 phases sequentially with no other behavioral change.
- Do not use `.tools/auto-hermes-supervisor.mjs` for this command — market research is a one-shot pipeline, not a loop.
- After tasks are written, optionally hand off to `/auto-hermes-max` for execution.

---

## Output

Reference `.claude/commands/auto-hermes-market.md` → Output Files for the full file list.

Final user-facing report format: see `.claude/commands/auto-hermes-market.md` → Coordinator Reply Rules.
