# Races Detail Map Stage Design

Date: 2026-04-19
Surface: `/races/details/:raceId`
Status: approved design, awaiting user review of written spec

## Goal

Repair the broken race-detail map experience by redesigning the lower map area into a dominant full-width Leaflet world-map stage that feels clearly interactive and uses the AI-scanned result only as a georeferenced route line.

This is not a hero redesign and not a backend workflow rewrite. The existing hero, course/elevation section, and race-detail data flow remain in place unless the map-stage implementation requires narrowly scoped supporting adjustments.

## User-Approved Direction

- Use the lower grid as a dominant full-width map block.
- Embed a real Leaflet world map in that block.
- Show the AI-scanned result as only the georeferenced route line on the map.
- Do not render the scanned course-map image overlay in this block.

## Problem Summary

The current race-detail map block is broken at the product level because it no longer reads as a trustworthy interactive map stage. Even when Leaflet exists in code, the block has recently drifted between static fallbacks, hero-map experiments, and lower-card restoration passes. That history makes it too easy for the surface to look like an image, mount unreliably, or communicate the wrong hierarchy.

The redesign should make the map block structurally unambiguous:

- the map is the main visual object
- the route line is the main AI outcome
- the user can drag and zoom without fighting the UI
- the surrounding cards support the map instead of competing with it

## Scope

### In scope

- Redesign the lower map area into a single dominant full-width map stage.
- Move the readiness/playbook content below the map stage instead of beside it.
- Keep the Leaflet map mounted in the lower content area, not in the hero.
- Render the AI-scanned route as a Leaflet polyline with start/finish markers.
- Preserve one-time route framing, then preserve user pan/zoom.
- Keep the city-context Leaflet fallback when a trustworthy aligned route is unavailable.
- Remove visual fallback treatments that make the map stage read as a static image card.
- Add/update focused smoke tests that enforce the new structure.

### Out of scope

- Redesigning the hero section.
- Bringing back scanned course-map image overlays in the runner-facing map card.
- Changing the backend route extraction pipeline.
- Reworking the course/elevation chart above the map stage.
- Changing race prediction, coach copy, or route-trust heuristics beyond what is necessary for this map-stage behavior.

## Design Principles

### 1. Map-first hierarchy

The lower map block should feel like the main spatial stage of the race-detail page, not an equal-weight utility card. The map gets the full row. Supporting actions and readiness information are demoted to the row beneath it.

### 2. Real map truthfulness

The block must always read as a real map surface, not a poster, screenshot, or pseudo-map image. If the route is unavailable, the fallback is still a real Leaflet city-context map.

### 3. Route-only AI result

The AI output on this surface is the interpreted route geometry, not the scanned source image. The runner should see the route aligned to geography, not a confidence-sensitive image overlay.

### 4. User control after initial framing

The page may auto-frame the route once on mount or on valid route arrival, but it must not keep snapping back after the user starts interacting.

### 5. Preserve product rhythm

The hero remains editorial. The course/elevation section remains analytical. The redesigned map stage becomes the spatial center of the page between those layers and the readiness/playbook content beneath it.

## Target Layout

## Overall page rhythm

1. Editorial hero
2. Command strip
3. Course/elevation card
4. Full-width map stage
5. Readiness/playbook card below the map

## Lower section structure

Replace the current two-column lower grid with a stacked structure:

1. `race-detail-map-stage`
2. `race-detail-readiness-card`

The map stage spans the full available width of the lower content area.

## Map stage composition

The map stage contains:

- a full-bleed Leaflet canvas
- a small floating HUD in one corner
- optional small supporting pills or labels for route source / interaction hint
- no large copy slabs over the center of the map
- no image-like fallback layer beneath or above the map

The HUD should be visually light:

- route source: AI-scanned and georeferenced
- confidence/state: if available and meaningful
- interaction hint: drag and zoom

The HUD should not dominate the block or reduce the visible route area.

## Visual treatment

The block should follow the current Hermes dark/light dual-mode language:

- dark mode: deep world-map stage with restrained glass HUD
- light mode: vellum/airier card shell with the same hierarchy

The route line should remain the strongest accent element in the block.

Recommended visual rules:

- keep the map stage tall enough to feel immersive
- avoid centered poster framing
- avoid heavy map chrome
- avoid decorative overlays that dim the actual map too much
- keep the route line and start/finish markers high-contrast in both modes

## Interaction Behavior

## Leaflet map behavior

- Mount a real Leaflet map inside the full-width stage.
- Use the existing same-origin tile path first.
- Fall back to OpenStreetMap tiles if same-origin tile loading fails.
- Keep zoom and drag enabled.

