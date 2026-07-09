---
name: auto-hermes-self
description: Use when the user wants the Ralph-style indefinite self-loop variant of auto-hermes to keep iterating until a real stop gate fires in this repository.
---

# Auto-Hermes Self Skill

Use this skill for Hermes requests that should follow the `/auto-hermes-self` workflow.

## Source Of Truth

- Canonical command file: `.codex/commands/auto-hermes-self.md`
- This skill only routes into that command file.
- If this skill and the command note ever differ, follow the command note.

## Workflow

1. Read `AGENTS.md`.
2. Read `docs/auto-hermes/index.md`.
3. Read `.codex/commands/auto-hermes-self.md`.
4. Execute the self-loop workflow from the command file directly. When delegation is needed, spawn Codex-native subagents from the parent Codex session with `multi_agent_v1.spawn_agent` instead of generating repo agents.

## Rules

- Treat `.codex/commands/auto-hermes-self.md` as the canonical Codex-side execution note.
- Do not treat a single bounded round as completion.
- Preserve the loop-owner, re-entry, and real-stop-gate behavior.
- For Codex execution, do not run repo agent-generation helpers such as `.tools/generate-codex.js`, `.tools/auto-hermes-loop.mjs` helper-generated agent paths, or external generators; spawn native Codex subagents with `multi_agent_v1.spawn_agent` when delegation is needed.
- Keep all round-close, verification, and runtime-proof gates intact.
