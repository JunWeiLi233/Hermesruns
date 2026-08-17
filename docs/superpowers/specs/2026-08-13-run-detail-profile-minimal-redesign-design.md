# Run Detail Profile Minimal Redesign

## Scope

- Surface: `/run/:id`, validated against `/run/1680`.
- Mode: dual-mode, with Profile's light dashboard as the primary reference and a dark-mode token map for parity.
- Reference source: Hermes `/profile`, especially `.hd-content`, `.hd-hero`, `.hd-today-card`, `.hd-metric-strip`, and `.hd-progression`.
- Round type: focused visual redesign. No API, calculation, routing, or data-model changes.

## Goal

Make Run Detail feel like a natural drill-down from Profile: calm, editorial, and evidence-led. Remove the current oversized title, ornamental background, border-heavy cards, duplicated distance overlay, and competing visual weights without hiding advanced run data.

## Information Hierarchy

1. A compact page header carries back navigation, activity title, date/location metadata, provider, resync, and share actions.
2. The route map is the primary visual; distance, pace, and moving time form a compact evidence rail beside it.
3. Coach debrief remains the single dark editorial feature card, paired with a quiet linked-gear card.
4. Comparison, telemetry, splits, and performance metrics follow as full-width evidence sections with consistent headings and surfaces.

## Visual System

- Canvas: inherit the authenticated runner shell rather than painting a second page background.
- Typography: Profile-scale Outfit/Manrope hierarchy, with a `2.45rem` maximum page title instead of the current oversized display treatment.
- Surfaces: translucent warm-white cards in light mode and restrained charcoal cards in dark mode; containment comes from tone and spacing, not persistent borders.
- Accent: coral is reserved for active controls, focus, and high-value cues. The distance card and coach debrief use Profile's dark editorial treatment.
- Radius: `20px` for feature surfaces, `16px` for regular cards, `12px` for nested controls.
- Depth: one soft ambient shadow for feature surfaces; ordinary data panels stay flat.
- Motion: a short opacity/translate page reveal only, disabled for reduced motion.

## Responsive Behavior

- Desktop: map plus a one-column metric rail; coach debrief plus gear.
- Tablet: map stacks above a three-column metric strip; coach and gear stack naturally.
- Mobile: all content becomes one column, controls wrap, telemetry tabs become a two-column compact grid, tables remain horizontally scrollable, and map height is capped.

## Preserve List

- Shared authenticated runner shell, Runs breadcrumb/subnavigation, and footer.
- `/runs` back navigation, settings/profile shell actions, share, and Strava resync.
- Real route map and all activity-derived values.
- Coach debrief, run comparison, telemetry tabs/chart/readout, training effect, device metrics, elevation warning and recalibration.
- Shoe link/change/unlink picker behavior and status messaging.
- Splits expansion, fastest-lap highlight, performance metrics, loading, empty, and error states.
- English/Chinese copy, units, themes, keyboard focus, and reduced-motion behavior.

## Acceptance Criteria

- Run Detail uses a dedicated final CSS layer imported after shared page treatments, so its Profile hierarchy is deterministic.
- The loaded route opts into `run-detail-profile-minimal`; loading and empty states retain the shared cockpit base.
- The duplicate map distance overlay is removed; the metric rail is the only distance summary.
- Gear has its own section heading, eliminating the CSS margin-offset hack used to align it with Coach Debrief.
- Desktop, tablet, and mobile layouts avoid horizontal page overflow.
- Existing Run Detail behavior guardrails, targeted redesign smoke test, frontend build, runtime sync, and HTTP proof pass.

