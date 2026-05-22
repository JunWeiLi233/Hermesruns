# Auto-Hermes Record System

Use this file as the small, stable entrypoint for `/auto-hermes`.

This file is a map, not an exhaustive manual.

## Read Order

1. `AGENTS.md`
   Policy plane: truthfulness, runtime proof, task discipline, safety, and repo rules.
2. `docs/auto-hermes/index.md`
   Record-system map: where `/auto-hermes` stores durable workflow truth.
3. `.ai-codex/optimized-codex.md`
   Session-scale compressed queue and repo brief.
4. `.ai-sync/CONTEXT_LEDGER.md`
   Surface-level durable intent and preservation rules.
5. `.ai-sync/AGENT_SYNC.md`
   Live claims, recently completed work, and reclaim safety.
6. Deeper owners only when the current round actually needs them.

## Concern Map

| Concern | Owning file | Why it exists |
| --- | --- | --- |
| Policy and truth rules | `AGENTS.md` | Defines what must be true before `/auto-hermes` can claim success |
| Shared lifecycle | `.codex/workflows/auto-hermes-shared-contract.md` | Keeps stop rules, follow-up rules, and runtime wording aligned across runtimes |
| Control plane | `.codex/workflows/auto-hermes-architecture.md` | Defines the bounded round model and authority boundaries |
| Delegation plane | `.codex/workflows/hermes-multi-agent.md` | Defines when work stays local vs. becomes specialist or parallel work |
| Promotion plane | `HERMES_SELF_EVOLVING_ENGINE.md` | Owns self-generated continuation and promotion gates |
| Structure steering | `.tools/auto-hermes-structure-update.mjs` | Emits bounded structure-fix suggestions plus the next-round steering brief for `/auto-hermes` |
| Deterministic routing | `.tools/auto-hermes-controller.mjs` | Selects the current work unit and emits the routing brief |
| Loop ownership | `.tools/auto-hermes-loop.mjs` | Owns worker/coordinator prompts and loop-state truth |
| Ralph self-loop ownership | `.tools/auto-hermes-self-loop.mjs` | Owns the true Ralph indefinite self-loop variant of `/auto-hermes` |
| Max loop ownership | `.tools/auto-hermes-max-loop.mjs` | Owns parent `/auto-hermes-max` re-entry, Ralph-backed iteration posture, and parent-loop truth |
| Round writeback | `.tools/auto-hermes-round-close.mjs` | Refreshes audit, promotion, and finish state after a verified round |
| Finish action | `.tools/auto-hermes-finish.mjs` | Generates deterministic finish/commit briefs |

## Progressive Disclosure Rules

- Start from this map and the controller brief instead of broad repo scans.
- Read the smallest file that owns the question before opening neighboring workflow files.
- Treat `.ai-sync/AUTO_HERMES_CONTROLLER.*` and `.ai-sync/AUTO_HERMES_COORDINATOR.*` as the active round briefs, not as permanent policy.
- When a helper output and a durable owner disagree, prefer the durable owner first, then update the helper in code.

## Record-System Rules

- `AGENTS.md` is policy and top-level routing, not the place for every durable workflow detail.
- Durable `/auto-hermes` decisions should live in the smallest owning workflow doc or helper script, then be discoverable from this map.
- If a fact only exists in chat, it does not count as durable `/auto-hermes` knowledge.
- Plans, promotion outputs, controller briefs, and finish briefs are first-class repo artifacts when they change agent behavior.
- Structure-update briefs at `.ai-sync/AUTO_HERMES_STRUCTURE_UPDATE.*` are first-class repo artifacts when they steer the next eligible `/auto-hermes` round.

## Doc-Gardening Rules

- If a round changes enduring `/auto-hermes` behavior, update the smallest owning doc or helper in the same round.
- If a doc is stale but the behavioral fix is too large for the current round, write a concrete doc-gardening follow-up instead of silently leaving drift behind.
- Prefer fixing drift at the owner file rather than copying the same explanation into multiple docs.
- Keep this file short. If it starts reading like a manual, move detail down to the owning file and keep only the link here.
