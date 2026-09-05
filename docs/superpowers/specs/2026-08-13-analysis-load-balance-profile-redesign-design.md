# Analysis Load Balance Profile Redesign

## Status

Approved direction: decision-first Profile alignment.

## Surface

- Route: `/analysis/load-balance`
- Component: `frontend/src/pages/analysis/AnalysisInsightDetail.jsx`
- Visual reference: authenticated `/profile` dashboard in light mode
- Scope: Load Balance content only; the Analysis-specific Profile-style sidebar remains unchanged

## Goal

Make Load Balance read like the Profile dashboard: lead with the runner's decision, then show the evidence behind it. Replace the oversized title-first composition with a compact status header, a dominant coaching recommendation, and progressively quieter analytical detail.

## Preserve List

- Existing ACWR, acute load, chronic load, load delta, and injury-risk calculations
- Interactive 20-day acute/chronic SVG chart and pointer scrubber
- Training-window result and Today Run navigation
- Recent-run rows, run-detail navigation, and Runs navigation
- Existing API requests, auth behavior, loading/error handling, units, and translations
- Analysis-specific navigation rail and active route state
- Light, midnight, and high-contrast themes
- Desktop, tablet, mobile, keyboard focus, and reduced-motion behavior

## Information Hierarchy

1. Compact page header with back action, training-load label, title, ACWR ring, and current zone.
2. Primary coach decision card with judgment, explanation, training window, and Today Run CTA.
3. Evidence workbench with the 20-day chart as the main panel and ACWR gauge as the supporting panel.
4. Four compact metric tiles for acute load, chronic load, delta, and injury signal.
5. Recent training ledger with the three existing run rows and archive actions.
6. Methodology section last, visually quiet but always accessible.

## Visual System

- Reuse Profile's local visual grammar rather than its class names: warm editorial canvas, compact Manrope hierarchy, coral directional accents, tonal card separation, and restrained radii.
- Use one dark coached-decision card as the dominant surface, corresponding to Profile's Today Run card.
- Use translucent white evidence cards in light mode and warm charcoal tonal steps in midnight mode.
- Remove equal-weight card-wall behavior. Supporting metrics should be compact and the methodology should not compete with the recommendation.
- Keep borders subtle; rely primarily on surface shifts, whitespace, and ambient depth.
- Use a short staggered rise on major sections and disable it under `prefers-reduced-motion`.

## Responsive Behavior

- Desktop: coach decision spans the width; chart and ratio use an asymmetric two-column workbench; metrics use four columns.
- Tablet: workbench and lower content collapse to one column; metrics use two columns.
- Mobile: all sections stack; the header status becomes horizontal and compact; chart retains a usable minimum height; run-row metrics wrap without horizontal overflow.

## Implementation Shape

- Recompose only the `load-balance` JSX branch using route-specific class names.
- Add a dedicated `analysis-load-balance-profile-alignment.css` imported after current Analysis styling so the redesign owns the live cascade without broad overrides.
- Keep current model fields and event handlers; add derived presentation fields only if needed.
- Extend the existing Analysis smoke guard to assert decision-first section order, preserved chart interaction, preserved navigation targets, and the dedicated stylesheet import.
- Append a new `DESIGN_VERSIONS.md` entry after implementation.

## Verification

- Run the targeted Analysis smoke test.
- Run the frontend build and frontend runtime-sync verifier.
- Use the in-app Browser on authenticated `/analysis/load-balance` at desktop and mobile widths.
- Verify chart pointer interaction, Today Run CTA, recent-run navigation, sidebar presence, no horizontal overflow, and browser console errors.
- Compare the result with `/profile` for hierarchy, spacing, typography, tonal cards, and responsive collapse.
