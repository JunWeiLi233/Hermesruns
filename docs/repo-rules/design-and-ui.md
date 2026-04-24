# Design And UI

This file owns Hermes UI and design rules.

## Design Authority

- `design.md` is the default visual source of truth for meaningful Hermes UI work.
- Combine `design.md`, the current user request, and any supplied reference image/mockup/export.
- Preserve product behavior, routing, auth, and real data wiring unless the task explicitly changes them.
- Improve runner usefulness first, then visual polish.

## Core Design Direction

Hermes follows the `design.md` Kinetic Editorial system:

- intentional asymmetry over rigid dashboard grids
- tonal layering over hard separators
- premium editorial hierarchy over dense generic SaaS cards
- glass and gradient only where they reinforce hierarchy
- ambient depth over heavy shadows
- spacing before chrome when a surface feels crowded

## Non-Trivial Frontend Rounds

Treat a frontend round as non-trivial when it changes:

- layout or hierarchy
- empty/loading/error states on runner-facing surfaces
- interaction treatment
- reference-driven or mimic-driven UI
- primary-surface copy that changes how the page reads

Before editing, lock:

- exact surface
- visual goal
- preserve list
- round type: `visual-bug`, `interaction-bug`, `structural-redesign`, or `mimic-implementation`
- reference source: user reference, `design.md`, or the current approved Hermes surface

## Mimic Protocol

When a user provides a reference, extract:

1. layout structure
2. hierarchy
3. typography
4. color roles
5. interaction cues

Copy the design language, not unrelated product content.

Do not water down a strong reference into generic SaaS glassmorphism.

## Translation Rules

- Any changed user-facing copy must be updated in both locales in `frontend/src/i18n/translations.js`.
- Treat `TRANSLATION_WORKFLOW.md` as required process for user-visible frontend work.
- Do not leave new hardcoded UI strings in place.

## Design Version Log

For meaningful user-facing design changes, append a new entry to `DESIGN_VERSIONS.md` with:

- `Version:`
- `Date:`
- `Surface:`
- `Files:`
- `What changed:`
- `Why:`
- `Rollback target:`
- `Notes:`
