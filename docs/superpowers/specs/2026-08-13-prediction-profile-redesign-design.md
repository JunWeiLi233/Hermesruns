# Prediction Profile Redesign

## Goal

Redesign `/prediction/:distKey` so it feels like a direct extension of the Profile dashboard: compact, editorial, coach-led, and easy to scan, without changing prediction calculations, data loading, routes, localization, or actions.

## Visual Direction

Use the Profile dashboard's Aerodynamic Gallery structure in light mode and its equivalent Cinematic Athlete tones in dark mode. The page should have a compact editorial introduction, one dark forecast focal card, a four-item metric strip, a balanced effort-and-coach grid, and a quieter trend card. Coral remains the shared action accent; each race distance keeps its existing accent color only for forecast-specific signals.

## Information Hierarchy

1. Keep the Analysis Lab navigation and global top bar unchanged.
2. Present the predicted finish time as the first visual focus in a bounded dark focal card.
3. Keep confidence, trend direction, evidence basis, and primary actions inside that focal card.
4. Move VDOT, race pace, sample count, and recent-match evidence directly below the focal card as compact Profile-style metrics.
5. Pair the effort ladder with the coach recommendation in a two-column training grid.
6. Finish with the 90-day prediction trend in one light tonal card.

## Responsive Behavior

Desktop uses the Profile dashboard's padded full-width canvas and asymmetric two-column sections. Tablet collapses the forecast focal card and training grid to one column. Mobile uses a strict single column, two-column metric tiles where space permits, compact effort rows, full-width actions, and no horizontal overflow.

## States And Accessibility

Retain loading, empty-data, and chart fallbacks. Preserve semantic sections, button labels, focus-visible treatment, chart theme colors, reduced-motion behavior, and keyboard-accessible shared navigation. No user-facing copy changes are required.

## Implementation Boundary

- Reorder existing JSX in `PredictionDetail.jsx`; do not alter prediction logic.
- Add a dedicated late-loaded `prediction-profile-alignment.css` stylesheet scoped to `.prediction-detail-page`.
- Update the prediction skeleton to reserve the new loaded geometry.
- Add a route-specific smoke test and register it in the frontend test runner.
- Add a design-version record.

## Preserve List

Preserve authentication, `/api/activities`, VDOT calculations, calibrated race prediction, confidence score, effort predictions, coach recommendation, chart datasets and tooltips, all four distance routes, Analysis Lab navigation, top-bar actions, localization, themes, responsive navigation, and reduced-motion behavior.

