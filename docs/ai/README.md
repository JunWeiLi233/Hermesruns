# Cross-runtime AI tooling

Hermes supports Codex, Claude, Gemini, and OpenCode without allowing their
project-editing rules or workflow commands to drift.

Direct editing entrypoints are `AGENTS.md` (Codex and OpenCode), `CLAUDE.md`,
and `GEMINI.md`; each routes to the same shared contract.

## Source of truth

- [`EDITING_CONTRACT.md`](EDITING_CONTRACT.md) is mandatory for every
  AI-assisted edit.
- [`CONTEXT_SNAPSHOT.md`](CONTEXT_SNAPSHOT.md) is the shared bounded bootstrap;
  [`context-manifest.json`](context-manifest.json) defines and budgets it.
- [`.codex/commands/`](../../.codex/commands/) is the canonical command source.
- [`runtime-command-manifest.json`](runtime-command-manifest.json) declares the
  full workflow set and the generated target locations.
- Runtime-specific plugins and agent cards remain adapters; they cannot weaken
  the contract or change workflow outcomes.

## Change a workflow command

1. Edit the matching file in `.codex/commands/`.
2. Update `runtime-command-manifest.json` if the command is added or removed.
3. Run `node tools/generate-runtime-commands.mjs`.
4. Run `node tools/generate-runtime-commands.mjs --check` (or the companion
   test) before committing.

Do not directly edit generated command files under `.claude/commands/`,
`.gemini/commands/`, or `.opencode/commands/`.

## Formatting policy

Follow the [editing contract's formatting policy](EDITING_CONTRACT.md#formatting).
Preserve existing style, check whitespace with `git diff --check`, and use the
configured lint/compiler gates. Automatic formatter tasks are not configured in
this checkout. A full-repository formatting pass requires a planned cleanup.

Run `node tools/check-ai-context-budget.mjs` after changing an AI entrypoint,
editing contract, or context document. Historical logs remain searchable but
must not be added to the bootstrap list.
