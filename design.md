# Hermes Design System: Kinetic Editorial

This file is the canonical visual authority for Hermes UI work.

It defines one design language with two explicit runtime expressions:
- `dark mode`: **The Cinematic Athlete**
- `light mode`: **The Aerodynamic Gallery**

`/auto-hermes` must treat this file as mode-aware design authority, not as a dark-only mood board.

## 0. Auto-Hermes Frontend Skill Wiring

`/auto-hermes` must route non-trivial frontend design work through this design authority plus the installed frontend design skills. This file owns the final Hermes visual decision; skills are execution lenses that sharpen the work without replacing Hermes-specific product judgment.

Required skill stack for non-trivial frontend rounds:
- `hermes-dev`: repo workflow, runtime proof, and Hermes preservation rules.
- `design-taste-frontend`: anti-generic UI constraints, asymmetric composition, calibrated color, motion discipline, responsive collapse, and performance guardrails.
- `frontend-design`: bold concept selection and production-grade visual execution when a route, component, landing page, dashboard, or design surface is being built or restyled.
- `ui-ux-pro-max`: supporting design research only after this file is read; keep only recommendations that fit Kinetic Editorial and runner value.
- `browser` or `browser-harness`: live visual proof for touched routes, including desktop/mobile layout, contrast, overflow, and interaction state.
- `hermes-translation-sync`: required when user-visible copy changes.
- `accesslint` or `vercel-web-interface-guidelines`: use when the work touches forms, controls, focus states, ARIA, labels, keyboard behavior, or complex responsive UI.

Auto-Hermes command integration:
- `.tools/auto-hermes-skills.mjs --json` is the durable manifest for the frontend design skill stack.
- `.tools/auto-hermes-controller.mjs` must include that manifest in `designContext` for frontend `design-review` rounds.
- `.tools/auto-hermes-loop.mjs` must carry the selected skill stack into the worker prompt before UI implementation.
- If a listed skill is unavailable in the active runtime, the worker must say so plainly and use the nearest verified fallback, never pretend the skill ran.

Conflict order for frontend design rounds:
1. explicit user request and supplied reference
2. verified live runtime state and browser evidence
3. `design.md`
4. surface memory in `.ai-sync/CONTEXT_LEDGER.md`
5. installed frontend design skills
6. generic design taste or model preference

## 1. Creative North Star

Hermes should not look like a generic SaaS dashboard in either theme.

The product aesthetic is **Kinetic Editorial**:
- premium sports journalism meets high-trust performance analytics
- intentional asymmetry over rigid utility grids
- tonal layering over hard separators
- cinematic hierarchy over equal-weight card walls
- data as a coached narrative, not a pile of widgets

The dark and light themes are not separate products. They are two tonal interpretations of the same Hermes design language:
- dark mode is the athlete inside the arena
- light mode is the athlete inside the gallery

In both modes, Hermes should feel:
- premium
- focused
- breathable
- coach-like
- visually decisive

## 2. Mode Selection Rules For Auto-Hermes

When `/auto-hermes` performs meaningful frontend work, it must lock the target theme mode before editing.

Use this order:
1. explicit user request
2. the active runtime theme on the touched surface
3. the visual mode implied by the provided mockup or screenshot
4. the existing approved surface baseline from `.ai-sync/CONTEXT_LEDGER.md`
5. fallback to both-mode-safe styling when the change is shared infrastructure

Before non-trivial frontend implementation, `/auto-hermes` must define:
- target surface
- target mode:
  - `dark`
  - `light`
  - `dual-mode`
- what visual behaviors must remain shared across both modes
- whether the untouched counterpart mode needs a regression check

If a change touches shared tokens, shared cards, shared shell, shared overlays, or theme selectors, treat it as `dual-mode` by default.

If the user supplies only a light-mode or dark-mode reference:
- match that target mode closely
- preserve the same structural hierarchy in the opposite mode
- do not copy colors mechanically into the other mode

## 3. Shared Invariants Across Both Modes

These rules apply in both dark and light themes.

### 3.1 The No-Line Rule

1px solid borders must not be the normal way Hermes defines containment.

Prefer:
- surface shifts
- tonal contrast
- layered backgrounds
- spacing
- glass surfaces
- ghost-border fallback only when clarity demands it

### 3.2 Typography Pairing

Use:
- `Outfit` or `Manrope` for display and headline authority
- `Manrope`, `Satoshi`, or a similarly high-quality sans for body, metadata, and controls when available
- existing route typography only when preserving a mature surface or avoiding a risky broad cascade

Typography should create hierarchy through:
- scale contrast
- spacing
- rhythm
- restraint

Do not rely on bolding alone.

