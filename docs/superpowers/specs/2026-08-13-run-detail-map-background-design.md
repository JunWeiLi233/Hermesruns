# Run Detail Map Background Design

## Scope

- Surface: `/run/:runId` loaded state only.
- Round type: focused visual and layout redesign.
- Reference: the supplied OpenStreetMap screenshot and the existing Profile-minimal Run Detail treatment.
- No API, route calculation, telemetry, shoe, sharing, resync, localization, or theme contract changes.

## Goal

Promote the route map from a contained hero card to the spatial background of the Run Detail workspace. The map must fill the authenticated main column while stopping exactly at the Runs subnavigation boundary. Run evidence remains readable and operational above the map.

## Recommended Composition

1. The shared Runs subnavigation remains the fixed left rail and highest-level boundary.
2. `.runner-shell-main` becomes the stacking owner for the Run Detail background.
3. The existing Leaflet route map renders in a viewport-anchored full-bleed plane behind the Run Detail canvas, preserving route fitting, zoom controls, drag, and scroll-wheel zoom without creating a page-height Leaflet viewport.
4. The shared topbar remains above the map with its existing translucent treatment.
5. Activity title, metrics, coach evidence, telemetry, gear, splits, and performance sections render in a centered foreground content column.
6. A restrained map veil improves text contrast without obscuring route geography. Foreground data cards use warm, mostly opaque surfaces rather than low-contrast glass.

## Boundary And Interaction Contract

- The map is mounted inside `.runner-shell-main`, not the page root or `body`. Its fixed desktop edge follows the shell's published `--runner-nav-expanded-width` and `--runner-nav-collapsed-width` variables rather than duplicating numeric sidebar widths.
- The background layer cannot overlap or receive pointer events beneath `.runs-subnav`.
- Exposed map regions remain interactive. Foreground cards and controls retain normal pointer and keyboard behavior.
- Leaflet controls remain reachable, visible, and clear of the sticky topbar and primary evidence cards.
- The existing route polyline, tile attribution, `fitBounds`, and resize invalidation behavior are preserved.
- When route points are unavailable, the page uses the existing no-map fallback and a normal warm canvas rather than an empty map background.

## Responsive Behavior

- Desktop: the map fills the right-hand main workspace from below/behind the topbar through the loaded page, while content floats in a centered column above it.
- Tablet: the main-column background remains full bleed; evidence grids collapse using the current Profile-minimal breakpoints.
- Mobile at the shared `860px` shell breakpoint: the Runs rail becomes a top navigation strip, and the map returns to a contained route panel below the activity header. This avoids trapping vertical page scrolling inside a full-screen interactive map.
- No viewport may introduce horizontal page overflow.

## Visual System

- Preserve the current Outfit/Manrope Profile hierarchy and coral route/accent language.
- Use a neutral map veil with a slightly stronger fade beneath long-form evidence sections.
- Use high-opacity warm cards in light mode and high-opacity charcoal cards in dark/high-contrast mode.
- Keep ordinary cards flat; reserve shadow for the primary metric/evidence cluster.
- Preserve visible focus outlines and reduced-motion behavior.

## Preserve List

- Shared authenticated shell, Runs subnavigation, collapse state, breadcrumb, notifications, settings, and profile actions.
- Real Leaflet tiles, route points, polyline, fitting, zoom, drag, attribution, and cleanup.
- Back navigation, provider badge, Strava resync, and share behavior.
- All existing run metrics, coach debrief, comparison, telemetry, training effect, elevation controls, gear linking, splits, and performance details.
- Loading, empty, no-route, error, English/Chinese, unit, theme, keyboard, and reduced-motion behavior.

## Verification

- A smoke assertion proves the map background is mounted inside `.runner-shell-main` and outside the foreground evidence canvas.
- CSS assertions prove the main column is the clipping context, foreground content is above the map, and mobile restores a contained map panel.
- Existing Run Detail smoke coverage passes.
- The frontend build and runtime-sync proof pass.
- Browser QA covers expanded and collapsed desktop rails, exposed map interaction, card readability, mobile scrolling, no-route fallback, and light/dark contrast.
