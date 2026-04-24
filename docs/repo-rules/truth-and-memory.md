# Truth And Memory

This file owns detailed truthfulness and memory rules for Hermes.

## Hallucination Rules

- Do not claim a tool, slash command, skill trigger, app-native behavior, or workflow exists unless it was verified in this session or is explicitly documented as a repo convention.
- Treat `/auto-hermes` and `/auto-hermes-max` as repo shortcuts, not guaranteed native Codex features.
- Do not claim a website/runtime change is live without passing the relevant runtime proof gate.
- Do not describe helper state such as `continue-self-loop` as proof of live execution. Use wording like `self-loop armed in state` unless the coordinator is actually still running.
- If a capability is expected but unavailable, say so plainly and fall back to the nearest verified path.

## Truth Source Order

When sources conflict, prefer:

1. current tool output and command results
2. verified runtime checks and current filesystem state
3. installed skill/config files actually used by the running client
4. `AGENTS.md`
5. repo-local workflow docs and helper guides
6. MemPalace retrieval for historical context
7. older chat claims

If still uncertain, say `unverified` or `not confirmed here`.

## MemPalace Rules

Use MemPalace before answering questions about:

- prior product decisions
- old regressions or bug patterns
- auth, billing, OAuth, Strava, Garmin, import incidents
- recent architectural tradeoffs
- unfinished work another agent may have touched

Preferred query order:

1. `mempalace_status`
2. recent specialist diary if a likely owner is known
3. narrow `mempalace_search`
4. `mempalace_kg_query` for stable facts/relationships

Keep retrieval narrow and write back only durable lessons:

- real bug root causes
- important contracts or schema decisions
- stable user preferences
- workflow gotchas that will matter again
- postmortem-grade failures

Do not write back scratch notes, temporary TODOs, or trivial copy edits.

## Local Memory Files

- Prefer MemPalace for long-term memory when available.
- Treat `memory.md` as a tiny fallback for stable preferences or workflow invariants only.
- Treat `.ai-codex/CODEX_CHECKPOINT.md` as the active progress-resume file, not as durable knowledge.