Avoid:
- defaulting to Inter, Arial, Roboto, or system stacks for new premium Hermes surfaces
- oversized centered H1s that dominate the decision the runner needs to make
- serif typography on dashboard or logged-in software UI surfaces unless a user-provided reference explicitly demands it

### 3.3 Cinematic Hierarchy

Each screen should have:
- a clear first focus
- a readable second layer
- restrained supporting metadata

Do not let every card scream at the same volume.

### 3.4 Ambient Depth

Depth should come primarily from:
- surface stacking
- translucency
- soft ambient shadows
- overlap

Avoid:
- tight default web shadows
- box-inside-box repetition
- divider-heavy layouts

### 3.5 Coach Value First

A design change is good only if it improves one or more of:
- decision clarity
- training trust
- perceived readiness
- motivation
- next-action usefulness

Decorative polish without runner value is not enough.

### 3.6 Anti-Generic Frontend Rules

New or meaningfully redesigned Hermes UI must avoid common AI-default patterns:
- no centered hero plus equal three-card feature row when the target surface needs decision hierarchy
- no purple/blue neon SaaS palette unless explicitly requested by the user
- no pure black slabs; use charcoal, warm paper, vellum, or tonal surface steps
- no emoji icons in production UI; use real SVG/icon components
- no heavy default shadows or glow as the main separation mechanism
- no layout motion that animates `top`, `left`, `width`, or `height`; use `transform` and `opacity`
- no mobile design that depends on desktop asymmetry; collapse high-variance grids to a strict single column below tablet widths
- no decorative redesign that removes loading, empty, error, focus, label, or contrast states

## 4. Dark Mode: The Cinematic Athlete

## 4.1 Overview

Dark mode should feel like a premium performance HUD on a deep track at night.

It should communicate:
- focus
- athletic intensity
- compression of noise
- strong visual confidence

## 4.2 Tonal Architecture

Dark mode is rooted in nuanced charcoal tones, never flat black.

Preferred foundation:
- `surface-dim` for the atmospheric background
- `surface-container-low` for main content fields
- `surface-container-high` for interactive cards
- `surface-container-highest` for select controls and raised utilities

Key rules:
- do not use pure `#000000`
- separate sections through tonal steps, not white/grey borders
- use glassmorphism for top bars, floating actions, and overlays with 60-80% tinted fills and at least `16px` blur
- hero surfaces may use a subtle 45-degree coral gradient

## 4.3 Color Role

Use coral accents sparingly and purposefully:
- `#ffb4a7`
- `#f07561`

Coral should signal:
- hero metrics
- active states
- CTA emphasis
- high-value cues

Do not flood the page with coral.

## 4.4 Typography

Dark mode typography should feel high-contrast and engineered.

Recommended behavior:
- large Manrope displays for hero metrics and major page hooks
- smaller Inter labels for metadata
- dramatic size jumps to create editorial cadence

## 4.5 Components

### Buttons
- Primary: `primary-container` fill, `on-primary-container` text, rounded `full`
- Secondary: `surface-container-highest` fill with ghost-border-level separation
- Tertiary: text-only in `primary`

### Inputs
- `surface-container-highest` fill
- no full border
- 2px `primary` emphasis only on focus

### Cards And Lists
- no divider lines between list rows
- use vertical spacing instead
- use `surface-container-low` or `surface-container-high` as the main container step

### Gauges
- semicircular or circular gauges should use the `primary -> tertiary` gradient and remain readable against charcoal layers

## 4.6 Dark Mode Do / Don't

Do:
- use asymmetry
- let visuals bleed to edges
- overlap chips or labels onto charts when useful
- prioritize high-contrast hero numbers

Don't:
- use 1px white or grey borders
- use heavy default shadows
- overfill the screen with low-value detail
- flatten the whole page into one undifferentiated dark slab

## 5. Light Mode: The Aerodynamic Gallery

## 5.1 Overview

Light mode should feel like a warm editorial gallery, not a clinical enterprise dashboard.

It should communicate:
- refinement
- motion through space
- breathable hierarchy
- soft confidence

## 5.2 Tonal Architecture

Light mode transitions into a warm-smoke vellum environment.

Preferred foundation:
- `background` `#f5f6f7`
- `surface-container-low` `#eff1f2`
- `surface-container-lowest` `#ffffff`

Key rules:
- use surface shifts instead of borders for separation
- glass surfaces should use `surface` around 70% opacity with `20px` blur
- primary CTAs should use a 135-degree gradient from `#a0392a` to `#fc7e69`
- ambient depth should come from white-on-vellum stacking, not hard outlines

## 5.3 Color Role

Light mode keeps the same coral family, but with softer environment contrast.

