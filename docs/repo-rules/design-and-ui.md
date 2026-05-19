# Design And UI

This file owns Hermes UI and design rules.

## Design Authority

- `design.md` is the default visual source of truth for meaningful Hermes UI work.
- For `/auto-hermes`, `node .tools/auto-hermes-skills.mjs --json` is the durable frontend design skill manifest.
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
- anti-generic design-taste constraints from `design-taste-frontend` and `frontend-design`, filtered through Hermes runner value

## Frontend Design Skill Stack

For non-trivial frontend rounds, apply the stack in this order:

- `hermes-dev` for repo workflow and runtime proof.
- `design-taste-frontend` for anti-slop layout, typography, color, motion, and responsive constraints.
- `frontend-design` for bold but production-safe concept execution.
- `ui-ux-pro-max` only as supplemental research after `design.md` is read.
- `browser` or browser-harness for live route evidence before claiming success.
- `hermes-translation-sync`, `accesslint`, or `vercel-web-interface-guidelines` when copy, accessibility, forms, controls, or interaction quality are in scope.

If a required skill is unavailable in the active runtime, state that plainly and use the nearest verified fallback.

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

## Customer Playtest Gate

End every meaningful UI/design round with a customer playtest gate before claiming completion. Use Browser evidence for at least the touched route, then evaluate the page as both an amateur runner and an elite runner.

The gate must answer:

- Can the amateur runner find the main decision and next action without jargon?
- Can the elite runner find the evidence, controls, and trust signals without clutter?
- Is navigation clarity good enough that the runner knows where they are and where to go next?
- Does the page feel useful and enjoyable enough for daily use?
- Are loading, empty, error, focus, label, and contrast basics acceptable?

Use `.tools/customer-playtest-gate.mjs` to write the round artifact, then fill it with real Browser observations and customer feedback. A round should not pass if navigation clarity or daily-use enjoyment is below 4/5, or if either persona hits a must-fix blocker.