## Route rendering

When `deriveRaceMapTrust(...)` and the normalized route data indicate a trustworthy route:

- render the route as a Leaflet polyline
- render start and finish markers
- frame the route once using trusted viewport bounds when available

Do not render `L.imageOverlay(...)` for the runner-facing map stage in this design.

## Fallback behavior

If the route is unavailable or not trustworthy:

- show a real Leaflet city-context map centered around the race
- do not replace the map with a static image, poster, or tile screenshot
- keep the block visually consistent so the user still sees an interactive map stage

## User pan/zoom preservation

- Keep the existing one-time initial viewport model.
- After the initial forced fit, later user pan/zoom must remain in control.
- Avoid repeated refit calls triggered by benign re-renders.

## Data Flow

## Existing sources to preserve

- `/api/races/course-map`
- `normalizeCourseMapPayload(...)`
- `deriveRaceMapTrust(...)`
- existing `routePoints`, `viewportBounds`, and race fallback location data

## Behavioral interpretation

The backend and trust layer continue to determine whether the AI-scanned result is trustworthy enough to use as route geometry.

The frontend interpretation changes as follows:

- trust gate still governs route usage
- trust gate no longer governs whether a scanned image overlay is painted in the runner map stage
- the only trusted AI visualization in this stage is the georeferenced route line itself

## Component Boundaries

## `RacesDetail.jsx`

Owns:

- page structure
- map-stage composition
- Leaflet mount lifecycle
- route rendering
- fallback city map behavior
- readiness-card placement under the map

Should not own:

- a second DOM-based map fallback layer
- poster-style map presentation logic
- conflicting hero-map and lower-map layouts at the same time

## `raceDetailMapTrust.js`

Continues to own:

- route trust
- overlay trust calculations if still useful elsewhere
- viewport derivation from trustworthy route geometry

This redesign does not require deleting overlay-trust utilities immediately, but the runner-facing map stage should no longer depend on painting the overlay image.

## CSS structure

Prefer a dedicated map-stage class family over leaving dead styles around as the primary styling model. Existing unused map-copy, map-actions, static-fallback, and similar classes should be reduced or removed if they no longer describe runtime behavior.

## Error Handling and Edge Cases

### Missing route data

Show the city-context Leaflet map with no broken UI state.

### Tile failures

Keep the existing same-origin to OSM fallback behavior.

### Async route arrival

The map must reinitialize or update cleanly when route data arrives after the page becomes ready.

### Re-renders

Avoid duplicate map instances and stale mount races.

### Mobile layout

On smaller screens:

- keep the full-width map stage
- reduce HUD density
- place the readiness/playbook card below the map as a natural stacked continuation

## Testing Strategy

## Source guardrails

Update smoke tests to assert the new design contract:

- the lower area is map-first and full-width
- the readiness card is no longer a side-by-side partner to the map
- the runner-facing map stage does not use `L.imageOverlay(...)`
- the runner-facing map stage does not render DOM static-map fallback layers
- the map remains in the lower section, not the hero
- initial viewport framing remains one-time

## Runtime verification

For implementation completion:

- `node frontend/src/pages/raceDetailCourseMapOverlay.smoke.test.js`
- any related map lifecycle/trust smoke tests
- `cd frontend && npm run lint`
- `cd frontend && node scripts/run-vite-build.mjs`
- `node .tools/verify-frontend-runtime-sync.mjs --files "..."`

If practical during implementation, also manually verify:

- `/races/details/tokyo-marathon`
- drag and zoom remain responsive
- route line appears on geography
- no visual fallback image layer appears

## Risks

### 1. Over-correcting into a bare map

If the HUD becomes too minimal, the block may lose orientation. Keep a small amount of route/source context visible.

### 2. Reintroducing snap-back behavior

Layout refactors can accidentally re-trigger viewport fitting. Preserve the existing one-time framing discipline.

### 3. CSS drift from legacy classes

Leaving old map-copy/fallback structures partially active can create confusing stacking bugs. The implementation should simplify the map-stage DOM and CSS together.

### 4. Trust-layer confusion

The app may still calculate overlay trust, but that should not imply overlay-image rendering on this runner-facing stage.

## Implementation Notes

Implementation should prefer a small structural rewrite over patching the current lower grid incrementally. The main target is a clearer DOM structure:

- one full-width map stage
- one Leaflet owner surface
- one smaller readiness/playbook card below

That is safer than preserving the current split-grid assumptions and trying to stretch them into a map-first layout.
