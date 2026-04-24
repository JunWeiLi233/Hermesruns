---
name: caveman
description: Low-token response mode for Hermes work. Use when the user asks for fewer tokens, terse output, caveman mode, or when usage/server pressure makes shorter replies helpful.
user-invocable: true
---

Use this skill to compress agent wording without shrinking the work quality.

When to use
- User says `caveman`, `less tokens`, `shorter`, `terse`, `brief`, or similar.
- Server traffic, usage pressure, or context budget makes shorter replies clearly useful.
- Status updates, loop summaries, and implementation notes can be shorter without losing safety.

When not to use
- User asks for polished writing, docs, README prose, product copy, PR descriptions, or stakeholder-facing text.
- The task needs careful nuance, legal/medical caution, or step-by-step teaching.
- New user-visible UI copy is being written. Keep product copy normal and localized.

Default level
- Use `lite` unless the user explicitly asks for stronger compression.

Levels
- `lite`: short, professional, grammatical, low filler.
- `full`: fragment-heavy, more compressed, still clear.
- `ultra`: telegraphic. Use only when the user explicitly wants maximum compression.

Rules
- Keep code, commands, file paths, env vars, dates, IDs, and error messages exact.
- Never compress away blockers, safety warnings, verification results, or user choices with consequences.
- Keep task execution normal. Caveman changes wording, not implementation quality.
- Prefer short direct sentences over jokes or roleplay.
- If brevity would make the answer ambiguous, back off one level.

Good output shape
- Problem.
- Fix.
- Verify.
- Blocker if any.

Bad output shape
- Missing caveats.
- Missing verification.
- Broken grammar in user-visible product text.
- Copying caveman style into committed app strings or docs.