Use coral for:
- CTA hierarchy
- featured metrics
- active selections
- directional cues

Do not let supporting copy fade into the background. Light mode must preserve clear contrast for:
- hero numbers
- helper copy
- labels on charts and gauges
- pills and chips on pale surfaces

## 5.4 Typography

Light mode should still feel cinematic, not lightweight.

Recommended behavior:
- `display-lg` `3.5rem` and `display-md` `2.75rem` in Manrope Bold for hero metrics
- `headline-lg` `2rem` in Manrope for section anchors
- `body-lg` `1rem` and `body-md` `0.875rem` in Inter with relaxed line-height
- technical labels in muted `on_surface_variant` tones with slight tracking expansion

## 5.5 Components

### Buttons
- Primary: gradient from `primary` to `primary-container`, sharp modern corners
- Tertiary: no background, no border, underline only on hover with a 2px accent stroke

### Inputs
- use `surface-container-high` fills
- very small corners
- on focus, shift toward `surface-container-highest` and add a primary ghost-border

### Cards And Lists
- no divider lines
- separate rows through 16px or 24px whitespace
- on hover, cards should move from `surface` toward `surface-container-lowest` with a slightly stronger ambient shadow

### Metric Blocks
- large Manrope values
- labels above or beside the value rather than always stacked below
- keep number contrast explicit on pale surfaces

## 5.6 Light Mode Do / Don't

Do:
- use asymmetry and diagonal flow
- let imagery bleed where it strengthens the composition
- layer glass over photography when needed for readability
- preserve warm editorial contrast

Don't:
- box content into repetitive white cards inside white cards
- use pure black text
- use default web shadows
- leave dark-mode text colors on light cards

## 6. Shared Component Translation Rules

When the same component exists in both modes, preserve:
- information hierarchy
- spacing logic
- component purpose
- interaction semantics
- coach-value clarity

Translate between modes through:
- tonal architecture
- contrast strategy
- ambient shadow behavior
- surface layering
- overlay intensity

Do not translate between modes by merely inverting colors.

Examples:
- a dark glass HUD card becomes a vellum layered card in light mode
- a dark overlay over photography becomes a lighter, fogged editorial veil in light mode
- a bright-on-dark muted label becomes a darker muted label with preserved contrast, not a washed-out near-white

## 7. Auto-Hermes Design Review Requirements

For non-trivial frontend rounds, `/auto-hermes` must review design with theme-awareness.

Before implementation, `/auto-hermes` must lock and carry forward:
- target surface
- target mode: `dark`, `light`, or `dual-mode`
- visual goal
- preserve list
- round type: `visual-bug`, `interaction-bug`, `structural-redesign`, or `mimic-implementation`
- reference source: user reference, `design.md`, current approved live surface, or generated reference
- active frontend skill stack from `.tools/auto-hermes-skills.mjs`

If the round is `dark` or `light` only, the reviewer must still ask:
- did this break readability in the opposite mode if the selector is shared?

If the round is `dual-mode`, the reviewer must check both modes for:
- hierarchy
- readability
- contrast on metrics, pills, charts, gauges, and helper copy
- shell-to-card consistency
- absence of stray hardcoded dark-only or light-only colors

Automatic must-fix triggers for theme work:
- dark-mode text styles left on light surfaces
- light-mode text styles left on dark surfaces
- gauges, chart labels, pills, or helper copy becoming unreadable
- shared card families switching mode in one route but not another equivalent route
- borders reappearing as a substitute for tonal separation
- generic centered hero/card-wall patterns replacing a stronger approved Hermes hierarchy
- unverified frontend design claims without live browser or browser-harness evidence

## 8. Implementation Guidance For Shared Tokens

When building shared theme support:
- prefer shared tokens and shared theme selectors first
- add route-level overrides only when a page has a dedicated cinematic treatment
- preserve one design language across routes
- do not fork each page into unrelated visual dialects

When fixing theme mismatches:
- trace whether the bug comes from tokens, shared card families, or route-local hardcoded styles
- fix the narrowest authoritative layer that resolves the mismatch
- if a page has its own dedicated card family, it still must inherit the current theme language

## 9. Final Do / Don't For Hermes Agents

Do:
- treat dark and light as equal-quality Hermes experiences
- preserve structural rhythm across both modes
- keep contrast intentional on all cards, charts, and gauges
- use `design.md` as a mode-aware system, not a one-theme inspiration note

Don't:
- assume dark mode is canonical and light mode is an afterthought
- ship a "light shell, dark cards" hybrid unless the user explicitly wants that contrast
- solve theme separation with borders
- claim a theme redesign is complete until the actual affected surfaces read coherently in the target mode
