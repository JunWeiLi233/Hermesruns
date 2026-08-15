# Analysis Subnav Toggle Design

## Summary

Redesign the desktop collapse toggle used by `AnalysisSubpageNav` so it remains visibly and structurally contained within the Analysis rail header. Preserve all navigation, collapse-state, localization, theme, and mobile behavior.

## Problem

The shared Profile sidebar styles place the toggle in a flexible brand row. The Analysis rail adds denser branding inside a narrow sidebar and clips sidebar overflow. This allows the toggle to become visually crowded against the rail boundary, producing the misaligned appearance shown in the reported screenshot.

## Approved Direction

Use the inset header control shown as Option A in the visual companion.

- Expanded desktop state: make `.analysis-subnav-header` a two-column layout with a shrinkable brand column and a fixed 40px toggle target.
- Visible control: render a centered 32px warm-paper circular surface inside the 40px button target.
- Collapsed desktop state: switch the header to one column and center the toggle beneath the compact brand mark.
- Keep the control fully inside the sidebar. Do not use negative offsets, edge overlap, or visible-overflow exceptions.
- Keep the current chevron direction, button semantics, accessible label, and `aria-pressed` state.
- Continue hiding the toggle at the existing mobile breakpoint, where the Analysis navigation becomes horizontal.

## Component Boundaries

`AnalysisSubpageNav.jsx` continues to own the control and its existing behavior. `analysis-subnav.css` owns the Analysis-specific positioning and appearance overrides. Shared Profile sidebar styles remain unchanged so unrelated Hermes surfaces are not affected.

## States

- Expanded: the brand and toggle share one header row; neither can overlap or push outside the rail.
- Collapsed: the brand mark and toggle form a centered vertical stack within the 96px rail.
- Hover and focus-visible: preserve a clear state change without translating the control toward an edge.
- Mobile at 860px and below: retain the existing hidden toggle and horizontal navigation.
- Midnight and high-contrast themes: use existing Analysis navigation tokens for readable border, surface, and glyph colors.

## Verification

- Add a source-level regression assertion for the fixed header grid and contained toggle target.
- Run the Analysis subnav smoke test and prediction alignment smoke test.
- Run targeted lint if JSX changes are required.
- Build the frontend and run the Hermes frontend runtime-sync proof.
- Inspect the expanded and collapsed control in the in-app browser at desktop width.

## Preserve List

- Routes and active-link behavior.
- Collapse state and page-width transitions.
- Current translations and accessible button labels.
- Prediction and Analysis Insight page data loading.
- Responsive horizontal navigation at 860px and below.
